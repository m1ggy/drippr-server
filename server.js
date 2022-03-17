const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const authRoutes = require('./routes/authRoutes');
const readingRoutes = require('./routes/readingRoutes');
const { scheduler } = require('./classes/scheduler');
const { refreshData, postRequest } = require('./utils');
const { init } = require('./globals');
const { notifs } = require('./classes/notifications');
const { subscribe } = require('./firebase/firestore');
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const port = process.env.PORT || 3000;

app.use('/auth', authRoutes);
app.use('/reading', readingRoutes);

app.get('/refresh', async (req, res) => {
    console.info('Refresh Request. Refreshing ....');
    await refreshData('all');
    scheduler.scheduleAllPlans(global.plans);
    res.status(200).send();
});

app.get('/new-token', async (req, res) => {
    res.status(200).send();
})

app.post("/debug/trigger", async (req, res) => {
    const { id, value, type } = req.body;
    console.log(req.body, process.env.RPI_URL);
    const response = await postRequest(process.env.RPI_URL, {
        id,
        value,
        type
    });
    console.log(response);

    res.status(200).send("success");
})

app.get("/debug/status", (req, res) => {
        const data = JSON.stringify(global.substrate);
        res.status(200).json(data);
})


app.listen(port, () => {
    //init
    init();
    subscribe().then(async unsub => {
        process.on('beforeExit', () => {
            unsub;
        })

        scheduler.init();
        scheduler.scheduleAllPlans(global.plans);
        console.log(`server is listening on port ${port}`);
        if (!global.tokens) {
            const inter = setInterval(async () => {

                if (global.tokens) {
                    await notifs.sendNotif({
                        sound: 'default',
                        body: 'Dripper Server Started.',
                        title: 'Drippr Server Update',
                        vibrate: true,
                    });
                    clearInterval(inter);
                }

            }, 5000);
        }
    })
});
