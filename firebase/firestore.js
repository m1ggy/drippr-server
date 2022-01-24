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
                if (x.exists) data.push({id: x.id, ...x.data()});
            });
            res(data);
        });
    } catch (error) {
        throw new Error(error);
    }
};

module.exports = {add, update, fetchCollection};
