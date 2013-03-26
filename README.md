route-pattern
=

#### Generic Express/Sinatra/Backbone-style route pattern matching

# Features

* Environment, framework and tool agnostic. Works in both Node.js and the browser. No jQuery, Express etc. needed.
* Match against the *path*, *search* (query string) and the *hash* part of a location
* Define patterns for matching *only* against the parts of the location you are interested in
* Match against a location and capture named parameters, query string, etc.
* Well tested.

### Example: matching a route against a path 

```js
var pattern = RoutePattern.fromString("/planets/:planet")
pattern.matches("/planets/earth?fruit=apple#bookmark") // true
```

### Matching a route by query string

```js
var pattern = RoutePattern.fromString("?foo=:foo&fruit=:fruit")
pattern.matches("/hello/world?foo=bar&fruit=apple") // true
pattern.matches("/ignore/what/is/here?fruit=apple&foo=bar") // true
```

### Matching a route by location hash

Path-like patterns can be used in the hash part of the route string too.

```js
var pattern = RoutePattern.fromString("#/chapters/:chapter")
pattern.matches("#/chapters/5") // true
pattern.matches("/books/3432?display=full#/chapters/2") // true
```

### Wildcard matches 

By default, query string routes will match *only* when all speficied parameters are present in 
the matched location string, and they are the *only* query parameters in the location string.
Thus, the following statement will be `false`:

```js
RoutePattern.fromString("?foo=:foo").matches("?foo=bar&baz=qux") // false
```

To specify that other query parameters should be allowed, add a single wildcard to the route string:

```js
RoutePattern.fromString("?foo=:foo&*").matches("?foo=bar&baz=qux") // true
```

Wildcards can also be used in the path to ignore whatever is in the place of the `*`

```js
var pattern = RoutePattern.fromString("*/planets/:planet/*")
pattern.matches("/some/root/path/planets/earth/facts/about/this/planet") // true
```

## Getting match data

```js
var pattern = RoutePattern.fromString("/hello/:planet?foo=:foo&fruit=:fruit#:section")
pattern.match("/hello/earth?foo=bar&fruit=apple#chapter2");
// Returns:
{
  params: ["bar", "apple", ],
  namedParams: { planet: "earth", foo: "bar", fruit: "apple" }
  pathParams: { planet: "world" }
  queryParams: { foo: "bar", fruit: "apple" }
  hashParams: { section: "chapter2" }
}
```

Note: `namedParams` is a merge of `pathParams`, `queryParams` and `hashParams`.

### Capturing wildcards and splats

#### Wildcards will ignore whatever is in the place of the `*`

```js
var pattern = RoutePattern.fromString("*/planets/:planet/*")
pattern.match("/some/root/path/planets/earth/facts/about/this/planet") // true
// Returns:
{
  params: ["earth"],
  namedParams: {
    planet: "earth"
  }
  //...
}
```

#### Splat parameters is like wildcards, only that they will capture the value of the identifier that comes
after the `*` 

```js
var pattern = RoutePattern.fromString("*/planets/:planet/*")
pattern.match("/some/root/path/planets/earth/facts/about/this/planet")
// Returns:
{
  params: ["some/root/path","earth","facts/about/this/planet"],
  namedParams: {
    before: "some/root/path",
    planet: "earth",
    after:"facts/about/this/planet"
  }
  //...
}
```

# Getting started

## Node.js
1. Install with npm: `npm install route-pattern`
2. From your .js file: `var RoutePattern = require("route-pattern");` 

## Browser

This module works in all major browsers, including IE 8-10

Download latest version:
* [Development](https://raw.github.com/bjoerge/route-pattern/master/route-pattern-0.0.1.js)
* [Production](https://raw.github.com/bjoerge/route-pattern/master/route-pattern-0.0.1.min.js) (minified)

When included with a &lt;script&gt; tag, it it will expose the `RoutePattern` class as a global variable.

# API

### `RoutePattern.fromString(routeString)`
Compiles a route string and returns a RoutePattern instance.

### `new RoutePattern(opts)`
Constructor. Usually its better to use `RoutePattern.fromString(routeString)` instead of using the constructor directly.

### routePattern.match(locationString)
Matches a location string against the pattern and returns captured values (i.e.
`params`, `namedParams`, `queryParams`, `hashParams` and `pathParams`)

### routePattern.matches(locationString)
Tests whether the pattern matches a given location string

Example:
```
RoutePattern.fromString("/foo/:bar").matches("/foo/bar/baz") // false
RoutePattern.fromString("/foo/:bar").matches("/foo/bar") // true
```


# Future work:
* Allow pattern matching against the full url (i.e. scheme, domain, port in addition to the currently supported parts of
the url)


## License

MIT
