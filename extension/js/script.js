;(function() {
"use strict";

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
for (var i = 0; i < DOMAINS_NO_ALTER.length; i++) {
    if (window.location.hostname.indexOf(DOMAINS_NO_ALTER[i]) !== -1) {
        BEHAVIOR.copy = true;
        break;
    }
}

if (BEHAVIOR.copy) {
    BEHAVIOR.shortcodes = false;
}
function formReplace(elem, search, replace) {
    if (
        !elem ||
        typeof elem.value !== "string" ||
        typeof elem.selectionStart !== "number"
    ) {
        return false;
    }

    var value = elem.value,
        endIndex = elem.selectionStart,
        startIndex = endIndex - search.length;

    if (
        startIndex >= 0 &&
        endIndex > startIndex &&
        value.substr(startIndex, endIndex) === search
    ) {
        var before = value.substr(0, startIndex);
        var after = value.substr(endIndex);

        elem.value = before + replace + after;
    }
}

function matchSelection(search, callback) {
    var selection = window.getSelection();

    if (
        selection &&
        selection.focusNode &&
        selection.focusNode.nodeValue
    ) {
        var node = selection.focusNode;
        var endIndex = selection.focusOffset;
        var startIndex = endIndex - search.length;

        if (
            startIndex >= 0 &&
            endIndex > startIndex &&
            selection.rangeCount > 0 &&
            node.nodeValue.substring(startIndex, endIndex) === search
        ) {
            callback(node, startIndex, endIndex);
            return true;
        }
    }

    return false;
}

function isElementEmojiEligible(elem) {
    var forbidden = ["email", "password", "tel"]
    ,   type = elem.getAttribute("type")
    ,   name = elem.getAttribute("name");

    return (
        isElementEditable(elem) &&
        forbidden.indexOf(type) == -1 &&
        forbidden.indexOf(name) == -1
    );
}

function isElementEditable(elem) {
    return (elem && (
        elem.hasAttribute("contenteditable") ||
        elem.tagName === "TEXTAREA" ||
        elem.tagName === "INPUT"
    ));
}

function getElementBodyOffset(elem) {
    var viewportOffset = elem.getBoundingClientRect()
    ,   scrollTop = document.documentElement.scrollTop + document.body.scrollTop
    ,   scrollLeft = document.documentElement.scrollLeft + document.body.scrollLeft
    ,   offsetElem = elem
    ,   result = {
            top: 0,
            left: 0,
            fixed: false
        };

    do {
        var computed = window.getComputedStyle(offsetElem);

        if (computed && computed.position == "fixed") {
            result.fixed = true;
            break;
        }
    } while (offsetElem = offsetElem.offsetParent);

    result.top = viewportOffset.top;
    result.left = viewportOffset.left;

    if (!result.fixed) {
        result.top += scrollTop;
        result.left += scrollLeft;
    }

    return result;
}

function getContenteditableCaretBodyOffset() {
    var selection = window.getSelection(),
        range = selection.getRangeAt(selection.rangeCount - 1),
        clonedRange = range.cloneRange();

    var node = document.createElement("span");
    clonedRange.insertNode(node);

    var offset = getElementBodyOffset(node);

    var parent = node.parentNode;
    parent.removeChild(node);
    parent.normalize();

    return offset;
}

function isArrowKey(code) {
    return code >= KEYS.left && code <= KEYS.down;
}

function clipWithInput(text) {
    var input = document.createElement("input");
    document.body.appendChild(input);

    input.addEventListener("focus", function (e) {
        e.preventDefault();
        e.stopPropagation();
    });

    input.value = text;
    input.select();

    document.execCommand("copy");
    document.body.removeChild(input);
}

function clipWithSelection(text) {
    var node = document.createTextNode(text),
        selection = window.getSelection(),
        range = document.createRange(),
        clone = null;

    if (selection.rangeCount > 0) {
        clone = selection.getRangeAt(selection.rangeCount - 1).cloneRange();
    }

    document.body.appendChild(node);
    selection.removeAllRanges();
    range.selectNodeContents(node);
    selection.addRange(range);
    document.execCommand("copy");

    selection.removeAllRanges();
    document.body.removeChild(node);

    if (clone !== null) {
        selection.addRange(clone);
    }
}
function Dropdown(parent) {
    this.items = {};
    this.selectedItem = null;
    this.onChoose = NOOP;
    this.parent = parent || document.body;

    this.dropdown = document.createElement("div");
    this.dropdown.classList.add("smiley-caret-dropdown");

    this.container = document.createElement("div");
    this.container.classList.add("smiley-caret-container");
    this.dropdown.appendChild(this.container);

    if (BEHAVIOR.copy) {
        this.container.classList.add("behavior-copy");
    }

    this.parent.appendChild(this.dropdown);
} Dropdown.prototype = {
    createItem: function (name, emoji) {
        if (this.items[name]) return;

        var item = document.createElement("div");
        var emojiElem = document.createElement("span");
        var emojiElemChar = document.createElement("i");
        var emojiElemImg = document.createElement("img");
        var nameElem = document.createElement("p");

        emojiElemChar.appendChild(document.createTextNode(emoji));
        emojiElem.appendChild(emojiElemChar);
        emojiElem.appendChild(emojiElemImg);

        var imageMarkup = twemoji.parse(emoji)
        ,   imageSrcMatch = /src\=\"(.*)\"/.exec(imageMarkup)
        ,   imageSrc = (imageSrcMatch && imageSrcMatch[1]);
        
        if (imageSrc) {
            var tempImage = new Image();
            tempImage.onload = function () {
                emojiElem.classList.add("is-loaded");
            };

            tempImage.src = imageSrc;
            emojiElemImg.src = imageSrc;
        }

        item.appendChild(emojiElem);

        nameElem.appendChild(document.createTextNode(name));
        item.appendChild(nameElem);

        item.smileyCaret = {
            emoji: emoji,
            name: name
        };

        var self = this;
        item.addEventListener("mouseenter", function () {
            self.selectItem(this);
        });

        item.addEventListener("mousedown", function (event) {
            self.selectItem(this);
            self.chooseItem();
            event.preventDefault(); // to prevent loss of focus
            event.stopImmediatePropagation();
        });

        this.container.appendChild(item);
        this.items[name] = item;
    },

    chooseItem: function () {
        if (
            this.selectedItem &&
            this.selectedItem.smileyCaret &&
            this.selectedItem.smileyCaret.emoji
        ) {
            this.onChoose(this.selectedItem.smileyCaret.emoji);
        }  
    },

    selectItem: function (item) {
        if (this.selectedItem) {
            this.selectedItem.classList.remove("selected");
            this.selectedItem = null;
        }

        if (item) {
            item.classList.add("selected");
            this.selectedItem = item;
        }
    },

    updateList: function (list) {
        if (list.length === 0) return;

        for (var k in this.items) {
            this.items[k].parentNode.removeChild(this.items[k]);

            var exists = false;
            for (var i = 0; i < list.length; i++) {
                if (list[i][0] === k) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                delete this.items[k];
            }
        }

        for (var i = 0; i < list.length; i++) {
            var name = list[i][0]
            ,   emoji = list[i][1];

            if (this.items[name]) {
                this.container.appendChild(this.items[name]);
            } else {
                this.createItem(name, emoji);
            }
        }

        if (this.container.firstElementChild) {
            this.selectItem(this.container.firstElementChild);
        }
    },

    alignTo: function (elem) {
        var offset = null;

        if (elem.hasAttribute("contenteditable")) {
            offset = getContenteditableCaretBodyOffset();
        } else {
            offset = getElementBodyOffset(elem);
            offset.left += elem.clientWidth;
        }

        if (offset) {
            this.dropdown.style.left = offset.left + "px";
            this.dropdown.style.top = offset.top + "px";

            if (offset.fixed) {
                this.dropdown.classList.add("is-fixed");
            } else {
                this.dropdown.classList.remove("is-fixed");
            }
        }
    },

    show: function () {
        this.active = true;
        this.dropdown.classList.add("is-visible");
    },

    hide: function () {
        this.active = false;
        this.dropdown.classList.remove("is-visible");
    },

    remove: function () {
        this.hide();

        var self = this;
        setTimeout(function () {
            self.destroy();
        }, 500);
    },

    destroy: function () {
        if (this.destroyed) return;
        
        if (this.dropdown.parentNode) {
            this.dropdown.parentNode.removeChild(this.dropdown);
        }

        this.parent = null;
        this.items = null;
        this.selectedItem = null;
        this.dropdown = null;
        this.container = null;

        this.destroyed = true;
    }
};
// Checks the currently focused element over short interval and dispatches
// changes. The "focusin" event can't do the job because it can be cancelled.

var FocusWatcher = (function () {
    var exports = {
        onChange: NOOP
    };

    var _active = null,
        _emitted = null;

    setInterval(function () {
        if (document.activeElement !== _active) {
            _active = document.activeElement;
            exports.onChange(_active);
        }
    }, FOCUS_WATCHER_DELAY);

    return exports;
})();
var ElementWatcher = (function () {
    var exports = {
        onRebind: NOOP,
        events: {}
    };

    var _currentElem = null;

    function bindEvents(elem) {
        for (var k in exports.events) {
            if (typeof exports.events[k] === "function") {
                elem.addEventListener(k, exports.events[k]);
            }
        }
    }

    function unbindEvents(elem) {
        for (var k in exports.events) {
            elem.removeEventListener(k, exports.events[k]);
        }
    }

    exports.changeElement = function (newElement) {
        if (_currentElem) {
            unbindEvents(_currentElem);
            _currentElem = null;
        }

        if (newElement) {
            bindEvents(newElement);
            _currentElem = newElement;

            exports.onRebind();
        }
    };

    exports.getElement = function () {
        return _currentElem;
    };

    return exports;
})();
var StringBuffer = (function () {
    var exports = {
        onChange: NOOP,
        onClear: NOOP,
        onBreak: NOOP
    };

    var _buffer = "";

    function change(mutator, silent) {
        var cache = _buffer;
        _buffer = mutator(_buffer);

        if (
            _buffer !== cache &&
            typeof _buffer === "string"
        ) {
            if (silent !== true) {
                exports.onChange(_buffer, cache);
            }

            if (_buffer.length === 0) {
                exports.onClear();
            }
        }
    }

    function clear() {
        change(function () {
            return "";
        }, true);
    }

    exports.handleKeyPress = function (event) {
        change(function (buffer) {
            if (event.which !== KEYS.space) {
                return buffer + event.key;
            } else {
                return buffer;
            }
        });
    };

    exports.handleKeyDown = function (event) {
        if (
            event.which === KEYS.enter ||
            event.which === KEYS.space
        ) {
            exports.onBreak(_buffer);
            clear();
            return;
        }

        //                              selection is not a single character (ctrl+A)
        if (isArrowKey(event.which) || !(window.getSelection().isCollapsed)) {
            clear();
            return;
        }

        if (event.which === KEYS.backspace) {
            change(function (buffer) {
                return buffer.slice(0, -1);
            });
        }
    };

    exports.reset = clear;
    exports.getBuffer = function () {
        return _buffer;
    };

    return exports;
})();
var Matcher = (function () {
    var exports = {
        onMatch: NOOP,
        onColoncodeUpdate: NOOP,
        onFlagsUpdate: NOOP,
        onFlagsDown: NOOP
    };

    var _flags = {},
        _coloncodes = [];

    function resetFlags() {
        _flags.shortcode = false;
        _flags.colonStart = false;
        _flags.coloncode = false;
        exports.onFlagsUpdate(_flags);
    }

    function updateColoncodes(data) {
        _coloncodes = data || [];
        exports.onColoncodeUpdate(_coloncodes);
    }

    function searchForColoncodes(buffer) {
        chrome.runtime.sendMessage({
            id: "get_coloncodes",
            search: buffer
        }, function (data) {
            updateColoncodes(data);
        });
    }

    function flagsDown() {
        var allDown = true;

        if (
            _flags.shortcode !== false ||
            _flags.colonStart === true || 
            _flags.coloncode !== false
        ) {
            allDown = false;
        }

        return allDown;
    }

    function isPartOfColoncode(buffer) {
        var match = buffer.match(COLONCODE_REGEX);

        if (match !== null && match.length) {
            return match[1];
        } else {
            return false;
        }
    }

    function updateFlags(buffer) {
        if (BEHAVIOR.coloncodes) {
            if (buffer.length === 1 && buffer[0] === ":") {
                _flags.colonStart = true;
            }

            if (_flags.colonStart) {
                _flags.coloncode = isPartOfColoncode(buffer);
            }
        }

        if (BEHAVIOR.shortcodes) {
            _flags.shortcode = SmileyCaretShortcodes.isPart(buffer) ? buffer : false;
        }

        exports.onFlagsUpdate(_flags);
    }

    exports.reset = function () {
        resetFlags();
        updateColoncodes(null);
    };

    exports.checkMatch = function (buffer) {
        if (_flags.shortcode) {
            var shortcode = SmileyCaretShortcodes.get(_flags.shortcode);

            if (shortcode !== null) {
                exports.onMatch(shortcode);
            }
        }

        if (_flags.coloncode) {
            for (var i = 0; i < _coloncodes.length; i++) {
                if (_coloncodes[i][0] === _flags.coloncode) {
                    exports.onMatch(_coloncodes[i][1]);
                }
            }
        }   
    };

    exports.update = function (buffer) {
        updateFlags(buffer);

        if (flagsDown()) {
            exports.onFlagsDown();
        } else {
            if (_flags.coloncode) {
                searchForColoncodes(_flags.coloncode);
            } else {
                updateColoncodes(null);
            }
        }
    };

    resetFlags();
    return exports;
})();
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
function updateActiveState() {
    chrome.storage.local.get("active", function (data) {
        BEHAVIOR.active = (data.active !== false);

        if (!BEHAVIOR.active) {
            StringBuffer.reset();
        }
    });
}

chrome.runtime.onMessage.addListener(function (request, sender, respond) {
    if (request.id == "update_active_state") {
        updateActiveState();
    }
});

updateActiveState();
}());
