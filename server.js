// Load the necessary servers and utilities
var util = require('util');
var browscap = require('browscap'); // https://github.com/bign8/node-browscap
var mime = require('mime');
var fs = require('fs');
var geoip = require('geoip-lite'); // https://github.com/bign8/node-geoip
var MySQLPool = require('mysql-pool').MySQLPool; // https://github.com/bign8/node-mysql-pool

/**
	QUESTIONS:
	
	1.
	WHY DO SOME SESSIONS NOT EVEN HAVE ACTIONS - looks like IE is the problem?
*/


// create pool of sql connections
var mysql = new MySQLPool({
	poolSize : 10,
	user     : 'stats',
	password : 'dontcare',
	database : 'nodeStats'
	//,debug: true
});

// create socket server
var app = require('http').createServer(genServer).listen(1337);
var io = require('socket.io').listen(app, { // thx | https://github.com/LearnBoost/Socket.IO/wiki/Configuring-Socket.IO
		'log level': 1, // 2 for development, 1 for production
		'browser client minification': true,
		'browser client etag': true,
		'browser client gzip': true,
		'transports': ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']
	});

var admin = io.of('/admin');
var stats = io.of('/stats');

// handle the viewing stats server
admin.on('connection', function (socket) {
	// database get stuff here
	
	socket.on('getInfo', function (data) {
		switch (data.idType) {
			case 'pageID':
				mysql.query("SELECT `aPage` FROM `a_page` WHERE `aPageID` = ?;", [data.id], function(err, rows) {
					if (err) throw err;
					data.value = rows[0].aPage;
					socket.emit('getInfoResult', data);
				});
				
				break;
			case 'extRefID':
				break;
			case 'Something else':
				break;
		}
	});
});

