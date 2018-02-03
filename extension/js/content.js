// ---
// add keywords when searching
// fix dropdown positioning when it's too close to the edge (facebook chat search)

require('twemoji');
require('./modules/shortcodes.js');

var Utils = require('./modules/utils.js');
var UI = require('./modules/ui.js');
var FocusWatcher = require('./modules/focus-watcher.js');
var ElementWatcher = require('./modules/element-watcher.js');
var StringBuffer = require('./modules/string-buffer.js');
var Matcher = require('./modules/matcher.js');
var replace = require('./modules/replace.js');
var State = require('./modules/State.js');

FocusWatcher.onChange = function (element) {
    element = Utils.isElementEmojiEligible(element)
        ? element
        : null;

    ElementWatcher.changeElement(element);
};

ElementWatcher.on('rebind', StringBuffer.reset);
ElementWatcher.element.on('keydown', StringBuffer.handleKeyDown);

ElementWatcher.element.on('keypress', function (event) {
    StringBuffer.handleKeyPress(event);

    setTimeout(function () {
        // Timeout needed because otherwise the positioning happens before
        // the character is inserted.
        UI.dropdownAction(function (dropdown) {
            dropdown.alignTo(event.target);
        });
    }, 0);
});

ElementWatcher.element.on('keyup', function (event, element) {
    UI.dropdownAction(function (dropdown) {
        dropdown.alignTo(event.target);
    });
});

ElementWatcher.element.on('blur', StringBuffer.reset);
ElementWatcher.element.on('click', StringBuffer.reset);

StringBuffer.onClear = function () {
    UI.removeDropdown();
    Matcher.reset();
};

StringBuffer.onBreak = function () {
    Matcher.checkMatch();
};

StringBuffer.onChange = function (buffer) {
    console.log(buffer);
    if (State.getBehavior('active')) {
        Matcher.update(buffer);
    }
};

Matcher.onFlagsUpdate = function (flags) {
    if (flags.colonStart && !UI.dropdownExists()) {
        UI.createDropdown();
    }
};

Matcher.onColoncodeUpdate = function (codes) {
    if (codes && codes.length) {
        UI.dropdownAction(function (dropdown) {
            dropdown.show();
            dropdown.updateList(codes);
        });
    } else {
        UI.dropdownAction(function (dropdown) {
            dropdown.hide();
        });
    }
};

Matcher.onMatch = replace;

Matcher.onFlagsDown = function () {
    StringBuffer.reset();
};

require('./modules/state.js');