#!/usr/bin/env node
// -*- tab-width: 4 -*-

var fs    = require('fs');
var jsdom = require('jsdom');
var path  = require('path');
var us    = require('underscore');


var PATH_BASE = './data/developer.mozilla.org/en/CSS/';
var URL_BASE  = 'https://developer.mozilla.org/en/CSS/';
var JQUERY_URL = './jquery-1.5.min.js'; // 'http://code.jquery.com/jquery-1.5.min.js'; 
var INDEX_NAME = 'CSS_Reference';

/*
function create_window(cb) {
    var document = jsdom.jsdom('<html><body>');
    var window = document.createWindow();

    jsdom.jQueryify(window, JQUERY_URL, function() {
	cb(window, document);
    });
}
*/

var escaped_one_to_xml_special_map = {
    '&amp;': '&',
    '&quot;': '"',
    '&apos;': "'", 
    '&lt;': '<',
    '&gt;': '>'
};

function decodeXml(string) {
    return string.replace(/(&quot;|&apos;|&lt;|&gt;|&amp;)/g,
			  function(str, item) {
			      return escaped_one_to_xml_special_map[item];
			  });
}


function create_window(cb) {
    jsdom.env('<html><body>', [ JQUERY_URL ], function(errors, window) {
	if (errors) {
	    throw new Error(errors[0]);
	}
	cb(window, window.document);
    });
}

function fetch_html(path, cb) {
    var html = fs.readFileSync(path).toString();
	cb(html);
}

// List of all CSS properties
// $("#section_1 li a")

// CSS Property summary
// $($("#section_1 p")[0]).text().trim().replace(/\n/g, " ").replace(/\s+/g, " ")

// CSS Property syntax
// $("#section_2 pre").text().trim().replace(/\n/g, " ").replace(/\s+/g, " ")

// CSS Pseudo Class summary
// $($("#section_1 p")[0]).text().trim().replace(/\n/g, " ").replace(/\s+/g, " ")

// CSS pseudo-selector syntax/example
// $("#section_2 pre").text().trim().replace(/\n+/g, "\n").replace(/\n/g, "\\n").replace(/\s+/g, " ")

function get_path_using_selector(window, document, selector, cb) {
	var fn = path.join(path.dirname(PATH_BASE), INDEX_NAME);
	fetch_html(fn, function(html) {
		document.innerHTML = html;
		var $ = window.$;
		var properties = $(selector).map(function() {
			return $(this).text().trim().split(/\s/)[0];
		}).toArray().filter(function(property) {
			return property.search(/firefox/i) === -1;
		});
		cb(properties);
	});
}

function get_css_property_paths(window, document, cb) {
	get_path_using_selector(window, document, "#section_1 li a", cb);
}

function get_css_pseudo_classes_paths(window, document, cb) {
	get_path_using_selector(window, document, "#section_25 li a, #section_26 li a", cb);
}

function start_parsing(dirs, window, document, summary_fetcher, syntax_fetcher, cb) {
    console.error("start_parsing: dirs:", dirs);

    var data = [ ];
    function parse_file(dirs, i, data) {

		var _p  = path.join(PATH_BASE, dirs[i]);
		fetch_html(_p, function(html) {
			console.error("Parsing file:", _p);
			
			document.innerHTML = html;
			var $ = window.$;
			var entry = {
				page: dirs[i], 
				synopsis: decodeXml(syntax_fetcher($)), 
				description: decodeXml(summary_fetcher($)), 
				url: URL_BASE + dirs[i]
			};
			
			data.push(entry);
			
			console.error("entry:", entry);
		});
    }

    for (var i = 0; i < dirs.length; ++i) {
		parse_file(dirs, i, data);
    }
    cb(data);
}


function parse_all_docs(window, document, cb) {
	var property_paths = get_css_property_paths(window, document, function(ppaths) {
		var pseudo_class_paths = get_css_pseudo_classes_paths(window, document, function(pcpaths) {
			start_parsing(ppaths, window, document, function($) {
				// Note: To screw yourself, move the dot(.) to the next line
				return $($("#section_1 p")[0]).text().
					trim().replace(/\n/g, " ").replace(/\s+/g, " ");
			}, function($) {
				return $("#section_2 pre").text().
					trim().replace(/\n/g, " ").replace(/\s+/g, " ");
			}, function(data) {
				start_parsing(pcpaths, window, document, function($) {
					return $($("#section_1 p")[0]).text().
						trim().replace(/\n/g, " ").replace(/\s+/g, " ");
				}, function($) {
					return $("#section_2 pre").text().
						trim().replace(/\n+/g, "\n").replace(/\n/g, "\\n").replace(/\s+/g, " ");
				}, function(data2) {
					data = data.concat(data2);
					cb(data);
				});
			});
		});
	});
}


function dump_to_file(docs) {
    var _d = docs.map(function(d) {
	return decodeXml([ d.page, '', d.url, d.description, 
			   d.synopsis, '', '', 'en' ].join('\t').replace(/\n/g, ' '));
    });
    fs.writeFileSync('css.docs.txt', _d.join('\n'));
}

function main() {
    create_window(function(window, document) {
	parse_all_docs(window, document, function(data) {
	    dump_to_file(data);
	    console.error("DONE!!");
	});
    });
}

main();


