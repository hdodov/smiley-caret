// ---
// add keywords when searching
// fix dropdown positioning when it's too close to the edge (facebook chat search)

require('twemoji');
require('./modules/shortcodes.js');

var Config = require('./modules/_config.js');
var Utils = require('./modules/utils.js');
var Dropdown = require('./modules/dropdown.js');
var FocusWatcher = require('./modules/focus-watcher.js');
var ElementWatcher = require('./modules/element-watcher.js');
var StringBuffer = require('./modules/string-buffer.js');
var Matcher = require('./modules/matcher.js');

function replace(emoji, isViaUI) {
    var element = ElementWatcher.getElement();
    var search = StringBuffer.getBuffer();

    if (Config.behavior.copy) {
        Utils.clipWithSelection(emoji);
    }

    if (element) {
        if (element.hasAttribute("contenteditable")) {
            Utils.matchSelection(search, function (node, start, end) {
                var selection = window.getSelection();

                var range = selection.getRangeAt(selection.rangeCount - 1);
                range.setStart(node, start);
                range.setEnd(node, end);

                if (!Config.behavior.copy) {
                    range.deleteContents();
                    range.insertNode(document.createTextNode(emoji));

                    node.parentNode.normalize();
                    selection.collapseToEnd();
                }
            });
        } else {
            Utils.formReplace(element, search, emoji);
        }

        StringBuffer.reset();
    }
}

var UI = (function () {
    var exports = {};

    var _dropdown = null;

    function exists() {
        return (
            _dropdown &&
            _dropdown instanceof Dropdown &&
            !_dropdown.destroyed
        );
    }

    exports.createDropdown = function () {
        if (!exists()) {
            _dropdown = new Dropdown();
            _dropdown.onChoose = function (emoji) {
                replace(emoji, true);
            };
        }
    };

    exports.dropdownAction = function (callback) {
        if (exists()) {
            callback(_dropdown);
        }
    };

    exports.removeDropdown = function () {
        if (exists()) {
            _dropdown.remove();
            _dropdown = null;
        }
    };

    exports.dropdownExists = exists;

    return exports;
})();

FocusWatcher.onChange = function (element) {
    element = Utils.isElementEmojiEligible(element)
        ? element
        : null;

    ElementWatcher.changeElement(element);
};

ElementWatcher.onRebind = function () {
    StringBuffer.reset();
};

ElementWatcher.events = {
    keydown: function (event) {
        StringBuffer.handleKeyDown(event);
    },

    keypress: function (event) {
        StringBuffer.handleKeyPress(event);
        
        var self = this;
        setTimeout(function () {
            // Timeout needed because otherwise the positioning happens before
            // the character is inserted.
            UI.dropdownAction(function (dropdown) {
                dropdown.alignTo(self);
            });
        }, 0);
    },

    keyup: function (event) {
        var self = this;
        UI.dropdownAction(function (dropdown) {
            dropdown.alignTo(self);
        });
    },

    blur: StringBuffer.reset,
    click: StringBuffer.reset
};

StringBuffer.onClear = function () {
    UI.removeDropdown();
    Matcher.reset();
};

StringBuffer.onBreak = function () {
    Matcher.checkMatch();
};

StringBuffer.onChange = function (buffer) {
    if (Config.behavior.active) {
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