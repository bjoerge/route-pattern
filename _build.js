var fs = require("fs");
var pkg = require("./package.json");
var browserify = require('browserify');
var semver = require('semver');
var UglifyJS = require('uglify-js');

var newVersion = semver.inc(pkg.version, "patch")
var base = pkg.name + "-standalone-" + newVersion;

var standalone = base+".js";
var minified = base+".min.js";

browserify("./"+pkg.main)
  .bundle({standalone: 'RoutePattern'})
  .pipe(fs.createWriteStream(standalone))
  .on('finish', function() {
    var result = UglifyJS.minify(standalone);
    fs.writeFileSync(minified, result.code);

    console.log('Built version %s to %s', newVersion, standalone);

    [standalone, minified].map(function(file) {
      var stat = fs.statSync(file);
      console.log("  * %s: %dkb", file, Math.round((stat.size/102.4))/10);
    });
  });
