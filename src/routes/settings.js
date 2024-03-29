const express = require('express'),
	multer = require('multer'),
    router = express.Router()
    configs = require('../configs.js'),
    dataStructure = require('../dataStructure.js'),

    Logger = require('../logger.js'),
    logger = new Logger(configs.logging);

router.get('/', async function getSettings(req, res) {
	var response = await dataStructure.getSettings(req.boxid,false);
	logger.log('debug', `boxId: ${req.boxid}: ${req.method} ${req.originalUrl}: Settings Delivered: ${response.length}`);
    res.send(response);
});

router.delete('/:deleteId', async function deleteSetting(req, res) {
	var result = await dataStructure.deleteSetting(req.boxid,req.params.deleteId);
	if (result) {
		res.sendStatus(200);
	}
	else {
		res.sendStatus(404);
	}
});


module.exports = router;
