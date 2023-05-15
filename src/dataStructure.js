const configs = require('./configs.js'),
    Logger = require('./logger.js'),
    logger = new Logger(configs.logging),
    CryptoJS = require("crypto-js"),
	moment = require('moment-timezone'),
    fs = require('fs'),
	FileType = require('file-type'),
  	{ v4: uuidv4 } = require('uuid'); 

var db = {
	collection: function(collection) { 
		if (!state[collection]){
			console.log('ASBC')
			state[collection] = {}
			return ({})
		}
		else {
			return(state[collection])
		}
	},
};
var settingsPending = {};
var state = {};
var lastSavedState = '';

var test = {
	boxid: '1234567890',
	authorization: 'ABCDEFG'
}

loadState();
console.log(state);
console.log(checkAPIKeys(test.boxid,test.authorization));
console.log(deleteSecurity(test.boxid))
console.log(putSetting(test.boxid,'KEY','VALUE'))
//console.log(getMessageStatusValue(test.boxid))
//console.log(setMessageStatusValue(test.boxid))

console.log(JSON.stringify(state,null,2));

function loadState() {
	try {
		logger.log('info', `loadState: LOADING`);		
		var data = fs.readFileSync('./state.json').toString();
		console.log(data);
		state = JSON.parse(data);
	}
	catch (err) {
		logger.log('info', `loadState: Nothing to load: ${err}`);
		state = {
			 boxes: {},
			 users: {}
		}
	}
}

function saveState(callback) {
	var hash = stringToHash(JSON.stringify(state));	
	logger.log('info', `saveState: New State is hash: ${hash}  --   Existing is: ${lastSavedState})`);
	if (hash !== lastSavedState) {
		lastSavedState = hash;
		logger.log('info', `saveState: Saving`);
		fs.writeFileSync('./state.json',JSON.stringify(state,null,2));
	}
}

setInterval(saveState, 5000);

function checkAPIKeys(boxid,authorization) {
	if (authorization) {
		authorization = authorization.replace('Bearer ','').replace('Bearer','');
	}
	logger.log('info', `checkAPIKeys: boxid: ${boxid} -- Token: ${authorization}`);
console.log('========');
console.log(boxid,authorization)
console.log(state.boxes[boxid]);
console.log('========');

	if (!boxid || boxid.length <= 6) {
		return (false);
	}
	if (state.boxes[boxid] && state.boxes[boxid].authorization && state.boxes[boxid].authorization === authorization) {
		logger.log('info', `checkAPIKeys: Valid Boxid: ${boxid}`);
		return boxid;
	}
	else if (state.boxes[boxid] && state.boxes[boxid].newAuth === authorization) {
		logger.log('error', `checkAPIKeys: Found Box is using newAuth.  Clean up old auth`);
		state.boxes[boxid].authorization = authorization;
		delete state.boxes[boxid].newAuth;
		return (boxid);
	}
	else if (state.boxes[boxid]) {
		logger.log('error', `checkAPIKeys: No Valid Credentials`);
		return false;
	}
	else if (boxid && boxid.length > 5) {
		state.boxes[boxid] = {
			authorization: authorization,
			newAuth: uuidv4(),
			boxSyncTime: 0,
			courseRoster: {},
			settings: [],
			logs: []
		}
		putSetting(boxid,"authorization",state.boxes[boxid].newAuth);
		logger.log('debug', `checkAPIKeys: New Device. ${boxid} Setting Up Default Security: New Key: ${state.boxes[boxid].authorization}`);
		return (boxid);
	}
	else {
		logger.log('error', `checkAPIKeys: ERROR`);
		return false
	}
}

function unauthorizedBoxes(string) {
	var [boxid,key] = string.replace('Bearer ','').split('|');
	logger.log('debug',`unauthorizedBoxes: ${boxid}: ${string}`);
	setCourseRoster(boxid,[{sitename:'UNAUTHORIZED'}],'', function(response) {
		// Nothing to do here;
	});
}

// Put the courseRoster in dataStructure.  That is all
function setCourseRoster(boxid,body,ip,callback) {
	if (!state.boxes[boxid]) {
		logger.log('error', `boxId: ${boxid}: setCourseRoster: FAILED: No Boxid`);
		callback (500);
	}
	else {
		logger.log('info', `boxId: ${boxid}: setCourseRoster: Success`);
		if (body && body[0] && body[0].authorization) {
			body[0].authorization = body[0].authorization.replace('Bearer ','');
			if (body[0].sitename) {
				body[0].siteip = ip;
			}
		}
		state.boxes[boxid].boxSyncTime = moment().unix();
		state.boxes[boxid].courseRoster = { 
			data: body,
			timestamp: moment().unix(),
		};
		callback (200);
	}
}

// Get the Roster
function getBoxRosters(boxid) {
	if (!state.boxes[boxid] || !state.boxes[boxid].courseRoster) {
		return ([])
	}
	else {
		return (state.boxes[boxid].courseRoster.data);
	}
}

// Put the logs in dataStructure.  That is all
function setLogs(boxid,data,type,callback) {
	for (var log of data) {
		log.boxid = boxid;
		log.type = type;
		state.boxes[boxid].logs.push(log);
	}
	logger.log('info', `boxId: ${boxid}: setLogs: ${type}: Success`);
	callback(200);
}

// Removes the zip data here
function replacer(key,value)
{
    if (key=="zip") return undefined;
    else return value;
}

function searchLogs(querystring) {
//     let promise = new Promise((resolve, reject) => {
//     	console.log('1');
// 		const collection = db.collection('logs');
// 		console.log(querystring);
// 		collection.find(querystring).toArray(function(err, response) {
// 			resolve(response);
// 		});
// 	});
//     let result = await promise;
//     return result;
}

