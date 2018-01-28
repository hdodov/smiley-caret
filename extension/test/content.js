(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports={":D":"😀","':D":"😅","xD":"😆",";)":"😉","^^":"😊",":p":"😋","8)":"😎",":*":"😘",":3":"😗",":)":"🙂",":?":"🤔",":|":"😐","-_-":"😑",":x":"😶",":X":"😶","|-(":"🙄",":O":"😮",":o":"😯","D:":"😫","|-)":"😴",":P":"😛",";P":"😜",":/":"😕","(:":"🙃","8O":"😲",":(":"🙁",";(":"😢",":@":"🤬",">:)":"😈","<3":"❤️"};
},{}],2:[function(require,module,exports){
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
},{"./modules/_config.js":3,"./modules/dropdown.js":4,"./modules/element-watcher.js":5,"./modules/focus-watcher.js":6,"./modules/matcher.js":7,"./modules/shortcodes.js":8,"./modules/state.js":9,"./modules/string-buffer.js":10,"./modules/utils.js":11,"twemoji":12}],3:[function(require,module,exports){
module.exports = {
    general: {
        domains_no_alter: ['facebook']
    },

    behavior: {
        active: true,
        copy: false,
        shortcodes: true,
        coloncodes: true
    },

    keys: {
        left:   37,
        up:     38,
        right:  39,
        down:   40,

        tab:    9,
        enter:  13,
        escape: 27,
        space:  32,
        backspace: 8
    }
};

// for (var i = 0; i < module.exports.general.domains_no_alter.length; i++) {
//     if (window.location.hostname.indexOf(module.exports.general.domains_no_alter[i]) !== -1) {
//         BEHAVIOR.copy = true;
//         break;
//     }
// }

// if (BEHAVIOR.copy) {
//     BEHAVIOR.shortcodes = false;
// }
},{}],4:[function(require,module,exports){
var Config = require('./_config.js');
var Utils = require('./utils.js');
var twemoji = require('twemoji');

function Dropdown(parent) {
    this.items = {};
    this.selectedItem = null;
    this.onChoose = function () {};
    this.parent = parent || document.body;

    this.dropdown = document.createElement("div");
    this.dropdown.classList.add("smiley-caret-dropdown");

    this.container = document.createElement("div");
    this.container.classList.add("smiley-caret-container");
    this.dropdown.appendChild(this.container);

    if (Config.behavior.copy) {
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
            offset = Utils.getContenteditableCaretBodyOffset();
        } else {
            offset = Utils.getElementBodyOffset(elem);
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

module.exports = Dropdown;
},{"./_config.js":3,"./utils.js":11,"twemoji":12}],5:[function(require,module,exports){
module.exports = (function () {
    var exports = {
        onRebind: function () {},
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
},{}],6:[function(require,module,exports){
// Checks the currently focused element over short interval and dispatches
// changes. The "focusin" event can't do the job because it can be cancelled.

module.exports = (function () {
    var _config = {
        interval: 250
    };

    var exports = {
        onChange: function () {}
    };

    var _active = null,
        _emitted = null;

    setInterval(function () {
        if (document.activeElement !== _active) {
            _active = document.activeElement;
            exports.onChange(_active);
        }
    }, _config.interval);

    return exports;
})();
},{}],7:[function(require,module,exports){
var Config = require('./_config.js');
var Shortcodes = require('./shortcodes.js');

module.exports = (function () {
    var exports = {
        onMatch: function () {},
        onColoncodeUpdate: function () {},
        onFlagsUpdate: function () {},
        onFlagsDown: function () {}
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
        var match = buffer.match(/^\:([a-z0-9\-]{3,})\:?$/);

        if (match !== null && match.length) {
            return match[1];
        } else {
            return false;
        }
    }

    function updateFlags(buffer) {
        if (Config.behavior.coloncodes) {
            if (buffer.length === 1 && buffer[0] === ":") {
                _flags.colonStart = true;
            }

            if (_flags.colonStart) {
                _flags.coloncode = isPartOfColoncode(buffer);
            }
        }

        if (Config.behavior.shortcodes) {
            _flags.shortcode = Shortcodes.isPart(buffer) ? buffer : false;
        }

        exports.onFlagsUpdate(_flags);
    }

    exports.reset = function () {
        resetFlags();
        updateColoncodes(null);
    };

    exports.checkMatch = function (buffer) {
        if (_flags.shortcode) {
            var shortcode = Shortcodes.get(_flags.shortcode);

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
},{"./_config.js":3,"./shortcodes.js":8}],8:[function(require,module,exports){
var Shortcodes = require('../../data/shortcodes.js');

module.exports = (function () {
    var exports = {};

    var _sets = getSets(Shortcodes);

    function getSets(list) {
        var sets = [];

        for (var code in list) {
            for (var i = 0; i < code.length; i++) {
                sets[i] = sets[i] || [];

                if (sets[i].indexOf(code[i]) === -1) {
                    sets[i].push(code[i]);
                }
            }
        }

        return sets;
    }

    exports.isPart = function (str) {
        for (var i = str.length - 1; i >= 0; i--) {
            if (!_sets[i] || _sets[i].indexOf(str[i]) === -1) {
                return false;
            }
        }

        return true;
    };

    exports.get = function (key) {
        if (Shortcodes[key]) {
            return Shortcodes[key];
        } else {
            return null;
        }
    };

    exports.getAll = function () {
        return Shortcodes;
    };

    return exports;
})();
},{"../../data/shortcodes.js":1}],9:[function(require,module,exports){
var Config = require('./_config.js');

function updateActiveState() {
    chrome.storage.local.get("active", function (data) {
        Config.behavior.active = (data.active !== false);

        if (!Config.behavior.active) {
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
},{"./_config.js":3}],10:[function(require,module,exports){
var Config = require('./_config.js');
var Utils = require('./utils.js');

module.exports = (function () {
    var exports = {
        onChange: function () {},
        onClear: function () {},
        onBreak: function () {}
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
            if (event.which !== Config.keys.space) {
                return buffer + event.key;
            } else {
                return buffer;
            }
        });
    };

    exports.handleKeyDown = function (event) {
        if (
            event.which === Config.keys.enter ||
            event.which === Config.keys.space
        ) {
            exports.onBreak(_buffer);
            clear();
            return;
        }

        //                              selection is not a single character (ctrl+A)
        if (Utils.isArrowKey(event.which) || !(window.getSelection().isCollapsed)) {
            clear();
            return;
        }

        if (event.which === Config.keys.backspace) {
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
},{"./_config.js":3,"./utils.js":11}],11:[function(require,module,exports){
var Config = require('./_config.js');

module.exports = {
    formReplace: function (elem, search, replace) {
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
    },

    matchSelection: function (search, callback) {
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
    },

    isElementEmojiEligible: function (elem) {
        var forbidden = ["email", "password", "tel"]
        ,   type = elem.getAttribute("type")
        ,   name = elem.getAttribute("name");

        return (
            this.isElementEditable(elem) &&
            forbidden.indexOf(type) == -1 &&
            forbidden.indexOf(name) == -1
        );
    },

    isElementEditable: function (elem) {
        return (elem && (
            elem.hasAttribute("contenteditable") ||
            elem.tagName === "TEXTAREA" ||
            elem.tagName === "INPUT"
        ));
    },

    getElementBodyOffset: function (elem) {
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
    },

    getContenteditableCaretBodyOffset: function () {
        var selection = window.getSelection(),
            range = selection.getRangeAt(selection.rangeCount - 1),
            clonedRange = range.cloneRange();

        var node = document.createElement("span");
        clonedRange.insertNode(node);

        var offset = this.getElementBodyOffset(node);

        var parent = node.parentNode;
        parent.removeChild(node);
        parent.normalize();

        return offset;
    },

    isArrowKey: function (code) {
        return code >= Config.keys.left && code <= Config.keys.down;
    },

    clipWithInput: function (text) {
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
    },

    clipWithSelection: function (text) {
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
};
},{"./_config.js":3}],12:[function(require,module,exports){
(function (global){
var location = global.location || {};
/*jslint indent: 2, browser: true, bitwise: true, plusplus: true */
var twemoji = (function (
  /*! Copyright Twitter Inc. and other contributors. Licensed under MIT *//*
    https://github.com/twitter/twemoji/blob/gh-pages/LICENSE
  */

  // WARNING:   this file is generated automatically via
  //            `node twemoji-generator.js`
  //            please update its `createTwemoji` function
  //            at the bottom of the same file instead.

) {
  'use strict';

  /*jshint maxparams:4 */

  var
    // the exported module object
    twemoji = {


    /////////////////////////
    //      properties     //
    /////////////////////////

      // default assets url, by default will be Twitter Inc. CDN
      base: 'https://twemoji.maxcdn.com/2/',

      // default assets file extensions, by default '.png'
      ext: '.png',

      // default assets/folder size, by default "72x72"
      // available via Twitter CDN: 72
      size: '72x72',

      // default class name, by default 'emoji'
      className: 'emoji',

      // basic utilities / helpers to convert code points
      // to JavaScript surrogates and vice versa
      convert: {

        /**
         * Given an HEX codepoint, returns UTF16 surrogate pairs.
         *
         * @param   string  generic codepoint, i.e. '1F4A9'
         * @return  string  codepoint transformed into utf16 surrogates pair,
         *          i.e. \uD83D\uDCA9
         *
         * @example
         *  twemoji.convert.fromCodePoint('1f1e8');
         *  // "\ud83c\udde8"
         *
         *  '1f1e8-1f1f3'.split('-').map(twemoji.convert.fromCodePoint).join('')
         *  // "\ud83c\udde8\ud83c\uddf3"
         */
        fromCodePoint: fromCodePoint,

        /**
         * Given UTF16 surrogate pairs, returns the equivalent HEX codepoint.
         *
         * @param   string  generic utf16 surrogates pair, i.e. \uD83D\uDCA9
         * @param   string  optional separator for double code points, default='-'
         * @return  string  utf16 transformed into codepoint, i.e. '1F4A9'
         *
         * @example
         *  twemoji.convert.toCodePoint('\ud83c\udde8\ud83c\uddf3');
         *  // "1f1e8-1f1f3"
         *
         *  twemoji.convert.toCodePoint('\ud83c\udde8\ud83c\uddf3', '~');
         *  // "1f1e8~1f1f3"
         */
        toCodePoint: toCodePoint
      },


    /////////////////////////
    //       methods       //
    /////////////////////////

      /**
       * User first: used to remove missing images
       * preserving the original text intent when
       * a fallback for network problems is desired.
       * Automatically added to Image nodes via DOM
       * It could be recycled for string operations via:
       *  $('img.emoji').on('error', twemoji.onerror)
       */
      onerror: function onerror() {
        if (this.parentNode) {
          this.parentNode.replaceChild(createText(this.alt, false), this);
        }
      },

      /**
       * Main method/logic to generate either <img> tags or HTMLImage nodes.
       *  "emojify" a generic text or DOM Element.
       *
       * @overloads
       *
       * String replacement for `innerHTML` or server side operations
       *  twemoji.parse(string);
       *  twemoji.parse(string, Function);
       *  twemoji.parse(string, Object);
       *
       * HTMLElement tree parsing for safer operations over existing DOM
       *  twemoji.parse(HTMLElement);
       *  twemoji.parse(HTMLElement, Function);
       *  twemoji.parse(HTMLElement, Object);
       *
       * @param   string|HTMLElement  the source to parse and enrich with emoji.
       *
       *          string              replace emoji matches with <img> tags.
       *                              Mainly used to inject emoji via `innerHTML`
       *                              It does **not** parse the string or validate it,
       *                              it simply replaces found emoji with a tag.
       *                              NOTE: be sure this won't affect security.
       *
       *          HTMLElement         walk through the DOM tree and find emoji
       *                              that are inside **text node only** (nodeType === 3)
       *                              Mainly used to put emoji in already generated DOM
       *                              without compromising surrounding nodes and
       *                              **avoiding** the usage of `innerHTML`.
       *                              NOTE: Using DOM elements instead of strings should
       *                              improve security without compromising too much
       *                              performance compared with a less safe `innerHTML`.
       *
       * @param   Function|Object  [optional]
       *                              either the callback that will be invoked or an object
       *                              with all properties to use per each found emoji.
       *
       *          Function            if specified, this will be invoked per each emoji
       *                              that has been found through the RegExp except
       *                              those follwed by the invariant \uFE0E ("as text").
       *                              Once invoked, parameters will be:
       *
       *                                iconId:string     the lower case HEX code point
       *                                                  i.e. "1f4a9"
       *
       *                                options:Object    all info for this parsing operation
       *
       *                                variant:char      the optional \uFE0F ("as image")
       *                                                  variant, in case this info
       *                                                  is anyhow meaningful.
       *                                                  By default this is ignored.
       *
       *                              If such callback will return a falsy value instead
       *                              of a valid `src` to use for the image, nothing will
       *                              actually change for that specific emoji.
       *
       *
       *          Object              if specified, an object containing the following properties
       *
       *            callback   Function  the callback to invoke per each found emoji.
       *            base       string    the base url, by default twemoji.base
       *            ext        string    the image extension, by default twemoji.ext
       *            size       string    the assets size, by default twemoji.size
       *
       * @example
       *
       *  twemoji.parse("I \u2764\uFE0F emoji!");
       *  // I <img class="emoji" draggable="false" alt="❤️" src="/assets/2764.gif"/> emoji!
       *
       *
       *  twemoji.parse("I \u2764\uFE0F emoji!", function(iconId, options) {
       *    return '/assets/' + iconId + '.gif';
       *  });
       *  // I <img class="emoji" draggable="false" alt="❤️" src="/assets/2764.gif"/> emoji!
       *
       *
       * twemoji.parse("I \u2764\uFE0F emoji!", {
       *   size: 72,
       *   callback: function(iconId, options) {
       *     return '/assets/' + options.size + '/' + iconId + options.ext;
       *   }
       * });
       *  // I <img class="emoji" draggable="false" alt="❤️" src="/assets/72x72/2764.png"/> emoji!
       *
       */
      parse: parse,

      /**
       * Given a string, invokes the callback argument
       *  per each emoji found in such string.
       * This is the most raw version used by
       *  the .parse(string) method itself.
       *
       * @param   string    generic string to parse
       * @param   Function  a generic callback that will be
       *                    invoked to replace the content.
       *                    This calback wil receive standard
       *                    String.prototype.replace(str, callback)
       *                    arguments such:
       *  callback(
       *    rawText,  // the emoji match
       *  );
       *
       *                    and others commonly received via replace.
       */
      replace: replace,

      /**
       * Simplify string tests against emoji.
       *
       * @param   string  some text that might contain emoji
       * @return  boolean true if any emoji was found, false otherwise.
       *
       * @example
       *
       *  if (twemoji.test(someContent)) {
       *    console.log("emoji All The Things!");
       *  }
       */
      test: test
    },

    // used to escape HTML special chars in attributes
    escaper = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    },

    // RegExp based on emoji's official Unicode standards
    // http://www.unicode.org/Public/UNIDATA/EmojiSources.txt
    re = /\ud83d[\udc68-\udc69](?:\ud83c[\udffb-\udfff])?\u200d(?:\u2695\ufe0f|\u2696\ufe0f|\u2708\ufe0f|\ud83c[\udf3e\udf73\udf93\udfa4\udfa8\udfeb\udfed]|\ud83d[\udcbb\udcbc\udd27\udd2c\ude80\ude92])|(?:\ud83c[\udfcb\udfcc]|\ud83d\udd75|\u26f9)(?:\ufe0f|\ud83c[\udffb-\udfff])\u200d[\u2640\u2642]\ufe0f|(?:\ud83c[\udfc3\udfc4\udfca]|\ud83d[\udc6e\udc71\udc73\udc77\udc81\udc82\udc86\udc87\ude45-\ude47\ude4b\ude4d\ude4e\udea3\udeb4-\udeb6]|\ud83e[\udd26\udd37-\udd39\udd3d\udd3e\uddd6-\udddd])(?:\ud83c[\udffb-\udfff])?\u200d[\u2640\u2642]\ufe0f|\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d\udc68|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d[\udc68\udc69]|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc68|\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d[\udc68\udc69]|\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83c\udff3\ufe0f\u200d\ud83c\udf08|\ud83c\udff4\u200d\u2620\ufe0f|\ud83d\udc41\u200d\ud83d\udde8|\ud83d\udc68\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83d\udc6f\u200d\u2640\ufe0f|\ud83d\udc6f\u200d\u2642\ufe0f|\ud83e\udd3c\u200d\u2640\ufe0f|\ud83e\udd3c\u200d\u2642\ufe0f|\ud83e\uddde\u200d\u2640\ufe0f|\ud83e\uddde\u200d\u2642\ufe0f|\ud83e\udddf\u200d\u2640\ufe0f|\ud83e\udddf\u200d\u2642\ufe0f|(?:[\u0023\u002a\u0030-\u0039])\ufe0f?\u20e3|(?:(?:\ud83c[\udfcb\udfcc]|\ud83d[\udd74\udd75\udd90]|[\u261d\u26f7\u26f9\u270c\u270d])(?:\ufe0f|(?!\ufe0e))|\ud83c[\udf85\udfc2-\udfc4\udfc7\udfca]|\ud83d[\udc42\udc43\udc46-\udc50\udc66-\udc69\udc6e\udc70-\udc78\udc7c\udc81-\udc83\udc85-\udc87\udcaa\udd7a\udd95\udd96\ude45-\ude47\ude4b-\ude4f\udea3\udeb4-\udeb6\udec0\udecc]|\ud83e[\udd18-\udd1c\udd1e\udd1f\udd26\udd30-\udd39\udd3d\udd3e\uddd1-\udddd]|[\u270a\u270b])(?:\ud83c[\udffb-\udfff]|)|\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc65\udb40\udc6e\udb40\udc67\udb40\udc7f|\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc73\udb40\udc63\udb40\udc74\udb40\udc7f|\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc77\udb40\udc6c\udb40\udc73\udb40\udc7f|\ud83c\udde6\ud83c[\udde8-\uddec\uddee\uddf1\uddf2\uddf4\uddf6-\uddfa\uddfc\uddfd\uddff]|\ud83c\udde7\ud83c[\udde6\udde7\udde9-\uddef\uddf1-\uddf4\uddf6-\uddf9\uddfb\uddfc\uddfe\uddff]|\ud83c\udde8\ud83c[\udde6\udde8\udde9\uddeb-\uddee\uddf0-\uddf5\uddf7\uddfa-\uddff]|\ud83c\udde9\ud83c[\uddea\uddec\uddef\uddf0\uddf2\uddf4\uddff]|\ud83c\uddea\ud83c[\udde6\udde8\uddea\uddec\udded\uddf7-\uddfa]|\ud83c\uddeb\ud83c[\uddee-\uddf0\uddf2\uddf4\uddf7]|\ud83c\uddec\ud83c[\udde6\udde7\udde9-\uddee\uddf1-\uddf3\uddf5-\uddfa\uddfc\uddfe]|\ud83c\udded\ud83c[\uddf0\uddf2\uddf3\uddf7\uddf9\uddfa]|\ud83c\uddee\ud83c[\udde8-\uddea\uddf1-\uddf4\uddf6-\uddf9]|\ud83c\uddef\ud83c[\uddea\uddf2\uddf4\uddf5]|\ud83c\uddf0\ud83c[\uddea\uddec-\uddee\uddf2\uddf3\uddf5\uddf7\uddfc\uddfe\uddff]|\ud83c\uddf1\ud83c[\udde6-\udde8\uddee\uddf0\uddf7-\uddfb\uddfe]|\ud83c\uddf2\ud83c[\udde6\udde8-\udded\uddf0-\uddff]|\ud83c\uddf3\ud83c[\udde6\udde8\uddea-\uddec\uddee\uddf1\uddf4\uddf5\uddf7\uddfa\uddff]|\ud83c\uddf4\ud83c\uddf2|\ud83c\uddf5\ud83c[\udde6\uddea-\udded\uddf0-\uddf3\uddf7-\uddf9\uddfc\uddfe]|\ud83c\uddf6\ud83c\udde6|\ud83c\uddf7\ud83c[\uddea\uddf4\uddf8\uddfa\uddfc]|\ud83c\uddf8\ud83c[\udde6-\uddea\uddec-\uddf4\uddf7-\uddf9\uddfb\uddfd-\uddff]|\ud83c\uddf9\ud83c[\udde6\udde8\udde9\uddeb-\udded\uddef-\uddf4\uddf7\uddf9\uddfb\uddfc\uddff]|\ud83c\uddfa\ud83c[\udde6\uddec\uddf2\uddf3\uddf8\uddfe\uddff]|\ud83c\uddfb\ud83c[\udde6\udde8\uddea\uddec\uddee\uddf3\uddfa]|\ud83c\uddfc\ud83c[\uddeb\uddf8]|\ud83c\uddfd\ud83c\uddf0|\ud83c\uddfe\ud83c[\uddea\uddf9]|\ud83c\uddff\ud83c[\udde6\uddf2\uddfc]|\ud800\udc00|\ud83c[\udccf\udd8e\udd91-\udd9a\udde6-\uddff\ude01\ude32-\ude36\ude38-\ude3a\ude50\ude51\udf00-\udf20\udf2d-\udf35\udf37-\udf7c\udf7e-\udf84\udf86-\udf93\udfa0-\udfc1\udfc5\udfc6\udfc8\udfc9\udfcf-\udfd3\udfe0-\udff0\udff4\udff8-\udfff]|\ud83d[\udc00-\udc3e\udc40\udc44\udc45\udc51-\udc65\udc6a-\udc6d\udc6f\udc79-\udc7b\udc7d-\udc80\udc84\udc88-\udca9\udcab-\udcfc\udcff-\udd3d\udd4b-\udd4e\udd50-\udd67\udda4\uddfb-\ude44\ude48-\ude4a\ude80-\udea2\udea4-\udeb3\udeb7-\udebf\udec1-\udec5\uded0-\uded2\udeeb\udeec\udef4-\udef8]|\ud83e[\udd10-\udd17\udd1d\udd20-\udd25\udd27-\udd2f\udd3a\udd3c\udd40-\udd45\udd47-\udd4c\udd50-\udd6b\udd80-\udd97\uddc0\uddd0\uddde-\udde6]|[\u23e9-\u23ec\u23f0\u23f3\u2640\u2642\u2695\u26ce\u2705\u2728\u274c\u274e\u2753-\u2755\u2795-\u2797\u27b0\u27bf\ue50a]|(?:\ud83c[\udc04\udd70\udd71\udd7e\udd7f\ude02\ude1a\ude2f\ude37\udf21\udf24-\udf2c\udf36\udf7d\udf96\udf97\udf99-\udf9b\udf9e\udf9f\udfcd\udfce\udfd4-\udfdf\udff3\udff5\udff7]|\ud83d[\udc3f\udc41\udcfd\udd49\udd4a\udd6f\udd70\udd73\udd76-\udd79\udd87\udd8a-\udd8d\udda5\udda8\uddb1\uddb2\uddbc\uddc2-\uddc4\uddd1-\uddd3\udddc-\uddde\udde1\udde3\udde8\uddef\uddf3\uddfa\udecb\udecd-\udecf\udee0-\udee5\udee9\udef0\udef3]|[\u00a9\u00ae\u203c\u2049\u2122\u2139\u2194-\u2199\u21a9\u21aa\u231a\u231b\u2328\u23cf\u23ed-\u23ef\u23f1\u23f2\u23f8-\u23fa\u24c2\u25aa\u25ab\u25b6\u25c0\u25fb-\u25fe\u2600-\u2604\u260e\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262a\u262e\u262f\u2638-\u263a\u2648-\u2653\u2660\u2663\u2665\u2666\u2668\u267b\u267f\u2692-\u2694\u2696\u2697\u2699\u269b\u269c\u26a0\u26a1\u26aa\u26ab\u26b0\u26b1\u26bd\u26be\u26c4\u26c5\u26c8\u26cf\u26d1\u26d3\u26d4\u26e9\u26ea\u26f0-\u26f5\u26f8\u26fa\u26fd\u2702\u2708\u2709\u270f\u2712\u2714\u2716\u271d\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u2764\u27a1\u2934\u2935\u2b05-\u2b07\u2b1b\u2b1c\u2b50\u2b55\u3030\u303d\u3297\u3299])(?:\ufe0f|(?!\ufe0e))/g,

    // avoid runtime RegExp creation for not so smart,
    // not JIT based, and old browsers / engines
    UFE0Fg = /\uFE0F/g,

    // avoid using a string literal like '\u200D' here because minifiers expand it inline
    U200D = String.fromCharCode(0x200D),

    // used to find HTML special chars in attributes
    rescaper = /[&<>'"]/g,

    // nodes with type 1 which should **not** be parsed
    shouldntBeParsed = /^(?:iframe|noframes|noscript|script|select|style|textarea)$/,

    // just a private shortcut
    fromCharCode = String.fromCharCode;

  return twemoji;


  /////////////////////////
  //  private functions  //
  //     declaration     //
  /////////////////////////

  /**
   * Shortcut to create text nodes
   * @param   string  text used to create DOM text node
   * @return  Node  a DOM node with that text
   */
  function createText(text, clean) {
    return document.createTextNode(clean ? text.replace(UFE0Fg, '') : text);
  }

  /**
   * Utility function to escape html attribute text
   * @param   string  text use in HTML attribute
   * @return  string  text encoded to use in HTML attribute
   */
  function escapeHTML(s) {
    return s.replace(rescaper, replacer);
  }

  /**
   * Default callback used to generate emoji src
   *  based on Twitter CDN
   * @param   string    the emoji codepoint string
   * @param   string    the default size to use, i.e. "36x36"
   * @return  string    the image source to use
   */
  function defaultImageSrcGenerator(icon, options) {
    return ''.concat(options.base, options.size, '/', icon, options.ext);
  }

  /**
   * Given a generic DOM nodeType 1, walk through all children
   * and store every nodeType 3 (#text) found in the tree.
   * @param   Element a DOM Element with probably some text in it
   * @param   Array the list of previously discovered text nodes
   * @return  Array same list with new discovered nodes, if any
   */
  function grabAllTextNodes(node, allText) {
    var
      childNodes = node.childNodes,
      length = childNodes.length,
      subnode,
      nodeType;
    while (length--) {
      subnode = childNodes[length];
      nodeType = subnode.nodeType;
      // parse emoji only in text nodes
      if (nodeType === 3) {
        // collect them to process emoji later
        allText.push(subnode);
      }
      // ignore all nodes that are not type 1, that are svg, or that
      // should not be parsed as script, style, and others
      else if (nodeType === 1 && !('ownerSVGElement' in subnode) &&
          !shouldntBeParsed.test(subnode.nodeName.toLowerCase())) {
        grabAllTextNodes(subnode, allText);
      }
    }
    return allText;
  }

  /**
   * Used to both remove the possible variant
   *  and to convert utf16 into code points.
   *  If there is a zero-width-joiner (U+200D), leave the variants in.
   * @param   string    the raw text of the emoji match
   * @return  string    the code point
   */
  function grabTheRightIcon(rawText) {
    // if variant is present as \uFE0F
    return toCodePoint(rawText.indexOf(U200D) < 0 ?
      rawText.replace(UFE0Fg, '') :
      rawText
    );
  }

  /**
   * DOM version of the same logic / parser:
   *  emojify all found sub-text nodes placing images node instead.
   * @param   Element   generic DOM node with some text in some child node
   * @param   Object    options  containing info about how to parse
    *
    *            .callback   Function  the callback to invoke per each found emoji.
    *            .base       string    the base url, by default twemoji.base
    *            .ext        string    the image extension, by default twemoji.ext
    *            .size       string    the assets size, by default twemoji.size
    *
   * @return  Element same generic node with emoji in place, if any.
   */
  function parseNode(node, options) {
    var
      allText = grabAllTextNodes(node, []),
      length = allText.length,
      attrib,
      attrname,
      modified,
      fragment,
      subnode,
      text,
      match,
      i,
      index,
      img,
      rawText,
      iconId,
      src;
    while (length--) {
      modified = false;
      fragment = document.createDocumentFragment();
      subnode = allText[length];
      text = subnode.nodeValue;
      i = 0;
      while ((match = re.exec(text))) {
        index = match.index;
        if (index !== i) {
          fragment.appendChild(
            createText(text.slice(i, index), true)
          );
        }
        rawText = match[0];
        iconId = grabTheRightIcon(rawText);
        i = index + rawText.length;
        src = options.callback(iconId, options);
        if (src) {
          img = new Image();
          img.onerror = options.onerror;
          img.setAttribute('draggable', 'false');
          attrib = options.attributes(rawText, iconId);
          for (attrname in attrib) {
            if (
              attrib.hasOwnProperty(attrname) &&
              // don't allow any handlers to be set + don't allow overrides
              attrname.indexOf('on') !== 0 &&
              !img.hasAttribute(attrname)
            ) {
              img.setAttribute(attrname, attrib[attrname]);
            }
          }
          img.className = options.className;
          img.alt = rawText;
          img.src = src;
          modified = true;
          fragment.appendChild(img);
        }
        if (!img) fragment.appendChild(createText(rawText, false));
        img = null;
      }
      // is there actually anything to replace in here ?
      if (modified) {
        // any text left to be added ?
        if (i < text.length) {
          fragment.appendChild(
            createText(text.slice(i), true)
          );
        }
        // replace the text node only, leave intact
        // anything else surrounding such text
        subnode.parentNode.replaceChild(fragment, subnode);
      }
    }
    return node;
  }

  /**
   * String/HTML version of the same logic / parser:
   *  emojify a generic text placing images tags instead of surrogates pair.
   * @param   string    generic string with possibly some emoji in it
   * @param   Object    options  containing info about how to parse
   *
   *            .callback   Function  the callback to invoke per each found emoji.
   *            .base       string    the base url, by default twemoji.base
   *            .ext        string    the image extension, by default twemoji.ext
   *            .size       string    the assets size, by default twemoji.size
   *
   * @return  the string with <img tags> replacing all found and parsed emoji
   */
  function parseString(str, options) {
    return replace(str, function (rawText) {
      var
        ret = rawText,
        iconId = grabTheRightIcon(rawText),
        src = options.callback(iconId, options),
        attrib,
        attrname;
      if (src) {
        // recycle the match string replacing the emoji
        // with its image counter part
        ret = '<img '.concat(
          'class="', options.className, '" ',
          'draggable="false" ',
          // needs to preserve user original intent
          // when variants should be copied and pasted too
          'alt="',
          rawText,
          '"',
          ' src="',
          src,
          '"'
        );
        attrib = options.attributes(rawText, iconId);
        for (attrname in attrib) {
          if (
            attrib.hasOwnProperty(attrname) &&
            // don't allow any handlers to be set + don't allow overrides
            attrname.indexOf('on') !== 0 &&
            ret.indexOf(' ' + attrname + '=') === -1
          ) {
            ret = ret.concat(' ', attrname, '="', escapeHTML(attrib[attrname]), '"');
          }
        }
        ret = ret.concat('/>');
      }
      return ret;
    });
  }

  /**
   * Function used to actually replace HTML special chars
   * @param   string  HTML special char
   * @return  string  encoded HTML special char
   */
  function replacer(m) {
    return escaper[m];
  }

  /**
   * Default options.attribute callback
   * @return  null
   */
  function returnNull() {
    return null;
  }

  /**
   * Given a generic value, creates its squared counterpart if it's a number.
   *  As example, number 36 will return '36x36'.
   * @param   any     a generic value.
   * @return  any     a string representing asset size, i.e. "36x36"
   *                  only in case the value was a number.
   *                  Returns initial value otherwise.
   */
  function toSizeSquaredAsset(value) {
    return typeof value === 'number' ?
      value + 'x' + value :
      value;
  }


  /////////////////////////
  //  exported functions //
  //     declaration     //
  /////////////////////////

  function fromCodePoint(codepoint) {
    var code = typeof codepoint === 'string' ?
          parseInt(codepoint, 16) : codepoint;
    if (code < 0x10000) {
      return fromCharCode(code);
    }
    code -= 0x10000;
    return fromCharCode(
      0xD800 + (code >> 10),
      0xDC00 + (code & 0x3FF)
    );
  }

  function parse(what, how) {
    if (!how || typeof how === 'function') {
      how = {callback: how};
    }
    // if first argument is string, inject html <img> tags
    // otherwise use the DOM tree and parse text nodes only
    return (typeof what === 'string' ? parseString : parseNode)(what, {
      callback:   how.callback || defaultImageSrcGenerator,
      attributes: typeof how.attributes === 'function' ? how.attributes : returnNull,
      base:       typeof how.base === 'string' ? how.base : twemoji.base,
      ext:        how.ext || twemoji.ext,
      size:       how.folder || toSizeSquaredAsset(how.size || twemoji.size),
      className:  how.className || twemoji.className,
      onerror:    how.onerror || twemoji.onerror
    });
  }

  function replace(text, callback) {
    return String(text).replace(re, callback);
  }

  function test(text) {
    // IE6 needs a reset before too
    re.lastIndex = 0;
    var result = re.test(text);
    re.lastIndex = 0;
    return result;
  }

  function toCodePoint(unicodeSurrogates, sep) {
    var
      r = [],
      c = 0,
      p = 0,
      i = 0;
    while (i < unicodeSurrogates.length) {
      c = unicodeSurrogates.charCodeAt(i++);
      if (p) {
        r.push((0x10000 + ((p - 0xD800) << 10) + (c - 0xDC00)).toString(16));
        p = 0;
      } else if (0xD800 <= c && c <= 0xDBFF) {
        p = c;
      } else {
        r.push(c.toString(16));
      }
    }
    return r.join(sep || '-');
  }

}());
if (!location.protocol) {
  twemoji.base = twemoji.base.replace(/^http:/, "");
}
module.exports = twemoji;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}]},{},[2])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkYXRhL3Nob3J0Y29kZXMuanMiLCJqcy9jb250ZW50LmpzIiwianMvbW9kdWxlcy9fY29uZmlnLmpzIiwianMvbW9kdWxlcy9kcm9wZG93bi5qcyIsImpzL21vZHVsZXMvZWxlbWVudC13YXRjaGVyLmpzIiwianMvbW9kdWxlcy9mb2N1cy13YXRjaGVyLmpzIiwianMvbW9kdWxlcy9tYXRjaGVyLmpzIiwianMvbW9kdWxlcy9zaG9ydGNvZGVzLmpzIiwianMvbW9kdWxlcy9zdGF0ZS5qcyIsImpzL21vZHVsZXMvc3RyaW5nLWJ1ZmZlci5qcyIsImpzL21vZHVsZXMvdXRpbHMuanMiLCIuLi9ub2RlX21vZHVsZXMvdHdlbW9qaS8yL3R3ZW1vamkubnBtLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ3JLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHM9e1wiOkRcIjpcIvCfmIBcIixcIic6RFwiOlwi8J+YhVwiLFwieERcIjpcIvCfmIZcIixcIjspXCI6XCLwn5iJXCIsXCJeXlwiOlwi8J+YilwiLFwiOnBcIjpcIvCfmItcIixcIjgpXCI6XCLwn5iOXCIsXCI6KlwiOlwi8J+YmFwiLFwiOjNcIjpcIvCfmJdcIixcIjopXCI6XCLwn5mCXCIsXCI6P1wiOlwi8J+klFwiLFwiOnxcIjpcIvCfmJBcIixcIi1fLVwiOlwi8J+YkVwiLFwiOnhcIjpcIvCfmLZcIixcIjpYXCI6XCLwn5i2XCIsXCJ8LShcIjpcIvCfmYRcIixcIjpPXCI6XCLwn5iuXCIsXCI6b1wiOlwi8J+Yr1wiLFwiRDpcIjpcIvCfmKtcIixcInwtKVwiOlwi8J+YtFwiLFwiOlBcIjpcIvCfmJtcIixcIjtQXCI6XCLwn5icXCIsXCI6L1wiOlwi8J+YlVwiLFwiKDpcIjpcIvCfmYNcIixcIjhPXCI6XCLwn5iyXCIsXCI6KFwiOlwi8J+ZgVwiLFwiOyhcIjpcIvCfmKJcIixcIjpAXCI6XCLwn6SsXCIsXCI+OilcIjpcIvCfmIhcIixcIjwzXCI6XCLinaTvuI9cIn07IiwiLy8gLS0tXHJcbi8vIGFkZCBrZXl3b3JkcyB3aGVuIHNlYXJjaGluZ1xyXG4vLyBmaXggZHJvcGRvd24gcG9zaXRpb25pbmcgd2hlbiBpdCdzIHRvbyBjbG9zZSB0byB0aGUgZWRnZSAoZmFjZWJvb2sgY2hhdCBzZWFyY2gpXHJcblxyXG5yZXF1aXJlKCd0d2Vtb2ppJyk7XHJcbnJlcXVpcmUoJy4vbW9kdWxlcy9zaG9ydGNvZGVzLmpzJyk7XHJcblxyXG52YXIgQ29uZmlnID0gcmVxdWlyZSgnLi9tb2R1bGVzL19jb25maWcuanMnKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi9tb2R1bGVzL3V0aWxzLmpzJyk7XHJcbnZhciBEcm9wZG93biA9IHJlcXVpcmUoJy4vbW9kdWxlcy9kcm9wZG93bi5qcycpO1xyXG52YXIgRm9jdXNXYXRjaGVyID0gcmVxdWlyZSgnLi9tb2R1bGVzL2ZvY3VzLXdhdGNoZXIuanMnKTtcclxudmFyIEVsZW1lbnRXYXRjaGVyID0gcmVxdWlyZSgnLi9tb2R1bGVzL2VsZW1lbnQtd2F0Y2hlci5qcycpO1xyXG52YXIgU3RyaW5nQnVmZmVyID0gcmVxdWlyZSgnLi9tb2R1bGVzL3N0cmluZy1idWZmZXIuanMnKTtcclxudmFyIE1hdGNoZXIgPSByZXF1aXJlKCcuL21vZHVsZXMvbWF0Y2hlci5qcycpO1xyXG5cclxuZnVuY3Rpb24gcmVwbGFjZShlbW9qaSwgaXNWaWFVSSkge1xyXG4gICAgdmFyIGVsZW1lbnQgPSBFbGVtZW50V2F0Y2hlci5nZXRFbGVtZW50KCk7XHJcbiAgICB2YXIgc2VhcmNoID0gU3RyaW5nQnVmZmVyLmdldEJ1ZmZlcigpO1xyXG5cclxuICAgIGlmIChDb25maWcuYmVoYXZpb3IuY29weSkge1xyXG4gICAgICAgIFV0aWxzLmNsaXBXaXRoU2VsZWN0aW9uKGVtb2ppKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZWxlbWVudCkge1xyXG4gICAgICAgIGlmIChlbGVtZW50Lmhhc0F0dHJpYnV0ZShcImNvbnRlbnRlZGl0YWJsZVwiKSkge1xyXG4gICAgICAgICAgICBVdGlscy5tYXRjaFNlbGVjdGlvbihzZWFyY2gsIGZ1bmN0aW9uIChub2RlLCBzdGFydCwgZW5kKSB7XHJcbiAgICAgICAgICAgICAgICB2YXIgc2VsZWN0aW9uID0gd2luZG93LmdldFNlbGVjdGlvbigpO1xyXG5cclxuICAgICAgICAgICAgICAgIHZhciByYW5nZSA9IHNlbGVjdGlvbi5nZXRSYW5nZUF0KHNlbGVjdGlvbi5yYW5nZUNvdW50IC0gMSk7XHJcbiAgICAgICAgICAgICAgICByYW5nZS5zZXRTdGFydChub2RlLCBzdGFydCk7XHJcbiAgICAgICAgICAgICAgICByYW5nZS5zZXRFbmQobm9kZSwgZW5kKTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoIUNvbmZpZy5iZWhhdmlvci5jb3B5KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmFuZ2UuZGVsZXRlQ29udGVudHMoKTtcclxuICAgICAgICAgICAgICAgICAgICByYW5nZS5pbnNlcnROb2RlKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGVtb2ppKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIG5vZGUucGFyZW50Tm9kZS5ub3JtYWxpemUoKTtcclxuICAgICAgICAgICAgICAgICAgICBzZWxlY3Rpb24uY29sbGFwc2VUb0VuZCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBVdGlscy5mb3JtUmVwbGFjZShlbGVtZW50LCBzZWFyY2gsIGVtb2ppKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIFN0cmluZ0J1ZmZlci5yZXNldCgpO1xyXG4gICAgfVxyXG59XHJcblxyXG52YXIgVUkgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIGV4cG9ydHMgPSB7fTtcclxuXHJcbiAgICB2YXIgX2Ryb3Bkb3duID0gbnVsbDtcclxuXHJcbiAgICBmdW5jdGlvbiBleGlzdHMoKSB7XHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgX2Ryb3Bkb3duICYmXHJcbiAgICAgICAgICAgIF9kcm9wZG93biBpbnN0YW5jZW9mIERyb3Bkb3duICYmXHJcbiAgICAgICAgICAgICFfZHJvcGRvd24uZGVzdHJveWVkXHJcbiAgICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnRzLmNyZWF0ZURyb3Bkb3duID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICghZXhpc3RzKCkpIHtcclxuICAgICAgICAgICAgX2Ryb3Bkb3duID0gbmV3IERyb3Bkb3duKCk7XHJcbiAgICAgICAgICAgIF9kcm9wZG93bi5vbkNob29zZSA9IGZ1bmN0aW9uIChlbW9qaSkge1xyXG4gICAgICAgICAgICAgICAgcmVwbGFjZShlbW9qaSwgdHJ1ZSk7XHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLmRyb3Bkb3duQWN0aW9uID0gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XHJcbiAgICAgICAgaWYgKGV4aXN0cygpKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrKF9kcm9wZG93bik7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLnJlbW92ZURyb3Bkb3duID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmIChleGlzdHMoKSkge1xyXG4gICAgICAgICAgICBfZHJvcGRvd24ucmVtb3ZlKCk7XHJcbiAgICAgICAgICAgIF9kcm9wZG93biA9IG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLmRyb3Bkb3duRXhpc3RzID0gZXhpc3RzO1xyXG5cclxuICAgIHJldHVybiBleHBvcnRzO1xyXG59KSgpO1xyXG5cclxuRm9jdXNXYXRjaGVyLm9uQ2hhbmdlID0gZnVuY3Rpb24gKGVsZW1lbnQpIHtcclxuICAgIGVsZW1lbnQgPSBVdGlscy5pc0VsZW1lbnRFbW9qaUVsaWdpYmxlKGVsZW1lbnQpXHJcbiAgICAgICAgPyBlbGVtZW50XHJcbiAgICAgICAgOiBudWxsO1xyXG5cclxuICAgIEVsZW1lbnRXYXRjaGVyLmNoYW5nZUVsZW1lbnQoZWxlbWVudCk7XHJcbn07XHJcblxyXG5FbGVtZW50V2F0Y2hlci5vblJlYmluZCA9IGZ1bmN0aW9uICgpIHtcclxuICAgIFN0cmluZ0J1ZmZlci5yZXNldCgpO1xyXG59O1xyXG5cclxuRWxlbWVudFdhdGNoZXIuZXZlbnRzID0ge1xyXG4gICAga2V5ZG93bjogZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgICAgU3RyaW5nQnVmZmVyLmhhbmRsZUtleURvd24oZXZlbnQpO1xyXG4gICAgfSxcclxuXHJcbiAgICBrZXlwcmVzczogZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgICAgU3RyaW5nQnVmZmVyLmhhbmRsZUtleVByZXNzKGV2ZW50KTtcclxuICAgICAgICBcclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIC8vIFRpbWVvdXQgbmVlZGVkIGJlY2F1c2Ugb3RoZXJ3aXNlIHRoZSBwb3NpdGlvbmluZyBoYXBwZW5zIGJlZm9yZVxyXG4gICAgICAgICAgICAvLyB0aGUgY2hhcmFjdGVyIGlzIGluc2VydGVkLlxyXG4gICAgICAgICAgICBVSS5kcm9wZG93bkFjdGlvbihmdW5jdGlvbiAoZHJvcGRvd24pIHtcclxuICAgICAgICAgICAgICAgIGRyb3Bkb3duLmFsaWduVG8oc2VsZik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sIDApO1xyXG4gICAgfSxcclxuXHJcbiAgICBrZXl1cDogZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gICAgICAgIFVJLmRyb3Bkb3duQWN0aW9uKGZ1bmN0aW9uIChkcm9wZG93bikge1xyXG4gICAgICAgICAgICBkcm9wZG93bi5hbGlnblRvKHNlbGYpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSxcclxuXHJcbiAgICBibHVyOiBTdHJpbmdCdWZmZXIucmVzZXQsXHJcbiAgICBjbGljazogU3RyaW5nQnVmZmVyLnJlc2V0XHJcbn07XHJcblxyXG5TdHJpbmdCdWZmZXIub25DbGVhciA9IGZ1bmN0aW9uICgpIHtcclxuICAgIFVJLnJlbW92ZURyb3Bkb3duKCk7XHJcbiAgICBNYXRjaGVyLnJlc2V0KCk7XHJcbn07XHJcblxyXG5TdHJpbmdCdWZmZXIub25CcmVhayA9IGZ1bmN0aW9uICgpIHtcclxuICAgIE1hdGNoZXIuY2hlY2tNYXRjaCgpO1xyXG59O1xyXG5cclxuU3RyaW5nQnVmZmVyLm9uQ2hhbmdlID0gZnVuY3Rpb24gKGJ1ZmZlcikge1xyXG4gICAgaWYgKENvbmZpZy5iZWhhdmlvci5hY3RpdmUpIHtcclxuICAgICAgICBNYXRjaGVyLnVwZGF0ZShidWZmZXIpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuTWF0Y2hlci5vbkZsYWdzVXBkYXRlID0gZnVuY3Rpb24gKGZsYWdzKSB7XHJcbiAgICBpZiAoZmxhZ3MuY29sb25TdGFydCAmJiAhVUkuZHJvcGRvd25FeGlzdHMoKSkge1xyXG4gICAgICAgIFVJLmNyZWF0ZURyb3Bkb3duKCk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5NYXRjaGVyLm9uQ29sb25jb2RlVXBkYXRlID0gZnVuY3Rpb24gKGNvZGVzKSB7XHJcbiAgICBpZiAoY29kZXMgJiYgY29kZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgVUkuZHJvcGRvd25BY3Rpb24oZnVuY3Rpb24gKGRyb3Bkb3duKSB7XHJcbiAgICAgICAgICAgIGRyb3Bkb3duLnNob3coKTtcclxuICAgICAgICAgICAgZHJvcGRvd24udXBkYXRlTGlzdChjb2Rlcyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIFVJLmRyb3Bkb3duQWN0aW9uKGZ1bmN0aW9uIChkcm9wZG93bikge1xyXG4gICAgICAgICAgICBkcm9wZG93bi5oaWRlKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn07XHJcblxyXG5NYXRjaGVyLm9uTWF0Y2ggPSByZXBsYWNlO1xyXG5cclxuTWF0Y2hlci5vbkZsYWdzRG93biA9IGZ1bmN0aW9uICgpIHtcclxuICAgIFN0cmluZ0J1ZmZlci5yZXNldCgpO1xyXG59O1xyXG5cclxucmVxdWlyZSgnLi9tb2R1bGVzL3N0YXRlLmpzJyk7IiwibW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBnZW5lcmFsOiB7XHJcbiAgICAgICAgZG9tYWluc19ub19hbHRlcjogWydmYWNlYm9vayddXHJcbiAgICB9LFxyXG5cclxuICAgIGJlaGF2aW9yOiB7XHJcbiAgICAgICAgYWN0aXZlOiB0cnVlLFxyXG4gICAgICAgIGNvcHk6IGZhbHNlLFxyXG4gICAgICAgIHNob3J0Y29kZXM6IHRydWUsXHJcbiAgICAgICAgY29sb25jb2RlczogdHJ1ZVxyXG4gICAgfSxcclxuXHJcbiAgICBrZXlzOiB7XHJcbiAgICAgICAgbGVmdDogICAzNyxcclxuICAgICAgICB1cDogICAgIDM4LFxyXG4gICAgICAgIHJpZ2h0OiAgMzksXHJcbiAgICAgICAgZG93bjogICA0MCxcclxuXHJcbiAgICAgICAgdGFiOiAgICA5LFxyXG4gICAgICAgIGVudGVyOiAgMTMsXHJcbiAgICAgICAgZXNjYXBlOiAyNyxcclxuICAgICAgICBzcGFjZTogIDMyLFxyXG4gICAgICAgIGJhY2tzcGFjZTogOFxyXG4gICAgfVxyXG59O1xyXG5cclxuLy8gZm9yICh2YXIgaSA9IDA7IGkgPCBtb2R1bGUuZXhwb3J0cy5nZW5lcmFsLmRvbWFpbnNfbm9fYWx0ZXIubGVuZ3RoOyBpKyspIHtcclxuLy8gICAgIGlmICh3aW5kb3cubG9jYXRpb24uaG9zdG5hbWUuaW5kZXhPZihtb2R1bGUuZXhwb3J0cy5nZW5lcmFsLmRvbWFpbnNfbm9fYWx0ZXJbaV0pICE9PSAtMSkge1xyXG4vLyAgICAgICAgIEJFSEFWSU9SLmNvcHkgPSB0cnVlO1xyXG4vLyAgICAgICAgIGJyZWFrO1xyXG4vLyAgICAgfVxyXG4vLyB9XHJcblxyXG4vLyBpZiAoQkVIQVZJT1IuY29weSkge1xyXG4vLyAgICAgQkVIQVZJT1Iuc2hvcnRjb2RlcyA9IGZhbHNlO1xyXG4vLyB9IiwidmFyIENvbmZpZyA9IHJlcXVpcmUoJy4vX2NvbmZpZy5qcycpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzLmpzJyk7XHJcbnZhciB0d2Vtb2ppID0gcmVxdWlyZSgndHdlbW9qaScpO1xyXG5cclxuZnVuY3Rpb24gRHJvcGRvd24ocGFyZW50KSB7XHJcbiAgICB0aGlzLml0ZW1zID0ge307XHJcbiAgICB0aGlzLnNlbGVjdGVkSXRlbSA9IG51bGw7XHJcbiAgICB0aGlzLm9uQ2hvb3NlID0gZnVuY3Rpb24gKCkge307XHJcbiAgICB0aGlzLnBhcmVudCA9IHBhcmVudCB8fCBkb2N1bWVudC5ib2R5O1xyXG5cclxuICAgIHRoaXMuZHJvcGRvd24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgdGhpcy5kcm9wZG93bi5jbGFzc0xpc3QuYWRkKFwic21pbGV5LWNhcmV0LWRyb3Bkb3duXCIpO1xyXG5cclxuICAgIHRoaXMuY29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgIHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoXCJzbWlsZXktY2FyZXQtY29udGFpbmVyXCIpO1xyXG4gICAgdGhpcy5kcm9wZG93bi5hcHBlbmRDaGlsZCh0aGlzLmNvbnRhaW5lcik7XHJcblxyXG4gICAgaWYgKENvbmZpZy5iZWhhdmlvci5jb3B5KSB7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIuY2xhc3NMaXN0LmFkZChcImJlaGF2aW9yLWNvcHlcIik7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5wYXJlbnQuYXBwZW5kQ2hpbGQodGhpcy5kcm9wZG93bik7XHJcbn0gRHJvcGRvd24ucHJvdG90eXBlID0ge1xyXG4gICAgY3JlYXRlSXRlbTogZnVuY3Rpb24gKG5hbWUsIGVtb2ppKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaXRlbXNbbmFtZV0pIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIGl0ZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgICAgIHZhciBlbW9qaUVsZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcclxuICAgICAgICB2YXIgZW1vamlFbGVtQ2hhciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpXCIpO1xyXG4gICAgICAgIHZhciBlbW9qaUVsZW1JbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW1nXCIpO1xyXG4gICAgICAgIHZhciBuYW1lRWxlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJwXCIpO1xyXG5cclxuICAgICAgICBlbW9qaUVsZW1DaGFyLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGVtb2ppKSk7XHJcbiAgICAgICAgZW1vamlFbGVtLmFwcGVuZENoaWxkKGVtb2ppRWxlbUNoYXIpO1xyXG4gICAgICAgIGVtb2ppRWxlbS5hcHBlbmRDaGlsZChlbW9qaUVsZW1JbWcpO1xyXG5cclxuICAgICAgICB2YXIgaW1hZ2VNYXJrdXAgPSB0d2Vtb2ppLnBhcnNlKGVtb2ppKVxyXG4gICAgICAgICwgICBpbWFnZVNyY01hdGNoID0gL3NyY1xcPVxcXCIoLiopXFxcIi8uZXhlYyhpbWFnZU1hcmt1cClcclxuICAgICAgICAsICAgaW1hZ2VTcmMgPSAoaW1hZ2VTcmNNYXRjaCAmJiBpbWFnZVNyY01hdGNoWzFdKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoaW1hZ2VTcmMpIHtcclxuICAgICAgICAgICAgdmFyIHRlbXBJbWFnZSA9IG5ldyBJbWFnZSgpO1xyXG4gICAgICAgICAgICB0ZW1wSW1hZ2Uub25sb2FkID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgZW1vamlFbGVtLmNsYXNzTGlzdC5hZGQoXCJpcy1sb2FkZWRcIik7XHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICB0ZW1wSW1hZ2Uuc3JjID0gaW1hZ2VTcmM7XHJcbiAgICAgICAgICAgIGVtb2ppRWxlbUltZy5zcmMgPSBpbWFnZVNyYztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGl0ZW0uYXBwZW5kQ2hpbGQoZW1vamlFbGVtKTtcclxuXHJcbiAgICAgICAgbmFtZUVsZW0uYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUobmFtZSkpO1xyXG4gICAgICAgIGl0ZW0uYXBwZW5kQ2hpbGQobmFtZUVsZW0pO1xyXG5cclxuICAgICAgICBpdGVtLnNtaWxleUNhcmV0ID0ge1xyXG4gICAgICAgICAgICBlbW9qaTogZW1vamksXHJcbiAgICAgICAgICAgIG5hbWU6IG5hbWVcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwibW91c2VlbnRlclwiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHNlbGYuc2VsZWN0SXRlbSh0aGlzKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgICAgICAgICBzZWxmLnNlbGVjdEl0ZW0odGhpcyk7XHJcbiAgICAgICAgICAgIHNlbGYuY2hvb3NlSXRlbSgpO1xyXG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyB0byBwcmV2ZW50IGxvc3Mgb2YgZm9jdXNcclxuICAgICAgICAgICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKGl0ZW0pO1xyXG4gICAgICAgIHRoaXMuaXRlbXNbbmFtZV0gPSBpdGVtO1xyXG4gICAgfSxcclxuXHJcbiAgICBjaG9vc2VJdGVtOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICB0aGlzLnNlbGVjdGVkSXRlbSAmJlxyXG4gICAgICAgICAgICB0aGlzLnNlbGVjdGVkSXRlbS5zbWlsZXlDYXJldCAmJlxyXG4gICAgICAgICAgICB0aGlzLnNlbGVjdGVkSXRlbS5zbWlsZXlDYXJldC5lbW9qaVxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgICB0aGlzLm9uQ2hvb3NlKHRoaXMuc2VsZWN0ZWRJdGVtLnNtaWxleUNhcmV0LmVtb2ppKTtcclxuICAgICAgICB9ICBcclxuICAgIH0sXHJcblxyXG4gICAgc2VsZWN0SXRlbTogZnVuY3Rpb24gKGl0ZW0pIHtcclxuICAgICAgICBpZiAodGhpcy5zZWxlY3RlZEl0ZW0pIHtcclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZEl0ZW0uY2xhc3NMaXN0LnJlbW92ZShcInNlbGVjdGVkXCIpO1xyXG4gICAgICAgICAgICB0aGlzLnNlbGVjdGVkSXRlbSA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoaXRlbSkge1xyXG4gICAgICAgICAgICBpdGVtLmNsYXNzTGlzdC5hZGQoXCJzZWxlY3RlZFwiKTtcclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZEl0ZW0gPSBpdGVtO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgdXBkYXRlTGlzdDogZnVuY3Rpb24gKGxpc3QpIHtcclxuICAgICAgICBpZiAobGlzdC5sZW5ndGggPT09IDApIHJldHVybjtcclxuXHJcbiAgICAgICAgZm9yICh2YXIgayBpbiB0aGlzLml0ZW1zKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaXRlbXNba10ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLml0ZW1zW2tdKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBleGlzdHMgPSBmYWxzZTtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobGlzdFtpXVswXSA9PT0gaykge1xyXG4gICAgICAgICAgICAgICAgICAgIGV4aXN0cyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghZXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5pdGVtc1trXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBuYW1lID0gbGlzdFtpXVswXVxyXG4gICAgICAgICAgICAsICAgZW1vamkgPSBsaXN0W2ldWzFdO1xyXG5cclxuICAgICAgICAgICAgaWYgKHRoaXMuaXRlbXNbbmFtZV0pIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuaXRlbXNbbmFtZV0pO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVJdGVtKG5hbWUsIGVtb2ppKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY29udGFpbmVyLmZpcnN0RWxlbWVudENoaWxkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0SXRlbSh0aGlzLmNvbnRhaW5lci5maXJzdEVsZW1lbnRDaGlsZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBhbGlnblRvOiBmdW5jdGlvbiAoZWxlbSkge1xyXG4gICAgICAgIHZhciBvZmZzZXQgPSBudWxsO1xyXG5cclxuICAgICAgICBpZiAoZWxlbS5oYXNBdHRyaWJ1dGUoXCJjb250ZW50ZWRpdGFibGVcIikpIHtcclxuICAgICAgICAgICAgb2Zmc2V0ID0gVXRpbHMuZ2V0Q29udGVudGVkaXRhYmxlQ2FyZXRCb2R5T2Zmc2V0KCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgb2Zmc2V0ID0gVXRpbHMuZ2V0RWxlbWVudEJvZHlPZmZzZXQoZWxlbSk7XHJcbiAgICAgICAgICAgIG9mZnNldC5sZWZ0ICs9IGVsZW0uY2xpZW50V2lkdGg7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAob2Zmc2V0KSB7XHJcbiAgICAgICAgICAgIHRoaXMuZHJvcGRvd24uc3R5bGUubGVmdCA9IG9mZnNldC5sZWZ0ICsgXCJweFwiO1xyXG4gICAgICAgICAgICB0aGlzLmRyb3Bkb3duLnN0eWxlLnRvcCA9IG9mZnNldC50b3AgKyBcInB4XCI7XHJcblxyXG4gICAgICAgICAgICBpZiAob2Zmc2V0LmZpeGVkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRyb3Bkb3duLmNsYXNzTGlzdC5hZGQoXCJpcy1maXhlZFwiKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZHJvcGRvd24uY2xhc3NMaXN0LnJlbW92ZShcImlzLWZpeGVkXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBzaG93OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5hY3RpdmUgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuZHJvcGRvd24uY2xhc3NMaXN0LmFkZChcImlzLXZpc2libGVcIik7XHJcbiAgICB9LFxyXG5cclxuICAgIGhpZGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMuZHJvcGRvd24uY2xhc3NMaXN0LnJlbW92ZShcImlzLXZpc2libGVcIik7XHJcbiAgICB9LFxyXG5cclxuICAgIHJlbW92ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuaGlkZSgpO1xyXG5cclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xyXG4gICAgICAgIH0sIDUwMCk7XHJcbiAgICB9LFxyXG5cclxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAodGhpcy5kZXN0cm95ZWQpIHJldHVybjtcclxuICAgICAgICBcclxuICAgICAgICBpZiAodGhpcy5kcm9wZG93bi5wYXJlbnROb2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZHJvcGRvd24ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmRyb3Bkb3duKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMucGFyZW50ID0gbnVsbDtcclxuICAgICAgICB0aGlzLml0ZW1zID0gbnVsbDtcclxuICAgICAgICB0aGlzLnNlbGVjdGVkSXRlbSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5kcm9wZG93biA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBudWxsO1xyXG5cclxuICAgICAgICB0aGlzLmRlc3Ryb3llZCA9IHRydWU7XHJcbiAgICB9XHJcbn07XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IERyb3Bkb3duOyIsIm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBleHBvcnRzID0ge1xyXG4gICAgICAgIG9uUmViaW5kOiBmdW5jdGlvbiAoKSB7fSxcclxuICAgICAgICBldmVudHM6IHt9XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBfY3VycmVudEVsZW0gPSBudWxsO1xyXG5cclxuICAgIGZ1bmN0aW9uIGJpbmRFdmVudHMoZWxlbSkge1xyXG4gICAgICAgIGZvciAodmFyIGsgaW4gZXhwb3J0cy5ldmVudHMpIHtcclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBleHBvcnRzLmV2ZW50c1trXSA9PT0gXCJmdW5jdGlvblwiKSB7XHJcbiAgICAgICAgICAgICAgICBlbGVtLmFkZEV2ZW50TGlzdGVuZXIoaywgZXhwb3J0cy5ldmVudHNba10pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHVuYmluZEV2ZW50cyhlbGVtKSB7XHJcbiAgICAgICAgZm9yICh2YXIgayBpbiBleHBvcnRzLmV2ZW50cykge1xyXG4gICAgICAgICAgICBlbGVtLnJlbW92ZUV2ZW50TGlzdGVuZXIoaywgZXhwb3J0cy5ldmVudHNba10pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBleHBvcnRzLmNoYW5nZUVsZW1lbnQgPSBmdW5jdGlvbiAobmV3RWxlbWVudCkge1xyXG4gICAgICAgIGlmIChfY3VycmVudEVsZW0pIHtcclxuICAgICAgICAgICAgdW5iaW5kRXZlbnRzKF9jdXJyZW50RWxlbSk7XHJcbiAgICAgICAgICAgIF9jdXJyZW50RWxlbSA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAobmV3RWxlbWVudCkge1xyXG4gICAgICAgICAgICBiaW5kRXZlbnRzKG5ld0VsZW1lbnQpO1xyXG4gICAgICAgICAgICBfY3VycmVudEVsZW0gPSBuZXdFbGVtZW50O1xyXG5cclxuICAgICAgICAgICAgZXhwb3J0cy5vblJlYmluZCgpO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgZXhwb3J0cy5nZXRFbGVtZW50ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiBfY3VycmVudEVsZW07XHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBleHBvcnRzO1xyXG59KSgpOyIsIi8vIENoZWNrcyB0aGUgY3VycmVudGx5IGZvY3VzZWQgZWxlbWVudCBvdmVyIHNob3J0IGludGVydmFsIGFuZCBkaXNwYXRjaGVzXHJcbi8vIGNoYW5nZXMuIFRoZSBcImZvY3VzaW5cIiBldmVudCBjYW4ndCBkbyB0aGUgam9iIGJlY2F1c2UgaXQgY2FuIGJlIGNhbmNlbGxlZC5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBfY29uZmlnID0ge1xyXG4gICAgICAgIGludGVydmFsOiAyNTBcclxuICAgIH07XHJcblxyXG4gICAgdmFyIGV4cG9ydHMgPSB7XHJcbiAgICAgICAgb25DaGFuZ2U6IGZ1bmN0aW9uICgpIHt9XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBfYWN0aXZlID0gbnVsbCxcclxuICAgICAgICBfZW1pdHRlZCA9IG51bGw7XHJcblxyXG4gICAgc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmIChkb2N1bWVudC5hY3RpdmVFbGVtZW50ICE9PSBfYWN0aXZlKSB7XHJcbiAgICAgICAgICAgIF9hY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xyXG4gICAgICAgICAgICBleHBvcnRzLm9uQ2hhbmdlKF9hY3RpdmUpO1xyXG4gICAgICAgIH1cclxuICAgIH0sIF9jb25maWcuaW50ZXJ2YWwpO1xyXG5cclxuICAgIHJldHVybiBleHBvcnRzO1xyXG59KSgpOyIsInZhciBDb25maWcgPSByZXF1aXJlKCcuL19jb25maWcuanMnKTtcclxudmFyIFNob3J0Y29kZXMgPSByZXF1aXJlKCcuL3Nob3J0Y29kZXMuanMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBleHBvcnRzID0ge1xyXG4gICAgICAgIG9uTWF0Y2g6IGZ1bmN0aW9uICgpIHt9LFxyXG4gICAgICAgIG9uQ29sb25jb2RlVXBkYXRlOiBmdW5jdGlvbiAoKSB7fSxcclxuICAgICAgICBvbkZsYWdzVXBkYXRlOiBmdW5jdGlvbiAoKSB7fSxcclxuICAgICAgICBvbkZsYWdzRG93bjogZnVuY3Rpb24gKCkge31cclxuICAgIH07XHJcblxyXG4gICAgdmFyIF9mbGFncyA9IHt9LFxyXG4gICAgICAgIF9jb2xvbmNvZGVzID0gW107XHJcblxyXG4gICAgZnVuY3Rpb24gcmVzZXRGbGFncygpIHtcclxuICAgICAgICBfZmxhZ3Muc2hvcnRjb2RlID0gZmFsc2U7XHJcbiAgICAgICAgX2ZsYWdzLmNvbG9uU3RhcnQgPSBmYWxzZTtcclxuICAgICAgICBfZmxhZ3MuY29sb25jb2RlID0gZmFsc2U7XHJcbiAgICAgICAgZXhwb3J0cy5vbkZsYWdzVXBkYXRlKF9mbGFncyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdXBkYXRlQ29sb25jb2RlcyhkYXRhKSB7XHJcbiAgICAgICAgX2NvbG9uY29kZXMgPSBkYXRhIHx8IFtdO1xyXG4gICAgICAgIGV4cG9ydHMub25Db2xvbmNvZGVVcGRhdGUoX2NvbG9uY29kZXMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNlYXJjaEZvckNvbG9uY29kZXMoYnVmZmVyKSB7XHJcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xyXG4gICAgICAgICAgICBpZDogXCJnZXRfY29sb25jb2Rlc1wiLFxyXG4gICAgICAgICAgICBzZWFyY2g6IGJ1ZmZlclxyXG4gICAgICAgIH0sIGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgICAgIHVwZGF0ZUNvbG9uY29kZXMoZGF0YSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZmxhZ3NEb3duKCkge1xyXG4gICAgICAgIHZhciBhbGxEb3duID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBfZmxhZ3Muc2hvcnRjb2RlICE9PSBmYWxzZSB8fFxyXG4gICAgICAgICAgICBfZmxhZ3MuY29sb25TdGFydCA9PT0gdHJ1ZSB8fCBcclxuICAgICAgICAgICAgX2ZsYWdzLmNvbG9uY29kZSAhPT0gZmFsc2VcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgYWxsRG93biA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGFsbERvd247XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNQYXJ0T2ZDb2xvbmNvZGUoYnVmZmVyKSB7XHJcbiAgICAgICAgdmFyIG1hdGNoID0gYnVmZmVyLm1hdGNoKC9eXFw6KFthLXowLTlcXC1dezMsfSlcXDo/JC8pO1xyXG5cclxuICAgICAgICBpZiAobWF0Y2ggIT09IG51bGwgJiYgbWF0Y2gubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBtYXRjaFsxXTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHVwZGF0ZUZsYWdzKGJ1ZmZlcikge1xyXG4gICAgICAgIGlmIChDb25maWcuYmVoYXZpb3IuY29sb25jb2Rlcykge1xyXG4gICAgICAgICAgICBpZiAoYnVmZmVyLmxlbmd0aCA9PT0gMSAmJiBidWZmZXJbMF0gPT09IFwiOlwiKSB7XHJcbiAgICAgICAgICAgICAgICBfZmxhZ3MuY29sb25TdGFydCA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChfZmxhZ3MuY29sb25TdGFydCkge1xyXG4gICAgICAgICAgICAgICAgX2ZsYWdzLmNvbG9uY29kZSA9IGlzUGFydE9mQ29sb25jb2RlKGJ1ZmZlcik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChDb25maWcuYmVoYXZpb3Iuc2hvcnRjb2Rlcykge1xyXG4gICAgICAgICAgICBfZmxhZ3Muc2hvcnRjb2RlID0gU2hvcnRjb2Rlcy5pc1BhcnQoYnVmZmVyKSA/IGJ1ZmZlciA6IGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZXhwb3J0cy5vbkZsYWdzVXBkYXRlKF9mbGFncyk7XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0cy5yZXNldCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXNldEZsYWdzKCk7XHJcbiAgICAgICAgdXBkYXRlQ29sb25jb2RlcyhudWxsKTtcclxuICAgIH07XHJcblxyXG4gICAgZXhwb3J0cy5jaGVja01hdGNoID0gZnVuY3Rpb24gKGJ1ZmZlcikge1xyXG4gICAgICAgIGlmIChfZmxhZ3Muc2hvcnRjb2RlKSB7XHJcbiAgICAgICAgICAgIHZhciBzaG9ydGNvZGUgPSBTaG9ydGNvZGVzLmdldChfZmxhZ3Muc2hvcnRjb2RlKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChzaG9ydGNvZGUgIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgIGV4cG9ydHMub25NYXRjaChzaG9ydGNvZGUpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoX2ZsYWdzLmNvbG9uY29kZSkge1xyXG4gICAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IF9jb2xvbmNvZGVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAoX2NvbG9uY29kZXNbaV1bMF0gPT09IF9mbGFncy5jb2xvbmNvZGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBleHBvcnRzLm9uTWF0Y2goX2NvbG9uY29kZXNbaV1bMV0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSAgIFxyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLnVwZGF0ZSA9IGZ1bmN0aW9uIChidWZmZXIpIHtcclxuICAgICAgICB1cGRhdGVGbGFncyhidWZmZXIpO1xyXG5cclxuICAgICAgICBpZiAoZmxhZ3NEb3duKCkpIHtcclxuICAgICAgICAgICAgZXhwb3J0cy5vbkZsYWdzRG93bigpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGlmIChfZmxhZ3MuY29sb25jb2RlKSB7XHJcbiAgICAgICAgICAgICAgICBzZWFyY2hGb3JDb2xvbmNvZGVzKF9mbGFncy5jb2xvbmNvZGUpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdXBkYXRlQ29sb25jb2RlcyhudWxsKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgcmVzZXRGbGFncygpO1xyXG4gICAgcmV0dXJuIGV4cG9ydHM7XHJcbn0pKCk7IiwidmFyIFNob3J0Y29kZXMgPSByZXF1aXJlKCcuLi8uLi9kYXRhL3Nob3J0Y29kZXMuanMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBleHBvcnRzID0ge307XHJcblxyXG4gICAgdmFyIF9zZXRzID0gZ2V0U2V0cyhTaG9ydGNvZGVzKTtcclxuXHJcbiAgICBmdW5jdGlvbiBnZXRTZXRzKGxpc3QpIHtcclxuICAgICAgICB2YXIgc2V0cyA9IFtdO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBjb2RlIGluIGxpc3QpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb2RlLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBzZXRzW2ldID0gc2V0c1tpXSB8fCBbXTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoc2V0c1tpXS5pbmRleE9mKGNvZGVbaV0pID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHNldHNbaV0ucHVzaChjb2RlW2ldKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHNldHM7XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0cy5pc1BhcnQgPSBmdW5jdGlvbiAoc3RyKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IHN0ci5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgICAgICBpZiAoIV9zZXRzW2ldIHx8IF9zZXRzW2ldLmluZGV4T2Yoc3RyW2ldKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuZ2V0ID0gZnVuY3Rpb24gKGtleSkge1xyXG4gICAgICAgIGlmIChTaG9ydGNvZGVzW2tleV0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIFNob3J0Y29kZXNba2V5XTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuZ2V0QWxsID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiBTaG9ydGNvZGVzO1xyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gZXhwb3J0cztcclxufSkoKTsiLCJ2YXIgQ29uZmlnID0gcmVxdWlyZSgnLi9fY29uZmlnLmpzJyk7XHJcblxyXG5mdW5jdGlvbiB1cGRhdGVBY3RpdmVTdGF0ZSgpIHtcclxuICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChcImFjdGl2ZVwiLCBmdW5jdGlvbiAoZGF0YSkge1xyXG4gICAgICAgIENvbmZpZy5iZWhhdmlvci5hY3RpdmUgPSAoZGF0YS5hY3RpdmUgIT09IGZhbHNlKTtcclxuXHJcbiAgICAgICAgaWYgKCFDb25maWcuYmVoYXZpb3IuYWN0aXZlKSB7XHJcbiAgICAgICAgICAgIFN0cmluZ0J1ZmZlci5yZXNldCgpO1xyXG4gICAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcblxyXG5jaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoZnVuY3Rpb24gKHJlcXVlc3QsIHNlbmRlciwgcmVzcG9uZCkge1xyXG4gICAgaWYgKHJlcXVlc3QuaWQgPT0gXCJ1cGRhdGVfYWN0aXZlX3N0YXRlXCIpIHtcclxuICAgICAgICB1cGRhdGVBY3RpdmVTdGF0ZSgpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbnVwZGF0ZUFjdGl2ZVN0YXRlKCk7IiwidmFyIENvbmZpZyA9IHJlcXVpcmUoJy4vX2NvbmZpZy5qcycpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgZXhwb3J0cyA9IHtcclxuICAgICAgICBvbkNoYW5nZTogZnVuY3Rpb24gKCkge30sXHJcbiAgICAgICAgb25DbGVhcjogZnVuY3Rpb24gKCkge30sXHJcbiAgICAgICAgb25CcmVhazogZnVuY3Rpb24gKCkge31cclxuICAgIH07XHJcblxyXG4gICAgdmFyIF9idWZmZXIgPSBcIlwiO1xyXG5cclxuICAgIGZ1bmN0aW9uIGNoYW5nZShtdXRhdG9yLCBzaWxlbnQpIHtcclxuICAgICAgICB2YXIgY2FjaGUgPSBfYnVmZmVyO1xyXG4gICAgICAgIF9idWZmZXIgPSBtdXRhdG9yKF9idWZmZXIpO1xyXG5cclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgIF9idWZmZXIgIT09IGNhY2hlICYmXHJcbiAgICAgICAgICAgIHR5cGVvZiBfYnVmZmVyID09PSBcInN0cmluZ1wiXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIGlmIChzaWxlbnQgIT09IHRydWUpIHtcclxuICAgICAgICAgICAgICAgIGV4cG9ydHMub25DaGFuZ2UoX2J1ZmZlciwgY2FjaGUpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoX2J1ZmZlci5sZW5ndGggPT09IDApIHtcclxuICAgICAgICAgICAgICAgIGV4cG9ydHMub25DbGVhcigpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIGNsZWFyKCkge1xyXG4gICAgICAgIGNoYW5nZShmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBcIlwiO1xyXG4gICAgICAgIH0sIHRydWUpO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydHMuaGFuZGxlS2V5UHJlc3MgPSBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgICAgICBjaGFuZ2UoZnVuY3Rpb24gKGJ1ZmZlcikge1xyXG4gICAgICAgICAgICBpZiAoZXZlbnQud2hpY2ggIT09IENvbmZpZy5rZXlzLnNwYWNlKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYnVmZmVyICsgZXZlbnQua2V5O1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLmhhbmRsZUtleURvd24gPSBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgIGV2ZW50LndoaWNoID09PSBDb25maWcua2V5cy5lbnRlciB8fFxyXG4gICAgICAgICAgICBldmVudC53aGljaCA9PT0gQ29uZmlnLmtleXMuc3BhY2VcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgZXhwb3J0cy5vbkJyZWFrKF9idWZmZXIpO1xyXG4gICAgICAgICAgICBjbGVhcigpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlbGVjdGlvbiBpcyBub3QgYSBzaW5nbGUgY2hhcmFjdGVyIChjdHJsK0EpXHJcbiAgICAgICAgaWYgKFV0aWxzLmlzQXJyb3dLZXkoZXZlbnQud2hpY2gpIHx8ICEod2luZG93LmdldFNlbGVjdGlvbigpLmlzQ29sbGFwc2VkKSkge1xyXG4gICAgICAgICAgICBjbGVhcigpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZXZlbnQud2hpY2ggPT09IENvbmZpZy5rZXlzLmJhY2tzcGFjZSkge1xyXG4gICAgICAgICAgICBjaGFuZ2UoZnVuY3Rpb24gKGJ1ZmZlcikge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlci5zbGljZSgwLCAtMSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH07XHJcblxyXG4gICAgZXhwb3J0cy5yZXNldCA9IGNsZWFyO1xyXG4gICAgZXhwb3J0cy5nZXRCdWZmZXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmV0dXJuIF9idWZmZXI7XHJcbiAgICB9O1xyXG5cclxuICAgIHJldHVybiBleHBvcnRzO1xyXG59KSgpOyIsInZhciBDb25maWcgPSByZXF1aXJlKCcuL19jb25maWcuanMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgZm9ybVJlcGxhY2U6IGZ1bmN0aW9uIChlbGVtLCBzZWFyY2gsIHJlcGxhY2UpIHtcclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgICFlbGVtIHx8XHJcbiAgICAgICAgICAgIHR5cGVvZiBlbGVtLnZhbHVlICE9PSBcInN0cmluZ1wiIHx8XHJcbiAgICAgICAgICAgIHR5cGVvZiBlbGVtLnNlbGVjdGlvblN0YXJ0ICE9PSBcIm51bWJlclwiXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciB2YWx1ZSA9IGVsZW0udmFsdWUsXHJcbiAgICAgICAgICAgIGVuZEluZGV4ID0gZWxlbS5zZWxlY3Rpb25TdGFydCxcclxuICAgICAgICAgICAgc3RhcnRJbmRleCA9IGVuZEluZGV4IC0gc2VhcmNoLmxlbmd0aDtcclxuXHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBzdGFydEluZGV4ID49IDAgJiZcclxuICAgICAgICAgICAgZW5kSW5kZXggPiBzdGFydEluZGV4ICYmXHJcbiAgICAgICAgICAgIHZhbHVlLnN1YnN0cihzdGFydEluZGV4LCBlbmRJbmRleCkgPT09IHNlYXJjaFxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgICB2YXIgYmVmb3JlID0gdmFsdWUuc3Vic3RyKDAsIHN0YXJ0SW5kZXgpO1xyXG4gICAgICAgICAgICB2YXIgYWZ0ZXIgPSB2YWx1ZS5zdWJzdHIoZW5kSW5kZXgpO1xyXG5cclxuICAgICAgICAgICAgZWxlbS52YWx1ZSA9IGJlZm9yZSArIHJlcGxhY2UgKyBhZnRlcjtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIG1hdGNoU2VsZWN0aW9uOiBmdW5jdGlvbiAoc2VhcmNoLCBjYWxsYmFjaykge1xyXG4gICAgICAgIHZhciBzZWxlY3Rpb24gPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XHJcblxyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgICAgc2VsZWN0aW9uICYmXHJcbiAgICAgICAgICAgIHNlbGVjdGlvbi5mb2N1c05vZGUgJiZcclxuICAgICAgICAgICAgc2VsZWN0aW9uLmZvY3VzTm9kZS5ub2RlVmFsdWVcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgdmFyIG5vZGUgPSBzZWxlY3Rpb24uZm9jdXNOb2RlO1xyXG4gICAgICAgICAgICB2YXIgZW5kSW5kZXggPSBzZWxlY3Rpb24uZm9jdXNPZmZzZXQ7XHJcbiAgICAgICAgICAgIHZhciBzdGFydEluZGV4ID0gZW5kSW5kZXggLSBzZWFyY2gubGVuZ3RoO1xyXG5cclxuICAgICAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICAgICAgc3RhcnRJbmRleCA+PSAwICYmXHJcbiAgICAgICAgICAgICAgICBlbmRJbmRleCA+IHN0YXJ0SW5kZXggJiZcclxuICAgICAgICAgICAgICAgIHNlbGVjdGlvbi5yYW5nZUNvdW50ID4gMCAmJlxyXG4gICAgICAgICAgICAgICAgbm9kZS5ub2RlVmFsdWUuc3Vic3RyaW5nKHN0YXJ0SW5kZXgsIGVuZEluZGV4KSA9PT0gc2VhcmNoXHJcbiAgICAgICAgICAgICkge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2sobm9kZSwgc3RhcnRJbmRleCwgZW5kSW5kZXgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH0sXHJcblxyXG4gICAgaXNFbGVtZW50RW1vamlFbGlnaWJsZTogZnVuY3Rpb24gKGVsZW0pIHtcclxuICAgICAgICB2YXIgZm9yYmlkZGVuID0gW1wiZW1haWxcIiwgXCJwYXNzd29yZFwiLCBcInRlbFwiXVxyXG4gICAgICAgICwgICB0eXBlID0gZWxlbS5nZXRBdHRyaWJ1dGUoXCJ0eXBlXCIpXHJcbiAgICAgICAgLCAgIG5hbWUgPSBlbGVtLmdldEF0dHJpYnV0ZShcIm5hbWVcIik7XHJcblxyXG4gICAgICAgIHJldHVybiAoXHJcbiAgICAgICAgICAgIHRoaXMuaXNFbGVtZW50RWRpdGFibGUoZWxlbSkgJiZcclxuICAgICAgICAgICAgZm9yYmlkZGVuLmluZGV4T2YodHlwZSkgPT0gLTEgJiZcclxuICAgICAgICAgICAgZm9yYmlkZGVuLmluZGV4T2YobmFtZSkgPT0gLTFcclxuICAgICAgICApO1xyXG4gICAgfSxcclxuXHJcbiAgICBpc0VsZW1lbnRFZGl0YWJsZTogZnVuY3Rpb24gKGVsZW0pIHtcclxuICAgICAgICByZXR1cm4gKGVsZW0gJiYgKFxyXG4gICAgICAgICAgICBlbGVtLmhhc0F0dHJpYnV0ZShcImNvbnRlbnRlZGl0YWJsZVwiKSB8fFxyXG4gICAgICAgICAgICBlbGVtLnRhZ05hbWUgPT09IFwiVEVYVEFSRUFcIiB8fFxyXG4gICAgICAgICAgICBlbGVtLnRhZ05hbWUgPT09IFwiSU5QVVRcIlxyXG4gICAgICAgICkpO1xyXG4gICAgfSxcclxuXHJcbiAgICBnZXRFbGVtZW50Qm9keU9mZnNldDogZnVuY3Rpb24gKGVsZW0pIHtcclxuICAgICAgICB2YXIgdmlld3BvcnRPZmZzZXQgPSBlbGVtLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXHJcbiAgICAgICAgLCAgIHNjcm9sbFRvcCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxUb3AgKyBkb2N1bWVudC5ib2R5LnNjcm9sbFRvcFxyXG4gICAgICAgICwgICBzY3JvbGxMZWZ0ID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbExlZnQgKyBkb2N1bWVudC5ib2R5LnNjcm9sbExlZnRcclxuICAgICAgICAsICAgb2Zmc2V0RWxlbSA9IGVsZW1cclxuICAgICAgICAsICAgcmVzdWx0ID0ge1xyXG4gICAgICAgICAgICAgICAgdG9wOiAwLFxyXG4gICAgICAgICAgICAgICAgbGVmdDogMCxcclxuICAgICAgICAgICAgICAgIGZpeGVkOiBmYWxzZVxyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICBkbyB7XHJcbiAgICAgICAgICAgIHZhciBjb21wdXRlZCA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKG9mZnNldEVsZW0pO1xyXG5cclxuICAgICAgICAgICAgaWYgKGNvbXB1dGVkICYmIGNvbXB1dGVkLnBvc2l0aW9uID09IFwiZml4ZWRcIikge1xyXG4gICAgICAgICAgICAgICAgcmVzdWx0LmZpeGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSB3aGlsZSAob2Zmc2V0RWxlbSA9IG9mZnNldEVsZW0ub2Zmc2V0UGFyZW50KTtcclxuXHJcbiAgICAgICAgcmVzdWx0LnRvcCA9IHZpZXdwb3J0T2Zmc2V0LnRvcDtcclxuICAgICAgICByZXN1bHQubGVmdCA9IHZpZXdwb3J0T2Zmc2V0LmxlZnQ7XHJcblxyXG4gICAgICAgIGlmICghcmVzdWx0LmZpeGVkKSB7XHJcbiAgICAgICAgICAgIHJlc3VsdC50b3AgKz0gc2Nyb2xsVG9wO1xyXG4gICAgICAgICAgICByZXN1bHQubGVmdCArPSBzY3JvbGxMZWZ0O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcclxuICAgIH0sXHJcblxyXG4gICAgZ2V0Q29udGVudGVkaXRhYmxlQ2FyZXRCb2R5T2Zmc2V0OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdmFyIHNlbGVjdGlvbiA9IHdpbmRvdy5nZXRTZWxlY3Rpb24oKSxcclxuICAgICAgICAgICAgcmFuZ2UgPSBzZWxlY3Rpb24uZ2V0UmFuZ2VBdChzZWxlY3Rpb24ucmFuZ2VDb3VudCAtIDEpLFxyXG4gICAgICAgICAgICBjbG9uZWRSYW5nZSA9IHJhbmdlLmNsb25lUmFuZ2UoKTtcclxuXHJcbiAgICAgICAgdmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcclxuICAgICAgICBjbG9uZWRSYW5nZS5pbnNlcnROb2RlKG5vZGUpO1xyXG5cclxuICAgICAgICB2YXIgb2Zmc2V0ID0gdGhpcy5nZXRFbGVtZW50Qm9keU9mZnNldChub2RlKTtcclxuXHJcbiAgICAgICAgdmFyIHBhcmVudCA9IG5vZGUucGFyZW50Tm9kZTtcclxuICAgICAgICBwYXJlbnQucmVtb3ZlQ2hpbGQobm9kZSk7XHJcbiAgICAgICAgcGFyZW50Lm5vcm1hbGl6ZSgpO1xyXG5cclxuICAgICAgICByZXR1cm4gb2Zmc2V0O1xyXG4gICAgfSxcclxuXHJcbiAgICBpc0Fycm93S2V5OiBmdW5jdGlvbiAoY29kZSkge1xyXG4gICAgICAgIHJldHVybiBjb2RlID49IENvbmZpZy5rZXlzLmxlZnQgJiYgY29kZSA8PSBDb25maWcua2V5cy5kb3duO1xyXG4gICAgfSxcclxuXHJcbiAgICBjbGlwV2l0aElucHV0OiBmdW5jdGlvbiAodGV4dCkge1xyXG4gICAgICAgIHZhciBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKTtcclxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGlucHV0KTtcclxuXHJcbiAgICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImZvY3VzXCIsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaW5wdXQudmFsdWUgPSB0ZXh0O1xyXG4gICAgICAgIGlucHV0LnNlbGVjdCgpO1xyXG5cclxuICAgICAgICBkb2N1bWVudC5leGVjQ29tbWFuZChcImNvcHlcIik7XHJcbiAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChpbnB1dCk7XHJcbiAgICB9LFxyXG5cclxuICAgIGNsaXBXaXRoU2VsZWN0aW9uOiBmdW5jdGlvbiAodGV4dCkge1xyXG4gICAgICAgIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGV4dCksXHJcbiAgICAgICAgICAgIHNlbGVjdGlvbiA9IHdpbmRvdy5nZXRTZWxlY3Rpb24oKSxcclxuICAgICAgICAgICAgcmFuZ2UgPSBkb2N1bWVudC5jcmVhdGVSYW5nZSgpLFxyXG4gICAgICAgICAgICBjbG9uZSA9IG51bGw7XHJcblxyXG4gICAgICAgIGlmIChzZWxlY3Rpb24ucmFuZ2VDb3VudCA+IDApIHtcclxuICAgICAgICAgICAgY2xvbmUgPSBzZWxlY3Rpb24uZ2V0UmFuZ2VBdChzZWxlY3Rpb24ucmFuZ2VDb3VudCAtIDEpLmNsb25lUmFuZ2UoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobm9kZSk7XHJcbiAgICAgICAgc2VsZWN0aW9uLnJlbW92ZUFsbFJhbmdlcygpO1xyXG4gICAgICAgIHJhbmdlLnNlbGVjdE5vZGVDb250ZW50cyhub2RlKTtcclxuICAgICAgICBzZWxlY3Rpb24uYWRkUmFuZ2UocmFuZ2UpO1xyXG4gICAgICAgIGRvY3VtZW50LmV4ZWNDb21tYW5kKFwiY29weVwiKTtcclxuXHJcbiAgICAgICAgc2VsZWN0aW9uLnJlbW92ZUFsbFJhbmdlcygpO1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQobm9kZSk7XHJcblxyXG4gICAgICAgIGlmIChjbG9uZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBzZWxlY3Rpb24uYWRkUmFuZ2UoY2xvbmUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiLCJ2YXIgbG9jYXRpb24gPSBnbG9iYWwubG9jYXRpb24gfHwge307XG4vKmpzbGludCBpbmRlbnQ6IDIsIGJyb3dzZXI6IHRydWUsIGJpdHdpc2U6IHRydWUsIHBsdXNwbHVzOiB0cnVlICovXG52YXIgdHdlbW9qaSA9IChmdW5jdGlvbiAoXG4gIC8qISBDb3B5cmlnaHQgVHdpdHRlciBJbmMuIGFuZCBvdGhlciBjb250cmlidXRvcnMuIExpY2Vuc2VkIHVuZGVyIE1JVCAqLy8qXG4gICAgaHR0cHM6Ly9naXRodWIuY29tL3R3aXR0ZXIvdHdlbW9qaS9ibG9iL2doLXBhZ2VzL0xJQ0VOU0VcbiAgKi9cblxuICAvLyBXQVJOSU5HOiAgIHRoaXMgZmlsZSBpcyBnZW5lcmF0ZWQgYXV0b21hdGljYWxseSB2aWFcbiAgLy8gICAgICAgICAgICBgbm9kZSB0d2Vtb2ppLWdlbmVyYXRvci5qc2BcbiAgLy8gICAgICAgICAgICBwbGVhc2UgdXBkYXRlIGl0cyBgY3JlYXRlVHdlbW9qaWAgZnVuY3Rpb25cbiAgLy8gICAgICAgICAgICBhdCB0aGUgYm90dG9tIG9mIHRoZSBzYW1lIGZpbGUgaW5zdGVhZC5cblxuKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICAvKmpzaGludCBtYXhwYXJhbXM6NCAqL1xuXG4gIHZhclxuICAgIC8vIHRoZSBleHBvcnRlZCBtb2R1bGUgb2JqZWN0XG4gICAgdHdlbW9qaSA9IHtcblxuXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgIC8vICAgICAgcHJvcGVydGllcyAgICAgLy9cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbiAgICAgIC8vIGRlZmF1bHQgYXNzZXRzIHVybCwgYnkgZGVmYXVsdCB3aWxsIGJlIFR3aXR0ZXIgSW5jLiBDRE5cbiAgICAgIGJhc2U6ICdodHRwczovL3R3ZW1vamkubWF4Y2RuLmNvbS8yLycsXG5cbiAgICAgIC8vIGRlZmF1bHQgYXNzZXRzIGZpbGUgZXh0ZW5zaW9ucywgYnkgZGVmYXVsdCAnLnBuZydcbiAgICAgIGV4dDogJy5wbmcnLFxuXG4gICAgICAvLyBkZWZhdWx0IGFzc2V0cy9mb2xkZXIgc2l6ZSwgYnkgZGVmYXVsdCBcIjcyeDcyXCJcbiAgICAgIC8vIGF2YWlsYWJsZSB2aWEgVHdpdHRlciBDRE46IDcyXG4gICAgICBzaXplOiAnNzJ4NzInLFxuXG4gICAgICAvLyBkZWZhdWx0IGNsYXNzIG5hbWUsIGJ5IGRlZmF1bHQgJ2Vtb2ppJ1xuICAgICAgY2xhc3NOYW1lOiAnZW1vamknLFxuXG4gICAgICAvLyBiYXNpYyB1dGlsaXRpZXMgLyBoZWxwZXJzIHRvIGNvbnZlcnQgY29kZSBwb2ludHNcbiAgICAgIC8vIHRvIEphdmFTY3JpcHQgc3Vycm9nYXRlcyBhbmQgdmljZSB2ZXJzYVxuICAgICAgY29udmVydDoge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHaXZlbiBhbiBIRVggY29kZXBvaW50LCByZXR1cm5zIFVURjE2IHN1cnJvZ2F0ZSBwYWlycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtICAgc3RyaW5nICBnZW5lcmljIGNvZGVwb2ludCwgaS5lLiAnMUY0QTknXG4gICAgICAgICAqIEByZXR1cm4gIHN0cmluZyAgY29kZXBvaW50IHRyYW5zZm9ybWVkIGludG8gdXRmMTYgc3Vycm9nYXRlcyBwYWlyLFxuICAgICAgICAgKiAgICAgICAgICBpLmUuIFxcdUQ4M0RcXHVEQ0E5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqICB0d2Vtb2ppLmNvbnZlcnQuZnJvbUNvZGVQb2ludCgnMWYxZTgnKTtcbiAgICAgICAgICogIC8vIFwiXFx1ZDgzY1xcdWRkZThcIlxuICAgICAgICAgKlxuICAgICAgICAgKiAgJzFmMWU4LTFmMWYzJy5zcGxpdCgnLScpLm1hcCh0d2Vtb2ppLmNvbnZlcnQuZnJvbUNvZGVQb2ludCkuam9pbignJylcbiAgICAgICAgICogIC8vIFwiXFx1ZDgzY1xcdWRkZThcXHVkODNjXFx1ZGRmM1wiXG4gICAgICAgICAqL1xuICAgICAgICBmcm9tQ29kZVBvaW50OiBmcm9tQ29kZVBvaW50LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHaXZlbiBVVEYxNiBzdXJyb2dhdGUgcGFpcnMsIHJldHVybnMgdGhlIGVxdWl2YWxlbnQgSEVYIGNvZGVwb2ludC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtICAgc3RyaW5nICBnZW5lcmljIHV0ZjE2IHN1cnJvZ2F0ZXMgcGFpciwgaS5lLiBcXHVEODNEXFx1RENBOVxuICAgICAgICAgKiBAcGFyYW0gICBzdHJpbmcgIG9wdGlvbmFsIHNlcGFyYXRvciBmb3IgZG91YmxlIGNvZGUgcG9pbnRzLCBkZWZhdWx0PSctJ1xuICAgICAgICAgKiBAcmV0dXJuICBzdHJpbmcgIHV0ZjE2IHRyYW5zZm9ybWVkIGludG8gY29kZXBvaW50LCBpLmUuICcxRjRBOSdcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogIHR3ZW1vamkuY29udmVydC50b0NvZGVQb2ludCgnXFx1ZDgzY1xcdWRkZThcXHVkODNjXFx1ZGRmMycpO1xuICAgICAgICAgKiAgLy8gXCIxZjFlOC0xZjFmM1wiXG4gICAgICAgICAqXG4gICAgICAgICAqICB0d2Vtb2ppLmNvbnZlcnQudG9Db2RlUG9pbnQoJ1xcdWQ4M2NcXHVkZGU4XFx1ZDgzY1xcdWRkZjMnLCAnficpO1xuICAgICAgICAgKiAgLy8gXCIxZjFlOH4xZjFmM1wiXG4gICAgICAgICAqL1xuICAgICAgICB0b0NvZGVQb2ludDogdG9Db2RlUG9pbnRcbiAgICAgIH0sXG5cblxuICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAvLyAgICAgICBtZXRob2RzICAgICAgIC8vXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4gICAgICAvKipcbiAgICAgICAqIFVzZXIgZmlyc3Q6IHVzZWQgdG8gcmVtb3ZlIG1pc3NpbmcgaW1hZ2VzXG4gICAgICAgKiBwcmVzZXJ2aW5nIHRoZSBvcmlnaW5hbCB0ZXh0IGludGVudCB3aGVuXG4gICAgICAgKiBhIGZhbGxiYWNrIGZvciBuZXR3b3JrIHByb2JsZW1zIGlzIGRlc2lyZWQuXG4gICAgICAgKiBBdXRvbWF0aWNhbGx5IGFkZGVkIHRvIEltYWdlIG5vZGVzIHZpYSBET01cbiAgICAgICAqIEl0IGNvdWxkIGJlIHJlY3ljbGVkIGZvciBzdHJpbmcgb3BlcmF0aW9ucyB2aWE6XG4gICAgICAgKiAgJCgnaW1nLmVtb2ppJykub24oJ2Vycm9yJywgdHdlbW9qaS5vbmVycm9yKVxuICAgICAgICovXG4gICAgICBvbmVycm9yOiBmdW5jdGlvbiBvbmVycm9yKCkge1xuICAgICAgICBpZiAodGhpcy5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgdGhpcy5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChjcmVhdGVUZXh0KHRoaXMuYWx0LCBmYWxzZSksIHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIE1haW4gbWV0aG9kL2xvZ2ljIHRvIGdlbmVyYXRlIGVpdGhlciA8aW1nPiB0YWdzIG9yIEhUTUxJbWFnZSBub2Rlcy5cbiAgICAgICAqICBcImVtb2ppZnlcIiBhIGdlbmVyaWMgdGV4dCBvciBET00gRWxlbWVudC5cbiAgICAgICAqXG4gICAgICAgKiBAb3ZlcmxvYWRzXG4gICAgICAgKlxuICAgICAgICogU3RyaW5nIHJlcGxhY2VtZW50IGZvciBgaW5uZXJIVE1MYCBvciBzZXJ2ZXIgc2lkZSBvcGVyYXRpb25zXG4gICAgICAgKiAgdHdlbW9qaS5wYXJzZShzdHJpbmcpO1xuICAgICAgICogIHR3ZW1vamkucGFyc2Uoc3RyaW5nLCBGdW5jdGlvbik7XG4gICAgICAgKiAgdHdlbW9qaS5wYXJzZShzdHJpbmcsIE9iamVjdCk7XG4gICAgICAgKlxuICAgICAgICogSFRNTEVsZW1lbnQgdHJlZSBwYXJzaW5nIGZvciBzYWZlciBvcGVyYXRpb25zIG92ZXIgZXhpc3RpbmcgRE9NXG4gICAgICAgKiAgdHdlbW9qaS5wYXJzZShIVE1MRWxlbWVudCk7XG4gICAgICAgKiAgdHdlbW9qaS5wYXJzZShIVE1MRWxlbWVudCwgRnVuY3Rpb24pO1xuICAgICAgICogIHR3ZW1vamkucGFyc2UoSFRNTEVsZW1lbnQsIE9iamVjdCk7XG4gICAgICAgKlxuICAgICAgICogQHBhcmFtICAgc3RyaW5nfEhUTUxFbGVtZW50ICB0aGUgc291cmNlIHRvIHBhcnNlIGFuZCBlbnJpY2ggd2l0aCBlbW9qaS5cbiAgICAgICAqXG4gICAgICAgKiAgICAgICAgICBzdHJpbmcgICAgICAgICAgICAgIHJlcGxhY2UgZW1vamkgbWF0Y2hlcyB3aXRoIDxpbWc+IHRhZ3MuXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1haW5seSB1c2VkIHRvIGluamVjdCBlbW9qaSB2aWEgYGlubmVySFRNTGBcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSXQgZG9lcyAqKm5vdCoqIHBhcnNlIHRoZSBzdHJpbmcgb3IgdmFsaWRhdGUgaXQsXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0IHNpbXBseSByZXBsYWNlcyBmb3VuZCBlbW9qaSB3aXRoIGEgdGFnLlxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBOT1RFOiBiZSBzdXJlIHRoaXMgd29uJ3QgYWZmZWN0IHNlY3VyaXR5LlxuICAgICAgICpcbiAgICAgICAqICAgICAgICAgIEhUTUxFbGVtZW50ICAgICAgICAgd2FsayB0aHJvdWdoIHRoZSBET00gdHJlZSBhbmQgZmluZCBlbW9qaVxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0IGFyZSBpbnNpZGUgKip0ZXh0IG5vZGUgb25seSoqIChub2RlVHlwZSA9PT0gMylcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWFpbmx5IHVzZWQgdG8gcHV0IGVtb2ppIGluIGFscmVhZHkgZ2VuZXJhdGVkIERPTVxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aXRob3V0IGNvbXByb21pc2luZyBzdXJyb3VuZGluZyBub2RlcyBhbmRcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKiphdm9pZGluZyoqIHRoZSB1c2FnZSBvZiBgaW5uZXJIVE1MYC5cbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTk9URTogVXNpbmcgRE9NIGVsZW1lbnRzIGluc3RlYWQgb2Ygc3RyaW5ncyBzaG91bGRcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW1wcm92ZSBzZWN1cml0eSB3aXRob3V0IGNvbXByb21pc2luZyB0b28gbXVjaFxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZXJmb3JtYW5jZSBjb21wYXJlZCB3aXRoIGEgbGVzcyBzYWZlIGBpbm5lckhUTUxgLlxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSAgIEZ1bmN0aW9ufE9iamVjdCAgW29wdGlvbmFsXVxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlaXRoZXIgdGhlIGNhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIG9yIGFuIG9iamVjdFxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aXRoIGFsbCBwcm9wZXJ0aWVzIHRvIHVzZSBwZXIgZWFjaCBmb3VuZCBlbW9qaS5cbiAgICAgICAqXG4gICAgICAgKiAgICAgICAgICBGdW5jdGlvbiAgICAgICAgICAgIGlmIHNwZWNpZmllZCwgdGhpcyB3aWxsIGJlIGludm9rZWQgcGVyIGVhY2ggZW1vamlcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdCBoYXMgYmVlbiBmb3VuZCB0aHJvdWdoIHRoZSBSZWdFeHAgZXhjZXB0XG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRob3NlIGZvbGx3ZWQgYnkgdGhlIGludmFyaWFudCBcXHVGRTBFIChcImFzIHRleHRcIikuXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9uY2UgaW52b2tlZCwgcGFyYW1ldGVycyB3aWxsIGJlOlxuICAgICAgICpcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpY29uSWQ6c3RyaW5nICAgICB0aGUgbG93ZXIgY2FzZSBIRVggY29kZSBwb2ludFxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGkuZS4gXCIxZjRhOVwiXG4gICAgICAgKlxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6T2JqZWN0ICAgIGFsbCBpbmZvIGZvciB0aGlzIHBhcnNpbmcgb3BlcmF0aW9uXG4gICAgICAgKlxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ6Y2hhciAgICAgIHRoZSBvcHRpb25hbCBcXHVGRTBGIChcImFzIGltYWdlXCIpXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudCwgaW4gY2FzZSB0aGlzIGluZm9cbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpcyBhbnlob3cgbWVhbmluZ2Z1bC5cbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBCeSBkZWZhdWx0IHRoaXMgaXMgaWdub3JlZC5cbiAgICAgICAqXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIElmIHN1Y2ggY2FsbGJhY2sgd2lsbCByZXR1cm4gYSBmYWxzeSB2YWx1ZSBpbnN0ZWFkXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9mIGEgdmFsaWQgYHNyY2AgdG8gdXNlIGZvciB0aGUgaW1hZ2UsIG5vdGhpbmcgd2lsbFxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY3R1YWxseSBjaGFuZ2UgZm9yIHRoYXQgc3BlY2lmaWMgZW1vamkuXG4gICAgICAgKlxuICAgICAgICpcbiAgICAgICAqICAgICAgICAgIE9iamVjdCAgICAgICAgICAgICAgaWYgc3BlY2lmaWVkLCBhbiBvYmplY3QgY29udGFpbmluZyB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXNcbiAgICAgICAqXG4gICAgICAgKiAgICAgICAgICAgIGNhbGxiYWNrICAgRnVuY3Rpb24gIHRoZSBjYWxsYmFjayB0byBpbnZva2UgcGVyIGVhY2ggZm91bmQgZW1vamkuXG4gICAgICAgKiAgICAgICAgICAgIGJhc2UgICAgICAgc3RyaW5nICAgIHRoZSBiYXNlIHVybCwgYnkgZGVmYXVsdCB0d2Vtb2ppLmJhc2VcbiAgICAgICAqICAgICAgICAgICAgZXh0ICAgICAgICBzdHJpbmcgICAgdGhlIGltYWdlIGV4dGVuc2lvbiwgYnkgZGVmYXVsdCB0d2Vtb2ppLmV4dFxuICAgICAgICogICAgICAgICAgICBzaXplICAgICAgIHN0cmluZyAgICB0aGUgYXNzZXRzIHNpemUsIGJ5IGRlZmF1bHQgdHdlbW9qaS5zaXplXG4gICAgICAgKlxuICAgICAgICogQGV4YW1wbGVcbiAgICAgICAqXG4gICAgICAgKiAgdHdlbW9qaS5wYXJzZShcIkkgXFx1Mjc2NFxcdUZFMEYgZW1vamkhXCIpO1xuICAgICAgICogIC8vIEkgPGltZyBjbGFzcz1cImVtb2ppXCIgZHJhZ2dhYmxlPVwiZmFsc2VcIiBhbHQ9XCLinaTvuI9cIiBzcmM9XCIvYXNzZXRzLzI3NjQuZ2lmXCIvPiBlbW9qaSFcbiAgICAgICAqXG4gICAgICAgKlxuICAgICAgICogIHR3ZW1vamkucGFyc2UoXCJJIFxcdTI3NjRcXHVGRTBGIGVtb2ppIVwiLCBmdW5jdGlvbihpY29uSWQsIG9wdGlvbnMpIHtcbiAgICAgICAqICAgIHJldHVybiAnL2Fzc2V0cy8nICsgaWNvbklkICsgJy5naWYnO1xuICAgICAgICogIH0pO1xuICAgICAgICogIC8vIEkgPGltZyBjbGFzcz1cImVtb2ppXCIgZHJhZ2dhYmxlPVwiZmFsc2VcIiBhbHQ9XCLinaTvuI9cIiBzcmM9XCIvYXNzZXRzLzI3NjQuZ2lmXCIvPiBlbW9qaSFcbiAgICAgICAqXG4gICAgICAgKlxuICAgICAgICogdHdlbW9qaS5wYXJzZShcIkkgXFx1Mjc2NFxcdUZFMEYgZW1vamkhXCIsIHtcbiAgICAgICAqICAgc2l6ZTogNzIsXG4gICAgICAgKiAgIGNhbGxiYWNrOiBmdW5jdGlvbihpY29uSWQsIG9wdGlvbnMpIHtcbiAgICAgICAqICAgICByZXR1cm4gJy9hc3NldHMvJyArIG9wdGlvbnMuc2l6ZSArICcvJyArIGljb25JZCArIG9wdGlvbnMuZXh0O1xuICAgICAgICogICB9XG4gICAgICAgKiB9KTtcbiAgICAgICAqICAvLyBJIDxpbWcgY2xhc3M9XCJlbW9qaVwiIGRyYWdnYWJsZT1cImZhbHNlXCIgYWx0PVwi4p2k77iPXCIgc3JjPVwiL2Fzc2V0cy83Mng3Mi8yNzY0LnBuZ1wiLz4gZW1vamkhXG4gICAgICAgKlxuICAgICAgICovXG4gICAgICBwYXJzZTogcGFyc2UsXG5cbiAgICAgIC8qKlxuICAgICAgICogR2l2ZW4gYSBzdHJpbmcsIGludm9rZXMgdGhlIGNhbGxiYWNrIGFyZ3VtZW50XG4gICAgICAgKiAgcGVyIGVhY2ggZW1vamkgZm91bmQgaW4gc3VjaCBzdHJpbmcuXG4gICAgICAgKiBUaGlzIGlzIHRoZSBtb3N0IHJhdyB2ZXJzaW9uIHVzZWQgYnlcbiAgICAgICAqICB0aGUgLnBhcnNlKHN0cmluZykgbWV0aG9kIGl0c2VsZi5cbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0gICBzdHJpbmcgICAgZ2VuZXJpYyBzdHJpbmcgdG8gcGFyc2VcbiAgICAgICAqIEBwYXJhbSAgIEZ1bmN0aW9uICBhIGdlbmVyaWMgY2FsbGJhY2sgdGhhdCB3aWxsIGJlXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgaW52b2tlZCB0byByZXBsYWNlIHRoZSBjb250ZW50LlxuICAgICAgICogICAgICAgICAgICAgICAgICAgIFRoaXMgY2FsYmFjayB3aWwgcmVjZWl2ZSBzdGFuZGFyZFxuICAgICAgICogICAgICAgICAgICAgICAgICAgIFN0cmluZy5wcm90b3R5cGUucmVwbGFjZShzdHIsIGNhbGxiYWNrKVxuICAgICAgICogICAgICAgICAgICAgICAgICAgIGFyZ3VtZW50cyBzdWNoOlxuICAgICAgICogIGNhbGxiYWNrKFxuICAgICAgICogICAgcmF3VGV4dCwgIC8vIHRoZSBlbW9qaSBtYXRjaFxuICAgICAgICogICk7XG4gICAgICAgKlxuICAgICAgICogICAgICAgICAgICAgICAgICAgIGFuZCBvdGhlcnMgY29tbW9ubHkgcmVjZWl2ZWQgdmlhIHJlcGxhY2UuXG4gICAgICAgKi9cbiAgICAgIHJlcGxhY2U6IHJlcGxhY2UsXG5cbiAgICAgIC8qKlxuICAgICAgICogU2ltcGxpZnkgc3RyaW5nIHRlc3RzIGFnYWluc3QgZW1vamkuXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtICAgc3RyaW5nICBzb21lIHRleHQgdGhhdCBtaWdodCBjb250YWluIGVtb2ppXG4gICAgICAgKiBAcmV0dXJuICBib29sZWFuIHRydWUgaWYgYW55IGVtb2ppIHdhcyBmb3VuZCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAgICpcbiAgICAgICAqIEBleGFtcGxlXG4gICAgICAgKlxuICAgICAgICogIGlmICh0d2Vtb2ppLnRlc3Qoc29tZUNvbnRlbnQpKSB7XG4gICAgICAgKiAgICBjb25zb2xlLmxvZyhcImVtb2ppIEFsbCBUaGUgVGhpbmdzIVwiKTtcbiAgICAgICAqICB9XG4gICAgICAgKi9cbiAgICAgIHRlc3Q6IHRlc3RcbiAgICB9LFxuXG4gICAgLy8gdXNlZCB0byBlc2NhcGUgSFRNTCBzcGVjaWFsIGNoYXJzIGluIGF0dHJpYnV0ZXNcbiAgICBlc2NhcGVyID0ge1xuICAgICAgJyYnOiAnJmFtcDsnLFxuICAgICAgJzwnOiAnJmx0OycsXG4gICAgICAnPic6ICcmZ3Q7JyxcbiAgICAgIFwiJ1wiOiAnJiMzOTsnLFxuICAgICAgJ1wiJzogJyZxdW90OydcbiAgICB9LFxuXG4gICAgLy8gUmVnRXhwIGJhc2VkIG9uIGVtb2ppJ3Mgb2ZmaWNpYWwgVW5pY29kZSBzdGFuZGFyZHNcbiAgICAvLyBodHRwOi8vd3d3LnVuaWNvZGUub3JnL1B1YmxpYy9VTklEQVRBL0Vtb2ppU291cmNlcy50eHRcbiAgICByZSA9IC9cXHVkODNkW1xcdWRjNjgtXFx1ZGM2OV0oPzpcXHVkODNjW1xcdWRmZmItXFx1ZGZmZl0pP1xcdTIwMGQoPzpcXHUyNjk1XFx1ZmUwZnxcXHUyNjk2XFx1ZmUwZnxcXHUyNzA4XFx1ZmUwZnxcXHVkODNjW1xcdWRmM2VcXHVkZjczXFx1ZGY5M1xcdWRmYTRcXHVkZmE4XFx1ZGZlYlxcdWRmZWRdfFxcdWQ4M2RbXFx1ZGNiYlxcdWRjYmNcXHVkZDI3XFx1ZGQyY1xcdWRlODBcXHVkZTkyXSl8KD86XFx1ZDgzY1tcXHVkZmNiXFx1ZGZjY118XFx1ZDgzZFxcdWRkNzV8XFx1MjZmOSkoPzpcXHVmZTBmfFxcdWQ4M2NbXFx1ZGZmYi1cXHVkZmZmXSlcXHUyMDBkW1xcdTI2NDBcXHUyNjQyXVxcdWZlMGZ8KD86XFx1ZDgzY1tcXHVkZmMzXFx1ZGZjNFxcdWRmY2FdfFxcdWQ4M2RbXFx1ZGM2ZVxcdWRjNzFcXHVkYzczXFx1ZGM3N1xcdWRjODFcXHVkYzgyXFx1ZGM4NlxcdWRjODdcXHVkZTQ1LVxcdWRlNDdcXHVkZTRiXFx1ZGU0ZFxcdWRlNGVcXHVkZWEzXFx1ZGViNC1cXHVkZWI2XXxcXHVkODNlW1xcdWRkMjZcXHVkZDM3LVxcdWRkMzlcXHVkZDNkXFx1ZGQzZVxcdWRkZDYtXFx1ZGRkZF0pKD86XFx1ZDgzY1tcXHVkZmZiLVxcdWRmZmZdKT9cXHUyMDBkW1xcdTI2NDBcXHUyNjQyXVxcdWZlMGZ8XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1Mjc2NFxcdWZlMGZcXHUyMDBkXFx1ZDgzZFxcdWRjOGJcXHUyMDBkXFx1ZDgzZFxcdWRjNjh8XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjZcXHUyMDBkXFx1ZDgzZFxcdWRjNjZ8XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjdcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjZcXHUyMDBkXFx1ZDgzZFxcdWRjNjZ8XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjdcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1Mjc2NFxcdWZlMGZcXHUyMDBkXFx1ZDgzZFxcdWRjOGJcXHUyMDBkXFx1ZDgzZFtcXHVkYzY4XFx1ZGM2OV18XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjZcXHUyMDBkXFx1ZDgzZFxcdWRjNjZ8XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjdcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1Mjc2NFxcdWZlMGZcXHUyMDBkXFx1ZDgzZFxcdWRjNjh8XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjZcXHUyMDBkXFx1ZDgzZFxcdWRjNjZ8XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjdcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1Mjc2NFxcdWZlMGZcXHUyMDBkXFx1ZDgzZFtcXHVkYzY4XFx1ZGM2OV18XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjZcXHUyMDBkXFx1ZDgzZFxcdWRjNjZ8XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjdcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzY1xcdWRmZjNcXHVmZTBmXFx1MjAwZFxcdWQ4M2NcXHVkZjA4fFxcdWQ4M2NcXHVkZmY0XFx1MjAwZFxcdTI2MjBcXHVmZTBmfFxcdWQ4M2RcXHVkYzQxXFx1MjAwZFxcdWQ4M2RcXHVkZGU4fFxcdWQ4M2RcXHVkYzY4XFx1MjAwZFxcdWQ4M2RbXFx1ZGM2NlxcdWRjNjddfFxcdWQ4M2RcXHVkYzY5XFx1MjAwZFxcdWQ4M2RbXFx1ZGM2NlxcdWRjNjddfFxcdWQ4M2RcXHVkYzZmXFx1MjAwZFxcdTI2NDBcXHVmZTBmfFxcdWQ4M2RcXHVkYzZmXFx1MjAwZFxcdTI2NDJcXHVmZTBmfFxcdWQ4M2VcXHVkZDNjXFx1MjAwZFxcdTI2NDBcXHVmZTBmfFxcdWQ4M2VcXHVkZDNjXFx1MjAwZFxcdTI2NDJcXHVmZTBmfFxcdWQ4M2VcXHVkZGRlXFx1MjAwZFxcdTI2NDBcXHVmZTBmfFxcdWQ4M2VcXHVkZGRlXFx1MjAwZFxcdTI2NDJcXHVmZTBmfFxcdWQ4M2VcXHVkZGRmXFx1MjAwZFxcdTI2NDBcXHVmZTBmfFxcdWQ4M2VcXHVkZGRmXFx1MjAwZFxcdTI2NDJcXHVmZTBmfCg/OltcXHUwMDIzXFx1MDAyYVxcdTAwMzAtXFx1MDAzOV0pXFx1ZmUwZj9cXHUyMGUzfCg/Oig/OlxcdWQ4M2NbXFx1ZGZjYlxcdWRmY2NdfFxcdWQ4M2RbXFx1ZGQ3NFxcdWRkNzVcXHVkZDkwXXxbXFx1MjYxZFxcdTI2ZjdcXHUyNmY5XFx1MjcwY1xcdTI3MGRdKSg/OlxcdWZlMGZ8KD8hXFx1ZmUwZSkpfFxcdWQ4M2NbXFx1ZGY4NVxcdWRmYzItXFx1ZGZjNFxcdWRmYzdcXHVkZmNhXXxcXHVkODNkW1xcdWRjNDJcXHVkYzQzXFx1ZGM0Ni1cXHVkYzUwXFx1ZGM2Ni1cXHVkYzY5XFx1ZGM2ZVxcdWRjNzAtXFx1ZGM3OFxcdWRjN2NcXHVkYzgxLVxcdWRjODNcXHVkYzg1LVxcdWRjODdcXHVkY2FhXFx1ZGQ3YVxcdWRkOTVcXHVkZDk2XFx1ZGU0NS1cXHVkZTQ3XFx1ZGU0Yi1cXHVkZTRmXFx1ZGVhM1xcdWRlYjQtXFx1ZGViNlxcdWRlYzBcXHVkZWNjXXxcXHVkODNlW1xcdWRkMTgtXFx1ZGQxY1xcdWRkMWVcXHVkZDFmXFx1ZGQyNlxcdWRkMzAtXFx1ZGQzOVxcdWRkM2RcXHVkZDNlXFx1ZGRkMS1cXHVkZGRkXXxbXFx1MjcwYVxcdTI3MGJdKSg/OlxcdWQ4M2NbXFx1ZGZmYi1cXHVkZmZmXXwpfFxcdWQ4M2NcXHVkZmY0XFx1ZGI0MFxcdWRjNjdcXHVkYjQwXFx1ZGM2MlxcdWRiNDBcXHVkYzY1XFx1ZGI0MFxcdWRjNmVcXHVkYjQwXFx1ZGM2N1xcdWRiNDBcXHVkYzdmfFxcdWQ4M2NcXHVkZmY0XFx1ZGI0MFxcdWRjNjdcXHVkYjQwXFx1ZGM2MlxcdWRiNDBcXHVkYzczXFx1ZGI0MFxcdWRjNjNcXHVkYjQwXFx1ZGM3NFxcdWRiNDBcXHVkYzdmfFxcdWQ4M2NcXHVkZmY0XFx1ZGI0MFxcdWRjNjdcXHVkYjQwXFx1ZGM2MlxcdWRiNDBcXHVkYzc3XFx1ZGI0MFxcdWRjNmNcXHVkYjQwXFx1ZGM3M1xcdWRiNDBcXHVkYzdmfFxcdWQ4M2NcXHVkZGU2XFx1ZDgzY1tcXHVkZGU4LVxcdWRkZWNcXHVkZGVlXFx1ZGRmMVxcdWRkZjJcXHVkZGY0XFx1ZGRmNi1cXHVkZGZhXFx1ZGRmY1xcdWRkZmRcXHVkZGZmXXxcXHVkODNjXFx1ZGRlN1xcdWQ4M2NbXFx1ZGRlNlxcdWRkZTdcXHVkZGU5LVxcdWRkZWZcXHVkZGYxLVxcdWRkZjRcXHVkZGY2LVxcdWRkZjlcXHVkZGZiXFx1ZGRmY1xcdWRkZmVcXHVkZGZmXXxcXHVkODNjXFx1ZGRlOFxcdWQ4M2NbXFx1ZGRlNlxcdWRkZThcXHVkZGU5XFx1ZGRlYi1cXHVkZGVlXFx1ZGRmMC1cXHVkZGY1XFx1ZGRmN1xcdWRkZmEtXFx1ZGRmZl18XFx1ZDgzY1xcdWRkZTlcXHVkODNjW1xcdWRkZWFcXHVkZGVjXFx1ZGRlZlxcdWRkZjBcXHVkZGYyXFx1ZGRmNFxcdWRkZmZdfFxcdWQ4M2NcXHVkZGVhXFx1ZDgzY1tcXHVkZGU2XFx1ZGRlOFxcdWRkZWFcXHVkZGVjXFx1ZGRlZFxcdWRkZjctXFx1ZGRmYV18XFx1ZDgzY1xcdWRkZWJcXHVkODNjW1xcdWRkZWUtXFx1ZGRmMFxcdWRkZjJcXHVkZGY0XFx1ZGRmN118XFx1ZDgzY1xcdWRkZWNcXHVkODNjW1xcdWRkZTZcXHVkZGU3XFx1ZGRlOS1cXHVkZGVlXFx1ZGRmMS1cXHVkZGYzXFx1ZGRmNS1cXHVkZGZhXFx1ZGRmY1xcdWRkZmVdfFxcdWQ4M2NcXHVkZGVkXFx1ZDgzY1tcXHVkZGYwXFx1ZGRmMlxcdWRkZjNcXHVkZGY3XFx1ZGRmOVxcdWRkZmFdfFxcdWQ4M2NcXHVkZGVlXFx1ZDgzY1tcXHVkZGU4LVxcdWRkZWFcXHVkZGYxLVxcdWRkZjRcXHVkZGY2LVxcdWRkZjldfFxcdWQ4M2NcXHVkZGVmXFx1ZDgzY1tcXHVkZGVhXFx1ZGRmMlxcdWRkZjRcXHVkZGY1XXxcXHVkODNjXFx1ZGRmMFxcdWQ4M2NbXFx1ZGRlYVxcdWRkZWMtXFx1ZGRlZVxcdWRkZjJcXHVkZGYzXFx1ZGRmNVxcdWRkZjdcXHVkZGZjXFx1ZGRmZVxcdWRkZmZdfFxcdWQ4M2NcXHVkZGYxXFx1ZDgzY1tcXHVkZGU2LVxcdWRkZThcXHVkZGVlXFx1ZGRmMFxcdWRkZjctXFx1ZGRmYlxcdWRkZmVdfFxcdWQ4M2NcXHVkZGYyXFx1ZDgzY1tcXHVkZGU2XFx1ZGRlOC1cXHVkZGVkXFx1ZGRmMC1cXHVkZGZmXXxcXHVkODNjXFx1ZGRmM1xcdWQ4M2NbXFx1ZGRlNlxcdWRkZThcXHVkZGVhLVxcdWRkZWNcXHVkZGVlXFx1ZGRmMVxcdWRkZjRcXHVkZGY1XFx1ZGRmN1xcdWRkZmFcXHVkZGZmXXxcXHVkODNjXFx1ZGRmNFxcdWQ4M2NcXHVkZGYyfFxcdWQ4M2NcXHVkZGY1XFx1ZDgzY1tcXHVkZGU2XFx1ZGRlYS1cXHVkZGVkXFx1ZGRmMC1cXHVkZGYzXFx1ZGRmNy1cXHVkZGY5XFx1ZGRmY1xcdWRkZmVdfFxcdWQ4M2NcXHVkZGY2XFx1ZDgzY1xcdWRkZTZ8XFx1ZDgzY1xcdWRkZjdcXHVkODNjW1xcdWRkZWFcXHVkZGY0XFx1ZGRmOFxcdWRkZmFcXHVkZGZjXXxcXHVkODNjXFx1ZGRmOFxcdWQ4M2NbXFx1ZGRlNi1cXHVkZGVhXFx1ZGRlYy1cXHVkZGY0XFx1ZGRmNy1cXHVkZGY5XFx1ZGRmYlxcdWRkZmQtXFx1ZGRmZl18XFx1ZDgzY1xcdWRkZjlcXHVkODNjW1xcdWRkZTZcXHVkZGU4XFx1ZGRlOVxcdWRkZWItXFx1ZGRlZFxcdWRkZWYtXFx1ZGRmNFxcdWRkZjdcXHVkZGY5XFx1ZGRmYlxcdWRkZmNcXHVkZGZmXXxcXHVkODNjXFx1ZGRmYVxcdWQ4M2NbXFx1ZGRlNlxcdWRkZWNcXHVkZGYyXFx1ZGRmM1xcdWRkZjhcXHVkZGZlXFx1ZGRmZl18XFx1ZDgzY1xcdWRkZmJcXHVkODNjW1xcdWRkZTZcXHVkZGU4XFx1ZGRlYVxcdWRkZWNcXHVkZGVlXFx1ZGRmM1xcdWRkZmFdfFxcdWQ4M2NcXHVkZGZjXFx1ZDgzY1tcXHVkZGViXFx1ZGRmOF18XFx1ZDgzY1xcdWRkZmRcXHVkODNjXFx1ZGRmMHxcXHVkODNjXFx1ZGRmZVxcdWQ4M2NbXFx1ZGRlYVxcdWRkZjldfFxcdWQ4M2NcXHVkZGZmXFx1ZDgzY1tcXHVkZGU2XFx1ZGRmMlxcdWRkZmNdfFxcdWQ4MDBcXHVkYzAwfFxcdWQ4M2NbXFx1ZGNjZlxcdWRkOGVcXHVkZDkxLVxcdWRkOWFcXHVkZGU2LVxcdWRkZmZcXHVkZTAxXFx1ZGUzMi1cXHVkZTM2XFx1ZGUzOC1cXHVkZTNhXFx1ZGU1MFxcdWRlNTFcXHVkZjAwLVxcdWRmMjBcXHVkZjJkLVxcdWRmMzVcXHVkZjM3LVxcdWRmN2NcXHVkZjdlLVxcdWRmODRcXHVkZjg2LVxcdWRmOTNcXHVkZmEwLVxcdWRmYzFcXHVkZmM1XFx1ZGZjNlxcdWRmYzhcXHVkZmM5XFx1ZGZjZi1cXHVkZmQzXFx1ZGZlMC1cXHVkZmYwXFx1ZGZmNFxcdWRmZjgtXFx1ZGZmZl18XFx1ZDgzZFtcXHVkYzAwLVxcdWRjM2VcXHVkYzQwXFx1ZGM0NFxcdWRjNDVcXHVkYzUxLVxcdWRjNjVcXHVkYzZhLVxcdWRjNmRcXHVkYzZmXFx1ZGM3OS1cXHVkYzdiXFx1ZGM3ZC1cXHVkYzgwXFx1ZGM4NFxcdWRjODgtXFx1ZGNhOVxcdWRjYWItXFx1ZGNmY1xcdWRjZmYtXFx1ZGQzZFxcdWRkNGItXFx1ZGQ0ZVxcdWRkNTAtXFx1ZGQ2N1xcdWRkYTRcXHVkZGZiLVxcdWRlNDRcXHVkZTQ4LVxcdWRlNGFcXHVkZTgwLVxcdWRlYTJcXHVkZWE0LVxcdWRlYjNcXHVkZWI3LVxcdWRlYmZcXHVkZWMxLVxcdWRlYzVcXHVkZWQwLVxcdWRlZDJcXHVkZWViXFx1ZGVlY1xcdWRlZjQtXFx1ZGVmOF18XFx1ZDgzZVtcXHVkZDEwLVxcdWRkMTdcXHVkZDFkXFx1ZGQyMC1cXHVkZDI1XFx1ZGQyNy1cXHVkZDJmXFx1ZGQzYVxcdWRkM2NcXHVkZDQwLVxcdWRkNDVcXHVkZDQ3LVxcdWRkNGNcXHVkZDUwLVxcdWRkNmJcXHVkZDgwLVxcdWRkOTdcXHVkZGMwXFx1ZGRkMFxcdWRkZGUtXFx1ZGRlNl18W1xcdTIzZTktXFx1MjNlY1xcdTIzZjBcXHUyM2YzXFx1MjY0MFxcdTI2NDJcXHUyNjk1XFx1MjZjZVxcdTI3MDVcXHUyNzI4XFx1Mjc0Y1xcdTI3NGVcXHUyNzUzLVxcdTI3NTVcXHUyNzk1LVxcdTI3OTdcXHUyN2IwXFx1MjdiZlxcdWU1MGFdfCg/OlxcdWQ4M2NbXFx1ZGMwNFxcdWRkNzBcXHVkZDcxXFx1ZGQ3ZVxcdWRkN2ZcXHVkZTAyXFx1ZGUxYVxcdWRlMmZcXHVkZTM3XFx1ZGYyMVxcdWRmMjQtXFx1ZGYyY1xcdWRmMzZcXHVkZjdkXFx1ZGY5NlxcdWRmOTdcXHVkZjk5LVxcdWRmOWJcXHVkZjllXFx1ZGY5ZlxcdWRmY2RcXHVkZmNlXFx1ZGZkNC1cXHVkZmRmXFx1ZGZmM1xcdWRmZjVcXHVkZmY3XXxcXHVkODNkW1xcdWRjM2ZcXHVkYzQxXFx1ZGNmZFxcdWRkNDlcXHVkZDRhXFx1ZGQ2ZlxcdWRkNzBcXHVkZDczXFx1ZGQ3Ni1cXHVkZDc5XFx1ZGQ4N1xcdWRkOGEtXFx1ZGQ4ZFxcdWRkYTVcXHVkZGE4XFx1ZGRiMVxcdWRkYjJcXHVkZGJjXFx1ZGRjMi1cXHVkZGM0XFx1ZGRkMS1cXHVkZGQzXFx1ZGRkYy1cXHVkZGRlXFx1ZGRlMVxcdWRkZTNcXHVkZGU4XFx1ZGRlZlxcdWRkZjNcXHVkZGZhXFx1ZGVjYlxcdWRlY2QtXFx1ZGVjZlxcdWRlZTAtXFx1ZGVlNVxcdWRlZTlcXHVkZWYwXFx1ZGVmM118W1xcdTAwYTlcXHUwMGFlXFx1MjAzY1xcdTIwNDlcXHUyMTIyXFx1MjEzOVxcdTIxOTQtXFx1MjE5OVxcdTIxYTlcXHUyMWFhXFx1MjMxYVxcdTIzMWJcXHUyMzI4XFx1MjNjZlxcdTIzZWQtXFx1MjNlZlxcdTIzZjFcXHUyM2YyXFx1MjNmOC1cXHUyM2ZhXFx1MjRjMlxcdTI1YWFcXHUyNWFiXFx1MjViNlxcdTI1YzBcXHUyNWZiLVxcdTI1ZmVcXHUyNjAwLVxcdTI2MDRcXHUyNjBlXFx1MjYxMVxcdTI2MTRcXHUyNjE1XFx1MjYxOFxcdTI2MjBcXHUyNjIyXFx1MjYyM1xcdTI2MjZcXHUyNjJhXFx1MjYyZVxcdTI2MmZcXHUyNjM4LVxcdTI2M2FcXHUyNjQ4LVxcdTI2NTNcXHUyNjYwXFx1MjY2M1xcdTI2NjVcXHUyNjY2XFx1MjY2OFxcdTI2N2JcXHUyNjdmXFx1MjY5Mi1cXHUyNjk0XFx1MjY5NlxcdTI2OTdcXHUyNjk5XFx1MjY5YlxcdTI2OWNcXHUyNmEwXFx1MjZhMVxcdTI2YWFcXHUyNmFiXFx1MjZiMFxcdTI2YjFcXHUyNmJkXFx1MjZiZVxcdTI2YzRcXHUyNmM1XFx1MjZjOFxcdTI2Y2ZcXHUyNmQxXFx1MjZkM1xcdTI2ZDRcXHUyNmU5XFx1MjZlYVxcdTI2ZjAtXFx1MjZmNVxcdTI2ZjhcXHUyNmZhXFx1MjZmZFxcdTI3MDJcXHUyNzA4XFx1MjcwOVxcdTI3MGZcXHUyNzEyXFx1MjcxNFxcdTI3MTZcXHUyNzFkXFx1MjcyMVxcdTI3MzNcXHUyNzM0XFx1Mjc0NFxcdTI3NDdcXHUyNzU3XFx1Mjc2M1xcdTI3NjRcXHUyN2ExXFx1MjkzNFxcdTI5MzVcXHUyYjA1LVxcdTJiMDdcXHUyYjFiXFx1MmIxY1xcdTJiNTBcXHUyYjU1XFx1MzAzMFxcdTMwM2RcXHUzMjk3XFx1MzI5OV0pKD86XFx1ZmUwZnwoPyFcXHVmZTBlKSkvZyxcblxuICAgIC8vIGF2b2lkIHJ1bnRpbWUgUmVnRXhwIGNyZWF0aW9uIGZvciBub3Qgc28gc21hcnQsXG4gICAgLy8gbm90IEpJVCBiYXNlZCwgYW5kIG9sZCBicm93c2VycyAvIGVuZ2luZXNcbiAgICBVRkUwRmcgPSAvXFx1RkUwRi9nLFxuXG4gICAgLy8gYXZvaWQgdXNpbmcgYSBzdHJpbmcgbGl0ZXJhbCBsaWtlICdcXHUyMDBEJyBoZXJlIGJlY2F1c2UgbWluaWZpZXJzIGV4cGFuZCBpdCBpbmxpbmVcbiAgICBVMjAwRCA9IFN0cmluZy5mcm9tQ2hhckNvZGUoMHgyMDBEKSxcblxuICAgIC8vIHVzZWQgdG8gZmluZCBIVE1MIHNwZWNpYWwgY2hhcnMgaW4gYXR0cmlidXRlc1xuICAgIHJlc2NhcGVyID0gL1smPD4nXCJdL2csXG5cbiAgICAvLyBub2RlcyB3aXRoIHR5cGUgMSB3aGljaCBzaG91bGQgKipub3QqKiBiZSBwYXJzZWRcbiAgICBzaG91bGRudEJlUGFyc2VkID0gL14oPzppZnJhbWV8bm9mcmFtZXN8bm9zY3JpcHR8c2NyaXB0fHNlbGVjdHxzdHlsZXx0ZXh0YXJlYSkkLyxcblxuICAgIC8vIGp1c3QgYSBwcml2YXRlIHNob3J0Y3V0XG4gICAgZnJvbUNoYXJDb2RlID0gU3RyaW5nLmZyb21DaGFyQ29kZTtcblxuICByZXR1cm4gdHdlbW9qaTtcblxuXG4gIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgLy8gIHByaXZhdGUgZnVuY3Rpb25zICAvL1xuICAvLyAgICAgZGVjbGFyYXRpb24gICAgIC8vXG4gIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuICAvKipcbiAgICogU2hvcnRjdXQgdG8gY3JlYXRlIHRleHQgbm9kZXNcbiAgICogQHBhcmFtICAgc3RyaW5nICB0ZXh0IHVzZWQgdG8gY3JlYXRlIERPTSB0ZXh0IG5vZGVcbiAgICogQHJldHVybiAgTm9kZSAgYSBET00gbm9kZSB3aXRoIHRoYXQgdGV4dFxuICAgKi9cbiAgZnVuY3Rpb24gY3JlYXRlVGV4dCh0ZXh0LCBjbGVhbikge1xuICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjbGVhbiA/IHRleHQucmVwbGFjZShVRkUwRmcsICcnKSA6IHRleHQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFV0aWxpdHkgZnVuY3Rpb24gdG8gZXNjYXBlIGh0bWwgYXR0cmlidXRlIHRleHRcbiAgICogQHBhcmFtICAgc3RyaW5nICB0ZXh0IHVzZSBpbiBIVE1MIGF0dHJpYnV0ZVxuICAgKiBAcmV0dXJuICBzdHJpbmcgIHRleHQgZW5jb2RlZCB0byB1c2UgaW4gSFRNTCBhdHRyaWJ1dGVcbiAgICovXG4gIGZ1bmN0aW9uIGVzY2FwZUhUTUwocykge1xuICAgIHJldHVybiBzLnJlcGxhY2UocmVzY2FwZXIsIHJlcGxhY2VyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWZhdWx0IGNhbGxiYWNrIHVzZWQgdG8gZ2VuZXJhdGUgZW1vamkgc3JjXG4gICAqICBiYXNlZCBvbiBUd2l0dGVyIENETlxuICAgKiBAcGFyYW0gICBzdHJpbmcgICAgdGhlIGVtb2ppIGNvZGVwb2ludCBzdHJpbmdcbiAgICogQHBhcmFtICAgc3RyaW5nICAgIHRoZSBkZWZhdWx0IHNpemUgdG8gdXNlLCBpLmUuIFwiMzZ4MzZcIlxuICAgKiBAcmV0dXJuICBzdHJpbmcgICAgdGhlIGltYWdlIHNvdXJjZSB0byB1c2VcbiAgICovXG4gIGZ1bmN0aW9uIGRlZmF1bHRJbWFnZVNyY0dlbmVyYXRvcihpY29uLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuICcnLmNvbmNhdChvcHRpb25zLmJhc2UsIG9wdGlvbnMuc2l6ZSwgJy8nLCBpY29uLCBvcHRpb25zLmV4dCk7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gYSBnZW5lcmljIERPTSBub2RlVHlwZSAxLCB3YWxrIHRocm91Z2ggYWxsIGNoaWxkcmVuXG4gICAqIGFuZCBzdG9yZSBldmVyeSBub2RlVHlwZSAzICgjdGV4dCkgZm91bmQgaW4gdGhlIHRyZWUuXG4gICAqIEBwYXJhbSAgIEVsZW1lbnQgYSBET00gRWxlbWVudCB3aXRoIHByb2JhYmx5IHNvbWUgdGV4dCBpbiBpdFxuICAgKiBAcGFyYW0gICBBcnJheSB0aGUgbGlzdCBvZiBwcmV2aW91c2x5IGRpc2NvdmVyZWQgdGV4dCBub2Rlc1xuICAgKiBAcmV0dXJuICBBcnJheSBzYW1lIGxpc3Qgd2l0aCBuZXcgZGlzY292ZXJlZCBub2RlcywgaWYgYW55XG4gICAqL1xuICBmdW5jdGlvbiBncmFiQWxsVGV4dE5vZGVzKG5vZGUsIGFsbFRleHQpIHtcbiAgICB2YXJcbiAgICAgIGNoaWxkTm9kZXMgPSBub2RlLmNoaWxkTm9kZXMsXG4gICAgICBsZW5ndGggPSBjaGlsZE5vZGVzLmxlbmd0aCxcbiAgICAgIHN1Ym5vZGUsXG4gICAgICBub2RlVHlwZTtcbiAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgIHN1Ym5vZGUgPSBjaGlsZE5vZGVzW2xlbmd0aF07XG4gICAgICBub2RlVHlwZSA9IHN1Ym5vZGUubm9kZVR5cGU7XG4gICAgICAvLyBwYXJzZSBlbW9qaSBvbmx5IGluIHRleHQgbm9kZXNcbiAgICAgIGlmIChub2RlVHlwZSA9PT0gMykge1xuICAgICAgICAvLyBjb2xsZWN0IHRoZW0gdG8gcHJvY2VzcyBlbW9qaSBsYXRlclxuICAgICAgICBhbGxUZXh0LnB1c2goc3Vibm9kZSk7XG4gICAgICB9XG4gICAgICAvLyBpZ25vcmUgYWxsIG5vZGVzIHRoYXQgYXJlIG5vdCB0eXBlIDEsIHRoYXQgYXJlIHN2Zywgb3IgdGhhdFxuICAgICAgLy8gc2hvdWxkIG5vdCBiZSBwYXJzZWQgYXMgc2NyaXB0LCBzdHlsZSwgYW5kIG90aGVyc1xuICAgICAgZWxzZSBpZiAobm9kZVR5cGUgPT09IDEgJiYgISgnb3duZXJTVkdFbGVtZW50JyBpbiBzdWJub2RlKSAmJlxuICAgICAgICAgICFzaG91bGRudEJlUGFyc2VkLnRlc3Qoc3Vibm9kZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgICBncmFiQWxsVGV4dE5vZGVzKHN1Ym5vZGUsIGFsbFRleHQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYWxsVGV4dDtcbiAgfVxuXG4gIC8qKlxuICAgKiBVc2VkIHRvIGJvdGggcmVtb3ZlIHRoZSBwb3NzaWJsZSB2YXJpYW50XG4gICAqICBhbmQgdG8gY29udmVydCB1dGYxNiBpbnRvIGNvZGUgcG9pbnRzLlxuICAgKiAgSWYgdGhlcmUgaXMgYSB6ZXJvLXdpZHRoLWpvaW5lciAoVSsyMDBEKSwgbGVhdmUgdGhlIHZhcmlhbnRzIGluLlxuICAgKiBAcGFyYW0gICBzdHJpbmcgICAgdGhlIHJhdyB0ZXh0IG9mIHRoZSBlbW9qaSBtYXRjaFxuICAgKiBAcmV0dXJuICBzdHJpbmcgICAgdGhlIGNvZGUgcG9pbnRcbiAgICovXG4gIGZ1bmN0aW9uIGdyYWJUaGVSaWdodEljb24ocmF3VGV4dCkge1xuICAgIC8vIGlmIHZhcmlhbnQgaXMgcHJlc2VudCBhcyBcXHVGRTBGXG4gICAgcmV0dXJuIHRvQ29kZVBvaW50KHJhd1RleHQuaW5kZXhPZihVMjAwRCkgPCAwID9cbiAgICAgIHJhd1RleHQucmVwbGFjZShVRkUwRmcsICcnKSA6XG4gICAgICByYXdUZXh0XG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBET00gdmVyc2lvbiBvZiB0aGUgc2FtZSBsb2dpYyAvIHBhcnNlcjpcbiAgICogIGVtb2ppZnkgYWxsIGZvdW5kIHN1Yi10ZXh0IG5vZGVzIHBsYWNpbmcgaW1hZ2VzIG5vZGUgaW5zdGVhZC5cbiAgICogQHBhcmFtICAgRWxlbWVudCAgIGdlbmVyaWMgRE9NIG5vZGUgd2l0aCBzb21lIHRleHQgaW4gc29tZSBjaGlsZCBub2RlXG4gICAqIEBwYXJhbSAgIE9iamVjdCAgICBvcHRpb25zICBjb250YWluaW5nIGluZm8gYWJvdXQgaG93IHRvIHBhcnNlXG4gICAgKlxuICAgICogICAgICAgICAgICAuY2FsbGJhY2sgICBGdW5jdGlvbiAgdGhlIGNhbGxiYWNrIHRvIGludm9rZSBwZXIgZWFjaCBmb3VuZCBlbW9qaS5cbiAgICAqICAgICAgICAgICAgLmJhc2UgICAgICAgc3RyaW5nICAgIHRoZSBiYXNlIHVybCwgYnkgZGVmYXVsdCB0d2Vtb2ppLmJhc2VcbiAgICAqICAgICAgICAgICAgLmV4dCAgICAgICAgc3RyaW5nICAgIHRoZSBpbWFnZSBleHRlbnNpb24sIGJ5IGRlZmF1bHQgdHdlbW9qaS5leHRcbiAgICAqICAgICAgICAgICAgLnNpemUgICAgICAgc3RyaW5nICAgIHRoZSBhc3NldHMgc2l6ZSwgYnkgZGVmYXVsdCB0d2Vtb2ppLnNpemVcbiAgICAqXG4gICAqIEByZXR1cm4gIEVsZW1lbnQgc2FtZSBnZW5lcmljIG5vZGUgd2l0aCBlbW9qaSBpbiBwbGFjZSwgaWYgYW55LlxuICAgKi9cbiAgZnVuY3Rpb24gcGFyc2VOb2RlKG5vZGUsIG9wdGlvbnMpIHtcbiAgICB2YXJcbiAgICAgIGFsbFRleHQgPSBncmFiQWxsVGV4dE5vZGVzKG5vZGUsIFtdKSxcbiAgICAgIGxlbmd0aCA9IGFsbFRleHQubGVuZ3RoLFxuICAgICAgYXR0cmliLFxuICAgICAgYXR0cm5hbWUsXG4gICAgICBtb2RpZmllZCxcbiAgICAgIGZyYWdtZW50LFxuICAgICAgc3Vibm9kZSxcbiAgICAgIHRleHQsXG4gICAgICBtYXRjaCxcbiAgICAgIGksXG4gICAgICBpbmRleCxcbiAgICAgIGltZyxcbiAgICAgIHJhd1RleHQsXG4gICAgICBpY29uSWQsXG4gICAgICBzcmM7XG4gICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICBtb2RpZmllZCA9IGZhbHNlO1xuICAgICAgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICBzdWJub2RlID0gYWxsVGV4dFtsZW5ndGhdO1xuICAgICAgdGV4dCA9IHN1Ym5vZGUubm9kZVZhbHVlO1xuICAgICAgaSA9IDA7XG4gICAgICB3aGlsZSAoKG1hdGNoID0gcmUuZXhlYyh0ZXh0KSkpIHtcbiAgICAgICAgaW5kZXggPSBtYXRjaC5pbmRleDtcbiAgICAgICAgaWYgKGluZGV4ICE9PSBpKSB7XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoXG4gICAgICAgICAgICBjcmVhdGVUZXh0KHRleHQuc2xpY2UoaSwgaW5kZXgpLCB0cnVlKVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgcmF3VGV4dCA9IG1hdGNoWzBdO1xuICAgICAgICBpY29uSWQgPSBncmFiVGhlUmlnaHRJY29uKHJhd1RleHQpO1xuICAgICAgICBpID0gaW5kZXggKyByYXdUZXh0Lmxlbmd0aDtcbiAgICAgICAgc3JjID0gb3B0aW9ucy5jYWxsYmFjayhpY29uSWQsIG9wdGlvbnMpO1xuICAgICAgICBpZiAoc3JjKSB7XG4gICAgICAgICAgaW1nID0gbmV3IEltYWdlKCk7XG4gICAgICAgICAgaW1nLm9uZXJyb3IgPSBvcHRpb25zLm9uZXJyb3I7XG4gICAgICAgICAgaW1nLnNldEF0dHJpYnV0ZSgnZHJhZ2dhYmxlJywgJ2ZhbHNlJyk7XG4gICAgICAgICAgYXR0cmliID0gb3B0aW9ucy5hdHRyaWJ1dGVzKHJhd1RleHQsIGljb25JZCk7XG4gICAgICAgICAgZm9yIChhdHRybmFtZSBpbiBhdHRyaWIpIHtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgYXR0cmliLmhhc093blByb3BlcnR5KGF0dHJuYW1lKSAmJlxuICAgICAgICAgICAgICAvLyBkb24ndCBhbGxvdyBhbnkgaGFuZGxlcnMgdG8gYmUgc2V0ICsgZG9uJ3QgYWxsb3cgb3ZlcnJpZGVzXG4gICAgICAgICAgICAgIGF0dHJuYW1lLmluZGV4T2YoJ29uJykgIT09IDAgJiZcbiAgICAgICAgICAgICAgIWltZy5oYXNBdHRyaWJ1dGUoYXR0cm5hbWUpXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgaW1nLnNldEF0dHJpYnV0ZShhdHRybmFtZSwgYXR0cmliW2F0dHJuYW1lXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGltZy5jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZTtcbiAgICAgICAgICBpbWcuYWx0ID0gcmF3VGV4dDtcbiAgICAgICAgICBpbWcuc3JjID0gc3JjO1xuICAgICAgICAgIG1vZGlmaWVkID0gdHJ1ZTtcbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChpbWcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaW1nKSBmcmFnbWVudC5hcHBlbmRDaGlsZChjcmVhdGVUZXh0KHJhd1RleHQsIGZhbHNlKSk7XG4gICAgICAgIGltZyA9IG51bGw7XG4gICAgICB9XG4gICAgICAvLyBpcyB0aGVyZSBhY3R1YWxseSBhbnl0aGluZyB0byByZXBsYWNlIGluIGhlcmUgP1xuICAgICAgaWYgKG1vZGlmaWVkKSB7XG4gICAgICAgIC8vIGFueSB0ZXh0IGxlZnQgdG8gYmUgYWRkZWQgP1xuICAgICAgICBpZiAoaSA8IHRleHQubGVuZ3RoKSB7XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoXG4gICAgICAgICAgICBjcmVhdGVUZXh0KHRleHQuc2xpY2UoaSksIHRydWUpXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICAvLyByZXBsYWNlIHRoZSB0ZXh0IG5vZGUgb25seSwgbGVhdmUgaW50YWN0XG4gICAgICAgIC8vIGFueXRoaW5nIGVsc2Ugc3Vycm91bmRpbmcgc3VjaCB0ZXh0XG4gICAgICAgIHN1Ym5vZGUucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoZnJhZ21lbnQsIHN1Ym5vZGUpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdHJpbmcvSFRNTCB2ZXJzaW9uIG9mIHRoZSBzYW1lIGxvZ2ljIC8gcGFyc2VyOlxuICAgKiAgZW1vamlmeSBhIGdlbmVyaWMgdGV4dCBwbGFjaW5nIGltYWdlcyB0YWdzIGluc3RlYWQgb2Ygc3Vycm9nYXRlcyBwYWlyLlxuICAgKiBAcGFyYW0gICBzdHJpbmcgICAgZ2VuZXJpYyBzdHJpbmcgd2l0aCBwb3NzaWJseSBzb21lIGVtb2ppIGluIGl0XG4gICAqIEBwYXJhbSAgIE9iamVjdCAgICBvcHRpb25zICBjb250YWluaW5nIGluZm8gYWJvdXQgaG93IHRvIHBhcnNlXG4gICAqXG4gICAqICAgICAgICAgICAgLmNhbGxiYWNrICAgRnVuY3Rpb24gIHRoZSBjYWxsYmFjayB0byBpbnZva2UgcGVyIGVhY2ggZm91bmQgZW1vamkuXG4gICAqICAgICAgICAgICAgLmJhc2UgICAgICAgc3RyaW5nICAgIHRoZSBiYXNlIHVybCwgYnkgZGVmYXVsdCB0d2Vtb2ppLmJhc2VcbiAgICogICAgICAgICAgICAuZXh0ICAgICAgICBzdHJpbmcgICAgdGhlIGltYWdlIGV4dGVuc2lvbiwgYnkgZGVmYXVsdCB0d2Vtb2ppLmV4dFxuICAgKiAgICAgICAgICAgIC5zaXplICAgICAgIHN0cmluZyAgICB0aGUgYXNzZXRzIHNpemUsIGJ5IGRlZmF1bHQgdHdlbW9qaS5zaXplXG4gICAqXG4gICAqIEByZXR1cm4gIHRoZSBzdHJpbmcgd2l0aCA8aW1nIHRhZ3M+IHJlcGxhY2luZyBhbGwgZm91bmQgYW5kIHBhcnNlZCBlbW9qaVxuICAgKi9cbiAgZnVuY3Rpb24gcGFyc2VTdHJpbmcoc3RyLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHJlcGxhY2Uoc3RyLCBmdW5jdGlvbiAocmF3VGV4dCkge1xuICAgICAgdmFyXG4gICAgICAgIHJldCA9IHJhd1RleHQsXG4gICAgICAgIGljb25JZCA9IGdyYWJUaGVSaWdodEljb24ocmF3VGV4dCksXG4gICAgICAgIHNyYyA9IG9wdGlvbnMuY2FsbGJhY2soaWNvbklkLCBvcHRpb25zKSxcbiAgICAgICAgYXR0cmliLFxuICAgICAgICBhdHRybmFtZTtcbiAgICAgIGlmIChzcmMpIHtcbiAgICAgICAgLy8gcmVjeWNsZSB0aGUgbWF0Y2ggc3RyaW5nIHJlcGxhY2luZyB0aGUgZW1vamlcbiAgICAgICAgLy8gd2l0aCBpdHMgaW1hZ2UgY291bnRlciBwYXJ0XG4gICAgICAgIHJldCA9ICc8aW1nICcuY29uY2F0KFxuICAgICAgICAgICdjbGFzcz1cIicsIG9wdGlvbnMuY2xhc3NOYW1lLCAnXCIgJyxcbiAgICAgICAgICAnZHJhZ2dhYmxlPVwiZmFsc2VcIiAnLFxuICAgICAgICAgIC8vIG5lZWRzIHRvIHByZXNlcnZlIHVzZXIgb3JpZ2luYWwgaW50ZW50XG4gICAgICAgICAgLy8gd2hlbiB2YXJpYW50cyBzaG91bGQgYmUgY29waWVkIGFuZCBwYXN0ZWQgdG9vXG4gICAgICAgICAgJ2FsdD1cIicsXG4gICAgICAgICAgcmF3VGV4dCxcbiAgICAgICAgICAnXCInLFxuICAgICAgICAgICcgc3JjPVwiJyxcbiAgICAgICAgICBzcmMsXG4gICAgICAgICAgJ1wiJ1xuICAgICAgICApO1xuICAgICAgICBhdHRyaWIgPSBvcHRpb25zLmF0dHJpYnV0ZXMocmF3VGV4dCwgaWNvbklkKTtcbiAgICAgICAgZm9yIChhdHRybmFtZSBpbiBhdHRyaWIpIHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBhdHRyaWIuaGFzT3duUHJvcGVydHkoYXR0cm5hbWUpICYmXG4gICAgICAgICAgICAvLyBkb24ndCBhbGxvdyBhbnkgaGFuZGxlcnMgdG8gYmUgc2V0ICsgZG9uJ3QgYWxsb3cgb3ZlcnJpZGVzXG4gICAgICAgICAgICBhdHRybmFtZS5pbmRleE9mKCdvbicpICE9PSAwICYmXG4gICAgICAgICAgICByZXQuaW5kZXhPZignICcgKyBhdHRybmFtZSArICc9JykgPT09IC0xXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICByZXQgPSByZXQuY29uY2F0KCcgJywgYXR0cm5hbWUsICc9XCInLCBlc2NhcGVIVE1MKGF0dHJpYlthdHRybmFtZV0pLCAnXCInKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0ID0gcmV0LmNvbmNhdCgnLz4nKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXQ7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRnVuY3Rpb24gdXNlZCB0byBhY3R1YWxseSByZXBsYWNlIEhUTUwgc3BlY2lhbCBjaGFyc1xuICAgKiBAcGFyYW0gICBzdHJpbmcgIEhUTUwgc3BlY2lhbCBjaGFyXG4gICAqIEByZXR1cm4gIHN0cmluZyAgZW5jb2RlZCBIVE1MIHNwZWNpYWwgY2hhclxuICAgKi9cbiAgZnVuY3Rpb24gcmVwbGFjZXIobSkge1xuICAgIHJldHVybiBlc2NhcGVyW21dO1xuICB9XG5cbiAgLyoqXG4gICAqIERlZmF1bHQgb3B0aW9ucy5hdHRyaWJ1dGUgY2FsbGJhY2tcbiAgICogQHJldHVybiAgbnVsbFxuICAgKi9cbiAgZnVuY3Rpb24gcmV0dXJuTnVsbCgpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHaXZlbiBhIGdlbmVyaWMgdmFsdWUsIGNyZWF0ZXMgaXRzIHNxdWFyZWQgY291bnRlcnBhcnQgaWYgaXQncyBhIG51bWJlci5cbiAgICogIEFzIGV4YW1wbGUsIG51bWJlciAzNiB3aWxsIHJldHVybiAnMzZ4MzYnLlxuICAgKiBAcGFyYW0gICBhbnkgICAgIGEgZ2VuZXJpYyB2YWx1ZS5cbiAgICogQHJldHVybiAgYW55ICAgICBhIHN0cmluZyByZXByZXNlbnRpbmcgYXNzZXQgc2l6ZSwgaS5lLiBcIjM2eDM2XCJcbiAgICogICAgICAgICAgICAgICAgICBvbmx5IGluIGNhc2UgdGhlIHZhbHVlIHdhcyBhIG51bWJlci5cbiAgICogICAgICAgICAgICAgICAgICBSZXR1cm5zIGluaXRpYWwgdmFsdWUgb3RoZXJ3aXNlLlxuICAgKi9cbiAgZnVuY3Rpb24gdG9TaXplU3F1YXJlZEFzc2V0KHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgP1xuICAgICAgdmFsdWUgKyAneCcgKyB2YWx1ZSA6XG4gICAgICB2YWx1ZTtcbiAgfVxuXG5cbiAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAvLyAgZXhwb3J0ZWQgZnVuY3Rpb25zIC8vXG4gIC8vICAgICBkZWNsYXJhdGlvbiAgICAgLy9cbiAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4gIGZ1bmN0aW9uIGZyb21Db2RlUG9pbnQoY29kZXBvaW50KSB7XG4gICAgdmFyIGNvZGUgPSB0eXBlb2YgY29kZXBvaW50ID09PSAnc3RyaW5nJyA/XG4gICAgICAgICAgcGFyc2VJbnQoY29kZXBvaW50LCAxNikgOiBjb2RlcG9pbnQ7XG4gICAgaWYgKGNvZGUgPCAweDEwMDAwKSB7XG4gICAgICByZXR1cm4gZnJvbUNoYXJDb2RlKGNvZGUpO1xuICAgIH1cbiAgICBjb2RlIC09IDB4MTAwMDA7XG4gICAgcmV0dXJuIGZyb21DaGFyQ29kZShcbiAgICAgIDB4RDgwMCArIChjb2RlID4+IDEwKSxcbiAgICAgIDB4REMwMCArIChjb2RlICYgMHgzRkYpXG4gICAgKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlKHdoYXQsIGhvdykge1xuICAgIGlmICghaG93IHx8IHR5cGVvZiBob3cgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGhvdyA9IHtjYWxsYmFjazogaG93fTtcbiAgICB9XG4gICAgLy8gaWYgZmlyc3QgYXJndW1lbnQgaXMgc3RyaW5nLCBpbmplY3QgaHRtbCA8aW1nPiB0YWdzXG4gICAgLy8gb3RoZXJ3aXNlIHVzZSB0aGUgRE9NIHRyZWUgYW5kIHBhcnNlIHRleHQgbm9kZXMgb25seVxuICAgIHJldHVybiAodHlwZW9mIHdoYXQgPT09ICdzdHJpbmcnID8gcGFyc2VTdHJpbmcgOiBwYXJzZU5vZGUpKHdoYXQsIHtcbiAgICAgIGNhbGxiYWNrOiAgIGhvdy5jYWxsYmFjayB8fCBkZWZhdWx0SW1hZ2VTcmNHZW5lcmF0b3IsXG4gICAgICBhdHRyaWJ1dGVzOiB0eXBlb2YgaG93LmF0dHJpYnV0ZXMgPT09ICdmdW5jdGlvbicgPyBob3cuYXR0cmlidXRlcyA6IHJldHVybk51bGwsXG4gICAgICBiYXNlOiAgICAgICB0eXBlb2YgaG93LmJhc2UgPT09ICdzdHJpbmcnID8gaG93LmJhc2UgOiB0d2Vtb2ppLmJhc2UsXG4gICAgICBleHQ6ICAgICAgICBob3cuZXh0IHx8IHR3ZW1vamkuZXh0LFxuICAgICAgc2l6ZTogICAgICAgaG93LmZvbGRlciB8fCB0b1NpemVTcXVhcmVkQXNzZXQoaG93LnNpemUgfHwgdHdlbW9qaS5zaXplKSxcbiAgICAgIGNsYXNzTmFtZTogIGhvdy5jbGFzc05hbWUgfHwgdHdlbW9qaS5jbGFzc05hbWUsXG4gICAgICBvbmVycm9yOiAgICBob3cub25lcnJvciB8fCB0d2Vtb2ppLm9uZXJyb3JcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlcGxhY2UodGV4dCwgY2FsbGJhY2spIHtcbiAgICByZXR1cm4gU3RyaW5nKHRleHQpLnJlcGxhY2UocmUsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRlc3QodGV4dCkge1xuICAgIC8vIElFNiBuZWVkcyBhIHJlc2V0IGJlZm9yZSB0b29cbiAgICByZS5sYXN0SW5kZXggPSAwO1xuICAgIHZhciByZXN1bHQgPSByZS50ZXN0KHRleHQpO1xuICAgIHJlLmxhc3RJbmRleCA9IDA7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvQ29kZVBvaW50KHVuaWNvZGVTdXJyb2dhdGVzLCBzZXApIHtcbiAgICB2YXJcbiAgICAgIHIgPSBbXSxcbiAgICAgIGMgPSAwLFxuICAgICAgcCA9IDAsXG4gICAgICBpID0gMDtcbiAgICB3aGlsZSAoaSA8IHVuaWNvZGVTdXJyb2dhdGVzLmxlbmd0aCkge1xuICAgICAgYyA9IHVuaWNvZGVTdXJyb2dhdGVzLmNoYXJDb2RlQXQoaSsrKTtcbiAgICAgIGlmIChwKSB7XG4gICAgICAgIHIucHVzaCgoMHgxMDAwMCArICgocCAtIDB4RDgwMCkgPDwgMTApICsgKGMgLSAweERDMDApKS50b1N0cmluZygxNikpO1xuICAgICAgICBwID0gMDtcbiAgICAgIH0gZWxzZSBpZiAoMHhEODAwIDw9IGMgJiYgYyA8PSAweERCRkYpIHtcbiAgICAgICAgcCA9IGM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByLnB1c2goYy50b1N0cmluZygxNikpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gci5qb2luKHNlcCB8fCAnLScpO1xuICB9XG5cbn0oKSk7XG5pZiAoIWxvY2F0aW9uLnByb3RvY29sKSB7XG4gIHR3ZW1vamkuYmFzZSA9IHR3ZW1vamkuYmFzZS5yZXBsYWNlKC9eaHR0cDovLCBcIlwiKTtcbn1cbm1vZHVsZS5leHBvcnRzID0gdHdlbW9qaTsiXX0=
