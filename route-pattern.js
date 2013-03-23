var merge = function() {
  return [].slice.call(arguments).reduce(function(merged, source) {
    for (var prop in source) {
      merged[prop] = source[prop];
    }
    return merged;
  }, {});
};

var decodeQueryString = function(queryString) {
  return queryString.split("&").reduce(function (params, pair) {
    var parts = pair.split("="),
      key = decodeURIComponent(parts[0]),
      value = decodeURIComponent(parts[1] || '');
    params[key] = value;
    return params;
  }, {});
};

var parseLocation = function(location) {
  var re = /([^\?#]*)?(\?[^#]*)?(#.*)?$/;
  var match = re.exec(location);
  return {
    path: match[1] || '',
    queryString: match[2] && match[2].substring(1) || '',
    hash: match[3] && match[3].substring(1) || ''
  }
};

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
    var data = {
      params: [],
      namedParams: {},
      namedQueryParams: {},
      queryParams: {}
    };

    if (!queryString) {
      return data;
    }

    // Create a mapping from each key in params to their named param
    var namedParams = this.params.reduce(function (names, param) {
      names[param.key] = param.name;
      return names;
    }, {});

    queryString.split("&").forEach(function (pair) {
      var parts = pair.split("="),
        key = decodeURIComponent(parts[0]),
        value = decodeURIComponent(parts[1] || '');
      data.queryParams[key] = value;

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


// # RoutePattern
// The RoutePattern holds a compiled version of a route string
var PathPattern = (function () {

  // These are the regexps used to construct a regular expression from a route pattern string
  // Almost entirely taken from Backbone.js
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

  PathPattern.routePathToRegexp = function(path) {
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

// # RoutePattern
// The RoutePattern holds a compiled version of a route string
var RoutePattern = module.exports = (function () {

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
    var loc = parseLocation(location);

    return (!this.pathPattern || this.pathPattern.matches(loc.path)) &&
      (!this.queryStringPattern || this.queryStringPattern.matches(loc.queryString) ) &&
      (!this.hashPattern || this.hashPattern.matches(loc.hash))
  };

  // Extracts all matched parameters
  RoutePattern.prototype.match = function (location) {

    // Whatever comes after ? and # is ignored
    var loc = parseLocation(location),
      match,
      pattern;

    var data = {
      params: [],
      namedParams: {},
      pathParams: {},
      queryParams: {},
      namedQueryParams: {},
      hashParams: {}
    };

    var addMatch = function(match) {
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
      data.queryParams = match ? match.queryParams : {};
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
    var parts = parseLocation(routeString);

    var matchPath = parts.path;
    var matchQueryString = parts.queryString || routeString.indexOf("?") > -1;
    var matchHash =  parts.hash || routeString.indexOf("#") > -1;

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

// # RegexPattern
// The RegexPattern matches against a regex
var RegexPattern = (function () {

  // The RegexPattern constructor
  // Wraps a regexp and provides a *Pattern api for it
  function RegexPattern(regex) {
    this.regex = regex;
  }

  RegexPattern.prototype.matches = function (loc) {
    return this.regex.test(loc);
  };

  // Extracts all matched parameters
  RegexPattern.prototype.match = function (loc) {
    var queryString = loc.search || loc.split("?")[0] || '';
    var queryParams = decodeQueryString(queryString);
    return {
      params: this.regex.exec(loc).slice(1),
      namedParams: {},
      queryParams: queryParams
    };
  };

  return RegexPattern;
}());
