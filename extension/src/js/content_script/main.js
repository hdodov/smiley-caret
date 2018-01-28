// ---
// add keywords when searching
// fix dropdown positioning when it's too close to the edge (facebook chat search)

function replace(emoji, isViaUI) {
    var element = ElementWatcher.getElement();
    var search = StringBuffer.getBuffer();

    if (BEHAVIOR.copy) {
        clipWithSelection(emoji);
    }

    if (element) {
        if (element.hasAttribute("contenteditable")) {
            matchSelection(search, function (node, start, end) {
                var selection = window.getSelection();

                var range = selection.getRangeAt(selection.rangeCount - 1);
                range.setStart(node, start);
                range.setEnd(node, end);

                if (!BEHAVIOR.copy) {
                    range.deleteContents();
                    range.insertNode(document.createTextNode(emoji));

                    node.parentNode.normalize();
                    selection.collapseToEnd();
                }
            });
        } else {
            formReplace(element, search, emoji);
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
    element = isElementEmojiEligible(element)
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
    if (BEHAVIOR.active) {
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