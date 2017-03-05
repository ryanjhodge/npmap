/**
 * NPMap.js 4.0.0
 * Built on 03/05/2017 at 05:56AM PST
 * Copyright 2017 National Park Service
 * Licensed under MIT (https://github.com/nationalparkservice/npmap.js/blob/master/LICENSE.md)
 */
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports={
  "bing": {
    "key": ""
  },
  "mapbox": {
    "access_token": "pk.eyJ1Ijoicnlhbmpob2RnZSIsImEiOiJ5clRfMjRRIn0.KldXlC8cT9zpaQGY_YSOGQ"
  },
  "mapquest": {
    "key": ""
  },
  "mapzen": {
    "api_key": ""
  }
}

},{}],2:[function(require,module,exports){
(function (process){
var toGeoJSON = (function() {
    'use strict';

    var removeSpace = /\s*/g,
        trimSpace = /^\s*|\s*$/g,
        splitSpace = /\s+/;
    // generate a short, numeric hash of a string
    function okhash(x) {
        if (!x || !x.length) return 0;
        for (var i = 0, h = 0; i < x.length; i++) {
            h = ((h << 5) - h) + x.charCodeAt(i) | 0;
        } return h;
    }
    // all Y children of X
    function get(x, y) { return x.getElementsByTagName(y); }
    function attr(x, y) { return x.getAttribute(y); }
    function attrf(x, y) { return parseFloat(attr(x, y)); }
    // one Y child of X, if any, otherwise null
    function get1(x, y) { var n = get(x, y); return n.length ? n[0] : null; }
    // https://developer.mozilla.org/en-US/docs/Web/API/Node.normalize
    function norm(el) { if (el.normalize) { el.normalize(); } return el; }
    // cast array x into numbers
    function numarray(x) {
        for (var j = 0, o = []; j < x.length; j++) { o[j] = parseFloat(x[j]); }
        return o;
    }
    // get the content of a text node, if any
    function nodeVal(x) {
        if (x) { norm(x); }
        return (x && x.textContent) || '';
    }
    // get the contents of multiple text nodes, if present
    function getMulti(x, ys) {
        var o = {}, n, k;
        for (k = 0; k < ys.length; k++) {
            n = get1(x, ys[k]);
            if (n) o[ys[k]] = nodeVal(n);
        }
        return o;
    }
    // add properties of Y to X, overwriting if present in both
    function extend(x, y) { for (var k in y) x[k] = y[k]; }
    // get one coordinate from a coordinate array, if any
    function coord1(v) { return numarray(v.replace(removeSpace, '').split(',')); }
    // get all coordinates from a coordinate array as [[],[]]
    function coord(v) {
        var coords = v.replace(trimSpace, '').split(splitSpace),
            o = [];
        for (var i = 0; i < coords.length; i++) {
            o.push(coord1(coords[i]));
        }
        return o;
    }
    function coordPair(x) {
        var ll = [attrf(x, 'lon'), attrf(x, 'lat')],
            ele = get1(x, 'ele'),
            // handle namespaced attribute in browser
            heartRate = get1(x, 'gpxtpx:hr') || get1(x, 'hr'),
            time = get1(x, 'time'),
            e;
        if (ele) {
            e = parseFloat(nodeVal(ele));
            if (!isNaN(e)) {
                ll.push(e);
            }
        }
        return {
            coordinates: ll,
            time: time ? nodeVal(time) : null,
            heartRate: heartRate ? parseFloat(nodeVal(heartRate)) : null
        };
    }

    // create a new feature collection parent object
    function fc() {
        return {
            type: 'FeatureCollection',
            features: []
        };
    }

    var serializer;
    if (typeof XMLSerializer !== 'undefined') {
        /* istanbul ignore next */
        serializer = new XMLSerializer();
    // only require xmldom in a node environment
    } else if (typeof exports === 'object' && typeof process === 'object' && !process.browser) {
        serializer = new (require('xmldom').XMLSerializer)();
    }
    function xml2str(str) {
        // IE9 will create a new XMLSerializer but it'll crash immediately.
        // This line is ignored because we don't run coverage tests in IE9
        /* istanbul ignore next */
        if (str.xml !== undefined) return str.xml;
        return serializer.serializeToString(str);
    }

    var t = {
        kml: function(doc) {

            var gj = fc(),
                // styleindex keeps track of hashed styles in order to match features
                styleIndex = {}, styleByHash = {},
                // stylemapindex keeps track of style maps to expose in properties
                styleMapIndex = {},
                // atomic geospatial types supported by KML - MultiGeometry is
                // handled separately
                geotypes = ['Polygon', 'LineString', 'Point', 'Track', 'gx:Track'],
                // all root placemarks in the file
                placemarks = get(doc, 'Placemark'),
                styles = get(doc, 'Style'),
                styleMaps = get(doc, 'StyleMap');

            for (var k = 0; k < styles.length; k++) {
                var hash = okhash(xml2str(styles[k])).toString(16);
                styleIndex['#' + attr(styles[k], 'id')] = hash;
                styleByHash[hash] = styles[k];
            }
            for (var l = 0; l < styleMaps.length; l++) {
                styleIndex['#' + attr(styleMaps[l], 'id')] = okhash(xml2str(styleMaps[l])).toString(16);
                var pairs = get(styleMaps[l], 'Pair');
                var pairsMap = {};
                for (var m = 0; m < pairs.length; m++) {
                    pairsMap[nodeVal(get1(pairs[m], 'key'))] = nodeVal(get1(pairs[m], 'styleUrl'));
                }
                styleMapIndex['#' + attr(styleMaps[l], 'id')] = pairsMap;

            }
            for (var j = 0; j < placemarks.length; j++) {
                gj.features = gj.features.concat(getPlacemark(placemarks[j]));
            }
            function kmlColor(v) {
                var color, opacity;
                v = v || '';
                if (v.substr(0, 1) === '#') { v = v.substr(1); }
                if (v.length === 6 || v.length === 3) { color = v; }
                if (v.length === 8) {
                    opacity = parseInt(v.substr(0, 2), 16) / 255;
                    color = '#' + v.substr(6, 2) +
                        v.substr(4, 2) +
                        v.substr(2, 2);
                }
                return [color, isNaN(opacity) ? undefined : opacity];
            }
            function gxCoord(v) { return numarray(v.split(' ')); }
            function gxCoords(root) {
                var elems = get(root, 'coord', 'gx'), coords = [], times = [];
                if (elems.length === 0) elems = get(root, 'gx:coord');
                for (var i = 0; i < elems.length; i++) coords.push(gxCoord(nodeVal(elems[i])));
                var timeElems = get(root, 'when');
                for (var j = 0; j < timeElems.length; j++) times.push(nodeVal(timeElems[j]));
                return {
                    coords: coords,
                    times: times
                };
            }
            function getGeometry(root) {
                var geomNode, geomNodes, i, j, k, geoms = [], coordTimes = [];
                if (get1(root, 'MultiGeometry')) { return getGeometry(get1(root, 'MultiGeometry')); }
                if (get1(root, 'MultiTrack')) { return getGeometry(get1(root, 'MultiTrack')); }
                if (get1(root, 'gx:MultiTrack')) { return getGeometry(get1(root, 'gx:MultiTrack')); }
                for (i = 0; i < geotypes.length; i++) {
                    geomNodes = get(root, geotypes[i]);
                    if (geomNodes) {
                        for (j = 0; j < geomNodes.length; j++) {
                            geomNode = geomNodes[j];
                            if (geotypes[i] === 'Point') {
                                geoms.push({
                                    type: 'Point',
                                    coordinates: coord1(nodeVal(get1(geomNode, 'coordinates')))
                                });
                            } else if (geotypes[i] === 'LineString') {
                                geoms.push({
                                    type: 'LineString',
                                    coordinates: coord(nodeVal(get1(geomNode, 'coordinates')))
                                });
                            } else if (geotypes[i] === 'Polygon') {
                                var rings = get(geomNode, 'LinearRing'),
                                    coords = [];
                                for (k = 0; k < rings.length; k++) {
                                    coords.push(coord(nodeVal(get1(rings[k], 'coordinates'))));
                                }
                                geoms.push({
                                    type: 'Polygon',
                                    coordinates: coords
                                });
                            } else if (geotypes[i] === 'Track' ||
                                geotypes[i] === 'gx:Track') {
                                var track = gxCoords(geomNode);
                                geoms.push({
                                    type: 'LineString',
                                    coordinates: track.coords
                                });
                                if (track.times.length) coordTimes.push(track.times);
                            }
                        }
                    }
                }
                return {
                    geoms: geoms,
                    coordTimes: coordTimes
                };
            }
            function getPlacemark(root) {
                var geomsAndTimes = getGeometry(root), i, properties = {},
                    name = nodeVal(get1(root, 'name')),
                    address = nodeVal(get1(root, 'address')),
                    styleUrl = nodeVal(get1(root, 'styleUrl')),
                    description = nodeVal(get1(root, 'description')),
                    timeSpan = get1(root, 'TimeSpan'),
                    timeStamp = get1(root, 'TimeStamp'),
                    extendedData = get1(root, 'ExtendedData'),
                    lineStyle = get1(root, 'LineStyle'),
                    polyStyle = get1(root, 'PolyStyle'),
                    visibility = get1(root, 'visibility');

                if (!geomsAndTimes.geoms.length) return [];
                if (name) properties.name = name;
                if (address) properties.address = address;
                if (styleUrl) {
                    if (styleUrl[0] !== '#') {
                        styleUrl = '#' + styleUrl;
                    }

                    properties.styleUrl = styleUrl;
                    if (styleIndex[styleUrl]) {
                        properties.styleHash = styleIndex[styleUrl];
                    }
                    if (styleMapIndex[styleUrl]) {
                        properties.styleMapHash = styleMapIndex[styleUrl];
                        properties.styleHash = styleIndex[styleMapIndex[styleUrl].normal];
                    }
                    // Try to populate the lineStyle or polyStyle since we got the style hash
                    var style = styleByHash[properties.styleHash];
                    if (style) {
                        if (!lineStyle) lineStyle = get1(style, 'LineStyle');
                        if (!polyStyle) polyStyle = get1(style, 'PolyStyle');
                    }
                }
                if (description) properties.description = description;
                if (timeSpan) {
                    var begin = nodeVal(get1(timeSpan, 'begin'));
                    var end = nodeVal(get1(timeSpan, 'end'));
                    properties.timespan = { begin: begin, end: end };
                }
                if (timeStamp) {
                    properties.timestamp = nodeVal(get1(timeStamp, 'when'));
                }
                if (lineStyle) {
                    var linestyles = kmlColor(nodeVal(get1(lineStyle, 'color'))),
                        color = linestyles[0],
                        opacity = linestyles[1],
                        width = parseFloat(nodeVal(get1(lineStyle, 'width')));
                    if (color) properties.stroke = color;
                    if (!isNaN(opacity)) properties['stroke-opacity'] = opacity;
                    if (!isNaN(width)) properties['stroke-width'] = width;
                }
                if (polyStyle) {
                    var polystyles = kmlColor(nodeVal(get1(polyStyle, 'color'))),
                        pcolor = polystyles[0],
                        popacity = polystyles[1],
                        fill = nodeVal(get1(polyStyle, 'fill')),
                        outline = nodeVal(get1(polyStyle, 'outline'));
                    if (pcolor) properties.fill = pcolor;
                    if (!isNaN(popacity)) properties['fill-opacity'] = popacity;
                    if (fill) properties['fill-opacity'] = fill === '1' ? properties['fill-opacity'] || 1 : 0;
                    if (outline) properties['stroke-opacity'] = outline === '1' ? properties['stroke-opacity'] || 1 : 0;
                }
                if (extendedData) {
                    var datas = get(extendedData, 'Data'),
                        simpleDatas = get(extendedData, 'SimpleData');

                    for (i = 0; i < datas.length; i++) {
                        properties[datas[i].getAttribute('name')] = nodeVal(get1(datas[i], 'value'));
                    }
                    for (i = 0; i < simpleDatas.length; i++) {
                        properties[simpleDatas[i].getAttribute('name')] = nodeVal(simpleDatas[i]);
                    }
                }
                if (visibility) {
                    properties.visibility = nodeVal(visibility);
                }
                if (geomsAndTimes.coordTimes.length) {
                    properties.coordTimes = (geomsAndTimes.coordTimes.length === 1) ?
                        geomsAndTimes.coordTimes[0] : geomsAndTimes.coordTimes;
                }
                var feature = {
                    type: 'Feature',
                    geometry: (geomsAndTimes.geoms.length === 1) ? geomsAndTimes.geoms[0] : {
                        type: 'GeometryCollection',
                        geometries: geomsAndTimes.geoms
                    },
                    properties: properties
                };
                if (attr(root, 'id')) feature.id = attr(root, 'id');
                return [feature];
            }
            return gj;
        },
        gpx: function(doc) {
            var i,
                tracks = get(doc, 'trk'),
                routes = get(doc, 'rte'),
                waypoints = get(doc, 'wpt'),
                // a feature collection
                gj = fc(),
                feature;
            for (i = 0; i < tracks.length; i++) {
                feature = getTrack(tracks[i]);
                if (feature) gj.features.push(feature);
            }
            for (i = 0; i < routes.length; i++) {
                feature = getRoute(routes[i]);
                if (feature) gj.features.push(feature);
            }
            for (i = 0; i < waypoints.length; i++) {
                gj.features.push(getPoint(waypoints[i]));
            }
            function getPoints(node, pointname) {
                var pts = get(node, pointname),
                    line = [],
                    times = [],
                    heartRates = [],
                    l = pts.length;
                if (l < 2) return {};  // Invalid line in GeoJSON
                for (var i = 0; i < l; i++) {
                    var c = coordPair(pts[i]);
                    line.push(c.coordinates);
                    if (c.time) times.push(c.time);
                    if (c.heartRate) heartRates.push(c.heartRate);
                }
                return {
                    line: line,
                    times: times,
                    heartRates: heartRates
                };
            }
            function getTrack(node) {
                var segments = get(node, 'trkseg'),
                    track = [],
                    times = [],
                    heartRates = [],
                    line;
                for (var i = 0; i < segments.length; i++) {
                    line = getPoints(segments[i], 'trkpt');
                    if (line) {
                        if (line.line) track.push(line.line);
                        if (line.times && line.times.length) times.push(line.times);
                        if (line.heartRates && line.heartRates.length) heartRates.push(line.heartRates);
                    }
                }
                if (track.length === 0) return;
                var properties = getProperties(node);
                extend(properties, getLineStyle(get1(node, 'extensions')));
                if (times.length) properties.coordTimes = track.length === 1 ? times[0] : times;
                if (heartRates.length) properties.heartRates = track.length === 1 ? heartRates[0] : heartRates;
                return {
                    type: 'Feature',
                    properties: properties,
                    geometry: {
                        type: track.length === 1 ? 'LineString' : 'MultiLineString',
                        coordinates: track.length === 1 ? track[0] : track
                    }
                };
            }
            function getRoute(node) {
                var line = getPoints(node, 'rtept');
                if (!line.line) return;
                var prop = getProperties(node);
                extend(prop, getLineStyle(get1(node, 'extensions')));
                var routeObj = {
                    type: 'Feature',
                    properties: prop,
                    geometry: {
                        type: 'LineString',
                        coordinates: line.line
                    }
                };
                return routeObj;
            }
            function getPoint(node) {
                var prop = getProperties(node);
                extend(prop, getMulti(node, ['sym']));
                return {
                    type: 'Feature',
                    properties: prop,
                    geometry: {
                        type: 'Point',
                        coordinates: coordPair(node).coordinates
                    }
                };
            }
            function getLineStyle(extensions) {
                var style = {};
                if (extensions) {
                    var lineStyle = get1(extensions, 'line');
                    if (lineStyle) {
                        var color = nodeVal(get1(lineStyle, 'color')),
                            opacity = parseFloat(nodeVal(get1(lineStyle, 'opacity'))),
                            width = parseFloat(nodeVal(get1(lineStyle, 'width')));
                        if (color) style.stroke = color;
                        if (!isNaN(opacity)) style['stroke-opacity'] = opacity;
                        // GPX width is in mm, convert to px with 96 px per inch
                        if (!isNaN(width)) style['stroke-width'] = width * 96 / 25.4;
                    }
                }
                return style;
            }
            function getProperties(node) {
                var prop = getMulti(node, ['name', 'cmt', 'desc', 'type', 'time', 'keywords']),
                    links = get(node, 'link');
                if (links.length) prop.links = [];
                for (var i = 0, link; i < links.length; i++) {
                    link = { href: attr(links[i], 'href') };
                    extend(link, getMulti(links[i], ['text', 'type']));
                    prop.links.push(link);
                }
                return prop;
            }
            return gj;
        }
    };
    return t;
})();

if (typeof module !== 'undefined') module.exports = toGeoJSON;
}).call(this,require('_process'))
},{"_process":6,"xmldom":4}],3:[function(require,module,exports){

},{}],4:[function(require,module,exports){
arguments[4][3][0].apply(exports,arguments)
},{"dup":3}],5:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":6}],6:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],7:[function(require,module,exports){
'use strict';

var dsv = require('d3-dsv'),
    sexagesimal = require('sexagesimal');

var latRegex = /(Lat)(itude)?/gi,
    lonRegex = /(L)(on|ng)(gitude)?/i;

function guessHeader(row, regexp) {
    var name, match, score;
    for (var f in row) {
        match = f.match(regexp);
        if (match && (!name || match[0].length / f.length > score)) {
            score = match[0].length / f.length;
            name = f;
        }
    }
    return name;
}

function guessLatHeader(row) { return guessHeader(row, latRegex); }
function guessLonHeader(row) { return guessHeader(row, lonRegex); }

function isLat(f) { return !!f.match(latRegex); }
function isLon(f) { return !!f.match(lonRegex); }

function keyCount(o) {
    return (typeof o == 'object') ? Object.keys(o).length : 0;
}

function autoDelimiter(x) {
    var delimiters = [',', ';', '\t', '|'];
    var results = [];

    delimiters.forEach(function (delimiter) {
        var res = dsv.dsvFormat(delimiter).parse(x);
        if (res.length >= 1) {
            var count = keyCount(res[0]);
            for (var i = 0; i < res.length; i++) {
                if (keyCount(res[i]) !== count) return;
            }
            results.push({
                delimiter: delimiter,
                arity: Object.keys(res[0]).length,
            });
        }
    });

    if (results.length) {
        return results.sort(function (a, b) {
            return b.arity - a.arity;
        })[0].delimiter;
    } else {
        return null;
    }
}

/**
 * Silly stopgap for dsv to d3-dsv upgrade
 *
 * @param {Array} x dsv output
 * @returns {Array} array without columns member
 */
function deleteColumns(x) {
    delete x.columns;
    return x;
}

function auto(x) {
    var delimiter = autoDelimiter(x);
    if (!delimiter) return null;
    return deleteColumns(dsv.dsvFormat(delimiter).parse(x));
}

function csv2geojson(x, options, callback) {

    if (!callback) {
        callback = options;
        options = {};
    }

    options.delimiter = options.delimiter || ',';

    var latfield = options.latfield || '',
        lonfield = options.lonfield || '',
        crs = options.crs || '';

    var features = [],
        featurecollection = {type: 'FeatureCollection', features: features};

    if (crs !== '') {
        featurecollection.crs = {type: 'name', properties: {name: crs}};
    }

    if (options.delimiter === 'auto' && typeof x == 'string') {
        options.delimiter = autoDelimiter(x);
        if (!options.delimiter) {
            callback({
                type: 'Error',
                message: 'Could not autodetect delimiter'
            });
            return;
        }
    }

    var parsed = (typeof x == 'string') ?
        dsv.dsvFormat(options.delimiter).parse(x) : x;

    if (!parsed.length) {
        callback(null, featurecollection);
        return;
    }

    var errors = [];
    var i;


    if (!latfield) latfield = guessLatHeader(parsed[0]);
    if (!lonfield) lonfield = guessLonHeader(parsed[0]);
    var noGeometry = (!latfield || !lonfield);

    if (noGeometry) {
        for (i = 0; i < parsed.length; i++) {
            features.push({
                type: 'Feature',
                properties: parsed[i],
                geometry: null
            });
        }
        callback(errors.length ? errors : null, featurecollection);
        return;
    }

    for (i = 0; i < parsed.length; i++) {
        if (parsed[i][lonfield] !== undefined &&
            parsed[i][latfield] !== undefined) {

            var lonk = parsed[i][lonfield],
                latk = parsed[i][latfield],
                lonf, latf,
                a;

            a = sexagesimal(lonk, 'EW');
            if (a) lonk = a;
            a = sexagesimal(latk, 'NS');
            if (a) latk = a;

            lonf = parseFloat(lonk);
            latf = parseFloat(latk);

            if (isNaN(lonf) ||
                isNaN(latf)) {
                errors.push({
                    message: 'A row contained an invalid value for latitude or longitude',
                    row: parsed[i],
                    index: i
                });
            } else {
                if (!options.includeLatLon) {
                    delete parsed[i][lonfield];
                    delete parsed[i][latfield];
                }

                features.push({
                    type: 'Feature',
                    properties: parsed[i],
                    geometry: {
                        type: 'Point',
                        coordinates: [
                            parseFloat(lonf),
                            parseFloat(latf)
                        ]
                    }
                });
            }
        }
    }

    callback(errors.length ? errors : null, featurecollection);
}

function toLine(gj) {
    var features = gj.features;
    var line = {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: []
        }
    };
    for (var i = 0; i < features.length; i++) {
        line.geometry.coordinates.push(features[i].geometry.coordinates);
    }
    line.properties = features.reduce(function (aggregatedProperties, newFeature) {
        for (var key in newFeature.properties) {
            if (!aggregatedProperties[key]) {
                aggregatedProperties[key] = [];
            }
            aggregatedProperties[key].push(newFeature.properties[key]);
        }
        return aggregatedProperties;
    }, {});
    return {
        type: 'FeatureCollection',
        features: [line]
    };
}

function toPolygon(gj) {
    var features = gj.features;
    var poly = {
        type: 'Feature',
        geometry: {
            type: 'Polygon',
            coordinates: [[]]
        }
    };
    for (var i = 0; i < features.length; i++) {
        poly.geometry.coordinates[0].push(features[i].geometry.coordinates);
    }
    poly.properties = features.reduce(function (aggregatedProperties, newFeature) {
        for (var key in newFeature.properties) {
            if (!aggregatedProperties[key]) {
                aggregatedProperties[key] = [];
            }
            aggregatedProperties[key].push(newFeature.properties[key]);
        }
        return aggregatedProperties;
    }, {});
    return {
        type: 'FeatureCollection',
        features: [poly]
    };
}

module.exports = {
    isLon: isLon,
    isLat: isLat,
    guessLatHeader: guessLatHeader,
    guessLonHeader: guessLonHeader,
    csv: dsv.csvParse,
    tsv: dsv.tsvParse,
    dsv: dsv,
    auto: auto,
    csv2geojson: csv2geojson,
    toLine: toLine,
    toPolygon: toPolygon
};

},{"d3-dsv":8,"sexagesimal":9}],8:[function(require,module,exports){
// https://d3js.org/d3-dsv/ Version 1.0.1. Copyright 2016 Mike Bostock.
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (factory((global.d3 = global.d3 || {})));
}(this, function (exports) { 'use strict';

  function objectConverter(columns) {
    return new Function("d", "return {" + columns.map(function(name, i) {
      return JSON.stringify(name) + ": d[" + i + "]";
    }).join(",") + "}");
  }

  function customConverter(columns, f) {
    var object = objectConverter(columns);
    return function(row, i) {
      return f(object(row), i, columns);
    };
  }

  // Compute unique columns in order of discovery.
  function inferColumns(rows) {
    var columnSet = Object.create(null),
        columns = [];

    rows.forEach(function(row) {
      for (var column in row) {
        if (!(column in columnSet)) {
          columns.push(columnSet[column] = column);
        }
      }
    });

    return columns;
  }

  function dsv(delimiter) {
    var reFormat = new RegExp("[\"" + delimiter + "\n]"),
        delimiterCode = delimiter.charCodeAt(0);

    function parse(text, f) {
      var convert, columns, rows = parseRows(text, function(row, i) {
        if (convert) return convert(row, i - 1);
        columns = row, convert = f ? customConverter(row, f) : objectConverter(row);
      });
      rows.columns = columns;
      return rows;
    }

    function parseRows(text, f) {
      var EOL = {}, // sentinel value for end-of-line
          EOF = {}, // sentinel value for end-of-file
          rows = [], // output rows
          N = text.length,
          I = 0, // current character index
          n = 0, // the current line number
          t, // the current token
          eol; // is the current token followed by EOL?

      function token() {
        if (I >= N) return EOF; // special case: end of file
        if (eol) return eol = false, EOL; // special case: end of line

        // special case: quotes
        var j = I, c;
        if (text.charCodeAt(j) === 34) {
          var i = j;
          while (i++ < N) {
            if (text.charCodeAt(i) === 34) {
              if (text.charCodeAt(i + 1) !== 34) break;
              ++i;
            }
          }
          I = i + 2;
          c = text.charCodeAt(i + 1);
          if (c === 13) {
            eol = true;
            if (text.charCodeAt(i + 2) === 10) ++I;
          } else if (c === 10) {
            eol = true;
          }
          return text.slice(j + 1, i).replace(/""/g, "\"");
        }

        // common case: find next delimiter or newline
        while (I < N) {
          var k = 1;
          c = text.charCodeAt(I++);
          if (c === 10) eol = true; // \n
          else if (c === 13) { eol = true; if (text.charCodeAt(I) === 10) ++I, ++k; } // \r|\r\n
          else if (c !== delimiterCode) continue;
          return text.slice(j, I - k);
        }

        // special case: last token before EOF
        return text.slice(j);
      }

      while ((t = token()) !== EOF) {
        var a = [];
        while (t !== EOL && t !== EOF) {
          a.push(t);
          t = token();
        }
        if (f && (a = f(a, n++)) == null) continue;
        rows.push(a);
      }

      return rows;
    }

    function format(rows, columns) {
      if (columns == null) columns = inferColumns(rows);
      return [columns.map(formatValue).join(delimiter)].concat(rows.map(function(row) {
        return columns.map(function(column) {
          return formatValue(row[column]);
        }).join(delimiter);
      })).join("\n");
    }

    function formatRows(rows) {
      return rows.map(formatRow).join("\n");
    }

    function formatRow(row) {
      return row.map(formatValue).join(delimiter);
    }

    function formatValue(text) {
      return text == null ? ""
          : reFormat.test(text += "") ? "\"" + text.replace(/\"/g, "\"\"") + "\""
          : text;
    }

    return {
      parse: parse,
      parseRows: parseRows,
      format: format,
      formatRows: formatRows
    };
  }

  var csv = dsv(",");

  var csvParse = csv.parse;
  var csvParseRows = csv.parseRows;
  var csvFormat = csv.format;
  var csvFormatRows = csv.formatRows;

  var tsv = dsv("\t");

  var tsvParse = tsv.parse;
  var tsvParseRows = tsv.parseRows;
  var tsvFormat = tsv.format;
  var tsvFormatRows = tsv.formatRows;

  exports.dsvFormat = dsv;
  exports.csvParse = csvParse;
  exports.csvParseRows = csvParseRows;
  exports.csvFormat = csvFormat;
  exports.csvFormatRows = csvFormatRows;
  exports.tsvParse = tsvParse;
  exports.tsvParseRows = tsvParseRows;
  exports.tsvFormat = tsvFormat;
  exports.tsvFormatRows = tsvFormatRows;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
},{}],9:[function(require,module,exports){
module.exports = element;
module.exports.pair = pair;
module.exports.format = format;
module.exports.formatPair = formatPair;
module.exports.coordToDMS = coordToDMS;

function element(x, dims) {
  return search(x, dims).val;
}

function formatPair(x) {
  return format(x.lat, 'lat') + ' ' + format(x.lon, 'lon');
}

// Is 0 North or South?
function format(x, dim) {
  var dms = coordToDMS(x,dim);
  return dms.whole + '° ' +
    (dms.minutes ? dms.minutes + '\' ' : '') +
    (dms.seconds ? dms.seconds + '" ' : '') + dms.dir;
}

function coordToDMS(x,dim) {
  var dirs = {
    lat: ['N', 'S'],
    lon: ['E', 'W']
  }[dim] || '',
  dir = dirs[x >= 0 ? 0 : 1],
    abs = Math.abs(x),
    whole = Math.floor(abs),
    fraction = abs - whole,
    fractionMinutes = fraction * 60,
    minutes = Math.floor(fractionMinutes),
    seconds = Math.floor((fractionMinutes - minutes) * 60);

  return {
    whole: whole,
    minutes: minutes,
    seconds: seconds,
    dir: dir
  };
}

function search(x, dims, r) {
  if (!dims) dims = 'NSEW';
  if (typeof x !== 'string') return { val: null, regex: r };
  r = r || /[\s\,]*([\-|\—|\―]?[0-9.]+)°? *(?:([0-9.]+)['’′‘] *)?(?:([0-9.]+)(?:''|"|”|″) *)?([NSEW])?/gi;
  var m = r.exec(x);
  if (!m) return { val: null, regex: r };
  else if (m[4] && dims.indexOf(m[4]) === -1) return { val: null, regex: r };
  else return {
    val: (((m[1]) ? parseFloat(m[1]) : 0) +
          ((m[2] ? parseFloat(m[2]) / 60 : 0)) +
          ((m[3] ? parseFloat(m[3]) / 3600 : 0))) *
          ((m[4] && m[4] === 'S' || m[4] === 'W') ? -1 : 1),
    regex: r,
    raw: m[0],
    dim: m[4]
  };
}

function pair(x, dims) {
  x = x.trim();
  var one = search(x, dims);
  if (one.val === null) return null;
  var two = search(x, dims, one.regex);
  if (two.val === null) return null;
  // null if one/two are not contiguous.
  if (one.raw + two.raw !== x) return null;
  if (one.dim) {
    return swapdim(one.val, two.val, one.dim);
  } else {
    return [one.val, two.val];
  }
}

function swapdim(a, b, dim) {
  if (dim === 'N' || dim === 'S') return [a, b];
  if (dim === 'W' || dim === 'E') return [b, a];
}

},{}],10:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _handlebarsRuntime = require('./handlebars.runtime');

var _handlebarsRuntime2 = _interopRequireDefault(_handlebarsRuntime);

// Compiler imports

var _handlebarsCompilerAst = require('./handlebars/compiler/ast');

var _handlebarsCompilerAst2 = _interopRequireDefault(_handlebarsCompilerAst);

var _handlebarsCompilerBase = require('./handlebars/compiler/base');

var _handlebarsCompilerCompiler = require('./handlebars/compiler/compiler');

var _handlebarsCompilerJavascriptCompiler = require('./handlebars/compiler/javascript-compiler');

var _handlebarsCompilerJavascriptCompiler2 = _interopRequireDefault(_handlebarsCompilerJavascriptCompiler);

var _handlebarsCompilerVisitor = require('./handlebars/compiler/visitor');

var _handlebarsCompilerVisitor2 = _interopRequireDefault(_handlebarsCompilerVisitor);

var _handlebarsNoConflict = require('./handlebars/no-conflict');

var _handlebarsNoConflict2 = _interopRequireDefault(_handlebarsNoConflict);

var _create = _handlebarsRuntime2['default'].create;
function create() {
  var hb = _create();

  hb.compile = function (input, options) {
    return _handlebarsCompilerCompiler.compile(input, options, hb);
  };
  hb.precompile = function (input, options) {
    return _handlebarsCompilerCompiler.precompile(input, options, hb);
  };

  hb.AST = _handlebarsCompilerAst2['default'];
  hb.Compiler = _handlebarsCompilerCompiler.Compiler;
  hb.JavaScriptCompiler = _handlebarsCompilerJavascriptCompiler2['default'];
  hb.Parser = _handlebarsCompilerBase.parser;
  hb.parse = _handlebarsCompilerBase.parse;

  return hb;
}

var inst = create();
inst.create = create;

_handlebarsNoConflict2['default'](inst);

inst.Visitor = _handlebarsCompilerVisitor2['default'];

inst['default'] = inst;

exports['default'] = inst;
module.exports = exports['default'];


},{"./handlebars.runtime":11,"./handlebars/compiler/ast":13,"./handlebars/compiler/base":14,"./handlebars/compiler/compiler":16,"./handlebars/compiler/javascript-compiler":18,"./handlebars/compiler/visitor":21,"./handlebars/no-conflict":35}],11:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _handlebarsBase = require('./handlebars/base');

var base = _interopRequireWildcard(_handlebarsBase);

// Each of these augment the Handlebars object. No need to setup here.
// (This is done to easily share code between commonjs and browse envs)

var _handlebarsSafeString = require('./handlebars/safe-string');

var _handlebarsSafeString2 = _interopRequireDefault(_handlebarsSafeString);

var _handlebarsException = require('./handlebars/exception');

var _handlebarsException2 = _interopRequireDefault(_handlebarsException);

var _handlebarsUtils = require('./handlebars/utils');

var Utils = _interopRequireWildcard(_handlebarsUtils);

var _handlebarsRuntime = require('./handlebars/runtime');

var runtime = _interopRequireWildcard(_handlebarsRuntime);

var _handlebarsNoConflict = require('./handlebars/no-conflict');

var _handlebarsNoConflict2 = _interopRequireDefault(_handlebarsNoConflict);

// For compatibility and usage outside of module systems, make the Handlebars object a namespace
function create() {
  var hb = new base.HandlebarsEnvironment();

  Utils.extend(hb, base);
  hb.SafeString = _handlebarsSafeString2['default'];
  hb.Exception = _handlebarsException2['default'];
  hb.Utils = Utils;
  hb.escapeExpression = Utils.escapeExpression;

  hb.VM = runtime;
  hb.template = function (spec) {
    return runtime.template(spec, hb);
  };

  return hb;
}

var inst = create();
inst.create = create;

_handlebarsNoConflict2['default'](inst);

inst['default'] = inst;

exports['default'] = inst;
module.exports = exports['default'];


},{"./handlebars/base":12,"./handlebars/exception":25,"./handlebars/no-conflict":35,"./handlebars/runtime":36,"./handlebars/safe-string":37,"./handlebars/utils":38}],12:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.HandlebarsEnvironment = HandlebarsEnvironment;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _utils = require('./utils');

var _exception = require('./exception');

var _exception2 = _interopRequireDefault(_exception);

var _helpers = require('./helpers');

var _decorators = require('./decorators');

var _logger = require('./logger');

var _logger2 = _interopRequireDefault(_logger);

var VERSION = '4.0.5';
exports.VERSION = VERSION;
var COMPILER_REVISION = 7;

exports.COMPILER_REVISION = COMPILER_REVISION;
var REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '== 1.x.x',
  5: '== 2.0.0-alpha.x',
  6: '>= 2.0.0-beta.1',
  7: '>= 4.0.0'
};

exports.REVISION_CHANGES = REVISION_CHANGES;
var objectType = '[object Object]';

function HandlebarsEnvironment(helpers, partials, decorators) {
  this.helpers = helpers || {};
  this.partials = partials || {};
  this.decorators = decorators || {};

  _helpers.registerDefaultHelpers(this);
  _decorators.registerDefaultDecorators(this);
}

HandlebarsEnvironment.prototype = {
  constructor: HandlebarsEnvironment,

  logger: _logger2['default'],
  log: _logger2['default'].log,

  registerHelper: function registerHelper(name, fn) {
    if (_utils.toString.call(name) === objectType) {
      if (fn) {
        throw new _exception2['default']('Arg not supported with multiple helpers');
      }
      _utils.extend(this.helpers, name);
    } else {
      this.helpers[name] = fn;
    }
  },
  unregisterHelper: function unregisterHelper(name) {
    delete this.helpers[name];
  },

  registerPartial: function registerPartial(name, partial) {
    if (_utils.toString.call(name) === objectType) {
      _utils.extend(this.partials, name);
    } else {
      if (typeof partial === 'undefined') {
        throw new _exception2['default']('Attempting to register a partial called "' + name + '" as undefined');
      }
      this.partials[name] = partial;
    }
  },
  unregisterPartial: function unregisterPartial(name) {
    delete this.partials[name];
  },

  registerDecorator: function registerDecorator(name, fn) {
    if (_utils.toString.call(name) === objectType) {
      if (fn) {
        throw new _exception2['default']('Arg not supported with multiple decorators');
      }
      _utils.extend(this.decorators, name);
    } else {
      this.decorators[name] = fn;
    }
  },
  unregisterDecorator: function unregisterDecorator(name) {
    delete this.decorators[name];
  }
};

var log = _logger2['default'].log;

exports.log = log;
exports.createFrame = _utils.createFrame;
exports.logger = _logger2['default'];


},{"./decorators":23,"./exception":25,"./helpers":26,"./logger":34,"./utils":38}],13:[function(require,module,exports){
'use strict';

exports.__esModule = true;
var AST = {
  // Public API used to evaluate derived attributes regarding AST nodes
  helpers: {
    // a mustache is definitely a helper if:
    // * it is an eligible helper, and
    // * it has at least one parameter or hash segment
    helperExpression: function helperExpression(node) {
      return node.type === 'SubExpression' || (node.type === 'MustacheStatement' || node.type === 'BlockStatement') && !!(node.params && node.params.length || node.hash);
    },

    scopedId: function scopedId(path) {
      return (/^\.|this\b/.test(path.original)
      );
    },

    // an ID is simple if it only has one part, and that part is not
    // `..` or `this`.
    simpleId: function simpleId(path) {
      return path.parts.length === 1 && !AST.helpers.scopedId(path) && !path.depth;
    }
  }
};

// Must be exported as an object rather than the root of the module as the jison lexer
// must modify the object to operate properly.
exports['default'] = AST;
module.exports = exports['default'];


},{}],14:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.parse = parse;
// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _parser = require('./parser');

var _parser2 = _interopRequireDefault(_parser);

var _whitespaceControl = require('./whitespace-control');

var _whitespaceControl2 = _interopRequireDefault(_whitespaceControl);

var _helpers = require('./helpers');

var Helpers = _interopRequireWildcard(_helpers);

var _utils = require('../utils');

exports.parser = _parser2['default'];

var yy = {};
_utils.extend(yy, Helpers);

function parse(input, options) {
  // Just return if an already-compiled AST was passed in.
  if (input.type === 'Program') {
    return input;
  }

  _parser2['default'].yy = yy;

  // Altering the shared object here, but this is ok as parser is a sync operation
  yy.locInfo = function (locInfo) {
    return new yy.SourceLocation(options && options.srcName, locInfo);
  };

  var strip = new _whitespaceControl2['default'](options);
  return strip.accept(_parser2['default'].parse(input));
}


},{"../utils":38,"./helpers":17,"./parser":19,"./whitespace-control":22}],15:[function(require,module,exports){
/* global define */
'use strict';

exports.__esModule = true;

var _utils = require('../utils');

var SourceNode = undefined;

try {
  /* istanbul ignore next */
  if (typeof define !== 'function' || !define.amd) {
    // We don't support this in AMD environments. For these environments, we asusme that
    // they are running on the browser and thus have no need for the source-map library.
    var SourceMap = require('source-map');
    SourceNode = SourceMap.SourceNode;
  }
} catch (err) {}
/* NOP */

/* istanbul ignore if: tested but not covered in istanbul due to dist build  */
if (!SourceNode) {
  SourceNode = function (line, column, srcFile, chunks) {
    this.src = '';
    if (chunks) {
      this.add(chunks);
    }
  };
  /* istanbul ignore next */
  SourceNode.prototype = {
    add: function add(chunks) {
      if (_utils.isArray(chunks)) {
        chunks = chunks.join('');
      }
      this.src += chunks;
    },
    prepend: function prepend(chunks) {
      if (_utils.isArray(chunks)) {
        chunks = chunks.join('');
      }
      this.src = chunks + this.src;
    },
    toStringWithSourceMap: function toStringWithSourceMap() {
      return { code: this.toString() };
    },
    toString: function toString() {
      return this.src;
    }
  };
}

function castChunk(chunk, codeGen, loc) {
  if (_utils.isArray(chunk)) {
    var ret = [];

    for (var i = 0, len = chunk.length; i < len; i++) {
      ret.push(codeGen.wrap(chunk[i], loc));
    }
    return ret;
  } else if (typeof chunk === 'boolean' || typeof chunk === 'number') {
    // Handle primitives that the SourceNode will throw up on
    return chunk + '';
  }
  return chunk;
}

function CodeGen(srcFile) {
  this.srcFile = srcFile;
  this.source = [];
}

CodeGen.prototype = {
  isEmpty: function isEmpty() {
    return !this.source.length;
  },
  prepend: function prepend(source, loc) {
    this.source.unshift(this.wrap(source, loc));
  },
  push: function push(source, loc) {
    this.source.push(this.wrap(source, loc));
  },

  merge: function merge() {
    var source = this.empty();
    this.each(function (line) {
      source.add(['  ', line, '\n']);
    });
    return source;
  },

  each: function each(iter) {
    for (var i = 0, len = this.source.length; i < len; i++) {
      iter(this.source[i]);
    }
  },

  empty: function empty() {
    var loc = this.currentLocation || { start: {} };
    return new SourceNode(loc.start.line, loc.start.column, this.srcFile);
  },
  wrap: function wrap(chunk) {
    var loc = arguments.length <= 1 || arguments[1] === undefined ? this.currentLocation || { start: {} } : arguments[1];

    if (chunk instanceof SourceNode) {
      return chunk;
    }

    chunk = castChunk(chunk, this, loc);

    return new SourceNode(loc.start.line, loc.start.column, this.srcFile, chunk);
  },

  functionCall: function functionCall(fn, type, params) {
    params = this.generateList(params);
    return this.wrap([fn, type ? '.' + type + '(' : '(', params, ')']);
  },

  quotedString: function quotedString(str) {
    return '"' + (str + '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\u2028/g, '\\u2028') // Per Ecma-262 7.3 + 7.8.4
    .replace(/\u2029/g, '\\u2029') + '"';
  },

  objectLiteral: function objectLiteral(obj) {
    var pairs = [];

    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        var value = castChunk(obj[key], this);
        if (value !== 'undefined') {
          pairs.push([this.quotedString(key), ':', value]);
        }
      }
    }

    var ret = this.generateList(pairs);
    ret.prepend('{');
    ret.add('}');
    return ret;
  },

  generateList: function generateList(entries) {
    var ret = this.empty();

    for (var i = 0, len = entries.length; i < len; i++) {
      if (i) {
        ret.add(',');
      }

      ret.add(castChunk(entries[i], this));
    }

    return ret;
  },

  generateArray: function generateArray(entries) {
    var ret = this.generateList(entries);
    ret.prepend('[');
    ret.add(']');

    return ret;
  }
};

exports['default'] = CodeGen;
module.exports = exports['default'];


},{"../utils":38,"source-map":40}],16:[function(require,module,exports){
/* eslint-disable new-cap */

'use strict';

exports.__esModule = true;
exports.Compiler = Compiler;
exports.precompile = precompile;
exports.compile = compile;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _exception = require('../exception');

var _exception2 = _interopRequireDefault(_exception);

var _utils = require('../utils');

var _ast = require('./ast');

var _ast2 = _interopRequireDefault(_ast);

var slice = [].slice;

function Compiler() {}

// the foundHelper register will disambiguate helper lookup from finding a
// function in a context. This is necessary for mustache compatibility, which
// requires that context functions in blocks are evaluated by blockHelperMissing,
// and then proceed as if the resulting value was provided to blockHelperMissing.

Compiler.prototype = {
  compiler: Compiler,

  equals: function equals(other) {
    var len = this.opcodes.length;
    if (other.opcodes.length !== len) {
      return false;
    }

    for (var i = 0; i < len; i++) {
      var opcode = this.opcodes[i],
          otherOpcode = other.opcodes[i];
      if (opcode.opcode !== otherOpcode.opcode || !argEquals(opcode.args, otherOpcode.args)) {
        return false;
      }
    }

    // We know that length is the same between the two arrays because they are directly tied
    // to the opcode behavior above.
    len = this.children.length;
    for (var i = 0; i < len; i++) {
      if (!this.children[i].equals(other.children[i])) {
        return false;
      }
    }

    return true;
  },

  guid: 0,

  compile: function compile(program, options) {
    this.sourceNode = [];
    this.opcodes = [];
    this.children = [];
    this.options = options;
    this.stringParams = options.stringParams;
    this.trackIds = options.trackIds;

    options.blockParams = options.blockParams || [];

    // These changes will propagate to the other compiler components
    var knownHelpers = options.knownHelpers;
    options.knownHelpers = {
      'helperMissing': true,
      'blockHelperMissing': true,
      'each': true,
      'if': true,
      'unless': true,
      'with': true,
      'log': true,
      'lookup': true
    };
    if (knownHelpers) {
      for (var _name in knownHelpers) {
        /* istanbul ignore else */
        if (_name in knownHelpers) {
          options.knownHelpers[_name] = knownHelpers[_name];
        }
      }
    }

    return this.accept(program);
  },

  compileProgram: function compileProgram(program) {
    var childCompiler = new this.compiler(),
        // eslint-disable-line new-cap
    result = childCompiler.compile(program, this.options),
        guid = this.guid++;

    this.usePartial = this.usePartial || result.usePartial;

    this.children[guid] = result;
    this.useDepths = this.useDepths || result.useDepths;

    return guid;
  },

  accept: function accept(node) {
    /* istanbul ignore next: Sanity code */
    if (!this[node.type]) {
      throw new _exception2['default']('Unknown type: ' + node.type, node);
    }

    this.sourceNode.unshift(node);
    var ret = this[node.type](node);
    this.sourceNode.shift();
    return ret;
  },

  Program: function Program(program) {
    this.options.blockParams.unshift(program.blockParams);

    var body = program.body,
        bodyLength = body.length;
    for (var i = 0; i < bodyLength; i++) {
      this.accept(body[i]);
    }

    this.options.blockParams.shift();

    this.isSimple = bodyLength === 1;
    this.blockParams = program.blockParams ? program.blockParams.length : 0;

    return this;
  },

  BlockStatement: function BlockStatement(block) {
    transformLiteralToPath(block);

    var program = block.program,
        inverse = block.inverse;

    program = program && this.compileProgram(program);
    inverse = inverse && this.compileProgram(inverse);

    var type = this.classifySexpr(block);

    if (type === 'helper') {
      this.helperSexpr(block, program, inverse);
    } else if (type === 'simple') {
      this.simpleSexpr(block);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('blockValue', block.path.original);
    } else {
      this.ambiguousSexpr(block, program, inverse);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('ambiguousBlockValue');
    }

    this.opcode('append');
  },

  DecoratorBlock: function DecoratorBlock(decorator) {
    var program = decorator.program && this.compileProgram(decorator.program);
    var params = this.setupFullMustacheParams(decorator, program, undefined),
        path = decorator.path;

    this.useDecorators = true;
    this.opcode('registerDecorator', params.length, path.original);
  },

  PartialStatement: function PartialStatement(partial) {
    this.usePartial = true;

    var program = partial.program;
    if (program) {
      program = this.compileProgram(partial.program);
    }

    var params = partial.params;
    if (params.length > 1) {
      throw new _exception2['default']('Unsupported number of partial arguments: ' + params.length, partial);
    } else if (!params.length) {
      if (this.options.explicitPartialContext) {
        this.opcode('pushLiteral', 'undefined');
      } else {
        params.push({ type: 'PathExpression', parts: [], depth: 0 });
      }
    }

    var partialName = partial.name.original,
        isDynamic = partial.name.type === 'SubExpression';
    if (isDynamic) {
      this.accept(partial.name);
    }

    this.setupFullMustacheParams(partial, program, undefined, true);

    var indent = partial.indent || '';
    if (this.options.preventIndent && indent) {
      this.opcode('appendContent', indent);
      indent = '';
    }

    this.opcode('invokePartial', isDynamic, partialName, indent);
    this.opcode('append');
  },
  PartialBlockStatement: function PartialBlockStatement(partialBlock) {
    this.PartialStatement(partialBlock);
  },

  MustacheStatement: function MustacheStatement(mustache) {
    this.SubExpression(mustache);

    if (mustache.escaped && !this.options.noEscape) {
      this.opcode('appendEscaped');
    } else {
      this.opcode('append');
    }
  },
  Decorator: function Decorator(decorator) {
    this.DecoratorBlock(decorator);
  },

  ContentStatement: function ContentStatement(content) {
    if (content.value) {
      this.opcode('appendContent', content.value);
    }
  },

  CommentStatement: function CommentStatement() {},

  SubExpression: function SubExpression(sexpr) {
    transformLiteralToPath(sexpr);
    var type = this.classifySexpr(sexpr);

    if (type === 'simple') {
      this.simpleSexpr(sexpr);
    } else if (type === 'helper') {
      this.helperSexpr(sexpr);
    } else {
      this.ambiguousSexpr(sexpr);
    }
  },
  ambiguousSexpr: function ambiguousSexpr(sexpr, program, inverse) {
    var path = sexpr.path,
        name = path.parts[0],
        isBlock = program != null || inverse != null;

    this.opcode('getContext', path.depth);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    path.strict = true;
    this.accept(path);

    this.opcode('invokeAmbiguous', name, isBlock);
  },

  simpleSexpr: function simpleSexpr(sexpr) {
    var path = sexpr.path;
    path.strict = true;
    this.accept(path);
    this.opcode('resolvePossibleLambda');
  },

  helperSexpr: function helperSexpr(sexpr, program, inverse) {
    var params = this.setupFullMustacheParams(sexpr, program, inverse),
        path = sexpr.path,
        name = path.parts[0];

    if (this.options.knownHelpers[name]) {
      this.opcode('invokeKnownHelper', params.length, name);
    } else if (this.options.knownHelpersOnly) {
      throw new _exception2['default']('You specified knownHelpersOnly, but used the unknown helper ' + name, sexpr);
    } else {
      path.strict = true;
      path.falsy = true;

      this.accept(path);
      this.opcode('invokeHelper', params.length, path.original, _ast2['default'].helpers.simpleId(path));
    }
  },

  PathExpression: function PathExpression(path) {
    this.addDepth(path.depth);
    this.opcode('getContext', path.depth);

    var name = path.parts[0],
        scoped = _ast2['default'].helpers.scopedId(path),
        blockParamId = !path.depth && !scoped && this.blockParamIndex(name);

    if (blockParamId) {
      this.opcode('lookupBlockParam', blockParamId, path.parts);
    } else if (!name) {
      // Context reference, i.e. `{{foo .}}` or `{{foo ..}}`
      this.opcode('pushContext');
    } else if (path.data) {
      this.options.data = true;
      this.opcode('lookupData', path.depth, path.parts, path.strict);
    } else {
      this.opcode('lookupOnContext', path.parts, path.falsy, path.strict, scoped);
    }
  },

  StringLiteral: function StringLiteral(string) {
    this.opcode('pushString', string.value);
  },

  NumberLiteral: function NumberLiteral(number) {
    this.opcode('pushLiteral', number.value);
  },

  BooleanLiteral: function BooleanLiteral(bool) {
    this.opcode('pushLiteral', bool.value);
  },

  UndefinedLiteral: function UndefinedLiteral() {
    this.opcode('pushLiteral', 'undefined');
  },

  NullLiteral: function NullLiteral() {
    this.opcode('pushLiteral', 'null');
  },

  Hash: function Hash(hash) {
    var pairs = hash.pairs,
        i = 0,
        l = pairs.length;

    this.opcode('pushHash');

    for (; i < l; i++) {
      this.pushParam(pairs[i].value);
    }
    while (i--) {
      this.opcode('assignToHash', pairs[i].key);
    }
    this.opcode('popHash');
  },

  // HELPERS
  opcode: function opcode(name) {
    this.opcodes.push({ opcode: name, args: slice.call(arguments, 1), loc: this.sourceNode[0].loc });
  },

  addDepth: function addDepth(depth) {
    if (!depth) {
      return;
    }

    this.useDepths = true;
  },

  classifySexpr: function classifySexpr(sexpr) {
    var isSimple = _ast2['default'].helpers.simpleId(sexpr.path);

    var isBlockParam = isSimple && !!this.blockParamIndex(sexpr.path.parts[0]);

    // a mustache is an eligible helper if:
    // * its id is simple (a single part, not `this` or `..`)
    var isHelper = !isBlockParam && _ast2['default'].helpers.helperExpression(sexpr);

    // if a mustache is an eligible helper but not a definite
    // helper, it is ambiguous, and will be resolved in a later
    // pass or at runtime.
    var isEligible = !isBlockParam && (isHelper || isSimple);

    // if ambiguous, we can possibly resolve the ambiguity now
    // An eligible helper is one that does not have a complex path, i.e. `this.foo`, `../foo` etc.
    if (isEligible && !isHelper) {
      var _name2 = sexpr.path.parts[0],
          options = this.options;

      if (options.knownHelpers[_name2]) {
        isHelper = true;
      } else if (options.knownHelpersOnly) {
        isEligible = false;
      }
    }

    if (isHelper) {
      return 'helper';
    } else if (isEligible) {
      return 'ambiguous';
    } else {
      return 'simple';
    }
  },

  pushParams: function pushParams(params) {
    for (var i = 0, l = params.length; i < l; i++) {
      this.pushParam(params[i]);
    }
  },

  pushParam: function pushParam(val) {
    var value = val.value != null ? val.value : val.original || '';

    if (this.stringParams) {
      if (value.replace) {
        value = value.replace(/^(\.?\.\/)*/g, '').replace(/\//g, '.');
      }

      if (val.depth) {
        this.addDepth(val.depth);
      }
      this.opcode('getContext', val.depth || 0);
      this.opcode('pushStringParam', value, val.type);

      if (val.type === 'SubExpression') {
        // SubExpressions get evaluated and passed in
        // in string params mode.
        this.accept(val);
      }
    } else {
      if (this.trackIds) {
        var blockParamIndex = undefined;
        if (val.parts && !_ast2['default'].helpers.scopedId(val) && !val.depth) {
          blockParamIndex = this.blockParamIndex(val.parts[0]);
        }
        if (blockParamIndex) {
          var blockParamChild = val.parts.slice(1).join('.');
          this.opcode('pushId', 'BlockParam', blockParamIndex, blockParamChild);
        } else {
          value = val.original || value;
          if (value.replace) {
            value = value.replace(/^this(?:\.|$)/, '').replace(/^\.\//, '').replace(/^\.$/, '');
          }

          this.opcode('pushId', val.type, value);
        }
      }
      this.accept(val);
    }
  },

  setupFullMustacheParams: function setupFullMustacheParams(sexpr, program, inverse, omitEmpty) {
    var params = sexpr.params;
    this.pushParams(params);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    if (sexpr.hash) {
      this.accept(sexpr.hash);
    } else {
      this.opcode('emptyHash', omitEmpty);
    }

    return params;
  },

  blockParamIndex: function blockParamIndex(name) {
    for (var depth = 0, len = this.options.blockParams.length; depth < len; depth++) {
      var blockParams = this.options.blockParams[depth],
          param = blockParams && _utils.indexOf(blockParams, name);
      if (blockParams && param >= 0) {
        return [depth, param];
      }
    }
  }
};

function precompile(input, options, env) {
  if (input == null || typeof input !== 'string' && input.type !== 'Program') {
    throw new _exception2['default']('You must pass a string or Handlebars AST to Handlebars.precompile. You passed ' + input);
  }

  options = options || {};
  if (!('data' in options)) {
    options.data = true;
  }
  if (options.compat) {
    options.useDepths = true;
  }

  var ast = env.parse(input, options),
      environment = new env.Compiler().compile(ast, options);
  return new env.JavaScriptCompiler().compile(environment, options);
}

function compile(input, options, env) {
  if (options === undefined) options = {};

  if (input == null || typeof input !== 'string' && input.type !== 'Program') {
    throw new _exception2['default']('You must pass a string or Handlebars AST to Handlebars.compile. You passed ' + input);
  }

  if (!('data' in options)) {
    options.data = true;
  }
  if (options.compat) {
    options.useDepths = true;
  }

  var compiled = undefined;

  function compileInput() {
    var ast = env.parse(input, options),
        environment = new env.Compiler().compile(ast, options),
        templateSpec = new env.JavaScriptCompiler().compile(environment, options, undefined, true);
    return env.template(templateSpec);
  }

  // Template is only compiled on first use and cached after that point.
  function ret(context, execOptions) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled.call(this, context, execOptions);
  }
  ret._setup = function (setupOptions) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled._setup(setupOptions);
  };
  ret._child = function (i, data, blockParams, depths) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled._child(i, data, blockParams, depths);
  };
  return ret;
}

function argEquals(a, b) {
  if (a === b) {
    return true;
  }

  if (_utils.isArray(a) && _utils.isArray(b) && a.length === b.length) {
    for (var i = 0; i < a.length; i++) {
      if (!argEquals(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
}

function transformLiteralToPath(sexpr) {
  if (!sexpr.path.parts) {
    var literal = sexpr.path;
    // Casting to string here to make false and 0 literal values play nicely with the rest
    // of the system.
    sexpr.path = {
      type: 'PathExpression',
      data: false,
      depth: 0,
      parts: [literal.original + ''],
      original: literal.original + '',
      loc: literal.loc
    };
  }
}


},{"../exception":25,"../utils":38,"./ast":13}],17:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.SourceLocation = SourceLocation;
exports.id = id;
exports.stripFlags = stripFlags;
exports.stripComment = stripComment;
exports.preparePath = preparePath;
exports.prepareMustache = prepareMustache;
exports.prepareRawBlock = prepareRawBlock;
exports.prepareBlock = prepareBlock;
exports.prepareProgram = prepareProgram;
exports.preparePartialBlock = preparePartialBlock;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _exception = require('../exception');

var _exception2 = _interopRequireDefault(_exception);

function validateClose(open, close) {
  close = close.path ? close.path.original : close;

  if (open.path.original !== close) {
    var errorNode = { loc: open.path.loc };

    throw new _exception2['default'](open.path.original + " doesn't match " + close, errorNode);
  }
}

function SourceLocation(source, locInfo) {
  this.source = source;
  this.start = {
    line: locInfo.first_line,
    column: locInfo.first_column
  };
  this.end = {
    line: locInfo.last_line,
    column: locInfo.last_column
  };
}

function id(token) {
  if (/^\[.*\]$/.test(token)) {
    return token.substr(1, token.length - 2);
  } else {
    return token;
  }
}

function stripFlags(open, close) {
  return {
    open: open.charAt(2) === '~',
    close: close.charAt(close.length - 3) === '~'
  };
}

function stripComment(comment) {
  return comment.replace(/^\{\{~?\!-?-?/, '').replace(/-?-?~?\}\}$/, '');
}

function preparePath(data, parts, loc) {
  loc = this.locInfo(loc);

  var original = data ? '@' : '',
      dig = [],
      depth = 0,
      depthString = '';

  for (var i = 0, l = parts.length; i < l; i++) {
    var part = parts[i].part,

    // If we have [] syntax then we do not treat path references as operators,
    // i.e. foo.[this] resolves to approximately context.foo['this']
    isLiteral = parts[i].original !== part;
    original += (parts[i].separator || '') + part;

    if (!isLiteral && (part === '..' || part === '.' || part === 'this')) {
      if (dig.length > 0) {
        throw new _exception2['default']('Invalid path: ' + original, { loc: loc });
      } else if (part === '..') {
        depth++;
        depthString += '../';
      }
    } else {
      dig.push(part);
    }
  }

  return {
    type: 'PathExpression',
    data: data,
    depth: depth,
    parts: dig,
    original: original,
    loc: loc
  };
}

function prepareMustache(path, params, hash, open, strip, locInfo) {
  // Must use charAt to support IE pre-10
  var escapeFlag = open.charAt(3) || open.charAt(2),
      escaped = escapeFlag !== '{' && escapeFlag !== '&';

  var decorator = /\*/.test(open);
  return {
    type: decorator ? 'Decorator' : 'MustacheStatement',
    path: path,
    params: params,
    hash: hash,
    escaped: escaped,
    strip: strip,
    loc: this.locInfo(locInfo)
  };
}

function prepareRawBlock(openRawBlock, contents, close, locInfo) {
  validateClose(openRawBlock, close);

  locInfo = this.locInfo(locInfo);
  var program = {
    type: 'Program',
    body: contents,
    strip: {},
    loc: locInfo
  };

  return {
    type: 'BlockStatement',
    path: openRawBlock.path,
    params: openRawBlock.params,
    hash: openRawBlock.hash,
    program: program,
    openStrip: {},
    inverseStrip: {},
    closeStrip: {},
    loc: locInfo
  };
}

function prepareBlock(openBlock, program, inverseAndProgram, close, inverted, locInfo) {
  if (close && close.path) {
    validateClose(openBlock, close);
  }

  var decorator = /\*/.test(openBlock.open);

  program.blockParams = openBlock.blockParams;

  var inverse = undefined,
      inverseStrip = undefined;

  if (inverseAndProgram) {
    if (decorator) {
      throw new _exception2['default']('Unexpected inverse block on decorator', inverseAndProgram);
    }

    if (inverseAndProgram.chain) {
      inverseAndProgram.program.body[0].closeStrip = close.strip;
    }

    inverseStrip = inverseAndProgram.strip;
    inverse = inverseAndProgram.program;
  }

  if (inverted) {
    inverted = inverse;
    inverse = program;
    program = inverted;
  }

  return {
    type: decorator ? 'DecoratorBlock' : 'BlockStatement',
    path: openBlock.path,
    params: openBlock.params,
    hash: openBlock.hash,
    program: program,
    inverse: inverse,
    openStrip: openBlock.strip,
    inverseStrip: inverseStrip,
    closeStrip: close && close.strip,
    loc: this.locInfo(locInfo)
  };
}

function prepareProgram(statements, loc) {
  if (!loc && statements.length) {
    var firstLoc = statements[0].loc,
        lastLoc = statements[statements.length - 1].loc;

    /* istanbul ignore else */
    if (firstLoc && lastLoc) {
      loc = {
        source: firstLoc.source,
        start: {
          line: firstLoc.start.line,
          column: firstLoc.start.column
        },
        end: {
          line: lastLoc.end.line,
          column: lastLoc.end.column
        }
      };
    }
  }

  return {
    type: 'Program',
    body: statements,
    strip: {},
    loc: loc
  };
}

function preparePartialBlock(open, program, close, locInfo) {
  validateClose(open, close);

  return {
    type: 'PartialBlockStatement',
    name: open.path,
    params: open.params,
    hash: open.hash,
    program: program,
    openStrip: open.strip,
    closeStrip: close && close.strip,
    loc: this.locInfo(locInfo)
  };
}


},{"../exception":25}],18:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _base = require('../base');

var _exception = require('../exception');

var _exception2 = _interopRequireDefault(_exception);

var _utils = require('../utils');

var _codeGen = require('./code-gen');

var _codeGen2 = _interopRequireDefault(_codeGen);

function Literal(value) {
  this.value = value;
}

function JavaScriptCompiler() {}

JavaScriptCompiler.prototype = {
  // PUBLIC API: You can override these methods in a subclass to provide
  // alternative compiled forms for name lookup and buffering semantics
  nameLookup: function nameLookup(parent, name /* , type*/) {
    if (JavaScriptCompiler.isValidJavaScriptVariableName(name)) {
      return [parent, '.', name];
    } else {
      return [parent, '[', JSON.stringify(name), ']'];
    }
  },
  depthedLookup: function depthedLookup(name) {
    return [this.aliasable('container.lookup'), '(depths, "', name, '")'];
  },

  compilerInfo: function compilerInfo() {
    var revision = _base.COMPILER_REVISION,
        versions = _base.REVISION_CHANGES[revision];
    return [revision, versions];
  },

  appendToBuffer: function appendToBuffer(source, location, explicit) {
    // Force a source as this simplifies the merge logic.
    if (!_utils.isArray(source)) {
      source = [source];
    }
    source = this.source.wrap(source, location);

    if (this.environment.isSimple) {
      return ['return ', source, ';'];
    } else if (explicit) {
      // This is a case where the buffer operation occurs as a child of another
      // construct, generally braces. We have to explicitly output these buffer
      // operations to ensure that the emitted code goes in the correct location.
      return ['buffer += ', source, ';'];
    } else {
      source.appendToBuffer = true;
      return source;
    }
  },

  initializeBuffer: function initializeBuffer() {
    return this.quotedString('');
  },
  // END PUBLIC API

  compile: function compile(environment, options, context, asObject) {
    this.environment = environment;
    this.options = options;
    this.stringParams = this.options.stringParams;
    this.trackIds = this.options.trackIds;
    this.precompile = !asObject;

    this.name = this.environment.name;
    this.isChild = !!context;
    this.context = context || {
      decorators: [],
      programs: [],
      environments: []
    };

    this.preamble();

    this.stackSlot = 0;
    this.stackVars = [];
    this.aliases = {};
    this.registers = { list: [] };
    this.hashes = [];
    this.compileStack = [];
    this.inlineStack = [];
    this.blockParams = [];

    this.compileChildren(environment, options);

    this.useDepths = this.useDepths || environment.useDepths || environment.useDecorators || this.options.compat;
    this.useBlockParams = this.useBlockParams || environment.useBlockParams;

    var opcodes = environment.opcodes,
        opcode = undefined,
        firstLoc = undefined,
        i = undefined,
        l = undefined;

    for (i = 0, l = opcodes.length; i < l; i++) {
      opcode = opcodes[i];

      this.source.currentLocation = opcode.loc;
      firstLoc = firstLoc || opcode.loc;
      this[opcode.opcode].apply(this, opcode.args);
    }

    // Flush any trailing content that might be pending.
    this.source.currentLocation = firstLoc;
    this.pushSource('');

    /* istanbul ignore next */
    if (this.stackSlot || this.inlineStack.length || this.compileStack.length) {
      throw new _exception2['default']('Compile completed with content left on stack');
    }

    if (!this.decorators.isEmpty()) {
      this.useDecorators = true;

      this.decorators.prepend('var decorators = container.decorators;\n');
      this.decorators.push('return fn;');

      if (asObject) {
        this.decorators = Function.apply(this, ['fn', 'props', 'container', 'depth0', 'data', 'blockParams', 'depths', this.decorators.merge()]);
      } else {
        this.decorators.prepend('function(fn, props, container, depth0, data, blockParams, depths) {\n');
        this.decorators.push('}\n');
        this.decorators = this.decorators.merge();
      }
    } else {
      this.decorators = undefined;
    }

    var fn = this.createFunctionContext(asObject);
    if (!this.isChild) {
      var ret = {
        compiler: this.compilerInfo(),
        main: fn
      };

      if (this.decorators) {
        ret.main_d = this.decorators; // eslint-disable-line camelcase
        ret.useDecorators = true;
      }

      var _context = this.context;
      var programs = _context.programs;
      var decorators = _context.decorators;

      for (i = 0, l = programs.length; i < l; i++) {
        if (programs[i]) {
          ret[i] = programs[i];
          if (decorators[i]) {
            ret[i + '_d'] = decorators[i];
            ret.useDecorators = true;
          }
        }
      }

      if (this.environment.usePartial) {
        ret.usePartial = true;
      }
      if (this.options.data) {
        ret.useData = true;
      }
      if (this.useDepths) {
        ret.useDepths = true;
      }
      if (this.useBlockParams) {
        ret.useBlockParams = true;
      }
      if (this.options.compat) {
        ret.compat = true;
      }

      if (!asObject) {
        ret.compiler = JSON.stringify(ret.compiler);

        this.source.currentLocation = { start: { line: 1, column: 0 } };
        ret = this.objectLiteral(ret);

        if (options.srcName) {
          ret = ret.toStringWithSourceMap({ file: options.destName });
          ret.map = ret.map && ret.map.toString();
        } else {
          ret = ret.toString();
        }
      } else {
        ret.compilerOptions = this.options;
      }

      return ret;
    } else {
      return fn;
    }
  },

  preamble: function preamble() {
    // track the last context pushed into place to allow skipping the
    // getContext opcode when it would be a noop
    this.lastContext = 0;
    this.source = new _codeGen2['default'](this.options.srcName);
    this.decorators = new _codeGen2['default'](this.options.srcName);
  },

  createFunctionContext: function createFunctionContext(asObject) {
    var varDeclarations = '';

    var locals = this.stackVars.concat(this.registers.list);
    if (locals.length > 0) {
      varDeclarations += ', ' + locals.join(', ');
    }

    // Generate minimizer alias mappings
    //
    // When using true SourceNodes, this will update all references to the given alias
    // as the source nodes are reused in situ. For the non-source node compilation mode,
    // aliases will not be used, but this case is already being run on the client and
    // we aren't concern about minimizing the template size.
    var aliasCount = 0;
    for (var alias in this.aliases) {
      // eslint-disable-line guard-for-in
      var node = this.aliases[alias];

      if (this.aliases.hasOwnProperty(alias) && node.children && node.referenceCount > 1) {
        varDeclarations += ', alias' + ++aliasCount + '=' + alias;
        node.children[0] = 'alias' + aliasCount;
      }
    }

    var params = ['container', 'depth0', 'helpers', 'partials', 'data'];

    if (this.useBlockParams || this.useDepths) {
      params.push('blockParams');
    }
    if (this.useDepths) {
      params.push('depths');
    }

    // Perform a second pass over the output to merge content when possible
    var source = this.mergeSource(varDeclarations);

    if (asObject) {
      params.push(source);

      return Function.apply(this, params);
    } else {
      return this.source.wrap(['function(', params.join(','), ') {\n  ', source, '}']);
    }
  },
  mergeSource: function mergeSource(varDeclarations) {
    var isSimple = this.environment.isSimple,
        appendOnly = !this.forceBuffer,
        appendFirst = undefined,
        sourceSeen = undefined,
        bufferStart = undefined,
        bufferEnd = undefined;
    this.source.each(function (line) {
      if (line.appendToBuffer) {
        if (bufferStart) {
          line.prepend('  + ');
        } else {
          bufferStart = line;
        }
        bufferEnd = line;
      } else {
        if (bufferStart) {
          if (!sourceSeen) {
            appendFirst = true;
          } else {
            bufferStart.prepend('buffer += ');
          }
          bufferEnd.add(';');
          bufferStart = bufferEnd = undefined;
        }

        sourceSeen = true;
        if (!isSimple) {
          appendOnly = false;
        }
      }
    });

    if (appendOnly) {
      if (bufferStart) {
        bufferStart.prepend('return ');
        bufferEnd.add(';');
      } else if (!sourceSeen) {
        this.source.push('return "";');
      }
    } else {
      varDeclarations += ', buffer = ' + (appendFirst ? '' : this.initializeBuffer());

      if (bufferStart) {
        bufferStart.prepend('return buffer + ');
        bufferEnd.add(';');
      } else {
        this.source.push('return buffer;');
      }
    }

    if (varDeclarations) {
      this.source.prepend('var ' + varDeclarations.substring(2) + (appendFirst ? '' : ';\n'));
    }

    return this.source.merge();
  },

  // [blockValue]
  //
  // On stack, before: hash, inverse, program, value
  // On stack, after: return value of blockHelperMissing
  //
  // The purpose of this opcode is to take a block of the form
  // `{{#this.foo}}...{{/this.foo}}`, resolve the value of `foo`, and
  // replace it on the stack with the result of properly
  // invoking blockHelperMissing.
  blockValue: function blockValue(name) {
    var blockHelperMissing = this.aliasable('helpers.blockHelperMissing'),
        params = [this.contextName(0)];
    this.setupHelperArgs(name, 0, params);

    var blockName = this.popStack();
    params.splice(1, 0, blockName);

    this.push(this.source.functionCall(blockHelperMissing, 'call', params));
  },

  // [ambiguousBlockValue]
  //
  // On stack, before: hash, inverse, program, value
  // Compiler value, before: lastHelper=value of last found helper, if any
  // On stack, after, if no lastHelper: same as [blockValue]
  // On stack, after, if lastHelper: value
  ambiguousBlockValue: function ambiguousBlockValue() {
    // We're being a bit cheeky and reusing the options value from the prior exec
    var blockHelperMissing = this.aliasable('helpers.blockHelperMissing'),
        params = [this.contextName(0)];
    this.setupHelperArgs('', 0, params, true);

    this.flushInline();

    var current = this.topStack();
    params.splice(1, 0, current);

    this.pushSource(['if (!', this.lastHelper, ') { ', current, ' = ', this.source.functionCall(blockHelperMissing, 'call', params), '}']);
  },

  // [appendContent]
  //
  // On stack, before: ...
  // On stack, after: ...
  //
  // Appends the string value of `content` to the current buffer
  appendContent: function appendContent(content) {
    if (this.pendingContent) {
      content = this.pendingContent + content;
    } else {
      this.pendingLocation = this.source.currentLocation;
    }

    this.pendingContent = content;
  },

  // [append]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Coerces `value` to a String and appends it to the current buffer.
  //
  // If `value` is truthy, or 0, it is coerced into a string and appended
  // Otherwise, the empty string is appended
  append: function append() {
    if (this.isInline()) {
      this.replaceStack(function (current) {
        return [' != null ? ', current, ' : ""'];
      });

      this.pushSource(this.appendToBuffer(this.popStack()));
    } else {
      var local = this.popStack();
      this.pushSource(['if (', local, ' != null) { ', this.appendToBuffer(local, undefined, true), ' }']);
      if (this.environment.isSimple) {
        this.pushSource(['else { ', this.appendToBuffer("''", undefined, true), ' }']);
      }
    }
  },

  // [appendEscaped]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Escape `value` and append it to the buffer
  appendEscaped: function appendEscaped() {
    this.pushSource(this.appendToBuffer([this.aliasable('container.escapeExpression'), '(', this.popStack(), ')']));
  },

  // [getContext]
  //
  // On stack, before: ...
  // On stack, after: ...
  // Compiler value, after: lastContext=depth
  //
  // Set the value of the `lastContext` compiler value to the depth
  getContext: function getContext(depth) {
    this.lastContext = depth;
  },

  // [pushContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext, ...
  //
  // Pushes the value of the current context onto the stack.
  pushContext: function pushContext() {
    this.pushStackLiteral(this.contextName(this.lastContext));
  },

  // [lookupOnContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext[name], ...
  //
  // Looks up the value of `name` on the current context and pushes
  // it onto the stack.
  lookupOnContext: function lookupOnContext(parts, falsy, strict, scoped) {
    var i = 0;

    if (!scoped && this.options.compat && !this.lastContext) {
      // The depthed query is expected to handle the undefined logic for the root level that
      // is implemented below, so we evaluate that directly in compat mode
      this.push(this.depthedLookup(parts[i++]));
    } else {
      this.pushContext();
    }

    this.resolvePath('context', parts, i, falsy, strict);
  },

  // [lookupBlockParam]
  //
  // On stack, before: ...
  // On stack, after: blockParam[name], ...
  //
  // Looks up the value of `parts` on the given block param and pushes
  // it onto the stack.
  lookupBlockParam: function lookupBlockParam(blockParamId, parts) {
    this.useBlockParams = true;

    this.push(['blockParams[', blockParamId[0], '][', blockParamId[1], ']']);
    this.resolvePath('context', parts, 1);
  },

  // [lookupData]
  //
  // On stack, before: ...
  // On stack, after: data, ...
  //
  // Push the data lookup operator
  lookupData: function lookupData(depth, parts, strict) {
    if (!depth) {
      this.pushStackLiteral('data');
    } else {
      this.pushStackLiteral('container.data(data, ' + depth + ')');
    }

    this.resolvePath('data', parts, 0, true, strict);
  },

  resolvePath: function resolvePath(type, parts, i, falsy, strict) {
    // istanbul ignore next

    var _this = this;

    if (this.options.strict || this.options.assumeObjects) {
      this.push(strictLookup(this.options.strict && strict, this, parts, type));
      return;
    }

    var len = parts.length;
    for (; i < len; i++) {
      /* eslint-disable no-loop-func */
      this.replaceStack(function (current) {
        var lookup = _this.nameLookup(current, parts[i], type);
        // We want to ensure that zero and false are handled properly if the context (falsy flag)
        // needs to have the special handling for these values.
        if (!falsy) {
          return [' != null ? ', lookup, ' : ', current];
        } else {
          // Otherwise we can use generic falsy handling
          return [' && ', lookup];
        }
      });
      /* eslint-enable no-loop-func */
    }
  },

  // [resolvePossibleLambda]
  //
  // On stack, before: value, ...
  // On stack, after: resolved value, ...
  //
  // If the `value` is a lambda, replace it on the stack by
  // the return value of the lambda
  resolvePossibleLambda: function resolvePossibleLambda() {
    this.push([this.aliasable('container.lambda'), '(', this.popStack(), ', ', this.contextName(0), ')']);
  },

  // [pushStringParam]
  //
  // On stack, before: ...
  // On stack, after: string, currentContext, ...
  //
  // This opcode is designed for use in string mode, which
  // provides the string value of a parameter along with its
  // depth rather than resolving it immediately.
  pushStringParam: function pushStringParam(string, type) {
    this.pushContext();
    this.pushString(type);

    // If it's a subexpression, the string result
    // will be pushed after this opcode.
    if (type !== 'SubExpression') {
      if (typeof string === 'string') {
        this.pushString(string);
      } else {
        this.pushStackLiteral(string);
      }
    }
  },

  emptyHash: function emptyHash(omitEmpty) {
    if (this.trackIds) {
      this.push('{}'); // hashIds
    }
    if (this.stringParams) {
      this.push('{}'); // hashContexts
      this.push('{}'); // hashTypes
    }
    this.pushStackLiteral(omitEmpty ? 'undefined' : '{}');
  },
  pushHash: function pushHash() {
    if (this.hash) {
      this.hashes.push(this.hash);
    }
    this.hash = { values: [], types: [], contexts: [], ids: [] };
  },
  popHash: function popHash() {
    var hash = this.hash;
    this.hash = this.hashes.pop();

    if (this.trackIds) {
      this.push(this.objectLiteral(hash.ids));
    }
    if (this.stringParams) {
      this.push(this.objectLiteral(hash.contexts));
      this.push(this.objectLiteral(hash.types));
    }

    this.push(this.objectLiteral(hash.values));
  },

  // [pushString]
  //
  // On stack, before: ...
  // On stack, after: quotedString(string), ...
  //
  // Push a quoted version of `string` onto the stack
  pushString: function pushString(string) {
    this.pushStackLiteral(this.quotedString(string));
  },

  // [pushLiteral]
  //
  // On stack, before: ...
  // On stack, after: value, ...
  //
  // Pushes a value onto the stack. This operation prevents
  // the compiler from creating a temporary variable to hold
  // it.
  pushLiteral: function pushLiteral(value) {
    this.pushStackLiteral(value);
  },

  // [pushProgram]
  //
  // On stack, before: ...
  // On stack, after: program(guid), ...
  //
  // Push a program expression onto the stack. This takes
  // a compile-time guid and converts it into a runtime-accessible
  // expression.
  pushProgram: function pushProgram(guid) {
    if (guid != null) {
      this.pushStackLiteral(this.programExpression(guid));
    } else {
      this.pushStackLiteral(null);
    }
  },

  // [registerDecorator]
  //
  // On stack, before: hash, program, params..., ...
  // On stack, after: ...
  //
  // Pops off the decorator's parameters, invokes the decorator,
  // and inserts the decorator into the decorators list.
  registerDecorator: function registerDecorator(paramSize, name) {
    var foundDecorator = this.nameLookup('decorators', name, 'decorator'),
        options = this.setupHelperArgs(name, paramSize);

    this.decorators.push(['fn = ', this.decorators.functionCall(foundDecorator, '', ['fn', 'props', 'container', options]), ' || fn;']);
  },

  // [invokeHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // Pops off the helper's parameters, invokes the helper,
  // and pushes the helper's return value onto the stack.
  //
  // If the helper is not found, `helperMissing` is called.
  invokeHelper: function invokeHelper(paramSize, name, isSimple) {
    var nonHelper = this.popStack(),
        helper = this.setupHelper(paramSize, name),
        simple = isSimple ? [helper.name, ' || '] : '';

    var lookup = ['('].concat(simple, nonHelper);
    if (!this.options.strict) {
      lookup.push(' || ', this.aliasable('helpers.helperMissing'));
    }
    lookup.push(')');

    this.push(this.source.functionCall(lookup, 'call', helper.callParams));
  },

  // [invokeKnownHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // This operation is used when the helper is known to exist,
  // so a `helperMissing` fallback is not required.
  invokeKnownHelper: function invokeKnownHelper(paramSize, name) {
    var helper = this.setupHelper(paramSize, name);
    this.push(this.source.functionCall(helper.name, 'call', helper.callParams));
  },

  // [invokeAmbiguous]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of disambiguation
  //
  // This operation is used when an expression like `{{foo}}`
  // is provided, but we don't know at compile-time whether it
  // is a helper or a path.
  //
  // This operation emits more code than the other options,
  // and can be avoided by passing the `knownHelpers` and
  // `knownHelpersOnly` flags at compile-time.
  invokeAmbiguous: function invokeAmbiguous(name, helperCall) {
    this.useRegister('helper');

    var nonHelper = this.popStack();

    this.emptyHash();
    var helper = this.setupHelper(0, name, helperCall);

    var helperName = this.lastHelper = this.nameLookup('helpers', name, 'helper');

    var lookup = ['(', '(helper = ', helperName, ' || ', nonHelper, ')'];
    if (!this.options.strict) {
      lookup[0] = '(helper = ';
      lookup.push(' != null ? helper : ', this.aliasable('helpers.helperMissing'));
    }

    this.push(['(', lookup, helper.paramsInit ? ['),(', helper.paramsInit] : [], '),', '(typeof helper === ', this.aliasable('"function"'), ' ? ', this.source.functionCall('helper', 'call', helper.callParams), ' : helper))']);
  },

  // [invokePartial]
  //
  // On stack, before: context, ...
  // On stack after: result of partial invocation
  //
  // This operation pops off a context, invokes a partial with that context,
  // and pushes the result of the invocation back.
  invokePartial: function invokePartial(isDynamic, name, indent) {
    var params = [],
        options = this.setupParams(name, 1, params);

    if (isDynamic) {
      name = this.popStack();
      delete options.name;
    }

    if (indent) {
      options.indent = JSON.stringify(indent);
    }
    options.helpers = 'helpers';
    options.partials = 'partials';
    options.decorators = 'container.decorators';

    if (!isDynamic) {
      params.unshift(this.nameLookup('partials', name, 'partial'));
    } else {
      params.unshift(name);
    }

    if (this.options.compat) {
      options.depths = 'depths';
    }
    options = this.objectLiteral(options);
    params.push(options);

    this.push(this.source.functionCall('container.invokePartial', '', params));
  },

  // [assignToHash]
  //
  // On stack, before: value, ..., hash, ...
  // On stack, after: ..., hash, ...
  //
  // Pops a value off the stack and assigns it to the current hash
  assignToHash: function assignToHash(key) {
    var value = this.popStack(),
        context = undefined,
        type = undefined,
        id = undefined;

    if (this.trackIds) {
      id = this.popStack();
    }
    if (this.stringParams) {
      type = this.popStack();
      context = this.popStack();
    }

    var hash = this.hash;
    if (context) {
      hash.contexts[key] = context;
    }
    if (type) {
      hash.types[key] = type;
    }
    if (id) {
      hash.ids[key] = id;
    }
    hash.values[key] = value;
  },

  pushId: function pushId(type, name, child) {
    if (type === 'BlockParam') {
      this.pushStackLiteral('blockParams[' + name[0] + '].path[' + name[1] + ']' + (child ? ' + ' + JSON.stringify('.' + child) : ''));
    } else if (type === 'PathExpression') {
      this.pushString(name);
    } else if (type === 'SubExpression') {
      this.pushStackLiteral('true');
    } else {
      this.pushStackLiteral('null');
    }
  },

  // HELPERS

  compiler: JavaScriptCompiler,

  compileChildren: function compileChildren(environment, options) {
    var children = environment.children,
        child = undefined,
        compiler = undefined;

    for (var i = 0, l = children.length; i < l; i++) {
      child = children[i];
      compiler = new this.compiler(); // eslint-disable-line new-cap

      var index = this.matchExistingProgram(child);

      if (index == null) {
        this.context.programs.push(''); // Placeholder to prevent name conflicts for nested children
        index = this.context.programs.length;
        child.index = index;
        child.name = 'program' + index;
        this.context.programs[index] = compiler.compile(child, options, this.context, !this.precompile);
        this.context.decorators[index] = compiler.decorators;
        this.context.environments[index] = child;

        this.useDepths = this.useDepths || compiler.useDepths;
        this.useBlockParams = this.useBlockParams || compiler.useBlockParams;
      } else {
        child.index = index;
        child.name = 'program' + index;

        this.useDepths = this.useDepths || child.useDepths;
        this.useBlockParams = this.useBlockParams || child.useBlockParams;
      }
    }
  },
  matchExistingProgram: function matchExistingProgram(child) {
    for (var i = 0, len = this.context.environments.length; i < len; i++) {
      var environment = this.context.environments[i];
      if (environment && environment.equals(child)) {
        return i;
      }
    }
  },

  programExpression: function programExpression(guid) {
    var child = this.environment.children[guid],
        programParams = [child.index, 'data', child.blockParams];

    if (this.useBlockParams || this.useDepths) {
      programParams.push('blockParams');
    }
    if (this.useDepths) {
      programParams.push('depths');
    }

    return 'container.program(' + programParams.join(', ') + ')';
  },

  useRegister: function useRegister(name) {
    if (!this.registers[name]) {
      this.registers[name] = true;
      this.registers.list.push(name);
    }
  },

  push: function push(expr) {
    if (!(expr instanceof Literal)) {
      expr = this.source.wrap(expr);
    }

    this.inlineStack.push(expr);
    return expr;
  },

  pushStackLiteral: function pushStackLiteral(item) {
    this.push(new Literal(item));
  },

  pushSource: function pushSource(source) {
    if (this.pendingContent) {
      this.source.push(this.appendToBuffer(this.source.quotedString(this.pendingContent), this.pendingLocation));
      this.pendingContent = undefined;
    }

    if (source) {
      this.source.push(source);
    }
  },

  replaceStack: function replaceStack(callback) {
    var prefix = ['('],
        stack = undefined,
        createdStack = undefined,
        usedLiteral = undefined;

    /* istanbul ignore next */
    if (!this.isInline()) {
      throw new _exception2['default']('replaceStack on non-inline');
    }

    // We want to merge the inline statement into the replacement statement via ','
    var top = this.popStack(true);

    if (top instanceof Literal) {
      // Literals do not need to be inlined
      stack = [top.value];
      prefix = ['(', stack];
      usedLiteral = true;
    } else {
      // Get or create the current stack name for use by the inline
      createdStack = true;
      var _name = this.incrStack();

      prefix = ['((', this.push(_name), ' = ', top, ')'];
      stack = this.topStack();
    }

    var item = callback.call(this, stack);

    if (!usedLiteral) {
      this.popStack();
    }
    if (createdStack) {
      this.stackSlot--;
    }
    this.push(prefix.concat(item, ')'));
  },

  incrStack: function incrStack() {
    this.stackSlot++;
    if (this.stackSlot > this.stackVars.length) {
      this.stackVars.push('stack' + this.stackSlot);
    }
    return this.topStackName();
  },
  topStackName: function topStackName() {
    return 'stack' + this.stackSlot;
  },
  flushInline: function flushInline() {
    var inlineStack = this.inlineStack;
    this.inlineStack = [];
    for (var i = 0, len = inlineStack.length; i < len; i++) {
      var entry = inlineStack[i];
      /* istanbul ignore if */
      if (entry instanceof Literal) {
        this.compileStack.push(entry);
      } else {
        var stack = this.incrStack();
        this.pushSource([stack, ' = ', entry, ';']);
        this.compileStack.push(stack);
      }
    }
  },
  isInline: function isInline() {
    return this.inlineStack.length;
  },

  popStack: function popStack(wrapped) {
    var inline = this.isInline(),
        item = (inline ? this.inlineStack : this.compileStack).pop();

    if (!wrapped && item instanceof Literal) {
      return item.value;
    } else {
      if (!inline) {
        /* istanbul ignore next */
        if (!this.stackSlot) {
          throw new _exception2['default']('Invalid stack pop');
        }
        this.stackSlot--;
      }
      return item;
    }
  },

  topStack: function topStack() {
    var stack = this.isInline() ? this.inlineStack : this.compileStack,
        item = stack[stack.length - 1];

    /* istanbul ignore if */
    if (item instanceof Literal) {
      return item.value;
    } else {
      return item;
    }
  },

  contextName: function contextName(context) {
    if (this.useDepths && context) {
      return 'depths[' + context + ']';
    } else {
      return 'depth' + context;
    }
  },

  quotedString: function quotedString(str) {
    return this.source.quotedString(str);
  },

  objectLiteral: function objectLiteral(obj) {
    return this.source.objectLiteral(obj);
  },

  aliasable: function aliasable(name) {
    var ret = this.aliases[name];
    if (ret) {
      ret.referenceCount++;
      return ret;
    }

    ret = this.aliases[name] = this.source.wrap(name);
    ret.aliasable = true;
    ret.referenceCount = 1;

    return ret;
  },

  setupHelper: function setupHelper(paramSize, name, blockHelper) {
    var params = [],
        paramsInit = this.setupHelperArgs(name, paramSize, params, blockHelper);
    var foundHelper = this.nameLookup('helpers', name, 'helper'),
        callContext = this.aliasable(this.contextName(0) + ' != null ? ' + this.contextName(0) + ' : {}');

    return {
      params: params,
      paramsInit: paramsInit,
      name: foundHelper,
      callParams: [callContext].concat(params)
    };
  },

  setupParams: function setupParams(helper, paramSize, params) {
    var options = {},
        contexts = [],
        types = [],
        ids = [],
        objectArgs = !params,
        param = undefined;

    if (objectArgs) {
      params = [];
    }

    options.name = this.quotedString(helper);
    options.hash = this.popStack();

    if (this.trackIds) {
      options.hashIds = this.popStack();
    }
    if (this.stringParams) {
      options.hashTypes = this.popStack();
      options.hashContexts = this.popStack();
    }

    var inverse = this.popStack(),
        program = this.popStack();

    // Avoid setting fn and inverse if neither are set. This allows
    // helpers to do a check for `if (options.fn)`
    if (program || inverse) {
      options.fn = program || 'container.noop';
      options.inverse = inverse || 'container.noop';
    }

    // The parameters go on to the stack in order (making sure that they are evaluated in order)
    // so we need to pop them off the stack in reverse order
    var i = paramSize;
    while (i--) {
      param = this.popStack();
      params[i] = param;

      if (this.trackIds) {
        ids[i] = this.popStack();
      }
      if (this.stringParams) {
        types[i] = this.popStack();
        contexts[i] = this.popStack();
      }
    }

    if (objectArgs) {
      options.args = this.source.generateArray(params);
    }

    if (this.trackIds) {
      options.ids = this.source.generateArray(ids);
    }
    if (this.stringParams) {
      options.types = this.source.generateArray(types);
      options.contexts = this.source.generateArray(contexts);
    }

    if (this.options.data) {
      options.data = 'data';
    }
    if (this.useBlockParams) {
      options.blockParams = 'blockParams';
    }
    return options;
  },

  setupHelperArgs: function setupHelperArgs(helper, paramSize, params, useRegister) {
    var options = this.setupParams(helper, paramSize, params);
    options = this.objectLiteral(options);
    if (useRegister) {
      this.useRegister('options');
      params.push('options');
      return ['options=', options];
    } else if (params) {
      params.push(options);
      return '';
    } else {
      return options;
    }
  }
};

(function () {
  var reservedWords = ('break else new var' + ' case finally return void' + ' catch for switch while' + ' continue function this with' + ' default if throw' + ' delete in try' + ' do instanceof typeof' + ' abstract enum int short' + ' boolean export interface static' + ' byte extends long super' + ' char final native synchronized' + ' class float package throws' + ' const goto private transient' + ' debugger implements protected volatile' + ' double import public let yield await' + ' null true false').split(' ');

  var compilerWords = JavaScriptCompiler.RESERVED_WORDS = {};

  for (var i = 0, l = reservedWords.length; i < l; i++) {
    compilerWords[reservedWords[i]] = true;
  }
})();

JavaScriptCompiler.isValidJavaScriptVariableName = function (name) {
  return !JavaScriptCompiler.RESERVED_WORDS[name] && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(name);
};

function strictLookup(requireTerminal, compiler, parts, type) {
  var stack = compiler.popStack(),
      i = 0,
      len = parts.length;
  if (requireTerminal) {
    len--;
  }

  for (; i < len; i++) {
    stack = compiler.nameLookup(stack, parts[i], type);
  }

  if (requireTerminal) {
    return [compiler.aliasable('container.strict'), '(', stack, ', ', compiler.quotedString(parts[i]), ')'];
  } else {
    return stack;
  }
}

exports['default'] = JavaScriptCompiler;
module.exports = exports['default'];


},{"../base":12,"../exception":25,"../utils":38,"./code-gen":15}],19:[function(require,module,exports){
/* istanbul ignore next */
/* Jison generated parser */
"use strict";

var handlebars = (function () {
    var parser = { trace: function trace() {},
        yy: {},
        symbols_: { "error": 2, "root": 3, "program": 4, "EOF": 5, "program_repetition0": 6, "statement": 7, "mustache": 8, "block": 9, "rawBlock": 10, "partial": 11, "partialBlock": 12, "content": 13, "COMMENT": 14, "CONTENT": 15, "openRawBlock": 16, "rawBlock_repetition_plus0": 17, "END_RAW_BLOCK": 18, "OPEN_RAW_BLOCK": 19, "helperName": 20, "openRawBlock_repetition0": 21, "openRawBlock_option0": 22, "CLOSE_RAW_BLOCK": 23, "openBlock": 24, "block_option0": 25, "closeBlock": 26, "openInverse": 27, "block_option1": 28, "OPEN_BLOCK": 29, "openBlock_repetition0": 30, "openBlock_option0": 31, "openBlock_option1": 32, "CLOSE": 33, "OPEN_INVERSE": 34, "openInverse_repetition0": 35, "openInverse_option0": 36, "openInverse_option1": 37, "openInverseChain": 38, "OPEN_INVERSE_CHAIN": 39, "openInverseChain_repetition0": 40, "openInverseChain_option0": 41, "openInverseChain_option1": 42, "inverseAndProgram": 43, "INVERSE": 44, "inverseChain": 45, "inverseChain_option0": 46, "OPEN_ENDBLOCK": 47, "OPEN": 48, "mustache_repetition0": 49, "mustache_option0": 50, "OPEN_UNESCAPED": 51, "mustache_repetition1": 52, "mustache_option1": 53, "CLOSE_UNESCAPED": 54, "OPEN_PARTIAL": 55, "partialName": 56, "partial_repetition0": 57, "partial_option0": 58, "openPartialBlock": 59, "OPEN_PARTIAL_BLOCK": 60, "openPartialBlock_repetition0": 61, "openPartialBlock_option0": 62, "param": 63, "sexpr": 64, "OPEN_SEXPR": 65, "sexpr_repetition0": 66, "sexpr_option0": 67, "CLOSE_SEXPR": 68, "hash": 69, "hash_repetition_plus0": 70, "hashSegment": 71, "ID": 72, "EQUALS": 73, "blockParams": 74, "OPEN_BLOCK_PARAMS": 75, "blockParams_repetition_plus0": 76, "CLOSE_BLOCK_PARAMS": 77, "path": 78, "dataName": 79, "STRING": 80, "NUMBER": 81, "BOOLEAN": 82, "UNDEFINED": 83, "NULL": 84, "DATA": 85, "pathSegments": 86, "SEP": 87, "$accept": 0, "$end": 1 },
        terminals_: { 2: "error", 5: "EOF", 14: "COMMENT", 15: "CONTENT", 18: "END_RAW_BLOCK", 19: "OPEN_RAW_BLOCK", 23: "CLOSE_RAW_BLOCK", 29: "OPEN_BLOCK", 33: "CLOSE", 34: "OPEN_INVERSE", 39: "OPEN_INVERSE_CHAIN", 44: "INVERSE", 47: "OPEN_ENDBLOCK", 48: "OPEN", 51: "OPEN_UNESCAPED", 54: "CLOSE_UNESCAPED", 55: "OPEN_PARTIAL", 60: "OPEN_PARTIAL_BLOCK", 65: "OPEN_SEXPR", 68: "CLOSE_SEXPR", 72: "ID", 73: "EQUALS", 75: "OPEN_BLOCK_PARAMS", 77: "CLOSE_BLOCK_PARAMS", 80: "STRING", 81: "NUMBER", 82: "BOOLEAN", 83: "UNDEFINED", 84: "NULL", 85: "DATA", 87: "SEP" },
        productions_: [0, [3, 2], [4, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [7, 1], [13, 1], [10, 3], [16, 5], [9, 4], [9, 4], [24, 6], [27, 6], [38, 6], [43, 2], [45, 3], [45, 1], [26, 3], [8, 5], [8, 5], [11, 5], [12, 3], [59, 5], [63, 1], [63, 1], [64, 5], [69, 1], [71, 3], [74, 3], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [20, 1], [56, 1], [56, 1], [79, 2], [78, 1], [86, 3], [86, 1], [6, 0], [6, 2], [17, 1], [17, 2], [21, 0], [21, 2], [22, 0], [22, 1], [25, 0], [25, 1], [28, 0], [28, 1], [30, 0], [30, 2], [31, 0], [31, 1], [32, 0], [32, 1], [35, 0], [35, 2], [36, 0], [36, 1], [37, 0], [37, 1], [40, 0], [40, 2], [41, 0], [41, 1], [42, 0], [42, 1], [46, 0], [46, 1], [49, 0], [49, 2], [50, 0], [50, 1], [52, 0], [52, 2], [53, 0], [53, 1], [57, 0], [57, 2], [58, 0], [58, 1], [61, 0], [61, 2], [62, 0], [62, 1], [66, 0], [66, 2], [67, 0], [67, 1], [70, 1], [70, 2], [76, 1], [76, 2]],
        performAction: function anonymous(yytext, yyleng, yylineno, yy, yystate, $$, _$
        /**/) {

            var $0 = $$.length - 1;
            switch (yystate) {
                case 1:
                    return $$[$0 - 1];
                    break;
                case 2:
                    this.$ = yy.prepareProgram($$[$0]);
                    break;
                case 3:
                    this.$ = $$[$0];
                    break;
                case 4:
                    this.$ = $$[$0];
                    break;
                case 5:
                    this.$ = $$[$0];
                    break;
                case 6:
                    this.$ = $$[$0];
                    break;
                case 7:
                    this.$ = $$[$0];
                    break;
                case 8:
                    this.$ = $$[$0];
                    break;
                case 9:
                    this.$ = {
                        type: 'CommentStatement',
                        value: yy.stripComment($$[$0]),
                        strip: yy.stripFlags($$[$0], $$[$0]),
                        loc: yy.locInfo(this._$)
                    };

                    break;
                case 10:
                    this.$ = {
                        type: 'ContentStatement',
                        original: $$[$0],
                        value: $$[$0],
                        loc: yy.locInfo(this._$)
                    };

                    break;
                case 11:
                    this.$ = yy.prepareRawBlock($$[$0 - 2], $$[$0 - 1], $$[$0], this._$);
                    break;
                case 12:
                    this.$ = { path: $$[$0 - 3], params: $$[$0 - 2], hash: $$[$0 - 1] };
                    break;
                case 13:
                    this.$ = yy.prepareBlock($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0], false, this._$);
                    break;
                case 14:
                    this.$ = yy.prepareBlock($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0], true, this._$);
                    break;
                case 15:
                    this.$ = { open: $$[$0 - 5], path: $$[$0 - 4], params: $$[$0 - 3], hash: $$[$0 - 2], blockParams: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 5], $$[$0]) };
                    break;
                case 16:
                    this.$ = { path: $$[$0 - 4], params: $$[$0 - 3], hash: $$[$0 - 2], blockParams: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 5], $$[$0]) };
                    break;
                case 17:
                    this.$ = { path: $$[$0 - 4], params: $$[$0 - 3], hash: $$[$0 - 2], blockParams: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 5], $$[$0]) };
                    break;
                case 18:
                    this.$ = { strip: yy.stripFlags($$[$0 - 1], $$[$0 - 1]), program: $$[$0] };
                    break;
                case 19:
                    var inverse = yy.prepareBlock($$[$0 - 2], $$[$0 - 1], $$[$0], $$[$0], false, this._$),
                        program = yy.prepareProgram([inverse], $$[$0 - 1].loc);
                    program.chained = true;

                    this.$ = { strip: $$[$0 - 2].strip, program: program, chain: true };

                    break;
                case 20:
                    this.$ = $$[$0];
                    break;
                case 21:
                    this.$ = { path: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 2], $$[$0]) };
                    break;
                case 22:
                    this.$ = yy.prepareMustache($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0 - 4], yy.stripFlags($$[$0 - 4], $$[$0]), this._$);
                    break;
                case 23:
                    this.$ = yy.prepareMustache($$[$0 - 3], $$[$0 - 2], $$[$0 - 1], $$[$0 - 4], yy.stripFlags($$[$0 - 4], $$[$0]), this._$);
                    break;
                case 24:
                    this.$ = {
                        type: 'PartialStatement',
                        name: $$[$0 - 3],
                        params: $$[$0 - 2],
                        hash: $$[$0 - 1],
                        indent: '',
                        strip: yy.stripFlags($$[$0 - 4], $$[$0]),
                        loc: yy.locInfo(this._$)
                    };

                    break;
                case 25:
                    this.$ = yy.preparePartialBlock($$[$0 - 2], $$[$0 - 1], $$[$0], this._$);
                    break;
                case 26:
                    this.$ = { path: $$[$0 - 3], params: $$[$0 - 2], hash: $$[$0 - 1], strip: yy.stripFlags($$[$0 - 4], $$[$0]) };
                    break;
                case 27:
                    this.$ = $$[$0];
                    break;
                case 28:
                    this.$ = $$[$0];
                    break;
                case 29:
                    this.$ = {
                        type: 'SubExpression',
                        path: $$[$0 - 3],
                        params: $$[$0 - 2],
                        hash: $$[$0 - 1],
                        loc: yy.locInfo(this._$)
                    };

                    break;
                case 30:
                    this.$ = { type: 'Hash', pairs: $$[$0], loc: yy.locInfo(this._$) };
                    break;
                case 31:
                    this.$ = { type: 'HashPair', key: yy.id($$[$0 - 2]), value: $$[$0], loc: yy.locInfo(this._$) };
                    break;
                case 32:
                    this.$ = yy.id($$[$0 - 1]);
                    break;
                case 33:
                    this.$ = $$[$0];
                    break;
                case 34:
                    this.$ = $$[$0];
                    break;
                case 35:
                    this.$ = { type: 'StringLiteral', value: $$[$0], original: $$[$0], loc: yy.locInfo(this._$) };
                    break;
                case 36:
                    this.$ = { type: 'NumberLiteral', value: Number($$[$0]), original: Number($$[$0]), loc: yy.locInfo(this._$) };
                    break;
                case 37:
                    this.$ = { type: 'BooleanLiteral', value: $$[$0] === 'true', original: $$[$0] === 'true', loc: yy.locInfo(this._$) };
                    break;
                case 38:
                    this.$ = { type: 'UndefinedLiteral', original: undefined, value: undefined, loc: yy.locInfo(this._$) };
                    break;
                case 39:
                    this.$ = { type: 'NullLiteral', original: null, value: null, loc: yy.locInfo(this._$) };
                    break;
                case 40:
                    this.$ = $$[$0];
                    break;
                case 41:
                    this.$ = $$[$0];
                    break;
                case 42:
                    this.$ = yy.preparePath(true, $$[$0], this._$);
                    break;
                case 43:
                    this.$ = yy.preparePath(false, $$[$0], this._$);
                    break;
                case 44:
                    $$[$0 - 2].push({ part: yy.id($$[$0]), original: $$[$0], separator: $$[$0 - 1] });this.$ = $$[$0 - 2];
                    break;
                case 45:
                    this.$ = [{ part: yy.id($$[$0]), original: $$[$0] }];
                    break;
                case 46:
                    this.$ = [];
                    break;
                case 47:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 48:
                    this.$ = [$$[$0]];
                    break;
                case 49:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 50:
                    this.$ = [];
                    break;
                case 51:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 58:
                    this.$ = [];
                    break;
                case 59:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 64:
                    this.$ = [];
                    break;
                case 65:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 70:
                    this.$ = [];
                    break;
                case 71:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 78:
                    this.$ = [];
                    break;
                case 79:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 82:
                    this.$ = [];
                    break;
                case 83:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 86:
                    this.$ = [];
                    break;
                case 87:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 90:
                    this.$ = [];
                    break;
                case 91:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 94:
                    this.$ = [];
                    break;
                case 95:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 98:
                    this.$ = [$$[$0]];
                    break;
                case 99:
                    $$[$0 - 1].push($$[$0]);
                    break;
                case 100:
                    this.$ = [$$[$0]];
                    break;
                case 101:
                    $$[$0 - 1].push($$[$0]);
                    break;
            }
        },
        table: [{ 3: 1, 4: 2, 5: [2, 46], 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 1: [3] }, { 5: [1, 4] }, { 5: [2, 2], 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 13: 11, 14: [1, 12], 15: [1, 20], 16: 17, 19: [1, 23], 24: 15, 27: 16, 29: [1, 21], 34: [1, 22], 39: [2, 2], 44: [2, 2], 47: [2, 2], 48: [1, 13], 51: [1, 14], 55: [1, 18], 59: 19, 60: [1, 24] }, { 1: [2, 1] }, { 5: [2, 47], 14: [2, 47], 15: [2, 47], 19: [2, 47], 29: [2, 47], 34: [2, 47], 39: [2, 47], 44: [2, 47], 47: [2, 47], 48: [2, 47], 51: [2, 47], 55: [2, 47], 60: [2, 47] }, { 5: [2, 3], 14: [2, 3], 15: [2, 3], 19: [2, 3], 29: [2, 3], 34: [2, 3], 39: [2, 3], 44: [2, 3], 47: [2, 3], 48: [2, 3], 51: [2, 3], 55: [2, 3], 60: [2, 3] }, { 5: [2, 4], 14: [2, 4], 15: [2, 4], 19: [2, 4], 29: [2, 4], 34: [2, 4], 39: [2, 4], 44: [2, 4], 47: [2, 4], 48: [2, 4], 51: [2, 4], 55: [2, 4], 60: [2, 4] }, { 5: [2, 5], 14: [2, 5], 15: [2, 5], 19: [2, 5], 29: [2, 5], 34: [2, 5], 39: [2, 5], 44: [2, 5], 47: [2, 5], 48: [2, 5], 51: [2, 5], 55: [2, 5], 60: [2, 5] }, { 5: [2, 6], 14: [2, 6], 15: [2, 6], 19: [2, 6], 29: [2, 6], 34: [2, 6], 39: [2, 6], 44: [2, 6], 47: [2, 6], 48: [2, 6], 51: [2, 6], 55: [2, 6], 60: [2, 6] }, { 5: [2, 7], 14: [2, 7], 15: [2, 7], 19: [2, 7], 29: [2, 7], 34: [2, 7], 39: [2, 7], 44: [2, 7], 47: [2, 7], 48: [2, 7], 51: [2, 7], 55: [2, 7], 60: [2, 7] }, { 5: [2, 8], 14: [2, 8], 15: [2, 8], 19: [2, 8], 29: [2, 8], 34: [2, 8], 39: [2, 8], 44: [2, 8], 47: [2, 8], 48: [2, 8], 51: [2, 8], 55: [2, 8], 60: [2, 8] }, { 5: [2, 9], 14: [2, 9], 15: [2, 9], 19: [2, 9], 29: [2, 9], 34: [2, 9], 39: [2, 9], 44: [2, 9], 47: [2, 9], 48: [2, 9], 51: [2, 9], 55: [2, 9], 60: [2, 9] }, { 20: 25, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 36, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 37, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 39: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 4: 38, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 13: 40, 15: [1, 20], 17: 39 }, { 20: 42, 56: 41, 64: 43, 65: [1, 44], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 45, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 5: [2, 10], 14: [2, 10], 15: [2, 10], 18: [2, 10], 19: [2, 10], 29: [2, 10], 34: [2, 10], 39: [2, 10], 44: [2, 10], 47: [2, 10], 48: [2, 10], 51: [2, 10], 55: [2, 10], 60: [2, 10] }, { 20: 46, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 47, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 48, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 42, 56: 49, 64: 43, 65: [1, 44], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [2, 78], 49: 50, 65: [2, 78], 72: [2, 78], 80: [2, 78], 81: [2, 78], 82: [2, 78], 83: [2, 78], 84: [2, 78], 85: [2, 78] }, { 23: [2, 33], 33: [2, 33], 54: [2, 33], 65: [2, 33], 68: [2, 33], 72: [2, 33], 75: [2, 33], 80: [2, 33], 81: [2, 33], 82: [2, 33], 83: [2, 33], 84: [2, 33], 85: [2, 33] }, { 23: [2, 34], 33: [2, 34], 54: [2, 34], 65: [2, 34], 68: [2, 34], 72: [2, 34], 75: [2, 34], 80: [2, 34], 81: [2, 34], 82: [2, 34], 83: [2, 34], 84: [2, 34], 85: [2, 34] }, { 23: [2, 35], 33: [2, 35], 54: [2, 35], 65: [2, 35], 68: [2, 35], 72: [2, 35], 75: [2, 35], 80: [2, 35], 81: [2, 35], 82: [2, 35], 83: [2, 35], 84: [2, 35], 85: [2, 35] }, { 23: [2, 36], 33: [2, 36], 54: [2, 36], 65: [2, 36], 68: [2, 36], 72: [2, 36], 75: [2, 36], 80: [2, 36], 81: [2, 36], 82: [2, 36], 83: [2, 36], 84: [2, 36], 85: [2, 36] }, { 23: [2, 37], 33: [2, 37], 54: [2, 37], 65: [2, 37], 68: [2, 37], 72: [2, 37], 75: [2, 37], 80: [2, 37], 81: [2, 37], 82: [2, 37], 83: [2, 37], 84: [2, 37], 85: [2, 37] }, { 23: [2, 38], 33: [2, 38], 54: [2, 38], 65: [2, 38], 68: [2, 38], 72: [2, 38], 75: [2, 38], 80: [2, 38], 81: [2, 38], 82: [2, 38], 83: [2, 38], 84: [2, 38], 85: [2, 38] }, { 23: [2, 39], 33: [2, 39], 54: [2, 39], 65: [2, 39], 68: [2, 39], 72: [2, 39], 75: [2, 39], 80: [2, 39], 81: [2, 39], 82: [2, 39], 83: [2, 39], 84: [2, 39], 85: [2, 39] }, { 23: [2, 43], 33: [2, 43], 54: [2, 43], 65: [2, 43], 68: [2, 43], 72: [2, 43], 75: [2, 43], 80: [2, 43], 81: [2, 43], 82: [2, 43], 83: [2, 43], 84: [2, 43], 85: [2, 43], 87: [1, 51] }, { 72: [1, 35], 86: 52 }, { 23: [2, 45], 33: [2, 45], 54: [2, 45], 65: [2, 45], 68: [2, 45], 72: [2, 45], 75: [2, 45], 80: [2, 45], 81: [2, 45], 82: [2, 45], 83: [2, 45], 84: [2, 45], 85: [2, 45], 87: [2, 45] }, { 52: 53, 54: [2, 82], 65: [2, 82], 72: [2, 82], 80: [2, 82], 81: [2, 82], 82: [2, 82], 83: [2, 82], 84: [2, 82], 85: [2, 82] }, { 25: 54, 38: 56, 39: [1, 58], 43: 57, 44: [1, 59], 45: 55, 47: [2, 54] }, { 28: 60, 43: 61, 44: [1, 59], 47: [2, 56] }, { 13: 63, 15: [1, 20], 18: [1, 62] }, { 15: [2, 48], 18: [2, 48] }, { 33: [2, 86], 57: 64, 65: [2, 86], 72: [2, 86], 80: [2, 86], 81: [2, 86], 82: [2, 86], 83: [2, 86], 84: [2, 86], 85: [2, 86] }, { 33: [2, 40], 65: [2, 40], 72: [2, 40], 80: [2, 40], 81: [2, 40], 82: [2, 40], 83: [2, 40], 84: [2, 40], 85: [2, 40] }, { 33: [2, 41], 65: [2, 41], 72: [2, 41], 80: [2, 41], 81: [2, 41], 82: [2, 41], 83: [2, 41], 84: [2, 41], 85: [2, 41] }, { 20: 65, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 26: 66, 47: [1, 67] }, { 30: 68, 33: [2, 58], 65: [2, 58], 72: [2, 58], 75: [2, 58], 80: [2, 58], 81: [2, 58], 82: [2, 58], 83: [2, 58], 84: [2, 58], 85: [2, 58] }, { 33: [2, 64], 35: 69, 65: [2, 64], 72: [2, 64], 75: [2, 64], 80: [2, 64], 81: [2, 64], 82: [2, 64], 83: [2, 64], 84: [2, 64], 85: [2, 64] }, { 21: 70, 23: [2, 50], 65: [2, 50], 72: [2, 50], 80: [2, 50], 81: [2, 50], 82: [2, 50], 83: [2, 50], 84: [2, 50], 85: [2, 50] }, { 33: [2, 90], 61: 71, 65: [2, 90], 72: [2, 90], 80: [2, 90], 81: [2, 90], 82: [2, 90], 83: [2, 90], 84: [2, 90], 85: [2, 90] }, { 20: 75, 33: [2, 80], 50: 72, 63: 73, 64: 76, 65: [1, 44], 69: 74, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 72: [1, 80] }, { 23: [2, 42], 33: [2, 42], 54: [2, 42], 65: [2, 42], 68: [2, 42], 72: [2, 42], 75: [2, 42], 80: [2, 42], 81: [2, 42], 82: [2, 42], 83: [2, 42], 84: [2, 42], 85: [2, 42], 87: [1, 51] }, { 20: 75, 53: 81, 54: [2, 84], 63: 82, 64: 76, 65: [1, 44], 69: 83, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 26: 84, 47: [1, 67] }, { 47: [2, 55] }, { 4: 85, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 39: [2, 46], 44: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 47: [2, 20] }, { 20: 86, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 4: 87, 6: 3, 14: [2, 46], 15: [2, 46], 19: [2, 46], 29: [2, 46], 34: [2, 46], 47: [2, 46], 48: [2, 46], 51: [2, 46], 55: [2, 46], 60: [2, 46] }, { 26: 88, 47: [1, 67] }, { 47: [2, 57] }, { 5: [2, 11], 14: [2, 11], 15: [2, 11], 19: [2, 11], 29: [2, 11], 34: [2, 11], 39: [2, 11], 44: [2, 11], 47: [2, 11], 48: [2, 11], 51: [2, 11], 55: [2, 11], 60: [2, 11] }, { 15: [2, 49], 18: [2, 49] }, { 20: 75, 33: [2, 88], 58: 89, 63: 90, 64: 76, 65: [1, 44], 69: 91, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 65: [2, 94], 66: 92, 68: [2, 94], 72: [2, 94], 80: [2, 94], 81: [2, 94], 82: [2, 94], 83: [2, 94], 84: [2, 94], 85: [2, 94] }, { 5: [2, 25], 14: [2, 25], 15: [2, 25], 19: [2, 25], 29: [2, 25], 34: [2, 25], 39: [2, 25], 44: [2, 25], 47: [2, 25], 48: [2, 25], 51: [2, 25], 55: [2, 25], 60: [2, 25] }, { 20: 93, 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 31: 94, 33: [2, 60], 63: 95, 64: 76, 65: [1, 44], 69: 96, 70: 77, 71: 78, 72: [1, 79], 75: [2, 60], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 33: [2, 66], 36: 97, 63: 98, 64: 76, 65: [1, 44], 69: 99, 70: 77, 71: 78, 72: [1, 79], 75: [2, 66], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 22: 100, 23: [2, 52], 63: 101, 64: 76, 65: [1, 44], 69: 102, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 20: 75, 33: [2, 92], 62: 103, 63: 104, 64: 76, 65: [1, 44], 69: 105, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [1, 106] }, { 33: [2, 79], 65: [2, 79], 72: [2, 79], 80: [2, 79], 81: [2, 79], 82: [2, 79], 83: [2, 79], 84: [2, 79], 85: [2, 79] }, { 33: [2, 81] }, { 23: [2, 27], 33: [2, 27], 54: [2, 27], 65: [2, 27], 68: [2, 27], 72: [2, 27], 75: [2, 27], 80: [2, 27], 81: [2, 27], 82: [2, 27], 83: [2, 27], 84: [2, 27], 85: [2, 27] }, { 23: [2, 28], 33: [2, 28], 54: [2, 28], 65: [2, 28], 68: [2, 28], 72: [2, 28], 75: [2, 28], 80: [2, 28], 81: [2, 28], 82: [2, 28], 83: [2, 28], 84: [2, 28], 85: [2, 28] }, { 23: [2, 30], 33: [2, 30], 54: [2, 30], 68: [2, 30], 71: 107, 72: [1, 108], 75: [2, 30] }, { 23: [2, 98], 33: [2, 98], 54: [2, 98], 68: [2, 98], 72: [2, 98], 75: [2, 98] }, { 23: [2, 45], 33: [2, 45], 54: [2, 45], 65: [2, 45], 68: [2, 45], 72: [2, 45], 73: [1, 109], 75: [2, 45], 80: [2, 45], 81: [2, 45], 82: [2, 45], 83: [2, 45], 84: [2, 45], 85: [2, 45], 87: [2, 45] }, { 23: [2, 44], 33: [2, 44], 54: [2, 44], 65: [2, 44], 68: [2, 44], 72: [2, 44], 75: [2, 44], 80: [2, 44], 81: [2, 44], 82: [2, 44], 83: [2, 44], 84: [2, 44], 85: [2, 44], 87: [2, 44] }, { 54: [1, 110] }, { 54: [2, 83], 65: [2, 83], 72: [2, 83], 80: [2, 83], 81: [2, 83], 82: [2, 83], 83: [2, 83], 84: [2, 83], 85: [2, 83] }, { 54: [2, 85] }, { 5: [2, 13], 14: [2, 13], 15: [2, 13], 19: [2, 13], 29: [2, 13], 34: [2, 13], 39: [2, 13], 44: [2, 13], 47: [2, 13], 48: [2, 13], 51: [2, 13], 55: [2, 13], 60: [2, 13] }, { 38: 56, 39: [1, 58], 43: 57, 44: [1, 59], 45: 112, 46: 111, 47: [2, 76] }, { 33: [2, 70], 40: 113, 65: [2, 70], 72: [2, 70], 75: [2, 70], 80: [2, 70], 81: [2, 70], 82: [2, 70], 83: [2, 70], 84: [2, 70], 85: [2, 70] }, { 47: [2, 18] }, { 5: [2, 14], 14: [2, 14], 15: [2, 14], 19: [2, 14], 29: [2, 14], 34: [2, 14], 39: [2, 14], 44: [2, 14], 47: [2, 14], 48: [2, 14], 51: [2, 14], 55: [2, 14], 60: [2, 14] }, { 33: [1, 114] }, { 33: [2, 87], 65: [2, 87], 72: [2, 87], 80: [2, 87], 81: [2, 87], 82: [2, 87], 83: [2, 87], 84: [2, 87], 85: [2, 87] }, { 33: [2, 89] }, { 20: 75, 63: 116, 64: 76, 65: [1, 44], 67: 115, 68: [2, 96], 69: 117, 70: 77, 71: 78, 72: [1, 79], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 33: [1, 118] }, { 32: 119, 33: [2, 62], 74: 120, 75: [1, 121] }, { 33: [2, 59], 65: [2, 59], 72: [2, 59], 75: [2, 59], 80: [2, 59], 81: [2, 59], 82: [2, 59], 83: [2, 59], 84: [2, 59], 85: [2, 59] }, { 33: [2, 61], 75: [2, 61] }, { 33: [2, 68], 37: 122, 74: 123, 75: [1, 121] }, { 33: [2, 65], 65: [2, 65], 72: [2, 65], 75: [2, 65], 80: [2, 65], 81: [2, 65], 82: [2, 65], 83: [2, 65], 84: [2, 65], 85: [2, 65] }, { 33: [2, 67], 75: [2, 67] }, { 23: [1, 124] }, { 23: [2, 51], 65: [2, 51], 72: [2, 51], 80: [2, 51], 81: [2, 51], 82: [2, 51], 83: [2, 51], 84: [2, 51], 85: [2, 51] }, { 23: [2, 53] }, { 33: [1, 125] }, { 33: [2, 91], 65: [2, 91], 72: [2, 91], 80: [2, 91], 81: [2, 91], 82: [2, 91], 83: [2, 91], 84: [2, 91], 85: [2, 91] }, { 33: [2, 93] }, { 5: [2, 22], 14: [2, 22], 15: [2, 22], 19: [2, 22], 29: [2, 22], 34: [2, 22], 39: [2, 22], 44: [2, 22], 47: [2, 22], 48: [2, 22], 51: [2, 22], 55: [2, 22], 60: [2, 22] }, { 23: [2, 99], 33: [2, 99], 54: [2, 99], 68: [2, 99], 72: [2, 99], 75: [2, 99] }, { 73: [1, 109] }, { 20: 75, 63: 126, 64: 76, 65: [1, 44], 72: [1, 35], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 5: [2, 23], 14: [2, 23], 15: [2, 23], 19: [2, 23], 29: [2, 23], 34: [2, 23], 39: [2, 23], 44: [2, 23], 47: [2, 23], 48: [2, 23], 51: [2, 23], 55: [2, 23], 60: [2, 23] }, { 47: [2, 19] }, { 47: [2, 77] }, { 20: 75, 33: [2, 72], 41: 127, 63: 128, 64: 76, 65: [1, 44], 69: 129, 70: 77, 71: 78, 72: [1, 79], 75: [2, 72], 78: 26, 79: 27, 80: [1, 28], 81: [1, 29], 82: [1, 30], 83: [1, 31], 84: [1, 32], 85: [1, 34], 86: 33 }, { 5: [2, 24], 14: [2, 24], 15: [2, 24], 19: [2, 24], 29: [2, 24], 34: [2, 24], 39: [2, 24], 44: [2, 24], 47: [2, 24], 48: [2, 24], 51: [2, 24], 55: [2, 24], 60: [2, 24] }, { 68: [1, 130] }, { 65: [2, 95], 68: [2, 95], 72: [2, 95], 80: [2, 95], 81: [2, 95], 82: [2, 95], 83: [2, 95], 84: [2, 95], 85: [2, 95] }, { 68: [2, 97] }, { 5: [2, 21], 14: [2, 21], 15: [2, 21], 19: [2, 21], 29: [2, 21], 34: [2, 21], 39: [2, 21], 44: [2, 21], 47: [2, 21], 48: [2, 21], 51: [2, 21], 55: [2, 21], 60: [2, 21] }, { 33: [1, 131] }, { 33: [2, 63] }, { 72: [1, 133], 76: 132 }, { 33: [1, 134] }, { 33: [2, 69] }, { 15: [2, 12] }, { 14: [2, 26], 15: [2, 26], 19: [2, 26], 29: [2, 26], 34: [2, 26], 47: [2, 26], 48: [2, 26], 51: [2, 26], 55: [2, 26], 60: [2, 26] }, { 23: [2, 31], 33: [2, 31], 54: [2, 31], 68: [2, 31], 72: [2, 31], 75: [2, 31] }, { 33: [2, 74], 42: 135, 74: 136, 75: [1, 121] }, { 33: [2, 71], 65: [2, 71], 72: [2, 71], 75: [2, 71], 80: [2, 71], 81: [2, 71], 82: [2, 71], 83: [2, 71], 84: [2, 71], 85: [2, 71] }, { 33: [2, 73], 75: [2, 73] }, { 23: [2, 29], 33: [2, 29], 54: [2, 29], 65: [2, 29], 68: [2, 29], 72: [2, 29], 75: [2, 29], 80: [2, 29], 81: [2, 29], 82: [2, 29], 83: [2, 29], 84: [2, 29], 85: [2, 29] }, { 14: [2, 15], 15: [2, 15], 19: [2, 15], 29: [2, 15], 34: [2, 15], 39: [2, 15], 44: [2, 15], 47: [2, 15], 48: [2, 15], 51: [2, 15], 55: [2, 15], 60: [2, 15] }, { 72: [1, 138], 77: [1, 137] }, { 72: [2, 100], 77: [2, 100] }, { 14: [2, 16], 15: [2, 16], 19: [2, 16], 29: [2, 16], 34: [2, 16], 44: [2, 16], 47: [2, 16], 48: [2, 16], 51: [2, 16], 55: [2, 16], 60: [2, 16] }, { 33: [1, 139] }, { 33: [2, 75] }, { 33: [2, 32] }, { 72: [2, 101], 77: [2, 101] }, { 14: [2, 17], 15: [2, 17], 19: [2, 17], 29: [2, 17], 34: [2, 17], 39: [2, 17], 44: [2, 17], 47: [2, 17], 48: [2, 17], 51: [2, 17], 55: [2, 17], 60: [2, 17] }],
        defaultActions: { 4: [2, 1], 55: [2, 55], 57: [2, 20], 61: [2, 57], 74: [2, 81], 83: [2, 85], 87: [2, 18], 91: [2, 89], 102: [2, 53], 105: [2, 93], 111: [2, 19], 112: [2, 77], 117: [2, 97], 120: [2, 63], 123: [2, 69], 124: [2, 12], 136: [2, 75], 137: [2, 32] },
        parseError: function parseError(str, hash) {
            throw new Error(str);
        },
        parse: function parse(input) {
            var self = this,
                stack = [0],
                vstack = [null],
                lstack = [],
                table = this.table,
                yytext = "",
                yylineno = 0,
                yyleng = 0,
                recovering = 0,
                TERROR = 2,
                EOF = 1;
            this.lexer.setInput(input);
            this.lexer.yy = this.yy;
            this.yy.lexer = this.lexer;
            this.yy.parser = this;
            if (typeof this.lexer.yylloc == "undefined") this.lexer.yylloc = {};
            var yyloc = this.lexer.yylloc;
            lstack.push(yyloc);
            var ranges = this.lexer.options && this.lexer.options.ranges;
            if (typeof this.yy.parseError === "function") this.parseError = this.yy.parseError;
            function popStack(n) {
                stack.length = stack.length - 2 * n;
                vstack.length = vstack.length - n;
                lstack.length = lstack.length - n;
            }
            function lex() {
                var token;
                token = self.lexer.lex() || 1;
                if (typeof token !== "number") {
                    token = self.symbols_[token] || token;
                }
                return token;
            }
            var symbol,
                preErrorSymbol,
                state,
                action,
                a,
                r,
                yyval = {},
                p,
                len,
                newState,
                expected;
            while (true) {
                state = stack[stack.length - 1];
                if (this.defaultActions[state]) {
                    action = this.defaultActions[state];
                } else {
                    if (symbol === null || typeof symbol == "undefined") {
                        symbol = lex();
                    }
                    action = table[state] && table[state][symbol];
                }
                if (typeof action === "undefined" || !action.length || !action[0]) {
                    var errStr = "";
                    if (!recovering) {
                        expected = [];
                        for (p in table[state]) if (this.terminals_[p] && p > 2) {
                            expected.push("'" + this.terminals_[p] + "'");
                        }
                        if (this.lexer.showPosition) {
                            errStr = "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", ") + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                        } else {
                            errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1 ? "end of input" : "'" + (this.terminals_[symbol] || symbol) + "'");
                        }
                        this.parseError(errStr, { text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected });
                    }
                }
                if (action[0] instanceof Array && action.length > 1) {
                    throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
                }
                switch (action[0]) {
                    case 1:
                        stack.push(symbol);
                        vstack.push(this.lexer.yytext);
                        lstack.push(this.lexer.yylloc);
                        stack.push(action[1]);
                        symbol = null;
                        if (!preErrorSymbol) {
                            yyleng = this.lexer.yyleng;
                            yytext = this.lexer.yytext;
                            yylineno = this.lexer.yylineno;
                            yyloc = this.lexer.yylloc;
                            if (recovering > 0) recovering--;
                        } else {
                            symbol = preErrorSymbol;
                            preErrorSymbol = null;
                        }
                        break;
                    case 2:
                        len = this.productions_[action[1]][1];
                        yyval.$ = vstack[vstack.length - len];
                        yyval._$ = { first_line: lstack[lstack.length - (len || 1)].first_line, last_line: lstack[lstack.length - 1].last_line, first_column: lstack[lstack.length - (len || 1)].first_column, last_column: lstack[lstack.length - 1].last_column };
                        if (ranges) {
                            yyval._$.range = [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]];
                        }
                        r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
                        if (typeof r !== "undefined") {
                            return r;
                        }
                        if (len) {
                            stack = stack.slice(0, -1 * len * 2);
                            vstack = vstack.slice(0, -1 * len);
                            lstack = lstack.slice(0, -1 * len);
                        }
                        stack.push(this.productions_[action[1]][0]);
                        vstack.push(yyval.$);
                        lstack.push(yyval._$);
                        newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
                        stack.push(newState);
                        break;
                    case 3:
                        return true;
                }
            }
            return true;
        }
    };
    /* Jison generated lexer */
    var lexer = (function () {
        var lexer = { EOF: 1,
            parseError: function parseError(str, hash) {
                if (this.yy.parser) {
                    this.yy.parser.parseError(str, hash);
                } else {
                    throw new Error(str);
                }
            },
            setInput: function setInput(input) {
                this._input = input;
                this._more = this._less = this.done = false;
                this.yylineno = this.yyleng = 0;
                this.yytext = this.matched = this.match = '';
                this.conditionStack = ['INITIAL'];
                this.yylloc = { first_line: 1, first_column: 0, last_line: 1, last_column: 0 };
                if (this.options.ranges) this.yylloc.range = [0, 0];
                this.offset = 0;
                return this;
            },
            input: function input() {
                var ch = this._input[0];
                this.yytext += ch;
                this.yyleng++;
                this.offset++;
                this.match += ch;
                this.matched += ch;
                var lines = ch.match(/(?:\r\n?|\n).*/g);
                if (lines) {
                    this.yylineno++;
                    this.yylloc.last_line++;
                } else {
                    this.yylloc.last_column++;
                }
                if (this.options.ranges) this.yylloc.range[1]++;

                this._input = this._input.slice(1);
                return ch;
            },
            unput: function unput(ch) {
                var len = ch.length;
                var lines = ch.split(/(?:\r\n?|\n)/g);

                this._input = ch + this._input;
                this.yytext = this.yytext.substr(0, this.yytext.length - len - 1);
                //this.yyleng -= len;
                this.offset -= len;
                var oldLines = this.match.split(/(?:\r\n?|\n)/g);
                this.match = this.match.substr(0, this.match.length - 1);
                this.matched = this.matched.substr(0, this.matched.length - 1);

                if (lines.length - 1) this.yylineno -= lines.length - 1;
                var r = this.yylloc.range;

                this.yylloc = { first_line: this.yylloc.first_line,
                    last_line: this.yylineno + 1,
                    first_column: this.yylloc.first_column,
                    last_column: lines ? (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length : this.yylloc.first_column - len
                };

                if (this.options.ranges) {
                    this.yylloc.range = [r[0], r[0] + this.yyleng - len];
                }
                return this;
            },
            more: function more() {
                this._more = true;
                return this;
            },
            less: function less(n) {
                this.unput(this.match.slice(n));
            },
            pastInput: function pastInput() {
                var past = this.matched.substr(0, this.matched.length - this.match.length);
                return (past.length > 20 ? '...' : '') + past.substr(-20).replace(/\n/g, "");
            },
            upcomingInput: function upcomingInput() {
                var next = this.match;
                if (next.length < 20) {
                    next += this._input.substr(0, 20 - next.length);
                }
                return (next.substr(0, 20) + (next.length > 20 ? '...' : '')).replace(/\n/g, "");
            },
            showPosition: function showPosition() {
                var pre = this.pastInput();
                var c = new Array(pre.length + 1).join("-");
                return pre + this.upcomingInput() + "\n" + c + "^";
            },
            next: function next() {
                if (this.done) {
                    return this.EOF;
                }
                if (!this._input) this.done = true;

                var token, match, tempMatch, index, col, lines;
                if (!this._more) {
                    this.yytext = '';
                    this.match = '';
                }
                var rules = this._currentRules();
                for (var i = 0; i < rules.length; i++) {
                    tempMatch = this._input.match(this.rules[rules[i]]);
                    if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                        match = tempMatch;
                        index = i;
                        if (!this.options.flex) break;
                    }
                }
                if (match) {
                    lines = match[0].match(/(?:\r\n?|\n).*/g);
                    if (lines) this.yylineno += lines.length;
                    this.yylloc = { first_line: this.yylloc.last_line,
                        last_line: this.yylineno + 1,
                        first_column: this.yylloc.last_column,
                        last_column: lines ? lines[lines.length - 1].length - lines[lines.length - 1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length };
                    this.yytext += match[0];
                    this.match += match[0];
                    this.matches = match;
                    this.yyleng = this.yytext.length;
                    if (this.options.ranges) {
                        this.yylloc.range = [this.offset, this.offset += this.yyleng];
                    }
                    this._more = false;
                    this._input = this._input.slice(match[0].length);
                    this.matched += match[0];
                    token = this.performAction.call(this, this.yy, this, rules[index], this.conditionStack[this.conditionStack.length - 1]);
                    if (this.done && this._input) this.done = false;
                    if (token) return token;else return;
                }
                if (this._input === "") {
                    return this.EOF;
                } else {
                    return this.parseError('Lexical error on line ' + (this.yylineno + 1) + '. Unrecognized text.\n' + this.showPosition(), { text: "", token: null, line: this.yylineno });
                }
            },
            lex: function lex() {
                var r = this.next();
                if (typeof r !== 'undefined') {
                    return r;
                } else {
                    return this.lex();
                }
            },
            begin: function begin(condition) {
                this.conditionStack.push(condition);
            },
            popState: function popState() {
                return this.conditionStack.pop();
            },
            _currentRules: function _currentRules() {
                return this.conditions[this.conditionStack[this.conditionStack.length - 1]].rules;
            },
            topState: function topState() {
                return this.conditionStack[this.conditionStack.length - 2];
            },
            pushState: function begin(condition) {
                this.begin(condition);
            } };
        lexer.options = {};
        lexer.performAction = function anonymous(yy, yy_, $avoiding_name_collisions, YY_START
        /**/) {

            function strip(start, end) {
                return yy_.yytext = yy_.yytext.substr(start, yy_.yyleng - end);
            }

            var YYSTATE = YY_START;
            switch ($avoiding_name_collisions) {
                case 0:
                    if (yy_.yytext.slice(-2) === "\\\\") {
                        strip(0, 1);
                        this.begin("mu");
                    } else if (yy_.yytext.slice(-1) === "\\") {
                        strip(0, 1);
                        this.begin("emu");
                    } else {
                        this.begin("mu");
                    }
                    if (yy_.yytext) return 15;

                    break;
                case 1:
                    return 15;
                    break;
                case 2:
                    this.popState();
                    return 15;

                    break;
                case 3:
                    this.begin('raw');return 15;
                    break;
                case 4:
                    this.popState();
                    // Should be using `this.topState()` below, but it currently
                    // returns the second top instead of the first top. Opened an
                    // issue about it at https://github.com/zaach/jison/issues/291
                    if (this.conditionStack[this.conditionStack.length - 1] === 'raw') {
                        return 15;
                    } else {
                        yy_.yytext = yy_.yytext.substr(5, yy_.yyleng - 9);
                        return 'END_RAW_BLOCK';
                    }

                    break;
                case 5:
                    return 15;
                    break;
                case 6:
                    this.popState();
                    return 14;

                    break;
                case 7:
                    return 65;
                    break;
                case 8:
                    return 68;
                    break;
                case 9:
                    return 19;
                    break;
                case 10:
                    this.popState();
                    this.begin('raw');
                    return 23;

                    break;
                case 11:
                    return 55;
                    break;
                case 12:
                    return 60;
                    break;
                case 13:
                    return 29;
                    break;
                case 14:
                    return 47;
                    break;
                case 15:
                    this.popState();return 44;
                    break;
                case 16:
                    this.popState();return 44;
                    break;
                case 17:
                    return 34;
                    break;
                case 18:
                    return 39;
                    break;
                case 19:
                    return 51;
                    break;
                case 20:
                    return 48;
                    break;
                case 21:
                    this.unput(yy_.yytext);
                    this.popState();
                    this.begin('com');

                    break;
                case 22:
                    this.popState();
                    return 14;

                    break;
                case 23:
                    return 48;
                    break;
                case 24:
                    return 73;
                    break;
                case 25:
                    return 72;
                    break;
                case 26:
                    return 72;
                    break;
                case 27:
                    return 87;
                    break;
                case 28:
                    // ignore whitespace
                    break;
                case 29:
                    this.popState();return 54;
                    break;
                case 30:
                    this.popState();return 33;
                    break;
                case 31:
                    yy_.yytext = strip(1, 2).replace(/\\"/g, '"');return 80;
                    break;
                case 32:
                    yy_.yytext = strip(1, 2).replace(/\\'/g, "'");return 80;
                    break;
                case 33:
                    return 85;
                    break;
                case 34:
                    return 82;
                    break;
                case 35:
                    return 82;
                    break;
                case 36:
                    return 83;
                    break;
                case 37:
                    return 84;
                    break;
                case 38:
                    return 81;
                    break;
                case 39:
                    return 75;
                    break;
                case 40:
                    return 77;
                    break;
                case 41:
                    return 72;
                    break;
                case 42:
                    yy_.yytext = yy_.yytext.replace(/\\([\\\]])/g, '$1');return 72;
                    break;
                case 43:
                    return 'INVALID';
                    break;
                case 44:
                    return 5;
                    break;
            }
        };
        lexer.rules = [/^(?:[^\x00]*?(?=(\{\{)))/, /^(?:[^\x00]+)/, /^(?:[^\x00]{2,}?(?=(\{\{|\\\{\{|\\\\\{\{|$)))/, /^(?:\{\{\{\{(?=[^\/]))/, /^(?:\{\{\{\{\/[^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=[=}\s\/.])\}\}\}\})/, /^(?:[^\x00]*?(?=(\{\{\{\{)))/, /^(?:[\s\S]*?--(~)?\}\})/, /^(?:\()/, /^(?:\))/, /^(?:\{\{\{\{)/, /^(?:\}\}\}\})/, /^(?:\{\{(~)?>)/, /^(?:\{\{(~)?#>)/, /^(?:\{\{(~)?#\*?)/, /^(?:\{\{(~)?\/)/, /^(?:\{\{(~)?\^\s*(~)?\}\})/, /^(?:\{\{(~)?\s*else\s*(~)?\}\})/, /^(?:\{\{(~)?\^)/, /^(?:\{\{(~)?\s*else\b)/, /^(?:\{\{(~)?\{)/, /^(?:\{\{(~)?&)/, /^(?:\{\{(~)?!--)/, /^(?:\{\{(~)?![\s\S]*?\}\})/, /^(?:\{\{(~)?\*?)/, /^(?:=)/, /^(?:\.\.)/, /^(?:\.(?=([=~}\s\/.)|])))/, /^(?:[\/.])/, /^(?:\s+)/, /^(?:\}(~)?\}\})/, /^(?:(~)?\}\})/, /^(?:"(\\["]|[^"])*")/, /^(?:'(\\[']|[^'])*')/, /^(?:@)/, /^(?:true(?=([~}\s)])))/, /^(?:false(?=([~}\s)])))/, /^(?:undefined(?=([~}\s)])))/, /^(?:null(?=([~}\s)])))/, /^(?:-?[0-9]+(?:\.[0-9]+)?(?=([~}\s)])))/, /^(?:as\s+\|)/, /^(?:\|)/, /^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=([=~}\s\/.)|]))))/, /^(?:\[(\\\]|[^\]])*\])/, /^(?:.)/, /^(?:$)/];
        lexer.conditions = { "mu": { "rules": [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44], "inclusive": false }, "emu": { "rules": [2], "inclusive": false }, "com": { "rules": [6], "inclusive": false }, "raw": { "rules": [3, 4, 5], "inclusive": false }, "INITIAL": { "rules": [0, 1, 44], "inclusive": true } };
        return lexer;
    })();
    parser.lexer = lexer;
    function Parser() {
        this.yy = {};
    }Parser.prototype = parser;parser.Parser = Parser;
    return new Parser();
})();exports.__esModule = true;
exports['default'] = handlebars;


},{}],20:[function(require,module,exports){
/* eslint-disable new-cap */
'use strict';

exports.__esModule = true;
exports.print = print;
exports.PrintVisitor = PrintVisitor;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _visitor = require('./visitor');

var _visitor2 = _interopRequireDefault(_visitor);

function print(ast) {
  return new PrintVisitor().accept(ast);
}

function PrintVisitor() {
  this.padding = 0;
}

PrintVisitor.prototype = new _visitor2['default']();

PrintVisitor.prototype.pad = function (string) {
  var out = '';

  for (var i = 0, l = this.padding; i < l; i++) {
    out += '  ';
  }

  out += string + '\n';
  return out;
};

PrintVisitor.prototype.Program = function (program) {
  var out = '',
      body = program.body,
      i = undefined,
      l = undefined;

  if (program.blockParams) {
    var blockParams = 'BLOCK PARAMS: [';
    for (i = 0, l = program.blockParams.length; i < l; i++) {
      blockParams += ' ' + program.blockParams[i];
    }
    blockParams += ' ]';
    out += this.pad(blockParams);
  }

  for (i = 0, l = body.length; i < l; i++) {
    out += this.accept(body[i]);
  }

  this.padding--;

  return out;
};

PrintVisitor.prototype.MustacheStatement = function (mustache) {
  return this.pad('{{ ' + this.SubExpression(mustache) + ' }}');
};
PrintVisitor.prototype.Decorator = function (mustache) {
  return this.pad('{{ DIRECTIVE ' + this.SubExpression(mustache) + ' }}');
};

PrintVisitor.prototype.BlockStatement = PrintVisitor.prototype.DecoratorBlock = function (block) {
  var out = '';

  out += this.pad((block.type === 'DecoratorBlock' ? 'DIRECTIVE ' : '') + 'BLOCK:');
  this.padding++;
  out += this.pad(this.SubExpression(block));
  if (block.program) {
    out += this.pad('PROGRAM:');
    this.padding++;
    out += this.accept(block.program);
    this.padding--;
  }
  if (block.inverse) {
    if (block.program) {
      this.padding++;
    }
    out += this.pad('{{^}}');
    this.padding++;
    out += this.accept(block.inverse);
    this.padding--;
    if (block.program) {
      this.padding--;
    }
  }
  this.padding--;

  return out;
};

PrintVisitor.prototype.PartialStatement = function (partial) {
  var content = 'PARTIAL:' + partial.name.original;
  if (partial.params[0]) {
    content += ' ' + this.accept(partial.params[0]);
  }
  if (partial.hash) {
    content += ' ' + this.accept(partial.hash);
  }
  return this.pad('{{> ' + content + ' }}');
};
PrintVisitor.prototype.PartialBlockStatement = function (partial) {
  var content = 'PARTIAL BLOCK:' + partial.name.original;
  if (partial.params[0]) {
    content += ' ' + this.accept(partial.params[0]);
  }
  if (partial.hash) {
    content += ' ' + this.accept(partial.hash);
  }

  content += ' ' + this.pad('PROGRAM:');
  this.padding++;
  content += this.accept(partial.program);
  this.padding--;

  return this.pad('{{> ' + content + ' }}');
};

PrintVisitor.prototype.ContentStatement = function (content) {
  return this.pad("CONTENT[ '" + content.value + "' ]");
};

PrintVisitor.prototype.CommentStatement = function (comment) {
  return this.pad("{{! '" + comment.value + "' }}");
};

PrintVisitor.prototype.SubExpression = function (sexpr) {
  var params = sexpr.params,
      paramStrings = [],
      hash = undefined;

  for (var i = 0, l = params.length; i < l; i++) {
    paramStrings.push(this.accept(params[i]));
  }

  params = '[' + paramStrings.join(', ') + ']';

  hash = sexpr.hash ? ' ' + this.accept(sexpr.hash) : '';

  return this.accept(sexpr.path) + ' ' + params + hash;
};

PrintVisitor.prototype.PathExpression = function (id) {
  var path = id.parts.join('/');
  return (id.data ? '@' : '') + 'PATH:' + path;
};

PrintVisitor.prototype.StringLiteral = function (string) {
  return '"' + string.value + '"';
};

PrintVisitor.prototype.NumberLiteral = function (number) {
  return 'NUMBER{' + number.value + '}';
};

PrintVisitor.prototype.BooleanLiteral = function (bool) {
  return 'BOOLEAN{' + bool.value + '}';
};

PrintVisitor.prototype.UndefinedLiteral = function () {
  return 'UNDEFINED';
};

PrintVisitor.prototype.NullLiteral = function () {
  return 'NULL';
};

PrintVisitor.prototype.Hash = function (hash) {
  var pairs = hash.pairs,
      joinedPairs = [];

  for (var i = 0, l = pairs.length; i < l; i++) {
    joinedPairs.push(this.accept(pairs[i]));
  }

  return 'HASH{' + joinedPairs.join(', ') + '}';
};
PrintVisitor.prototype.HashPair = function (pair) {
  return pair.key + '=' + this.accept(pair.value);
};
/* eslint-enable new-cap */


},{"./visitor":21}],21:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _exception = require('../exception');

var _exception2 = _interopRequireDefault(_exception);

function Visitor() {
  this.parents = [];
}

Visitor.prototype = {
  constructor: Visitor,
  mutating: false,

  // Visits a given value. If mutating, will replace the value if necessary.
  acceptKey: function acceptKey(node, name) {
    var value = this.accept(node[name]);
    if (this.mutating) {
      // Hacky sanity check: This may have a few false positives for type for the helper
      // methods but will generally do the right thing without a lot of overhead.
      if (value && !Visitor.prototype[value.type]) {
        throw new _exception2['default']('Unexpected node type "' + value.type + '" found when accepting ' + name + ' on ' + node.type);
      }
      node[name] = value;
    }
  },

  // Performs an accept operation with added sanity check to ensure
  // required keys are not removed.
  acceptRequired: function acceptRequired(node, name) {
    this.acceptKey(node, name);

    if (!node[name]) {
      throw new _exception2['default'](node.type + ' requires ' + name);
    }
  },

  // Traverses a given array. If mutating, empty respnses will be removed
  // for child elements.
  acceptArray: function acceptArray(array) {
    for (var i = 0, l = array.length; i < l; i++) {
      this.acceptKey(array, i);

      if (!array[i]) {
        array.splice(i, 1);
        i--;
        l--;
      }
    }
  },

  accept: function accept(object) {
    if (!object) {
      return;
    }

    /* istanbul ignore next: Sanity code */
    if (!this[object.type]) {
      throw new _exception2['default']('Unknown type: ' + object.type, object);
    }

    if (this.current) {
      this.parents.unshift(this.current);
    }
    this.current = object;

    var ret = this[object.type](object);

    this.current = this.parents.shift();

    if (!this.mutating || ret) {
      return ret;
    } else if (ret !== false) {
      return object;
    }
  },

  Program: function Program(program) {
    this.acceptArray(program.body);
  },

  MustacheStatement: visitSubExpression,
  Decorator: visitSubExpression,

  BlockStatement: visitBlock,
  DecoratorBlock: visitBlock,

  PartialStatement: visitPartial,
  PartialBlockStatement: function PartialBlockStatement(partial) {
    visitPartial.call(this, partial);

    this.acceptKey(partial, 'program');
  },

  ContentStatement: function ContentStatement() /* content */{},
  CommentStatement: function CommentStatement() /* comment */{},

  SubExpression: visitSubExpression,

  PathExpression: function PathExpression() /* path */{},

  StringLiteral: function StringLiteral() /* string */{},
  NumberLiteral: function NumberLiteral() /* number */{},
  BooleanLiteral: function BooleanLiteral() /* bool */{},
  UndefinedLiteral: function UndefinedLiteral() /* literal */{},
  NullLiteral: function NullLiteral() /* literal */{},

  Hash: function Hash(hash) {
    this.acceptArray(hash.pairs);
  },
  HashPair: function HashPair(pair) {
    this.acceptRequired(pair, 'value');
  }
};

function visitSubExpression(mustache) {
  this.acceptRequired(mustache, 'path');
  this.acceptArray(mustache.params);
  this.acceptKey(mustache, 'hash');
}
function visitBlock(block) {
  visitSubExpression.call(this, block);

  this.acceptKey(block, 'program');
  this.acceptKey(block, 'inverse');
}
function visitPartial(partial) {
  this.acceptRequired(partial, 'name');
  this.acceptArray(partial.params);
  this.acceptKey(partial, 'hash');
}

exports['default'] = Visitor;
module.exports = exports['default'];


},{"../exception":25}],22:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _visitor = require('./visitor');

var _visitor2 = _interopRequireDefault(_visitor);

function WhitespaceControl() {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

  this.options = options;
}
WhitespaceControl.prototype = new _visitor2['default']();

WhitespaceControl.prototype.Program = function (program) {
  var doStandalone = !this.options.ignoreStandalone;

  var isRoot = !this.isRootSeen;
  this.isRootSeen = true;

  var body = program.body;
  for (var i = 0, l = body.length; i < l; i++) {
    var current = body[i],
        strip = this.accept(current);

    if (!strip) {
      continue;
    }

    var _isPrevWhitespace = isPrevWhitespace(body, i, isRoot),
        _isNextWhitespace = isNextWhitespace(body, i, isRoot),
        openStandalone = strip.openStandalone && _isPrevWhitespace,
        closeStandalone = strip.closeStandalone && _isNextWhitespace,
        inlineStandalone = strip.inlineStandalone && _isPrevWhitespace && _isNextWhitespace;

    if (strip.close) {
      omitRight(body, i, true);
    }
    if (strip.open) {
      omitLeft(body, i, true);
    }

    if (doStandalone && inlineStandalone) {
      omitRight(body, i);

      if (omitLeft(body, i)) {
        // If we are on a standalone node, save the indent info for partials
        if (current.type === 'PartialStatement') {
          // Pull out the whitespace from the final line
          current.indent = /([ \t]+$)/.exec(body[i - 1].original)[1];
        }
      }
    }
    if (doStandalone && openStandalone) {
      omitRight((current.program || current.inverse).body);

      // Strip out the previous content node if it's whitespace only
      omitLeft(body, i);
    }
    if (doStandalone && closeStandalone) {
      // Always strip the next node
      omitRight(body, i);

      omitLeft((current.inverse || current.program).body);
    }
  }

  return program;
};

WhitespaceControl.prototype.BlockStatement = WhitespaceControl.prototype.DecoratorBlock = WhitespaceControl.prototype.PartialBlockStatement = function (block) {
  this.accept(block.program);
  this.accept(block.inverse);

  // Find the inverse program that is involed with whitespace stripping.
  var program = block.program || block.inverse,
      inverse = block.program && block.inverse,
      firstInverse = inverse,
      lastInverse = inverse;

  if (inverse && inverse.chained) {
    firstInverse = inverse.body[0].program;

    // Walk the inverse chain to find the last inverse that is actually in the chain.
    while (lastInverse.chained) {
      lastInverse = lastInverse.body[lastInverse.body.length - 1].program;
    }
  }

  var strip = {
    open: block.openStrip.open,
    close: block.closeStrip.close,

    // Determine the standalone candiacy. Basically flag our content as being possibly standalone
    // so our parent can determine if we actually are standalone
    openStandalone: isNextWhitespace(program.body),
    closeStandalone: isPrevWhitespace((firstInverse || program).body)
  };

  if (block.openStrip.close) {
    omitRight(program.body, null, true);
  }

  if (inverse) {
    var inverseStrip = block.inverseStrip;

    if (inverseStrip.open) {
      omitLeft(program.body, null, true);
    }

    if (inverseStrip.close) {
      omitRight(firstInverse.body, null, true);
    }
    if (block.closeStrip.open) {
      omitLeft(lastInverse.body, null, true);
    }

    // Find standalone else statments
    if (!this.options.ignoreStandalone && isPrevWhitespace(program.body) && isNextWhitespace(firstInverse.body)) {
      omitLeft(program.body);
      omitRight(firstInverse.body);
    }
  } else if (block.closeStrip.open) {
    omitLeft(program.body, null, true);
  }

  return strip;
};

WhitespaceControl.prototype.Decorator = WhitespaceControl.prototype.MustacheStatement = function (mustache) {
  return mustache.strip;
};

WhitespaceControl.prototype.PartialStatement = WhitespaceControl.prototype.CommentStatement = function (node) {
  /* istanbul ignore next */
  var strip = node.strip || {};
  return {
    inlineStandalone: true,
    open: strip.open,
    close: strip.close
  };
};

function isPrevWhitespace(body, i, isRoot) {
  if (i === undefined) {
    i = body.length;
  }

  // Nodes that end with newlines are considered whitespace (but are special
  // cased for strip operations)
  var prev = body[i - 1],
      sibling = body[i - 2];
  if (!prev) {
    return isRoot;
  }

  if (prev.type === 'ContentStatement') {
    return (sibling || !isRoot ? /\r?\n\s*?$/ : /(^|\r?\n)\s*?$/).test(prev.original);
  }
}
function isNextWhitespace(body, i, isRoot) {
  if (i === undefined) {
    i = -1;
  }

  var next = body[i + 1],
      sibling = body[i + 2];
  if (!next) {
    return isRoot;
  }

  if (next.type === 'ContentStatement') {
    return (sibling || !isRoot ? /^\s*?\r?\n/ : /^\s*?(\r?\n|$)/).test(next.original);
  }
}

// Marks the node to the right of the position as omitted.
// I.e. {{foo}}' ' will mark the ' ' node as omitted.
//
// If i is undefined, then the first child will be marked as such.
//
// If mulitple is truthy then all whitespace will be stripped out until non-whitespace
// content is met.
function omitRight(body, i, multiple) {
  var current = body[i == null ? 0 : i + 1];
  if (!current || current.type !== 'ContentStatement' || !multiple && current.rightStripped) {
    return;
  }

  var original = current.value;
  current.value = current.value.replace(multiple ? /^\s+/ : /^[ \t]*\r?\n?/, '');
  current.rightStripped = current.value !== original;
}

// Marks the node to the left of the position as omitted.
// I.e. ' '{{foo}} will mark the ' ' node as omitted.
//
// If i is undefined then the last child will be marked as such.
//
// If mulitple is truthy then all whitespace will be stripped out until non-whitespace
// content is met.
function omitLeft(body, i, multiple) {
  var current = body[i == null ? body.length - 1 : i - 1];
  if (!current || current.type !== 'ContentStatement' || !multiple && current.leftStripped) {
    return;
  }

  // We omit the last node if it's whitespace only and not preceeded by a non-content node.
  var original = current.value;
  current.value = current.value.replace(multiple ? /\s+$/ : /[ \t]+$/, '');
  current.leftStripped = current.value !== original;
  return current.leftStripped;
}

exports['default'] = WhitespaceControl;
module.exports = exports['default'];


},{"./visitor":21}],23:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.registerDefaultDecorators = registerDefaultDecorators;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _decoratorsInline = require('./decorators/inline');

var _decoratorsInline2 = _interopRequireDefault(_decoratorsInline);

function registerDefaultDecorators(instance) {
  _decoratorsInline2['default'](instance);
}


},{"./decorators/inline":24}],24:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _utils = require('../utils');

exports['default'] = function (instance) {
  instance.registerDecorator('inline', function (fn, props, container, options) {
    var ret = fn;
    if (!props.partials) {
      props.partials = {};
      ret = function (context, options) {
        // Create a new partials stack frame prior to exec.
        var original = container.partials;
        container.partials = _utils.extend({}, original, props.partials);
        var ret = fn(context, options);
        container.partials = original;
        return ret;
      };
    }

    props.partials[options.args[0]] = options.fn;

    return ret;
  });
};

module.exports = exports['default'];


},{"../utils":38}],25:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

function Exception(message, node) {
  var loc = node && node.loc,
      line = undefined,
      column = undefined;
  if (loc) {
    line = loc.start.line;
    column = loc.start.column;

    message += ' - ' + line + ':' + column;
  }

  var tmp = Error.prototype.constructor.call(this, message);

  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }

  /* istanbul ignore else */
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, Exception);
  }

  if (loc) {
    this.lineNumber = line;
    this.column = column;
  }
}

Exception.prototype = new Error();

exports['default'] = Exception;
module.exports = exports['default'];


},{}],26:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.registerDefaultHelpers = registerDefaultHelpers;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _helpersBlockHelperMissing = require('./helpers/block-helper-missing');

var _helpersBlockHelperMissing2 = _interopRequireDefault(_helpersBlockHelperMissing);

var _helpersEach = require('./helpers/each');

var _helpersEach2 = _interopRequireDefault(_helpersEach);

var _helpersHelperMissing = require('./helpers/helper-missing');

var _helpersHelperMissing2 = _interopRequireDefault(_helpersHelperMissing);

var _helpersIf = require('./helpers/if');

var _helpersIf2 = _interopRequireDefault(_helpersIf);

var _helpersLog = require('./helpers/log');

var _helpersLog2 = _interopRequireDefault(_helpersLog);

var _helpersLookup = require('./helpers/lookup');

var _helpersLookup2 = _interopRequireDefault(_helpersLookup);

var _helpersWith = require('./helpers/with');

var _helpersWith2 = _interopRequireDefault(_helpersWith);

function registerDefaultHelpers(instance) {
  _helpersBlockHelperMissing2['default'](instance);
  _helpersEach2['default'](instance);
  _helpersHelperMissing2['default'](instance);
  _helpersIf2['default'](instance);
  _helpersLog2['default'](instance);
  _helpersLookup2['default'](instance);
  _helpersWith2['default'](instance);
}


},{"./helpers/block-helper-missing":27,"./helpers/each":28,"./helpers/helper-missing":29,"./helpers/if":30,"./helpers/log":31,"./helpers/lookup":32,"./helpers/with":33}],27:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _utils = require('../utils');

exports['default'] = function (instance) {
  instance.registerHelper('blockHelperMissing', function (context, options) {
    var inverse = options.inverse,
        fn = options.fn;

    if (context === true) {
      return fn(this);
    } else if (context === false || context == null) {
      return inverse(this);
    } else if (_utils.isArray(context)) {
      if (context.length > 0) {
        if (options.ids) {
          options.ids = [options.name];
        }

        return instance.helpers.each(context, options);
      } else {
        return inverse(this);
      }
    } else {
      if (options.data && options.ids) {
        var data = _utils.createFrame(options.data);
        data.contextPath = _utils.appendContextPath(options.data.contextPath, options.name);
        options = { data: data };
      }

      return fn(context, options);
    }
  });
};

module.exports = exports['default'];


},{"../utils":38}],28:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _utils = require('../utils');

var _exception = require('../exception');

var _exception2 = _interopRequireDefault(_exception);

exports['default'] = function (instance) {
  instance.registerHelper('each', function (context, options) {
    if (!options) {
      throw new _exception2['default']('Must pass iterator to #each');
    }

    var fn = options.fn,
        inverse = options.inverse,
        i = 0,
        ret = '',
        data = undefined,
        contextPath = undefined;

    if (options.data && options.ids) {
      contextPath = _utils.appendContextPath(options.data.contextPath, options.ids[0]) + '.';
    }

    if (_utils.isFunction(context)) {
      context = context.call(this);
    }

    if (options.data) {
      data = _utils.createFrame(options.data);
    }

    function execIteration(field, index, last) {
      if (data) {
        data.key = field;
        data.index = index;
        data.first = index === 0;
        data.last = !!last;

        if (contextPath) {
          data.contextPath = contextPath + field;
        }
      }

      ret = ret + fn(context[field], {
        data: data,
        blockParams: _utils.blockParams([context[field], field], [contextPath + field, null])
      });
    }

    if (context && typeof context === 'object') {
      if (_utils.isArray(context)) {
        for (var j = context.length; i < j; i++) {
          if (i in context) {
            execIteration(i, i, i === context.length - 1);
          }
        }
      } else {
        var priorKey = undefined;

        for (var key in context) {
          if (context.hasOwnProperty(key)) {
            // We're running the iterations one step out of sync so we can detect
            // the last iteration without have to scan the object twice and create
            // an itermediate keys array.
            if (priorKey !== undefined) {
              execIteration(priorKey, i - 1);
            }
            priorKey = key;
            i++;
          }
        }
        if (priorKey !== undefined) {
          execIteration(priorKey, i - 1, true);
        }
      }
    }

    if (i === 0) {
      ret = inverse(this);
    }

    return ret;
  });
};

module.exports = exports['default'];


},{"../exception":25,"../utils":38}],29:[function(require,module,exports){
'use strict';

exports.__esModule = true;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _exception = require('../exception');

var _exception2 = _interopRequireDefault(_exception);

exports['default'] = function (instance) {
  instance.registerHelper('helperMissing', function () /* [args, ]options */{
    if (arguments.length === 1) {
      // A missing field in a {{foo}} construct.
      return undefined;
    } else {
      // Someone is actually trying to call something, blow up.
      throw new _exception2['default']('Missing helper: "' + arguments[arguments.length - 1].name + '"');
    }
  });
};

module.exports = exports['default'];


},{"../exception":25}],30:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _utils = require('../utils');

exports['default'] = function (instance) {
  instance.registerHelper('if', function (conditional, options) {
    if (_utils.isFunction(conditional)) {
      conditional = conditional.call(this);
    }

    // Default behavior is to render the positive path if the value is truthy and not empty.
    // The `includeZero` option may be set to treat the condtional as purely not empty based on the
    // behavior of isEmpty. Effectively this determines if 0 is handled by the positive path or negative.
    if (!options.hash.includeZero && !conditional || _utils.isEmpty(conditional)) {
      return options.inverse(this);
    } else {
      return options.fn(this);
    }
  });

  instance.registerHelper('unless', function (conditional, options) {
    return instance.helpers['if'].call(this, conditional, { fn: options.inverse, inverse: options.fn, hash: options.hash });
  });
};

module.exports = exports['default'];


},{"../utils":38}],31:[function(require,module,exports){
'use strict';

exports.__esModule = true;

exports['default'] = function (instance) {
  instance.registerHelper('log', function () /* message, options */{
    var args = [undefined],
        options = arguments[arguments.length - 1];
    for (var i = 0; i < arguments.length - 1; i++) {
      args.push(arguments[i]);
    }

    var level = 1;
    if (options.hash.level != null) {
      level = options.hash.level;
    } else if (options.data && options.data.level != null) {
      level = options.data.level;
    }
    args[0] = level;

    instance.log.apply(instance, args);
  });
};

module.exports = exports['default'];


},{}],32:[function(require,module,exports){
'use strict';

exports.__esModule = true;

exports['default'] = function (instance) {
  instance.registerHelper('lookup', function (obj, field) {
    return obj && obj[field];
  });
};

module.exports = exports['default'];


},{}],33:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _utils = require('../utils');

exports['default'] = function (instance) {
  instance.registerHelper('with', function (context, options) {
    if (_utils.isFunction(context)) {
      context = context.call(this);
    }

    var fn = options.fn;

    if (!_utils.isEmpty(context)) {
      var data = options.data;
      if (options.data && options.ids) {
        data = _utils.createFrame(options.data);
        data.contextPath = _utils.appendContextPath(options.data.contextPath, options.ids[0]);
      }

      return fn(context, {
        data: data,
        blockParams: _utils.blockParams([context], [data && data.contextPath])
      });
    } else {
      return options.inverse(this);
    }
  });
};

module.exports = exports['default'];


},{"../utils":38}],34:[function(require,module,exports){
'use strict';

exports.__esModule = true;

var _utils = require('./utils');

var logger = {
  methodMap: ['debug', 'info', 'warn', 'error'],
  level: 'info',

  // Maps a given level value to the `methodMap` indexes above.
  lookupLevel: function lookupLevel(level) {
    if (typeof level === 'string') {
      var levelMap = _utils.indexOf(logger.methodMap, level.toLowerCase());
      if (levelMap >= 0) {
        level = levelMap;
      } else {
        level = parseInt(level, 10);
      }
    }

    return level;
  },

  // Can be overridden in the host environment
  log: function log(level) {
    level = logger.lookupLevel(level);

    if (typeof console !== 'undefined' && logger.lookupLevel(logger.level) <= level) {
      var method = logger.methodMap[level];
      if (!console[method]) {
        // eslint-disable-line no-console
        method = 'log';
      }

      for (var _len = arguments.length, message = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        message[_key - 1] = arguments[_key];
      }

      console[method].apply(console, message); // eslint-disable-line no-console
    }
  }
};

exports['default'] = logger;
module.exports = exports['default'];


},{"./utils":38}],35:[function(require,module,exports){
(function (global){
/* global window */
'use strict';

exports.__esModule = true;

exports['default'] = function (Handlebars) {
  /* istanbul ignore next */
  var root = typeof global !== 'undefined' ? global : window,
      $Handlebars = root.Handlebars;
  /* istanbul ignore next */
  Handlebars.noConflict = function () {
    if (root.Handlebars === Handlebars) {
      root.Handlebars = $Handlebars;
    }
    return Handlebars;
  };
};

module.exports = exports['default'];


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],36:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.checkRevision = checkRevision;
exports.template = template;
exports.wrapProgram = wrapProgram;
exports.resolvePartial = resolvePartial;
exports.invokePartial = invokePartial;
exports.noop = noop;
// istanbul ignore next

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

// istanbul ignore next

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

var _utils = require('./utils');

var Utils = _interopRequireWildcard(_utils);

var _exception = require('./exception');

var _exception2 = _interopRequireDefault(_exception);

var _base = require('./base');

function checkRevision(compilerInfo) {
  var compilerRevision = compilerInfo && compilerInfo[0] || 1,
      currentRevision = _base.COMPILER_REVISION;

  if (compilerRevision !== currentRevision) {
    if (compilerRevision < currentRevision) {
      var runtimeVersions = _base.REVISION_CHANGES[currentRevision],
          compilerVersions = _base.REVISION_CHANGES[compilerRevision];
      throw new _exception2['default']('Template was precompiled with an older version of Handlebars than the current runtime. ' + 'Please update your precompiler to a newer version (' + runtimeVersions + ') or downgrade your runtime to an older version (' + compilerVersions + ').');
    } else {
      // Use the embedded version info since the runtime doesn't know about this revision yet
      throw new _exception2['default']('Template was precompiled with a newer version of Handlebars than the current runtime. ' + 'Please update your runtime to a newer version (' + compilerInfo[1] + ').');
    }
  }
}

function template(templateSpec, env) {
  /* istanbul ignore next */
  if (!env) {
    throw new _exception2['default']('No environment passed to template');
  }
  if (!templateSpec || !templateSpec.main) {
    throw new _exception2['default']('Unknown template object: ' + typeof templateSpec);
  }

  templateSpec.main.decorator = templateSpec.main_d;

  // Note: Using env.VM references rather than local var references throughout this section to allow
  // for external users to override these as psuedo-supported APIs.
  env.VM.checkRevision(templateSpec.compiler);

  function invokePartialWrapper(partial, context, options) {
    if (options.hash) {
      context = Utils.extend({}, context, options.hash);
      if (options.ids) {
        options.ids[0] = true;
      }
    }

    partial = env.VM.resolvePartial.call(this, partial, context, options);
    var result = env.VM.invokePartial.call(this, partial, context, options);

    if (result == null && env.compile) {
      options.partials[options.name] = env.compile(partial, templateSpec.compilerOptions, env);
      result = options.partials[options.name](context, options);
    }
    if (result != null) {
      if (options.indent) {
        var lines = result.split('\n');
        for (var i = 0, l = lines.length; i < l; i++) {
          if (!lines[i] && i + 1 === l) {
            break;
          }

          lines[i] = options.indent + lines[i];
        }
        result = lines.join('\n');
      }
      return result;
    } else {
      throw new _exception2['default']('The partial ' + options.name + ' could not be compiled when running in runtime-only mode');
    }
  }

  // Just add water
  var container = {
    strict: function strict(obj, name) {
      if (!(name in obj)) {
        throw new _exception2['default']('"' + name + '" not defined in ' + obj);
      }
      return obj[name];
    },
    lookup: function lookup(depths, name) {
      var len = depths.length;
      for (var i = 0; i < len; i++) {
        if (depths[i] && depths[i][name] != null) {
          return depths[i][name];
        }
      }
    },
    lambda: function lambda(current, context) {
      return typeof current === 'function' ? current.call(context) : current;
    },

    escapeExpression: Utils.escapeExpression,
    invokePartial: invokePartialWrapper,

    fn: function fn(i) {
      var ret = templateSpec[i];
      ret.decorator = templateSpec[i + '_d'];
      return ret;
    },

    programs: [],
    program: function program(i, data, declaredBlockParams, blockParams, depths) {
      var programWrapper = this.programs[i],
          fn = this.fn(i);
      if (data || depths || blockParams || declaredBlockParams) {
        programWrapper = wrapProgram(this, i, fn, data, declaredBlockParams, blockParams, depths);
      } else if (!programWrapper) {
        programWrapper = this.programs[i] = wrapProgram(this, i, fn);
      }
      return programWrapper;
    },

    data: function data(value, depth) {
      while (value && depth--) {
        value = value._parent;
      }
      return value;
    },
    merge: function merge(param, common) {
      var obj = param || common;

      if (param && common && param !== common) {
        obj = Utils.extend({}, common, param);
      }

      return obj;
    },

    noop: env.VM.noop,
    compilerInfo: templateSpec.compiler
  };

  function ret(context) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    var data = options.data;

    ret._setup(options);
    if (!options.partial && templateSpec.useData) {
      data = initData(context, data);
    }
    var depths = undefined,
        blockParams = templateSpec.useBlockParams ? [] : undefined;
    if (templateSpec.useDepths) {
      if (options.depths) {
        depths = context !== options.depths[0] ? [context].concat(options.depths) : options.depths;
      } else {
        depths = [context];
      }
    }

    function main(context /*, options*/) {
      return '' + templateSpec.main(container, context, container.helpers, container.partials, data, blockParams, depths);
    }
    main = executeDecorators(templateSpec.main, main, container, options.depths || [], data, blockParams);
    return main(context, options);
  }
  ret.isTop = true;

  ret._setup = function (options) {
    if (!options.partial) {
      container.helpers = container.merge(options.helpers, env.helpers);

      if (templateSpec.usePartial) {
        container.partials = container.merge(options.partials, env.partials);
      }
      if (templateSpec.usePartial || templateSpec.useDecorators) {
        container.decorators = container.merge(options.decorators, env.decorators);
      }
    } else {
      container.helpers = options.helpers;
      container.partials = options.partials;
      container.decorators = options.decorators;
    }
  };

  ret._child = function (i, data, blockParams, depths) {
    if (templateSpec.useBlockParams && !blockParams) {
      throw new _exception2['default']('must pass block params');
    }
    if (templateSpec.useDepths && !depths) {
      throw new _exception2['default']('must pass parent depths');
    }

    return wrapProgram(container, i, templateSpec[i], data, 0, blockParams, depths);
  };
  return ret;
}

function wrapProgram(container, i, fn, data, declaredBlockParams, blockParams, depths) {
  function prog(context) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    var currentDepths = depths;
    if (depths && context !== depths[0]) {
      currentDepths = [context].concat(depths);
    }

    return fn(container, context, container.helpers, container.partials, options.data || data, blockParams && [options.blockParams].concat(blockParams), currentDepths);
  }

  prog = executeDecorators(fn, prog, container, depths, data, blockParams);

  prog.program = i;
  prog.depth = depths ? depths.length : 0;
  prog.blockParams = declaredBlockParams || 0;
  return prog;
}

function resolvePartial(partial, context, options) {
  if (!partial) {
    if (options.name === '@partial-block') {
      partial = options.data['partial-block'];
    } else {
      partial = options.partials[options.name];
    }
  } else if (!partial.call && !options.name) {
    // This is a dynamic partial that returned a string
    options.name = partial;
    partial = options.partials[partial];
  }
  return partial;
}

function invokePartial(partial, context, options) {
  options.partial = true;
  if (options.ids) {
    options.data.contextPath = options.ids[0] || options.data.contextPath;
  }

  var partialBlock = undefined;
  if (options.fn && options.fn !== noop) {
    options.data = _base.createFrame(options.data);
    partialBlock = options.data['partial-block'] = options.fn;

    if (partialBlock.partials) {
      options.partials = Utils.extend({}, options.partials, partialBlock.partials);
    }
  }

  if (partial === undefined && partialBlock) {
    partial = partialBlock;
  }

  if (partial === undefined) {
    throw new _exception2['default']('The partial ' + options.name + ' could not be found');
  } else if (partial instanceof Function) {
    return partial(context, options);
  }
}

function noop() {
  return '';
}

function initData(context, data) {
  if (!data || !('root' in data)) {
    data = data ? _base.createFrame(data) : {};
    data.root = context;
  }
  return data;
}

function executeDecorators(fn, prog, container, depths, data, blockParams) {
  if (fn.decorator) {
    var props = {};
    prog = fn.decorator(prog, props, container, depths && depths[0], data, blockParams, depths);
    Utils.extend(prog, props);
  }
  return prog;
}


},{"./base":12,"./exception":25,"./utils":38}],37:[function(require,module,exports){
// Build out our basic SafeString type
'use strict';

exports.__esModule = true;
function SafeString(string) {
  this.string = string;
}

SafeString.prototype.toString = SafeString.prototype.toHTML = function () {
  return '' + this.string;
};

exports['default'] = SafeString;
module.exports = exports['default'];


},{}],38:[function(require,module,exports){
'use strict';

exports.__esModule = true;
exports.extend = extend;
exports.indexOf = indexOf;
exports.escapeExpression = escapeExpression;
exports.isEmpty = isEmpty;
exports.createFrame = createFrame;
exports.blockParams = blockParams;
exports.appendContextPath = appendContextPath;
var escape = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

var badChars = /[&<>"'`=]/g,
    possible = /[&<>"'`=]/;

function escapeChar(chr) {
  return escape[chr];
}

function extend(obj /* , ...source */) {
  for (var i = 1; i < arguments.length; i++) {
    for (var key in arguments[i]) {
      if (Object.prototype.hasOwnProperty.call(arguments[i], key)) {
        obj[key] = arguments[i][key];
      }
    }
  }

  return obj;
}

var toString = Object.prototype.toString;

exports.toString = toString;
// Sourced from lodash
// https://github.com/bestiejs/lodash/blob/master/LICENSE.txt
/* eslint-disable func-style */
var isFunction = function isFunction(value) {
  return typeof value === 'function';
};
// fallback for older versions of Chrome and Safari
/* istanbul ignore next */
if (isFunction(/x/)) {
  exports.isFunction = isFunction = function (value) {
    return typeof value === 'function' && toString.call(value) === '[object Function]';
  };
}
exports.isFunction = isFunction;

/* eslint-enable func-style */

/* istanbul ignore next */
var isArray = Array.isArray || function (value) {
  return value && typeof value === 'object' ? toString.call(value) === '[object Array]' : false;
};

exports.isArray = isArray;
// Older IE versions do not directly support indexOf so we must implement our own, sadly.

function indexOf(array, value) {
  for (var i = 0, len = array.length; i < len; i++) {
    if (array[i] === value) {
      return i;
    }
  }
  return -1;
}

function escapeExpression(string) {
  if (typeof string !== 'string') {
    // don't escape SafeStrings, since they're already safe
    if (string && string.toHTML) {
      return string.toHTML();
    } else if (string == null) {
      return '';
    } else if (!string) {
      return string + '';
    }

    // Force a string conversion as this will be done by the append regardless and
    // the regex test will do this transparently behind the scenes, causing issues if
    // an object's to string has escaped characters in it.
    string = '' + string;
  }

  if (!possible.test(string)) {
    return string;
  }
  return string.replace(badChars, escapeChar);
}

function isEmpty(value) {
  if (!value && value !== 0) {
    return true;
  } else if (isArray(value) && value.length === 0) {
    return true;
  } else {
    return false;
  }
}

function createFrame(object) {
  var frame = extend({}, object);
  frame._parent = object;
  return frame;
}

function blockParams(params, ids) {
  params.path = ids;
  return params;
}

function appendContextPath(contextPath, id) {
  return (contextPath ? contextPath + '.' : '') + id;
}


},{}],39:[function(require,module,exports){
// USAGE:
// var handlebars = require('handlebars');
/* eslint-disable no-var */

// var local = handlebars.create();

var handlebars = require('../dist/cjs/handlebars')['default'];

var printer = require('../dist/cjs/handlebars/compiler/printer');
handlebars.PrintVisitor = printer.PrintVisitor;
handlebars.print = printer.print;

module.exports = handlebars;

// Publish a Node.js require() handler for .handlebars and .hbs files
function extension(module, filename) {
  var fs = require('fs');
  var templateString = fs.readFileSync(filename, 'utf8');
  module.exports = handlebars.compile(templateString);
}
/* istanbul ignore else */
if (typeof require !== 'undefined' && require.extensions) {
  require.extensions['.handlebars'] = extension;
  require.extensions['.hbs'] = extension;
}

},{"../dist/cjs/handlebars":10,"../dist/cjs/handlebars/compiler/printer":20,"fs":3}],40:[function(require,module,exports){
/*
 * Copyright 2009-2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE.txt or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
exports.SourceMapGenerator = require('./source-map/source-map-generator').SourceMapGenerator;
exports.SourceMapConsumer = require('./source-map/source-map-consumer').SourceMapConsumer;
exports.SourceNode = require('./source-map/source-node').SourceNode;

},{"./source-map/source-map-consumer":47,"./source-map/source-map-generator":48,"./source-map/source-node":49}],41:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');

  /**
   * A data structure which is a combination of an array and a set. Adding a new
   * member is O(1), testing for membership is O(1), and finding the index of an
   * element is O(1). Removing elements from the set is not supported. Only
   * strings are supported for membership.
   */
  function ArraySet() {
    this._array = [];
    this._set = {};
  }

  /**
   * Static method for creating ArraySet instances from an existing array.
   */
  ArraySet.fromArray = function ArraySet_fromArray(aArray, aAllowDuplicates) {
    var set = new ArraySet();
    for (var i = 0, len = aArray.length; i < len; i++) {
      set.add(aArray[i], aAllowDuplicates);
    }
    return set;
  };

  /**
   * Return how many unique items are in this ArraySet. If duplicates have been
   * added, than those do not count towards the size.
   *
   * @returns Number
   */
  ArraySet.prototype.size = function ArraySet_size() {
    return Object.getOwnPropertyNames(this._set).length;
  };

  /**
   * Add the given string to this set.
   *
   * @param String aStr
   */
  ArraySet.prototype.add = function ArraySet_add(aStr, aAllowDuplicates) {
    var isDuplicate = this.has(aStr);
    var idx = this._array.length;
    if (!isDuplicate || aAllowDuplicates) {
      this._array.push(aStr);
    }
    if (!isDuplicate) {
      this._set[util.toSetString(aStr)] = idx;
    }
  };

  /**
   * Is the given string a member of this set?
   *
   * @param String aStr
   */
  ArraySet.prototype.has = function ArraySet_has(aStr) {
    return Object.prototype.hasOwnProperty.call(this._set,
                                                util.toSetString(aStr));
  };

  /**
   * What is the index of the given string in the array?
   *
   * @param String aStr
   */
  ArraySet.prototype.indexOf = function ArraySet_indexOf(aStr) {
    if (this.has(aStr)) {
      return this._set[util.toSetString(aStr)];
    }
    throw new Error('"' + aStr + '" is not in the set.');
  };

  /**
   * What is the element at the given index?
   *
   * @param Number aIdx
   */
  ArraySet.prototype.at = function ArraySet_at(aIdx) {
    if (aIdx >= 0 && aIdx < this._array.length) {
      return this._array[aIdx];
    }
    throw new Error('No element indexed by ' + aIdx);
  };

  /**
   * Returns the array representation of this set (which has the proper indices
   * indicated by indexOf). Note that this is a copy of the internal array used
   * for storing the members so that no one can mess with internal state.
   */
  ArraySet.prototype.toArray = function ArraySet_toArray() {
    return this._array.slice();
  };

  exports.ArraySet = ArraySet;

});

},{"./util":50,"amdefine":51}],42:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 *
 * Based on the Base 64 VLQ implementation in Closure Compiler:
 * https://code.google.com/p/closure-compiler/source/browse/trunk/src/com/google/debugging/sourcemap/Base64VLQ.java
 *
 * Copyright 2011 The Closure Compiler Authors. All rights reserved.
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *  * Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *  * Neither the name of Google Inc. nor the names of its
 *    contributors may be used to endorse or promote products derived
 *    from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var base64 = require('./base64');

  // A single base 64 digit can contain 6 bits of data. For the base 64 variable
  // length quantities we use in the source map spec, the first bit is the sign,
  // the next four bits are the actual value, and the 6th bit is the
  // continuation bit. The continuation bit tells us whether there are more
  // digits in this value following this digit.
  //
  //   Continuation
  //   |    Sign
  //   |    |
  //   V    V
  //   101011

  var VLQ_BASE_SHIFT = 5;

  // binary: 100000
  var VLQ_BASE = 1 << VLQ_BASE_SHIFT;

  // binary: 011111
  var VLQ_BASE_MASK = VLQ_BASE - 1;

  // binary: 100000
  var VLQ_CONTINUATION_BIT = VLQ_BASE;

  /**
   * Converts from a two-complement value to a value where the sign bit is
   * placed in the least significant bit.  For example, as decimals:
   *   1 becomes 2 (10 binary), -1 becomes 3 (11 binary)
   *   2 becomes 4 (100 binary), -2 becomes 5 (101 binary)
   */
  function toVLQSigned(aValue) {
    return aValue < 0
      ? ((-aValue) << 1) + 1
      : (aValue << 1) + 0;
  }

  /**
   * Converts to a two-complement value from a value where the sign bit is
   * placed in the least significant bit.  For example, as decimals:
   *   2 (10 binary) becomes 1, 3 (11 binary) becomes -1
   *   4 (100 binary) becomes 2, 5 (101 binary) becomes -2
   */
  function fromVLQSigned(aValue) {
    var isNegative = (aValue & 1) === 1;
    var shifted = aValue >> 1;
    return isNegative
      ? -shifted
      : shifted;
  }

  /**
   * Returns the base 64 VLQ encoded value.
   */
  exports.encode = function base64VLQ_encode(aValue) {
    var encoded = "";
    var digit;

    var vlq = toVLQSigned(aValue);

    do {
      digit = vlq & VLQ_BASE_MASK;
      vlq >>>= VLQ_BASE_SHIFT;
      if (vlq > 0) {
        // There are still more digits in this value, so we must make sure the
        // continuation bit is marked.
        digit |= VLQ_CONTINUATION_BIT;
      }
      encoded += base64.encode(digit);
    } while (vlq > 0);

    return encoded;
  };

  /**
   * Decodes the next base 64 VLQ value from the given string and returns the
   * value and the rest of the string via the out parameter.
   */
  exports.decode = function base64VLQ_decode(aStr, aIndex, aOutParam) {
    var strLen = aStr.length;
    var result = 0;
    var shift = 0;
    var continuation, digit;

    do {
      if (aIndex >= strLen) {
        throw new Error("Expected more digits in base 64 VLQ value.");
      }

      digit = base64.decode(aStr.charCodeAt(aIndex++));
      if (digit === -1) {
        throw new Error("Invalid base64 digit: " + aStr.charAt(aIndex - 1));
      }

      continuation = !!(digit & VLQ_CONTINUATION_BIT);
      digit &= VLQ_BASE_MASK;
      result = result + (digit << shift);
      shift += VLQ_BASE_SHIFT;
    } while (continuation);

    aOutParam.value = fromVLQSigned(result);
    aOutParam.rest = aIndex;
  };

});

},{"./base64":43,"amdefine":51}],43:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var intToCharMap = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('');

  /**
   * Encode an integer in the range of 0 to 63 to a single base 64 digit.
   */
  exports.encode = function (number) {
    if (0 <= number && number < intToCharMap.length) {
      return intToCharMap[number];
    }
    throw new TypeError("Must be between 0 and 63: " + aNumber);
  };

  /**
   * Decode a single base 64 character code digit to an integer. Returns -1 on
   * failure.
   */
  exports.decode = function (charCode) {
    var bigA = 65;     // 'A'
    var bigZ = 90;     // 'Z'

    var littleA = 97;  // 'a'
    var littleZ = 122; // 'z'

    var zero = 48;     // '0'
    var nine = 57;     // '9'

    var plus = 43;     // '+'
    var slash = 47;    // '/'

    var littleOffset = 26;
    var numberOffset = 52;

    // 0 - 25: ABCDEFGHIJKLMNOPQRSTUVWXYZ
    if (bigA <= charCode && charCode <= bigZ) {
      return (charCode - bigA);
    }

    // 26 - 51: abcdefghijklmnopqrstuvwxyz
    if (littleA <= charCode && charCode <= littleZ) {
      return (charCode - littleA + littleOffset);
    }

    // 52 - 61: 0123456789
    if (zero <= charCode && charCode <= nine) {
      return (charCode - zero + numberOffset);
    }

    // 62: +
    if (charCode == plus) {
      return 62;
    }

    // 63: /
    if (charCode == slash) {
      return 63;
    }

    // Invalid base64 digit.
    return -1;
  };

});

},{"amdefine":51}],44:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  exports.GREATEST_LOWER_BOUND = 1;
  exports.LEAST_UPPER_BOUND = 2;

  /**
   * Recursive implementation of binary search.
   *
   * @param aLow Indices here and lower do not contain the needle.
   * @param aHigh Indices here and higher do not contain the needle.
   * @param aNeedle The element being searched for.
   * @param aHaystack The non-empty array being searched.
   * @param aCompare Function which takes two elements and returns -1, 0, or 1.
   * @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
   *     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
   *     closest element that is smaller than or greater than the one we are
   *     searching for, respectively, if the exact element cannot be found.
   */
  function recursiveSearch(aLow, aHigh, aNeedle, aHaystack, aCompare, aBias) {
    // This function terminates when one of the following is true:
    //
    //   1. We find the exact element we are looking for.
    //
    //   2. We did not find the exact element, but we can return the index of
    //      the next-closest element.
    //
    //   3. We did not find the exact element, and there is no next-closest
    //      element than the one we are searching for, so we return -1.
    var mid = Math.floor((aHigh - aLow) / 2) + aLow;
    var cmp = aCompare(aNeedle, aHaystack[mid], true);
    if (cmp === 0) {
      // Found the element we are looking for.
      return mid;
    }
    else if (cmp > 0) {
      // Our needle is greater than aHaystack[mid].
      if (aHigh - mid > 1) {
        // The element is in the upper half.
        return recursiveSearch(mid, aHigh, aNeedle, aHaystack, aCompare, aBias);
      }

      // The exact needle element was not found in this haystack. Determine if
      // we are in termination case (3) or (2) and return the appropriate thing.
      if (aBias == exports.LEAST_UPPER_BOUND) {
        return aHigh < aHaystack.length ? aHigh : -1;
      } else {
        return mid;
      }
    }
    else {
      // Our needle is less than aHaystack[mid].
      if (mid - aLow > 1) {
        // The element is in the lower half.
        return recursiveSearch(aLow, mid, aNeedle, aHaystack, aCompare, aBias);
      }

      // we are in termination case (3) or (2) and return the appropriate thing.
      if (aBias == exports.LEAST_UPPER_BOUND) {
        return mid;
      } else {
        return aLow < 0 ? -1 : aLow;
      }
    }
  }

  /**
   * This is an implementation of binary search which will always try and return
   * the index of the closest element if there is no exact hit. This is because
   * mappings between original and generated line/col pairs are single points,
   * and there is an implicit region between each of them, so a miss just means
   * that you aren't on the very start of a region.
   *
   * @param aNeedle The element you are looking for.
   * @param aHaystack The array that is being searched.
   * @param aCompare A function which takes the needle and an element in the
   *     array and returns -1, 0, or 1 depending on whether the needle is less
   *     than, equal to, or greater than the element, respectively.
   * @param aBias Either 'binarySearch.GREATEST_LOWER_BOUND' or
   *     'binarySearch.LEAST_UPPER_BOUND'. Specifies whether to return the
   *     closest element that is smaller than or greater than the one we are
   *     searching for, respectively, if the exact element cannot be found.
   *     Defaults to 'binarySearch.GREATEST_LOWER_BOUND'.
   */
  exports.search = function search(aNeedle, aHaystack, aCompare, aBias) {
    if (aHaystack.length === 0) {
      return -1;
    }

    var index = recursiveSearch(-1, aHaystack.length, aNeedle, aHaystack,
                                aCompare, aBias || exports.GREATEST_LOWER_BOUND);
    if (index < 0) {
      return -1;
    }

    // We have found either the exact element, or the next-closest element than
    // the one we are searching for. However, there may be more than one such
    // element. Make sure we always return the smallest of these.
    while (index - 1 >= 0) {
      if (aCompare(aHaystack[index], aHaystack[index - 1], true) !== 0) {
        break;
      }
      --index;
    }

    return index;
  };

});

},{"amdefine":51}],45:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2014 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');

  /**
   * Determine whether mappingB is after mappingA with respect to generated
   * position.
   */
  function generatedPositionAfter(mappingA, mappingB) {
    // Optimized for most common case
    var lineA = mappingA.generatedLine;
    var lineB = mappingB.generatedLine;
    var columnA = mappingA.generatedColumn;
    var columnB = mappingB.generatedColumn;
    return lineB > lineA || lineB == lineA && columnB >= columnA ||
           util.compareByGeneratedPositionsInflated(mappingA, mappingB) <= 0;
  }

  /**
   * A data structure to provide a sorted view of accumulated mappings in a
   * performance conscious manner. It trades a neglibable overhead in general
   * case for a large speedup in case of mappings being added in order.
   */
  function MappingList() {
    this._array = [];
    this._sorted = true;
    // Serves as infimum
    this._last = {generatedLine: -1, generatedColumn: 0};
  }

  /**
   * Iterate through internal items. This method takes the same arguments that
   * `Array.prototype.forEach` takes.
   *
   * NOTE: The order of the mappings is NOT guaranteed.
   */
  MappingList.prototype.unsortedForEach =
    function MappingList_forEach(aCallback, aThisArg) {
      this._array.forEach(aCallback, aThisArg);
    };

  /**
   * Add the given source mapping.
   *
   * @param Object aMapping
   */
  MappingList.prototype.add = function MappingList_add(aMapping) {
    var mapping;
    if (generatedPositionAfter(this._last, aMapping)) {
      this._last = aMapping;
      this._array.push(aMapping);
    } else {
      this._sorted = false;
      this._array.push(aMapping);
    }
  };

  /**
   * Returns the flat, sorted array of mappings. The mappings are sorted by
   * generated position.
   *
   * WARNING: This method returns internal data without copying, for
   * performance. The return value must NOT be mutated, and should be treated as
   * an immutable borrow. If you want to take ownership, you must make your own
   * copy.
   */
  MappingList.prototype.toArray = function MappingList_toArray() {
    if (!this._sorted) {
      this._array.sort(util.compareByGeneratedPositionsInflated);
      this._sorted = true;
    }
    return this._array;
  };

  exports.MappingList = MappingList;

});

},{"./util":50,"amdefine":51}],46:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  // It turns out that some (most?) JavaScript engines don't self-host
  // `Array.prototype.sort`. This makes sense because C++ will likely remain
  // faster than JS when doing raw CPU-intensive sorting. However, when using a
  // custom comparator function, calling back and forth between the VM's C++ and
  // JIT'd JS is rather slow *and* loses JIT type information, resulting in
  // worse generated code for the comparator function than would be optimal. In
  // fact, when sorting with a comparator, these costs outweigh the benefits of
  // sorting in C++. By using our own JS-implemented Quick Sort (below), we get
  // a ~3500ms mean speed-up in `bench/bench.html`.

  /**
   * Swap the elements indexed by `x` and `y` in the array `ary`.
   *
   * @param {Array} ary
   *        The array.
   * @param {Number} x
   *        The index of the first item.
   * @param {Number} y
   *        The index of the second item.
   */
  function swap(ary, x, y) {
    var temp = ary[x];
    ary[x] = ary[y];
    ary[y] = temp;
  }

  /**
   * Returns a random integer within the range `low .. high` inclusive.
   *
   * @param {Number} low
   *        The lower bound on the range.
   * @param {Number} high
   *        The upper bound on the range.
   */
  function randomIntInRange(low, high) {
    return Math.round(low + (Math.random() * (high - low)));
  }

  /**
   * The Quick Sort algorithm.
   *
   * @param {Array} ary
   *        An array to sort.
   * @param {function} comparator
   *        Function to use to compare two items.
   * @param {Number} p
   *        Start index of the array
   * @param {Number} r
   *        End index of the array
   */
  function doQuickSort(ary, comparator, p, r) {
    // If our lower bound is less than our upper bound, we (1) partition the
    // array into two pieces and (2) recurse on each half. If it is not, this is
    // the empty array and our base case.

    if (p < r) {
      // (1) Partitioning.
      //
      // The partitioning chooses a pivot between `p` and `r` and moves all
      // elements that are less than or equal to the pivot to the before it, and
      // all the elements that are greater than it after it. The effect is that
      // once partition is done, the pivot is in the exact place it will be when
      // the array is put in sorted order, and it will not need to be moved
      // again. This runs in O(n) time.

      // Always choose a random pivot so that an input array which is reverse
      // sorted does not cause O(n^2) running time.
      var pivotIndex = randomIntInRange(p, r);
      var i = p - 1;

      swap(ary, pivotIndex, r);
      var pivot = ary[r];

      // Immediately after `j` is incremented in this loop, the following hold
      // true:
      //
      //   * Every element in `ary[p .. i]` is less than or equal to the pivot.
      //
      //   * Every element in `ary[i+1 .. j-1]` is greater than the pivot.
      for (var j = p; j < r; j++) {
        if (comparator(ary[j], pivot) <= 0) {
          i += 1;
          swap(ary, i, j);
        }
      }

      swap(ary, i + 1, j);
      var q = i + 1;

      // (2) Recurse on each half.

      doQuickSort(ary, comparator, p, q - 1);
      doQuickSort(ary, comparator, q + 1, r);
    }
  }

  /**
   * Sort the given array in-place with the given comparator function.
   *
   * @param {Array} ary
   *        An array to sort.
   * @param {function} comparator
   *        Function to use to compare two items.
   */
  exports.quickSort = function (ary, comparator) {
    doQuickSort(ary, comparator, 0, ary.length - 1);
  };

});

},{"amdefine":51}],47:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var util = require('./util');
  var binarySearch = require('./binary-search');
  var ArraySet = require('./array-set').ArraySet;
  var base64VLQ = require('./base64-vlq');
  var quickSort = require('./quick-sort').quickSort;

  function SourceMapConsumer(aSourceMap) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === 'string') {
      sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
    }

    return sourceMap.sections != null
      ? new IndexedSourceMapConsumer(sourceMap)
      : new BasicSourceMapConsumer(sourceMap);
  }

  SourceMapConsumer.fromSourceMap = function(aSourceMap) {
    return BasicSourceMapConsumer.fromSourceMap(aSourceMap);
  }

  /**
   * The version of the source mapping spec that we are consuming.
   */
  SourceMapConsumer.prototype._version = 3;

  // `__generatedMappings` and `__originalMappings` are arrays that hold the
  // parsed mapping coordinates from the source map's "mappings" attribute. They
  // are lazily instantiated, accessed via the `_generatedMappings` and
  // `_originalMappings` getters respectively, and we only parse the mappings
  // and create these arrays once queried for a source location. We jump through
  // these hoops because there can be many thousands of mappings, and parsing
  // them is expensive, so we only want to do it if we must.
  //
  // Each object in the arrays is of the form:
  //
  //     {
  //       generatedLine: The line number in the generated code,
  //       generatedColumn: The column number in the generated code,
  //       source: The path to the original source file that generated this
  //               chunk of code,
  //       originalLine: The line number in the original source that
  //                     corresponds to this chunk of generated code,
  //       originalColumn: The column number in the original source that
  //                       corresponds to this chunk of generated code,
  //       name: The name of the original symbol which generated this chunk of
  //             code.
  //     }
  //
  // All properties except for `generatedLine` and `generatedColumn` can be
  // `null`.
  //
  // `_generatedMappings` is ordered by the generated positions.
  //
  // `_originalMappings` is ordered by the original positions.

  SourceMapConsumer.prototype.__generatedMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, '_generatedMappings', {
    get: function () {
      if (!this.__generatedMappings) {
        this._parseMappings(this._mappings, this.sourceRoot);
      }

      return this.__generatedMappings;
    }
  });

  SourceMapConsumer.prototype.__originalMappings = null;
  Object.defineProperty(SourceMapConsumer.prototype, '_originalMappings', {
    get: function () {
      if (!this.__originalMappings) {
        this._parseMappings(this._mappings, this.sourceRoot);
      }

      return this.__originalMappings;
    }
  });

  SourceMapConsumer.prototype._charIsMappingSeparator =
    function SourceMapConsumer_charIsMappingSeparator(aStr, index) {
      var c = aStr.charAt(index);
      return c === ";" || c === ",";
    };

  /**
   * Parse the mappings in a string in to a data structure which we can easily
   * query (the ordered arrays in the `this.__generatedMappings` and
   * `this.__originalMappings` properties).
   */
  SourceMapConsumer.prototype._parseMappings =
    function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
      throw new Error("Subclasses must implement _parseMappings");
    };

  SourceMapConsumer.GENERATED_ORDER = 1;
  SourceMapConsumer.ORIGINAL_ORDER = 2;

  SourceMapConsumer.GREATEST_LOWER_BOUND = 1;
  SourceMapConsumer.LEAST_UPPER_BOUND = 2;

  /**
   * Iterate over each mapping between an original source/line/column and a
   * generated line/column in this source map.
   *
   * @param Function aCallback
   *        The function that is called with each mapping.
   * @param Object aContext
   *        Optional. If specified, this object will be the value of `this` every
   *        time that `aCallback` is called.
   * @param aOrder
   *        Either `SourceMapConsumer.GENERATED_ORDER` or
   *        `SourceMapConsumer.ORIGINAL_ORDER`. Specifies whether you want to
   *        iterate over the mappings sorted by the generated file's line/column
   *        order or the original's source/line/column order, respectively. Defaults to
   *        `SourceMapConsumer.GENERATED_ORDER`.
   */
  SourceMapConsumer.prototype.eachMapping =
    function SourceMapConsumer_eachMapping(aCallback, aContext, aOrder) {
      var context = aContext || null;
      var order = aOrder || SourceMapConsumer.GENERATED_ORDER;

      var mappings;
      switch (order) {
      case SourceMapConsumer.GENERATED_ORDER:
        mappings = this._generatedMappings;
        break;
      case SourceMapConsumer.ORIGINAL_ORDER:
        mappings = this._originalMappings;
        break;
      default:
        throw new Error("Unknown order of iteration.");
      }

      var sourceRoot = this.sourceRoot;
      mappings.map(function (mapping) {
        var source = mapping.source === null ? null : this._sources.at(mapping.source);
        if (source != null && sourceRoot != null) {
          source = util.join(sourceRoot, source);
        }
        return {
          source: source,
          generatedLine: mapping.generatedLine,
          generatedColumn: mapping.generatedColumn,
          originalLine: mapping.originalLine,
          originalColumn: mapping.originalColumn,
          name: mapping.name === null ? null : this._names.at(mapping.name)
        };
      }, this).forEach(aCallback, context);
    };

  /**
   * Returns all generated line and column information for the original source,
   * line, and column provided. If no column is provided, returns all mappings
   * corresponding to a either the line we are searching for or the next
   * closest line that has any mappings. Otherwise, returns all mappings
   * corresponding to the given line and either the column we are searching for
   * or the next closest column that has any offsets.
   *
   * The only argument is an object with the following properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.
   *   - column: Optional. the column number in the original source.
   *
   * and an array of objects is returned, each with the following properties:
   *
   *   - line: The line number in the generated source, or null.
   *   - column: The column number in the generated source, or null.
   */
  SourceMapConsumer.prototype.allGeneratedPositionsFor =
    function SourceMapConsumer_allGeneratedPositionsFor(aArgs) {
      var line = util.getArg(aArgs, 'line');

      // When there is no exact match, BasicSourceMapConsumer.prototype._findMapping
      // returns the index of the closest mapping less than the needle. By
      // setting needle.originalColumn to 0, we thus find the last mapping for
      // the given line, provided such a mapping exists.
      var needle = {
        source: util.getArg(aArgs, 'source'),
        originalLine: line,
        originalColumn: util.getArg(aArgs, 'column', 0)
      };

      if (this.sourceRoot != null) {
        needle.source = util.relative(this.sourceRoot, needle.source);
      }
      if (!this._sources.has(needle.source)) {
        return [];
      }
      needle.source = this._sources.indexOf(needle.source);

      var mappings = [];

      var index = this._findMapping(needle,
                                    this._originalMappings,
                                    "originalLine",
                                    "originalColumn",
                                    util.compareByOriginalPositions,
                                    binarySearch.LEAST_UPPER_BOUND);
      if (index >= 0) {
        var mapping = this._originalMappings[index];

        if (aArgs.column === undefined) {
          var originalLine = mapping.originalLine;

          // Iterate until either we run out of mappings, or we run into
          // a mapping for a different line than the one we found. Since
          // mappings are sorted, this is guaranteed to find all mappings for
          // the line we found.
          while (mapping && mapping.originalLine === originalLine) {
            mappings.push({
              line: util.getArg(mapping, 'generatedLine', null),
              column: util.getArg(mapping, 'generatedColumn', null),
              lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
            });

            mapping = this._originalMappings[++index];
          }
        } else {
          var originalColumn = mapping.originalColumn;

          // Iterate until either we run out of mappings, or we run into
          // a mapping for a different line than the one we were searching for.
          // Since mappings are sorted, this is guaranteed to find all mappings for
          // the line we are searching for.
          while (mapping &&
                 mapping.originalLine === line &&
                 mapping.originalColumn == originalColumn) {
            mappings.push({
              line: util.getArg(mapping, 'generatedLine', null),
              column: util.getArg(mapping, 'generatedColumn', null),
              lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
            });

            mapping = this._originalMappings[++index];
          }
        }
      }

      return mappings;
    };

  exports.SourceMapConsumer = SourceMapConsumer;

  /**
   * A BasicSourceMapConsumer instance represents a parsed source map which we can
   * query for information about the original file positions by giving it a file
   * position in the generated source.
   *
   * The only parameter is the raw source map (either as a JSON string, or
   * already parsed to an object). According to the spec, source maps have the
   * following attributes:
   *
   *   - version: Which version of the source map spec this map is following.
   *   - sources: An array of URLs to the original source files.
   *   - names: An array of identifiers which can be referrenced by individual mappings.
   *   - sourceRoot: Optional. The URL root from which all sources are relative.
   *   - sourcesContent: Optional. An array of contents of the original source files.
   *   - mappings: A string of base64 VLQs which contain the actual mappings.
   *   - file: Optional. The generated file this source map is associated with.
   *
   * Here is an example source map, taken from the source map spec[0]:
   *
   *     {
   *       version : 3,
   *       file: "out.js",
   *       sourceRoot : "",
   *       sources: ["foo.js", "bar.js"],
   *       names: ["src", "maps", "are", "fun"],
   *       mappings: "AA,AB;;ABCDE;"
   *     }
   *
   * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit?pli=1#
   */
  function BasicSourceMapConsumer(aSourceMap) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === 'string') {
      sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
    }

    var version = util.getArg(sourceMap, 'version');
    var sources = util.getArg(sourceMap, 'sources');
    // Sass 3.3 leaves out the 'names' array, so we deviate from the spec (which
    // requires the array) to play nice here.
    var names = util.getArg(sourceMap, 'names', []);
    var sourceRoot = util.getArg(sourceMap, 'sourceRoot', null);
    var sourcesContent = util.getArg(sourceMap, 'sourcesContent', null);
    var mappings = util.getArg(sourceMap, 'mappings');
    var file = util.getArg(sourceMap, 'file', null);

    // Once again, Sass deviates from the spec and supplies the version as a
    // string rather than a number, so we use loose equality checking here.
    if (version != this._version) {
      throw new Error('Unsupported version: ' + version);
    }

    // Some source maps produce relative source paths like "./foo.js" instead of
    // "foo.js".  Normalize these first so that future comparisons will succeed.
    // See bugzil.la/1090768.
    sources = sources.map(util.normalize);

    // Pass `true` below to allow duplicate names and sources. While source maps
    // are intended to be compressed and deduplicated, the TypeScript compiler
    // sometimes generates source maps with duplicates in them. See Github issue
    // #72 and bugzil.la/889492.
    this._names = ArraySet.fromArray(names, true);
    this._sources = ArraySet.fromArray(sources, true);

    this.sourceRoot = sourceRoot;
    this.sourcesContent = sourcesContent;
    this._mappings = mappings;
    this.file = file;
  }

  BasicSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
  BasicSourceMapConsumer.prototype.consumer = SourceMapConsumer;

  /**
   * Create a BasicSourceMapConsumer from a SourceMapGenerator.
   *
   * @param SourceMapGenerator aSourceMap
   *        The source map that will be consumed.
   * @returns BasicSourceMapConsumer
   */
  BasicSourceMapConsumer.fromSourceMap =
    function SourceMapConsumer_fromSourceMap(aSourceMap) {
      var smc = Object.create(BasicSourceMapConsumer.prototype);

      var names = smc._names = ArraySet.fromArray(aSourceMap._names.toArray(), true);
      var sources = smc._sources = ArraySet.fromArray(aSourceMap._sources.toArray(), true);
      smc.sourceRoot = aSourceMap._sourceRoot;
      smc.sourcesContent = aSourceMap._generateSourcesContent(smc._sources.toArray(),
                                                              smc.sourceRoot);
      smc.file = aSourceMap._file;

      // Because we are modifying the entries (by converting string sources and
      // names to indices into the sources and names ArraySets), we have to make
      // a copy of the entry or else bad things happen. Shared mutable state
      // strikes again! See github issue #191.

      var generatedMappings = aSourceMap._mappings.toArray().slice();
      var destGeneratedMappings = smc.__generatedMappings = [];
      var destOriginalMappings = smc.__originalMappings = [];

      for (var i = 0, length = generatedMappings.length; i < length; i++) {
        var srcMapping = generatedMappings[i];
        var destMapping = new Mapping;
        destMapping.generatedLine = srcMapping.generatedLine;
        destMapping.generatedColumn = srcMapping.generatedColumn;

        if (srcMapping.source) {
          destMapping.source = sources.indexOf(srcMapping.source);
          destMapping.originalLine = srcMapping.originalLine;
          destMapping.originalColumn = srcMapping.originalColumn;

          if (srcMapping.name) {
            destMapping.name = names.indexOf(srcMapping.name);
          }

          destOriginalMappings.push(destMapping);
        }

        destGeneratedMappings.push(destMapping);
      }

      quickSort(smc.__originalMappings, util.compareByOriginalPositions);

      return smc;
    };

  /**
   * The version of the source mapping spec that we are consuming.
   */
  BasicSourceMapConsumer.prototype._version = 3;

  /**
   * The list of original sources.
   */
  Object.defineProperty(BasicSourceMapConsumer.prototype, 'sources', {
    get: function () {
      return this._sources.toArray().map(function (s) {
        return this.sourceRoot != null ? util.join(this.sourceRoot, s) : s;
      }, this);
    }
  });

  /**
   * Provide the JIT with a nice shape / hidden class.
   */
  function Mapping() {
    this.generatedLine = 0;
    this.generatedColumn = 0;
    this.source = null;
    this.originalLine = null;
    this.originalColumn = null;
    this.name = null;
  }

  /**
   * Parse the mappings in a string in to a data structure which we can easily
   * query (the ordered arrays in the `this.__generatedMappings` and
   * `this.__originalMappings` properties).
   */
  BasicSourceMapConsumer.prototype._parseMappings =
    function SourceMapConsumer_parseMappings(aStr, aSourceRoot) {
      var generatedLine = 1;
      var previousGeneratedColumn = 0;
      var previousOriginalLine = 0;
      var previousOriginalColumn = 0;
      var previousSource = 0;
      var previousName = 0;
      var length = aStr.length;
      var index = 0;
      var cachedSegments = {};
      var temp = {};
      var originalMappings = [];
      var generatedMappings = [];
      var mapping, str, segment, end, value;

      while (index < length) {
        if (aStr.charAt(index) === ';') {
          generatedLine++;
          index++;
          previousGeneratedColumn = 0;
        }
        else if (aStr.charAt(index) === ',') {
          index++;
        }
        else {
          mapping = new Mapping();
          mapping.generatedLine = generatedLine;

          // Because each offset is encoded relative to the previous one,
          // many segments often have the same encoding. We can exploit this
          // fact by caching the parsed variable length fields of each segment,
          // allowing us to avoid a second parse if we encounter the same
          // segment again.
          for (end = index; end < length; end++) {
            if (this._charIsMappingSeparator(aStr, end)) {
              break;
            }
          }
          str = aStr.slice(index, end);

          segment = cachedSegments[str];
          if (segment) {
            index += str.length;
          } else {
            segment = [];
            while (index < end) {
              base64VLQ.decode(aStr, index, temp);
              value = temp.value;
              index = temp.rest;
              segment.push(value);
            }

            if (segment.length === 2) {
              throw new Error('Found a source, but no line and column');
            }

            if (segment.length === 3) {
              throw new Error('Found a source and line, but no column');
            }

            cachedSegments[str] = segment;
          }

          // Generated column.
          mapping.generatedColumn = previousGeneratedColumn + segment[0];
          previousGeneratedColumn = mapping.generatedColumn;

          if (segment.length > 1) {
            // Original source.
            mapping.source = previousSource + segment[1];
            previousSource += segment[1];

            // Original line.
            mapping.originalLine = previousOriginalLine + segment[2];
            previousOriginalLine = mapping.originalLine;
            // Lines are stored 0-based
            mapping.originalLine += 1;

            // Original column.
            mapping.originalColumn = previousOriginalColumn + segment[3];
            previousOriginalColumn = mapping.originalColumn;

            if (segment.length > 4) {
              // Original name.
              mapping.name = previousName + segment[4];
              previousName += segment[4];
            }
          }

          generatedMappings.push(mapping);
          if (typeof mapping.originalLine === 'number') {
            originalMappings.push(mapping);
          }
        }
      }

      quickSort(generatedMappings, util.compareByGeneratedPositionsDeflated);
      this.__generatedMappings = generatedMappings;

      quickSort(originalMappings, util.compareByOriginalPositions);
      this.__originalMappings = originalMappings;
    };

  /**
   * Find the mapping that best matches the hypothetical "needle" mapping that
   * we are searching for in the given "haystack" of mappings.
   */
  BasicSourceMapConsumer.prototype._findMapping =
    function SourceMapConsumer_findMapping(aNeedle, aMappings, aLineName,
                                           aColumnName, aComparator, aBias) {
      // To return the position we are searching for, we must first find the
      // mapping for the given position and then return the opposite position it
      // points to. Because the mappings are sorted, we can use binary search to
      // find the best mapping.

      if (aNeedle[aLineName] <= 0) {
        throw new TypeError('Line must be greater than or equal to 1, got '
                            + aNeedle[aLineName]);
      }
      if (aNeedle[aColumnName] < 0) {
        throw new TypeError('Column must be greater than or equal to 0, got '
                            + aNeedle[aColumnName]);
      }

      return binarySearch.search(aNeedle, aMappings, aComparator, aBias);
    };

  /**
   * Compute the last column for each generated mapping. The last column is
   * inclusive.
   */
  BasicSourceMapConsumer.prototype.computeColumnSpans =
    function SourceMapConsumer_computeColumnSpans() {
      for (var index = 0; index < this._generatedMappings.length; ++index) {
        var mapping = this._generatedMappings[index];

        // Mappings do not contain a field for the last generated columnt. We
        // can come up with an optimistic estimate, however, by assuming that
        // mappings are contiguous (i.e. given two consecutive mappings, the
        // first mapping ends where the second one starts).
        if (index + 1 < this._generatedMappings.length) {
          var nextMapping = this._generatedMappings[index + 1];

          if (mapping.generatedLine === nextMapping.generatedLine) {
            mapping.lastGeneratedColumn = nextMapping.generatedColumn - 1;
            continue;
          }
        }

        // The last mapping for each line spans the entire line.
        mapping.lastGeneratedColumn = Infinity;
      }
    };

  /**
   * Returns the original source, line, and column information for the generated
   * source's line and column positions provided. The only argument is an object
   * with the following properties:
   *
   *   - line: The line number in the generated source.
   *   - column: The column number in the generated source.
   *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
   *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
   *     closest element that is smaller than or greater than the one we are
   *     searching for, respectively, if the exact element cannot be found.
   *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
   *
   * and an object is returned with the following properties:
   *
   *   - source: The original source file, or null.
   *   - line: The line number in the original source, or null.
   *   - column: The column number in the original source, or null.
   *   - name: The original identifier, or null.
   */
  BasicSourceMapConsumer.prototype.originalPositionFor =
    function SourceMapConsumer_originalPositionFor(aArgs) {
      var needle = {
        generatedLine: util.getArg(aArgs, 'line'),
        generatedColumn: util.getArg(aArgs, 'column')
      };

      var index = this._findMapping(
        needle,
        this._generatedMappings,
        "generatedLine",
        "generatedColumn",
        util.compareByGeneratedPositionsDeflated,
        util.getArg(aArgs, 'bias', SourceMapConsumer.GREATEST_LOWER_BOUND)
      );

      if (index >= 0) {
        var mapping = this._generatedMappings[index];

        if (mapping.generatedLine === needle.generatedLine) {
          var source = util.getArg(mapping, 'source', null);
          if (source !== null) {
            source = this._sources.at(source);
            if (this.sourceRoot != null) {
              source = util.join(this.sourceRoot, source);
            }
          }
          var name = util.getArg(mapping, 'name', null);
          if (name !== null) {
            name = this._names.at(name);
          }
          return {
            source: source,
            line: util.getArg(mapping, 'originalLine', null),
            column: util.getArg(mapping, 'originalColumn', null),
            name: name
          };
        }
      }

      return {
        source: null,
        line: null,
        column: null,
        name: null
      };
    };

  /**
   * Return true if we have the source content for every source in the source
   * map, false otherwise.
   */
  BasicSourceMapConsumer.prototype.hasContentsOfAllSources =
    function BasicSourceMapConsumer_hasContentsOfAllSources() {
      if (!this.sourcesContent) {
        return false;
      }
      return this.sourcesContent.length >= this._sources.size() &&
        !this.sourcesContent.some(function (sc) { return sc == null; });
    };

  /**
   * Returns the original source content. The only argument is the url of the
   * original source file. Returns null if no original source content is
   * availible.
   */
  BasicSourceMapConsumer.prototype.sourceContentFor =
    function SourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
      if (!this.sourcesContent) {
        return null;
      }

      if (this.sourceRoot != null) {
        aSource = util.relative(this.sourceRoot, aSource);
      }

      if (this._sources.has(aSource)) {
        return this.sourcesContent[this._sources.indexOf(aSource)];
      }

      var url;
      if (this.sourceRoot != null
          && (url = util.urlParse(this.sourceRoot))) {
        // XXX: file:// URIs and absolute paths lead to unexpected behavior for
        // many users. We can help them out when they expect file:// URIs to
        // behave like it would if they were running a local HTTP server. See
        // https://bugzilla.mozilla.org/show_bug.cgi?id=885597.
        var fileUriAbsPath = aSource.replace(/^file:\/\//, "");
        if (url.scheme == "file"
            && this._sources.has(fileUriAbsPath)) {
          return this.sourcesContent[this._sources.indexOf(fileUriAbsPath)]
        }

        if ((!url.path || url.path == "/")
            && this._sources.has("/" + aSource)) {
          return this.sourcesContent[this._sources.indexOf("/" + aSource)];
        }
      }

      // This function is used recursively from
      // IndexedSourceMapConsumer.prototype.sourceContentFor. In that case, we
      // don't want to throw if we can't find the source - we just want to
      // return null, so we provide a flag to exit gracefully.
      if (nullOnMissing) {
        return null;
      }
      else {
        throw new Error('"' + aSource + '" is not in the SourceMap.');
      }
    };

  /**
   * Returns the generated line and column information for the original source,
   * line, and column positions provided. The only argument is an object with
   * the following properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.
   *   - column: The column number in the original source.
   *   - bias: Either 'SourceMapConsumer.GREATEST_LOWER_BOUND' or
   *     'SourceMapConsumer.LEAST_UPPER_BOUND'. Specifies whether to return the
   *     closest element that is smaller than or greater than the one we are
   *     searching for, respectively, if the exact element cannot be found.
   *     Defaults to 'SourceMapConsumer.GREATEST_LOWER_BOUND'.
   *
   * and an object is returned with the following properties:
   *
   *   - line: The line number in the generated source, or null.
   *   - column: The column number in the generated source, or null.
   */
  BasicSourceMapConsumer.prototype.generatedPositionFor =
    function SourceMapConsumer_generatedPositionFor(aArgs) {
      var source = util.getArg(aArgs, 'source');
      if (this.sourceRoot != null) {
        source = util.relative(this.sourceRoot, source);
      }
      if (!this._sources.has(source)) {
        return {
          line: null,
          column: null,
          lastColumn: null
        };
      }
      source = this._sources.indexOf(source);

      var needle = {
        source: source,
        originalLine: util.getArg(aArgs, 'line'),
        originalColumn: util.getArg(aArgs, 'column')
      };

      var index = this._findMapping(
        needle,
        this._originalMappings,
        "originalLine",
        "originalColumn",
        util.compareByOriginalPositions,
        util.getArg(aArgs, 'bias', SourceMapConsumer.GREATEST_LOWER_BOUND)
      );

      if (index >= 0) {
        var mapping = this._originalMappings[index];

        if (mapping.source === needle.source) {
          return {
            line: util.getArg(mapping, 'generatedLine', null),
            column: util.getArg(mapping, 'generatedColumn', null),
            lastColumn: util.getArg(mapping, 'lastGeneratedColumn', null)
          };
        }
      }

      return {
        line: null,
        column: null,
        lastColumn: null
      };
    };

  exports.BasicSourceMapConsumer = BasicSourceMapConsumer;

  /**
   * An IndexedSourceMapConsumer instance represents a parsed source map which
   * we can query for information. It differs from BasicSourceMapConsumer in
   * that it takes "indexed" source maps (i.e. ones with a "sections" field) as
   * input.
   *
   * The only parameter is a raw source map (either as a JSON string, or already
   * parsed to an object). According to the spec for indexed source maps, they
   * have the following attributes:
   *
   *   - version: Which version of the source map spec this map is following.
   *   - file: Optional. The generated file this source map is associated with.
   *   - sections: A list of section definitions.
   *
   * Each value under the "sections" field has two fields:
   *   - offset: The offset into the original specified at which this section
   *       begins to apply, defined as an object with a "line" and "column"
   *       field.
   *   - map: A source map definition. This source map could also be indexed,
   *       but doesn't have to be.
   *
   * Instead of the "map" field, it's also possible to have a "url" field
   * specifying a URL to retrieve a source map from, but that's currently
   * unsupported.
   *
   * Here's an example source map, taken from the source map spec[0], but
   * modified to omit a section which uses the "url" field.
   *
   *  {
   *    version : 3,
   *    file: "app.js",
   *    sections: [{
   *      offset: {line:100, column:10},
   *      map: {
   *        version : 3,
   *        file: "section.js",
   *        sources: ["foo.js", "bar.js"],
   *        names: ["src", "maps", "are", "fun"],
   *        mappings: "AAAA,E;;ABCDE;"
   *      }
   *    }],
   *  }
   *
   * [0]: https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit#heading=h.535es3xeprgt
   */
  function IndexedSourceMapConsumer(aSourceMap) {
    var sourceMap = aSourceMap;
    if (typeof aSourceMap === 'string') {
      sourceMap = JSON.parse(aSourceMap.replace(/^\)\]\}'/, ''));
    }

    var version = util.getArg(sourceMap, 'version');
    var sections = util.getArg(sourceMap, 'sections');

    if (version != this._version) {
      throw new Error('Unsupported version: ' + version);
    }

    this._sources = new ArraySet();
    this._names = new ArraySet();

    var lastOffset = {
      line: -1,
      column: 0
    };
    this._sections = sections.map(function (s) {
      if (s.url) {
        // The url field will require support for asynchronicity.
        // See https://github.com/mozilla/source-map/issues/16
        throw new Error('Support for url field in sections not implemented.');
      }
      var offset = util.getArg(s, 'offset');
      var offsetLine = util.getArg(offset, 'line');
      var offsetColumn = util.getArg(offset, 'column');

      if (offsetLine < lastOffset.line ||
          (offsetLine === lastOffset.line && offsetColumn < lastOffset.column)) {
        throw new Error('Section offsets must be ordered and non-overlapping.');
      }
      lastOffset = offset;

      return {
        generatedOffset: {
          // The offset fields are 0-based, but we use 1-based indices when
          // encoding/decoding from VLQ.
          generatedLine: offsetLine + 1,
          generatedColumn: offsetColumn + 1
        },
        consumer: new SourceMapConsumer(util.getArg(s, 'map'))
      }
    });
  }

  IndexedSourceMapConsumer.prototype = Object.create(SourceMapConsumer.prototype);
  IndexedSourceMapConsumer.prototype.constructor = SourceMapConsumer;

  /**
   * The version of the source mapping spec that we are consuming.
   */
  IndexedSourceMapConsumer.prototype._version = 3;

  /**
   * The list of original sources.
   */
  Object.defineProperty(IndexedSourceMapConsumer.prototype, 'sources', {
    get: function () {
      var sources = [];
      for (var i = 0; i < this._sections.length; i++) {
        for (var j = 0; j < this._sections[i].consumer.sources.length; j++) {
          sources.push(this._sections[i].consumer.sources[j]);
        }
      };
      return sources;
    }
  });

  /**
   * Returns the original source, line, and column information for the generated
   * source's line and column positions provided. The only argument is an object
   * with the following properties:
   *
   *   - line: The line number in the generated source.
   *   - column: The column number in the generated source.
   *
   * and an object is returned with the following properties:
   *
   *   - source: The original source file, or null.
   *   - line: The line number in the original source, or null.
   *   - column: The column number in the original source, or null.
   *   - name: The original identifier, or null.
   */
  IndexedSourceMapConsumer.prototype.originalPositionFor =
    function IndexedSourceMapConsumer_originalPositionFor(aArgs) {
      var needle = {
        generatedLine: util.getArg(aArgs, 'line'),
        generatedColumn: util.getArg(aArgs, 'column')
      };

      // Find the section containing the generated position we're trying to map
      // to an original position.
      var sectionIndex = binarySearch.search(needle, this._sections,
        function(needle, section) {
          var cmp = needle.generatedLine - section.generatedOffset.generatedLine;
          if (cmp) {
            return cmp;
          }

          return (needle.generatedColumn -
                  section.generatedOffset.generatedColumn);
        });
      var section = this._sections[sectionIndex];

      if (!section) {
        return {
          source: null,
          line: null,
          column: null,
          name: null
        };
      }

      return section.consumer.originalPositionFor({
        line: needle.generatedLine -
          (section.generatedOffset.generatedLine - 1),
        column: needle.generatedColumn -
          (section.generatedOffset.generatedLine === needle.generatedLine
           ? section.generatedOffset.generatedColumn - 1
           : 0),
        bias: aArgs.bias
      });
    };

  /**
   * Return true if we have the source content for every source in the source
   * map, false otherwise.
   */
  IndexedSourceMapConsumer.prototype.hasContentsOfAllSources =
    function IndexedSourceMapConsumer_hasContentsOfAllSources() {
      return this._sections.every(function (s) {
        return s.consumer.hasContentsOfAllSources();
      });
    };

  /**
   * Returns the original source content. The only argument is the url of the
   * original source file. Returns null if no original source content is
   * available.
   */
  IndexedSourceMapConsumer.prototype.sourceContentFor =
    function IndexedSourceMapConsumer_sourceContentFor(aSource, nullOnMissing) {
      for (var i = 0; i < this._sections.length; i++) {
        var section = this._sections[i];

        var content = section.consumer.sourceContentFor(aSource, true);
        if (content) {
          return content;
        }
      }
      if (nullOnMissing) {
        return null;
      }
      else {
        throw new Error('"' + aSource + '" is not in the SourceMap.');
      }
    };

  /**
   * Returns the generated line and column information for the original source,
   * line, and column positions provided. The only argument is an object with
   * the following properties:
   *
   *   - source: The filename of the original source.
   *   - line: The line number in the original source.
   *   - column: The column number in the original source.
   *
   * and an object is returned with the following properties:
   *
   *   - line: The line number in the generated source, or null.
   *   - column: The column number in the generated source, or null.
   */
  IndexedSourceMapConsumer.prototype.generatedPositionFor =
    function IndexedSourceMapConsumer_generatedPositionFor(aArgs) {
      for (var i = 0; i < this._sections.length; i++) {
        var section = this._sections[i];

        // Only consider this section if the requested source is in the list of
        // sources of the consumer.
        if (section.consumer.sources.indexOf(util.getArg(aArgs, 'source')) === -1) {
          continue;
        }
        var generatedPosition = section.consumer.generatedPositionFor(aArgs);
        if (generatedPosition) {
          var ret = {
            line: generatedPosition.line +
              (section.generatedOffset.generatedLine - 1),
            column: generatedPosition.column +
              (section.generatedOffset.generatedLine === generatedPosition.line
               ? section.generatedOffset.generatedColumn - 1
               : 0)
          };
          return ret;
        }
      }

      return {
        line: null,
        column: null
      };
    };

  /**
   * Parse the mappings in a string in to a data structure which we can easily
   * query (the ordered arrays in the `this.__generatedMappings` and
   * `this.__originalMappings` properties).
   */
  IndexedSourceMapConsumer.prototype._parseMappings =
    function IndexedSourceMapConsumer_parseMappings(aStr, aSourceRoot) {
      this.__generatedMappings = [];
      this.__originalMappings = [];
      for (var i = 0; i < this._sections.length; i++) {
        var section = this._sections[i];
        var sectionMappings = section.consumer._generatedMappings;
        for (var j = 0; j < sectionMappings.length; j++) {
          var mapping = sectionMappings[i];

          var source = section.consumer._sources.at(mapping.source);
          if (section.consumer.sourceRoot !== null) {
            source = util.join(section.consumer.sourceRoot, source);
          }
          this._sources.add(source);
          source = this._sources.indexOf(source);

          var name = section.consumer._names.at(mapping.name);
          this._names.add(name);
          name = this._names.indexOf(name);

          // The mappings coming from the consumer for the section have
          // generated positions relative to the start of the section, so we
          // need to offset them to be relative to the start of the concatenated
          // generated file.
          var adjustedMapping = {
            source: source,
            generatedLine: mapping.generatedLine +
              (section.generatedOffset.generatedLine - 1),
            generatedColumn: mapping.column +
              (section.generatedOffset.generatedLine === mapping.generatedLine)
              ? section.generatedOffset.generatedColumn - 1
              : 0,
            originalLine: mapping.originalLine,
            originalColumn: mapping.originalColumn,
            name: name
          };

          this.__generatedMappings.push(adjustedMapping);
          if (typeof adjustedMapping.originalLine === 'number') {
            this.__originalMappings.push(adjustedMapping);
          }
        };
      };

      quickSort(this.__generatedMappings, util.compareByGeneratedPositionsDeflated);
      quickSort(this.__originalMappings, util.compareByOriginalPositions);
    };

  exports.IndexedSourceMapConsumer = IndexedSourceMapConsumer;

});

},{"./array-set":41,"./base64-vlq":42,"./binary-search":44,"./quick-sort":46,"./util":50,"amdefine":51}],48:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var base64VLQ = require('./base64-vlq');
  var util = require('./util');
  var ArraySet = require('./array-set').ArraySet;
  var MappingList = require('./mapping-list').MappingList;

  /**
   * An instance of the SourceMapGenerator represents a source map which is
   * being built incrementally. You may pass an object with the following
   * properties:
   *
   *   - file: The filename of the generated source.
   *   - sourceRoot: A root for all relative URLs in this source map.
   */
  function SourceMapGenerator(aArgs) {
    if (!aArgs) {
      aArgs = {};
    }
    this._file = util.getArg(aArgs, 'file', null);
    this._sourceRoot = util.getArg(aArgs, 'sourceRoot', null);
    this._skipValidation = util.getArg(aArgs, 'skipValidation', false);
    this._sources = new ArraySet();
    this._names = new ArraySet();
    this._mappings = new MappingList();
    this._sourcesContents = null;
  }

  SourceMapGenerator.prototype._version = 3;

  /**
   * Creates a new SourceMapGenerator based on a SourceMapConsumer
   *
   * @param aSourceMapConsumer The SourceMap.
   */
  SourceMapGenerator.fromSourceMap =
    function SourceMapGenerator_fromSourceMap(aSourceMapConsumer) {
      var sourceRoot = aSourceMapConsumer.sourceRoot;
      var generator = new SourceMapGenerator({
        file: aSourceMapConsumer.file,
        sourceRoot: sourceRoot
      });
      aSourceMapConsumer.eachMapping(function (mapping) {
        var newMapping = {
          generated: {
            line: mapping.generatedLine,
            column: mapping.generatedColumn
          }
        };

        if (mapping.source != null) {
          newMapping.source = mapping.source;
          if (sourceRoot != null) {
            newMapping.source = util.relative(sourceRoot, newMapping.source);
          }

          newMapping.original = {
            line: mapping.originalLine,
            column: mapping.originalColumn
          };

          if (mapping.name != null) {
            newMapping.name = mapping.name;
          }
        }

        generator.addMapping(newMapping);
      });
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          generator.setSourceContent(sourceFile, content);
        }
      });
      return generator;
    };

  /**
   * Add a single mapping from original source line and column to the generated
   * source's line and column for this source map being created. The mapping
   * object should have the following properties:
   *
   *   - generated: An object with the generated line and column positions.
   *   - original: An object with the original line and column positions.
   *   - source: The original source file (relative to the sourceRoot).
   *   - name: An optional original token name for this mapping.
   */
  SourceMapGenerator.prototype.addMapping =
    function SourceMapGenerator_addMapping(aArgs) {
      var generated = util.getArg(aArgs, 'generated');
      var original = util.getArg(aArgs, 'original', null);
      var source = util.getArg(aArgs, 'source', null);
      var name = util.getArg(aArgs, 'name', null);

      if (!this._skipValidation) {
        this._validateMapping(generated, original, source, name);
      }

      if (source != null && !this._sources.has(source)) {
        this._sources.add(source);
      }

      if (name != null && !this._names.has(name)) {
        this._names.add(name);
      }

      this._mappings.add({
        generatedLine: generated.line,
        generatedColumn: generated.column,
        originalLine: original != null && original.line,
        originalColumn: original != null && original.column,
        source: source,
        name: name
      });
    };

  /**
   * Set the source content for a source file.
   */
  SourceMapGenerator.prototype.setSourceContent =
    function SourceMapGenerator_setSourceContent(aSourceFile, aSourceContent) {
      var source = aSourceFile;
      if (this._sourceRoot != null) {
        source = util.relative(this._sourceRoot, source);
      }

      if (aSourceContent != null) {
        // Add the source content to the _sourcesContents map.
        // Create a new _sourcesContents map if the property is null.
        if (!this._sourcesContents) {
          this._sourcesContents = {};
        }
        this._sourcesContents[util.toSetString(source)] = aSourceContent;
      } else if (this._sourcesContents) {
        // Remove the source file from the _sourcesContents map.
        // If the _sourcesContents map is empty, set the property to null.
        delete this._sourcesContents[util.toSetString(source)];
        if (Object.keys(this._sourcesContents).length === 0) {
          this._sourcesContents = null;
        }
      }
    };

  /**
   * Applies the mappings of a sub-source-map for a specific source file to the
   * source map being generated. Each mapping to the supplied source file is
   * rewritten using the supplied source map. Note: The resolution for the
   * resulting mappings is the minimium of this map and the supplied map.
   *
   * @param aSourceMapConsumer The source map to be applied.
   * @param aSourceFile Optional. The filename of the source file.
   *        If omitted, SourceMapConsumer's file property will be used.
   * @param aSourceMapPath Optional. The dirname of the path to the source map
   *        to be applied. If relative, it is relative to the SourceMapConsumer.
   *        This parameter is needed when the two source maps aren't in the same
   *        directory, and the source map to be applied contains relative source
   *        paths. If so, those relative source paths need to be rewritten
   *        relative to the SourceMapGenerator.
   */
  SourceMapGenerator.prototype.applySourceMap =
    function SourceMapGenerator_applySourceMap(aSourceMapConsumer, aSourceFile, aSourceMapPath) {
      var sourceFile = aSourceFile;
      // If aSourceFile is omitted, we will use the file property of the SourceMap
      if (aSourceFile == null) {
        if (aSourceMapConsumer.file == null) {
          throw new Error(
            'SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, ' +
            'or the source map\'s "file" property. Both were omitted.'
          );
        }
        sourceFile = aSourceMapConsumer.file;
      }
      var sourceRoot = this._sourceRoot;
      // Make "sourceFile" relative if an absolute Url is passed.
      if (sourceRoot != null) {
        sourceFile = util.relative(sourceRoot, sourceFile);
      }
      // Applying the SourceMap can add and remove items from the sources and
      // the names array.
      var newSources = new ArraySet();
      var newNames = new ArraySet();

      // Find mappings for the "sourceFile"
      this._mappings.unsortedForEach(function (mapping) {
        if (mapping.source === sourceFile && mapping.originalLine != null) {
          // Check if it can be mapped by the source map, then update the mapping.
          var original = aSourceMapConsumer.originalPositionFor({
            line: mapping.originalLine,
            column: mapping.originalColumn
          });
          if (original.source != null) {
            // Copy mapping
            mapping.source = original.source;
            if (aSourceMapPath != null) {
              mapping.source = util.join(aSourceMapPath, mapping.source)
            }
            if (sourceRoot != null) {
              mapping.source = util.relative(sourceRoot, mapping.source);
            }
            mapping.originalLine = original.line;
            mapping.originalColumn = original.column;
            if (original.name != null) {
              mapping.name = original.name;
            }
          }
        }

        var source = mapping.source;
        if (source != null && !newSources.has(source)) {
          newSources.add(source);
        }

        var name = mapping.name;
        if (name != null && !newNames.has(name)) {
          newNames.add(name);
        }

      }, this);
      this._sources = newSources;
      this._names = newNames;

      // Copy sourcesContents of applied map.
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          if (aSourceMapPath != null) {
            sourceFile = util.join(aSourceMapPath, sourceFile);
          }
          if (sourceRoot != null) {
            sourceFile = util.relative(sourceRoot, sourceFile);
          }
          this.setSourceContent(sourceFile, content);
        }
      }, this);
    };

  /**
   * A mapping can have one of the three levels of data:
   *
   *   1. Just the generated position.
   *   2. The Generated position, original position, and original source.
   *   3. Generated and original position, original source, as well as a name
   *      token.
   *
   * To maintain consistency, we validate that any new mapping being added falls
   * in to one of these categories.
   */
  SourceMapGenerator.prototype._validateMapping =
    function SourceMapGenerator_validateMapping(aGenerated, aOriginal, aSource,
                                                aName) {
      if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
          && aGenerated.line > 0 && aGenerated.column >= 0
          && !aOriginal && !aSource && !aName) {
        // Case 1.
        return;
      }
      else if (aGenerated && 'line' in aGenerated && 'column' in aGenerated
               && aOriginal && 'line' in aOriginal && 'column' in aOriginal
               && aGenerated.line > 0 && aGenerated.column >= 0
               && aOriginal.line > 0 && aOriginal.column >= 0
               && aSource) {
        // Cases 2 and 3.
        return;
      }
      else {
        throw new Error('Invalid mapping: ' + JSON.stringify({
          generated: aGenerated,
          source: aSource,
          original: aOriginal,
          name: aName
        }));
      }
    };

  /**
   * Serialize the accumulated mappings in to the stream of base 64 VLQs
   * specified by the source map format.
   */
  SourceMapGenerator.prototype._serializeMappings =
    function SourceMapGenerator_serializeMappings() {
      var previousGeneratedColumn = 0;
      var previousGeneratedLine = 1;
      var previousOriginalColumn = 0;
      var previousOriginalLine = 0;
      var previousName = 0;
      var previousSource = 0;
      var result = '';
      var mapping;

      var mappings = this._mappings.toArray();
      for (var i = 0, len = mappings.length; i < len; i++) {
        mapping = mappings[i];

        if (mapping.generatedLine !== previousGeneratedLine) {
          previousGeneratedColumn = 0;
          while (mapping.generatedLine !== previousGeneratedLine) {
            result += ';';
            previousGeneratedLine++;
          }
        }
        else {
          if (i > 0) {
            if (!util.compareByGeneratedPositionsInflated(mapping, mappings[i - 1])) {
              continue;
            }
            result += ',';
          }
        }

        result += base64VLQ.encode(mapping.generatedColumn
                                   - previousGeneratedColumn);
        previousGeneratedColumn = mapping.generatedColumn;

        if (mapping.source != null) {
          result += base64VLQ.encode(this._sources.indexOf(mapping.source)
                                     - previousSource);
          previousSource = this._sources.indexOf(mapping.source);

          // lines are stored 0-based in SourceMap spec version 3
          result += base64VLQ.encode(mapping.originalLine - 1
                                     - previousOriginalLine);
          previousOriginalLine = mapping.originalLine - 1;

          result += base64VLQ.encode(mapping.originalColumn
                                     - previousOriginalColumn);
          previousOriginalColumn = mapping.originalColumn;

          if (mapping.name != null) {
            result += base64VLQ.encode(this._names.indexOf(mapping.name)
                                       - previousName);
            previousName = this._names.indexOf(mapping.name);
          }
        }
      }

      return result;
    };

  SourceMapGenerator.prototype._generateSourcesContent =
    function SourceMapGenerator_generateSourcesContent(aSources, aSourceRoot) {
      return aSources.map(function (source) {
        if (!this._sourcesContents) {
          return null;
        }
        if (aSourceRoot != null) {
          source = util.relative(aSourceRoot, source);
        }
        var key = util.toSetString(source);
        return Object.prototype.hasOwnProperty.call(this._sourcesContents,
                                                    key)
          ? this._sourcesContents[key]
          : null;
      }, this);
    };

  /**
   * Externalize the source map.
   */
  SourceMapGenerator.prototype.toJSON =
    function SourceMapGenerator_toJSON() {
      var map = {
        version: this._version,
        sources: this._sources.toArray(),
        names: this._names.toArray(),
        mappings: this._serializeMappings()
      };
      if (this._file != null) {
        map.file = this._file;
      }
      if (this._sourceRoot != null) {
        map.sourceRoot = this._sourceRoot;
      }
      if (this._sourcesContents) {
        map.sourcesContent = this._generateSourcesContent(map.sources, map.sourceRoot);
      }

      return map;
    };

  /**
   * Render the source map being generated to a string.
   */
  SourceMapGenerator.prototype.toString =
    function SourceMapGenerator_toString() {
      return JSON.stringify(this.toJSON());
    };

  exports.SourceMapGenerator = SourceMapGenerator;

});

},{"./array-set":41,"./base64-vlq":42,"./mapping-list":45,"./util":50,"amdefine":51}],49:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  var SourceMapGenerator = require('./source-map-generator').SourceMapGenerator;
  var util = require('./util');

  // Matches a Windows-style `\r\n` newline or a `\n` newline used by all other
  // operating systems these days (capturing the result).
  var REGEX_NEWLINE = /(\r?\n)/;

  // Newline character code for charCodeAt() comparisons
  var NEWLINE_CODE = 10;

  // Private symbol for identifying `SourceNode`s when multiple versions of
  // the source-map library are loaded. This MUST NOT CHANGE across
  // versions!
  var isSourceNode = "$$$isSourceNode$$$";

  /**
   * SourceNodes provide a way to abstract over interpolating/concatenating
   * snippets of generated JavaScript source code while maintaining the line and
   * column information associated with the original source code.
   *
   * @param aLine The original line number.
   * @param aColumn The original column number.
   * @param aSource The original source's filename.
   * @param aChunks Optional. An array of strings which are snippets of
   *        generated JS, or other SourceNodes.
   * @param aName The original identifier.
   */
  function SourceNode(aLine, aColumn, aSource, aChunks, aName) {
    this.children = [];
    this.sourceContents = {};
    this.line = aLine == null ? null : aLine;
    this.column = aColumn == null ? null : aColumn;
    this.source = aSource == null ? null : aSource;
    this.name = aName == null ? null : aName;
    this[isSourceNode] = true;
    if (aChunks != null) this.add(aChunks);
  }

  /**
   * Creates a SourceNode from generated code and a SourceMapConsumer.
   *
   * @param aGeneratedCode The generated code
   * @param aSourceMapConsumer The SourceMap for the generated code
   * @param aRelativePath Optional. The path that relative sources in the
   *        SourceMapConsumer should be relative to.
   */
  SourceNode.fromStringWithSourceMap =
    function SourceNode_fromStringWithSourceMap(aGeneratedCode, aSourceMapConsumer, aRelativePath) {
      // The SourceNode we want to fill with the generated code
      // and the SourceMap
      var node = new SourceNode();

      // All even indices of this array are one line of the generated code,
      // while all odd indices are the newlines between two adjacent lines
      // (since `REGEX_NEWLINE` captures its match).
      // Processed fragments are removed from this array, by calling `shiftNextLine`.
      var remainingLines = aGeneratedCode.split(REGEX_NEWLINE);
      var shiftNextLine = function() {
        var lineContents = remainingLines.shift();
        // The last line of a file might not have a newline.
        var newLine = remainingLines.shift() || "";
        return lineContents + newLine;
      };

      // We need to remember the position of "remainingLines"
      var lastGeneratedLine = 1, lastGeneratedColumn = 0;

      // The generate SourceNodes we need a code range.
      // To extract it current and last mapping is used.
      // Here we store the last mapping.
      var lastMapping = null;

      aSourceMapConsumer.eachMapping(function (mapping) {
        if (lastMapping !== null) {
          // We add the code from "lastMapping" to "mapping":
          // First check if there is a new line in between.
          if (lastGeneratedLine < mapping.generatedLine) {
            var code = "";
            // Associate first line with "lastMapping"
            addMappingWithCode(lastMapping, shiftNextLine());
            lastGeneratedLine++;
            lastGeneratedColumn = 0;
            // The remaining code is added without mapping
          } else {
            // There is no new line in between.
            // Associate the code between "lastGeneratedColumn" and
            // "mapping.generatedColumn" with "lastMapping"
            var nextLine = remainingLines[0];
            var code = nextLine.substr(0, mapping.generatedColumn -
                                          lastGeneratedColumn);
            remainingLines[0] = nextLine.substr(mapping.generatedColumn -
                                                lastGeneratedColumn);
            lastGeneratedColumn = mapping.generatedColumn;
            addMappingWithCode(lastMapping, code);
            // No more remaining code, continue
            lastMapping = mapping;
            return;
          }
        }
        // We add the generated code until the first mapping
        // to the SourceNode without any mapping.
        // Each line is added as separate string.
        while (lastGeneratedLine < mapping.generatedLine) {
          node.add(shiftNextLine());
          lastGeneratedLine++;
        }
        if (lastGeneratedColumn < mapping.generatedColumn) {
          var nextLine = remainingLines[0];
          node.add(nextLine.substr(0, mapping.generatedColumn));
          remainingLines[0] = nextLine.substr(mapping.generatedColumn);
          lastGeneratedColumn = mapping.generatedColumn;
        }
        lastMapping = mapping;
      }, this);
      // We have processed all mappings.
      if (remainingLines.length > 0) {
        if (lastMapping) {
          // Associate the remaining code in the current line with "lastMapping"
          addMappingWithCode(lastMapping, shiftNextLine());
        }
        // and add the remaining lines without any mapping
        node.add(remainingLines.join(""));
      }

      // Copy sourcesContent into SourceNode
      aSourceMapConsumer.sources.forEach(function (sourceFile) {
        var content = aSourceMapConsumer.sourceContentFor(sourceFile);
        if (content != null) {
          if (aRelativePath != null) {
            sourceFile = util.join(aRelativePath, sourceFile);
          }
          node.setSourceContent(sourceFile, content);
        }
      });

      return node;

      function addMappingWithCode(mapping, code) {
        if (mapping === null || mapping.source === undefined) {
          node.add(code);
        } else {
          var source = aRelativePath
            ? util.join(aRelativePath, mapping.source)
            : mapping.source;
          node.add(new SourceNode(mapping.originalLine,
                                  mapping.originalColumn,
                                  source,
                                  code,
                                  mapping.name));
        }
      }
    };

  /**
   * Add a chunk of generated JS to this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  SourceNode.prototype.add = function SourceNode_add(aChunk) {
    if (Array.isArray(aChunk)) {
      aChunk.forEach(function (chunk) {
        this.add(chunk);
      }, this);
    }
    else if (aChunk[isSourceNode] || typeof aChunk === "string") {
      if (aChunk) {
        this.children.push(aChunk);
      }
    }
    else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  };

  /**
   * Add a chunk of generated JS to the beginning of this source node.
   *
   * @param aChunk A string snippet of generated JS code, another instance of
   *        SourceNode, or an array where each member is one of those things.
   */
  SourceNode.prototype.prepend = function SourceNode_prepend(aChunk) {
    if (Array.isArray(aChunk)) {
      for (var i = aChunk.length-1; i >= 0; i--) {
        this.prepend(aChunk[i]);
      }
    }
    else if (aChunk[isSourceNode] || typeof aChunk === "string") {
      this.children.unshift(aChunk);
    }
    else {
      throw new TypeError(
        "Expected a SourceNode, string, or an array of SourceNodes and strings. Got " + aChunk
      );
    }
    return this;
  };

  /**
   * Walk over the tree of JS snippets in this node and its children. The
   * walking function is called once for each snippet of JS and is passed that
   * snippet and the its original associated source's line/column location.
   *
   * @param aFn The traversal function.
   */
  SourceNode.prototype.walk = function SourceNode_walk(aFn) {
    var chunk;
    for (var i = 0, len = this.children.length; i < len; i++) {
      chunk = this.children[i];
      if (chunk[isSourceNode]) {
        chunk.walk(aFn);
      }
      else {
        if (chunk !== '') {
          aFn(chunk, { source: this.source,
                       line: this.line,
                       column: this.column,
                       name: this.name });
        }
      }
    }
  };

  /**
   * Like `String.prototype.join` except for SourceNodes. Inserts `aStr` between
   * each of `this.children`.
   *
   * @param aSep The separator.
   */
  SourceNode.prototype.join = function SourceNode_join(aSep) {
    var newChildren;
    var i;
    var len = this.children.length;
    if (len > 0) {
      newChildren = [];
      for (i = 0; i < len-1; i++) {
        newChildren.push(this.children[i]);
        newChildren.push(aSep);
      }
      newChildren.push(this.children[i]);
      this.children = newChildren;
    }
    return this;
  };

  /**
   * Call String.prototype.replace on the very right-most source snippet. Useful
   * for trimming whitespace from the end of a source node, etc.
   *
   * @param aPattern The pattern to replace.
   * @param aReplacement The thing to replace the pattern with.
   */
  SourceNode.prototype.replaceRight = function SourceNode_replaceRight(aPattern, aReplacement) {
    var lastChild = this.children[this.children.length - 1];
    if (lastChild[isSourceNode]) {
      lastChild.replaceRight(aPattern, aReplacement);
    }
    else if (typeof lastChild === 'string') {
      this.children[this.children.length - 1] = lastChild.replace(aPattern, aReplacement);
    }
    else {
      this.children.push(''.replace(aPattern, aReplacement));
    }
    return this;
  };

  /**
   * Set the source content for a source file. This will be added to the SourceMapGenerator
   * in the sourcesContent field.
   *
   * @param aSourceFile The filename of the source file
   * @param aSourceContent The content of the source file
   */
  SourceNode.prototype.setSourceContent =
    function SourceNode_setSourceContent(aSourceFile, aSourceContent) {
      this.sourceContents[util.toSetString(aSourceFile)] = aSourceContent;
    };

  /**
   * Walk over the tree of SourceNodes. The walking function is called for each
   * source file content and is passed the filename and source content.
   *
   * @param aFn The traversal function.
   */
  SourceNode.prototype.walkSourceContents =
    function SourceNode_walkSourceContents(aFn) {
      for (var i = 0, len = this.children.length; i < len; i++) {
        if (this.children[i][isSourceNode]) {
          this.children[i].walkSourceContents(aFn);
        }
      }

      var sources = Object.keys(this.sourceContents);
      for (var i = 0, len = sources.length; i < len; i++) {
        aFn(util.fromSetString(sources[i]), this.sourceContents[sources[i]]);
      }
    };

  /**
   * Return the string representation of this source node. Walks over the tree
   * and concatenates all the various snippets together to one string.
   */
  SourceNode.prototype.toString = function SourceNode_toString() {
    var str = "";
    this.walk(function (chunk) {
      str += chunk;
    });
    return str;
  };

  /**
   * Returns the string representation of this source node along with a source
   * map.
   */
  SourceNode.prototype.toStringWithSourceMap = function SourceNode_toStringWithSourceMap(aArgs) {
    var generated = {
      code: "",
      line: 1,
      column: 0
    };
    var map = new SourceMapGenerator(aArgs);
    var sourceMappingActive = false;
    var lastOriginalSource = null;
    var lastOriginalLine = null;
    var lastOriginalColumn = null;
    var lastOriginalName = null;
    this.walk(function (chunk, original) {
      generated.code += chunk;
      if (original.source !== null
          && original.line !== null
          && original.column !== null) {
        if(lastOriginalSource !== original.source
           || lastOriginalLine !== original.line
           || lastOriginalColumn !== original.column
           || lastOriginalName !== original.name) {
          map.addMapping({
            source: original.source,
            original: {
              line: original.line,
              column: original.column
            },
            generated: {
              line: generated.line,
              column: generated.column
            },
            name: original.name
          });
        }
        lastOriginalSource = original.source;
        lastOriginalLine = original.line;
        lastOriginalColumn = original.column;
        lastOriginalName = original.name;
        sourceMappingActive = true;
      } else if (sourceMappingActive) {
        map.addMapping({
          generated: {
            line: generated.line,
            column: generated.column
          }
        });
        lastOriginalSource = null;
        sourceMappingActive = false;
      }
      for (var idx = 0, length = chunk.length; idx < length; idx++) {
        if (chunk.charCodeAt(idx) === NEWLINE_CODE) {
          generated.line++;
          generated.column = 0;
          // Mappings end at eol
          if (idx + 1 === length) {
            lastOriginalSource = null;
            sourceMappingActive = false;
          } else if (sourceMappingActive) {
            map.addMapping({
              source: original.source,
              original: {
                line: original.line,
                column: original.column
              },
              generated: {
                line: generated.line,
                column: generated.column
              },
              name: original.name
            });
          }
        } else {
          generated.column++;
        }
      }
    });
    this.walkSourceContents(function (sourceFile, sourceContent) {
      map.setSourceContent(sourceFile, sourceContent);
    });

    return { code: generated.code, map: map };
  };

  exports.SourceNode = SourceNode;

});

},{"./source-map-generator":48,"./util":50,"amdefine":51}],50:[function(require,module,exports){
/* -*- Mode: js; js-indent-level: 2; -*- */
/*
 * Copyright 2011 Mozilla Foundation and contributors
 * Licensed under the New BSD license. See LICENSE or:
 * http://opensource.org/licenses/BSD-3-Clause
 */
if (typeof define !== 'function') {
    var define = require('amdefine')(module, require);
}
define(function (require, exports, module) {

  /**
   * This is a helper function for getting values from parameter/options
   * objects.
   *
   * @param args The object we are extracting values from
   * @param name The name of the property we are getting.
   * @param defaultValue An optional value to return if the property is missing
   * from the object. If this is not specified and the property is missing, an
   * error will be thrown.
   */
  function getArg(aArgs, aName, aDefaultValue) {
    if (aName in aArgs) {
      return aArgs[aName];
    } else if (arguments.length === 3) {
      return aDefaultValue;
    } else {
      throw new Error('"' + aName + '" is a required argument.');
    }
  }
  exports.getArg = getArg;

  var urlRegexp = /^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.]*)(?::(\d+))?(\S*)$/;
  var dataUrlRegexp = /^data:.+\,.+$/;

  function urlParse(aUrl) {
    var match = aUrl.match(urlRegexp);
    if (!match) {
      return null;
    }
    return {
      scheme: match[1],
      auth: match[2],
      host: match[3],
      port: match[4],
      path: match[5]
    };
  }
  exports.urlParse = urlParse;

  function urlGenerate(aParsedUrl) {
    var url = '';
    if (aParsedUrl.scheme) {
      url += aParsedUrl.scheme + ':';
    }
    url += '//';
    if (aParsedUrl.auth) {
      url += aParsedUrl.auth + '@';
    }
    if (aParsedUrl.host) {
      url += aParsedUrl.host;
    }
    if (aParsedUrl.port) {
      url += ":" + aParsedUrl.port
    }
    if (aParsedUrl.path) {
      url += aParsedUrl.path;
    }
    return url;
  }
  exports.urlGenerate = urlGenerate;

  /**
   * Normalizes a path, or the path portion of a URL:
   *
   * - Replaces consequtive slashes with one slash.
   * - Removes unnecessary '.' parts.
   * - Removes unnecessary '<dir>/..' parts.
   *
   * Based on code in the Node.js 'path' core module.
   *
   * @param aPath The path or url to normalize.
   */
  function normalize(aPath) {
    var path = aPath;
    var url = urlParse(aPath);
    if (url) {
      if (!url.path) {
        return aPath;
      }
      path = url.path;
    }
    var isAbsolute = (path.charAt(0) === '/');

    var parts = path.split(/\/+/);
    for (var part, up = 0, i = parts.length - 1; i >= 0; i--) {
      part = parts[i];
      if (part === '.') {
        parts.splice(i, 1);
      } else if (part === '..') {
        up++;
      } else if (up > 0) {
        if (part === '') {
          // The first part is blank if the path is absolute. Trying to go
          // above the root is a no-op. Therefore we can remove all '..' parts
          // directly after the root.
          parts.splice(i + 1, up);
          up = 0;
        } else {
          parts.splice(i, 2);
          up--;
        }
      }
    }
    path = parts.join('/');

    if (path === '') {
      path = isAbsolute ? '/' : '.';
    }

    if (url) {
      url.path = path;
      return urlGenerate(url);
    }
    return path;
  }
  exports.normalize = normalize;

  /**
   * Joins two paths/URLs.
   *
   * @param aRoot The root path or URL.
   * @param aPath The path or URL to be joined with the root.
   *
   * - If aPath is a URL or a data URI, aPath is returned, unless aPath is a
   *   scheme-relative URL: Then the scheme of aRoot, if any, is prepended
   *   first.
   * - Otherwise aPath is a path. If aRoot is a URL, then its path portion
   *   is updated with the result and aRoot is returned. Otherwise the result
   *   is returned.
   *   - If aPath is absolute, the result is aPath.
   *   - Otherwise the two paths are joined with a slash.
   * - Joining for example 'http://' and 'www.example.com' is also supported.
   */
  function join(aRoot, aPath) {
    if (aRoot === "") {
      aRoot = ".";
    }
    if (aPath === "") {
      aPath = ".";
    }
    var aPathUrl = urlParse(aPath);
    var aRootUrl = urlParse(aRoot);
    if (aRootUrl) {
      aRoot = aRootUrl.path || '/';
    }

    // `join(foo, '//www.example.org')`
    if (aPathUrl && !aPathUrl.scheme) {
      if (aRootUrl) {
        aPathUrl.scheme = aRootUrl.scheme;
      }
      return urlGenerate(aPathUrl);
    }

    if (aPathUrl || aPath.match(dataUrlRegexp)) {
      return aPath;
    }

    // `join('http://', 'www.example.com')`
    if (aRootUrl && !aRootUrl.host && !aRootUrl.path) {
      aRootUrl.host = aPath;
      return urlGenerate(aRootUrl);
    }

    var joined = aPath.charAt(0) === '/'
      ? aPath
      : normalize(aRoot.replace(/\/+$/, '') + '/' + aPath);

    if (aRootUrl) {
      aRootUrl.path = joined;
      return urlGenerate(aRootUrl);
    }
    return joined;
  }
  exports.join = join;

  /**
   * Make a path relative to a URL or another path.
   *
   * @param aRoot The root path or URL.
   * @param aPath The path or URL to be made relative to aRoot.
   */
  function relative(aRoot, aPath) {
    if (aRoot === "") {
      aRoot = ".";
    }

    aRoot = aRoot.replace(/\/$/, '');

    // It is possible for the path to be above the root. In this case, simply
    // checking whether the root is a prefix of the path won't work. Instead, we
    // need to remove components from the root one by one, until either we find
    // a prefix that fits, or we run out of components to remove.
    var level = 0;
    while (aPath.indexOf(aRoot + '/') !== 0) {
      var index = aRoot.lastIndexOf("/");
      if (index < 0) {
        return aPath;
      }

      // If the only part of the root that is left is the scheme (i.e. http://,
      // file:///, etc.), one or more slashes (/), or simply nothing at all, we
      // have exhausted all components, so the path is not relative to the root.
      aRoot = aRoot.slice(0, index);
      if (aRoot.match(/^([^\/]+:\/)?\/*$/)) {
        return aPath;
      }

      ++level;
    }

    // Make sure we add a "../" for each component we removed from the root.
    return Array(level + 1).join("../") + aPath.substr(aRoot.length + 1);
  }
  exports.relative = relative;

  /**
   * Because behavior goes wacky when you set `__proto__` on objects, we
   * have to prefix all the strings in our set with an arbitrary character.
   *
   * See https://github.com/mozilla/source-map/pull/31 and
   * https://github.com/mozilla/source-map/issues/30
   *
   * @param String aStr
   */
  function toSetString(aStr) {
    return '$' + aStr;
  }
  exports.toSetString = toSetString;

  function fromSetString(aStr) {
    return aStr.substr(1);
  }
  exports.fromSetString = fromSetString;

  /**
   * Comparator between two mappings where the original positions are compared.
   *
   * Optionally pass in `true` as `onlyCompareGenerated` to consider two
   * mappings with the same original source/line/column, but different generated
   * line and column the same. Useful when searching for a mapping with a
   * stubbed out mapping.
   */
  function compareByOriginalPositions(mappingA, mappingB, onlyCompareOriginal) {
    var cmp = mappingA.source - mappingB.source;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0 || onlyCompareOriginal) {
      return cmp;
    }

    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp !== 0) {
      return cmp;
    }

    return mappingA.name - mappingB.name;
  };
  exports.compareByOriginalPositions = compareByOriginalPositions;

  /**
   * Comparator between two mappings with deflated source and name indices where
   * the generated positions are compared.
   *
   * Optionally pass in `true` as `onlyCompareGenerated` to consider two
   * mappings with the same generated line and column, but different
   * source/name/original line and column the same. Useful when searching for a
   * mapping with a stubbed out mapping.
   */
  function compareByGeneratedPositionsDeflated(mappingA, mappingB, onlyCompareGenerated) {
    var cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0 || onlyCompareGenerated) {
      return cmp;
    }

    cmp = mappingA.source - mappingB.source;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0) {
      return cmp;
    }

    return mappingA.name - mappingB.name;
  };
  exports.compareByGeneratedPositionsDeflated = compareByGeneratedPositionsDeflated;

  function strcmp(aStr1, aStr2) {
    if (aStr1 === aStr2) {
      return 0;
    }

    if (aStr1 > aStr2) {
      return 1;
    }

    return -1;
  }

  /**
   * Comparator between two mappings with inflated source and name strings where
   * the generated positions are compared.
   */
  function compareByGeneratedPositionsInflated(mappingA, mappingB) {
    var cmp = mappingA.generatedLine - mappingB.generatedLine;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.generatedColumn - mappingB.generatedColumn;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = strcmp(mappingA.source, mappingB.source);
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.originalLine - mappingB.originalLine;
    if (cmp !== 0) {
      return cmp;
    }

    cmp = mappingA.originalColumn - mappingB.originalColumn;
    if (cmp !== 0) {
      return cmp;
    }

    return strcmp(mappingA.name, mappingB.name);
  };
  exports.compareByGeneratedPositionsInflated = compareByGeneratedPositionsInflated;

});

},{"amdefine":51}],51:[function(require,module,exports){
(function (process,__filename){
/** vim: et:ts=4:sw=4:sts=4
 * @license amdefine 1.0.0 Copyright (c) 2011-2015, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/amdefine for details
 */

/*jslint node: true */
/*global module, process */
'use strict';

/**
 * Creates a define for node.
 * @param {Object} module the "module" object that is defined by Node for the
 * current module.
 * @param {Function} [requireFn]. Node's require function for the current module.
 * It only needs to be passed in Node versions before 0.5, when module.require
 * did not exist.
 * @returns {Function} a define function that is usable for the current node
 * module.
 */
function amdefine(module, requireFn) {
    'use strict';
    var defineCache = {},
        loaderCache = {},
        alreadyCalled = false,
        path = require('path'),
        makeRequire, stringRequire;

    /**
     * Trims the . and .. from an array of path segments.
     * It will keep a leading path segment if a .. will become
     * the first path segment, to help with module name lookups,
     * which act like paths, but can be remapped. But the end result,
     * all paths that use this function should look normalized.
     * NOTE: this method MODIFIES the input array.
     * @param {Array} ary the array of path segments.
     */
    function trimDots(ary) {
        var i, part;
        for (i = 0; ary[i]; i+= 1) {
            part = ary[i];
            if (part === '.') {
                ary.splice(i, 1);
                i -= 1;
            } else if (part === '..') {
                if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                    //End of the line. Keep at least one non-dot
                    //path segment at the front so it can be mapped
                    //correctly to disk. Otherwise, there is likely
                    //no path mapping for a path starting with '..'.
                    //This can still fail, but catches the most reasonable
                    //uses of ..
                    break;
                } else if (i > 0) {
                    ary.splice(i - 1, 2);
                    i -= 2;
                }
            }
        }
    }

    function normalize(name, baseName) {
        var baseParts;

        //Adjust any relative paths.
        if (name && name.charAt(0) === '.') {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                baseParts = baseName.split('/');
                baseParts = baseParts.slice(0, baseParts.length - 1);
                baseParts = baseParts.concat(name.split('/'));
                trimDots(baseParts);
                name = baseParts.join('/');
            }
        }

        return name;
    }

    /**
     * Create the normalize() function passed to a loader plugin's
     * normalize method.
     */
    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(id) {
        function load(value) {
            loaderCache[id] = value;
        }

        load.fromText = function (id, text) {
            //This one is difficult because the text can/probably uses
            //define, and any relative paths and requires should be relative
            //to that id was it would be found on disk. But this would require
            //bootstrapping a module/require fairly deeply from node core.
            //Not sure how best to go about that yet.
            throw new Error('amdefine does not implement load.fromText');
        };

        return load;
    }

    makeRequire = function (systemRequire, exports, module, relId) {
        function amdRequire(deps, callback) {
            if (typeof deps === 'string') {
                //Synchronous, single module require('')
                return stringRequire(systemRequire, exports, module, deps, relId);
            } else {
                //Array of dependencies with a callback.

                //Convert the dependencies to modules.
                deps = deps.map(function (depName) {
                    return stringRequire(systemRequire, exports, module, depName, relId);
                });

                //Wait for next tick to call back the require call.
                if (callback) {
                    process.nextTick(function () {
                        callback.apply(null, deps);
                    });
                }
            }
        }

        amdRequire.toUrl = function (filePath) {
            if (filePath.indexOf('.') === 0) {
                return normalize(filePath, path.dirname(module.filename));
            } else {
                return filePath;
            }
        };

        return amdRequire;
    };

    //Favor explicit value, passed in if the module wants to support Node 0.4.
    requireFn = requireFn || function req() {
        return module.require.apply(module, arguments);
    };

    function runFactory(id, deps, factory) {
        var r, e, m, result;

        if (id) {
            e = loaderCache[id] = {};
            m = {
                id: id,
                uri: __filename,
                exports: e
            };
            r = makeRequire(requireFn, e, m, id);
        } else {
            //Only support one define call per file
            if (alreadyCalled) {
                throw new Error('amdefine with no module ID cannot be called more than once per file.');
            }
            alreadyCalled = true;

            //Use the real variables from node
            //Use module.exports for exports, since
            //the exports in here is amdefine exports.
            e = module.exports;
            m = module;
            r = makeRequire(requireFn, e, m, module.id);
        }

        //If there are dependencies, they are strings, so need
        //to convert them to dependency values.
        if (deps) {
            deps = deps.map(function (depName) {
                return r(depName);
            });
        }

        //Call the factory with the right dependencies.
        if (typeof factory === 'function') {
            result = factory.apply(m.exports, deps);
        } else {
            result = factory;
        }

        if (result !== undefined) {
            m.exports = result;
            if (id) {
                loaderCache[id] = m.exports;
            }
        }
    }

    stringRequire = function (systemRequire, exports, module, id, relId) {
        //Split the ID by a ! so that
        var index = id.indexOf('!'),
            originalId = id,
            prefix, plugin;

        if (index === -1) {
            id = normalize(id, relId);

            //Straight module lookup. If it is one of the special dependencies,
            //deal with it, otherwise, delegate to node.
            if (id === 'require') {
                return makeRequire(systemRequire, exports, module, relId);
            } else if (id === 'exports') {
                return exports;
            } else if (id === 'module') {
                return module;
            } else if (loaderCache.hasOwnProperty(id)) {
                return loaderCache[id];
            } else if (defineCache[id]) {
                runFactory.apply(null, defineCache[id]);
                return loaderCache[id];
            } else {
                if(systemRequire) {
                    return systemRequire(originalId);
                } else {
                    throw new Error('No module with ID: ' + id);
                }
            }
        } else {
            //There is a plugin in play.
            prefix = id.substring(0, index);
            id = id.substring(index + 1, id.length);

            plugin = stringRequire(systemRequire, exports, module, prefix, relId);

            if (plugin.normalize) {
                id = plugin.normalize(id, makeNormalize(relId));
            } else {
                //Normalize the ID normally.
                id = normalize(id, relId);
            }

            if (loaderCache[id]) {
                return loaderCache[id];
            } else {
                plugin.load(id, makeRequire(systemRequire, exports, module, relId), makeLoad(id), {});

                return loaderCache[id];
            }
        }
    };

    //Create a define function specific to the module asking for amdefine.
    function define(id, deps, factory) {
        if (Array.isArray(id)) {
            factory = deps;
            deps = id;
            id = undefined;
        } else if (typeof id !== 'string') {
            factory = id;
            id = deps = undefined;
        }

        if (deps && !Array.isArray(deps)) {
            factory = deps;
            deps = undefined;
        }

        if (!deps) {
            deps = ['require', 'exports', 'module'];
        }

        //Set up properties for this module. If an ID, then use
        //internal cache. If no ID, then use the external variables
        //for this node module.
        if (id) {
            //Put the module in deep freeze until there is a
            //require call for it.
            defineCache[id] = [id, deps, factory];
        } else {
            runFactory(id, deps, factory);
        }
    }

    //define.require, which has access to all the values in the
    //cache. Useful for AMD modules that all have IDs in the file,
    //but need to finally export a value to node based on one of those
    //IDs.
    define.require = function (id) {
        if (loaderCache[id]) {
            return loaderCache[id];
        }

        if (defineCache[id]) {
            runFactory.apply(null, defineCache[id]);
            return loaderCache[id];
        }
    };

    define.amd = {};

    return define;
}

module.exports = amdefine;

}).call(this,require('_process'),"/node_modules\\handlebars\\node_modules\\source-map\\node_modules\\amdefine\\amdefine.js")
},{"_process":6,"path":5}],52:[function(require,module,exports){
'use strict';

var dateformat = require('dateformat');

module.exports = function date (format, dt) {
  dt = dt || 'now';
  format = format || 'mmmm dd, yyyy';

  if ((typeof dt === 'string' && dt !== 'now') || typeof dt === 'number') {
    dt = new Date(dt);
  } else {
    dt = new Date();
  }

  return dateformat(dt, format);
};

},{"dateformat":53}],53:[function(require,module,exports){
/*
 * Date Format 1.2.3
 * (c) 2007-2009 Steven Levithan <stevenlevithan.com>
 * MIT license
 *
 * Includes enhancements by Scott Trenda <scott.trenda.net>
 * and Kris Kowal <cixar.com/~kris.kowal/>
 *
 * Accepts a date, a mask, or a date and a mask.
 * Returns a formatted version of the given date.
 * The date defaults to the current date/time.
 * The mask defaults to dateFormat.masks.default.
 */

(function(global) {
  'use strict';

  var dateFormat = (function() {
      var token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZWN]|'[^']*'|'[^']*'/g;
      var timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g;
      var timezoneClip = /[^-+\dA-Z]/g;
  
      // Regexes and supporting functions are cached through closure
      return function (date, mask, utc, gmt) {
  
        // You can't provide utc if you skip other args (use the 'UTC:' mask prefix)
        if (arguments.length === 1 && kindOf(date) === 'string' && !/\d/.test(date)) {
          mask = date;
          date = undefined;
        }
  
        date = date || new Date;
  
        if(!(date instanceof Date)) {
          date = new Date(date);
        }
  
        if (isNaN(date)) {
          throw TypeError('Invalid date');
        }
  
        mask = String(dateFormat.masks[mask] || mask || dateFormat.masks['default']);
  
        // Allow setting the utc/gmt argument via the mask
        var maskSlice = mask.slice(0, 4);
        if (maskSlice === 'UTC:' || maskSlice === 'GMT:') {
          mask = mask.slice(4);
          utc = true;
          if (maskSlice === 'GMT:') {
            gmt = true;
          }
        }
  
        var _ = utc ? 'getUTC' : 'get';
        var d = date[_ + 'Date']();
        var D = date[_ + 'Day']();
        var m = date[_ + 'Month']();
        var y = date[_ + 'FullYear']();
        var H = date[_ + 'Hours']();
        var M = date[_ + 'Minutes']();
        var s = date[_ + 'Seconds']();
        var L = date[_ + 'Milliseconds']();
        var o = utc ? 0 : date.getTimezoneOffset();
        var W = getWeek(date);
        var N = getDayOfWeek(date);
        var flags = {
          d:    d,
          dd:   pad(d),
          ddd:  dateFormat.i18n.dayNames[D],
          dddd: dateFormat.i18n.dayNames[D + 7],
          m:    m + 1,
          mm:   pad(m + 1),
          mmm:  dateFormat.i18n.monthNames[m],
          mmmm: dateFormat.i18n.monthNames[m + 12],
          yy:   String(y).slice(2),
          yyyy: y,
          h:    H % 12 || 12,
          hh:   pad(H % 12 || 12),
          H:    H,
          HH:   pad(H),
          M:    M,
          MM:   pad(M),
          s:    s,
          ss:   pad(s),
          l:    pad(L, 3),
          L:    pad(Math.round(L / 10)),
          t:    H < 12 ? 'a'  : 'p',
          tt:   H < 12 ? 'am' : 'pm',
          T:    H < 12 ? 'A'  : 'P',
          TT:   H < 12 ? 'AM' : 'PM',
          Z:    gmt ? 'GMT' : utc ? 'UTC' : (String(date).match(timezone) || ['']).pop().replace(timezoneClip, ''),
          o:    (o > 0 ? '-' : '+') + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
          S:    ['th', 'st', 'nd', 'rd'][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10],
          W:    W,
          N:    N
        };
  
        return mask.replace(token, function (match) {
          if (match in flags) {
            return flags[match];
          }
          return match.slice(1, match.length - 1);
        });
      };
    })();

  dateFormat.masks = {
    'default':               'ddd mmm dd yyyy HH:MM:ss',
    'shortDate':             'm/d/yy',
    'mediumDate':            'mmm d, yyyy',
    'longDate':              'mmmm d, yyyy',
    'fullDate':              'dddd, mmmm d, yyyy',
    'shortTime':             'h:MM TT',
    'mediumTime':            'h:MM:ss TT',
    'longTime':              'h:MM:ss TT Z',
    'isoDate':               'yyyy-mm-dd',
    'isoTime':               'HH:MM:ss',
    'isoDateTime':           'yyyy-mm-dd\'T\'HH:MM:sso',
    'isoUtcDateTime':        'UTC:yyyy-mm-dd\'T\'HH:MM:ss\'Z\'',
    'expiresHeaderFormat':   'ddd, dd mmm yyyy HH:MM:ss Z'
  };

  // Internationalization strings
  dateFormat.i18n = {
    dayNames: [
      'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
    ],
    monthNames: [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'
    ]
  };

function pad(val, len) {
  val = String(val);
  len = len || 2;
  while (val.length < len) {
    val = '0' + val;
  }
  return val;
}

/**
 * Get the ISO 8601 week number
 * Based on comments from
 * http://techblog.procurios.nl/k/n618/news/view/33796/14863/Calculate-ISO-8601-week-and-year-in-javascript.html
 *
 * @param  {Object} `date`
 * @return {Number}
 */
function getWeek(date) {
  // Remove time components of date
  var targetThursday = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  // Change date to Thursday same week
  targetThursday.setDate(targetThursday.getDate() - ((targetThursday.getDay() + 6) % 7) + 3);

  // Take January 4th as it is always in week 1 (see ISO 8601)
  var firstThursday = new Date(targetThursday.getFullYear(), 0, 4);

  // Change date to Thursday same week
  firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3);

  // Check if daylight-saving-time-switch occured and correct for it
  var ds = targetThursday.getTimezoneOffset() - firstThursday.getTimezoneOffset();
  targetThursday.setHours(targetThursday.getHours() - ds);

  // Number of weeks between target Thursday and first Thursday
  var weekDiff = (targetThursday - firstThursday) / (86400000*7);
  return 1 + Math.floor(weekDiff);
}

/**
 * Get ISO-8601 numeric representation of the day of the week
 * 1 (for Monday) through 7 (for Sunday)
 * 
 * @param  {Object} `date`
 * @return {Number}
 */
function getDayOfWeek(date) {
  var dow = date.getDay();
  if(dow === 0) {
    dow = 7;
  }
  return dow;
}

/**
 * kind-of shortcut
 * @param  {*} val
 * @return {String}
 */
function kindOf(val) {
  if (val === null) {
    return 'null';
  }

  if (val === undefined) {
    return 'undefined';
  }

  if (typeof val !== 'object') {
    return typeof val;
  }

  if (Array.isArray(val)) {
    return 'array';
  }

  return {}.toString.call(val)
    .slice(8, -1).toLowerCase();
};



  if (typeof define === 'function' && define.amd) {
    define(function () {
      return dateFormat;
    });
  } else if (typeof exports === 'object') {
    module.exports = dateFormat;
  } else {
    global.dateFormat = dateFormat;
  }
})(this);

},{}],54:[function(require,module,exports){
/**
 * humane.js
 * Humanized Messages for Notifications
 * @author Marc Harter (@wavded)
 * @example
 *   humane.log('hello world');
 * @license MIT
 * See more usage examples at: http://wavded.github.com/humane-js/
 */

;!function (name, context, definition) {
   if (typeof module !== 'undefined') module.exports = definition(name, context)
   else if (typeof define === 'function' && typeof define.amd  === 'object') define(definition)
   else context[name] = definition(name, context)
}('humane', this, function (name, context) {
   var win = window
   var doc = document

   var ENV = {
      on: function (el, type, cb) {
         'addEventListener' in win ? el.addEventListener(type,cb,false) : el.attachEvent('on'+type,cb)
      },
      off: function (el, type, cb) {
         'removeEventListener' in win ? el.removeEventListener(type,cb,false) : el.detachEvent('on'+type,cb)
      },
      bind: function (fn, ctx) {
         return function () { fn.apply(ctx,arguments) }
      },
      isArray: Array.isArray || function (obj) { return Object.prototype.toString.call(obj) === '[object Array]' },
      config: function (preferred, fallback) {
         return preferred != null ? preferred : fallback
      },
      transSupport: false,
      useFilter: /msie [678]/i.test(navigator.userAgent), // sniff, sniff
      _checkTransition: function () {
         var el = doc.createElement('div')
         var vendors = { webkit: 'webkit', Moz: '', O: 'o', ms: 'MS' }

         for (var vendor in vendors)
            if (vendor + 'Transition' in el.style) {
               this.vendorPrefix = vendors[vendor]
               this.transSupport = true
            }
      }
   }
   ENV._checkTransition()

   var Humane = function (o) {
      o || (o = {})
      this.queue = []
      this.baseCls = o.baseCls || 'humane'
      this.addnCls = o.addnCls || ''
      this.timeout = 'timeout' in o ? o.timeout : 2500
      this.waitForMove = o.waitForMove || false
      this.clickToClose = o.clickToClose || false
      this.timeoutAfterMove = o.timeoutAfterMove || false
      this.container = o.container

      try { this._setupEl() } // attempt to setup elements
      catch (e) {
        ENV.on(win,'load',ENV.bind(this._setupEl, this)) // dom wasn't ready, wait till ready
      }
   }

   Humane.prototype = {
      constructor: Humane,
      _setupEl: function () {
         var el = doc.createElement('div')
         el.style.display = 'none'
         if (!this.container){
           if(doc.body) this.container = doc.body;
           else throw 'document.body is null'
         }
         this.container.appendChild(el)
         this.el = el
         this.removeEvent = ENV.bind(function(){
            var timeoutAfterMove = ENV.config(this.currentMsg.timeoutAfterMove,this.timeoutAfterMove)
            if (!timeoutAfterMove){
               this.remove()
            } else {
               setTimeout(ENV.bind(this.remove,this),timeoutAfterMove)
            }
         },this)

         this.transEvent = ENV.bind(this._afterAnimation,this)
         this._run()
      },
      _afterTimeout: function () {
         if (!ENV.config(this.currentMsg.waitForMove,this.waitForMove)) this.remove()

         else if (!this.removeEventsSet) {
            ENV.on(doc.body,'mousemove',this.removeEvent)
            ENV.on(doc.body,'click',this.removeEvent)
            ENV.on(doc.body,'keypress',this.removeEvent)
            ENV.on(doc.body,'touchstart',this.removeEvent)
            this.removeEventsSet = true
         }
      },
      _run: function () {
         if (this._animating || !this.queue.length || !this.el) return

         this._animating = true
         if (this.currentTimer) {
            clearTimeout(this.currentTimer)
            this.currentTimer = null
         }

         var msg = this.queue.shift()
         var clickToClose = ENV.config(msg.clickToClose,this.clickToClose)

         if (clickToClose) {
            ENV.on(this.el,'click',this.removeEvent)
            ENV.on(this.el,'touchstart',this.removeEvent)
         }

         var timeout = ENV.config(msg.timeout,this.timeout)

         if (timeout > 0)
            this.currentTimer = setTimeout(ENV.bind(this._afterTimeout,this), timeout)

         if (ENV.isArray(msg.html)) msg.html = '<ul><li>'+msg.html.join('<li>')+'</ul>'

         this.el.innerHTML = msg.html
         this.currentMsg = msg
         this.el.className = this.baseCls
         if (ENV.transSupport) {
            this.el.style.display = 'block'
            setTimeout(ENV.bind(this._showMsg,this),50)
         } else {
            this._showMsg()
         }

      },
      _setOpacity: function (opacity) {
         if (ENV.useFilter){
            try{
               this.el.filters.item('DXImageTransform.Microsoft.Alpha').Opacity = opacity*100
            } catch(err){}
         } else {
            this.el.style.opacity = String(opacity)
         }
      },
      _showMsg: function () {
         var addnCls = ENV.config(this.currentMsg.addnCls,this.addnCls)
         if (ENV.transSupport) {
            this.el.className = this.baseCls+' '+addnCls+' '+this.baseCls+'-animate'
         }
         else {
            var opacity = 0
            this.el.className = this.baseCls+' '+addnCls+' '+this.baseCls+'-js-animate'
            this._setOpacity(0) // reset value so hover states work
            this.el.style.display = 'block'

            var self = this
            var interval = setInterval(function(){
               if (opacity < 1) {
                  opacity += 0.1
                  if (opacity > 1) opacity = 1
                  self._setOpacity(opacity)
               }
               else clearInterval(interval)
            }, 30)
         }
      },
      _hideMsg: function () {
         var addnCls = ENV.config(this.currentMsg.addnCls,this.addnCls)
         if (ENV.transSupport) {
            this.el.className = this.baseCls+' '+addnCls
            ENV.on(this.el,ENV.vendorPrefix ? ENV.vendorPrefix+'TransitionEnd' : 'transitionend',this.transEvent)
         }
         else {
            var opacity = 1
            var self = this
            var interval = setInterval(function(){
               if(opacity > 0) {
                  opacity -= 0.1
                  if (opacity < 0) opacity = 0
                  self._setOpacity(opacity);
               }
               else {
                  self.el.className = self.baseCls+' '+addnCls
                  clearInterval(interval)
                  self._afterAnimation()
               }
            }, 30)
         }
      },
      _afterAnimation: function () {
         if (ENV.transSupport) ENV.off(this.el,ENV.vendorPrefix ? ENV.vendorPrefix+'TransitionEnd' : 'transitionend',this.transEvent)

         if (this.currentMsg.cb) this.currentMsg.cb()
         this.el.style.display = 'none'

         this._animating = false
         this._run()
      },
      remove: function (e) {
         var cb = typeof e == 'function' ? e : null

         ENV.off(doc.body,'mousemove',this.removeEvent)
         ENV.off(doc.body,'click',this.removeEvent)
         ENV.off(doc.body,'keypress',this.removeEvent)
         ENV.off(doc.body,'touchstart',this.removeEvent)
         ENV.off(this.el,'click',this.removeEvent)
         ENV.off(this.el,'touchstart',this.removeEvent)
         this.removeEventsSet = false

         if (cb && this.currentMsg) this.currentMsg.cb = cb
         if (this._animating) this._hideMsg()
         else if (cb) cb()
      },
      log: function (html, o, cb, defaults) {
         var msg = {}
         if (defaults)
           for (var opt in defaults)
               msg[opt] = defaults[opt]

         if (typeof o == 'function') cb = o
         else if (o)
            for (var opt in o) msg[opt] = o[opt]

         msg.html = html
         if (cb) msg.cb = cb
         this.queue.push(msg)
         this._run()
         return this
      },
      spawn: function (defaults) {
         var self = this
         return function (html, o, cb) {
            self.log.call(self,html,o,cb,defaults)
            return self
         }
      },
      create: function (o) { return new Humane(o) }
   }
   return new Humane()
});

},{}],55:[function(require,module,exports){
/*
	Leaflet.draw, a plugin that adds drawing and editing tools to Leaflet powered maps.
	(c) 2012-2013, Jacob Toye, Smartrak

	https://github.com/Leaflet/Leaflet.draw
	http://leafletjs.com
	https://github.com/jacobtoye
*/
!function(t,e){L.drawVersion="0.2.4-dev",L.drawLocal={draw:{toolbar:{actions:{title:"Cancel drawing",text:"Cancel"},undo:{title:"Delete last point drawn",text:"Delete last point"},buttons:{polyline:"Draw a polyline",polygon:"Draw a polygon",rectangle:"Draw a rectangle",circle:"Draw a circle",marker:"Draw a marker"}},handlers:{circle:{tooltip:{start:"Click and drag to draw circle."},radius:"Radius"},marker:{tooltip:{start:"Click map to place marker."}},polygon:{tooltip:{start:"Click to start drawing shape.",cont:"Click to continue drawing shape.",end:"Click first point to close this shape."}},polyline:{error:"<strong>Error:</strong> shape edges cannot cross!",tooltip:{start:"Click to start drawing line.",cont:"Click to continue drawing line.",end:"Click last point to finish line."}},rectangle:{tooltip:{start:"Click and drag to draw rectangle."}},simpleshape:{tooltip:{end:"Release mouse to finish drawing."}}}},edit:{toolbar:{actions:{save:{title:"Save changes.",text:"Save"},cancel:{title:"Cancel editing, discards all changes.",text:"Cancel"}},buttons:{edit:"Edit layers.",editDisabled:"No layers to edit.",remove:"Delete layers.",removeDisabled:"No layers to delete."}},handlers:{edit:{tooltip:{text:"Drag handles, or marker to edit feature.",subtext:"Click cancel to undo changes."}},remove:{tooltip:{text:"Click on a feature to remove"}}}}},L.Draw={},L.Draw.Feature=L.Handler.extend({includes:L.Mixin.Events,initialize:function(t,e){this._map=t,this._container=t._container,this._overlayPane=t._panes.overlayPane,this._popupPane=t._panes.popupPane,e&&e.shapeOptions&&(e.shapeOptions=L.Util.extend({},this.options.shapeOptions,e.shapeOptions)),L.setOptions(this,e)},enable:function(){this._enabled||(L.Handler.prototype.enable.call(this),this.fire("enabled",{handler:this.type}),this._map.fire("draw:drawstart",{layerType:this.type}))},disable:function(){this._enabled&&(L.Handler.prototype.disable.call(this),this._map.fire("draw:drawstop",{layerType:this.type}),this.fire("disabled",{handler:this.type}))},addHooks:function(){var t=this._map;t&&(L.DomUtil.disableTextSelection(),t.getContainer().focus(),this._tooltip=new L.Tooltip(this._map),L.DomEvent.on(this._container,"keyup",this._cancelDrawing,this))},removeHooks:function(){this._map&&(L.DomUtil.enableTextSelection(),this._tooltip.dispose(),this._tooltip=null,L.DomEvent.off(this._container,"keyup",this._cancelDrawing,this))},setOptions:function(t){L.setOptions(this,t)},_fireCreatedEvent:function(t){this._map.fire("draw:created",{layer:t,layerType:this.type})},_cancelDrawing:function(t){27===t.keyCode&&this.disable()}}),L.Draw.Polyline=L.Draw.Feature.extend({statics:{TYPE:"polyline"},Poly:L.Polyline,options:{allowIntersection:!0,repeatMode:!1,drawError:{color:"#b00b00",timeout:2500},icon:new L.DivIcon({iconSize:new L.Point(8,8),className:"leaflet-div-icon leaflet-editing-icon"}),guidelineDistance:20,maxGuideLineLength:4e3,shapeOptions:{stroke:!0,color:"#f06eaa",weight:4,opacity:.5,fill:!1,clickable:!0},metric:!0,showLength:!0,zIndexOffset:2e3},initialize:function(t,e){this.options.drawError.message=L.drawLocal.draw.handlers.polyline.error,e&&e.drawError&&(e.drawError=L.Util.extend({},this.options.drawError,e.drawError)),this.type=L.Draw.Polyline.TYPE,L.Draw.Feature.prototype.initialize.call(this,t,e)},addHooks:function(){L.Draw.Feature.prototype.addHooks.call(this),this._map&&(this._markers=[],this._markerGroup=new L.LayerGroup,this._map.addLayer(this._markerGroup),this._poly=new L.Polyline([],this.options.shapeOptions),this._tooltip.updateContent(this._getTooltipText()),this._mouseMarker||(this._mouseMarker=L.marker(this._map.getCenter(),{icon:L.divIcon({className:"leaflet-mouse-marker",iconAnchor:[20,20],iconSize:[40,40]}),opacity:0,zIndexOffset:this.options.zIndexOffset})),this._mouseMarker.on("mousedown",this._onMouseDown,this).addTo(this._map),this._map.on("mousemove",this._onMouseMove,this).on("mouseup",this._onMouseUp,this).on("zoomend",this._onZoomEnd,this))},removeHooks:function(){L.Draw.Feature.prototype.removeHooks.call(this),this._clearHideErrorTimeout(),this._cleanUpShape(),this._map.removeLayer(this._markerGroup),delete this._markerGroup,delete this._markers,this._map.removeLayer(this._poly),delete this._poly,this._mouseMarker.off("mousedown",this._onMouseDown,this).off("mouseup",this._onMouseUp,this),this._map.removeLayer(this._mouseMarker),delete this._mouseMarker,this._clearGuides(),this._map.off("mousemove",this._onMouseMove,this).off("zoomend",this._onZoomEnd,this)},deleteLastVertex:function(){if(!(this._markers.length<=1)){var t=this._markers.pop(),e=this._poly,i=this._poly.spliceLatLngs(e.getLatLngs().length-1,1)[0];this._markerGroup.removeLayer(t),e.getLatLngs().length<2&&this._map.removeLayer(e),this._vertexChanged(i,!1)}},addVertex:function(t){var e=this._markers.length;return e>0&&!this.options.allowIntersection&&this._poly.newLatLngIntersects(t)?void this._showErrorTooltip():(this._errorShown&&this._hideErrorTooltip(),this._markers.push(this._createMarker(t)),this._poly.addLatLng(t),2===this._poly.getLatLngs().length&&this._map.addLayer(this._poly),void this._vertexChanged(t,!0))},_finishShape:function(){var t=this._poly.newLatLngIntersects(this._poly.getLatLngs()[0],!0);return!this.options.allowIntersection&&t||!this._shapeIsValid()?void this._showErrorTooltip():(this._fireCreatedEvent(),this.disable(),void(this.options.repeatMode&&this.enable()))},_shapeIsValid:function(){return!0},_onZoomEnd:function(){this._updateGuide()},_onMouseMove:function(t){var e=t.layerPoint,i=t.latlng;this._currentLatLng=i,this._updateTooltip(i),this._updateGuide(e),this._mouseMarker.setLatLng(i),L.DomEvent.preventDefault(t.originalEvent)},_vertexChanged:function(t,e){this._updateFinishHandler(),this._updateRunningMeasure(t,e),this._clearGuides(),this._updateTooltip()},_onMouseDown:function(t){var e=t.originalEvent;this._mouseDownOrigin=L.point(e.clientX,e.clientY)},_onMouseUp:function(e){if(this._mouseDownOrigin){var i=L.point(e.originalEvent.clientX,e.originalEvent.clientY).distanceTo(this._mouseDownOrigin);Math.abs(i)<9*(t.devicePixelRatio||1)&&this.addVertex(e.latlng)}this._mouseDownOrigin=null},_updateFinishHandler:function(){var t=this._markers.length;t>1&&this._markers[t-1].on("click",this._finishShape,this),t>2&&this._markers[t-2].off("click",this._finishShape,this)},_createMarker:function(t){var e=new L.Marker(t,{icon:this.options.icon,zIndexOffset:2*this.options.zIndexOffset});return this._markerGroup.addLayer(e),e},_updateGuide:function(t){var e=this._markers.length;e>0&&(t=t||this._map.latLngToLayerPoint(this._currentLatLng),this._clearGuides(),this._drawGuide(this._map.latLngToLayerPoint(this._markers[e-1].getLatLng()),t))},_updateTooltip:function(t){var e=this._getTooltipText();t&&this._tooltip.updatePosition(t),this._errorShown||this._tooltip.updateContent(e)},_drawGuide:function(t,e){var i,o,a,s=Math.floor(Math.sqrt(Math.pow(e.x-t.x,2)+Math.pow(e.y-t.y,2))),r=this.options.guidelineDistance,n=this.options.maxGuideLineLength,l=s>n?s-n:r;for(this._guidesContainer||(this._guidesContainer=L.DomUtil.create("div","leaflet-draw-guides",this._overlayPane));s>l;l+=this.options.guidelineDistance)i=l/s,o={x:Math.floor(t.x*(1-i)+i*e.x),y:Math.floor(t.y*(1-i)+i*e.y)},a=L.DomUtil.create("div","leaflet-draw-guide-dash",this._guidesContainer),a.style.backgroundColor=this._errorShown?this.options.drawError.color:this.options.shapeOptions.color,L.DomUtil.setPosition(a,o)},_updateGuideColor:function(t){if(this._guidesContainer)for(var e=0,i=this._guidesContainer.childNodes.length;i>e;e++)this._guidesContainer.childNodes[e].style.backgroundColor=t},_clearGuides:function(){if(this._guidesContainer)for(;this._guidesContainer.firstChild;)this._guidesContainer.removeChild(this._guidesContainer.firstChild)},_getTooltipText:function(){var t,e,i=this.options.showLength;return 0===this._markers.length?t={text:L.drawLocal.draw.handlers.polyline.tooltip.start}:(e=i?this._getMeasurementString():"",t=1===this._markers.length?{text:L.drawLocal.draw.handlers.polyline.tooltip.cont,subtext:e}:{text:L.drawLocal.draw.handlers.polyline.tooltip.end,subtext:e}),t},_updateRunningMeasure:function(t,e){var i,o,a=this._markers.length;1===this._markers.length?this._measurementRunningTotal=0:(i=a-(e?2:1),o=t.distanceTo(this._markers[i].getLatLng()),this._measurementRunningTotal+=o*(e?1:-1))},_getMeasurementString:function(){var t,e=this._currentLatLng,i=this._markers[this._markers.length-1].getLatLng();return t=this._measurementRunningTotal+e.distanceTo(i),L.GeometryUtil.readableDistance(t,this.options.metric)},_showErrorTooltip:function(){this._errorShown=!0,this._tooltip.showAsError().updateContent({text:this.options.drawError.message}),this._updateGuideColor(this.options.drawError.color),this._poly.setStyle({color:this.options.drawError.color}),this._clearHideErrorTimeout(),this._hideErrorTimeout=setTimeout(L.Util.bind(this._hideErrorTooltip,this),this.options.drawError.timeout)},_hideErrorTooltip:function(){this._errorShown=!1,this._clearHideErrorTimeout(),this._tooltip.removeError().updateContent(this._getTooltipText()),this._updateGuideColor(this.options.shapeOptions.color),this._poly.setStyle({color:this.options.shapeOptions.color})},_clearHideErrorTimeout:function(){this._hideErrorTimeout&&(clearTimeout(this._hideErrorTimeout),this._hideErrorTimeout=null)},_cleanUpShape:function(){this._markers.length>1&&this._markers[this._markers.length-1].off("click",this._finishShape,this)},_fireCreatedEvent:function(){var t=new this.Poly(this._poly.getLatLngs(),this.options.shapeOptions);L.Draw.Feature.prototype._fireCreatedEvent.call(this,t)}}),L.Draw.Polygon=L.Draw.Polyline.extend({statics:{TYPE:"polygon"},Poly:L.Polygon,options:{showArea:!1,shapeOptions:{stroke:!0,color:"#f06eaa",weight:4,opacity:.5,fill:!0,fillColor:null,fillOpacity:.2,clickable:!0}},initialize:function(t,e){L.Draw.Polyline.prototype.initialize.call(this,t,e),this.type=L.Draw.Polygon.TYPE},_updateFinishHandler:function(){var t=this._markers.length;1===t&&this._markers[0].on("click",this._finishShape,this),t>2&&(this._markers[t-1].on("dblclick",this._finishShape,this),t>3&&this._markers[t-2].off("dblclick",this._finishShape,this))},_getTooltipText:function(){var t,e;return 0===this._markers.length?t=L.drawLocal.draw.handlers.polygon.tooltip.start:this._markers.length<3?t=L.drawLocal.draw.handlers.polygon.tooltip.cont:(t=L.drawLocal.draw.handlers.polygon.tooltip.end,e=this._getMeasurementString()),{text:t,subtext:e}},_getMeasurementString:function(){var t=this._area;return t?L.GeometryUtil.readableArea(t,this.options.metric):null},_shapeIsValid:function(){return this._markers.length>=3},_vertexChanged:function(t,e){var i;!this.options.allowIntersection&&this.options.showArea&&(i=this._poly.getLatLngs(),this._area=L.GeometryUtil.geodesicArea(i)),L.Draw.Polyline.prototype._vertexChanged.call(this,t,e)},_cleanUpShape:function(){var t=this._markers.length;t>0&&(this._markers[0].off("click",this._finishShape,this),t>2&&this._markers[t-1].off("dblclick",this._finishShape,this))}}),L.SimpleShape={},L.Draw.SimpleShape=L.Draw.Feature.extend({options:{repeatMode:!1},initialize:function(t,e){this._endLabelText=L.drawLocal.draw.handlers.simpleshape.tooltip.end,L.Draw.Feature.prototype.initialize.call(this,t,e)},addHooks:function(){L.Draw.Feature.prototype.addHooks.call(this),this._map&&(this._mapDraggable=this._map.dragging.enabled(),this._mapDraggable&&this._map.dragging.disable(),this._container.style.cursor="crosshair",this._tooltip.updateContent({text:this._initialLabelText}),this._map.on("mousedown",this._onMouseDown,this).on("mousemove",this._onMouseMove,this))},removeHooks:function(){L.Draw.Feature.prototype.removeHooks.call(this),this._map&&(this._mapDraggable&&this._map.dragging.enable(),this._container.style.cursor="",this._map.off("mousedown",this._onMouseDown,this).off("mousemove",this._onMouseMove,this),L.DomEvent.off(e,"mouseup",this._onMouseUp,this),this._shape&&(this._map.removeLayer(this._shape),delete this._shape)),this._isDrawing=!1},_getTooltipText:function(){return{text:this._endLabelText}},_onMouseDown:function(t){this._isDrawing=!0,this._startLatLng=t.latlng,L.DomEvent.on(e,"mouseup",this._onMouseUp,this).preventDefault(t.originalEvent)},_onMouseMove:function(t){var e=t.latlng;this._tooltip.updatePosition(e),this._isDrawing&&(this._tooltip.updateContent(this._getTooltipText()),this._drawShape(e))},_onMouseUp:function(){this._shape&&this._fireCreatedEvent(),this.disable(),this.options.repeatMode&&this.enable()}}),L.Draw.Rectangle=L.Draw.SimpleShape.extend({statics:{TYPE:"rectangle"},options:{shapeOptions:{stroke:!0,color:"#f06eaa",weight:4,opacity:.5,fill:!0,fillColor:null,fillOpacity:.2,clickable:!0},metric:!0},initialize:function(t,e){this.type=L.Draw.Rectangle.TYPE,this._initialLabelText=L.drawLocal.draw.handlers.rectangle.tooltip.start,L.Draw.SimpleShape.prototype.initialize.call(this,t,e)},_drawShape:function(t){this._shape?this._shape.setBounds(new L.LatLngBounds(this._startLatLng,t)):(this._shape=new L.Rectangle(new L.LatLngBounds(this._startLatLng,t),this.options.shapeOptions),this._map.addLayer(this._shape))},_fireCreatedEvent:function(){var t=new L.Rectangle(this._shape.getBounds(),this.options.shapeOptions);L.Draw.SimpleShape.prototype._fireCreatedEvent.call(this,t)},_getTooltipText:function(){var t,e,i,o=L.Draw.SimpleShape.prototype._getTooltipText.call(this),a=this._shape;return a&&(t=this._shape.getLatLngs(),e=L.GeometryUtil.geodesicArea(t),i=L.GeometryUtil.readableArea(e,this.options.metric)),{text:o.text,subtext:i}}}),L.Draw.Circle=L.Draw.SimpleShape.extend({statics:{TYPE:"circle"},options:{shapeOptions:{stroke:!0,color:"#f06eaa",weight:4,opacity:.5,fill:!0,fillColor:null,fillOpacity:.2,clickable:!0},showRadius:!0,metric:!0},initialize:function(t,e){this.type=L.Draw.Circle.TYPE,this._initialLabelText=L.drawLocal.draw.handlers.circle.tooltip.start,L.Draw.SimpleShape.prototype.initialize.call(this,t,e)},_drawShape:function(t){this._shape?this._shape.setRadius(this._startLatLng.distanceTo(t)):(this._shape=new L.Circle(this._startLatLng,this._startLatLng.distanceTo(t),this.options.shapeOptions),this._map.addLayer(this._shape))},_fireCreatedEvent:function(){var t=new L.Circle(this._startLatLng,this._shape.getRadius(),this.options.shapeOptions);L.Draw.SimpleShape.prototype._fireCreatedEvent.call(this,t)},_onMouseMove:function(t){var e,i=t.latlng,o=this.options.showRadius,a=this.options.metric;this._tooltip.updatePosition(i),this._isDrawing&&(this._drawShape(i),e=this._shape.getRadius().toFixed(1),this._tooltip.updateContent({text:this._endLabelText,subtext:o?L.drawLocal.draw.handlers.circle.radius+": "+L.GeometryUtil.readableDistance(e,a):""}))}}),L.Draw.Marker=L.Draw.Feature.extend({statics:{TYPE:"marker"},options:{icon:new L.Icon.Default,repeatMode:!1,zIndexOffset:2e3},initialize:function(t,e){this.type=L.Draw.Marker.TYPE,L.Draw.Feature.prototype.initialize.call(this,t,e)},addHooks:function(){L.Draw.Feature.prototype.addHooks.call(this),this._map&&(this._tooltip.updateContent({text:L.drawLocal.draw.handlers.marker.tooltip.start}),this._mouseMarker||(this._mouseMarker=L.marker(this._map.getCenter(),{icon:L.divIcon({className:"leaflet-mouse-marker",iconAnchor:[20,20],iconSize:[40,40]}),opacity:0,zIndexOffset:this.options.zIndexOffset})),this._mouseMarker.on("click",this._onClick,this).addTo(this._map),this._map.on("mousemove",this._onMouseMove,this))},removeHooks:function(){L.Draw.Feature.prototype.removeHooks.call(this),this._map&&(this._marker&&(this._marker.off("click",this._onClick,this),this._map.off("click",this._onClick,this).removeLayer(this._marker),delete this._marker),this._mouseMarker.off("click",this._onClick,this),this._map.removeLayer(this._mouseMarker),delete this._mouseMarker,this._map.off("mousemove",this._onMouseMove,this))},_onMouseMove:function(t){var e=t.latlng;this._tooltip.updatePosition(e),this._mouseMarker.setLatLng(e),this._marker?(e=this._mouseMarker.getLatLng(),this._marker.setLatLng(e)):(this._marker=new L.Marker(e,{icon:this.options.icon,zIndexOffset:this.options.zIndexOffset}),this._marker.on("click",this._onClick,this),this._map.on("click",this._onClick,this).addLayer(this._marker),this._map.fire("draw:drawstartmarker",{marker:this._marker}))},_onClick:function(){this._fireCreatedEvent(),this.disable(),this.options.repeatMode&&this.enable()},_fireCreatedEvent:function(){var t=new L.Marker(this._marker.getLatLng(),{icon:this.options.icon});L.Draw.Feature.prototype._fireCreatedEvent.call(this,t)}}),L.Edit=L.Edit||{},L.Edit.Marker=L.Handler.extend({initialize:function(t,e){this._marker=t,L.setOptions(this,e)},addHooks:function(){var t=this._marker;t.dragging.enable(),t.on("dragend",this._onDragEnd,t),this._toggleMarkerHighlight()},removeHooks:function(){var t=this._marker;t.dragging.disable(),t.off("dragend",this._onDragEnd,t),this._toggleMarkerHighlight()},_onDragEnd:function(t){var e=t.target;e.edited=!0},_toggleMarkerHighlight:function(){if(this._icon){var t=this._icon;t.style.display="none",L.DomUtil.hasClass(t,"leaflet-edit-marker-selected")?(L.DomUtil.removeClass(t,"leaflet-edit-marker-selected"),this._offsetMarker(t,-4)):(L.DomUtil.addClass(t,"leaflet-edit-marker-selected"),this._offsetMarker(t,4)),t.style.display=""}},_offsetMarker:function(t,e){var i=parseInt(t.style.marginTop,10)-e,o=parseInt(t.style.marginLeft,10)-e;t.style.marginTop=i+"px",t.style.marginLeft=o+"px"}}),L.Marker.addInitHook(function(){L.Edit.Marker&&(this.editing=new L.Edit.Marker(this),this.options.editable&&this.editing.enable())}),L.Edit=L.Edit||{},L.Edit.Poly=L.Handler.extend({options:{icon:new L.DivIcon({iconSize:new L.Point(8,8),className:"leaflet-div-icon leaflet-editing-icon"})},initialize:function(t,e){this._poly=t,L.setOptions(this,e)},addHooks:function(){var t=this._poly;if(!(t instanceof L.Polygon))try{t.options.editing.fill=!1}catch(e){}t.setStyle(t.options.editing),this._poly._map&&(this._markerGroup||this._initMarkers(),this._poly._map.addLayer(this._markerGroup))},removeHooks:function(){var t=this._poly;t.setStyle(t.options.original),t._map&&(t._map.removeLayer(this._markerGroup),delete this._markerGroup,delete this._markers)},updateMarkers:function(){this._markerGroup.clearLayers(),this._initMarkers()},_initMarkers:function(){this._markerGroup||(this._markerGroup=new L.LayerGroup),this._markers=[];var t,e,i,o,a=this._poly._latlngs;for(t=0,i=a.length;i>t;t++)o=this._createMarker(a[t],t),o.on("click",this._onMarkerClick,this),this._markers.push(o);var s,r;for(t=0,e=i-1;i>t;e=t++)(0!==t||L.Polygon&&this._poly instanceof L.Polygon)&&(s=this._markers[e],r=this._markers[t],this._createMiddleMarker(s,r),this._updatePrevNext(s,r))},_createMarker:function(t,e){var i=new L.Marker(t,{draggable:!0,icon:this.options.icon});return i._origLatLng=t,i._index=e,i.on("drag",this._onMarkerDrag,this),i.on("dragend",this._fireEdit,this),this._markerGroup.addLayer(i),i},_removeMarker:function(t){var e=t._index;this._markerGroup.removeLayer(t),this._markers.splice(e,1),this._poly.spliceLatLngs(e,1),this._updateIndexes(e,-1),t.off("drag",this._onMarkerDrag,this).off("dragend",this._fireEdit,this).off("click",this._onMarkerClick,this)},_fireEdit:function(){this._poly.edited=!0,this._poly.fire("edit")},_onMarkerDrag:function(t){var e=t.target;L.extend(e._origLatLng,e._latlng),e._middleLeft&&e._middleLeft.setLatLng(this._getMiddleLatLng(e._prev,e)),e._middleRight&&e._middleRight.setLatLng(this._getMiddleLatLng(e,e._next)),this._poly.redraw()},_onMarkerClick:function(t){var e=L.Polygon&&this._poly instanceof L.Polygon?4:3,i=t.target;this._poly._latlngs.length<e||(this._removeMarker(i),this._updatePrevNext(i._prev,i._next),i._middleLeft&&this._markerGroup.removeLayer(i._middleLeft),i._middleRight&&this._markerGroup.removeLayer(i._middleRight),i._prev&&i._next?this._createMiddleMarker(i._prev,i._next):i._prev?i._next||(i._prev._middleRight=null):i._next._middleLeft=null,this._fireEdit())},_updateIndexes:function(t,e){this._markerGroup.eachLayer(function(i){i._index>t&&(i._index+=e)})},_createMiddleMarker:function(t,e){var i,o,a,s=this._getMiddleLatLng(t,e),r=this._createMarker(s);r.setOpacity(.6),t._middleRight=e._middleLeft=r,o=function(){var o=e._index;r._index=o,r.off("click",i,this).on("click",this._onMarkerClick,this),s.lat=r.getLatLng().lat,s.lng=r.getLatLng().lng,this._poly.spliceLatLngs(o,0,s),this._markers.splice(o,0,r),r.setOpacity(1),this._updateIndexes(o,1),e._index++,this._updatePrevNext(t,r),this._updatePrevNext(r,e),this._poly.fire("editstart")},a=function(){r.off("dragstart",o,this),r.off("dragend",a,this),this._createMiddleMarker(t,r),this._createMiddleMarker(r,e)},i=function(){o.call(this),a.call(this),this._fireEdit()},r.on("click",i,this).on("dragstart",o,this).on("dragend",a,this),this._markerGroup.addLayer(r)},_updatePrevNext:function(t,e){t&&(t._next=e),e&&(e._prev=t)},_getMiddleLatLng:function(t,e){var i=this._poly._map,o=i.project(t.getLatLng()),a=i.project(e.getLatLng());return i.unproject(o._add(a)._divideBy(2))}}),L.Polyline.addInitHook(function(){this.editing||(L.Edit.Poly&&(this.editing=new L.Edit.Poly(this),this.options.editable&&this.editing.enable()),this.on("add",function(){this.editing&&this.editing.enabled()&&this.editing.addHooks()}),this.on("remove",function(){this.editing&&this.editing.enabled()&&this.editing.removeHooks()}))}),L.Edit=L.Edit||{},L.Edit.SimpleShape=L.Handler.extend({options:{moveIcon:new L.DivIcon({iconSize:new L.Point(8,8),className:"leaflet-div-icon leaflet-editing-icon leaflet-edit-move"}),resizeIcon:new L.DivIcon({iconSize:new L.Point(8,8),className:"leaflet-div-icon leaflet-editing-icon leaflet-edit-resize"})},initialize:function(t,e){this._shape=t,L.Util.setOptions(this,e)},addHooks:function(){var t=this._shape;t.setStyle(t.options.editing),t._map&&(this._map=t._map,this._markerGroup||this._initMarkers(),this._map.addLayer(this._markerGroup))},removeHooks:function(){var t=this._shape;if(t.setStyle(t.options.original),t._map){this._unbindMarker(this._moveMarker);for(var e=0,i=this._resizeMarkers.length;i>e;e++)this._unbindMarker(this._resizeMarkers[e]);this._resizeMarkers=null,this._map.removeLayer(this._markerGroup),delete this._markerGroup}this._map=null},updateMarkers:function(){this._markerGroup.clearLayers(),this._initMarkers()},_initMarkers:function(){this._markerGroup||(this._markerGroup=new L.LayerGroup),this._createMoveMarker(),this._createResizeMarker()},_createMoveMarker:function(){},_createResizeMarker:function(){},_createMarker:function(t,e){var i=new L.Marker(t,{draggable:!0,icon:e,zIndexOffset:10});return this._bindMarker(i),this._markerGroup.addLayer(i),i},_bindMarker:function(t){t.on("dragstart",this._onMarkerDragStart,this).on("drag",this._onMarkerDrag,this).on("dragend",this._onMarkerDragEnd,this)},_unbindMarker:function(t){t.off("dragstart",this._onMarkerDragStart,this).off("drag",this._onMarkerDrag,this).off("dragend",this._onMarkerDragEnd,this)},_onMarkerDragStart:function(t){var e=t.target;e.setOpacity(0),this._shape.fire("editstart")},_fireEdit:function(){this._shape.edited=!0,this._shape.fire("edit")},_onMarkerDrag:function(t){var e=t.target,i=e.getLatLng();e===this._moveMarker?this._move(i):this._resize(i),this._shape.redraw()},_onMarkerDragEnd:function(t){var e=t.target;e.setOpacity(1),this._fireEdit()},_move:function(){},_resize:function(){}}),L.Edit=L.Edit||{},L.Edit.Rectangle=L.Edit.SimpleShape.extend({_createMoveMarker:function(){var t=this._shape.getBounds(),e=t.getCenter();this._moveMarker=this._createMarker(e,this.options.moveIcon)},_createResizeMarker:function(){var t=this._getCorners();this._resizeMarkers=[];for(var e=0,i=t.length;i>e;e++)this._resizeMarkers.push(this._createMarker(t[e],this.options.resizeIcon)),this._resizeMarkers[e]._cornerIndex=e},_onMarkerDragStart:function(t){L.Edit.SimpleShape.prototype._onMarkerDragStart.call(this,t);var e=this._getCorners(),i=t.target,o=i._cornerIndex;this._oppositeCorner=e[(o+2)%4],this._toggleCornerMarkers(0,o)},_onMarkerDragEnd:function(t){var e,i,o=t.target;o===this._moveMarker&&(e=this._shape.getBounds(),i=e.getCenter(),o.setLatLng(i)),this._toggleCornerMarkers(1),this._repositionCornerMarkers(),L.Edit.SimpleShape.prototype._onMarkerDragEnd.call(this,t)},_move:function(t){for(var e,i=this._shape.getLatLngs(),o=this._shape.getBounds(),a=o.getCenter(),s=[],r=0,n=i.length;n>r;r++)e=[i[r].lat-a.lat,i[r].lng-a.lng],s.push([t.lat+e[0],t.lng+e[1]]);this._shape.setLatLngs(s),this._repositionCornerMarkers()},_resize:function(t){var e;this._shape.setBounds(L.latLngBounds(t,this._oppositeCorner)),e=this._shape.getBounds(),this._moveMarker.setLatLng(e.getCenter())},_getCorners:function(){var t=this._shape.getBounds(),e=t.getNorthWest(),i=t.getNorthEast(),o=t.getSouthEast(),a=t.getSouthWest();return[e,i,o,a]},_toggleCornerMarkers:function(t){for(var e=0,i=this._resizeMarkers.length;i>e;e++)this._resizeMarkers[e].setOpacity(t)},_repositionCornerMarkers:function(){for(var t=this._getCorners(),e=0,i=this._resizeMarkers.length;i>e;e++)this._resizeMarkers[e].setLatLng(t[e])}}),L.Rectangle.addInitHook(function(){L.Edit.Rectangle&&(this.editing=new L.Edit.Rectangle(this),this.options.editable&&this.editing.enable())}),L.Edit=L.Edit||{},L.Edit.Circle=L.Edit.SimpleShape.extend({_createMoveMarker:function(){var t=this._shape.getLatLng();this._moveMarker=this._createMarker(t,this.options.moveIcon)},_createResizeMarker:function(){var t=this._shape.getLatLng(),e=this._getResizeMarkerPoint(t);this._resizeMarkers=[],this._resizeMarkers.push(this._createMarker(e,this.options.resizeIcon))},_getResizeMarkerPoint:function(t){var e=this._shape._radius*Math.cos(Math.PI/4),i=this._map.project(t);return this._map.unproject([i.x+e,i.y-e])},_move:function(t){var e=this._getResizeMarkerPoint(t);this._resizeMarkers[0].setLatLng(e),this._shape.setLatLng(t)},_resize:function(t){var e=this._moveMarker.getLatLng(),i=e.distanceTo(t);this._shape.setRadius(i)}}),L.Circle.addInitHook(function(){L.Edit.Circle&&(this.editing=new L.Edit.Circle(this),this.options.editable&&this.editing.enable()),this.on("add",function(){this.editing&&this.editing.enabled()&&this.editing.addHooks()}),this.on("remove",function(){this.editing&&this.editing.enabled()&&this.editing.removeHooks()})}),L.LatLngUtil={cloneLatLngs:function(t){for(var e=[],i=0,o=t.length;o>i;i++)e.push(this.cloneLatLng(t[i]));return e},cloneLatLng:function(t){return L.latLng(t.lat,t.lng)}},L.GeometryUtil=L.extend(L.GeometryUtil||{},{geodesicArea:function(t){var e,i,o=t.length,a=0,s=L.LatLng.DEG_TO_RAD;if(o>2){for(var r=0;o>r;r++)e=t[r],i=t[(r+1)%o],a+=(i.lng-e.lng)*s*(2+Math.sin(e.lat*s)+Math.sin(i.lat*s));a=6378137*a*6378137/2}return Math.abs(a)},readableArea:function(t,e){var i;return e?i=t>=1e4?(1e-4*t).toFixed(2)+" ha":t.toFixed(2)+" m&sup2;":(t/=.836127,i=t>=3097600?(t/3097600).toFixed(2)+" mi&sup2;":t>=4840?(t/4840).toFixed(2)+" acres":Math.ceil(t)+" yd&sup2;"),i},readableDistance:function(t,e){var i;return e?i=t>1e3?(t/1e3).toFixed(2)+" km":Math.ceil(t)+" m":(t*=1.09361,i=t>1760?(t/1760).toFixed(2)+" miles":Math.ceil(t)+" yd"),i}}),L.Util.extend(L.LineUtil,{segmentsIntersect:function(t,e,i,o){return this._checkCounterclockwise(t,i,o)!==this._checkCounterclockwise(e,i,o)&&this._checkCounterclockwise(t,e,i)!==this._checkCounterclockwise(t,e,o)},_checkCounterclockwise:function(t,e,i){return(i.y-t.y)*(e.x-t.x)>(e.y-t.y)*(i.x-t.x)}}),L.Polyline.include({intersects:function(){var t,e,i,o=this._originalPoints,a=o?o.length:0;if(this._tooFewPointsForIntersection())return!1;for(t=a-1;t>=3;t--)if(e=o[t-1],i=o[t],this._lineSegmentsIntersectsRange(e,i,t-2))return!0;return!1},newLatLngIntersects:function(t,e){return this._map?this.newPointIntersects(this._map.latLngToLayerPoint(t),e):!1},newPointIntersects:function(t,e){var i=this._originalPoints,o=i?i.length:0,a=i?i[o-1]:null,s=o-2;return this._tooFewPointsForIntersection(1)?!1:this._lineSegmentsIntersectsRange(a,t,s,e?1:0)},_tooFewPointsForIntersection:function(t){var e=this._originalPoints,i=e?e.length:0;return i+=t||0,!this._originalPoints||3>=i},_lineSegmentsIntersectsRange:function(t,e,i,o){var a,s,r=this._originalPoints;o=o||0;for(var n=i;n>o;n--)if(a=r[n-1],s=r[n],L.LineUtil.segmentsIntersect(t,e,a,s))return!0;return!1}}),L.Polygon.include({intersects:function(){var t,e,i,o,a,s=this._originalPoints;return this._tooFewPointsForIntersection()?!1:(t=L.Polyline.prototype.intersects.call(this))?!0:(e=s.length,i=s[0],o=s[e-1],a=e-2,this._lineSegmentsIntersectsRange(o,i,a,1))}}),L.Control.Draw=L.Control.extend({options:{position:"topleft",draw:{},edit:!1},initialize:function(t){if(L.version<"0.7")throw new Error("Leaflet.draw 0.2.3+ requires Leaflet 0.7.0+. Download latest from https://github.com/Leaflet/Leaflet/");L.Control.prototype.initialize.call(this,t);var e;this._toolbars={},L.DrawToolbar&&this.options.draw&&(e=new L.DrawToolbar(this.options.draw),this._toolbars[L.DrawToolbar.TYPE]=e,this._toolbars[L.DrawToolbar.TYPE].on("enable",this._toolbarEnabled,this)),L.EditToolbar&&this.options.edit&&(e=new L.EditToolbar(this.options.edit),this._toolbars[L.EditToolbar.TYPE]=e,this._toolbars[L.EditToolbar.TYPE].on("enable",this._toolbarEnabled,this))},onAdd:function(t){var e,i=L.DomUtil.create("div","leaflet-draw"),o=!1,a="leaflet-draw-toolbar-top";for(var s in this._toolbars)this._toolbars.hasOwnProperty(s)&&(e=this._toolbars[s].addToolbar(t),e&&(o||(L.DomUtil.hasClass(e,a)||L.DomUtil.addClass(e.childNodes[0],a),o=!0),i.appendChild(e)));return i},onRemove:function(){for(var t in this._toolbars)this._toolbars.hasOwnProperty(t)&&this._toolbars[t].removeToolbar()},setDrawingOptions:function(t){for(var e in this._toolbars)this._toolbars[e]instanceof L.DrawToolbar&&this._toolbars[e].setOptions(t)},_toolbarEnabled:function(t){var e=t.target;for(var i in this._toolbars)this._toolbars[i]!==e&&this._toolbars[i].disable()}}),L.Map.mergeOptions({drawControlTooltips:!0,drawControl:!1}),L.Map.addInitHook(function(){this.options.drawControl&&(this.drawControl=new L.Control.Draw,this.addControl(this.drawControl))}),L.Toolbar=L.Class.extend({includes:[L.Mixin.Events],initialize:function(t){L.setOptions(this,t),this._modes={},this._actionButtons=[],this._activeMode=null},enabled:function(){return null!==this._activeMode},disable:function(){this.enabled()&&this._activeMode.handler.disable()},addToolbar:function(t){var e,i=L.DomUtil.create("div","leaflet-draw-section"),o=0,a=this._toolbarClass||"",s=this.getModeHandlers(t);for(this._toolbarContainer=L.DomUtil.create("div","leaflet-draw-toolbar leaflet-bar"),this._map=t,e=0;e<s.length;e++)s[e].enabled&&this._initModeHandler(s[e].handler,this._toolbarContainer,o++,a,s[e].title);return o?(this._lastButtonIndex=--o,this._actionsContainer=L.DomUtil.create("ul","leaflet-draw-actions"),i.appendChild(this._toolbarContainer),i.appendChild(this._actionsContainer),i):void 0},removeToolbar:function(){for(var t in this._modes)this._modes.hasOwnProperty(t)&&(this._disposeButton(this._modes[t].button,this._modes[t].handler.enable,this._modes[t].handler),this._modes[t].handler.disable(),this._modes[t].handler.off("enabled",this._handlerActivated,this).off("disabled",this._handlerDeactivated,this));this._modes={};for(var e=0,i=this._actionButtons.length;i>e;e++)this._disposeButton(this._actionButtons[e].button,this._actionButtons[e].callback,this);this._actionButtons=[],this._actionsContainer=null},_initModeHandler:function(t,e,i,o,a){var s=t.type;this._modes[s]={},this._modes[s].handler=t,this._modes[s].button=this._createButton({title:a,className:o+"-"+s,container:e,callback:this._modes[s].handler.enable,context:this._modes[s].handler}),this._modes[s].buttonIndex=i,this._modes[s].handler.on("enabled",this._handlerActivated,this).on("disabled",this._handlerDeactivated,this)},_createButton:function(t){var e=L.DomUtil.create("a",t.className||"",t.container);return e.href="#",t.text&&(e.innerHTML=t.text),t.title&&(e.title=t.title),L.DomEvent.on(e,"click",L.DomEvent.stopPropagation).on(e,"mousedown",L.DomEvent.stopPropagation).on(e,"dblclick",L.DomEvent.stopPropagation).on(e,"click",L.DomEvent.preventDefault).on(e,"click",t.callback,t.context),e
},_disposeButton:function(t,e){L.DomEvent.off(t,"click",L.DomEvent.stopPropagation).off(t,"mousedown",L.DomEvent.stopPropagation).off(t,"dblclick",L.DomEvent.stopPropagation).off(t,"click",L.DomEvent.preventDefault).off(t,"click",e)},_handlerActivated:function(t){this.disable(),this._activeMode=this._modes[t.handler],L.DomUtil.addClass(this._activeMode.button,"leaflet-draw-toolbar-button-enabled"),this._showActionsToolbar(),this.fire("enable")},_handlerDeactivated:function(){this._hideActionsToolbar(),L.DomUtil.removeClass(this._activeMode.button,"leaflet-draw-toolbar-button-enabled"),this._activeMode=null,this.fire("disable")},_createActions:function(t){var e,i,o,a,s=this._actionsContainer,r=this.getActions(t),n=r.length;for(i=0,o=this._actionButtons.length;o>i;i++)this._disposeButton(this._actionButtons[i].button,this._actionButtons[i].callback);for(this._actionButtons=[];s.firstChild;)s.removeChild(s.firstChild);for(var l=0;n>l;l++)"enabled"in r[l]&&!r[l].enabled||(e=L.DomUtil.create("li","",s),a=this._createButton({title:r[l].title,text:r[l].text,container:e,callback:r[l].callback,context:r[l].context}),this._actionButtons.push({button:a,callback:r[l].callback}))},_showActionsToolbar:function(){var t=this._activeMode.buttonIndex,e=this._lastButtonIndex,i=this._activeMode.button.offsetTop-1;this._createActions(this._activeMode.handler),this._actionsContainer.style.top=i+"px",0===t&&(L.DomUtil.addClass(this._toolbarContainer,"leaflet-draw-toolbar-notop"),L.DomUtil.addClass(this._actionsContainer,"leaflet-draw-actions-top")),t===e&&(L.DomUtil.addClass(this._toolbarContainer,"leaflet-draw-toolbar-nobottom"),L.DomUtil.addClass(this._actionsContainer,"leaflet-draw-actions-bottom")),this._actionsContainer.style.display="block"},_hideActionsToolbar:function(){this._actionsContainer.style.display="none",L.DomUtil.removeClass(this._toolbarContainer,"leaflet-draw-toolbar-notop"),L.DomUtil.removeClass(this._toolbarContainer,"leaflet-draw-toolbar-nobottom"),L.DomUtil.removeClass(this._actionsContainer,"leaflet-draw-actions-top"),L.DomUtil.removeClass(this._actionsContainer,"leaflet-draw-actions-bottom")}}),L.Tooltip=L.Class.extend({initialize:function(t){this._map=t,this._popupPane=t._panes.popupPane,this._container=t.options.drawControlTooltips?L.DomUtil.create("div","leaflet-draw-tooltip",this._popupPane):null,this._singleLineLabel=!1},dispose:function(){this._container&&(this._popupPane.removeChild(this._container),this._container=null)},updateContent:function(t){return this._container?(t.subtext=t.subtext||"",0!==t.subtext.length||this._singleLineLabel?t.subtext.length>0&&this._singleLineLabel&&(L.DomUtil.removeClass(this._container,"leaflet-draw-tooltip-single"),this._singleLineLabel=!1):(L.DomUtil.addClass(this._container,"leaflet-draw-tooltip-single"),this._singleLineLabel=!0),this._container.innerHTML=(t.subtext.length>0?'<span class="leaflet-draw-tooltip-subtext">'+t.subtext+"</span><br />":"")+"<span>"+t.text+"</span>",this):this},updatePosition:function(t){var e=this._map.latLngToLayerPoint(t),i=this._container;return this._container&&(i.style.visibility="inherit",L.DomUtil.setPosition(i,e)),this},showAsError:function(){return this._container&&L.DomUtil.addClass(this._container,"leaflet-error-draw-tooltip"),this},removeError:function(){return this._container&&L.DomUtil.removeClass(this._container,"leaflet-error-draw-tooltip"),this}}),L.DrawToolbar=L.Toolbar.extend({statics:{TYPE:"draw"},options:{polyline:{},polygon:{},rectangle:{},circle:{},marker:{}},initialize:function(t){for(var e in this.options)this.options.hasOwnProperty(e)&&t[e]&&(t[e]=L.extend({},this.options[e],t[e]));this._toolbarClass="leaflet-draw-draw",L.Toolbar.prototype.initialize.call(this,t)},getModeHandlers:function(t){return[{enabled:this.options.polyline,handler:new L.Draw.Polyline(t,this.options.polyline),title:L.drawLocal.draw.toolbar.buttons.polyline},{enabled:this.options.polygon,handler:new L.Draw.Polygon(t,this.options.polygon),title:L.drawLocal.draw.toolbar.buttons.polygon},{enabled:this.options.rectangle,handler:new L.Draw.Rectangle(t,this.options.rectangle),title:L.drawLocal.draw.toolbar.buttons.rectangle},{enabled:this.options.circle,handler:new L.Draw.Circle(t,this.options.circle),title:L.drawLocal.draw.toolbar.buttons.circle},{enabled:this.options.marker,handler:new L.Draw.Marker(t,this.options.marker),title:L.drawLocal.draw.toolbar.buttons.marker}]},getActions:function(t){return[{enabled:t.deleteLastVertex,title:L.drawLocal.draw.toolbar.undo.title,text:L.drawLocal.draw.toolbar.undo.text,callback:t.deleteLastVertex,context:t},{title:L.drawLocal.draw.toolbar.actions.title,text:L.drawLocal.draw.toolbar.actions.text,callback:this.disable,context:this}]},setOptions:function(t){L.setOptions(this,t);for(var e in this._modes)this._modes.hasOwnProperty(e)&&t.hasOwnProperty(e)&&this._modes[e].handler.setOptions(t[e])}}),L.EditToolbar=L.Toolbar.extend({statics:{TYPE:"edit"},options:{edit:{selectedPathOptions:{color:"#fe57a1",opacity:.6,dashArray:"10, 10",fill:!0,fillColor:"#fe57a1",fillOpacity:.1,maintainColor:!1}},remove:{},featureGroup:null},initialize:function(t){t.edit&&("undefined"==typeof t.edit.selectedPathOptions&&(t.edit.selectedPathOptions=this.options.edit.selectedPathOptions),t.edit.selectedPathOptions=L.extend({},this.options.edit.selectedPathOptions,t.edit.selectedPathOptions)),t.remove&&(t.remove=L.extend({},this.options.remove,t.remove)),this._toolbarClass="leaflet-draw-edit",L.Toolbar.prototype.initialize.call(this,t),this._selectedFeatureCount=0},getModeHandlers:function(t){var e=this.options.featureGroup;return[{enabled:this.options.edit,handler:new L.EditToolbar.Edit(t,{featureGroup:e,selectedPathOptions:this.options.edit.selectedPathOptions}),title:L.drawLocal.edit.toolbar.buttons.edit},{enabled:this.options.remove,handler:new L.EditToolbar.Delete(t,{featureGroup:e}),title:L.drawLocal.edit.toolbar.buttons.remove}]},getActions:function(){return[{title:L.drawLocal.edit.toolbar.actions.save.title,text:L.drawLocal.edit.toolbar.actions.save.text,callback:this._save,context:this},{title:L.drawLocal.edit.toolbar.actions.cancel.title,text:L.drawLocal.edit.toolbar.actions.cancel.text,callback:this.disable,context:this}]},addToolbar:function(t){var e=L.Toolbar.prototype.addToolbar.call(this,t);return this._checkDisabled(),this.options.featureGroup.on("layeradd layerremove",this._checkDisabled,this),e},removeToolbar:function(){this.options.featureGroup.off("layeradd layerremove",this._checkDisabled,this),L.Toolbar.prototype.removeToolbar.call(this)},disable:function(){this.enabled()&&(this._activeMode.handler.revertLayers(),L.Toolbar.prototype.disable.call(this))},_save:function(){this._activeMode.handler.save(),this._activeMode.handler.disable()},_checkDisabled:function(){var t,e=this.options.featureGroup,i=0!==e.getLayers().length;this.options.edit&&(t=this._modes[L.EditToolbar.Edit.TYPE].button,i?L.DomUtil.removeClass(t,"leaflet-disabled"):L.DomUtil.addClass(t,"leaflet-disabled"),t.setAttribute("title",i?L.drawLocal.edit.toolbar.buttons.edit:L.drawLocal.edit.toolbar.buttons.editDisabled)),this.options.remove&&(t=this._modes[L.EditToolbar.Delete.TYPE].button,i?L.DomUtil.removeClass(t,"leaflet-disabled"):L.DomUtil.addClass(t,"leaflet-disabled"),t.setAttribute("title",i?L.drawLocal.edit.toolbar.buttons.remove:L.drawLocal.edit.toolbar.buttons.removeDisabled))}}),L.EditToolbar.Edit=L.Handler.extend({statics:{TYPE:"edit"},includes:L.Mixin.Events,initialize:function(t,e){if(L.Handler.prototype.initialize.call(this,t),L.setOptions(this,e),this._featureGroup=e.featureGroup,!(this._featureGroup instanceof L.FeatureGroup))throw new Error("options.featureGroup must be a L.FeatureGroup");this._uneditedLayerProps={},this.type=L.EditToolbar.Edit.TYPE},enable:function(){!this._enabled&&this._hasAvailableLayers()&&(this.fire("enabled",{handler:this.type}),this._map.fire("draw:editstart",{handler:this.type}),L.Handler.prototype.enable.call(this),this._featureGroup.on("layeradd",this._enableLayerEdit,this).on("layerremove",this._disableLayerEdit,this))},disable:function(){this._enabled&&(this._featureGroup.off("layeradd",this._enableLayerEdit,this).off("layerremove",this._disableLayerEdit,this),L.Handler.prototype.disable.call(this),this._map.fire("draw:editstop",{handler:this.type}),this.fire("disabled",{handler:this.type}))},addHooks:function(){var t=this._map;t&&(t.getContainer().focus(),this._featureGroup.eachLayer(this._enableLayerEdit,this),this._tooltip=new L.Tooltip(this._map),this._tooltip.updateContent({text:L.drawLocal.edit.handlers.edit.tooltip.text,subtext:L.drawLocal.edit.handlers.edit.tooltip.subtext}),this._map.on("mousemove",this._onMouseMove,this))},removeHooks:function(){this._map&&(this._featureGroup.eachLayer(this._disableLayerEdit,this),this._uneditedLayerProps={},this._tooltip.dispose(),this._tooltip=null,this._map.off("mousemove",this._onMouseMove,this))},revertLayers:function(){this._featureGroup.eachLayer(function(t){this._revertLayer(t)},this)},save:function(){var t=new L.LayerGroup;this._featureGroup.eachLayer(function(e){e.edited&&(t.addLayer(e),e.edited=!1)}),this._map.fire("draw:edited",{layers:t})},_backupLayer:function(t){var e=L.Util.stamp(t);this._uneditedLayerProps[e]||(t instanceof L.Polyline||t instanceof L.Polygon||t instanceof L.Rectangle?this._uneditedLayerProps[e]={latlngs:L.LatLngUtil.cloneLatLngs(t.getLatLngs())}:t instanceof L.Circle?this._uneditedLayerProps[e]={latlng:L.LatLngUtil.cloneLatLng(t.getLatLng()),radius:t.getRadius()}:t instanceof L.Marker&&(this._uneditedLayerProps[e]={latlng:L.LatLngUtil.cloneLatLng(t.getLatLng())}))},_revertLayer:function(t){var e=L.Util.stamp(t);t.edited=!1,this._uneditedLayerProps.hasOwnProperty(e)&&(t instanceof L.Polyline||t instanceof L.Polygon||t instanceof L.Rectangle?t.setLatLngs(this._uneditedLayerProps[e].latlngs):t instanceof L.Circle?(t.setLatLng(this._uneditedLayerProps[e].latlng),t.setRadius(this._uneditedLayerProps[e].radius)):t instanceof L.Marker&&t.setLatLng(this._uneditedLayerProps[e].latlng),t.fire("revert-edited",{layer:t}))},_enableLayerEdit:function(t){var e,i=t.layer||t.target||t;this._backupLayer(i),this.options.selectedPathOptions&&(e=L.Util.extend({},this.options.selectedPathOptions),e.maintainColor&&(e.color=i.options.color,e.fillColor=i.options.fillColor),i.options.original=L.extend({},i.options),i.options.editing=e),i.editing.enable()},_disableLayerEdit:function(t){var e=t.layer||t.target||t;e.edited=!1,e.editing.disable(),delete e.options.editing,delete e.options.original},_onMouseMove:function(t){this._tooltip.updatePosition(t.latlng)},_hasAvailableLayers:function(){return 0!==this._featureGroup.getLayers().length}}),L.EditToolbar.Delete=L.Handler.extend({statics:{TYPE:"remove"},includes:L.Mixin.Events,initialize:function(t,e){if(L.Handler.prototype.initialize.call(this,t),L.Util.setOptions(this,e),this._deletableLayers=this.options.featureGroup,!(this._deletableLayers instanceof L.FeatureGroup))throw new Error("options.featureGroup must be a L.FeatureGroup");this.type=L.EditToolbar.Delete.TYPE},enable:function(){!this._enabled&&this._hasAvailableLayers()&&(this.fire("enabled",{handler:this.type}),this._map.fire("draw:deletestart",{handler:this.type}),L.Handler.prototype.enable.call(this),this._deletableLayers.on("layeradd",this._enableLayerDelete,this).on("layerremove",this._disableLayerDelete,this))},disable:function(){this._enabled&&(this._deletableLayers.off("layeradd",this._enableLayerDelete,this).off("layerremove",this._disableLayerDelete,this),L.Handler.prototype.disable.call(this),this._map.fire("draw:deletestop",{handler:this.type}),this.fire("disabled",{handler:this.type}))},addHooks:function(){var t=this._map;t&&(t.getContainer().focus(),this._deletableLayers.eachLayer(this._enableLayerDelete,this),this._deletedLayers=new L.LayerGroup,this._tooltip=new L.Tooltip(this._map),this._tooltip.updateContent({text:L.drawLocal.edit.handlers.remove.tooltip.text}),this._map.on("mousemove",this._onMouseMove,this))},removeHooks:function(){this._map&&(this._deletableLayers.eachLayer(this._disableLayerDelete,this),this._deletedLayers=null,this._tooltip.dispose(),this._tooltip=null,this._map.off("mousemove",this._onMouseMove,this))},revertLayers:function(){this._deletedLayers.eachLayer(function(t){this._deletableLayers.addLayer(t),t.fire("revert-deleted",{layer:t})},this)},save:function(){this._map.fire("draw:deleted",{layers:this._deletedLayers})},_enableLayerDelete:function(t){var e=t.layer||t.target||t;e.on("click",this._removeLayer,this)},_disableLayerDelete:function(t){var e=t.layer||t.target||t;e.off("click",this._removeLayer,this),this._deletedLayers.removeLayer(e)},_removeLayer:function(t){var e=t.layer||t.target||t;this._deletableLayers.removeLayer(e),this._deletedLayers.addLayer(e),e.fire("deleted")},_onMouseMove:function(t){this._tooltip.updatePosition(t.latlng)},_hasAvailableLayers:function(){return 0!==this._deletableLayers.getLayers().length}})}(window,document);
},{}],56:[function(require,module,exports){
/*
 Leaflet.markercluster, Provides Beautiful Animated Marker Clustering functionality for Leaflet, a JS library for interactive maps.
 https://github.com/Leaflet/Leaflet.markercluster
 (c) 2012-2013, Dave Leaver, smartrak
*/
!function(e,t,i){L.MarkerClusterGroup=L.FeatureGroup.extend({options:{maxClusterRadius:80,iconCreateFunction:null,spiderfyOnMaxZoom:!0,showCoverageOnHover:!0,zoomToBoundsOnClick:!0,singleMarkerMode:!1,disableClusteringAtZoom:null,removeOutsideVisibleBounds:!0,animate:!0,animateAddingMarkers:!1,spiderfyDistanceMultiplier:1,spiderLegPolylineOptions:{weight:1.5,color:"#222",opacity:.5},chunkedLoading:!1,chunkInterval:200,chunkDelay:50,chunkProgress:null,polygonOptions:{}},initialize:function(e){L.Util.setOptions(this,e),this.options.iconCreateFunction||(this.options.iconCreateFunction=this._defaultIconCreateFunction),this._featureGroup=L.featureGroup(),this._featureGroup.addEventParent(this),this._nonPointGroup=L.featureGroup(),this._nonPointGroup.addEventParent(this),this._inZoomAnimation=0,this._needsClustering=[],this._needsRemoving=[],this._currentShownBounds=null,this._queue=[];var t=L.DomUtil.TRANSITION&&this.options.animate;L.extend(this,t?this._withAnimation:this._noAnimation),this._markerCluster=t?L.MarkerCluster:L.MarkerClusterNonAnimated},addLayer:function(e){if(e instanceof L.LayerGroup)return this.addLayers([e]);if(!e.getLatLng)return this._nonPointGroup.addLayer(e),this;if(!this._map)return this._needsClustering.push(e),this;if(this.hasLayer(e))return this;this._unspiderfy&&this._unspiderfy(),this._addLayer(e,this._maxZoom),this._topClusterLevel._recalculateBounds(),this._refreshClustersIcons();var t=e,i=this._zoom;if(e.__parent)for(;t.__parent._zoom>=i;)t=t.__parent;return this._currentShownBounds.contains(t.getLatLng())&&(this.options.animateAddingMarkers?this._animationAddLayer(e,t):this._animationAddLayerNonAnimated(e,t)),this},removeLayer:function(e){return e instanceof L.LayerGroup?this.removeLayers([e]):e.getLatLng?this._map?e.__parent?(this._unspiderfy&&(this._unspiderfy(),this._unspiderfyLayer(e)),this._removeLayer(e,!0),this._topClusterLevel._recalculateBounds(),this._refreshClustersIcons(),e.off("move",this._childMarkerMoved,this),this._featureGroup.hasLayer(e)&&(this._featureGroup.removeLayer(e),e.clusterShow&&e.clusterShow()),this):this:(!this._arraySplice(this._needsClustering,e)&&this.hasLayer(e)&&this._needsRemoving.push(e),this):(this._nonPointGroup.removeLayer(e),this)},addLayers:function(e){if(!L.Util.isArray(e))return this.addLayer(e);var t,i=this._featureGroup,n=this._nonPointGroup,s=this.options.chunkedLoading,r=this.options.chunkInterval,o=this.options.chunkProgress,a=e.length,h=0,u=!0;if(this._map){var l=(new Date).getTime(),_=L.bind(function(){for(var d=(new Date).getTime();a>h;h++){if(s&&0===h%200){var c=(new Date).getTime()-d;if(c>r)break}if(t=e[h],t instanceof L.LayerGroup)u&&(e=e.slice(),u=!1),this._extractNonGroupLayers(t,e),a=e.length;else if(t.getLatLng){if(!this.hasLayer(t)&&(this._addLayer(t,this._maxZoom),t.__parent&&2===t.__parent.getChildCount())){var p=t.__parent.getAllChildMarkers(),f=p[0]===t?p[1]:p[0];i.removeLayer(f)}}else n.addLayer(t)}o&&o(h,a,(new Date).getTime()-l),h===a?(this._topClusterLevel._recalculateBounds(),this._refreshClustersIcons(),this._topClusterLevel._recursivelyAddChildrenToMap(null,this._zoom,this._currentShownBounds)):setTimeout(_,this.options.chunkDelay)},this);_()}else for(var d=this._needsClustering;a>h;h++)t=e[h],t instanceof L.LayerGroup?(u&&(e=e.slice(),u=!1),this._extractNonGroupLayers(t,e),a=e.length):t.getLatLng?this.hasLayer(t)||d.push(t):n.addLayer(t);return this},removeLayers:function(e){var t,i,n=e.length,s=this._featureGroup,r=this._nonPointGroup,o=!0;if(!this._map){for(t=0;n>t;t++)i=e[t],i instanceof L.LayerGroup?(o&&(e=e.slice(),o=!1),this._extractNonGroupLayers(i,e),n=e.length):(this._arraySplice(this._needsClustering,i),r.removeLayer(i),this.hasLayer(i)&&this._needsRemoving.push(i));return this}if(this._unspiderfy){this._unspiderfy();var a=e.slice(),h=n;for(t=0;h>t;t++)i=a[t],i instanceof L.LayerGroup?(this._extractNonGroupLayers(i,a),h=a.length):this._unspiderfyLayer(i)}for(t=0;n>t;t++)i=e[t],i instanceof L.LayerGroup?(o&&(e=e.slice(),o=!1),this._extractNonGroupLayers(i,e),n=e.length):i.__parent?(this._removeLayer(i,!0,!0),s.hasLayer(i)&&(s.removeLayer(i),i.clusterShow&&i.clusterShow())):r.removeLayer(i);return this._topClusterLevel._recalculateBounds(),this._refreshClustersIcons(),this._topClusterLevel._recursivelyAddChildrenToMap(null,this._zoom,this._currentShownBounds),this},clearLayers:function(){return this._map||(this._needsClustering=[],delete this._gridClusters,delete this._gridUnclustered),this._noanimationUnspiderfy&&this._noanimationUnspiderfy(),this._featureGroup.clearLayers(),this._nonPointGroup.clearLayers(),this.eachLayer(function(e){e.off("move",this._childMarkerMoved,this),delete e.__parent}),this._map&&this._generateInitialClusters(),this},getBounds:function(){var e=new L.LatLngBounds;this._topClusterLevel&&e.extend(this._topClusterLevel._bounds);for(var t=this._needsClustering.length-1;t>=0;t--)e.extend(this._needsClustering[t].getLatLng());return e.extend(this._nonPointGroup.getBounds()),e},eachLayer:function(e,t){var i,n=this._needsClustering.slice(),s=this._needsRemoving;for(this._topClusterLevel&&this._topClusterLevel.getAllChildMarkers(n),i=n.length-1;i>=0;i--)-1===s.indexOf(n[i])&&e.call(t,n[i]);this._nonPointGroup.eachLayer(e,t)},getLayers:function(){var e=[];return this.eachLayer(function(t){e.push(t)}),e},getLayer:function(e){var t=null;return e=parseInt(e,10),this.eachLayer(function(i){L.stamp(i)===e&&(t=i)}),t},hasLayer:function(e){if(!e)return!1;var t,i=this._needsClustering;for(t=i.length-1;t>=0;t--)if(i[t]===e)return!0;for(i=this._needsRemoving,t=i.length-1;t>=0;t--)if(i[t]===e)return!1;return!(!e.__parent||e.__parent._group!==this)||this._nonPointGroup.hasLayer(e)},zoomToShowLayer:function(e,t){"function"!=typeof t&&(t=function(){});var i=function(){!e._icon&&!e.__parent._icon||this._inZoomAnimation||(this._map.off("moveend",i,this),this.off("animationend",i,this),e._icon?t():e.__parent._icon&&(this.once("spiderfied",t,this),e.__parent.spiderfy()))};if(e._icon&&this._map.getBounds().contains(e.getLatLng()))t();else if(e.__parent._zoom<Math.round(this._map._zoom))this._map.on("moveend",i,this),this._map.panTo(e.getLatLng());else{var n=function(){this._map.off("movestart",n,this),n=null};this._map.on("movestart",n,this),this._map.on("moveend",i,this),this.on("animationend",i,this),e.__parent.zoomToBounds(),n&&i.call(this)}},onAdd:function(e){this._map=e;var t,i,n;if(!isFinite(this._map.getMaxZoom()))throw"Map has no maxZoom specified";for(this._featureGroup.addTo(e),this._nonPointGroup.addTo(e),this._gridClusters||this._generateInitialClusters(),this._maxLat=e.options.crs.projection.MAX_LATITUDE,t=0,i=this._needsRemoving.length;i>t;t++)n=this._needsRemoving[t],this._removeLayer(n,!0);this._needsRemoving=[],this._zoom=Math.round(this._map._zoom),this._currentShownBounds=this._getExpandedVisibleBounds(),this._map.on("zoomend",this._zoomEnd,this),this._map.on("moveend",this._moveEnd,this),this._spiderfierOnAdd&&this._spiderfierOnAdd(),this._bindEvents(),i=this._needsClustering,this._needsClustering=[],this.addLayers(i)},onRemove:function(e){e.off("zoomend",this._zoomEnd,this),e.off("moveend",this._moveEnd,this),this._unbindEvents(),this._map._mapPane.className=this._map._mapPane.className.replace(" leaflet-cluster-anim",""),this._spiderfierOnRemove&&this._spiderfierOnRemove(),delete this._maxLat,this._hideCoverage(),this._featureGroup.remove(),this._nonPointGroup.remove(),this._featureGroup.clearLayers(),this._map=null},getVisibleParent:function(e){for(var t=e;t&&!t._icon;)t=t.__parent;return t||null},_arraySplice:function(e,t){for(var i=e.length-1;i>=0;i--)if(e[i]===t)return e.splice(i,1),!0},_removeFromGridUnclustered:function(e,t){for(var i=this._map,n=this._gridUnclustered;t>=0&&n[t].removeObject(e,i.project(e.getLatLng(),t));t--);},_childMarkerMoved:function(e){this._ignoreMove||(e.target._latlng=e.oldLatLng,this.removeLayer(e.target),e.target._latlng=e.latlng,this.addLayer(e.target))},_removeLayer:function(e,t,i){var n=this._gridClusters,s=this._gridUnclustered,r=this._featureGroup,o=this._map;t&&this._removeFromGridUnclustered(e,this._maxZoom);var a,h=e.__parent,u=h._markers;for(this._arraySplice(u,e);h&&(h._childCount--,h._boundsNeedUpdate=!0,!(h._zoom<0));)t&&h._childCount<=1?(a=h._markers[0]===e?h._markers[1]:h._markers[0],n[h._zoom].removeObject(h,o.project(h._cLatLng,h._zoom)),s[h._zoom].addObject(a,o.project(a.getLatLng(),h._zoom)),this._arraySplice(h.__parent._childClusters,h),h.__parent._markers.push(a),a.__parent=h.__parent,h._icon&&(r.removeLayer(h),i||r.addLayer(a))):h._iconNeedsUpdate=!0,h=h.__parent;delete e.__parent},_isOrIsParent:function(e,t){for(;t;){if(e===t)return!0;t=t.parentNode}return!1},fire:function(e,t,i){if(t&&t.layer instanceof L.MarkerCluster){if(t.originalEvent&&this._isOrIsParent(t.layer._icon,t.originalEvent.relatedTarget))return;e="cluster"+e}L.FeatureGroup.prototype.fire.call(this,e,t,i)},listens:function(e,t){return L.FeatureGroup.prototype.listens.call(this,e,t)||L.FeatureGroup.prototype.listens.call(this,"cluster"+e,t)},_defaultIconCreateFunction:function(e){var t=e.getChildCount(),i=" marker-cluster-";return i+=10>t?"small":100>t?"medium":"large",new L.DivIcon({html:"<div><span>"+t+"</span></div>",className:"marker-cluster"+i,iconSize:new L.Point(40,40)})},_bindEvents:function(){var e=this._map,t=this.options.spiderfyOnMaxZoom,i=this.options.showCoverageOnHover,n=this.options.zoomToBoundsOnClick;(t||n)&&this.on("clusterclick",this._zoomOrSpiderfy,this),i&&(this.on("clustermouseover",this._showCoverage,this),this.on("clustermouseout",this._hideCoverage,this),e.on("zoomend",this._hideCoverage,this))},_zoomOrSpiderfy:function(e){for(var t=e.layer,i=t;1===i._childClusters.length;)i=i._childClusters[0];i._zoom===this._maxZoom&&i._childCount===t._childCount&&this.options.spiderfyOnMaxZoom?t.spiderfy():this.options.zoomToBoundsOnClick&&t.zoomToBounds(),e.originalEvent&&13===e.originalEvent.keyCode&&this._map._container.focus()},_showCoverage:function(e){var t=this._map;this._inZoomAnimation||(this._shownPolygon&&t.removeLayer(this._shownPolygon),e.layer.getChildCount()>2&&e.layer!==this._spiderfied&&(this._shownPolygon=new L.Polygon(e.layer.getConvexHull(),this.options.polygonOptions),t.addLayer(this._shownPolygon)))},_hideCoverage:function(){this._shownPolygon&&(this._map.removeLayer(this._shownPolygon),this._shownPolygon=null)},_unbindEvents:function(){var e=this.options.spiderfyOnMaxZoom,t=this.options.showCoverageOnHover,i=this.options.zoomToBoundsOnClick,n=this._map;(e||i)&&this.off("clusterclick",this._zoomOrSpiderfy,this),t&&(this.off("clustermouseover",this._showCoverage,this),this.off("clustermouseout",this._hideCoverage,this),n.off("zoomend",this._hideCoverage,this))},_zoomEnd:function(){this._map&&(this._mergeSplitClusters(),this._zoom=Math.round(this._map._zoom),this._currentShownBounds=this._getExpandedVisibleBounds())},_moveEnd:function(){if(!this._inZoomAnimation){var e=this._getExpandedVisibleBounds();this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,this._zoom,e),this._topClusterLevel._recursivelyAddChildrenToMap(null,Math.round(this._map._zoom),e),this._currentShownBounds=e}},_generateInitialClusters:function(){var e=this._map.getMaxZoom(),t=this.options.maxClusterRadius,i=t;"function"!=typeof t&&(i=function(){return t}),this.options.disableClusteringAtZoom&&(e=this.options.disableClusteringAtZoom-1),this._maxZoom=e,this._gridClusters={},this._gridUnclustered={};for(var n=e;n>=0;n--)this._gridClusters[n]=new L.DistanceGrid(i(n)),this._gridUnclustered[n]=new L.DistanceGrid(i(n));this._topClusterLevel=new this._markerCluster(this,-1)},_addLayer:function(e,t){var i,n,s=this._gridClusters,r=this._gridUnclustered;for(this.options.singleMarkerMode&&this._overrideMarkerIcon(e),e.on("move",this._childMarkerMoved,this);t>=0;t--){i=this._map.project(e.getLatLng(),t);var o=s[t].getNearObject(i);if(o)return o._addChild(e),e.__parent=o,void 0;if(o=r[t].getNearObject(i)){var a=o.__parent;a&&this._removeLayer(o,!1);var h=new this._markerCluster(this,t,o,e);s[t].addObject(h,this._map.project(h._cLatLng,t)),o.__parent=h,e.__parent=h;var u=h;for(n=t-1;n>a._zoom;n--)u=new this._markerCluster(this,n,u),s[n].addObject(u,this._map.project(o.getLatLng(),n));return a._addChild(u),this._removeFromGridUnclustered(o,t),void 0}r[t].addObject(e,i)}this._topClusterLevel._addChild(e),e.__parent=this._topClusterLevel},_refreshClustersIcons:function(){this._featureGroup.eachLayer(function(e){e instanceof L.MarkerCluster&&e._iconNeedsUpdate&&e._updateIcon()})},_enqueue:function(e){this._queue.push(e),this._queueTimeout||(this._queueTimeout=setTimeout(L.bind(this._processQueue,this),300))},_processQueue:function(){for(var e=0;e<this._queue.length;e++)this._queue[e].call(this);this._queue.length=0,clearTimeout(this._queueTimeout),this._queueTimeout=null},_mergeSplitClusters:function(){var e=Math.round(this._map._zoom);this._processQueue(),this._zoom<e&&this._currentShownBounds.intersects(this._getExpandedVisibleBounds())?(this._animationStart(),this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,this._zoom,this._getExpandedVisibleBounds()),this._animationZoomIn(this._zoom,e)):this._zoom>e?(this._animationStart(),this._animationZoomOut(this._zoom,e)):this._moveEnd()},_getExpandedVisibleBounds:function(){return this.options.removeOutsideVisibleBounds?L.Browser.mobile?this._checkBoundsMaxLat(this._map.getBounds()):this._checkBoundsMaxLat(this._map.getBounds().pad(1)):this._mapBoundsInfinite},_checkBoundsMaxLat:function(e){var t=this._maxLat;return t!==i&&(e.getNorth()>=t&&(e._northEast.lat=1/0),e.getSouth()<=-t&&(e._southWest.lat=-1/0)),e},_animationAddLayerNonAnimated:function(e,t){if(t===e)this._featureGroup.addLayer(e);else if(2===t._childCount){t._addToMap();var i=t.getAllChildMarkers();this._featureGroup.removeLayer(i[0]),this._featureGroup.removeLayer(i[1])}else t._updateIcon()},_extractNonGroupLayers:function(e,t){var i,n=e.getLayers(),s=0;for(t=t||[];s<n.length;s++)i=n[s],i instanceof L.LayerGroup?this._extractNonGroupLayers(i,t):t.push(i);return t},_overrideMarkerIcon:function(e){var t=e.options.icon=this.options.iconCreateFunction({getChildCount:function(){return 1},getAllChildMarkers:function(){return[e]}});return t}}),L.MarkerClusterGroup.include({_mapBoundsInfinite:new L.LatLngBounds(new L.LatLng(-1/0,-1/0),new L.LatLng(1/0,1/0))}),L.MarkerClusterGroup.include({_noAnimation:{_animationStart:function(){},_animationZoomIn:function(e,t){this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,e),this._topClusterLevel._recursivelyAddChildrenToMap(null,t,this._getExpandedVisibleBounds()),this.fire("animationend")},_animationZoomOut:function(e,t){this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,e),this._topClusterLevel._recursivelyAddChildrenToMap(null,t,this._getExpandedVisibleBounds()),this.fire("animationend")},_animationAddLayer:function(e,t){this._animationAddLayerNonAnimated(e,t)}},_withAnimation:{_animationStart:function(){this._map._mapPane.className+=" leaflet-cluster-anim",this._inZoomAnimation++},_animationZoomIn:function(e,t){var i,n=this._getExpandedVisibleBounds(),s=this._featureGroup;this._ignoreMove=!0,this._topClusterLevel._recursively(n,e,0,function(r){var o,a=r._latlng,h=r._markers;for(n.contains(a)||(a=null),r._isSingleParent()&&e+1===t?(s.removeLayer(r),r._recursivelyAddChildrenToMap(null,t,n)):(r.clusterHide(),r._recursivelyAddChildrenToMap(a,t,n)),i=h.length-1;i>=0;i--)o=h[i],n.contains(o._latlng)||s.removeLayer(o)}),this._forceLayout(),this._topClusterLevel._recursivelyBecomeVisible(n,t),s.eachLayer(function(e){e instanceof L.MarkerCluster||!e._icon||e.clusterShow()}),this._topClusterLevel._recursively(n,e,t,function(e){e._recursivelyRestoreChildPositions(t)}),this._ignoreMove=!1,this._enqueue(function(){this._topClusterLevel._recursively(n,e,0,function(e){s.removeLayer(e),e.clusterShow()}),this._animationEnd()})},_animationZoomOut:function(e,t){this._animationZoomOutSingle(this._topClusterLevel,e-1,t),this._topClusterLevel._recursivelyAddChildrenToMap(null,t,this._getExpandedVisibleBounds()),this._topClusterLevel._recursivelyRemoveChildrenFromMap(this._currentShownBounds,e,this._getExpandedVisibleBounds())},_animationAddLayer:function(e,t){var i=this,n=this._featureGroup;n.addLayer(e),t!==e&&(t._childCount>2?(t._updateIcon(),this._forceLayout(),this._animationStart(),e._setPos(this._map.latLngToLayerPoint(t.getLatLng())),e.clusterHide(),this._enqueue(function(){n.removeLayer(e),e.clusterShow(),i._animationEnd()})):(this._forceLayout(),i._animationStart(),i._animationZoomOutSingle(t,this._map.getMaxZoom(),this._zoom)))}},_animationZoomOutSingle:function(e,t,i){var n=this._getExpandedVisibleBounds();e._recursivelyAnimateChildrenInAndAddSelfToMap(n,t+1,i);var s=this;this._forceLayout(),e._recursivelyBecomeVisible(n,i),this._enqueue(function(){if(1===e._childCount){var r=e._markers[0];this._ignoreMove=!0,r.setLatLng(r.getLatLng()),this._ignoreMove=!1,r.clusterShow&&r.clusterShow()}else e._recursively(n,i,0,function(e){e._recursivelyRemoveChildrenFromMap(n,t+1)});s._animationEnd()})},_animationEnd:function(){this._map&&(this._map._mapPane.className=this._map._mapPane.className.replace(" leaflet-cluster-anim","")),this._inZoomAnimation--,this.fire("animationend")},_forceLayout:function(){L.Util.falseFn(t.body.offsetWidth)}}),L.markerClusterGroup=function(e){return new L.MarkerClusterGroup(e)},L.MarkerCluster=L.Marker.extend({initialize:function(e,t,i,n){L.Marker.prototype.initialize.call(this,i?i._cLatLng||i.getLatLng():new L.LatLng(0,0),{icon:this}),this._group=e,this._zoom=t,this._markers=[],this._childClusters=[],this._childCount=0,this._iconNeedsUpdate=!0,this._boundsNeedUpdate=!0,this._bounds=new L.LatLngBounds,i&&this._addChild(i),n&&this._addChild(n)},getAllChildMarkers:function(e){e=e||[];for(var t=this._childClusters.length-1;t>=0;t--)this._childClusters[t].getAllChildMarkers(e);for(var i=this._markers.length-1;i>=0;i--)e.push(this._markers[i]);return e},getChildCount:function(){return this._childCount},zoomToBounds:function(){for(var e,t=this._childClusters.slice(),i=this._group._map,n=i.getBoundsZoom(this._bounds),s=this._zoom+1,r=i.getZoom();t.length>0&&n>s;){s++;var o=[];for(e=0;e<t.length;e++)o=o.concat(t[e]._childClusters);t=o}n>s?this._group._map.setView(this._latlng,s):r>=n?this._group._map.setView(this._latlng,r+1):this._group._map.fitBounds(this._bounds)},getBounds:function(){var e=new L.LatLngBounds;return e.extend(this._bounds),e},_updateIcon:function(){this._iconNeedsUpdate=!0,this._icon&&this.setIcon(this)},createIcon:function(){return this._iconNeedsUpdate&&(this._iconObj=this._group.options.iconCreateFunction(this),this._iconNeedsUpdate=!1),this._iconObj.createIcon()},createShadow:function(){return this._iconObj.createShadow()},_addChild:function(e,t){this._iconNeedsUpdate=!0,this._boundsNeedUpdate=!0,this._setClusterCenter(e),e instanceof L.MarkerCluster?(t||(this._childClusters.push(e),e.__parent=this),this._childCount+=e._childCount):(t||this._markers.push(e),this._childCount++),this.__parent&&this.__parent._addChild(e,!0)},_setClusterCenter:function(e){this._cLatLng||(this._cLatLng=e._cLatLng||e._latlng)},_resetBounds:function(){var e=this._bounds;e._southWest&&(e._southWest.lat=1/0,e._southWest.lng=1/0),e._northEast&&(e._northEast.lat=-1/0,e._northEast.lng=-1/0)},_recalculateBounds:function(){var e,t,i,n,s=this._markers,r=this._childClusters,o=0,a=0,h=this._childCount;if(0!==h){for(this._resetBounds(),e=0;e<s.length;e++)i=s[e]._latlng,this._bounds.extend(i),o+=i.lat,a+=i.lng;for(e=0;e<r.length;e++)t=r[e],t._boundsNeedUpdate&&t._recalculateBounds(),this._bounds.extend(t._bounds),i=t._wLatLng,n=t._childCount,o+=i.lat*n,a+=i.lng*n;this._latlng=this._wLatLng=new L.LatLng(o/h,a/h),this._boundsNeedUpdate=!1}},_addToMap:function(e){e&&(this._backupLatlng=this._latlng,this.setLatLng(e)),this._group._featureGroup.addLayer(this)},_recursivelyAnimateChildrenIn:function(e,t,i){this._recursively(e,0,i-1,function(e){var i,n,s=e._markers;for(i=s.length-1;i>=0;i--)n=s[i],n._icon&&(n._setPos(t),n.clusterHide())},function(e){var i,n,s=e._childClusters;for(i=s.length-1;i>=0;i--)n=s[i],n._icon&&(n._setPos(t),n.clusterHide())})},_recursivelyAnimateChildrenInAndAddSelfToMap:function(e,t,i){this._recursively(e,i,0,function(n){n._recursivelyAnimateChildrenIn(e,n._group._map.latLngToLayerPoint(n.getLatLng()).round(),t),n._isSingleParent()&&t-1===i?(n.clusterShow(),n._recursivelyRemoveChildrenFromMap(e,t)):n.clusterHide(),n._addToMap()})},_recursivelyBecomeVisible:function(e,t){this._recursively(e,0,t,null,function(e){e.clusterShow()})},_recursivelyAddChildrenToMap:function(e,t,i){this._recursively(i,-1,t,function(n){if(t!==n._zoom)for(var s=n._markers.length-1;s>=0;s--){var r=n._markers[s];i.contains(r._latlng)&&(e&&(r._backupLatlng=r.getLatLng(),r.setLatLng(e),r.clusterHide&&r.clusterHide()),n._group._featureGroup.addLayer(r))}},function(t){t._addToMap(e)})},_recursivelyRestoreChildPositions:function(e){for(var t=this._markers.length-1;t>=0;t--){var i=this._markers[t];i._backupLatlng&&(i.setLatLng(i._backupLatlng),delete i._backupLatlng)}if(e-1===this._zoom)for(var n=this._childClusters.length-1;n>=0;n--)this._childClusters[n]._restorePosition();else for(var s=this._childClusters.length-1;s>=0;s--)this._childClusters[s]._recursivelyRestoreChildPositions(e)},_restorePosition:function(){this._backupLatlng&&(this.setLatLng(this._backupLatlng),delete this._backupLatlng)},_recursivelyRemoveChildrenFromMap:function(e,t,i){var n,s;this._recursively(e,-1,t-1,function(e){for(s=e._markers.length-1;s>=0;s--)n=e._markers[s],i&&i.contains(n._latlng)||(e._group._featureGroup.removeLayer(n),n.clusterShow&&n.clusterShow())},function(e){for(s=e._childClusters.length-1;s>=0;s--)n=e._childClusters[s],i&&i.contains(n._latlng)||(e._group._featureGroup.removeLayer(n),n.clusterShow&&n.clusterShow())})},_recursively:function(e,t,i,n,s){var r,o,a=this._childClusters,h=this._zoom;if(h>=t&&(n&&n(this),s&&h===i&&s(this)),t>h||i>h)for(r=a.length-1;r>=0;r--)o=a[r],e.intersects(o._bounds)&&o._recursively(e,t,i,n,s)},_isSingleParent:function(){return this._childClusters.length>0&&this._childClusters[0]._childCount===this._childCount}}),L.Marker.include({clusterHide:function(){return this.options.opacityWhenUnclustered=this.options.opacity||1,this.setOpacity(0)},clusterShow:function(){var e=this.setOpacity(this.options.opacity||this.options.opacityWhenUnclustered);return delete this.options.opacityWhenUnclustered,e}}),L.DistanceGrid=function(e){this._cellSize=e,this._sqCellSize=e*e,this._grid={},this._objectPoint={}},L.DistanceGrid.prototype={addObject:function(e,t){var i=this._getCoord(t.x),n=this._getCoord(t.y),s=this._grid,r=s[n]=s[n]||{},o=r[i]=r[i]||[],a=L.Util.stamp(e);this._objectPoint[a]=t,o.push(e)},updateObject:function(e,t){this.removeObject(e),this.addObject(e,t)},removeObject:function(e,t){var i,n,s=this._getCoord(t.x),r=this._getCoord(t.y),o=this._grid,a=o[r]=o[r]||{},h=a[s]=a[s]||[];for(delete this._objectPoint[L.Util.stamp(e)],i=0,n=h.length;n>i;i++)if(h[i]===e)return h.splice(i,1),1===n&&delete a[s],!0},eachObject:function(e,t){var i,n,s,r,o,a,h,u=this._grid;for(i in u){o=u[i];for(n in o)for(a=o[n],s=0,r=a.length;r>s;s++)h=e.call(t,a[s]),h&&(s--,r--)}},getNearObject:function(e){var t,i,n,s,r,o,a,h,u=this._getCoord(e.x),l=this._getCoord(e.y),_=this._objectPoint,d=this._sqCellSize,c=null;for(t=l-1;l+1>=t;t++)if(s=this._grid[t])for(i=u-1;u+1>=i;i++)if(r=s[i])for(n=0,o=r.length;o>n;n++)a=r[n],h=this._sqDist(_[L.Util.stamp(a)],e),d>h&&(d=h,c=a);return c},_getCoord:function(e){return Math.floor(e/this._cellSize)},_sqDist:function(e,t){var i=t.x-e.x,n=t.y-e.y;return i*i+n*n}},function(){L.QuickHull={getDistant:function(e,t){var i=t[1].lat-t[0].lat,n=t[0].lng-t[1].lng;return n*(e.lat-t[0].lat)+i*(e.lng-t[0].lng)},findMostDistantPointFromBaseLine:function(e,t){var i,n,s,r=0,o=null,a=[];for(i=t.length-1;i>=0;i--)n=t[i],s=this.getDistant(n,e),s>0&&(a.push(n),s>r&&(r=s,o=n));return{maxPoint:o,newPoints:a}},buildConvexHull:function(e,t){var i=[],n=this.findMostDistantPointFromBaseLine(e,t);return n.maxPoint?(i=i.concat(this.buildConvexHull([e[0],n.maxPoint],n.newPoints)),i=i.concat(this.buildConvexHull([n.maxPoint,e[1]],n.newPoints))):[e[0]]},getConvexHull:function(e){var t,i=!1,n=!1,s=!1,r=!1,o=null,a=null,h=null,u=null,l=null,_=null;for(t=e.length-1;t>=0;t--){var d=e[t];(i===!1||d.lat>i)&&(o=d,i=d.lat),(n===!1||d.lat<n)&&(a=d,n=d.lat),(s===!1||d.lng>s)&&(h=d,s=d.lng),(r===!1||d.lng<r)&&(u=d,r=d.lng)}n!==i?(_=a,l=o):(_=u,l=h);var c=[].concat(this.buildConvexHull([_,l],e),this.buildConvexHull([l,_],e));return c}}}(),L.MarkerCluster.include({getConvexHull:function(){var e,t,i=this.getAllChildMarkers(),n=[];for(t=i.length-1;t>=0;t--)e=i[t].getLatLng(),n.push(e);return L.QuickHull.getConvexHull(n)}}),L.MarkerCluster.include({_2PI:2*Math.PI,_circleFootSeparation:25,_circleStartAngle:Math.PI/6,_spiralFootSeparation:28,_spiralLengthStart:11,_spiralLengthFactor:5,_circleSpiralSwitchover:9,spiderfy:function(){if(this._group._spiderfied!==this&&!this._group._inZoomAnimation){var e,t=this.getAllChildMarkers(),i=this._group,n=i._map,s=n.latLngToLayerPoint(this._latlng);this._group._unspiderfy(),this._group._spiderfied=this,t.length>=this._circleSpiralSwitchover?e=this._generatePointsSpiral(t.length,s):(s.y+=10,e=this._generatePointsCircle(t.length,s)),this._animationSpiderfy(t,e)}},unspiderfy:function(e){this._group._inZoomAnimation||(this._animationUnspiderfy(e),this._group._spiderfied=null)},_generatePointsCircle:function(e,t){var i,n,s=this._group.options.spiderfyDistanceMultiplier*this._circleFootSeparation*(2+e),r=s/this._2PI,o=this._2PI/e,a=[];for(a.length=e,i=e-1;i>=0;i--)n=this._circleStartAngle+i*o,a[i]=new L.Point(t.x+r*Math.cos(n),t.y+r*Math.sin(n))._round();return a},_generatePointsSpiral:function(e,t){var i,n=this._group.options.spiderfyDistanceMultiplier,s=n*this._spiralLengthStart,r=n*this._spiralFootSeparation,o=n*this._spiralLengthFactor*this._2PI,a=0,h=[];for(h.length=e,i=e-1;i>=0;i--)a+=r/s+5e-4*i,h[i]=new L.Point(t.x+s*Math.cos(a),t.y+s*Math.sin(a))._round(),s+=o/a;return h},_noanimationUnspiderfy:function(){var e,t,i=this._group,n=i._map,s=i._featureGroup,r=this.getAllChildMarkers();for(i._ignoreMove=!0,this.setOpacity(1),t=r.length-1;t>=0;t--)e=r[t],s.removeLayer(e),e._preSpiderfyLatlng&&(e.setLatLng(e._preSpiderfyLatlng),delete e._preSpiderfyLatlng),e.setZIndexOffset&&e.setZIndexOffset(0),e._spiderLeg&&(n.removeLayer(e._spiderLeg),delete e._spiderLeg);i.fire("unspiderfied",{cluster:this,markers:r}),i._ignoreMove=!1,i._spiderfied=null}}),L.MarkerClusterNonAnimated=L.MarkerCluster.extend({_animationSpiderfy:function(e,t){var i,n,s,r,o=this._group,a=o._map,h=o._featureGroup,u=this._group.options.spiderLegPolylineOptions;for(o._ignoreMove=!0,i=0;i<e.length;i++)r=a.layerPointToLatLng(t[i]),n=e[i],s=new L.Polyline([this._latlng,r],u),a.addLayer(s),n._spiderLeg=s,n._preSpiderfyLatlng=n._latlng,n.setLatLng(r),n.setZIndexOffset&&n.setZIndexOffset(1e6),h.addLayer(n);this.setOpacity(.3),o._ignoreMove=!1,o.fire("spiderfied",{cluster:this,markers:e})},_animationUnspiderfy:function(){this._noanimationUnspiderfy()}}),L.MarkerCluster.include({_animationSpiderfy:function(e,t){var n,s,r,o,a,h,u=this,l=this._group,_=l._map,d=l._featureGroup,c=this._latlng,p=_.latLngToLayerPoint(c),f=L.Path.SVG,m=L.extend({},this._group.options.spiderLegPolylineOptions),g=m.opacity;for(g===i&&(g=L.MarkerClusterGroup.prototype.options.spiderLegPolylineOptions.opacity),f?(m.opacity=0,m.className=(m.className||"")+" leaflet-cluster-spider-leg"):m.opacity=g,l._ignoreMove=!0,n=0;n<e.length;n++)s=e[n],h=_.layerPointToLatLng(t[n]),r=new L.Polyline([c,h],m),_.addLayer(r),s._spiderLeg=r,f&&(o=r._path,a=o.getTotalLength()+.1,o.style.strokeDasharray=a,o.style.strokeDashoffset=a),s.setZIndexOffset&&s.setZIndexOffset(1e6),s.clusterHide&&s.clusterHide(),d.addLayer(s),s._setPos&&s._setPos(p);for(l._forceLayout(),l._animationStart(),n=e.length-1;n>=0;n--)h=_.layerPointToLatLng(t[n]),s=e[n],s._preSpiderfyLatlng=s._latlng,s.setLatLng(h),s.clusterShow&&s.clusterShow(),f&&(r=s._spiderLeg,o=r._path,o.style.strokeDashoffset=0,r.setStyle({opacity:g}));this.setOpacity(.3),l._ignoreMove=!1,setTimeout(function(){l._animationEnd(),l.fire("spiderfied",{cluster:u,markers:e})},200)},_animationUnspiderfy:function(e){var t,i,n,s,r,o,a=this,h=this._group,u=h._map,l=h._featureGroup,_=e?u._latLngToNewLayerPoint(this._latlng,e.zoom,e.center):u.latLngToLayerPoint(this._latlng),d=this.getAllChildMarkers(),c=L.Path.SVG;for(h._ignoreMove=!0,h._animationStart(),this.setOpacity(1),i=d.length-1;i>=0;i--)t=d[i],t._preSpiderfyLatlng&&(t.setLatLng(t._preSpiderfyLatlng),delete t._preSpiderfyLatlng,o=!0,t._setPos&&(t._setPos(_),o=!1),t.clusterHide&&(t.clusterHide(),o=!1),o&&l.removeLayer(t),c&&(n=t._spiderLeg,s=n._path,r=s.getTotalLength()+.1,s.style.strokeDashoffset=r,n.setStyle({opacity:0})));h._ignoreMove=!1,setTimeout(function(){var e=0;for(i=d.length-1;i>=0;i--)t=d[i],t._spiderLeg&&e++;for(i=d.length-1;i>=0;i--)t=d[i],t._spiderLeg&&(t.clusterShow&&t.clusterShow(),t.setZIndexOffset&&t.setZIndexOffset(0),e>1&&l.removeLayer(t),u.removeLayer(t._spiderLeg),delete t._spiderLeg);h._animationEnd(),h.fire("unspiderfied",{cluster:a,markers:d})},200)}}),L.MarkerClusterGroup.include({_spiderfied:null,unspiderfy:function(){this._unspiderfy.apply(this,arguments)},_spiderfierOnAdd:function(){this._map.on("click",this._unspiderfyWrapper,this),this._map.options.zoomAnimation&&this._map.on("zoomstart",this._unspiderfyZoomStart,this),this._map.on("zoomend",this._noanimationUnspiderfy,this),L.Browser.touch||this._map.getRenderer(this)},_spiderfierOnRemove:function(){this._map.off("click",this._unspiderfyWrapper,this),this._map.off("zoomstart",this._unspiderfyZoomStart,this),this._map.off("zoomanim",this._unspiderfyZoomAnim,this),this._map.off("zoomend",this._noanimationUnspiderfy,this),this._noanimationUnspiderfy()},_unspiderfyZoomStart:function(){this._map&&this._map.on("zoomanim",this._unspiderfyZoomAnim,this)},_unspiderfyZoomAnim:function(e){L.DomUtil.hasClass(this._map._mapPane,"leaflet-touching")||(this._map.off("zoomanim",this._unspiderfyZoomAnim,this),this._unspiderfy(e))},_unspiderfyWrapper:function(){this._unspiderfy()},_unspiderfy:function(e){this._spiderfied&&this._spiderfied.unspiderfy(e)},_noanimationUnspiderfy:function(){this._spiderfied&&this._spiderfied._noanimationUnspiderfy()},_unspiderfyLayer:function(e){e._spiderLeg&&(this._featureGroup.removeLayer(e),e.clusterShow&&e.clusterShow(),e.setZIndexOffset&&e.setZIndexOffset(0),this._map.removeLayer(e._spiderLeg),delete e._spiderLeg)}}),L.MarkerClusterGroup.include({refreshClusters:function(e){return e?e instanceof L.MarkerClusterGroup?e=e._topClusterLevel.getAllChildMarkers():e instanceof L.LayerGroup?e=e._layers:e instanceof L.MarkerCluster?e=e.getAllChildMarkers():e instanceof L.Marker&&(e=[e]):e=this._topClusterLevel.getAllChildMarkers(),this._flagParentsIconsNeedUpdate(e),this._refreshClustersIcons(),this.options.singleMarkerMode&&this._refreshSingleMarkerModeMarkers(e),this},_flagParentsIconsNeedUpdate:function(e){var t,i;for(t in e)for(i=e[t].__parent;i;)i._iconNeedsUpdate=!0,i=i.__parent},_refreshSingleMarkerModeMarkers:function(e){var t,i;for(t in e)i=e[t],this.hasLayer(i)&&i.setIcon(this._overrideMarkerIcon(i))}}),L.Marker.include({refreshIconOptions:function(e,t){var i=this.options.icon;return L.setOptions(i,e),this.setIcon(i),t&&this.__parent&&this.__parent._group.refreshClusters(this),this}})}(window,document);
},{}],57:[function(require,module,exports){
module.exports=[
    {
        "name": "Circle stroked",
        "tags": [
            "circle",
            "disc",
            "shape",
            "shapes",
            "geometric",
            "stroke",
            "round"
        ],
        "icon": "circle-stroked"
    },
    {
        "name": "Circle solid",
        "tags": [
            "circle",
            "shape",
            "shapes",
            "geometric",
            "round"
        ],
        "icon": "circle"
    },
    {
        "name": "Square stroked",
        "tags": [
            "box",
            "square",
            "shapes",
            "shape",
            "geometric",
            "stroke"
        ],
        "icon": "square-stroked"
    },
    {
        "name": "Square solid",
        "tags": [
            "box",
            "square",
            "shape",
            "shapes",
            "geometric"
        ],
        "icon": "square"
    },
    {
        "name": "Triangle stroked",
        "tags": [
            "triangle",
            "shape",
            "shapes",
            "geometric",
            "stroke"
        ],
        "icon": "triangle-stroked"
    },
    {
        "name": "Triangle solid",
        "tags": [
            "triangle",
            "shape",
            "shapes",
            "geometric"
        ],
        "icon": "triangle"
    },
    {
        "name": "Star stroked",
        "tags": [
            "star",
            "shape",
            "shapes",
            "geometric",
            "stroke"
        ],
        "icon": "star-stroked"
    },
    {
        "name": "Star solid",
        "tags": [
            "star",
            "shape",
            "shapes",
            "geometric"
        ],
        "icon": "star"
    },
    {
        "name": "Cross",
        "tags": [
            "cross",
            "x",
            "ex",
            "shape",
            "shapes",
            "geometric"
        ],
        "icon": "cross"
    },
    {
        "name": "Marker Stroke",
        "tags": [
            "marker",
            "point",
            "shape",
            "shapes",
            "stroke"
        ],
        "icon": "marker-stroked"
    },
    {
        "name": "Marker Solid",
        "tags": [
            "marker",
            "point",
            "shape",
            "shapes"
        ],
        "icon": "marker"
    },
    {
        "name": "Religious Jewish",
        "tags": [
            "jewish",
            "judaism",
            "hebrew",
            "star",
            "david",
            "religious",
            "religion",
            "temple",
            "synagogue"
        ],
        "icon": "religious-jewish"
    },
    {
        "name": "Religious Christian",
        "tags": [
            "christian",
            "cross",
            "religious",
            "religion",
            "church",
            "cathedral"
        ],
        "icon": "religious-christian"
    },
    {
        "name": "Religious Muslim",
        "tags": [
            "muslim",
            "crescent",
            "star",
            "religious",
            "religion",
            "mosque"
        ],
        "icon": "religious-muslim"
    },
    {
        "name": "Cemetery",
        "tags": [
            "cemetery",
            "graveyard",
            "funeral",
            "religious",
            "religion",
            "memorial"
        ],
        "icon": "cemetery"
    },
    {
        "name": "Rocket",
        "tags": [
            "rocket",
            "space",
            "launch",
            "transportation"
        ],
        "icon": "rocket"
    },
    {
        "name": "Airport",
        "tags": [
            "airplane",
            "plane",
            "airport",
            "transportation"
        ],
        "icon": "airport"
    },
    {
        "name": "Heliport",
        "tags": [
            "heliport",
            "helicopter",
            "transportation"
        ],
        "icon": "heliport"
    },
    {
        "name": "Rail",
        "tags": [
            "rail",
            "train",
            "transportation"
        ],
        "icon": "rail"
    },
    {
        "name": "Rail Metro",
        "tags": [
            "rail",
            "train",
            "metro",
            "subway",
            "rapid-transit",
            "transportation"
        ],
        "icon": "rail-metro"
    },
    {
        "name": "Rail Light",
        "tags": [
            "rail",
            "train",
            "light-rail",
            "transportation"
        ],
        "icon": "rail-light"
    },
    {
        "name": "Bus",
        "tags": [
            "vehicle",
            "bus",
            "transportation"
        ],
        "icon": "bus"
    },
    {
        "name": "Fuel",
        "tags": [
            "petrol",
            "fuel",
            "gas",
            "transportation",
            "station"
        ],
        "icon": "fuel"
    },
    {
        "name": "Parking",
        "tags": [
            "parking",
            "transportation"
        ],
        "icon": "parking"
    },
    {
        "name": "Parking Garage",
        "tags": [
            "parking",
            "transportation",
            "garage"
        ],
        "icon": "parking-garage"
    },
    {
        "name": "Airfield",
        "tags": [
            "airfield",
            "airport",
            "plane",
            "landing strip"
        ],
        "icon": "airfield"
    },
    {
        "name": "Roadblock",
        "tags": [
            "roadblock",
            "stop",
            "warning",
            "dead end"
        ],
        "icon": "roadblock"
    },
    {
        "name": "Ferry",
        "tags": [
            "ship",
            "boat",
            "water",
            "ferry",
            "transportation"
        ],
        "icon": "ferry"
    },
    {
        "name": "Harbor",
        "tags": [
            "marine",
            "dock",
            "water",
            "wharf"
        ],
        "icon": "harbor"
    },
    {
        "name": "Bicycle",
        "tags": [
            "cycling",
            "cycle",
            "transportation"
        ],
        "icon": "bicycle"
    },
    {
        "name": "Park",
        "tags": [
            "recreation",
            "park",
            "forest",
            "tree",
            "green",
            "woods",
            "nature"
        ],
        "icon": "park"
    },
    {
        "name": "Park 2",
        "tags": [
            "recreation",
            "park",
            "forest",
            "tree",
            "green",
            "woods",
            "nature"
        ],
        "icon": "park2"
    },
    {
        "name": "Museum",
        "tags": [
            "recreation",
            "museum",
            "tourism"
        ],
        "icon": "museum"
    },
    {
        "name": "Lodging",
        "tags": [
            "lodging",
            "hotel",
            "recreation",
            "motel",
            "tourism"
        ],
        "icon": "lodging"
    },
    {
        "name": "Monument",
        "tags": [
            "recreation",
            "statue",
            "monument",
            "tourism"
        ],
        "icon": "monument"
    },
    {
        "name": "Zoo",
        "tags": [
            "recreation",
            "zoo",
            "animal",
            "giraffe"
        ],
        "icon": "zoo"
    },
    {
        "name": "Garden",
        "tags": [
            "recreation",
            "garden",
            "park",
            "flower",
            "nature"
        ],
        "icon": "garden"
    },
    {
        "name": "Campsite",
        "tags": [
            "recreation",
            "campsite",
            "camp",
            "camping",
            "tent",
            "nature"
        ],
        "icon": "campsite"
    },
    {
        "name": "Theatre",
        "tags": [
            "recreation",
            "theatre",
            "theater",
            "entertainment",
            "play",
            "performance"
        ],
        "icon": "theatre"
    },
    {
        "name": "Art gallery",
        "tags": [
            "art",
            "center",
            "museum",
            "gallery",
            "creative",
            "recreation",
            "entertainment",
            "studio"
        ],
        "icon": "art-gallery"
    },
    {
        "name": "Pitch",
        "tags": [
            "pitch",
            "track",
            "athletic",
            "sports",
            "field"
        ],
        "icon": "pitch"
    },
    {
        "name": "Soccer",
        "tags": [
            "soccer",
            "sports"
        ],
        "icon": "soccer"
    },
    {
        "name": "American Football",
        "tags": [
            "football",
            "sports"
        ],
        "icon": "america-football"
    },
    {
        "name": "Tennis",
        "tags": [
            "tennis",
            "court",
            "ball",
            "sports"
        ],
        "icon": "tennis"
    },
    {
        "name": "Basketball",
        "tags": [
            "basketball",
            "ball",
            "sports"
        ],
        "icon": "basketball"
    },
    {
        "name": "Baseball",
        "tags": [
            "baseball",
            "softball",
            "ball",
            "sports"
        ],
        "icon": "baseball"
    },
    {
        "name": "Golf",
        "tags": [
            "golf",
            "sports",
            "course"
        ],
        "icon": "golf"
    },
    {
        "name": "Swimming",
        "tags": [
            "swimming",
            "water",
            "swim",
            "sports"
        ],
        "icon": "swimming"
    },
    {
        "name": "Cricket",
        "tags": [
            "cricket",
            "sports"
        ],
        "icon": "cricket"
    },
    {
        "name": "Skiing",
        "tags": [
            "winter",
            "skiing",
            "ski",
            "sports"
        ],
        "icon": "skiing"
    },
    {
        "name": "School",
        "tags": [
            "school",
            "highschool",
            "elementary",
            "children",
            "amenity",
            "middle"
        ],
        "icon": "school"
    },
    {
        "name": "College",
        "tags": [
            "college",
            "school",
            "amenity",
            "university"
        ],
        "icon": "college"
    },
    {
        "name": "Library",
        "tags": [
            "library",
            "books",
            "amenity"
        ],
        "icon": "library"
    },
    {
        "name": "Post",
        "tags": [
            "post",
            "office",
            "amenity",
            "mail",
            "letter"
        ],
        "icon": "post"
    },
    {
        "name": "Fire station",
        "tags": [
            "fire",
            "station",
            "amenity"
        ],
        "icon": "fire-station"
    },
    {
        "name": "Town hall",
        "tags": [
            "townhall",
            "mayor",
            "building",
            "amenity",
            "government"
        ],
        "icon": "town-hall"
    },
    {
        "name": "Police",
        "tags": [
            "police",
            "jail",
            "arrest",
            "amenity",
            "station"
        ],
        "icon": "police"
    },
    {
        "name": "Prison",
        "tags": [
            "prison",
            "jail",
            "amenity"
        ],
        "icon": "prison"
    },
    {
        "name": "Embassy",
        "tags": [
            "embassy",
            "diplomacy",
            "consulate",
            "amenity",
            "flag"
        ],
        "icon": "embassy"
    },
    {
        "name": "Beer",
        "tags": [
            "bar",
            "beer",
            "drink",
            "commercial",
            "biergarten",
            "pub"
        ],
        "icon": "beer"
    },
    {
        "name": "Restaurant",
        "tags": [
            "restaurant",
            "commercial"
        ],
        "icon": "restaurant"
    },
    {
        "name": "Cafe",
        "tags": [
            "cafe",
            "coffee",
            "commercial",
            "tea"
        ],
        "icon": "cafe"
    },
    {
        "name": "Shop",
        "tags": [
            "shop",
            "mall",
            "commercial",
            "store"
        ],
        "icon": "shop"
    },
    {
        "name": "Fast Food",
        "tags": [
            "food",
            "fast",
            "commercial",
            "burger",
            "drive-through"
        ],
        "icon": "fast-food"
    },
    {
        "name": "Bar",
        "tags": [
            "bar",
            "drink",
            "commercial",
            "club",
            "martini",
            "lounge"
        ],
        "icon": "bar"
    },
    {
        "name": "Bank",
        "tags": [
            "bank",
            "atm",
            "commercial",
            "money"
        ],
        "icon": "bank"
    },
    {
        "name": "Grocery",
        "tags": [
            "food",
            "grocery",
            "commercial",
            "store",
            "market"
        ],
        "icon": "grocery"
    },
    {
        "name": "Cinema",
        "tags": [
            "cinema",
            "theatre",
            "film",
            "movie",
            "commercial",
            "theater",
            "entertainment"
        ],
        "icon": "cinema"
    },
    {
        "name": "Pharmacy",
        "tags": [
            "pharmacy",
            "drugs",
            "medication",
            "social",
            "medicine",
            "prescription"
        ],
        "icon": "pharmacy"
    },
    {
        "name": "Hospital",
        "tags": [
            "hospital",
            "health",
            "medication",
            "social",
            "medicine",
            "medical",
            "clinic"
        ],
        "icon": "hospital"
    },
    {
        "name": "Danger",
        "tags": [
            "minefield",
            "landmine",
            "disaster",
            "dangerous",
            "hazard"
        ],
        "icon": "danger"
    },
    {
        "name": "Industrial",
        "tags": [
            "industrial",
            "factory",
            "property",
            "building"
        ],
        "icon": "industrial"
    },
    {
        "name": "Warehouse",
        "tags": [
            "warehouse",
            "property",
            "storage",
            "building"
        ],
        "icon": "warehouse"
    },
    {
        "name": "Commercial",
        "tags": [
            "commercial",
            "property",
            "business",
            "building"
        ],
        "icon": "commercial"
    },
    {
        "name": "Building",
        "tags": [
            "building",
            "property",
            "structure",
            "business",
            "building"
        ],
        "icon": "building"
    },
    {
        "name": "Place of worship",
        "tags": [
            "religion",
            "ceremony",
            "religious",
            "nondenominational",
            "church",
            "temple"
        ],
        "icon": "place-of-worship"
    },
    {
        "name": "Alcohol shop",
        "tags": [
            "alcohol",
            "liquor",
            "store",
            "shop",
            "beer",
            "wine",
            "vodka"
        ],
        "icon": "alcohol-shop"
    },
    {
        "name": "Logging",
        "tags": [
            "logger",
            "chainsaw",
            "woods",
            "industry"
        ],
        "icon": "logging"
    },
    {
        "name": "Oil well",
        "tags": [
            "oil",
            "natural",
            "environment",
            "industry",
            "resources"
        ],
        "icon": "oil-well"
    },
    {
        "name": "Slaughterhouse",
        "tags": [
            "cows",
            "cattle",
            "food",
            "meat",
            "industry",
            "resources"
        ],
        "icon": "slaughterhouse"
    },
    {
        "name": "Dam",
        "tags": [
            "water",
            "natural",
            "hydro",
            "hydroelectric",
            "energy",
            "environment",
            "industry",
            "resources"
        ],
        "icon": "dam"
    },
    {
    "name": "Water",
    "tags": [
        "water",
        "natural",
        "hydro",
        "lake",
        "river",
        "ocean",
        "resources"
    ],
    "icon": "water"
    },
    {
    "name": "Wetland",
    "tags": [
        "water",
        "swamp",
        "natural"
    ],
    "icon": "wetland"
    },
    {
    "name": "Disability",
    "tags": [
        "handicap",
        "wheelchair",
        "access"
    ],
    "icon": "disability"
    },
    {
    "name": "Telephone",
    "tags": [
        "payphone",
        "call"
    ],
    "icon": "telephone"
    },
    {
    "name": "Emergency Telephone",
    "tags": [
        "payphone",
        "danger",
        "safety",
        "call"
    ],
    "icon": "emergency-telephone"
    },
    {
    "name": "Toilets",
    "tags": [
        "bathroom",
        "men",
        "women",
        "sink",
        "washroom",
        "lavatory"
    ],
    "icon": "toilets"
    },
    {
    "name": "Waste Basket",
    "tags": [
        "trash",
        "rubbish",
        "bin",
        "garbage"
    ],
    "icon": "waste-basket"
    },
    {
    "name": "Music",
    "tags": [
        "stage",
        "performance",
        "band",
        "concert",
        "venue"
    ],
    "icon": "music"
    },
    {
    "name": "Land Use",
    "tags": [
        "zoning",
        "usage",
        "area"
    ],
    "icon": "land-use"
    },
    {
    "name": "City",
    "tags": [
        "area",
        "point",
        "place",
        "urban"
    ],
    "icon": "city"
    },
    {
    "name": "Town",
    "tags": [
        "area",
        "point",
        "place",
        "small"
    ],
    "icon": "town"
    },
    {
    "name": "Village",
    "tags": [
        "area",
        "point",
        "place",
        "small",
        "rural"
    ],
    "icon": "village"
    },
    {
    "name": "Farm",
    "tags": [
        "building",
        "farming",
        "crops",
        "plants",
        "agriculture",
        "rural"
    ],
    "icon": "farm"
    },
    {
    "name": "Bakery",
    "tags": [
        "bakery",
        "pastry",
        "croissant",
        "food",
        "shop",
        "bread"
    ],
    "icon": "bakery"
    },
	{
    "name": "Dog Park",
    "tags": [
        "dog",
        "pet"
    ],
    "icon": "dog-park"
    },
   {
    "name": "Lighthouse",
    "tags": [
        "building",
        "navigation",
        "nautical",
        "ocean",
        "logistics"
    ],
    "icon": "lighthouse"
    },
    {
    "name": "Clothing Store",
    "tags": [
        "clothing",
        "store",
        "shop"
    ],
    "icon": "clothing-store"
    },
    {
    "name": "Polling Place",
    "tags": [
        "poll",
        "polling",
        "vote"
    ],
    "icon": "polling-place"
    },
    {
    "name": "Playground",
    "tags": [
        "playground",
        "play",
        "park",
        "children"
    ],
    "icon": "playground"
    },
    {
    "name": "Entrance",
    "tags": [
        "entrance",
        "enter",
        "subway",
        "rail"
    ],
    "icon": "entrance"
    },
    {
    "name": "Heart",
    "tags": [
        "heart",
        "love",
        "shape",
        "shapes",
        "wedding"
    ],
    "icon": "heart"
    },
    {
    "name": "London Underground",
    "tags": [
        "deprecated"
    ],
    "icon": "london-underground"
    },
    {
    "name": "Minefield",
    "tags": [
        "deprecated"
    ],
    "icon": "minefield"
    },
    {
    "name": "Rail Underground",
    "tags": [
        "deprecated"
    ],
    "icon": "rail-underground"
    },
    {
    "name": "Rail Above",
    "tags": [
        "deprecated"
    ],
    "icon": "rail-above"
    },
    {
     "name": "Camera",
     "tags": [
         "camera",
         "photo",
         "commercial",
         "shop"
     ],
     "icon": "camera"
    },
    {
    "name": "Laundry",
    "tags": [
        "laundry",
        "washing machine",
        "dry_cleaning",
        "commercial",
        "store"
    ],
    "icon": "laundry"
    },
    {
        "name": "Car",
        "tags": [
            "car",
            "auto",
            "vehicle",
            "transportation"
        ],
        "icon": "car"
    },
    {
    "name": "Suitcase",
    "tags": [
      "suitcase",
      "travel",
      "travel agency",
      "commercial",
      "store"
    ],
    "icon": "suitcase"
    },
    {
    "name": "Hairdresser",
    "tags": [
      "scissors",
      "barber shop",
      "barber",
      "stylist",
      "hair",
      "cut",
      "salon"
    ],
    "icon": "hairdresser"
    },
    {
    "name": "Chemist",
    "tags": [
      "shop",
      "science",
      "chemistry",
      "experiment",
      "research",
      "pharmacy"
    ],
    "icon": "chemist"
    },
    {
    "name": "Mobile phone",
    "tags": [
      "phone",
      "cellphone",
      "communication",
      "mobile"
    ],
    "icon": "mobilephone"
    },
    {
    "name": "Scooter",
    "tags": [
      "bike",
      "transportation",
      "vehicle",
      "route",
      "moped",
      "motorcycle"
    ],
    "icon": "scooter"
    },
    {
    "name": "Gift",
    "tags": [
      "gift",
      "shop",
      "commercial",
      "store"
    ],
    "icon": "gift"
    },
    {
    "name": "Ice cream",
    "tags": [
      "ice",
      "sweets",
      "food",
      "shop"
    ],
    "icon": "ice-cream"
    },
    {
    "name": "Dentist",
    "tags": [
      "dentist",
      "tooth",
      "health",
      "medication",
      "social",
      "medicine",
      "medical"
    ],
    "icon": "dentist"
    },
    {
    "name": "Aerialway",
    "tags": [
      "gondola",
      "cable_car",
      "chairlift",
      "draglift"
    ],
    "icon": "aerialway"
    }
]

},{}],58:[function(require,module,exports){
/* http://nanobar.micronube.com/  ||  https://github.com/jacoborus/nanobar/    MIT LICENSE */
(function (root) {
  'use strict'
  // container styles
  var css = '.nanobar{width:100%;height:4px;z-index:9999;top:0}.bar{width:0;height:100%;transition:height .3s;background:#000}'

  // add required css in head div
  function addCss () {
    var s = document.getElementById('nanobarcss')

    // check whether style tag is already inserted
    if (s === null) {
      s = document.createElement('style')
      s.type = 'text/css'
      s.id = 'nanobarcss'
      document.head.insertBefore(s, document.head.firstChild)
      // the world
      if (!s.styleSheet) return s.appendChild(document.createTextNode(css))
      // IE
      s.styleSheet.cssText = css
    }
  }

  function addClass (el, cls) {
    if (el.classList) el.classList.add(cls)
    else el.className += ' ' + cls
  }

  // create a progress bar
  // this will be destroyed after reaching 100% progress
  function createBar (rm) {
    // create progress element
    var el = document.createElement('div'),
        width = 0,
        here = 0,
        on = 0,
        bar = {
          el: el,
          go: go
        }

    addClass(el, 'bar')

    // animation loop
    function move () {
      var dist = width - here

      if (dist < 0.1 && dist > -0.1) {
        place(here)
        on = 0
        if (width === 100) {
          el.style.height = 0
          setTimeout(function () {
            rm(el)
          }, 300)
        }
      } else {
        place(width - dist / 4)
        setTimeout(go, 16)
      }
    }

    // set bar width
    function place (num) {
      width = num
      el.style.width = width + '%'
    }

    function go (num) {
      if (num >= 0) {
        here = num
        if (!on) {
          on = 1
          move()
        }
      } else if (on) {
        move()
      }
    }
    return bar
  }

  function Nanobar (opts) {
    opts = opts || {}
    // set options
    var el = document.createElement('div'),
        applyGo,
        nanobar = {
          el: el,
          go: function (p) {
            // expand bar
            applyGo(p)
            // create new bar when progress reaches 100%
            if (p === 100) {
              init()
            }
          }
        }

    // remove element from nanobar container
    function rm (child) {
      el.removeChild(child)
    }

    // create and insert progress var in nanobar container
    function init () {
      var bar = createBar(rm)
      el.appendChild(bar.el)
      applyGo = bar.go
    }

    addCss()

    addClass(el, 'nanobar')
    if (opts.id) el.id = opts.id
    if (opts.classname) addClass(el, opts.classname)

    // insert container
    if (opts.target) {
      // inside a div
      el.style.position = 'relative'
      opts.target.insertBefore(el, opts.target.firstChild)
    } else {
      // on top of the page
      el.style.position = 'fixed'
      document.getElementsByTagName('body')[0].appendChild(el)
    }

    init()
    return nanobar
  }

  if (typeof exports === 'object') {
    // CommonJS
    module.exports = Nanobar
  } else if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], function () { return Nanobar })
  } else {
    // Browser globals
    root.Nanobar = Nanobar
  }
}(this))

},{}],59:[function(require,module,exports){
module.exports=[
  {
    "name": "AED (Black)",
    "tags": [
      "aed",
      "automated external defibrillator",
      "defibrillator"
    ],
    "icon": "aed-black",
    "release": "2.0.0"
  },
  {
    "name": "AED (White)",
    "tags": [
      "aed",
      "automated external defibrillator",
      "defibrillator"
    ],
    "icon": "aed-white",
    "release": "2.0.0"
  },
  {
    "name": "Airport (Black)",
    "tags": [
      "airport",
      "plane",
      "travel"
    ],
    "icon": "airport-black",
    "release": "1.0.0"
  },
  {
    "name": "Airport (White)",
    "tags": [
      "airport",
      "plane",
      "travel"
    ],
    "icon": "airport-white",
    "release": "1.0.0"
  },
  {
    "name": "All-Terrain Trail (Black)",
    "tags": [
      "all terrain vehicle trail",
      "atv",
      "off road",
      "ohv",
      "orv trail",
      "quad"
    ],
    "icon": "all-terrain-trail-black",
    "release": "2.2.0"
  },
  {
    "name": "All-Terrain Trail (White)",
    "tags": [
      "all terrain vehicle trail",
      "atv",
      "off road",
      "ohv",
      "orv trail",
      "quad"
    ],
    "icon": "all-terrain-trail-white",
    "release": "2.2.0"
  },
  {
    "name": "Amphitheater (Black)",
    "tags": [
      "amphitheater",
      "theater",
      "leisure"
    ],
    "icon": "amphitheater-black",
    "release": "1.0.0"
  },
  {
    "name": "Amphitheater (White)",
    "tags": [
      "amphitheater",
      "theater",
      "leisure"
    ],
    "icon": "amphitheater-white",
    "release": "1.0.0"
  },
  {
    "name": "ATM (Black)",
    "tags": [
      "atm",
      "automated teller machine",
      "cash",
      "cash dispenser"
    ],
    "icon": "atm-black",
    "release": "2.2.0"
  },
  {
    "name": "ATM (White)",
    "tags": [
      "atm",
      "automated teller machine",
      "cash",
      "cash dispenser"
    ],
    "icon": "atm-white",
    "release": "2.2.0"
  },
  {
    "name": "Bear (Black)",
    "tags": [
      "bear"
    ],
    "icon": "bear-black",
    "release": "1.0.0"
  },
  {
    "name": "Bear (White)",
    "tags": [
      "bear"
    ],
    "icon": "bear-white",
    "release": "1.0.0"
  },
  {
    "name": "Beach Access (Black)",
    "tags": [
      "beach",
      "coast",
      "shore",
      "strand"
    ],
    "icon": "beach-access-black",
    "release": "2.2.0"
  },
  {
    "name": "Beach Access (White)",
    "tags": [
      "beach",
      "coast",
      "shore",
      "strand"
    ],
    "icon": "beach-access-white",
    "release": "2.2.0"
  },
  {
    "name": "Bike Trail (Black)",
    "tags": [
      "bike",
      "cycling",
      "trail"
    ],
    "icon": "bicycle-trail-black",
    "release": "1.0.0"
  },
  {
    "name": "Bike Trail (White)",
    "tags": [
      "bike",
      "cycling",
      "trail"
    ],
    "icon": "bicycle-trail-white",
    "release": "1.0.0"
  },
  {
    "name": "Boat Launch (Black)",
    "tags": [
      "boats",
      "sailing",
      "recreation"
    ],
    "icon": "boat-launch-black",
    "release": "1.0.0"
  },
  {
    "name": "Boat Launch (White)",
    "tags": [
      "boats",
      "sailing",
      "recreation"
    ],
    "icon": "boat-launch-white",
    "release": "1.0.0"
  },
  {
    "name": "Boat Tour (Black)",
    "tags": [
      "boats",
      "sailing",
      "recreation"
    ],
    "icon": "boat-tour-black",
    "release": "1.0.0"
  },
  {
    "name": "Boat Tour (White)",
    "tags": [
      "boats",
      "sailing",
      "recreation"
    ],
    "icon": "boat-tour-white",
    "release": "1.0.0"
  },
  {
    "name": "Bookstore (Black)",
    "tags": [
      "book",
      "reading",
      "shop",
      "shopping"
    ],
    "icon": "bookstore-black",
    "release": "2.2.0"
  },
  {
    "name": "Bookstore (White)",
    "tags": [
      "book",
      "reading",
      "shop",
      "shopping"
    ],
    "icon": "bookstore-white",
    "release": "2.2.0"
  },
  {
    "name": "Bus and Shuttle Stop (Black)",
    "tags": [
      "bus",
      "shuttle",
      "transportation"
    ],
    "icon": "bus-stop-black",
    "release": "1.0.0"
  },
  {
    "name": "Bus and Shuttle Stop (White)",
    "tags": [
      "bus",
      "shuttle",
      "transportation"
    ],
    "icon": "bus-stop-white",
    "release": "1.0.0"
  },
  {
    "name": "Campfire (Black)",
    "tags": [
      "campfire"
    ],
    "icon": "campfire-black",
    "release": "1.0.0"
  },
  {
    "name": "Campfire (White)",
    "tags": [
      "campfire"
    ],
    "icon": "campfire-white",
    "release": "1.0.0"
  },
  {
    "name": "Camping (Black)",
    "tags": [
      "camp",
      "campsite",
      "tent"
    ],
    "icon": "campground-black",
    "release": "1.0.0"
  },
  {
    "name": "Camping (White)",
    "tags": [
      "camp",
      "campsite",
      "tent"
    ],
    "icon": "campground-white",
    "release": "1.0.0"
  },
  {
    "name": "Campsite (Black)",
    "tags": [
      "camp",
      "campsite",
      "tent"
    ],
    "icon": "campsite-black",
    "release": "1.0.0"
  },
  {
    "name": "Campsite (White)",
    "tags": [
      "camp",
      "campsite",
      "tent"
    ],
    "icon": "campsite-white",
    "release": "1.0.0"
  },
  {
    "name": "Canoe Access (Black)",
    "tags": [
      "canoe access",
      "canoe",
      "recreation"
    ],
    "icon": "canoe-access-black",
    "release": "1.0.0"
  },
  {
    "name": "Canoe Access (White)",
    "tags": [
      "canoe access",
      "canoe",
      "recreation"
    ],
    "icon": "canoe-access-white",
    "release": "1.0.0"
  },
  {
    "name": "Cave (Black)",
    "tags": [
      "cave",
      "cave entrance",
      "cavern",
      "grotto"
    ],
    "icon": "cave-black",
    "release": "2.2.0"
  },
  {
    "name": "Cave (White)",
    "tags": [
      "cave",
      "cave entrance",
      "cavern",
      "grotto"
    ],
    "icon": "cave-white",
    "release": "2.2.0"
  },
  {
    "name": "Cross Country Ski Trail (Black)",
    "tags": [
      "cross country ski trail",
      "skiing",
      "cross country"
    ],
    "icon": "cross-country-ski-trail-black",
    "release": "1.0.0"
  },
  {
    "name": "Cross Country Ski Trail (White)",
    "tags": [
      "cross country ski trail",
      "skiing",
      "cross country"
    ],
    "icon": "cross-country-ski-trail-white",
    "release": "1.0.0"
  },
  {
    "name": "Dam (Black)",
    "tags": [
      "dam",
      "breakwater",
      "dike",
      "jetty"
    ],
    "icon": "dam-black",
    "release": "2.2.0"
  },
  {
    "name": "Dam (White)",
    "tags": [
      "dam",
      "breakwater",
      "dike",
      "jetty"
    ],
    "icon": "dam-white",
    "release": "2.2.0"
  },
  {
    "name": "Downhill Skiing (Black)",
    "tags": [
      "downhill skiing",
      "ski",
      "recreation"
    ],
    "icon": "downhill-skiing-black",
    "release": "1.0.0"
  },
  {
    "name": "Downhill Skiing (White)",
    "tags": [
      "downhill skiing",
      "ski",
      "recreation"
    ],
    "icon": "downhill-skiing-white",
    "release": "1.0.0"
  },
  {
    "name": "Dot (Black)",
    "tags": [
      "circle marker",
      "generic",
      "dot"
    ],
    "icon": "dot-black",
    "release": "2.2.0"
  },
  {
    "name": "Dot (White)",
    "tags": [
      "circle marker",
      "generic",
      "dot"
    ],
    "icon": "dot-white",
    "release": "2.2.0"
  },
  {
    "name": "Drinking Water (Black)",
    "tags": [
      "drinking water",
      "water"
    ],
    "icon": "drinking-water-black",
    "release": "1.0.0"
  },
  {
    "name": "Drinking Water (White)",
    "tags": [
      "drinking water",
      "water"
    ],
    "icon": "drinking-water-white",
    "release": "1.0.0"
  },
  {
    "name": "Emergency Telephone (Black)",
    "tags": [
      "emergency telephone",
      "phone"
    ],
    "icon": "emergency-telephone-black",
    "release": "2.2.0"
  },
  {
    "name": "Emergency Telephone (White)",
    "tags": [
      "emergency telephone",
      "phone"
    ],
    "icon": "emergency-telephone-white",
    "release": "2.2.0"
  },
  {
    "name": "Entrance (Black)",
    "tags": [
      "entrance",
      "building"
    ],
    "icon": "entrance-black",
    "release": "2.0.0"
  },
  {
    "name": "Entrance (White)",
    "tags": [
      "entrance",
      "building"
    ],
    "icon": "entrance-white",
    "release": "2.0.0"
  },
  {
    "name": "Entrance Station (Black)",
    "tags": [
      "entrance station",
      "entry",
      "gateway",
      "portal"
    ],
    "icon": "entrance-station-black",
    "release": "2.0.0"
  },
  {
    "name": "Entrance Station (White)",
    "tags": [
      "entrance station",
      "entry",
      "gateway",
      "portal"
    ],
    "icon": "entrance-station-white",
    "release": "2.0.0"
  },
  {
    "name": "First Aid (Black)",
    "tags": [
      "first aid",
      "medical"
    ],
    "icon": "first-aid-black",
    "release": "1.0.0"
  },
  {
    "name": "First Aid (White)",
    "tags": [
      "first aid",
      "medical"
    ],
    "icon": "first-aid-white",
    "release": "1.0.0"
  },
  {
    "name": "Fishing (Black)",
    "tags": [
      "fishing",
      "recreation"
    ],
    "icon": "fishing-black",
    "release": "1.0.0"
  },
  {
    "name": "Fishing (White)",
    "tags": [
      "fishing",
      "recreation"
    ],
    "icon": "fishing-white",
    "release": "1.0.0"
  },
  {
    "name": "Flagpole (Black)",
    "tags": [
      "flagpole",
      "flag"
    ],
    "icon": "flagpole-black",
    "release": "2.0.0"
  },
  {
    "name": "Flagpole (White)",
    "tags": [
      "flagpole",
      "flag"
    ],
    "icon": "flagpole-white",
    "release": "2.0.0"
  },
  {
    "name": "Food Cache (Black)",
    "tags": [
      "food cache",
      "food box",
      "food stoage"
    ],
    "icon": "food-cache-black",
    "release": "2.0.0"
  },
  {
    "name": "Food Cache (White)",
    "tags": [
      "food cache",
      "food box",
      "food stoage"
    ],
    "icon": "food-cache-white",
    "release": "2.0.0"
  },
  {
    "name": "Food Service (Black)",
    "tags": [
      "food",
      "restaurant",
      "dining"
    ],
    "icon": "food-service-black",
    "release": "1.0.0"
  },
  {
    "name": "Food Service (White)",
    "tags": [
      "food",
      "restaurant",
      "dining"
    ],
    "icon": "food-service-white",
    "release": "1.0.0"
  },
  {
    "name": "Four Wheel Drive (Black)",
    "tags": [
      "4 wheel drive",
      "off road"
    ],
    "icon": "four-wheel-drive-road-black",
    "release": "1.0.0"
  },
  {
    "name": "Four Wheel Drive (White)",
    "tags": [
      "4 wheel drive",
      "off road"
    ],
    "icon": "four-wheel-drive-road-white",
    "release": "1.0.0"
  },
  {
    "name": "Gas Station (Black)",
    "tags": [
      "gas",
      "fuel",
      "service"
    ],
    "icon": "gas-station-black",
    "release": "1.0.0"
  },
  {
    "name": "Gas Station (White)",
    "tags": [
      "gas",
      "fuel",
      "service"
    ],
    "icon": "gas-station-white",
    "release": "1.0.0"
  },
  {
    "name": "Golfing (Black)",
    "tags": [
      "golfing",
      "golf"
    ],
    "icon": "golfing-black",
    "release": "1.0.0"
  },
  {
    "name": "Golfing (White)",
    "tags": [
      "golifing",
      "golf"
    ],
    "icon": "golfing-white",
    "release": "1.0.0"
  },
  {
    "name": "Historic Feature (Black)",
    "tags": [
      "historic",
      "site",
      "ruin",
      "monument",
      "memorial"
    ],
    "icon": "historic-feature-black",
    "release": "2.2.0"
  },
  {
    "name": "Historic Feature (White)",
    "tags": [
      "historic",
      "site",
      "ruin",
      "monument",
      "memorial"
    ],
    "icon": "historic-feature-white",
    "release": "2.2.0"
  },
  {
    "name": "Horseback Riding (Black)",
    "tags": [
      "horseback riding",
      "horseback rental",
      "horseback tour"
    ],
    "icon": "horseback-riding-black",
    "release": "1.0.0"
  },
  {
    "name": "Horseback Riding (White)",
    "tags": [
      "horseback riding",
      "horseback rental",
      "horseback tour"
    ],
    "icon": "horseback-riding-white",
    "release": "1.0.0"
  },
  {
    "name": "Hospital (Black)",
    "tags": [
      "hospital"
    ],
    "icon": "hospital-black",
    "release": "1.0.0"
  },
  {
    "name": "Hospital (White)",
    "tags": [
      "hospital"
    ],
    "icon": "hospital-white",
    "release": "1.0.0"
  },
  {
    "name": "Ice Skating (Black)",
    "tags": [
      "ice skating",
      "skating"
    ],
    "icon": "ice-skating-black",
    "release": "1.0.0"
  },
  {
    "name": "Ice Skating (White)",
    "tags": [
      "ice skating",
      "skating"
    ],
    "icon": "ice-skating-white",
    "release": "1.0.0"
  },
  {
    "name": "Information (Black)",
    "tags": [
      "information",
      "service"
    ],
    "icon": "information-black",
    "release": "1.0.0"
  },
  {
    "name": "Information (White)",
    "tags": [
      "information",
      "service"
    ],
    "icon": "information-white",
    "release": "1.0.0"
  },
  {
    "name": "Interpretive Exhibit (Black)",
    "tags": [
      "information",
      "attraction",
      "exhibit",
      "wayside",
      "interpretive sign",
      "tourist attraction"
    ],
    "icon": "interpretive-exhibit-black",
    "release": "2.2.0"
  },
  {
    "name": "Interpretive Exhibit (White)",
    "tags": [
      "information",
      "attraction",
      "exhibit",
      "wayside",
      "interpretive sign",
      "tourist attraction"
    ],
    "icon": "interpretive-exhibit-white",
    "release": "2.2.0"
  },
  {
    "name": "Laundry (Black)",
    "tags": [
      "laundry",
      "laundromat",
      "service"
    ],
    "icon": "laundry-black",
    "release": "2.0.0"
  },
  {
    "name": "Laundry (White)",
    "tags": [
      "laundry",
      "laundromat",
      "service"
    ],
    "icon": "laundry-white",
    "release": "2.0.0"
  },
  {
    "name": "Library (Black)",
    "tags": [
      "book",
      "reading",
      "information"
    ],
    "icon": "library-black",
    "release": "2.2.0"
  },
  {
    "name": "Library (White)",
    "tags": [
      "book",
      "reading",
      "information"
    ],
    "icon": "library-white",
    "release": "2.2.0"
  },
  {
    "name": "Lighthouse (Black)",
    "tags": [
      "lighthouse",
      "beacon"
    ],
    "icon": "lighthouse-black",
    "release": "2.2.0"
  },
  {
    "name": "Lighthouse (White)",
    "tags": [
      "lighthouse",
      "beacon"
    ],
    "icon": "lighthouse-white",
    "release": "2.2.0"
  },
  {
    "name": "Litter Receptacle (Black)",
    "tags": [
      "litter receptacle",
      "trash can"
    ],
    "icon": "litter-receptacle-black",
    "release": "1.0.0"
  },
  {
    "name": "Litter Receptacle (White)",
    "tags": [
      "litter receptacle",
      "trash can"
    ],
    "icon": "litter-receptacle-white",
    "release": "1.0.0"
  },
  {
    "name": "Lodging (Black)",
    "tags": [
      "hotel",
      "motel",
      "lodging"
    ],
    "icon": "lodging-black",
    "release": "1.0.0"
  },
  {
    "name": "Lodging (White)",
    "tags": [
      "hotel",
      "motel",
      "lodging"
    ],
    "icon": "lodging-white",
    "release": "1.0.0"
  },
  {
    "name": "Lookout Tower (Black)",
    "tags": [
      "lookout tower",
      "fire tower",
      "water tower"
    ],
    "icon": "lookout-tower-black",
    "release": "2.2.0"
  },
  {
    "name": "Lookout Tower (White)",
    "tags": [
      "lookout tower",
      "fire tower",
      "water tower"
    ],
    "icon": "lookout-tower-white",
    "release": "2.2.0"
  },
  {
    "name": "Marina (Black)",
    "tags": [
      "marina"
    ],
    "icon": "marina-black",
    "release": "1.0.0"
  },
  {
    "name": "Marina (White)",
    "tags": [
      "marina"
    ],
    "icon": "marina-white",
    "release": "1.0.0"
  },
  {
    "name": "Mechanic (Black)",
    "tags": [
      "mechanic",
      "auto shop",
      "boat house",
      "bus barn",
      "maintenance",
      "utility building",
      "workshop"
    ],
    "icon": "mechanic-black",
    "release": "2.2.0"
  },
  {
    "name": "Mechanic (White)",
    "tags": [
      "mechanic",
      "auto shop",
      "boat house",
      "bus barn",
      "maintenance",
      "utility building",
      "workshop"
    ],
    "icon": "mechanic-white",
    "release": "2.2.0"
  },
  {
    "name": "Motor Bike Trail (Black)",
    "tags": [
      "motor bike trail"
    ],
    "icon": "motor-bike-trail-black",
    "release": "1.0.0"
  },
  {
    "name": "Motor Bike Trail (White)",
    "tags": [
      "motor bike trail"
    ],
    "icon": "motor-bike-trail-white",
    "release": "1.0.0"
  },
  {
    "name": "Museum (Black)",
    "tags": [
      "history",
      "nature",
      "tourist attraction"
    ],
    "icon": "museum-black",
    "release": "2.2.0"
  },
  {
    "name": "Museum (White)",
    "tags": [
      "history",
      "nature",
      "tourist attraction"
    ],
    "icon": "museum-white",
    "release": "2.2.0"
  },
  {
    "name": "Parking (Black)",
    "tags": [
      "parking",
      "park"
    ],
    "icon": "parking-black",
    "release": "1.0.0"
  },
  {
    "name": "Parking (White)",
    "tags": [
      "parking",
      "park"
    ],
    "icon": "parking-white",
    "release": "1.0.0"
  },
  {
    "name": "Pets on Leash (Black)",
    "tags": [
      "pets on leash"
    ],
    "icon": "pets-on-leash-black",
    "release": "1.0.0"
  },
  {
    "name": "Pets on Leash (White)",
    "tags": [
      "pets on leash"
    ],
    "icon": "pets-on-leash-white",
    "release": "1.0.0"
  },
  {
    "name": "Picnic Area (Black)",
    "tags": [
      "picnic",
      "recreation"
    ],
    "icon": "picnic-area-black",
    "release": "1.0.0"
  },
  {
    "name": "Picnic Area (White)",
    "tags": [
      "picnic",
      "recreation"
    ],
    "icon": "picnic-area-white",
    "release": "1.0.0"
  },
  {
    "name": "Playground (Black)",
    "tags": [
      "play area",
      "playpark"
    ],
    "icon": "playground-black",
    "release": "2.2.0"
  },
  {
    "name": "Playground (White)",
    "tags": [
      "play area",
      "playpark"
    ],
    "icon": "playground-white",
    "release": "2.2.0"
  },
  {
    "name": "Post Office (Black)",
    "tags": [
      "post office"
    ],
    "icon": "post-office-black",
    "release": "1.0.0"
  },
  {
    "name": "Post Office (White)",
    "tags": [
      "post office"
    ],
    "icon": "post-office-white",
    "release": "1.0.0"
  },
  {
    "name": "Radiator Water (Black)",
    "tags": [
      "radiator water"
    ],
    "icon": "radiator-water-black",
    "release": "1.0.0"
  },
  {
    "name": "Radiator Water (White)",
    "tags": [
      "radiator water"
    ],
    "icon": "radiator-water-white",
    "release": "1.0.0"
  },
  {
    "name": "Railroad Crossing (Black)",
    "tags": [
      "railroad",
      "crossing",
      "rr xing"
    ],
    "icon": "rr-xing-black",
    "release": "2.0.0"
  },
  {
    "name": "Railroad Crossing (White)",
    "tags": [
      "railroad",
      "crossing",
      "rr xing"
    ],
    "icon": "rr-xing-white",
    "release": "2.0.0"
  },
  {
    "name": "Ranger Station (Black)",
    "tags": [
      "ranger station"
    ],
    "icon": "ranger-station-black",
    "release": "1.0.0"
  },
  {
    "name": "Ranger Station (White)",
    "tags": [
      "ranger station"
    ],
    "icon": "ranger-station-white",
    "release": "1.0.0"
  },
  {
    "name": "Recycling (Black)",
    "tags": [
      "recycling"
    ],
    "icon": "recycling-black",
    "release": "1.0.0"
  },
  {
    "name": "Recycling (White)",
    "tags": [
      "recycling"
    ],
    "icon": "recycling-white",
    "release": "1.0.0"
  },
  {
    "name": "Restroom (Black)",
    "tags": [
      "restroom",
      "bathroom",
      "toilet"
    ],
    "icon": "restrooms-black",
    "release": "1.0.0"
  },
  {
    "name": "Restroom (White)",
    "tags": [
      "restroom",
      "bathroom",
      "toilet"
    ],
    "icon": "restrooms-white",
    "release": "1.0.0"
  },
  {
    "name": "RV Campground (Black)",
    "tags": [
      "rv campground"
    ],
    "icon": "rv-campground-black",
    "release": "1.0.0"
  },
  {
    "name": "RV Campground (White)",
    "tags": [
      "rv campground"
    ],
    "icon": "rv-campground-white",
    "release": "1.0.0"
  },
  {
    "name": "Sailing (Black)",
    "tags": [
      "sailing"
    ],
    "icon": "sailing-black",
    "release": "1.0.0"
  },
  {
    "name": "Sailing (White)",
    "tags": [
      "sailing"
    ],
    "icon": "sailing-white",
    "release": "1.0.0"
  },
  {
    "name": "Sanitary Dump Station (Black)",
    "tags": [
      "sanitary dump station"
    ],
    "icon": "sanitary-disposal-station-black",
    "release": "1.0.0"
  },
  {
    "name": "Sanitary Dump Station (White)",
    "tags": [
      "sanitary dump station"
    ],
    "icon": "sanitary-disposal-station-white",
    "release": "1.0.0"
  },
  {
    "name": "Scenic Viewpoint (Black)",
    "tags": [
      "scenic viewpoint",
      "overlook",
      "observation point",
      "vista",
      "viewing area",
      "lookout"
    ],
    "icon": "scenic-viewpoint-black",
    "release": "2.1.0"
  },
  {
    "name": "Scenic Viewpoint (White)",
    "tags": [
      "scenic viewpoint",
      "overlook",
      "observation point",
      "vista",
      "viewing area",
      "lookout"
    ],
    "icon": "scenic-viewpoint-white",
    "release": "2.1.0"
  },
  {
    "name": "Scuba Diving (Black)",
    "tags": [
      "scuba diving"
    ],
    "icon": "scuba-diving-black",
    "release": "1.0.0"
  },
  {
    "name": "Scuba Diving (White)",
    "tags": [
      "scuba diving"
    ],
    "icon": "scuba-diving-white",
    "release": "1.0.0"
  },
  {
    "name": "Sea Plane (Black)",
    "tags": [
      "airport",
      "float landing",
      "float plane"
    ],
    "icon": "sea-plane-black",
    "release": "2.2.0"
  },
  {
    "name": "Sea Plane (White)",
    "tags": [
      "airport",
      "float landing",
      "float plane"
    ],
    "icon": "sea-plane-white",
    "release": "2.2.0"
  },
  {
    "name": "Self Guided Trail (Black)",
    "tags": [
      "trail"
    ],
    "icon": "self-guiding-trail-black",
    "release": "1.0.0"
  },
  {
    "name": "Self Guided Trail (White)",
    "tags": [
      "trail"
    ],
    "icon": "self-guiding-trail-white",
    "release": "1.0.0"
  },
  {
    "name": "Shelter (Black)",
    "tags": [
      "shelter"
    ],
    "icon": "shelter-black",
    "release": "1.0.0"
  },
  {
    "name": "Shelter (White)",
    "tags": [
      "shelter"
    ],
    "icon": "shelter-white",
    "release": "1.0.0"
  },
  {
    "name": "Shelter Cabin (Black)",
    "tags": [
      "shelter cabin",
      "cottage"
    ],
    "icon": "shelter-cabin-black",
    "release": "2.2.0"
  },
  {
    "name": "Shelter Cabin (White)",
    "tags": [
      "shelter cabin",
      "cottage"
    ],
    "icon": "shelter-cabin-white",
    "release": "2.2.0"
  },
  {
    "name": "Showers (Black)",
    "tags": [
      "showers"
    ],
    "icon": "showers-black",
    "release": "1.0.0"
  },
  {
    "name": "Showers (White)",
    "tags": [
      "showers"
    ],
    "icon": "showers-white",
    "release": "1.0.0"
  },
  {
    "name": "Sign (Black)",
    "tags": [
      "sign",
      "directional",
      "regulatory",
      "marker",
      "milepost",
      "gateway"
    ],
    "icon": "sign-black",
    "release": "2.2.0"
  },
  {
    "name": "Sign (White)",
    "tags": [
      "sign",
      "directional",
      "regulatory",
      "marker",
      "milepost",
      "gateway"
    ],
    "icon": "sign-white",
    "release": "2.2.0"
  },
  {
    "name": "Sledding (Black)",
    "tags": [
      "sledding"
    ],
    "icon": "sledding-black",
    "release": "1.0.0"
  },
  {
    "name": "Sledding (White)",
    "tags": [
      "sledding"
    ],
    "icon": "sledding-white",
    "release": "1.0.0"
  },
  {
    "name": "Snowmobile Trail (Black)",
    "tags": [
      "snowmobile trail"
    ],
    "icon": "snowmobile-trail-black",
    "release": "1.0.0"
  },
  {
    "name": "Snowmobile Trail (White)",
    "tags": [
      "snowmobile trail"
    ],
    "icon": "snowmobile-trail-white",
    "release": "1.0.0"
  },
  {
    "name": "Souvenir (Black)",
    "tags": [
      "souvenir",
      "gift shop"
    ],
    "icon": "souvenir-black",
    "release": "2.2.0"
  },
  {
    "name": "Souvenir (White)",
    "tags": [
      "souvenir",
      "gift shop"
    ],
    "icon": "souvenir-white",
    "release": "2.2.0"
  },
  {
    "name": "Spring (Black)",
    "tags": [
      "spring",
      "seep"
    ],
    "icon": "spring-black",
    "release": "2.0.0"
  },
  {
    "name": "Spring (White)",
    "tags": [
      "spring",
      "seep"
    ],
    "icon": "spring-white",
    "release": "2.0.0"
  },
  {
    "name": "Stable (Black)",
    "tags": [
      "stable"
    ],
    "icon": "stable-black",
    "release": "1.0.0"
  },
  {
    "name": "Stable (White)",
    "tags": [
      "stable"
    ],
    "icon": "stable-white",
    "release": "1.0.0"
  },
  {
    "name": "Statue (Black)",
    "tags": [
      "statue",
      "monument",
      "sculpture"
    ],
    "icon": "statue-black",
    "release": "2.0.0"
  },
  {
    "name": "Statue (White)",
    "tags": [
      "statue",
      "monument",
      "sculpture"
    ],
    "icon": "statue-white",
    "release": "2.0.0"
  },
  {
    "name": "Store (Black)",
    "tags": [
      "store",
      "food",
      "shopping"
    ],
    "icon": "store-black",
    "release": "1.0.0"
  },
  {
    "name": "Store (White)",
    "tags": [
      "store",
      "food",
      "shopping"
    ],
    "icon": "store-white",
    "release": "1.0.0"
  },
  {
    "name": "Swimming (Black)",
    "tags": [
      "swimming"
    ],
    "icon": "swimming-black",
    "release": "1.0.0"
  },
  {
    "name": "Swimming (White)",
    "tags": [
      "swimming"
    ],
    "icon": "swimming-white",
    "release": "1.0.0"
  },
  {
    "name": "Telephone (Black)",
    "tags": [
      "telephone"
    ],
    "icon": "telephone-black",
    "release": "1.0.0"
  },
  {
    "name": "Telephone (White)",
    "tags": [
      "telephone"
    ],
    "icon": "telephone-white",
    "release": "1.0.0"
  },
  {
    "name": "Theater (Black)",
    "tags": [
      "cinema",
      "movie theater",
      "film"
    ],
    "icon": "theater-black",
    "release": "2.2.0"
  },
  {
    "name": "Theater (White)",
    "tags": [
      "cinema",
      "movie theater",
      "film"
    ],
    "icon": "theater-white",
    "release": "2.2.0"
  },
  {
    "name": "Trailhead (Black)",
    "tags": [
      "trailhead"
    ],
    "icon": "trailhead-black",
    "release": "1.0.0"
  },
  {
    "name": "Trailhead (White)",
    "tags": [
      "trailhead"
    ],
    "icon": "trailhead-white",
    "release": "1.0.0"
  },
  {
    "name": "Trash Dumpster (Black)",
    "tags": [
      "trash",
      "waste",
      "dumpster"
    ],
    "icon": "trash-dumpster-black",
    "release": "2.2.0"
  },
  {
    "name": "Trash Dumpster (White)",
    "tags": [
      "trash",
      "waste",
      "dumpster"
    ],
    "icon": "trash-dumpster-white",
    "release": "2.2.0"
  },
  {
    "name": "Tunnel (Black)",
    "tags": [
      "tunnel",
      "covered passageway"
    ],
    "icon": "tunnel-black",
    "release": "2.1.0"
  },
  {
    "name": "Tunnel (White)",
    "tags": [
      "tunnel",
      "covered passageway"
    ],
    "icon": "tunnel-white",
    "release": "2.1.0"
  },
  {
    "name": "Vehicle Ferry (Black)",
    "tags": [
      "vehicle ferry",
      "ferry terminal",
      "boat terminal"
    ],
    "icon": "vehicle-ferry-black",
    "release": "2.2.0"
  },
  {
    "name": "Vehicle Ferry (White)",
    "tags": [
      "vehicle ferry",
      "ferry terminal",
      "boat terminal"
    ],
    "icon": "vehicle-ferry-white",
    "release": "2.2.0"
  },
  {
    "name": "Visitor Center (Black)",
    "tags": [
      "visitor center"
    ],
    "icon": "visitor-center-black",
    "release": "1.0.0"
  },
  {
    "name": "Visitor Center (White)",
    "tags": [
      "visitor center"
    ],
    "icon": "visitor-center-white",
    "release": "1.0.0"
  },
  {
    "name": "Waterfall (Black)",
    "tags": [
      "waterfall"
    ],
    "icon": "waterfall-black",
    "release": "1.0.0"
  },
  {
    "name": "Waterfall (White)",
    "tags": [
      "waterfall"
    ],
    "icon": "waterfall-white",
    "release": "1.0.0"
  },
  {
    "name": "Webcam (Black)",
    "tags": [
      "webcam",
      "weather camera"
    ],
    "icon": "webcam-black",
    "release": "2.1.0"
  },
  {
    "name": "Webcam (White)",
    "tags": [
      "webcam",
      "weather camera"
    ],
    "icon": "webcam-white",
    "release": "2.1.0"
  },
  {
    "name": "Wheelchair Accessible (Black)",
    "tags": [
      "wheelchair accessible"
    ],
    "icon": "wheelchair-accessible-black",
    "release": "1.0.0"
  },
  {
    "name": "Wheelchair Accessible (White)",
    "tags": [
      "wheelchair accessible"
    ],
    "icon": "wheelchair-accessible-white",
    "release": "1.0.0"
  },
  {
    "name": "Wi-Fi (Black)",
    "tags": [
      "wifi",
      "wireless internet",
      "online"
    ],
    "icon": "wi-fi-black",
    "release": "2.2.0"
  },
  {
    "name": "Wi-Fi (White)",
    "tags": [
      "wifi",
      "wireless internet",
      "online"
    ],
    "icon": "wi-fi-white",
    "release": "2.2.0"
  },
  {
    "name": "Wind Surfing (Black)",
    "tags": [
      "wind surfing"
    ],
    "icon": "wind-surfing-black",
    "release": "1.0.0"
  },
  {
    "name": "Wind Surfing (White)",
    "tags": [
      "wind surfing"
    ],
    "icon": "wind-surfing-white",
    "release": "1.0.0"
  },
  {
    "name": "Zebra Mussel Decontamination Station (Black)",
    "tags": [
      "decontamination",
      "water recreation"
    ],
    "icon": "zebra-mussel-decontamination-station-black",
    "release": "2.2.0"
  },
  {
    "name": "Zebra Mussel Decontamination Station (White)",
    "tags": [
      "decontamination",
      "water recreation"
    ],
    "icon": "zebra-mussel-decontamination-station-white",
    "release": "2.2.0"
  },
  {
    "name": "Letter 'A' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-a-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'A' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-a-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'B' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-b-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'B' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-b-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'C' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-c-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'C' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-c-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'D' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-d-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'D' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-d-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'E' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-e-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'E' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-e-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'F' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-f-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'F' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-f-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'G' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-g-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'G' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-g-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'H' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-h-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'H' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-h-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'I' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-i-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'I' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-i-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'J' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-j-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'J' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-j-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'K' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-k-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'K' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-k-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'L' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-l-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'L' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-l-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'M' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-m-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'M' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-m-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'N' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-n-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'N' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-n-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'O' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-o-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'O' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-o-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'P' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-p-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'P' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-p-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'Q' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-q-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'Q' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-q-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'R' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-r-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'R' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-r-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'S' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-s-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'S' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-s-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'T' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-t-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'T' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-t-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'U' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-u-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'U' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-u-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'V' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-v-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'V' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-v-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'W' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-w-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'W' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-w-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'X' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-x-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'X' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-x-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'Y' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-y-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'Y' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-y-white",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'Z' (Black)",
    "tags": [
      "letter"
    ],
    "icon": "letter-z-black",
    "release": "1.0.0"
  },
  {
    "name": "Letter 'Z' (White)",
    "tags": [
      "letter"
    ],
    "icon": "letter-z-white",
    "release": "1.0.0"
  },
  {
    "name": "Number '0' (Black)",
    "tags": [
      "number"
    ],
    "icon": "number-0-black",
    "release": "1.0.0"
  },
  {
    "name": "Number '0' (White)",
    "tags": [
      "number"
    ],
    "icon": "number-0-white",
    "release": "1.0.0"
  },
  {
    "name": "Number '1' (Black)",
    "tags": [
      "number"
    ],
    "icon": "number-1-black",
    "release": "1.0.0"
  },
  {
    "name": "Number '1' (White)",
    "tags": [
      "number"
    ],
    "icon": "number-1-white",
    "release": "1.0.0"
  },
  {
    "name": "Number '2' (Black)",
    "tags": [
      "number"
    ],
    "icon": "number-2-black",
    "release": "1.0.0"
  },
  {
    "name": "Number '2' (White)",
    "tags": [
      "number"
    ],
    "icon": "number-2-white",
    "release": "1.0.0"
  },
  {
    "name": "Number '3' (Black)",
    "tags": [
      "number"
    ],
    "icon": "number-3-black",
    "release": "1.0.0"
  },
  {
    "name": "Number '3' (White)",
    "tags": [
      "number"
    ],
    "icon": "number-3-white",
    "release": "1.0.0"
  },
  {
    "name": "Number '4' (Black)",
    "tags": [
      "number"
    ],
    "icon": "number-4-black",
    "release": "1.0.0"
  },
  {
    "name": "Number '4' (White)",
    "tags": [
      "number"
    ],
    "icon": "number-4-white",
    "release": "1.0.0"
  },
  {
    "name": "Number '5' (Black)",
    "tags": [
      "number"
    ],
    "icon": "number-5-black",
    "release": "1.0.0"
  },
  {
    "name": "Number '5' (White)",
    "tags": [
      "number"
    ],
    "icon": "number-5-white",
    "release": "1.0.0"
  },
  {
    "name": "Number '6' (Black)",
    "tags": [
      "number"
    ],
    "icon": "number-6-black",
    "release": "1.0.0"
  },
  {
    "name": "Number '6' (White)",
    "tags": [
      "number"
    ],
    "icon": "number-6-white",
    "release": "1.0.0"
  },
  {
    "name": "Number '7' (Black)",
    "tags": [
      "number"
    ],
    "icon": "number-7-black",
    "release": "1.0.0"
  },
  {
    "name": "Number '7' (White)",
    "tags": [
      "number"
    ],
    "icon": "number-7-white",
    "release": "1.0.0"
  },
  {
    "name": "Number '8' (Black)",
    "tags": [
      "number"
    ],
    "icon": "number-8-black",
    "release": "1.0.0"
  },
  {
    "name": "Number '8' (White)",
    "tags": [
      "number"
    ],
    "icon": "number-8-white",
    "release": "1.0.0"
  },
  {
    "name": "Number '9' (Black)",
    "tags": [
      "number"
    ],
    "icon": "number-9-black",
    "release": "1.0.0"
  },
  {
    "name": "Number '9' (White)",
    "tags": [
      "number"
    ],
    "icon": "number-9-white",
    "release": "1.0.0"
  }
]

},{}],60:[function(require,module,exports){
/*!
  * Reqwest! A general purpose XHR connection manager
  * license MIT (c) Dustin Diaz 2015
  * https://github.com/ded/reqwest
  */

!function (name, context, definition) {
  if (typeof module != 'undefined' && module.exports) module.exports = definition()
  else if (typeof define == 'function' && define.amd) define(definition)
  else context[name] = definition()
}('reqwest', this, function () {

  var context = this

  if ('window' in context) {
    var doc = document
      , byTag = 'getElementsByTagName'
      , head = doc[byTag]('head')[0]
  } else {
    var XHR2
    try {
      XHR2 = require('xhr2')
    } catch (ex) {
      throw new Error('Peer dependency `xhr2` required! Please npm install xhr2')
    }
  }


  var httpsRe = /^http/
    , protocolRe = /(^\w+):\/\//
    , twoHundo = /^(20\d|1223)$/ //http://stackoverflow.com/questions/10046972/msie-returns-status-code-of-1223-for-ajax-request
    , readyState = 'readyState'
    , contentType = 'Content-Type'
    , requestedWith = 'X-Requested-With'
    , uniqid = 0
    , callbackPrefix = 'reqwest_' + (+new Date())
    , lastValue // data stored by the most recent JSONP callback
    , xmlHttpRequest = 'XMLHttpRequest'
    , xDomainRequest = 'XDomainRequest'
    , noop = function () {}

    , isArray = typeof Array.isArray == 'function'
        ? Array.isArray
        : function (a) {
            return a instanceof Array
          }

    , defaultHeaders = {
          'contentType': 'application/x-www-form-urlencoded'
        , 'requestedWith': xmlHttpRequest
        , 'accept': {
              '*':  'text/javascript, text/html, application/xml, text/xml, */*'
            , 'xml':  'application/xml, text/xml'
            , 'html': 'text/html'
            , 'text': 'text/plain'
            , 'json': 'application/json, text/javascript'
            , 'js':   'application/javascript, text/javascript'
          }
      }

    , xhr = function(o) {
        // is it x-domain
        if (o['crossOrigin'] === true) {
          var xhr = context[xmlHttpRequest] ? new XMLHttpRequest() : null
          if (xhr && 'withCredentials' in xhr) {
            return xhr
          } else if (context[xDomainRequest]) {
            return new XDomainRequest()
          } else {
            throw new Error('Browser does not support cross-origin requests')
          }
        } else if (context[xmlHttpRequest]) {
          return new XMLHttpRequest()
        } else if (XHR2) {
          return new XHR2()
        } else {
          return new ActiveXObject('Microsoft.XMLHTTP')
        }
      }
    , globalSetupOptions = {
        dataFilter: function (data) {
          return data
        }
      }

  function succeed(r) {
    var protocol = protocolRe.exec(r.url)
    protocol = (protocol && protocol[1]) || context.location.protocol
    return httpsRe.test(protocol) ? twoHundo.test(r.request.status) : !!r.request.response
  }

  function handleReadyState(r, success, error) {
    return function () {
      // use _aborted to mitigate against IE err c00c023f
      // (can't read props on aborted request objects)
      if (r._aborted) return error(r.request)
      if (r._timedOut) return error(r.request, 'Request is aborted: timeout')
      if (r.request && r.request[readyState] == 4) {
        r.request.onreadystatechange = noop
        if (succeed(r)) success(r.request)
        else
          error(r.request)
      }
    }
  }

  function setHeaders(http, o) {
    var headers = o['headers'] || {}
      , h

    headers['Accept'] = headers['Accept']
      || defaultHeaders['accept'][o['type']]
      || defaultHeaders['accept']['*']

    var isAFormData = typeof FormData !== 'undefined' && (o['data'] instanceof FormData);
    // breaks cross-origin requests with legacy browsers
    if (!o['crossOrigin'] && !headers[requestedWith]) headers[requestedWith] = defaultHeaders['requestedWith']
    if (!headers[contentType] && !isAFormData) headers[contentType] = o['contentType'] || defaultHeaders['contentType']
    for (h in headers)
      headers.hasOwnProperty(h) && 'setRequestHeader' in http && http.setRequestHeader(h, headers[h])
  }

  function setCredentials(http, o) {
    if (typeof o['withCredentials'] !== 'undefined' && typeof http.withCredentials !== 'undefined') {
      http.withCredentials = !!o['withCredentials']
    }
  }

  function generalCallback(data) {
    lastValue = data
  }

  function urlappend (url, s) {
    return url + (/\?/.test(url) ? '&' : '?') + s
  }

  function handleJsonp(o, fn, err, url) {
    var reqId = uniqid++
      , cbkey = o['jsonpCallback'] || 'callback' // the 'callback' key
      , cbval = o['jsonpCallbackName'] || reqwest.getcallbackPrefix(reqId)
      , cbreg = new RegExp('((^|\\?|&)' + cbkey + ')=([^&]+)')
      , match = url.match(cbreg)
      , script = doc.createElement('script')
      , loaded = 0
      , isIE10 = navigator.userAgent.indexOf('MSIE 10.0') !== -1

    if (match) {
      if (match[3] === '?') {
        url = url.replace(cbreg, '$1=' + cbval) // wildcard callback func name
      } else {
        cbval = match[3] // provided callback func name
      }
    } else {
      url = urlappend(url, cbkey + '=' + cbval) // no callback details, add 'em
    }

    context[cbval] = generalCallback

    script.type = 'text/javascript'
    script.src = url
    script.async = true
    if (typeof script.onreadystatechange !== 'undefined' && !isIE10) {
      // need this for IE due to out-of-order onreadystatechange(), binding script
      // execution to an event listener gives us control over when the script
      // is executed. See http://jaubourg.net/2010/07/loading-script-as-onclick-handler-of.html
      script.htmlFor = script.id = '_reqwest_' + reqId
    }

    script.onload = script.onreadystatechange = function () {
      if ((script[readyState] && script[readyState] !== 'complete' && script[readyState] !== 'loaded') || loaded) {
        return false
      }
      script.onload = script.onreadystatechange = null
      script.onclick && script.onclick()
      // Call the user callback with the last value stored and clean up values and scripts.
      fn(lastValue)
      lastValue = undefined
      head.removeChild(script)
      loaded = 1
    }

    // Add the script to the DOM head
    head.appendChild(script)

    // Enable JSONP timeout
    return {
      abort: function () {
        script.onload = script.onreadystatechange = null
        err({}, 'Request is aborted: timeout', {})
        lastValue = undefined
        head.removeChild(script)
        loaded = 1
      }
    }
  }

  function getRequest(fn, err) {
    var o = this.o
      , method = (o['method'] || 'GET').toUpperCase()
      , url = typeof o === 'string' ? o : o['url']
      // convert non-string objects to query-string form unless o['processData'] is false
      , data = (o['processData'] !== false && o['data'] && typeof o['data'] !== 'string')
        ? reqwest.toQueryString(o['data'])
        : (o['data'] || null)
      , http
      , sendWait = false

    // if we're working on a GET request and we have data then we should append
    // query string to end of URL and not post data
    if ((o['type'] == 'jsonp' || method == 'GET') && data) {
      url = urlappend(url, data)
      data = null
    }

    if (o['type'] == 'jsonp') return handleJsonp(o, fn, err, url)

    // get the xhr from the factory if passed
    // if the factory returns null, fall-back to ours
    http = (o.xhr && o.xhr(o)) || xhr(o)

    http.open(method, url, o['async'] === false ? false : true)
    setHeaders(http, o)
    setCredentials(http, o)
    if (context[xDomainRequest] && http instanceof context[xDomainRequest]) {
        http.onload = fn
        http.onerror = err
        // NOTE: see
        // http://social.msdn.microsoft.com/Forums/en-US/iewebdevelopment/thread/30ef3add-767c-4436-b8a9-f1ca19b4812e
        http.onprogress = function() {}
        sendWait = true
    } else {
      http.onreadystatechange = handleReadyState(this, fn, err)
    }
    o['before'] && o['before'](http)
    if (sendWait) {
      setTimeout(function () {
        http.send(data)
      }, 200)
    } else {
      http.send(data)
    }
    return http
  }

  function Reqwest(o, fn) {
    this.o = o
    this.fn = fn

    init.apply(this, arguments)
  }

  function setType(header) {
    // json, javascript, text/plain, text/html, xml
    if (header === null) return undefined; //In case of no content-type.
    if (header.match('json')) return 'json'
    if (header.match('javascript')) return 'js'
    if (header.match('text')) return 'html'
    if (header.match('xml')) return 'xml'
  }

  function init(o, fn) {

    this.url = typeof o == 'string' ? o : o['url']
    this.timeout = null

    // whether request has been fulfilled for purpose
    // of tracking the Promises
    this._fulfilled = false
    // success handlers
    this._successHandler = function(){}
    this._fulfillmentHandlers = []
    // error handlers
    this._errorHandlers = []
    // complete (both success and fail) handlers
    this._completeHandlers = []
    this._erred = false
    this._responseArgs = {}

    var self = this

    fn = fn || function () {}

    if (o['timeout']) {
      this.timeout = setTimeout(function () {
        timedOut()
      }, o['timeout'])
    }

    if (o['success']) {
      this._successHandler = function () {
        o['success'].apply(o, arguments)
      }
    }

    if (o['error']) {
      this._errorHandlers.push(function () {
        o['error'].apply(o, arguments)
      })
    }

    if (o['complete']) {
      this._completeHandlers.push(function () {
        o['complete'].apply(o, arguments)
      })
    }

    function complete (resp) {
      o['timeout'] && clearTimeout(self.timeout)
      self.timeout = null
      while (self._completeHandlers.length > 0) {
        self._completeHandlers.shift()(resp)
      }
    }

    function success (resp) {
      var type = o['type'] || resp && setType(resp.getResponseHeader('Content-Type')) // resp can be undefined in IE
      resp = (type !== 'jsonp') ? self.request : resp
      // use global data filter on response text
      var filteredResponse = globalSetupOptions.dataFilter(resp.responseText, type)
        , r = filteredResponse
      try {
        resp.responseText = r
      } catch (e) {
        // can't assign this in IE<=8, just ignore
      }
      if (r) {
        switch (type) {
        case 'json':
          try {
            resp = context.JSON ? context.JSON.parse(r) : eval('(' + r + ')')
          } catch (err) {
            return error(resp, 'Could not parse JSON in response', err)
          }
          break
        case 'js':
          resp = eval(r)
          break
        case 'html':
          resp = r
          break
        case 'xml':
          resp = resp.responseXML
              && resp.responseXML.parseError // IE trololo
              && resp.responseXML.parseError.errorCode
              && resp.responseXML.parseError.reason
            ? null
            : resp.responseXML
          break
        }
      }

      self._responseArgs.resp = resp
      self._fulfilled = true
      fn(resp)
      self._successHandler(resp)
      while (self._fulfillmentHandlers.length > 0) {
        resp = self._fulfillmentHandlers.shift()(resp)
      }

      complete(resp)
    }

    function timedOut() {
      self._timedOut = true
      self.request.abort()
    }

    function error(resp, msg, t) {
      resp = self.request
      self._responseArgs.resp = resp
      self._responseArgs.msg = msg
      self._responseArgs.t = t
      self._erred = true
      while (self._errorHandlers.length > 0) {
        self._errorHandlers.shift()(resp, msg, t)
      }
      complete(resp)
    }

    this.request = getRequest.call(this, success, error)
  }

  Reqwest.prototype = {
    abort: function () {
      this._aborted = true
      this.request.abort()
    }

  , retry: function () {
      init.call(this, this.o, this.fn)
    }

    /**
     * Small deviation from the Promises A CommonJs specification
     * http://wiki.commonjs.org/wiki/Promises/A
     */

    /**
     * `then` will execute upon successful requests
     */
  , then: function (success, fail) {
      success = success || function () {}
      fail = fail || function () {}
      if (this._fulfilled) {
        this._responseArgs.resp = success(this._responseArgs.resp)
      } else if (this._erred) {
        fail(this._responseArgs.resp, this._responseArgs.msg, this._responseArgs.t)
      } else {
        this._fulfillmentHandlers.push(success)
        this._errorHandlers.push(fail)
      }
      return this
    }

    /**
     * `always` will execute whether the request succeeds or fails
     */
  , always: function (fn) {
      if (this._fulfilled || this._erred) {
        fn(this._responseArgs.resp)
      } else {
        this._completeHandlers.push(fn)
      }
      return this
    }

    /**
     * `fail` will execute when the request fails
     */
  , fail: function (fn) {
      if (this._erred) {
        fn(this._responseArgs.resp, this._responseArgs.msg, this._responseArgs.t)
      } else {
        this._errorHandlers.push(fn)
      }
      return this
    }
  , 'catch': function (fn) {
      return this.fail(fn)
    }
  }

  function reqwest(o, fn) {
    return new Reqwest(o, fn)
  }

  // normalize newline variants according to spec -> CRLF
  function normalize(s) {
    return s ? s.replace(/\r?\n/g, '\r\n') : ''
  }

  function serial(el, cb) {
    var n = el.name
      , t = el.tagName.toLowerCase()
      , optCb = function (o) {
          // IE gives value="" even where there is no value attribute
          // 'specified' ref: http://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-862529273
          if (o && !o['disabled'])
            cb(n, normalize(o['attributes']['value'] && o['attributes']['value']['specified'] ? o['value'] : o['text']))
        }
      , ch, ra, val, i

    // don't serialize elements that are disabled or without a name
    if (el.disabled || !n) return

    switch (t) {
    case 'input':
      if (!/reset|button|image|file/i.test(el.type)) {
        ch = /checkbox/i.test(el.type)
        ra = /radio/i.test(el.type)
        val = el.value
        // WebKit gives us "" instead of "on" if a checkbox has no value, so correct it here
        ;(!(ch || ra) || el.checked) && cb(n, normalize(ch && val === '' ? 'on' : val))
      }
      break
    case 'textarea':
      cb(n, normalize(el.value))
      break
    case 'select':
      if (el.type.toLowerCase() === 'select-one') {
        optCb(el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null)
      } else {
        for (i = 0; el.length && i < el.length; i++) {
          el.options[i].selected && optCb(el.options[i])
        }
      }
      break
    }
  }

  // collect up all form elements found from the passed argument elements all
  // the way down to child elements; pass a '<form>' or form fields.
  // called with 'this'=callback to use for serial() on each element
  function eachFormElement() {
    var cb = this
      , e, i
      , serializeSubtags = function (e, tags) {
          var i, j, fa
          for (i = 0; i < tags.length; i++) {
            fa = e[byTag](tags[i])
            for (j = 0; j < fa.length; j++) serial(fa[j], cb)
          }
        }

    for (i = 0; i < arguments.length; i++) {
      e = arguments[i]
      if (/input|select|textarea/i.test(e.tagName)) serial(e, cb)
      serializeSubtags(e, [ 'input', 'select', 'textarea' ])
    }
  }

  // standard query string style serialization
  function serializeQueryString() {
    return reqwest.toQueryString(reqwest.serializeArray.apply(null, arguments))
  }

  // { 'name': 'value', ... } style serialization
  function serializeHash() {
    var hash = {}
    eachFormElement.apply(function (name, value) {
      if (name in hash) {
        hash[name] && !isArray(hash[name]) && (hash[name] = [hash[name]])
        hash[name].push(value)
      } else hash[name] = value
    }, arguments)
    return hash
  }

  // [ { name: 'name', value: 'value' }, ... ] style serialization
  reqwest.serializeArray = function () {
    var arr = []
    eachFormElement.apply(function (name, value) {
      arr.push({name: name, value: value})
    }, arguments)
    return arr
  }

  reqwest.serialize = function () {
    if (arguments.length === 0) return ''
    var opt, fn
      , args = Array.prototype.slice.call(arguments, 0)

    opt = args.pop()
    opt && opt.nodeType && args.push(opt) && (opt = null)
    opt && (opt = opt.type)

    if (opt == 'map') fn = serializeHash
    else if (opt == 'array') fn = reqwest.serializeArray
    else fn = serializeQueryString

    return fn.apply(null, args)
  }

  reqwest.toQueryString = function (o, trad) {
    var prefix, i
      , traditional = trad || false
      , s = []
      , enc = encodeURIComponent
      , add = function (key, value) {
          // If value is a function, invoke it and return its value
          value = ('function' === typeof value) ? value() : (value == null ? '' : value)
          s[s.length] = enc(key) + '=' + enc(value)
        }
    // If an array was passed in, assume that it is an array of form elements.
    if (isArray(o)) {
      for (i = 0; o && i < o.length; i++) add(o[i]['name'], o[i]['value'])
    } else {
      // If traditional, encode the "old" way (the way 1.3.2 or older
      // did it), otherwise encode params recursively.
      for (prefix in o) {
        if (o.hasOwnProperty(prefix)) buildParams(prefix, o[prefix], traditional, add)
      }
    }

    // spaces should be + according to spec
    return s.join('&').replace(/%20/g, '+')
  }

  function buildParams(prefix, obj, traditional, add) {
    var name, i, v
      , rbracket = /\[\]$/

    if (isArray(obj)) {
      // Serialize array item.
      for (i = 0; obj && i < obj.length; i++) {
        v = obj[i]
        if (traditional || rbracket.test(prefix)) {
          // Treat each array item as a scalar.
          add(prefix, v)
        } else {
          buildParams(prefix + '[' + (typeof v === 'object' ? i : '') + ']', v, traditional, add)
        }
      }
    } else if (obj && obj.toString() === '[object Object]') {
      // Serialize object item.
      for (name in obj) {
        buildParams(prefix + '[' + name + ']', obj[name], traditional, add)
      }

    } else {
      // Serialize scalar item.
      add(prefix, obj)
    }
  }

  reqwest.getcallbackPrefix = function () {
    return callbackPrefix
  }

  // jQuery and Zepto compatibility, differences can be remapped here so you can call
  // .ajax.compat(options, callback)
  reqwest.compat = function (o, fn) {
    if (o) {
      o['type'] && (o['method'] = o['type']) && delete o['type']
      o['dataType'] && (o['type'] = o['dataType'])
      o['jsonpCallback'] && (o['jsonpCallbackName'] = o['jsonpCallback']) && delete o['jsonpCallback']
      o['jsonp'] && (o['jsonpCallback'] = o['jsonp'])
    }
    return new Reqwest(o, fn)
  }

  reqwest.ajaxSetup = function (options) {
    options = options || {}
    for (var k in options) {
      globalSetupOptions[k] = options[k]
    }
  }

  return reqwest
});

},{"xhr2":4}],61:[function(require,module,exports){
/* global L */
/* jshint camelcase: false */

var version = require('./package.json').version;

window.L.Icon.Default.imagePath = 'https://cdn.rawgit.com/ryanjhodge/npmap/10d6adc0/images';
L.npmap = module.exports = {
  VERSION: version,
  // Preserve order of controls because it affects the display hierarchy.
  control: {
    geocoder: require('./src/control/geocoder'),
    download: require('./src/control/download'),
    home: require('./src/control/home'),
    smallzoom: require('./src/control/smallzoom'),
    locate: require('./src/control/locate'),
    measure: require('./src/control/measure'),
    edit: require('./src/control/edit'),
    fullscreen: require('./src/control/fullscreen'),
    hash: require('./src/control/hash'),
    infobox: require('./src/control/infobox'),
    legend: require('./src/control/legend'),
    overview: require('./src/control/overview'),
    print: require('./src/control/print'),
    scale: require('./src/control/scale'),
    share: require('./src/control/share'),
    switcher: require('./src/control/switcher'),
    zoomdisplay: require('./src/control/zoomdisplay')
  },
  icon: {
    maki: require('./src/icon/maki'),
    npmapsymbollibrary: require('./src/icon/npmapsymbollibrary')
  },
  layer: {
    _cluster: require('./src/layer/cluster'),
    arcgisserver: {
      dynamic: require('./src/layer/arcgisserver/dynamic'),
      tiled: require('./src/layer/arcgisserver/tiled')
    },
    bing: require('./src/layer/bing'),
    cartodb: require('./src/layer/cartodb'),
    csv: require('./src/layer/csv'),
    geojson: require('./src/layer/geojson'),
    github: require('./src/layer/github'),
    kml: require('./src/layer/kml'),
    mapbox: require('./src/layer/mapbox'),
    spot: require('./src/layer/spot'),
    tiled: require('./src/layer/tiled'),
    wms: require('./src/layer/wms'),
    zoomify: require('./src/layer/zoomify')
  },
  map: require('./src/map'),
  module: {
    directions: require('./src/module/directions')
  },
  popup: require('./src/popup'),
  preset: {
    baselayers: require('./src/preset/baselayers.json'),
    colors: require('./src/preset/colors.json'),
    maki: require('./node_modules/maki/_includes/maki.json'),
    npmapsymbollibrary: require('./node_modules/npmap-symbol-library/www/npmap-builder/npmap-symbol-library.json'),
    overlays: require('./src/preset/overlays.json'),
    places: {
      pois: require('./src/preset/places/pois')
    }
  },
  tooltip: require('./src/tooltip'),
  util: {
    _: require('./src/util/util'),
    geocode: require('./src/util/geocode'),
    route: require('./src/util/route'),
    topojson: require('./src/util/topojson')
  }
};

},{"./node_modules/maki/_includes/maki.json":57,"./node_modules/npmap-symbol-library/www/npmap-builder/npmap-symbol-library.json":59,"./package.json":62,"./src/control/download":63,"./src/control/edit":64,"./src/control/fullscreen":65,"./src/control/geocoder":66,"./src/control/hash":67,"./src/control/home":68,"./src/control/infobox":69,"./src/control/legend":70,"./src/control/locate":71,"./src/control/measure":72,"./src/control/overview":73,"./src/control/print":74,"./src/control/scale":75,"./src/control/share":76,"./src/control/smallzoom":77,"./src/control/switcher":78,"./src/control/zoomdisplay":79,"./src/icon/maki":80,"./src/icon/npmapsymbollibrary":81,"./src/layer/arcgisserver/dynamic":82,"./src/layer/arcgisserver/tiled":83,"./src/layer/bing":84,"./src/layer/cartodb":85,"./src/layer/cluster":86,"./src/layer/csv":87,"./src/layer/geojson":88,"./src/layer/github":89,"./src/layer/kml":90,"./src/layer/mapbox":91,"./src/layer/spot":92,"./src/layer/tiled":93,"./src/layer/wms":94,"./src/layer/zoomify":95,"./src/map":96,"./src/module/directions":101,"./src/popup":102,"./src/preset/baselayers.json":103,"./src/preset/colors.json":104,"./src/preset/overlays.json":105,"./src/preset/places/pois":106,"./src/tooltip":107,"./src/util/geocode":108,"./src/util/route":110,"./src/util/topojson":112,"./src/util/util":113}],62:[function(require,module,exports){
module.exports={
  "bugs": {
    "email": "npmap@nps.gov",
    "url": "https://github.com/nationalparkservice/npmap.js/issues"
  },
  "dependencies": {
    "csv2geojson": "5.0.2",
    "handlebars": "4.0.5",
    "helper-dateformat": "https://github.com/nationalparkservice/helper-dateformat/archive/v0.2.1.tar.gz",
    "humane-js": "https://github.com/nationalparkservice/humane-js/archive/3.2.2.tar.gz",
    "leaflet": "1.0.3",
    "leaflet-draw": "0.4.9",
    "leaflet.markercluster": "~1.0.0",
    "maki": "~0.5.0",
    "nanobar": "0.4.2",
    "npmap-symbol-library": "https://github.com/nationalparkservice/npmap-symbol-library/archive/v2.2.2.tar.gz",
    "reqwest": "2.0.5",
    "@mapbox/togeojson": "0.16.0"
  },
  "description": "A JavaScript web mapping library for the National Park Service, built as a Leaflet plugin.",
  "devDependencies": {
    "brfs": "1.4.3",
    "browserify": "^13.0.0",
    "expect.js": "^0.3.1",
    "grunt": "^1.0.0",
    "grunt": "~0.4.0",
    "grunt-akamai-rest-purge": "^0.1.1",
    "grunt-banner": "0.6.0",
    "grunt-browserify": "5.0.0",
    "grunt-contrib-clean": "1.0.0",
    "grunt-contrib-compress": "1.3.0",
    "grunt-contrib-concat": "1.0.1",
    "grunt-contrib-copy": "1.0.0",
    "grunt-contrib-csslint": "2.0.0",
    "grunt-contrib-cssmin": "1.0.2",
    "grunt-contrib-handlebars": "1.0.0",
    "grunt-contrib-uglify": "2.0.0",
    "grunt-curl": "2.2.0",
    "grunt-http": "2.0.1",
    "grunt-md2html": "^0.3.0",
    "grunt-mkdir": "1.0.0",
    "grunt-mocha-phantomjs": "^3.0.0",
    "grunt-semistandard": "^1.0.4",
    "grunt-string-replace": "^1.2.1",
    "happen": "0.3.1",
    "mocha": "^3.0.0",
    "mocha-phantomjs": "^4.0.1",
    "phantomjs-prebuilt": "~2.1.12",
    "sinon": "1.17.5",
    "uglify-js": "2.7.3",
    "xhr2": "^0.1.2"
  },
  "scripts": {
    "test": "grunt test"
  },
  "engines": {
    "node": "*"
  },
  "homepage": "https://www.nps.gov/maps/tools/npmap.js/",
  "keywords": [
    "Cartography",
    "Department of Interior",
    "Digital",
    "JavaScript",
    "Leaflet",
    "Map",
    "National Park Service",
    "NPMap",
    "NPMap.js",
    "NPMap Symbol Library",
    "NPS Places",
    "Park Tiles",
    "US Government",
    "Web Map"
  ],
  "licenses": [
    {
      "type": "MIT",
      "url": "https://github.com/nationalparkservice/npmap.js/blob/master/LICENSE.md"
    }
  ],
  "main": "main.js",
  "name": "npmap.js",
  "repository": {
    "type": "git",
    "url": "https://github.com/nationalparkservice/npmap.js.git"
  },
  "version": "4.0.0"
}

},{}],63:[function(require,module,exports){
/* global L */

'use strict';

var util = require('../util/util');
var DownloadControl = L.Control.extend({
  initialize: function () {
    this._li = L.DomUtil.create('li', '');
    this._button = L.DomUtil.create('button', 'download', this._li);
    this._button.setAttribute('alt', 'Download data');
    L.DomEvent.addListener(this._button, 'click', this.download, this);
    return this;
  },
  addTo: function (map) {
    var toolbar = util.getChildElementsByClassName(map.getContainer().parentNode.parentNode, 'npmap-toolbar')[0];

    toolbar.childNodes[1].appendChild(this._li);
    toolbar.style.display = 'block';
    this._container = toolbar.parentNode.parentNode;
    this._map = map;
    util.getChildElementsByClassName(this._container.parentNode, 'npmap-map-wrapper')[0].style.top = '28px';
    return this;
  },
  download: function (e) {
    L.DomEvent.preventDefault(e);
    window.alert('The download tool has not yet been implemented.');
  }
});

L.Map.mergeOptions({
  downloadControl: false
});
L.Map.addInitHook(function () {
  if (this.options.downloadControl) {
    var options = {};

    if (typeof this.options.downloadControl === 'object') {
      options = this.options.downloadControl;
    }

    this.downloadControl = L.npmap.control.download(options).addTo(this);
  }
});

module.exports = function (options) {
  return new DownloadControl(options);
};

},{"../util/util":113}],64:[function(require,module,exports){
/* global L */

'use strict';

// Modified options to support passing a layer in.

require('leaflet-draw');
require('../icon/maki');
require('../icon/npmapsymbollibrary');

var EditControl = L.Control.extend({
  includes: L.Mixin.Events,
  options: {
    circle: {
      shapeOptions: {
        color: '#d46655',
        fillOpacity: 0.4,
        opacity: 1,
        weight: 4
      }
    },
    layer: undefined,
    marker: {
      icon: {
        'marker-color': '#d46655',
        'marker-library': 'maki',
        'marker-size': 'medium'
      }
    },
    polygon: {
      shapeOptions: {
        color: '#d46655',
        fillOpacity: 0.4,
        opacity: 1,
        weight: 4
      }
    },
    polyline: {
      shapeOptions: {
        color: '#d46655',
        opacity: 1,
        weight: 4
      }
    },
    position: 'topleft',
    rectangle: {
      shapeOptions: {
        color: '#d46655',
        fillOpacity: 0.4,
        opacity: 1,
        weight: 4
      }
    },
    toolbar: true
  },
  initialize: function (options) {
    L.Util.setOptions(this, options);
    this._activeMode = null;
    this._featureGroup = (options && options.layer ? options.layer : new L.FeatureGroup());
    this._modes = {};
    return this;
  },
  onAdd: function (map) {
    var container = L.DomUtil.create('div', 'leaflet-control-edit leaflet-bar');
    var me = this;
    var options = this.options;
    var editId;
    var editShape;

    if (options.marker) {
      if (options.marker.icon && options.marker.icon['marker-library']) {
        options.marker.icon = L.npmap.icon[options.marker.icon['marker-library']](options.marker.icon);
      }

      this._initializeMode(container, new L.Draw.Marker(map, options.marker), 'Draw a marker');
    }

    if (options.polyline) {
      this._initializeMode(container, new L.Draw.Polyline(map, options.polyline), 'Draw a line');
    }

    if (options.polygon) {
      this._initializeMode(container, new L.Draw.Polygon(map, options.polygon), 'Draw a polygon');
    }

    if (options.rectangle) {
      this._initializeMode(container, new L.Draw.Rectangle(map, options.rectangle), 'Draw a rectangle');
    }

    if (options.circle) {
      this._initializeMode(container, new L.Draw.Circle(map, options.circle), 'Draw a circle');
    }

    this._map = map;
    this._featureGroup.on('click', function (e) {
      var editing = e.layer.editing;
      var leafletId;

      if (editing) {
        if (!editing._marker) {
          if (editing._poly) {
            leafletId = editing._poly._leaflet_id;
          } else {
            leafletId = editing._shape._leaflet_id;
          }

          if (editId === leafletId) {
            editing.disable();
            editId = null;
            editShape = null;
          } else {
            if (editShape) {
              editShape.editing.disable();
            }

            editing.enable();
            editId = leafletId;
            editShape = e.layer;
          }
        }
      } else {
        if (editShape) {
          editShape.editing.disable();
          editId = null;
          editShape = null;
        }
      }
    });
    map
      .addLayer(this._featureGroup)
      .on('click', function () {
        if (editShape) {
          editShape.editing.disable();
          editId = null;
          editShape = null;
        }
      })
      .on('draw:created', function (e) {
        if (me._activeMode) {
          me._featureGroup.addLayer(e.layer);

          if (e.layerType === 'marker') {
            e.layer.dragging.enable();
            e.layer.on('dragstart', function () {
              if (editShape) {
                editShape.editing.disable();
                editId = null;
                editShape = null;
              }
            });
          }
        }
      })
      .on('draw:drawstart', function () {
        if (editShape) {
          editShape.editing.disable();
          editId = null;
          editShape = null;
        }
      });

    return container;
  },
  _handlerActivated: function (e) {
    var map = this._map;

    if (map._controllingInteractivity !== 'map') {
      map[map._controllingInteractivity + 'Control'].deactivate();
    }

    if (this._activeMode && this._activeMode.handler.enabled()) {
      this._activeMode.handler.disable();
    }

    this._activeMode = this._modes[e.handler];

    if (this._activeMode.button) {
      L.DomUtil.addClass(this._activeMode.button, 'pressed');
    }

    map._controllingInteractivity = 'edit';
    this.fire('activated');
    map.closePopup();
  },
  _handlerDeactivated: function () {
    if (this._activeMode.button) {
      L.DomUtil.removeClass(this._activeMode.button, 'pressed');
    }

    this._activeMode = null;
    this._map._controllingInteractivity = 'map';
    this.fire('deactivated');
  },
  _initializeMode: function (container, handler, title) {
    var button = null;
    var me = this;
    var type = handler.type;

    this._modes[type] = {};
    this._modes[type].handler = handler;

    if (this.options.toolbar) {
      button = L.DomUtil.create('button', type, container);
      button.setAttribute('alt', title);
      L.DomEvent
        .disableClickPropagation(button)
        .on(button, 'click', function () {
          if (me._activeMode && me._activeMode.handler.type === type) {
            me._modes[type].handler.disable();
          } else {
            me._modes[type].handler.enable();
          }
        }, this._modes[type].handler);
    }

    this._modes[type].button = button;
    this._modes[type].handler
      .on('disabled', this._handlerDeactivated, this)
      .on('enabled', this._handlerActivated, this);
  },
  activateMode: function (type) {
    this._modes[type].handler.enable();
  },
  clearShapes: function () {
    this._featureGroup.clearLayers();
  },
  deactivate: function () {
    this.deactivateMode(this._activeMode.handler.type);
  },
  deactivateMode: function (type) {
    this._modes[type].handler.disable();
  }
});

L.Map.mergeOptions({
  editControl: false
});
L.Map.addInitHook(function () {
  if (this.options.editControl) {
    var options = {};

    if (typeof this.options.editControl === 'object') {
      options = this.options.editControl;
    }

    this.editControl = L.npmap.control.edit(options).addTo(this);
  } else {
    var edit = false;
    var overlays = this.options.overlays;

    if (overlays && L.Util.isArray(overlays)) {
      for (var i = 0; i < overlays.length; i++) {
        if (overlays[i].edit) {
          edit = true;
          break;
        }
      }
    }

    if (edit) {
      this.editControl = L.npmap.control.edit({
        toolbar: false
      }).addTo(this);
    }
  }
});

module.exports = function (options) {
  return new EditControl(options);
};

},{"../icon/maki":80,"../icon/npmapsymbollibrary":81,"leaflet-draw":55}],65:[function(require,module,exports){
/* global L */

'use strict';

var util = require('../util/util');
var FullscreenControl = L.Control.extend({
  initialize: function (options) {
    this._frame = null;
    this._supported = true;

    if ((window.self !== window.top) && document.referrer !== '') {
      // The map is in an iframe.
      try {
        this._frame = window.frameElement;

        if (this._frame) {
          this._frameBody = this._getParentDocumentBody(this._frame);
        }
      } catch (exception) {
        this._supported = false;
      }
    }

    // TODO: Also add ARIA attributes.
    this._li = L.DomUtil.create('li', '');
    this._button = L.DomUtil.create('button', 'fullscreen enter', this._li);
    this._button.setAttribute('alt', 'Enter fullscreen');
    L.DomEvent.addListener(this._button, 'click', this.fullscreen, this);

    return this;
  },
  _onKeyUp: function (e) {
    if (!e) {
      e = window.event;
    }

    if (this._isFullscreen === true && e.keyCode === 27) {
      this.fullscreen();
    }
  },
  addTo: function (map) {
    var toolbar = util.getChildElementsByClassName(map.getContainer().parentNode.parentNode, 'npmap-toolbar')[0];

    toolbar.childNodes[1].appendChild(this._li);
    toolbar.style.display = 'block';
    this._container = toolbar.parentNode.parentNode;
    this._isFullscreen = false;
    this._map = map;
    util.getChildElementsByClassName(this._container.parentNode, 'npmap-map-wrapper')[0].style.top = '28px';
    return this;
  },
  _getParentDocumentBody: function (el) {
    while (el.parentNode) {
      el = el.parentNode;

      if (el.tagName.toLowerCase() === 'body') {
        return el;
      }
    }

    return null;
  },
  fullscreen: function (e) {
    L.DomEvent.preventDefault(e);

    if (this._supported) {
      var body = document.body;
      var utils;

      if (this._isFullscreen) {
        if (this._frame) {
          this._frameBody.style.height = this._frameBodyHeight;
          this._frameBody.style.margin = this._frameBodyMargin;
          this._frameBody.style.overflow = this._frameBodyOverflow;
          this._frameBody.style.padding = this._frameBodyPadding;
          this._frameBody.style.width = this._frameBodyWidth;
          this._frame.height = this._frameHeight;
          this._frame.style.height = this._frameHeightStyle;
          this._frame.style.left = this._frameLeft;
          this._frame.style.margin = this._frameMargin;
          this._frame.style.padding = this._framePadding;
          this._frame.style.position = this._framePosition;
          this._frame.style.top = this._frameTop;
          this._frame.style.width = this._frameWidthStyle;
          this._frame.style.zIndex = this._frameZindex;
          this._frame.width = this._frameWidth;
        }

        body.style.margin = this._bodyMargin;
        body.style.overflow = this._bodyOverflow;
        body.style.padding = this._bodyPadding;
        this._container.style.left = this._containerLeft;
        this._container.style.position = this._containerPosition;
        this._container.style.top = this._containerTop;
        L.DomEvent.removeListener(document, 'keyup', this._onKeyUp);
        this._isFullscreen = false;
        L.DomUtil.removeClass(this._button, 'exit');
        L.DomUtil.addClass(this._button, 'enter');
        this._button.setAttribute('alt', 'Enter fullscreen');
        this._map.fire('exitfullscreen');

        if (this._frame && window.postMessage) {
          window.parent.postMessage('exitfullscreen', '*');

          if (this._frameBody) {
            utils = window.parent.NPMapUtils;

            if (utils && utils.fullscreenControl && utils.fullscreenControl.listeners && typeof utils.fullscreenControl.listeners.exitfullscreen === 'function') {
              utils.fullscreenControl.listeners.exitfullscreen();
            }
          }
        }
      } else {
        // TODO: You should probably capture each margin and padding side individually (e.g. padding-left).

        if (this._frame) {
          this._frameBodyHeight = this._frameBody.style.height;
          this._frameBodyMargin = this._frameBody.style.margin;
          this._frameBodyOverflow = this._frameBody.style.overflow;
          this._frameBodyPadding = this._frameBody.style.padding;
          this._frameBodyWidth = this._frameBody.style.width;
          this._frameBody.style.height = '100%';
          this._frameBody.style.margin = '0';
          this._frameBody.style.overflow = 'hidden';
          this._frameBody.style.padding = '0';
          this._frameBody.style.width = '100%';
          this._frameHeight = this._frame.height;
          this._frameHeightStyle = this._frame.style.height;
          this._frameLeft = this._frame.style.left;
          this._frameMargin = this._frame.style.margin;
          this._framePadding = this._frame.style.padding;
          this._framePosition = this._frame.style.position;
          this._frameTop = this._frame.style.top;
          this._frameWidth = this._frame.width;
          this._frameWidthStyle = this._frame.style.width;
          this._frameZindex = this._frame.style.zIndex;
          this._frame.height = '100%';
          this._frame.style.height = '100%';
          this._frame.style.left = '0';
          this._frame.style.margin = '0';
          this._frame.style.padding = '0';
          this._frame.style.position = 'fixed';
          this._frame.style.top = '0';
          this._frame.style.width = '100%';
          this._frame.style.zIndex = 9999999999;
          this._frame.width = '100%';
        }

        this._bodyMargin = body.style.margin;
        this._bodyOverflow = body.style.overflow;
        this._bodyPadding = body.style.padding;
        body.style.margin = '0';
        body.style.overflow = 'hidden';
        body.style.padding = '0';
        this._containerLeft = this._container.style.left;
        this._containerPosition = this._container.style.position;
        this._containerTop = this._container.style.top;
        this._container.style.left = '0';
        this._container.style.position = 'fixed';
        this._container.style.top = '0';
        L.DomEvent.addListener(document, 'keyup', this._onKeyUp, this);
        this._isFullscreen = true;
        L.DomUtil.removeClass(this._button, 'enter');
        L.DomUtil.addClass(this._button, 'exit');
        this._button.setAttribute('alt', 'Exit fullscreen');
        this._map.fire('enterfullscreen');

        if (this._frame && window.postMessage) {
          window.parent.postMessage('enterfullscreen', '*');

          if (this._frameBody) {
            utils = window.parent.NPMapUtils;

            if (utils && utils.fullscreenControl && utils.fullscreenControl.listeners && typeof utils.fullscreenControl.listeners.enterfullscreen === 'function') {
              utils.fullscreenControl.listeners.enterfullscreen();
            }
          }
        }
      }

      this._map.invalidateSize();
    } else {
      window.alert('Sorry, but the fullscreen tool does not work for maps that are loaded in an iframe hosted on another domain.');
    }
  }
});

L.Map.mergeOptions({
  fullscreenControl: false
});
L.Map.addInitHook(function () {
  if (this.options.fullscreenControl) {
    var options = {};

    if (typeof this.options.fullscreenControl === 'object') {
      options = this.options.fullscreenControl;
    }

    this.fullscreenControl = L.npmap.control.fullscreen(options).addTo(this);
  }
});

module.exports = function (options) {
  return new FullscreenControl(options);
};

},{"../util/util":113}],66:[function(require,module,exports){
/* globals L, module, require */

'use strict';

var geocode = require('../util/geocode');
var reqwest = require('reqwest');
var util = require('../util/util');
var GeocoderControl = L.Control.extend({
  _bounds: {},
  _cache: {},
  _centroids: {},
  _pois: {},
  includes: L.Mixin.Events,
  options: {
    position: 'topright',
    provider: 'esri',
    searchPlaces: false
  },
  statics: {
    ATTRIBUTIONS: {
      BING: 'Geocoding by Microsoft',
      ESRI: 'Geocoding by Esri',
      MAPBOX: 'Geocoding by Mapbox',
      MAPQUEST: 'Geocoding by MapQuest',
      MAPZEN: 'Geocoding by Mapzen',
      NOMINATIM: [
        'Geocoding by Nominatim',
        '&copy; <a href=\'https://openstreetmap.org/copyright\'>OpenStreetMap</a> contributors'
      ]
    }
  },
  initialize: function (options) {
    L.Util.setOptions(this, options);
    return this;
  },
  onAdd: function (map) {
    var attribution = GeocoderControl.ATTRIBUTIONS[this.options.provider.toUpperCase()];
    var container = L.DomUtil.create('div', 'leaflet-control-geocoder');
    var stopPropagation = L.DomEvent.stopPropagation;

    this._button = L.DomUtil.create('button', 'search', container);
    this._input = L.DomUtil.create('input', '', container);
    this._ul = L.DomUtil.create('ul', 'leaflet-control', container);
    this._initalizeNpsIndex();
    L.DomEvent.disableClickPropagation(this._button);
    L.DomEvent.disableClickPropagation(this._input);
    L.DomEvent.disableClickPropagation(this._ul);
    L.DomEvent
      .on(this._button, 'click', this._geocodeRequest, this)
      .on(this._button, 'mousewheel', stopPropagation)
      .on(this._input, 'focus', function () {
        this.value = this.value;
      })
      .on(this._input, 'mousewheel', stopPropagation)
      .on(this._ul, 'mousewheel', stopPropagation);

    this._container = container;
    this._button.setAttribute('alt', 'Search');
    this._input.setAttribute('aria-activedescendant', null);
    this._input.setAttribute('aria-autocomplete', 'list');
    this._input.setAttribute('aria-expanded', false);
    this._input.setAttribute('aria-label', 'Geocode');
    this._input.setAttribute('aria-owns', 'geocoder_listbox');
    this._input.setAttribute('placeholder', 'Find a location');
    this._input.setAttribute('role', 'combobox');
    this._input.setAttribute('type', 'text');
    this._ul.setAttribute('id', 'geocoder_listbox');
    this._ul.setAttribute('role', 'listbox');

    if (attribution) {
      if (L.Util.isArray(attribution)) {
        for (var i = 0; i < attribution.length; i++) {
          map.attributionControl.addAttribution(attribution[i]);
        }
      } else {
        map.attributionControl.addAttribution(attribution);
      }
    }

    return container;
  },
  onRemove: function (map) {
    var attribution = GeocoderControl.ATTRIBUTIONS[this.options.provider.toUpperCase()];

    if (attribution) {
      if (L.Util.isArray(attribution)) {
        for (var i = 0; i < attribution.length; i++) {
          map.attributionControl.removeAttribution(attribution[i]);
        }
      } else {
        map.attributionControl.removeAttribution(attribution);
      }
    }
  },
  _checkScroll: function () {
    if (this._selected) {
      var top = util.getPosition(this._selected).top;
      var bottom = top + util.getOuterDimensions(this._selected).height;
      var scrollTop = this._ul.scrollTop;
      var visible = [
        scrollTop,
        scrollTop + util.getOuterDimensions(this._ul).height
      ];

      if (top < visible[0]) {
        this._ul.scrollTop = top - 10;
      } else if (bottom > visible[1]) {
        this._ul.scrollTop = top - 10;
      }
    }
  },
  _clearResults: function () {
    this._ul.innerHTML = '';
    this._ul.scrollTop = 0;
    this._ul.style.display = 'none';
    this._input.setAttribute('aria-activedescendant', null);
    this._input.setAttribute('aria-expanded', false);
    this._selected = null;
    this._oldValue = '';
  },
  _debounce: function (fn, delay) {
    var timer = null;

    return function () {
      var args = arguments;
      var context = this;

      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  },
  _geocodeRequest: function (e) {
    var value = this._input.value;

    if (typeof e === 'object') {
      L.DomEvent.preventDefault(e);
    }

    if (value.length) {
      var me = this;

      me._clearResults();
      me._showLoading();
      geocode[me.options.provider](value, function (result) {
        me._hideLoading();

        if (result && result.success) {
          if (result.results && result.results.length) {
            var first = result.results[0];

            if (first.bounds) {
              me._map.fitBounds(first.bounds);
            } else if (first.latLng) {
              me._map.setView(first.latLng, 17);
            } else {
              me._map.notify.danger('There was an error finding that location. Please try again.');
            }
          } else {
            if (result.message) {
              me._map.notify.danger(result.message);
            } else {
              me._map.notify.danger('There was an error finding that location. Please try again.');
            }
          }
        } else {
          me._map.notify.danger('There was an error finding that location. Please try again.');
        }
      });
    }
  },
  _handleSelect: function (li) {
    var id = li.id;
    var me = this;

    this._clearResults();
    this._isDirty = false;
    this._input.focus();
    this._input.setAttribute('aria-activedescendant', id);

    if (isNaN(id) === false) {
      var poi = this._pois[parseInt(id, 10)];

      this._input.value = this._oldValue = poi.n;
      me._map.setView({
        lat: poi.y,
        lng: poi.x
      }, 17);
    } else {
      this._input.value = this._oldValue = id;

      if (me._bounds[id]) {
        me._map.fitBounds(me._bounds[id]);
      } else if (me._centroids[id]) {
        me._map.setView(me._centroids[id], 17);
      } else {
        reqwest({
          success: function (response) {
            if (response && response.total_rows) {
              var row = response.rows[0];

              if (row.b) {
                me._bounds[id] = new L.GeoJSON(JSON.parse(row.b));
                me._map.fitBounds(me._bounds[id]);
              } else {
                me._centroids[id] = {
                  lat: row.l,
                  lng: row.n
                };
                me._map.setView(me._centroids[id], 14);
              }
            } else {
              me._map.notify.danger('There was an error getting the bounds for that park.');
            }
          },
          type: 'jsonp',
          url: 'https://nps.cartodb.com/api/v2/sql?q=' + window.encodeURIComponent('SELECT ST_AsGeoJSON(ST_Extent(the_geom)) AS b,max(label_lat) AS l,max(label_lng) AS n FROM places_parks_v2 WHERE full_name=\'' + id.replace('\'', '\'\'') + '\'')
        });
      }
    }
  },
  _hideLoading: function () {
    L.DomEvent.on(this._button, 'click', this._geocodeRequest, this);
    L.DomUtil.addClass(this._button, 'search');
    L.DomUtil.removeClass(this._button, 'working');
  },
  _initalizeNpsIndex: function () {
    var me = this;

    reqwest({
      success: function (response) {
        if (response && response.total_rows) {
          me._oldValue = me._input.value;

          for (var i = 0; i < response.rows.length; i++) {
            me._bounds[response.rows[i].n] = null;
          }

          L.DomEvent.on(me._input, 'keydown', function (e) {
            switch (e.keyCode) {
              case 13:
                if (me._selected) {
                  me._handleSelect(me._selected);
                } else {
                  me._geocodeRequest();
                }
                break;
              case 27:
                // Escape
                me._clearResults();
                break;
              case 38:
                // Up
                if (me._ul.style.display === 'block') {
                  if (me._selected) {
                    L.DomUtil.removeClass(me._selected, 'selected');
                    me._selected = util.getPreviousSibling(me._selected);
                  }

                  if (!me._selected) {
                    me._selected = me._ul.childNodes[me._ul.childNodes.length - 1];
                  }

                  L.DomUtil.addClass(me._selected, 'selected');
                  me._checkScroll();
                }

                L.DomEvent.preventDefault(e);
                break;
              case 40:
                // Down
                if (me._ul.style.display === 'block') {
                  if (me._selected) {
                    L.DomUtil.removeClass(me._selected, 'selected');
                    me._selected = util.getNextSibling(me._selected);
                  }

                  if (!me._selected) {
                    me._selected = me._ul.childNodes[0];
                  }

                  L.DomUtil.addClass(me._selected, 'selected');
                  me._checkScroll();
                }

                L.DomEvent.preventDefault(e);
                break;
            }
          });
          L.DomEvent.on(me._input, 'keyup', me._debounce(function (e) {
            var value = this.value;

            if (value) {
              var keyCode = e.keyCode;

              if (keyCode !== 13 && keyCode !== 27 && keyCode !== 38 && keyCode !== 40) {
                if (value !== me._oldValue) {
                  me._isDirty = true;
                  me._oldValue = value;

                  if (value.length) {
                    var results = [];

                    for (var key in me._bounds) {
                      if (key.toLowerCase().indexOf(value.toLowerCase()) !== -1) {
                        results.push({
                          d: key
                        });
                      }
                    }

                    if (me.options.searchPlaces === true) {
                      if (me._cache[value]) {
                        for (var j = 0; j < me._cache[value].length; j++) {
                          results.push(me._cache[value][j]);
                        }

                        me._resultsReady(value, results);
                      } else {
                        me._showLoading();
                        reqwest({
                          success: function (response) {
                            if (response && response.total_rows) {
                              me._cache[value] = response.rows;

                              for (var j = 0; j < response.rows.length; j++) {
                                var row = response.rows[j];
                                var c = row.c;

                                results.push(row);

                                if (!me._pois[c]) {
                                  me._pois[c] = row;
                                }
                              }
                            }

                            me._resultsReady(value, results);
                            me._hideLoading();
                          },
                          type: 'jsonp',
                          url: 'https://nps.cartodb.com/api/v2/sql?q=SELECT cartodb_id AS c,name AS n,type AS t,st_x(the_geom) AS x,st_y(the_geom) AS y FROM points_of_interest WHERE name IS NOT NULL AND name ILIKE \'%25' + value.replace(/'/g, '\'\'') + '%25\' ORDER BY name LIMIT(10)'
                        });
                      }
                    } else {
                      me._resultsReady(value, results);
                    }
                  }
                }
              }
            } else {
              me._clearResults();
            }
          }, 250));
        } else {
          me._map.notify.danger('There was an error getting the bounds for that park.');
        }
      },
      type: 'jsonp',
      url: 'https://nps.cartodb.com/api/v2/sql?q=SELECT full_name AS n FROM places_parks_v2 WHERE the_geom IS NOT NULL OR (label_lat IS NOT NULL AND label_lng IS NOT NULL) ORDER BY full_name'
    });
  },
  _resultsReady: function (value, results) {
    var me = this;

    if (results.length > 0) {
      me._clearResults();

      for (var i = 0; i < results.length; i++) {
        var li = L.DomUtil.create('li', null, me._ul);
        var result = results[i];
        var d = result.d;
        var j;
        var type;

        if (d) {
          li.className = 'npmap-geocoder-result-park';
          li.id = d;
          type = 'park';
        } else {
          d = result.n;
          li.className = 'npmap-geocoder-result-poi';
          li.id = result.c;
          type = 'poi';
        }

        j = d.toLowerCase().indexOf(value.toLowerCase());
        li.innerHTML = (d.slice(0, j) + '<strong>' + d.slice(j, j + value.length) + '</strong>' + d.slice(j + value.length) + (me.options.searchPlaces ? ('<br>' + (type === 'park' ? 'NPS Unit' : result.t)) : ''));
        L.DomEvent.on(li, 'click', function () {
          me._handleSelect(this);
        });
      }

      me._ul.style.display = 'block';
      me._input.setAttribute('aria-expanded', true);
    } else {
      me._clearResults();
    }
  },
  _showLoading: function () {
    L.DomEvent.off(this._button, 'click', this._geocodeRequest);
    L.DomUtil.removeClass(this._button, 'search');
    L.DomUtil.addClass(this._button, 'working');
  }
});

L.Map.mergeOptions({
  geocoderControl: false
});
L.Map.addInitHook(function () {
  if (this.options.geocoderControl) {
    var options = {};

    if (typeof this.options.geocoderControl === 'object') {
      options = this.options.geocoderControl;
    }

    this.geocoderControl = L.npmap.control.geocoder(options).addTo(this);
  }
});

module.exports = function (options) {
  return new GeocoderControl(options);
};

},{"../util/geocode":108,"../util/util":113,"reqwest":60}],67:[function(require,module,exports){
/* global L */

'use strict';

var util = require('../util/util');
var HashControl = L.Class.extend({
  addTo: function (map) {
    if (this._supported) {
      var me = this;

      this._map = map;

      // A bit of a hack to give map.js time to setup the DOM. Really only needed when the modules pane is set to visible = true.
      setTimeout(function () {
        me._onHashChange(true);
        me._startListening();
      }, 250);
      return this;
    } else {
      window.alert('Sorry, but the hash control does not work for maps that are loaded in an iframe hosted from another domain.');
    }
  },
  initialize: function () {
    this._iframe = false;
    this._supported = true;
    this._window = window;

    if ((window.self !== window.top) && document.referrer !== '') {
      if (util.parseDomainFromUrl(document.referrer) === util.parseDomainFromUrl(window.location.href)) {
        try {
          this._iframe = true;
          this._window = window.top;
        } catch (exception) {
          this._supported = false;
        }
      } else {
        this._supported = false;
      }
    }

    if (this._supported) {
      this._supportsHashChange = (function () {
        var docMode = window.documentMode;

        return ('onhashchange' in window) && (docMode === undefined || docMode > 7);
      })();
      this._supportsHistory = (function () {
        if (window.history && window.history.pushState) {
          return true;
        } else {
          return false;
        }
      })();
    }

    return this;
  },
  removeFrom: function () {
    if (this._changeTimeout) {
      clearTimeout(this._changeTimeout);
    }

    if (this.isListening) {
      this._stopListening();
    }

    delete this._map.hashControl;
    this._map = null;
  },
  _changeDefer: 100,
  _changeTimeout: null,
  _hashChangeInterval: null,
  _isListening: false,
  _lastHash: null,
  _movingMap: false,
  _formatHash: function (map) {
    var center = map.getCenter();
    var zoom = map.getZoom();
    var precision = Math.max(0, Math.ceil(Math.log(zoom) / Math.LN2));

    return '#' + [
      zoom,
      center.lat.toFixed(precision),
      center.lng.toFixed(precision)
    ].join('/');
  },
  _getParentDocumentWindow: function (el) {
    while (el.parentNode) {
      el = el.parentNode;

      if (el.tagName.toLowerCase() === 'window') {
        return el;
      }
    }

    return null;
  },
  _onHashChange: function (skipTimeout) {
    if (skipTimeout) {
      this._update();
    } else if (!this._changeTimeout) {
      var me = this;

      this._changeTimeout = setTimeout(function () {
        me._changeTimeout = null;
        me._update();
      }, this._changeDefer);
    }
  },
  _onMapMove: function () {
    var hash;

    if (this._movingMap || !this._map._loaded) {
      return false;
    }

    hash = this._formatHash(this._map);

    if (this._lastHash !== hash) {
      if (this._supportsHistory) {
        var location = this._window.location;

        this._window.history.replaceState({}, '', location.origin + location.pathname + location.search + hash);
      } else {
        if (this._iframe) {
          // TODO: This preserves browser history, and is only partially working.
          this._window.location.hash = hash;
        } else {
          this._window.location.replace(hash);
        }
      }

      this._lastHash = hash;
    }
  },
  _parseHash: function (hash) {
    var args;

    if (hash.indexOf('#') === 0) {
      hash = hash.substr(1);
    }

    args = hash.split('/');

    if (args.length === 3) {
      var lat = parseFloat(args[1]);
      var lng = parseFloat(args[2]);
      var zoom = parseInt(args[0], 10);

      if (isNaN(zoom) || isNaN(lat) || isNaN(lng)) {
        return false;
      } else {
        return {
          center: new L.LatLng(lat, lng),
          zoom: zoom
        };
      }
    } else {
      return false;
    }
  },
  _startListening: function () {
    var me = this;

    this._map.on('moveend', this._onMapMove, this);

    if (this._supportsHashChange) {
      L.DomEvent.addListener(this._window, 'hashchange', function () {
        me._onHashChange(me);
      });
    } else {
      clearInterval(this._hashChangeInterval);
      this._hashChangeInterval = setInterval(function () {
        me._onHashChange(me);
      }, 50);
    }

    this._isListening = true;
  },
  _stopListening: function () {
    this._map.off('moveend', this._onMapMove, this);

    if (this._supportsHashChange) {
      L.DomEvent.removeListener(this._window, 'hashchange', this._onHashChange, this);
    } else {
      clearInterval(this._hashChangeInterval);
      this._hashChangeInterval = null;
    }

    this._isListening = false;
  },
  _update: function () {
    var hash = this._window.location.hash;
    var parsed;

    if (hash === this._lastHash) {
      return;
    }

    parsed = this._parseHash(hash);

    if (parsed) {
      this._movingMap = true;
      this._map.setView(parsed.center, parsed.zoom);
      this._movingMap = false;
    } else {
      this._onMapMove(this._map);
    }
  }
});

L.Map.addInitHook(function () {
  if (this.options.hashControl) {
    this.hashControl = L.npmap.control.hash(this.options.hashControl).addTo(this);
  }
});

module.exports = function (options) {
  return new HashControl(options);
};

},{"../util/util":113}],68:[function(require,module,exports){
/* global L */

'use strict';

var HomeControl = L.Control.extend({
  options: {
    position: 'topleft'
  },
  initialize: function (options) {
    L.Util.extend(this.options, options);
    return this;
  },
  onAdd: function () {
    var container = L.DomUtil.create('div', 'leaflet-control-home leaflet-bar leaflet-control');
    var button = L.DomUtil.create('button', 'leaflet-bar-single', container);

    button.setAttribute('alt', 'Pan/zoom to initial extent');
    L.DomEvent
      .disableClickPropagation(button)
      .on(button, 'click', L.DomEvent.preventDefault)
      .on(button, 'click', this.toHome, this);

    return container;
  },
  toHome: function () {
    var map = this._map;
    var options = map.options;

    map.setView(options.center, options.zoom);
    map.closePopup();
  }
});

L.Map.mergeOptions({
  homeControl: true
});
L.Map.addInitHook(function () {
  if (this.options.homeControl) {
    var options = {};

    if (typeof this.options.homeControl === 'object') {
      options = this.options.homeControl;
    }

    this.homeControl = L.npmap.control.home(options).addTo(this);
  }
});

module.exports = function (options) {
  return new HomeControl(options);
};

},{}],69:[function(require,module,exports){
/* global L */

'use strict';

var util = require('../util/util');
var InfoboxControl = L.Control.extend({
  options: {
    position: 'bottomleft'
  },
  initialize: function (options) {
    L.setOptions(this, options);
    return this;
  },
  onAdd: function () {
    this._container = L.DomUtil.create('div', 'leaflet-control-info leaflet-control');
    return this._container;
  },
  _hide: function () {
    this._container.style.display = 'none';
    L.DomUtil.removeClass(this._container, 'leaflet-tooltip-fade');

    if (this._map.activeTip === this) {
      delete this._map.activeTip;
    }
  },
  _show: function () {
    this._container.style.display = 'inline-block';
    L.DomUtil.addClass(this._container, 'leaflet-tooltip-fade');
  },
  getHtml: function () {
    return this._container.innerHTML;
  },
  hide: function () {
    this._hide();
  },
  isVisible: function () {
    return this._container.style.display !== 'none';
  },
  setHtml: function (html) {
    this._container.innerHTML = util.unescapeHtml(html);
  },
  setPosition: function () {
    return;
  },
  show: function (centerpoint, html) {
    if (this._map.activeTip && (this._map.activeTip !== this)) {
      this._map.activeTip._hide();
    }

    this._map.activeTip = this;

    if (html) {
      this.setHtml(html);
    }

    this._show();
  }
});

L.Map.mergeOptions({
  infoboxControl: false
});
L.Map.addInitHook(function () {
  if (this.options.infoboxControl) {
    var options = {};

    if (typeof this.options.infoboxControl === 'object') {
      options = this.options.infoboxControl;
    }

    this.infoboxControl = L.npmap.control.infobox(options).addTo(this);
  }
});

module.exports = function (options) {
  return new InfoboxControl(options);
};

},{"../util/util":113}],70:[function(require,module,exports){
/* globals L */

'use strict';

var LegendControl = L.Control.extend({
  options: {
    position: 'topright'
  },
  _html: null,
  initialize: function (options) {
    L.Util.setOptions(this, options);
    this._container = L.DomUtil.create('div', 'leaflet-control-legend');
    L.DomEvent.disableClickPropagation(this._container);

    if (options.html) {
      if (typeof options.html === 'string') {
        this._html = options.html;
        this._container.innerHTML = this._html;
      } else if (typeof options.html === 'function') {
        this._html = options.html();
        this._container.innerHTML = this._html;
      } else {
        this._html = options.html;
        this._container.appendChild(this._html);
      }
    } else if (options.overlays) {
      this._html = this._createLegend(options.overlays);
      this._container.innerHTML = this._html;
    }
  },
  onAdd: function (map) {
    this._map = map;

    if (!this._html) {
      // TODO: Add 'ready' event to map, then iterate through all baselayers and shapes, per individual overlay, on the map, dynamically building a legend.
    }

    return this._container;
  },
  _createLegend: function (overlays) {
    var html = '';
    var options = this.options;

    if (options.title) {
      html += '<h3>' + options.title + '</h3>';
    }

    for (var i = 0; i < overlays.length; i++) {
      var overlay = overlays[i];

      if (overlay.name) {
        html += '<h4>' + overlay.name + '</h4>';
      }

      if (overlay.icons) {
        html += '<ul>';

        for (var icon in overlay.icons) {
          html += '<li><span style="background-color:' + overlay.icons[icon] + ';">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> ' + icon + '</li>';
        }
      }

      /*
      if (overlay.clustered) {
        var bottomValue = 0,
          clusterHtml = '<h6>Groups</h6>',
          lastColor = '',
          upperValue = 0;

        for (var group = 0; group < options.layers[layer].clustered.length; group++) {
          if (lastColor && options.layers[layer].clustered[group].color !== lastColor) {
            if (!lastColor.match(/^#/g)) {lastColor = '#' + lastColor;}
            clusterHtml += '<span style="background-color: ' + lastColor  + '; border-radius: 8px;">&nbsp;&nbsp;&nbsp;&nbsp;</span> ' + bottomValue + ' - ' + upperValue + ' points</br>';
            bottomValue = upperValue + 1;
          }
          upperValue = options.layers[layer].clustered[group].maxNodes;
          lastColor = options.layers[layer].clustered[group].color;
        }

        if (!lastColor.match(/^#/g)) {
          lastColor = '#' + lastColor;
        }

        if (bottomValue === 0) {
          clusterHtml = '<span style="background-color: ' + lastColor  + '; border-radius: 8px;">&nbsp;&nbsp;&nbsp;&nbsp;</span> Grouped Points</br>';
        } else {
          clusterHtml += '<span style="background-color: ' + lastColor  + '; border-radius: 8px;">&nbsp;&nbsp;&nbsp;&nbsp;</span> &gt; ' + bottomValue + ' points</br>';
        }

        html += clusterHtml;
      }
      */
    }

    return html;
  }
  /*
  _update: function() {
    function cssString(css) {
      var returnValue = '';

      for (var item in css) {
        returnValue += item + ': ' + css[item] + ';';
      }

      return returnValue;
    }

    if (this._div) {
      this._div.innerHTML = this._html;
      this._div.setAttribute('style', cssString(this.options.style));
    }

    return this;
  },
  _addLegend: function(html, options) {
    this.options.style = {
      'background-color': 'rgba(255,255,255,.8)',
      'background-color': '#fff',
      'padding': '5px'
    };

    options = L.Util.extend(this.options, options);
    html = html || this._html;
    this._html = html;

    return this._update();
  },
  */
});

L.Map.mergeOptions({
  legendControl: false
});
L.Map.addInitHook(function () {
  if (this.options.legendControl) {
    var options = {};

    if (typeof this.options.legendControl === 'object') {
      options = this.options.legendControl;
    }

    this.legendControl = L.npmap.control.legend(options).addTo(this);
  }
});

module.exports = function (options) {
  return new LegendControl(options);
};

},{}],71:[function(require,module,exports){
/* global L */

'use strict';

var LocateControl = L.Control.extend({
  options: {
    circlePadding: [0, 0],
    circleStyle: {
      clickable: false,
      color: '#136aec',
      fillColor: '#136aec',
      fillOpacity: 0.15,
      opacity: 0.5,
      weight: 2
    },
    drawCircle: true,
    follow: false,
    followCircleStyle: {},
    followMarkerStyle: {},
    locateOptions: {},
    markerStyle: {
      clickable: false,
      color: '#136aec',
      fillColor: '#2a93ee',
      fillOpacity: 0.7,
      opacity: 0.9,
      radius: 5,
      weight: 2
    },
    metric: true,
    onLocationError: function (context, error) {
      context._map.notify.danger(error.message);
    },
    onLocationOutsideMapBounds: function (context) {
      context._map.notify.danger(context.options.strings.outsideMapBoundsMsg);
    },
    position: 'topleft',
    setView: true,
    stopFollowingOnDrag: true,
    strings: {
      outsideMapBoundsMsg: 'You seem to be located outside of the boundaries of the map',
      popup: 'You are within {distance} {unit} of this point',
      title: 'Show me where I am'
    }
  },
  onAdd: function (map) {
    var me = this;
    var obj = {};

    this._container = L.DomUtil.create('div', 'npmap-control-locate leaflet-bar leaflet-control');
    this._event = undefined;
    this._layer = new L.LayerGroup().addTo(map);
    this._locateOptions = {
      watch: true
    };
    this._map = map;
    L.extend(this._locateOptions, this.options.locateOptions);
    L.extend(this._locateOptions, {
      setView: false
    });
    L.extend(obj, this.options.markerStyle, this.options.followMarkerStyle);
    this.options.followMarkerStyle = obj;
    obj = {};
    L.extend(obj, this.options.circleStyle, this.options.followCircleStyle);
    this.options.followCircleStyle = obj;
    me._button = L.DomUtil.create('button', 'leaflet-bar-single', this._container);
    me._button.setAttribute('alt', this.options.strings.title);
    L.DomEvent
      .on(me._button, 'click', L.DomEvent.stopPropagation)
      .on(me._button, 'click', L.DomEvent.preventDefault)
      .on(me._button, 'click', function () {
        if (me._active && (me._event === undefined || map.getBounds().contains(me._event.latlng) || !me.options.setView || isOutsideMapBounds())) {
          stopLocate();
        } else {
          locate();
        }
      })
      .on(me._button, 'dblclick', L.DomEvent.stopPropagation);

    function isOutsideMapBounds () {
      if (me._event === undefined) {
        return false;
      }

      return map.options.maxBounds && !map.options.maxBounds.contains(me._event.latlng);
    }
    function locate () {
      if (!me._event) {
        L.DomUtil.addClass(me._button, 'requesting');
        L.DomUtil.addClass(me._button, 'pressed');
        L.DomUtil.removeClass(me._button, 'following');
      } else {
        visualizeLocation();
      }

      if (!me._active) {
        map.locate(me._locateOptions);
      }

      me._active = true;

      if (me.options.follow) {
        startFollowing();
      }

      if (me.options.setView) {
        me._locateOnNextLocationFound = true;
      }
    }
    function onLocationError (err) {
      if (err.code === 3 && me._locateOptions.watch) {
        return;
      }

      stopLocate();
      me.options.onLocationError(me, err);
    }
    function onLocationFound (e) {
      if (me._event && (me._event.latlng.lat === e.latlng.lat && me._event.latlng.lng === e.latlng.lng && me._event.accuracy === e.accuracy)) {
        return;
      }

      if (!me._active) {
        return;
      }

      me._event = e;

      if (me.options.follow && me._following) {
        me._locateOnNextLocationFound = true;
      }

      visualizeLocation();
    }
    function resetVariables () {
      me._active = false;
      me._following = false;
      me._locateOnNextLocationFound = me.options.setView;
    }
    function startFollowing () {
      map.fire('startfollowing');
      me._following = true;

      if (me.options.stopFollowingOnDrag) {
        map.on('dragstart', stopFollowing);
      }
    }
    function stopFollowing () {
      map.fire('stopfollowing');
      me._following = false;

      if (me.options.stopFollowingOnDrag) {
        map.off('dragstart', stopFollowing);
      }

      visualizeLocation();
    }
    function stopLocate () {
      map.stopLocate();
      map.off('dragstart', stopFollowing);
      L.DomUtil.removeClass(me._button, 'following');
      L.DomUtil.removeClass(me._button, 'pressed');
      L.DomUtil.removeClass(me._button, 'requesting');
      resetVariables();
      me._layer.clearLayers();
      me._circleMarker = undefined;
      me._circle = undefined;
    }
    function visualizeLocation () {
      var mStyle;
      var o;
      var radius;
      var style;

      if (me._event.accuracy === undefined) {
        me._event.accuracy = 0;
      }

      radius = me._event.accuracy;

      if (me._locateOnNextLocationFound) {
        if (isOutsideMapBounds()) {
          me.options.onLocationOutsideMapBounds(me);
        } else {
          map.fitBounds(me._event.bounds, {
            padding: me.options.circlePadding
          });
        }

        me._locateOnNextLocationFound = false;
      }

      if (me.options.drawCircle) {
        if (me._following) {
          style = me.options.followCircleStyle;
        } else {
          style = me.options.circleStyle;
        }

        if (!me._circle) {
          me._circle = L.circle(me._event.latlng, radius, style).addTo(me._layer);
        } else {
          me._circle.setLatLng(me._event.latlng).setRadius(radius);

          for (o in style) {
            me._circle.options[o] = style[o];
          }
        }
      }

      if (me._following) {
        mStyle = me.options.followMarkerStyle;
      } else {
        mStyle = me.options.markerStyle;
      }

      if (!me._circleMarker) {
        me._circleMarker = L.circleMarker(me._event.latlng, mStyle)
          .addTo(me._layer);
      } else {
        me._circleMarker.setLatLng(me._event.latlng);

        for (o in mStyle) {
          me._circleMarker.options[o] = mStyle[o];
        }
      }

      if (!me._container) {
        return;
      }

      L.DomUtil.removeClass(me._button, 'requesting');
      L.DomUtil.addClass(me._button, 'pressed');

      if (me._following) {
        L.DomUtil.addClass(me._button, 'following');
      } else {
        L.DomUtil.removeClass(me._button, 'following');
      }
    }

    resetVariables();
    map.on('locationerror', onLocationError, me);
    map.on('locationfound', onLocationFound, me);
    this.locate = locate;
    this.stopFollowing = stopFollowing;
    this.stopLocate = stopLocate;
    return this._container;
  }
});

L.Map.addInitHook(function () {
  if (this.options.locateControl) {
    var options = {};

    if (typeof this.options.locateControl === 'object') {
      options = this.options.locateControl;
    }

    this.locateControl = L.npmap.control.locate(options).addTo(this);
  }
});

module.exports = function (options) {
  return new LocateControl(options);
};

},{}],72:[function(require,module,exports){
/* global L */
/* jshint camelcase: false */

'use strict';

require('leaflet-draw');

var util = require('../util/util');
var MeasureControl = L.Control.extend({
  includes: L.Mixin.Events,
  options: {
    polygon: {
      allowIntersection: false,
      drawError: {
        color: '#f06eaa',
        message: 'Polygons can\'t overlap',
        timeout: 500
      },
      repeatMode: true,
      shapeOptions: {
        color: '#882255',
        fillOpacity: 0.4,
        opacity: 1,
        weight: 4
      }
    },
    polyline: {
      repeatMode: true,
      shapeOptions: {
        color: '#882255',
        opacity: 1,
        weight: 4
      }
    },
    position: 'topleft',
    units: {
      area: [
        'ac',
        'ha'
      ],
      distance: [
        'mi',
        'ft',
        'm'
      ]
    }
  },
  // TODO: Also store conversion formulas here.
  units: {
    area: {
      'ac': 'Acres',
      'ha': 'Hectares'
    },
    distance: {
      'ft': 'Feet',
      'm': 'Meters',
      'mi': 'Miles'
    }
  },
  initialize: function (options) {
    L.Util.setOptions(this, options);
    this._featureGroup = new L.FeatureGroup();
    this._featureGroupTooltips = new L.FeatureGroup();
    this._modes = {};
    this._resetVariables();

    if (this.options && this.options.units) {
      var unit;

      if (this.options.units.area && this.options.units.area.length) {
        unit = this.options.units.area[0];

        if (this.units.area[unit]) {
          this._activeUnitArea = unit;
          this._lastUnitArea = unit;
        }
      }

      if (this.options.units.distance && this.options.units.distance.length) {
        unit = this.options.units.distance[0];

        if (this.units.distance[unit]) {
          this._activeUnitDistance = unit;
          this._lastUnitDistance = unit;
        }
      }
    }

    return this;
  },
  onAdd: function (map) {
    if (this._activeUnitArea || this._activeUnitDistance) {
      var liSelect = document.createElement('li');
      var html;
      var i;
      var unit;

      this._container = L.DomUtil.create('div', 'leaflet-bar leaflet-control npmap-control-measure');
      this._map = map;
      this._menu = L.DomUtil.create('ul', '', this._container);
      this._button = L.DomUtil.create('button', 'leaflet-bar-single measure-control', this._container);

      if (this._activeUnitArea) {
        var liArea = L.DomUtil.create('li', '', this._menu);

        html = '';
        this._buttonArea = L.DomUtil.create('button', 'pressed', liArea);
        this._buttonArea.innerHTML = 'Area';
        this._selectUnitArea = L.DomUtil.create('select', '', liSelect);

        // TODO: Verify this is a supported unit.
        for (i = 0; i < this.options.units.area.length; i++) {
          unit = this.options.units.area[i];
          html += '<option value="' + unit + '"' + (i === 0 ? ' selected' : '') + '>' + this.units.area[unit] + '</option>';
        }

        this._selectUnitArea.innerHTML = html;
      }

      if (this._activeUnitDistance) {
        var liDistance = L.DomUtil.create('li', '', this._menu);
        var me = this;

        html = '';
        this._buttonDistance = L.DomUtil.create('button', (function () {
          if (me._buttonArea) {
            return '';
          } else {
            return 'pressed';
          }
        })(), liDistance);
        this._buttonDistance.innerHTML = 'Distance';
        this._selectUnitDistance = L.DomUtil.create('select', '', liSelect);

        // TODO: Verify this is a supported unit.
        for (i = 0; i < this.options.units.distance.length; i++) {
          unit = this.options.units.distance[i];
          html += '<option value="' + unit + '"' + (i === 0 ? ' selected' : '') + '>' + this.units.distance[unit] + '</option>';
        }

        this._selectUnitDistance.innerHTML = html;
      }

      this._menu.appendChild(liSelect);
      map
        .addLayer(this._featureGroup)
        .addLayer(this._featureGroupTooltips);
      this._initializeMode(this._buttonArea, new L.Draw.Polygon(map, this.options.polygon));
      this._initializeMode(this._buttonDistance, new L.Draw.Polyline(map, this.options.polyline));
      this._setupListeners();

      return this._container;
    } else {
      throw new Error('No valid units specified for measure control!');
    }
  },
  _buildTooltipArea: function (total) {
    return '' +
      '<div class="leaflet-measure-tooltip-area">' +
        '<div class="leaflet-measure-tooltip-total">' +
          '<span>' +
            total.toFixed(2) + ' ' + this._activeUnitArea +
          '</span>' +
        '</div>' +
      '</div>' +
    '';
  },
  _buildTooltipDistance: function (total, difference) {
    var html = '' +
      '<div class="leaflet-measure-tooltip-distance">' +
        '<div class="leaflet-measure-tooltip-total">' +
          '<span>' +
            total.toFixed(2) + ' ' + this._activeUnitDistance +
          '</span>' +
          '<span>' +
            total +
          '</span>' +
        '</div>' +
      '' +
    '';

    if (typeof difference !== 'undefined' && (difference !== 0) && (difference !== total)) {
      html += '' +
        '' +
          '<div class="leaflet-measure-tooltip-difference">' +
            '<span>' +
              '(+' + difference.toFixed(2) + ' ' + this._activeUnitDistance + ')' +
            '</span>' +
            '<span>' +
              difference +
            '</span>' +
          '</div>' +
        '' +
      '';
    }

    return html + '</div>';
  },
  _buttonClick: function (e, manual) {
    var button = e.target;

    if (manual || !L.DomUtil.hasClass(button, 'pressed')) {
      var add;
      var mode;
      var remove;

      if (button.innerHTML.toLowerCase() === 'distance') {
        add = this._buttonDistance;
        mode = 'distance';

        if (this._selectUnitArea) {
          this._selectUnitArea.style.display = 'none';
          remove = this._buttonArea;
          this._modes.polygon.handler.disable();
        }

        this._selectUnitDistance.style.display = 'block';
        this._modes.polyline.handler.enable();
      } else {
        add = this._buttonArea;
        mode = 'area';

        if (this._selectUnitDistance) {
          this._selectUnitDistance.style.display = 'none';
          remove = this._buttonDistance;
          this._modes.polyline.handler.disable();
        }

        this._selectUnitArea.style.display = 'block';
        this._modes.polygon.handler.enable();
      }

      L.DomUtil.addClass(add, 'pressed');

      if (remove) {
        L.DomUtil.removeClass(remove, 'pressed');
      }

      this._startMeasuring(mode);
    }
  },
  _calculateArea: function (to, val, from) {
    from = from || 'm';

    if (from !== to) {
      if (from === 'ac') {
        switch (to) {
          case 'ha':
            val = val / 2.47105;
            break;
          case 'm':
            val = val * 4046.85642;
            break;
        }
      } else if (from === 'ha') {
        switch (to) {
          case 'ac':
            val = val * 2.47105;
            break;
          case 'm':
            val = val * 10000;
            break;
        }
      } else if (from === 'm') {
        switch (to) {
          case 'ac':
            val = val / 4046.85642;
            break;
          case 'ha':
            val = val / 10000;
            break;
        }
      }
    }

    return val;
  },
  _calculateDistance: function (to, val, from) {
    from = from || 'm';

    if (from !== to) {
      if (from === 'ft') {
        switch (to) {
          case 'm':
            val = val / 3.28084;
            break;
          case 'mi':
            val = val / 5280;
            break;
        }
      } else if (from === 'm') {
        switch (to) {
          case 'ft':
            val = val * 3.28084;
            break;
          case 'mi':
            val = val * 0.000621371192;
            break;
        }
      } else if (from === 'mi') {
        switch (to) {
          case 'ft':
            val = val * 5280;
            break;
          case 'm':
            val = val * 1609.344;
            break;
        }
      }
    }

    return val;
  },
  _createTooltip: function (latLng, text) {
    return new L.Marker(latLng, {
      clickable: false,
      icon: new L.DivIcon({
        className: 'leaflet-measure-tooltip',
        html: text,
        iconAnchor: [
          -5,
          -5
        ]
      })
    }).addTo(this._featureGroupTooltips);
  },
  _handlerActivated: function (e) {
    if (this._activeMode && this._activeMode.handler.enabled()) {
      this._activeMode.handler.disable();
    }

    this._activeMode = this._modes[e.handler];
    this.fire('activated');
  },
  _handlerDeactivated: function () {
    this._resetVariables();
    this.fire('deactivated');
  },
  _initializeMode: function (button, handler) {
    var type = handler.type;

    this._modes[type] = {
      button: button,
      handler: handler
    };
    this._modes[type].handler
      .on('disabled', this._handlerDeactivated, this)
      .on('enabled', this._handlerActivated, this);
  },
  // TODO: Add circlemarkers at the vertices, and make these clickable to finish the measurement.
  _mouseClickArea: function (e) {
    var latLng = e.latlng;

    if (this._activePolygon) {
      var latLngs;

      this._activePolygon.addLatLng(latLng);
      latLngs = this._activePolygon.getLatLngs();

      if (latLngs.length > 2) {
        if (this._activeTooltip) {
          this._featureGroupTooltips.removeLayer(this._activeTooltip);
        }

        this._area = this._calculateArea(this._activeUnitArea, L.GeometryUtil.geodesicArea(latLngs));
        this._activeTooltip = this._createTooltip(latLng, this._buildTooltipArea(this._area));
      }
    } else {
      this._activePolygon = new L.Polygon([
        latLng
      ]);
      this._area = 0;
    }

    if (this._tempTooltip) {
      this._removeTempTooltip();
    }
  },
  // TODO: Add circlemarkers at the vertices, and make these clickable to finish the measurement.
  _mouseClickDistance: function (e) {
    var latLng = e.latlng;

    if (this._activePoint) {
      var distance = this._calculateDistance(this._activeUnitDistance, latLng.distanceTo(this._activePoint));

      this._distance = this._distance + distance;
      this._activeTooltip = this._createTooltip(latLng, this._buildTooltipDistance(this._distance, distance));
    } else {
      this._distance = 0;
    }

    this._activePoint = latLng;

    if (this._tempTooltip) {
      this._removeTempTooltip();
    }
  },
  _mouseMove: function (e) {
    var latLng = e.latlng;

    if (!latLng || !this._activePoint) {
      return;
    }

    if (!L.DomUtil.hasClass(this._buttonArea, 'pressed')) {
      this._mouseMoveDistance(latLng);
    }
  },
  _mouseMoveDistance: function (latLng) {
    var distance = this._calculateDistance(this._activeUnitDistance, latLng.distanceTo(this._activePoint));
    var html = this._buildTooltipDistance(this._distance + distance);

    if (this._tempTooltip) {
      this._updateTooltip(latLng, html, this._tempTooltip);
    } else {
      this._tempTooltip = this._createTooltip(latLng, html);
    }
  },
  _onKeyDown: function (e) {
    if (e.keyCode === 27) {
      this._toggleMeasure();
    }
  },
  _onSelectUnitArea: function () {
    var tooltips = util.getElementsByClassName('leaflet-measure-tooltip-area');

    this._lastUnitArea = this._activeUnitArea;
    this._activeUnitArea = this._selectUnitArea.options[this._selectUnitArea.selectedIndex].value;

    for (var i = 0; i < tooltips.length; i++) {
      var tooltip = tooltips[i];
      var node = tooltip.childNodes[0].childNodes[0];

      tooltip.parentNode.innerHTML = this._buildTooltipArea(this._calculateArea(this._activeUnitArea, parseFloat(node.innerHTML), this._lastUnitArea));
    }
  },
  _onSelectUnitDistance: function () {
    var tooltips = util.getElementsByClassName('leaflet-measure-tooltip-distance');

    this._lastUnitDistance = this._activeUnitDistance;
    this._activeUnitDistance = this._selectUnitDistance.options[this._selectUnitDistance.selectedIndex].value;

    for (var i = 0; i < tooltips.length; i++) {
      var tooltip = tooltips[i];
      var childNodes = tooltip.childNodes;
      var difference;
      var differenceNode;
      var total;
      var totalNode;

      if (childNodes.length === 2) {
        differenceNode = childNodes[1].childNodes[1];
        totalNode = childNodes[0].childNodes[1];
      } else {
        differenceNode = childNodes[0].childNodes[1];
      }

      difference = this._calculateDistance(this._activeUnitDistance, parseFloat(differenceNode.innerHTML), this._lastUnitDistance);

      if (totalNode) {
        total = this._calculateDistance(this._activeUnitDistance, parseFloat(totalNode.innerHTML), this._lastUnitDistance);
        tooltip.parentNode.innerHTML = this._buildTooltipDistance(total, difference);
      } else {
        tooltip.parentNode.innerHTML = this._buildTooltipDistance(difference);
      }
    }

    if (this._activeTooltip) {
      this._distance = parseFloat(this._activeTooltip._icon.childNodes[0].childNodes[0].childNodes[1].innerHTML);

      // TODO: You should really just update this._tempTooltip with the new distance.
      if (this._tempTooltip) {
        this._removeTempTooltip();
      }
    }
  },
  _removeListeners: function () {
    var map = this._map;

    L.DomEvent
      .off(document, 'keydown', this._onKeyDown)
      .off(map, 'click', this._mouseClickArea)
      .off(map, 'click', this._mouseClickDistance)
      .off(map, 'dblclick', this._handlerDeactivated)
      .off(map, 'mousemove', this._mouseMove);
  },
  _removeTempTooltip: function () {
    this._featureGroupTooltips.removeLayer(this._tempTooltip);
    this._tempTooltip = null;
  },
  _resetVariables: function () {
    this._activeMode = null;
    this._activePoint = null;
    this._activePolygon = null;
    this._activeTooltip = null;
    this._area = 0;
    this._currentCircles = [];
    this._distance = 0;
    this._layerGroupPath = null;
    this._tempTooltip = null;
  },
  _setupListeners: function () {
    var me = this;

    L.DomEvent
      .disableClickPropagation(this._button)
      .disableClickPropagation(this._menu)
      .on(this._button, 'click', this._toggleMeasure, this);

    if (this._buttonArea) {
      L.DomEvent
        .on(this._buttonArea, 'click', this._buttonClick, this)
        .on(this._selectUnitArea, 'change', this._onSelectUnitArea, this);
    }

    if (this._buttonDistance) {
      L.DomEvent
        .on(this._buttonDistance, 'click', this._buttonClick, this)
        .on(this._selectUnitDistance, 'change', this._onSelectUnitDistance, this);
    }

    this._map.on('draw:created', function (e) {
      if (L.DomUtil.hasClass(me._button, 'pressed')) {
        var added = [];
        var layers = me._featureGroupTooltips.getLayers();
        var i;

        me._featureGroup.addLayer(e.layer);

        for (i = 0; i < layers.length; i++) {
          added.push(layers[i]);
          me._featureGroup.addLayer(layers[i]);
        }

        for (i = 0; i < layers.length; i++) {
          me._featureGroupTooltips.removeLayer(layers[i]);
        }

        for (i = 0; i < added.length; i++) {
          added[i].addTo(me._map);
        }
      }
    });
  },
  _startMeasuring: function (type) {
    var map = this._map;

    map.closePopup();
    this._featureGroupTooltips.clearLayers();
    this._removeListeners();
    L.DomEvent
      .on(document, 'keydown', this._onKeyDown, this)
      .on(map, 'dblclick', this._handlerDeactivated, this)
      .on(map, 'mousemove', this._mouseMove, this);

    if (type === 'area') {
      L.DomEvent.on(map, 'click', this._mouseClickArea, this);
    } else {
      L.DomEvent.on(map, 'click', this._mouseClickDistance, this);
    }
  },
  _toggleMeasure: function () {
    var map = this._map;

    if (L.DomUtil.hasClass(this._button, 'pressed')) {
      L.DomUtil.removeClass(this._button, 'pressed');
      this._menu.style.display = 'none';
      this._removeListeners();
      this._featureGroup.clearLayers();
      this._featureGroupTooltips.clearLayers();
      map._controllingInteractivity = 'map';
      this._activeMode.handler.disable();
    } else {
      if (map._controllingInteractivity !== 'map') {
        map[map._controllingInteractivity + 'Control'].deactivate();
      }

      L.DomUtil.addClass(this._button, 'pressed');
      this._menu.style.display = 'block';

      if (this._buttonArea && L.DomUtil.hasClass(this._buttonArea, 'pressed')) {
        this._buttonClick({
          target: this._buttonArea
        }, true);
      } else {
        this._buttonClick({
          target: this._buttonDistance
        }, true);
      }

      map._controllingInteractivity = 'measure';
    }
  },
  _updateTooltip: function (latLng, html, tooltip) {
    tooltip = tooltip || this._activeTooltip;
    tooltip.setLatLng(latLng);
    tooltip._icon.innerHTML = html;
  },
  activate: function () {
    if (!L.DomUtil.hasClass(this._button, 'pressed')) {
      this._toggleMeasure();
    }
  },
  deactivate: function () {
    if (L.DomUtil.hasClass(this._button, 'pressed')) {
      this._toggleMeasure();
    }
  }
});

L.Map.mergeOptions({
  measureControl: false
});
L.Map.addInitHook(function () {
  if (this.options.measureControl) {
    var options = {};

    if (typeof this.options.measureControl === 'object') {
      options = this.options.measureControl;
    }

    this.measureControl = L.npmap.control.measure(options).addTo(this);
  }
});

module.exports = function (options) {
  return new MeasureControl(options);
};

},{"../util/util":113,"leaflet-draw":55}],73:[function(require,module,exports){
/* global L */

'use strict';

var baselayerPresets = require('../preset/baselayers.json');
var util = require('../util/util');
var OverviewControl = L.Control.extend({
  options: {
    autoToggleDisplay: false,
    height: 150,
    position: 'bottomright',
    toggleDisplay: true,
    width: 150,
    zoomAnimation: false,
    zoomLevelFixed: false,
    zoomLevelOffset: -5
  },
  addTo: function (map) {
    L.Control.prototype.addTo.call(this, map);
    this._miniMap.setView(this._mainMap.getCenter(), this._decideZoom(true));
    this._setDisplay(this._decideMinimized());
    return this;
  },
  initialize: function (options) {
    util.strict(options, 'object');

    if (options.layer) {
      if (typeof options.layer === 'string') {
        var name = options.layer.split('-');

        options.layer = util.clone(baselayerPresets[name[0]][name[1]]);
      }

      L.Util.setOptions(this, options);

      if (options.layer.type === 'arcgisserver') {
        this._layer = options.layer.L = L.npmap.layer[options.layer.type][options.layer.tiled === true ? 'tiled' : 'dynamic'](options.layer);
      } else {
        this._layer = options.layer.L = L.npmap.layer[options.layer.type](options.layer);
      }

      return this;
    } else {
      throw new Error('The overview control must have a layer specified.');
    }
  },
  onAdd: function (map) {
    // TODO: The hidden-* classes needs to be triggered by the width of the map itself.

    this._container = L.DomUtil.create('div', 'npmap-hidden-xs leaflet-control-overview');
    this._container.style.width = this.options.width + 'px';
    this._container.style.height = this.options.height + 'px';
    L.DomEvent.disableClickPropagation(this._container);
    L.DomEvent.on(this._container, 'mousewheel', L.DomEvent.stopPropagation);
    this._mainMap = map;
    this._attributionContainer = this._mainMap.attributionControl._container;
    this._container.style.margin = '0 0 ' + -this._attributionContainer.offsetHeight + 'px 0';
    this._miniMap = this.L = new L.Map(this._container, {
      attributionControl: false,
      autoToggleDisplay: this.options.autoToggleDisplay,
      boxZoom: !this.options.zoomLevelFixed,
      crs: map.options.crs,
      doubleClickZoom: !this.options.zoomLevelFixed,
      homeControl: false,
      keyboard: false,
      scrollWheelZoom: !this.options.zoomLevelFixed,
      smallzoomControl: false,
      touchZoom: !this.options.zoomLevelFixed,
      zoomAnimation: this.options.zoomAnimation,
      zoomControl: false
    });
    this._attributionContainer.style.marginRight = (this.options.width + 3) + 'px';
    this._miniMap.addLayer(this._layer);
    this._mainMapMoving = false;
    this._miniMapMoving = false;
    this._userToggledDisplay = false;
    this._minimized = false;
    this._transitioning = false;

    if (this.options.toggleDisplay) {
      this._addToggleButton();
    }

    this._miniMap.whenReady(L.Util.bind(function () {
      this._aimingRect = L.rectangle(this._mainMap.getBounds(), {
        clickable: false,
        color: '#d29700',
        weight: 3
      }).addTo(this._miniMap);
      this._shadowRect = L.rectangle(this._mainMap.getBounds(), {
        clickable: false,
        color: '#454545',
        fillOpacity: 0,
        opacity: 0,
        weight: 3
      }).addTo(this._miniMap);
      this._mainMap.on('moveend', this._onMainMapMoved, this);
      this._mainMap.on('move', this._onMainMapMoving, this);
      this._miniMap.on('movestart', this._onMiniMapMoveStarted, this);
      this._miniMap.on('move', this._onMiniMapMoving, this);
      this._miniMap.on('moveend', this._onMiniMapMoved, this);
    }, this));

    return this._container;
  },
  onRemove: function () {
    this._mainMap.off('moveend', this._onMainMapMoved, this);
    this._mainMap.off('move', this._onMainMapMoving, this);
    this._miniMap.off('moveend', this._onMiniMapMoved, this);
    this._miniMap.removeLayer(this._layer);
    this._attributionContainer.style.marginRight = '0';
  },
  _addToggleButton: function () {
    this._toggleDisplayButton = this._createButton('', 'Hide Overview', null, this._container, this._toggleDisplayButtonClicked, this);
    this._toggleDisplayButtonImage = L.DomUtil.create('span', null, this._toggleDisplayButton);
  },
  _createButton: function (html, title, className, container, fn, context) {
    var button = L.DomUtil.create('button', className, container);
    var stop = L.DomEvent.stopPropagation;

    button.innerHTML = html;
    button.setAttribute('alt', title);
    L.DomEvent
      .on(button, 'click', stop)
      .on(button, 'mousedown', stop)
      .on(button, 'dblclick', stop)
      .on(button, 'click', L.DomEvent.preventDefault)
      .on(button, 'click', fn, context);

    return button;
  },
  _decideMinimized: function () {
    if (this._userToggledDisplay) {
      return this._minimized;
    }

    if (this.options.autoToggleDisplay) {
      if (this._mainMap.getBounds().contains(this._miniMap.getBounds())) {
        return true;
      }

      return false;
    }

    return this._minimized;
  },
  _decideZoom: function (fromMaintoMini) {
    if (!this.options.zoomLevelFixed) {
      if (fromMaintoMini) {
        var zoom = this._mainMap.getZoom() + this.options.zoomLevelOffset;

        if (zoom < 0) {
          zoom = 0;
        }

        return zoom;
      } else {
        var currentDiff = this._miniMap.getZoom() - this._mainMap.getZoom();
        var proposedZoom = this._miniMap.getZoom() - this.options.zoomLevelOffset;
        var toRet;

        if (currentDiff > this.options.zoomLevelOffset && this._mainMap.getZoom() < this._miniMap.getMinZoom() - this.options.zoomLevelOffset) {
          if (this._miniMap.getZoom() > this._lastMiniMapZoom) {
            toRet = this._mainMap.getZoom() + 1;
            this._miniMap.setZoom(this._miniMap.getZoom() - 1);
          } else {
            toRet = this._mainMap.getZoom();
          }
        } else {
          toRet = proposedZoom;
        }

        this._lastMiniMapZoom = this._miniMap.getZoom();
        return toRet;
      }
    } else {
      if (fromMaintoMini) {
        return this.options.zoomLevelFixed;
      } else {
        return this._mainMap.getZoom();
      }
    }
  },
  _minimize: function () {
    var me = this;
    me._transitioning = true;
    me._attributionContainer.style.marginRight = '50px';
    me._container.style.width = '47px';
    me._container.style.height = '47px';
    me._minimized = true;
    me._toggleDisplayButton.style.display = 'none';
    me._toggleDisplayButton.style.height = '47px';
    me._toggleDisplayButton.style.width = '47px';
    me._toggleDisplayButtonImage.className += ' minimized';
    me._toggleDisplayButtonImage.style.bottom = 'auto';
    me._toggleDisplayButtonImage.style.right = 'auto';
    me._toggleDisplayButtonImage.style.left = '10px';
    me._toggleDisplayButtonImage.style.top = '10px';
    setTimeout(function () {
      me._toggleDisplayButton.style.display = 'block';
      me._toggleDisplayButton.focus();
      me._aimingRect.setStyle({
        fillOpacity: 0,
        opacity: 0
      });
      me._miniMap.invalidateSize();
      me._transitioning = false;
    }, 200);
  },
  _onMainMapMoved: function () {
    if (!this._transitioning) {
      if (!this._miniMapMoving) {
        this._mainMapMoving = true;
        this._miniMap.setView(this._mainMap.getCenter(), this._decideZoom(true));
        this._setDisplay(this._decideMinimized());
      } else {
        this._miniMapMoving = false;
      }
    }

    this._aimingRect.setBounds(this._mainMap.getBounds());
  },
  _onMainMapMoving: function () {
    this._aimingRect.setBounds(this._mainMap.getBounds());
  },
  _onMiniMapMoved: function () {
    if (!this._transitioning) {
      if (!this._mainMapMoving) {
        this._miniMapMoving = true;
        this._mainMap.setView(this._miniMap.getCenter(), this._decideZoom(false));
        this._shadowRect.setStyle({
          fillOpacity: 0,
          opacity: 0
        });
      } else {
        this._mainMapMoving = false;
      }
    } else {
      if (!this._mainMapMoving) {
        this._shadowRect.setStyle({
          fillOpacity: 0,
          opacity: 0
        });
      }
    }
  },
  _onMiniMapMoveStarted: function () {
    var lastAimingRect = this._aimingRect.getBounds();

    this._lastAimingRectPosition = {
      sw: this._miniMap.latLngToContainerPoint(lastAimingRect.getSouthWest()),
      ne: this._miniMap.latLngToContainerPoint(lastAimingRect.getNorthEast())
    };
  },
  _onMiniMapMoving: function () {
    if (!this._mainMapMoving && this._lastAimingRectPosition) {
      this._shadowRect.setBounds(new L.LatLngBounds(this._miniMap.containerPointToLatLng(this._lastAimingRectPosition.sw), this._miniMap.containerPointToLatLng(this._lastAimingRectPosition.ne)));
      this._shadowRect.setStyle({
        fillOpacity: 0.3,
        opacity: 1
      });
    }
  },
  _restore: function () {
    var me = this;

    me._transitioning = true;
    me._toggleDisplayButton.style.display = 'none';
    me._toggleDisplayButton.style.height = '20px';
    me._toggleDisplayButton.style.bottom = '0';
    me._toggleDisplayButton.style.left = 'auto';
    me._toggleDisplayButton.style.position = 'absolute';
    me._toggleDisplayButton.style.right = '0';
    me._toggleDisplayButton.style.top = 'auto';
    me._toggleDisplayButton.style.width = '20px';
    me._toggleDisplayButtonImage.className = me._toggleDisplayButtonImage.className.replace(/(?:^|\s)minimized(?!\S)/g, '');
    me._toggleDisplayButtonImage.style.bottom = '10px';
    me._toggleDisplayButtonImage.style.left = 'auto';
    me._toggleDisplayButtonImage.style.right = '10px';
    me._toggleDisplayButtonImage.style.top = 'auto';
    me._container.style.width = me.options.width + 'px';
    me._container.style.height = me.options.height + 'px';
    me._attributionContainer.style.marginRight = (me.options.width + 3) + 'px';
    me._minimized = false;
    setTimeout(function () {
      me._toggleDisplayButton.style.display = 'block';
      me._toggleDisplayButton.focus();
      me._aimingRect.setStyle({
        fillOpacity: 0.2,
        opacity: 0.5
      });
      me._miniMap.invalidateSize();
      me._transitioning = false;
    }, 200);
  },
  _setDisplay: function (minimize) {
    if (minimize !== this._minimized) {
      if (!this._minimized) {
        this._minimize();
      } else {
        this._restore();
      }
    }
  },
  _toggleDisplayButtonClicked: function (e) {
    this._userToggledDisplay = true;

    L.DomEvent.preventDefault(e);

    if (!this._minimized) {
      this._minimize();
      this._toggleDisplayButton.setAttribute('alt', 'Show Overview');
    } else {
      this._restore();
      this._toggleDisplayButton.setAttribute('alt', 'Hide Overview');
    }
  }
});

L.Map.mergeOptions({
  overviewControl: false
});
L.Map.addInitHook(function () {
  if (this.options.overviewControl) {
    var options = {};

    if (typeof this.options.overviewControl === 'object') {
      options = this.options.overviewControl;
    }

    this.overviewControl = L.npmap.control.overview(options).addTo(this);
  }
});

module.exports = function (options) {
  return new OverviewControl(options);
};

},{"../preset/baselayers.json":103,"../util/util":113}],74:[function(require,module,exports){
/* global L */

'use strict';

var util = require('../util/util');
var PrintControl = L.Control.extend({
  options: {
    ui: true,
    url: 'https://www.nps.gov/maps/print/'
  },
  initialize: function (options) {
    L.Util.setOptions(this, options);

    if (this.options.ui === true) {
      this._li = L.DomUtil.create('li', '');
      this._button = L.DomUtil.create('button', 'print', this._li);
      this._button.setAttribute('alt', 'Print the map');
      L.DomEvent.addListener(this._button, 'click', this.print, this);
    }

    return this;
  },
  addTo: function (map) {
    if (this.options.ui === true) {
      var toolbar = util.getChildElementsByClassName(map.getContainer().parentNode.parentNode, 'npmap-toolbar')[0];
      toolbar.childNodes[1].appendChild(this._li);
      toolbar.style.display = 'block';
      this._container = toolbar.parentNode.parentNode;
      util.getChildElementsByClassName(this._container.parentNode, 'npmap-map-wrapper')[0].style.top = '28px';
    }

    this._map = map;
    return this;
  },
  _clean: function (layer) {
    delete layer.L;

    // TODO: Move layer type-specific code.
    switch (layer.type) {
      case 'arcgisserver':
        delete layer.service;
        break;
    }

    if (layer.popup) {
      delete layer.popup.actions;

      if (typeof layer.popup.description === 'string') {
        layer.popup.description = util.escapeHtml(layer.popup.description);
      }

      if (typeof layer.popup.title === 'string') {
        layer.popup.title = util.escapeHtml(layer.popup.title);
      }
    }

    if (layer.tooltip) {
      layer.tooltip = util.escapeHtml(layer.tooltip);
    }
  },
  _guid: (function () {
    function s4 () {
      return Math.floor((1 + Math.random()) * 0x10000)
       .toString(16)
       .substring(1);
    }

    return function () {
      return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    };
  })(),
  print: function (e) {
    var map = this._map;
    var me = this;
    var center = map.getCenter();
    var url = me.options.url + (me.options.url.indexOf('?') === -1 ? '?' : '&') + 'lat=' + center.lat.toFixed(4) + '&lng=' + center.lng.toFixed(4) + '&zoom=' + map.getZoom();
    var win;

    L.DomEvent.preventDefault(e);

    if (map.options.mapId) {
      url += '&mapId=' + map.options.mapId;
    } else {
      var options = map.options;
      var config = {
        baseLayers: [],
        center: options.center,
        overlays: [],
        zoom: options.zoom
      };
      var params = {
        action: 'save',
        key: this._guid()
      };
      var supportsCors = (window.location.protocol.indexOf('https:') === 0 ? true : (util.supportsCors() === 'yes'));
      var active;
      var i;
      var layer;

      for (i = 0; i < options.baseLayers.length; i++) {
        layer = options.baseLayers[i];

        if (typeof layer.L === 'object') {
          active = L.extend({}, layer);
          me._clean(active);
          config.baseLayers.push(active);
          break;
        }
      }

      for (i = 0; i < options.overlays.length; i++) {
        layer = options.overlays[i];

        if (typeof layer.L === 'object') {
          active = L.extend({}, layer);
          me._clean(active);
          config.overlays.push(active);
        }
      }

      params.value = window.btoa(JSON.stringify(config));
      url += '&printId=' + params.key;
      L.npmap.util._.reqwest({
        crossOrigin: supportsCors,
        type: 'json' + (supportsCors ? '' : 'p'),
        url: 'https://server-utils.herokuapp.com/session/' + L.Util.getParamString(params)
      });
    }

    win = window.open(url, '_blank');

    // Needed because this throws an error in Internet Explorer 8.
    try {
      win.focus();
    } catch (e) {}
  }
});

L.Map.addInitHook(function () {
  if (this.options.printControl) {
    var options = {};

    if (typeof this.options.printControl === 'object') {
      options = this.options.printControl;
    }

    this.printControl = L.npmap.control.print(options).addTo(this);
  }
});

module.exports = function (options) {
  return new PrintControl(options);
};

},{"../util/util":113}],75:[function(require,module,exports){
/* global L */

'use strict';

var ScaleControl = L.Control.Scale.extend({
  options: {
    metric: false
  }
});

L.Map.mergeOptions({
  scaleControl: false
});
L.Map.addInitHook(function () {
  if (this.options.scaleControl) {
    var options = {};

    if (typeof this.options.scaleControl === 'object') {
      options = this.options.scaleControl;
    }

    this.scaleControl = L.npmap.control.scale(options).addTo(this);
  }
});

module.exports = function (options) {
  return new ScaleControl(options);
};

},{}],76:[function(require,module,exports){
/* global L */

'use strict';

var util = require('../util/util');
var ShareControl = L.Control.extend({
  initialize: function () {
    this._li = L.DomUtil.create('li', '');
    this._button = L.DomUtil.create('button', 'share', this._li);
    this._button.setAttribute('alt', 'Share the map');
    L.DomEvent.addListener(this._button, 'click', this.share, this);
    return this;
  },
  addTo: function (map) {
    var toolbar = util.getChildElementsByClassName(map.getContainer().parentNode.parentNode, 'npmap-toolbar')[0];
    toolbar.childNodes[1].appendChild(this._li);
    toolbar.style.display = 'block';
    this._container = toolbar.parentNode.parentNode;
    this._map = map;
    util.getChildElementsByClassName(this._container.parentNode, 'npmap-map-wrapper')[0].style.top = '28px';
    return this;
  },
  share: function (e) {
    L.DomEvent.preventDefault(e);
    window.alert('The share tool has not yet been implemented.');
  }
});

L.Map.mergeOptions({
  shareControl: false
});
L.Map.addInitHook(function () {
  if (this.options.shareControl) {
    var options = {};

    if (typeof this.options.shareControl === 'object') {
      options = this.options.shareControl;
    }

    this.shareControl = L.npmap.control.share(options).addTo(this);
  }
});

module.exports = function (options) {
  return new ShareControl(options);
};

},{"../util/util":113}],77:[function(require,module,exports){
/* global L */

'use strict';

var SmallZoomControl = L.Control.extend({
  options: {
    position: 'topleft'
  },
  initialize: function (options) {
    L.Util.extend(this.options, options);
    return this;
  },
  onAdd: function (map) {
    this._container = L.DomUtil.create('div', 'leaflet-control-zoom leaflet-bar');
    this._zoomInButton = this._createButton('Zoom in', 'in', this._container, this._zoomIn, this);
    this._zoomOutButton = this._createButton('Zoom out', 'out', this._container, this._zoomOut, this);
    map.on('zoomend zoomlevelschange', this._updateDisabled, this);
    this._updateDisabled();
    return this._container;
  },
  onRemove: function (map) {
    map.off('zoomend zoomlevelschange', this._updateDisabled, this);
  },
  _createButton: function (title, clsName, container, handler, context) {
    var button = L.DomUtil.create('button', clsName, container);
    button.setAttribute('alt', title);
    L.DomEvent.disableClickPropagation(button);
    L.DomEvent
      .on(button, 'click', L.DomEvent.preventDefault)
      .on(button, 'click', handler, context);
    return button;
  },
  _updateDisabled: function () {
    var clsName = 'leaflet-disabled';
    var map = this._map;

    L.DomUtil.removeClass(this._zoomInButton, clsName);
    L.DomUtil.removeClass(this._zoomOutButton, clsName);

    if (map._zoom === map.getMinZoom()) {
      L.DomUtil.addClass(this._zoomOutButton, clsName);
    }
    if (map._zoom === map.getMaxZoom()) {
      L.DomUtil.addClass(this._zoomInButton, clsName);
    }
  },
  _zoomIn: function (e) {
    this._map.zoomIn(e.shiftKey ? 3 : 1);
  },
  _zoomOut: function (e) {
    this._map.zoomOut(e.shiftKey ? 3 : 1);
  }
});

L.Map.mergeOptions({
  smallzoomControl: true
});
L.Map.addInitHook(function () {
  if (this.options.smallzoomControl) {
    var options = {};

    if (typeof this.options.smallzoomControl === 'object') {
      options = this.options.smallzoomControl;
    }

    this.smallzoomControl = L.npmap.control.smallzoom(options).addTo(this);
  }
});

module.exports = function (options) {
  return new SmallZoomControl(options);
};

},{}],78:[function(require,module,exports){
/* global L */
/* jshint camelcase: false */

'use strict';

var util = require('../util/util');
var SwitcherControl = L.Control.extend({
  options: {
    position: 'topright'
  },
  statics: {
    SELECTED_ID: 'basemap_listbox_selected'
  },
  initialize: function (baseLayers) {
    this._baseLayers = baseLayers;
  },
  _addLi: function (baseLayer) {
    var li = L.DomUtil.create('li', (baseLayer.visible ? 'selected' : null));

    if (baseLayer.visible) {
      li.setAttribute('id', SwitcherControl.SELECTED_ID);
      this._active.setAttribute('aria-activedescendant', SwitcherControl.SELECTED_ID);
    }

    li.innerHTML = baseLayer.name;
    li.layerId = L.stamp(baseLayer);
    this._list.appendChild(li);
  },
  _initLayout: function () {
    var container = this._container = L.DomUtil.create('div', 'npmap-control-switcher');

    if (!L.Browser.touch) {
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(container, 'mousewheel', L.DomEvent.stopPropagation);
    } else {
      L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
    }

    this._active = L.DomUtil.create('div', null, container);
    this._active.setAttribute('aria-expanded', false);
    this._active.setAttribute('aria-haspopup', true);
    this._active.setAttribute('aria-label', 'Switch base maps');
    this._active.setAttribute('aria-owns', 'basemap_listbox');
    this._active.setAttribute('role', 'combobox');
    this._list = L.DomUtil.create('ul', null, container);
    this._list.setAttribute('id', 'basemap_listbox');
    this._list.setAttribute('role', 'listbox');
    this._list.style.display = 'none';
    this._activeIcon = L.DomUtil.create('span', null, this._active);
    L.DomUtil.create('ico', null, this._activeIcon);
    this._activeText = L.DomUtil.create('div', null, this._active);
    this._activeDropdown = L.DomUtil.create('span', null, this._active);
    L.DomEvent.addListener(this._active, 'click', this._toggleList, this);
  },
  _onClick: function (e) {
    var target = util.getEventObjectTarget(e);

    if (!L.DomUtil.hasClass(target, 'selected')) {
      var added = false;
      var children = util.getChildElementsByNodeName(this._list, 'li');
      var removed = false;
      var selectedId = SwitcherControl.SELECTED_ID;
      var i;

      for (i = 0; i < children.length; i++) {
        var li = children[i];

        if (L.DomUtil.hasClass(li, 'selected')) {
          li.removeAttribute('id');
          L.DomUtil.removeClass(li, 'selected');
          break;
        }
      }

      target.setAttribute('id', selectedId);
      this._active.setAttribute('aria-activedescendant', selectedId);

      for (i = 0; i < this._baseLayers.length; i++) {
        var baseLayer = this._baseLayers[i];

        if (baseLayer.L) {
          this._map.removeLayer(baseLayer.L);
          baseLayer.visible = false;
          removed = true;
          delete baseLayer.L;
        } else if (target.layerId === baseLayer._leaflet_id) {
          baseLayer.visible = true;

          if (baseLayer.type === 'arcgisserver') {
            baseLayer.L = L.npmap.layer[baseLayer.type][baseLayer.tiled === true ? 'tiled' : 'dynamic'](baseLayer);
          } else {
            baseLayer.L = L.npmap.layer[baseLayer.type](baseLayer);
          }

          if (this._map.getZoom() < baseLayer.minZoom) {
            this._map.setView(this._map.getCenter(), baseLayer.minZoom);
          } else if (this._map.getZoom() > baseLayer.maxZoom) {
            this._map.setView(this._map.getCenter(), baseLayer.maxZoom);
          }

          if (baseLayer.maxZoom) {
            this._map.options.maxZoom = baseLayer.maxZoom;
          } else {
            this._map.options.maxZoom = 19;
          }

          this._map.addLayer(baseLayer.L);
          L.DomUtil.addClass(target, 'selected');
          this._setActive(baseLayer);
          added = baseLayer.L;
        }

        if (added && removed) {
          this._map.fire('baselayerchange', {
            layer: added
          });
          break;
        }
      }
    }

    this._toggleList();
  },
  _setActive: function (baseLayer) {
    var active = this._activeIcon.childNodes[0];
    var icon = baseLayer.icon;

    if (!icon) {
      icon = 'generic';
    }

    active.className = '';
    L.DomUtil.addClass(active, icon + '-small');
    this._activeText.innerHTML = baseLayer.name;
  },
  _toggleList: function () {
    if (this._list.style.display && this._list.style.display === 'none') {
      this._list.style.display = 'block';
      L.DomUtil.addClass(this._activeDropdown, 'open');
      this._active.setAttribute('aria-expanded', true);
    } else {
      this._list.style.display = 'none';
      L.DomUtil.removeClass(this._activeDropdown, 'open');
      this._active.setAttribute('aria-expanded', false);
    }
  },
  _update: function () {
    var children;
    var i;

    this._activeIcon.childNodes[0].innerHTML = '';
    this._activeText.innerHTML = '';
    this._list.innerHTML = '';

    for (i = 0; i < this._baseLayers.length; i++) {
      var baseLayer = this._baseLayers[i];

      this._addLi(baseLayer);

      if (baseLayer.visible) {
        this._setActive(baseLayer);
      }
    }

    children = util.getChildElementsByNodeName(this._list, 'li');

    for (i = 0; i < children.length; i++) {
      L.DomEvent.addListener(children[i], 'click', this._onClick, this);
    }
  },
  onAdd: function (map) {
    this._initLayout();
    this._update();

    return this._container;
  }
});

L.Map.addInitHook(function () {
  if (this.options.baseLayers && this.options.baseLayers.length > 1) {
    this.switcherControl = L.npmap.control.switcher(this.options.baseLayers).addTo(this);
  }
});

module.exports = function (baseLayers) {
  return new SwitcherControl(baseLayers);
};

},{"../util/util":113}],79:[function(require,module,exports){
/* global L */

'use strict';

var ZoomDisplayControl = L.Control.extend({
  options: {
    position: 'topleft'
  },
  onAdd: function (map) {
    this._map = map;
    this._container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-zoomdisplay');
    this._control = L.DomUtil.create('div', 'leaflet-bar-single', this._container);
    this._control.setAttribute('alt', 'Current zoom level');
    this.updateZoom(map.getZoom());
    map.on('zoomend', this.onMapZoomEnd, this);
    return this._container;
  },
  onRemove: function (map) {
    map.off('zoomend', this.onMapZoomEnd, this);
  },
  onMapZoomEnd: function () {
    this.updateZoom(this._map.getZoom());
  },
  updateZoom: function (zoom) {
    if (typeof zoom === 'undefined') {
      zoom = '';
    }

    this._control.innerHTML = Math.floor(zoom);
  }
});

L.Map.addInitHook(function () {
  if (this.options.zoomdisplayControl) {
    var options = {};

    if (typeof this.options.zoomdisplayControl === 'object') {
      options = this.options.zoomdisplayControl;
    }

    this.zoomdisplayControl = L.npmap.control.zoomdisplay(options).addTo(this);
  }
});

module.exports = function (options) {
  return new ZoomDisplayControl(options);
};

},{}],80:[function(require,module,exports){
/* global L */

'use strict';

var keys = require('../../keys.json');
var util = require('../util/util');
var MakiIcon = L.Icon.extend({
  options: {
    accessToken: (function () {
      if (keys && keys.mapbox && keys.mapbox.access_token) {
        return keys.mapbox.access_token;
      } else {
        return null;
      }
    })(),
    'marker-color': '#000000',
    'marker-size': 'medium'
  },
  statics: {
    CSS_TEMPLATE: 'url(https://api.mapbox.com/v4/marker/pin-{{size}}{{symbol}}+{{color}}{{retina}}.png?access_token={{accessToken}})'
  },
  initialize: function (options) {
    options = options || {};

    var size = options['marker-size'] || 'medium';
    var sizes = {
      large: {
        iconAnchor: [17.5, 49],
        iconSize: [35, 55],
        popupAnchor: [2, -45]
      },
      medium: {
        iconAnchor: [14, 36],
        iconSize: [28, 41],
        popupAnchor: [2, -34]
      },
      small: {
        iconAnchor: [10, 24],
        iconSize: [20, 30],
        popupAnchor: [2, -24]
      }
    };

    L.Util.extend(options, sizes[size]);
    L.setOptions(this, options);
  },
  createIcon: function (oldIcon) {
    var div = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div');
    var options = this.options;

    this._setIconStyles(div, 'icon');
    div.style.backgroundImage = util.handlebars(MakiIcon.CSS_TEMPLATE, {
      accessToken: options.accessToken,
      color: options['marker-color'].replace('#', ''),
      retina: L.Browser.retina ? '@2x' : '',
      size: options['marker-size'].slice(0, 1),
      symbol: options['marker-symbol'] ? '-' + options['marker-symbol'] : ''
    });
    return div;
  },
  createShadow: function () {
    return null;
  }
});

L.Marker.mergeOptions({
  icon: new MakiIcon()
});
module.exports = function (options) {
  return new MakiIcon(options);
};

},{"../../keys.json":1,"../util/util":113}],81:[function(require,module,exports){
/* global L */

'use strict';

var keys = require('../../keys.json');
var util = require('../util/util');
var NpmapIcon = L.Icon.extend({
  options: {
    accessToken: (function () {
      if (keys && keys.mapbox && keys.mapbox.access_token) {
        return keys.mapbox.access_token;
      } else {
        return null;
      }
    })(),
    'marker-color': '#000000',
    'marker-size': 'medium'
  },
  statics: {
    MAKI_TEMPLATE: 'url(https://api.mapbox.com/v4/marker/pin-{{size}}+{{color}}{{retina}}.png?access_token={{accessToken}})'
  },
  initialize: function (options) {
    options = options || {};

    var size = options['marker-size'] || 'medium';
    var sizes = {
      large: {
        iconAnchor: [17.5, 49],
        iconSize: [35, 55],
        popupAnchor: [2, -45]
      },
      medium: {
        iconAnchor: [14, 36],
        iconSize: [28, 41],
        popupAnchor: [2, -34]
      },
      small: {
        iconAnchor: [10, 24],
        iconSize: [20, 30],
        popupAnchor: [2, -24]
      }
    };

    L.Util.extend(options, sizes[size]);
    L.Util.setOptions(this, options);
  },
  createIcon: function (oldIcon) {
    var options = this.options;
    var divIcon = L.DomUtil.create('div', 'npmapsymbollibrary-icon ' + options['marker-size'] + ' ' + options['marker-symbol'] + '-' + options['marker-size'] + (L.Browser.retina ? '-2x' : ''));
    var divMarker = (oldIcon && oldIcon.tagName === 'DIV') ? oldIcon : document.createElement('div');

    this._setIconStyles(divMarker, 'icon');
    divMarker.style.backgroundImage = util.handlebars(NpmapIcon.MAKI_TEMPLATE, {
      accessToken: options.accessToken,
      color: options['marker-color'].replace('#', ''),
      retina: L.Browser.retina ? '@2x' : '',
      size: options['marker-size'].slice(0, 1)
    });
    divMarker.appendChild(divIcon);
    return divMarker;
  },
  createShadow: function () {
    return null;
  }
});

module.exports = function (options) {
  return new NpmapIcon(options);
};

},{"../../keys.json":1,"../util/util":113}],82:[function(require,module,exports){
/* globals L */

var util = require('../../util/util');

var ArcGisServerDynamicLayer = L.Layer.extend({
  includes: [
    L.Mixin.Events,
    require('../../mixin/esri')
  ],
  options: {
    opacity: 1,
    position: 'front'
  },
  _defaultLayerParams: {
    bboxSR: 3857,
    f: 'image',
    format: 'png24',
    imageSR: 3857,
    layers: '',
    transparent: true
  },
  initialize: function (options) {
    util.strict(options.url, 'string');

    this._layerParams = L.Util.extend({}, this._defaultLayerParams);
    this._serviceUrl = this._cleanUrl(options.url);

    for (var option in options) {
      if (this._defaultLayerParams.hasOwnProperty(option)) {
        this._layerParams[option] = options[option];
      }
    }

    this._parseLayers();
    L.Util.setOptions(this, options);

    if (!this._layerParams.transparent) {
      this.options.opacity = 1;
    }

    if (options.clickable === false) {
      this._hasInteractivity = false;
    }

    this._getMetadata();
  },
  onAdd: function (map) {
    this._map = map;
    this._moveHandler = this._debounce(this._update, 150, this);

    if (map.options.crs && map.options.crs.code) {
      var sr = map.options.crs.code.split(':')[1];

      this._layerParams.bboxSR = sr;
      this._layerParams.imageSR = sr;
    }

    map.on('moveend', this._moveHandler, this);
    this._update();
  },
  onRemove: function (map) {
    if (this._currentImage) {
      this._map.removeLayer(this._currentImage);
    }

    map.off('moveend', this._moveHandler, this);
  },
  _debounce: function (fn, delay) {
    var timer = null;

    return function () {
      var args = arguments;
      var context = this || context;

      clearTimeout(timer);

      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  },
  _getImageUrl: function () {
    var map = this._map;
    var bounds = map.getBounds();
    var crs = map.options.crs;
    var layerParams = this._layerParams;
    var size = map.getSize();
    var ne = crs.project(bounds._northEast);
    var options = this.options;
    var sw = crs.project(bounds._southWest);

    layerParams.bbox = [sw.x, sw.y, ne.x, ne.y].join(',');
    layerParams.size = size.x + ',' + size.y;

    if (options.edit) {
      layerParams.nocache = new Date().getTime();
    }

    if (options.token) {
      layerParams.token = options.token;
    }

    return this._serviceUrl + 'export' + L.Util.getParamString(layerParams);
  },
  _parseLayers: function () {
    if (typeof this._layerParams.layers === 'undefined') {
      delete this._layerParams.layerOption;
      return;
    }

    var action = this._layerParams.layerOption || null;
    var layers = this._layerParams.layers || null;
    var verb = 'show';
    var verbs = ['exclude', 'hide', 'include', 'show'];

    delete this._layerParams.layerOption;

    if (!action) {
      if (L.Util.isArray(layers)) {
        this._layerParams.layers = verb + ':' + layers.join(',');
      } else if (typeof layers === 'string') {
        var match = layers.match(':');

        if (match) {
          layers = layers.split(match[0]);

          if (Number(layers[1].split(',')[0])) {
            if (verbs.indexOf(layers[0]) !== -1) {
              verb = layers[0];
            }

            layers = layers[1];
          }
        }

        this._layerParams.layers = verb + ':' + layers;
      }
    } else {
      if (verbs.indexOf(action) !== -1) {
        verb = action;
      }

      this._layerParams.layers = verb + ':' + layers;
    }
  },
  _update: function () {
    var bounds;
    var image;
    var zoom;

    if (this._animatingZoom || (this._map._panTransition && this._map._panTransition._inProgress)) {
      return;
    }

    zoom = this._map.getZoom();

    if (zoom > this.options.maxZoom || zoom < this.options.minZoom) {
      return;
    }

    bounds = this._map.getBounds();
    bounds._southWest.wrap();
    bounds._northEast.wrap();
    image = new L.ImageOverlay(this._getImageUrl(), bounds, {
      opacity: 0
    }).addTo(this._map);
    image.on('load', function (e) {
      var newImage = e.target;
      var oldImage = this._currentImage;

      if (newImage._bounds.equals(bounds)) {
        this._currentImage = newImage;

        if (this.options.position === 'front') {
          this._currentImage.bringToFront();
        } else {
          this._currentImage.bringToBack();
        }

        this._currentImage.setOpacity(this.options.opacity);

        if (oldImage) {
          this._map.removeLayer(oldImage);
        }
      } else {
        this._map.removeLayer(newImage);
      }
    }, this);
    this.fire('loading', {
      bounds: bounds
    });
  },
  bringToBack: function () {
    this.options.position = 'back';
    this._currentImage.bringToBack();
    return this;
  },
  bringToFront: function () {
    this.options.position = 'front';
    this._currentImage.bringToFront();
    return this;
  },
  redraw: function () {
    this._update();
  },
  setLayers: function (layers) {
    if (typeof layers === 'number') {
      layers = layers.toString();
    }

    this._layerParams.layers = layers;
    this._parseLayers();
    this._map.removeLayer(this._currentImage);
    this._update();
  },
  setOpacity: function (opacity) {
    this.options.opacity = opacity;
    this._currentImage.setOpacity(opacity);
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'arcgisserver';
  }

  return new ArcGisServerDynamicLayer(options);
};

},{"../../mixin/esri":97,"../../util/util":113}],83:[function(require,module,exports){
/* global L */

'use strict';

var util = require('../../util/util');

var ArcGisServerTiledLayer = L.TileLayer.extend({
  includes: [
    require('../../mixin/esri')
  ],
  options: {
    errorTileUrl: L.Util.emptyImageUrl
  },
  initialize: function (options) {
    L.Util.setOptions(this, options);
    util.strict(options.url, 'string');
    this._serviceUrl = this._cleanUrl(options.url);
    this.tileUrl = this._cleanUrl(options.url) + 'tile/{z}/{y}/{x}';

    if (options.clickable === false) {
      this._hasInteractivity = false;
    }

    L.TileLayer.prototype.initialize.call(this, this.tileUrl, options);
    this._getMetadata();
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'arcgisserver';
  }

  return new ArcGisServerTiledLayer(options);
};

},{"../../mixin/esri":97,"../../util/util":113}],84:[function(require,module,exports){
/* globals console, document, L, module, window */

'use strict';

var keys = require('../../keys.json');
var BingLayer = L.TileLayer.extend({
  options: {
    attribution: 'Bing',
    culture: 'en-US',
    layer: 'aerial',
    subdomains: [
      0,
      1,
      2,
      3
    ]
  },
  getTileUrl: function (p) {
    var subdomains = this.options.subdomains;
    var s = this.options.subdomains[Math.abs((p.x + p.y) % subdomains.length)];
    var z = this._getZoomForUrl();

    return this._url
      .replace('http:', 'https:')
      .replace('{subdomain}', s)
      .replace('{quadkey}', this.tile2quad(p.x, p.y, z))
      .replace('http:', document.location.protocol)
      .replace('{culture}', this.options.culture);
  },
  initialize: function (options) {
    L.Util.setOptions(this, options);

    this._key = keys.bing.key;
    this._url = null;
    this.meta = {};
    this._loadMetadata();
  },
  onRemove: function (map) {
    for (var i = 0; i < this._providers.length; i++) {
      var p = this._providers[i];

      if (p.active && this._map.attributionControl) {
        this._map.attributionControl.removeAttribution(p.attrib);
        p.active = false;
      }
    }

    L.TileLayer.prototype.onRemove.apply(this, [map]);
  },
  _initMetadata: function () {
    var r = this.meta.resourceSets[0].resources[0];

    this.options.subdomains = r.imageUrlSubdomains;
    this._url = r.imageUrl;
    this._providers = [];

    if (r.imageryProviders) {
      for (var i = 0; i < r.imageryProviders.length; i++) {
        var p = r.imageryProviders[i];

        for (var j = 0; j < p.coverageAreas.length; j++) {
          var c = p.coverageAreas[j];
          var coverage = {zoomMin: c.zoomMin, zoomMax: c.zoomMax, active: false};
          var bounds = new L.LatLngBounds(
            new L.LatLng(c.bbox[0] + 0.01, c.bbox[1] + 0.01),
            new L.LatLng(c.bbox[2] - 0.01, c.bbox[3] - 0.01)
          );

          coverage.bounds = bounds;
          coverage.attrib = p.attribution;
          this._providers.push(coverage);
        }
      }
    }

    this.fire('ready');
    this.readyFired = true;
    this._update();
  },
  _loadMetadata: function () {
    var cbid = '_bing_metadata_' + L.stamp(this);
    var me = this;
    var script;

    window[cbid] = function (meta) {
      var el = document.getElementById(cbid);

      me.meta = meta;
      // Cannot use delete window[cbid] because it throws an error in Internet Explorer 8.
      window[cbid] = null;
      el.parentNode.removeChild(el);

      if (meta.errorDetails) {
        if (window.console) {
          var error = {
            message: meta.errorDetails
          };

          me.fire('error', error);
          me.errorFired = error;
        }

        return;
      }

      me._initMetadata();
    };

    script = document.createElement('script');
    script.src = 'https://dev.virtualearth.net/REST/v1/Imagery/Metadata/' + this.options.layer + '?include=ImageryProviders&jsonp=' + cbid + '&key=' + this._key;
    script.id = cbid;
    document.getElementsByTagName('head')[0].appendChild(script);
  },
  _update: function () {
    if (this._url === null || !this._map) {
      return;
    }

    this._updateAttribution();
    L.TileLayer.prototype._update.apply(this, []);
  },
  _updateAttribution: function () {
    var bounds = this._map.getBounds();
    var zoom = this._map.getZoom();

    for (var i = 0; i < this._providers.length; i++) {
      var p = this._providers[i];

      if ((zoom <= p.zoomMax && zoom >= p.zoomMin) && bounds.intersects(p.bounds)) {
        if (!p.active && this._map.attributionControl) {
          this._map.attributionControl.addAttribution(p.attrib);
        }

        p.active = true;
      } else {
        if (p.active && this._map.attributionControl) {
          this._map.attributionControl.removeAttribution(p.attrib);
        }

        p.active = false;
      }
    }
  },
  tile2quad: function (x, y, z) {
    var quad = '';

    for (var i = z; i > 0; i--) {
      var digit = 0;
      var mask = 1 << (i - 1);

      if ((x & mask) !== 0) {
        digit += 1;
      }

      if ((y & mask) !== 0) {
        digit += 2;
      }

      quad = quad + digit;
    }

    return quad;
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'bing';
  }

  return new BingLayer(options);
};

},{"../../keys.json":1}],85:[function(require,module,exports){
/* global L */
/* jshint camelcase: false */

'use strict';

var reqwest = require('reqwest');
var util = require('../util/util');

var CartoDbLayer = L.TileLayer.extend({
  includes: [
    require('../mixin/grid')
  ],
  options: {
    errorTileUrl: L.Util.emptyImageUrl,
    format: 'png',
    subdomains: [
      0,
      1,
      2,
      3
    ]
  },
  statics: {
    GEOMETRY_TYPES: {
      'st_linestring': 'line',
      'st_multilinestring': 'line',
      'st_multipoint': 'point',
      'st_multipolygon': 'polygon',
      'st_point': 'point',
      'st_polygon': 'polygon'
    }
  },
  _update: function () {
    if (this._urlTile) {
      L.TileLayer.prototype._update.call(this);
    }
  },
  initialize: function (options) {
    var me = this;

    if (!L.Browser.retina || !options.detectRetina) {
      options.detectRetina = false;
    }

    L.Util.setOptions(this, options);
    util.strict(this.options.table, 'string');
    util.strict(this.options.user, 'string');
    L.TileLayer.prototype.initialize.call(this, undefined, this.options);
    this._urlApi = 'https://' + this.options.user + '.cartodb.com/api/v2/sql';
    reqwest({
      crossOrigin: true,
      error: function (error) {
        error.message = JSON.parse(error.response).error[0];
        me.fire('error', error);
        me.errorFired = error;
      },
      success: function (response) {
        if (response) {
          var layer = {
            options: {},
            type: 'cartodb'
          };
          var queryFields = [];
          var i;

          if (me.options.cartocss) {
            me._cartocss = me.options.cartocss;
          } else if (me.options.styles) {
            me._cartocss = me._stylesToCartoCss(me.options.styles);
          }

          me._hasInteractivity = false;
          me._interactivity = null;

          if (me.options.interactivity) {
            me._interactivity = me.options.interactivity.split(',');
          } else if (me.options.clickable !== false && response.rows) {
            me._interactivity = [];

            for (i = 0; i < response.rows.length; i++) {
              if (response.rows[i].cdb_columnnames !== 'the_geom' && response.rows[i].cdb_columnnames !== 'the_geom_webmercator') {
                me._interactivity.push(response.rows[i].cdb_columnnames);
              }
            }
          }

          if (L.Util.isArray(me._interactivity) && me._interactivity.length) {
            me._hasInteractivity = true;
          }

          for (i = 0; i < response.rows.length; i++) {
            var columnNames = response.rows[i].cdb_columnnames;

            if (response.rows[i].cdb_columntype === 'timestamp without time zone') {
              queryFields.push('to_char(' + columnNames + ', \'YYYY-MM-DD-THH24:MI:SS\') AS ' + columnNames);
            } else if (response.rows[i].cdb_columntype === 'timestamp with time zone') {
              queryFields.push('to_char(' + columnNames + ', \'YYYY-MM-DD-THH24:MI:SS TZ\') AS ' + columnNames);
            } else {
              queryFields.push(columnNames);
            }
          }

          layer.options.sql = me._sql = (me.options.sql || ('SELECT ' + queryFields.toString() + ' FROM ' + me.options.table + ';'));

          if (me._cartocss) {
            layer.options.cartocss = me._cartocss;
            layer.options.cartocss_version = '2.1.1';
          }

          if (me._interactivity) {
            layer.options.interactivity = me._interactivity;
          }

          reqwest({
            crossOrigin: true,
            error: function (response) {
              var obj = {};

              if (response && response.responseText) {
                response = JSON.parse(response.responseText);

                if (response.errors && response.errors.length) {
                  obj.message = response.errors[0];
                } else {
                  obj.message = 'An unspecified error occured.';
                }
              } else {
                obj.message = 'An unspecified error occured.';
              }

              me.fire('error', obj);
            },
            success: function (response) {
              if (response) {
                // This is the only layer handler that we don't default everything to https for.
                // This is because CartoDB's SSL endpoint doesn't support subdomains, so there is a performance hit for when using https.
                // If the web page is using https, however, we do want to default to it - even if it means taking a performance hit.
                var root = (window.location.protocol === 'https:' ? 'https://' : 'http://{s}.') + response.cdn_url[window.location.protocol === 'https:' ? 'https' : 'http'] + '/' + me.options.user + '/api/v1/map/' + response.layergroupid;
                var template = '{z}/{x}/{y}';

                if (me._hasInteractivity && me._interactivity.length) {
                  me._urlGrid = root + '/0/' + template + '.grid.json';
                }

                me._urlTile = root + '/' + template + '.png';
                me.setUrl(me._urlTile);
                me.redraw();
                me.fire('ready');
                me.readyFired = true;

                return me;
              } else {
                me.fire('error', {
                  msg: 'No response was received.'
                });
              }
            },
            type: 'json',
            url: util.buildUrl('https://' + me.options.user + '.cartodb.com/api/v1/map', {
              config: JSON.stringify({
                layers: [
                  layer
                ],
                version: '1.0.1'
              })
            })
          });
        }
      },
      type: 'json',
      url: util.buildUrl(this._urlApi, {
        q: 'SELECT DISTINCT CDB_ColumnNames,CDB_ColumnType(\'' + this.options.table + '\',cdb_columnnames) FROM CDB_ColumnNames(\'' + this.options.table + '\');'
      })
    });
    reqwest({
      crossOrigin: true,
      success: function (response) {
        me._geometryTypes = [];

        if (response && response.rows && response.rows.length) {
          var geometryType = response.rows[0].st_geometrytype;

          if (geometryType) {
            me._geometryTypes.push(CartoDbLayer.GEOMETRY_TYPES[geometryType.toLowerCase()]);
          }
        }
      },
      type: 'json',
      url: util.buildUrl(this._urlApi, {
        q: 'select ST_GeometryType(the_geom) from ' + this.options.table + ' where the_geom IS NOT NULL limit 1;'
      })
    });
  },
  _getGridData: function (latLng, callback) {
    var me = this;

    if (this._urlGrid) {
      this._getTileGrid(L.Util.template(this._urlGrid, L.Util.extend({
        s: this.options.subdomains[Math.floor(Math.random() * this.options.subdomains.length)]
      }, this._getTileCoords(latLng))), latLng, function (resultData, gridData) {
        if (resultData === 'loading') {
          callback({
            layer: me,
            results: 'loading'
          });
        } else {
          if (gridData) {
            callback({
              layer: me,
              results: [
                gridData
              ]
            });
          } else {
            callback({
              layer: me,
              results: null
            });
          }
        }
      });
    } else {
      callback({
        layer: me,
        results: null
      });
    }
  },
  _stylesToCartoCss: function (styles) {
    var cartoCss = {};
    var match = {
      'fill': 'polygon-fill',
      'fill-opacity': 'polygon-opacity',
      'marker-color': 'marker-fill',
      'marker-size': function (value) {
        var size = 8;

        if (value === 'large') {
          size = 16;
        } else if (value === 'medium') {
          size = 12;
        }

        cartoCss['marker-height'] = size;
        cartoCss['marker-width'] = size;
      },
      'stroke': 'line-color',
      'stroke-opacity': 'line-opacity',
      'stroke-width': 'line-width'
    };

    for (var property in styles) {
      var value = styles[property];

      if (typeof match[property] === 'function') {
        match[property](value);
      } else if (typeof match[property] === 'string') {
        cartoCss[match[property]] = value;
      }
    }

    return '#layer' + JSON.stringify(cartoCss).replace(/"/g, '').replace(/,/g, ';');
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'cartodb';
  }

  return new CartoDbLayer(options);
};

},{"../mixin/grid":99,"../util/util":113,"reqwest":60}],86:[function(require,module,exports){
/* INFO: In leaflet.markercluster, in src/MarkerCluster.js, add "keyboard: false" to line 4. */
/* global L */

'use strict';

require('leaflet.markercluster');

var ClusterLayer = L.MarkerClusterGroup.extend({
  options: {
    showCoverageOnHover: false
  },
  initialize: function (options) {
    var me = this;
    var interval;

    L.Util.setOptions(this, options);

    if (options.cluster === true) {
      options.cluster = {};
    }

    options.cluster.iconCreateFunction = new me.IconCreateFunction(options.cluster.clusterIcon);
    L.Util.setOptions(this, options.cluster);
    options.clustered = options.cluster.iconCreateFunction('getInfo');
    delete options.cluster;
    this._markercluster = L.MarkerClusterGroup.prototype.initialize.call(this);
    this._currentShownBounds = null;
    this._featureGroup = L.featureGroup();
    this._featureGroup.addEventParent(this);
    this._inZoomAnimation = 0;
    this._needsClustering = [];
    this._needsRemoving = [];
    this._nonPointGroup = L.featureGroup();
    this._nonPointGroup.addEventParent(this);
    this._queue = [];
    this.L = L.npmap.layer[options.type](options);
    interval = setInterval(function () {
      if (me.L._loaded) {
        clearInterval(interval);
        me.addLayer(me.L);
        me.fire('ready');
        me.readyFired = true;
        me._loaded = true;
      }
    }, 0);

    return this;
  },
  onAdd: function (map) {
    this._map = map;
    this._addAttribution();

    if (this.options.zoomToBounds) {
      this.L.on('ready', function () {
        map.fitBounds(this.getBounds());
      });
    }

    L.MarkerClusterGroup.prototype.onAdd.call(this, map);
  },
  onRemove: function (map) {
    this._removeAttribution();
    L.MarkerClusterGroup.prototype.onRemove.call(this, map);
    delete this._map;
  },
  _addAttribution: function () {
    var attribution = this.options.attribution;

    if (attribution && this._map.attributionControl) {
      this._map.attributionControl.addAttribution(attribution);
    }
  },
  _removeAttribution: function () {
    var attribution = this.options.attribution;

    if (attribution && this._map.attributionControl) {
      this._map.attributionControl.removeAttribution(attribution);
    }
  },
  IconCreateFunction: function (settings) {
    var defaultSettings = [{
      color: '#000',
      fontColor: '#fff',
      maxNodes: 9,
      name: 'small',
      outerRing: 22,
      size: 20
    }, {
      color: '#000',
      fontColor: '#fff',
      maxNodes: 99,
      name: 'medium',
      outerRing: 24,
      size: 35
    }, {
      color: '#000',
      fontColor: '#fff',
      maxNodes: Infinity,
      name: 'large',
      outerRing: 24,
      size: 50
    }];

    function addStyles () {
      var head = document.head || document.getElementsByTagName('head')[0];
      var style = document.createElement('style');
      var text = '';

      style.type = 'text/css';
      text += '.leaflet-cluster-anim .leaflet-marker-icon, .leaflet-cluster-anim .leaflet-marker-shadow {';
      text += '-webkit-transition: -webkit-transform 0.2s ease-out, opacity 0.2s ease-in;';
      text += '-moz-transition: -moz-transform 0.2s ease-out, opacity 0.2s ease-in;';
      text += '-o-transition: -o-transform 0.2s ease-out, opacity 0.2s ease-in;';
      text += 'transition: transform 0.2s ease-out, opacity 0.2s ease-in;';
      text += '}';

      for (var i = 0; i < defaultSettings.length; i++) {
        var currStyle = createStyle(defaultSettings[i]);

        for (var styleType in currStyle) {
          text += '.' + 'marker-cluster-custom-' + defaultSettings[i].maxNodes.toString() + ' ' + (styleType === 'main' ? '' : styleType) + ' {' + currStyle[styleType] + '}\n';
        }
      }

      if (style.styleSheet) {
        style.styleSheet.cssText = text;
      } else {
        style.appendChild(document.createTextNode(text));
      }

      head.appendChild(style);
    }
    function autoTextColor (rgb) {
      if (Object.prototype.toString.call(rgb) !== '[object Array]') {
        rgb = hexToArray(rgb);
      }

      if (rgb) {
        var brightness = (((rgb[0] * 299) + (rgb[1] * 587) + (rgb[2] * 144)) / 1000);

        if (brightness > 127) {
          return '#000';
        } else {
          return '#fff';
        }
      } else {
        return false;
      }
    }
    function createStyle (style) {
      var styles = {
        main: {
          'background-clip': 'padding-box',
          background: supportsRgba('rgba(' + hexToArray(style.color)[0] + ', ' + hexToArray(style.color)[1] + ', ' + hexToArray(style.color)[2] + ', 0.4)'),
          'border-radius': ((style.size + style.outerRing) * 0.5) + 'px'
        },
        div: {
          background: supportsRgba('rgba(' + hexToArray(style.color)[0] + ', ' + hexToArray(style.color)[1] + ', ' + hexToArray(style.color)[2] + ', 0.9)'),
          'border-radius': (style.size / 2) + 'px',
          height: style.size + 'px',
          'margin-left': (style.outerRing / 2) + 'px',
          'margin-top': (style.outerRing / 2) + 'px',
          'text-align': 'center',
          width: style.size + 'px'
        },
        span: {
          color: 'rgb(' + hexToArray(style.fontColor)[0] + ', ' + hexToArray(style.fontColor)[1] + ', ' + hexToArray(style.fontColor)[2] + ')',
          display: 'block',
          font: '12px Frutiger, "Frutiger Linotype", Univers, Calibri, "Gill Sans", "Gill Sans MT", "Myriad Pro", Myriad, "DejaVu Sans Condensed", "Liberation Sans", "Nimbus Sans L", Tahoma, Geneva, "Helvetica Neue", Helvetica, Arial, sans-serif',
          'line-height': style.size + 'px'
        }
      };

      function cssStyle (fields) {
        var returnValue = [];

        for (var field in fields) {
          returnValue.push(field + ': ' + fields[field] + '; ');
        }

        return returnValue.join('');
      }
      function styleLoop (fields, process) {
        var returnValue = {};

        for (var field in fields) {
          returnValue[field] = process(fields[field]);
        }

        return returnValue;
      }

      return styleLoop(styles, cssStyle);
    }
    function customIconCreateFunction (cluster) {
      if (cluster === 'getInfo') {
        return defaultSettings;
      }

      var childCount = cluster.getChildCount();
      var className, size;

      for (var i = 0; i < defaultSettings.length; i++) {
        var defaultSetting = defaultSettings[i];

        if (childCount <= defaultSetting.maxNodes) {
          className = 'marker-cluster-custom-' + defaultSetting.maxNodes.toString();
          size = defaultSetting.size + defaultSetting.outerRing;
          break;
        }
      }

      return new L.DivIcon({
        className: className,
        html: '<div><span>' + childCount + '</span></div>',
        iconSize: new L.Point(size, size)
      });
    }
    function hexToArray (hexValue) {
      var returnValue = false;

      if (typeof hexValue === 'string') {
        hexValue = hexValue.replace('#', '');

        if (hexValue.length === 3) {
          hexValue = hexValue.replace(/(.)(.)(.)/g, '$1$1$2$2$3$3');
        }

        if (hexValue.match(/[\da-fA-F]{6}$/)) {
          returnValue = [
            parseInt(hexValue.substr(0, 2), 16),
            parseInt(hexValue.substr(2, 2), 16),
            parseInt(hexValue.substr(4, 2), 16)
          ];
        }
      }

      return returnValue;
    }
    function supportsRgba (color) {
      var returnValue = false;
      var rgbaTestVal = 'rgba(0,0,0,0.1)';
      var testDiv = document.createElement('div');
      var newColor;

      try {
        testDiv.style.color = rgbaTestVal;

        if (testDiv.style.color.substr(0, 4) === 'rgba') {
          returnValue = true;
        }
      } catch (e) {}

      if (color) {
        if (returnValue) {
          return color;
        } else {
          newColor = color.replace(/^rgba\(/g, 'rgb(,').replace(')', '').split(',');
          newColor[1] = Math.floor(parseInt(newColor[1], 10) + (255 * (1 - parseFloat(newColor[4], 10))));
          newColor[2] = Math.floor(parseInt(newColor[2], 10) + (255 * (1 - parseFloat(newColor[4], 10))));
          newColor[3] = Math.floor(parseInt(newColor[3], 10) + (255 * (1 - parseFloat(newColor[4], 10))));
          if (newColor[1] > 255) {
            newColor[1] = 255;
          }

          if (newColor[2] > 255) {
            newColor[2] = 255;
          }

          if (newColor[3] > 255) {
            newColor[3] = 255;
          }

          newColor = newColor.slice(0, 4).join(',').replace('(,', '(') + ')';

          return newColor;
        }
      } else {
        return returnValue;
      }
    }
    function updateDefaults (newSettings) {
      for (var j = 0; j < defaultSettings.length; j++) {
        if (defaultSettings[j].name && newSettings[defaultSettings[j].name]) {
          L.Util.extend(defaultSettings[j], newSettings[defaultSettings[j].name]);

          if (!newSettings[defaultSettings[j].name].fontColor && newSettings[defaultSettings[j].name].color) {
            defaultSettings[j].fontColor = autoTextColor(hexToArray(newSettings[defaultSettings[j].name].color));
          }
        }
      }
    }

    if (settings) {
      if (typeof settings === 'string') {
        updateDefaults({
          small: {
            color: settings
          },
          medium: {
            color: settings
          },
          large: {
            color: settings
          }
        });
      } else if (Object.prototype.toString.call(settings) === '[object Object]') {
        updateDefaults(settings);
      } else if (Object.prototype.toString.call(settings) === '[object Array]') {
        defaultSettings = settings;
      }
    }

    addStyles();

    return customIconCreateFunction;
  }
});

module.exports = function (options) {
  return new ClusterLayer(options);
};

},{"leaflet.markercluster":56}],87:[function(require,module,exports){
/* global L */

'use strict';

var csv2geojson = require('csv2geojson');
var util = require('../util/util');

var CsvLayer = L.GeoJSON.extend({
  includes: [
    require('../mixin/geojson')
  ],
  initialize: function (options) {
    var me = this;

    L.Util.setOptions(this, this._toLeaflet(options));

    if (typeof options.data === 'string') {
      me._create(options, options.data);
      return this;
    } else {
      var url = options.url;

      util.strict(url, 'string');
      util.loadFile(url, 'text', function (response) {
        if (response) {
          me._create(options, response);
        } else {
          me.fire('error', {
            message: 'There was an error loading the CSV file.'
          });
        }
      });
    }
  },
  _create: function (options, csv) {
    var me = this;

    csv2geojson.csv2geojson(csv, {}, function (error, data) {
      if (error) {
        var obj = {
          message: error
        };

        me.fire('error', obj);
        me.errorFired = obj;
      } else {
        L.GeoJSON.prototype.initialize.call(me, data, options);
        me.fire('ready');
        me.readyFired = true;
        me._loaded = true;
      }

      return me;
    });
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'csv';
  }

  if (options.cluster) {
    return L.npmap.layer._cluster(options);
  } else {
    return new CsvLayer(options);
  }
};

},{"../mixin/geojson":98,"../util/util":113,"csv2geojson":7}],88:[function(require,module,exports){
/* global L */

'use strict';

var util = require('../util/util');

var GeoJsonLayer = L.GeoJSON.extend({
  includes: [
    require('../mixin/geojson')
  ],
  initialize: function (options) {
    L.Util.setOptions(this, this._toLeaflet(options));

    if (typeof options.data === 'object') {
      this._create(options, options.data);
    } else if (typeof options.url === 'string') {
      var me = this;
      var url = options.url;

      util.loadFile(url, 'json', function (response) {
        if (response) {
          // TODO: Do a check to make sure the GeoJSON is valid, and fire error event if it isn't.
          me._create(options, response);
        } else {
          var obj = {
            message: 'There was an error loading the GeoJSON file.'
          };

          me.fire('error', obj);
          me.errorFired = obj;
        }
      });
    } else {
      this._create(options);
    }
  },
  _create: function (options, data) {
    var me = this;

    try {
      L.GeoJSON.prototype.initialize.call(me, data, options);
      me.fire('ready');
      me.readyFired = true;
      me._loaded = true;
    } catch (e) {
      var obj = {
        message: 'The response was not a valid GeoJSON object.'
      };

      me.fire('error', obj);
      me.errorFired = obj;
    }

    return me;
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'geojson';
  }

  if (options.cluster) {
    return L.npmap.layer._cluster(options);
  } else {
    return new GeoJsonLayer(options);
  }
};

},{"../mixin/geojson":98,"../util/util":113}],89:[function(require,module,exports){
/* global L */

'use strict';

var reqwest = require('reqwest');
var util = require('../util/util');

var GitHubLayer = L.GeoJSON.extend({
  includes: [
    require('../mixin/geojson')
  ],
  options: {
    branch: 'master'
  },
  initialize: function (options) {
    var me = this;
    var supportsCors = util.supportsCors();

    L.Util.setOptions(this, this._toLeaflet(options));

    // If ID <=8 and protocol is http.
    if (window.location.protocol === 'http:' && (window.attachEvent && !window.addEventListener)) {
      var obj = {
        message: 'The data cannot load from GitHub because you are using an old browser.'
      };

      me.fire('error', obj);
      me.errorFired = obj;
    } else {
      if (typeof options.data === 'object') {
        this._create(options, options.data);
      } else {
        util.strict(options.path, 'string');
        util.strict(options.repo, 'string');
        util.strict(options.user, 'string');
        reqwest({
          crossOrigin: supportsCors === 'yes',
          error: function (error) {
            var obj = L.extend(error, {
              message: 'There was an error loading the data from GitHub.'
            });

            me.fire('error', obj);
            me.errorFired = obj;
          },
          success: function (response) {
            var data = response.content || response.data.content;

            me._create(options, JSON.parse(window.atob(data.replace(/\s/g, ''))));
          },
          type: 'json' + (supportsCors === 'yes' ? '' : 'p'),
          url: 'https://api.github.com/repos/' + options.user + '/' + options.repo + '/contents/' + options.path + '?ref=' + options.branch + (supportsCors === 'yes' ? '' : '?callback=?')
        });
      }
    }
  },
  _create: function (options, data) {
    L.GeoJSON.prototype.initialize.call(this, data, options);
    this.fire('ready');
    this.readyFired = true;
    this._loaded = true;
    return this;
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'github';
  }

  if (options.cluster) {
    return L.npmap.layer._cluster(options);
  } else {
    return new GitHubLayer(options);
  }
};

},{"../mixin/geojson":98,"../util/util":113,"reqwest":60}],90:[function(require,module,exports){
/* global DOMParser, L */

'use strict';

var togeojson = require('@mapbox/togeojson');
var util = require('../util/util');

var KmlLayer = L.GeoJSON.extend({
  includes: [
    require('../mixin/geojson')
  ],
  initialize: function (options) {
    var me = this;

    L.Util.setOptions(this, this._toLeaflet(options));

    if (typeof options.data === 'string') {
      me._create(options, options.data);
      return this;
    } else {
      var url = options.url;

      util.strict(url, 'string');
      util.loadFile(url, 'xml', function (response) {
        if (response) {
          me._create(options, response);
        } else {
          var obj = {
            message: 'There was an error loading the KML file.'
          };

          me.fire('error', obj);
          me.errorFired = obj;
        }
      });
    }
  },
  _create: function (options, data) {
    L.GeoJSON.prototype.initialize.call(this, togeojson.kml(new DOMParser().parseFromString(data, 'text/xml')), options);
    this.fire('ready');
    this.readyFired = true;
    this._loaded = true;
    return this;
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'kml';
  }

  if (options.cluster) {
    return L.npmap.layer._cluster(options);
  } else {
    return new KmlLayer(options);
  }
};

},{"../mixin/geojson":98,"../util/util":113,"@mapbox/togeojson":2}],91:[function(require,module,exports){
/* global document, L */
/* jslint node: true */

'use strict';

var keys = require('../../keys.json');
var reqwest = require('reqwest');
var util = require('../util/util');

var MapBoxLayer = L.TileLayer.extend({
  _formatPattern: /\.((?:png|jpg)\d*)(?=$|\?)/,
  includes: [
    require('../mixin/grid')
  ],
  options: {
    accessToken: (function () {
      if (keys && keys.mapbox && keys.mapbox.access_token) {
        return keys.mapbox.access_token;
      } else {
        return null;
      }
    })(),
    errorTileUrl: L.Util.emptyImageUrl,
    format: 'png',
    subdomains: [
      'a',
      'b',
      'c',
      'd'
    ]
  },
  statics: {
    FORMATS: [
      'jpg',
      'jpg70',
      'jpg80',
      'jpg90',
      'png',
      'png32',
      'png64',
      'png128',
      'png256'
    ]
  },
  initialize: function (options) {
    var load;

    if (!options.id && !options.tileJson) {
      throw new Error('Mapbox layers require either an "id" or a "tileJson" property.');
    }

    if (options.format) {
      util.strictOneOf(options.format, MapBoxLayer.FORMATS);
    }

    load = options.tileJson || options.id;
    L.Util.setOptions(this, options);
    L.TileLayer.prototype.initialize.call(this, undefined, options);
    this._hasInteractivity = false;
    this._loadTileJson(load);
  },
  getTileUrl: function (tilePoint) {
    var tiles = this.options.tiles;
    var templated = L.Util.template(tiles[Math.floor(Math.abs(tilePoint.x + tilePoint.y) % tiles.length)], tilePoint);

    if (!templated) {
      return templated;
    } else {
      return templated.replace(this._formatPattern, (L.Browser.retina ? '@2x' : '') + '.' + this.options.format);
    }
  },
  onAdd: function onAdd (map) {
    this._map = map;
    L.TileLayer.prototype.onAdd.call(this, this._map);
  },
  onRemove: function onRemove () {
    L.TileLayer.prototype.onRemove.call(this, this._map);
    delete this._map;
  },
  _getGridData: function (latLng, callback) {
    var me = this;

    me._getTileGrid(me._getTileGridUrl(latLng), latLng, function (resultData, gridData) {
      if (resultData === 'loading') {
        callback({
          layer: me,
          results: 'loading'
        });
      } else {
        if (gridData) {
          callback({
            layer: me,
            results: [
              gridData
            ]
          });
        } else {
          callback({
            layer: me,
            results: null
          });
        }
      }
    });
  },
  _loadTileJson: function (from) {
    if (typeof from === 'string') {
      var me = this;

      reqwest({
        crossOrigin: true,
        error: function (error) {
          var obj = L.extend(error, {
            message: 'There was an error loading the data from Mapbox.'
          });

          me.fire('error', obj);
          me.errorFired = obj;
        },
        success: function (response) {
          me._setTileJson(response);
        },
        type: 'json',
        // To make CORS work in IE9.
        url: (window.location.protocol === 'https:' ? 'https://api.mapbox.com/v4/' + from + '.json?access_token=' + me.options.accessToken + '&secure=1' : 'http://a.tiles.mapbox.com/v4/' + from + '.json?access_token=' + me.options.accessToken)
      });
    } else if (typeof from === 'object') {
      this._setTileJson(from);
    }
  },
  _setTileJson: function (json) {
    var me = this;
    var extend;

    util.strict(json, 'object');

    extend = {
      attribution: (function () {
        if (me.options.attribution) {
          return me.options.attribution;
        } else if (json.attribution) {
          return json.attribution;
        } else {
          return null;
        }
      })(),
      bounds: json.bounds ? this._toLeafletBounds(json.bounds) : null,
      grids: json.grids ? json.grids : null,
      maxZoom: json.maxzoom,
      minZoom: json.minzoom,
      tiles: json.tiles,
      tms: json.scheme === 'tms'
    };

    if (typeof this.options.attribution === 'undefined') {
      extend.attribution = json.attribution;
    }

    if (this.options.clickable !== false) {
      this._hasInteractivity = typeof json.grids === 'object';
    }

    if (typeof this.options.maxZoom === 'undefined') {
      extend.maxZoom = json.maxzoom;
    }

    if (typeof this.options.minZoom === 'undefined') {
      extend.minZoom = json.minzoom;
    }

    this.options.format = this.options.format || json.tiles[0].match(this._formatPattern)[1];
    L.extend(this.options, extend);
    this.tileJson = json;
    this.redraw();
    me.fire('ready');
    me.readyFired = true;
    return this;
  },
  _toLeafletBounds: function (_) {
    return new L.LatLngBounds([[_[1], _[0]], [_[3], _[2]]]);
  },
  _update: function () {
    if (this.options.tiles) {
      L.TileLayer.prototype._update.call(this);
    }
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'mapbox';
  }

  return new MapBoxLayer(options);
};

},{"../../keys.json":1,"../mixin/grid":99,"../util/util":113,"reqwest":60}],92:[function(require,module,exports){
/* global L */

'use strict';

var reqwest = require('reqwest');
var util = require('../util/util');

var SpotLayer = L.GeoJSON.extend({
  includes: [
    require('../mixin/geojson')
  ],
  initialize: function (options) {
    var me = this;
    var supportsCors = util.supportsCors();
    var startDate;

    if (options.minutesAgo) {
      startDate = new Date(new Date() - options.minutesAgo * 60000).toISOString().slice(0, -5) + '-0000';
    }

    util.strict(options.id, 'string');
    L.Util.setOptions(this, this._toLeaflet(options));
    reqwest({
      crossOrigin: supportsCors === 'yes',
      success: function (response) {
        var message;

        if (response && response.data && response.data.response) {
          response = response.data.response;

          if (response.feedMessageResponse && response.feedMessageResponse.messages && response.feedMessageResponse.messages.message) {
            var geoJson = {
              features: [],
              type: 'FeatureCollection'
            };
            var messages = response.feedMessageResponse.messages.message;

            if (!L.Util.isArray(messages)) {
              messages = [messages];
            }

            for (var i = 0; i < messages.length; i++) {
              message = messages[i];
              geoJson.features.push({
                geometry: {
                  coordinates: [message.longitude, message.latitude],
                  type: 'Point'
                },
                properties: message,
                type: 'Feature'
              });
            }

            if (geoJson.features.length) {
              me._create(me.options, geoJson);
            } else {
              var obj;

              message = 'The SPOT service returned invalid data.';
              obj = {
                message: message
              };

              me.fire('error', obj);
              me.errorFired = obj;

              if (me._map) {
                me._map.notify.danger(message);
              }
            }
          } else {
            message = 'The SPOT service returned the following error message: ' + response.errors.error.text;

            me.fire('error', {
              message: message
            });

            if (me._map) {
              me._map.notify.danger(message);
            }
          }
        } else {
          message = 'The SPOT service is unresponsive.';
          me.fire('error', {
            message: message
          });

          if (me._map) {
            me._map.notify.danger(message);
          }
        }
      },
      type: 'json' + (supportsCors === 'yes' ? '' : 'p'),
      url: 'https://server-utils.herokuapp.com/proxy/?type=json&url=' + encodeURIComponent('https://api.findmespot.com/spot-main-web/consumer/rest-api/2.0/public/feed/' + options.id + (options.latest ? '/latest' : '/message') + '?dir=DESC&sort=timeInMili' + (options.password ? '&feedPassword=' + options.password : '') + (startDate ? '&startDate=' + startDate : '')) + (supportsCors === 'yes' ? '' : '&callback=?')
    });

    return this;
  },
  _create: function (options, data) {
    L.GeoJSON.prototype.initialize.call(this, data, options);
    this.fire('ready');
    this.readyFired = true;
    this._loaded = true;
    return this;
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'spot';
  }

  if (options.cluster) {
    return L.npmap.layer._cluster(options);
  } else {
    return new SpotLayer(options);
  }
};

},{"../mixin/geojson":98,"../util/util":113,"reqwest":60}],93:[function(require,module,exports){
/* global L */

'use strict';

var util = require('../util/util');
var TiledLayer;

TiledLayer = L.TileLayer.extend({
  options: {
    errorTileUrl: L.Util.emptyImageUrl
  },
  initialize: function (options) {
    util.strict(options.url, 'string');

    if (L.Browser.retina && options.retinaId) {
      options.url = options.url.replace('{{retina}}', options.retinaId);
    } else {
      options.url = options.url.replace('{{retina}}', '');
    }

    if (options.supportsSsl) {
      options.url = options.url.replace('{{protocol}}', 'https://');
    } else {
      options.url = options.url.replace('{{protocol}}', 'http://');
    }

    L.Util.setOptions(this, options);
    L.TileLayer.prototype.initialize.call(this, options.url, options);
    this.fire('ready');
    this.readyFired = true;
    return this;
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'tiled';
  }

  return new TiledLayer(options);
};

},{"../util/util":113}],94:[function(require,module,exports){
/* global L */

'use strict';

var util = require('../util/util');

var WmsLayer = L.TileLayer.WMS.extend({
  initialize: function (options) {
    util.strict(options.layers, 'string');
    util.strict(options.url, 'string');
    L.TileLayer.WMS.prototype.initialize.call(this, options.url, options);
    this.fire('ready');
    this.readyFired = true;
    return this;
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'wms';
  }

  return new WmsLayer(options);
};

},{"../util/util":113}],95:[function(require,module,exports){
/* global L */

'use strict';

var util = require('../util/util');

var ZoomifyLayer = L.TileLayer.extend({
  options: {
    noWrap: true,
    tileGroupPrefix: 'TileGroup',
    tilesPerTileGroup: 256,
    tolerance: 1
  },
  initialize: function (url, options) {
    L.TileLayer.prototype.initialize.call(this, url, options);
    util.strict(options.height, 'number');
    util.strict(options.url, 'string');
    util.strict(options.width, 'number');
  },
  beforeAdd: function (map) {
    var imageSize = L.point(this.options.width, this.options.height);
    var maxNativeZoom;
    var maxX;
    var maxY;
    var maxZoomGrid;
    var northWest;
    var southEast;

    this._imageSize = [imageSize];
    this._gridSize = [this._getGridSize(imageSize)];

    while (imageSize.x > this.options.tileSize || imageSize.y > this.options.tileSize) {
      imageSize = imageSize.divideBy(2).floor();
      this._imageSize.push(imageSize);
      this._gridSize.push(this._getGridSize(imageSize));
    }

    this._imageSize.reverse();
    this._gridSize.reverse();
    maxNativeZoom = this._gridSize.length - 1;
    this.options.maxNativeZoom = maxNativeZoom;
    maxZoomGrid = this._gridSize[maxNativeZoom];
    maxX = maxZoomGrid.x * this.options.tileSize;
    maxY = maxZoomGrid.y * this.options.tileSize;
    northWest = map.unproject([0, 0], maxNativeZoom);
    southEast = map.unproject([maxX, maxY], maxNativeZoom);
    this.options.bounds = new L.LatLngBounds([northWest, southEast]);
    L.TileLayer.prototype.beforeAdd.call(this, map);
  },
  onAdd: function (map) {
    var mapSize = map.getSize();
    var zoom = this._getBestFitZoom(mapSize);
    var imageSize = this._imageSize[zoom];
    var center = map.options.crs.pointToLatLng(new L.Point(imageSize.x / 2, (imageSize.y + (map.getContainer().parentNode.parentNode.childNodes[0].style.display === 'block' ? 25 : 0)) / 2), zoom);

    L.TileLayer.prototype.onAdd.call(this, map);
    map.options.center = center;
    map.options.maxZoom = this.options.maxNativeZoom;
    map.options.zoom = zoom;
    map.setView(center, zoom, false);
    this.fire('ready');
    this.readyFired = true;
  },
  getBounds: function () {
    return this.options.bounds;
  },
  getTileUrl: function (coords) {
    this.options.g = this.options.tileGroupPrefix + this._getTileGroup(coords);
    return L.TileLayer.prototype.getTileUrl.call(this, coords);
  },
  _addTile: function (coords, container) {
    var imageSize = this._imageSize[this._getZoomForUrl()];
    var gridSize = this._gridSize[this._getZoomForUrl()];
    var realTileSize = L.GridLayer.prototype.getTileSize.call(this);
    var displayTileSize = L.TileLayer.prototype.getTileSize.call(this);
    var key = this._tileCoordsToKey(coords);
    var tile;
    var scaleFactor = L.point((imageSize.x % realTileSize.x), (imageSize.y % realTileSize.y)).unscaleBy(realTileSize);

    L.TileLayer.prototype._addTile.call(this, coords, container);
    tile = this._tiles[key].el;

    if ((imageSize.x % realTileSize.x) > 0 && coords.x === gridSize.x - 1) {
      tile.style.width = displayTileSize.scaleBy(scaleFactor).x + 'px';
    }

    if ((imageSize.y % realTileSize.y) > 0 && coords.y === gridSize.y - 1) {
      tile.style.height = displayTileSize.scaleBy(scaleFactor).y + 'px';
    }
  },
  _getBestFitZoom: function (mapSize) {
    var tolerance = this.options.tolerance;
    var zoom = this._imageSize.length - 1;
    var imageSize;

    while (zoom) {
      imageSize = this._imageSize[zoom];

      if (((imageSize.x * tolerance) < mapSize.x) && ((imageSize.y * tolerance) < mapSize.y)) {
        return zoom;
      }

      zoom--;
    }

    return zoom;
  },
  _getGridSize: function (imageSize) {
    var tileSize = this.options.tileSize;
    return L.point(Math.ceil(imageSize.x / tileSize), Math.ceil(imageSize.y / tileSize));
  },
  _getTileGroup: function (coords) {
    var zoom = this._getZoomForUrl();
    var num = 0;
    var gridSize;

    for (var z = 0; z < zoom; z++) {
      gridSize = this._gridSize[z];
      num += gridSize.x * gridSize.y;
    }

    num += coords.y * this._gridSize[zoom].x + coords.x;
    return Math.floor(num / this.options.tilesPerTileGroup);
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'zoomify';
  }

  return new ZoomifyLayer(options.url, options);
};

},{"../util/util":113}],96:[function(require,module,exports){
/* global L */
/* jshint camelcase: false */

'use strict';

var baselayerPresets = require('./preset/baselayers.json');
var colorPresets = require('./preset/colors.json');
var humane = require('humane-js');
var Nanobar = require('nanobar');
var overlayPresets = require('./preset/overlays.json');
var util = require('./util/util');
var MapExt;

require('./popup.js');

(function () {
  var style = colorPresets.gold;

  L.Circle.mergeOptions(style);
  L.CircleMarker.mergeOptions(style);
  L.Control.Attribution.mergeOptions({
    prefix: '<a href="https://www.nps.gov/npmap/disclaimer/" target="_blank">Disclaimer</a>'
  });
  L.Map.addInitHook(function () {
    var container = this.getContainer();
    var elAttribution = util.getChildElementsByClassName(container, 'leaflet-control-attribution')[0];
    var elControl = util.getChildElementsByClassName(container, 'leaflet-control-container')[0];
    var me = this;

    function resize () {
      var left = util.getOuterDimensions(elControl.childNodes[2]).width;
      var overviewControl = util.getChildElementsByClassName(container, 'leaflet-control-overview')[0];

      if (left) {
        left = left + 15;
      } else {
        left = 10;
      }

      if (overviewControl && !util.isHidden(overviewControl)) {
        elAttribution.style['margin-right'] = util.getOuterDimensions(overviewControl).width + 'px';
      } else {
        elAttribution.style['margin-right'] = 0;
      }

      elAttribution.style['max-width'] = (util.getOuterDimensions(container).width - left) + 'px';
    }

    if (this.options.attributionControl) {
      this.attributionControl._update = function () {
        var attribs = [];
        var prefixAndAttribs = [];

        for (var attribution in this._attributions) {
          if (this._attributions[attribution] > 0) {
            var i = -1;

            if (attribution) {
              for (var j = 0; j < attribs.length; j++) {
                if (attribs[j] === attribution) {
                  i = j;
                  break;
                }
              }

              if (i === -1) {
                attribs.push(attribution);
              }
            }
          }
        }

        if (this.options.prefix) {
          prefixAndAttribs.push(this.options.prefix);
        }

        if (attribs.length) {
          prefixAndAttribs.push(attribs.join(' | '));
        }

        this._container.innerHTML = prefixAndAttribs.join(' | ');

        if (typeof me._updateImproveLinks === 'function') {
          me._updateImproveLinks();
        }
      };
      this.on('resize', resize);
      resize();
    }

    if (typeof me._updateImproveLinks === 'function') {
      me.on('moveend', me._updateImproveLinks);
    }
  });
  L.Polygon.mergeOptions(style);
  L.Polyline.mergeOptions({
    color: style.color,
    opacity: style.opacity,
    weight: style.weight
  });
})();
MapExt = L.Map.extend({
  options: {
    bounceAtZoomLimits: false,
    wheelPxPerZoomLevel: 120,
    worldCopyJump: true,
    zoomDelta: 0.5,
    zoomSnap: 0.5
  },
  initialize: function (options) {
    var baseLayerSet = false;
    var container = L.DomUtil.create('div', 'npmap-container');
    var map = L.DomUtil.create('div', 'npmap-map');
    var mapWrapper = L.DomUtil.create('div', 'npmap-map-wrapper');
    var me = this;
    var modules = L.DomUtil.create('div', 'npmap-modules');
    var npmap = L.DomUtil.create('div', 'npmap' + ((L.Browser.ie6 || L.Browser.ie7) ? ' npmap-oldie' : '') + (L.Browser.retina ? ' npmap-retina' : ''));
    var toolbar = L.DomUtil.create('div', 'npmap-toolbar');
    var toolbarLeft = L.DomUtil.create('ul', 'left');
    var toolbarRight = L.DomUtil.create('ul', 'right');
    var zoomifyMode = false;

    options = me._toLeaflet(options);
    L.Util.setOptions(this, options);
    options.div.insertBefore(npmap, options.div.hasChildNodes() ? options.div.childNodes[0] : null);
    npmap.appendChild(modules);
    npmap.appendChild(container);
    toolbar.appendChild(toolbarLeft);
    toolbar.appendChild(toolbarRight);
    container.appendChild(toolbar);
    container.appendChild(mapWrapper);
    mapWrapper.appendChild(map);
    options.div = map;
    options.zoomControl = false;
    L.Map.prototype.initialize.call(me, options.div, options);
    me._addEvents(me, options);
    me._controllingCursor = 'map';
    me._controllingInteractivity = 'map';
    me._defaultCursor = me.getContainer().style.cursor;

    me.on('autopanstart', function () {
      me._setCursor('');
    });
    me.notify = humane.create({
      baseCls: 'humane-bootstrap',
      container: map
    });
    me.notify.danger = me.notify.spawn({
      addnCls: 'humane-bootstrap-danger'
    });
    me.notify.info = me.notify.spawn({
      addnCls: 'humane-bootstrap-info'
    });
    me.notify.success = me.notify.spawn({
      addnCls: 'humane-bootstrap-success'
    });
    me.notify.warning = me.notify.spawn({
      addnCls: 'humane-bootstrap-warning'
    });
    me._progress = new Nanobar({
      bg: '#d29700',
      id: 'npmap-progress',
      target: map
    });

    if (!me._loaded) {
      me.setView(options.center, options.zoom);
    }

    if (options.baseLayers.length) {
      var zoomify = [];
      var baseLayer;
      var i;

      for (i = 0; i < options.baseLayers.length; i++) {
        baseLayer = options.baseLayers[i];

        if (baseLayer.type === 'zoomify') {
          zoomify.push(baseLayer);
        }
      }

      if (zoomify.length) {
        zoomifyMode = true;

        for (i = 0; i < zoomify.length; i++) {
          baseLayer = zoomify[i];

          if (baseLayer.visible || typeof baseLayer.visible === 'undefined') {
            baseLayer.visible = true;
            baseLayer.L = L.npmap.layer.zoomify(baseLayer);
            me._addEvents(baseLayer.L, baseLayer);
            baseLayer.L.addTo(me);
            break;
          }
        }
      } else {
        for (i = 0; i < options.baseLayers.length; i++) {
          baseLayer = options.baseLayers[i];
          baseLayer.zIndex = 0;

          if (!baseLayerSet && (baseLayer.visible || typeof baseLayer.visible === 'undefined')) {
            baseLayer.visible = true;
            baseLayerSet = true;

            if (baseLayer.type === 'arcgisserver') {
              baseLayer.L = me._createArcGisServerLayer(baseLayer);
            } else {
              baseLayer.L = L.npmap.layer[baseLayer.type](baseLayer);
            }

            me._addEvents(baseLayer.L, baseLayer);
            me.addLayer(baseLayer.L);
          } else {
            baseLayer.visible = false;
          }
        }
      }
    }

    if (!zoomifyMode && options.overlays.length) {
      var zIndex = 1;

      for (var j = 0; j < options.overlays.length; j++) {
        var overlay = options.overlays[j];

        if (typeof overlay === 'string') {
          // TODO: Support preset strings that are passed in.
        } else if (overlay.type === 'zoomify') {
          throw new Error('Zoomify layers can only be added in the "baseLayers" config property.');
        } else {
          if (overlay.visible || typeof overlay.visible === 'undefined') {
            overlay.visible = true;
            overlay.zIndex = zIndex;

            if (overlay.preset) {
              switch (overlay.preset) {
                case 'nps-places-pois':
                  overlay.L = L.npmap.preset.places.pois(overlay);
                  break;
              }
            } else if (overlay.type === 'arcgisserver') {
              overlay.L = me._createArcGisServerLayer(overlay);
            } else {
              overlay.L = L.npmap.layer[overlay.type](overlay);
            }

            me._addEvents(overlay.L, overlay);
            me.addLayer(overlay.L);
            zIndex++;
          } else {
            overlay.visible = false;
          }
        }
      }
    }

    util.checkNpsNetwork(function (on) {
      me._onNpsNetwork = on;

      if (typeof me._updateImproveLinks === 'function') {
        me._updateImproveLinks();
      }
    });
    me._initializeModules();
    me._setupPopup();
    me._setupTooltip();

    return this;
  },
  _addEvents: function (obj, config) {
    if (config.events && config.events.length) {
      for (var i = 0; i < config.events.length; i++) {
        var e = config.events[i];
        var context = e.context || null;

        if (e.single === true) {
          obj.once(e.type, e.fn, context);
        } else {
          obj.on(e.type, e.fn, context);
        }

        if (e.type === 'error' && obj.errorFired) {
          obj.fire('error', obj.errorFired);
        } else if (e.type === 'load' && obj._loaded) {
          obj.fire('load');
        } else if (e.type === 'ready' && obj.readyFired) {
          obj.fire('ready');
        }
      }
    }
  },
  _createArcGisServerLayer: function (config) {
    return L.npmap.layer[config.type][config.tiled === true ? 'tiled' : 'dynamic'](config);
  },
  _initializeModules: function () {
    if (this.options && this.options.modules && L.Util.isArray(this.options.modules) && this.options.modules.length) {
      var initialize = null;
      var me = this;
      var modules = this.options.modules;
      var width = 0;
      var button;
      var i;

      this._divWrapper = this._container.parentNode.parentNode;
      this._divModules = util.getChildElementsByClassName(this._divWrapper.parentNode.parentNode, 'npmap-modules')[0];
      this._divModuleButtons = L.DomUtil.create('div', 'npmap-modules-buttons', this._container.parentNode);
      this._buttonCloseModules = L.DomUtil.create('button', 'npmap-modules-buttons-button', this._divModuleButtons);
      this._buttonCloseModules.style.backgroundImage = 'url(' + window.L.Icon.Default.imagePath + '/font-awesome/times' + (L.Browser.retina ? '@2x' : '') + '.png)';
      this._buttonCloseModules.setAttribute('alt', 'Close');
      L.DomEvent.addListener(this._buttonCloseModules, 'click', me.closeModules, this);

      for (i = 0; i < modules.length; i++) {
        var div = L.DomUtil.create('div', 'module', this._divModules);
        var divTitle = L.DomUtil.create('h2', 'title', div);
        var divContent = L.DomUtil.create('div', 'content', div);
        var module = modules[i];
        var content;
        var icon;
        var title;

        if (module.type !== 'custom') {
          this.options.modules[i] = module = L.npmap.module[module.type](module).addTo(this);
        }

        content = module.content;
        icon = module.icon;
        title = divTitle.innerHTML = module.title;

        if (typeof content === 'string') {
          divContent.innerHTML = content;
        } else if ('nodeType' in content) {
          divContent.appendChild(content);
        }

        button = L.DomUtil.create('button', 'npmap-modules-buttons-button', this._divModuleButtons);
        button.id = 'npmap-modules-buttons_' + title.replace(/ /g, '_');
        button.setAttribute('alt', title);
        button.style.backgroundImage = 'url(' + window.L.Icon.Default.imagePath + '/font-awesome/' + icon + (L.Browser.retina ? '@2x' : '') + '.png)';
        div.id = 'npmap-module_' + title.replace(/ /g, '_');

        if (typeof module.width === 'number') {
          if (module.width > width) {
            width = module.width;
          }
        }

        L.DomEvent.addListener(button, 'click', function () {
          me.showModule(this.id.replace('npmap-modules-buttons_', ''));
        });

        if (!initialize && module.visible === true) {
          initialize = title;
        }
      }

      if (width !== 0) {
        this._divModules.style.width = width + 'px';
      }

      if (initialize) {
        this.showModule(initialize);
      } else {
        for (i = 1; i < this._divModuleButtons.childNodes.length; i++) {
          button = this._divModuleButtons.childNodes[i];
          button.style.display = 'inline-block';
        }
      }
    }
  },
  _setCursor: function (type) {
    this._container.style.cursor = type;
  },
  _setupPopup: function () {
    var clicks = 0;
    var detectAvailablePopupSpace = true;
    var me = this;
    var canceled;
    var changed;
    var hasArcGisServer;

    if (typeof me.options.detectAvailablePopupSpace !== 'undefined' && me.options.detectAvailablePopupSpace === false) {
      detectAvailablePopupSpace = false;
    }

    function done () {
      me
        .off('click', setCanceled)
        .off('dragstart', setChanged)
        .off('movestart', setChanged)
        .off('zoomstart', setChanged);

      if (hasArcGisServer) {
        me._progress.go(100);
        me._setCursor('');
      }
    }
    function go (e) {
      var queryable = [];
      var layer;

      canceled = false;
      changed = false;
      me
        .on('click', setCanceled)
        .on('dragstart', setChanged)
        .on('movestart', setChanged)
        .on('zoomstart', setChanged);

      for (var layerId in me._layers) {
        layer = me._layers[layerId];

        if (typeof layer.options === 'object' && (typeof layer.options.popup === 'undefined' || layer.options.popup !== false) && typeof layer._handleClick === 'function' && layer._hasInteractivity !== false) {
          queryable.push(layer);
        }
      }

      if (queryable.length) {
        var completed = 0;
        var intervals = 0;
        var latLng = e.latlng.wrap();
        var results = [];
        var i;
        var interval;

        hasArcGisServer = false;

        for (i = 0; i < queryable.length; i++) {
          layer = queryable[i];

          if (layer.options && layer.options.type === 'arcgisserver') {
            hasArcGisServer = true;
          }

          layer._handleClick(latLng, function (result) {
            if (result) {
              results.push(result);
            }

            completed++;
          });
        }

        if (hasArcGisServer) {
          me._progress.go(1);
          me._setCursor('wait');
        }

        interval = setInterval(function () {
          intervals++;

          if (hasArcGisServer) {
            me._progress.go(intervals);
          }

          if (canceled || changed) {
            clearInterval(interval);
            done();
          } else if ((queryable.length === completed) || intervals > 98) {
            clearInterval(interval);
            done();

            if (intervals > 98) {
              me.notify.danger('One or more servers failed to respond.');
            }

            if (results.length) {
              var actual = [];

              for (var i = 0; i < results.length; i++) {
                var result = results[i];

                if (typeof result.results !== 'undefined') {
                  if (result.results && result.results !== 'loading') {
                    actual.push(result);
                  }
                } else {
                  actual.push(result);
                }
              }

              if (actual.length) {
                var popup = L.npmap.popup({
                  autoPanPaddingTopLeft: util._getAutoPanPaddingTopLeft(me.getContainer()),
                  maxHeight: (detectAvailablePopupSpace ? util._getAvailableVerticalSpace(me) - 84 : null),
                  maxWidth: (detectAvailablePopupSpace ? util._getAvailableHorizontalSpace(me) - 77 : null)
                });

                popup
                  .setContent(popup._handleResults(actual, me.options.popup))
                  .setLatLng(latLng).openOn(me);
              }
            }
          }
        }, 100);
      }
    }
    function setCanceled () {
      canceled = true;
    }
    function setChanged () {
      changed = true;
    }

    me.on('dblclick', function () {
      clicks++;
    });
    me.on('click', function (e) {
      clicks = 0;

      if (me._controllingInteractivity === 'map') {
        setTimeout(function () {
          if (!clicks) {
            go(e);
          }
        }, 200);
      }
    });
  },
  _setupTooltip: function () {
    var me = this;
    var overData = [];
    var tooltip = (me.infoboxControl ? me.infoboxControl : L.npmap.tooltip({
      map: me
    }));

    function handle () {
      if (me._controllingCursor === 'map') {
        updateCursor();
      }

      if (me._tooltips.length) {
        var changed = false;
        var childNodes = tooltip._container.childNodes;
        var html = '';
        var i;
        var obj;

        if (childNodes.length) {
          var remove = [];

          for (i = 0; i < childNodes.length; i++) {
            var childNode = childNodes[i];
            var removeNode = true;

            for (var j = 0; j < me._tooltips.length; j++) {
              obj = me._tooltips[j];

              // Also do comparison of html to see.
              if (obj.added && (obj.layerId === parseInt(childNode.id.replace('tooltip-', ''), 10))) {
                removeNode = false;
                break;
              }
            }

            if (removeNode) {
              remove.push(childNode);
            }
          }

          if (remove.length) {
            for (i = 0; i < remove.length; i++) {
              var div = remove[i];

              div.parentNode.removeChild(div);
            }

            changed = true;
          }

          html = tooltip.getHtml();
        }

        for (i = 0; i < me._tooltips.length; i++) {
          obj = me._tooltips[i];

          if (!obj.added) {
            changed = true;
            html += '<div id="tooltip-' + obj.layerId + '">' + util.unescapeHtml(obj.html) + '</div>';
            obj.added = true;
          }
        }

        if (tooltip.isVisible()) {
          if (changed) {
            tooltip.setHtml(html);
          }

          tooltip.setPosition(me._cursorEvent.containerPoint);
        } else {
          tooltip.show(me._cursorEvent.containerPoint, html);
        }
      } else {
        tooltip.hide();
        tooltip.setHtml('');
      }
    }
    function removeOverData (layerId) {
      var remove = [];
      var i;

      for (i = 0; i < overData.length; i++) {
        if (overData[i] === layerId) {
          remove.push(layerId);
        }
      }

      if (remove.length) {
        for (i = 0; i < remove.length; i++) {
          overData.splice(overData.indexOf(remove[i]), 1);
        }
      }
    }
    function removeTooltip (layerId) {
      var remove = [];
      var i;

      for (i = 0; i < me._tooltips.length; i++) {
        var obj = me._tooltips[i];

        if (obj.layerId === layerId) {
          remove.push(obj);
        }
      }

      if (remove.length) {
        for (i = 0; i < remove.length; i++) {
          me._tooltips.splice(me._tooltips.indexOf(remove[i]), 1);
        }
      }
    }
    function updateCursor () {
      if (overData.length) {
        me._setCursor('pointer');
      } else {
        if (me.getContainer().style.cursor !== 'wait') {
          me._setCursor('');
        }
      }
    }

    me._tooltips = [];
    L.DomEvent.on(util.getChildElementsByClassName(me.getContainer(), 'leaflet-popup-pane')[0], 'mousemove', function (e) {
      L.DomEvent.stopPropagation(e);
      tooltip.hide();
    });
    me.on('mousemove', function (e) {
      me._cursorEvent = e;

      if (me._controllingCursor === 'map') {
        handle();

        for (var layerId in me._layers) {
          var layer = me._layers[layerId];

          if (typeof layer._handleMousemove === 'function' && layer._hasInteractivity !== false) {
            layer._handleMousemove(me._cursorEvent.latlng.wrap(), function (result) {
              if (result.results !== 'loading') {
                var l = result.layer;
                var leafletId = l._leaflet_id;

                removeOverData(leafletId);
                removeTooltip(leafletId);

                if (result.results) {
                  overData.push(leafletId);

                  if (l.options && l.options.tooltip) {
                    for (var i = 0; i < result.results.length; i++) {
                      var data = result.results[i];
                      var tip;

                      if (typeof l.options.tooltip === 'function') {
                        tip = util.handlebars(l.options.tooltip(data));
                      } else if (typeof l.options.tooltip === 'string') {
                        tip = util.unescapeHtml(util.handlebars(l.options.tooltip, data));
                      }

                      if (tip && me._tooltips.indexOf(tip) === -1) {
                        me._tooltips.push({
                          html: tip,
                          layerId: leafletId
                        });
                      }
                    }
                  }
                }

                handle();
              }
            });
          }
        }
      }
    });
    me.on('mouseout', function () {
      tooltip.hide();
    });
  },
  _toLeaflet: function (config) {
    if (!config.div) {
      throw new Error('The map config object must have a div property');
    } else if (typeof config.div !== 'string' && typeof config.div !== 'object') {
      throw new Error('The map config object must be either a string or object');
    }

    if (config.baseLayers === false || (L.Util.isArray(config.baseLayers) && !config.baseLayers.length)) {
      config.baseLayers = [];
    } else {
      config.baseLayers = (function () {
        var visible = false;

        if (config.baseLayers && L.Util.isArray(config.baseLayers) && config.baseLayers.length) {
          for (var i = 0; i < config.baseLayers.length; i++) {
            var baseLayer = config.baseLayers[i];

            if (typeof baseLayer === 'string') {
              var name = baseLayer.split('-');

              if (name[1]) {
                baseLayer = util.clone(baselayerPresets[name[0]][name[1]]);
              } else {
                baseLayer = util.clone(baselayerPresets[name]);
              }
            }

            if (baseLayer.visible === true || typeof baseLayer.visible === 'undefined') {
              if (visible) {
                baseLayer.visible = false;
              } else {
                baseLayer.visible = true;
                visible = true;
              }
            } else {
              baseLayer.visible = false;
            }

            baseLayer.zIndex = 0;
            config.baseLayers[i] = baseLayer;
          }
        }

        if (visible) {
          return config.baseLayers;
        } else {
          var active = util.clone(baselayerPresets.nps.parkTiles);
          active.visible = true;
          active.zIndex = 0;
          return [
            active
          ];
        }
      })();
    }

    config.center = (function () {
      var c = config.center;

      if (c) {
        return new L.LatLng(c.lat, c.lng);
      } else {
        return new L.LatLng(39.06, -96.02);
      }
    })();

    if (typeof config.div === 'string') {
      config.div = document.getElementById(config.div);
    }

    if (config.layers && L.Util.isArray(config.layers) && config.layers.length) {
      config.overlays = config.layers;

      for (var j = 0; j < config.overlays.length; j++) {
        var overlay = config.overlays[j];

        if (typeof overlay === 'string') {
          overlay = config.overlays[j] = util.clone(overlayPresets[overlay]);
        }
      }
    } else if (!config.overlays || !L.Util.isArray(config.overlays)) {
      config.overlays = [];
    }

    if (typeof config.maxZoom !== 'number') {
      config.maxZoom = 19;
    }

    if (config.baseLayers.length !== 0 && config.maxZoom > config.baseLayers[0].maxZoom) {
      config.maxZoom = config.baseLayers[0].maxZoom;
    }

    delete config.layers;
    config.zoom = typeof config.zoom === 'number' ? config.zoom : 4;

    if (config.baseLayers.length !== 0) {
      if (config.baseLayers[0].minZoom > config.zoom) {
        config.zoom = config.baseLayers[0].minZoom;
      } else if (config.baseLayers[0].maxZoom < config.zoom) {
        config.zoom = config.baseLayers[0].maxZoom;
      }
    }

    return config;
  },
  _updateImproveLinks: function () {
    if (this.attributionControl) {
      var els = util.getChildElementsByClassName(this.attributionControl._container, 'improve-park-tiles');

      if (els && els.length) {
        var center = this.getCenter();
        var el = els[0];
        var lat = center.lat.toFixed(5);
        var lng = center.lng.toFixed(5);
        var zoom = this.getZoom();

        el.href = (this._onNpsNetwork ? ('http://insidemaps.nps.gov/places/editor/#background=mapbox-satellite&map=' + zoom + '/' + lng + '/' + lat + '&overlays=park-tiles-overlay') : ('https://www.nps.gov/npmap/tools/park-tiles/improve/#' + zoom + '/' + lat + '/' + lng));
      }
    }
  },
  closeModules: function () {
    var buttons = this._divModuleButtons.childNodes;

    this._buttonCloseModules.style.display = 'none';
    this._divWrapper.style.left = '0';
    this._divModules.style.display = 'none';

    for (var i = 1; i < buttons.length; i++) {
      var button = buttons[i];

      L.DomUtil.removeClass(button, 'active');
      button.style.display = 'inline-block';
    }

    this.invalidateSize();
  },
  showModule: function (title) {
    var divModules = this._divModules;
    var childNodes = divModules.childNodes;
    var modules = this.options.modules;
    var i;

    title = title.replace(/_/g, ' ');

    for (i = 0; i < modules.length; i++) {
      var m = modules[i];
      var visibility = 'none';

      if (m.title === title) {
        visibility = 'block';
      }

      m.visible = (visibility === 'block');
      childNodes[i].style.display = visibility;
    }

    divModules.style.display = 'block';
    this._divWrapper.style.left = util.getOuterDimensions(divModules).width + 'px';
    this.invalidateSize();

    for (i = 0; i < this._divModuleButtons.childNodes.length; i++) {
      var button = this._divModuleButtons.childNodes[i];

      if (i === 0) {
        button.style.display = 'inline-block';
      } else {
        if (modules.length > 1) {
          button.style.display = 'inline-block';
        } else {
          button.style.display = 'none';
        }
      }

      if (button.id.replace('npmap-modules-buttons_', '').replace(/_/g, ' ') === title) {
        L.DomUtil.addClass(button, 'active');
      } else {
        L.DomUtil.removeClass(button, 'active');
      }
    }

    // TODO: Fire module 'show' event.
  },
  showModules: function () {
    var buttons = this._divModuleButtons.childNodes;

    this._buttonCloseModules.style.display = 'inline-block';
    this._divModules.style.display = 'block';
    this._divWrapper.style.left = util.getOuterDimensions(this._divModules).width + 'px';

    for (var i = 1; i < buttons.length; i++) {
      buttons[i].style.display = 'inline-block';
    }

    this.invalidateSize();
  }
});

module.exports = function (config) {
  return new MapExt(config);
};

},{"./popup.js":102,"./preset/baselayers.json":103,"./preset/colors.json":104,"./preset/overlays.json":105,"./util/util":113,"humane-js":54,"nanobar":58}],97:[function(require,module,exports){
/* global L */
/* jshint camelcase: false */

'use strict';

var reqwest = require('reqwest');

module.exports = {
  _boundsToExtent: function (bounds) {
    var ne = bounds.getNorthEast();
    var sw = bounds.getSouthWest();

    return {
      spatalReference: {
        wkid: 4326
      },
      xmax: ne.lng,
      xmin: sw.lng,
      ymax: ne.lat,
      ymin: sw.lat
    };
  },
  _cleanUrl: function (url) {
    url = L.Util.trim(url);

    if (url[url.length - 1] !== '/') {
      url += '/';
    }

    return url;
  },
  _getMetadata: function () {
    var me = this;

    reqwest({
      success: function (response) {
        if (response.error) {
          me.fire('error', response.error);
          me.errorFired = response.error;
        } else {
          var capabilities = response.capabilities;

          if (typeof capabilities === 'string' && capabilities.toLowerCase().indexOf('query') === -1) {
            me._hasInteractivity = false;
          }

          me._metadata = response;
          me.fire('ready', response);
          me.readyFired = true;
        }
      },
      type: 'jsonp',
      url: me._serviceUrl + '?f=json'
    });
  },
  _handleClick: function (latLng, callback) {
    var me = this;

    me.identify(latLng, function (response) {
      if (response) {
        var results = response.results;

        if (results && results.length) {
          var obj = {
            layer: me,
            subLayers: []
          };

          for (var i = 0; i < results.length; i++) {
            var active = null;
            var result = results[i];

            for (var j = 0; j < obj.subLayers.length; j++) {
              var subLayer = obj.subLayers[j];

              if (subLayer.name === result.layerName) {
                active = subLayer;
                break;
              }
            }

            if (active) {
              active.results.push(result.attributes);
            } else {
              obj.subLayers.push({
                name: result.layerName,
                popup: {
                  description: {
                    format: 'table'
                  },
                  title: '{{[' + result.displayFieldName + ']}}'
                },
                results: [
                  result.attributes
                ]
              });
            }
          }

          callback(obj);
        } else {
          callback(null);
        }
      } else {
        callback(null);
      }
    });
  },
  _updateAttribution: function () {
    var map = this._map;
    var bounds = map.getBounds();
    var include = [];
    var zoom = map.getZoom();

    if (this.options.attribution) {
      this._map.attributionControl.removeAttribution(this.options.attribution);
    }

    for (var i = 0; i < this._dynamicAttributionData.length; i++) {
      var contributor = this._dynamicAttributionData[i];

      for (var j = 0; j < contributor.coverageAreas.length; j++) {
        var coverageArea = contributor.coverageAreas[j];
        var coverageBounds = coverageArea.bbox;

        if (zoom >= coverageArea.zoomMin && zoom <= coverageArea.zoomMax) {
          if (bounds.intersects(L.latLngBounds(L.latLng(coverageBounds[0], coverageBounds[3]), L.latLng(coverageBounds[2], coverageBounds[1])))) {
            include.push(contributor.attribution);
            break;
          }
        }
      }
    }

    if (include.length) {
      this.options.attribution = include.join(', ');
      map.attributionControl.addAttribution(this.options.attribution);
    }
  },
  getLayers: function () {
    if (this._layerParams) {
      return this._layerParams.layers.split(':')[1];
    } else {
      return this.options.layers;
    }
  },
  identify: function (latLng, callback) {
    var map = this._map;
    var size = map.getSize();
    var params = {
      f: 'json',
      geometry: JSON.stringify({
        spatialReference: {
          wkid: 4326
        },
        x: latLng.lng,
        y: latLng.lat
      }),
      geometryType: 'esriGeometryPoint',
      imageDisplay: size.x + ',' + size.y + ',96',
      layers: 'visible:' + this.getLayers(),
      mapExtent: JSON.stringify(this._boundsToExtent(map.getBounds())),
      returnGeometry: false,
      sr: '4326',
      tolerance: 6
    };

    reqwest({
      data: params,
      error: function () {
        callback(null);
      },
      success: function (response) {
        callback(response);
      },
      type: 'jsonp',
      url: this._serviceUrl + 'identify'
    });
  }
};

},{"reqwest":60}],98:[function(require,module,exports){
/* global L */
/* jshint camelcase: false */

'use strict';

var topojson = require('../util/topojson');
var util = require('../util/util');

module.exports = {
  _types: {
    'LineString': 'line',
    'MultiLineString': 'line',
    'Point': 'point',
    'Polygon': 'polygon'
  },
  addData: function (feature) {
    if (/\btopology\b/i.test(feature.type)) {
      for (var prop in feature.objects) {
        var geojson = topojson.feature(feature, feature.objects[prop]);

        this._checkGeometryType(geojson);
        L.GeoJSON.prototype.addData.call(this, geojson);
      }
    } else {
      this._checkGeometryType(feature);
      L.GeoJSON.prototype.addData.call(this, feature);
    }
  },
  onAdd: function (map) {
    this._map = map;
    this._addAttribution();

    if (this.options.zoomToBounds) {
      this.on('ready', function () {
        map.fitBounds(this.getBounds());
      });
    }

    L.GeoJSON.prototype.onAdd.call(this, map);
  },
  onRemove: function (map) {
    delete this._map;
    this._removeAttribution();
    L.GeoJSON.prototype.onRemove.call(this, map);
  },
  _addAttribution: function () {
    var attribution = this.options.attribution;

    if (attribution && this._map.attributionControl) {
      this._map.attributionControl.addAttribution(attribution);
    }
  },
  _checkGeometryType: function (feature) {
    if (!this._geometryTypes) {
      this._geometryTypes = [];
    }

    if (feature.geometry && feature.geometry.type) {
      var type = this._types[feature.geometry.type];

      if (this._geometryTypes.indexOf(type) === -1) {
        this._geometryTypes.push(type);
      }
    }
  },
  _removeAttribution: function () {
    var attribution = this.options.attribution;

    if (attribution && this._map.attributionControl) {
      this._map.attributionControl.removeAttribution(attribution);
    }
  },
  _toLeaflet: function (config) {
    // TODO: Support preset colors. Setup a "colorProperties" array that contains the name of the properties that can contain colors, then use those to pull in presets.
    // TODO: Support handlebars templates.
    var matchSimpleStyles = {
      'fill': 'fillColor',
      'fill-opacity': 'fillOpacity',
      'stroke': 'color',
      'stroke-opacity': 'opacity',
      'stroke-width': 'weight'
    };
    var configStyles;

    if (typeof config.clickable === 'undefined' || config.clickable === true) {
      var activeTip = null;
      var detectAvailablePopupSpace = true;
      var map = null;

      // TODO: If typeof config.onEachFeature === 'function', save it and call it.
      config.onEachFeature = function (feature, layer) {
        var clicks = 0;

        layer.on('click', function (e) {
          var target = e.target;

          if (!map) {
            map = target._map;

            if (typeof map.options.detectAvailablePopupSpace !== 'undefined' && map.options.detectAvailablePopupSpace === false) {
              detectAvailablePopupSpace = false;
            }
          }

          if (map._controllingInteractivity === 'map') {
            clicks = 0;

            setTimeout(function () {
              if (!clicks) {
                if (target._popup) {
                  target.openPopup();
                } else {
                  var container = map.getContainer();
                  var popup = L.npmap.popup({
                    autoPanPaddingTopLeft: util._getAutoPanPaddingTopLeft(container),
                    maxHeight: (detectAvailablePopupSpace ? util._getAvailableVerticalSpace(map) - 84 : null),
                    maxWidth: (detectAvailablePopupSpace ? util._getAvailableHorizontalSpace(map) - 77 : null)
                  });
                  var properties = feature.properties;
                  var html = popup._resultToHtml(properties, config.popup, null, null, map.options.popup);

                  if (html) {
                    if (typeof html === 'string') {
                      html = util.unescapeHtml(html);
                    }

                    if (feature.geometry.type === 'Point') {
                      popup.setContent(html);
                      target
                        .bindPopup(popup)
                        .openPopup();
                    } else {
                      popup
                        .setContent(html)
                        .setLatLng(e.latlng.wrap())
                        .openOn(target._map);
                    }
                  }
                }
              }
            }, 200);
          } else {
            map.fireEvent('click', e);
          }
        });
        layer.on('dblclick', function (e) {
          clicks++;
          e.containerPoint = e.target._map.latLngToContainerPoint(e.latlng);
          e.target._map.fireEvent('dblclick', e);
        });
        layer.on('mouseout', function (e) {
          if (activeTip) {
            var removeIndex = null;
            var tooltips = e.target._map._tooltips;

            for (var i = 0; i < tooltips.length; i++) {
              var obj = tooltips[i];

              if (activeTip.layerId === obj.layerId) {
                removeIndex = i;
                break;
              }
            }

            if (removeIndex !== null) {
              tooltips.splice(removeIndex, 1);
            }

            activeTip = null;
          }
        });
        layer.on('mouseover', function (e) {
          var tooltipConfig = config.tooltip;

          if (tooltipConfig) {
            var properties = feature.properties;
            var tip;

            if (typeof tooltipConfig === 'function') {
              tip = tooltipConfig(properties);
            } else if (typeof tooltipConfig === 'string') {
              tip = util.handlebars(tooltipConfig, properties);
            }

            if (tip) {
              var target = e.target;
              var obj = {
                html: tip,
                layerId: target._leaflet_id
              };

              target._map._tooltips.push(obj);
              activeTip = obj;
            }
          }
        });
      };
    }

    config.pointToLayer = function (feature, latLng) {
      // TODO: Support L.CircleMarker and L.Icon
      var configStyles;
      var icon = {
        'marker-color': '#000000',
        'marker-size': 'medium',
        'marker-library': 'maki',
        'marker-symbol': null
      };
      var properties = feature.properties;
      var property;
      var value;

      configStyles = typeof config.styles === 'function' ? config.styles(properties) : config.styles;

      if (!configStyles || !configStyles.point) {
        for (property in icon) {
          value = properties[property];

          if (value) {
            icon[property] = value;
          }
        }

        icon = L.npmap.icon[icon['marker-library']](icon);
      } else {
        configStyles = typeof configStyles.point === 'function' ? configStyles.point(properties) : configStyles.point;

        if (configStyles) {
          if (typeof configStyles.iconUrl === 'string') {
            icon = new L.Icon(configStyles);
          } else {
            for (property in icon) {
              value = configStyles[property];

              if (value) {
                icon[property] = value;
              }
            }

            if (!configStyles.ignoreFeatureStyles) {
              for (property in icon) {
                value = properties[property];

                if (value) {
                  icon[property] = value;
                }
              }
            }

            icon = L.npmap.icon[icon['marker-library']](icon);
          }
        } else {
          if (!configStyles.ignoreFeatureStyles) {
            for (property in icon) {
              value = properties[property];

              if (value) {
                icon[property] = value;
              }
            }
          }

          icon = L.npmap.icon[icon['marker-library']](icon);
        }
      }

      return new L.Marker(latLng, L.extend(config, {
        icon: icon,
        keyboard: false
      }));
    };
    config.style = function (feature) {
      var type = (function () {
        var t = feature.geometry.type.toLowerCase();

        if (t.indexOf('line') !== -1) {
          return 'line';
        } else if (t.indexOf('point') !== -1) {
          return 'point';
        } else if (t.indexOf('polygon') !== -1) {
          return 'polygon';
        }
      })();

      if (type !== 'point') {
        // TODO: Add support for passing Leaflet styles in.
        var count = 0;
        var style = {};
        var properties;
        var property;

        if (typeof feature.properties === 'object') {
          properties = feature.properties;
        } else {
          properties = {};
        }

        for (property in matchSimpleStyles) {
          if (typeof properties[property] !== 'undefined' && properties[property] !== null && properties[property] !== '') {
            style[matchSimpleStyles[property]] = properties[property];
          }
        }

        configStyles = typeof config.styles === 'function' ? config.styles(properties) : config.styles;

        if (configStyles) {
          configStyles = typeof configStyles[type] === 'function' ? configStyles[type](properties) : configStyles[type];

          if (configStyles) {
            for (property in matchSimpleStyles) {
              if (typeof configStyles[property] !== 'undefined' && configStyles[property] !== null && configStyles[property] !== '') {
                style[matchSimpleStyles[property]] = configStyles[property];
              }
            }
          }
        }

        for (property in style) {
          count++;
          break;
        }

        if (count) {
          return style;
        }
      }
    };

    return config;
  }
};

},{"../util/topojson":112,"../util/util":113}],99:[function(require,module,exports){
/* globals L */

var reqwest = require('reqwest');
var tileMath = require('../util/tilemath');

module.exports = {
  _cache: {},
  _getTileCoords: function (latLng) {
    var zoom = this._map.getZoom();

    return {
      x: tileMath.long2tile(latLng.lng, zoom),
      y: tileMath.lat2tile(latLng.lat, zoom),
      z: zoom
    };
  },
  _getTileGrid: function (url, latLng, callback) {
    if (this._cache[url]) {
      var response = this._cache[url];

      if (response === 'empty') {
        callback(null, null);
      } else {
        var tileGridPoint = this._getTileGridPoint(latLng, response);

        // TODO: Handle if tileGridPoint contains an error.

        if (response === 'loading') {
          callback('loading', tileGridPoint);
        } else {
          callback(response, tileGridPoint);
        }
      }
    } else {
      var me = this;

      me._cache[url] = 'loading';
      reqwest({
        crossOrigin: true,
        error: function () {
          me._cache[url] = 'empty';
          callback(null, null);
        },
        success: function (response) {
          if (response) {
            me._cache[url] = response;
            callback(response, me._getTileGridPoint(latLng, response));
          } else {
            me._cache[url] = 'empty';
            callback(null, null);
          }
        },
        timeout: 2000,
        type: 'json',
        url: url
      });
    }
  },
  _getTileGridPoint: function (latLng, response) {
    var map = this._map;

    // TODO: Handle if response.error exists.

    if (map && typeof response === 'object') {
      var point = map.project(latLng.wrap());
      var resolution = 4;
      var tileSize = 256;
      var max = map.options.crs.scale(map.getZoom()) / tileSize;

      return (response.data[response.keys[this._utfDecode(response.grid[Math.floor((point.y - (((Math.floor(point.y / tileSize) + max) % max) * tileSize)) / resolution)].charCodeAt(Math.floor((point.x - (((Math.floor(point.x / tileSize) + max) % max) * tileSize)) / resolution)))]]);
    }

    return null;
  },
  _getTileGridUrl: function (latLng) {
    var grids = this.options.grids;
    var gridTileCoords = this._getTileCoords(latLng);

    return L.Util.template(grids[Math.floor(Math.abs(gridTileCoords.x + gridTileCoords.y) % grids.length)], gridTileCoords);
  },
  _handleClick: function (latLng, callback) {
    this._getGridData(latLng, callback);
  },
  _handleMousemove: function (latLng, callback) {
    this._getGridData(latLng, callback);
  },
  _utfDecode: function (key) {
    if (key >= 93) {
      key--;
    }

    if (key >= 35) {
      key--;
    }

    return key - 32;
  }
};

},{"../util/tilemath":111,"reqwest":60}],100:[function(require,module,exports){
'use strict';

module.exports = {
  addTo: function (map) {
    this._map = map;
    return this;
  }
};

},{}],101:[function(require,module,exports){
/* globals L */

'use strict';

var geocode = require('../util/geocode');
var route = require('../util/route');
var util = require('../util/util');

require('../icon/maki');

var DirectionsModule = L.Class.extend({
  options: {
    visible: true
  },
  includes: [
    require('../mixin/module')
  ],
  initialize: function (options) {
    var buttonAddStop = document.createElement('button');
    var buttonClear = document.createElement('button');
    var buttonOptions = document.createElement('button');
    var div = document.createElement('div');
    var me = this;
    var p = document.createElement('p');

    L.Util.setOptions(this, options);
    p.innerHTML = 'Search for a location by address or name. Drag stops to reorder.';
    div.appendChild(p);
    this._ul = document.createElement('ul');
    div.appendChild(this._ul);
    this._actions = document.createElement('div');
    this._actions.className = 'actions';
    this._options = document.createElement('div');
    this._options.className = 'clearfix';
    buttonAddStop.className = buttonOptions.className = 'btn btn-link';
    buttonOptions.innerHTML = 'Options';
    L.DomEvent.addListener(buttonAddStop, 'click', function () {
      this._addLi();
    }, this);
    this._options.appendChild(buttonAddStop);
    this._options.appendChild(buttonOptions);
    this._actions.appendChild(this._options);
    this._buttonPrimary = document.createElement('button');
    this._buttonPrimary.className = 'btn btn-primary';
    this._buttonPrimary.innerHTML = buttonAddStop.innerHTML = 'Add Stop';
    L.DomEvent.addListener(this._buttonPrimary, 'click', function () {
      if (me._buttonPrimary.innerHTML === 'Add Stop') {
        var value = me._getFirstValue();

        me._ul.innerHTML = '';
        me._addLi(value);
        me._addLi();
      } else {
        // TODO: Route.
      }
    }, this);
    this._actions.appendChild(this._buttonPrimary);
    buttonClear.className = 'btn btn-link';
    buttonClear.innerHTML = 'clear';
    L.DomEvent.addListener(buttonClear, 'click', this._clear, this);
    this._actions.appendChild(buttonClear);
    div.appendChild(this._actions);
    this._directions = document.createElement('div');
    this._directions.className = 'directions';
    this._directions.style.display = 'none';
    div.appendChild(this._directions);
    this._disclaimer = document.createElement('p');
    this._disclaimer.className = 'disclaimer';
    this._disclaimer.innerHTML = 'DISCLAIMER: These directions are for planning purposes only. While the National Park Service strives to provide the most accurate information possible, please use caution when driving in unfamiliar locations and check directions against the content provided by each Park\'s website. The National Park Service assumes no responsibility for information provided by NPS partners.';
    div.appendChild(this._disclaimer);
    this.content = div;
    this.icon = 'car';
    this.title = this.type = 'Directions';
    this.visible = (options && options.visible) || false;
    this._addLiFirst();
    this._addDraggableListeners();

    return this;
  },
  _dragSource: null,
  _icon: {
    iconAnchor: [13.5, 37],
    iconRetinaUrl: window.L.Icon.Default.imagePath + '/module/directions/stop-{{letter}}@2x.png',
    iconSize: [27, 37],
    iconUrl: window.L.Icon.Default.imagePath + '/module/directions/stop-{{letter}}.png',
    popupAnchor: [0, -40]
  },
  _letters: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],
  _markers: [],
  _route: [],
  _styles: [{
    color: '#818171',
    opacity: 1,
    weight: 6
  }, {
    color: '#c16b2b',
    opacity: 1,
    weight: 4
  }],
  _addDraggableListeners: function () {
    for (var i = 0; i < this._ul.childNodes.length; i++) {
      var li = this._ul.childNodes[i];

      L.DomEvent
        .addListener(li, 'dragend', this._handleDragEnd, this)
        .addListener(li, 'dragenter', this._handleDragEnter, this)
        .addListener(li, 'dragleave', this._handleDragLeave, this)
        .addListener(li, 'dragover', this._handleDragOver, this)
        .addListener(li, 'dragstart', this._handleDragStart, this);
    }
  },
  _addLi: function (value, focus) {
    var backgroundImage = 'url(' + window.L.Icon.Default.imagePath + '/module/directions/times' + (L.Browser.retina ? '@2x' : '') + '.png)';
    var button = document.createElement('button');
    var div = document.createElement('div');
    var input = document.createElement('input');
    var label = document.createElement('label');
    var letter = this._letters[this._ul.childNodes.length];
    var li = document.createElement('li');
    var me = this;

    div.className = 'remove';
    label.htmlFor = 'stop-' + letter;
    label.innerHTML = letter;
    li.appendChild(label);
    li.draggable = true;
    input.id = 'stop-' + letter;
    input.onkeypress = function (e) {
      if (e.keyCode === 13 && input.value && input.value.length > 0) {
        geocode.esri(input.value, function (response) {
          if (response && response.results) {
            var result = response.results[0];

            if (result) {
              input.value = result.name;
              result.letter = letter;
              me._addMarker(result);

              if (me._markers.length > 1) {
                me.route();
              }
            }
          }
        });
      }
    };
    input.type = 'text';

    if (value) {
      input.value = value;
    }

    div.appendChild(input);
    button.className = 'ir remove';
    button.innerHTML = 'Remove stop';
    L.DomEvent
      .addListener(button, 'click', function () {
        var li = this.parentNode;
        var letter = li.childNodes[0].innerHTML;
        var refresh = false;
        var ul = li.parentNode;

        ul.removeChild(li);

        if (ul.childNodes.length === 0) {
          me._clear();
        } else {
          if (ul.childNodes.length === 1) {
            var value = me._getFirstValue();

            ul.innerHTML = '';
            me._addLiFirst(value);
          }

          for (var i = 0; i < me._markers.length; i++) {
            var marker = me._markers[i];

            if (marker._letter === letter) {
              refresh = true;
              me._map.removeLayer(marker);
              me._markers.splice(i, 1);
              break;
            }
          }

          if (refresh) {
            me._clearRoute();

            if (me._markers.length > 1) {
              me.route();
            }
          }

          me._refreshLetters();
        }
      })
      .addListener(button, 'onmouseout', function () {
        this.style.backgroundImage = backgroundImage;
      })
      .addListener(button, 'onmouseover', function () {
        this.style.backgroundImage = 'url(' + window.L.Icon.Default.imagePath + '/module/directions/times-over' + (L.Browser.retina ? '@2x' : '') + '.png)';
      });
    button.style.backgroundImage = backgroundImage;
    li.appendChild(div);
    li.appendChild(button);
    this._ul.appendChild(li);
    this._options.style.display = 'block';
    this._buttonPrimary.innerHTML = 'Get Directions';

    if (focus) {
      input.focus();
    }
  },
  _addLiFirst: function (value) {
    var button = document.createElement('button');
    var divLi = document.createElement('div');
    var input = document.createElement('input');
    var label = document.createElement('label');
    var li = document.createElement('li');
    var me = this;

    label.htmlFor = 'stop-A';
    label.innerHTML = 'A';
    li.appendChild(label);
    input.className = 'search';
    input.id = 'stop-A';
    input.type = 'text';
    input.onkeypress = function (e) {
      if (e.keyCode === 13 && input.value && input.value.length > 0) {
        geocode.esri(input.value, function (response) {
          if (response && response.results) {
            var result = response.results[0];

            if (result) {
              result.letter = 'A';
              me._ul.innerHTML = '';
              me._addLi(result.name);
              me._addLi(null, true);
              me._addMarker(result);
            }
          }
        });
      }
    };
    divLi.appendChild(input);
    button.className = 'search ir';
    button.innerHTML = 'Search for a location';
    button.style.backgroundImage = 'url(' + window.L.Icon.Default.imagePath + '/font-awesome/search' + (L.Browser.retina ? '@2x' : '') + '.png)';
    L.DomEvent.addListener(button, 'click', function () {
      if (input.value && input.value.length > 0) {
        me._geocode(input);
      }
    });
    divLi.appendChild(button);
    li.appendChild(divLi);
    li.draggable = true;
    this._ul.appendChild(li);
    this._options.style.display = 'none';
    this._buttonPrimary.innerHTML = 'Add Stop';

    if (value) {
      input.value = value;
    }
  },
  _addMarker: function (result) {
    var icon = L.extend({}, this._icon);
    var latLng = result.latLng;
    var letter = result.letter;
    var marker;

    L.extend(icon, {
      iconRetinaUrl: util.handlebars(icon.iconRetinaUrl, {
        letter: letter
      }),
      iconUrl: util.handlebars(icon.iconUrl, {
        letter: letter
      })
    });
    marker = new L.Marker({
      lat: latLng[0],
      lng: latLng[1]
    }, {
      icon: new L.Icon(icon)
    });
    marker._letter = letter;
    marker._name = result.name;
    this._markers.push(marker.bindPopup('<div class="title">' + result.name + '</div>').addTo(this._map));
  },
  _clear: function () {
    this._directions.innerHTML = '';
    this._directions.style.display = 'none';
    this._ul.innerHTML = '';
    this._addLiFirst();

    for (var i = 0; i < this._markers.length; i++) {
      this._map.removeLayer(this._markers[i]);
    }

    this._clearRoute();
  },
  _clearRoute: function () {
    if (this._route.length) {
      for (var i = 0; i < this._route.length; i++) {
        this._map.removeLayer(this._route[i]);
      }

      this._directions.innerHTML = '';
      this._directions.style.display = 'none';
      this._route = [];
    }
  },
  _formatDistance: function (meters) {
    var distance = Math.round(meters / 1609.344) / 10;

    if (distance === 0) {
      return Math.round(meters * 3.28084) + ' ft';
    } else {
      return distance + ' mi';
    }
  },
  _getFirstValue: function () {
    return this._ul.childNodes[0].childNodes[1].childNodes[0].value || null;
  },
  _handleDragEnd: function (e) {
    e.target.style.opacity = '1';
  },
  _handleDragEnter: function (e) {
    e.target.classList.add('over');
  },
  _handleDragLeave: function (e) {
    e.target.classList.remove('over');
  },
  _handleDrop: function (e) {
    var target = e.target;

    if (e.stopPropagation) {
      e.stopPropagation();
    }

    if (target._dragSource != target) {
      target._dragSource.innerHTML = target.innerHTML;
      target.innerHTML = e.dataTransfer.getData('text/html');
    }

    return false;
  },
  _handleDragOver: function (e) {
    if (e.preventDefault) {
      e.preventDefault();
    }

    e.dataTransfer.dropEffect = 'move';

    return false;
  },
  _handleDragStart: function (e) {
    var target = e.target;

    target.style.opacity = '0.4';
    target._dragSource = target;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', target.innerHTML);
  },
  _refreshLetters: function () {
    for (var i = 0; i < this._ul.childNodes.length; i++) {
      var childNodes = this._ul.childNodes[i].childNodes;
      var icon = L.extend({}, this._icon);
      var label = childNodes[0];
      var letter = this._letters[i];
      var marker = this._markers[i];
      var id = 'stop-' + letter;

      label.htmlFor = id;
      label.innerHTML = letter;
      childNodes[1].childNodes[0].id = id;

      if (marker) {
        marker._letter = letter;
        L.extend(icon, {
          iconRetinaUrl: util.handlebars(icon.iconRetinaUrl, {
            letter: letter
          }),
          iconUrl: util.handlebars(icon.iconUrl, {
            letter: letter
          })
        });
        marker.setIcon(new L.Icon(icon));
      }
    }
  },
  route: function () {
    var latLngs = [];
    var me = this;

    for (var i = 0; i < me._markers.length; i++) {
      latLngs.push(me._markers[i].getLatLng());
    }

    route.mapbox.route(latLngs, function (route) {
      if (route && route.routes && route.routes.length) {
        var first = route.routes[0];
        var steps = first.steps;
        var html = '<div class="maneuver-header"><h2>Driving Directions to ' + me._markers[me._markers.length - 1]._name + '</h2><span class="info">ROUTE: ' + Math.round(first.distance / 1609.344) + ' MI, ' + Math.round(first.duration / 60) + ' MIN </span><h3 class="location"><span class="identifier">A</span><span class="name">' + me._markers[0]._name + '</span></h3></div><ol class="maneuvers">';
        var i;

        for (i = 0; i < me._styles.length; i++) {
          var line = new L.GeoJSON({
            geometry: route.routes[0].geometry,
            properties: {},
            type: 'Feature'
          }, L.extend({
            clickable: false
          }, me._styles[i]));

          me._route.push(line);
          line.addTo(me._map);
        }

        for (i = 0; i < steps.length; i++) {
          var step = steps[i];

          html += '<li>' + step.maneuver.instruction + (typeof step.distance === 'undefined' ? '' : '<span class="distance">' + me._formatDistance(step.distance) + '</span>') + '</li>';
        }

        me._directions.innerHTML = html + '</ol><div class="maneuver-footer"><h3 class="location"><span class="identifier">B</span><span class="name">' + me._markers[me._markers.length - 1]._name + '</span></h3></div>';
        me._directions.style.display = 'block';

        me._map.fitBounds(me._route[0].getBounds(), {
          paddingBottomRight: [15, 0],
          paddingTopLeft: [15, 30]
        });
      }
    });
  }
});

module.exports = function (options) {
  return new DirectionsModule(options);
};

},{"../icon/maki":80,"../mixin/module":100,"../util/geocode":108,"../util/route":110,"../util/util":113}],102:[function(require,module,exports){
/* global L */
/* jshint camelcase: false */

'use strict';

var util = require('./util/util');

var Popup = L.Popup.extend({
  options: {
    autoPanPadding: null,
    autoPanPaddingBottomRight: [20, 20],
    autoPanPaddingTopLeft: [20, 20],
    maxWidth: null,
    minWidth: 250,
    offset: [0, -1]
  },
  _data: [],
  _html: null,
  _results: [],
  initialize: function (options) {
    L.Util.setOptions(this, options);
    L.Popup.prototype.initialize.call(this, this.options);
  },
  onAdd: function (map) {
    if (window.addEventListener) {
      this._content.addEventListener('DOMMouseScroll', this._handleMouseWheel, false);
    }

    this._content.onmousewheel = this._handleMouseWheel;
    L.Popup.prototype.onAdd.apply(this, [
      map
    ]);
  },
  setContent: function (content) {
    if (typeof content === 'string') {
      var node = document.createElement('div');
      node.innerHTML = content;
      content = node;
    }

    if (typeof this.options.maxWidth === 'number') {
      content.style.maxWidth = this.options.maxWidth + 'px';
    }

    if (typeof this.options.minWidth === 'number') {
      content.style.minWidth = this.options.minWidth + 'px';
    }

    L.Popup.prototype.setContent.call(this, content);
    return this;
  },
  _back: function () {
    this.setContent(this._html).update();
    this._html = null;
  },
  _createAction: function (config, data, div) {
    var a = document.createElement('a');
    var li = document.createElement('li');

    li.appendChild(a);
    a.innerHTML = util.handlebars(config.text, data);

    if (config.menu) {
      var menu = L.DomUtil.create('ul', 'menu', div);

      for (var i = 0; i < config.menu.length; i++) {
        (function () {
          var item = config.menu[i];
          var itemA = document.createElement('a');
          var itemLi = document.createElement('li');

          itemA.innerHTML = util.handlebars(item.text, data);
          L.DomEvent.addListener(itemA, 'click', function () {
            var data = null;

            try {
              data = this.parentNode.parentNode.parentNode.parentNode.npmap_data;
            } catch (exception) {}

            menu.style.display = 'none';
            item.handler(data);
          });
          itemLi.appendChild(itemA);
          menu.appendChild(itemLi);
        })();
      }

      L.DomEvent.addListener(a, 'click', function (e) {
        this._toggleMenu(menu, e);
      }, this);
    } else if (config.handler) {
      L.DomEvent.addListener(a, 'click', function () {
        var data = null;

        try {
          data = this.parentNode.parentNode.parentNode.parentNode.npmap_data;
        } catch (exception) {}

        config.handler(data);
      });
    }

    return li;
  },
  _handleMouseWheel: function (e) {
    if (e) {
      var delta = e.wheelDelta;
      var parentNode = this.parentNode;

      if (L.DomUtil.hasClass(parentNode, 'leaflet-popup-scrolled')) {
        if (parentNode.scrollTop === 0 && delta > 0) {
          util.cancelEvent();
        } else if ((parentNode.scrollTop === parentNode.scrollHeight - util.getOuterDimensions(parentNode).height) && delta < 0) {
          util.cancelEvent();
        }
      }
    }
  },
  _handleResults: function (results, mapPopupConfig) {
    var div;

    function getLayerConfig (layer) {
      if (layer.options && layer.options.popup) {
        return layer.options.popup;
      } else {
        return null;
      }
    }

    if (mapPopupConfig && typeof mapPopupConfig === 'function') {
      var html = mapPopupConfig(results);

      div = document.createElement('div');

      if (typeof html === 'string') {
        div.innerHTML = html;
      } else {
        div = html;
      }
    } else {
      if (results.length > 1) {
        div = this._resultsToHtml(results);
      } else {
        var all = [];
        var result = results[0];
        var theseResults = result.results;
        var i;

        if (theseResults && theseResults.length) {
          for (i = 0; i < theseResults.length; i++) {
            all.push({
              layerConfig: getLayerConfig(result.layer),
              result: theseResults[i],
              resultConfig: null
            });
          }
        } else if (result.subLayers && result.subLayers.length) {
          for (i = 0; i < result.subLayers.length; i++) {
            var subLayer = result.subLayers[i];

            if (subLayer.results && subLayer.results.length) {
              for (var j = 0; j < subLayer.results.length; j++) {
                all.push({
                  layerConfig: getLayerConfig(result.layer),
                  result: subLayer.results[j],
                  resultConfig: subLayer.popup || null
                });
              }
            }
          }
        }

        if (all.length === 1) {
          var first = all[0];

          div = this._resultToHtml(first.result, first.layerConfig, first.resultConfig);
        } else {
          div = this._resultsToHtml(results);
        }
      }
    }

    return div;
  },
  _more: function (index) {
    this._html = this.getContent();
    this.setContent(this._results[index]).update();
  },
  _resultToHtml: function (result, layerConfig, resultConfig, addBack, mapConfig) {
    var div;

    if (mapConfig && typeof mapConfig === 'function') {
      var html = mapConfig(result);

      div = document.createElement('div');

      if (typeof html === 'string') {
        div.innerHTML = html;
      } else {
        div = html;
      }

      return div;
    } else if (layerConfig && typeof layerConfig === 'function') {
      div = L.DomUtil.create('div', 'layer');
      div.innerHTML = layerConfig(result);
      div.npmap_data = result;
      return div;
    } else {
      var config = layerConfig;
      var actions;
      var description;
      var divContent;
      var media;
      var obj;
      var title;
      var ul;

      div = L.DomUtil.create('div', 'layer');
      div.npmap_data = result;

      if (!config) {
        if (resultConfig) {
          config = resultConfig;
        } else {
          config = {
            description: {
              format: 'table'
            }
          };
        }
      }

      // TODO: Wrap title in an h3 (I believe?) with a zIndex of -1 and give it focus when popup is shown.

      if (config.title) {
        obj = null;

        if (typeof config.title === 'function') {
          obj = config.title(result);
        } else {
          obj = config.title;
        }

        if (obj && typeof obj === 'string') {
          title = L.DomUtil.create('div', 'title', div);
          title.innerHTML = util.unescapeHtml(util.handlebars(obj, result));
        }
      }

      if (config.description) {
        divContent = L.DomUtil.create('div', 'content', div);
        obj = null;

        if (typeof config.description === 'function') {
          obj = config.description(result);
        } else {
          obj = config.description;
        }

        if (obj) {
          if (obj.format === 'list') {
            obj = util.dataToList(result, obj.fields);
          } else if (obj.format === 'table') {
            obj = util.dataToTable(result, obj.fields);
          }

          description = L.DomUtil.create('div', 'description', divContent);

          if (typeof obj === 'string') {
            description.innerHTML = util.unescapeHtml(util.handlebars(obj, result));
          } else if ('nodeType' in obj) {
            description.appendChild(obj);
          }
        }
      }

      if (config.media) {
        media = [];

        for (var i = 0; i < config.media.length; i++) {
          if (result[config.media[i].id.replace('{{', '').replace('}}', '')]) {
            media.push(config.media[i]);
          }
        }

        if (media.length) {
          var mediaDiv = util.mediaToList(result, media);

          if (mediaDiv) {
            if (!divContent) {
              divContent = L.DomUtil.create('div', 'content', div);
            }

            mediaDiv.className = 'clearfix media';
            divContent.appendChild(mediaDiv);
          }
        }
      }

      if (config.actions) {
        obj = null;

        if (typeof config.actions === 'function') {
          obj = config.actions(result);
        } else {
          obj = config.actions;
        }

        if (obj) {
          actions = L.DomUtil.create('div', 'actions', div);

          if (L.Util.isArray(obj)) {
            ul = document.createElement('ul');
            actions.appendChild(ul);

            for (var j = 0; j < obj.length; j++) {
              ul.appendChild(this._createAction(obj[j], result, actions));
            }
          } else if (typeof obj === 'string') {
            actions.innerHTML = util.unescapeHtml(util.handlebars(obj, result));
          } else if ('nodeType' in obj) {
            actions.appendChild(obj);
          }
        }
      }

      if (addBack) {
        var a = document.createElement('a');
        var li = document.createElement('li');

        L.DomEvent.addListener(a, 'click', this._back, this);
        a.innerHTML = '&#171; Back';
        li.appendChild(a);

        if (actions) {
          actions.childNodes[0].insertBefore(li, actions.childNodes[0].childNodes[0]);
        } else {
          ul = document.createElement('ul');
          ul.appendChild(li);
          L.DomUtil.create('div', 'actions', div).appendChild(ul);
        }
      }

      return div;
    }
  },
  _resultsToHtml: function (results) {
    var div = document.createElement('div');
    var index = 0;
    var me = this;

    function listener () {
      me._more(this.id);
    }

    for (var i = 0; i < results.length; i++) {
      var divLayer = L.DomUtil.create('div', 'layer', div);
      var divLayerTitle = L.DomUtil.create('div', 'title', divLayer);
      var resultLayer = results[i];
      var a;
      var childNode;
      var divLayerContent;
      var j;
      var k;
      var layerConfig;
      var li;
      var more;
      var resultConfig;
      var single;
      var ul;

      if (resultLayer.layer.options) {
        if (resultLayer.layer.options.popup) {
          layerConfig = resultLayer.layer.options.popup;
        }

        if (resultLayer.layer.options.name) {
          divLayerTitle.innerHTML = resultLayer.layer.options.name;
        } else {
          divLayerTitle.innerHTML = 'Unnamed';
        }
      }

      if (resultLayer.results && resultLayer.results.length) {
        divLayerContent = L.DomUtil.create('div', 'content', divLayer);
        ul = document.createElement('ul');

        for (j = 0; j < resultLayer.results.length; j++) {
          var result = resultLayer.results[j];

          a = document.createElement('a');
          li = document.createElement('li');
          single = this._resultToHtml(result, layerConfig, resultConfig, true);

          for (k = 0; k < single.childNodes.length; k++) {
            childNode = single.childNodes[k];

            if (L.DomUtil.hasClass(childNode, 'title')) {
              more = util.stripHtml(childNode.innerHTML);
              break;
            }
          }

          if (!more) {
            more = 'Untitled';
          }

          L.DomEvent.addListener(a, 'click', function () {
            me._more(this.id);
          });
          this._results[index] = single;
          a.id = index;
          a.innerHTML = more;
          li.appendChild(a);
          ul.appendChild(li);
          divLayerContent.appendChild(ul);
          index++;
        }
      } else if (resultLayer.subLayers && resultLayer.subLayers.length) {
        divLayerContent = L.DomUtil.create('div', 'content', divLayer);

        for (j = 0; j < resultLayer.subLayers.length; j++) {
          var divSubLayer = L.DomUtil.create('div', 'sublayer', divLayerContent);
          var divSubLayerTitle = L.DomUtil.create('div', 'title', divSubLayer);
          var divSubLayerContent = L.DomUtil.create('div', 'content', divSubLayer);
          var resultSubLayer = resultLayer.subLayers[j];

          divSubLayerTitle.innerHTML = resultSubLayer.name;
          ul = document.createElement('ul');
          divSubLayerContent.appendChild(ul);

          for (k = 0; k < resultSubLayer.results.length; k++) {
            var resultFinal = resultSubLayer.results[k];

            if (resultSubLayer.popup) {
              resultConfig = resultSubLayer.popup;
            }

            a = document.createElement('a');
            li = document.createElement('li');
            single = this._resultToHtml(resultFinal, layerConfig, resultConfig, true);

            for (var l = 0; l < single.childNodes.length; l++) {
              childNode = single.childNodes[l];

              if (L.DomUtil.hasClass(childNode, 'title')) {
                more = util.stripHtml(childNode.innerHTML);
                break;
              }
            }

            if (!more) {
              more = 'Untitled';
            }

            L.DomEvent.addListener(a, 'click', listener);
            this._results[index] = single;
            a.id = index;
            a.innerHTML = more;
            li.appendChild(a);
            ul.appendChild(li);
            index++;
          }
        }
      }
    }

    return div;
  },
  _toggleMenu: function (menu, e) {
    if (!menu.style.display || menu.style.display === 'none') {
      var to = e.toElement;

      menu.style.bottom = '0';
      menu.style.display = 'block';
      menu.style.left = to.offsetLeft + 'px';
    } else {
      menu.style.display = 'none';
    }
  }
});

module.exports = function (options) {
  return new Popup(options);
};

},{"./util/util":113}],103:[function(require,module,exports){
module.exports={
  "bing": {
    "aerial": {
      "icon": "aerial",
      "layer": "aerial",
      "maxZoom": 19,
      "minZoom": 0,
      "name": "Bing Aerial",
      "type": "bing"
    },
    "aerialLabels": {
      "icon": "aerial",
      "layer": "aerialwithlabels",
      "maxZoom": 19,
      "minZoom": 0,
      "name": "Bing Hybrid",
      "type": "bing"
    },
    "roads": {
      "icon": "street",
      "layer": "road",
      "maxZoom": 19,
      "minZoom": 0,
      "name": "Bing Roads",
      "type": "bing"
    }
  },
  "cartodb": {
    "darkMatter": {
      "attribution": "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors, &copy; <a href='https://cartodb.com/attributions'>CartoDB</a>",
      "icon": "street",
      "name": "CartoDB Dark Matter",
      "retinaId": "@2x",
      "type": "tiled",
      "url": "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}{{retina}}.png"
    },
    "darkMatterNoLabels": {
      "attribution": "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors, &copy; <a href='https://cartodb.com/attributions'>CartoDB</a>",
      "icon": "street",
      "name": "CartoDB Dark Matter (No Labels)",
      "retinaId": "@2x",
      "type": "tiled",
      "url": "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_nolabels/{z}/{x}/{y}{{retina}}.png"
    },
    "positron": {
      "attribution": "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors, &copy; <a href='https://cartodb.com/attributions'>CartoDB</a>",
      "icon": "street",
      "name": "CartoDB Positron",
      "retinaId": "@2x",
      "type": "tiled",
      "url": "https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}{{retina}}.png"
    },
    "positronNoLabels": {
      "attribution": "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors, &copy; <a href='https://cartodb.com/attributions'>CartoDB</a>",
      "icon": "street",
      "name": "CartoDB Positron (No Labels)",
      "retinaId": "@2x",
      "type": "tiled",
      "url": "https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}{{retina}}.png"
    }
  },
  "esri": {
    "gray": {
      "attribution": "Copyright: &copy;2013 Esri, DeLorme, NAVTEQ",
      "maxZoom": 16,
      "minZoom": 1,
      "name": "Esri Light Gray",
      "tiled": true,
      "type": "arcgisserver",
      "url": "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer"
    },
    "imagery": {
      "attribution": "Esri, DigitalGlobe, GeoEye, i-cubed, USDA, USGS, AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community",
      "icon": "aerial",
      "maxZoom": 19,
      "minZoom": 1,
      "name": "Esri Imagery",
      "popup": false,
      "tiled": true,
      "type": "arcgisserver",
      "url": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer"
    },
    "nationalGeographic": {
      "attribution": "Esri",
      "maxZoom": 16,
      "minZoom": 1,
      "name": "Esri National Geographic",
      "popup": false,
      "tiled": true,
      "type": "arcgisserver",
      "url": "https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer"
    },
    "oceans": {
      "attribution": "Esri",
      "maxZoom": 16,
      "minZoom": 1,
      "name": "Esri Oceans",
      "tiled": true,
      "type": "arcgisserver",
      "url": "https://services.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Base/MapServer"
    },
    "shadedRelief": {
      "attribution": "Esri, USGS",
      "icon": "topo",
      "maxZoom": 13,
      "minZoom": 1,
      "name": "Esri Shaded Relief",
      "popup": false,
      "tiled": true,
      "type": "arcgisserver",
      "url": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer"
    },
    "streets": {
      "attribution": "Esri",
      "dynamicAttribution": "https://static.arcgis.com/attribution/World_Street_Map?f=json",
      "icon": "street",
      "maxZoom": 19,
      "minZoom": 1,
      "name": "Esri Streets",
      "tiled": true,
      "type": "arcgisserver",
      "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer"
    },
    "terrain": {
      "attribution": "Esri, NOAA, USGS",
      "icon": "topo",
      "maxZoom": 17,
      "minZoom": 1,
      "name": "Esri Terrain",
      "popup": false,
      "tiled": true,
      "type": "arcgisserver",
      "url": "https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer"
    },
    "topographic": {
      "attribution": "Esri",
      "dynamicAttribution": "https://static.arcgis.com/attribution/World_Street_Map?f=json",
      "icon": "topo",
      "maxZoom": 17,
      "minZoom": 1,
      "name": "Esri Topo",
      "popup": false,
      "tiled": true,
      "type": "arcgisserver",
      "url": "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer"
    }
  },
  "mapbox": {
    "dark": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "street",
      "id": "mapbox.dark",
      "name": "Mapbox Dark",
      "type": "mapbox"
    },
    "emerald": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "street",
      "id": "mapbox.emerald",
      "name": "Mapbox Emerald",
      "type": "mapbox"
    },
    "highContrast": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "street",
      "id": "mapbox.high-contrast",
      "name": "Mapbox High Contrast",
      "type": "mapbox"
    },
    "landsatLive": {
      "attribution": "Imagery courtesy <a href='http://landsat.usgs.gov/' target='_blank'>USGS</a>",
      "icon": "aerial",
      "id": "mapbox.landsat-live-32",
      "maxZoom": 12,
      "minZoom": 7,
      "name": "Mapbox Landsat Live",
      "type": "mapbox"
    },
    "light": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "street",
      "id": "mapbox.light",
      "name": "Mapbox Light",
      "type": "mapbox"
    },
    "outdoors": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "topo",
      "id": "mapbox.outdoors",
      "name": "Mapbox Outdoors",
      "type": "mapbox"
    },
    "pencil": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "street",
      "id": "mapbox.pencil",
      "name": "Mapbox Pencil",
      "type": "mapbox"
    },
    "runBikeAndHike": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "topo",
      "id": "mapbox.run-bike-hike",
      "name": "Mapbox Run, Bike, and Hike",
      "type": "mapbox"
    },
    "satellite": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a>",
      "icon": "aerial",
      "id": "mapbox.satellite",
      "maxNativeZoom": 18,
      "name": "Mapbox Satellite",
      "type": "mapbox"
    },
    "satelliteLabels": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "aerial",
      "id": "mapbox.streets-satellite",
      "maxNativeZoom": 18,
      "name": "Mapbox Hybrid",
      "type": "mapbox"
    },
    "streets": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "street",
      "id": "mapbox.streets-basic",
      "name": "Mapbox Streets",
      "type": "mapbox"
    },
    "terrain": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "topo",
      "id": "mapbox.streets",
      "name": "Mapbox Terrain",
      "type": "mapbox"
    }
  },
  "nps": {
    "darkStreets": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "nps",
      "id": "nps.68926899",
      "lightOrDark": "dark",
      "name": "Park Tiles Slate",
      "type": "mapbox"
    },
    "lightStreets": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "nps",
      "id": "nps.g9ndno9j",
      "lightOrDark": "light",
      "name": "NPS Light",
      "type": "mapbox"
    },
    "neutralTerrain": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "nps",
      "id": "nps.g9nccg3d",
      "lightOrDark": "light",
      "name": "NPS Neutral Terrain",
      "type": "mapbox"
    },
    "parkTiles3": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors | <a class='improve-park-tiles' href='https://www.nps.gov/npmap/tools/park-tiles/improve/' target='_blank'>Improve Park Tiles</a>",
      "clickable": false,
      "icon": "nps",
      "id": "nps.397cfb9a,nps.3cf3d4ab,nps.b0add3e6",
      "lightOrDark": "light",
      "name": "Park Tiles 3",
      "type": "mapbox"
    },
    "parkTiles3Imagery": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors | <a class='improve-park-tiles' href='https://www.nps.gov/npmap/tools/park-tiles/improve/' target='_blank'>Improve Park Tiles</a>",
      "clickable": false,
      "icon": "nps",
      "id": "nps.2c589204,nps.25abf75b,nps.7531d30a",
      "lightOrDark": "dark",
      "name": "Park Tiles 3 Imagery",
      "type": "mapbox"
    },
    "parkTiles3Light": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors | <a class='improve-park-tiles' href='https://www.nps.gov/npmap/tools/park-tiles/improve/' target='_blank'>Improve Park Tiles</a>",
      "clickable": false,
      "icon": "nps",
      "id": "nps.1ee61ddf,nps.7f508801,nps.5748cf33",
      "lightOrDark": "light",
      "name": "Park Tiles 3 Light",
      "type": "mapbox"
    },
    "parkTiles3Slate": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors | <a class='improve-park-tiles' href='https://www.nps.gov/npmap/tools/park-tiles/improve/' target='_blank'>Improve Park Tiles</a>",
      "clickable": false,
      "icon": "nps",
      "id": "nps.9e521899,nps.17f575d9,nps.e091bdaf",
      "lightOrDark": "dark",
      "name": "Park Tiles 3 Slate",
      "type": "mapbox"
    },
    "parkTiles": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors | <a class='improve-park-tiles' href='https://www.nps.gov/npmap/tools/park-tiles/improve/' target='_blank'>Improve Park Tiles</a>",
      "icon": "nps",
      "id": "nps.2yxv8n84",
      "lightOrDark": "light",
      "name": "Park Tiles",
      "type": "mapbox"
    },
    "parkTilesImagery": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors | <a class='improve-park-tiles' href='https://www.nps.gov/npmap/tools/park-tiles/improve/' target='_blank'>Improve Park Tiles</a>",
      "icon": "nps",
      "id": "mapbox.satellite,nps.gdipreks",
      "lightOrDark": "dark",
      "name": "Park Tiles Imagery",
      "type": "mapbox"
    },
    "parkTilesSlate": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "nps",
      "id": "nps.68926899",
      "lightOrDark": "dark",
      "name": "Park Tiles Slate",
      "type": "mapbox"
    },
    "satelliteNight": {
      "attribution": "&copy; <a href='https://www.mapbox.com/about/maps/' target='_blank'>Mapbox</a> &copy; <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors",
      "icon": "nps",
      "id": "nps.g9o0im10",
      "lightOrDark": "dark",
      "name": "NPS Satellite at Night",
      "type": "mapbox"
    }
  },
  "openstreetmap": {
    "attribution": "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors",
    "icon": "street",
    "name": "OpenStreetMap",
    "type": "tiled",
    "url": "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  },
  "stamen": {
    "terrain": {
      "attribution": "Map tiles by <a href='http://stamen.com'>Stamen Design</a>, under <a href='https://creativecommons.org/licenses/by/3.0/'>CC BY 3.0</a>. Data &copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors.",
      "icon": "topo",
      "maxZoom": 18,
      "minZoom": 0,
      "name": "Stamen Terrain",
      "subdomains": "abcd",
      "type": "tiled",
      "url": "https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg"
    },
    "toner": {
      "attribution": "Map tiles by <a href='http://stamen.com'>Stamen Design</a>, under <a href='https://creativecommons.org/licenses/by/3.0/'>CC BY 3.0</a>. Data &copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors.",
      "icon": "street",
      "maxZoom": 20,
      "minZoom": 0,
      "name": "Stamen Toner",
      "subdomains": "abcd",
      "type": "tiled",
      "url": "https://stamen-tiles-{s}.a.ssl.fastly.net/toner/{z}/{x}/{y}.png"
    },
    "watercolor": {
      "attribution": "Map tiles by <a href='http://stamen.com'>Stamen Design</a>, under <a href='https://creativecommons.org/licenses/by/3.0/'>CC BY 3.0</a>. Data &copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors.",
      "maxZoom": 16,
      "minZoom": 3,
      "name": "Stamen Watercolor",
      "subdomains": "abcd",
      "type": "tiled",
      "url": "https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.jpg"
    }
  }
}

},{}],104:[function(require,module,exports){
module.exports={
  "marigold": {
    "color": "#fff4ad",
    "colorBlind": true,
    "fill": true,
    "fillColor": "#fff4ad",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "daisy": {
    "color": "#ddcc77",
    "colorBlind": true,
    "fill": true,
    "fillColor": "#ddcc77",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "mustard": {
    "color": "#d98d38",
    "fill": true,
    "fillColor": "#d98d38",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "gold": {
    "color": "#d39800",
    "fill": true,
    "fillColor": "#d39800",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "chesnut": {
    "color": "#bf815d",
    "fill": true,
    "fillColor": "#bf815d",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "clementine": {
    "color": "#d95f02",
    "fill": true,
    "fillColor": "#d95f02",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "salmon": {
    "color": "#fa946e",
    "fill": true,
    "fillColor": "#fa946e",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "rose": {
    "color": "#d46655",
    "fill": true,
    "fillColor": "#d46655",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "coral": {
    "color": "#cc6677",
    "colorBlind": true,
    "fill": true,
    "fillColor": "#cc6677",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "berry": {
    "color": "#aa4499",
    "colorBlind": true,
    "fill": true,
    "fillColor": "#aa4499",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "scarlet": {
    "color": "#882255",
    "colorBlind": true,
    "fill": true,
    "fillColor": "#882255",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "lilac": {
    "color": "#896c9c",
    "fill": true,
    "fillColor": "#896c9c",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "violet": {
    "color": "#7570b3",
    "fill": true,
    "fillColor": "#7570b3",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "currant": {
    "color": "#5f3663",
    "fill": true,
    "fillColor": "#5f3663",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "breeze": {
    "color": "#88ccee",
    "colorBlind": true,
    "fill": true,
    "fillColor": "#88ccee",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "chill": {
    "color": "#1b99aa",
    "fill": true,
    "fillColor": "#1b99aa",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "steele": {
    "color": "#32557d",
    "fill": true,
    "fillColor": "#32557d",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "sapphire": {
    "color": "#332288",
    "colorBlind": true,
    "fill": true,
    "fillColor": "#332288",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "turquoise": {
    "color": "#44aa99",
    "colorBlind": true,
    "fill": true,
    "fillColor": "#44aa99",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "meadow": {
    "color": "#1b9e77",
    "fill": true,
    "fillColor": "#1b9e77",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "eucalyptus": {
    "color": "#558877",
    "fill": true,
    "fillColor": "#558877",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "sycamore": {
    "color": "#999933",
    "colorBlind": true,
    "fill": true,
    "fillColor": "#999933",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "emerald": {
    "color": "#117733",
    "colorBlind": true,
    "fill": true,
    "fillColor": "#117733",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "russett": {
    "color": "#7a4810",
    "fill": true,
    "fillColor": "#7a4810",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "sand": {
    "color": "#8f7657",
    "fill": true,
    "fillColor": "#8f7657",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "nickel": {
    "color": "#6c6c6c",
    "fill": true,
    "fillColor": "#6c6c6c",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "night": {
    "color": "#1f1f1f",
    "colorBlind": true,
    "fill": true,
    "fillColor": "#1f1f1f",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  },
  "white": {
    "color": "#ffffff",
    "colorBlind": true,
    "fill": true,
    "fillColor": "#ffffff",
    "fillOpacity": 0.2,
    "opacity": 0.5,
    "stroke": true,
    "weight": 3
  }
}

},{}],105:[function(require,module,exports){
module.exports={
  "esri": {
    "grayLabels": {
      "attribution": "Copyright: &copy;2013 Esri, DeLorme, NAVTEQ",
      "maxZoom": 16,
      "minZoom": 1,
      "name": "Esri Light Gray Labels",
      "tiled": true,
      "type": "arcgisserver",
      "url": "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer"
    },
    "imageryLabels": {
      "attribution": "Esri, DigitalGlobe, GeoEye, i-cubed, USDA, USGS, AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community",
      "maxZoom": 19,
      "minZoom": 1,
      "popup": false,
      "name": "Esri Boundaries & Places",
      "tiled": true,
      "type": "arcgisserver",
      "url": "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer"
    },
    "oceansLabels": {
      "attribution": "Esri",
      "maxZoom": 16,
      "minZoom": 1,
      "name": "Esri Ocean Labels",
      "tiled": true,
      "type": "arcgisserver",
      "url": "https://services.arcgisonline.com/arcgis/rest/services/Ocean/World_Ocean_Reference/MapServer"
    }
  },
  "nps": {
    "places": {
      "buildings": {
        "name": "Buildings",
        "table": "buildings",
        "type": "cartodb",
        "user": "nps"
      },
      "parkingLots": {
        "name": "Parking Lots",
        "table": "parking_lots",
        "type": "cartodb",
        "user": "nps"
      },
      "pointsOfInterest": {
        "name": "Points of Interest",
        "table": "points_of_interest",
        "type": "cartodb",
        "user": "nps"
      },
      "roads": {
        "name": "Roads",
        "table": "roads",
        "type": "cartodb",
        "user": "nps"
      },
      "trails": {
        "name": "Trails",
        "table": "trails",
        "type": "cartodb",
        "user": "nps"
      }
    }
  }
}

},{}],106:[function(require,module,exports){
/* global L */

'use strict';

var reqwest = require('reqwest');

var PoiLayer = L.GeoJSON.extend({
  /*
  _exclude: [{
    type: 'Cultural Landscape'
  }, {
    type: 'Historic District'
  }, {
    type: 'Junction'
  }, {
    type: 'Locale'
  }, {
    type: 'Populated Place'
  }],
  */
  _include: [{
    type: 'Visitor Center',
    symbol: 'visitor-center',
    minZoomFactor: 5,
    maxZoom: 22,
    priority: 1
  }, {
    type: 'Entrance Station',
    symbol: 'entrance-station',
    minZoomFactor: 6,
    maxZoom: 22,
    priority: 1
  }, {
    type: 'Information',
    symbol: 'information',
    minZoomFactor: 6,
    maxZoom: 22,
    priority: 2
  }, {
    type: 'Fee Booth',
    symbol: 'entrance-station',
    minZoomFactor: 6,
    maxZoom: 22,
    priority: 2
  }, {
    type: 'Ranger Station',
    symbol: 'ranger-station',
    minZoomFactor: 7,
    maxZoom: 22,
    priority: 2
  }, {
    type: 'Lodge',
    symbol: 'lodging',
    minZoomFactor: 7,
    maxZoom: 22,
    priority: 2
  }, {
    type: 'Lodging',
    symbol: 'lodging',
    minZoomFactor: 7,
    maxZoom: 22,
    priority: 2
  }, {
    type: 'Campground',
    symbol: 'campground',
    minZoomFactor: 7,
    maxZoom: 22,
    priority: 2
  }, {
    type: 'RV Campground',
    symbol: 'rv-campground',
    minZoomFactor: 7,
    maxZoom: 22,
    priority: 2
  }, {
    type: 'Store',
    symbol: 'store',
    minZoomFactor: 7,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Gift Shop',
    symbol: 'souvenir',
    minZoomFactor: 7,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Trailhead',
    symbol: 'trailhead',
    minZoomFactor: 8,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Gas Station',
    symbol: 'gas-station',
    minZoomFactor: 8,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Food Service',
    symbol: 'food-service',
    minZoomFactor: 8,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Picnic Area',
    symbol: 'picnic-area',
    minZoomFactor: 8,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Airport',
    symbol: 'airport',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Beach',
    symbol: 'beach-access',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Hospital',
    symbol: 'hospital',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Campsite',
    symbol: 'campsite',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Shelter',
    symbol: 'shelter',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Bus Stop / Shuttle Stop',
    symbol: 'bus-stop',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Emergency Telephone',
    symbol: 'emergency-telephone',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Bookstore',
    symbol: 'bookstore',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Trail Marker',
    symbol: 'sign',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'First Aid Station',
    symbol: 'first-aid',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Historic Marker',
    symbol: 'historic-feature',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Historic Site',
    symbol: 'historic-feature',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Horse Camp',
    symbol: 'horseback-riding',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Metro Stop / Subway Entrance',
    symbol: 'letter-m',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Library',
    symbol: 'library',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Lighthouse',
    symbol: 'lighthouse',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Marina',
    symbol: 'marina',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Museum',
    symbol: 'museum',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Post Office',
    symbol: 'post-office',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Restroom',
    symbol: 'restrooms',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Overlook',
    symbol: 'scenic-viewpoint',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Viewpoint',
    symbol: 'scenic-viewpoint',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Self Guiding Trail',
    symbol: 'self-guiding-trail',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Cabin',
    symbol: 'shelter-cabin',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Memorial',
    symbol: 'statue',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Monument',
    symbol: 'statue',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Telephone',
    symbol: 'telephone',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Cinema',
    symbol: 'theater',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Ferry Terminal',
    symbol: 'vehicle-ferry',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Waterfall',
    symbol: 'waterfall',
    minZoom: 16,
    maxZoom: 22,
    priority: 3
  }, {
    type: 'Amphitheater',
    symbol: 'amphitheater',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'ATM',
    symbol: 'atm',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Bicycle Trail',
    symbol: 'bicycle-trail',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Boat Launch',
    symbol: 'boat-launch',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Primitive Camping',
    symbol: 'campsite',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Canoe / Kayak Access',
    symbol: 'canoe-access',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Cave Entrance',
    symbol: 'cave',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Cross-Country Ski Trail',
    symbol: 'cross-country-ski-trail',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Dam',
    symbol: 'dam',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Downhill Ski Trail',
    symbol: 'downhill-skiing',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Fountain',
    symbol: 'drinking-water',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Potable Water',
    symbol: 'drinking-water',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Fishing',
    symbol: 'fishing',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Food Box / Food Cache',
    symbol: 'food-cache',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Four-Wheel Drive Trail',
    symbol: 'four-wheel-drive-road',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Motorized Trail',
    symbol: 'four-wheel-drive-road',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Golf Course',
    symbol: 'golfing',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Historic Building',
    symbol: 'historic-feature',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Historic Cabin',
    symbol: 'historic-feature',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Historic Ruins',
    symbol: 'historic-feature',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Historic Ship',
    symbol: 'historic-feature',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Wreck',
    symbol: 'historic-feature',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Historic Mine',
    symbol: 'historic-feature',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Horseback Riding',
    symbol: 'horseback-riding',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Ice Rink',
    symbol: 'ice-skating',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Interpretive Exhibit',
    symbol: 'interpretive-exhibit',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Laundry',
    symbol: 'laundry',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Litter Receptacle',
    symbol: 'litter-receptacle',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Tower',
    symbol: 'lookout-tower',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Garage',
    symbol: 'mechanic',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Motorcycle Trail',
    symbol: 'motor-bike-trail',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Parking Lot',
    symbol: 'parking',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Playground',
    symbol: 'playground',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Mailbox',
    symbol: 'post-office',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Radiator Water',
    symbol: 'radiator-water',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Recycling',
    symbol: 'recycling',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Floating Restroom',
    symbol: 'restrooms',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Sailing',
    symbol: 'sailing',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Dump Station',
    symbol: 'sanitary-disposal-station',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Scuba Diving',
    symbol: 'scuba-diving',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Seaplane Base',
    symbol: 'sea-plane',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Gazebo',
    symbol: 'shelter',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Hut',
    symbol: 'shelter',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Pavilion',
    symbol: 'shelter',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Showers',
    symbol: 'showers',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Information Board',
    symbol: 'sign',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Information Map',
    symbol: 'sign',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Directional Sign',
    symbol: 'sign',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Gateway Sign',
    symbol: 'sign',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Regulatory Sign',
    symbol: 'sign',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Sledding',
    symbol: 'sledding',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Snowmobile Trail',
    symbol: 'snowmobile-trail',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Spring',
    symbol: 'spring',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Stable',
    symbol: 'stable',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Sculpture',
    symbol: 'statue',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Swimming Area',
    symbol: 'swimming',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Non-Motorized Trail',
    symbol: 'trailhead',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Trail Register',
    symbol: 'trailhead',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Dumpster',
    symbol: 'trash-dumpster',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Tunnel',
    symbol: 'tunnel',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Webcam',
    symbol: 'webcam',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Wheelchair Accessible',
    symbol: 'wheelchair-accessible',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Wi-Fi',
    symbol: 'wi-fi',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Windsurfing Area',
    symbol: 'wind-surfing',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'Zebra Mussel Decontamination Station',
    symbol: 'zebra-mussel-decontamination-station',
    minZoom: 16,
    maxZoom: 22,
    priority: 4
  }, {
    type: 'All-Terrain Vehicle Trail',
    symbol: 'all-terrain-trail',
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Campfire Ring',
    symbol: 'campfire',
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Flag Pole',
    symbol: 'flagpole',
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Mile Marker',
    symbol: 'sign',
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Trail Sign',
    symbol: 'sign',
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Weather Shelter',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Picnic Table',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Barn',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Greenhouse',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Ranch',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Building',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Building Under Construction',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Bunker',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Public Building',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Administrative Office',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Commercial Building',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Headquarters',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Industrial Building',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Office',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Retail Building',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Education Center',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'School Building',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'University Building',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Cathedral',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Chapel',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Church',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Apartments',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Detached Home',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Dormitory',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'House',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Residential Building',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Row House',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Static Mobile Home',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Shed',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Warehouse',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Battlefield',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Cannon',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Battlefield Marker',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Brochure Box',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Bike Rack',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Canyoneering Route',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Climbing Route',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Park',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Grill',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Athletic Field',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Steps',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Totem Pole',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Bench',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Canal',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Cemetery / Graveyard',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Grave',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Fence',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Garden',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Gate',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Dyke (Levee)',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Lock',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Military Area',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Quarry (Mine)',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Shaft (Mine)',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Oilfield',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Point of Interest',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Reserve',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Reservoir',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Fortification',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Windmill',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Arroyo',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Reef (Bar)',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Shoal (Bar)',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Basin',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Bay',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Cape',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Cliff',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Desert',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Dune',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Forest',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Woods',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Glacier',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Grove',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Tree',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Harbor',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Island',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Isthmus',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Lake',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Lava',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Natural Feature',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Mountain Pass (Saddle / Gap)',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Peak',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Grassland',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Plain',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Prairie',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Plateau',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Rapids',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Ridge',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Arch',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Pillar',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Rock Formation',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Sea',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Strait (Channel)',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Stream',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Swamp',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Fumarole',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Geyser',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Hot Spring',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Mud Pot',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Canyon',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Valley',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Volcano',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Wetland',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Bridge',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Traffic Signals',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Turning Circle',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Airstrip',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Landing Strip',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Electric Vehicle Parking',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Roadside Pullout',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Train Station',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Fire Hydrant',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Fire Station',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Patrol Cabin',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Police',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Water Well',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Water Access',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Anchorage',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Boat Dock',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Boat Storage',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Buoy',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Mooring',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Fish Cleaning',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Fish Hatchery',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Dog Sled Trail',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Backcountry Ski Trail',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }, {
    type: 'Snowshoe Trail',
    symbol: null,
    minZoom: 16,
    maxZoom: 22,
    priority: 5
  }],
  includes: [
    require('../../mixin/geojson')
  ],
  options: {
    // autoContrast: true,
    environment: 'production',
    prioritization: true,
    types: [],
    unitCodes: []
  },

  // Wipe out popup, tooltip, and styles configs if they're passed up.
  // This is a "developmental" feature, so the API is going to be a moving target for a little while.
  // Add "darkOrLight" property to each baseLayer preset.
  // If autoContrast === true, subscribe to map baselayerchange event and update color of all icons, when needed.
  // Only support two colors for now.

  rows: null,
  initialize: function (options) {
    var me = this;
    var environment;
    var query;
    var i;

    L.Util.setOptions(this, this._toLeaflet(options));

    environment = this.options.environment;
    query = 'SELECT a.minzoompoly AS m,b.name AS n,b.type AS t,b.unit_code AS u,ST_X(b.the_geom) AS x,ST_Y(b.the_geom) AS y FROM parks AS a,points_of_interest' + (environment === 'production' ? '' : '_' + environment) + ' AS b WHERE a.unit_code=b.unit_code';

    if (this.options.types.length) {
      query += ' AND (';

      for (i = 0; i < this.options.types.length; i++) {
        query += 'b.type=\'' + this.options.types[i] + '\' OR ';
      }

      query = query.slice(0, query.length - 4) + ')';

      if (this.options.unitCodes.length) {
        query += ' AND (';

        for (i = 0; i < this.options.unitCodes.length; i++) {
          query += 'a.unit_code=\'' + this.options.unitCodes[i] + '\' OR ';
        }

        query = query.slice(0, query.length - 4) + ')';
      }
    } else if (this.options.unitCodes.length) {
      query += ' AND (';

      for (i = 0; i < this.options.unitCodes.length; i++) {
        query += 'a.unit_code=\'' + this.options.unitCodes[i] + '\' OR ';
      }

      query = query.slice(0, query.length - 4) + ')';
    }

    reqwest({
      data: {
        cb: new Date().getTime(),
        q: query
      },
      error: function (error) {
        var obj = L.extend(error, {
          message: 'There was an error loading the data from Places.'
        });

        me.fire('error', obj);
        me.errorFired = obj;
      },
      success: function (response) {
        var obj;

        if (response && response.responseText) {
          me._rows = JSON.parse(response.responseText).rows;

          if (me._rows.length) {
            var i = me._rows.length;

            L.GeoJSON.prototype.initialize.call(me, null, me.options);

            while (i--) {
              var row = me._rows[i];
              var config = (function () {
                var c;

                for (var j = 0; j < me._include.length; j++) {
                  if (me._include[j].type === row.t) {
                    c = me._include[j];
                    break;
                  }
                }

                if (c) {
                  return c;
                }
              })();

              if (config) {
                var symbol = config.symbol;

                obj = {
                  lat: row.y,
                  lng: row.x,
                  minZoom: row.m,
                  name: row.n,
                  symbol: symbol,
                  type: row.t,
                  unitCode: row.u
                };
                L.Util.extend(row, obj);
                delete row.m;
                delete row.n;
                delete row.t;
                delete row.u;
                delete row.x;
                delete row.y;
                row.marker = new L.Marker({
                  lat: row.lat,
                  lng: row.lng
                }, {
                  icon: me._getIcon(true, symbol),
                  title: row.name || row.type,
                  zIndexOffset: config.priority * -1000
                }).bindPopup((function () {
                  var html = '<div class="layer" style="min-width:250px;">';

                  if (row.name) {
                    html += '<div class="title">' + row.name + '</div>';
                  }

                  html += '<div class="description"><p>' + row.type + '</p></div>';

                  return html;
                })());
                L.Util.extend(row.marker, obj);
              } else {
                me._rows.splice(i, 1);
              }
            }

            if (me.options.prioritization) {
              me._update();
            } else {
              for (i = 0; i < me._rows.length; i++) {
                me._map.addLayer(me._rows[i].marker);
              }
            }

            me.fire('ready');
            me._loaded = true;
            me.readyFired = true;
          } else {
            obj = {
              message: 'No records were returned from Places.'
            };

            me.fire('error', obj);
            me.errorFired = obj;
          }
        } else {
          obj = {
            message: 'There was an error loading the data from Places.'
          };

          me.fire('error', obj);
          me.errorFired = obj;
        }

        return me;
      },
      type: 'POST',
      url: 'https://nps.cartodb.com/api/v2/sql'
    });
  },
  onAdd: function (map) {
    var me = this;

    me._map = map;

    /*
    if (me.options.autoContrast) {
      // TODO: Need to set this dynamically.
      // TODO: Also think about storing "lightOrDark" here in this module rather than with the baselayer presets.
      me._baseLayerColor = 'light';

      me._map.on('baselayerchange', function (e) {
        if (me._rows && me._rows.length && e.layer.options) {
          var lightOrDark = e.layer.options.lightOrDark;

          if (typeof lightOrDark === 'string' && (lightOrDark !== me._baseLayerColor)) {
            for (var i = 0; i < me._rows.length; i++) {
              var row = me._rows[i];
              var symbol = (function () {
                var c;

                for (var j = 0; j < me._include.length; j++) {
                  if (me._include[j].type === row.type) {
                    c = me._include[j];
                    break;
                  }
                }

                if (c) {
                  return c.symbol;
                } else {
                  return null;
                }
              })();

              // TODO: It seems like you're going to have to rebuild the marker itself.
              // So, remove all the markers from the map.
              // Then iterate through me._rows, overwriting me._rows[i].marker with the new marker.
              // Then call _update if me.options.prioritization is true.
              // If it isn't true, just readd all the markers.

              row.marker.setIcon(me._getIcon(lightOrDark === 'dark', symbol));
            }
          }
        }
      });
    }
    */

    if (me.options.prioritization) {
      me._map.on('moveend', function () {
        if (me._rows && me._rows.length) {
          me._update();
        }
      });
    }

    L.GeoJSON.prototype.onAdd.call(this, this._map);
  },
  _getIcon: function (dark, symbol) {
    if (symbol) {
      return L.npmap.icon.npmapsymbollibrary({
        'marker-color': (dark ? '000000' : '117733'),
        'marker-size': 'medium',
        'marker-symbol': symbol + '-white'
      });
    } else {
      return L.icon({
        iconAnchor: [
          3,
          3
        ],
        iconRetinaUrl: window.L.Icon.Default.imagePath + '/dots/dot-' + (dark ? 'black' : 'green') + '-6@2x.png',
        iconSize: [
          6,
          6
        ],
        iconUrl: window.L.Icon.Default.imagePath + '/dots/dot-' + (dark ? 'black' : 'green') + '-6.png',
        popupAnchor: [
          2,
          -6
        ]
      });
    }
  },
  _update: function () {
    var me = this;
    var active = [];
    var bounds = me._map.getBounds().pad(0.1);
    var layers = me.getLayers();
    var config;
    var i;
    var marker;

    for (i = 0; i < me._include.length; i++) {
      config = me._include[i];

      if (typeof config.minZoomFactor === 'number' || (me._map.getZoom() >= config.minZoom)) {
        active.push(config.type);
      }
    }

    i = layers.length;

    while (i--) {
      marker = layers[i];

      if (active.indexOf(marker.type) === -1 || !bounds.contains(marker.getLatLng())) {
        me.removeLayer(marker);
      }
    }

    for (i = 0; i < me._rows.length; i++) {
      var type;

      marker = me._rows[i].marker;
      type = marker.type;

      if (active.indexOf(type) > -1) {
        if (bounds.contains(marker.getLatLng())) {
          var factor;

          config = (function () {
            var c;

            for (var j = 0; j < me._include.length; j++) {
              if (me._include[j].type === type) {
                c = me._include[j];
                break;
              }
            }

            if (c) {
              return c;
            }
          })();
          factor = config.minZoomFactor;

          if (typeof factor === 'number') {
            var minZoom = marker.minZoom;
            var zoom = 16;

            if (typeof minZoom === 'number' && ((minZoom + factor) < 16)) {
              zoom = minZoom + factor;
            }

            if (me._map.getZoom() >= zoom) {
              me.addLayer(marker);
            } else if (me.hasLayer(marker)) {
              me.removeLayer(marker);
            }
          } else if (!me.hasLayer(marker)) {
            me.addLayer(marker);
          }
        }
      }
    }
  }
});

module.exports = function (options) {
  options = options || {};

  if (!options.type) {
    options.type = 'geojson';
  }

  if (options.cluster) {
    return L.npmap.layer._cluster(options);
  } else {
    return new PoiLayer(options);
  }
};

},{"../../mixin/geojson":98,"reqwest":60}],107:[function(require,module,exports){
/* globals L */

'use strict';

var util = require('./util/util');

var Tooltip = L.Class.extend({
  initialize: function (options) {
    L.setOptions(this, options);
    this._map = this.options.map;

    if (!this._map) {
      throw new Error('No map configured for tooltip');
    }

    this._container = L.DomUtil.create('div', 'leaflet-tooltip');
    this._map._tooltipContainer.appendChild(this._container);
  },
  _hide: function () {
    this._container.style.display = 'none';
    L.DomUtil.removeClass(this._container, 'leaflet-tooltip-fade');

    if (this._map.activeTip === this) {
      delete this._map.activeTip;
    }
  },
  _show: function () {
    this._container.style.display = 'inline-block';
    L.DomUtil.addClass(this._container, 'leaflet-tooltip-fade');
  },
  getHtml: function () {
    return this._container.innerHTML;
  },
  hide: function () {
    this._hide();
  },
  isVisible: function () {
    return this._container.style.display !== 'none';
  },
  setHtml: function (html) {
    if (typeof html === 'string') {
      this._container.innerHTML = util.unescapeHtml(html);
    } else {
      while (this._container.hasChildNodes()) {
        this._container.removeChild(this._container.firstChild);
      }

      this._container.appendChild(this._content);
    }

    this._sizeChanged = true;
  },
  setPosition: function (point) {
    var container = this._container;
    var containerSize = util.getOuterDimensions(container);
    var mapSize = this._map.getSize();
    var offset = L.point(15, 0);

    if (point.x + containerSize.width > mapSize.x - offset.x - 5) {
      container.style.left = 'auto';
      container.style.right = (mapSize.x - point.x + (offset.x - 5)) + 'px';
    } else {
      container.style.left = point.x + offset.x + 'px';
      container.style.right = 'auto';
    }

    if (point.y + containerSize.height > mapSize.y) {
      container.style.top = 'auto';
      container.style.bottom = (mapSize.y - point.y) + 'px';
    } else {
      container.style.top = point.y + 'px';
      container.style.bottom = 'auto';
    }
  },
  show: function (point, html) {
    if (this._map.activeTip && (this._map.activeTip !== this)) {
      this._map.activeTip._hide();
    }

    this._map.activeTip = this;

    if (html) {
      this.setHtml(html);
    }

    this.setPosition(point);
    this._show();
  }
});

L.Map.addInitHook(function () {
  this._tooltipContainer = L.DomUtil.create('div', 'leaflet-tooltip-container', this._container);
});

module.exports = function (options) {
  return new Tooltip(options);
};

},{"./util/util":113}],108:[function(require,module,exports){
/* globals L */
/* jshint camelcase: false */

'use strict';

var keys = require('../../keys.json');
var reqwest = require('reqwest');
var util = require('../util/util');

module.exports = ({
  _formatBingResult: function (result) {
    var bbox = result.bbox;
    var coordinates = result.geocodePoints[0].coordinates;

    return {
      bounds: [
        [
          bbox[0],
          bbox[1]
        ],
        [
          bbox[2],
          bbox[3]
        ]
      ],
      latLng: [
        coordinates[0],
        coordinates[1]
      ],
      name: result.name
    };
  },
  _formatEsriResult: function (result) {
    var extent = result.extent;
    var geometry = result.feature.geometry;

    return {
      bounds: [
        [
          extent.ymin,
          extent.xmin
        ],
        [
          extent.ymax,
          extent.xmax
        ]
      ],
      latLng: [
        geometry.y,
        geometry.x
      ],
      name: result.name
    };
  },
  _formatMapboxResult: function (result) {
    var bbox = result.bbox;
    var center = result.center;

    return {
      bounds: [
        [
          bbox[1],
          bbox[0]
        ],
        [
          bbox[3],
          bbox[2]
        ]
      ],
      latLng: [
        center[1],
        center[0]
      ],
      name: result.place_name
    };
  },
  _formatMapquestResult: function (result) {
    var city = result.adminArea5 || null;
    var county = result.adminArea4 || null;
    var country = result.adminArea1 || null;
    var street = result.street || null;
    var state = result.adminArea3 || null;
    var name = (street ? street + ', ' : '') + (city || county) + ', ' + state + ' ' + country;

    return {
      bounds: null,
      latLng: [
        result.latLng.lat,
        result.latLng.lng
      ],
      name: name
    };
  },
  _formatMapzenResult: function (result) {
    var coordinates = result.geometry.coordinates;
    var properties = result.properties;

    return {
      bounds: null,
      latLng: [
        coordinates[1],
        coordinates[0]
      ],
      name: properties.label || properties.name
    };
  },
  _formatNominatimResult: function (result) {
    var bbox = result.boundingbox;

    return {
      bounds: [
        [
          bbox[0],
          bbox[3]
        ],
        [
          bbox[1],
          bbox[2]
        ]
      ],
      latLng: [
        result.lat,
        result.lon
      ],
      name: result.display_name
    };
  },
  bing: function (value, callback) {
    var me = this;

    reqwest({
      error: function () {
        callback({
          message: 'The location search failed. Please check your network connection.',
          success: false
        });
      },
      jsonpCallback: 'jsonp',
      success: function (response) {
        var obj = {};

        if (response) {
          var results = [];

          for (var i = 0; i < response.resourceSets[0].resources.length; i++) {
            results.push(me._formatBingResult(response.resourceSets[0].resources[i]));
          }

          obj.results = results;
          obj.success = true;
        } else {
          obj.message = 'The response from the Bing service was invalid. Please try again.';
          obj.success = false;
        }

        callback(obj);
      },
      type: 'jsonp',
      url: util.buildUrl('https://dev.virtualearth.net/REST/v1/Locations', {
        include: 'queryParse',
        includeNeighborhood: 1,
        key: keys.bing.key,
        query: value
      })
    });
  },
  esri: function (value, callback, options) {
    var me = this;
    var defaults = {
      // bbox: options && options.bbox ? options.bbox : null,
      // center: me._map.getCenter(),
      // distance: Math.min(Math.max(center.distanceTo(ne), 2000), 50000),
      f: 'json',
      // location: options && options.center ? options.center.lat + ',' + options.center.lng : null,
      // maxLocations: 5,
      // outFields: 'Subregion, Region, PlaceName, Match_addr, Country, Addr_type, City',
      text: value
    };

    options = options ? L.extend(defaults, options) : defaults;

    reqwest({
      error: function () {
        callback({
          message: 'The location search failed. Please check your network connection.',
          success: false
        });
      },
      success: function (response) {
        var obj = {};

        if (response) {
          var results = [];

          for (var i = 0; i < response.locations.length; i++) {
            results.push(me._formatEsriResult(response.locations[i]));
          }

          obj.results = results;
          obj.success = true;
        } else {
          obj.message = 'The response from the Esri service was invalid. Please try again.';
          obj.success = false;
        }

        callback(obj);
      },
      type: 'jsonp',
      url: util.buildUrl('https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/find', options)
    });
  },
  mapbox: function (value, callback) {
    var me = this;

    reqwest({
      error: function () {
        callback({
          message: 'The location search failed. Please check your network connection.',
          success: false
        });
      },
      success: function (response) {
        if (response) {
          if (response.features && response.features.length) {
            var results = [];

            for (var i = 0; i < response.features.length; i++) {
              results.push(me._formatMapboxResult(response.features[i]));
            }

            callback({
              results: results,
              success: true
            });
          } else {
            callback({
              message: 'No locations found.',
              success: true
            });
          }
        } else {
          callback({
            message: 'The geocode failed. Please try again.',
            success: false
          });
        }
      },
      type: 'json',
      url: util.buildUrl('https://api.mapbox.com/geocoding/v5/mapbox.places/' + value.replace(/ /g, '+').replace(/,/g, '+') + '.json', {
        access_token: keys.mapbox.access_token
      })
    });
  },
  mapquest: function (value, callback) {
    var me = this;

    console.info('The MapQuest Geocoding API is limited to 15,000 transactions a month. We recommend using the `esri` provider, as it supports much higher limits for NPS maps.');
    reqwest({
      error: function () {
        callback({
          message: 'The location search failed. Please check your network connection.',
          success: false
        });
      },
      success: function (response) {
        if (response) {
          if (response.results && response.results[0] && response.results[0].locations && response.results[0].locations.length) {
            var results = [];

            for (var i = 0; i < response.results[0].locations.length; i++) {
              results.push(me._formatMapquestResult(response.results[0].locations[i]));
            }

            callback({
              results: results,
              success: true
            });
          } else {
            callback({
              message: 'No locations found.',
              success: true
            });
          }
        } else {
          callback({
            message: 'The geocode failed. Please try again.',
            success: false
          });
        }
      },
      type: 'jsonp',
      url: util.buildUrl('https://www.mapquestapi.com/geocoding/v1/address', {
        key: keys.mapquest.key,
        location: value,
        thumbMaps: false
      })
    });
  },
  mapzen: function (value, callback) {
    var me = this;

    reqwest({
      error: function () {
        callback({
          message: 'The location search failed. Please check your network connection.',
          success: false
        });
      },
      success: function (response) {
        if (response) {
          if (response.features && response.features.length) {
            var results = [];

            for (var i = 0; i < response.features.length; i++) {
              results.push(me._formatMapzenResult(response.features[i]));
            }

            callback({
              results: results,
              success: true
            });
          } else {
            callback({
              message: 'No locations found.',
              success: true
            });
          }
        } else {
          callback({
            message: 'The geocode failed. Please try again.',
            success: false
          });
        }
      },
      type: 'json',
      url: util.buildUrl('https://search.mapzen.com/v1/search', {
        api_key: keys.mapzen.api_key,
        text: value
      })
    });
  },
  nominatim: function (value, callback) {
    var me = this;

    console.info('The MapQuest Nominatim API is limited to 15,000 transactions a month. We recommend using the `esri` provider, as it supports much higher limits for NPS maps.');
    reqwest({
      error: function () {
        callback({
          message: 'The location search failed. Please check your network connection.',
          success: false
        });
      },
      jsonpCallback: 'json_callback',
      success: function (response) {
        var obj = {};

        if (response) {
          var results = [];

          for (var i = 0; i < response.length; i++) {
            results.push(me._formatNominatimResult(response[i]));
          }

          obj.results = results;
          obj.success = true;
        } else {
          obj.message = 'The response from the Nominatim service was invalid. Please try again.';
          obj.success = false;
        }

        callback(obj);
      },
      type: 'jsonp',
      url: util.buildUrl('https://open.mapquestapi.com/nominatim/v1/search.php', {
        addressdetails: 1,
        dedupe: 1,
        format: 'json',
        key: keys.mapquest.key,
        q: value
      })
    });
  }
});

},{"../../keys.json":1,"../util/util":113,"reqwest":60}],109:[function(require,module,exports){
module.exports = function (i, j) {
  function c () {
    g--;
    g === 0 && j && j();
  }
  function f (a) {
    try {
      document.styleSheets[a].cssRules ? c() : document.styleSheets[a].rules && document.styleSheets[a].rules.length ? c() : setTimeout(function () {
        f(a);
      }, 250);
    } catch (b) {
      setTimeout(function () {
        f(a);
      }, 250);
    }
  }
  function k (a) {
    a = a.toLowerCase();
    var b = a.indexOf('js');
    a = a.indexOf('css');
    return b === -1 && a === -1 ? !1 : b > a ? 'js' : 'css';
  }
  function m (a) {
    var b = document.createElement('link');
    b.href = a;
    b.rel = 'stylesheet';
    b.type = 'text/css';
    b.onload = c;
    b.onreadystatechange = function () {
      (this.readyState === 'loaded' || this.readyState === 'complete') && c();
    };
    document.getElementsByTagName('head')[0].appendChild(b);
  }

  for (var g = 0, d, l = document.styleSheets.length - 1, h = 0; h < i.length; h++) {
    if (g++, d = i[h], k(d) === 'css' && (m(d), l++, !window.opera && navigator.userAgent.indexOf('MSIE') === -1 && f(l)), k(d) === 'js') {
      var e = document.createElement('script');
      e.onload = c;
      e.src = d;
      e.type = 'text/javascript';
      document.getElementsByTagName('head')[0].appendChild(e);
    }
  }
};

},{}],110:[function(require,module,exports){
'use strict';

var keys = require('../../keys.json');
var reqwest = require('reqwest');

module.exports = ({
  mapbox: (function () {
    return {
      route: function (latLngs, callback, mode) {
        var locations = '';

        mode = mode || 'driving';

        for (var i = 0; i < latLngs.length; i++) {
          var latLng = latLngs[i];

          if (i) {
            locations += ';';
          }

          locations += latLng.lng + ',' + latLng.lat;
        }

        reqwest({
          crossOrigin: true,
          error: function () {
            callback({
              message: 'The route failed. Please check your network connection.',
              success: false
            });
          },
          success: function (response) {
            callback(response);
          },
          type: 'json',
          url: 'https://api.mapbox.com/v4/directions/mapbox.' + mode + '/' + locations + '.json?access_token=' + keys.mapbox.access_token + '&alternatives=false&instructions=html'
        });
      }
    };
  })()
});

},{"../../keys.json":1,"reqwest":60}],111:[function(require,module,exports){
'use strict';

module.exports = ({
  lat2tile: function (lat, zoom) {
    return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)));
  },
  long2tile: function (lon, zoom) {
    return (Math.floor((lon + 180) / 360 * Math.pow(2, zoom)));
  },
  tile2lat: function (y, z) {
    var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);

    return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
  },
  tile2long: function (x, z) {
    return (x / Math.pow(2, z) * 360 - 180);
  }
});

},{}],112:[function(require,module,exports){
module.exports = (function() {
  function merge(topology, arcs) {
    var fragmentByStart = {},
        fragmentByEnd = {};

    arcs.forEach(function(i) {
      var e = ends(i),
          start = e[0],
          end = e[1],
          f, g;

      if (f = fragmentByEnd[start]) {
        delete fragmentByEnd[f.end];
        f.push(i);
        f.end = end;
        if (g = fragmentByStart[end]) {
          delete fragmentByStart[g.start];
          var fg = g === f ? f : f.concat(g);
          fragmentByStart[fg.start = f.start] = fragmentByEnd[fg.end = g.end] = fg;
        } else if (g = fragmentByEnd[end]) {
          delete fragmentByStart[g.start];
          delete fragmentByEnd[g.end];
          var fg = f.concat(g.map(function(i) { return ~i; }).reverse());
          fragmentByStart[fg.start = f.start] = fragmentByEnd[fg.end = g.start] = fg;
        } else {
          fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
        }
      } else if (f = fragmentByStart[end]) {
        delete fragmentByStart[f.start];
        f.unshift(i);
        f.start = start;
        if (g = fragmentByEnd[start]) {
          delete fragmentByEnd[g.end];
          var gf = g === f ? f : g.concat(f);
          fragmentByStart[gf.start = g.start] = fragmentByEnd[gf.end = f.end] = gf;
        } else if (g = fragmentByStart[start]) {
          delete fragmentByStart[g.start];
          delete fragmentByEnd[g.end];
          var gf = g.map(function(i) { return ~i; }).reverse().concat(f);
          fragmentByStart[gf.start = g.end] = fragmentByEnd[gf.end = f.end] = gf;
        } else {
          fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
        }
      } else if (f = fragmentByStart[start]) {
        delete fragmentByStart[f.start];
        f.unshift(~i);
        f.start = end;
        if (g = fragmentByEnd[end]) {
          delete fragmentByEnd[g.end];
          var gf = g === f ? f : g.concat(f);
          fragmentByStart[gf.start = g.start] = fragmentByEnd[gf.end = f.end] = gf;
        } else if (g = fragmentByStart[end]) {
          delete fragmentByStart[g.start];
          delete fragmentByEnd[g.end];
          var gf = g.map(function(i) { return ~i; }).reverse().concat(f);
          fragmentByStart[gf.start = g.end] = fragmentByEnd[gf.end = f.end] = gf;
        } else {
          fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
        }
      } else if (f = fragmentByEnd[end]) {
        delete fragmentByEnd[f.end];
        f.push(~i);
        f.end = start;
        if (g = fragmentByEnd[start]) {
          delete fragmentByStart[g.start];
          var fg = g === f ? f : f.concat(g);
          fragmentByStart[fg.start = f.start] = fragmentByEnd[fg.end = g.end] = fg;
        } else if (g = fragmentByStart[start]) {
          delete fragmentByStart[g.start];
          delete fragmentByEnd[g.end];
          var fg = f.concat(g.map(function(i) { return ~i; }).reverse());
          fragmentByStart[fg.start = f.start] = fragmentByEnd[fg.end = g.start] = fg;
        } else {
          fragmentByStart[f.start] = fragmentByEnd[f.end] = f;
        }
      } else {
        f = [i];
        fragmentByStart[f.start = start] = fragmentByEnd[f.end = end] = f;
      }
    });

    function ends(i) {
      var arc = topology.arcs[i], p0 = arc[0], p1 = [0, 0];
      arc.forEach(function(dp) { p1[0] += dp[0], p1[1] += dp[1]; });
      return [p0, p1];
    }

    var fragments = [];
    for (var k in fragmentByEnd) fragments.push(fragmentByEnd[k]);
    return fragments;
  }

  function mesh(topology, o, filter) {
    var arcs = [];

    if (arguments.length > 1) {
      var geomsByArc = [],
          geom;

      function arc(i) {
        if (i < 0) i = ~i;
        (geomsByArc[i] || (geomsByArc[i] = [])).push(geom);
      }

      function line(arcs) {
        arcs.forEach(arc);
      }

      function polygon(arcs) {
        arcs.forEach(line);
      }

      function geometry(o) {
        if (o.type === "GeometryCollection") o.geometries.forEach(geometry);
        else if (o.type in geometryType) {
          geom = o;
          geometryType[o.type](o.arcs);
        }
      }

      var geometryType = {
        LineString: line,
        MultiLineString: polygon,
        Polygon: polygon,
        MultiPolygon: function(arcs) { arcs.forEach(polygon); }
      };

      geometry(o);

      geomsByArc.forEach(arguments.length < 3
          ? function(geoms, i) { arcs.push(i); }
          : function(geoms, i) { if (filter(geoms[0], geoms[geoms.length - 1])) arcs.push(i); });
    } else {
      for (var i = 0, n = topology.arcs.length; i < n; ++i) arcs.push(i);
    }

    return object(topology, {type: "MultiLineString", arcs: merge(topology, arcs)});
  }

  function featureOrCollection(topology, o) {
    return o.type === "GeometryCollection" ? {
      type: "FeatureCollection",
      features: o.geometries.map(function(o) { return feature(topology, o); })
    } : feature(topology, o);
  }

  function feature(topology, o) {
    var f = {
      type: "Feature",
      id: o.id,
      properties: o.properties || {},
      geometry: object(topology, o)
    };
    if (o.id == null) delete f.id;
    return f;
  }

  function object(topology, o) {
    var absolute = transformAbsolute(topology.transform),
        arcs = topology.arcs;

    function arc(i, points) {
      if (points.length) points.pop();
      for (var a = arcs[i < 0 ? ~i : i], k = 0, n = a.length, p; k < n; ++k) {
        points.push(p = a[k].slice());
        absolute(p, k);
      }
      if (i < 0) reverse(points, n);
    }

    function point(p) {
      p = p.slice();
      absolute(p, 0);
      return p;
    }

    function line(arcs) {
      var points = [];
      for (var i = 0, n = arcs.length; i < n; ++i) arc(arcs[i], points);
      if (points.length < 2) points.push(points[0].slice());
      return points;
    }

    function ring(arcs) {
      var points = line(arcs);
      while (points.length < 4) points.push(points[0].slice());
      return points;
    }

    function polygon(arcs) {
      return arcs.map(ring);
    }

    function geometry(o) {
      var t = o.type;
      return t === "GeometryCollection" ? {type: t, geometries: o.geometries.map(geometry)}
          : t in geometryType ? {type: t, coordinates: geometryType[t](o)}
          : null;
    }

    var geometryType = {
      Point: function(o) { return point(o.coordinates); },
      MultiPoint: function(o) { return o.coordinates.map(point); },
      LineString: function(o) { return line(o.arcs); },
      MultiLineString: function(o) { return o.arcs.map(line); },
      Polygon: function(o) { return polygon(o.arcs); },
      MultiPolygon: function(o) { return o.arcs.map(polygon); }
    };

    return geometry(o);
  }

  function reverse(array, n) {
    var t, j = array.length, i = j - n; while (i < --j) t = array[i], array[i++] = array[j], array[j] = t;
  }

  function bisect(a, x) {
    var lo = 0, hi = a.length;
    while (lo < hi) {
      var mid = lo + hi >>> 1;
      if (a[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  function neighbors(objects) {
    var indexesByArc = {}, // arc index -> array of object indexes
        neighbors = objects.map(function() { return []; });

    function line(arcs, i) {
      arcs.forEach(function(a) {
        if (a < 0) a = ~a;
        var o = indexesByArc[a];
        if (o) o.push(i);
        else indexesByArc[a] = [i];
      });
    }

    function polygon(arcs, i) {
      arcs.forEach(function(arc) { line(arc, i); });
    }

    function geometry(o, i) {
      if (o.type === "GeometryCollection") o.geometries.forEach(function(o) { geometry(o, i); });
      else if (o.type in geometryType) geometryType[o.type](o.arcs, i);
    }

    var geometryType = {
      LineString: line,
      MultiLineString: polygon,
      Polygon: polygon,
      MultiPolygon: function(arcs, i) { arcs.forEach(function(arc) { polygon(arc, i); }); }
    };

    objects.forEach(geometry);

    for (var i in indexesByArc) {
      for (var indexes = indexesByArc[i], m = indexes.length, j = 0; j < m; ++j) {
        for (var k = j + 1; k < m; ++k) {
          var ij = indexes[j], ik = indexes[k], n;
          if ((n = neighbors[ij])[i = bisect(n, ik)] !== ik) n.splice(i, 0, ik);
          if ((n = neighbors[ik])[i = bisect(n, ij)] !== ij) n.splice(i, 0, ij);
        }
      }
    }

    return neighbors;
  }

  function presimplify(topology, triangleArea) {
    var absolute = transformAbsolute(topology.transform),
        relative = transformRelative(topology.transform),
        heap = minHeap(compareArea),
        maxArea = 0,
        triangle;

    if (!triangleArea) triangleArea = cartesianArea;

    topology.arcs.forEach(function(arc) {
      var triangles = [];

      arc.forEach(absolute);

      for (var i = 1, n = arc.length - 1; i < n; ++i) {
        triangle = arc.slice(i - 1, i + 2);
        triangle[1][2] = triangleArea(triangle);
        triangles.push(triangle);
        heap.push(triangle);
      }

      // Always keep the arc endpoints!
      arc[0][2] = arc[n][2] = Infinity;

      for (var i = 0, n = triangles.length; i < n; ++i) {
        triangle = triangles[i];
        triangle.previous = triangles[i - 1];
        triangle.next = triangles[i + 1];
      }
    });

    while (triangle = heap.pop()) {
      var previous = triangle.previous,
          next = triangle.next;

      // If the area of the current point is less than that of the previous point
      // to be eliminated, use the latter's area instead. This ensures that the
      // current point cannot be eliminated without eliminating previously-
      // eliminated points.
      if (triangle[1][2] < maxArea) triangle[1][2] = maxArea;
      else maxArea = triangle[1][2];

      if (previous) {
        previous.next = next;
        previous[2] = triangle[2];
        update(previous);
      }

      if (next) {
        next.previous = previous;
        next[0] = triangle[0];
        update(next);
      }
    }

    topology.arcs.forEach(function(arc) {
      arc.forEach(relative);
    });

    function update(triangle) {
      heap.remove(triangle);
      triangle[1][2] = triangleArea(triangle);
      heap.push(triangle);
    }

    return topology;
  };

  function cartesianArea(triangle) {
    return Math.abs(
      (triangle[0][0] - triangle[2][0]) * (triangle[1][1] - triangle[0][1])
      - (triangle[0][0] - triangle[1][0]) * (triangle[2][1] - triangle[0][1])
    );
  }

  function compareArea(a, b) {
    return a[1][2] - b[1][2];
  }

  function minHeap(compare) {
    var heap = {},
        array = [];

    heap.push = function() {
      for (var i = 0, n = arguments.length; i < n; ++i) {
        var object = arguments[i];
        up(object.index = array.push(object) - 1);
      }
      return array.length;
    };

    heap.pop = function() {
      var removed = array[0],
          object = array.pop();
      if (array.length) {
        array[object.index = 0] = object;
        down(0);
      }
      return removed;
    };

    heap.remove = function(removed) {
      var i = removed.index,
          object = array.pop();
      if (i !== array.length) {
        array[object.index = i] = object;
        (compare(object, removed) < 0 ? up : down)(i);
      }
      return i;
    };

    function up(i) {
      var object = array[i];
      while (i > 0) {
        var up = ((i + 1) >> 1) - 1,
            parent = array[up];
        if (compare(object, parent) >= 0) break;
        array[parent.index = i] = parent;
        array[object.index = i = up] = object;
      }
    }

    function down(i) {
      var object = array[i];
      while (true) {
        var right = (i + 1) << 1,
            left = right - 1,
            down = i,
            child = array[down];
        if (left < array.length && compare(array[left], child) < 0) child = array[down = left];
        if (right < array.length && compare(array[right], child) < 0) child = array[down = right];
        if (down === i) break;
        array[child.index = i] = child;
        array[object.index = i = down] = object;
      }
    }

    return heap;
  }

  function transformAbsolute(transform) {
    if (!transform) return noop;
    var x0,
        y0,
        kx = transform.scale[0],
        ky = transform.scale[1],
        dx = transform.translate[0],
        dy = transform.translate[1];
    return function(point, i) {
      if (!i) x0 = y0 = 0;
      point[0] = (x0 += point[0]) * kx + dx;
      point[1] = (y0 += point[1]) * ky + dy;
    };
  }

  function transformRelative(transform) {
    if (!transform) return noop;
    var x0,
        y0,
        kx = transform.scale[0],
        ky = transform.scale[1],
        dx = transform.translate[0],
        dy = transform.translate[1];
    return function(point, i) {
      if (!i) x0 = y0 = 0;
      var x1 = (point[0] - dx) / kx | 0,
          y1 = (point[1] - dy) / ky | 0;
      point[0] = x1 - x0;
      point[1] = y1 - y0;
      x0 = x1;
      y0 = y1;
    };
  }

  function noop() {}

  return {
    version: "1.4.0",
    mesh: mesh,
    feature: featureOrCollection,
    neighbors: neighbors,
    presimplify: presimplify
  };
})();

},{}],113:[function(require,module,exports){
/* global L, XMLHttpRequest */

'use strict';

var dateFormat = require('helper-dateformat');
var handlebars = require('handlebars');
var reqwest = require('reqwest');

handlebars.registerHelper('dateFormat', dateFormat);
handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
  switch (operator) {
    case '!=':
      return (v1 != v2) ? options.fn(this) : options.inverse(this);
    case '!==':
      return (v1 !== v2) ? options.fn(this) : options.inverse(this);
    case '==':
      return (v1 == v2) ? options.fn(this) : options.inverse(this);
    case '===':
      return (v1 === v2) ? options.fn(this) : options.inverse(this);
    case '<':
      return (v1 < v2) ? options.fn(this) : options.inverse(this);
    case '<=':
      return (v1 <= v2) ? options.fn(this) : options.inverse(this);
    case '>':
      return (v1 > v2) ? options.fn(this) : options.inverse(this);
    case '>=':
      return (v1 >= v2) ? options.fn(this) : options.inverse(this);
    case '&&':
      return (v1 && v2) ? options.fn(this) : options.inverse(this);
    case '||':
      return (v1 || v2) ? options.fn(this) : options.inverse(this);
    default:
      return options.inverse(this);
  }
});
handlebars.registerHelper('toInt', function (str) {
  return parseInt(str, 10);
});
handlebars.registerHelper('toLowerCase', function (str) {
  return str.toLowerCase();
});
handlebars.registerHelper('toUpperCase', function (str) {
  return str.toUpperCase();
});

// Shim for window.atob/window.btoa. Needed for IE9 support.
(function () {
  var decodeChars = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 62, -1, -1, -1, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, -1, -1, -1, -1, -1];
  var encodeChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  function base64decode (str) {
    var c1, c2, c3, c4, i, len, out;

    len = str.length;
    i = 0;
    out = '';

    while (i < len) {
      do {
        c1 = decodeChars[str.charCodeAt(i++) & 0xff];
      } while (i < len && c1 === -1);

      if (c1 === -1) {
        break;
      }

      do {
        c2 = decodeChars[str.charCodeAt(i++) & 0xff];
      } while (i < len && c2 === -1);

      if (c2 === -1) {
        break;
      }

      out += String.fromCharCode((c1 << 2) | ((c2 & 0x30) >> 4));

      do {
        c3 = str.charCodeAt(i++) & 0xff;

        if (c3 === 61) {
          return out;
        }

        c3 = decodeChars[c3];
      } while (i < len && c3 === -1);

      if (c3 === -1) {
        break;
      }

      out += String.fromCharCode(((c2 & 0XF) << 4) | ((c3 & 0x3C) >> 2));

      do {
        c4 = str.charCodeAt(i++) & 0xff;

        if (c4 === 61) {
          return out;
        }

        c4 = decodeChars[c4];
      } while (i < len && c4 === -1);

      if (c4 === -1) {
        break;
      }

      out += String.fromCharCode(((c3 & 0x03) << 6) | c4);
    }

    return out;
  }
  function base64encode (str) {
    var c1, c2, c3, i, len, out;

    len = str.length;
    i = 0;
    out = '';

    while (i < len) {
      c1 = str.charCodeAt(i++) & 0xff;

      if (i === len) {
        out += encodeChars.charAt(c1 >> 2);
        out += encodeChars.charAt((c1 & 0x3) << 4);
        out += '==';
        break;
      }

      c2 = str.charCodeAt(i++);

      if (i === len) {
        out += encodeChars.charAt(c1 >> 2);
        out += encodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
        out += encodeChars.charAt((c2 & 0xF) << 2);
        out += '=';
        break;
      }

      c3 = str.charCodeAt(i++);
      out += encodeChars.charAt(c1 >> 2);
      out += encodeChars.charAt(((c1 & 0x3) << 4) | ((c2 & 0xF0) >> 4));
      out += encodeChars.charAt(((c2 & 0xF) << 2) | ((c3 & 0xC0) >> 6));
      out += encodeChars.charAt(c3 & 0x3F);
    }

    return out;
  }

  if (!window.btoa) {
    window.btoa = base64encode;
  }

  if (!window.atob) {
    window.atob = base64decode;
  }
})();

module.exports = {
  _checkDisplay: function (node, changed) {
    if (node.style && node.style.display === 'none') {
      changed.push(node);
      node.style.display = 'block';
    }
  },
  checkNpsNetwork: function (callback) {
    this.reqwest({
      crossOrigin: true,
      error: function () {
        callback(false);
      },
      success: function (response) {
        if (response && response.success) {
          callback(true);
        } else {
          callback(false);
        }
      },
      type: 'json',
      url: 'https://insidemaps.nps.gov/test/inside'
    });
  },
  _getAutoPanPaddingTopLeft: function (el) {
    var containers = this.getChildElementsByClassName(el, 'leaflet-top');

    return [this.getOuterDimensions(containers[0]).width + 20, this.getOuterDimensions(containers[1]).height + 20];
  },
  _getAvailableHorizontalSpace: function (map) {
    var container = map.getContainer();
    var leftBottom = this.getChildElementsByClassName(container, 'leaflet-bottom')[0];
    var leftTop = this.getChildElementsByClassName(container, 'leaflet-top')[0];
    var leftWidth = this.getOuterDimensions(leftBottom).width;
    var available;

    if (this.getOuterDimensions(leftTop).width > leftWidth) {
      leftWidth = this.getOuterDimensions(leftTop).width;
    }

    // Should this be 'leaflet-bottom'[0].width?
    available = this.getOuterDimensions(container).width - leftWidth - this.getOuterDimensions(this.getChildElementsByClassName(container, 'leaflet-top')[1]).width;

    if (available > 249) {
      return available;
    } else {
      return 250;
    }
  },
  _getAvailableVerticalSpace: function (map) {
    var container = map.getContainer();
    var bottomLeft = this.getChildElementsByClassName(container, 'leaflet-bottom')[0];
    var bottomRight = this.getChildElementsByClassName(container, 'leaflet-bottom')[1];
    var bottomHeight = this.getOuterDimensions(bottomLeft).height;
    var available;

    if (this.getOuterDimensions(bottomRight).height > bottomHeight) {
      bottomHeight = this.getOuterDimensions(bottomRight).height;
    }

    available = this.getOuterDimensions(container).height - bottomHeight - this.getOuterDimensions(this.getChildElementsByClassName(container, 'leaflet-top')[1]).height;

    if (available > 149) {
      return available;
    } else {
      return 150;
    }
  },
  _lazyLoader: require('./lazyloader.js'),
  _parseLocalUrl: function (url) {
    return url.replace(window.location.origin, '');
  },
  appendCssFile: function (urls, callback) {
    if (typeof urls === 'string') {
      urls = [
        urls
      ];
    }

    this._lazyLoader(urls, callback);
  },
  appendJsFile: function (urls, callback) {
    if (typeof urls === 'string') {
      urls = [
        urls
      ];
    }

    this._lazyLoader(urls, callback);
  },
  buildUrl: function (base, params) {
    var returnArray = [];

    if (params) {
      returnArray.push(base + '?');
    } else {
      return base;
    }

    for (var param in params) {
      returnArray.push(encodeURIComponent(param));
      returnArray.push('=');
      returnArray.push(encodeURIComponent(params[param]));
      returnArray.push('&');
    }

    returnArray.pop();
    return returnArray.join('');
  },
  cancelEvent: function (e) {
    e = e || window.event;

    if (e.preventDefault) {
      e.preventDefault();
    }

    e.returnValue = false;
  },
  clone: function (obj) {
    // One problem with this: http://stackoverflow.com/questions/11491938/issues-with-date-when-using-json-stringify-and-json-parse/11491993#11491993.
    return JSON.parse(JSON.stringify(obj));
  },
  dataToList: function (data, fields) {
    var dl = document.createElement('dl');

    for (var prop in data) {
      var add = true;

      if (fields && L.Util.isArray(fields)) {
        if (fields.indexOf(prop) === -1) {
          add = false;
        }
      }

      if (add) {
        var dd = document.createElement('dd');
        var dt = document.createElement('dt');

        dt.innerHTML = prop;
        dd.innerHTML = data[prop];
        dl.appendChild(dt);
        dl.appendChild(dd);
      }
    }

    return dl;
  },
  // TODO: Needs a lot of cleanup, and also need to document fields option.
  dataToTable: function (data, fields) {
    var table = document.createElement('table');
    var tableBody = document.createElement('tbody');
    var field;
    var fieldTitles;

    table.appendChild(tableBody);

    if (L.Util.isArray(fields)) {
      fieldTitles = {};

      for (var i = 0; i < fields.length; i++) {
        field = fields[i];

        if (typeof field === 'string') {
          fieldTitles[field] = {
            'title': field
          };
        } else {
          fieldTitles[field.field] = field;
        }
      }
    }

    for (var prop in data) {
      var add = false;

      if (fieldTitles) {
        for (field in fieldTitles) {
          if (field === prop) {
            add = true;
            break;
          }
        }
      } else {
        add = true;
      }

      if (add) {
        var tdProperty = document.createElement('td');
        var tdValue = document.createElement('td');
        var tr = document.createElement('tr');

        if (fieldTitles) {
          tdProperty.innerHTML = fieldTitles[prop].title;
        } else {
          tdProperty.innerHTML = prop;
        }

        if (fieldTitles && fieldTitles[prop] && fieldTitles[prop].separator) {
          tdValue.innerHTML = data[prop].replace(fieldTitles[prop].separator, '<br/>');
        } else {
          tdValue.innerHTML = data[prop];
        }

        if (fieldTitles && fieldTitles[prop] && fieldTitles[prop].process) {
          tdValue.innerHTML = fieldTitles[prop].process(tdValue.innerHTML);
        }

        tr.appendChild(tdProperty);
        tr.appendChild(tdValue);
        tableBody.appendChild(tr);
      }
    }

    return table;
  },
  escapeHtml: function (unsafe) {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },
  getChildElementsByClassName: function (parentNode, className) {
    var children = parentNode.childNodes;
    var matches = [];

    function recurse (el) {
      var grandChildren = el.children;

      if (typeof el.className === 'string' && el.className.indexOf(className) !== -1) {
        var classNames = el.className.split(' ');

        for (var k = 0; k < classNames.length; k++) {
          if (classNames[k] === className) {
            matches.push(el);
            break;
          }
        }
      }

      if (grandChildren && grandChildren.length) {
        for (var j = 0; j < grandChildren.length; j++) {
          recurse(grandChildren[j]);
        }
      }
    }

    for (var i = 0; i < children.length; i++) {
      recurse(children[i]);
    }

    return matches;
  },
  getChildElementsByNodeName: function (parentNode, nodeName) {
    var children = parentNode.childNodes;
    var matches = [];

    nodeName = nodeName.toLowerCase();

    function recurse (el) {
      var grandChildren = el.children;

      if (typeof el.nodeName === 'string' && el.nodeName.toLowerCase() === nodeName) {
        matches.push(el);
      }

      if (grandChildren && grandChildren.length) {
        for (var j = 0; j < grandChildren.length; j++) {
          recurse(grandChildren[j]);
        }
      }
    }

    for (var i = 0; i < children.length; i++) {
      recurse(children[i]);
    }

    return matches;
  },
  getElementsByClassName: function (className) {
    var matches = [];
    var regex = new RegExp('(^|\\s)' + className + '(\\s|$)');
    var tmp = document.getElementsByTagName('*');

    for (var i = 0; i < tmp.length; i++) {
      if (regex.test(tmp[i].className)) {
        matches.push(tmp[i]);
      }
    }

    return matches;
  },
  getEventObject: function (e) {
    if (!e) {
      e = window.event;
    }

    return e;
  },
  getEventObjectTarget: function (e) {
    var target;

    if (e.target) {
      target = e.target;
    } else {
      target = e.srcElement;
    }

    if (target.nodeType === 3) {
      target = target.parentNode;
    }

    return target;
  },
  getNextSibling: function (el) {
    do {
      el = el.nextSibling;
    } while (el && el.nodeType !== 1);

    return el;
  },
  getOffset: function (el) {
    for (var lx = 0, ly = 0; el !== null; lx += el.offsetLeft, ly += el.offsetTop, el = el.offsetParent);

    return {
      left: lx,
      top: ly
    };
  },
  getOuterDimensions: function (el) {
    var height = 0;
    var width = 0;

    if (el) {
      var changed = [];
      var parentNode = el.parentNode;

      this._checkDisplay(el, changed);

      if (el.id !== 'npmap' && parentNode) {
        this._checkDisplay(parentNode, changed);

        while (parentNode.id && parentNode.id !== 'npmap' && parentNode.id !== 'npmap-map') {
          parentNode = parentNode.parentNode;

          if (parentNode) {
            this._checkDisplay(parentNode, changed);
          }
        }
      }

      height = el.offsetHeight;
      width = el.offsetWidth;

      changed.reverse();

      for (var i = 0; i < changed.length; i++) {
        changed[i].style.display = 'none';
      }
    }

    return {
      height: height,
      width: width
    };
  },
  getOuterHtml: function (el) {
    if (!el || !el.tagName) {
      return '';
    }

    var div = document.createElement('div');
    var ax;
    var txt;

    div.appendChild(el.cloneNode(false));
    txt = div.innerHTML;
    ax = txt.indexOf('>') + 1;
    txt = txt.substring(0, ax) + el.innerHTML + txt.substring(ax);
    div = null;
    return txt;
  },
  getPosition: function (el) {
    var obj = {
      left: 0,
      top: 0
    };
    var offset = this.getOffset(el);
    var offsetParent = this.getOffset(el.parentNode);

    obj.left = offset.left - offsetParent.left;
    obj.top = offset.top - offsetParent.top;

    return obj;
  },
  getPreviousSibling: function (el) {
    do {
      el = el.previousSibling;
    } while (el && el.nodeType !== 1);

    return el;
  },
  getPropertyCount: function (obj) {
    if (!Object.keys) {
      var keys = [];
      var k;

      for (k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
          keys.push(k);
        }
      }

      return keys.length;
    } else {
      return Object.keys(obj).length;
    }
  },
  handlebars: function (template, data) {
    template = handlebars.compile(template);

    return template(data);
  },
  isHidden: function (el) {
    return (el.offsetParent === null);
  },
  isLocalUrl: function (url) {
    if (url.indexOf(window.location.hostname) >= 0) {
      return true;
    } else {
      return !(/^(?:[a-z]+:)?\/\//i.test(url));
    }
  },
  isNumeric: function (val) {
    return !isNaN(parseFloat(val)) && isFinite(val);
  },
  linkify: function (text, shorten, target) {
    var regexRoot = '\\b(https?:\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[A-Z0-9+&@#/%=~_|])';
    var regexLink = new RegExp(regexRoot, 'gi');
    var regexShorten = new RegExp('>' + regexRoot + '</a>', 'gi');
    var textLinked = text.replace(regexLink, '<a href="$1"' + (target ? ' target="' + target + '"' : '') + '>$1</a>');

    if (shorten) {
      var matchArray = textLinked.match(regexShorten);

      if (matchArray) {
        for (var i = 0; i < matchArray.length; i++) {
          var newBase = matchArray[i].substr(1, matchArray[i].length - 5).replace(/https?:\/\//gi, '');
          var newName = newBase.substr(0, shorten) + (newBase.length > shorten ? '&hellip;' : '');

          if (newBase.length - 1 === shorten) {
            newName = newName.substr(0, shorten) + newBase.substr(shorten, 1);
          }

          textLinked = textLinked.replace(matchArray[i], '>' + newName + '</a>');
        }
      }
    }

    return textLinked;
  },
  loadFile: function (url, type, callback) {
    if (this.isLocalUrl(url)) {
      if (type === 'xml') {
        var request = new XMLHttpRequest();

        request.onload = function () {
          var text = this.responseText;

          if (text) {
            callback(text);
          } else {
            callback(false);
          }
        };
        request.open('get', this._parseLocalUrl(url), true);
        request.send();
      } else {
        reqwest({
          error: function () {
            callback(false);
          },
          success: function (response) {
            if (response) {
              if (type === 'text') {
                callback(response.responseText);
              } else {
                callback(response);
              }
            } else {
              callback(false);
            }
          },
          type: type,
          url: this._parseLocalUrl(url)
        });
      }
    } else {
      var supportsCors = (window.location.protocol.indexOf('https:') === 0 ? true : (this.supportsCors() === 'yes'));

      reqwest({
        crossOrigin: supportsCors,
        error: function () {
          callback(false);
        },
        success: function (response) {
          if (response && response.success) {
            callback(response.data);
          } else {
            callback(false);
          }
        },
        type: 'json' + (supportsCors ? '' : 'p'),
        url: 'https://server-utils.herokuapp.com/proxy/?encoded=true&type=' + type + '&url=' + window.btoa(encodeURIComponent(url))
      });
    }
  },
  mediaToList: function (data, media) {
    var div = document.createElement('div');
    var types = {
      focus: function (guids) {
        var guidArray = guids.match(new RegExp('[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}(}){0,1}', 'g'));
        var imgs = [];

        for (var i = 0; i < guidArray.length; i++) {
          imgs.push({
            href: 'http://focus.nps.gov/AssetDetail?assetID=' + guidArray[i],
            src: 'http://focus.nps.gov/GetAsset/' + guidArray[i] + '/thumb/xlarge'
          });
        }

        return imgs;
      }
    };
    var ul = document.createElement('ul');
    var images;
    var next;
    var previous;

    function changeImage (direction) {
      var lis = ul.childNodes;
      var maxImg = lis.length;
      var curImg;
      var j;
      var li;

      for (j = 0; j < lis.length; j++) {
        li = lis[j];

        if (li.style.display !== 'none') {
          curImg = j;
          break;
        }
      }

      if ((curImg + direction) < maxImg && (curImg + direction) > -1) {
        for (j = 0; j < lis.length; j++) {
          li = lis[j];

          if (j === (curImg + direction)) {
            li.style.display = 'block';
          } else {
            li.style.display = 'none';
          }
        }
      }

      if ((curImg + direction) <= 0) {
        L.DomUtil.addClass(previous, 'disabled');
      } else {
        L.DomUtil.removeClass(previous, 'disabled');
      }

      if ((curImg + direction + 1) >= maxImg) {
        L.DomUtil.addClass(next, 'disabled');
      } else {
        L.DomUtil.removeClass(next, 'disabled');
      }
    }

    for (var i = 0; i < media.length; i++) {
      var config = media[i];
      var type = types[config.type];

      if (type) {
        images = type(data[config.id.replace('{{', '').replace('}}', '')]);

        for (var k = 0; k < images.length; k++) {
          var a = document.createElement('a');
          var image = images[k];
          var img = document.createElement('img');
          var imgStyles = [];
          var li = document.createElement('li');

          if (typeof config.height === 'number') {
            imgStyles += 'height:' + config.height + 'px;';
          }

          if (typeof config.width === 'number') {
            imgStyles += 'width:' + config.width + 'px;';
          }

          if (imgStyles.length) {
            img.style.cssText = imgStyles;
          }

          img.src = image.src;
          a.appendChild(img);
          a.href = image.href;
          a.target = '_blank';
          li.appendChild(a);
          li.style.display = k > 0 ? 'none' : 'block';
          ul.appendChild(li);
        }
      }
    }

    ul.className = 'clearfix';
    div.appendChild(ul);

    if (ul.childNodes.length > 1) {
      var buttons = document.createElement('div');

      next = document.createElement('button');
      previous = document.createElement('button');
      buttons.style.float = 'right';
      previous = document.createElement('button');
      previous.setAttribute('class', 'btn btn-circle disabled prev');
      previous.innerHTML = '&lt;';
      next = document.createElement('button');
      next.setAttribute('class', 'btn btn-circle next');
      next.innerHTML = '&gt;';
      L.DomEvent.addListener(previous, 'click', function () {
        changeImage(-1);
      });
      L.DomEvent.addListener(next, 'click', function () {
        changeImage(1);
      });
      buttons.appendChild(previous);
      buttons.appendChild(next);
      div.appendChild(buttons);
    }

    return div;
  },
  parseDomainFromUrl: function (url) {
    var matches = url.match(/^https?\:\/\/([^\/?#]+)(?:[\/?#]|$)/i);

    return matches && matches[1];
  },
  putCursorAtEndOfInput: function (input) {
    if (input.setSelectionRange) {
      var length = input.value.length * 2;
      input.setSelectionRange(length, length);
    } else {
      input.value = input.value;
    }
  },
  reqwest: reqwest,
  strict: function (_, type) {
    if (typeof _ !== type) {
      throw new Error('Invalid argument: ' + type + ' expected');
    }
  },
  strictInstance: function (_, klass, name) {
    if (!(_ instanceof klass)) {
      throw new Error('Invalid argument: ' + name + ' expected');
    }
  },
  strictOneOf: function (_, values) {
    if (values.indexOf(_) === -1) {
      throw new Error('Invalid argument: ' + _ + ' given, valid values are ' + values.join(', '));
    }
  },
  stripHtml: function (html) {
    var tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  },
  // http://stackoverflow.com/a/7616755/27540
  supportsCors: function () {
    if ('withCredentials' in new XMLHttpRequest()) {
      return 'yes';
    } else if (typeof XDomainRequest !== 'undefined') {
      return 'partial';
    } else {
      return 'no';
    }
  },
  unescapeHtml: function (unsafe) {
    return unsafe
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '\"')
      .replace(/&#039;/g, '\'');
  }
};

},{"./lazyloader.js":109,"handlebars":39,"helper-dateformat":52,"reqwest":60}]},{},[61]);
