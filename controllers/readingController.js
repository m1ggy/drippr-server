const { scheduler } = require('../classes/scheduler');
const { add } = require('../firebase/firestore');
const { postRequest } = require('../utils');
const moment = require('moment');
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
            const id = await add('dhtreadings', { ...parsed, timestamp });
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

            // check if the new reading is below threshold, if it is, run irrigation
            const [currentSubstrate] = global.substrates.filter((substrate) =>
                substrate.sensors.includes(parsed.id)
            );

            if (currentSubstrate) {
                // get the plan for that plot
                const [currentPlan] = global.plans.filter(
                    (plan) => plan.plotId == currentSubstrate.plotId
                );
                if (currentPlan) {
                    if (currentPlan.type === 'SENSOR_BASED') {
                        // if the parsed value is less than equals the minimum threshold of the current plan, start irrigating
                        if (currentPlan.threshold.min <= parsed.value) {
                            const wateringTime = scheduler.getWateringTime(
                                currentPlan.id,
                                moment().valueOf()
                            );
                            // start irrigating
                            scheduler.run('irrigate', {
                                id: substrate.valveId,
                                type: 'trigger',
                                value: true,
                            });
                            // stop the irrigation based on the computed watering time
                            scheduler.schedule(wateringTime, 'irrigate', {
                                id: currentSubstrate.valveId,
                                type: 'trigger',
                                value: false,
                            });
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
