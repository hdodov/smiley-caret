// ---
// add keywords when searching
// fix dropdown positioning when it's too close to the edge (facebook chat search)

var Utils = require('./modules/utils.js');
var UI = require('./modules/ui.js');
var FocusWatcher = require('./modules/focus-watcher.js');
var ElementWatcher = require('./modules/element-watcher.js');
var StringBuffer = require('./modules/string-buffer.js');
var Matcher = require('./modules/matcher.js');
var replace = require('./modules/replace.js');
var State = require('./modules/State.js');

FocusWatcher.on('change', function (element) {
    if (Utils.isElementEmojiEligible(element)) {
        ElementWatcher.changeElement(element);
    } else {
        ElementWatcher.changeElement(null);
    }
});

ElementWatcher.on('rebind', StringBuffer.clear);
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

ElementWatcher.element.on('blur', StringBuffer.clear);
ElementWatcher.element.on('click', StringBuffer.clear);

StringBuffer.on('clear', function () {
    UI.removeDropdown();
    Matcher.reset();
});

StringBuffer.on('break', Matcher.checkMatch);

StringBuffer.on('change', function (buffer) {
    if (State.getBehavior('active')) {
        Matcher.update(buffer);
    }
});

Matcher.on('flags_update', function (flags) {
    if (flags.colonStart && !UI.dropdownExists()) {
        UI.createDropdown();
    }
});

Matcher.on('coloncode_update', function (codes) {
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
});

Matcher.on('match', replace);
Matcher.on('flags_down', StringBuffer.clear);

require('./modules/state.js');