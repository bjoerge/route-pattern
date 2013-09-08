var assert = require("assert");

var RoutePattern = require("../route-pattern");
var RegExpPattern = RoutePattern.RegExpPattern;

if (typeof Array.prototype.forEach == "undefined") {
  require("es5-shim");
}
if (typeof Object.getOwnPropertyNames == "undefined") {
  require("es5-shim/es5-sham");
}

describe("RoutePattern", function () {

  describe("path matching", function () {
    it("should treat / as root", function () {
      assert(RoutePattern.fromString("/").matches(""));
      assert(RoutePattern.fromString("/").matches("/"));
      assert(RoutePattern.fromString("").matches("/"));
      assert(RoutePattern.fromString("").matches(""));
      assert(RoutePattern.fromString("this/is/something").matches("/this/is/something"));
    });
    it("should allow providing named, required parameters", function () {
      assert(RoutePattern.fromString("/:a/:b").matches("/foo/bar"));
      assert(!RoutePattern.fromString("/:a/:b").matches("/foo/"));
    });
    it("should allow named parameters within path segments", function () {
      assert(RoutePattern.fromString("/:dir/:file.:ext").matches("/foo/bar.jpg"));
    });
    it("should match against (capturing) splat parameters that spans more than one path segment", function () {
      assert(RoutePattern.fromString("/*path/:foo").matches("/foo/bar/baz/qux"));
      assert(RoutePattern.fromString("/*path/qux").matches("/foo/bar/baz/qux"));
      assert(!RoutePattern.fromString("/*path/qux").matches("/foo/bar/baz/quxius"));
    });
    it("should match against (noncapturing) wildcard parameters that spans more than one path segment", function () {
      assert(RoutePattern.fromString("/*/:foo").matches("/foo/bar/baz/qux"));
      assert(RoutePattern.fromString("/*/qux").matches("/foo/bar/baz/qux"));
      assert(!RoutePattern.fromString("/*/qux").matches("/foo/bar/baz/quxius"));
      assert(RoutePattern.fromString("/*/baz/*").matches("/foo/bar/baz/qux/quux"));
    });
    it("should not care about trailing slashes", function () {
      assert(RoutePattern.fromString("/foo/bar/").matches("/foo/bar"));
      assert(RoutePattern.fromString("/foo/bar").matches("/foo/bar/"));
    });
  });

  describe("query string matching", function () {
    it("should match a query string against specified query parameter(s) only", function () {
      var pattern = RoutePattern.fromString("?foo=:bar");
      assert(pattern.matches("?foo=qux"));
      assert(pattern.matches("/?foo=foobar"));
      assert(pattern.matches("/yeah/whatever?foo=foobar"));
      assert(pattern.matches("?foo="));
      assert(!pattern.matches("?bar=foo"));
      assert(!pattern.matches("?foo=bar&baz=qux"));
    });
    it("should allow arbitrary query parameters using a wildcard '*'", function () {
      assert(RoutePattern.fromString("?*&foo=:bar").matches("?foo=qux"));
      assert(RoutePattern.fromString("?foo=:bar&*").matches("?foo=qux"));
      assert(RoutePattern.fromString("/a/b?*").matches("/a/b?foo=qux"));
    });
    it("should support named parameters for values in query parameters", function () {
      assert(RoutePattern.fromString("?foo=:bar").matches("/a/b/d?foo=qux"));
    });
    it("should provide super strict equality matching on query parameter values", function () {
      assert(RoutePattern.fromString("?page=foobar").matches("/some/path/?page=foobar"));
      assert(RoutePattern.fromString("?page=foobar&article=:article").matches("/some/path/?page=foobar&article=1"))
    });
  });

  describe("hash matching", function () {
    it("should match against the hash part of a location", function () {
      var pattern = RoutePattern.fromString("#:foo");
      assert(pattern.matches("#banana"));
      assert(pattern.matches("/a/b/d?foo=qux#apple"));
      assert(!pattern.matches("/?foo=bar#"));
      assert(!pattern.matches("#"));
      assert(!pattern.matches(""));
    });
    it("should be able to specify a path-like pattern in the hash too", function () {
      var pattern = RoutePattern.fromString("#/foo/:bar");
      assert(pattern.matches("/a/b/d#/foo/banana"));
      assert(!pattern.matches("/a/b/d?foo=qux"));
      assert(pattern.matches("/a/b/d/?page=index#/foo/test"));
    });
    it("should be able to match against splat params in hash too", function () {
      var pattern = RoutePattern.fromString("#/*whatevs/foo");
      assert(pattern.matches("/hello#/this/is/a/splat/foo"));
      assert(!pattern.matches("/hello#/this/is/a/splat/bar"));
    });
  });

  describe("regex matching", function () {
    it("should match like a regex", function () {
      var pattern = new RegExpPattern(/\/a\/(b|c)\/e/);
      assert(pattern.matches("/a/b/e"));
      assert(pattern.matches("/a/c/e"));
      assert(pattern.matches("/a/b/e/f"));
      assert(!pattern.matches("/a/d/e"));
    });
    it("should extract the different parts of the path as the other patterns", function () {
      var pattern = new RegExpPattern(/\/a\/(b|c)\/e/);
      assert.deepEqual({foo: "bar"}, pattern.match("/a/b/e?foo=bar").queryParams);
      assert.deepEqual(['c'], pattern.match("/a/c/e").params);
      assert.equal(null, pattern.match("/a/d/e"));
    });
  });

  describe("extracting captured data", function () {
    describe("captured parameter values", function () {
      it("should return null if no match at all", function () {
        var pattern = RoutePattern.fromString("/*root/:foo/?param=:param#:hash");
        assert.equal(null, pattern.match("/whatever"));
      });
    });
    describe("captured parameter values", function () {
      it("should return an array of all captured parameter values", function () {
        var pattern = RoutePattern.fromString("/*root/:foo/?param=:param#:hash");
        assert.deepEqual(['foo/bar', 'baz', 'hey', 'qux'], pattern.match("/foo/bar/baz/?param=hey#qux").params);
      });
    });
    describe("named parameters matching", function () {
      it("should return a hash of the named parameters", function () {
        var pattern = RoutePattern.fromString("/foo/:foo?bar=:bar");
        assert.deepEqual({foo: "banana", bar: "apple"}, pattern.match("/foo/banana?bar=apple").namedParams);
      });
      it("should extract named parameters from withing path segments", function () {
        var pattern = RoutePattern.fromString("/:dir/:file.:ext");
        assert.deepEqual({dir: "about", file: "banana", ext: "txt"}, pattern.match("/about/banana.txt").namedParams);
      });
      it("should extract named splat parameters from withing path segments", function () {
        var pattern = RoutePattern.fromString("/:dir/*file.:ext");
        assert.deepEqual({dir: "about", file: "ban/ana", ext: "txt"}, pattern.match("/about/ban/ana.txt").namedParams);
      });
      it("should return undefined for empty named splat parameters", function () {
        var pattern = RoutePattern.fromString("/:dir/*file");
        assert.deepEqual({dir: "about", file: undefined}, pattern.match("/about/").namedParams);
      });
      it("should merge named parameters from all aspects of the path", function () {
        var pattern = RoutePattern.fromString("/*root/:foo/?param=:param#:hash");
        assert.deepEqual(['foo/bar', 'baz', 'hey', 'qux'], pattern.match("/foo/bar/baz/?param=hey#qux").params);
      });
      it("should override conflicting named parameters in a left-to-right order", function () {
        var pattern = RoutePattern.fromString("/:foo/:foo/?foo=:foo#:foo");
        assert.deepEqual({foo: "qux"}, pattern.match("/foo/bar/?foo=baz#qux").namedParams);
      });
      it("should provide a separate object with the named parameters from the path", function () {
        var pattern = RoutePattern.fromString("/:one/:two/:three?foo=:one&*");
        assert.deepEqual(pattern.match("/1/2/3/?foo=4").pathParams, {
          one: "1",
          two: "2",
          three: "3"
        });
      });
      it("should provide a separate object with the named parameters from the query string", function () {
        var pattern = RoutePattern.fromString("/:one/?foo=:one&*");
        assert.deepEqual(pattern.match("/something/?foo=4").namedQueryParams, {
          one: "4"
        });
      });
      it("should provide a separate object with the query parameters", function () {
        var pattern = RoutePattern.fromString("/:one/?foo=:one&*");
        assert.deepEqual(pattern.match("/something/?foo=4").queryParams, {
          foo: "4"
        });
      });
      it("should decode query parameters properly", function () {
        var pattern = RoutePattern.fromString("/hello/?url=:site&*");
        var match = pattern.match("/hello/?url=http%3A%2F%2Ffoo.bar");
        assert.deepEqual(match.params, ["http://foo.bar"]);
        assert.deepEqual(match.namedQueryParams, { site: decodeURIComponent("http://foo.bar") });
        assert.deepEqual(match.queryParams, { url: decodeURIComponent("http://foo.bar") });
      });
    });
  });
})
;
