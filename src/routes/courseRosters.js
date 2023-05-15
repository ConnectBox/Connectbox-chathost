const express = require('express'),
    router = express.Router()
    configs = require('../configs.js'),
    dataStructure = require('../dataStructure.js'),

    Logger = require('../logger.js'),
   	moment = require('moment-timezone'),
    logger = new Logger(configs.logging),
    { v4: uuidv4 } = require('uuid');

//  Put in the courseRoster data
router.post('/', async function postRosters(req, res) {
	req.body[0].authorization = req.headers.authorization;
	dataStructure.setCourseRoster(req.boxid,req.body,req.headers['x-forwarded-for'] || req.socket.remoteAddress, async function(result) {
		logger.log('debug', `boxId: ${req.boxid}: ${req.method} ${req.originalUrl}: ${result}`);
	    res.sendStatus(200);
	});
});

module.exports = router;
