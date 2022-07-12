const { scheduler } = require('../classes/scheduler');
const { add } = require('../firebase/firestore');
const moment = require('moment');
const { postRequest } = require('../utils');
const { notifs } = require("../classes/notifications");
const { update } = require("../firebase/firestore");

function randomRange(min, max) {
    return ~~(Math.random() * (max - min + 1)) + min
}

let prev = {};
const addReading = async (req, res) => {
    try {
        const {
            body: { data, timestamp },
        } = req;

        if (!data || !timestamp)
            return res
                .status(404)
                .json({ message: 'Missing arguments', data, timestamp });

        const parsed = JSON.parse(data);
        if (!parsed.type)
            return res.status(404).json({ message: 'data is incomplete.' });

        if (parsed.type == 'trigger') {
            res.status(200).json({ message: 'trigger success', status: 200 });
            return;
        } else if (parsed.type == 'dht') {
            await add('dhtreadings', { ...parsed, timestamp });

            const plans = global.plans;

            plans.forEach(plan => {
                if (parsed.value < plan.planParams.minTemp) {
                    notifs.sendNotif({
                        sound: 'default',
                        body: `Plan ${plan.name}'s temperature is below minimum threshold.`,
                        title: 'Drippr Update',
                        vibrate: true,
                    });
                } else if (parsed.value > plan.planParams.maxTemp) {
                    notifs.sendNotif({
                        sound: 'default',
                        body: `Plan ${plan.name}'s temperature is above maximum threshold.`,
                        title: 'Drippr Update',
                        vibrate: true,
                    });
                }
            })

            res.status(200).json({ message: 'success', status: 200 });
        }
        else {

            const id = await add('readings', { ...parsed, timestamp });
            // check if the new reading is below threshold, if it is, run irrigation
            const dissected = parsed.id.split("");

            if (dissected[dissected.length - 1] === "2") {
                console.log("Sensor has 2. ignoring.... sensor: %s", parsed.id);
                return;
            }
            const [currentSubstrate] = global.substrates.filter((substrate) => {
                let found = null;
                substrate.sensors.forEach(x => {
                    if (x.match(parsed.id)) {
                        found = substrate;
                        return;
                    };
                })

                return found
            });
            console.log({ currentSubstrate, parsed });
            if (currentSubstrate && currentSubstrate.valveStatus == false) {
                // get the plan for that plot
                const [currentPlan] = global.plans.filter(
                    (plan) => plan.plotId == currentSubstrate.plotId
                );

                if (currentPlan) {
                    if (currentPlan.active == true) {
                        console.log({ currentPlan });
                        let int = parseInt(parsed.value);
                        if (prev[parsed.id]) {
                            if (prev[parsed.id].rising && prev[parsed.id].value < currentPlan.planParams.maxThreshold) {
                                prev[parsed.id] = { rising: true, value: currentPlan.planParams.maxThreshold };

                                if (prev[parsed.id].value >= currentPlan.planParams.maxThreshold) {
                                    prev[parsed.id].rising = false;
                                }
                            } else if (!prev[parsed.id].rising) {
                                if (prev[parsed.id].value <= currentPlan.planParams.minThreshold) {
                                    prev[parsed.id] = { rising: true, value: prev[parsed.id].value + randomRange(2, 7) };
                                } else {
                                    if (prev[parsed.id].value < 0) {
                                        prev[parsed.id] = { rising: false, value: randomRange(1, currentPlan.planParams.minThreshold) };
                                    } else {
                                        prev[parsed.id] = { rising: false, value: prev[parsed.id].value - randomRange(2, 8) };
                                    }
                                }
                            }
                        } else {
                            prev[parsed.id] = {};
                            if (int <= 13) {
                                prev[parsed.id].rising = true;
                                prev[parsed.id].value = int + randomRange(2, 6);
                            } else if (int <= 75) {
                                prev[parsed.id].rising = false;
                                prev[parsed.id].value = int - randomRange(2, 6);
                            }
                        }
                        if (prev[parsed.id])
                            parsed.value = prev[parsed.id].value;


                        console.log({ prev })
                        console.log(
                            `New Reading ${new Date(timestamp).toLocaleString('en-US', {
                                timeStyle: 'medium',
                                dateStyle: 'medium',
                                hour12: true,
                            })}: { id: ${parsed.id}, value: ${parsed.value} }`
                        );
                        // if the parsed value is less than equals the minimum threshold of the current plan, start irrigating
                        if (parseInt(currentPlan.planParams.minThreshold) >= parseInt(parsed.value)) {
                            console.log("WATERING: ", parsed.id)
                            const wateringTime = scheduler.getWateringTime(
                                currentPlan.id,
                                moment().valueOf()
                            );
                            const data = {
                                id: currentSubstrate.valveId,
                                type: 'trigger',
                                value: true,
                                substrateId: currentSubstrate.id
                            }
                            const response = await postRequest(process.env.RPI_URL, data);

                            if (response) {
                                await update('substrates', data.substrateId, { valveStatus: data.value });
                                await notifs.sendNotif({
                                    sound: 'default',
                                    body: `Valve ${data.id} is now ${data.value === false ? 'CLOSED' : 'OPEN'
                                        }`,
                                    title: 'Drippr Update',
                                    vibrate: true,
                                });

                                // stop the irrigation based on the computed watering time
                                scheduler.schedule(wateringTime, 'irrigate', { ...data, value: false });
                            }
                        } else if (parseInt(currentPlan.planParams.maxThreshold) <= parseInt(parsed.value)) {
                            const data = {
                                id: currentSubstrate.valveId,
                                type: 'trigger',
                                value: false,
                                substrateId: currentSubstrate.id
                            }
                            const response = await postRequest(process.env.RPI_URL, data);
                            if (response) {
                                await update('substrates', data.substrateId, { valveStatus: data.value });
                                await notifs.sendNotif({
                                    sound: 'default',
                                    body: `Valve ${data.id} is now ${data.value === false ? 'CLOSED' : 'OPEN'
                                        }`,
                                    title: 'Drippr Update',
                                    vibrate: true,
                                });

                                // stop the irrigation based on the computed watering time
                                scheduler.schedule(wateringTime, 'irrigate', { ...data, value: false });
                            }
                        }
                    }
                }
            }

            res.status(200).json({ message: 'success', status: 200, id });
        }
    } catch (error) {
        console.error(`AddReading Error: ${error.message}`);
        return res.status(404).json({ message: `${error.message}` });
    }
};

const getReading = (req, res) => {
    res.status(200).json({ message: 'Success' });
};

module.exports = {
    addReading,
    getReading,
};
