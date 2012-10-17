// Load the necessary servers and utilities
var staticServer = require('node-static'); // github.com/bign8/node-static

// Create server for admin section
var fileServer = new(staticServer.Server)("./server");

// Create web server
exports.startHTTP = function(config) {
	return require('http').createServer(function(req, res) {
		if (config.enable_dashboard) { // All enabled
			console.log(req.url);
			fileServer.serve(req, res);
			
		} else if (req.url = '/client.js') { // just tracker
			fileServer.serveFile('/client.js', 200, {}, req, res);
		} else {
			res.writeHead(200,{'Content-Type':'text/plain'});
			res.end('Dashboard Disabled');
		}
	}).listen(config.system_port);
}

// startup the sub socket
exports.start = function(admin, mysql) {
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
}