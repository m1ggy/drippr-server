const { notifs } = require('../classes/notifications');
const firebase = require('./firebase');

const db = firebase.firestore();
const add = async (collection, doc) => {
    if (!collection || !doc) return null;
    try {
        const ref = await db.collection(collection).add(doc);

        return ref;
    } catch (error) {
        throw new Error(error);
    }
};

const update = async (collection, id, update) => {
    try {
        const ref = db.collection(collection).doc(id);
        if (ref) {
            await ref.update(update);
            return;
        }
        throw new Error('Failed to update data.');
    } catch (error) {
        throw new Error(error);
    }
};
const fetchCollection = async (collection) => {
    try {
        return new Promise(async (res) => {
            const data = [];
            const snapshot = await db.collection(collection).get();

            snapshot.forEach((x) => {
                if (x.exists) data.push({ id: x.id, ...x.data() });
            });
            res(data);
        });
    } catch (error) {
        console.error(error);
    }
};

const subscribe = async () => {
    const unsub = db.collection('substrates').onSnapshot((snapshot) => {
        const substrates = [];
        if (snapshot) {
            snapshot.forEach(doc => {
                substrates.push({ id: doc.id, ...doc.data() })
            })
        }
        global.substrates = substrates;
    });
    const unsub2 = db.collection('plans').onSnapshot(snapshot => {
        const plans = [];
        if (snapshot) {
            snapshot.forEach(doc => {
                plans.push({ id: doc.id, ...doc.data() })
            })
        }
        global.plans = plans;
    });

    const unsub3 = db.collection('tokens').onSnapshot(snapshot => {
        const tokens = [];
        if (snapshot) {
            snapshot.forEach(doc => {
                tokens.push({ id: doc.id, ...doc.data() })
            })
        }
        console.log(tokens);
        global.tokens = tokens;
        notifs.setTokens(tokens);
    })





    return () => { unsub(); unsub2(); unsub3() }
}

module.exports = { add, update, fetchCollection, subscribe };
