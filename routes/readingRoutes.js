const express = require('express');
const routes = express.Router();
const {addReading, getReading} = require('../controllers/readingController');
const {update, add} = require('../firebase/firestore');
const {postRequest} = require('../utils');

routes.post('/', addReading);

routes.get('/:id', getReading);

routes.post('/test', async (req, res) => {
    try {
        const {body} = req;

        if (!body) throw new Error('No body');

        const postData = await postRequest(process.env.RPI_URL, body);

        if (!postData) throw new Error('An error occurred');

        console.log(postData);

        const [cur] = substrates.filter((x) => x.valveId === postData.id);

        if (!cur) throw new Error('An error occurred');

        await update('substrates', cur.id, {valveStatus: postData.value});

        res.status(200).json({message: 'success'});
    } catch (error) {
        return res.status(404).json({error: error.message});
    }
});

module.exports = routes;
