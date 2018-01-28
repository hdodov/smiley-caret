var NOOP = function () {}
,   COLONCODE_REGEX = /^\:([a-z0-9\-]{3,})\:?$/
,   FOCUS_WATCHER_DELAY = 250
,   DOMAINS_NO_ALTER = ["facebook"];

var BEHAVIOR = {
    active: true,
    copy: false,
    shortcodes: true,
    coloncodes: true
};

var KEYS = {
    left:   37,
    up:     38,
    right:  39,
    down:   40,

    tab:    9,
    enter:  13,
    escape: 27,
    space:  32,
    backspace: 8
};