// ==UserScript==
// @name          Amazon International Links
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       1.0.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @description   Add international links to Amazon product pages
// @include       http://www.amazon.ca/*
// @include       http://www.amazon.cn/*
// @include       http://www.amazon.co.jp/*
// @include       http://www.amazon.com/*
// @include       http://www.amazon.co.uk/*
// @include       http://www.amazon.de/*
// @include       http://www.amazon.es/*
// @include       http://www.amazon.fr/*
// @include       http://www.amazon.it/*
// @include       https://www.amazon.ca/*
// @include       https://www.amazon.cn/*
// @include       https://www.amazon.co.jp/*
// @include       https://www.amazon.com/*
// @include       https://www.amazon.co.uk/*
// @include       https://www.amazon.de/*
// @include       https://www.amazon.es/*
// @include       https://www.amazon.fr/*
// @include       https://www.amazon.it/*
// @require       https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js
// @require       https://raw.github.com/sizzlemctwizzle/GM_config/master/gm_config.js
// @require       https://sprintf.googlecode.com/files/sprintf-0.7-beta1.js
// @require       http://documentcloud.github.com/underscore/underscore-min.js
// ==/UserScript==

/*
 * @requires:
 *
 * jQuery 1.7.1
 *
 *     https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.js
 *
 * GM_config
 *
 *     https://github.com/sizzlemctwizzle/GM_config/wiki
 *
 * sprintf() for JavaScript
 *
 *     http://www.diveintojavascript.com/projects/javascript-sprintf
 *
 * Underscore.js utility library
 *
 *     http://documentcloud.github.com/underscore/
 */

/*
 *
 * further reading:
 *
 *     http://helpful.knobs-dials.com/index.php/Amazon_notes#Links
 */

/*********************** Constants ********************************/

// these are all initialized lazily (hence "var" instead of "const")
// XXX this is a pointless optimisation if thousands of lines of jQuery, sprintf &c. are executed for every Amazon page
var ASIN, CROSS_SITE_LINK_CLASS, CURRENT_TLD, LINKS, MODERN, PROTOCOL, SITES;
var $CROSS_SHOP_LINKS, $LINK, $SEPARATOR; // the $ sigil denotes jQuery objects

// convenience function to reduce the verbosity of Underscore.js chaining
// see: http://github.com/documentcloud/underscore/issues/issue/37
function __(obj) { return _(obj).chain() }

/*********************** Functions ********************************/

// lazily initialize constants - these are only assigned if the ASIN is found
function initializeConstants(asin) {
    var location = document.location;

    $CROSS_SHOP_LINKS = $('#nav-cross-shop-links'); // the cross-site/shop links container in the "modern" design

    if ($CROSS_SHOP_LINKS.length) {
        MODERN = true;
    } else {
        CROSS_SITE_LINK_CLASS = 'navCrossshopYALink'; // the CSS class for cross-site links in the "classic" design
        $LINK = $('a.' + CROSS_SITE_LINK_CLASS).eq(-2); // the penultimate Amazon cross-site link e.g. "Your Account"
        $SEPARATOR = $LINK.next(); // a span with a spaced vertical bar
        MODERN = false;
    }

    ASIN = asin; // the unique Amazon identifier for this product
    CURRENT_TLD = location.hostname.substr('www.amazon.'.length); // one of the 8 current Amazon TLDs
    LINKS = []; // an array of our added elements - jQuery objects representing alternating links and separators
    PROTOCOL = location.protocol; // http: or https:
    SITES = { // a map from the Amazon TLD to the corresponding two-letter country code
        'ca'    : 'CA',
        'cn'    : 'CN',
        'de'    : 'DE',
        'es'    : 'ES',
        'fr'    : 'FR',
        'it'    : 'IT',
        'co.jp' : 'JP',
        'co.uk' : 'UK', // technically (shmecnically), this should be GB: http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
        'com'   : 'US'
    };
}

// build the underlying data model used by the GM_config utility
function initializeConfig() {
    var checkboxes = __(SITES).keys().foldl(
        function(fields, tld) {
            var country = SITES[tld];
            fields[tld] = {
                type: 'checkbox',
                label: country,
                title: sprintf('amazon.%s', tld),
                default: (country == 'UK' || country == 'US')
            };
            return fields;
        },
        {}
    ).value();

    // re-render the links if the settings are updated
    var callbacks = {
        save: function() { removeLinks(); addLinks() }
    };

    GM_config.init('Amazon International Links Settings', checkboxes, callbacks);
}

// display the settings manager
function showConfig() {
    GM_config.open();
}

// return the subset of the TLD -> country code map (SITES) corresponding to the enabled sites
function getConfiguredSites() {
    return __(SITES).keys().foldl(
        function(sites, tld) {
            if (GM_config.get(tld)) {
                sites[tld] = SITES[tld];
            }
            return sites;
        },
        {}
    ).value();
}

// remove all added links from the DOM and clear the array referencing them
function removeLinks() {
    _(LINKS).each(function(el) { el.remove() });
    LINKS.length = 0; // clear the array of links and separators
}

function classicAddLink(tld, country) {
    var html;

    if (tld == CURRENT_TLD) {
        html = sprintf('<strong title="amazon.%s">%s</strong>', tld, country);
    } else {
        html = sprintf(
            '<a href="%s//www.amazon.%s/dp/%s" class="%s" title="amazon.%2$s">%s</a>',
            PROTOCOL, tld, ASIN, CROSS_SITE_LINK_CLASS, country
        );
    }

    LINKS.push($(html), $SEPARATOR.clone());
}

function modernAddLink(tld, country) {
    var html;

    if (tld == CURRENT_TLD) {
        html = sprintf('<li class="nav-xs-link"><strong title="amazon.%s">%s</strong></li>', tld, country);
    } else {
        html = sprintf(
            '<li class="nav-xs-link"><a href="%s//www.amazon.%s/dp/%s" title="amazon.%2$s">%s</a></li>',
            PROTOCOL, tld, ASIN, country
        );
    }

    LINKS.push($(html));
}

// prepend the cross-site links to the "Your Account" link
function classicDisplayLinks() {
    $LINK.before.apply($LINK, LINKS);
}

// append the cross-site links to the body of the nav-cross-shop-links <ul> element
function modernDisplayLinks() {
    $CROSS_SHOP_LINKS.append.apply($CROSS_SHOP_LINKS, LINKS);
}

// populate an array of links and display them by prepending them to the body of the cross-site navigation bar
function addLinks() {
    var sites = getConfiguredSites();

    if (!_.isEmpty(sites)) {
        var tlds = __(sites).keys().sortBy(function(tld) { return sites[tld] }).value();
        var addLink, displayLinks;

        if (MODERN) {
            addLink = modernAddLink;
            displayLinks = modernDisplayLinks;
        } else {
            addLink = classicAddLink;
            displayLinks = classicDisplayLinks;
        }

        _(tlds).each(function(tld) {
            var country = sites[tld];
            addLink(tld, country);
        });

        displayLinks();
    }
}

/*********************** Main ********************************/

var $temp = $('input#ASIN, input[name="ASIN"], input[name="ASIN.0"]');

if ($temp.length) {
    initializeConstants($temp.val());
    initializeConfig();
    GM_registerMenuCommand('Configure Amazon International Links', showConfig);
    addLinks();
}
