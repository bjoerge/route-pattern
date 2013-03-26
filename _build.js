var fs = require("fs");
var pkg = require("./package.json");
var browserify = require('browserify');

var base = pkg.name + "-" + pkg.version;
browserify('./route-pattern.js')
  .bundle({standalone: 'RoutePattern'})
  .pipe(fs.createWriteStream(__dirname + '/'+base+".js"));
