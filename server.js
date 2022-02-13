const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const authRoutes = require('./routes/authRoutes');
const readingRoutes = require('./routes/readingRoutes');
const { scheduler } = require('./classes/scheduler');
const { refreshData } = require('./utils');
const { init } = require('./globals');
const { notifs } = require('./classes/notifications');
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
    await notifs.init()
})

app.listen(port, async () => {
    //init
    init();
    await refreshData('all');
    scheduler.init();
    scheduler.scheduleAllPlans(global.plans);
    await notifs.init();
    await notifs.sendNotif({
        sound: 'default',
        body: 'Dripper Server Started.',
        title: 'Drippr Server Update',
        vibrate: true,
    });

    console.log(`server is listening on port ${port}`);
});
