// Load the necessary servers and utilities
var MySQLPool = require('mysql-pool').MySQLPool; // github.com/bign8/node-mysql-pool

// Load system needed files
var config  = require('./config/config');
var dashbrd = require('./lib/dashboard');
var tracker = require('./lib/tracker');

// Create pool of MySQL connections
var mysql = new MySQLPool({ // github.com/felixge/node-mysql
	poolSize : config.mysql_pool,
	host     : config.mysql_server,
	user     : config.mysql_user,
	password : config.mysql_pass,
	database : config.mysql_db
});

// Start dashboard webserver
var webServer = dashbrd.startHTTP(config);

// Create socket server
var io = require('socket.io').listen(webServer, { // github.com/LearnBoost/Socket.IO/wiki/Configuring-Socket.IO
	'log level': (config.is_production) ? 1 : 2,
	'browser client minification': true,
	'browser client etag': true,
	'browser client gzip': true,
	'transports': ['websocket', 'flashsocket', 'htmlfile', 'xhr-polling', 'jsonp-polling']
});

// Start subClients of sockets
dashbrd.start(io.of('/admin'), mysql);
tracker.start(io.of('/stats'), mysql);

console.log(config.system_name + ' successfully started!');