// handle the stats server
stats.on('connection', function (socket) { // io.sockets
	
	// TODO : dive deeper into this error
	if (typeof(socket.handshake) === 'undefined' || socket.handshake.headers.referer == undefined) {
		consoleMsg('header problem');
		//console.log(socket);
		socket.disconnect('header problem');
		return;
	}
	admin.emit('num', stats.clients().length);
	
	var newOrigin = socket.handshake.headers.referer.replace(/^https?:\/\//,''); // remove http(s)
	newOrigin = newOrigin.substring(0, newOrigin.indexOf('/')); // remove everything trailing the last /
	
	//mysql.query("SELECT `domainID` FROM `domain` WHERE `domainHash` = MD5('" + newOrigin + "') LIMIT 1", function(err, rows, fields) {
	mysql.query("SELECT `domainID` FROM `domain` WHERE '" + newOrigin + "' LIKE CONCAT('%', `domainName`) LIMIT 1", function(err, rows, fields) {
		if (err) throw err;
		if (rows.length > 0) {
			//socket.set('domainID', rows[0].domainID);
			fnStartStatsSocket(socket, rows[0].domainID);
		} else {
			consoleMsg('Domain unauthorized: ' + newOrigin);
			socket.disconnect('unauthorized');
		}
	});
});

// Once domainID is obtained, start the magic
function fnStartStatsSocket(socket, domainID) {
	
	// let client know that we are ready to talk
	socket.emit('ackConn');

	// requesting new session be created
	socket.on('needHash', function(){
		startNewSession();
	});
	
	// verifying old session
	socket.on('validHash', function(data){
		// TODO : add date to a day ago
		mysql.query("SELECT `sessionID` FROM `session` WHERE MD5(`sessionID`) = '" + data.hash + "' LIMIT 1;", function(err, rows, fields) {
			if (rows.length > 0) {
				socket.set('sessionID', rows[0].sessionID);
				socket.emit('retGoodHash');
			} else {
				startNewSession();
			}
		});
	});
	
	// TODO : parse the origional page info data
	socket.on('info', function (cbData) {
		admin.emit('test', cbData);
		
		// parse referer for proper proper insert data
		var newReferer = cbData.ref;
		var same_domain = (cbData.ref.indexOf(cbData.orig) === 0);
		if (same_domain) newReferer = newReferer.substring(cbData.orig.length); // same domain
		
		socket.get('sessionID', function(err, sessionID){
			var fix = mysql.query("CALL action_insert(?, ?, ?, ?);",
				[sessionID, cbData.loc, (same_domain)?newReferer:undefined, (!same_domain)?newReferer:undefined],
				function(err, rows) {
					if (err) {console.log(err); throw err;}
					
					//* DEBUGGING
					// note for admin socket pageID, intRefID, extRefID and actionID available
					if (typeof(rows) === 'undefined' || typeof(rows[0]) === 'undefined' || !rows[0].hasOwnProperty('actionID')) {
						console.log(fix.sql);
						
						if (typeof(rows) === 'undefined') {
							console.log('ROWS');
						} else {
							console.log('show ROWS');
							console.log(rows);
							console.log('end ROWS');
							if (typeof(rows[0]) === 'undefined') {
								console.log('ROWS[0]');
							} else {
								if (!rows[0].hasOwnProperty('actionID')) console.log('ROWS[0].actionID');
							}
						}
						
						throw new Error("Something is undefined here");
					}//*/
					
					admin.emit('infoResult', rows[0]);
					
					socket.set('actionID', rows[0].actionID);
				}
			);
		});
	});
	
	// set end of page view time
	socket.on('disconnect', function () {
		admin.emit('num', stats.clients().length);
		
		socket.get('actionID', function(err, actionID){
			if (err) {console.log(err); throw err;}
			
			mysql.query("UPDATE `action` SET `actionEnd` = NOW() WHERE `actionID` =" + actionID, function(err, data) {
				if (err) {console.log(err); throw err;}
			});
		});
	});
	
	// ---- PROCESS FUNCTIONS ----
	// create new database session
	// TODO : fix passing of booleans into call
	function startNewSession() {
		var c = socket.handshake.address; // clientAddress
		var a = geoip.lookup(c.address); // ipGeo
		var b = browscap.getBrowser(socket.handshake.headers['user-agent']); // browserData
		
		// DEBUGGING
		if (typeof(domainID) === 'undefined') { console.log('DOMAIN ID IS NULL'); return; }
		//consoleMsg('testInsert');
		
		// browsercap data stored as strings, used to convert to boolean
		String.prototype.b = function() { return this.valueOf() === 'true'; }
		Boolean.prototype.b = function() { return this.valueOf(); }
		//new Date().getTime()+Math.random(),
		var x = mysql.query("CALL session_insert(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
			[a.country,a.region,a.city,a.ll[0],a.ll[1],b.Browser,b.MajorVer,b.MinorVer,b.Platform,b.Platform_Description,b.Platform_Version,b.Device_Maker,b.Device_Name,b.RenderingEngine_Name,b.RenderingEngine_Version,c.address,domainID,b.Alpha.b(),b.Beta.b(),b.Win16.b(),b.Win32.b(),b.Win64.b(),b.Frames.b(),b.IFrames.b(),b.Tables.b(),b.Cookies.b(),b.BackgroundSounds.b(),b.VBScript.b(),b.JavaApplets.b(),b.ActiveXControls.b(),b.isMobileDevice.b(),b.isSyndicationReader.b(),b.Crawler.b()],
			function(err, rows) {
				if (err) {console.log(err); console.log(x.sql); throw err;}
				
				// note for admin socket pageID, intRefID, extRefID and actionID available
				
				//* DEBUGGING
				if (typeof(rows) === 'undefined' || typeof(rows[0]) === 'undefined' || !rows[0].hasOwnProperty('sessionID')) {
					console.log(x.sql);
					if (typeof(rows) === 'undefined') {
						console.log('ROWS');
					} else {
						console.log('show ROWS');
						console.log(rows);
						console.log('end ROWS');
						if (typeof(rows[0]) === 'undefined') {
							console.log('ROWS[0]');
						} else {
							if (!rows[0].hasOwnProperty('sessionID')) console.log('ROWS[0].sessionID');
						}
					}
					throw new Error("Something is undefined here");
				}//*/
				
				socket.set('sessionID', rows[0].sessionID);
				socket.emit('retSession', {'hash': rows[0].sessionKey});
			}
		);
	}
}


// colored console logger
var strRed = '\033[31m', strBlue = '\033[34m', strGrey = '\033[90m', strReset = '\033[0m';
function consoleMsg(msg, name) {
	if (!name) name = 'nate';
	console.log('   ' + strGrey + name + '  - ' + strReset + msg);
}

// simple webserver
function genServer(req, res) {
	var uri = req.url, file, path;
	if (uri.indexOf('?') > -1) uri = uri.substring(0, uri.indexOf('?'));
	
	switch(uri) {
		case '/': file = '/index.html'; break;
		default: file = uri;
	}
	
	path = __dirname + '/server' + file;
	fs.readFile(path, function (err, data) {
		if (err) {
			if (err.errno = 34) {
				res.writeHead(404, {"Content-Type": "text/plain"});
				return res.end("404 Not Found\n");
			} else {
				res.writeHead(500, {"Content-Type": "text/plain"});
				return res.end('Error loading ' + file);
			}
		}
		// thx http://stackoverflow.com/a/7128772
		type = mime.lookup(path);
		if (!res.getHeader('content-type')) {
			var charset = mime.charsets.lookup(type);
			res.setHeader('Content-Type', type + (charset ? '; charset=' + charset : ''));
		}
		res.writeHead(200);
		res.end(data);
	});
}