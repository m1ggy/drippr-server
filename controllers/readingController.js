const { scheduler } = require('../classes/scheduler');
const { add } = require('../firebase/firestore');
const moment = require('moment');
const { postRequest } = require('../utils');
const { notifs } = require("../classes/notifications");
const { update } = require("../firebase/firestore");

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
            console.info(
                `New Reading ${new Date(timestamp).toLocaleString('en-US', {
                    timeStyle: 'medium',
                    dateStyle: 'medium',
                    hour12: true,
                })}: { id: ${parsed.id}, value: ${parsed.value} }`
            );
            const id = await add('readings', { ...parsed, timestamp });
            console.log(global.substrates)
            // check if the new reading is below threshold, if it is, run irrigation
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
            console.log({ currentSubstrate });
            if (currentSubstrate && currentSubstrate.valveStatus == false) {
                // get the plan for that plot
                const [currentPlan] = global.plans.filter(
                    (plan) => plan.plotId == currentSubstrate.plotId
                );
                console.log({ currentPlan });

                if (currentPlan) {
                    if (currentPlan.type === 'SENSOR_BASED' && currentPlan.active == true) {
                        // if the parsed value is less than equals the minimum threshold of the current plan, start irrigating
                        if (currentPlan.threshold.min <= parsed.value) {

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
