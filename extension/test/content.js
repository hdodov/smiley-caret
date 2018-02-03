(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports={":D":"😀","':D":"😅","xD":"😆",";)":"😉","^^":"😊",":p":"😋","8)":"😎",":*":"😘",":3":"😗",":)":"🙂",":?":"🤔",":|":"😐","-_-":"😑",":x":"😶",":X":"😶","|-(":"🙄",":O":"😮",":o":"😯","D:":"😫","|-)":"😴",":P":"😛",";P":"😜",":/":"😕","(:":"🙃","8O":"😲",":(":"🙁",";(":"😢",":@":"🤬",">:)":"😈","<3":"❤️"};
},{}],2:[function(require,module,exports){
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
},{"./modules/State.js":4,"./modules/element-watcher.js":6,"./modules/focus-watcher.js":7,"./modules/matcher.js":8,"./modules/replace.js":9,"./modules/shortcodes.js":10,"./modules/state.js":4,"./modules/string-buffer.js":11,"./modules/ui.js":13,"./modules/utils.js":14,"twemoji":32}],3:[function(require,module,exports){
module.exports = {
    codes: {
        left:   37,
        up:     38,
        right:  39,
        down:   40,

        backspace:  8,
        tab:        9,
        enter:      13,
        escape:     27,
        space:      32
    },

    isArrowKey: function (code) {
        return code >= this.codes.left && code <= this.codes.down;
    }
};
},{}],4:[function(require,module,exports){
var EventEmitter = require('event-emitter');

var _behavior = {
    active: true,
    shortcodes: true,
    coloncodes: true,
    copy: false
};

var State = {
    getBehavior: function (key) {
        return _behavior[key];
    },

    setBehavior: function (data, silent) {
        for (var k in data) {
            if (k in _behavior && data[k] !== _behavior[k]) {
                _behavior[k] = data[k];

                if (!silent) {
                    this.emit("behavior_change", k, _behavior[k]);
                }
            }
        }
    }
};

if (window.location.hostname.indexOf('facebook') !== -1) {
    State.setBehavior({
        copy: true,
        shortcodes: false
    }, true);
}

chrome.runtime.onMessage.addListener(function (request, sender, respond) {
    if (request.id == "update_behavior") {
        State.setBehavior(request.data);
    }
});

EventEmitter(State);
module.exports = State;
},{"event-emitter":31}],5:[function(require,module,exports){
var EventEmitter = require('event-emitter');
var twemoji = require('twemoji');
var Utils = require('./utils.js');
var State = require('./State.js');

function Dropdown(parent) {
    this.items = {};
    this.selectedItem = null;
    this.parent = parent || document.body;

    this.dropdown = document.createElement("div");
    this.dropdown.classList.add("smiley-caret-dropdown");

    this.container = document.createElement("div");
    this.container.classList.add("smiley-caret-container");
    this.dropdown.appendChild(this.container);

    if (State.getBehavior('copy')) {
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
            this.emit('choose', this.selectedItem.smileyCaret.emoji);
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
        var offset = Utils.getElementCaretOffset(elem);

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

EventEmitter(Dropdown.prototype);
module.exports = Dropdown;
},{"./State.js":4,"./utils.js":14,"event-emitter":31,"twemoji":32}],6:[function(require,module,exports){
var EventEmitter = require('event-emitter');
var MONITORED_EVENTS = [
    'keydown',
    'keypress',
    'keyup',
    'blur',
    'click'
];

function Element(domElement) {
    this.domElement = domElement;
    this.boundEvents = [];
} Element.prototype = {
    addEvent: function (key, callback) {
        this.domElement.addEventListener(key, callback);
        this.boundEvents.push([key, callback]);
    },

    clearEvents: function () {
        for (var i = this.boundEvents.length - 1; i >= 0; i--) {
            var event = this.boundEvents[i];

            this.domElement.removeEventListener(event[0], event[1]);
            this.boundEvents.splice(i, 1);
        }
    },

    destroy: function () {
        if (this.destroyed) return;

        this.clearEvents();
        this.domElement = null;
        this.boundEvents = null;
        this.destroyed = true;
    }
};

var ElementWatcher = (function () {
    var _currentElem = null;
    var domEmitter = EventEmitter();

    function _initializeElement(element) {
        for (var i = 0; i < MONITORED_EVENTS.length; i++) {
            element.addEvent(MONITORED_EVENTS[i], function (event) {
                domEmitter.emit(event.type, event);
            });
        }
    }

    exports.changeElement = function (domElement) {
        var lastDomElement = null
        ,   newDomElement = null;

        if (_currentElem) {
            lastDomElement = _currentElem.domElement;
            _currentElem.destroy();
            _currentElem = null;
        }

        if (domElement) {
            _currentElem = new Element(domElement);
            _initializeElement(_currentElem);
            newDomElement = _currentElem.domElement;
        }
        
        exports.emit('rebind', newDomElement, lastDomElement);
    };

    exports.getElement = function () {
        return (_currentElem && _currentElem.domElement);
    };

    exports.element = domEmitter;

    return exports;
})();

EventEmitter(ElementWatcher);
module.exports = ElementWatcher;
},{"event-emitter":31}],7:[function(require,module,exports){
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
},{}],8:[function(require,module,exports){
var Shortcodes = require('./shortcodes.js');
var State = require('./State.js');

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
        if (State.getBehavior('coloncodes')) {
            if (buffer.length === 1 && buffer[0] === ":") {
                _flags.colonStart = true;
            }

            if (_flags.colonStart) {
                _flags.coloncode = isPartOfColoncode(buffer);
            }
        }

        if (State.getBehavior('shortcodes')) {
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
},{"./State.js":4,"./shortcodes.js":10}],9:[function(require,module,exports){
var State = require('./State.js');
var Utils = require('./utils.js');
var ElementWatcher = require('./element-watcher.js');
var StringBuffer = require('./string-buffer.js');

module.exports = function (emoji) {
    var element = ElementWatcher.getElement();
    var search = StringBuffer.getBuffer();
    var copyBehavior = State.getBehavior('copy');

    if (copyBehavior) {
        Utils.clipWithSelection(emoji);
    }

    console.log("repl", element, emoji);

    if (element) {
        if (element.hasAttribute("contenteditable")) {
            Utils.matchSelection(search, function (node, start, end) {
                var selection = window.getSelection();

                var range = selection.getRangeAt(selection.rangeCount - 1);
                range.setStart(node, start);
                range.setEnd(node, end);

                if (!copyBehavior) {
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
};
},{"./State.js":4,"./element-watcher.js":6,"./string-buffer.js":11,"./utils.js":14}],10:[function(require,module,exports){
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
},{"../../data/shortcodes.js":1}],11:[function(require,module,exports){
var State = require('./State.js');
var Utils = require('./utils.js');
var Keys = require('./Keys.js');

StringBuffer = (function () {
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
            if (event.which !== Keys.codes.space) {
                return buffer + event.key;
            } else {
                return buffer;
            }
        });
    };

    exports.handleKeyDown = function (event) {
        if (
            event.which === Keys.codes.enter ||
            event.which === Keys.codes.space
        ) {
            exports.onBreak(_buffer);
            clear();
            return;
        }

        //                              selection is not a single character (ctrl+A)
        if (Keys.isArrowKey(event.which) || !(window.getSelection().isCollapsed)) {
            clear();
            return;
        }

        if (event.which === Keys.codes.backspace) {
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

State.on('behavior_change', function (key, value) {
    if (key == 'active' && value == false) {
        StringBuffer.reset();
    }
});

module.exports = StringBuffer;
},{"./Keys.js":3,"./State.js":4,"./utils.js":14}],12:[function(require,module,exports){
// Source: https://github.com/component/textarea-caret-position/blob/master/index.js
// Change (1) removed the dot (not needed in Chrome) for better accuracy

/* jshint browser: true */

(function () {

// We'll copy the properties below into the mirror div.
// Note that some browsers, such as Firefox, do not concatenate properties
// into their shorthand (e.g. padding-top, padding-bottom etc. -> padding),
// so we have to list every single property explicitly.
var properties = [
  'direction',  // RTL support
  'boxSizing',
  'width',  // on Chrome and IE, exclude the scrollbar, so the mirror div wraps exactly as the textarea does
  'height',
  'overflowX',
  'overflowY',  // copy the scrollbar for IE

  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',

  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',

  // https://developer.mozilla.org/en-US/docs/Web/CSS/font
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',

  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',  // might not make a difference, but better be safe

  'letterSpacing',
  'wordSpacing',

  'tabSize',
  'MozTabSize'

];

var isBrowser = (typeof window !== 'undefined');
var isFirefox = (isBrowser && window.mozInnerScreenX != null);

function getCaretCoordinates(element, position, options) {
  if (!isBrowser) {
    throw new Error('textarea-caret-position#getCaretCoordinates should only be called in a browser');
  }

  var debug = options && options.debug || false;
  if (debug) {
    var el = document.querySelector('#input-textarea-caret-position-mirror-div');
    if (el) el.parentNode.removeChild(el);
  }

  // The mirror div will replicate the textarea's style
  var div = document.createElement('div');
  div.id = 'input-textarea-caret-position-mirror-div';
  document.body.appendChild(div);

  var style = div.style;
  var computed = window.getComputedStyle ? window.getComputedStyle(element) : element.currentStyle;  // currentStyle for IE < 9
  var isInput = element.nodeName === 'INPUT';

  // Default textarea styles
  style.whiteSpace = 'pre-wrap';
  if (!isInput)
    style.wordWrap = 'break-word';  // only for textarea-s

  // Position off-screen
  style.position = 'absolute';  // required to return coordinates properly
  if (!debug)
    style.visibility = 'hidden';  // not 'display: none' because we want rendering

  // Transfer the element's properties to the div
  properties.forEach(function (prop) {
    if (isInput && prop === 'lineHeight') {
      // Special case for <input>s because text is rendered centered and line height may be != height
      style.lineHeight = computed.height;
    } else {
      style[prop] = computed[prop];
    }
  });

  if (isFirefox) {
    // Firefox lies about the overflow property for textareas: https://bugzilla.mozilla.org/show_bug.cgi?id=984275
    if (element.scrollHeight > parseInt(computed.height))
      style.overflowY = 'scroll';
  } else {
    style.overflow = 'hidden';  // for Chrome to not render a scrollbar; IE keeps overflowY = 'scroll'
  }

  div.textContent = element.value.substring(0, position);
  // The second special handling for input type="text" vs textarea:
  // spaces need to be replaced with non-breaking spaces - http://stackoverflow.com/a/13402035/1269037
  if (isInput)
    div.textContent = div.textContent.replace(/\s/g, '\u00a0');

  var span = document.createElement('span');
  // Wrapping must be replicated *exactly*, including when a long word gets
  // onto the next line, with whitespace at the end of the line before (#7).
  // The  *only* reliable way to do that is to copy the *entire* rest of the
  // textarea's content into the <span> created at the caret position.
  // For inputs, just '.' would be enough, but no need to bother.
  span.textContent = element.value.substring(position) || '';  // CHANGE (1)
  div.appendChild(span);

  var coordinates = {
    top: span.offsetTop + parseInt(computed['borderTopWidth']),
    left: span.offsetLeft + parseInt(computed['borderLeftWidth']),
    height: parseInt(computed['lineHeight'])
  };

  if (debug) {
    span.style.backgroundColor = '#aaa';
  } else {
    document.body.removeChild(div);
  }

  return coordinates;
}

if (typeof module != 'undefined' && typeof module.exports != 'undefined') {
  module.exports = getCaretCoordinates;
} else if(isBrowser) {
  window.getCaretCoordinates = getCaretCoordinates;
}

}());
},{}],13:[function(require,module,exports){
var Dropdown = require('./dropdown.js');
var replace = require('./replace.js');

module.exports = (function () {
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
            _dropdown.on('choose', function (emoji) {
                replace(emoji, true);
            });
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
},{"./dropdown.js":5,"./replace.js":9}],14:[function(require,module,exports){
var fnTextareaCaretPosition = require('./textarea-caret-position.js');

module.exports = {
    formReplace: function (elem, search, replace) {
        if (
            !elem ||
            typeof elem.value !== "string" ||
            typeof elem.selectionEnd !== "number"
        ) {
            return false;
        }

        var value = elem.value,
            endIndex = elem.selectionEnd,
            startIndex = endIndex - search.length;

        if (
            startIndex >= 0 &&
            endIndex > startIndex &&
            value.substring(startIndex, endIndex) === search
        ) {
            var before = value.substring(0, startIndex);
            var after = value.substring(endIndex);

            elem.value = before + replace + after;
            elem.selectionEnd = before.length + replace.length;
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

    isElementEditable: function (elem) {
        return (elem && (
            elem.hasAttribute("contenteditable") ||
            elem.tagName === "TEXTAREA" ||
            elem.tagName === "INPUT"
        ));
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

    getElementCaretOffset: function (elem) {
        var offset = null;

        if (elem.hasAttribute('contenteditable')) {
            var selection = window.getSelection()
            ,   range = selection.getRangeAt(selection.rangeCount - 1)
            ,   clonedRange = range.cloneRange();

            var node = document.createElement('span');
            clonedRange.insertNode(node);

            offset = this.getElementBodyOffset(node);

            var parent = node.parentNode;
            parent.removeChild(node);
            parent.normalize();
        } else {
            offset = this.getElementBodyOffset(elem);

            var caretOffset = fnTextareaCaretPosition(elem, elem.selectionEnd);
            offset.top += caretOffset.top - elem.scrollTop;
            offset.left += caretOffset.left;
        }

        return offset;
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
},{"./textarea-caret-position.js":12}],15:[function(require,module,exports){
'use strict';

var assign        = require('es5-ext/object/assign')
  , normalizeOpts = require('es5-ext/object/normalize-options')
  , isCallable    = require('es5-ext/object/is-callable')
  , contains      = require('es5-ext/string/#/contains')

  , d;

d = module.exports = function (dscr, value/*, options*/) {
	var c, e, w, options, desc;
	if ((arguments.length < 2) || (typeof dscr !== 'string')) {
		options = value;
		value = dscr;
		dscr = null;
	} else {
		options = arguments[2];
	}
	if (dscr == null) {
		c = w = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
		w = contains.call(dscr, 'w');
	}

	desc = { value: value, configurable: c, enumerable: e, writable: w };
	return !options ? desc : assign(normalizeOpts(options), desc);
};

d.gs = function (dscr, get, set/*, options*/) {
	var c, e, options, desc;
	if (typeof dscr !== 'string') {
		options = set;
		set = get;
		get = dscr;
		dscr = null;
	} else {
		options = arguments[3];
	}
	if (get == null) {
		get = undefined;
	} else if (!isCallable(get)) {
		options = get;
		get = set = undefined;
	} else if (set == null) {
		set = undefined;
	} else if (!isCallable(set)) {
		options = set;
		set = undefined;
	}
	if (dscr == null) {
		c = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
	}

	desc = { get: get, set: set, configurable: c, enumerable: e };
	return !options ? desc : assign(normalizeOpts(options), desc);
};

},{"es5-ext/object/assign":17,"es5-ext/object/is-callable":20,"es5-ext/object/normalize-options":25,"es5-ext/string/#/contains":28}],16:[function(require,module,exports){
"use strict";

// eslint-disable-next-line no-empty-function
module.exports = function () {};

},{}],17:[function(require,module,exports){
"use strict";

module.exports = require("./is-implemented")()
	? Object.assign
	: require("./shim");

},{"./is-implemented":18,"./shim":19}],18:[function(require,module,exports){
"use strict";

module.exports = function () {
	var assign = Object.assign, obj;
	if (typeof assign !== "function") return false;
	obj = { foo: "raz" };
	assign(obj, { bar: "dwa" }, { trzy: "trzy" });
	return (obj.foo + obj.bar + obj.trzy) === "razdwatrzy";
};

},{}],19:[function(require,module,exports){
"use strict";

var keys  = require("../keys")
  , value = require("../valid-value")
  , max   = Math.max;

module.exports = function (dest, src /*, …srcn*/) {
	var error, i, length = max(arguments.length, 2), assign;
	dest = Object(value(dest));
	assign = function (key) {
		try {
			dest[key] = src[key];
		} catch (e) {
			if (!error) error = e;
		}
	};
	for (i = 1; i < length; ++i) {
		src = arguments[i];
		keys(src).forEach(assign);
	}
	if (error !== undefined) throw error;
	return dest;
};

},{"../keys":22,"../valid-value":27}],20:[function(require,module,exports){
// Deprecated

"use strict";

module.exports = function (obj) {
 return typeof obj === "function";
};

},{}],21:[function(require,module,exports){
"use strict";

var _undefined = require("../function/noop")(); // Support ES3 engines

module.exports = function (val) {
 return (val !== _undefined) && (val !== null);
};

},{"../function/noop":16}],22:[function(require,module,exports){
"use strict";

module.exports = require("./is-implemented")()
	? Object.keys
	: require("./shim");

},{"./is-implemented":23,"./shim":24}],23:[function(require,module,exports){
"use strict";

module.exports = function () {
	try {
		Object.keys("primitive");
		return true;
	} catch (e) {
 return false;
}
};

},{}],24:[function(require,module,exports){
"use strict";

var isValue = require("../is-value");

var keys = Object.keys;

module.exports = function (object) {
	return keys(isValue(object) ? Object(object) : object);
};

},{"../is-value":21}],25:[function(require,module,exports){
"use strict";

var isValue = require("./is-value");

var forEach = Array.prototype.forEach, create = Object.create;

var process = function (src, obj) {
	var key;
	for (key in src) obj[key] = src[key];
};

// eslint-disable-next-line no-unused-vars
module.exports = function (opts1 /*, …options*/) {
	var result = create(null);
	forEach.call(arguments, function (options) {
		if (!isValue(options)) return;
		process(Object(options), result);
	});
	return result;
};

},{"./is-value":21}],26:[function(require,module,exports){
"use strict";

module.exports = function (fn) {
	if (typeof fn !== "function") throw new TypeError(fn + " is not a function");
	return fn;
};

},{}],27:[function(require,module,exports){
"use strict";

var isValue = require("./is-value");

module.exports = function (value) {
	if (!isValue(value)) throw new TypeError("Cannot use null or undefined");
	return value;
};

},{"./is-value":21}],28:[function(require,module,exports){
"use strict";

module.exports = require("./is-implemented")()
	? String.prototype.contains
	: require("./shim");

},{"./is-implemented":29,"./shim":30}],29:[function(require,module,exports){
"use strict";

var str = "razdwatrzy";

module.exports = function () {
	if (typeof str.contains !== "function") return false;
	return (str.contains("dwa") === true) && (str.contains("foo") === false);
};

},{}],30:[function(require,module,exports){
"use strict";

var indexOf = String.prototype.indexOf;

module.exports = function (searchString/*, position*/) {
	return indexOf.call(this, searchString, arguments[1]) > -1;
};

},{}],31:[function(require,module,exports){
'use strict';

var d        = require('d')
  , callable = require('es5-ext/object/valid-callable')

  , apply = Function.prototype.apply, call = Function.prototype.call
  , create = Object.create, defineProperty = Object.defineProperty
  , defineProperties = Object.defineProperties
  , hasOwnProperty = Object.prototype.hasOwnProperty
  , descriptor = { configurable: true, enumerable: false, writable: true }

  , on, once, off, emit, methods, descriptors, base;

on = function (type, listener) {
	var data;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) {
		data = descriptor.value = create(null);
		defineProperty(this, '__ee__', descriptor);
		descriptor.value = null;
	} else {
		data = this.__ee__;
	}
	if (!data[type]) data[type] = listener;
	else if (typeof data[type] === 'object') data[type].push(listener);
	else data[type] = [data[type], listener];

	return this;
};

once = function (type, listener) {
	var once, self;

	callable(listener);
	self = this;
	on.call(this, type, once = function () {
		off.call(self, type, once);
		apply.call(listener, this, arguments);
	});

	once.__eeOnceListener__ = listener;
	return this;
};

off = function (type, listener) {
	var data, listeners, candidate, i;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) return this;
	data = this.__ee__;
	if (!data[type]) return this;
	listeners = data[type];

	if (typeof listeners === 'object') {
		for (i = 0; (candidate = listeners[i]); ++i) {
			if ((candidate === listener) ||
					(candidate.__eeOnceListener__ === listener)) {
				if (listeners.length === 2) data[type] = listeners[i ? 0 : 1];
				else listeners.splice(i, 1);
			}
		}
	} else {
		if ((listeners === listener) ||
				(listeners.__eeOnceListener__ === listener)) {
			delete data[type];
		}
	}

	return this;
};

emit = function (type) {
	var i, l, listener, listeners, args;

	if (!hasOwnProperty.call(this, '__ee__')) return;
	listeners = this.__ee__[type];
	if (!listeners) return;

	if (typeof listeners === 'object') {
		l = arguments.length;
		args = new Array(l - 1);
		for (i = 1; i < l; ++i) args[i - 1] = arguments[i];

		listeners = listeners.slice();
		for (i = 0; (listener = listeners[i]); ++i) {
			apply.call(listener, this, args);
		}
	} else {
		switch (arguments.length) {
		case 1:
			call.call(listeners, this);
			break;
		case 2:
			call.call(listeners, this, arguments[1]);
			break;
		case 3:
			call.call(listeners, this, arguments[1], arguments[2]);
			break;
		default:
			l = arguments.length;
			args = new Array(l - 1);
			for (i = 1; i < l; ++i) {
				args[i - 1] = arguments[i];
			}
			apply.call(listeners, this, args);
		}
	}
};

methods = {
	on: on,
	once: once,
	off: off,
	emit: emit
};

descriptors = {
	on: d(on),
	once: d(once),
	off: d(off),
	emit: d(emit)
};

base = defineProperties({}, descriptors);

module.exports = exports = function (o) {
	return (o == null) ? create(base) : defineProperties(Object(o), descriptors);
};
exports.methods = methods;

},{"d":15,"es5-ext/object/valid-callable":26}],32:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkYXRhL3Nob3J0Y29kZXMuanMiLCJqcy9jb250ZW50LmpzIiwianMvbW9kdWxlcy9LZXlzLmpzIiwianMvbW9kdWxlcy9TdGF0ZS5qcyIsImpzL21vZHVsZXMvZHJvcGRvd24uanMiLCJqcy9tb2R1bGVzL2VsZW1lbnQtd2F0Y2hlci5qcyIsImpzL21vZHVsZXMvZm9jdXMtd2F0Y2hlci5qcyIsImpzL21vZHVsZXMvbWF0Y2hlci5qcyIsImpzL21vZHVsZXMvcmVwbGFjZS5qcyIsImpzL21vZHVsZXMvc2hvcnRjb2Rlcy5qcyIsImpzL21vZHVsZXMvc3RyaW5nLWJ1ZmZlci5qcyIsImpzL21vZHVsZXMvdGV4dGFyZWEtY2FyZXQtcG9zaXRpb24uanMiLCJqcy9tb2R1bGVzL3VpLmpzIiwianMvbW9kdWxlcy91dGlscy5qcyIsIi4uL25vZGVfbW9kdWxlcy9kL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzNS1leHQvZnVuY3Rpb24vbm9vcC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9hc3NpZ24vaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvYXNzaWduL2lzLWltcGxlbWVudGVkLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2Fzc2lnbi9zaGltLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2lzLWNhbGxhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2lzLXZhbHVlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2tleXMvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3Qva2V5cy9pcy1pbXBsZW1lbnRlZC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9rZXlzL3NoaW0uanMiLCIuLi9ub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3Qvbm9ybWFsaXplLW9wdGlvbnMuanMiLCIuLi9ub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvdmFsaWQtY2FsbGFibGUuanMiLCIuLi9ub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvdmFsaWQtdmFsdWUuanMiLCIuLi9ub2RlX21vZHVsZXMvZXM1LWV4dC9zdHJpbmcvIy9jb250YWlucy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lczUtZXh0L3N0cmluZy8jL2NvbnRhaW5zL2lzLWltcGxlbWVudGVkLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzNS1leHQvc3RyaW5nLyMvY29udGFpbnMvc2hpbS5qcyIsIi4uL25vZGVfbW9kdWxlcy9ldmVudC1lbWl0dGVyL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3R3ZW1vamkvMi90d2Vtb2ppLm5wbS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6TEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNwSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIm1vZHVsZS5leHBvcnRzPXtcIjpEXCI6XCLwn5iAXCIsXCInOkRcIjpcIvCfmIVcIixcInhEXCI6XCLwn5iGXCIsXCI7KVwiOlwi8J+YiVwiLFwiXl5cIjpcIvCfmIpcIixcIjpwXCI6XCLwn5iLXCIsXCI4KVwiOlwi8J+YjlwiLFwiOipcIjpcIvCfmJhcIixcIjozXCI6XCLwn5iXXCIsXCI6KVwiOlwi8J+ZglwiLFwiOj9cIjpcIvCfpJRcIixcIjp8XCI6XCLwn5iQXCIsXCItXy1cIjpcIvCfmJFcIixcIjp4XCI6XCLwn5i2XCIsXCI6WFwiOlwi8J+YtlwiLFwifC0oXCI6XCLwn5mEXCIsXCI6T1wiOlwi8J+YrlwiLFwiOm9cIjpcIvCfmK9cIixcIkQ6XCI6XCLwn5irXCIsXCJ8LSlcIjpcIvCfmLRcIixcIjpQXCI6XCLwn5ibXCIsXCI7UFwiOlwi8J+YnFwiLFwiOi9cIjpcIvCfmJVcIixcIig6XCI6XCLwn5mDXCIsXCI4T1wiOlwi8J+YslwiLFwiOihcIjpcIvCfmYFcIixcIjsoXCI6XCLwn5iiXCIsXCI6QFwiOlwi8J+krFwiLFwiPjopXCI6XCLwn5iIXCIsXCI8M1wiOlwi4p2k77iPXCJ9OyIsIi8vIC0tLVxyXG4vLyBhZGQga2V5d29yZHMgd2hlbiBzZWFyY2hpbmdcclxuLy8gZml4IGRyb3Bkb3duIHBvc2l0aW9uaW5nIHdoZW4gaXQncyB0b28gY2xvc2UgdG8gdGhlIGVkZ2UgKGZhY2Vib29rIGNoYXQgc2VhcmNoKVxyXG5cclxucmVxdWlyZSgndHdlbW9qaScpO1xyXG5yZXF1aXJlKCcuL21vZHVsZXMvc2hvcnRjb2Rlcy5qcycpO1xyXG5cclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi9tb2R1bGVzL3V0aWxzLmpzJyk7XHJcbnZhciBVSSA9IHJlcXVpcmUoJy4vbW9kdWxlcy91aS5qcycpO1xyXG52YXIgRm9jdXNXYXRjaGVyID0gcmVxdWlyZSgnLi9tb2R1bGVzL2ZvY3VzLXdhdGNoZXIuanMnKTtcclxudmFyIEVsZW1lbnRXYXRjaGVyID0gcmVxdWlyZSgnLi9tb2R1bGVzL2VsZW1lbnQtd2F0Y2hlci5qcycpO1xyXG52YXIgU3RyaW5nQnVmZmVyID0gcmVxdWlyZSgnLi9tb2R1bGVzL3N0cmluZy1idWZmZXIuanMnKTtcclxudmFyIE1hdGNoZXIgPSByZXF1aXJlKCcuL21vZHVsZXMvbWF0Y2hlci5qcycpO1xyXG52YXIgcmVwbGFjZSA9IHJlcXVpcmUoJy4vbW9kdWxlcy9yZXBsYWNlLmpzJyk7XHJcbnZhciBTdGF0ZSA9IHJlcXVpcmUoJy4vbW9kdWxlcy9TdGF0ZS5qcycpO1xyXG5cclxuRm9jdXNXYXRjaGVyLm9uQ2hhbmdlID0gZnVuY3Rpb24gKGVsZW1lbnQpIHtcclxuICAgIGVsZW1lbnQgPSBVdGlscy5pc0VsZW1lbnRFbW9qaUVsaWdpYmxlKGVsZW1lbnQpXHJcbiAgICAgICAgPyBlbGVtZW50XHJcbiAgICAgICAgOiBudWxsO1xyXG5cclxuICAgIEVsZW1lbnRXYXRjaGVyLmNoYW5nZUVsZW1lbnQoZWxlbWVudCk7XHJcbn07XHJcblxyXG5FbGVtZW50V2F0Y2hlci5vbigncmViaW5kJywgU3RyaW5nQnVmZmVyLnJlc2V0KTtcclxuRWxlbWVudFdhdGNoZXIuZWxlbWVudC5vbigna2V5ZG93bicsIFN0cmluZ0J1ZmZlci5oYW5kbGVLZXlEb3duKTtcclxuXHJcbkVsZW1lbnRXYXRjaGVyLmVsZW1lbnQub24oJ2tleXByZXNzJywgZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICBTdHJpbmdCdWZmZXIuaGFuZGxlS2V5UHJlc3MoZXZlbnQpO1xyXG5cclxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIC8vIFRpbWVvdXQgbmVlZGVkIGJlY2F1c2Ugb3RoZXJ3aXNlIHRoZSBwb3NpdGlvbmluZyBoYXBwZW5zIGJlZm9yZVxyXG4gICAgICAgIC8vIHRoZSBjaGFyYWN0ZXIgaXMgaW5zZXJ0ZWQuXHJcbiAgICAgICAgVUkuZHJvcGRvd25BY3Rpb24oZnVuY3Rpb24gKGRyb3Bkb3duKSB7XHJcbiAgICAgICAgICAgIGRyb3Bkb3duLmFsaWduVG8oZXZlbnQudGFyZ2V0KTtcclxuICAgICAgICB9KTtcclxuICAgIH0sIDApO1xyXG59KTtcclxuXHJcbkVsZW1lbnRXYXRjaGVyLmVsZW1lbnQub24oJ2tleXVwJywgZnVuY3Rpb24gKGV2ZW50LCBlbGVtZW50KSB7XHJcbiAgICBVSS5kcm9wZG93bkFjdGlvbihmdW5jdGlvbiAoZHJvcGRvd24pIHtcclxuICAgICAgICBkcm9wZG93bi5hbGlnblRvKGV2ZW50LnRhcmdldCk7XHJcbiAgICB9KTtcclxufSk7XHJcblxyXG5FbGVtZW50V2F0Y2hlci5lbGVtZW50Lm9uKCdibHVyJywgU3RyaW5nQnVmZmVyLnJlc2V0KTtcclxuRWxlbWVudFdhdGNoZXIuZWxlbWVudC5vbignY2xpY2snLCBTdHJpbmdCdWZmZXIucmVzZXQpO1xyXG5cclxuU3RyaW5nQnVmZmVyLm9uQ2xlYXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBVSS5yZW1vdmVEcm9wZG93bigpO1xyXG4gICAgTWF0Y2hlci5yZXNldCgpO1xyXG59O1xyXG5cclxuU3RyaW5nQnVmZmVyLm9uQnJlYWsgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBNYXRjaGVyLmNoZWNrTWF0Y2goKTtcclxufTtcclxuXHJcblN0cmluZ0J1ZmZlci5vbkNoYW5nZSA9IGZ1bmN0aW9uIChidWZmZXIpIHtcclxuICAgIGNvbnNvbGUubG9nKGJ1ZmZlcik7XHJcbiAgICBpZiAoU3RhdGUuZ2V0QmVoYXZpb3IoJ2FjdGl2ZScpKSB7XHJcbiAgICAgICAgTWF0Y2hlci51cGRhdGUoYnVmZmVyKTtcclxuICAgIH1cclxufTtcclxuXHJcbk1hdGNoZXIub25GbGFnc1VwZGF0ZSA9IGZ1bmN0aW9uIChmbGFncykge1xyXG4gICAgaWYgKGZsYWdzLmNvbG9uU3RhcnQgJiYgIVVJLmRyb3Bkb3duRXhpc3RzKCkpIHtcclxuICAgICAgICBVSS5jcmVhdGVEcm9wZG93bigpO1xyXG4gICAgfVxyXG59O1xyXG5cclxuTWF0Y2hlci5vbkNvbG9uY29kZVVwZGF0ZSA9IGZ1bmN0aW9uIChjb2Rlcykge1xyXG4gICAgaWYgKGNvZGVzICYmIGNvZGVzLmxlbmd0aCkge1xyXG4gICAgICAgIFVJLmRyb3Bkb3duQWN0aW9uKGZ1bmN0aW9uIChkcm9wZG93bikge1xyXG4gICAgICAgICAgICBkcm9wZG93bi5zaG93KCk7XHJcbiAgICAgICAgICAgIGRyb3Bkb3duLnVwZGF0ZUxpc3QoY29kZXMpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBVSS5kcm9wZG93bkFjdGlvbihmdW5jdGlvbiAoZHJvcGRvd24pIHtcclxuICAgICAgICAgICAgZHJvcGRvd24uaGlkZSgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG59O1xyXG5cclxuTWF0Y2hlci5vbk1hdGNoID0gcmVwbGFjZTtcclxuXHJcbk1hdGNoZXIub25GbGFnc0Rvd24gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICBTdHJpbmdCdWZmZXIucmVzZXQoKTtcclxufTtcclxuXHJcbnJlcXVpcmUoJy4vbW9kdWxlcy9zdGF0ZS5qcycpOyIsIm1vZHVsZS5leHBvcnRzID0ge1xyXG4gICAgY29kZXM6IHtcclxuICAgICAgICBsZWZ0OiAgIDM3LFxyXG4gICAgICAgIHVwOiAgICAgMzgsXHJcbiAgICAgICAgcmlnaHQ6ICAzOSxcclxuICAgICAgICBkb3duOiAgIDQwLFxyXG5cclxuICAgICAgICBiYWNrc3BhY2U6ICA4LFxyXG4gICAgICAgIHRhYjogICAgICAgIDksXHJcbiAgICAgICAgZW50ZXI6ICAgICAgMTMsXHJcbiAgICAgICAgZXNjYXBlOiAgICAgMjcsXHJcbiAgICAgICAgc3BhY2U6ICAgICAgMzJcclxuICAgIH0sXHJcblxyXG4gICAgaXNBcnJvd0tleTogZnVuY3Rpb24gKGNvZGUpIHtcclxuICAgICAgICByZXR1cm4gY29kZSA+PSB0aGlzLmNvZGVzLmxlZnQgJiYgY29kZSA8PSB0aGlzLmNvZGVzLmRvd247XHJcbiAgICB9XHJcbn07IiwidmFyIEV2ZW50RW1pdHRlciA9IHJlcXVpcmUoJ2V2ZW50LWVtaXR0ZXInKTtcclxuXHJcbnZhciBfYmVoYXZpb3IgPSB7XHJcbiAgICBhY3RpdmU6IHRydWUsXHJcbiAgICBzaG9ydGNvZGVzOiB0cnVlLFxyXG4gICAgY29sb25jb2RlczogdHJ1ZSxcclxuICAgIGNvcHk6IGZhbHNlXHJcbn07XHJcblxyXG52YXIgU3RhdGUgPSB7XHJcbiAgICBnZXRCZWhhdmlvcjogZnVuY3Rpb24gKGtleSkge1xyXG4gICAgICAgIHJldHVybiBfYmVoYXZpb3Jba2V5XTtcclxuICAgIH0sXHJcblxyXG4gICAgc2V0QmVoYXZpb3I6IGZ1bmN0aW9uIChkYXRhLCBzaWxlbnQpIHtcclxuICAgICAgICBmb3IgKHZhciBrIGluIGRhdGEpIHtcclxuICAgICAgICAgICAgaWYgKGsgaW4gX2JlaGF2aW9yICYmIGRhdGFba10gIT09IF9iZWhhdmlvcltrXSkge1xyXG4gICAgICAgICAgICAgICAgX2JlaGF2aW9yW2tdID0gZGF0YVtrXTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoIXNpbGVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZW1pdChcImJlaGF2aW9yX2NoYW5nZVwiLCBrLCBfYmVoYXZpb3Jba10pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59O1xyXG5cclxuaWYgKHdpbmRvdy5sb2NhdGlvbi5ob3N0bmFtZS5pbmRleE9mKCdmYWNlYm9vaycpICE9PSAtMSkge1xyXG4gICAgU3RhdGUuc2V0QmVoYXZpb3Ioe1xyXG4gICAgICAgIGNvcHk6IHRydWUsXHJcbiAgICAgICAgc2hvcnRjb2RlczogZmFsc2VcclxuICAgIH0sIHRydWUpO1xyXG59XHJcblxyXG5jaHJvbWUucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoZnVuY3Rpb24gKHJlcXVlc3QsIHNlbmRlciwgcmVzcG9uZCkge1xyXG4gICAgaWYgKHJlcXVlc3QuaWQgPT0gXCJ1cGRhdGVfYmVoYXZpb3JcIikge1xyXG4gICAgICAgIFN0YXRlLnNldEJlaGF2aW9yKHJlcXVlc3QuZGF0YSk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuRXZlbnRFbWl0dGVyKFN0YXRlKTtcclxubW9kdWxlLmV4cG9ydHMgPSBTdGF0ZTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnQtZW1pdHRlcicpO1xyXG52YXIgdHdlbW9qaSA9IHJlcXVpcmUoJ3R3ZW1vamknKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi91dGlscy5qcycpO1xyXG52YXIgU3RhdGUgPSByZXF1aXJlKCcuL1N0YXRlLmpzJyk7XHJcblxyXG5mdW5jdGlvbiBEcm9wZG93bihwYXJlbnQpIHtcclxuICAgIHRoaXMuaXRlbXMgPSB7fTtcclxuICAgIHRoaXMuc2VsZWN0ZWRJdGVtID0gbnVsbDtcclxuICAgIHRoaXMucGFyZW50ID0gcGFyZW50IHx8IGRvY3VtZW50LmJvZHk7XHJcblxyXG4gICAgdGhpcy5kcm9wZG93biA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICB0aGlzLmRyb3Bkb3duLmNsYXNzTGlzdC5hZGQoXCJzbWlsZXktY2FyZXQtZHJvcGRvd25cIik7XHJcblxyXG4gICAgdGhpcy5jb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgdGhpcy5jb250YWluZXIuY2xhc3NMaXN0LmFkZChcInNtaWxleS1jYXJldC1jb250YWluZXJcIik7XHJcbiAgICB0aGlzLmRyb3Bkb3duLmFwcGVuZENoaWxkKHRoaXMuY29udGFpbmVyKTtcclxuXHJcbiAgICBpZiAoU3RhdGUuZ2V0QmVoYXZpb3IoJ2NvcHknKSkge1xyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoXCJiZWhhdmlvci1jb3B5XCIpO1xyXG4gICAgfVxyXG5cclxuICAgIHRoaXMucGFyZW50LmFwcGVuZENoaWxkKHRoaXMuZHJvcGRvd24pO1xyXG59IERyb3Bkb3duLnByb3RvdHlwZSA9IHtcclxuICAgIGNyZWF0ZUl0ZW06IGZ1bmN0aW9uIChuYW1lLCBlbW9qaSkge1xyXG4gICAgICAgIGlmICh0aGlzLml0ZW1zW25hbWVdKSByZXR1cm47XHJcblxyXG4gICAgICAgIHZhciBpdGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgICAgICB2YXIgZW1vamlFbGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XHJcbiAgICAgICAgdmFyIGVtb2ppRWxlbUNoYXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaVwiKTtcclxuICAgICAgICB2YXIgZW1vamlFbGVtSW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImltZ1wiKTtcclxuICAgICAgICB2YXIgbmFtZUVsZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwicFwiKTtcclxuXHJcbiAgICAgICAgZW1vamlFbGVtQ2hhci5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShlbW9qaSkpO1xyXG4gICAgICAgIGVtb2ppRWxlbS5hcHBlbmRDaGlsZChlbW9qaUVsZW1DaGFyKTtcclxuICAgICAgICBlbW9qaUVsZW0uYXBwZW5kQ2hpbGQoZW1vamlFbGVtSW1nKTtcclxuXHJcbiAgICAgICAgdmFyIGltYWdlTWFya3VwID0gdHdlbW9qaS5wYXJzZShlbW9qaSlcclxuICAgICAgICAsICAgaW1hZ2VTcmNNYXRjaCA9IC9zcmNcXD1cXFwiKC4qKVxcXCIvLmV4ZWMoaW1hZ2VNYXJrdXApXHJcbiAgICAgICAgLCAgIGltYWdlU3JjID0gKGltYWdlU3JjTWF0Y2ggJiYgaW1hZ2VTcmNNYXRjaFsxXSk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgaWYgKGltYWdlU3JjKSB7XHJcbiAgICAgICAgICAgIHZhciB0ZW1wSW1hZ2UgPSBuZXcgSW1hZ2UoKTtcclxuICAgICAgICAgICAgdGVtcEltYWdlLm9ubG9hZCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgICAgIGVtb2ppRWxlbS5jbGFzc0xpc3QuYWRkKFwiaXMtbG9hZGVkXCIpO1xyXG4gICAgICAgICAgICB9O1xyXG5cclxuICAgICAgICAgICAgdGVtcEltYWdlLnNyYyA9IGltYWdlU3JjO1xyXG4gICAgICAgICAgICBlbW9qaUVsZW1JbWcuc3JjID0gaW1hZ2VTcmM7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpdGVtLmFwcGVuZENoaWxkKGVtb2ppRWxlbSk7XHJcblxyXG4gICAgICAgIG5hbWVFbGVtLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKG5hbWUpKTtcclxuICAgICAgICBpdGVtLmFwcGVuZENoaWxkKG5hbWVFbGVtKTtcclxuXHJcbiAgICAgICAgaXRlbS5zbWlsZXlDYXJldCA9IHtcclxuICAgICAgICAgICAgZW1vamk6IGVtb2ppLFxyXG4gICAgICAgICAgICBuYW1lOiBuYW1lXHJcbiAgICAgICAgfTtcclxuXHJcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xyXG4gICAgICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZW50ZXJcIiwgZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICBzZWxmLnNlbGVjdEl0ZW0odGhpcyk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZG93blwiLCBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgICAgICAgICAgc2VsZi5zZWxlY3RJdGVtKHRoaXMpO1xyXG4gICAgICAgICAgICBzZWxmLmNob29zZUl0ZW0oKTtcclxuICAgICAgICAgICAgZXZlbnQucHJldmVudERlZmF1bHQoKTsgLy8gdG8gcHJldmVudCBsb3NzIG9mIGZvY3VzXHJcbiAgICAgICAgICAgIGV2ZW50LnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICB0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZChpdGVtKTtcclxuICAgICAgICB0aGlzLml0ZW1zW25hbWVdID0gaXRlbTtcclxuICAgIH0sXHJcblxyXG4gICAgY2hvb3NlSXRlbTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZEl0ZW0gJiZcclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZEl0ZW0uc21pbGV5Q2FyZXQgJiZcclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZEl0ZW0uc21pbGV5Q2FyZXQuZW1vamlcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgdGhpcy5lbWl0KCdjaG9vc2UnLCB0aGlzLnNlbGVjdGVkSXRlbS5zbWlsZXlDYXJldC5lbW9qaSk7XHJcbiAgICAgICAgfSAgXHJcbiAgICB9LFxyXG5cclxuICAgIHNlbGVjdEl0ZW06IGZ1bmN0aW9uIChpdGVtKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuc2VsZWN0ZWRJdGVtKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWRJdGVtLmNsYXNzTGlzdC5yZW1vdmUoXCJzZWxlY3RlZFwiKTtcclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZEl0ZW0gPSBudWxsO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKGl0ZW0pIHtcclxuICAgICAgICAgICAgaXRlbS5jbGFzc0xpc3QuYWRkKFwic2VsZWN0ZWRcIik7XHJcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0ZWRJdGVtID0gaXRlbTtcclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIHVwZGF0ZUxpc3Q6IGZ1bmN0aW9uIChsaXN0KSB7XHJcbiAgICAgICAgaWYgKGxpc3QubGVuZ3RoID09PSAwKSByZXR1cm47XHJcblxyXG4gICAgICAgIGZvciAodmFyIGsgaW4gdGhpcy5pdGVtcykge1xyXG4gICAgICAgICAgICB0aGlzLml0ZW1zW2tdLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQodGhpcy5pdGVtc1trXSk7XHJcblxyXG4gICAgICAgICAgICB2YXIgZXhpc3RzID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKGxpc3RbaV1bMF0gPT09IGspIHtcclxuICAgICAgICAgICAgICAgICAgICBleGlzdHMgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBpZiAoIWV4aXN0cykge1xyXG4gICAgICAgICAgICAgICAgZGVsZXRlIHRoaXMuaXRlbXNba107XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICB2YXIgbmFtZSA9IGxpc3RbaV1bMF1cclxuICAgICAgICAgICAgLCAgIGVtb2ppID0gbGlzdFtpXVsxXTtcclxuXHJcbiAgICAgICAgICAgIGlmICh0aGlzLml0ZW1zW25hbWVdKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmNvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLml0ZW1zW25hbWVdKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY3JlYXRlSXRlbShuYW1lLCBlbW9qaSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLmNvbnRhaW5lci5maXJzdEVsZW1lbnRDaGlsZCkge1xyXG4gICAgICAgICAgICB0aGlzLnNlbGVjdEl0ZW0odGhpcy5jb250YWluZXIuZmlyc3RFbGVtZW50Q2hpbGQpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgYWxpZ25UbzogZnVuY3Rpb24gKGVsZW0pIHtcclxuICAgICAgICB2YXIgb2Zmc2V0ID0gVXRpbHMuZ2V0RWxlbWVudENhcmV0T2Zmc2V0KGVsZW0pO1xyXG5cclxuICAgICAgICBpZiAob2Zmc2V0KSB7XHJcbiAgICAgICAgICAgIHRoaXMuZHJvcGRvd24uc3R5bGUubGVmdCA9IG9mZnNldC5sZWZ0ICsgXCJweFwiO1xyXG4gICAgICAgICAgICB0aGlzLmRyb3Bkb3duLnN0eWxlLnRvcCA9IG9mZnNldC50b3AgKyBcInB4XCI7XHJcblxyXG4gICAgICAgICAgICBpZiAob2Zmc2V0LmZpeGVkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRyb3Bkb3duLmNsYXNzTGlzdC5hZGQoXCJpcy1maXhlZFwiKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZHJvcGRvd24uY2xhc3NMaXN0LnJlbW92ZShcImlzLWZpeGVkXCIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBzaG93OiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5hY3RpdmUgPSB0cnVlO1xyXG4gICAgICAgIHRoaXMuZHJvcGRvd24uY2xhc3NMaXN0LmFkZChcImlzLXZpc2libGVcIik7XHJcbiAgICB9LFxyXG5cclxuICAgIGhpZGU6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xyXG4gICAgICAgIHRoaXMuZHJvcGRvd24uY2xhc3NMaXN0LnJlbW92ZShcImlzLXZpc2libGVcIik7XHJcbiAgICB9LFxyXG5cclxuICAgIHJlbW92ZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuaGlkZSgpO1xyXG5cclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHNlbGYuZGVzdHJveSgpO1xyXG4gICAgICAgIH0sIDUwMCk7XHJcbiAgICB9LFxyXG5cclxuICAgIGRlc3Ryb3k6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICBpZiAodGhpcy5kZXN0cm95ZWQpIHJldHVybjtcclxuICAgICAgICBcclxuICAgICAgICBpZiAodGhpcy5kcm9wZG93bi5wYXJlbnROb2RlKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZHJvcGRvd24ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLmRyb3Bkb3duKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRoaXMucGFyZW50ID0gbnVsbDtcclxuICAgICAgICB0aGlzLml0ZW1zID0gbnVsbDtcclxuICAgICAgICB0aGlzLnNlbGVjdGVkSXRlbSA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5kcm9wZG93biA9IG51bGw7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSBudWxsO1xyXG5cclxuICAgICAgICB0aGlzLmRlc3Ryb3llZCA9IHRydWU7XHJcbiAgICB9XHJcbn07XHJcblxyXG5FdmVudEVtaXR0ZXIoRHJvcGRvd24ucHJvdG90eXBlKTtcclxubW9kdWxlLmV4cG9ydHMgPSBEcm9wZG93bjsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnQtZW1pdHRlcicpO1xyXG52YXIgTU9OSVRPUkVEX0VWRU5UUyA9IFtcclxuICAgICdrZXlkb3duJyxcclxuICAgICdrZXlwcmVzcycsXHJcbiAgICAna2V5dXAnLFxyXG4gICAgJ2JsdXInLFxyXG4gICAgJ2NsaWNrJ1xyXG5dO1xyXG5cclxuZnVuY3Rpb24gRWxlbWVudChkb21FbGVtZW50KSB7XHJcbiAgICB0aGlzLmRvbUVsZW1lbnQgPSBkb21FbGVtZW50O1xyXG4gICAgdGhpcy5ib3VuZEV2ZW50cyA9IFtdO1xyXG59IEVsZW1lbnQucHJvdG90eXBlID0ge1xyXG4gICAgYWRkRXZlbnQ6IGZ1bmN0aW9uIChrZXksIGNhbGxiYWNrKSB7XHJcbiAgICAgICAgdGhpcy5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoa2V5LCBjYWxsYmFjayk7XHJcbiAgICAgICAgdGhpcy5ib3VuZEV2ZW50cy5wdXNoKFtrZXksIGNhbGxiYWNrXSk7XHJcbiAgICB9LFxyXG5cclxuICAgIGNsZWFyRXZlbnRzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IHRoaXMuYm91bmRFdmVudHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuICAgICAgICAgICAgdmFyIGV2ZW50ID0gdGhpcy5ib3VuZEV2ZW50c1tpXTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuZG9tRWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50WzBdLCBldmVudFsxXSk7XHJcbiAgICAgICAgICAgIHRoaXMuYm91bmRFdmVudHMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgZGVzdHJveTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmRlc3Ryb3llZCkgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLmNsZWFyRXZlbnRzKCk7XHJcbiAgICAgICAgdGhpcy5kb21FbGVtZW50ID0gbnVsbDtcclxuICAgICAgICB0aGlzLmJvdW5kRXZlbnRzID0gbnVsbDtcclxuICAgICAgICB0aGlzLmRlc3Ryb3llZCA9IHRydWU7XHJcbiAgICB9XHJcbn07XHJcblxyXG52YXIgRWxlbWVudFdhdGNoZXIgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIF9jdXJyZW50RWxlbSA9IG51bGw7XHJcbiAgICB2YXIgZG9tRW1pdHRlciA9IEV2ZW50RW1pdHRlcigpO1xyXG5cclxuICAgIGZ1bmN0aW9uIF9pbml0aWFsaXplRWxlbWVudChlbGVtZW50KSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBNT05JVE9SRURfRVZFTlRTLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGVsZW1lbnQuYWRkRXZlbnQoTU9OSVRPUkVEX0VWRU5UU1tpXSwgZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgICAgICAgICAgICBkb21FbWl0dGVyLmVtaXQoZXZlbnQudHlwZSwgZXZlbnQpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0cy5jaGFuZ2VFbGVtZW50ID0gZnVuY3Rpb24gKGRvbUVsZW1lbnQpIHtcclxuICAgICAgICB2YXIgbGFzdERvbUVsZW1lbnQgPSBudWxsXHJcbiAgICAgICAgLCAgIG5ld0RvbUVsZW1lbnQgPSBudWxsO1xyXG5cclxuICAgICAgICBpZiAoX2N1cnJlbnRFbGVtKSB7XHJcbiAgICAgICAgICAgIGxhc3REb21FbGVtZW50ID0gX2N1cnJlbnRFbGVtLmRvbUVsZW1lbnQ7XHJcbiAgICAgICAgICAgIF9jdXJyZW50RWxlbS5kZXN0cm95KCk7XHJcbiAgICAgICAgICAgIF9jdXJyZW50RWxlbSA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZG9tRWxlbWVudCkge1xyXG4gICAgICAgICAgICBfY3VycmVudEVsZW0gPSBuZXcgRWxlbWVudChkb21FbGVtZW50KTtcclxuICAgICAgICAgICAgX2luaXRpYWxpemVFbGVtZW50KF9jdXJyZW50RWxlbSk7XHJcbiAgICAgICAgICAgIG5ld0RvbUVsZW1lbnQgPSBfY3VycmVudEVsZW0uZG9tRWxlbWVudDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZXhwb3J0cy5lbWl0KCdyZWJpbmQnLCBuZXdEb21FbGVtZW50LCBsYXN0RG9tRWxlbWVudCk7XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuZ2V0RWxlbWVudCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gKF9jdXJyZW50RWxlbSAmJiBfY3VycmVudEVsZW0uZG9tRWxlbWVudCk7XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuZWxlbWVudCA9IGRvbUVtaXR0ZXI7XHJcblxyXG4gICAgcmV0dXJuIGV4cG9ydHM7XHJcbn0pKCk7XHJcblxyXG5FdmVudEVtaXR0ZXIoRWxlbWVudFdhdGNoZXIpO1xyXG5tb2R1bGUuZXhwb3J0cyA9IEVsZW1lbnRXYXRjaGVyOyIsIi8vIENoZWNrcyB0aGUgY3VycmVudGx5IGZvY3VzZWQgZWxlbWVudCBvdmVyIHNob3J0IGludGVydmFsIGFuZCBkaXNwYXRjaGVzXHJcbi8vIGNoYW5nZXMuIFRoZSBcImZvY3VzaW5cIiBldmVudCBjYW4ndCBkbyB0aGUgam9iIGJlY2F1c2UgaXQgY2FuIGJlIGNhbmNlbGxlZC5cclxuXHJcbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBfY29uZmlnID0ge1xyXG4gICAgICAgIGludGVydmFsOiAyNTBcclxuICAgIH07XHJcblxyXG4gICAgdmFyIGV4cG9ydHMgPSB7XHJcbiAgICAgICAgb25DaGFuZ2U6IGZ1bmN0aW9uICgpIHt9XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBfYWN0aXZlID0gbnVsbCxcclxuICAgICAgICBfZW1pdHRlZCA9IG51bGw7XHJcblxyXG4gICAgc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmIChkb2N1bWVudC5hY3RpdmVFbGVtZW50ICE9PSBfYWN0aXZlKSB7XHJcbiAgICAgICAgICAgIF9hY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xyXG4gICAgICAgICAgICBleHBvcnRzLm9uQ2hhbmdlKF9hY3RpdmUpO1xyXG4gICAgICAgIH1cclxuICAgIH0sIF9jb25maWcuaW50ZXJ2YWwpO1xyXG5cclxuICAgIHJldHVybiBleHBvcnRzO1xyXG59KSgpOyIsInZhciBTaG9ydGNvZGVzID0gcmVxdWlyZSgnLi9zaG9ydGNvZGVzLmpzJyk7XHJcbnZhciBTdGF0ZSA9IHJlcXVpcmUoJy4vU3RhdGUuanMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBleHBvcnRzID0ge1xyXG4gICAgICAgIG9uTWF0Y2g6IGZ1bmN0aW9uICgpIHt9LFxyXG4gICAgICAgIG9uQ29sb25jb2RlVXBkYXRlOiBmdW5jdGlvbiAoKSB7fSxcclxuICAgICAgICBvbkZsYWdzVXBkYXRlOiBmdW5jdGlvbiAoKSB7fSxcclxuICAgICAgICBvbkZsYWdzRG93bjogZnVuY3Rpb24gKCkge31cclxuICAgIH07XHJcblxyXG4gICAgdmFyIF9mbGFncyA9IHt9LFxyXG4gICAgICAgIF9jb2xvbmNvZGVzID0gW107XHJcblxyXG4gICAgZnVuY3Rpb24gcmVzZXRGbGFncygpIHtcclxuICAgICAgICBfZmxhZ3Muc2hvcnRjb2RlID0gZmFsc2U7XHJcbiAgICAgICAgX2ZsYWdzLmNvbG9uU3RhcnQgPSBmYWxzZTtcclxuICAgICAgICBfZmxhZ3MuY29sb25jb2RlID0gZmFsc2U7XHJcbiAgICAgICAgZXhwb3J0cy5vbkZsYWdzVXBkYXRlKF9mbGFncyk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gdXBkYXRlQ29sb25jb2RlcyhkYXRhKSB7XHJcbiAgICAgICAgX2NvbG9uY29kZXMgPSBkYXRhIHx8IFtdO1xyXG4gICAgICAgIGV4cG9ydHMub25Db2xvbmNvZGVVcGRhdGUoX2NvbG9uY29kZXMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNlYXJjaEZvckNvbG9uY29kZXMoYnVmZmVyKSB7XHJcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xyXG4gICAgICAgICAgICBpZDogXCJnZXRfY29sb25jb2Rlc1wiLFxyXG4gICAgICAgICAgICBzZWFyY2g6IGJ1ZmZlclxyXG4gICAgICAgIH0sIGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgICAgIHVwZGF0ZUNvbG9uY29kZXMoZGF0YSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZmxhZ3NEb3duKCkge1xyXG4gICAgICAgIHZhciBhbGxEb3duID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBfZmxhZ3Muc2hvcnRjb2RlICE9PSBmYWxzZSB8fFxyXG4gICAgICAgICAgICBfZmxhZ3MuY29sb25TdGFydCA9PT0gdHJ1ZSB8fCBcclxuICAgICAgICAgICAgX2ZsYWdzLmNvbG9uY29kZSAhPT0gZmFsc2VcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgYWxsRG93biA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGFsbERvd247XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNQYXJ0T2ZDb2xvbmNvZGUoYnVmZmVyKSB7XHJcbiAgICAgICAgdmFyIG1hdGNoID0gYnVmZmVyLm1hdGNoKC9eXFw6KFthLXowLTlcXC1dezMsfSlcXDo/JC8pO1xyXG5cclxuICAgICAgICBpZiAobWF0Y2ggIT09IG51bGwgJiYgbWF0Y2gubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBtYXRjaFsxXTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHVwZGF0ZUZsYWdzKGJ1ZmZlcikge1xyXG4gICAgICAgIGlmIChTdGF0ZS5nZXRCZWhhdmlvcignY29sb25jb2RlcycpKSB7XHJcbiAgICAgICAgICAgIGlmIChidWZmZXIubGVuZ3RoID09PSAxICYmIGJ1ZmZlclswXSA9PT0gXCI6XCIpIHtcclxuICAgICAgICAgICAgICAgIF9mbGFncy5jb2xvblN0YXJ0ID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKF9mbGFncy5jb2xvblN0YXJ0KSB7XHJcbiAgICAgICAgICAgICAgICBfZmxhZ3MuY29sb25jb2RlID0gaXNQYXJ0T2ZDb2xvbmNvZGUoYnVmZmVyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKFN0YXRlLmdldEJlaGF2aW9yKCdzaG9ydGNvZGVzJykpIHtcclxuICAgICAgICAgICAgX2ZsYWdzLnNob3J0Y29kZSA9IFNob3J0Y29kZXMuaXNQYXJ0KGJ1ZmZlcikgPyBidWZmZXIgOiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGV4cG9ydHMub25GbGFnc1VwZGF0ZShfZmxhZ3MpO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydHMucmVzZXQgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgcmVzZXRGbGFncygpO1xyXG4gICAgICAgIHVwZGF0ZUNvbG9uY29kZXMobnVsbCk7XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuY2hlY2tNYXRjaCA9IGZ1bmN0aW9uIChidWZmZXIpIHtcclxuICAgICAgICBpZiAoX2ZsYWdzLnNob3J0Y29kZSkge1xyXG4gICAgICAgICAgICB2YXIgc2hvcnRjb2RlID0gU2hvcnRjb2Rlcy5nZXQoX2ZsYWdzLnNob3J0Y29kZSk7XHJcblxyXG4gICAgICAgICAgICBpZiAoc2hvcnRjb2RlICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgICAgICBleHBvcnRzLm9uTWF0Y2goc2hvcnRjb2RlKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKF9mbGFncy5jb2xvbmNvZGUpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBfY29sb25jb2Rlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgaWYgKF9jb2xvbmNvZGVzW2ldWzBdID09PSBfZmxhZ3MuY29sb25jb2RlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZXhwb3J0cy5vbk1hdGNoKF9jb2xvbmNvZGVzW2ldWzFdKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gICBcclxuICAgIH07XHJcblxyXG4gICAgZXhwb3J0cy51cGRhdGUgPSBmdW5jdGlvbiAoYnVmZmVyKSB7XHJcbiAgICAgICAgdXBkYXRlRmxhZ3MoYnVmZmVyKTtcclxuXHJcbiAgICAgICAgaWYgKGZsYWdzRG93bigpKSB7XHJcbiAgICAgICAgICAgIGV4cG9ydHMub25GbGFnc0Rvd24oKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAoX2ZsYWdzLmNvbG9uY29kZSkge1xyXG4gICAgICAgICAgICAgICAgc2VhcmNoRm9yQ29sb25jb2RlcyhfZmxhZ3MuY29sb25jb2RlKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHVwZGF0ZUNvbG9uY29kZXMobnVsbCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHJlc2V0RmxhZ3MoKTtcclxuICAgIHJldHVybiBleHBvcnRzO1xyXG59KSgpOyIsInZhciBTdGF0ZSA9IHJlcXVpcmUoJy4vU3RhdGUuanMnKTtcclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi91dGlscy5qcycpO1xyXG52YXIgRWxlbWVudFdhdGNoZXIgPSByZXF1aXJlKCcuL2VsZW1lbnQtd2F0Y2hlci5qcycpO1xyXG52YXIgU3RyaW5nQnVmZmVyID0gcmVxdWlyZSgnLi9zdHJpbmctYnVmZmVyLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChlbW9qaSkge1xyXG4gICAgdmFyIGVsZW1lbnQgPSBFbGVtZW50V2F0Y2hlci5nZXRFbGVtZW50KCk7XHJcbiAgICB2YXIgc2VhcmNoID0gU3RyaW5nQnVmZmVyLmdldEJ1ZmZlcigpO1xyXG4gICAgdmFyIGNvcHlCZWhhdmlvciA9IFN0YXRlLmdldEJlaGF2aW9yKCdjb3B5Jyk7XHJcblxyXG4gICAgaWYgKGNvcHlCZWhhdmlvcikge1xyXG4gICAgICAgIFV0aWxzLmNsaXBXaXRoU2VsZWN0aW9uKGVtb2ppKTtcclxuICAgIH1cclxuXHJcbiAgICBjb25zb2xlLmxvZyhcInJlcGxcIiwgZWxlbWVudCwgZW1vamkpO1xyXG5cclxuICAgIGlmIChlbGVtZW50KSB7XHJcbiAgICAgICAgaWYgKGVsZW1lbnQuaGFzQXR0cmlidXRlKFwiY29udGVudGVkaXRhYmxlXCIpKSB7XHJcbiAgICAgICAgICAgIFV0aWxzLm1hdGNoU2VsZWN0aW9uKHNlYXJjaCwgZnVuY3Rpb24gKG5vZGUsIHN0YXJ0LCBlbmQpIHtcclxuICAgICAgICAgICAgICAgIHZhciBzZWxlY3Rpb24gPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyIHJhbmdlID0gc2VsZWN0aW9uLmdldFJhbmdlQXQoc2VsZWN0aW9uLnJhbmdlQ291bnQgLSAxKTtcclxuICAgICAgICAgICAgICAgIHJhbmdlLnNldFN0YXJ0KG5vZGUsIHN0YXJ0KTtcclxuICAgICAgICAgICAgICAgIHJhbmdlLnNldEVuZChub2RlLCBlbmQpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICghY29weUJlaGF2aW9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmFuZ2UuZGVsZXRlQ29udGVudHMoKTtcclxuICAgICAgICAgICAgICAgICAgICByYW5nZS5pbnNlcnROb2RlKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGVtb2ppKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIG5vZGUucGFyZW50Tm9kZS5ub3JtYWxpemUoKTtcclxuICAgICAgICAgICAgICAgICAgICBzZWxlY3Rpb24uY29sbGFwc2VUb0VuZCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBVdGlscy5mb3JtUmVwbGFjZShlbGVtZW50LCBzZWFyY2gsIGVtb2ppKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIFN0cmluZ0J1ZmZlci5yZXNldCgpO1xyXG4gICAgfVxyXG59OyIsInZhciBTaG9ydGNvZGVzID0gcmVxdWlyZSgnLi4vLi4vZGF0YS9zaG9ydGNvZGVzLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgZXhwb3J0cyA9IHt9O1xyXG5cclxuICAgIHZhciBfc2V0cyA9IGdldFNldHMoU2hvcnRjb2Rlcyk7XHJcblxyXG4gICAgZnVuY3Rpb24gZ2V0U2V0cyhsaXN0KSB7XHJcbiAgICAgICAgdmFyIHNldHMgPSBbXTtcclxuXHJcbiAgICAgICAgZm9yICh2YXIgY29kZSBpbiBsaXN0KSB7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgY29kZS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgc2V0c1tpXSA9IHNldHNbaV0gfHwgW107XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHNldHNbaV0uaW5kZXhPZihjb2RlW2ldKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgICAgICBzZXRzW2ldLnB1c2goY29kZVtpXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBzZXRzO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydHMuaXNQYXJ0ID0gZnVuY3Rpb24gKHN0cikge1xyXG4gICAgICAgIGZvciAodmFyIGkgPSBzdHIubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuICAgICAgICAgICAgaWYgKCFfc2V0c1tpXSB8fCBfc2V0c1tpXS5pbmRleE9mKHN0cltpXSkgPT09IC0xKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLmdldCA9IGZ1bmN0aW9uIChrZXkpIHtcclxuICAgICAgICBpZiAoU2hvcnRjb2Rlc1trZXldKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBTaG9ydGNvZGVzW2tleV07XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLmdldEFsbCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gU2hvcnRjb2RlcztcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIGV4cG9ydHM7XHJcbn0pKCk7IiwidmFyIFN0YXRlID0gcmVxdWlyZSgnLi9TdGF0ZS5qcycpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzLmpzJyk7XHJcbnZhciBLZXlzID0gcmVxdWlyZSgnLi9LZXlzLmpzJyk7XHJcblxyXG5TdHJpbmdCdWZmZXIgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIGV4cG9ydHMgPSB7XHJcbiAgICAgICAgb25DaGFuZ2U6IGZ1bmN0aW9uICgpIHt9LFxyXG4gICAgICAgIG9uQ2xlYXI6IGZ1bmN0aW9uICgpIHt9LFxyXG4gICAgICAgIG9uQnJlYWs6IGZ1bmN0aW9uICgpIHt9XHJcbiAgICB9O1xyXG5cclxuICAgIHZhciBfYnVmZmVyID0gXCJcIjtcclxuXHJcbiAgICBmdW5jdGlvbiBjaGFuZ2UobXV0YXRvciwgc2lsZW50KSB7XHJcbiAgICAgICAgdmFyIGNhY2hlID0gX2J1ZmZlcjtcclxuICAgICAgICBfYnVmZmVyID0gbXV0YXRvcihfYnVmZmVyKTtcclxuXHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBfYnVmZmVyICE9PSBjYWNoZSAmJlxyXG4gICAgICAgICAgICB0eXBlb2YgX2J1ZmZlciA9PT0gXCJzdHJpbmdcIlxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgICBpZiAoc2lsZW50ICE9PSB0cnVlKSB7XHJcbiAgICAgICAgICAgICAgICBleHBvcnRzLm9uQ2hhbmdlKF9idWZmZXIsIGNhY2hlKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKF9idWZmZXIubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBleHBvcnRzLm9uQ2xlYXIoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBjbGVhcigpIHtcclxuICAgICAgICBjaGFuZ2UoZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICByZXR1cm4gXCJcIjtcclxuICAgICAgICB9LCB0cnVlKTtcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnRzLmhhbmRsZUtleVByZXNzID0gZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgICAgY2hhbmdlKGZ1bmN0aW9uIChidWZmZXIpIHtcclxuICAgICAgICAgICAgaWYgKGV2ZW50LndoaWNoICE9PSBLZXlzLmNvZGVzLnNwYWNlKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYnVmZmVyICsgZXZlbnQua2V5O1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGJ1ZmZlcjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLmhhbmRsZUtleURvd24gPSBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgIGV2ZW50LndoaWNoID09PSBLZXlzLmNvZGVzLmVudGVyIHx8XHJcbiAgICAgICAgICAgIGV2ZW50LndoaWNoID09PSBLZXlzLmNvZGVzLnNwYWNlXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIGV4cG9ydHMub25CcmVhayhfYnVmZmVyKTtcclxuICAgICAgICAgICAgY2xlYXIoKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3Rpb24gaXMgbm90IGEgc2luZ2xlIGNoYXJhY3RlciAoY3RybCtBKVxyXG4gICAgICAgIGlmIChLZXlzLmlzQXJyb3dLZXkoZXZlbnQud2hpY2gpIHx8ICEod2luZG93LmdldFNlbGVjdGlvbigpLmlzQ29sbGFwc2VkKSkge1xyXG4gICAgICAgICAgICBjbGVhcigpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZXZlbnQud2hpY2ggPT09IEtleXMuY29kZXMuYmFja3NwYWNlKSB7XHJcbiAgICAgICAgICAgIGNoYW5nZShmdW5jdGlvbiAoYnVmZmVyKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYnVmZmVyLnNsaWNlKDAsIC0xKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLnJlc2V0ID0gY2xlYXI7XHJcbiAgICBleHBvcnRzLmdldEJ1ZmZlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gX2J1ZmZlcjtcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIGV4cG9ydHM7XHJcbn0pKCk7XHJcblxyXG5TdGF0ZS5vbignYmVoYXZpb3JfY2hhbmdlJywgZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcclxuICAgIGlmIChrZXkgPT0gJ2FjdGl2ZScgJiYgdmFsdWUgPT0gZmFsc2UpIHtcclxuICAgICAgICBTdHJpbmdCdWZmZXIucmVzZXQoKTtcclxuICAgIH1cclxufSk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IFN0cmluZ0J1ZmZlcjsiLCIvLyBTb3VyY2U6IGh0dHBzOi8vZ2l0aHViLmNvbS9jb21wb25lbnQvdGV4dGFyZWEtY2FyZXQtcG9zaXRpb24vYmxvYi9tYXN0ZXIvaW5kZXguanNcclxuLy8gQ2hhbmdlICgxKSByZW1vdmVkIHRoZSBkb3QgKG5vdCBuZWVkZWQgaW4gQ2hyb21lKSBmb3IgYmV0dGVyIGFjY3VyYWN5XHJcblxyXG4vKiBqc2hpbnQgYnJvd3NlcjogdHJ1ZSAqL1xyXG5cclxuKGZ1bmN0aW9uICgpIHtcclxuXHJcbi8vIFdlJ2xsIGNvcHkgdGhlIHByb3BlcnRpZXMgYmVsb3cgaW50byB0aGUgbWlycm9yIGRpdi5cclxuLy8gTm90ZSB0aGF0IHNvbWUgYnJvd3NlcnMsIHN1Y2ggYXMgRmlyZWZveCwgZG8gbm90IGNvbmNhdGVuYXRlIHByb3BlcnRpZXNcclxuLy8gaW50byB0aGVpciBzaG9ydGhhbmQgKGUuZy4gcGFkZGluZy10b3AsIHBhZGRpbmctYm90dG9tIGV0Yy4gLT4gcGFkZGluZyksXHJcbi8vIHNvIHdlIGhhdmUgdG8gbGlzdCBldmVyeSBzaW5nbGUgcHJvcGVydHkgZXhwbGljaXRseS5cclxudmFyIHByb3BlcnRpZXMgPSBbXHJcbiAgJ2RpcmVjdGlvbicsICAvLyBSVEwgc3VwcG9ydFxyXG4gICdib3hTaXppbmcnLFxyXG4gICd3aWR0aCcsICAvLyBvbiBDaHJvbWUgYW5kIElFLCBleGNsdWRlIHRoZSBzY3JvbGxiYXIsIHNvIHRoZSBtaXJyb3IgZGl2IHdyYXBzIGV4YWN0bHkgYXMgdGhlIHRleHRhcmVhIGRvZXNcclxuICAnaGVpZ2h0JyxcclxuICAnb3ZlcmZsb3dYJyxcclxuICAnb3ZlcmZsb3dZJywgIC8vIGNvcHkgdGhlIHNjcm9sbGJhciBmb3IgSUVcclxuXHJcbiAgJ2JvcmRlclRvcFdpZHRoJyxcclxuICAnYm9yZGVyUmlnaHRXaWR0aCcsXHJcbiAgJ2JvcmRlckJvdHRvbVdpZHRoJyxcclxuICAnYm9yZGVyTGVmdFdpZHRoJyxcclxuICAnYm9yZGVyU3R5bGUnLFxyXG5cclxuICAncGFkZGluZ1RvcCcsXHJcbiAgJ3BhZGRpbmdSaWdodCcsXHJcbiAgJ3BhZGRpbmdCb3R0b20nLFxyXG4gICdwYWRkaW5nTGVmdCcsXHJcblxyXG4gIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0NTUy9mb250XHJcbiAgJ2ZvbnRTdHlsZScsXHJcbiAgJ2ZvbnRWYXJpYW50JyxcclxuICAnZm9udFdlaWdodCcsXHJcbiAgJ2ZvbnRTdHJldGNoJyxcclxuICAnZm9udFNpemUnLFxyXG4gICdmb250U2l6ZUFkanVzdCcsXHJcbiAgJ2xpbmVIZWlnaHQnLFxyXG4gICdmb250RmFtaWx5JyxcclxuXHJcbiAgJ3RleHRBbGlnbicsXHJcbiAgJ3RleHRUcmFuc2Zvcm0nLFxyXG4gICd0ZXh0SW5kZW50JyxcclxuICAndGV4dERlY29yYXRpb24nLCAgLy8gbWlnaHQgbm90IG1ha2UgYSBkaWZmZXJlbmNlLCBidXQgYmV0dGVyIGJlIHNhZmVcclxuXHJcbiAgJ2xldHRlclNwYWNpbmcnLFxyXG4gICd3b3JkU3BhY2luZycsXHJcblxyXG4gICd0YWJTaXplJyxcclxuICAnTW96VGFiU2l6ZSdcclxuXHJcbl07XHJcblxyXG52YXIgaXNCcm93c2VyID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKTtcclxudmFyIGlzRmlyZWZveCA9IChpc0Jyb3dzZXIgJiYgd2luZG93Lm1veklubmVyU2NyZWVuWCAhPSBudWxsKTtcclxuXHJcbmZ1bmN0aW9uIGdldENhcmV0Q29vcmRpbmF0ZXMoZWxlbWVudCwgcG9zaXRpb24sIG9wdGlvbnMpIHtcclxuICBpZiAoIWlzQnJvd3Nlcikge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCd0ZXh0YXJlYS1jYXJldC1wb3NpdGlvbiNnZXRDYXJldENvb3JkaW5hdGVzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBpbiBhIGJyb3dzZXInKTtcclxuICB9XHJcblxyXG4gIHZhciBkZWJ1ZyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5kZWJ1ZyB8fCBmYWxzZTtcclxuICBpZiAoZGVidWcpIHtcclxuICAgIHZhciBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNpbnB1dC10ZXh0YXJlYS1jYXJldC1wb3NpdGlvbi1taXJyb3ItZGl2Jyk7XHJcbiAgICBpZiAoZWwpIGVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZWwpO1xyXG4gIH1cclxuXHJcbiAgLy8gVGhlIG1pcnJvciBkaXYgd2lsbCByZXBsaWNhdGUgdGhlIHRleHRhcmVhJ3Mgc3R5bGVcclxuICB2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgZGl2LmlkID0gJ2lucHV0LXRleHRhcmVhLWNhcmV0LXBvc2l0aW9uLW1pcnJvci1kaXYnO1xyXG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGl2KTtcclxuXHJcbiAgdmFyIHN0eWxlID0gZGl2LnN0eWxlO1xyXG4gIHZhciBjb21wdXRlZCA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlID8gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbWVudCkgOiBlbGVtZW50LmN1cnJlbnRTdHlsZTsgIC8vIGN1cnJlbnRTdHlsZSBmb3IgSUUgPCA5XHJcbiAgdmFyIGlzSW5wdXQgPSBlbGVtZW50Lm5vZGVOYW1lID09PSAnSU5QVVQnO1xyXG5cclxuICAvLyBEZWZhdWx0IHRleHRhcmVhIHN0eWxlc1xyXG4gIHN0eWxlLndoaXRlU3BhY2UgPSAncHJlLXdyYXAnO1xyXG4gIGlmICghaXNJbnB1dClcclxuICAgIHN0eWxlLndvcmRXcmFwID0gJ2JyZWFrLXdvcmQnOyAgLy8gb25seSBmb3IgdGV4dGFyZWEtc1xyXG5cclxuICAvLyBQb3NpdGlvbiBvZmYtc2NyZWVuXHJcbiAgc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnOyAgLy8gcmVxdWlyZWQgdG8gcmV0dXJuIGNvb3JkaW5hdGVzIHByb3Blcmx5XHJcbiAgaWYgKCFkZWJ1ZylcclxuICAgIHN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJzsgIC8vIG5vdCAnZGlzcGxheTogbm9uZScgYmVjYXVzZSB3ZSB3YW50IHJlbmRlcmluZ1xyXG5cclxuICAvLyBUcmFuc2ZlciB0aGUgZWxlbWVudCdzIHByb3BlcnRpZXMgdG8gdGhlIGRpdlxyXG4gIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbiAocHJvcCkge1xyXG4gICAgaWYgKGlzSW5wdXQgJiYgcHJvcCA9PT0gJ2xpbmVIZWlnaHQnKSB7XHJcbiAgICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgPGlucHV0PnMgYmVjYXVzZSB0ZXh0IGlzIHJlbmRlcmVkIGNlbnRlcmVkIGFuZCBsaW5lIGhlaWdodCBtYXkgYmUgIT0gaGVpZ2h0XHJcbiAgICAgIHN0eWxlLmxpbmVIZWlnaHQgPSBjb21wdXRlZC5oZWlnaHQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzdHlsZVtwcm9wXSA9IGNvbXB1dGVkW3Byb3BdO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICBpZiAoaXNGaXJlZm94KSB7XHJcbiAgICAvLyBGaXJlZm94IGxpZXMgYWJvdXQgdGhlIG92ZXJmbG93IHByb3BlcnR5IGZvciB0ZXh0YXJlYXM6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTk4NDI3NVxyXG4gICAgaWYgKGVsZW1lbnQuc2Nyb2xsSGVpZ2h0ID4gcGFyc2VJbnQoY29tcHV0ZWQuaGVpZ2h0KSlcclxuICAgICAgc3R5bGUub3ZlcmZsb3dZID0gJ3Njcm9sbCc7XHJcbiAgfSBlbHNlIHtcclxuICAgIHN0eWxlLm92ZXJmbG93ID0gJ2hpZGRlbic7ICAvLyBmb3IgQ2hyb21lIHRvIG5vdCByZW5kZXIgYSBzY3JvbGxiYXI7IElFIGtlZXBzIG92ZXJmbG93WSA9ICdzY3JvbGwnXHJcbiAgfVxyXG5cclxuICBkaXYudGV4dENvbnRlbnQgPSBlbGVtZW50LnZhbHVlLnN1YnN0cmluZygwLCBwb3NpdGlvbik7XHJcbiAgLy8gVGhlIHNlY29uZCBzcGVjaWFsIGhhbmRsaW5nIGZvciBpbnB1dCB0eXBlPVwidGV4dFwiIHZzIHRleHRhcmVhOlxyXG4gIC8vIHNwYWNlcyBuZWVkIHRvIGJlIHJlcGxhY2VkIHdpdGggbm9uLWJyZWFraW5nIHNwYWNlcyAtIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzEzNDAyMDM1LzEyNjkwMzdcclxuICBpZiAoaXNJbnB1dClcclxuICAgIGRpdi50ZXh0Q29udGVudCA9IGRpdi50ZXh0Q29udGVudC5yZXBsYWNlKC9cXHMvZywgJ1xcdTAwYTAnKTtcclxuXHJcbiAgdmFyIHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgLy8gV3JhcHBpbmcgbXVzdCBiZSByZXBsaWNhdGVkICpleGFjdGx5KiwgaW5jbHVkaW5nIHdoZW4gYSBsb25nIHdvcmQgZ2V0c1xyXG4gIC8vIG9udG8gdGhlIG5leHQgbGluZSwgd2l0aCB3aGl0ZXNwYWNlIGF0IHRoZSBlbmQgb2YgdGhlIGxpbmUgYmVmb3JlICgjNykuXHJcbiAgLy8gVGhlICAqb25seSogcmVsaWFibGUgd2F5IHRvIGRvIHRoYXQgaXMgdG8gY29weSB0aGUgKmVudGlyZSogcmVzdCBvZiB0aGVcclxuICAvLyB0ZXh0YXJlYSdzIGNvbnRlbnQgaW50byB0aGUgPHNwYW4+IGNyZWF0ZWQgYXQgdGhlIGNhcmV0IHBvc2l0aW9uLlxyXG4gIC8vIEZvciBpbnB1dHMsIGp1c3QgJy4nIHdvdWxkIGJlIGVub3VnaCwgYnV0IG5vIG5lZWQgdG8gYm90aGVyLlxyXG4gIHNwYW4udGV4dENvbnRlbnQgPSBlbGVtZW50LnZhbHVlLnN1YnN0cmluZyhwb3NpdGlvbikgfHwgJyc7ICAvLyBDSEFOR0UgKDEpXHJcbiAgZGl2LmFwcGVuZENoaWxkKHNwYW4pO1xyXG5cclxuICB2YXIgY29vcmRpbmF0ZXMgPSB7XHJcbiAgICB0b3A6IHNwYW4ub2Zmc2V0VG9wICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlclRvcFdpZHRoJ10pLFxyXG4gICAgbGVmdDogc3Bhbi5vZmZzZXRMZWZ0ICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlckxlZnRXaWR0aCddKSxcclxuICAgIGhlaWdodDogcGFyc2VJbnQoY29tcHV0ZWRbJ2xpbmVIZWlnaHQnXSlcclxuICB9O1xyXG5cclxuICBpZiAoZGVidWcpIHtcclxuICAgIHNwYW4uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyNhYWEnO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpdik7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gY29vcmRpbmF0ZXM7XHJcbn1cclxuXHJcbmlmICh0eXBlb2YgbW9kdWxlICE9ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPSAndW5kZWZpbmVkJykge1xyXG4gIG1vZHVsZS5leHBvcnRzID0gZ2V0Q2FyZXRDb29yZGluYXRlcztcclxufSBlbHNlIGlmKGlzQnJvd3Nlcikge1xyXG4gIHdpbmRvdy5nZXRDYXJldENvb3JkaW5hdGVzID0gZ2V0Q2FyZXRDb29yZGluYXRlcztcclxufVxyXG5cclxufSgpKTsiLCJ2YXIgRHJvcGRvd24gPSByZXF1aXJlKCcuL2Ryb3Bkb3duLmpzJyk7XHJcbnZhciByZXBsYWNlID0gcmVxdWlyZSgnLi9yZXBsYWNlLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgZXhwb3J0cyA9IHt9O1xyXG5cclxuICAgIHZhciBfZHJvcGRvd24gPSBudWxsO1xyXG5cclxuICAgIGZ1bmN0aW9uIGV4aXN0cygpIHtcclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICBfZHJvcGRvd24gJiZcclxuICAgICAgICAgICAgX2Ryb3Bkb3duIGluc3RhbmNlb2YgRHJvcGRvd24gJiZcclxuICAgICAgICAgICAgIV9kcm9wZG93bi5kZXN0cm95ZWRcclxuICAgICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydHMuY3JlYXRlRHJvcGRvd24gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKCFleGlzdHMoKSkge1xyXG4gICAgICAgICAgICBfZHJvcGRvd24gPSBuZXcgRHJvcGRvd24oKTtcclxuICAgICAgICAgICAgX2Ryb3Bkb3duLm9uKCdjaG9vc2UnLCBmdW5jdGlvbiAoZW1vamkpIHtcclxuICAgICAgICAgICAgICAgIHJlcGxhY2UoZW1vamksIHRydWUpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuZHJvcGRvd25BY3Rpb24gPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICBpZiAoZXhpc3RzKCkpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2soX2Ryb3Bkb3duKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMucmVtb3ZlRHJvcGRvd24gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKGV4aXN0cygpKSB7XHJcbiAgICAgICAgICAgIF9kcm9wZG93bi5yZW1vdmUoKTtcclxuICAgICAgICAgICAgX2Ryb3Bkb3duID0gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuZHJvcGRvd25FeGlzdHMgPSBleGlzdHM7XHJcblxyXG4gICAgcmV0dXJuIGV4cG9ydHM7XHJcbn0pKCk7IiwidmFyIGZuVGV4dGFyZWFDYXJldFBvc2l0aW9uID0gcmVxdWlyZSgnLi90ZXh0YXJlYS1jYXJldC1wb3NpdGlvbi5qcycpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBmb3JtUmVwbGFjZTogZnVuY3Rpb24gKGVsZW0sIHNlYXJjaCwgcmVwbGFjZSkge1xyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgICAgIWVsZW0gfHxcclxuICAgICAgICAgICAgdHlwZW9mIGVsZW0udmFsdWUgIT09IFwic3RyaW5nXCIgfHxcclxuICAgICAgICAgICAgdHlwZW9mIGVsZW0uc2VsZWN0aW9uRW5kICE9PSBcIm51bWJlclwiXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHZhciB2YWx1ZSA9IGVsZW0udmFsdWUsXHJcbiAgICAgICAgICAgIGVuZEluZGV4ID0gZWxlbS5zZWxlY3Rpb25FbmQsXHJcbiAgICAgICAgICAgIHN0YXJ0SW5kZXggPSBlbmRJbmRleCAtIHNlYXJjaC5sZW5ndGg7XHJcblxyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgICAgc3RhcnRJbmRleCA+PSAwICYmXHJcbiAgICAgICAgICAgIGVuZEluZGV4ID4gc3RhcnRJbmRleCAmJlxyXG4gICAgICAgICAgICB2YWx1ZS5zdWJzdHJpbmcoc3RhcnRJbmRleCwgZW5kSW5kZXgpID09PSBzZWFyY2hcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgdmFyIGJlZm9yZSA9IHZhbHVlLnN1YnN0cmluZygwLCBzdGFydEluZGV4KTtcclxuICAgICAgICAgICAgdmFyIGFmdGVyID0gdmFsdWUuc3Vic3RyaW5nKGVuZEluZGV4KTtcclxuXHJcbiAgICAgICAgICAgIGVsZW0udmFsdWUgPSBiZWZvcmUgKyByZXBsYWNlICsgYWZ0ZXI7XHJcbiAgICAgICAgICAgIGVsZW0uc2VsZWN0aW9uRW5kID0gYmVmb3JlLmxlbmd0aCArIHJlcGxhY2UubGVuZ3RoO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgbWF0Y2hTZWxlY3Rpb246IGZ1bmN0aW9uIChzZWFyY2gsIGNhbGxiYWNrKSB7XHJcbiAgICAgICAgdmFyIHNlbGVjdGlvbiA9IHdpbmRvdy5nZXRTZWxlY3Rpb24oKTtcclxuXHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBzZWxlY3Rpb24gJiZcclxuICAgICAgICAgICAgc2VsZWN0aW9uLmZvY3VzTm9kZSAmJlxyXG4gICAgICAgICAgICBzZWxlY3Rpb24uZm9jdXNOb2RlLm5vZGVWYWx1ZVxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgICB2YXIgbm9kZSA9IHNlbGVjdGlvbi5mb2N1c05vZGU7XHJcbiAgICAgICAgICAgIHZhciBlbmRJbmRleCA9IHNlbGVjdGlvbi5mb2N1c09mZnNldDtcclxuICAgICAgICAgICAgdmFyIHN0YXJ0SW5kZXggPSBlbmRJbmRleCAtIHNlYXJjaC5sZW5ndGg7XHJcblxyXG4gICAgICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgICAgICBzdGFydEluZGV4ID49IDAgJiZcclxuICAgICAgICAgICAgICAgIGVuZEluZGV4ID4gc3RhcnRJbmRleCAmJlxyXG4gICAgICAgICAgICAgICAgc2VsZWN0aW9uLnJhbmdlQ291bnQgPiAwICYmXHJcbiAgICAgICAgICAgICAgICBub2RlLm5vZGVWYWx1ZS5zdWJzdHJpbmcoc3RhcnRJbmRleCwgZW5kSW5kZXgpID09PSBzZWFyY2hcclxuICAgICAgICAgICAgKSB7XHJcbiAgICAgICAgICAgICAgICBjYWxsYmFjayhub2RlLCBzdGFydEluZGV4LCBlbmRJbmRleCk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgfSxcclxuXHJcbiAgICBpc0VsZW1lbnRFZGl0YWJsZTogZnVuY3Rpb24gKGVsZW0pIHtcclxuICAgICAgICByZXR1cm4gKGVsZW0gJiYgKFxyXG4gICAgICAgICAgICBlbGVtLmhhc0F0dHJpYnV0ZShcImNvbnRlbnRlZGl0YWJsZVwiKSB8fFxyXG4gICAgICAgICAgICBlbGVtLnRhZ05hbWUgPT09IFwiVEVYVEFSRUFcIiB8fFxyXG4gICAgICAgICAgICBlbGVtLnRhZ05hbWUgPT09IFwiSU5QVVRcIlxyXG4gICAgICAgICkpO1xyXG4gICAgfSxcclxuXHJcbiAgICBpc0VsZW1lbnRFbW9qaUVsaWdpYmxlOiBmdW5jdGlvbiAoZWxlbSkge1xyXG4gICAgICAgIHZhciBmb3JiaWRkZW4gPSBbXCJlbWFpbFwiLCBcInBhc3N3b3JkXCIsIFwidGVsXCJdXHJcbiAgICAgICAgLCAgIHR5cGUgPSBlbGVtLmdldEF0dHJpYnV0ZShcInR5cGVcIilcclxuICAgICAgICAsICAgbmFtZSA9IGVsZW0uZ2V0QXR0cmlidXRlKFwibmFtZVwiKTtcclxuXHJcbiAgICAgICAgcmV0dXJuIChcclxuICAgICAgICAgICAgdGhpcy5pc0VsZW1lbnRFZGl0YWJsZShlbGVtKSAmJlxyXG4gICAgICAgICAgICBmb3JiaWRkZW4uaW5kZXhPZih0eXBlKSA9PSAtMSAmJlxyXG4gICAgICAgICAgICBmb3JiaWRkZW4uaW5kZXhPZihuYW1lKSA9PSAtMVxyXG4gICAgICAgICk7XHJcbiAgICB9LFxyXG5cclxuICAgIGdldEVsZW1lbnRCb2R5T2Zmc2V0OiBmdW5jdGlvbiAoZWxlbSkge1xyXG4gICAgICAgIHZhciB2aWV3cG9ydE9mZnNldCA9IGVsZW0uZ2V0Qm91bmRpbmdDbGllbnRSZWN0KClcclxuICAgICAgICAsICAgc2Nyb2xsVG9wID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcCArIGRvY3VtZW50LmJvZHkuc2Nyb2xsVG9wXHJcbiAgICAgICAgLCAgIHNjcm9sbExlZnQgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsTGVmdCArIGRvY3VtZW50LmJvZHkuc2Nyb2xsTGVmdFxyXG4gICAgICAgICwgICBvZmZzZXRFbGVtID0gZWxlbVxyXG4gICAgICAgICwgICByZXN1bHQgPSB7XHJcbiAgICAgICAgICAgICAgICB0b3A6IDAsXHJcbiAgICAgICAgICAgICAgICBsZWZ0OiAwLFxyXG4gICAgICAgICAgICAgICAgZml4ZWQ6IGZhbHNlXHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgIGRvIHtcclxuICAgICAgICAgICAgdmFyIGNvbXB1dGVkID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUob2Zmc2V0RWxlbSk7XHJcblxyXG4gICAgICAgICAgICBpZiAoY29tcHV0ZWQgJiYgY29tcHV0ZWQucG9zaXRpb24gPT0gXCJmaXhlZFwiKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQuZml4ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IHdoaWxlIChvZmZzZXRFbGVtID0gb2Zmc2V0RWxlbS5vZmZzZXRQYXJlbnQpO1xyXG5cclxuICAgICAgICByZXN1bHQudG9wID0gdmlld3BvcnRPZmZzZXQudG9wO1xyXG4gICAgICAgIHJlc3VsdC5sZWZ0ID0gdmlld3BvcnRPZmZzZXQubGVmdDtcclxuXHJcbiAgICAgICAgaWYgKCFyZXN1bHQuZml4ZWQpIHtcclxuICAgICAgICAgICAgcmVzdWx0LnRvcCArPSBzY3JvbGxUb3A7XHJcbiAgICAgICAgICAgIHJlc3VsdC5sZWZ0ICs9IHNjcm9sbExlZnQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gcmVzdWx0O1xyXG4gICAgfSxcclxuXHJcbiAgICBnZXRFbGVtZW50Q2FyZXRPZmZzZXQ6IGZ1bmN0aW9uIChlbGVtKSB7XHJcbiAgICAgICAgdmFyIG9mZnNldCA9IG51bGw7XHJcblxyXG4gICAgICAgIGlmIChlbGVtLmhhc0F0dHJpYnV0ZSgnY29udGVudGVkaXRhYmxlJykpIHtcclxuICAgICAgICAgICAgdmFyIHNlbGVjdGlvbiA9IHdpbmRvdy5nZXRTZWxlY3Rpb24oKVxyXG4gICAgICAgICAgICAsICAgcmFuZ2UgPSBzZWxlY3Rpb24uZ2V0UmFuZ2VBdChzZWxlY3Rpb24ucmFuZ2VDb3VudCAtIDEpXHJcbiAgICAgICAgICAgICwgICBjbG9uZWRSYW5nZSA9IHJhbmdlLmNsb25lUmFuZ2UoKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gICAgICAgICAgICBjbG9uZWRSYW5nZS5pbnNlcnROb2RlKG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgb2Zmc2V0ID0gdGhpcy5nZXRFbGVtZW50Qm9keU9mZnNldChub2RlKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBwYXJlbnQgPSBub2RlLnBhcmVudE5vZGU7XHJcbiAgICAgICAgICAgIHBhcmVudC5yZW1vdmVDaGlsZChub2RlKTtcclxuICAgICAgICAgICAgcGFyZW50Lm5vcm1hbGl6ZSgpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIG9mZnNldCA9IHRoaXMuZ2V0RWxlbWVudEJvZHlPZmZzZXQoZWxlbSk7XHJcblxyXG4gICAgICAgICAgICB2YXIgY2FyZXRPZmZzZXQgPSBmblRleHRhcmVhQ2FyZXRQb3NpdGlvbihlbGVtLCBlbGVtLnNlbGVjdGlvbkVuZCk7XHJcbiAgICAgICAgICAgIG9mZnNldC50b3AgKz0gY2FyZXRPZmZzZXQudG9wIC0gZWxlbS5zY3JvbGxUb3A7XHJcbiAgICAgICAgICAgIG9mZnNldC5sZWZ0ICs9IGNhcmV0T2Zmc2V0LmxlZnQ7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gb2Zmc2V0O1xyXG4gICAgfSxcclxuXHJcbiAgICBjbGlwV2l0aElucHV0OiBmdW5jdGlvbiAodGV4dCkge1xyXG4gICAgICAgIHZhciBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKTtcclxuICAgICAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKGlucHV0KTtcclxuXHJcbiAgICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImZvY3VzXCIsIGZ1bmN0aW9uIChlKSB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaW5wdXQudmFsdWUgPSB0ZXh0O1xyXG4gICAgICAgIGlucHV0LnNlbGVjdCgpO1xyXG5cclxuICAgICAgICBkb2N1bWVudC5leGVjQ29tbWFuZChcImNvcHlcIik7XHJcbiAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChpbnB1dCk7XHJcbiAgICB9LFxyXG5cclxuICAgIGNsaXBXaXRoU2VsZWN0aW9uOiBmdW5jdGlvbiAodGV4dCkge1xyXG4gICAgICAgIHZhciBub2RlID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodGV4dCksXHJcbiAgICAgICAgICAgIHNlbGVjdGlvbiA9IHdpbmRvdy5nZXRTZWxlY3Rpb24oKSxcclxuICAgICAgICAgICAgcmFuZ2UgPSBkb2N1bWVudC5jcmVhdGVSYW5nZSgpLFxyXG4gICAgICAgICAgICBjbG9uZSA9IG51bGw7XHJcblxyXG4gICAgICAgIGlmIChzZWxlY3Rpb24ucmFuZ2VDb3VudCA+IDApIHtcclxuICAgICAgICAgICAgY2xvbmUgPSBzZWxlY3Rpb24uZ2V0UmFuZ2VBdChzZWxlY3Rpb24ucmFuZ2VDb3VudCAtIDEpLmNsb25lUmFuZ2UoKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobm9kZSk7XHJcbiAgICAgICAgc2VsZWN0aW9uLnJlbW92ZUFsbFJhbmdlcygpO1xyXG4gICAgICAgIHJhbmdlLnNlbGVjdE5vZGVDb250ZW50cyhub2RlKTtcclxuICAgICAgICBzZWxlY3Rpb24uYWRkUmFuZ2UocmFuZ2UpO1xyXG4gICAgICAgIGRvY3VtZW50LmV4ZWNDb21tYW5kKFwiY29weVwiKTtcclxuXHJcbiAgICAgICAgc2VsZWN0aW9uLnJlbW92ZUFsbFJhbmdlcygpO1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkucmVtb3ZlQ2hpbGQobm9kZSk7XHJcblxyXG4gICAgICAgIGlmIChjbG9uZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICBzZWxlY3Rpb24uYWRkUmFuZ2UoY2xvbmUpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxufTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBhc3NpZ24gICAgICAgID0gcmVxdWlyZSgnZXM1LWV4dC9vYmplY3QvYXNzaWduJylcbiAgLCBub3JtYWxpemVPcHRzID0gcmVxdWlyZSgnZXM1LWV4dC9vYmplY3Qvbm9ybWFsaXplLW9wdGlvbnMnKVxuICAsIGlzQ2FsbGFibGUgICAgPSByZXF1aXJlKCdlczUtZXh0L29iamVjdC9pcy1jYWxsYWJsZScpXG4gICwgY29udGFpbnMgICAgICA9IHJlcXVpcmUoJ2VzNS1leHQvc3RyaW5nLyMvY29udGFpbnMnKVxuXG4gICwgZDtcblxuZCA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGRzY3IsIHZhbHVlLyosIG9wdGlvbnMqLykge1xuXHR2YXIgYywgZSwgdywgb3B0aW9ucywgZGVzYztcblx0aWYgKChhcmd1bWVudHMubGVuZ3RoIDwgMikgfHwgKHR5cGVvZiBkc2NyICE9PSAnc3RyaW5nJykpIHtcblx0XHRvcHRpb25zID0gdmFsdWU7XG5cdFx0dmFsdWUgPSBkc2NyO1xuXHRcdGRzY3IgPSBudWxsO1xuXHR9IGVsc2Uge1xuXHRcdG9wdGlvbnMgPSBhcmd1bWVudHNbMl07XG5cdH1cblx0aWYgKGRzY3IgPT0gbnVsbCkge1xuXHRcdGMgPSB3ID0gdHJ1ZTtcblx0XHRlID0gZmFsc2U7XG5cdH0gZWxzZSB7XG5cdFx0YyA9IGNvbnRhaW5zLmNhbGwoZHNjciwgJ2MnKTtcblx0XHRlID0gY29udGFpbnMuY2FsbChkc2NyLCAnZScpO1xuXHRcdHcgPSBjb250YWlucy5jYWxsKGRzY3IsICd3Jyk7XG5cdH1cblxuXHRkZXNjID0geyB2YWx1ZTogdmFsdWUsIGNvbmZpZ3VyYWJsZTogYywgZW51bWVyYWJsZTogZSwgd3JpdGFibGU6IHcgfTtcblx0cmV0dXJuICFvcHRpb25zID8gZGVzYyA6IGFzc2lnbihub3JtYWxpemVPcHRzKG9wdGlvbnMpLCBkZXNjKTtcbn07XG5cbmQuZ3MgPSBmdW5jdGlvbiAoZHNjciwgZ2V0LCBzZXQvKiwgb3B0aW9ucyovKSB7XG5cdHZhciBjLCBlLCBvcHRpb25zLCBkZXNjO1xuXHRpZiAodHlwZW9mIGRzY3IgIT09ICdzdHJpbmcnKSB7XG5cdFx0b3B0aW9ucyA9IHNldDtcblx0XHRzZXQgPSBnZXQ7XG5cdFx0Z2V0ID0gZHNjcjtcblx0XHRkc2NyID0gbnVsbDtcblx0fSBlbHNlIHtcblx0XHRvcHRpb25zID0gYXJndW1lbnRzWzNdO1xuXHR9XG5cdGlmIChnZXQgPT0gbnVsbCkge1xuXHRcdGdldCA9IHVuZGVmaW5lZDtcblx0fSBlbHNlIGlmICghaXNDYWxsYWJsZShnZXQpKSB7XG5cdFx0b3B0aW9ucyA9IGdldDtcblx0XHRnZXQgPSBzZXQgPSB1bmRlZmluZWQ7XG5cdH0gZWxzZSBpZiAoc2V0ID09IG51bGwpIHtcblx0XHRzZXQgPSB1bmRlZmluZWQ7XG5cdH0gZWxzZSBpZiAoIWlzQ2FsbGFibGUoc2V0KSkge1xuXHRcdG9wdGlvbnMgPSBzZXQ7XG5cdFx0c2V0ID0gdW5kZWZpbmVkO1xuXHR9XG5cdGlmIChkc2NyID09IG51bGwpIHtcblx0XHRjID0gdHJ1ZTtcblx0XHRlID0gZmFsc2U7XG5cdH0gZWxzZSB7XG5cdFx0YyA9IGNvbnRhaW5zLmNhbGwoZHNjciwgJ2MnKTtcblx0XHRlID0gY29udGFpbnMuY2FsbChkc2NyLCAnZScpO1xuXHR9XG5cblx0ZGVzYyA9IHsgZ2V0OiBnZXQsIHNldDogc2V0LCBjb25maWd1cmFibGU6IGMsIGVudW1lcmFibGU6IGUgfTtcblx0cmV0dXJuICFvcHRpb25zID8gZGVzYyA6IGFzc2lnbihub3JtYWxpemVPcHRzKG9wdGlvbnMpLCBkZXNjKTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWVtcHR5LWZ1bmN0aW9uXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHt9O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vaXMtaW1wbGVtZW50ZWRcIikoKVxuXHQ/IE9iamVjdC5hc3NpZ25cblx0OiByZXF1aXJlKFwiLi9zaGltXCIpO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgYXNzaWduID0gT2JqZWN0LmFzc2lnbiwgb2JqO1xuXHRpZiAodHlwZW9mIGFzc2lnbiAhPT0gXCJmdW5jdGlvblwiKSByZXR1cm4gZmFsc2U7XG5cdG9iaiA9IHsgZm9vOiBcInJhelwiIH07XG5cdGFzc2lnbihvYmosIHsgYmFyOiBcImR3YVwiIH0sIHsgdHJ6eTogXCJ0cnp5XCIgfSk7XG5cdHJldHVybiAob2JqLmZvbyArIG9iai5iYXIgKyBvYmoudHJ6eSkgPT09IFwicmF6ZHdhdHJ6eVwiO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIga2V5cyAgPSByZXF1aXJlKFwiLi4va2V5c1wiKVxuICAsIHZhbHVlID0gcmVxdWlyZShcIi4uL3ZhbGlkLXZhbHVlXCIpXG4gICwgbWF4ICAgPSBNYXRoLm1heDtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZGVzdCwgc3JjIC8qLCDigKZzcmNuKi8pIHtcblx0dmFyIGVycm9yLCBpLCBsZW5ndGggPSBtYXgoYXJndW1lbnRzLmxlbmd0aCwgMiksIGFzc2lnbjtcblx0ZGVzdCA9IE9iamVjdCh2YWx1ZShkZXN0KSk7XG5cdGFzc2lnbiA9IGZ1bmN0aW9uIChrZXkpIHtcblx0XHR0cnkge1xuXHRcdFx0ZGVzdFtrZXldID0gc3JjW2tleV07XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0aWYgKCFlcnJvcikgZXJyb3IgPSBlO1xuXHRcdH1cblx0fTtcblx0Zm9yIChpID0gMTsgaSA8IGxlbmd0aDsgKytpKSB7XG5cdFx0c3JjID0gYXJndW1lbnRzW2ldO1xuXHRcdGtleXMoc3JjKS5mb3JFYWNoKGFzc2lnbik7XG5cdH1cblx0aWYgKGVycm9yICE9PSB1bmRlZmluZWQpIHRocm93IGVycm9yO1xuXHRyZXR1cm4gZGVzdDtcbn07XG4iLCIvLyBEZXByZWNhdGVkXG5cblwidXNlIHN0cmljdFwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmopIHtcbiByZXR1cm4gdHlwZW9mIG9iaiA9PT0gXCJmdW5jdGlvblwiO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgX3VuZGVmaW5lZCA9IHJlcXVpcmUoXCIuLi9mdW5jdGlvbi9ub29wXCIpKCk7IC8vIFN1cHBvcnQgRVMzIGVuZ2luZXNcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAodmFsKSB7XG4gcmV0dXJuICh2YWwgIT09IF91bmRlZmluZWQpICYmICh2YWwgIT09IG51bGwpO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL2lzLWltcGxlbWVudGVkXCIpKClcblx0PyBPYmplY3Qua2V5c1xuXHQ6IHJlcXVpcmUoXCIuL3NoaW1cIik7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cdHRyeSB7XG5cdFx0T2JqZWN0LmtleXMoXCJwcmltaXRpdmVcIik7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH0gY2F0Y2ggKGUpIHtcbiByZXR1cm4gZmFsc2U7XG59XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBpc1ZhbHVlID0gcmVxdWlyZShcIi4uL2lzLXZhbHVlXCIpO1xuXG52YXIga2V5cyA9IE9iamVjdC5rZXlzO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChvYmplY3QpIHtcblx0cmV0dXJuIGtleXMoaXNWYWx1ZShvYmplY3QpID8gT2JqZWN0KG9iamVjdCkgOiBvYmplY3QpO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgaXNWYWx1ZSA9IHJlcXVpcmUoXCIuL2lzLXZhbHVlXCIpO1xuXG52YXIgZm9yRWFjaCA9IEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLCBjcmVhdGUgPSBPYmplY3QuY3JlYXRlO1xuXG52YXIgcHJvY2VzcyA9IGZ1bmN0aW9uIChzcmMsIG9iaikge1xuXHR2YXIga2V5O1xuXHRmb3IgKGtleSBpbiBzcmMpIG9ialtrZXldID0gc3JjW2tleV07XG59O1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tdW51c2VkLXZhcnNcbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9wdHMxIC8qLCDigKZvcHRpb25zKi8pIHtcblx0dmFyIHJlc3VsdCA9IGNyZWF0ZShudWxsKTtcblx0Zm9yRWFjaC5jYWxsKGFyZ3VtZW50cywgZnVuY3Rpb24gKG9wdGlvbnMpIHtcblx0XHRpZiAoIWlzVmFsdWUob3B0aW9ucykpIHJldHVybjtcblx0XHRwcm9jZXNzKE9iamVjdChvcHRpb25zKSwgcmVzdWx0KTtcblx0fSk7XG5cdHJldHVybiByZXN1bHQ7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZuKSB7XG5cdGlmICh0eXBlb2YgZm4gIT09IFwiZnVuY3Rpb25cIikgdGhyb3cgbmV3IFR5cGVFcnJvcihmbiArIFwiIGlzIG5vdCBhIGZ1bmN0aW9uXCIpO1xuXHRyZXR1cm4gZm47XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBpc1ZhbHVlID0gcmVxdWlyZShcIi4vaXMtdmFsdWVcIik7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHZhbHVlKSB7XG5cdGlmICghaXNWYWx1ZSh2YWx1ZSkpIHRocm93IG5ldyBUeXBlRXJyb3IoXCJDYW5ub3QgdXNlIG51bGwgb3IgdW5kZWZpbmVkXCIpO1xuXHRyZXR1cm4gdmFsdWU7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vaXMtaW1wbGVtZW50ZWRcIikoKVxuXHQ/IFN0cmluZy5wcm90b3R5cGUuY29udGFpbnNcblx0OiByZXF1aXJlKFwiLi9zaGltXCIpO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBzdHIgPSBcInJhemR3YXRyenlcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cdGlmICh0eXBlb2Ygc3RyLmNvbnRhaW5zICE9PSBcImZ1bmN0aW9uXCIpIHJldHVybiBmYWxzZTtcblx0cmV0dXJuIChzdHIuY29udGFpbnMoXCJkd2FcIikgPT09IHRydWUpICYmIChzdHIuY29udGFpbnMoXCJmb29cIikgPT09IGZhbHNlKTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIGluZGV4T2YgPSBTdHJpbmcucHJvdG90eXBlLmluZGV4T2Y7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHNlYXJjaFN0cmluZy8qLCBwb3NpdGlvbiovKSB7XG5cdHJldHVybiBpbmRleE9mLmNhbGwodGhpcywgc2VhcmNoU3RyaW5nLCBhcmd1bWVudHNbMV0pID4gLTE7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZCAgICAgICAgPSByZXF1aXJlKCdkJylcbiAgLCBjYWxsYWJsZSA9IHJlcXVpcmUoJ2VzNS1leHQvb2JqZWN0L3ZhbGlkLWNhbGxhYmxlJylcblxuICAsIGFwcGx5ID0gRnVuY3Rpb24ucHJvdG90eXBlLmFwcGx5LCBjYWxsID0gRnVuY3Rpb24ucHJvdG90eXBlLmNhbGxcbiAgLCBjcmVhdGUgPSBPYmplY3QuY3JlYXRlLCBkZWZpbmVQcm9wZXJ0eSA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eVxuICAsIGRlZmluZVByb3BlcnRpZXMgPSBPYmplY3QuZGVmaW5lUHJvcGVydGllc1xuICAsIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eVxuICAsIGRlc2NyaXB0b3IgPSB7IGNvbmZpZ3VyYWJsZTogdHJ1ZSwgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlIH1cblxuICAsIG9uLCBvbmNlLCBvZmYsIGVtaXQsIG1ldGhvZHMsIGRlc2NyaXB0b3JzLCBiYXNlO1xuXG5vbiA9IGZ1bmN0aW9uICh0eXBlLCBsaXN0ZW5lcikge1xuXHR2YXIgZGF0YTtcblxuXHRjYWxsYWJsZShsaXN0ZW5lcik7XG5cblx0aWYgKCFoYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMsICdfX2VlX18nKSkge1xuXHRcdGRhdGEgPSBkZXNjcmlwdG9yLnZhbHVlID0gY3JlYXRlKG51bGwpO1xuXHRcdGRlZmluZVByb3BlcnR5KHRoaXMsICdfX2VlX18nLCBkZXNjcmlwdG9yKTtcblx0XHRkZXNjcmlwdG9yLnZhbHVlID0gbnVsbDtcblx0fSBlbHNlIHtcblx0XHRkYXRhID0gdGhpcy5fX2VlX187XG5cdH1cblx0aWYgKCFkYXRhW3R5cGVdKSBkYXRhW3R5cGVdID0gbGlzdGVuZXI7XG5cdGVsc2UgaWYgKHR5cGVvZiBkYXRhW3R5cGVdID09PSAnb2JqZWN0JykgZGF0YVt0eXBlXS5wdXNoKGxpc3RlbmVyKTtcblx0ZWxzZSBkYXRhW3R5cGVdID0gW2RhdGFbdHlwZV0sIGxpc3RlbmVyXTtcblxuXHRyZXR1cm4gdGhpcztcbn07XG5cbm9uY2UgPSBmdW5jdGlvbiAodHlwZSwgbGlzdGVuZXIpIHtcblx0dmFyIG9uY2UsIHNlbGY7XG5cblx0Y2FsbGFibGUobGlzdGVuZXIpO1xuXHRzZWxmID0gdGhpcztcblx0b24uY2FsbCh0aGlzLCB0eXBlLCBvbmNlID0gZnVuY3Rpb24gKCkge1xuXHRcdG9mZi5jYWxsKHNlbGYsIHR5cGUsIG9uY2UpO1xuXHRcdGFwcGx5LmNhbGwobGlzdGVuZXIsIHRoaXMsIGFyZ3VtZW50cyk7XG5cdH0pO1xuXG5cdG9uY2UuX19lZU9uY2VMaXN0ZW5lcl9fID0gbGlzdGVuZXI7XG5cdHJldHVybiB0aGlzO1xufTtcblxub2ZmID0gZnVuY3Rpb24gKHR5cGUsIGxpc3RlbmVyKSB7XG5cdHZhciBkYXRhLCBsaXN0ZW5lcnMsIGNhbmRpZGF0ZSwgaTtcblxuXHRjYWxsYWJsZShsaXN0ZW5lcik7XG5cblx0aWYgKCFoYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMsICdfX2VlX18nKSkgcmV0dXJuIHRoaXM7XG5cdGRhdGEgPSB0aGlzLl9fZWVfXztcblx0aWYgKCFkYXRhW3R5cGVdKSByZXR1cm4gdGhpcztcblx0bGlzdGVuZXJzID0gZGF0YVt0eXBlXTtcblxuXHRpZiAodHlwZW9mIGxpc3RlbmVycyA9PT0gJ29iamVjdCcpIHtcblx0XHRmb3IgKGkgPSAwOyAoY2FuZGlkYXRlID0gbGlzdGVuZXJzW2ldKTsgKytpKSB7XG5cdFx0XHRpZiAoKGNhbmRpZGF0ZSA9PT0gbGlzdGVuZXIpIHx8XG5cdFx0XHRcdFx0KGNhbmRpZGF0ZS5fX2VlT25jZUxpc3RlbmVyX18gPT09IGxpc3RlbmVyKSkge1xuXHRcdFx0XHRpZiAobGlzdGVuZXJzLmxlbmd0aCA9PT0gMikgZGF0YVt0eXBlXSA9IGxpc3RlbmVyc1tpID8gMCA6IDFdO1xuXHRcdFx0XHRlbHNlIGxpc3RlbmVycy5zcGxpY2UoaSwgMSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdGlmICgobGlzdGVuZXJzID09PSBsaXN0ZW5lcikgfHxcblx0XHRcdFx0KGxpc3RlbmVycy5fX2VlT25jZUxpc3RlbmVyX18gPT09IGxpc3RlbmVyKSkge1xuXHRcdFx0ZGVsZXRlIGRhdGFbdHlwZV07XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuXG5lbWl0ID0gZnVuY3Rpb24gKHR5cGUpIHtcblx0dmFyIGksIGwsIGxpc3RlbmVyLCBsaXN0ZW5lcnMsIGFyZ3M7XG5cblx0aWYgKCFoYXNPd25Qcm9wZXJ0eS5jYWxsKHRoaXMsICdfX2VlX18nKSkgcmV0dXJuO1xuXHRsaXN0ZW5lcnMgPSB0aGlzLl9fZWVfX1t0eXBlXTtcblx0aWYgKCFsaXN0ZW5lcnMpIHJldHVybjtcblxuXHRpZiAodHlwZW9mIGxpc3RlbmVycyA9PT0gJ29iamVjdCcpIHtcblx0XHRsID0gYXJndW1lbnRzLmxlbmd0aDtcblx0XHRhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcblx0XHRmb3IgKGkgPSAxOyBpIDwgbDsgKytpKSBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblxuXHRcdGxpc3RlbmVycyA9IGxpc3RlbmVycy5zbGljZSgpO1xuXHRcdGZvciAoaSA9IDA7IChsaXN0ZW5lciA9IGxpc3RlbmVyc1tpXSk7ICsraSkge1xuXHRcdFx0YXBwbHkuY2FsbChsaXN0ZW5lciwgdGhpcywgYXJncyk7XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuXHRcdGNhc2UgMTpcblx0XHRcdGNhbGwuY2FsbChsaXN0ZW5lcnMsIHRoaXMpO1xuXHRcdFx0YnJlYWs7XG5cdFx0Y2FzZSAyOlxuXHRcdFx0Y2FsbC5jYWxsKGxpc3RlbmVycywgdGhpcywgYXJndW1lbnRzWzFdKTtcblx0XHRcdGJyZWFrO1xuXHRcdGNhc2UgMzpcblx0XHRcdGNhbGwuY2FsbChsaXN0ZW5lcnMsIHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcblx0XHRcdGJyZWFrO1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHRsID0gYXJndW1lbnRzLmxlbmd0aDtcblx0XHRcdGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuXHRcdFx0Zm9yIChpID0gMTsgaSA8IGw7ICsraSkge1xuXHRcdFx0XHRhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcblx0XHRcdH1cblx0XHRcdGFwcGx5LmNhbGwobGlzdGVuZXJzLCB0aGlzLCBhcmdzKTtcblx0XHR9XG5cdH1cbn07XG5cbm1ldGhvZHMgPSB7XG5cdG9uOiBvbixcblx0b25jZTogb25jZSxcblx0b2ZmOiBvZmYsXG5cdGVtaXQ6IGVtaXRcbn07XG5cbmRlc2NyaXB0b3JzID0ge1xuXHRvbjogZChvbiksXG5cdG9uY2U6IGQob25jZSksXG5cdG9mZjogZChvZmYpLFxuXHRlbWl0OiBkKGVtaXQpXG59O1xuXG5iYXNlID0gZGVmaW5lUHJvcGVydGllcyh7fSwgZGVzY3JpcHRvcnMpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHMgPSBmdW5jdGlvbiAobykge1xuXHRyZXR1cm4gKG8gPT0gbnVsbCkgPyBjcmVhdGUoYmFzZSkgOiBkZWZpbmVQcm9wZXJ0aWVzKE9iamVjdChvKSwgZGVzY3JpcHRvcnMpO1xufTtcbmV4cG9ydHMubWV0aG9kcyA9IG1ldGhvZHM7XG4iLCJ2YXIgbG9jYXRpb24gPSBnbG9iYWwubG9jYXRpb24gfHwge307XG4vKmpzbGludCBpbmRlbnQ6IDIsIGJyb3dzZXI6IHRydWUsIGJpdHdpc2U6IHRydWUsIHBsdXNwbHVzOiB0cnVlICovXG52YXIgdHdlbW9qaSA9IChmdW5jdGlvbiAoXG4gIC8qISBDb3B5cmlnaHQgVHdpdHRlciBJbmMuIGFuZCBvdGhlciBjb250cmlidXRvcnMuIExpY2Vuc2VkIHVuZGVyIE1JVCAqLy8qXG4gICAgaHR0cHM6Ly9naXRodWIuY29tL3R3aXR0ZXIvdHdlbW9qaS9ibG9iL2doLXBhZ2VzL0xJQ0VOU0VcbiAgKi9cblxuICAvLyBXQVJOSU5HOiAgIHRoaXMgZmlsZSBpcyBnZW5lcmF0ZWQgYXV0b21hdGljYWxseSB2aWFcbiAgLy8gICAgICAgICAgICBgbm9kZSB0d2Vtb2ppLWdlbmVyYXRvci5qc2BcbiAgLy8gICAgICAgICAgICBwbGVhc2UgdXBkYXRlIGl0cyBgY3JlYXRlVHdlbW9qaWAgZnVuY3Rpb25cbiAgLy8gICAgICAgICAgICBhdCB0aGUgYm90dG9tIG9mIHRoZSBzYW1lIGZpbGUgaW5zdGVhZC5cblxuKSB7XG4gICd1c2Ugc3RyaWN0JztcblxuICAvKmpzaGludCBtYXhwYXJhbXM6NCAqL1xuXG4gIHZhclxuICAgIC8vIHRoZSBleHBvcnRlZCBtb2R1bGUgb2JqZWN0XG4gICAgdHdlbW9qaSA9IHtcblxuXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgIC8vICAgICAgcHJvcGVydGllcyAgICAgLy9cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbiAgICAgIC8vIGRlZmF1bHQgYXNzZXRzIHVybCwgYnkgZGVmYXVsdCB3aWxsIGJlIFR3aXR0ZXIgSW5jLiBDRE5cbiAgICAgIGJhc2U6ICdodHRwczovL3R3ZW1vamkubWF4Y2RuLmNvbS8yLycsXG5cbiAgICAgIC8vIGRlZmF1bHQgYXNzZXRzIGZpbGUgZXh0ZW5zaW9ucywgYnkgZGVmYXVsdCAnLnBuZydcbiAgICAgIGV4dDogJy5wbmcnLFxuXG4gICAgICAvLyBkZWZhdWx0IGFzc2V0cy9mb2xkZXIgc2l6ZSwgYnkgZGVmYXVsdCBcIjcyeDcyXCJcbiAgICAgIC8vIGF2YWlsYWJsZSB2aWEgVHdpdHRlciBDRE46IDcyXG4gICAgICBzaXplOiAnNzJ4NzInLFxuXG4gICAgICAvLyBkZWZhdWx0IGNsYXNzIG5hbWUsIGJ5IGRlZmF1bHQgJ2Vtb2ppJ1xuICAgICAgY2xhc3NOYW1lOiAnZW1vamknLFxuXG4gICAgICAvLyBiYXNpYyB1dGlsaXRpZXMgLyBoZWxwZXJzIHRvIGNvbnZlcnQgY29kZSBwb2ludHNcbiAgICAgIC8vIHRvIEphdmFTY3JpcHQgc3Vycm9nYXRlcyBhbmQgdmljZSB2ZXJzYVxuICAgICAgY29udmVydDoge1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHaXZlbiBhbiBIRVggY29kZXBvaW50LCByZXR1cm5zIFVURjE2IHN1cnJvZ2F0ZSBwYWlycy5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtICAgc3RyaW5nICBnZW5lcmljIGNvZGVwb2ludCwgaS5lLiAnMUY0QTknXG4gICAgICAgICAqIEByZXR1cm4gIHN0cmluZyAgY29kZXBvaW50IHRyYW5zZm9ybWVkIGludG8gdXRmMTYgc3Vycm9nYXRlcyBwYWlyLFxuICAgICAgICAgKiAgICAgICAgICBpLmUuIFxcdUQ4M0RcXHVEQ0E5XG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqICB0d2Vtb2ppLmNvbnZlcnQuZnJvbUNvZGVQb2ludCgnMWYxZTgnKTtcbiAgICAgICAgICogIC8vIFwiXFx1ZDgzY1xcdWRkZThcIlxuICAgICAgICAgKlxuICAgICAgICAgKiAgJzFmMWU4LTFmMWYzJy5zcGxpdCgnLScpLm1hcCh0d2Vtb2ppLmNvbnZlcnQuZnJvbUNvZGVQb2ludCkuam9pbignJylcbiAgICAgICAgICogIC8vIFwiXFx1ZDgzY1xcdWRkZThcXHVkODNjXFx1ZGRmM1wiXG4gICAgICAgICAqL1xuICAgICAgICBmcm9tQ29kZVBvaW50OiBmcm9tQ29kZVBvaW50LFxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBHaXZlbiBVVEYxNiBzdXJyb2dhdGUgcGFpcnMsIHJldHVybnMgdGhlIGVxdWl2YWxlbnQgSEVYIGNvZGVwb2ludC5cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtICAgc3RyaW5nICBnZW5lcmljIHV0ZjE2IHN1cnJvZ2F0ZXMgcGFpciwgaS5lLiBcXHVEODNEXFx1RENBOVxuICAgICAgICAgKiBAcGFyYW0gICBzdHJpbmcgIG9wdGlvbmFsIHNlcGFyYXRvciBmb3IgZG91YmxlIGNvZGUgcG9pbnRzLCBkZWZhdWx0PSctJ1xuICAgICAgICAgKiBAcmV0dXJuICBzdHJpbmcgIHV0ZjE2IHRyYW5zZm9ybWVkIGludG8gY29kZXBvaW50LCBpLmUuICcxRjRBOSdcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogIHR3ZW1vamkuY29udmVydC50b0NvZGVQb2ludCgnXFx1ZDgzY1xcdWRkZThcXHVkODNjXFx1ZGRmMycpO1xuICAgICAgICAgKiAgLy8gXCIxZjFlOC0xZjFmM1wiXG4gICAgICAgICAqXG4gICAgICAgICAqICB0d2Vtb2ppLmNvbnZlcnQudG9Db2RlUG9pbnQoJ1xcdWQ4M2NcXHVkZGU4XFx1ZDgzY1xcdWRkZjMnLCAnficpO1xuICAgICAgICAgKiAgLy8gXCIxZjFlOH4xZjFmM1wiXG4gICAgICAgICAqL1xuICAgICAgICB0b0NvZGVQb2ludDogdG9Db2RlUG9pbnRcbiAgICAgIH0sXG5cblxuICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgICAvLyAgICAgICBtZXRob2RzICAgICAgIC8vXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4gICAgICAvKipcbiAgICAgICAqIFVzZXIgZmlyc3Q6IHVzZWQgdG8gcmVtb3ZlIG1pc3NpbmcgaW1hZ2VzXG4gICAgICAgKiBwcmVzZXJ2aW5nIHRoZSBvcmlnaW5hbCB0ZXh0IGludGVudCB3aGVuXG4gICAgICAgKiBhIGZhbGxiYWNrIGZvciBuZXR3b3JrIHByb2JsZW1zIGlzIGRlc2lyZWQuXG4gICAgICAgKiBBdXRvbWF0aWNhbGx5IGFkZGVkIHRvIEltYWdlIG5vZGVzIHZpYSBET01cbiAgICAgICAqIEl0IGNvdWxkIGJlIHJlY3ljbGVkIGZvciBzdHJpbmcgb3BlcmF0aW9ucyB2aWE6XG4gICAgICAgKiAgJCgnaW1nLmVtb2ppJykub24oJ2Vycm9yJywgdHdlbW9qaS5vbmVycm9yKVxuICAgICAgICovXG4gICAgICBvbmVycm9yOiBmdW5jdGlvbiBvbmVycm9yKCkge1xuICAgICAgICBpZiAodGhpcy5wYXJlbnROb2RlKSB7XG4gICAgICAgICAgdGhpcy5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChjcmVhdGVUZXh0KHRoaXMuYWx0LCBmYWxzZSksIHRoaXMpO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvKipcbiAgICAgICAqIE1haW4gbWV0aG9kL2xvZ2ljIHRvIGdlbmVyYXRlIGVpdGhlciA8aW1nPiB0YWdzIG9yIEhUTUxJbWFnZSBub2Rlcy5cbiAgICAgICAqICBcImVtb2ppZnlcIiBhIGdlbmVyaWMgdGV4dCBvciBET00gRWxlbWVudC5cbiAgICAgICAqXG4gICAgICAgKiBAb3ZlcmxvYWRzXG4gICAgICAgKlxuICAgICAgICogU3RyaW5nIHJlcGxhY2VtZW50IGZvciBgaW5uZXJIVE1MYCBvciBzZXJ2ZXIgc2lkZSBvcGVyYXRpb25zXG4gICAgICAgKiAgdHdlbW9qaS5wYXJzZShzdHJpbmcpO1xuICAgICAgICogIHR3ZW1vamkucGFyc2Uoc3RyaW5nLCBGdW5jdGlvbik7XG4gICAgICAgKiAgdHdlbW9qaS5wYXJzZShzdHJpbmcsIE9iamVjdCk7XG4gICAgICAgKlxuICAgICAgICogSFRNTEVsZW1lbnQgdHJlZSBwYXJzaW5nIGZvciBzYWZlciBvcGVyYXRpb25zIG92ZXIgZXhpc3RpbmcgRE9NXG4gICAgICAgKiAgdHdlbW9qaS5wYXJzZShIVE1MRWxlbWVudCk7XG4gICAgICAgKiAgdHdlbW9qaS5wYXJzZShIVE1MRWxlbWVudCwgRnVuY3Rpb24pO1xuICAgICAgICogIHR3ZW1vamkucGFyc2UoSFRNTEVsZW1lbnQsIE9iamVjdCk7XG4gICAgICAgKlxuICAgICAgICogQHBhcmFtICAgc3RyaW5nfEhUTUxFbGVtZW50ICB0aGUgc291cmNlIHRvIHBhcnNlIGFuZCBlbnJpY2ggd2l0aCBlbW9qaS5cbiAgICAgICAqXG4gICAgICAgKiAgICAgICAgICBzdHJpbmcgICAgICAgICAgICAgIHJlcGxhY2UgZW1vamkgbWF0Y2hlcyB3aXRoIDxpbWc+IHRhZ3MuXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE1haW5seSB1c2VkIHRvIGluamVjdCBlbW9qaSB2aWEgYGlubmVySFRNTGBcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSXQgZG9lcyAqKm5vdCoqIHBhcnNlIHRoZSBzdHJpbmcgb3IgdmFsaWRhdGUgaXQsXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGl0IHNpbXBseSByZXBsYWNlcyBmb3VuZCBlbW9qaSB3aXRoIGEgdGFnLlxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBOT1RFOiBiZSBzdXJlIHRoaXMgd29uJ3QgYWZmZWN0IHNlY3VyaXR5LlxuICAgICAgICpcbiAgICAgICAqICAgICAgICAgIEhUTUxFbGVtZW50ICAgICAgICAgd2FsayB0aHJvdWdoIHRoZSBET00gdHJlZSBhbmQgZmluZCBlbW9qaVxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0IGFyZSBpbnNpZGUgKip0ZXh0IG5vZGUgb25seSoqIChub2RlVHlwZSA9PT0gMylcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWFpbmx5IHVzZWQgdG8gcHV0IGVtb2ppIGluIGFscmVhZHkgZ2VuZXJhdGVkIERPTVxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aXRob3V0IGNvbXByb21pc2luZyBzdXJyb3VuZGluZyBub2RlcyBhbmRcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKiphdm9pZGluZyoqIHRoZSB1c2FnZSBvZiBgaW5uZXJIVE1MYC5cbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTk9URTogVXNpbmcgRE9NIGVsZW1lbnRzIGluc3RlYWQgb2Ygc3RyaW5ncyBzaG91bGRcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW1wcm92ZSBzZWN1cml0eSB3aXRob3V0IGNvbXByb21pc2luZyB0b28gbXVjaFxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBwZXJmb3JtYW5jZSBjb21wYXJlZCB3aXRoIGEgbGVzcyBzYWZlIGBpbm5lckhUTUxgLlxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSAgIEZ1bmN0aW9ufE9iamVjdCAgW29wdGlvbmFsXVxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlaXRoZXIgdGhlIGNhbGxiYWNrIHRoYXQgd2lsbCBiZSBpbnZva2VkIG9yIGFuIG9iamVjdFxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aXRoIGFsbCBwcm9wZXJ0aWVzIHRvIHVzZSBwZXIgZWFjaCBmb3VuZCBlbW9qaS5cbiAgICAgICAqXG4gICAgICAgKiAgICAgICAgICBGdW5jdGlvbiAgICAgICAgICAgIGlmIHNwZWNpZmllZCwgdGhpcyB3aWxsIGJlIGludm9rZWQgcGVyIGVhY2ggZW1vamlcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdCBoYXMgYmVlbiBmb3VuZCB0aHJvdWdoIHRoZSBSZWdFeHAgZXhjZXB0XG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRob3NlIGZvbGx3ZWQgYnkgdGhlIGludmFyaWFudCBcXHVGRTBFIChcImFzIHRleHRcIikuXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE9uY2UgaW52b2tlZCwgcGFyYW1ldGVycyB3aWxsIGJlOlxuICAgICAgICpcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpY29uSWQ6c3RyaW5nICAgICB0aGUgbG93ZXIgY2FzZSBIRVggY29kZSBwb2ludFxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGkuZS4gXCIxZjRhOVwiXG4gICAgICAgKlxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbnM6T2JqZWN0ICAgIGFsbCBpbmZvIGZvciB0aGlzIHBhcnNpbmcgb3BlcmF0aW9uXG4gICAgICAgKlxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnQ6Y2hhciAgICAgIHRoZSBvcHRpb25hbCBcXHVGRTBGIChcImFzIGltYWdlXCIpXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudCwgaW4gY2FzZSB0aGlzIGluZm9cbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpcyBhbnlob3cgbWVhbmluZ2Z1bC5cbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBCeSBkZWZhdWx0IHRoaXMgaXMgaWdub3JlZC5cbiAgICAgICAqXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIElmIHN1Y2ggY2FsbGJhY2sgd2lsbCByZXR1cm4gYSBmYWxzeSB2YWx1ZSBpbnN0ZWFkXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9mIGEgdmFsaWQgYHNyY2AgdG8gdXNlIGZvciB0aGUgaW1hZ2UsIG5vdGhpbmcgd2lsbFxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBhY3R1YWxseSBjaGFuZ2UgZm9yIHRoYXQgc3BlY2lmaWMgZW1vamkuXG4gICAgICAgKlxuICAgICAgICpcbiAgICAgICAqICAgICAgICAgIE9iamVjdCAgICAgICAgICAgICAgaWYgc3BlY2lmaWVkLCBhbiBvYmplY3QgY29udGFpbmluZyB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXNcbiAgICAgICAqXG4gICAgICAgKiAgICAgICAgICAgIGNhbGxiYWNrICAgRnVuY3Rpb24gIHRoZSBjYWxsYmFjayB0byBpbnZva2UgcGVyIGVhY2ggZm91bmQgZW1vamkuXG4gICAgICAgKiAgICAgICAgICAgIGJhc2UgICAgICAgc3RyaW5nICAgIHRoZSBiYXNlIHVybCwgYnkgZGVmYXVsdCB0d2Vtb2ppLmJhc2VcbiAgICAgICAqICAgICAgICAgICAgZXh0ICAgICAgICBzdHJpbmcgICAgdGhlIGltYWdlIGV4dGVuc2lvbiwgYnkgZGVmYXVsdCB0d2Vtb2ppLmV4dFxuICAgICAgICogICAgICAgICAgICBzaXplICAgICAgIHN0cmluZyAgICB0aGUgYXNzZXRzIHNpemUsIGJ5IGRlZmF1bHQgdHdlbW9qaS5zaXplXG4gICAgICAgKlxuICAgICAgICogQGV4YW1wbGVcbiAgICAgICAqXG4gICAgICAgKiAgdHdlbW9qaS5wYXJzZShcIkkgXFx1Mjc2NFxcdUZFMEYgZW1vamkhXCIpO1xuICAgICAgICogIC8vIEkgPGltZyBjbGFzcz1cImVtb2ppXCIgZHJhZ2dhYmxlPVwiZmFsc2VcIiBhbHQ9XCLinaTvuI9cIiBzcmM9XCIvYXNzZXRzLzI3NjQuZ2lmXCIvPiBlbW9qaSFcbiAgICAgICAqXG4gICAgICAgKlxuICAgICAgICogIHR3ZW1vamkucGFyc2UoXCJJIFxcdTI3NjRcXHVGRTBGIGVtb2ppIVwiLCBmdW5jdGlvbihpY29uSWQsIG9wdGlvbnMpIHtcbiAgICAgICAqICAgIHJldHVybiAnL2Fzc2V0cy8nICsgaWNvbklkICsgJy5naWYnO1xuICAgICAgICogIH0pO1xuICAgICAgICogIC8vIEkgPGltZyBjbGFzcz1cImVtb2ppXCIgZHJhZ2dhYmxlPVwiZmFsc2VcIiBhbHQ9XCLinaTvuI9cIiBzcmM9XCIvYXNzZXRzLzI3NjQuZ2lmXCIvPiBlbW9qaSFcbiAgICAgICAqXG4gICAgICAgKlxuICAgICAgICogdHdlbW9qaS5wYXJzZShcIkkgXFx1Mjc2NFxcdUZFMEYgZW1vamkhXCIsIHtcbiAgICAgICAqICAgc2l6ZTogNzIsXG4gICAgICAgKiAgIGNhbGxiYWNrOiBmdW5jdGlvbihpY29uSWQsIG9wdGlvbnMpIHtcbiAgICAgICAqICAgICByZXR1cm4gJy9hc3NldHMvJyArIG9wdGlvbnMuc2l6ZSArICcvJyArIGljb25JZCArIG9wdGlvbnMuZXh0O1xuICAgICAgICogICB9XG4gICAgICAgKiB9KTtcbiAgICAgICAqICAvLyBJIDxpbWcgY2xhc3M9XCJlbW9qaVwiIGRyYWdnYWJsZT1cImZhbHNlXCIgYWx0PVwi4p2k77iPXCIgc3JjPVwiL2Fzc2V0cy83Mng3Mi8yNzY0LnBuZ1wiLz4gZW1vamkhXG4gICAgICAgKlxuICAgICAgICovXG4gICAgICBwYXJzZTogcGFyc2UsXG5cbiAgICAgIC8qKlxuICAgICAgICogR2l2ZW4gYSBzdHJpbmcsIGludm9rZXMgdGhlIGNhbGxiYWNrIGFyZ3VtZW50XG4gICAgICAgKiAgcGVyIGVhY2ggZW1vamkgZm91bmQgaW4gc3VjaCBzdHJpbmcuXG4gICAgICAgKiBUaGlzIGlzIHRoZSBtb3N0IHJhdyB2ZXJzaW9uIHVzZWQgYnlcbiAgICAgICAqICB0aGUgLnBhcnNlKHN0cmluZykgbWV0aG9kIGl0c2VsZi5cbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0gICBzdHJpbmcgICAgZ2VuZXJpYyBzdHJpbmcgdG8gcGFyc2VcbiAgICAgICAqIEBwYXJhbSAgIEZ1bmN0aW9uICBhIGdlbmVyaWMgY2FsbGJhY2sgdGhhdCB3aWxsIGJlXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgaW52b2tlZCB0byByZXBsYWNlIHRoZSBjb250ZW50LlxuICAgICAgICogICAgICAgICAgICAgICAgICAgIFRoaXMgY2FsYmFjayB3aWwgcmVjZWl2ZSBzdGFuZGFyZFxuICAgICAgICogICAgICAgICAgICAgICAgICAgIFN0cmluZy5wcm90b3R5cGUucmVwbGFjZShzdHIsIGNhbGxiYWNrKVxuICAgICAgICogICAgICAgICAgICAgICAgICAgIGFyZ3VtZW50cyBzdWNoOlxuICAgICAgICogIGNhbGxiYWNrKFxuICAgICAgICogICAgcmF3VGV4dCwgIC8vIHRoZSBlbW9qaSBtYXRjaFxuICAgICAgICogICk7XG4gICAgICAgKlxuICAgICAgICogICAgICAgICAgICAgICAgICAgIGFuZCBvdGhlcnMgY29tbW9ubHkgcmVjZWl2ZWQgdmlhIHJlcGxhY2UuXG4gICAgICAgKi9cbiAgICAgIHJlcGxhY2U6IHJlcGxhY2UsXG5cbiAgICAgIC8qKlxuICAgICAgICogU2ltcGxpZnkgc3RyaW5nIHRlc3RzIGFnYWluc3QgZW1vamkuXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtICAgc3RyaW5nICBzb21lIHRleHQgdGhhdCBtaWdodCBjb250YWluIGVtb2ppXG4gICAgICAgKiBAcmV0dXJuICBib29sZWFuIHRydWUgaWYgYW55IGVtb2ppIHdhcyBmb3VuZCwgZmFsc2Ugb3RoZXJ3aXNlLlxuICAgICAgICpcbiAgICAgICAqIEBleGFtcGxlXG4gICAgICAgKlxuICAgICAgICogIGlmICh0d2Vtb2ppLnRlc3Qoc29tZUNvbnRlbnQpKSB7XG4gICAgICAgKiAgICBjb25zb2xlLmxvZyhcImVtb2ppIEFsbCBUaGUgVGhpbmdzIVwiKTtcbiAgICAgICAqICB9XG4gICAgICAgKi9cbiAgICAgIHRlc3Q6IHRlc3RcbiAgICB9LFxuXG4gICAgLy8gdXNlZCB0byBlc2NhcGUgSFRNTCBzcGVjaWFsIGNoYXJzIGluIGF0dHJpYnV0ZXNcbiAgICBlc2NhcGVyID0ge1xuICAgICAgJyYnOiAnJmFtcDsnLFxuICAgICAgJzwnOiAnJmx0OycsXG4gICAgICAnPic6ICcmZ3Q7JyxcbiAgICAgIFwiJ1wiOiAnJiMzOTsnLFxuICAgICAgJ1wiJzogJyZxdW90OydcbiAgICB9LFxuXG4gICAgLy8gUmVnRXhwIGJhc2VkIG9uIGVtb2ppJ3Mgb2ZmaWNpYWwgVW5pY29kZSBzdGFuZGFyZHNcbiAgICAvLyBodHRwOi8vd3d3LnVuaWNvZGUub3JnL1B1YmxpYy9VTklEQVRBL0Vtb2ppU291cmNlcy50eHRcbiAgICByZSA9IC9cXHVkODNkW1xcdWRjNjgtXFx1ZGM2OV0oPzpcXHVkODNjW1xcdWRmZmItXFx1ZGZmZl0pP1xcdTIwMGQoPzpcXHUyNjk1XFx1ZmUwZnxcXHUyNjk2XFx1ZmUwZnxcXHUyNzA4XFx1ZmUwZnxcXHVkODNjW1xcdWRmM2VcXHVkZjczXFx1ZGY5M1xcdWRmYTRcXHVkZmE4XFx1ZGZlYlxcdWRmZWRdfFxcdWQ4M2RbXFx1ZGNiYlxcdWRjYmNcXHVkZDI3XFx1ZGQyY1xcdWRlODBcXHVkZTkyXSl8KD86XFx1ZDgzY1tcXHVkZmNiXFx1ZGZjY118XFx1ZDgzZFxcdWRkNzV8XFx1MjZmOSkoPzpcXHVmZTBmfFxcdWQ4M2NbXFx1ZGZmYi1cXHVkZmZmXSlcXHUyMDBkW1xcdTI2NDBcXHUyNjQyXVxcdWZlMGZ8KD86XFx1ZDgzY1tcXHVkZmMzXFx1ZGZjNFxcdWRmY2FdfFxcdWQ4M2RbXFx1ZGM2ZVxcdWRjNzFcXHVkYzczXFx1ZGM3N1xcdWRjODFcXHVkYzgyXFx1ZGM4NlxcdWRjODdcXHVkZTQ1LVxcdWRlNDdcXHVkZTRiXFx1ZGU0ZFxcdWRlNGVcXHVkZWEzXFx1ZGViNC1cXHVkZWI2XXxcXHVkODNlW1xcdWRkMjZcXHVkZDM3LVxcdWRkMzlcXHVkZDNkXFx1ZGQzZVxcdWRkZDYtXFx1ZGRkZF0pKD86XFx1ZDgzY1tcXHVkZmZiLVxcdWRmZmZdKT9cXHUyMDBkW1xcdTI2NDBcXHUyNjQyXVxcdWZlMGZ8XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1Mjc2NFxcdWZlMGZcXHUyMDBkXFx1ZDgzZFxcdWRjOGJcXHUyMDBkXFx1ZDgzZFxcdWRjNjh8XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjZcXHUyMDBkXFx1ZDgzZFxcdWRjNjZ8XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjdcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjZcXHUyMDBkXFx1ZDgzZFxcdWRjNjZ8XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjdcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1Mjc2NFxcdWZlMGZcXHUyMDBkXFx1ZDgzZFxcdWRjOGJcXHUyMDBkXFx1ZDgzZFtcXHVkYzY4XFx1ZGM2OV18XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjZcXHUyMDBkXFx1ZDgzZFxcdWRjNjZ8XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjdcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1Mjc2NFxcdWZlMGZcXHUyMDBkXFx1ZDgzZFxcdWRjNjh8XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjZcXHUyMDBkXFx1ZDgzZFxcdWRjNjZ8XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjdcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1Mjc2NFxcdWZlMGZcXHUyMDBkXFx1ZDgzZFtcXHVkYzY4XFx1ZGM2OV18XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjZcXHUyMDBkXFx1ZDgzZFxcdWRjNjZ8XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjdcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzY1xcdWRmZjNcXHVmZTBmXFx1MjAwZFxcdWQ4M2NcXHVkZjA4fFxcdWQ4M2NcXHVkZmY0XFx1MjAwZFxcdTI2MjBcXHVmZTBmfFxcdWQ4M2RcXHVkYzQxXFx1MjAwZFxcdWQ4M2RcXHVkZGU4fFxcdWQ4M2RcXHVkYzY4XFx1MjAwZFxcdWQ4M2RbXFx1ZGM2NlxcdWRjNjddfFxcdWQ4M2RcXHVkYzY5XFx1MjAwZFxcdWQ4M2RbXFx1ZGM2NlxcdWRjNjddfFxcdWQ4M2RcXHVkYzZmXFx1MjAwZFxcdTI2NDBcXHVmZTBmfFxcdWQ4M2RcXHVkYzZmXFx1MjAwZFxcdTI2NDJcXHVmZTBmfFxcdWQ4M2VcXHVkZDNjXFx1MjAwZFxcdTI2NDBcXHVmZTBmfFxcdWQ4M2VcXHVkZDNjXFx1MjAwZFxcdTI2NDJcXHVmZTBmfFxcdWQ4M2VcXHVkZGRlXFx1MjAwZFxcdTI2NDBcXHVmZTBmfFxcdWQ4M2VcXHVkZGRlXFx1MjAwZFxcdTI2NDJcXHVmZTBmfFxcdWQ4M2VcXHVkZGRmXFx1MjAwZFxcdTI2NDBcXHVmZTBmfFxcdWQ4M2VcXHVkZGRmXFx1MjAwZFxcdTI2NDJcXHVmZTBmfCg/OltcXHUwMDIzXFx1MDAyYVxcdTAwMzAtXFx1MDAzOV0pXFx1ZmUwZj9cXHUyMGUzfCg/Oig/OlxcdWQ4M2NbXFx1ZGZjYlxcdWRmY2NdfFxcdWQ4M2RbXFx1ZGQ3NFxcdWRkNzVcXHVkZDkwXXxbXFx1MjYxZFxcdTI2ZjdcXHUyNmY5XFx1MjcwY1xcdTI3MGRdKSg/OlxcdWZlMGZ8KD8hXFx1ZmUwZSkpfFxcdWQ4M2NbXFx1ZGY4NVxcdWRmYzItXFx1ZGZjNFxcdWRmYzdcXHVkZmNhXXxcXHVkODNkW1xcdWRjNDJcXHVkYzQzXFx1ZGM0Ni1cXHVkYzUwXFx1ZGM2Ni1cXHVkYzY5XFx1ZGM2ZVxcdWRjNzAtXFx1ZGM3OFxcdWRjN2NcXHVkYzgxLVxcdWRjODNcXHVkYzg1LVxcdWRjODdcXHVkY2FhXFx1ZGQ3YVxcdWRkOTVcXHVkZDk2XFx1ZGU0NS1cXHVkZTQ3XFx1ZGU0Yi1cXHVkZTRmXFx1ZGVhM1xcdWRlYjQtXFx1ZGViNlxcdWRlYzBcXHVkZWNjXXxcXHVkODNlW1xcdWRkMTgtXFx1ZGQxY1xcdWRkMWVcXHVkZDFmXFx1ZGQyNlxcdWRkMzAtXFx1ZGQzOVxcdWRkM2RcXHVkZDNlXFx1ZGRkMS1cXHVkZGRkXXxbXFx1MjcwYVxcdTI3MGJdKSg/OlxcdWQ4M2NbXFx1ZGZmYi1cXHVkZmZmXXwpfFxcdWQ4M2NcXHVkZmY0XFx1ZGI0MFxcdWRjNjdcXHVkYjQwXFx1ZGM2MlxcdWRiNDBcXHVkYzY1XFx1ZGI0MFxcdWRjNmVcXHVkYjQwXFx1ZGM2N1xcdWRiNDBcXHVkYzdmfFxcdWQ4M2NcXHVkZmY0XFx1ZGI0MFxcdWRjNjdcXHVkYjQwXFx1ZGM2MlxcdWRiNDBcXHVkYzczXFx1ZGI0MFxcdWRjNjNcXHVkYjQwXFx1ZGM3NFxcdWRiNDBcXHVkYzdmfFxcdWQ4M2NcXHVkZmY0XFx1ZGI0MFxcdWRjNjdcXHVkYjQwXFx1ZGM2MlxcdWRiNDBcXHVkYzc3XFx1ZGI0MFxcdWRjNmNcXHVkYjQwXFx1ZGM3M1xcdWRiNDBcXHVkYzdmfFxcdWQ4M2NcXHVkZGU2XFx1ZDgzY1tcXHVkZGU4LVxcdWRkZWNcXHVkZGVlXFx1ZGRmMVxcdWRkZjJcXHVkZGY0XFx1ZGRmNi1cXHVkZGZhXFx1ZGRmY1xcdWRkZmRcXHVkZGZmXXxcXHVkODNjXFx1ZGRlN1xcdWQ4M2NbXFx1ZGRlNlxcdWRkZTdcXHVkZGU5LVxcdWRkZWZcXHVkZGYxLVxcdWRkZjRcXHVkZGY2LVxcdWRkZjlcXHVkZGZiXFx1ZGRmY1xcdWRkZmVcXHVkZGZmXXxcXHVkODNjXFx1ZGRlOFxcdWQ4M2NbXFx1ZGRlNlxcdWRkZThcXHVkZGU5XFx1ZGRlYi1cXHVkZGVlXFx1ZGRmMC1cXHVkZGY1XFx1ZGRmN1xcdWRkZmEtXFx1ZGRmZl18XFx1ZDgzY1xcdWRkZTlcXHVkODNjW1xcdWRkZWFcXHVkZGVjXFx1ZGRlZlxcdWRkZjBcXHVkZGYyXFx1ZGRmNFxcdWRkZmZdfFxcdWQ4M2NcXHVkZGVhXFx1ZDgzY1tcXHVkZGU2XFx1ZGRlOFxcdWRkZWFcXHVkZGVjXFx1ZGRlZFxcdWRkZjctXFx1ZGRmYV18XFx1ZDgzY1xcdWRkZWJcXHVkODNjW1xcdWRkZWUtXFx1ZGRmMFxcdWRkZjJcXHVkZGY0XFx1ZGRmN118XFx1ZDgzY1xcdWRkZWNcXHVkODNjW1xcdWRkZTZcXHVkZGU3XFx1ZGRlOS1cXHVkZGVlXFx1ZGRmMS1cXHVkZGYzXFx1ZGRmNS1cXHVkZGZhXFx1ZGRmY1xcdWRkZmVdfFxcdWQ4M2NcXHVkZGVkXFx1ZDgzY1tcXHVkZGYwXFx1ZGRmMlxcdWRkZjNcXHVkZGY3XFx1ZGRmOVxcdWRkZmFdfFxcdWQ4M2NcXHVkZGVlXFx1ZDgzY1tcXHVkZGU4LVxcdWRkZWFcXHVkZGYxLVxcdWRkZjRcXHVkZGY2LVxcdWRkZjldfFxcdWQ4M2NcXHVkZGVmXFx1ZDgzY1tcXHVkZGVhXFx1ZGRmMlxcdWRkZjRcXHVkZGY1XXxcXHVkODNjXFx1ZGRmMFxcdWQ4M2NbXFx1ZGRlYVxcdWRkZWMtXFx1ZGRlZVxcdWRkZjJcXHVkZGYzXFx1ZGRmNVxcdWRkZjdcXHVkZGZjXFx1ZGRmZVxcdWRkZmZdfFxcdWQ4M2NcXHVkZGYxXFx1ZDgzY1tcXHVkZGU2LVxcdWRkZThcXHVkZGVlXFx1ZGRmMFxcdWRkZjctXFx1ZGRmYlxcdWRkZmVdfFxcdWQ4M2NcXHVkZGYyXFx1ZDgzY1tcXHVkZGU2XFx1ZGRlOC1cXHVkZGVkXFx1ZGRmMC1cXHVkZGZmXXxcXHVkODNjXFx1ZGRmM1xcdWQ4M2NbXFx1ZGRlNlxcdWRkZThcXHVkZGVhLVxcdWRkZWNcXHVkZGVlXFx1ZGRmMVxcdWRkZjRcXHVkZGY1XFx1ZGRmN1xcdWRkZmFcXHVkZGZmXXxcXHVkODNjXFx1ZGRmNFxcdWQ4M2NcXHVkZGYyfFxcdWQ4M2NcXHVkZGY1XFx1ZDgzY1tcXHVkZGU2XFx1ZGRlYS1cXHVkZGVkXFx1ZGRmMC1cXHVkZGYzXFx1ZGRmNy1cXHVkZGY5XFx1ZGRmY1xcdWRkZmVdfFxcdWQ4M2NcXHVkZGY2XFx1ZDgzY1xcdWRkZTZ8XFx1ZDgzY1xcdWRkZjdcXHVkODNjW1xcdWRkZWFcXHVkZGY0XFx1ZGRmOFxcdWRkZmFcXHVkZGZjXXxcXHVkODNjXFx1ZGRmOFxcdWQ4M2NbXFx1ZGRlNi1cXHVkZGVhXFx1ZGRlYy1cXHVkZGY0XFx1ZGRmNy1cXHVkZGY5XFx1ZGRmYlxcdWRkZmQtXFx1ZGRmZl18XFx1ZDgzY1xcdWRkZjlcXHVkODNjW1xcdWRkZTZcXHVkZGU4XFx1ZGRlOVxcdWRkZWItXFx1ZGRlZFxcdWRkZWYtXFx1ZGRmNFxcdWRkZjdcXHVkZGY5XFx1ZGRmYlxcdWRkZmNcXHVkZGZmXXxcXHVkODNjXFx1ZGRmYVxcdWQ4M2NbXFx1ZGRlNlxcdWRkZWNcXHVkZGYyXFx1ZGRmM1xcdWRkZjhcXHVkZGZlXFx1ZGRmZl18XFx1ZDgzY1xcdWRkZmJcXHVkODNjW1xcdWRkZTZcXHVkZGU4XFx1ZGRlYVxcdWRkZWNcXHVkZGVlXFx1ZGRmM1xcdWRkZmFdfFxcdWQ4M2NcXHVkZGZjXFx1ZDgzY1tcXHVkZGViXFx1ZGRmOF18XFx1ZDgzY1xcdWRkZmRcXHVkODNjXFx1ZGRmMHxcXHVkODNjXFx1ZGRmZVxcdWQ4M2NbXFx1ZGRlYVxcdWRkZjldfFxcdWQ4M2NcXHVkZGZmXFx1ZDgzY1tcXHVkZGU2XFx1ZGRmMlxcdWRkZmNdfFxcdWQ4MDBcXHVkYzAwfFxcdWQ4M2NbXFx1ZGNjZlxcdWRkOGVcXHVkZDkxLVxcdWRkOWFcXHVkZGU2LVxcdWRkZmZcXHVkZTAxXFx1ZGUzMi1cXHVkZTM2XFx1ZGUzOC1cXHVkZTNhXFx1ZGU1MFxcdWRlNTFcXHVkZjAwLVxcdWRmMjBcXHVkZjJkLVxcdWRmMzVcXHVkZjM3LVxcdWRmN2NcXHVkZjdlLVxcdWRmODRcXHVkZjg2LVxcdWRmOTNcXHVkZmEwLVxcdWRmYzFcXHVkZmM1XFx1ZGZjNlxcdWRmYzhcXHVkZmM5XFx1ZGZjZi1cXHVkZmQzXFx1ZGZlMC1cXHVkZmYwXFx1ZGZmNFxcdWRmZjgtXFx1ZGZmZl18XFx1ZDgzZFtcXHVkYzAwLVxcdWRjM2VcXHVkYzQwXFx1ZGM0NFxcdWRjNDVcXHVkYzUxLVxcdWRjNjVcXHVkYzZhLVxcdWRjNmRcXHVkYzZmXFx1ZGM3OS1cXHVkYzdiXFx1ZGM3ZC1cXHVkYzgwXFx1ZGM4NFxcdWRjODgtXFx1ZGNhOVxcdWRjYWItXFx1ZGNmY1xcdWRjZmYtXFx1ZGQzZFxcdWRkNGItXFx1ZGQ0ZVxcdWRkNTAtXFx1ZGQ2N1xcdWRkYTRcXHVkZGZiLVxcdWRlNDRcXHVkZTQ4LVxcdWRlNGFcXHVkZTgwLVxcdWRlYTJcXHVkZWE0LVxcdWRlYjNcXHVkZWI3LVxcdWRlYmZcXHVkZWMxLVxcdWRlYzVcXHVkZWQwLVxcdWRlZDJcXHVkZWViXFx1ZGVlY1xcdWRlZjQtXFx1ZGVmOF18XFx1ZDgzZVtcXHVkZDEwLVxcdWRkMTdcXHVkZDFkXFx1ZGQyMC1cXHVkZDI1XFx1ZGQyNy1cXHVkZDJmXFx1ZGQzYVxcdWRkM2NcXHVkZDQwLVxcdWRkNDVcXHVkZDQ3LVxcdWRkNGNcXHVkZDUwLVxcdWRkNmJcXHVkZDgwLVxcdWRkOTdcXHVkZGMwXFx1ZGRkMFxcdWRkZGUtXFx1ZGRlNl18W1xcdTIzZTktXFx1MjNlY1xcdTIzZjBcXHUyM2YzXFx1MjY0MFxcdTI2NDJcXHUyNjk1XFx1MjZjZVxcdTI3MDVcXHUyNzI4XFx1Mjc0Y1xcdTI3NGVcXHUyNzUzLVxcdTI3NTVcXHUyNzk1LVxcdTI3OTdcXHUyN2IwXFx1MjdiZlxcdWU1MGFdfCg/OlxcdWQ4M2NbXFx1ZGMwNFxcdWRkNzBcXHVkZDcxXFx1ZGQ3ZVxcdWRkN2ZcXHVkZTAyXFx1ZGUxYVxcdWRlMmZcXHVkZTM3XFx1ZGYyMVxcdWRmMjQtXFx1ZGYyY1xcdWRmMzZcXHVkZjdkXFx1ZGY5NlxcdWRmOTdcXHVkZjk5LVxcdWRmOWJcXHVkZjllXFx1ZGY5ZlxcdWRmY2RcXHVkZmNlXFx1ZGZkNC1cXHVkZmRmXFx1ZGZmM1xcdWRmZjVcXHVkZmY3XXxcXHVkODNkW1xcdWRjM2ZcXHVkYzQxXFx1ZGNmZFxcdWRkNDlcXHVkZDRhXFx1ZGQ2ZlxcdWRkNzBcXHVkZDczXFx1ZGQ3Ni1cXHVkZDc5XFx1ZGQ4N1xcdWRkOGEtXFx1ZGQ4ZFxcdWRkYTVcXHVkZGE4XFx1ZGRiMVxcdWRkYjJcXHVkZGJjXFx1ZGRjMi1cXHVkZGM0XFx1ZGRkMS1cXHVkZGQzXFx1ZGRkYy1cXHVkZGRlXFx1ZGRlMVxcdWRkZTNcXHVkZGU4XFx1ZGRlZlxcdWRkZjNcXHVkZGZhXFx1ZGVjYlxcdWRlY2QtXFx1ZGVjZlxcdWRlZTAtXFx1ZGVlNVxcdWRlZTlcXHVkZWYwXFx1ZGVmM118W1xcdTAwYTlcXHUwMGFlXFx1MjAzY1xcdTIwNDlcXHUyMTIyXFx1MjEzOVxcdTIxOTQtXFx1MjE5OVxcdTIxYTlcXHUyMWFhXFx1MjMxYVxcdTIzMWJcXHUyMzI4XFx1MjNjZlxcdTIzZWQtXFx1MjNlZlxcdTIzZjFcXHUyM2YyXFx1MjNmOC1cXHUyM2ZhXFx1MjRjMlxcdTI1YWFcXHUyNWFiXFx1MjViNlxcdTI1YzBcXHUyNWZiLVxcdTI1ZmVcXHUyNjAwLVxcdTI2MDRcXHUyNjBlXFx1MjYxMVxcdTI2MTRcXHUyNjE1XFx1MjYxOFxcdTI2MjBcXHUyNjIyXFx1MjYyM1xcdTI2MjZcXHUyNjJhXFx1MjYyZVxcdTI2MmZcXHUyNjM4LVxcdTI2M2FcXHUyNjQ4LVxcdTI2NTNcXHUyNjYwXFx1MjY2M1xcdTI2NjVcXHUyNjY2XFx1MjY2OFxcdTI2N2JcXHUyNjdmXFx1MjY5Mi1cXHUyNjk0XFx1MjY5NlxcdTI2OTdcXHUyNjk5XFx1MjY5YlxcdTI2OWNcXHUyNmEwXFx1MjZhMVxcdTI2YWFcXHUyNmFiXFx1MjZiMFxcdTI2YjFcXHUyNmJkXFx1MjZiZVxcdTI2YzRcXHUyNmM1XFx1MjZjOFxcdTI2Y2ZcXHUyNmQxXFx1MjZkM1xcdTI2ZDRcXHUyNmU5XFx1MjZlYVxcdTI2ZjAtXFx1MjZmNVxcdTI2ZjhcXHUyNmZhXFx1MjZmZFxcdTI3MDJcXHUyNzA4XFx1MjcwOVxcdTI3MGZcXHUyNzEyXFx1MjcxNFxcdTI3MTZcXHUyNzFkXFx1MjcyMVxcdTI3MzNcXHUyNzM0XFx1Mjc0NFxcdTI3NDdcXHUyNzU3XFx1Mjc2M1xcdTI3NjRcXHUyN2ExXFx1MjkzNFxcdTI5MzVcXHUyYjA1LVxcdTJiMDdcXHUyYjFiXFx1MmIxY1xcdTJiNTBcXHUyYjU1XFx1MzAzMFxcdTMwM2RcXHUzMjk3XFx1MzI5OV0pKD86XFx1ZmUwZnwoPyFcXHVmZTBlKSkvZyxcblxuICAgIC8vIGF2b2lkIHJ1bnRpbWUgUmVnRXhwIGNyZWF0aW9uIGZvciBub3Qgc28gc21hcnQsXG4gICAgLy8gbm90IEpJVCBiYXNlZCwgYW5kIG9sZCBicm93c2VycyAvIGVuZ2luZXNcbiAgICBVRkUwRmcgPSAvXFx1RkUwRi9nLFxuXG4gICAgLy8gYXZvaWQgdXNpbmcgYSBzdHJpbmcgbGl0ZXJhbCBsaWtlICdcXHUyMDBEJyBoZXJlIGJlY2F1c2UgbWluaWZpZXJzIGV4cGFuZCBpdCBpbmxpbmVcbiAgICBVMjAwRCA9IFN0cmluZy5mcm9tQ2hhckNvZGUoMHgyMDBEKSxcblxuICAgIC8vIHVzZWQgdG8gZmluZCBIVE1MIHNwZWNpYWwgY2hhcnMgaW4gYXR0cmlidXRlc1xuICAgIHJlc2NhcGVyID0gL1smPD4nXCJdL2csXG5cbiAgICAvLyBub2RlcyB3aXRoIHR5cGUgMSB3aGljaCBzaG91bGQgKipub3QqKiBiZSBwYXJzZWRcbiAgICBzaG91bGRudEJlUGFyc2VkID0gL14oPzppZnJhbWV8bm9mcmFtZXN8bm9zY3JpcHR8c2NyaXB0fHNlbGVjdHxzdHlsZXx0ZXh0YXJlYSkkLyxcblxuICAgIC8vIGp1c3QgYSBwcml2YXRlIHNob3J0Y3V0XG4gICAgZnJvbUNoYXJDb2RlID0gU3RyaW5nLmZyb21DaGFyQ29kZTtcblxuICByZXR1cm4gdHdlbW9qaTtcblxuXG4gIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbiAgLy8gIHByaXZhdGUgZnVuY3Rpb25zICAvL1xuICAvLyAgICAgZGVjbGFyYXRpb24gICAgIC8vXG4gIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuICAvKipcbiAgICogU2hvcnRjdXQgdG8gY3JlYXRlIHRleHQgbm9kZXNcbiAgICogQHBhcmFtICAgc3RyaW5nICB0ZXh0IHVzZWQgdG8gY3JlYXRlIERPTSB0ZXh0IG5vZGVcbiAgICogQHJldHVybiAgTm9kZSAgYSBET00gbm9kZSB3aXRoIHRoYXQgdGV4dFxuICAgKi9cbiAgZnVuY3Rpb24gY3JlYXRlVGV4dCh0ZXh0LCBjbGVhbikge1xuICAgIHJldHVybiBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjbGVhbiA/IHRleHQucmVwbGFjZShVRkUwRmcsICcnKSA6IHRleHQpO1xuICB9XG5cbiAgLyoqXG4gICAqIFV0aWxpdHkgZnVuY3Rpb24gdG8gZXNjYXBlIGh0bWwgYXR0cmlidXRlIHRleHRcbiAgICogQHBhcmFtICAgc3RyaW5nICB0ZXh0IHVzZSBpbiBIVE1MIGF0dHJpYnV0ZVxuICAgKiBAcmV0dXJuICBzdHJpbmcgIHRleHQgZW5jb2RlZCB0byB1c2UgaW4gSFRNTCBhdHRyaWJ1dGVcbiAgICovXG4gIGZ1bmN0aW9uIGVzY2FwZUhUTUwocykge1xuICAgIHJldHVybiBzLnJlcGxhY2UocmVzY2FwZXIsIHJlcGxhY2VyKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEZWZhdWx0IGNhbGxiYWNrIHVzZWQgdG8gZ2VuZXJhdGUgZW1vamkgc3JjXG4gICAqICBiYXNlZCBvbiBUd2l0dGVyIENETlxuICAgKiBAcGFyYW0gICBzdHJpbmcgICAgdGhlIGVtb2ppIGNvZGVwb2ludCBzdHJpbmdcbiAgICogQHBhcmFtICAgc3RyaW5nICAgIHRoZSBkZWZhdWx0IHNpemUgdG8gdXNlLCBpLmUuIFwiMzZ4MzZcIlxuICAgKiBAcmV0dXJuICBzdHJpbmcgICAgdGhlIGltYWdlIHNvdXJjZSB0byB1c2VcbiAgICovXG4gIGZ1bmN0aW9uIGRlZmF1bHRJbWFnZVNyY0dlbmVyYXRvcihpY29uLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuICcnLmNvbmNhdChvcHRpb25zLmJhc2UsIG9wdGlvbnMuc2l6ZSwgJy8nLCBpY29uLCBvcHRpb25zLmV4dCk7XG4gIH1cblxuICAvKipcbiAgICogR2l2ZW4gYSBnZW5lcmljIERPTSBub2RlVHlwZSAxLCB3YWxrIHRocm91Z2ggYWxsIGNoaWxkcmVuXG4gICAqIGFuZCBzdG9yZSBldmVyeSBub2RlVHlwZSAzICgjdGV4dCkgZm91bmQgaW4gdGhlIHRyZWUuXG4gICAqIEBwYXJhbSAgIEVsZW1lbnQgYSBET00gRWxlbWVudCB3aXRoIHByb2JhYmx5IHNvbWUgdGV4dCBpbiBpdFxuICAgKiBAcGFyYW0gICBBcnJheSB0aGUgbGlzdCBvZiBwcmV2aW91c2x5IGRpc2NvdmVyZWQgdGV4dCBub2Rlc1xuICAgKiBAcmV0dXJuICBBcnJheSBzYW1lIGxpc3Qgd2l0aCBuZXcgZGlzY292ZXJlZCBub2RlcywgaWYgYW55XG4gICAqL1xuICBmdW5jdGlvbiBncmFiQWxsVGV4dE5vZGVzKG5vZGUsIGFsbFRleHQpIHtcbiAgICB2YXJcbiAgICAgIGNoaWxkTm9kZXMgPSBub2RlLmNoaWxkTm9kZXMsXG4gICAgICBsZW5ndGggPSBjaGlsZE5vZGVzLmxlbmd0aCxcbiAgICAgIHN1Ym5vZGUsXG4gICAgICBub2RlVHlwZTtcbiAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgIHN1Ym5vZGUgPSBjaGlsZE5vZGVzW2xlbmd0aF07XG4gICAgICBub2RlVHlwZSA9IHN1Ym5vZGUubm9kZVR5cGU7XG4gICAgICAvLyBwYXJzZSBlbW9qaSBvbmx5IGluIHRleHQgbm9kZXNcbiAgICAgIGlmIChub2RlVHlwZSA9PT0gMykge1xuICAgICAgICAvLyBjb2xsZWN0IHRoZW0gdG8gcHJvY2VzcyBlbW9qaSBsYXRlclxuICAgICAgICBhbGxUZXh0LnB1c2goc3Vibm9kZSk7XG4gICAgICB9XG4gICAgICAvLyBpZ25vcmUgYWxsIG5vZGVzIHRoYXQgYXJlIG5vdCB0eXBlIDEsIHRoYXQgYXJlIHN2Zywgb3IgdGhhdFxuICAgICAgLy8gc2hvdWxkIG5vdCBiZSBwYXJzZWQgYXMgc2NyaXB0LCBzdHlsZSwgYW5kIG90aGVyc1xuICAgICAgZWxzZSBpZiAobm9kZVR5cGUgPT09IDEgJiYgISgnb3duZXJTVkdFbGVtZW50JyBpbiBzdWJub2RlKSAmJlxuICAgICAgICAgICFzaG91bGRudEJlUGFyc2VkLnRlc3Qoc3Vibm9kZS5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpKSkge1xuICAgICAgICBncmFiQWxsVGV4dE5vZGVzKHN1Ym5vZGUsIGFsbFRleHQpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gYWxsVGV4dDtcbiAgfVxuXG4gIC8qKlxuICAgKiBVc2VkIHRvIGJvdGggcmVtb3ZlIHRoZSBwb3NzaWJsZSB2YXJpYW50XG4gICAqICBhbmQgdG8gY29udmVydCB1dGYxNiBpbnRvIGNvZGUgcG9pbnRzLlxuICAgKiAgSWYgdGhlcmUgaXMgYSB6ZXJvLXdpZHRoLWpvaW5lciAoVSsyMDBEKSwgbGVhdmUgdGhlIHZhcmlhbnRzIGluLlxuICAgKiBAcGFyYW0gICBzdHJpbmcgICAgdGhlIHJhdyB0ZXh0IG9mIHRoZSBlbW9qaSBtYXRjaFxuICAgKiBAcmV0dXJuICBzdHJpbmcgICAgdGhlIGNvZGUgcG9pbnRcbiAgICovXG4gIGZ1bmN0aW9uIGdyYWJUaGVSaWdodEljb24ocmF3VGV4dCkge1xuICAgIC8vIGlmIHZhcmlhbnQgaXMgcHJlc2VudCBhcyBcXHVGRTBGXG4gICAgcmV0dXJuIHRvQ29kZVBvaW50KHJhd1RleHQuaW5kZXhPZihVMjAwRCkgPCAwID9cbiAgICAgIHJhd1RleHQucmVwbGFjZShVRkUwRmcsICcnKSA6XG4gICAgICByYXdUZXh0XG4gICAgKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBET00gdmVyc2lvbiBvZiB0aGUgc2FtZSBsb2dpYyAvIHBhcnNlcjpcbiAgICogIGVtb2ppZnkgYWxsIGZvdW5kIHN1Yi10ZXh0IG5vZGVzIHBsYWNpbmcgaW1hZ2VzIG5vZGUgaW5zdGVhZC5cbiAgICogQHBhcmFtICAgRWxlbWVudCAgIGdlbmVyaWMgRE9NIG5vZGUgd2l0aCBzb21lIHRleHQgaW4gc29tZSBjaGlsZCBub2RlXG4gICAqIEBwYXJhbSAgIE9iamVjdCAgICBvcHRpb25zICBjb250YWluaW5nIGluZm8gYWJvdXQgaG93IHRvIHBhcnNlXG4gICAgKlxuICAgICogICAgICAgICAgICAuY2FsbGJhY2sgICBGdW5jdGlvbiAgdGhlIGNhbGxiYWNrIHRvIGludm9rZSBwZXIgZWFjaCBmb3VuZCBlbW9qaS5cbiAgICAqICAgICAgICAgICAgLmJhc2UgICAgICAgc3RyaW5nICAgIHRoZSBiYXNlIHVybCwgYnkgZGVmYXVsdCB0d2Vtb2ppLmJhc2VcbiAgICAqICAgICAgICAgICAgLmV4dCAgICAgICAgc3RyaW5nICAgIHRoZSBpbWFnZSBleHRlbnNpb24sIGJ5IGRlZmF1bHQgdHdlbW9qaS5leHRcbiAgICAqICAgICAgICAgICAgLnNpemUgICAgICAgc3RyaW5nICAgIHRoZSBhc3NldHMgc2l6ZSwgYnkgZGVmYXVsdCB0d2Vtb2ppLnNpemVcbiAgICAqXG4gICAqIEByZXR1cm4gIEVsZW1lbnQgc2FtZSBnZW5lcmljIG5vZGUgd2l0aCBlbW9qaSBpbiBwbGFjZSwgaWYgYW55LlxuICAgKi9cbiAgZnVuY3Rpb24gcGFyc2VOb2RlKG5vZGUsIG9wdGlvbnMpIHtcbiAgICB2YXJcbiAgICAgIGFsbFRleHQgPSBncmFiQWxsVGV4dE5vZGVzKG5vZGUsIFtdKSxcbiAgICAgIGxlbmd0aCA9IGFsbFRleHQubGVuZ3RoLFxuICAgICAgYXR0cmliLFxuICAgICAgYXR0cm5hbWUsXG4gICAgICBtb2RpZmllZCxcbiAgICAgIGZyYWdtZW50LFxuICAgICAgc3Vibm9kZSxcbiAgICAgIHRleHQsXG4gICAgICBtYXRjaCxcbiAgICAgIGksXG4gICAgICBpbmRleCxcbiAgICAgIGltZyxcbiAgICAgIHJhd1RleHQsXG4gICAgICBpY29uSWQsXG4gICAgICBzcmM7XG4gICAgd2hpbGUgKGxlbmd0aC0tKSB7XG4gICAgICBtb2RpZmllZCA9IGZhbHNlO1xuICAgICAgZnJhZ21lbnQgPSBkb2N1bWVudC5jcmVhdGVEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICBzdWJub2RlID0gYWxsVGV4dFtsZW5ndGhdO1xuICAgICAgdGV4dCA9IHN1Ym5vZGUubm9kZVZhbHVlO1xuICAgICAgaSA9IDA7XG4gICAgICB3aGlsZSAoKG1hdGNoID0gcmUuZXhlYyh0ZXh0KSkpIHtcbiAgICAgICAgaW5kZXggPSBtYXRjaC5pbmRleDtcbiAgICAgICAgaWYgKGluZGV4ICE9PSBpKSB7XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoXG4gICAgICAgICAgICBjcmVhdGVUZXh0KHRleHQuc2xpY2UoaSwgaW5kZXgpLCB0cnVlKVxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgICAgcmF3VGV4dCA9IG1hdGNoWzBdO1xuICAgICAgICBpY29uSWQgPSBncmFiVGhlUmlnaHRJY29uKHJhd1RleHQpO1xuICAgICAgICBpID0gaW5kZXggKyByYXdUZXh0Lmxlbmd0aDtcbiAgICAgICAgc3JjID0gb3B0aW9ucy5jYWxsYmFjayhpY29uSWQsIG9wdGlvbnMpO1xuICAgICAgICBpZiAoc3JjKSB7XG4gICAgICAgICAgaW1nID0gbmV3IEltYWdlKCk7XG4gICAgICAgICAgaW1nLm9uZXJyb3IgPSBvcHRpb25zLm9uZXJyb3I7XG4gICAgICAgICAgaW1nLnNldEF0dHJpYnV0ZSgnZHJhZ2dhYmxlJywgJ2ZhbHNlJyk7XG4gICAgICAgICAgYXR0cmliID0gb3B0aW9ucy5hdHRyaWJ1dGVzKHJhd1RleHQsIGljb25JZCk7XG4gICAgICAgICAgZm9yIChhdHRybmFtZSBpbiBhdHRyaWIpIHtcbiAgICAgICAgICAgIGlmIChcbiAgICAgICAgICAgICAgYXR0cmliLmhhc093blByb3BlcnR5KGF0dHJuYW1lKSAmJlxuICAgICAgICAgICAgICAvLyBkb24ndCBhbGxvdyBhbnkgaGFuZGxlcnMgdG8gYmUgc2V0ICsgZG9uJ3QgYWxsb3cgb3ZlcnJpZGVzXG4gICAgICAgICAgICAgIGF0dHJuYW1lLmluZGV4T2YoJ29uJykgIT09IDAgJiZcbiAgICAgICAgICAgICAgIWltZy5oYXNBdHRyaWJ1dGUoYXR0cm5hbWUpXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgaW1nLnNldEF0dHJpYnV0ZShhdHRybmFtZSwgYXR0cmliW2F0dHJuYW1lXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGltZy5jbGFzc05hbWUgPSBvcHRpb25zLmNsYXNzTmFtZTtcbiAgICAgICAgICBpbWcuYWx0ID0gcmF3VGV4dDtcbiAgICAgICAgICBpbWcuc3JjID0gc3JjO1xuICAgICAgICAgIG1vZGlmaWVkID0gdHJ1ZTtcbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChpbWcpO1xuICAgICAgICB9XG4gICAgICAgIGlmICghaW1nKSBmcmFnbWVudC5hcHBlbmRDaGlsZChjcmVhdGVUZXh0KHJhd1RleHQsIGZhbHNlKSk7XG4gICAgICAgIGltZyA9IG51bGw7XG4gICAgICB9XG4gICAgICAvLyBpcyB0aGVyZSBhY3R1YWxseSBhbnl0aGluZyB0byByZXBsYWNlIGluIGhlcmUgP1xuICAgICAgaWYgKG1vZGlmaWVkKSB7XG4gICAgICAgIC8vIGFueSB0ZXh0IGxlZnQgdG8gYmUgYWRkZWQgP1xuICAgICAgICBpZiAoaSA8IHRleHQubGVuZ3RoKSB7XG4gICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQoXG4gICAgICAgICAgICBjcmVhdGVUZXh0KHRleHQuc2xpY2UoaSksIHRydWUpXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICAvLyByZXBsYWNlIHRoZSB0ZXh0IG5vZGUgb25seSwgbGVhdmUgaW50YWN0XG4gICAgICAgIC8vIGFueXRoaW5nIGVsc2Ugc3Vycm91bmRpbmcgc3VjaCB0ZXh0XG4gICAgICAgIHN1Ym5vZGUucGFyZW50Tm9kZS5yZXBsYWNlQ2hpbGQoZnJhZ21lbnQsIHN1Ym5vZGUpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTdHJpbmcvSFRNTCB2ZXJzaW9uIG9mIHRoZSBzYW1lIGxvZ2ljIC8gcGFyc2VyOlxuICAgKiAgZW1vamlmeSBhIGdlbmVyaWMgdGV4dCBwbGFjaW5nIGltYWdlcyB0YWdzIGluc3RlYWQgb2Ygc3Vycm9nYXRlcyBwYWlyLlxuICAgKiBAcGFyYW0gICBzdHJpbmcgICAgZ2VuZXJpYyBzdHJpbmcgd2l0aCBwb3NzaWJseSBzb21lIGVtb2ppIGluIGl0XG4gICAqIEBwYXJhbSAgIE9iamVjdCAgICBvcHRpb25zICBjb250YWluaW5nIGluZm8gYWJvdXQgaG93IHRvIHBhcnNlXG4gICAqXG4gICAqICAgICAgICAgICAgLmNhbGxiYWNrICAgRnVuY3Rpb24gIHRoZSBjYWxsYmFjayB0byBpbnZva2UgcGVyIGVhY2ggZm91bmQgZW1vamkuXG4gICAqICAgICAgICAgICAgLmJhc2UgICAgICAgc3RyaW5nICAgIHRoZSBiYXNlIHVybCwgYnkgZGVmYXVsdCB0d2Vtb2ppLmJhc2VcbiAgICogICAgICAgICAgICAuZXh0ICAgICAgICBzdHJpbmcgICAgdGhlIGltYWdlIGV4dGVuc2lvbiwgYnkgZGVmYXVsdCB0d2Vtb2ppLmV4dFxuICAgKiAgICAgICAgICAgIC5zaXplICAgICAgIHN0cmluZyAgICB0aGUgYXNzZXRzIHNpemUsIGJ5IGRlZmF1bHQgdHdlbW9qaS5zaXplXG4gICAqXG4gICAqIEByZXR1cm4gIHRoZSBzdHJpbmcgd2l0aCA8aW1nIHRhZ3M+IHJlcGxhY2luZyBhbGwgZm91bmQgYW5kIHBhcnNlZCBlbW9qaVxuICAgKi9cbiAgZnVuY3Rpb24gcGFyc2VTdHJpbmcoc3RyLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHJlcGxhY2Uoc3RyLCBmdW5jdGlvbiAocmF3VGV4dCkge1xuICAgICAgdmFyXG4gICAgICAgIHJldCA9IHJhd1RleHQsXG4gICAgICAgIGljb25JZCA9IGdyYWJUaGVSaWdodEljb24ocmF3VGV4dCksXG4gICAgICAgIHNyYyA9IG9wdGlvbnMuY2FsbGJhY2soaWNvbklkLCBvcHRpb25zKSxcbiAgICAgICAgYXR0cmliLFxuICAgICAgICBhdHRybmFtZTtcbiAgICAgIGlmIChzcmMpIHtcbiAgICAgICAgLy8gcmVjeWNsZSB0aGUgbWF0Y2ggc3RyaW5nIHJlcGxhY2luZyB0aGUgZW1vamlcbiAgICAgICAgLy8gd2l0aCBpdHMgaW1hZ2UgY291bnRlciBwYXJ0XG4gICAgICAgIHJldCA9ICc8aW1nICcuY29uY2F0KFxuICAgICAgICAgICdjbGFzcz1cIicsIG9wdGlvbnMuY2xhc3NOYW1lLCAnXCIgJyxcbiAgICAgICAgICAnZHJhZ2dhYmxlPVwiZmFsc2VcIiAnLFxuICAgICAgICAgIC8vIG5lZWRzIHRvIHByZXNlcnZlIHVzZXIgb3JpZ2luYWwgaW50ZW50XG4gICAgICAgICAgLy8gd2hlbiB2YXJpYW50cyBzaG91bGQgYmUgY29waWVkIGFuZCBwYXN0ZWQgdG9vXG4gICAgICAgICAgJ2FsdD1cIicsXG4gICAgICAgICAgcmF3VGV4dCxcbiAgICAgICAgICAnXCInLFxuICAgICAgICAgICcgc3JjPVwiJyxcbiAgICAgICAgICBzcmMsXG4gICAgICAgICAgJ1wiJ1xuICAgICAgICApO1xuICAgICAgICBhdHRyaWIgPSBvcHRpb25zLmF0dHJpYnV0ZXMocmF3VGV4dCwgaWNvbklkKTtcbiAgICAgICAgZm9yIChhdHRybmFtZSBpbiBhdHRyaWIpIHtcbiAgICAgICAgICBpZiAoXG4gICAgICAgICAgICBhdHRyaWIuaGFzT3duUHJvcGVydHkoYXR0cm5hbWUpICYmXG4gICAgICAgICAgICAvLyBkb24ndCBhbGxvdyBhbnkgaGFuZGxlcnMgdG8gYmUgc2V0ICsgZG9uJ3QgYWxsb3cgb3ZlcnJpZGVzXG4gICAgICAgICAgICBhdHRybmFtZS5pbmRleE9mKCdvbicpICE9PSAwICYmXG4gICAgICAgICAgICByZXQuaW5kZXhPZignICcgKyBhdHRybmFtZSArICc9JykgPT09IC0xXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICByZXQgPSByZXQuY29uY2F0KCcgJywgYXR0cm5hbWUsICc9XCInLCBlc2NhcGVIVE1MKGF0dHJpYlthdHRybmFtZV0pLCAnXCInKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0ID0gcmV0LmNvbmNhdCgnLz4nKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXQ7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogRnVuY3Rpb24gdXNlZCB0byBhY3R1YWxseSByZXBsYWNlIEhUTUwgc3BlY2lhbCBjaGFyc1xuICAgKiBAcGFyYW0gICBzdHJpbmcgIEhUTUwgc3BlY2lhbCBjaGFyXG4gICAqIEByZXR1cm4gIHN0cmluZyAgZW5jb2RlZCBIVE1MIHNwZWNpYWwgY2hhclxuICAgKi9cbiAgZnVuY3Rpb24gcmVwbGFjZXIobSkge1xuICAgIHJldHVybiBlc2NhcGVyW21dO1xuICB9XG5cbiAgLyoqXG4gICAqIERlZmF1bHQgb3B0aW9ucy5hdHRyaWJ1dGUgY2FsbGJhY2tcbiAgICogQHJldHVybiAgbnVsbFxuICAgKi9cbiAgZnVuY3Rpb24gcmV0dXJuTnVsbCgpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8qKlxuICAgKiBHaXZlbiBhIGdlbmVyaWMgdmFsdWUsIGNyZWF0ZXMgaXRzIHNxdWFyZWQgY291bnRlcnBhcnQgaWYgaXQncyBhIG51bWJlci5cbiAgICogIEFzIGV4YW1wbGUsIG51bWJlciAzNiB3aWxsIHJldHVybiAnMzZ4MzYnLlxuICAgKiBAcGFyYW0gICBhbnkgICAgIGEgZ2VuZXJpYyB2YWx1ZS5cbiAgICogQHJldHVybiAgYW55ICAgICBhIHN0cmluZyByZXByZXNlbnRpbmcgYXNzZXQgc2l6ZSwgaS5lLiBcIjM2eDM2XCJcbiAgICogICAgICAgICAgICAgICAgICBvbmx5IGluIGNhc2UgdGhlIHZhbHVlIHdhcyBhIG51bWJlci5cbiAgICogICAgICAgICAgICAgICAgICBSZXR1cm5zIGluaXRpYWwgdmFsdWUgb3RoZXJ3aXNlLlxuICAgKi9cbiAgZnVuY3Rpb24gdG9TaXplU3F1YXJlZEFzc2V0KHZhbHVlKSB7XG4gICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgP1xuICAgICAgdmFsdWUgKyAneCcgKyB2YWx1ZSA6XG4gICAgICB2YWx1ZTtcbiAgfVxuXG5cbiAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAvLyAgZXhwb3J0ZWQgZnVuY3Rpb25zIC8vXG4gIC8vICAgICBkZWNsYXJhdGlvbiAgICAgLy9cbiAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4gIGZ1bmN0aW9uIGZyb21Db2RlUG9pbnQoY29kZXBvaW50KSB7XG4gICAgdmFyIGNvZGUgPSB0eXBlb2YgY29kZXBvaW50ID09PSAnc3RyaW5nJyA/XG4gICAgICAgICAgcGFyc2VJbnQoY29kZXBvaW50LCAxNikgOiBjb2RlcG9pbnQ7XG4gICAgaWYgKGNvZGUgPCAweDEwMDAwKSB7XG4gICAgICByZXR1cm4gZnJvbUNoYXJDb2RlKGNvZGUpO1xuICAgIH1cbiAgICBjb2RlIC09IDB4MTAwMDA7XG4gICAgcmV0dXJuIGZyb21DaGFyQ29kZShcbiAgICAgIDB4RDgwMCArIChjb2RlID4+IDEwKSxcbiAgICAgIDB4REMwMCArIChjb2RlICYgMHgzRkYpXG4gICAgKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlKHdoYXQsIGhvdykge1xuICAgIGlmICghaG93IHx8IHR5cGVvZiBob3cgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGhvdyA9IHtjYWxsYmFjazogaG93fTtcbiAgICB9XG4gICAgLy8gaWYgZmlyc3QgYXJndW1lbnQgaXMgc3RyaW5nLCBpbmplY3QgaHRtbCA8aW1nPiB0YWdzXG4gICAgLy8gb3RoZXJ3aXNlIHVzZSB0aGUgRE9NIHRyZWUgYW5kIHBhcnNlIHRleHQgbm9kZXMgb25seVxuICAgIHJldHVybiAodHlwZW9mIHdoYXQgPT09ICdzdHJpbmcnID8gcGFyc2VTdHJpbmcgOiBwYXJzZU5vZGUpKHdoYXQsIHtcbiAgICAgIGNhbGxiYWNrOiAgIGhvdy5jYWxsYmFjayB8fCBkZWZhdWx0SW1hZ2VTcmNHZW5lcmF0b3IsXG4gICAgICBhdHRyaWJ1dGVzOiB0eXBlb2YgaG93LmF0dHJpYnV0ZXMgPT09ICdmdW5jdGlvbicgPyBob3cuYXR0cmlidXRlcyA6IHJldHVybk51bGwsXG4gICAgICBiYXNlOiAgICAgICB0eXBlb2YgaG93LmJhc2UgPT09ICdzdHJpbmcnID8gaG93LmJhc2UgOiB0d2Vtb2ppLmJhc2UsXG4gICAgICBleHQ6ICAgICAgICBob3cuZXh0IHx8IHR3ZW1vamkuZXh0LFxuICAgICAgc2l6ZTogICAgICAgaG93LmZvbGRlciB8fCB0b1NpemVTcXVhcmVkQXNzZXQoaG93LnNpemUgfHwgdHdlbW9qaS5zaXplKSxcbiAgICAgIGNsYXNzTmFtZTogIGhvdy5jbGFzc05hbWUgfHwgdHdlbW9qaS5jbGFzc05hbWUsXG4gICAgICBvbmVycm9yOiAgICBob3cub25lcnJvciB8fCB0d2Vtb2ppLm9uZXJyb3JcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlcGxhY2UodGV4dCwgY2FsbGJhY2spIHtcbiAgICByZXR1cm4gU3RyaW5nKHRleHQpLnJlcGxhY2UocmUsIGNhbGxiYWNrKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRlc3QodGV4dCkge1xuICAgIC8vIElFNiBuZWVkcyBhIHJlc2V0IGJlZm9yZSB0b29cbiAgICByZS5sYXN0SW5kZXggPSAwO1xuICAgIHZhciByZXN1bHQgPSByZS50ZXN0KHRleHQpO1xuICAgIHJlLmxhc3RJbmRleCA9IDA7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRvQ29kZVBvaW50KHVuaWNvZGVTdXJyb2dhdGVzLCBzZXApIHtcbiAgICB2YXJcbiAgICAgIHIgPSBbXSxcbiAgICAgIGMgPSAwLFxuICAgICAgcCA9IDAsXG4gICAgICBpID0gMDtcbiAgICB3aGlsZSAoaSA8IHVuaWNvZGVTdXJyb2dhdGVzLmxlbmd0aCkge1xuICAgICAgYyA9IHVuaWNvZGVTdXJyb2dhdGVzLmNoYXJDb2RlQXQoaSsrKTtcbiAgICAgIGlmIChwKSB7XG4gICAgICAgIHIucHVzaCgoMHgxMDAwMCArICgocCAtIDB4RDgwMCkgPDwgMTApICsgKGMgLSAweERDMDApKS50b1N0cmluZygxNikpO1xuICAgICAgICBwID0gMDtcbiAgICAgIH0gZWxzZSBpZiAoMHhEODAwIDw9IGMgJiYgYyA8PSAweERCRkYpIHtcbiAgICAgICAgcCA9IGM7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByLnB1c2goYy50b1N0cmluZygxNikpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gci5qb2luKHNlcCB8fCAnLScpO1xuICB9XG5cbn0oKSk7XG5pZiAoIWxvY2F0aW9uLnByb3RvY29sKSB7XG4gIHR3ZW1vamkuYmFzZSA9IHR3ZW1vamkuYmFzZS5yZXBsYWNlKC9eaHR0cDovLCBcIlwiKTtcbn1cbm1vZHVsZS5leHBvcnRzID0gdHdlbW9qaTsiXX0=
