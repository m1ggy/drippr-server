const firebase = require('./firebase');

const auth = firebase.auth();
const signup = async (username, password, email) => {
    try {
        const user = await auth.createUser({
            email,
            emailVerified: true,
            password,
            displayName: username,
        });
        if (user) {
            return user;
        }

        return null;
    } catch (e) {
        throw new Error(e);
    }
};
const userLogin = async (email, password) => {
    try {
        const user = await auth.getUserByEmail(email);
        if (user) {
            return user;
        }

        return null;
    } catch (error) {
        throw new Error(e);
    }
};
module.exports = { signup, userLogin };
