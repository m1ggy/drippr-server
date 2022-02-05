const Agenda = require('agenda');
const { postRequest, convertToCron } = require('../utils');
const moment = require('moment');
const { update } = require('../firebase/firestore');
const { notifs } = require('./notifications');

const CONST = {
    EMITTER_FLOWRATE: 8000,
    PLAN_TYPES: {
        TIME_BASED: 'TIME_BASED',
        SENSOR_BASED: 'SENSOR_BASED',
    },
};
class Scheduler {
    constructor() {
        this.Agenda = null;
    }

    init() {
        this.Agenda = new Agenda({
            db: { address: process.env.MONGO_URI },
            defaultConcurrency: 10,
        });

        if (this.Agenda) {
            this.defineJob('irrigate', async (job, done) => {
                const { data } = job.attrs;
                console.log(job, data);
                const response = await postRequest(process.env.RPI_URL, data);
                if (response) {
                    console.log('Irrigate Data: ', response);
                    notifs.sendNotif({
                        sound: 'default',
                        body: `Valve ${data.id} is now ${
                            data.value === false ? 'CLOSED' : 'OPEN'
                        }`,
                        title: 'Drippr Update',
                        vibrate: true,
                    });
                    done();
                } else {
                    notifs.sendNotif({
                        sound: 'default',
                        body: `Valve ${data.id} failed to be updated. Please contact the developer.}`,
                        title: 'Drippr Update',
                        vibrate: true,
                    });
                    job.fail();
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

        this.Agenda.define(name, async (job, done) => await cb(job, done));
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
        if (!plans || !this.Agenda) return;

        this.Agenda.on('ready', () => {
            const active = plans.filter(
                (x) => x.active == true && x.type == 'TIME_BASED'
            );

            if (active.length) {
                active.forEach(async (x) => {
                    if (!this.isPlanActive(x.id)) return;
                    const plotId = x.plotId;

                    const [substrate] = global.substrates.filter((z) => {
                        return z.plotId == plotId;
                    });
                    if (!x.isScheduled && substrate) {
                        if (x.times) {
                            x.times.forEach((time) => {
                                const stopTime = this.getWateringTime(
                                    x.id,
                                    time
                                );
                                const current = moment.utc(time).toDate();
                                this.every(convertToCron(current), 'irrigate', {
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
                        console.log(x);
                        await update('plans', x.id, { isScheduled: true });
                    }
                });
            }
        });
    }

    // utils
    /**
     *
     * @param {String} id Plan ID
     * @param {String} time Moment Start time
     * @returns {Date} duration of irrigation
     */
    getWateringTime(id, time) {
        const [cur] = plans.filter((x) => x.id === id);
        const [cc] = crops.filter((x) => (x.id = cur.crop));

        let wateringTime = null;
        let maxWater = null;
        if (cur && cc) {
            const start = moment(cur.activatedAt);
            const current = moment();
            const maxDays = Object.values(cc.stageDays).reduce(
                (partialSum, a) => partialSum + a,
                0
            );
            const diff = this.datediff(start, current);

            let currentStage = null;
            let max = 0;
            for (const stage in cc.stageDays) {
                max += cc.stageDays[stage];
                if (max >= diff) {
                    currentStage = stage;
                    break;
                }
            }
            if (currentStage) {
                if (cur.type === CONST.PLAN_TYPES.TIME_BASED) {
                    maxWater = 12 * cc.cwrs[currentStage];
                    wateringTime = maxWater / CONST.EMITTER_FLOWRATE;
                } else if (cur.type === CONST.PLAN_TYPES.SENSOR_BASED) {
                    maxWater = 4 * cc.cwrs[currentStage];
                    wateringTime = maxWater / CONST.EMITTER_FLOWRATE;
                }
            }
        }

        if (wateringTime) {
            const split = wateringTime.toString().split('.');
            const et = moment
                .utc(time)
                .add(split[0], 'hours')
                .add(split[1], 'minutes')
                .toDate();
            return et;
        }

        return null;
    }

    isPlanActive(id) {
        const [cur] = plans.filter((x) => x.id === id);
        const [cc] = crops.filter((x) => (x.id = cur.crop));

        if (cur && cc) {
            const maxDays = Object.values(cc.stageDays).reduce(
                (partialSum, a) => partialSum + a,
                0
            );
            const start = moment(cur.activatedAt);
            const current = moment();
            const diffDays = this.datediff(start, current);
            if (diffDays > maxDays) {
                update('plans', id, { active: false });
                return false;
            }
            return true;
        }
    }
    datediff(date1, date2) {
        return date2.diff(date1, 'days') + 1;
    }
}

const scheduler = new Scheduler();

module.exports = { scheduler, Scheduler };
