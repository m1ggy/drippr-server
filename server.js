const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const authRoutes = require('./routes/authRoutes');
const readingRoutes = require('./routes/readingRoutes');
const {scheduler} = require('./classes/scheduler');
const {refreshData} = require('./utils');
const {init} = require('./globals');
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const port = process.env.PORT || 3000;

app.use('/auth', authRoutes);
app.use('/reading', readingRoutes);

app.get('/refresh', async () => {
    await refreshData('all');
    scheduler.scheduleAllPlans(global.plans);
});

app.listen(port, async () => {
    //init
    init();
    await refreshData('all');
    scheduler.init();
    scheduler.scheduleAllPlans(global.plans);

    console.log(`server is listening on port ${port}`);
});
