$(document).ready(function() {
	var socket = io.connect('http://a.h1x.com:1337/admin');
	
	socket.on('test', function(data){
		$('#lastPageViewed').html(data.title + ' (<a href="http://www.carroll.edu' + data.loc + '">'+data.loc+'</a>)');
	});
	
	socket.on('num', function(data) {
		$('#numOfSockets').html(data);
	});
	
	// http://diveintohtml5.info/storage.html
	socket.on('infoResult', function(data) {
		if (sessionStorage['pageID_'+data.pageID]===undefined) {
			socket.emit('getInfo', {idType:'pageID', id:data.pageID});
		}
		if (data.aRefInID != null && sessionStorage['pageID_'+data.aRefInID]===undefined) {
			socket.emit('getInfo', {idType:'pageID', id:data.aRefInID});
		}
	});
	
	socket.on('getInfoResult', function(data) {
		sessionStorage[data.idType+'_'+data.id]=data.value;
	});
	
});