function getLogs(boxid) {
	if (!state.boxes[boxid]) {
		return ([])
	}
	else {
		return (state.boxes[boxid].logs);	
	}
}

function orderLogs( a, b ) {
  if ( a.timestamp < b.timestamp ){
    return -1;
  }
  if ( a.timestamp > b.timestamp ){
    return 1;
  }
  return 0;
}

async function getSettings(boxid,sendPending) {
	var response = [];
	if (!state.boxes[boxid] || !state.boxes[boxid].settings) {
		logger.log('info', `boxId: ${boxid}: getSettings: Can't find that boxid`);			
		return response;
	}
	for (var result of state.boxes[boxid].settings) {
		if (sendPending || !settingsPending[result.deleteId] || settingsPending[result.deleteId] > moment.unix()) {
			result.pending = "No";
			if (!sendPending) {
				settingsPending[result.deleteId] = moment('21000101','YYYYMMDD').unix();  // Don't send it until the next century. :)
			}
			if (settingsPending[result.deleteId]) {
				result.pending = "Yes";						
			}
			logger.log('info', `boxId: ${boxid}: getSettings: Sending ${result.key}.  Pending until ${settingsPending[result.deleteId]} (${moment(settingsPending[result.deleteId] * 1000).format('LLL')})`);			
			response.push(result);
		}
		else {
			logger.log('info', `boxId: ${boxid}: getSettings: Not Resending ${result.key} until ${moment(settingsPending[result.deleteId] * 1000).format('LLL')}`);			
		}
	}
	return (response);
}

function putSetting(boxid,key,value) {
	if (!state.boxes[boxid] || !state.boxes[boxid].settings) {
		return false;
	}
	state.boxes[boxid].settings.push({
		boxid: boxid,
		deleteId: uuidv4(),
		timestamp: moment().unix(),
		key: key,
		value: value
	});
	return true;
}

function deleteSetting(boxid,recordid) {
	var counter = 0;
	for (var result of (state.boxes[boxid].settings)) {
		if (result.deleteId === recordid) {
			state.boxes[boxid].settings.splice(counter, 1);
			return (true);
		}
	}
	return (False)
}

function getSecurity(boxid) {
	if (!state.boxes[boxid] || !state.boxes[boxid].courseRoster) {
		return false;
	}
	else {
		return ({
			lastSecurityKey:state.boxes[boxid].courseRoster.lastSecurityKey,
			currentSecurityKey: state.boxes[boxid].authorization
		})
	}
}

function putSecurity(boxid,authorization) {
	if (!state.boxes[boxid]) {
		return false;
	}
	else if (authorization.includes('resetKey ')) {
		console.log(`boxId: ${boxid}: putSecurity: ${boxid}: keyReset: true`);
		state.boxes[boxid].authorization = null;
		return true;
	}
	else {
		console.log(`boxId: ${boxid}: putSecurity: ${boxid}: authorization: ${authorization}`);
		state.boxes[boxid].authorization = authorization;
		putSetting(boxid,'moodle-security-key',authorization);
		return true;
	}
}

function deleteBox(boxid) {
	console.log(`boxId: ${boxid}: deleteBox: ${boxid}`);
	delete state.boxes[boxid];
	console.log(`deleteBox: ${boxid}`);
	return true;
}

function deleteSecurity(boxid) {
	console.log(`boxId: ${boxid}: deleteSecurity: ${boxid}`);
	delete state.boxes[boxid].authorization;
	console.log(`deleteSecurity: ${boxid}`);
	return true;
}

function getUsers() {
	console.log(`boxId: ${boxid}: getUsers`);
	var response = []
	for (var username of Object.keys(state.users)) {
		response.push(username)
	}
	return (response);
}

function getUserAuth(username,password) {
	if (state.users[username] && state.users[useername].password === password) {
		console.log(`boxId: ${username}: getUserAuth: Authorized`);
		return (true);
	}
	else {
		console.log(`boxId: ${username}: getUserAuth: NOT Authorized`);
		return (false);
	}
}

function putUser(data) {
	console.log(`boxId: ${boxid}: putUser`);
	state.users[data.username] = {
		password: data.password,
		timestamp: moment().unix()
	}
	return(true)
}

function deleteUser(username) {
	console.log(`boxId: ${boxid}: deleteUser: ${username}`);
	delete state.users[username];
	return true;
}

async function getBoxInventory() {
	// Gets all boxes active in last 90 days
	console.log(`boxId: ${boxid}: getBoxInventory`);
	var historyDate = moment().add(-90,'days').unix();
	var response = [];
	for (var boxid of Object.keys(state.boxes)) {
		if (state.boxes[boxid].boxSyncTime > historyDate) {
			response.push({boxid:boxid, timestamp:state.boxes[boxid].boxSyncTime})
		}
	}
	return (response);
}

function status() {
	if (state && state.boxes) {
		return true;
	}
	else {
		return false;
	}
}

function stringToHash(string) {             
	var hash = 0;
 
	if (string.length == 0) return hash;
 
	for (i = 0; i < string.length; i++) {
		char = string.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash;
	}
 
	return hash;
}

module.exports = {
	checkAPIKeys,
	setCourseRoster,
	unauthorizedBoxes,
	getBoxRosters,
	setLogs,
	searchLogs,
	getLogs,
	getSettings,
	putSetting,
	deleteSetting,
	getSecurity,
	putSecurity,
	deleteSecurity,
	getUsers,
	getUserAuth,
	putUser,
	deleteUser,
	deleteBox,
	getBoxInventory,
	status
};
