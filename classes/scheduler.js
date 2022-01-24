const Agenda = require('agenda');
const {postRequest, convertToCron} = require('../utils');
const moment = require('moment');
const {update} = require('../firebase/firestore');
class Scheduler {
    constructor() {
        this.Agenda = null;
    }

    init() {
        this.Agenda = new Agenda({
            db: {address: process.env.MONGO_URI},
            defaultConcurrency: 10,
        });

        if (this.Agenda) {
            this.defineJob('irrigate', async (job) => {
                const {data} = job.attrs.data;

                const response = await postRequest(process.env.RPI_URL, data);

                if (response) {
                    console.log('Irrigate Data: ', response);
                }
            });

            console.log('default jobs initialized.');

            this.Agenda.on('ready', () => {
                this.Agenda.start();
                console.info('Agenda has started.');
            });
        }
    }

    defineJob(name, cb) {
        if (!this.Agenda) return;

        this.Agenda.define(name, cb);
    }

    schedule(time, name, data = {}) {
        if (!this.Agenda) return;

        this.Agenda.schedule(time, name, data);
    }

    run(name, data = {}) {
        if (!this.Agenda) return;

        this.Agenda.now(name, data);
    }
    stop() {
        this.Agenda.stop();
    }
    every(time, name, data) {
        if (!this.Agenda) return;

        const cur = this.Agenda.create(name, data);

        cur.repeatEvery(time);
        cur.save();
    }

    //main functions

    scheduleAllPlans(plans) {
        console.log(plans);
        if (!plans || !this.Agenda) return;

        this.Agenda.on('ready', () => {
            const active = plans.filter(
                (x) => x.active == true && x.type == 'TIME_BASED'
            );

            if (active.length) {
                active.forEach(async (x) => {
                    const plotId = x.plotId;

                    const [substrate] = global.substrates.filter((x) => {
                        return (x.plotId = plotId);
                    });
                    if (!x.isScheduled && substrate) {
                        if (x.times) {
                            x.times.forEach((time) => {
                                const stopTime = moment(time)
                                    .add(30, 'minutes')
                                    .toDate();
                                time = moment(time).toDate();
                                this.every(convertToCron(time), 'irrigate', {
                                    id: substrate.valveId,
                                    type: 'trigger',
                                    value: true,
                                });
                                this.every(
                                    convertToCron(stopTime),
                                    'irrigate',
                                    {
                                        id: substrate.valveId,
                                        type: 'trigger',
                                        value: false,
                                    }
                                );
                            });
                        }
                        await update('plans', x.id, {isScheduled: true});
                    }
                });
            }
        });
    }
}

const scheduler = new Scheduler();

module.exports = {scheduler, Scheduler};
