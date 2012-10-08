window.onload = function(){
	
};

// http://stackoverflow.com/a/950146
var head = document.getElementsByTagName('head')[0];
var script = document.createElement('script');
script.type = 'text/javascript';
script.src = 'http://a.h1x.com:1337/socket.io/socket.io.js';

script.onreadystatechange = startStats;
script.onload = startStats;

head.appendChild(script);

// ---- main process function ----
var called = false;
function startStats() {
	if (called) return;
	called = true;
	var socket = io.connect('http://a.h1x.com:1337/stats');// /stats
	
	// start the process
	socket.on('ackConn', function () {
		try {
			socket.emit('validHash', {'hash': document.cookie.match(/_sessionHash=([^;]*);/)[1]}); // verify old session
		} catch (e) {
			socket.emit('needHash'); // request new session
		}
	});
	
	// old session verified
	socket.on('retGoodHash', function(){
		sendInfo();
	});
	
	// new session created
	socket.on('retSession', function(data){
		//console.log(data);
		setCookie('_sessionHash', data.hash);
		
		sendInfo();
	});
	
	function sendInfo() {
		// generate data here
		socket.emit('info', { 
			title: document.title,
			ref: document.referrer,
			loc: window.location.pathname,
			orig: window.location.origin
		});
	}
}


// ---- helper functions ----
function setCookie(c_name, c_value) {
	var exdate=new Date();
	exdate.setDate(exdate.getDate() + 1);
	document.cookie= c_name + "=" + c_value + "; expires="+exdate.toUTCString();
}