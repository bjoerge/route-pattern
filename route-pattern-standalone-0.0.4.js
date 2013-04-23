(function(e){if("function"==typeof bootstrap)bootstrap("routepattern",e);else if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else if("undefined"!=typeof ses){if(!ses.ok())return;ses.makeRoutePattern=e}else"undefined"!=typeof window?window.RoutePattern=e():global.RoutePattern=e()})(function(){var define,ses,bootstrap,module,exports;
return (function(e,t,n){function i(n,s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("Cannot find module '"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0;s<n.length;s++)i(n[s]);return i})({1:[function(require,module,exports){
var querystring = require("querystring");

// # Utility functions
//
// ## Shallow merge two or more objects, e.g.
// merge({a: 1, b: 2}, {a: 2}, {a: 3}) => {a: 3, b: 2}
function merge() {
  return [].slice.call(arguments).reduce(function (merged, source) {
    for (var prop in source) {
      merged[prop] = source[prop];
    }
    return merged;
  }, {});
}

// Split a location string into different parts, e.g.:
// splitLocation("/foo/bar?fruit=apple#some-hash") => {
//  path: "/foo/bar", queryString: "fruit=apple", hash: "some-hash" 
// }
function splitLocation(location) {
  var re = /([^\?#]*)?(\?[^#]*)?(#.*)?$/;
  var match = re.exec(location);
  return {
    path: match[1] || '',
    queryString: match[2] && match[2].substring(1) || '',
    hash: match[3] && match[3].substring(1) || ''
  }
}

// # QueryStringPattern
// The QueryStringPattern holds a compiled version of the query string part of a route string, i.e.
// ?foo=:foo&fruit=:fruit
var QueryStringPattern = (function () {

  // The RoutePattern constructor
  // Takes a route string or regexp as parameter and provides a set of utility functions for matching against a 
  // location path
  function QueryStringPattern(options) {

    // The query parameters specified
    this.params = options.params;

    // if allowWildcards is set to true, unmatched query parameters will be ignored
    this.allowWildcards = options.allowWildcards;

    // The original route string (optional)
    this.routeString = options.routeString;
  }

  QueryStringPattern.prototype.matches = function (queryString) {
    var givenParams = (queryString || '').split("&").reduce(function (params, pair) {
      var parts = pair.split("="),
        name = parts[0],
        value = parts[1];
      if (name) params[name] = value;
      return params;
    }, {});

    var requiredParam, requiredParams = [].concat(this.params);
    while (requiredParam = requiredParams.shift()) {
      if (!givenParams.hasOwnProperty(requiredParam.key)) return false;
      if (requiredParam.value && givenParams[requiredParam.key] != requiredParam.value) return false;
    }
    if (!this.allowWildcards && this.params.length) {
      if (Object.getOwnPropertyNames(givenParams).length > this.params.length) return false;
    }
    return true;
  };

  QueryStringPattern.prototype.match = function (queryString) {

    if (!this.matches(queryString)) return null;

    var data = {
      params: [],
      namedParams: {},
      namedQueryParams: {}
    };

    if (!queryString) {
      return data;
    }

    // Create a mapping from each key in params to their named param
    var namedParams = this.params.reduce(function (names, param) {
      names[param.key] = param.name;
      return names;
    }, {});

    var parsedQueryString = querystring.parse(queryString);
    Object.keys(parsedQueryString).forEach(function(key) {
      var value = parsedQueryString[key];
      data.params.push(value);
      if (namedParams[key]) {
        data.namedQueryParams[namedParams[key]] = data.namedParams[namedParams[key]] = value;
      }
    });
    return data;
  };

  QueryStringPattern.fromString = function (routeString) {

    var options = {
      routeString: routeString,
      allowWildcards: false,
      params: []
    };

    // Extract named parameters from the route string
    // Construct an array with some metadata about each of the named parameters
    routeString.split("&").forEach(function (pair) {
      if (!pair) return;

      var parts = pair.split("="),
        name = parts[0],
        value = parts[1] || '';

      var wildcard = false;

      var param = { key: name };

      // Named parameters starts with ":"
      if (value.charAt(0) == ':') {
        // Thus the name of the parameter is whatever comes after ":"
        param.name = value.substring(1);
      }
      else if (name == '*' && value == '') {
        // If current param is a wildcard parameter, the options are flagged as accepting wildcards
        // and the current parameter is not added to the options' list of params
        wildcard = options.allowWildcards = true;
      }
      else {
        // The value is an exact match, i.e. the route string 
        // page=search&q=:query will match only when the page parameter is "search"
        param.value = value;
      }
      if (!wildcard) {
        options.params.push(param);
      }
    });
    return new QueryStringPattern(options);
  };

  return QueryStringPattern;
})();

// # PathPattern
// The PathPattern holds a compiled version of the path part of a route string, i.e.
// /some/:dir
var PathPattern = (function () {

  // These are the regexps used to construct a regular expression from a route pattern string
  // Based on route patterns in Backbone.js
  var
    pathParam = /:\w+/g,
    splatParam = /\*\w+/g,
    namedParams = /(:[^\/\.]+)|(\*\w+)/g,
    subPath = /\*/g,
    escapeRegExp = /[-[\]{}()+?.,\\^$|#\s]/g;

  // The PathPattern constructor
  // Takes a route string or regexp as parameter and provides a set of utility functions for matching against a 
  // location path
  function PathPattern(options) {
    // The route string are compiled to a regexp (if it isn't already)
    this.regexp = options.regexp;

    // The query parameters specified in the path part of the route
    this.params = options.params;

    // The original routestring (optional)
    this.routeString = options.routeString;
  }

  PathPattern.prototype.matches = function (pathname) {
    return this.regexp.test(pathname);
  };

  // Extracts all matched parameters
  PathPattern.prototype.match = function (pathname) {

    if (!this.matches(pathname)) return null;
    
    // The captured data from pathname
    var data = {
      params: [],
      namedParams: {}
    };

    // Using a regexp to capture named parameters on the pathname (the order of the parameters is significant)
    (this.regexp.exec(pathname) || []).slice(1).forEach(function (value, idx) {
      value = decodeURIComponent(value);
      data.namedParams[this.params[idx]] = value;
      data.params.push(value);
    }, this);

    return data;
  };

  PathPattern.routePathToRegexp = function (path) {
    path = path
      .replace(escapeRegExp, "\\$&")
      .replace(pathParam, "([^/]+)")
      .replace(splatParam, "(.*)?")
      .replace(subPath, ".*?")
      .replace(/\/?$/, "/?");
    return new RegExp("^/?" + path + "$");
  };

  // This compiles a route string into a set of options which a new PathPattern is created with 
  PathPattern.fromString = function (routeString) {

    // Whatever comes after ? and # is ignored
    routeString = routeString.split(/\?|#/)[0];

    // Create the options object
    // Keep the original routeString and a create a regexp for the pathname part of the url
    var options = {
      routeString: routeString,
      regexp: PathPattern.routePathToRegexp(routeString),
      params: (routeString.match(namedParams) || []).map(function (param) {
        return param.substring(1);
      })
    };

    // Options object are created, now instantiate the PathPattern
    return new PathPattern(options);
  };

  return PathPattern;
}());

// # RegExpPattern
// The RegExpPattern is just a simple wrapper around a regex, used to provide a similar api as the other route patterns
var RegExpPattern = (function () {
  // The RegExpPattern constructor
  // Wraps a regexp and provides a *Pattern api for it
  function RegExpPattern(regex) {
    this.regex = regex;
  }

  RegExpPattern.prototype.matches = function (loc) {
    return this.regex.test(loc);
  };

  // Extracts all matched parameters
  RegExpPattern.prototype.match = function (location) {

    if (!this.matches(location)) return null;

    var loc = splitLocation(location);

    return {
      params: this.regex.exec(location).slice(1),
      queryParams: querystring.parse(loc.queryString),
      namedParams: {}
    };
  };

  return RegExpPattern;
}());

// # RoutePattern
// The RoutePattern combines the PathPattern and the QueryStringPattern so it can represent a full location
// (excluding the scheme + domain part)
// It also allows for having path-like routes in the hash part of the location
// Allows for route strings like:
// /some/:page?param=:param&foo=:foo#:bookmark
// /some/:page?param=:param&foo=:foo#/:section/:bookmark
// 
// Todo: maybe allow for parameterization of the kind of route pattern to use for the hash?
// Maybe use the QueryStringPattern for cases like
// /some/:page?param=:param&foo=:foo#?onlyCareAbout=:thisPartOfTheHash&*
// Need to test how browsers handles urls like that
var RoutePattern = (function () {

  // The RoutePattern constructor
  // Takes a route string or regexp as parameter and provides a set of utility functions for matching against a 
  // location path
  function RoutePattern(options) {
    // The route string are compiled to a regexp (if it isn't already)
    this.pathPattern = options.pathPattern;
    this.queryStringPattern = options.queryStringPattern;
    this.hashPattern = options.hashPattern;

    // The original routestring (optional)
    this.routeString = options.routeString;
  }

  RoutePattern.prototype.matches = function (location) {
    // Whatever comes after ? and # is ignored
    var loc = splitLocation(location);

    return (!this.pathPattern || this.pathPattern.matches(loc.path)) &&
      (!this.queryStringPattern || this.queryStringPattern.matches(loc.queryString) ) &&
      (!this.hashPattern || this.hashPattern.matches(loc.hash))
  };

  // Extracts all matched parameters
  RoutePattern.prototype.match = function (location) {

    if (!this.matches(location)) return null;

    // Whatever comes after ? and # is ignored
    var loc = splitLocation(location),
      match,
      pattern;

    var data = {
      params: [],
      namedParams: {},
      pathParams: {},
      queryParams: querystring.parse(loc.queryString),
      namedQueryParams: {},
      hashParams: {}
    };

    var addMatch = function (match) {
      data.params = data.params.concat(match.params);
      data.namedParams = merge(data.namedParams, match.namedParams);
    };

    if (pattern = this.pathPattern) {
      match = pattern.match(loc.path);
      if (match) addMatch(match);
      data.pathParams = match ? match.namedParams : {};
    }
    if (pattern = this.queryStringPattern) {
      match = pattern.match(loc.queryString);
      if (match) addMatch(match);
      data.namedQueryParams = match ? match.namedQueryParams : {};
    }
    if (pattern = this.hashPattern) {
      match = pattern.match(loc.hash);
      if (match) addMatch(match);
      data.hashParams = match ? match.namedParams : {};
    }
    return data;
  };

  // This compiles a route string into a set of options which a new RoutePattern is created with 
  RoutePattern.fromString = function (routeString) {
    var parts = splitLocation(routeString);

    var matchPath = parts.path;
    var matchQueryString = parts.queryString || routeString.indexOf("?") > -1;
    var matchHash = parts.hash || routeString.indexOf("#") > -1;

    // Options object are created, now instantiate the RoutePattern
    return new RoutePattern({
      pathPattern: matchPath && PathPattern.fromString(parts.path),
      queryStringPattern: matchQueryString && QueryStringPattern.fromString(parts.queryString),
      hashPattern: matchHash && PathPattern.fromString(parts.hash),
      routeString: routeString
    });
  };

  return RoutePattern;
}());

// CommonJS export
module.exports = RoutePattern;

// Also export the individual pattern classes
RoutePattern.QueryStringPattern = QueryStringPattern;
RoutePattern.PathPattern = PathPattern;
RoutePattern.RegExpPattern = RegExpPattern;

},{"querystring":2}],2:[function(require,module,exports){
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    };

var objectKeys = Object.keys || function objectKeys(object) {
    if (object !== Object(object)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in object) if (object.hasOwnProperty(key)) keys[keys.length] = key;
    return keys;
}


/*!
 * querystring
 * Copyright(c) 2010 TJ Holowaychuk <tj@vision-media.ca>
 * MIT Licensed
 */

/**
 * Library version.
 */

exports.version = '0.3.1';

/**
 * Object#toString() ref for stringify().
 */

var toString = Object.prototype.toString;

/**
 * Cache non-integer test regexp.
 */

var notint = /[^0-9]/;

/**
 * Parse the given query `str`, returning an object.
 *
 * @param {String} str
 * @return {Object}
 * @api public
 */

exports.parse = function(str){
  if (null == str || '' == str) return {};

  function promote(parent, key) {
    if (parent[key].length == 0) return parent[key] = {};
    var t = {};
    for (var i in parent[key]) t[i] = parent[key][i];
    parent[key] = t;
    return t;
  }

  return String(str)
    .split('&')
    .reduce(function(ret, pair){
      try{ 
        pair = decodeURIComponent(pair.replace(/\+/g, ' '));
      } catch(e) {
        // ignore
      }

      var eql = pair.indexOf('=')
        , brace = lastBraceInKey(pair)
        , key = pair.substr(0, brace || eql)
        , val = pair.substr(brace || eql, pair.length)
        , val = val.substr(val.indexOf('=') + 1, val.length)
        , parent = ret;

      // ?foo
      if ('' == key) key = pair, val = '';

      // nested
      if (~key.indexOf(']')) {
        var parts = key.split('[')
          , len = parts.length
          , last = len - 1;

        function parse(parts, parent, key) {
          var part = parts.shift();

          // end
          if (!part) {
            if (isArray(parent[key])) {
              parent[key].push(val);
            } else if ('object' == typeof parent[key]) {
              parent[key] = val;
            } else if ('undefined' == typeof parent[key]) {
              parent[key] = val;
            } else {
              parent[key] = [parent[key], val];
            }
          // array
          } else {
            obj = parent[key] = parent[key] || [];
            if (']' == part) {
              if (isArray(obj)) {
                if ('' != val) obj.push(val);
              } else if ('object' == typeof obj) {
                obj[objectKeys(obj).length] = val;
              } else {
                obj = parent[key] = [parent[key], val];
              }
            // prop
            } else if (~part.indexOf(']')) {
              part = part.substr(0, part.length - 1);
              if(notint.test(part) && isArray(obj)) obj = promote(parent, key);
              parse(parts, obj, part);
            // key
            } else {
              if(notint.test(part) && isArray(obj)) obj = promote(parent, key);
              parse(parts, obj, part);
            }
          }
        }

        parse(parts, parent, 'base');
      // optimize
      } else {
        if (notint.test(key) && isArray(parent.base)) {
          var t = {};
          for(var k in parent.base) t[k] = parent.base[k];
          parent.base = t;
        }
        set(parent.base, key, val);
      }

      return ret;
    }, {base: {}}).base;
};

/**
 * Turn the given `obj` into a query string
 *
 * @param {Object} obj
 * @return {String}
 * @api public
 */

var stringify = exports.stringify = function(obj, prefix) {
  if (isArray(obj)) {
    return stringifyArray(obj, prefix);
  } else if ('[object Object]' == toString.call(obj)) {
    return stringifyObject(obj, prefix);
  } else if ('string' == typeof obj) {
    return stringifyString(obj, prefix);
  } else {
    return prefix;
  }
};

/**
 * Stringify the given `str`.
 *
 * @param {String} str
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyString(str, prefix) {
  if (!prefix) throw new TypeError('stringify expects an object');
  return prefix + '=' + encodeURIComponent(str);
}

/**
 * Stringify the given `arr`.
 *
 * @param {Array} arr
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyArray(arr, prefix) {
  var ret = [];
  if (!prefix) throw new TypeError('stringify expects an object');
  for (var i = 0; i < arr.length; i++) {
    ret.push(stringify(arr[i], prefix + '[]'));
  }
  return ret.join('&');
}

/**
 * Stringify the given `obj`.
 *
 * @param {Object} obj
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyObject(obj, prefix) {
  var ret = []
    , keys = objectKeys(obj)
    , key;
  for (var i = 0, len = keys.length; i < len; ++i) {
    key = keys[i];
    ret.push(stringify(obj[key], prefix
      ? prefix + '[' + encodeURIComponent(key) + ']'
      : encodeURIComponent(key)));
  }
  return ret.join('&');
}

/**
 * Set `obj`'s `key` to `val` respecting
 * the weird and wonderful syntax of a qs,
 * where "foo=bar&foo=baz" becomes an array.
 *
 * @param {Object} obj
 * @param {String} key
 * @param {String} val
 * @api private
 */

function set(obj, key, val) {
  var v = obj[key];
  if (undefined === v) {
    obj[key] = val;
  } else if (isArray(v)) {
    v.push(val);
  } else {
    obj[key] = [v, val];
  }
}

/**
 * Locate last brace in `str` within the key.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function lastBraceInKey(str) {
  var len = str.length
    , brace
    , c;
  for (var i = 0; i < len; ++i) {
    c = str[i];
    if (']' == c) brace = false;
    if ('[' == c) brace = true;
    if ('=' == c && !brace) return i;
  }
}

},{}]},{},[1])(1)
});
;