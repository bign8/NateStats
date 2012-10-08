var geoip = require('geoip-lite');

var ip = "199.5.171.254";
var geo = geoip.lookup(ip);

console.log(geo);