const express = require('express');
const { login, signUp } = require('../controllers/authController');
const routes = express.Router();

routes.post('/login', login);
routes.post('/signup', signUp);

module.exports = routes;
