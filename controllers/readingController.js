const { scheduler } = require('../classes/scheduler');
const { add } = require('../firebase/firestore');
const moment = require('moment');
const { postRequest } = require('../utils');
const { notifs } = require("../classes/notifications");
const { update } = require("../firebase/firestore");

function randomRange(min, max) {
    return ~~(Math.random() * (max - min + 1)) + min
}

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
            res.status(200).json({ message: 'success', status: 200 });
        }
        else {
            if (parsed.id.toLowerCase().includes("cps")) {
                const max = 25;
                const min = 35;
                parsed.value = randomRange(min, max);
            } else {
                const max = 75;
                const min = 65;
                parsed.value = randomRange(min, max);
            }
            console.log(
                `New Reading ${new Date(timestamp).toLocaleString('en-US', {
                    timeStyle: 'medium',
                    dateStyle: 'medium',
                    hour12: true,
                })}: { id: ${parsed.id}, value: ${parsed.value} }`
            );
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
                        // if the parsed value is less than equals the minimum threshold of the current plan, start irrigating
                        if (parseInt(currentPlan.threshold.min) >= parseInt(parsed.value)) {
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
                        } else if (parseInt(currentPlan.threshold.max) <= parseInt(parsed.value)) {
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
