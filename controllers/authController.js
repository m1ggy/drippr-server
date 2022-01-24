const bcrypt = require('bcrypt');
const { signup, userLogin } = require('../firebase/auth');
const { sign } = require('../utils');
async function login(req, res) {
    if (req.body == null)
        return res.status(404).json({ error: 'No body provided.' });

    const {
        body: { email, username, password },
    } = req;
    try {
        const user = await userLogin(email, password);

        if (user) {
            const token = sign({ uid: user.uid });
            console.log('user signed in');
            return res.status(200).json({
                msg: 'user logged in.',
                token,
            });
        }

        return res.status(404).json({ msg: 'user not found.' });
    } catch (e) {
        console.log(e);

        return res.status(404).json({ msg: e });
    }
}

async function signUp(req, res) {
    if (req.body == null)
        return res.status(404).json({ error: 'No body provided.' });

    let {
        body: { email, username, password },
    } = req;

    if (email == null && password == null)
        return res.status(404).json({ error: 'No body provided.' });
    if (username == null) username = 'User';
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await signup(username, hashedPassword, email);

        if (user)
            return res.status(200).json({
                message: 'user created.',
            });
    } catch (e) {
        return res.status(403).send({ msg: 'Email address already in use.' });
    }
}

module.exports = { login, signUp };
