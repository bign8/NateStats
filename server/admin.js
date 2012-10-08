$(document).ready(function() {
	var socket = io.connect('http://a.h1x.com:1337/admin');
	
	socket.on('test', function(data){
		console.log(data);
		$('#lastPageViewed').html(data.title + ' (<a href="http://www.carroll.edu' + data.loc + '">'+data.loc+'</a>)');
	});
	
	socket.on('num', function(data) {
		$('#numOfSockets').html(data);
	});
});