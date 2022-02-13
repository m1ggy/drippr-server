const jwt = require('jsonwebtoken');
const axios = require('axios');
const { fetchCollection } = require('./firebase/firestore');

async function postRequest(url, data) {
    const res = await axios.post(url, data);
    return res.data;
}
function sign(payload) {
    if (JSON.stringify(payload) == '{}' || !payload) return null;
    return jwt.sign(payload, process.env.JWT_SECRET);
}
function verify(token) {
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET) || null;
}

async function refreshData(type) {
    switch (type) {
        case 'substrates':
            substrates = await fetchCollection('substrates');
            break;
        case 'plans':
            plans = await fetchCollection('plans');
            break;
        case 'all':
            substrates = await fetchCollection('substrates');
            plans = await fetchCollection('plans');
            crops = await fetchCollection('crops');
            break;

        default:
            break;
    }
}

/**
 * 
 * @param {Date} date 
 * @returns {String} cron expression
 */
function convertToCron(date) {
    let mins = date.getUTCMinutes();
    let hours = date.getUTCHours();

    return `${mins} ${hours} * * *`;
}

module.exports = { sign, verify, postRequest, refreshData, convertToCron };
