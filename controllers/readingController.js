const {add} = require('../firebase/firestore');
const {postRequest} = require('../utils');

const addReading = async (req, res) => {
    try {
        const {
            body: {data, timestamp},
        } = req;

        if (!data || !timestamp)
            return res
                .status(404)
                .json({message: 'Missing arguments', data, timestamp});

        const parsed = JSON.parse(data);
        if (!parsed.id || !parsed.value)
            return res.status(404).json({message: 'data is incomplete.'});

        if (parsed.type == 'trigger') {
            res.status(200).json({message: 'trigger success', status: 200});
            return;
        } else {
            console.info(
                `New Reading ${new Date(timestamp).toLocaleString('en-US', {
                    timeStyle: 'medium',
                    dateStyle: 'medium',
                    hour12: true,
                })}: { id: ${parsed.id}, value: ${parsed.value} }`
            );
            const id = await add('readings', {...parsed, timestamp});

            res.status(200).json({message: 'success', status: 200, id});
        }
    } catch (error) {
        console.error(`AddReading Error: ${error.message}`);
        return res.status(404).json({message: `${error.message}`});
    }
};

const getReading = (req, res) => {
    res.status(200).json({message: 'Success'});
};

module.exports = {
    addReading,
    getReading,
};
