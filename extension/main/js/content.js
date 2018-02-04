(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

StringBuffer.on('break', function () {
    Matcher.checkMatch();
});

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
},{"./modules/State.js":2,"./modules/element-watcher.js":4,"./modules/focus-watcher.js":5,"./modules/matcher.js":7,"./modules/replace.js":8,"./modules/state.js":2,"./modules/string-buffer.js":10,"./modules/ui.js":12,"./modules/utils.js":13}],2:[function(require,module,exports){
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
},{"event-emitter":30}],3:[function(require,module,exports){
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
                if (list[i][1] === k) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                delete this.items[k];
            }
        }

        for (var i = 0; i < list.length; i++) {
            var emoji = list[i][0]
            ,   name = list[i][1];

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
},{"./State.js":2,"./utils.js":13,"event-emitter":30,"twemoji":32}],4:[function(require,module,exports){
// The user can only type in one element at once. We’re interested in
// receiving all keyboard events, no matter the element. This module does
// that. It handles the change from one element to another by internally
// switching listeners and exposing a single emitter that emits events.

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
},{"event-emitter":30}],5:[function(require,module,exports){
// Checks the currently focused element over short interval and dispatches
// changes. The "focusin" event can't do the job because it can be cancelled.

var EventEmitter = require('event-emitter');
var INTERVAL = 400;

var emitter = EventEmitter();
var _focusedElement = null;

setInterval(function () {
    if (document.activeElement !== _focusedElement) {
        _focusedElement = document.activeElement;
        emitter.emit('change', _focusedElement);
    }
}, INTERVAL);

module.exports = emitter;
},{"event-emitter":30}],6:[function(require,module,exports){
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
},{}],7:[function(require,module,exports){
var EventEmitter = require('event-emitter');
var Shortcodes = require('./shortcodes.js');
var State = require('./State.js');

module.exports = (function () {
    var exports = EventEmitter();

    var _flags = {},
        _coloncodes = [];

    function resetFlags() {
        _flags.shortcode = false;
        _flags.colonStart = false;
        _flags.coloncode = false;
        exports.emit('flags_update', _flags);
    }

    function updateColoncodes(data) {
        _coloncodes = data || [];
        exports.emit('coloncode_update', _coloncodes);
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

        exports.emit('flags_update', _flags);
    }

    exports.reset = function () {
        resetFlags();
        updateColoncodes(null);
    };

    exports.checkMatch = function (buffer) {
        if (_flags.shortcode) {
            var shortcode = Shortcodes.get(_flags.shortcode);

            if (shortcode !== null) {
                exports.emit('match', shortcode);
            }
        }

        if (_flags.coloncode) {
            for (var i = 0; i < _coloncodes.length; i++) {
                if (_coloncodes[i][0] === _flags.coloncode) {
                    exports.emit('match', _coloncodes[i][1]);
                }
            }
        }   
    };

    exports.update = function (buffer) {
        updateFlags(buffer);

        if (flagsDown()) {
            exports.emit('flags_down');
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
},{"./State.js":2,"./shortcodes.js":9,"event-emitter":30}],8:[function(require,module,exports){
var State = require('./State.js');
var Utils = require('./utils.js');
var ElementWatcher = require('./element-watcher.js');
var StringBuffer = require('./string-buffer.js');

module.exports = function (emoji) {
    var element = ElementWatcher.getElement();
    var search = StringBuffer.getBuffer();
    var copyBehavior = State.getBehavior('copy');

    if (!element) {
        return false;
    }

    if (element.hasAttribute("contenteditable")) {
        if (copyBehavior) {
            Utils.clipWithSelection(emoji);
        }

        Utils.searchSelection(search, function (result) {
            var range = result.selection.getRangeAt(result.selection.rangeCount - 1);
            range.setStart(result.node, result.start);
            range.setEnd(result.node, result.end);

            // If the behavior is copy, it should only select the match. If
            // it’s not - it should also replace it with the emoji.
            if (!copyBehavior) {
                range.deleteContents();
                range.insertNode(document.createTextNode(emoji));

                result.node.parentNode.normalize();
                result.node.parentElement.normalize();
                result.selection.collapseToEnd();
            }
        });
    } else {
        Utils.searchInput(element, search, function (result) {
            if (copyBehavior) {
                // clipWithSelection() removes the caret position, so it must
                // be done after the start and end of the match is found, I.E.
                // in the callback.
                Utils.clipWithSelection(emoji);

                element.selectionStart = result.start;
                element.selectionEnd = result.end;
            } else {
                element.value = result.before + emoji + result.after;
                element.selectionEnd = result.before.length + emoji.length;
            }
        });
    }

    StringBuffer.clear();
};
},{"./State.js":2,"./element-watcher.js":4,"./string-buffer.js":10,"./utils.js":13}],9:[function(require,module,exports){
var Shortcodes = require('smiley-caret-data/shortcodes');

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
},{"smiley-caret-data/shortcodes":31}],10:[function(require,module,exports){
var EventEmitter = require('event-emitter');
var State = require('./State.js');
var Utils = require('./utils.js');
var Keys = require('./keys.js');

module.exports = (function () {
    var exports = EventEmitter();

    var _buffer = "";

    function change(mutator, silent) {
        var cache = _buffer;
        _buffer = mutator(_buffer);

        if (
            _buffer !== cache &&
            typeof _buffer == "string"
        ) {
            if (silent !== true) {
                exports.emit('change', _buffer, cache);
            }

            if (_buffer.length === 0) {
                exports.emit('clear');
            }
        }
    }

    exports.clear = function () {
        change(function () {
            return "";
        }, true);
    };

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
            exports.emit('break', _buffer);
            exports.clear();
            return;
        }

        //                              selection is not a single character (ctrl+A)
        if (Keys.isArrowKey(event.which) || !(window.getSelection().isCollapsed)) {
            exports.clear();
            return;
        }

        if (event.which === Keys.codes.backspace) {
            change(function (buffer) {
                return buffer.slice(0, -1);
            });
        }
    };

    exports.getBuffer = function () {
        return _buffer;
    };

    return exports;
})();

State.on('behavior_change', function (key, value) {
    if (key == 'active' && value == false) {
        module.exports.clear();
    }
});
},{"./State.js":2,"./keys.js":6,"./utils.js":13,"event-emitter":30}],11:[function(require,module,exports){
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
},{}],12:[function(require,module,exports){
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
},{"./dropdown.js":3,"./replace.js":8}],13:[function(require,module,exports){
var fnTextareaCaretPosition = require('./textarea-caret-position.js');

module.exports = {
    searchInput: function (elem, search, callback) {
        if (
            !elem ||
            typeof elem.value != "string" ||
            typeof elem.selectionEnd != "number"
        ) {
            return false;
        }

        var value = elem.value
        ,   endIndex = elem.selectionEnd
        ,   startIndex = endIndex - search.length;

        if (
            startIndex < 0 ||
            endIndex < startIndex ||
            value.substring(startIndex, endIndex) != search
        ) {
            return false;
        }

        return callback({
            start: startIndex,
            end: endIndex,
            before: value.substring(0, startIndex),
            after: value.substring(endIndex)
        });
    },

    searchSelection: function (search, callback) {
        var selection = window.getSelection();

        if (
            !selection ||
            !selection.focusNode ||
            !selection.focusNode.nodeValue
        ) {
            return false;
        }

        var node = selection.focusNode
        ,   endIndex = selection.focusOffset
        ,   startIndex = endIndex - search.length;

        if (
            startIndex < 0 ||
            endIndex < startIndex ||
            selection.rangeCount == 0 ||
            node.nodeValue.substring(startIndex, endIndex) != search
        ) {
            return false;
        }

        return callback({
            selection: selection,
            node: node,
            start: startIndex,
            end: endIndex
        });
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
},{"./textarea-caret-position.js":11}],14:[function(require,module,exports){
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

},{"es5-ext/object/assign":16,"es5-ext/object/is-callable":19,"es5-ext/object/normalize-options":24,"es5-ext/string/#/contains":27}],15:[function(require,module,exports){
"use strict";

// eslint-disable-next-line no-empty-function
module.exports = function () {};

},{}],16:[function(require,module,exports){
"use strict";

module.exports = require("./is-implemented")()
	? Object.assign
	: require("./shim");

},{"./is-implemented":17,"./shim":18}],17:[function(require,module,exports){
"use strict";

module.exports = function () {
	var assign = Object.assign, obj;
	if (typeof assign !== "function") return false;
	obj = { foo: "raz" };
	assign(obj, { bar: "dwa" }, { trzy: "trzy" });
	return (obj.foo + obj.bar + obj.trzy) === "razdwatrzy";
};

},{}],18:[function(require,module,exports){
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

},{"../keys":21,"../valid-value":26}],19:[function(require,module,exports){
// Deprecated

"use strict";

module.exports = function (obj) {
 return typeof obj === "function";
};

},{}],20:[function(require,module,exports){
"use strict";

var _undefined = require("../function/noop")(); // Support ES3 engines

module.exports = function (val) {
 return (val !== _undefined) && (val !== null);
};

},{"../function/noop":15}],21:[function(require,module,exports){
"use strict";

module.exports = require("./is-implemented")()
	? Object.keys
	: require("./shim");

},{"./is-implemented":22,"./shim":23}],22:[function(require,module,exports){
"use strict";

module.exports = function () {
	try {
		Object.keys("primitive");
		return true;
	} catch (e) {
 return false;
}
};

},{}],23:[function(require,module,exports){
"use strict";

var isValue = require("../is-value");

var keys = Object.keys;

module.exports = function (object) {
	return keys(isValue(object) ? Object(object) : object);
};

},{"../is-value":20}],24:[function(require,module,exports){
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

},{"./is-value":20}],25:[function(require,module,exports){
"use strict";

module.exports = function (fn) {
	if (typeof fn !== "function") throw new TypeError(fn + " is not a function");
	return fn;
};

},{}],26:[function(require,module,exports){
"use strict";

var isValue = require("./is-value");

module.exports = function (value) {
	if (!isValue(value)) throw new TypeError("Cannot use null or undefined");
	return value;
};

},{"./is-value":20}],27:[function(require,module,exports){
"use strict";

module.exports = require("./is-implemented")()
	? String.prototype.contains
	: require("./shim");

},{"./is-implemented":28,"./shim":29}],28:[function(require,module,exports){
"use strict";

var str = "razdwatrzy";

module.exports = function () {
	if (typeof str.contains !== "function") return false;
	return (str.contains("dwa") === true) && (str.contains("foo") === false);
};

},{}],29:[function(require,module,exports){
"use strict";

var indexOf = String.prototype.indexOf;

module.exports = function (searchString/*, position*/) {
	return indexOf.call(this, searchString, arguments[1]) > -1;
};

},{}],30:[function(require,module,exports){
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

},{"d":14,"es5-ext/object/valid-callable":25}],31:[function(require,module,exports){
module.exports={":D":"😀","':D":"😅","xD":"😆",";)":"😉","^^":"😊",":p":"😋","8)":"😎",":*":"😘",":3":"😗",":)":"🙂",":?":"🤔",":|":"😐","-_-":"😑",":x":"😶",":X":"😶","|-(":"🙄",":O":"😮",":o":"😯","D:":"😫","|-)":"😴",":P":"😛",";P":"😜",":/":"😕","(:":"🙃","8O":"😲",":(":"🙁",";(":"😢",":@":"🤬",">:)":"😈","<3":"❤️"};
},{}],32:[function(require,module,exports){
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

},{}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJtYWluL2pzL3NyYy9jb250ZW50LmpzIiwibWFpbi9qcy9zcmMvbW9kdWxlcy9TdGF0ZS5qcyIsIm1haW4vanMvc3JjL21vZHVsZXMvZHJvcGRvd24uanMiLCJtYWluL2pzL3NyYy9tb2R1bGVzL2VsZW1lbnQtd2F0Y2hlci5qcyIsIm1haW4vanMvc3JjL21vZHVsZXMvZm9jdXMtd2F0Y2hlci5qcyIsIm1haW4vanMvc3JjL21vZHVsZXMva2V5cy5qcyIsIm1haW4vanMvc3JjL21vZHVsZXMvbWF0Y2hlci5qcyIsIm1haW4vanMvc3JjL21vZHVsZXMvcmVwbGFjZS5qcyIsIm1haW4vanMvc3JjL21vZHVsZXMvc2hvcnRjb2Rlcy5qcyIsIm1haW4vanMvc3JjL21vZHVsZXMvc3RyaW5nLWJ1ZmZlci5qcyIsIm1haW4vanMvc3JjL21vZHVsZXMvdGV4dGFyZWEtY2FyZXQtcG9zaXRpb24uanMiLCJtYWluL2pzL3NyYy9tb2R1bGVzL3VpLmpzIiwibWFpbi9qcy9zcmMvbW9kdWxlcy91dGlscy5qcyIsIi4uL25vZGVfbW9kdWxlcy9kL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzNS1leHQvZnVuY3Rpb24vbm9vcC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9hc3NpZ24vaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvYXNzaWduL2lzLWltcGxlbWVudGVkLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2Fzc2lnbi9zaGltLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2lzLWNhbGxhYmxlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2lzLXZhbHVlLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2tleXMvaW5kZXguanMiLCIuLi9ub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3Qva2V5cy9pcy1pbXBsZW1lbnRlZC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9rZXlzL3NoaW0uanMiLCIuLi9ub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3Qvbm9ybWFsaXplLW9wdGlvbnMuanMiLCIuLi9ub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvdmFsaWQtY2FsbGFibGUuanMiLCIuLi9ub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvdmFsaWQtdmFsdWUuanMiLCIuLi9ub2RlX21vZHVsZXMvZXM1LWV4dC9zdHJpbmcvIy9jb250YWlucy9pbmRleC5qcyIsIi4uL25vZGVfbW9kdWxlcy9lczUtZXh0L3N0cmluZy8jL2NvbnRhaW5zL2lzLWltcGxlbWVudGVkLmpzIiwiLi4vbm9kZV9tb2R1bGVzL2VzNS1leHQvc3RyaW5nLyMvY29udGFpbnMvc2hpbS5qcyIsIi4uL25vZGVfbW9kdWxlcy9ldmVudC1lbWl0dGVyL2luZGV4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3NtaWxleS1jYXJldC1kYXRhL3Nob3J0Y29kZXMuanMiLCIuLi9ub2RlX21vZHVsZXMvdHdlbW9qaS8yL3R3ZW1vamkubnBtLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekxBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BJQTs7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8vIC0tLVxyXG4vLyBhZGQga2V5d29yZHMgd2hlbiBzZWFyY2hpbmdcclxuLy8gZml4IGRyb3Bkb3duIHBvc2l0aW9uaW5nIHdoZW4gaXQncyB0b28gY2xvc2UgdG8gdGhlIGVkZ2UgKGZhY2Vib29rIGNoYXQgc2VhcmNoKVxyXG5cclxudmFyIFV0aWxzID0gcmVxdWlyZSgnLi9tb2R1bGVzL3V0aWxzLmpzJyk7XHJcbnZhciBVSSA9IHJlcXVpcmUoJy4vbW9kdWxlcy91aS5qcycpO1xyXG52YXIgRm9jdXNXYXRjaGVyID0gcmVxdWlyZSgnLi9tb2R1bGVzL2ZvY3VzLXdhdGNoZXIuanMnKTtcclxudmFyIEVsZW1lbnRXYXRjaGVyID0gcmVxdWlyZSgnLi9tb2R1bGVzL2VsZW1lbnQtd2F0Y2hlci5qcycpO1xyXG52YXIgU3RyaW5nQnVmZmVyID0gcmVxdWlyZSgnLi9tb2R1bGVzL3N0cmluZy1idWZmZXIuanMnKTtcclxudmFyIE1hdGNoZXIgPSByZXF1aXJlKCcuL21vZHVsZXMvbWF0Y2hlci5qcycpO1xyXG52YXIgcmVwbGFjZSA9IHJlcXVpcmUoJy4vbW9kdWxlcy9yZXBsYWNlLmpzJyk7XHJcbnZhciBTdGF0ZSA9IHJlcXVpcmUoJy4vbW9kdWxlcy9TdGF0ZS5qcycpO1xyXG5cclxuRm9jdXNXYXRjaGVyLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbiAoZWxlbWVudCkge1xyXG4gICAgaWYgKFV0aWxzLmlzRWxlbWVudEVtb2ppRWxpZ2libGUoZWxlbWVudCkpIHtcclxuICAgICAgICBFbGVtZW50V2F0Y2hlci5jaGFuZ2VFbGVtZW50KGVsZW1lbnQpO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBFbGVtZW50V2F0Y2hlci5jaGFuZ2VFbGVtZW50KG51bGwpO1xyXG4gICAgfVxyXG59KTtcclxuXHJcbkVsZW1lbnRXYXRjaGVyLm9uKCdyZWJpbmQnLCBTdHJpbmdCdWZmZXIuY2xlYXIpO1xyXG5FbGVtZW50V2F0Y2hlci5lbGVtZW50Lm9uKCdrZXlkb3duJywgU3RyaW5nQnVmZmVyLmhhbmRsZUtleURvd24pO1xyXG5cclxuRWxlbWVudFdhdGNoZXIuZWxlbWVudC5vbigna2V5cHJlc3MnLCBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgIFN0cmluZ0J1ZmZlci5oYW5kbGVLZXlQcmVzcyhldmVudCk7XHJcblxyXG4gICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgLy8gVGltZW91dCBuZWVkZWQgYmVjYXVzZSBvdGhlcndpc2UgdGhlIHBvc2l0aW9uaW5nIGhhcHBlbnMgYmVmb3JlXHJcbiAgICAgICAgLy8gdGhlIGNoYXJhY3RlciBpcyBpbnNlcnRlZC5cclxuICAgICAgICBVSS5kcm9wZG93bkFjdGlvbihmdW5jdGlvbiAoZHJvcGRvd24pIHtcclxuICAgICAgICAgICAgZHJvcGRvd24uYWxpZ25UbyhldmVudC50YXJnZXQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfSwgMCk7XHJcbn0pO1xyXG5cclxuRWxlbWVudFdhdGNoZXIuZWxlbWVudC5vbigna2V5dXAnLCBmdW5jdGlvbiAoZXZlbnQsIGVsZW1lbnQpIHtcclxuICAgIFVJLmRyb3Bkb3duQWN0aW9uKGZ1bmN0aW9uIChkcm9wZG93bikge1xyXG4gICAgICAgIGRyb3Bkb3duLmFsaWduVG8oZXZlbnQudGFyZ2V0KTtcclxuICAgIH0pO1xyXG59KTtcclxuXHJcbkVsZW1lbnRXYXRjaGVyLmVsZW1lbnQub24oJ2JsdXInLCBTdHJpbmdCdWZmZXIuY2xlYXIpO1xyXG5FbGVtZW50V2F0Y2hlci5lbGVtZW50Lm9uKCdjbGljaycsIFN0cmluZ0J1ZmZlci5jbGVhcik7XHJcblxyXG5TdHJpbmdCdWZmZXIub24oJ2NsZWFyJywgZnVuY3Rpb24gKCkge1xyXG4gICAgVUkucmVtb3ZlRHJvcGRvd24oKTtcclxuICAgIE1hdGNoZXIucmVzZXQoKTtcclxufSk7XHJcblxyXG5TdHJpbmdCdWZmZXIub24oJ2JyZWFrJywgZnVuY3Rpb24gKCkge1xyXG4gICAgTWF0Y2hlci5jaGVja01hdGNoKCk7XHJcbn0pO1xyXG5cclxuU3RyaW5nQnVmZmVyLm9uKCdjaGFuZ2UnLCBmdW5jdGlvbiAoYnVmZmVyKSB7XHJcbiAgICBpZiAoU3RhdGUuZ2V0QmVoYXZpb3IoJ2FjdGl2ZScpKSB7XHJcbiAgICAgICAgTWF0Y2hlci51cGRhdGUoYnVmZmVyKTtcclxuICAgIH1cclxufSk7XHJcblxyXG5NYXRjaGVyLm9uKCdmbGFnc191cGRhdGUnLCBmdW5jdGlvbiAoZmxhZ3MpIHtcclxuICAgIGlmIChmbGFncy5jb2xvblN0YXJ0ICYmICFVSS5kcm9wZG93bkV4aXN0cygpKSB7XHJcbiAgICAgICAgVUkuY3JlYXRlRHJvcGRvd24oKTtcclxuICAgIH1cclxufSk7XHJcblxyXG5NYXRjaGVyLm9uKCdjb2xvbmNvZGVfdXBkYXRlJywgZnVuY3Rpb24gKGNvZGVzKSB7XHJcbiAgICBpZiAoY29kZXMgJiYgY29kZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgVUkuZHJvcGRvd25BY3Rpb24oZnVuY3Rpb24gKGRyb3Bkb3duKSB7XHJcbiAgICAgICAgICAgIGRyb3Bkb3duLnNob3coKTtcclxuICAgICAgICAgICAgZHJvcGRvd24udXBkYXRlTGlzdChjb2Rlcyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICAgIFVJLmRyb3Bkb3duQWN0aW9uKGZ1bmN0aW9uIChkcm9wZG93bikge1xyXG4gICAgICAgICAgICBkcm9wZG93bi5oaWRlKCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcbn0pO1xyXG5cclxuTWF0Y2hlci5vbignbWF0Y2gnLCByZXBsYWNlKTtcclxuTWF0Y2hlci5vbignZmxhZ3NfZG93bicsIFN0cmluZ0J1ZmZlci5jbGVhcik7XHJcblxyXG5yZXF1aXJlKCcuL21vZHVsZXMvc3RhdGUuanMnKTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnQtZW1pdHRlcicpO1xyXG5cclxudmFyIF9iZWhhdmlvciA9IHtcclxuICAgIGFjdGl2ZTogdHJ1ZSxcclxuICAgIHNob3J0Y29kZXM6IHRydWUsXHJcbiAgICBjb2xvbmNvZGVzOiB0cnVlLFxyXG4gICAgY29weTogZmFsc2VcclxufTtcclxuXHJcbnZhciBTdGF0ZSA9IHtcclxuICAgIGdldEJlaGF2aW9yOiBmdW5jdGlvbiAoa2V5KSB7XHJcbiAgICAgICAgcmV0dXJuIF9iZWhhdmlvcltrZXldO1xyXG4gICAgfSxcclxuXHJcbiAgICBzZXRCZWhhdmlvcjogZnVuY3Rpb24gKGRhdGEsIHNpbGVudCkge1xyXG4gICAgICAgIGZvciAodmFyIGsgaW4gZGF0YSkge1xyXG4gICAgICAgICAgICBpZiAoayBpbiBfYmVoYXZpb3IgJiYgZGF0YVtrXSAhPT0gX2JlaGF2aW9yW2tdKSB7XHJcbiAgICAgICAgICAgICAgICBfYmVoYXZpb3Jba10gPSBkYXRhW2tdO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICghc2lsZW50KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5lbWl0KFwiYmVoYXZpb3JfY2hhbmdlXCIsIGssIF9iZWhhdmlvcltrXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcbn07XHJcblxyXG5pZiAod2luZG93LmxvY2F0aW9uLmhvc3RuYW1lLmluZGV4T2YoJ2ZhY2Vib29rJykgIT09IC0xKSB7XHJcbiAgICBTdGF0ZS5zZXRCZWhhdmlvcih7XHJcbiAgICAgICAgY29weTogdHJ1ZSxcclxuICAgICAgICBzaG9ydGNvZGVzOiBmYWxzZVxyXG4gICAgfSwgdHJ1ZSk7XHJcbn1cclxuXHJcbmNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihmdW5jdGlvbiAocmVxdWVzdCwgc2VuZGVyLCByZXNwb25kKSB7XHJcbiAgICBpZiAocmVxdWVzdC5pZCA9PSBcInVwZGF0ZV9iZWhhdmlvclwiKSB7XHJcbiAgICAgICAgU3RhdGUuc2V0QmVoYXZpb3IocmVxdWVzdC5kYXRhKTtcclxuICAgIH1cclxufSk7XHJcblxyXG5FdmVudEVtaXR0ZXIoU3RhdGUpO1xyXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlOyIsInZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudC1lbWl0dGVyJyk7XHJcbnZhciB0d2Vtb2ppID0gcmVxdWlyZSgndHdlbW9qaScpO1xyXG52YXIgVXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzLmpzJyk7XHJcbnZhciBTdGF0ZSA9IHJlcXVpcmUoJy4vU3RhdGUuanMnKTtcclxuXHJcbmZ1bmN0aW9uIERyb3Bkb3duKHBhcmVudCkge1xyXG4gICAgdGhpcy5pdGVtcyA9IHt9O1xyXG4gICAgdGhpcy5zZWxlY3RlZEl0ZW0gPSBudWxsO1xyXG4gICAgdGhpcy5wYXJlbnQgPSBwYXJlbnQgfHwgZG9jdW1lbnQuYm9keTtcclxuXHJcbiAgICB0aGlzLmRyb3Bkb3duID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImRpdlwiKTtcclxuICAgIHRoaXMuZHJvcGRvd24uY2xhc3NMaXN0LmFkZChcInNtaWxleS1jYXJldC1kcm9wZG93blwiKTtcclxuXHJcbiAgICB0aGlzLmNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICB0aGlzLmNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKFwic21pbGV5LWNhcmV0LWNvbnRhaW5lclwiKTtcclxuICAgIHRoaXMuZHJvcGRvd24uYXBwZW5kQ2hpbGQodGhpcy5jb250YWluZXIpO1xyXG5cclxuICAgIGlmIChTdGF0ZS5nZXRCZWhhdmlvcignY29weScpKSB7XHJcbiAgICAgICAgdGhpcy5jb250YWluZXIuY2xhc3NMaXN0LmFkZChcImJlaGF2aW9yLWNvcHlcIik7XHJcbiAgICB9XHJcblxyXG4gICAgdGhpcy5wYXJlbnQuYXBwZW5kQ2hpbGQodGhpcy5kcm9wZG93bik7XHJcbn0gRHJvcGRvd24ucHJvdG90eXBlID0ge1xyXG4gICAgY3JlYXRlSXRlbTogZnVuY3Rpb24gKG5hbWUsIGVtb2ppKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaXRlbXNbbmFtZV0pIHJldHVybjtcclxuXHJcbiAgICAgICAgdmFyIGl0ZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiZGl2XCIpO1xyXG4gICAgICAgIHZhciBlbW9qaUVsZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic3BhblwiKTtcclxuICAgICAgICB2YXIgZW1vamlFbGVtQ2hhciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpXCIpO1xyXG4gICAgICAgIHZhciBlbW9qaUVsZW1JbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW1nXCIpO1xyXG4gICAgICAgIHZhciBuYW1lRWxlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJwXCIpO1xyXG5cclxuICAgICAgICBlbW9qaUVsZW1DaGFyLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGVtb2ppKSk7XHJcbiAgICAgICAgZW1vamlFbGVtLmFwcGVuZENoaWxkKGVtb2ppRWxlbUNoYXIpO1xyXG4gICAgICAgIGVtb2ppRWxlbS5hcHBlbmRDaGlsZChlbW9qaUVsZW1JbWcpO1xyXG5cclxuICAgICAgICB2YXIgaW1hZ2VNYXJrdXAgPSB0d2Vtb2ppLnBhcnNlKGVtb2ppKVxyXG4gICAgICAgICwgICBpbWFnZVNyY01hdGNoID0gL3NyY1xcPVxcXCIoLiopXFxcIi8uZXhlYyhpbWFnZU1hcmt1cClcclxuICAgICAgICAsICAgaW1hZ2VTcmMgPSAoaW1hZ2VTcmNNYXRjaCAmJiBpbWFnZVNyY01hdGNoWzFdKTtcclxuICAgICAgICBcclxuICAgICAgICBpZiAoaW1hZ2VTcmMpIHtcclxuICAgICAgICAgICAgdmFyIHRlbXBJbWFnZSA9IG5ldyBJbWFnZSgpO1xyXG4gICAgICAgICAgICB0ZW1wSW1hZ2Uub25sb2FkID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgICAgICAgICAgZW1vamlFbGVtLmNsYXNzTGlzdC5hZGQoXCJpcy1sb2FkZWRcIik7XHJcbiAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICB0ZW1wSW1hZ2Uuc3JjID0gaW1hZ2VTcmM7XHJcbiAgICAgICAgICAgIGVtb2ppRWxlbUltZy5zcmMgPSBpbWFnZVNyYztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGl0ZW0uYXBwZW5kQ2hpbGQoZW1vamlFbGVtKTtcclxuXHJcbiAgICAgICAgbmFtZUVsZW0uYXBwZW5kQ2hpbGQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUobmFtZSkpO1xyXG4gICAgICAgIGl0ZW0uYXBwZW5kQ2hpbGQobmFtZUVsZW0pO1xyXG5cclxuICAgICAgICBpdGVtLnNtaWxleUNhcmV0ID0ge1xyXG4gICAgICAgICAgICBlbW9qaTogZW1vamksXHJcbiAgICAgICAgICAgIG5hbWU6IG5hbWVcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XHJcbiAgICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwibW91c2VlbnRlclwiLCBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgICAgIHNlbGYuc2VsZWN0SXRlbSh0aGlzKTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwibW91c2Vkb3duXCIsIGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgICAgICAgICBzZWxmLnNlbGVjdEl0ZW0odGhpcyk7XHJcbiAgICAgICAgICAgIHNlbGYuY2hvb3NlSXRlbSgpO1xyXG4gICAgICAgICAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpOyAvLyB0byBwcmV2ZW50IGxvc3Mgb2YgZm9jdXNcclxuICAgICAgICAgICAgZXZlbnQuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKGl0ZW0pO1xyXG4gICAgICAgIHRoaXMuaXRlbXNbbmFtZV0gPSBpdGVtO1xyXG4gICAgfSxcclxuXHJcbiAgICBjaG9vc2VJdGVtOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICB0aGlzLnNlbGVjdGVkSXRlbSAmJlxyXG4gICAgICAgICAgICB0aGlzLnNlbGVjdGVkSXRlbS5zbWlsZXlDYXJldCAmJlxyXG4gICAgICAgICAgICB0aGlzLnNlbGVjdGVkSXRlbS5zbWlsZXlDYXJldC5lbW9qaVxyXG4gICAgICAgICkge1xyXG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2Nob29zZScsIHRoaXMuc2VsZWN0ZWRJdGVtLnNtaWxleUNhcmV0LmVtb2ppKTtcclxuICAgICAgICB9ICBcclxuICAgIH0sXHJcblxyXG4gICAgc2VsZWN0SXRlbTogZnVuY3Rpb24gKGl0ZW0pIHtcclxuICAgICAgICBpZiAodGhpcy5zZWxlY3RlZEl0ZW0pIHtcclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZEl0ZW0uY2xhc3NMaXN0LnJlbW92ZShcInNlbGVjdGVkXCIpO1xyXG4gICAgICAgICAgICB0aGlzLnNlbGVjdGVkSXRlbSA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoaXRlbSkge1xyXG4gICAgICAgICAgICBpdGVtLmNsYXNzTGlzdC5hZGQoXCJzZWxlY3RlZFwiKTtcclxuICAgICAgICAgICAgdGhpcy5zZWxlY3RlZEl0ZW0gPSBpdGVtO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgdXBkYXRlTGlzdDogZnVuY3Rpb24gKGxpc3QpIHtcclxuICAgICAgICBpZiAobGlzdC5sZW5ndGggPT09IDApIHJldHVybjtcclxuXHJcbiAgICAgICAgZm9yICh2YXIgayBpbiB0aGlzLml0ZW1zKSB7XHJcbiAgICAgICAgICAgIHRoaXMuaXRlbXNba10ucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLml0ZW1zW2tdKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBleGlzdHMgPSBmYWxzZTtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAobGlzdFtpXVsxXSA9PT0gaykge1xyXG4gICAgICAgICAgICAgICAgICAgIGV4aXN0cyA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmICghZXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgdGhpcy5pdGVtc1trXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIHZhciBlbW9qaSA9IGxpc3RbaV1bMF1cclxuICAgICAgICAgICAgLCAgIG5hbWUgPSBsaXN0W2ldWzFdO1xyXG5cclxuICAgICAgICAgICAgaWYgKHRoaXMuaXRlbXNbbmFtZV0pIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuY29udGFpbmVyLmFwcGVuZENoaWxkKHRoaXMuaXRlbXNbbmFtZV0pO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jcmVhdGVJdGVtKG5hbWUsIGVtb2ppKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKHRoaXMuY29udGFpbmVyLmZpcnN0RWxlbWVudENoaWxkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2VsZWN0SXRlbSh0aGlzLmNvbnRhaW5lci5maXJzdEVsZW1lbnRDaGlsZCk7XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICBhbGlnblRvOiBmdW5jdGlvbiAoZWxlbSkge1xyXG4gICAgICAgIHZhciBvZmZzZXQgPSBVdGlscy5nZXRFbGVtZW50Q2FyZXRPZmZzZXQoZWxlbSk7XHJcblxyXG4gICAgICAgIGlmIChvZmZzZXQpIHtcclxuICAgICAgICAgICAgdGhpcy5kcm9wZG93bi5zdHlsZS5sZWZ0ID0gb2Zmc2V0LmxlZnQgKyBcInB4XCI7XHJcbiAgICAgICAgICAgIHRoaXMuZHJvcGRvd24uc3R5bGUudG9wID0gb2Zmc2V0LnRvcCArIFwicHhcIjtcclxuXHJcbiAgICAgICAgICAgIGlmIChvZmZzZXQuZml4ZWQpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuZHJvcGRvd24uY2xhc3NMaXN0LmFkZChcImlzLWZpeGVkXCIpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kcm9wZG93bi5jbGFzc0xpc3QucmVtb3ZlKFwiaXMtZml4ZWRcIik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9LFxyXG5cclxuICAgIHNob3c6IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICB0aGlzLmFjdGl2ZSA9IHRydWU7XHJcbiAgICAgICAgdGhpcy5kcm9wZG93bi5jbGFzc0xpc3QuYWRkKFwiaXMtdmlzaWJsZVwiKTtcclxuICAgIH0sXHJcblxyXG4gICAgaGlkZTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHRoaXMuYWN0aXZlID0gZmFsc2U7XHJcbiAgICAgICAgdGhpcy5kcm9wZG93bi5jbGFzc0xpc3QucmVtb3ZlKFwiaXMtdmlzaWJsZVwiKTtcclxuICAgIH0sXHJcblxyXG4gICAgcmVtb3ZlOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgdGhpcy5oaWRlKCk7XHJcblxyXG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcclxuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgc2VsZi5kZXN0cm95KCk7XHJcbiAgICAgICAgfSwgNTAwKTtcclxuICAgIH0sXHJcblxyXG4gICAgZGVzdHJveTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmRlc3Ryb3llZCkgcmV0dXJuO1xyXG4gICAgICAgIFxyXG4gICAgICAgIGlmICh0aGlzLmRyb3Bkb3duLnBhcmVudE5vZGUpIHtcclxuICAgICAgICAgICAgdGhpcy5kcm9wZG93bi5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMuZHJvcGRvd24pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdGhpcy5wYXJlbnQgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuaXRlbXMgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuc2VsZWN0ZWRJdGVtID0gbnVsbDtcclxuICAgICAgICB0aGlzLmRyb3Bkb3duID0gbnVsbDtcclxuICAgICAgICB0aGlzLmNvbnRhaW5lciA9IG51bGw7XHJcblxyXG4gICAgICAgIHRoaXMuZGVzdHJveWVkID0gdHJ1ZTtcclxuICAgIH1cclxufTtcclxuXHJcbkV2ZW50RW1pdHRlcihEcm9wZG93bi5wcm90b3R5cGUpO1xyXG5tb2R1bGUuZXhwb3J0cyA9IERyb3Bkb3duOyIsIi8vIFRoZSB1c2VyIGNhbiBvbmx5IHR5cGUgaW4gb25lIGVsZW1lbnQgYXQgb25jZS4gV2XigJlyZSBpbnRlcmVzdGVkIGluXHJcbi8vIHJlY2VpdmluZyBhbGwga2V5Ym9hcmQgZXZlbnRzLCBubyBtYXR0ZXIgdGhlIGVsZW1lbnQuIFRoaXMgbW9kdWxlIGRvZXNcclxuLy8gdGhhdC4gSXQgaGFuZGxlcyB0aGUgY2hhbmdlIGZyb20gb25lIGVsZW1lbnQgdG8gYW5vdGhlciBieSBpbnRlcm5hbGx5XHJcbi8vIHN3aXRjaGluZyBsaXN0ZW5lcnMgYW5kIGV4cG9zaW5nIGEgc2luZ2xlIGVtaXR0ZXIgdGhhdCBlbWl0cyBldmVudHMuXHJcblxyXG52YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnQtZW1pdHRlcicpO1xyXG52YXIgTU9OSVRPUkVEX0VWRU5UUyA9IFtcclxuICAgICdrZXlkb3duJyxcclxuICAgICdrZXlwcmVzcycsXHJcbiAgICAna2V5dXAnLFxyXG4gICAgJ2JsdXInLFxyXG4gICAgJ2NsaWNrJ1xyXG5dO1xyXG5cclxuZnVuY3Rpb24gRWxlbWVudChkb21FbGVtZW50KSB7XHJcbiAgICB0aGlzLmRvbUVsZW1lbnQgPSBkb21FbGVtZW50O1xyXG4gICAgdGhpcy5ib3VuZEV2ZW50cyA9IFtdO1xyXG59IEVsZW1lbnQucHJvdG90eXBlID0ge1xyXG4gICAgYWRkRXZlbnQ6IGZ1bmN0aW9uIChrZXksIGNhbGxiYWNrKSB7XHJcbiAgICAgICAgdGhpcy5kb21FbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoa2V5LCBjYWxsYmFjayk7XHJcbiAgICAgICAgdGhpcy5ib3VuZEV2ZW50cy5wdXNoKFtrZXksIGNhbGxiYWNrXSk7XHJcbiAgICB9LFxyXG5cclxuICAgIGNsZWFyRXZlbnRzOiBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IHRoaXMuYm91bmRFdmVudHMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcclxuICAgICAgICAgICAgdmFyIGV2ZW50ID0gdGhpcy5ib3VuZEV2ZW50c1tpXTtcclxuXHJcbiAgICAgICAgICAgIHRoaXMuZG9tRWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKGV2ZW50WzBdLCBldmVudFsxXSk7XHJcbiAgICAgICAgICAgIHRoaXMuYm91bmRFdmVudHMuc3BsaWNlKGksIDEpO1xyXG4gICAgICAgIH1cclxuICAgIH0sXHJcblxyXG4gICAgZGVzdHJveTogZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmRlc3Ryb3llZCkgcmV0dXJuO1xyXG5cclxuICAgICAgICB0aGlzLmNsZWFyRXZlbnRzKCk7XHJcbiAgICAgICAgdGhpcy5kb21FbGVtZW50ID0gbnVsbDtcclxuICAgICAgICB0aGlzLmJvdW5kRXZlbnRzID0gbnVsbDtcclxuICAgICAgICB0aGlzLmRlc3Ryb3llZCA9IHRydWU7XHJcbiAgICB9XHJcbn07XHJcblxyXG52YXIgRWxlbWVudFdhdGNoZXIgPSAoZnVuY3Rpb24gKCkge1xyXG4gICAgdmFyIF9jdXJyZW50RWxlbSA9IG51bGw7XHJcbiAgICB2YXIgZG9tRW1pdHRlciA9IEV2ZW50RW1pdHRlcigpO1xyXG5cclxuICAgIGZ1bmN0aW9uIF9pbml0aWFsaXplRWxlbWVudChlbGVtZW50KSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBNT05JVE9SRURfRVZFTlRTLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGVsZW1lbnQuYWRkRXZlbnQoTU9OSVRPUkVEX0VWRU5UU1tpXSwgZnVuY3Rpb24gKGV2ZW50KSB7XHJcbiAgICAgICAgICAgICAgICBkb21FbWl0dGVyLmVtaXQoZXZlbnQudHlwZSwgZXZlbnQpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0cy5jaGFuZ2VFbGVtZW50ID0gZnVuY3Rpb24gKGRvbUVsZW1lbnQpIHtcclxuICAgICAgICB2YXIgbGFzdERvbUVsZW1lbnQgPSBudWxsXHJcbiAgICAgICAgLCAgIG5ld0RvbUVsZW1lbnQgPSBudWxsO1xyXG5cclxuICAgICAgICBpZiAoX2N1cnJlbnRFbGVtKSB7XHJcbiAgICAgICAgICAgIGxhc3REb21FbGVtZW50ID0gX2N1cnJlbnRFbGVtLmRvbUVsZW1lbnQ7XHJcbiAgICAgICAgICAgIF9jdXJyZW50RWxlbS5kZXN0cm95KCk7XHJcbiAgICAgICAgICAgIF9jdXJyZW50RWxlbSA9IG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZG9tRWxlbWVudCkge1xyXG4gICAgICAgICAgICBfY3VycmVudEVsZW0gPSBuZXcgRWxlbWVudChkb21FbGVtZW50KTtcclxuICAgICAgICAgICAgX2luaXRpYWxpemVFbGVtZW50KF9jdXJyZW50RWxlbSk7XHJcbiAgICAgICAgICAgIG5ld0RvbUVsZW1lbnQgPSBfY3VycmVudEVsZW0uZG9tRWxlbWVudDtcclxuICAgICAgICB9XHJcbiAgICAgICAgXHJcbiAgICAgICAgZXhwb3J0cy5lbWl0KCdyZWJpbmQnLCBuZXdEb21FbGVtZW50LCBsYXN0RG9tRWxlbWVudCk7XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuZ2V0RWxlbWVudCA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gKF9jdXJyZW50RWxlbSAmJiBfY3VycmVudEVsZW0uZG9tRWxlbWVudCk7XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuZWxlbWVudCA9IGRvbUVtaXR0ZXI7XHJcblxyXG4gICAgcmV0dXJuIGV4cG9ydHM7XHJcbn0pKCk7XHJcblxyXG5FdmVudEVtaXR0ZXIoRWxlbWVudFdhdGNoZXIpO1xyXG5tb2R1bGUuZXhwb3J0cyA9IEVsZW1lbnRXYXRjaGVyOyIsIi8vIENoZWNrcyB0aGUgY3VycmVudGx5IGZvY3VzZWQgZWxlbWVudCBvdmVyIHNob3J0IGludGVydmFsIGFuZCBkaXNwYXRjaGVzXHJcbi8vIGNoYW5nZXMuIFRoZSBcImZvY3VzaW5cIiBldmVudCBjYW4ndCBkbyB0aGUgam9iIGJlY2F1c2UgaXQgY2FuIGJlIGNhbmNlbGxlZC5cclxuXHJcbnZhciBFdmVudEVtaXR0ZXIgPSByZXF1aXJlKCdldmVudC1lbWl0dGVyJyk7XHJcbnZhciBJTlRFUlZBTCA9IDQwMDtcclxuXHJcbnZhciBlbWl0dGVyID0gRXZlbnRFbWl0dGVyKCk7XHJcbnZhciBfZm9jdXNlZEVsZW1lbnQgPSBudWxsO1xyXG5cclxuc2V0SW50ZXJ2YWwoZnVuY3Rpb24gKCkge1xyXG4gICAgaWYgKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQgIT09IF9mb2N1c2VkRWxlbWVudCkge1xyXG4gICAgICAgIF9mb2N1c2VkRWxlbWVudCA9IGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQ7XHJcbiAgICAgICAgZW1pdHRlci5lbWl0KCdjaGFuZ2UnLCBfZm9jdXNlZEVsZW1lbnQpO1xyXG4gICAgfVxyXG59LCBJTlRFUlZBTCk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IGVtaXR0ZXI7IiwibW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBjb2Rlczoge1xyXG4gICAgICAgIGxlZnQ6ICAgMzcsXHJcbiAgICAgICAgdXA6ICAgICAzOCxcclxuICAgICAgICByaWdodDogIDM5LFxyXG4gICAgICAgIGRvd246ICAgNDAsXHJcblxyXG4gICAgICAgIGJhY2tzcGFjZTogIDgsXHJcbiAgICAgICAgdGFiOiAgICAgICAgOSxcclxuICAgICAgICBlbnRlcjogICAgICAxMyxcclxuICAgICAgICBlc2NhcGU6ICAgICAyNyxcclxuICAgICAgICBzcGFjZTogICAgICAzMlxyXG4gICAgfSxcclxuXHJcbiAgICBpc0Fycm93S2V5OiBmdW5jdGlvbiAoY29kZSkge1xyXG4gICAgICAgIHJldHVybiBjb2RlID49IHRoaXMuY29kZXMubGVmdCAmJiBjb2RlIDw9IHRoaXMuY29kZXMuZG93bjtcclxuICAgIH1cclxufTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnQtZW1pdHRlcicpO1xyXG52YXIgU2hvcnRjb2RlcyA9IHJlcXVpcmUoJy4vc2hvcnRjb2Rlcy5qcycpO1xyXG52YXIgU3RhdGUgPSByZXF1aXJlKCcuL1N0YXRlLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgZXhwb3J0cyA9IEV2ZW50RW1pdHRlcigpO1xyXG5cclxuICAgIHZhciBfZmxhZ3MgPSB7fSxcclxuICAgICAgICBfY29sb25jb2RlcyA9IFtdO1xyXG5cclxuICAgIGZ1bmN0aW9uIHJlc2V0RmxhZ3MoKSB7XHJcbiAgICAgICAgX2ZsYWdzLnNob3J0Y29kZSA9IGZhbHNlO1xyXG4gICAgICAgIF9mbGFncy5jb2xvblN0YXJ0ID0gZmFsc2U7XHJcbiAgICAgICAgX2ZsYWdzLmNvbG9uY29kZSA9IGZhbHNlO1xyXG4gICAgICAgIGV4cG9ydHMuZW1pdCgnZmxhZ3NfdXBkYXRlJywgX2ZsYWdzKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiB1cGRhdGVDb2xvbmNvZGVzKGRhdGEpIHtcclxuICAgICAgICBfY29sb25jb2RlcyA9IGRhdGEgfHwgW107XHJcbiAgICAgICAgZXhwb3J0cy5lbWl0KCdjb2xvbmNvZGVfdXBkYXRlJywgX2NvbG9uY29kZXMpO1xyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHNlYXJjaEZvckNvbG9uY29kZXMoYnVmZmVyKSB7XHJcbiAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2Uoe1xyXG4gICAgICAgICAgICBpZDogXCJnZXRfY29sb25jb2Rlc1wiLFxyXG4gICAgICAgICAgICBzZWFyY2g6IGJ1ZmZlclxyXG4gICAgICAgIH0sIGZ1bmN0aW9uIChkYXRhKSB7XHJcbiAgICAgICAgICAgIHVwZGF0ZUNvbG9uY29kZXMoZGF0YSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gZmxhZ3NEb3duKCkge1xyXG4gICAgICAgIHZhciBhbGxEb3duID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgaWYgKFxyXG4gICAgICAgICAgICBfZmxhZ3Muc2hvcnRjb2RlICE9PSBmYWxzZSB8fFxyXG4gICAgICAgICAgICBfZmxhZ3MuY29sb25TdGFydCA9PT0gdHJ1ZSB8fCBcclxuICAgICAgICAgICAgX2ZsYWdzLmNvbG9uY29kZSAhPT0gZmFsc2VcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgYWxsRG93biA9IGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGFsbERvd247XHJcbiAgICB9XHJcblxyXG4gICAgZnVuY3Rpb24gaXNQYXJ0T2ZDb2xvbmNvZGUoYnVmZmVyKSB7XHJcbiAgICAgICAgdmFyIG1hdGNoID0gYnVmZmVyLm1hdGNoKC9eXFw6KFthLXowLTlcXC1dezMsfSlcXDo/JC8pO1xyXG5cclxuICAgICAgICBpZiAobWF0Y2ggIT09IG51bGwgJiYgbWF0Y2gubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBtYXRjaFsxXTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGZ1bmN0aW9uIHVwZGF0ZUZsYWdzKGJ1ZmZlcikge1xyXG4gICAgICAgIGlmIChTdGF0ZS5nZXRCZWhhdmlvcignY29sb25jb2RlcycpKSB7XHJcbiAgICAgICAgICAgIGlmIChidWZmZXIubGVuZ3RoID09PSAxICYmIGJ1ZmZlclswXSA9PT0gXCI6XCIpIHtcclxuICAgICAgICAgICAgICAgIF9mbGFncy5jb2xvblN0YXJ0ID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgaWYgKF9mbGFncy5jb2xvblN0YXJ0KSB7XHJcbiAgICAgICAgICAgICAgICBfZmxhZ3MuY29sb25jb2RlID0gaXNQYXJ0T2ZDb2xvbmNvZGUoYnVmZmVyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgaWYgKFN0YXRlLmdldEJlaGF2aW9yKCdzaG9ydGNvZGVzJykpIHtcclxuICAgICAgICAgICAgX2ZsYWdzLnNob3J0Y29kZSA9IFNob3J0Y29kZXMuaXNQYXJ0KGJ1ZmZlcikgPyBidWZmZXIgOiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGV4cG9ydHMuZW1pdCgnZmxhZ3NfdXBkYXRlJywgX2ZsYWdzKTtcclxuICAgIH1cclxuXHJcbiAgICBleHBvcnRzLnJlc2V0ID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJlc2V0RmxhZ3MoKTtcclxuICAgICAgICB1cGRhdGVDb2xvbmNvZGVzKG51bGwpO1xyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLmNoZWNrTWF0Y2ggPSBmdW5jdGlvbiAoYnVmZmVyKSB7XHJcbiAgICAgICAgaWYgKF9mbGFncy5zaG9ydGNvZGUpIHtcclxuICAgICAgICAgICAgdmFyIHNob3J0Y29kZSA9IFNob3J0Y29kZXMuZ2V0KF9mbGFncy5zaG9ydGNvZGUpO1xyXG5cclxuICAgICAgICAgICAgaWYgKHNob3J0Y29kZSAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgZXhwb3J0cy5lbWl0KCdtYXRjaCcsIHNob3J0Y29kZSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmIChfZmxhZ3MuY29sb25jb2RlKSB7XHJcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgX2NvbG9uY29kZXMubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGlmIChfY29sb25jb2Rlc1tpXVswXSA9PT0gX2ZsYWdzLmNvbG9uY29kZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGV4cG9ydHMuZW1pdCgnbWF0Y2gnLCBfY29sb25jb2Rlc1tpXVsxXSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9ICAgXHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMudXBkYXRlID0gZnVuY3Rpb24gKGJ1ZmZlcikge1xyXG4gICAgICAgIHVwZGF0ZUZsYWdzKGJ1ZmZlcik7XHJcblxyXG4gICAgICAgIGlmIChmbGFnc0Rvd24oKSkge1xyXG4gICAgICAgICAgICBleHBvcnRzLmVtaXQoJ2ZsYWdzX2Rvd24nKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBpZiAoX2ZsYWdzLmNvbG9uY29kZSkge1xyXG4gICAgICAgICAgICAgICAgc2VhcmNoRm9yQ29sb25jb2RlcyhfZmxhZ3MuY29sb25jb2RlKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHVwZGF0ZUNvbG9uY29kZXMobnVsbCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIHJlc2V0RmxhZ3MoKTtcclxuXHJcbiAgICByZXR1cm4gZXhwb3J0cztcclxufSkoKTsiLCJ2YXIgU3RhdGUgPSByZXF1aXJlKCcuL1N0YXRlLmpzJyk7XHJcbnZhciBVdGlscyA9IHJlcXVpcmUoJy4vdXRpbHMuanMnKTtcclxudmFyIEVsZW1lbnRXYXRjaGVyID0gcmVxdWlyZSgnLi9lbGVtZW50LXdhdGNoZXIuanMnKTtcclxudmFyIFN0cmluZ0J1ZmZlciA9IHJlcXVpcmUoJy4vc3RyaW5nLWJ1ZmZlci5qcycpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZW1vamkpIHtcclxuICAgIHZhciBlbGVtZW50ID0gRWxlbWVudFdhdGNoZXIuZ2V0RWxlbWVudCgpO1xyXG4gICAgdmFyIHNlYXJjaCA9IFN0cmluZ0J1ZmZlci5nZXRCdWZmZXIoKTtcclxuICAgIHZhciBjb3B5QmVoYXZpb3IgPSBTdGF0ZS5nZXRCZWhhdmlvcignY29weScpO1xyXG5cclxuICAgIGlmICghZWxlbWVudCkge1xyXG4gICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZWxlbWVudC5oYXNBdHRyaWJ1dGUoXCJjb250ZW50ZWRpdGFibGVcIikpIHtcclxuICAgICAgICBpZiAoY29weUJlaGF2aW9yKSB7XHJcbiAgICAgICAgICAgIFV0aWxzLmNsaXBXaXRoU2VsZWN0aW9uKGVtb2ppKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIFV0aWxzLnNlYXJjaFNlbGVjdGlvbihzZWFyY2gsIGZ1bmN0aW9uIChyZXN1bHQpIHtcclxuICAgICAgICAgICAgdmFyIHJhbmdlID0gcmVzdWx0LnNlbGVjdGlvbi5nZXRSYW5nZUF0KHJlc3VsdC5zZWxlY3Rpb24ucmFuZ2VDb3VudCAtIDEpO1xyXG4gICAgICAgICAgICByYW5nZS5zZXRTdGFydChyZXN1bHQubm9kZSwgcmVzdWx0LnN0YXJ0KTtcclxuICAgICAgICAgICAgcmFuZ2Uuc2V0RW5kKHJlc3VsdC5ub2RlLCByZXN1bHQuZW5kKTtcclxuXHJcbiAgICAgICAgICAgIC8vIElmIHRoZSBiZWhhdmlvciBpcyBjb3B5LCBpdCBzaG91bGQgb25seSBzZWxlY3QgdGhlIG1hdGNoLiBJZlxyXG4gICAgICAgICAgICAvLyBpdOKAmXMgbm90IC0gaXQgc2hvdWxkIGFsc28gcmVwbGFjZSBpdCB3aXRoIHRoZSBlbW9qaS5cclxuICAgICAgICAgICAgaWYgKCFjb3B5QmVoYXZpb3IpIHtcclxuICAgICAgICAgICAgICAgIHJhbmdlLmRlbGV0ZUNvbnRlbnRzKCk7XHJcbiAgICAgICAgICAgICAgICByYW5nZS5pbnNlcnROb2RlKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGVtb2ppKSk7XHJcblxyXG4gICAgICAgICAgICAgICAgcmVzdWx0Lm5vZGUucGFyZW50Tm9kZS5ub3JtYWxpemUoKTtcclxuICAgICAgICAgICAgICAgIHJlc3VsdC5ub2RlLnBhcmVudEVsZW1lbnQubm9ybWFsaXplKCk7XHJcbiAgICAgICAgICAgICAgICByZXN1bHQuc2VsZWN0aW9uLmNvbGxhcHNlVG9FbmQoKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgICBVdGlscy5zZWFyY2hJbnB1dChlbGVtZW50LCBzZWFyY2gsIGZ1bmN0aW9uIChyZXN1bHQpIHtcclxuICAgICAgICAgICAgaWYgKGNvcHlCZWhhdmlvcikge1xyXG4gICAgICAgICAgICAgICAgLy8gY2xpcFdpdGhTZWxlY3Rpb24oKSByZW1vdmVzIHRoZSBjYXJldCBwb3NpdGlvbiwgc28gaXQgbXVzdFxyXG4gICAgICAgICAgICAgICAgLy8gYmUgZG9uZSBhZnRlciB0aGUgc3RhcnQgYW5kIGVuZCBvZiB0aGUgbWF0Y2ggaXMgZm91bmQsIEkuRS5cclxuICAgICAgICAgICAgICAgIC8vIGluIHRoZSBjYWxsYmFjay5cclxuICAgICAgICAgICAgICAgIFV0aWxzLmNsaXBXaXRoU2VsZWN0aW9uKGVtb2ppKTtcclxuXHJcbiAgICAgICAgICAgICAgICBlbGVtZW50LnNlbGVjdGlvblN0YXJ0ID0gcmVzdWx0LnN0YXJ0O1xyXG4gICAgICAgICAgICAgICAgZWxlbWVudC5zZWxlY3Rpb25FbmQgPSByZXN1bHQuZW5kO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgZWxlbWVudC52YWx1ZSA9IHJlc3VsdC5iZWZvcmUgKyBlbW9qaSArIHJlc3VsdC5hZnRlcjtcclxuICAgICAgICAgICAgICAgIGVsZW1lbnQuc2VsZWN0aW9uRW5kID0gcmVzdWx0LmJlZm9yZS5sZW5ndGggKyBlbW9qaS5sZW5ndGg7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBTdHJpbmdCdWZmZXIuY2xlYXIoKTtcclxufTsiLCJ2YXIgU2hvcnRjb2RlcyA9IHJlcXVpcmUoJ3NtaWxleS1jYXJldC1kYXRhL3Nob3J0Y29kZXMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBleHBvcnRzID0ge307XHJcblxyXG4gICAgdmFyIF9zZXRzID0gZ2V0U2V0cyhTaG9ydGNvZGVzKTtcclxuXHJcbiAgICBmdW5jdGlvbiBnZXRTZXRzKGxpc3QpIHtcclxuICAgICAgICB2YXIgc2V0cyA9IFtdO1xyXG5cclxuICAgICAgICBmb3IgKHZhciBjb2RlIGluIGxpc3QpIHtcclxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb2RlLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgICAgICBzZXRzW2ldID0gc2V0c1tpXSB8fCBbXTtcclxuXHJcbiAgICAgICAgICAgICAgICBpZiAoc2V0c1tpXS5pbmRleE9mKGNvZGVbaV0pID09PSAtMSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHNldHNbaV0ucHVzaChjb2RlW2ldKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHNldHM7XHJcbiAgICB9XHJcblxyXG4gICAgZXhwb3J0cy5pc1BhcnQgPSBmdW5jdGlvbiAoc3RyKSB7XHJcbiAgICAgICAgZm9yICh2YXIgaSA9IHN0ci5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xyXG4gICAgICAgICAgICBpZiAoIV9zZXRzW2ldIHx8IF9zZXRzW2ldLmluZGV4T2Yoc3RyW2ldKSA9PT0gLTEpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuZ2V0ID0gZnVuY3Rpb24gKGtleSkge1xyXG4gICAgICAgIGlmIChTaG9ydGNvZGVzW2tleV0pIHtcclxuICAgICAgICAgICAgcmV0dXJuIFNob3J0Y29kZXNba2V5XTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuZ2V0QWxsID0gZnVuY3Rpb24gKCkge1xyXG4gICAgICAgIHJldHVybiBTaG9ydGNvZGVzO1xyXG4gICAgfTtcclxuXHJcbiAgICByZXR1cm4gZXhwb3J0cztcclxufSkoKTsiLCJ2YXIgRXZlbnRFbWl0dGVyID0gcmVxdWlyZSgnZXZlbnQtZW1pdHRlcicpO1xyXG52YXIgU3RhdGUgPSByZXF1aXJlKCcuL1N0YXRlLmpzJyk7XHJcbnZhciBVdGlscyA9IHJlcXVpcmUoJy4vdXRpbHMuanMnKTtcclxudmFyIEtleXMgPSByZXF1aXJlKCcuL2tleXMuanMnKTtcclxuXHJcbm1vZHVsZS5leHBvcnRzID0gKGZ1bmN0aW9uICgpIHtcclxuICAgIHZhciBleHBvcnRzID0gRXZlbnRFbWl0dGVyKCk7XHJcblxyXG4gICAgdmFyIF9idWZmZXIgPSBcIlwiO1xyXG5cclxuICAgIGZ1bmN0aW9uIGNoYW5nZShtdXRhdG9yLCBzaWxlbnQpIHtcclxuICAgICAgICB2YXIgY2FjaGUgPSBfYnVmZmVyO1xyXG4gICAgICAgIF9idWZmZXIgPSBtdXRhdG9yKF9idWZmZXIpO1xyXG5cclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgIF9idWZmZXIgIT09IGNhY2hlICYmXHJcbiAgICAgICAgICAgIHR5cGVvZiBfYnVmZmVyID09IFwic3RyaW5nXCJcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgaWYgKHNpbGVudCAhPT0gdHJ1ZSkge1xyXG4gICAgICAgICAgICAgICAgZXhwb3J0cy5lbWl0KCdjaGFuZ2UnLCBfYnVmZmVyLCBjYWNoZSk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChfYnVmZmVyLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgZXhwb3J0cy5lbWl0KCdjbGVhcicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydHMuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgY2hhbmdlKGZ1bmN0aW9uICgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIFwiXCI7XHJcbiAgICAgICAgfSwgdHJ1ZSk7XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuaGFuZGxlS2V5UHJlc3MgPSBmdW5jdGlvbiAoZXZlbnQpIHtcclxuICAgICAgICBjaGFuZ2UoZnVuY3Rpb24gKGJ1ZmZlcikge1xyXG4gICAgICAgICAgICBpZiAoZXZlbnQud2hpY2ggIT09IEtleXMuY29kZXMuc3BhY2UpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBidWZmZXIgKyBldmVudC5rZXk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYnVmZmVyO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuaGFuZGxlS2V5RG93biA9IGZ1bmN0aW9uIChldmVudCkge1xyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgICAgZXZlbnQud2hpY2ggPT09IEtleXMuY29kZXMuZW50ZXIgfHxcclxuICAgICAgICAgICAgZXZlbnQud2hpY2ggPT09IEtleXMuY29kZXMuc3BhY2VcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgZXhwb3J0cy5lbWl0KCdicmVhaycsIF9idWZmZXIpO1xyXG4gICAgICAgICAgICBleHBvcnRzLmNsZWFyKCk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2VsZWN0aW9uIGlzIG5vdCBhIHNpbmdsZSBjaGFyYWN0ZXIgKGN0cmwrQSlcclxuICAgICAgICBpZiAoS2V5cy5pc0Fycm93S2V5KGV2ZW50LndoaWNoKSB8fCAhKHdpbmRvdy5nZXRTZWxlY3Rpb24oKS5pc0NvbGxhcHNlZCkpIHtcclxuICAgICAgICAgICAgZXhwb3J0cy5jbGVhcigpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoZXZlbnQud2hpY2ggPT09IEtleXMuY29kZXMuYmFja3NwYWNlKSB7XHJcbiAgICAgICAgICAgIGNoYW5nZShmdW5jdGlvbiAoYnVmZmVyKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gYnVmZmVyLnNsaWNlKDAsIC0xKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfTtcclxuXHJcbiAgICBleHBvcnRzLmdldEJ1ZmZlciA9IGZ1bmN0aW9uICgpIHtcclxuICAgICAgICByZXR1cm4gX2J1ZmZlcjtcclxuICAgIH07XHJcblxyXG4gICAgcmV0dXJuIGV4cG9ydHM7XHJcbn0pKCk7XHJcblxyXG5TdGF0ZS5vbignYmVoYXZpb3JfY2hhbmdlJywgZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcclxuICAgIGlmIChrZXkgPT0gJ2FjdGl2ZScgJiYgdmFsdWUgPT0gZmFsc2UpIHtcclxuICAgICAgICBtb2R1bGUuZXhwb3J0cy5jbGVhcigpO1xyXG4gICAgfVxyXG59KTsiLCIvLyBTb3VyY2U6IGh0dHBzOi8vZ2l0aHViLmNvbS9jb21wb25lbnQvdGV4dGFyZWEtY2FyZXQtcG9zaXRpb24vYmxvYi9tYXN0ZXIvaW5kZXguanNcclxuLy8gQ2hhbmdlICgxKSByZW1vdmVkIHRoZSBkb3QgKG5vdCBuZWVkZWQgaW4gQ2hyb21lKSBmb3IgYmV0dGVyIGFjY3VyYWN5XHJcblxyXG4vKiBqc2hpbnQgYnJvd3NlcjogdHJ1ZSAqL1xyXG5cclxuKGZ1bmN0aW9uICgpIHtcclxuXHJcbi8vIFdlJ2xsIGNvcHkgdGhlIHByb3BlcnRpZXMgYmVsb3cgaW50byB0aGUgbWlycm9yIGRpdi5cclxuLy8gTm90ZSB0aGF0IHNvbWUgYnJvd3NlcnMsIHN1Y2ggYXMgRmlyZWZveCwgZG8gbm90IGNvbmNhdGVuYXRlIHByb3BlcnRpZXNcclxuLy8gaW50byB0aGVpciBzaG9ydGhhbmQgKGUuZy4gcGFkZGluZy10b3AsIHBhZGRpbmctYm90dG9tIGV0Yy4gLT4gcGFkZGluZyksXHJcbi8vIHNvIHdlIGhhdmUgdG8gbGlzdCBldmVyeSBzaW5nbGUgcHJvcGVydHkgZXhwbGljaXRseS5cclxudmFyIHByb3BlcnRpZXMgPSBbXHJcbiAgJ2RpcmVjdGlvbicsICAvLyBSVEwgc3VwcG9ydFxyXG4gICdib3hTaXppbmcnLFxyXG4gICd3aWR0aCcsICAvLyBvbiBDaHJvbWUgYW5kIElFLCBleGNsdWRlIHRoZSBzY3JvbGxiYXIsIHNvIHRoZSBtaXJyb3IgZGl2IHdyYXBzIGV4YWN0bHkgYXMgdGhlIHRleHRhcmVhIGRvZXNcclxuICAnaGVpZ2h0JyxcclxuICAnb3ZlcmZsb3dYJyxcclxuICAnb3ZlcmZsb3dZJywgIC8vIGNvcHkgdGhlIHNjcm9sbGJhciBmb3IgSUVcclxuXHJcbiAgJ2JvcmRlclRvcFdpZHRoJyxcclxuICAnYm9yZGVyUmlnaHRXaWR0aCcsXHJcbiAgJ2JvcmRlckJvdHRvbVdpZHRoJyxcclxuICAnYm9yZGVyTGVmdFdpZHRoJyxcclxuICAnYm9yZGVyU3R5bGUnLFxyXG5cclxuICAncGFkZGluZ1RvcCcsXHJcbiAgJ3BhZGRpbmdSaWdodCcsXHJcbiAgJ3BhZGRpbmdCb3R0b20nLFxyXG4gICdwYWRkaW5nTGVmdCcsXHJcblxyXG4gIC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0NTUy9mb250XHJcbiAgJ2ZvbnRTdHlsZScsXHJcbiAgJ2ZvbnRWYXJpYW50JyxcclxuICAnZm9udFdlaWdodCcsXHJcbiAgJ2ZvbnRTdHJldGNoJyxcclxuICAnZm9udFNpemUnLFxyXG4gICdmb250U2l6ZUFkanVzdCcsXHJcbiAgJ2xpbmVIZWlnaHQnLFxyXG4gICdmb250RmFtaWx5JyxcclxuXHJcbiAgJ3RleHRBbGlnbicsXHJcbiAgJ3RleHRUcmFuc2Zvcm0nLFxyXG4gICd0ZXh0SW5kZW50JyxcclxuICAndGV4dERlY29yYXRpb24nLCAgLy8gbWlnaHQgbm90IG1ha2UgYSBkaWZmZXJlbmNlLCBidXQgYmV0dGVyIGJlIHNhZmVcclxuXHJcbiAgJ2xldHRlclNwYWNpbmcnLFxyXG4gICd3b3JkU3BhY2luZycsXHJcblxyXG4gICd0YWJTaXplJyxcclxuICAnTW96VGFiU2l6ZSdcclxuXHJcbl07XHJcblxyXG52YXIgaXNCcm93c2VyID0gKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnKTtcclxudmFyIGlzRmlyZWZveCA9IChpc0Jyb3dzZXIgJiYgd2luZG93Lm1veklubmVyU2NyZWVuWCAhPSBudWxsKTtcclxuXHJcbmZ1bmN0aW9uIGdldENhcmV0Q29vcmRpbmF0ZXMoZWxlbWVudCwgcG9zaXRpb24sIG9wdGlvbnMpIHtcclxuICBpZiAoIWlzQnJvd3Nlcikge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKCd0ZXh0YXJlYS1jYXJldC1wb3NpdGlvbiNnZXRDYXJldENvb3JkaW5hdGVzIHNob3VsZCBvbmx5IGJlIGNhbGxlZCBpbiBhIGJyb3dzZXInKTtcclxuICB9XHJcblxyXG4gIHZhciBkZWJ1ZyA9IG9wdGlvbnMgJiYgb3B0aW9ucy5kZWJ1ZyB8fCBmYWxzZTtcclxuICBpZiAoZGVidWcpIHtcclxuICAgIHZhciBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNpbnB1dC10ZXh0YXJlYS1jYXJldC1wb3NpdGlvbi1taXJyb3ItZGl2Jyk7XHJcbiAgICBpZiAoZWwpIGVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZWwpO1xyXG4gIH1cclxuXHJcbiAgLy8gVGhlIG1pcnJvciBkaXYgd2lsbCByZXBsaWNhdGUgdGhlIHRleHRhcmVhJ3Mgc3R5bGVcclxuICB2YXIgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgZGl2LmlkID0gJ2lucHV0LXRleHRhcmVhLWNhcmV0LXBvc2l0aW9uLW1pcnJvci1kaXYnO1xyXG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoZGl2KTtcclxuXHJcbiAgdmFyIHN0eWxlID0gZGl2LnN0eWxlO1xyXG4gIHZhciBjb21wdXRlZCA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlID8gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbWVudCkgOiBlbGVtZW50LmN1cnJlbnRTdHlsZTsgIC8vIGN1cnJlbnRTdHlsZSBmb3IgSUUgPCA5XHJcbiAgdmFyIGlzSW5wdXQgPSBlbGVtZW50Lm5vZGVOYW1lID09PSAnSU5QVVQnO1xyXG5cclxuICAvLyBEZWZhdWx0IHRleHRhcmVhIHN0eWxlc1xyXG4gIHN0eWxlLndoaXRlU3BhY2UgPSAncHJlLXdyYXAnO1xyXG4gIGlmICghaXNJbnB1dClcclxuICAgIHN0eWxlLndvcmRXcmFwID0gJ2JyZWFrLXdvcmQnOyAgLy8gb25seSBmb3IgdGV4dGFyZWEtc1xyXG5cclxuICAvLyBQb3NpdGlvbiBvZmYtc2NyZWVuXHJcbiAgc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnOyAgLy8gcmVxdWlyZWQgdG8gcmV0dXJuIGNvb3JkaW5hdGVzIHByb3Blcmx5XHJcbiAgaWYgKCFkZWJ1ZylcclxuICAgIHN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJzsgIC8vIG5vdCAnZGlzcGxheTogbm9uZScgYmVjYXVzZSB3ZSB3YW50IHJlbmRlcmluZ1xyXG5cclxuICAvLyBUcmFuc2ZlciB0aGUgZWxlbWVudCdzIHByb3BlcnRpZXMgdG8gdGhlIGRpdlxyXG4gIHByb3BlcnRpZXMuZm9yRWFjaChmdW5jdGlvbiAocHJvcCkge1xyXG4gICAgaWYgKGlzSW5wdXQgJiYgcHJvcCA9PT0gJ2xpbmVIZWlnaHQnKSB7XHJcbiAgICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgPGlucHV0PnMgYmVjYXVzZSB0ZXh0IGlzIHJlbmRlcmVkIGNlbnRlcmVkIGFuZCBsaW5lIGhlaWdodCBtYXkgYmUgIT0gaGVpZ2h0XHJcbiAgICAgIHN0eWxlLmxpbmVIZWlnaHQgPSBjb21wdXRlZC5oZWlnaHQ7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBzdHlsZVtwcm9wXSA9IGNvbXB1dGVkW3Byb3BdO1xyXG4gICAgfVxyXG4gIH0pO1xyXG5cclxuICBpZiAoaXNGaXJlZm94KSB7XHJcbiAgICAvLyBGaXJlZm94IGxpZXMgYWJvdXQgdGhlIG92ZXJmbG93IHByb3BlcnR5IGZvciB0ZXh0YXJlYXM6IGh0dHBzOi8vYnVnemlsbGEubW96aWxsYS5vcmcvc2hvd19idWcuY2dpP2lkPTk4NDI3NVxyXG4gICAgaWYgKGVsZW1lbnQuc2Nyb2xsSGVpZ2h0ID4gcGFyc2VJbnQoY29tcHV0ZWQuaGVpZ2h0KSlcclxuICAgICAgc3R5bGUub3ZlcmZsb3dZID0gJ3Njcm9sbCc7XHJcbiAgfSBlbHNlIHtcclxuICAgIHN0eWxlLm92ZXJmbG93ID0gJ2hpZGRlbic7ICAvLyBmb3IgQ2hyb21lIHRvIG5vdCByZW5kZXIgYSBzY3JvbGxiYXI7IElFIGtlZXBzIG92ZXJmbG93WSA9ICdzY3JvbGwnXHJcbiAgfVxyXG5cclxuICBkaXYudGV4dENvbnRlbnQgPSBlbGVtZW50LnZhbHVlLnN1YnN0cmluZygwLCBwb3NpdGlvbik7XHJcbiAgLy8gVGhlIHNlY29uZCBzcGVjaWFsIGhhbmRsaW5nIGZvciBpbnB1dCB0eXBlPVwidGV4dFwiIHZzIHRleHRhcmVhOlxyXG4gIC8vIHNwYWNlcyBuZWVkIHRvIGJlIHJlcGxhY2VkIHdpdGggbm9uLWJyZWFraW5nIHNwYWNlcyAtIGh0dHA6Ly9zdGFja292ZXJmbG93LmNvbS9hLzEzNDAyMDM1LzEyNjkwMzdcclxuICBpZiAoaXNJbnB1dClcclxuICAgIGRpdi50ZXh0Q29udGVudCA9IGRpdi50ZXh0Q29udGVudC5yZXBsYWNlKC9cXHMvZywgJ1xcdTAwYTAnKTtcclxuXHJcbiAgdmFyIHNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgLy8gV3JhcHBpbmcgbXVzdCBiZSByZXBsaWNhdGVkICpleGFjdGx5KiwgaW5jbHVkaW5nIHdoZW4gYSBsb25nIHdvcmQgZ2V0c1xyXG4gIC8vIG9udG8gdGhlIG5leHQgbGluZSwgd2l0aCB3aGl0ZXNwYWNlIGF0IHRoZSBlbmQgb2YgdGhlIGxpbmUgYmVmb3JlICgjNykuXHJcbiAgLy8gVGhlICAqb25seSogcmVsaWFibGUgd2F5IHRvIGRvIHRoYXQgaXMgdG8gY29weSB0aGUgKmVudGlyZSogcmVzdCBvZiB0aGVcclxuICAvLyB0ZXh0YXJlYSdzIGNvbnRlbnQgaW50byB0aGUgPHNwYW4+IGNyZWF0ZWQgYXQgdGhlIGNhcmV0IHBvc2l0aW9uLlxyXG4gIC8vIEZvciBpbnB1dHMsIGp1c3QgJy4nIHdvdWxkIGJlIGVub3VnaCwgYnV0IG5vIG5lZWQgdG8gYm90aGVyLlxyXG4gIHNwYW4udGV4dENvbnRlbnQgPSBlbGVtZW50LnZhbHVlLnN1YnN0cmluZyhwb3NpdGlvbikgfHwgJyc7ICAvLyBDSEFOR0UgKDEpXHJcbiAgZGl2LmFwcGVuZENoaWxkKHNwYW4pO1xyXG5cclxuICB2YXIgY29vcmRpbmF0ZXMgPSB7XHJcbiAgICB0b3A6IHNwYW4ub2Zmc2V0VG9wICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlclRvcFdpZHRoJ10pLFxyXG4gICAgbGVmdDogc3Bhbi5vZmZzZXRMZWZ0ICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlckxlZnRXaWR0aCddKSxcclxuICAgIGhlaWdodDogcGFyc2VJbnQoY29tcHV0ZWRbJ2xpbmVIZWlnaHQnXSlcclxuICB9O1xyXG5cclxuICBpZiAoZGVidWcpIHtcclxuICAgIHNwYW4uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyNhYWEnO1xyXG4gIH0gZWxzZSB7XHJcbiAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGRpdik7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gY29vcmRpbmF0ZXM7XHJcbn1cclxuXHJcbmlmICh0eXBlb2YgbW9kdWxlICE9ICd1bmRlZmluZWQnICYmIHR5cGVvZiBtb2R1bGUuZXhwb3J0cyAhPSAndW5kZWZpbmVkJykge1xyXG4gIG1vZHVsZS5leHBvcnRzID0gZ2V0Q2FyZXRDb29yZGluYXRlcztcclxufSBlbHNlIGlmKGlzQnJvd3Nlcikge1xyXG4gIHdpbmRvdy5nZXRDYXJldENvb3JkaW5hdGVzID0gZ2V0Q2FyZXRDb29yZGluYXRlcztcclxufVxyXG5cclxufSgpKTsiLCJ2YXIgRHJvcGRvd24gPSByZXF1aXJlKCcuL2Ryb3Bkb3duLmpzJyk7XHJcbnZhciByZXBsYWNlID0gcmVxdWlyZSgnLi9yZXBsYWNlLmpzJyk7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IChmdW5jdGlvbiAoKSB7XHJcbiAgICB2YXIgZXhwb3J0cyA9IHt9O1xyXG5cclxuICAgIHZhciBfZHJvcGRvd24gPSBudWxsO1xyXG5cclxuICAgIGZ1bmN0aW9uIGV4aXN0cygpIHtcclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICBfZHJvcGRvd24gJiZcclxuICAgICAgICAgICAgX2Ryb3Bkb3duIGluc3RhbmNlb2YgRHJvcGRvd24gJiZcclxuICAgICAgICAgICAgIV9kcm9wZG93bi5kZXN0cm95ZWRcclxuICAgICAgICApO1xyXG4gICAgfVxyXG5cclxuICAgIGV4cG9ydHMuY3JlYXRlRHJvcGRvd24gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKCFleGlzdHMoKSkge1xyXG4gICAgICAgICAgICBfZHJvcGRvd24gPSBuZXcgRHJvcGRvd24oKTtcclxuICAgICAgICAgICAgX2Ryb3Bkb3duLm9uKCdjaG9vc2UnLCBmdW5jdGlvbiAoZW1vamkpIHtcclxuICAgICAgICAgICAgICAgIHJlcGxhY2UoZW1vamksIHRydWUpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuZHJvcGRvd25BY3Rpb24gPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcclxuICAgICAgICBpZiAoZXhpc3RzKCkpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2soX2Ryb3Bkb3duKTtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMucmVtb3ZlRHJvcGRvd24gPSBmdW5jdGlvbiAoKSB7XHJcbiAgICAgICAgaWYgKGV4aXN0cygpKSB7XHJcbiAgICAgICAgICAgIF9kcm9wZG93bi5yZW1vdmUoKTtcclxuICAgICAgICAgICAgX2Ryb3Bkb3duID0gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9O1xyXG5cclxuICAgIGV4cG9ydHMuZHJvcGRvd25FeGlzdHMgPSBleGlzdHM7XHJcblxyXG4gICAgcmV0dXJuIGV4cG9ydHM7XHJcbn0pKCk7IiwidmFyIGZuVGV4dGFyZWFDYXJldFBvc2l0aW9uID0gcmVxdWlyZSgnLi90ZXh0YXJlYS1jYXJldC1wb3NpdGlvbi5qcycpO1xyXG5cclxubW9kdWxlLmV4cG9ydHMgPSB7XHJcbiAgICBzZWFyY2hJbnB1dDogZnVuY3Rpb24gKGVsZW0sIHNlYXJjaCwgY2FsbGJhY2spIHtcclxuICAgICAgICBpZiAoXHJcbiAgICAgICAgICAgICFlbGVtIHx8XHJcbiAgICAgICAgICAgIHR5cGVvZiBlbGVtLnZhbHVlICE9IFwic3RyaW5nXCIgfHxcclxuICAgICAgICAgICAgdHlwZW9mIGVsZW0uc2VsZWN0aW9uRW5kICE9IFwibnVtYmVyXCJcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIHZhbHVlID0gZWxlbS52YWx1ZVxyXG4gICAgICAgICwgICBlbmRJbmRleCA9IGVsZW0uc2VsZWN0aW9uRW5kXHJcbiAgICAgICAgLCAgIHN0YXJ0SW5kZXggPSBlbmRJbmRleCAtIHNlYXJjaC5sZW5ndGg7XHJcblxyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgICAgc3RhcnRJbmRleCA8IDAgfHxcclxuICAgICAgICAgICAgZW5kSW5kZXggPCBzdGFydEluZGV4IHx8XHJcbiAgICAgICAgICAgIHZhbHVlLnN1YnN0cmluZyhzdGFydEluZGV4LCBlbmRJbmRleCkgIT0gc2VhcmNoXHJcbiAgICAgICAgKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBjYWxsYmFjayh7XHJcbiAgICAgICAgICAgIHN0YXJ0OiBzdGFydEluZGV4LFxyXG4gICAgICAgICAgICBlbmQ6IGVuZEluZGV4LFxyXG4gICAgICAgICAgICBiZWZvcmU6IHZhbHVlLnN1YnN0cmluZygwLCBzdGFydEluZGV4KSxcclxuICAgICAgICAgICAgYWZ0ZXI6IHZhbHVlLnN1YnN0cmluZyhlbmRJbmRleClcclxuICAgICAgICB9KTtcclxuICAgIH0sXHJcblxyXG4gICAgc2VhcmNoU2VsZWN0aW9uOiBmdW5jdGlvbiAoc2VhcmNoLCBjYWxsYmFjaykge1xyXG4gICAgICAgIHZhciBzZWxlY3Rpb24gPSB3aW5kb3cuZ2V0U2VsZWN0aW9uKCk7XHJcblxyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgICAgIXNlbGVjdGlvbiB8fFxyXG4gICAgICAgICAgICAhc2VsZWN0aW9uLmZvY3VzTm9kZSB8fFxyXG4gICAgICAgICAgICAhc2VsZWN0aW9uLmZvY3VzTm9kZS5ub2RlVmFsdWVcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgdmFyIG5vZGUgPSBzZWxlY3Rpb24uZm9jdXNOb2RlXHJcbiAgICAgICAgLCAgIGVuZEluZGV4ID0gc2VsZWN0aW9uLmZvY3VzT2Zmc2V0XHJcbiAgICAgICAgLCAgIHN0YXJ0SW5kZXggPSBlbmRJbmRleCAtIHNlYXJjaC5sZW5ndGg7XHJcblxyXG4gICAgICAgIGlmIChcclxuICAgICAgICAgICAgc3RhcnRJbmRleCA8IDAgfHxcclxuICAgICAgICAgICAgZW5kSW5kZXggPCBzdGFydEluZGV4IHx8XHJcbiAgICAgICAgICAgIHNlbGVjdGlvbi5yYW5nZUNvdW50ID09IDAgfHxcclxuICAgICAgICAgICAgbm9kZS5ub2RlVmFsdWUuc3Vic3RyaW5nKHN0YXJ0SW5kZXgsIGVuZEluZGV4KSAhPSBzZWFyY2hcclxuICAgICAgICApIHtcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKHtcclxuICAgICAgICAgICAgc2VsZWN0aW9uOiBzZWxlY3Rpb24sXHJcbiAgICAgICAgICAgIG5vZGU6IG5vZGUsXHJcbiAgICAgICAgICAgIHN0YXJ0OiBzdGFydEluZGV4LFxyXG4gICAgICAgICAgICBlbmQ6IGVuZEluZGV4XHJcbiAgICAgICAgfSk7XHJcbiAgICB9LFxyXG5cclxuICAgIGlzRWxlbWVudEVkaXRhYmxlOiBmdW5jdGlvbiAoZWxlbSkge1xyXG4gICAgICAgIHJldHVybiAoZWxlbSAmJiAoXHJcbiAgICAgICAgICAgIGVsZW0uaGFzQXR0cmlidXRlKFwiY29udGVudGVkaXRhYmxlXCIpIHx8XHJcbiAgICAgICAgICAgIGVsZW0udGFnTmFtZSA9PT0gXCJURVhUQVJFQVwiIHx8XHJcbiAgICAgICAgICAgIGVsZW0udGFnTmFtZSA9PT0gXCJJTlBVVFwiXHJcbiAgICAgICAgKSk7XHJcbiAgICB9LFxyXG5cclxuICAgIGlzRWxlbWVudEVtb2ppRWxpZ2libGU6IGZ1bmN0aW9uIChlbGVtKSB7XHJcbiAgICAgICAgdmFyIGZvcmJpZGRlbiA9IFtcImVtYWlsXCIsIFwicGFzc3dvcmRcIiwgXCJ0ZWxcIl1cclxuICAgICAgICAsICAgdHlwZSA9IGVsZW0uZ2V0QXR0cmlidXRlKFwidHlwZVwiKVxyXG4gICAgICAgICwgICBuYW1lID0gZWxlbS5nZXRBdHRyaWJ1dGUoXCJuYW1lXCIpO1xyXG5cclxuICAgICAgICByZXR1cm4gKFxyXG4gICAgICAgICAgICB0aGlzLmlzRWxlbWVudEVkaXRhYmxlKGVsZW0pICYmXHJcbiAgICAgICAgICAgIGZvcmJpZGRlbi5pbmRleE9mKHR5cGUpID09IC0xICYmXHJcbiAgICAgICAgICAgIGZvcmJpZGRlbi5pbmRleE9mKG5hbWUpID09IC0xXHJcbiAgICAgICAgKTtcclxuICAgIH0sXHJcblxyXG4gICAgZ2V0RWxlbWVudEJvZHlPZmZzZXQ6IGZ1bmN0aW9uIChlbGVtKSB7XHJcbiAgICAgICAgdmFyIHZpZXdwb3J0T2Zmc2V0ID0gZWxlbS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxyXG4gICAgICAgICwgICBzY3JvbGxUb3AgPSBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsVG9wICsgZG9jdW1lbnQuYm9keS5zY3JvbGxUb3BcclxuICAgICAgICAsICAgc2Nyb2xsTGVmdCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxMZWZ0ICsgZG9jdW1lbnQuYm9keS5zY3JvbGxMZWZ0XHJcbiAgICAgICAgLCAgIG9mZnNldEVsZW0gPSBlbGVtXHJcbiAgICAgICAgLCAgIHJlc3VsdCA9IHtcclxuICAgICAgICAgICAgICAgIHRvcDogMCxcclxuICAgICAgICAgICAgICAgIGxlZnQ6IDAsXHJcbiAgICAgICAgICAgICAgICBmaXhlZDogZmFsc2VcclxuICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgZG8ge1xyXG4gICAgICAgICAgICB2YXIgY29tcHV0ZWQgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShvZmZzZXRFbGVtKTtcclxuXHJcbiAgICAgICAgICAgIGlmIChjb21wdXRlZCAmJiBjb21wdXRlZC5wb3NpdGlvbiA9PSBcImZpeGVkXCIpIHtcclxuICAgICAgICAgICAgICAgIHJlc3VsdC5maXhlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gd2hpbGUgKG9mZnNldEVsZW0gPSBvZmZzZXRFbGVtLm9mZnNldFBhcmVudCk7XHJcblxyXG4gICAgICAgIHJlc3VsdC50b3AgPSB2aWV3cG9ydE9mZnNldC50b3A7XHJcbiAgICAgICAgcmVzdWx0LmxlZnQgPSB2aWV3cG9ydE9mZnNldC5sZWZ0O1xyXG5cclxuICAgICAgICBpZiAoIXJlc3VsdC5maXhlZCkge1xyXG4gICAgICAgICAgICByZXN1bHQudG9wICs9IHNjcm9sbFRvcDtcclxuICAgICAgICAgICAgcmVzdWx0LmxlZnQgKz0gc2Nyb2xsTGVmdDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICB9LFxyXG5cclxuICAgIGdldEVsZW1lbnRDYXJldE9mZnNldDogZnVuY3Rpb24gKGVsZW0pIHtcclxuICAgICAgICB2YXIgb2Zmc2V0ID0gbnVsbDtcclxuXHJcbiAgICAgICAgaWYgKGVsZW0uaGFzQXR0cmlidXRlKCdjb250ZW50ZWRpdGFibGUnKSkge1xyXG4gICAgICAgICAgICB2YXIgc2VsZWN0aW9uID0gd2luZG93LmdldFNlbGVjdGlvbigpXHJcbiAgICAgICAgICAgICwgICByYW5nZSA9IHNlbGVjdGlvbi5nZXRSYW5nZUF0KHNlbGVjdGlvbi5yYW5nZUNvdW50IC0gMSlcclxuICAgICAgICAgICAgLCAgIGNsb25lZFJhbmdlID0gcmFuZ2UuY2xvbmVSYW5nZSgpO1xyXG5cclxuICAgICAgICAgICAgdmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgICAgICAgICAgIGNsb25lZFJhbmdlLmluc2VydE5vZGUobm9kZSk7XHJcblxyXG4gICAgICAgICAgICBvZmZzZXQgPSB0aGlzLmdldEVsZW1lbnRCb2R5T2Zmc2V0KG5vZGUpO1xyXG5cclxuICAgICAgICAgICAgdmFyIHBhcmVudCA9IG5vZGUucGFyZW50Tm9kZTtcclxuICAgICAgICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKG5vZGUpO1xyXG4gICAgICAgICAgICBwYXJlbnQubm9ybWFsaXplKCk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgb2Zmc2V0ID0gdGhpcy5nZXRFbGVtZW50Qm9keU9mZnNldChlbGVtKTtcclxuXHJcbiAgICAgICAgICAgIHZhciBjYXJldE9mZnNldCA9IGZuVGV4dGFyZWFDYXJldFBvc2l0aW9uKGVsZW0sIGVsZW0uc2VsZWN0aW9uRW5kKTtcclxuICAgICAgICAgICAgb2Zmc2V0LnRvcCArPSBjYXJldE9mZnNldC50b3AgLSBlbGVtLnNjcm9sbFRvcDtcclxuICAgICAgICAgICAgb2Zmc2V0LmxlZnQgKz0gY2FyZXRPZmZzZXQubGVmdDtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiBvZmZzZXQ7XHJcbiAgICB9LFxyXG5cclxuICAgIGNsaXBXaXRoSW5wdXQ6IGZ1bmN0aW9uICh0ZXh0KSB7XHJcbiAgICAgICAgdmFyIGlucHV0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcImlucHV0XCIpO1xyXG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoaW5wdXQpO1xyXG5cclxuICAgICAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwiZm9jdXNcIiwgZnVuY3Rpb24gKGUpIHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICBpbnB1dC52YWx1ZSA9IHRleHQ7XHJcbiAgICAgICAgaW5wdXQuc2VsZWN0KCk7XHJcblxyXG4gICAgICAgIGRvY3VtZW50LmV4ZWNDb21tYW5kKFwiY29weVwiKTtcclxuICAgICAgICBkb2N1bWVudC5ib2R5LnJlbW92ZUNoaWxkKGlucHV0KTtcclxuICAgIH0sXHJcblxyXG4gICAgY2xpcFdpdGhTZWxlY3Rpb246IGZ1bmN0aW9uICh0ZXh0KSB7XHJcbiAgICAgICAgdmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0ZXh0KSxcclxuICAgICAgICAgICAgc2VsZWN0aW9uID0gd2luZG93LmdldFNlbGVjdGlvbigpLFxyXG4gICAgICAgICAgICByYW5nZSA9IGRvY3VtZW50LmNyZWF0ZVJhbmdlKCksXHJcbiAgICAgICAgICAgIGNsb25lID0gbnVsbDtcclxuXHJcbiAgICAgICAgaWYgKHNlbGVjdGlvbi5yYW5nZUNvdW50ID4gMCkge1xyXG4gICAgICAgICAgICBjbG9uZSA9IHNlbGVjdGlvbi5nZXRSYW5nZUF0KHNlbGVjdGlvbi5yYW5nZUNvdW50IC0gMSkuY2xvbmVSYW5nZSgpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChub2RlKTtcclxuICAgICAgICBzZWxlY3Rpb24ucmVtb3ZlQWxsUmFuZ2VzKCk7XHJcbiAgICAgICAgcmFuZ2Uuc2VsZWN0Tm9kZUNvbnRlbnRzKG5vZGUpO1xyXG4gICAgICAgIHNlbGVjdGlvbi5hZGRSYW5nZShyYW5nZSk7XHJcbiAgICAgICAgZG9jdW1lbnQuZXhlY0NvbW1hbmQoXCJjb3B5XCIpO1xyXG5cclxuICAgICAgICBzZWxlY3Rpb24ucmVtb3ZlQWxsUmFuZ2VzKCk7XHJcbiAgICAgICAgZG9jdW1lbnQuYm9keS5yZW1vdmVDaGlsZChub2RlKTtcclxuXHJcbiAgICAgICAgaWYgKGNsb25lICE9PSBudWxsKSB7XHJcbiAgICAgICAgICAgIHNlbGVjdGlvbi5hZGRSYW5nZShjbG9uZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59OyIsIid1c2Ugc3RyaWN0JztcblxudmFyIGFzc2lnbiAgICAgICAgPSByZXF1aXJlKCdlczUtZXh0L29iamVjdC9hc3NpZ24nKVxuICAsIG5vcm1hbGl6ZU9wdHMgPSByZXF1aXJlKCdlczUtZXh0L29iamVjdC9ub3JtYWxpemUtb3B0aW9ucycpXG4gICwgaXNDYWxsYWJsZSAgICA9IHJlcXVpcmUoJ2VzNS1leHQvb2JqZWN0L2lzLWNhbGxhYmxlJylcbiAgLCBjb250YWlucyAgICAgID0gcmVxdWlyZSgnZXM1LWV4dC9zdHJpbmcvIy9jb250YWlucycpXG5cbiAgLCBkO1xuXG5kID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZHNjciwgdmFsdWUvKiwgb3B0aW9ucyovKSB7XG5cdHZhciBjLCBlLCB3LCBvcHRpb25zLCBkZXNjO1xuXHRpZiAoKGFyZ3VtZW50cy5sZW5ndGggPCAyKSB8fCAodHlwZW9mIGRzY3IgIT09ICdzdHJpbmcnKSkge1xuXHRcdG9wdGlvbnMgPSB2YWx1ZTtcblx0XHR2YWx1ZSA9IGRzY3I7XG5cdFx0ZHNjciA9IG51bGw7XG5cdH0gZWxzZSB7XG5cdFx0b3B0aW9ucyA9IGFyZ3VtZW50c1syXTtcblx0fVxuXHRpZiAoZHNjciA9PSBudWxsKSB7XG5cdFx0YyA9IHcgPSB0cnVlO1xuXHRcdGUgPSBmYWxzZTtcblx0fSBlbHNlIHtcblx0XHRjID0gY29udGFpbnMuY2FsbChkc2NyLCAnYycpO1xuXHRcdGUgPSBjb250YWlucy5jYWxsKGRzY3IsICdlJyk7XG5cdFx0dyA9IGNvbnRhaW5zLmNhbGwoZHNjciwgJ3cnKTtcblx0fVxuXG5cdGRlc2MgPSB7IHZhbHVlOiB2YWx1ZSwgY29uZmlndXJhYmxlOiBjLCBlbnVtZXJhYmxlOiBlLCB3cml0YWJsZTogdyB9O1xuXHRyZXR1cm4gIW9wdGlvbnMgPyBkZXNjIDogYXNzaWduKG5vcm1hbGl6ZU9wdHMob3B0aW9ucyksIGRlc2MpO1xufTtcblxuZC5ncyA9IGZ1bmN0aW9uIChkc2NyLCBnZXQsIHNldC8qLCBvcHRpb25zKi8pIHtcblx0dmFyIGMsIGUsIG9wdGlvbnMsIGRlc2M7XG5cdGlmICh0eXBlb2YgZHNjciAhPT0gJ3N0cmluZycpIHtcblx0XHRvcHRpb25zID0gc2V0O1xuXHRcdHNldCA9IGdldDtcblx0XHRnZXQgPSBkc2NyO1xuXHRcdGRzY3IgPSBudWxsO1xuXHR9IGVsc2Uge1xuXHRcdG9wdGlvbnMgPSBhcmd1bWVudHNbM107XG5cdH1cblx0aWYgKGdldCA9PSBudWxsKSB7XG5cdFx0Z2V0ID0gdW5kZWZpbmVkO1xuXHR9IGVsc2UgaWYgKCFpc0NhbGxhYmxlKGdldCkpIHtcblx0XHRvcHRpb25zID0gZ2V0O1xuXHRcdGdldCA9IHNldCA9IHVuZGVmaW5lZDtcblx0fSBlbHNlIGlmIChzZXQgPT0gbnVsbCkge1xuXHRcdHNldCA9IHVuZGVmaW5lZDtcblx0fSBlbHNlIGlmICghaXNDYWxsYWJsZShzZXQpKSB7XG5cdFx0b3B0aW9ucyA9IHNldDtcblx0XHRzZXQgPSB1bmRlZmluZWQ7XG5cdH1cblx0aWYgKGRzY3IgPT0gbnVsbCkge1xuXHRcdGMgPSB0cnVlO1xuXHRcdGUgPSBmYWxzZTtcblx0fSBlbHNlIHtcblx0XHRjID0gY29udGFpbnMuY2FsbChkc2NyLCAnYycpO1xuXHRcdGUgPSBjb250YWlucy5jYWxsKGRzY3IsICdlJyk7XG5cdH1cblxuXHRkZXNjID0geyBnZXQ6IGdldCwgc2V0OiBzZXQsIGNvbmZpZ3VyYWJsZTogYywgZW51bWVyYWJsZTogZSB9O1xuXHRyZXR1cm4gIW9wdGlvbnMgPyBkZXNjIDogYXNzaWduKG5vcm1hbGl6ZU9wdHMob3B0aW9ucyksIGRlc2MpO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbm8tZW1wdHktZnVuY3Rpb25cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge307XG4iLCJcInVzZSBzdHJpY3RcIjtcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9pcy1pbXBsZW1lbnRlZFwiKSgpXG5cdD8gT2JqZWN0LmFzc2lnblxuXHQ6IHJlcXVpcmUoXCIuL3NoaW1cIik7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBhc3NpZ24gPSBPYmplY3QuYXNzaWduLCBvYmo7XG5cdGlmICh0eXBlb2YgYXNzaWduICE9PSBcImZ1bmN0aW9uXCIpIHJldHVybiBmYWxzZTtcblx0b2JqID0geyBmb286IFwicmF6XCIgfTtcblx0YXNzaWduKG9iaiwgeyBiYXI6IFwiZHdhXCIgfSwgeyB0cnp5OiBcInRyenlcIiB9KTtcblx0cmV0dXJuIChvYmouZm9vICsgb2JqLmJhciArIG9iai50cnp5KSA9PT0gXCJyYXpkd2F0cnp5XCI7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBrZXlzICA9IHJlcXVpcmUoXCIuLi9rZXlzXCIpXG4gICwgdmFsdWUgPSByZXF1aXJlKFwiLi4vdmFsaWQtdmFsdWVcIilcbiAgLCBtYXggICA9IE1hdGgubWF4O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChkZXN0LCBzcmMgLyosIOKApnNyY24qLykge1xuXHR2YXIgZXJyb3IsIGksIGxlbmd0aCA9IG1heChhcmd1bWVudHMubGVuZ3RoLCAyKSwgYXNzaWduO1xuXHRkZXN0ID0gT2JqZWN0KHZhbHVlKGRlc3QpKTtcblx0YXNzaWduID0gZnVuY3Rpb24gKGtleSkge1xuXHRcdHRyeSB7XG5cdFx0XHRkZXN0W2tleV0gPSBzcmNba2V5XTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRpZiAoIWVycm9yKSBlcnJvciA9IGU7XG5cdFx0fVxuXHR9O1xuXHRmb3IgKGkgPSAxOyBpIDwgbGVuZ3RoOyArK2kpIHtcblx0XHRzcmMgPSBhcmd1bWVudHNbaV07XG5cdFx0a2V5cyhzcmMpLmZvckVhY2goYXNzaWduKTtcblx0fVxuXHRpZiAoZXJyb3IgIT09IHVuZGVmaW5lZCkgdGhyb3cgZXJyb3I7XG5cdHJldHVybiBkZXN0O1xufTtcbiIsIi8vIERlcHJlY2F0ZWRcblxuXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iaikge1xuIHJldHVybiB0eXBlb2Ygb2JqID09PSBcImZ1bmN0aW9uXCI7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBfdW5kZWZpbmVkID0gcmVxdWlyZShcIi4uL2Z1bmN0aW9uL25vb3BcIikoKTsgLy8gU3VwcG9ydCBFUzMgZW5naW5lc1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICh2YWwpIHtcbiByZXR1cm4gKHZhbCAhPT0gX3VuZGVmaW5lZCkgJiYgKHZhbCAhPT0gbnVsbCk7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZShcIi4vaXMtaW1wbGVtZW50ZWRcIikoKVxuXHQ/IE9iamVjdC5rZXlzXG5cdDogcmVxdWlyZShcIi4vc2hpbVwiKTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHtcblx0dHJ5IHtcblx0XHRPYmplY3Qua2V5cyhcInByaW1pdGl2ZVwiKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSBjYXRjaCAoZSkge1xuIHJldHVybiBmYWxzZTtcbn1cbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIGlzVmFsdWUgPSByZXF1aXJlKFwiLi4vaXMtdmFsdWVcIik7XG5cbnZhciBrZXlzID0gT2JqZWN0LmtleXM7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG9iamVjdCkge1xuXHRyZXR1cm4ga2V5cyhpc1ZhbHVlKG9iamVjdCkgPyBPYmplY3Qob2JqZWN0KSA6IG9iamVjdCk7XG59O1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBpc1ZhbHVlID0gcmVxdWlyZShcIi4vaXMtdmFsdWVcIik7XG5cbnZhciBmb3JFYWNoID0gQXJyYXkucHJvdG90eXBlLmZvckVhY2gsIGNyZWF0ZSA9IE9iamVjdC5jcmVhdGU7XG5cbnZhciBwcm9jZXNzID0gZnVuY3Rpb24gKHNyYywgb2JqKSB7XG5cdHZhciBrZXk7XG5cdGZvciAoa2V5IGluIHNyYykgb2JqW2tleV0gPSBzcmNba2V5XTtcbn07XG5cbi8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBuby11bnVzZWQtdmFyc1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob3B0czEgLyosIOKApm9wdGlvbnMqLykge1xuXHR2YXIgcmVzdWx0ID0gY3JlYXRlKG51bGwpO1xuXHRmb3JFYWNoLmNhbGwoYXJndW1lbnRzLCBmdW5jdGlvbiAob3B0aW9ucykge1xuXHRcdGlmICghaXNWYWx1ZShvcHRpb25zKSkgcmV0dXJuO1xuXHRcdHByb2Nlc3MoT2JqZWN0KG9wdGlvbnMpLCByZXN1bHQpO1xuXHR9KTtcblx0cmV0dXJuIHJlc3VsdDtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZm4pIHtcblx0aWYgKHR5cGVvZiBmbiAhPT0gXCJmdW5jdGlvblwiKSB0aHJvdyBuZXcgVHlwZUVycm9yKGZuICsgXCIgaXMgbm90IGEgZnVuY3Rpb25cIik7XG5cdHJldHVybiBmbjtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIGlzVmFsdWUgPSByZXF1aXJlKFwiLi9pcy12YWx1ZVwiKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAodmFsdWUpIHtcblx0aWYgKCFpc1ZhbHVlKHZhbHVlKSkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgbnVsbCBvciB1bmRlZmluZWRcIik7XG5cdHJldHVybiB2YWx1ZTtcbn07XG4iLCJcInVzZSBzdHJpY3RcIjtcblxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9pcy1pbXBsZW1lbnRlZFwiKSgpXG5cdD8gU3RyaW5nLnByb3RvdHlwZS5jb250YWluc1xuXHQ6IHJlcXVpcmUoXCIuL3NoaW1cIik7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIHN0ciA9IFwicmF6ZHdhdHJ6eVwiO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICgpIHtcblx0aWYgKHR5cGVvZiBzdHIuY29udGFpbnMgIT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIGZhbHNlO1xuXHRyZXR1cm4gKHN0ci5jb250YWlucyhcImR3YVwiKSA9PT0gdHJ1ZSkgJiYgKHN0ci5jb250YWlucyhcImZvb1wiKSA9PT0gZmFsc2UpO1xufTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgaW5kZXhPZiA9IFN0cmluZy5wcm90b3R5cGUuaW5kZXhPZjtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoc2VhcmNoU3RyaW5nLyosIHBvc2l0aW9uKi8pIHtcblx0cmV0dXJuIGluZGV4T2YuY2FsbCh0aGlzLCBzZWFyY2hTdHJpbmcsIGFyZ3VtZW50c1sxXSkgPiAtMTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBkICAgICAgICA9IHJlcXVpcmUoJ2QnKVxuICAsIGNhbGxhYmxlID0gcmVxdWlyZSgnZXM1LWV4dC9vYmplY3QvdmFsaWQtY2FsbGFibGUnKVxuXG4gICwgYXBwbHkgPSBGdW5jdGlvbi5wcm90b3R5cGUuYXBwbHksIGNhbGwgPSBGdW5jdGlvbi5wcm90b3R5cGUuY2FsbFxuICAsIGNyZWF0ZSA9IE9iamVjdC5jcmVhdGUsIGRlZmluZVByb3BlcnR5ID0gT2JqZWN0LmRlZmluZVByb3BlcnR5XG4gICwgZGVmaW5lUHJvcGVydGllcyA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzXG4gICwgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5XG4gICwgZGVzY3JpcHRvciA9IHsgY29uZmlndXJhYmxlOiB0cnVlLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IHRydWUgfVxuXG4gICwgb24sIG9uY2UsIG9mZiwgZW1pdCwgbWV0aG9kcywgZGVzY3JpcHRvcnMsIGJhc2U7XG5cbm9uID0gZnVuY3Rpb24gKHR5cGUsIGxpc3RlbmVyKSB7XG5cdHZhciBkYXRhO1xuXG5cdGNhbGxhYmxlKGxpc3RlbmVyKTtcblxuXHRpZiAoIWhhc093blByb3BlcnR5LmNhbGwodGhpcywgJ19fZWVfXycpKSB7XG5cdFx0ZGF0YSA9IGRlc2NyaXB0b3IudmFsdWUgPSBjcmVhdGUobnVsbCk7XG5cdFx0ZGVmaW5lUHJvcGVydHkodGhpcywgJ19fZWVfXycsIGRlc2NyaXB0b3IpO1xuXHRcdGRlc2NyaXB0b3IudmFsdWUgPSBudWxsO1xuXHR9IGVsc2Uge1xuXHRcdGRhdGEgPSB0aGlzLl9fZWVfXztcblx0fVxuXHRpZiAoIWRhdGFbdHlwZV0pIGRhdGFbdHlwZV0gPSBsaXN0ZW5lcjtcblx0ZWxzZSBpZiAodHlwZW9mIGRhdGFbdHlwZV0gPT09ICdvYmplY3QnKSBkYXRhW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuXHRlbHNlIGRhdGFbdHlwZV0gPSBbZGF0YVt0eXBlXSwgbGlzdGVuZXJdO1xuXG5cdHJldHVybiB0aGlzO1xufTtcblxub25jZSA9IGZ1bmN0aW9uICh0eXBlLCBsaXN0ZW5lcikge1xuXHR2YXIgb25jZSwgc2VsZjtcblxuXHRjYWxsYWJsZShsaXN0ZW5lcik7XG5cdHNlbGYgPSB0aGlzO1xuXHRvbi5jYWxsKHRoaXMsIHR5cGUsIG9uY2UgPSBmdW5jdGlvbiAoKSB7XG5cdFx0b2ZmLmNhbGwoc2VsZiwgdHlwZSwgb25jZSk7XG5cdFx0YXBwbHkuY2FsbChsaXN0ZW5lciwgdGhpcywgYXJndW1lbnRzKTtcblx0fSk7XG5cblx0b25jZS5fX2VlT25jZUxpc3RlbmVyX18gPSBsaXN0ZW5lcjtcblx0cmV0dXJuIHRoaXM7XG59O1xuXG5vZmYgPSBmdW5jdGlvbiAodHlwZSwgbGlzdGVuZXIpIHtcblx0dmFyIGRhdGEsIGxpc3RlbmVycywgY2FuZGlkYXRlLCBpO1xuXG5cdGNhbGxhYmxlKGxpc3RlbmVyKTtcblxuXHRpZiAoIWhhc093blByb3BlcnR5LmNhbGwodGhpcywgJ19fZWVfXycpKSByZXR1cm4gdGhpcztcblx0ZGF0YSA9IHRoaXMuX19lZV9fO1xuXHRpZiAoIWRhdGFbdHlwZV0pIHJldHVybiB0aGlzO1xuXHRsaXN0ZW5lcnMgPSBkYXRhW3R5cGVdO1xuXG5cdGlmICh0eXBlb2YgbGlzdGVuZXJzID09PSAnb2JqZWN0Jykge1xuXHRcdGZvciAoaSA9IDA7IChjYW5kaWRhdGUgPSBsaXN0ZW5lcnNbaV0pOyArK2kpIHtcblx0XHRcdGlmICgoY2FuZGlkYXRlID09PSBsaXN0ZW5lcikgfHxcblx0XHRcdFx0XHQoY2FuZGlkYXRlLl9fZWVPbmNlTGlzdGVuZXJfXyA9PT0gbGlzdGVuZXIpKSB7XG5cdFx0XHRcdGlmIChsaXN0ZW5lcnMubGVuZ3RoID09PSAyKSBkYXRhW3R5cGVdID0gbGlzdGVuZXJzW2kgPyAwIDogMV07XG5cdFx0XHRcdGVsc2UgbGlzdGVuZXJzLnNwbGljZShpLCAxKTtcblx0XHRcdH1cblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0aWYgKChsaXN0ZW5lcnMgPT09IGxpc3RlbmVyKSB8fFxuXHRcdFx0XHQobGlzdGVuZXJzLl9fZWVPbmNlTGlzdGVuZXJfXyA9PT0gbGlzdGVuZXIpKSB7XG5cdFx0XHRkZWxldGUgZGF0YVt0eXBlXTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdGhpcztcbn07XG5cbmVtaXQgPSBmdW5jdGlvbiAodHlwZSkge1xuXHR2YXIgaSwgbCwgbGlzdGVuZXIsIGxpc3RlbmVycywgYXJncztcblxuXHRpZiAoIWhhc093blByb3BlcnR5LmNhbGwodGhpcywgJ19fZWVfXycpKSByZXR1cm47XG5cdGxpc3RlbmVycyA9IHRoaXMuX19lZV9fW3R5cGVdO1xuXHRpZiAoIWxpc3RlbmVycykgcmV0dXJuO1xuXG5cdGlmICh0eXBlb2YgbGlzdGVuZXJzID09PSAnb2JqZWN0Jykge1xuXHRcdGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuXHRcdGFyZ3MgPSBuZXcgQXJyYXkobCAtIDEpO1xuXHRcdGZvciAoaSA9IDE7IGkgPCBsOyArK2kpIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG5cdFx0bGlzdGVuZXJzID0gbGlzdGVuZXJzLnNsaWNlKCk7XG5cdFx0Zm9yIChpID0gMDsgKGxpc3RlbmVyID0gbGlzdGVuZXJzW2ldKTsgKytpKSB7XG5cdFx0XHRhcHBseS5jYWxsKGxpc3RlbmVyLCB0aGlzLCBhcmdzKTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0c3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG5cdFx0Y2FzZSAxOlxuXHRcdFx0Y2FsbC5jYWxsKGxpc3RlbmVycywgdGhpcyk7XG5cdFx0XHRicmVhaztcblx0XHRjYXNlIDI6XG5cdFx0XHRjYWxsLmNhbGwobGlzdGVuZXJzLCB0aGlzLCBhcmd1bWVudHNbMV0pO1xuXHRcdFx0YnJlYWs7XG5cdFx0Y2FzZSAzOlxuXHRcdFx0Y2FsbC5jYWxsKGxpc3RlbmVycywgdGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuXHRcdFx0YnJlYWs7XG5cdFx0ZGVmYXVsdDpcblx0XHRcdGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuXHRcdFx0YXJncyA9IG5ldyBBcnJheShsIC0gMSk7XG5cdFx0XHRmb3IgKGkgPSAxOyBpIDwgbDsgKytpKSB7XG5cdFx0XHRcdGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXHRcdFx0fVxuXHRcdFx0YXBwbHkuY2FsbChsaXN0ZW5lcnMsIHRoaXMsIGFyZ3MpO1xuXHRcdH1cblx0fVxufTtcblxubWV0aG9kcyA9IHtcblx0b246IG9uLFxuXHRvbmNlOiBvbmNlLFxuXHRvZmY6IG9mZixcblx0ZW1pdDogZW1pdFxufTtcblxuZGVzY3JpcHRvcnMgPSB7XG5cdG9uOiBkKG9uKSxcblx0b25jZTogZChvbmNlKSxcblx0b2ZmOiBkKG9mZiksXG5cdGVtaXQ6IGQoZW1pdClcbn07XG5cbmJhc2UgPSBkZWZpbmVQcm9wZXJ0aWVzKHt9LCBkZXNjcmlwdG9ycyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZXhwb3J0cyA9IGZ1bmN0aW9uIChvKSB7XG5cdHJldHVybiAobyA9PSBudWxsKSA/IGNyZWF0ZShiYXNlKSA6IGRlZmluZVByb3BlcnRpZXMoT2JqZWN0KG8pLCBkZXNjcmlwdG9ycyk7XG59O1xuZXhwb3J0cy5tZXRob2RzID0gbWV0aG9kcztcbiIsIm1vZHVsZS5leHBvcnRzPXtcIjpEXCI6XCLwn5iAXCIsXCInOkRcIjpcIvCfmIVcIixcInhEXCI6XCLwn5iGXCIsXCI7KVwiOlwi8J+YiVwiLFwiXl5cIjpcIvCfmIpcIixcIjpwXCI6XCLwn5iLXCIsXCI4KVwiOlwi8J+YjlwiLFwiOipcIjpcIvCfmJhcIixcIjozXCI6XCLwn5iXXCIsXCI6KVwiOlwi8J+ZglwiLFwiOj9cIjpcIvCfpJRcIixcIjp8XCI6XCLwn5iQXCIsXCItXy1cIjpcIvCfmJFcIixcIjp4XCI6XCLwn5i2XCIsXCI6WFwiOlwi8J+YtlwiLFwifC0oXCI6XCLwn5mEXCIsXCI6T1wiOlwi8J+YrlwiLFwiOm9cIjpcIvCfmK9cIixcIkQ6XCI6XCLwn5irXCIsXCJ8LSlcIjpcIvCfmLRcIixcIjpQXCI6XCLwn5ibXCIsXCI7UFwiOlwi8J+YnFwiLFwiOi9cIjpcIvCfmJVcIixcIig6XCI6XCLwn5mDXCIsXCI4T1wiOlwi8J+YslwiLFwiOihcIjpcIvCfmYFcIixcIjsoXCI6XCLwn5iiXCIsXCI6QFwiOlwi8J+krFwiLFwiPjopXCI6XCLwn5iIXCIsXCI8M1wiOlwi4p2k77iPXCJ9OyIsInZhciBsb2NhdGlvbiA9IGdsb2JhbC5sb2NhdGlvbiB8fCB7fTtcbi8qanNsaW50IGluZGVudDogMiwgYnJvd3NlcjogdHJ1ZSwgYml0d2lzZTogdHJ1ZSwgcGx1c3BsdXM6IHRydWUgKi9cbnZhciB0d2Vtb2ppID0gKGZ1bmN0aW9uIChcbiAgLyohIENvcHlyaWdodCBUd2l0dGVyIEluYy4gYW5kIG90aGVyIGNvbnRyaWJ1dG9ycy4gTGljZW5zZWQgdW5kZXIgTUlUICovLypcbiAgICBodHRwczovL2dpdGh1Yi5jb20vdHdpdHRlci90d2Vtb2ppL2Jsb2IvZ2gtcGFnZXMvTElDRU5TRVxuICAqL1xuXG4gIC8vIFdBUk5JTkc6ICAgdGhpcyBmaWxlIGlzIGdlbmVyYXRlZCBhdXRvbWF0aWNhbGx5IHZpYVxuICAvLyAgICAgICAgICAgIGBub2RlIHR3ZW1vamktZ2VuZXJhdG9yLmpzYFxuICAvLyAgICAgICAgICAgIHBsZWFzZSB1cGRhdGUgaXRzIGBjcmVhdGVUd2Vtb2ppYCBmdW5jdGlvblxuICAvLyAgICAgICAgICAgIGF0IHRoZSBib3R0b20gb2YgdGhlIHNhbWUgZmlsZSBpbnN0ZWFkLlxuXG4pIHtcbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIC8qanNoaW50IG1heHBhcmFtczo0ICovXG5cbiAgdmFyXG4gICAgLy8gdGhlIGV4cG9ydGVkIG1vZHVsZSBvYmplY3RcbiAgICB0d2Vtb2ppID0ge1xuXG5cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gICAgLy8gICAgICBwcm9wZXJ0aWVzICAgICAvL1xuICAgIC8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuICAgICAgLy8gZGVmYXVsdCBhc3NldHMgdXJsLCBieSBkZWZhdWx0IHdpbGwgYmUgVHdpdHRlciBJbmMuIENETlxuICAgICAgYmFzZTogJ2h0dHBzOi8vdHdlbW9qaS5tYXhjZG4uY29tLzIvJyxcblxuICAgICAgLy8gZGVmYXVsdCBhc3NldHMgZmlsZSBleHRlbnNpb25zLCBieSBkZWZhdWx0ICcucG5nJ1xuICAgICAgZXh0OiAnLnBuZycsXG5cbiAgICAgIC8vIGRlZmF1bHQgYXNzZXRzL2ZvbGRlciBzaXplLCBieSBkZWZhdWx0IFwiNzJ4NzJcIlxuICAgICAgLy8gYXZhaWxhYmxlIHZpYSBUd2l0dGVyIENETjogNzJcbiAgICAgIHNpemU6ICc3Mng3MicsXG5cbiAgICAgIC8vIGRlZmF1bHQgY2xhc3MgbmFtZSwgYnkgZGVmYXVsdCAnZW1vamknXG4gICAgICBjbGFzc05hbWU6ICdlbW9qaScsXG5cbiAgICAgIC8vIGJhc2ljIHV0aWxpdGllcyAvIGhlbHBlcnMgdG8gY29udmVydCBjb2RlIHBvaW50c1xuICAgICAgLy8gdG8gSmF2YVNjcmlwdCBzdXJyb2dhdGVzIGFuZCB2aWNlIHZlcnNhXG4gICAgICBjb252ZXJ0OiB7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdpdmVuIGFuIEhFWCBjb2RlcG9pbnQsIHJldHVybnMgVVRGMTYgc3Vycm9nYXRlIHBhaXJzLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0gICBzdHJpbmcgIGdlbmVyaWMgY29kZXBvaW50LCBpLmUuICcxRjRBOSdcbiAgICAgICAgICogQHJldHVybiAgc3RyaW5nICBjb2RlcG9pbnQgdHJhbnNmb3JtZWQgaW50byB1dGYxNiBzdXJyb2dhdGVzIHBhaXIsXG4gICAgICAgICAqICAgICAgICAgIGkuZS4gXFx1RDgzRFxcdURDQTlcbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogIHR3ZW1vamkuY29udmVydC5mcm9tQ29kZVBvaW50KCcxZjFlOCcpO1xuICAgICAgICAgKiAgLy8gXCJcXHVkODNjXFx1ZGRlOFwiXG4gICAgICAgICAqXG4gICAgICAgICAqICAnMWYxZTgtMWYxZjMnLnNwbGl0KCctJykubWFwKHR3ZW1vamkuY29udmVydC5mcm9tQ29kZVBvaW50KS5qb2luKCcnKVxuICAgICAgICAgKiAgLy8gXCJcXHVkODNjXFx1ZGRlOFxcdWQ4M2NcXHVkZGYzXCJcbiAgICAgICAgICovXG4gICAgICAgIGZyb21Db2RlUG9pbnQ6IGZyb21Db2RlUG9pbnQsXG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEdpdmVuIFVURjE2IHN1cnJvZ2F0ZSBwYWlycywgcmV0dXJucyB0aGUgZXF1aXZhbGVudCBIRVggY29kZXBvaW50LlxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0gICBzdHJpbmcgIGdlbmVyaWMgdXRmMTYgc3Vycm9nYXRlcyBwYWlyLCBpLmUuIFxcdUQ4M0RcXHVEQ0E5XG4gICAgICAgICAqIEBwYXJhbSAgIHN0cmluZyAgb3B0aW9uYWwgc2VwYXJhdG9yIGZvciBkb3VibGUgY29kZSBwb2ludHMsIGRlZmF1bHQ9Jy0nXG4gICAgICAgICAqIEByZXR1cm4gIHN0cmluZyAgdXRmMTYgdHJhbnNmb3JtZWQgaW50byBjb2RlcG9pbnQsIGkuZS4gJzFGNEE5J1xuICAgICAgICAgKlxuICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgKiAgdHdlbW9qaS5jb252ZXJ0LnRvQ29kZVBvaW50KCdcXHVkODNjXFx1ZGRlOFxcdWQ4M2NcXHVkZGYzJyk7XG4gICAgICAgICAqICAvLyBcIjFmMWU4LTFmMWYzXCJcbiAgICAgICAgICpcbiAgICAgICAgICogIHR3ZW1vamkuY29udmVydC50b0NvZGVQb2ludCgnXFx1ZDgzY1xcdWRkZThcXHVkODNjXFx1ZGRmMycsICd+Jyk7XG4gICAgICAgICAqICAvLyBcIjFmMWU4fjFmMWYzXCJcbiAgICAgICAgICovXG4gICAgICAgIHRvQ29kZVBvaW50OiB0b0NvZGVQb2ludFxuICAgICAgfSxcblxuXG4gICAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAgIC8vICAgICAgIG1ldGhvZHMgICAgICAgLy9cbiAgICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbiAgICAgIC8qKlxuICAgICAgICogVXNlciBmaXJzdDogdXNlZCB0byByZW1vdmUgbWlzc2luZyBpbWFnZXNcbiAgICAgICAqIHByZXNlcnZpbmcgdGhlIG9yaWdpbmFsIHRleHQgaW50ZW50IHdoZW5cbiAgICAgICAqIGEgZmFsbGJhY2sgZm9yIG5ldHdvcmsgcHJvYmxlbXMgaXMgZGVzaXJlZC5cbiAgICAgICAqIEF1dG9tYXRpY2FsbHkgYWRkZWQgdG8gSW1hZ2Ugbm9kZXMgdmlhIERPTVxuICAgICAgICogSXQgY291bGQgYmUgcmVjeWNsZWQgZm9yIHN0cmluZyBvcGVyYXRpb25zIHZpYTpcbiAgICAgICAqICAkKCdpbWcuZW1vamknKS5vbignZXJyb3InLCB0d2Vtb2ppLm9uZXJyb3IpXG4gICAgICAgKi9cbiAgICAgIG9uZXJyb3I6IGZ1bmN0aW9uIG9uZXJyb3IoKSB7XG4gICAgICAgIGlmICh0aGlzLnBhcmVudE5vZGUpIHtcbiAgICAgICAgICB0aGlzLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGNyZWF0ZVRleHQodGhpcy5hbHQsIGZhbHNlKSwgdGhpcyk7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8qKlxuICAgICAgICogTWFpbiBtZXRob2QvbG9naWMgdG8gZ2VuZXJhdGUgZWl0aGVyIDxpbWc+IHRhZ3Mgb3IgSFRNTEltYWdlIG5vZGVzLlxuICAgICAgICogIFwiZW1vamlmeVwiIGEgZ2VuZXJpYyB0ZXh0IG9yIERPTSBFbGVtZW50LlxuICAgICAgICpcbiAgICAgICAqIEBvdmVybG9hZHNcbiAgICAgICAqXG4gICAgICAgKiBTdHJpbmcgcmVwbGFjZW1lbnQgZm9yIGBpbm5lckhUTUxgIG9yIHNlcnZlciBzaWRlIG9wZXJhdGlvbnNcbiAgICAgICAqICB0d2Vtb2ppLnBhcnNlKHN0cmluZyk7XG4gICAgICAgKiAgdHdlbW9qaS5wYXJzZShzdHJpbmcsIEZ1bmN0aW9uKTtcbiAgICAgICAqICB0d2Vtb2ppLnBhcnNlKHN0cmluZywgT2JqZWN0KTtcbiAgICAgICAqXG4gICAgICAgKiBIVE1MRWxlbWVudCB0cmVlIHBhcnNpbmcgZm9yIHNhZmVyIG9wZXJhdGlvbnMgb3ZlciBleGlzdGluZyBET01cbiAgICAgICAqICB0d2Vtb2ppLnBhcnNlKEhUTUxFbGVtZW50KTtcbiAgICAgICAqICB0d2Vtb2ppLnBhcnNlKEhUTUxFbGVtZW50LCBGdW5jdGlvbik7XG4gICAgICAgKiAgdHdlbW9qaS5wYXJzZShIVE1MRWxlbWVudCwgT2JqZWN0KTtcbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0gICBzdHJpbmd8SFRNTEVsZW1lbnQgIHRoZSBzb3VyY2UgdG8gcGFyc2UgYW5kIGVucmljaCB3aXRoIGVtb2ppLlxuICAgICAgICpcbiAgICAgICAqICAgICAgICAgIHN0cmluZyAgICAgICAgICAgICAgcmVwbGFjZSBlbW9qaSBtYXRjaGVzIHdpdGggPGltZz4gdGFncy5cbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWFpbmx5IHVzZWQgdG8gaW5qZWN0IGVtb2ppIHZpYSBgaW5uZXJIVE1MYFxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBJdCBkb2VzICoqbm90KiogcGFyc2UgdGhlIHN0cmluZyBvciB2YWxpZGF0ZSBpdCxcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaXQgc2ltcGx5IHJlcGxhY2VzIGZvdW5kIGVtb2ppIHdpdGggYSB0YWcuXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIE5PVEU6IGJlIHN1cmUgdGhpcyB3b24ndCBhZmZlY3Qgc2VjdXJpdHkuXG4gICAgICAgKlxuICAgICAgICogICAgICAgICAgSFRNTEVsZW1lbnQgICAgICAgICB3YWxrIHRocm91Z2ggdGhlIERPTSB0cmVlIGFuZCBmaW5kIGVtb2ppXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoYXQgYXJlIGluc2lkZSAqKnRleHQgbm9kZSBvbmx5KiogKG5vZGVUeXBlID09PSAzKVxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYWlubHkgdXNlZCB0byBwdXQgZW1vamkgaW4gYWxyZWFkeSBnZW5lcmF0ZWQgRE9NXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpdGhvdXQgY29tcHJvbWlzaW5nIHN1cnJvdW5kaW5nIG5vZGVzIGFuZFxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqKmF2b2lkaW5nKiogdGhlIHVzYWdlIG9mIGBpbm5lckhUTUxgLlxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBOT1RFOiBVc2luZyBET00gZWxlbWVudHMgaW5zdGVhZCBvZiBzdHJpbmdzIHNob3VsZFxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbXByb3ZlIHNlY3VyaXR5IHdpdGhvdXQgY29tcHJvbWlzaW5nIHRvbyBtdWNoXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBlcmZvcm1hbmNlIGNvbXBhcmVkIHdpdGggYSBsZXNzIHNhZmUgYGlubmVySFRNTGAuXG4gICAgICAgKlxuICAgICAgICogQHBhcmFtICAgRnVuY3Rpb258T2JqZWN0ICBbb3B0aW9uYWxdXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVpdGhlciB0aGUgY2FsbGJhY2sgdGhhdCB3aWxsIGJlIGludm9rZWQgb3IgYW4gb2JqZWN0XG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpdGggYWxsIHByb3BlcnRpZXMgdG8gdXNlIHBlciBlYWNoIGZvdW5kIGVtb2ppLlxuICAgICAgICpcbiAgICAgICAqICAgICAgICAgIEZ1bmN0aW9uICAgICAgICAgICAgaWYgc3BlY2lmaWVkLCB0aGlzIHdpbGwgYmUgaW52b2tlZCBwZXIgZWFjaCBlbW9qaVxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGF0IGhhcyBiZWVuIGZvdW5kIHRocm91Z2ggdGhlIFJlZ0V4cCBleGNlcHRcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhvc2UgZm9sbHdlZCBieSB0aGUgaW52YXJpYW50IFxcdUZFMEUgKFwiYXMgdGV4dFwiKS5cbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgT25jZSBpbnZva2VkLCBwYXJhbWV0ZXJzIHdpbGwgYmU6XG4gICAgICAgKlxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGljb25JZDpzdHJpbmcgICAgIHRoZSBsb3dlciBjYXNlIEhFWCBjb2RlIHBvaW50XG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaS5lLiBcIjFmNGE5XCJcbiAgICAgICAqXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9uczpPYmplY3QgICAgYWxsIGluZm8gZm9yIHRoaXMgcGFyc2luZyBvcGVyYXRpb25cbiAgICAgICAqXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFudDpjaGFyICAgICAgdGhlIG9wdGlvbmFsIFxcdUZFMEYgKFwiYXMgaW1hZ2VcIilcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50LCBpbiBjYXNlIHRoaXMgaW5mb1xuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlzIGFueWhvdyBtZWFuaW5nZnVsLlxuICAgICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEJ5IGRlZmF1bHQgdGhpcyBpcyBpZ25vcmVkLlxuICAgICAgICpcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSWYgc3VjaCBjYWxsYmFjayB3aWxsIHJldHVybiBhIGZhbHN5IHZhbHVlIGluc3RlYWRcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb2YgYSB2YWxpZCBgc3JjYCB0byB1c2UgZm9yIHRoZSBpbWFnZSwgbm90aGluZyB3aWxsXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjdHVhbGx5IGNoYW5nZSBmb3IgdGhhdCBzcGVjaWZpYyBlbW9qaS5cbiAgICAgICAqXG4gICAgICAgKlxuICAgICAgICogICAgICAgICAgT2JqZWN0ICAgICAgICAgICAgICBpZiBzcGVjaWZpZWQsIGFuIG9iamVjdCBjb250YWluaW5nIHRoZSBmb2xsb3dpbmcgcHJvcGVydGllc1xuICAgICAgICpcbiAgICAgICAqICAgICAgICAgICAgY2FsbGJhY2sgICBGdW5jdGlvbiAgdGhlIGNhbGxiYWNrIHRvIGludm9rZSBwZXIgZWFjaCBmb3VuZCBlbW9qaS5cbiAgICAgICAqICAgICAgICAgICAgYmFzZSAgICAgICBzdHJpbmcgICAgdGhlIGJhc2UgdXJsLCBieSBkZWZhdWx0IHR3ZW1vamkuYmFzZVxuICAgICAgICogICAgICAgICAgICBleHQgICAgICAgIHN0cmluZyAgICB0aGUgaW1hZ2UgZXh0ZW5zaW9uLCBieSBkZWZhdWx0IHR3ZW1vamkuZXh0XG4gICAgICAgKiAgICAgICAgICAgIHNpemUgICAgICAgc3RyaW5nICAgIHRoZSBhc3NldHMgc2l6ZSwgYnkgZGVmYXVsdCB0d2Vtb2ppLnNpemVcbiAgICAgICAqXG4gICAgICAgKiBAZXhhbXBsZVxuICAgICAgICpcbiAgICAgICAqICB0d2Vtb2ppLnBhcnNlKFwiSSBcXHUyNzY0XFx1RkUwRiBlbW9qaSFcIik7XG4gICAgICAgKiAgLy8gSSA8aW1nIGNsYXNzPVwiZW1vamlcIiBkcmFnZ2FibGU9XCJmYWxzZVwiIGFsdD1cIuKdpO+4j1wiIHNyYz1cIi9hc3NldHMvMjc2NC5naWZcIi8+IGVtb2ppIVxuICAgICAgICpcbiAgICAgICAqXG4gICAgICAgKiAgdHdlbW9qaS5wYXJzZShcIkkgXFx1Mjc2NFxcdUZFMEYgZW1vamkhXCIsIGZ1bmN0aW9uKGljb25JZCwgb3B0aW9ucykge1xuICAgICAgICogICAgcmV0dXJuICcvYXNzZXRzLycgKyBpY29uSWQgKyAnLmdpZic7XG4gICAgICAgKiAgfSk7XG4gICAgICAgKiAgLy8gSSA8aW1nIGNsYXNzPVwiZW1vamlcIiBkcmFnZ2FibGU9XCJmYWxzZVwiIGFsdD1cIuKdpO+4j1wiIHNyYz1cIi9hc3NldHMvMjc2NC5naWZcIi8+IGVtb2ppIVxuICAgICAgICpcbiAgICAgICAqXG4gICAgICAgKiB0d2Vtb2ppLnBhcnNlKFwiSSBcXHUyNzY0XFx1RkUwRiBlbW9qaSFcIiwge1xuICAgICAgICogICBzaXplOiA3MixcbiAgICAgICAqICAgY2FsbGJhY2s6IGZ1bmN0aW9uKGljb25JZCwgb3B0aW9ucykge1xuICAgICAgICogICAgIHJldHVybiAnL2Fzc2V0cy8nICsgb3B0aW9ucy5zaXplICsgJy8nICsgaWNvbklkICsgb3B0aW9ucy5leHQ7XG4gICAgICAgKiAgIH1cbiAgICAgICAqIH0pO1xuICAgICAgICogIC8vIEkgPGltZyBjbGFzcz1cImVtb2ppXCIgZHJhZ2dhYmxlPVwiZmFsc2VcIiBhbHQ9XCLinaTvuI9cIiBzcmM9XCIvYXNzZXRzLzcyeDcyLzI3NjQucG5nXCIvPiBlbW9qaSFcbiAgICAgICAqXG4gICAgICAgKi9cbiAgICAgIHBhcnNlOiBwYXJzZSxcblxuICAgICAgLyoqXG4gICAgICAgKiBHaXZlbiBhIHN0cmluZywgaW52b2tlcyB0aGUgY2FsbGJhY2sgYXJndW1lbnRcbiAgICAgICAqICBwZXIgZWFjaCBlbW9qaSBmb3VuZCBpbiBzdWNoIHN0cmluZy5cbiAgICAgICAqIFRoaXMgaXMgdGhlIG1vc3QgcmF3IHZlcnNpb24gdXNlZCBieVxuICAgICAgICogIHRoZSAucGFyc2Uoc3RyaW5nKSBtZXRob2QgaXRzZWxmLlxuICAgICAgICpcbiAgICAgICAqIEBwYXJhbSAgIHN0cmluZyAgICBnZW5lcmljIHN0cmluZyB0byBwYXJzZVxuICAgICAgICogQHBhcmFtICAgRnVuY3Rpb24gIGEgZ2VuZXJpYyBjYWxsYmFjayB0aGF0IHdpbGwgYmVcbiAgICAgICAqICAgICAgICAgICAgICAgICAgICBpbnZva2VkIHRvIHJlcGxhY2UgdGhlIGNvbnRlbnQuXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgVGhpcyBjYWxiYWNrIHdpbCByZWNlaXZlIHN0YW5kYXJkXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgU3RyaW5nLnByb3RvdHlwZS5yZXBsYWNlKHN0ciwgY2FsbGJhY2spXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgYXJndW1lbnRzIHN1Y2g6XG4gICAgICAgKiAgY2FsbGJhY2soXG4gICAgICAgKiAgICByYXdUZXh0LCAgLy8gdGhlIGVtb2ppIG1hdGNoXG4gICAgICAgKiAgKTtcbiAgICAgICAqXG4gICAgICAgKiAgICAgICAgICAgICAgICAgICAgYW5kIG90aGVycyBjb21tb25seSByZWNlaXZlZCB2aWEgcmVwbGFjZS5cbiAgICAgICAqL1xuICAgICAgcmVwbGFjZTogcmVwbGFjZSxcblxuICAgICAgLyoqXG4gICAgICAgKiBTaW1wbGlmeSBzdHJpbmcgdGVzdHMgYWdhaW5zdCBlbW9qaS5cbiAgICAgICAqXG4gICAgICAgKiBAcGFyYW0gICBzdHJpbmcgIHNvbWUgdGV4dCB0aGF0IG1pZ2h0IGNvbnRhaW4gZW1vamlcbiAgICAgICAqIEByZXR1cm4gIGJvb2xlYW4gdHJ1ZSBpZiBhbnkgZW1vamkgd2FzIGZvdW5kLCBmYWxzZSBvdGhlcndpc2UuXG4gICAgICAgKlxuICAgICAgICogQGV4YW1wbGVcbiAgICAgICAqXG4gICAgICAgKiAgaWYgKHR3ZW1vamkudGVzdChzb21lQ29udGVudCkpIHtcbiAgICAgICAqICAgIGNvbnNvbGUubG9nKFwiZW1vamkgQWxsIFRoZSBUaGluZ3MhXCIpO1xuICAgICAgICogIH1cbiAgICAgICAqL1xuICAgICAgdGVzdDogdGVzdFxuICAgIH0sXG5cbiAgICAvLyB1c2VkIHRvIGVzY2FwZSBIVE1MIHNwZWNpYWwgY2hhcnMgaW4gYXR0cmlidXRlc1xuICAgIGVzY2FwZXIgPSB7XG4gICAgICAnJic6ICcmYW1wOycsXG4gICAgICAnPCc6ICcmbHQ7JyxcbiAgICAgICc+JzogJyZndDsnLFxuICAgICAgXCInXCI6ICcmIzM5OycsXG4gICAgICAnXCInOiAnJnF1b3Q7J1xuICAgIH0sXG5cbiAgICAvLyBSZWdFeHAgYmFzZWQgb24gZW1vamkncyBvZmZpY2lhbCBVbmljb2RlIHN0YW5kYXJkc1xuICAgIC8vIGh0dHA6Ly93d3cudW5pY29kZS5vcmcvUHVibGljL1VOSURBVEEvRW1vamlTb3VyY2VzLnR4dFxuICAgIHJlID0gL1xcdWQ4M2RbXFx1ZGM2OC1cXHVkYzY5XSg/OlxcdWQ4M2NbXFx1ZGZmYi1cXHVkZmZmXSk/XFx1MjAwZCg/OlxcdTI2OTVcXHVmZTBmfFxcdTI2OTZcXHVmZTBmfFxcdTI3MDhcXHVmZTBmfFxcdWQ4M2NbXFx1ZGYzZVxcdWRmNzNcXHVkZjkzXFx1ZGZhNFxcdWRmYThcXHVkZmViXFx1ZGZlZF18XFx1ZDgzZFtcXHVkY2JiXFx1ZGNiY1xcdWRkMjdcXHVkZDJjXFx1ZGU4MFxcdWRlOTJdKXwoPzpcXHVkODNjW1xcdWRmY2JcXHVkZmNjXXxcXHVkODNkXFx1ZGQ3NXxcXHUyNmY5KSg/OlxcdWZlMGZ8XFx1ZDgzY1tcXHVkZmZiLVxcdWRmZmZdKVxcdTIwMGRbXFx1MjY0MFxcdTI2NDJdXFx1ZmUwZnwoPzpcXHVkODNjW1xcdWRmYzNcXHVkZmM0XFx1ZGZjYV18XFx1ZDgzZFtcXHVkYzZlXFx1ZGM3MVxcdWRjNzNcXHVkYzc3XFx1ZGM4MVxcdWRjODJcXHVkYzg2XFx1ZGM4N1xcdWRlNDUtXFx1ZGU0N1xcdWRlNGJcXHVkZTRkXFx1ZGU0ZVxcdWRlYTNcXHVkZWI0LVxcdWRlYjZdfFxcdWQ4M2VbXFx1ZGQyNlxcdWRkMzctXFx1ZGQzOVxcdWRkM2RcXHVkZDNlXFx1ZGRkNi1cXHVkZGRkXSkoPzpcXHVkODNjW1xcdWRmZmItXFx1ZGZmZl0pP1xcdTIwMGRbXFx1MjY0MFxcdTI2NDJdXFx1ZmUwZnxcXHVkODNkXFx1ZGM2OFxcdTIwMGRcXHUyNzY0XFx1ZmUwZlxcdTIwMGRcXHVkODNkXFx1ZGM4YlxcdTIwMGRcXHVkODNkXFx1ZGM2OHxcXHVkODNkXFx1ZGM2OFxcdTIwMGRcXHVkODNkXFx1ZGM2OFxcdTIwMGRcXHVkODNkXFx1ZGM2NlxcdTIwMGRcXHVkODNkXFx1ZGM2NnxcXHVkODNkXFx1ZGM2OFxcdTIwMGRcXHVkODNkXFx1ZGM2OFxcdTIwMGRcXHVkODNkXFx1ZGM2N1xcdTIwMGRcXHVkODNkW1xcdWRjNjZcXHVkYzY3XXxcXHVkODNkXFx1ZGM2OFxcdTIwMGRcXHVkODNkXFx1ZGM2OVxcdTIwMGRcXHVkODNkXFx1ZGM2NlxcdTIwMGRcXHVkODNkXFx1ZGM2NnxcXHVkODNkXFx1ZGM2OFxcdTIwMGRcXHVkODNkXFx1ZGM2OVxcdTIwMGRcXHVkODNkXFx1ZGM2N1xcdTIwMGRcXHVkODNkW1xcdWRjNjZcXHVkYzY3XXxcXHVkODNkXFx1ZGM2OVxcdTIwMGRcXHUyNzY0XFx1ZmUwZlxcdTIwMGRcXHVkODNkXFx1ZGM4YlxcdTIwMGRcXHVkODNkW1xcdWRjNjhcXHVkYzY5XXxcXHVkODNkXFx1ZGM2OVxcdTIwMGRcXHVkODNkXFx1ZGM2OVxcdTIwMGRcXHVkODNkXFx1ZGM2NlxcdTIwMGRcXHVkODNkXFx1ZGM2NnxcXHVkODNkXFx1ZGM2OVxcdTIwMGRcXHVkODNkXFx1ZGM2OVxcdTIwMGRcXHVkODNkXFx1ZGM2N1xcdTIwMGRcXHVkODNkW1xcdWRjNjZcXHVkYzY3XXxcXHVkODNkXFx1ZGM2OFxcdTIwMGRcXHUyNzY0XFx1ZmUwZlxcdTIwMGRcXHVkODNkXFx1ZGM2OHxcXHVkODNkXFx1ZGM2OFxcdTIwMGRcXHVkODNkXFx1ZGM2NlxcdTIwMGRcXHVkODNkXFx1ZGM2NnxcXHVkODNkXFx1ZGM2OFxcdTIwMGRcXHVkODNkXFx1ZGM2N1xcdTIwMGRcXHVkODNkW1xcdWRjNjZcXHVkYzY3XXxcXHVkODNkXFx1ZGM2OFxcdTIwMGRcXHVkODNkXFx1ZGM2OFxcdTIwMGRcXHVkODNkW1xcdWRjNjZcXHVkYzY3XXxcXHVkODNkXFx1ZGM2OFxcdTIwMGRcXHVkODNkXFx1ZGM2OVxcdTIwMGRcXHVkODNkW1xcdWRjNjZcXHVkYzY3XXxcXHVkODNkXFx1ZGM2OVxcdTIwMGRcXHUyNzY0XFx1ZmUwZlxcdTIwMGRcXHVkODNkW1xcdWRjNjhcXHVkYzY5XXxcXHVkODNkXFx1ZGM2OVxcdTIwMGRcXHVkODNkXFx1ZGM2NlxcdTIwMGRcXHVkODNkXFx1ZGM2NnxcXHVkODNkXFx1ZGM2OVxcdTIwMGRcXHVkODNkXFx1ZGM2N1xcdTIwMGRcXHVkODNkW1xcdWRjNjZcXHVkYzY3XXxcXHVkODNkXFx1ZGM2OVxcdTIwMGRcXHVkODNkXFx1ZGM2OVxcdTIwMGRcXHVkODNkW1xcdWRjNjZcXHVkYzY3XXxcXHVkODNjXFx1ZGZmM1xcdWZlMGZcXHUyMDBkXFx1ZDgzY1xcdWRmMDh8XFx1ZDgzY1xcdWRmZjRcXHUyMDBkXFx1MjYyMFxcdWZlMGZ8XFx1ZDgzZFxcdWRjNDFcXHUyMDBkXFx1ZDgzZFxcdWRkZTh8XFx1ZDgzZFxcdWRjNjhcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNjlcXHUyMDBkXFx1ZDgzZFtcXHVkYzY2XFx1ZGM2N118XFx1ZDgzZFxcdWRjNmZcXHUyMDBkXFx1MjY0MFxcdWZlMGZ8XFx1ZDgzZFxcdWRjNmZcXHUyMDBkXFx1MjY0MlxcdWZlMGZ8XFx1ZDgzZVxcdWRkM2NcXHUyMDBkXFx1MjY0MFxcdWZlMGZ8XFx1ZDgzZVxcdWRkM2NcXHUyMDBkXFx1MjY0MlxcdWZlMGZ8XFx1ZDgzZVxcdWRkZGVcXHUyMDBkXFx1MjY0MFxcdWZlMGZ8XFx1ZDgzZVxcdWRkZGVcXHUyMDBkXFx1MjY0MlxcdWZlMGZ8XFx1ZDgzZVxcdWRkZGZcXHUyMDBkXFx1MjY0MFxcdWZlMGZ8XFx1ZDgzZVxcdWRkZGZcXHUyMDBkXFx1MjY0MlxcdWZlMGZ8KD86W1xcdTAwMjNcXHUwMDJhXFx1MDAzMC1cXHUwMDM5XSlcXHVmZTBmP1xcdTIwZTN8KD86KD86XFx1ZDgzY1tcXHVkZmNiXFx1ZGZjY118XFx1ZDgzZFtcXHVkZDc0XFx1ZGQ3NVxcdWRkOTBdfFtcXHUyNjFkXFx1MjZmN1xcdTI2ZjlcXHUyNzBjXFx1MjcwZF0pKD86XFx1ZmUwZnwoPyFcXHVmZTBlKSl8XFx1ZDgzY1tcXHVkZjg1XFx1ZGZjMi1cXHVkZmM0XFx1ZGZjN1xcdWRmY2FdfFxcdWQ4M2RbXFx1ZGM0MlxcdWRjNDNcXHVkYzQ2LVxcdWRjNTBcXHVkYzY2LVxcdWRjNjlcXHVkYzZlXFx1ZGM3MC1cXHVkYzc4XFx1ZGM3Y1xcdWRjODEtXFx1ZGM4M1xcdWRjODUtXFx1ZGM4N1xcdWRjYWFcXHVkZDdhXFx1ZGQ5NVxcdWRkOTZcXHVkZTQ1LVxcdWRlNDdcXHVkZTRiLVxcdWRlNGZcXHVkZWEzXFx1ZGViNC1cXHVkZWI2XFx1ZGVjMFxcdWRlY2NdfFxcdWQ4M2VbXFx1ZGQxOC1cXHVkZDFjXFx1ZGQxZVxcdWRkMWZcXHVkZDI2XFx1ZGQzMC1cXHVkZDM5XFx1ZGQzZFxcdWRkM2VcXHVkZGQxLVxcdWRkZGRdfFtcXHUyNzBhXFx1MjcwYl0pKD86XFx1ZDgzY1tcXHVkZmZiLVxcdWRmZmZdfCl8XFx1ZDgzY1xcdWRmZjRcXHVkYjQwXFx1ZGM2N1xcdWRiNDBcXHVkYzYyXFx1ZGI0MFxcdWRjNjVcXHVkYjQwXFx1ZGM2ZVxcdWRiNDBcXHVkYzY3XFx1ZGI0MFxcdWRjN2Z8XFx1ZDgzY1xcdWRmZjRcXHVkYjQwXFx1ZGM2N1xcdWRiNDBcXHVkYzYyXFx1ZGI0MFxcdWRjNzNcXHVkYjQwXFx1ZGM2M1xcdWRiNDBcXHVkYzc0XFx1ZGI0MFxcdWRjN2Z8XFx1ZDgzY1xcdWRmZjRcXHVkYjQwXFx1ZGM2N1xcdWRiNDBcXHVkYzYyXFx1ZGI0MFxcdWRjNzdcXHVkYjQwXFx1ZGM2Y1xcdWRiNDBcXHVkYzczXFx1ZGI0MFxcdWRjN2Z8XFx1ZDgzY1xcdWRkZTZcXHVkODNjW1xcdWRkZTgtXFx1ZGRlY1xcdWRkZWVcXHVkZGYxXFx1ZGRmMlxcdWRkZjRcXHVkZGY2LVxcdWRkZmFcXHVkZGZjXFx1ZGRmZFxcdWRkZmZdfFxcdWQ4M2NcXHVkZGU3XFx1ZDgzY1tcXHVkZGU2XFx1ZGRlN1xcdWRkZTktXFx1ZGRlZlxcdWRkZjEtXFx1ZGRmNFxcdWRkZjYtXFx1ZGRmOVxcdWRkZmJcXHVkZGZjXFx1ZGRmZVxcdWRkZmZdfFxcdWQ4M2NcXHVkZGU4XFx1ZDgzY1tcXHVkZGU2XFx1ZGRlOFxcdWRkZTlcXHVkZGViLVxcdWRkZWVcXHVkZGYwLVxcdWRkZjVcXHVkZGY3XFx1ZGRmYS1cXHVkZGZmXXxcXHVkODNjXFx1ZGRlOVxcdWQ4M2NbXFx1ZGRlYVxcdWRkZWNcXHVkZGVmXFx1ZGRmMFxcdWRkZjJcXHVkZGY0XFx1ZGRmZl18XFx1ZDgzY1xcdWRkZWFcXHVkODNjW1xcdWRkZTZcXHVkZGU4XFx1ZGRlYVxcdWRkZWNcXHVkZGVkXFx1ZGRmNy1cXHVkZGZhXXxcXHVkODNjXFx1ZGRlYlxcdWQ4M2NbXFx1ZGRlZS1cXHVkZGYwXFx1ZGRmMlxcdWRkZjRcXHVkZGY3XXxcXHVkODNjXFx1ZGRlY1xcdWQ4M2NbXFx1ZGRlNlxcdWRkZTdcXHVkZGU5LVxcdWRkZWVcXHVkZGYxLVxcdWRkZjNcXHVkZGY1LVxcdWRkZmFcXHVkZGZjXFx1ZGRmZV18XFx1ZDgzY1xcdWRkZWRcXHVkODNjW1xcdWRkZjBcXHVkZGYyXFx1ZGRmM1xcdWRkZjdcXHVkZGY5XFx1ZGRmYV18XFx1ZDgzY1xcdWRkZWVcXHVkODNjW1xcdWRkZTgtXFx1ZGRlYVxcdWRkZjEtXFx1ZGRmNFxcdWRkZjYtXFx1ZGRmOV18XFx1ZDgzY1xcdWRkZWZcXHVkODNjW1xcdWRkZWFcXHVkZGYyXFx1ZGRmNFxcdWRkZjVdfFxcdWQ4M2NcXHVkZGYwXFx1ZDgzY1tcXHVkZGVhXFx1ZGRlYy1cXHVkZGVlXFx1ZGRmMlxcdWRkZjNcXHVkZGY1XFx1ZGRmN1xcdWRkZmNcXHVkZGZlXFx1ZGRmZl18XFx1ZDgzY1xcdWRkZjFcXHVkODNjW1xcdWRkZTYtXFx1ZGRlOFxcdWRkZWVcXHVkZGYwXFx1ZGRmNy1cXHVkZGZiXFx1ZGRmZV18XFx1ZDgzY1xcdWRkZjJcXHVkODNjW1xcdWRkZTZcXHVkZGU4LVxcdWRkZWRcXHVkZGYwLVxcdWRkZmZdfFxcdWQ4M2NcXHVkZGYzXFx1ZDgzY1tcXHVkZGU2XFx1ZGRlOFxcdWRkZWEtXFx1ZGRlY1xcdWRkZWVcXHVkZGYxXFx1ZGRmNFxcdWRkZjVcXHVkZGY3XFx1ZGRmYVxcdWRkZmZdfFxcdWQ4M2NcXHVkZGY0XFx1ZDgzY1xcdWRkZjJ8XFx1ZDgzY1xcdWRkZjVcXHVkODNjW1xcdWRkZTZcXHVkZGVhLVxcdWRkZWRcXHVkZGYwLVxcdWRkZjNcXHVkZGY3LVxcdWRkZjlcXHVkZGZjXFx1ZGRmZV18XFx1ZDgzY1xcdWRkZjZcXHVkODNjXFx1ZGRlNnxcXHVkODNjXFx1ZGRmN1xcdWQ4M2NbXFx1ZGRlYVxcdWRkZjRcXHVkZGY4XFx1ZGRmYVxcdWRkZmNdfFxcdWQ4M2NcXHVkZGY4XFx1ZDgzY1tcXHVkZGU2LVxcdWRkZWFcXHVkZGVjLVxcdWRkZjRcXHVkZGY3LVxcdWRkZjlcXHVkZGZiXFx1ZGRmZC1cXHVkZGZmXXxcXHVkODNjXFx1ZGRmOVxcdWQ4M2NbXFx1ZGRlNlxcdWRkZThcXHVkZGU5XFx1ZGRlYi1cXHVkZGVkXFx1ZGRlZi1cXHVkZGY0XFx1ZGRmN1xcdWRkZjlcXHVkZGZiXFx1ZGRmY1xcdWRkZmZdfFxcdWQ4M2NcXHVkZGZhXFx1ZDgzY1tcXHVkZGU2XFx1ZGRlY1xcdWRkZjJcXHVkZGYzXFx1ZGRmOFxcdWRkZmVcXHVkZGZmXXxcXHVkODNjXFx1ZGRmYlxcdWQ4M2NbXFx1ZGRlNlxcdWRkZThcXHVkZGVhXFx1ZGRlY1xcdWRkZWVcXHVkZGYzXFx1ZGRmYV18XFx1ZDgzY1xcdWRkZmNcXHVkODNjW1xcdWRkZWJcXHVkZGY4XXxcXHVkODNjXFx1ZGRmZFxcdWQ4M2NcXHVkZGYwfFxcdWQ4M2NcXHVkZGZlXFx1ZDgzY1tcXHVkZGVhXFx1ZGRmOV18XFx1ZDgzY1xcdWRkZmZcXHVkODNjW1xcdWRkZTZcXHVkZGYyXFx1ZGRmY118XFx1ZDgwMFxcdWRjMDB8XFx1ZDgzY1tcXHVkY2NmXFx1ZGQ4ZVxcdWRkOTEtXFx1ZGQ5YVxcdWRkZTYtXFx1ZGRmZlxcdWRlMDFcXHVkZTMyLVxcdWRlMzZcXHVkZTM4LVxcdWRlM2FcXHVkZTUwXFx1ZGU1MVxcdWRmMDAtXFx1ZGYyMFxcdWRmMmQtXFx1ZGYzNVxcdWRmMzctXFx1ZGY3Y1xcdWRmN2UtXFx1ZGY4NFxcdWRmODYtXFx1ZGY5M1xcdWRmYTAtXFx1ZGZjMVxcdWRmYzVcXHVkZmM2XFx1ZGZjOFxcdWRmYzlcXHVkZmNmLVxcdWRmZDNcXHVkZmUwLVxcdWRmZjBcXHVkZmY0XFx1ZGZmOC1cXHVkZmZmXXxcXHVkODNkW1xcdWRjMDAtXFx1ZGMzZVxcdWRjNDBcXHVkYzQ0XFx1ZGM0NVxcdWRjNTEtXFx1ZGM2NVxcdWRjNmEtXFx1ZGM2ZFxcdWRjNmZcXHVkYzc5LVxcdWRjN2JcXHVkYzdkLVxcdWRjODBcXHVkYzg0XFx1ZGM4OC1cXHVkY2E5XFx1ZGNhYi1cXHVkY2ZjXFx1ZGNmZi1cXHVkZDNkXFx1ZGQ0Yi1cXHVkZDRlXFx1ZGQ1MC1cXHVkZDY3XFx1ZGRhNFxcdWRkZmItXFx1ZGU0NFxcdWRlNDgtXFx1ZGU0YVxcdWRlODAtXFx1ZGVhMlxcdWRlYTQtXFx1ZGViM1xcdWRlYjctXFx1ZGViZlxcdWRlYzEtXFx1ZGVjNVxcdWRlZDAtXFx1ZGVkMlxcdWRlZWJcXHVkZWVjXFx1ZGVmNC1cXHVkZWY4XXxcXHVkODNlW1xcdWRkMTAtXFx1ZGQxN1xcdWRkMWRcXHVkZDIwLVxcdWRkMjVcXHVkZDI3LVxcdWRkMmZcXHVkZDNhXFx1ZGQzY1xcdWRkNDAtXFx1ZGQ0NVxcdWRkNDctXFx1ZGQ0Y1xcdWRkNTAtXFx1ZGQ2YlxcdWRkODAtXFx1ZGQ5N1xcdWRkYzBcXHVkZGQwXFx1ZGRkZS1cXHVkZGU2XXxbXFx1MjNlOS1cXHUyM2VjXFx1MjNmMFxcdTIzZjNcXHUyNjQwXFx1MjY0MlxcdTI2OTVcXHUyNmNlXFx1MjcwNVxcdTI3MjhcXHUyNzRjXFx1Mjc0ZVxcdTI3NTMtXFx1Mjc1NVxcdTI3OTUtXFx1Mjc5N1xcdTI3YjBcXHUyN2JmXFx1ZTUwYV18KD86XFx1ZDgzY1tcXHVkYzA0XFx1ZGQ3MFxcdWRkNzFcXHVkZDdlXFx1ZGQ3ZlxcdWRlMDJcXHVkZTFhXFx1ZGUyZlxcdWRlMzdcXHVkZjIxXFx1ZGYyNC1cXHVkZjJjXFx1ZGYzNlxcdWRmN2RcXHVkZjk2XFx1ZGY5N1xcdWRmOTktXFx1ZGY5YlxcdWRmOWVcXHVkZjlmXFx1ZGZjZFxcdWRmY2VcXHVkZmQ0LVxcdWRmZGZcXHVkZmYzXFx1ZGZmNVxcdWRmZjddfFxcdWQ4M2RbXFx1ZGMzZlxcdWRjNDFcXHVkY2ZkXFx1ZGQ0OVxcdWRkNGFcXHVkZDZmXFx1ZGQ3MFxcdWRkNzNcXHVkZDc2LVxcdWRkNzlcXHVkZDg3XFx1ZGQ4YS1cXHVkZDhkXFx1ZGRhNVxcdWRkYThcXHVkZGIxXFx1ZGRiMlxcdWRkYmNcXHVkZGMyLVxcdWRkYzRcXHVkZGQxLVxcdWRkZDNcXHVkZGRjLVxcdWRkZGVcXHVkZGUxXFx1ZGRlM1xcdWRkZThcXHVkZGVmXFx1ZGRmM1xcdWRkZmFcXHVkZWNiXFx1ZGVjZC1cXHVkZWNmXFx1ZGVlMC1cXHVkZWU1XFx1ZGVlOVxcdWRlZjBcXHVkZWYzXXxbXFx1MDBhOVxcdTAwYWVcXHUyMDNjXFx1MjA0OVxcdTIxMjJcXHUyMTM5XFx1MjE5NC1cXHUyMTk5XFx1MjFhOVxcdTIxYWFcXHUyMzFhXFx1MjMxYlxcdTIzMjhcXHUyM2NmXFx1MjNlZC1cXHUyM2VmXFx1MjNmMVxcdTIzZjJcXHUyM2Y4LVxcdTIzZmFcXHUyNGMyXFx1MjVhYVxcdTI1YWJcXHUyNWI2XFx1MjVjMFxcdTI1ZmItXFx1MjVmZVxcdTI2MDAtXFx1MjYwNFxcdTI2MGVcXHUyNjExXFx1MjYxNFxcdTI2MTVcXHUyNjE4XFx1MjYyMFxcdTI2MjJcXHUyNjIzXFx1MjYyNlxcdTI2MmFcXHUyNjJlXFx1MjYyZlxcdTI2MzgtXFx1MjYzYVxcdTI2NDgtXFx1MjY1M1xcdTI2NjBcXHUyNjYzXFx1MjY2NVxcdTI2NjZcXHUyNjY4XFx1MjY3YlxcdTI2N2ZcXHUyNjkyLVxcdTI2OTRcXHUyNjk2XFx1MjY5N1xcdTI2OTlcXHUyNjliXFx1MjY5Y1xcdTI2YTBcXHUyNmExXFx1MjZhYVxcdTI2YWJcXHUyNmIwXFx1MjZiMVxcdTI2YmRcXHUyNmJlXFx1MjZjNFxcdTI2YzVcXHUyNmM4XFx1MjZjZlxcdTI2ZDFcXHUyNmQzXFx1MjZkNFxcdTI2ZTlcXHUyNmVhXFx1MjZmMC1cXHUyNmY1XFx1MjZmOFxcdTI2ZmFcXHUyNmZkXFx1MjcwMlxcdTI3MDhcXHUyNzA5XFx1MjcwZlxcdTI3MTJcXHUyNzE0XFx1MjcxNlxcdTI3MWRcXHUyNzIxXFx1MjczM1xcdTI3MzRcXHUyNzQ0XFx1Mjc0N1xcdTI3NTdcXHUyNzYzXFx1Mjc2NFxcdTI3YTFcXHUyOTM0XFx1MjkzNVxcdTJiMDUtXFx1MmIwN1xcdTJiMWJcXHUyYjFjXFx1MmI1MFxcdTJiNTVcXHUzMDMwXFx1MzAzZFxcdTMyOTdcXHUzMjk5XSkoPzpcXHVmZTBmfCg/IVxcdWZlMGUpKS9nLFxuXG4gICAgLy8gYXZvaWQgcnVudGltZSBSZWdFeHAgY3JlYXRpb24gZm9yIG5vdCBzbyBzbWFydCxcbiAgICAvLyBub3QgSklUIGJhc2VkLCBhbmQgb2xkIGJyb3dzZXJzIC8gZW5naW5lc1xuICAgIFVGRTBGZyA9IC9cXHVGRTBGL2csXG5cbiAgICAvLyBhdm9pZCB1c2luZyBhIHN0cmluZyBsaXRlcmFsIGxpa2UgJ1xcdTIwMEQnIGhlcmUgYmVjYXVzZSBtaW5pZmllcnMgZXhwYW5kIGl0IGlubGluZVxuICAgIFUyMDBEID0gU3RyaW5nLmZyb21DaGFyQ29kZSgweDIwMEQpLFxuXG4gICAgLy8gdXNlZCB0byBmaW5kIEhUTUwgc3BlY2lhbCBjaGFycyBpbiBhdHRyaWJ1dGVzXG4gICAgcmVzY2FwZXIgPSAvWyY8PidcIl0vZyxcblxuICAgIC8vIG5vZGVzIHdpdGggdHlwZSAxIHdoaWNoIHNob3VsZCAqKm5vdCoqIGJlIHBhcnNlZFxuICAgIHNob3VsZG50QmVQYXJzZWQgPSAvXig/OmlmcmFtZXxub2ZyYW1lc3xub3NjcmlwdHxzY3JpcHR8c2VsZWN0fHN0eWxlfHRleHRhcmVhKSQvLFxuXG4gICAgLy8ganVzdCBhIHByaXZhdGUgc2hvcnRjdXRcbiAgICBmcm9tQ2hhckNvZGUgPSBTdHJpbmcuZnJvbUNoYXJDb2RlO1xuXG4gIHJldHVybiB0d2Vtb2ppO1xuXG5cbiAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuICAvLyAgcHJpdmF0ZSBmdW5jdGlvbnMgIC8vXG4gIC8vICAgICBkZWNsYXJhdGlvbiAgICAgLy9cbiAgLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4gIC8qKlxuICAgKiBTaG9ydGN1dCB0byBjcmVhdGUgdGV4dCBub2Rlc1xuICAgKiBAcGFyYW0gICBzdHJpbmcgIHRleHQgdXNlZCB0byBjcmVhdGUgRE9NIHRleHQgbm9kZVxuICAgKiBAcmV0dXJuICBOb2RlICBhIERPTSBub2RlIHdpdGggdGhhdCB0ZXh0XG4gICAqL1xuICBmdW5jdGlvbiBjcmVhdGVUZXh0KHRleHQsIGNsZWFuKSB7XG4gICAgcmV0dXJuIGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKGNsZWFuID8gdGV4dC5yZXBsYWNlKFVGRTBGZywgJycpIDogdGV4dCk7XG4gIH1cblxuICAvKipcbiAgICogVXRpbGl0eSBmdW5jdGlvbiB0byBlc2NhcGUgaHRtbCBhdHRyaWJ1dGUgdGV4dFxuICAgKiBAcGFyYW0gICBzdHJpbmcgIHRleHQgdXNlIGluIEhUTUwgYXR0cmlidXRlXG4gICAqIEByZXR1cm4gIHN0cmluZyAgdGV4dCBlbmNvZGVkIHRvIHVzZSBpbiBIVE1MIGF0dHJpYnV0ZVxuICAgKi9cbiAgZnVuY3Rpb24gZXNjYXBlSFRNTChzKSB7XG4gICAgcmV0dXJuIHMucmVwbGFjZShyZXNjYXBlciwgcmVwbGFjZXIpO1xuICB9XG5cbiAgLyoqXG4gICAqIERlZmF1bHQgY2FsbGJhY2sgdXNlZCB0byBnZW5lcmF0ZSBlbW9qaSBzcmNcbiAgICogIGJhc2VkIG9uIFR3aXR0ZXIgQ0ROXG4gICAqIEBwYXJhbSAgIHN0cmluZyAgICB0aGUgZW1vamkgY29kZXBvaW50IHN0cmluZ1xuICAgKiBAcGFyYW0gICBzdHJpbmcgICAgdGhlIGRlZmF1bHQgc2l6ZSB0byB1c2UsIGkuZS4gXCIzNngzNlwiXG4gICAqIEByZXR1cm4gIHN0cmluZyAgICB0aGUgaW1hZ2Ugc291cmNlIHRvIHVzZVxuICAgKi9cbiAgZnVuY3Rpb24gZGVmYXVsdEltYWdlU3JjR2VuZXJhdG9yKGljb24sIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gJycuY29uY2F0KG9wdGlvbnMuYmFzZSwgb3B0aW9ucy5zaXplLCAnLycsIGljb24sIG9wdGlvbnMuZXh0KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHaXZlbiBhIGdlbmVyaWMgRE9NIG5vZGVUeXBlIDEsIHdhbGsgdGhyb3VnaCBhbGwgY2hpbGRyZW5cbiAgICogYW5kIHN0b3JlIGV2ZXJ5IG5vZGVUeXBlIDMgKCN0ZXh0KSBmb3VuZCBpbiB0aGUgdHJlZS5cbiAgICogQHBhcmFtICAgRWxlbWVudCBhIERPTSBFbGVtZW50IHdpdGggcHJvYmFibHkgc29tZSB0ZXh0IGluIGl0XG4gICAqIEBwYXJhbSAgIEFycmF5IHRoZSBsaXN0IG9mIHByZXZpb3VzbHkgZGlzY292ZXJlZCB0ZXh0IG5vZGVzXG4gICAqIEByZXR1cm4gIEFycmF5IHNhbWUgbGlzdCB3aXRoIG5ldyBkaXNjb3ZlcmVkIG5vZGVzLCBpZiBhbnlcbiAgICovXG4gIGZ1bmN0aW9uIGdyYWJBbGxUZXh0Tm9kZXMobm9kZSwgYWxsVGV4dCkge1xuICAgIHZhclxuICAgICAgY2hpbGROb2RlcyA9IG5vZGUuY2hpbGROb2RlcyxcbiAgICAgIGxlbmd0aCA9IGNoaWxkTm9kZXMubGVuZ3RoLFxuICAgICAgc3Vibm9kZSxcbiAgICAgIG5vZGVUeXBlO1xuICAgIHdoaWxlIChsZW5ndGgtLSkge1xuICAgICAgc3Vibm9kZSA9IGNoaWxkTm9kZXNbbGVuZ3RoXTtcbiAgICAgIG5vZGVUeXBlID0gc3Vibm9kZS5ub2RlVHlwZTtcbiAgICAgIC8vIHBhcnNlIGVtb2ppIG9ubHkgaW4gdGV4dCBub2Rlc1xuICAgICAgaWYgKG5vZGVUeXBlID09PSAzKSB7XG4gICAgICAgIC8vIGNvbGxlY3QgdGhlbSB0byBwcm9jZXNzIGVtb2ppIGxhdGVyXG4gICAgICAgIGFsbFRleHQucHVzaChzdWJub2RlKTtcbiAgICAgIH1cbiAgICAgIC8vIGlnbm9yZSBhbGwgbm9kZXMgdGhhdCBhcmUgbm90IHR5cGUgMSwgdGhhdCBhcmUgc3ZnLCBvciB0aGF0XG4gICAgICAvLyBzaG91bGQgbm90IGJlIHBhcnNlZCBhcyBzY3JpcHQsIHN0eWxlLCBhbmQgb3RoZXJzXG4gICAgICBlbHNlIGlmIChub2RlVHlwZSA9PT0gMSAmJiAhKCdvd25lclNWR0VsZW1lbnQnIGluIHN1Ym5vZGUpICYmXG4gICAgICAgICAgIXNob3VsZG50QmVQYXJzZWQudGVzdChzdWJub2RlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkpKSB7XG4gICAgICAgIGdyYWJBbGxUZXh0Tm9kZXMoc3Vibm9kZSwgYWxsVGV4dCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBhbGxUZXh0O1xuICB9XG5cbiAgLyoqXG4gICAqIFVzZWQgdG8gYm90aCByZW1vdmUgdGhlIHBvc3NpYmxlIHZhcmlhbnRcbiAgICogIGFuZCB0byBjb252ZXJ0IHV0ZjE2IGludG8gY29kZSBwb2ludHMuXG4gICAqICBJZiB0aGVyZSBpcyBhIHplcm8td2lkdGgtam9pbmVyIChVKzIwMEQpLCBsZWF2ZSB0aGUgdmFyaWFudHMgaW4uXG4gICAqIEBwYXJhbSAgIHN0cmluZyAgICB0aGUgcmF3IHRleHQgb2YgdGhlIGVtb2ppIG1hdGNoXG4gICAqIEByZXR1cm4gIHN0cmluZyAgICB0aGUgY29kZSBwb2ludFxuICAgKi9cbiAgZnVuY3Rpb24gZ3JhYlRoZVJpZ2h0SWNvbihyYXdUZXh0KSB7XG4gICAgLy8gaWYgdmFyaWFudCBpcyBwcmVzZW50IGFzIFxcdUZFMEZcbiAgICByZXR1cm4gdG9Db2RlUG9pbnQocmF3VGV4dC5pbmRleE9mKFUyMDBEKSA8IDAgP1xuICAgICAgcmF3VGV4dC5yZXBsYWNlKFVGRTBGZywgJycpIDpcbiAgICAgIHJhd1RleHRcbiAgICApO1xuICB9XG5cbiAgLyoqXG4gICAqIERPTSB2ZXJzaW9uIG9mIHRoZSBzYW1lIGxvZ2ljIC8gcGFyc2VyOlxuICAgKiAgZW1vamlmeSBhbGwgZm91bmQgc3ViLXRleHQgbm9kZXMgcGxhY2luZyBpbWFnZXMgbm9kZSBpbnN0ZWFkLlxuICAgKiBAcGFyYW0gICBFbGVtZW50ICAgZ2VuZXJpYyBET00gbm9kZSB3aXRoIHNvbWUgdGV4dCBpbiBzb21lIGNoaWxkIG5vZGVcbiAgICogQHBhcmFtICAgT2JqZWN0ICAgIG9wdGlvbnMgIGNvbnRhaW5pbmcgaW5mbyBhYm91dCBob3cgdG8gcGFyc2VcbiAgICAqXG4gICAgKiAgICAgICAgICAgIC5jYWxsYmFjayAgIEZ1bmN0aW9uICB0aGUgY2FsbGJhY2sgdG8gaW52b2tlIHBlciBlYWNoIGZvdW5kIGVtb2ppLlxuICAgICogICAgICAgICAgICAuYmFzZSAgICAgICBzdHJpbmcgICAgdGhlIGJhc2UgdXJsLCBieSBkZWZhdWx0IHR3ZW1vamkuYmFzZVxuICAgICogICAgICAgICAgICAuZXh0ICAgICAgICBzdHJpbmcgICAgdGhlIGltYWdlIGV4dGVuc2lvbiwgYnkgZGVmYXVsdCB0d2Vtb2ppLmV4dFxuICAgICogICAgICAgICAgICAuc2l6ZSAgICAgICBzdHJpbmcgICAgdGhlIGFzc2V0cyBzaXplLCBieSBkZWZhdWx0IHR3ZW1vamkuc2l6ZVxuICAgICpcbiAgICogQHJldHVybiAgRWxlbWVudCBzYW1lIGdlbmVyaWMgbm9kZSB3aXRoIGVtb2ppIGluIHBsYWNlLCBpZiBhbnkuXG4gICAqL1xuICBmdW5jdGlvbiBwYXJzZU5vZGUobm9kZSwgb3B0aW9ucykge1xuICAgIHZhclxuICAgICAgYWxsVGV4dCA9IGdyYWJBbGxUZXh0Tm9kZXMobm9kZSwgW10pLFxuICAgICAgbGVuZ3RoID0gYWxsVGV4dC5sZW5ndGgsXG4gICAgICBhdHRyaWIsXG4gICAgICBhdHRybmFtZSxcbiAgICAgIG1vZGlmaWVkLFxuICAgICAgZnJhZ21lbnQsXG4gICAgICBzdWJub2RlLFxuICAgICAgdGV4dCxcbiAgICAgIG1hdGNoLFxuICAgICAgaSxcbiAgICAgIGluZGV4LFxuICAgICAgaW1nLFxuICAgICAgcmF3VGV4dCxcbiAgICAgIGljb25JZCxcbiAgICAgIHNyYztcbiAgICB3aGlsZSAobGVuZ3RoLS0pIHtcbiAgICAgIG1vZGlmaWVkID0gZmFsc2U7XG4gICAgICBmcmFnbWVudCA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgIHN1Ym5vZGUgPSBhbGxUZXh0W2xlbmd0aF07XG4gICAgICB0ZXh0ID0gc3Vibm9kZS5ub2RlVmFsdWU7XG4gICAgICBpID0gMDtcbiAgICAgIHdoaWxlICgobWF0Y2ggPSByZS5leGVjKHRleHQpKSkge1xuICAgICAgICBpbmRleCA9IG1hdGNoLmluZGV4O1xuICAgICAgICBpZiAoaW5kZXggIT09IGkpIHtcbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChcbiAgICAgICAgICAgIGNyZWF0ZVRleHQodGV4dC5zbGljZShpLCBpbmRleCksIHRydWUpXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICByYXdUZXh0ID0gbWF0Y2hbMF07XG4gICAgICAgIGljb25JZCA9IGdyYWJUaGVSaWdodEljb24ocmF3VGV4dCk7XG4gICAgICAgIGkgPSBpbmRleCArIHJhd1RleHQubGVuZ3RoO1xuICAgICAgICBzcmMgPSBvcHRpb25zLmNhbGxiYWNrKGljb25JZCwgb3B0aW9ucyk7XG4gICAgICAgIGlmIChzcmMpIHtcbiAgICAgICAgICBpbWcgPSBuZXcgSW1hZ2UoKTtcbiAgICAgICAgICBpbWcub25lcnJvciA9IG9wdGlvbnMub25lcnJvcjtcbiAgICAgICAgICBpbWcuc2V0QXR0cmlidXRlKCdkcmFnZ2FibGUnLCAnZmFsc2UnKTtcbiAgICAgICAgICBhdHRyaWIgPSBvcHRpb25zLmF0dHJpYnV0ZXMocmF3VGV4dCwgaWNvbklkKTtcbiAgICAgICAgICBmb3IgKGF0dHJuYW1lIGluIGF0dHJpYikge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICBhdHRyaWIuaGFzT3duUHJvcGVydHkoYXR0cm5hbWUpICYmXG4gICAgICAgICAgICAgIC8vIGRvbid0IGFsbG93IGFueSBoYW5kbGVycyB0byBiZSBzZXQgKyBkb24ndCBhbGxvdyBvdmVycmlkZXNcbiAgICAgICAgICAgICAgYXR0cm5hbWUuaW5kZXhPZignb24nKSAhPT0gMCAmJlxuICAgICAgICAgICAgICAhaW1nLmhhc0F0dHJpYnV0ZShhdHRybmFtZSlcbiAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICBpbWcuc2V0QXR0cmlidXRlKGF0dHJuYW1lLCBhdHRyaWJbYXR0cm5hbWVdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaW1nLmNsYXNzTmFtZSA9IG9wdGlvbnMuY2xhc3NOYW1lO1xuICAgICAgICAgIGltZy5hbHQgPSByYXdUZXh0O1xuICAgICAgICAgIGltZy5zcmMgPSBzcmM7XG4gICAgICAgICAgbW9kaWZpZWQgPSB0cnVlO1xuICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKGltZyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpbWcpIGZyYWdtZW50LmFwcGVuZENoaWxkKGNyZWF0ZVRleHQocmF3VGV4dCwgZmFsc2UpKTtcbiAgICAgICAgaW1nID0gbnVsbDtcbiAgICAgIH1cbiAgICAgIC8vIGlzIHRoZXJlIGFjdHVhbGx5IGFueXRoaW5nIHRvIHJlcGxhY2UgaW4gaGVyZSA/XG4gICAgICBpZiAobW9kaWZpZWQpIHtcbiAgICAgICAgLy8gYW55IHRleHQgbGVmdCB0byBiZSBhZGRlZCA/XG4gICAgICAgIGlmIChpIDwgdGV4dC5sZW5ndGgpIHtcbiAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChcbiAgICAgICAgICAgIGNyZWF0ZVRleHQodGV4dC5zbGljZShpKSwgdHJ1ZSlcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICAgIC8vIHJlcGxhY2UgdGhlIHRleHQgbm9kZSBvbmx5LCBsZWF2ZSBpbnRhY3RcbiAgICAgICAgLy8gYW55dGhpbmcgZWxzZSBzdXJyb3VuZGluZyBzdWNoIHRleHRcbiAgICAgICAgc3Vibm9kZS5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChmcmFnbWVudCwgc3Vibm9kZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgLyoqXG4gICAqIFN0cmluZy9IVE1MIHZlcnNpb24gb2YgdGhlIHNhbWUgbG9naWMgLyBwYXJzZXI6XG4gICAqICBlbW9qaWZ5IGEgZ2VuZXJpYyB0ZXh0IHBsYWNpbmcgaW1hZ2VzIHRhZ3MgaW5zdGVhZCBvZiBzdXJyb2dhdGVzIHBhaXIuXG4gICAqIEBwYXJhbSAgIHN0cmluZyAgICBnZW5lcmljIHN0cmluZyB3aXRoIHBvc3NpYmx5IHNvbWUgZW1vamkgaW4gaXRcbiAgICogQHBhcmFtICAgT2JqZWN0ICAgIG9wdGlvbnMgIGNvbnRhaW5pbmcgaW5mbyBhYm91dCBob3cgdG8gcGFyc2VcbiAgICpcbiAgICogICAgICAgICAgICAuY2FsbGJhY2sgICBGdW5jdGlvbiAgdGhlIGNhbGxiYWNrIHRvIGludm9rZSBwZXIgZWFjaCBmb3VuZCBlbW9qaS5cbiAgICogICAgICAgICAgICAuYmFzZSAgICAgICBzdHJpbmcgICAgdGhlIGJhc2UgdXJsLCBieSBkZWZhdWx0IHR3ZW1vamkuYmFzZVxuICAgKiAgICAgICAgICAgIC5leHQgICAgICAgIHN0cmluZyAgICB0aGUgaW1hZ2UgZXh0ZW5zaW9uLCBieSBkZWZhdWx0IHR3ZW1vamkuZXh0XG4gICAqICAgICAgICAgICAgLnNpemUgICAgICAgc3RyaW5nICAgIHRoZSBhc3NldHMgc2l6ZSwgYnkgZGVmYXVsdCB0d2Vtb2ppLnNpemVcbiAgICpcbiAgICogQHJldHVybiAgdGhlIHN0cmluZyB3aXRoIDxpbWcgdGFncz4gcmVwbGFjaW5nIGFsbCBmb3VuZCBhbmQgcGFyc2VkIGVtb2ppXG4gICAqL1xuICBmdW5jdGlvbiBwYXJzZVN0cmluZyhzdHIsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gcmVwbGFjZShzdHIsIGZ1bmN0aW9uIChyYXdUZXh0KSB7XG4gICAgICB2YXJcbiAgICAgICAgcmV0ID0gcmF3VGV4dCxcbiAgICAgICAgaWNvbklkID0gZ3JhYlRoZVJpZ2h0SWNvbihyYXdUZXh0KSxcbiAgICAgICAgc3JjID0gb3B0aW9ucy5jYWxsYmFjayhpY29uSWQsIG9wdGlvbnMpLFxuICAgICAgICBhdHRyaWIsXG4gICAgICAgIGF0dHJuYW1lO1xuICAgICAgaWYgKHNyYykge1xuICAgICAgICAvLyByZWN5Y2xlIHRoZSBtYXRjaCBzdHJpbmcgcmVwbGFjaW5nIHRoZSBlbW9qaVxuICAgICAgICAvLyB3aXRoIGl0cyBpbWFnZSBjb3VudGVyIHBhcnRcbiAgICAgICAgcmV0ID0gJzxpbWcgJy5jb25jYXQoXG4gICAgICAgICAgJ2NsYXNzPVwiJywgb3B0aW9ucy5jbGFzc05hbWUsICdcIiAnLFxuICAgICAgICAgICdkcmFnZ2FibGU9XCJmYWxzZVwiICcsXG4gICAgICAgICAgLy8gbmVlZHMgdG8gcHJlc2VydmUgdXNlciBvcmlnaW5hbCBpbnRlbnRcbiAgICAgICAgICAvLyB3aGVuIHZhcmlhbnRzIHNob3VsZCBiZSBjb3BpZWQgYW5kIHBhc3RlZCB0b29cbiAgICAgICAgICAnYWx0PVwiJyxcbiAgICAgICAgICByYXdUZXh0LFxuICAgICAgICAgICdcIicsXG4gICAgICAgICAgJyBzcmM9XCInLFxuICAgICAgICAgIHNyYyxcbiAgICAgICAgICAnXCInXG4gICAgICAgICk7XG4gICAgICAgIGF0dHJpYiA9IG9wdGlvbnMuYXR0cmlidXRlcyhyYXdUZXh0LCBpY29uSWQpO1xuICAgICAgICBmb3IgKGF0dHJuYW1lIGluIGF0dHJpYikge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGF0dHJpYi5oYXNPd25Qcm9wZXJ0eShhdHRybmFtZSkgJiZcbiAgICAgICAgICAgIC8vIGRvbid0IGFsbG93IGFueSBoYW5kbGVycyB0byBiZSBzZXQgKyBkb24ndCBhbGxvdyBvdmVycmlkZXNcbiAgICAgICAgICAgIGF0dHJuYW1lLmluZGV4T2YoJ29uJykgIT09IDAgJiZcbiAgICAgICAgICAgIHJldC5pbmRleE9mKCcgJyArIGF0dHJuYW1lICsgJz0nKSA9PT0gLTFcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHJldCA9IHJldC5jb25jYXQoJyAnLCBhdHRybmFtZSwgJz1cIicsIGVzY2FwZUhUTUwoYXR0cmliW2F0dHJuYW1lXSksICdcIicpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXQgPSByZXQuY29uY2F0KCcvPicpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJldDtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGdW5jdGlvbiB1c2VkIHRvIGFjdHVhbGx5IHJlcGxhY2UgSFRNTCBzcGVjaWFsIGNoYXJzXG4gICAqIEBwYXJhbSAgIHN0cmluZyAgSFRNTCBzcGVjaWFsIGNoYXJcbiAgICogQHJldHVybiAgc3RyaW5nICBlbmNvZGVkIEhUTUwgc3BlY2lhbCBjaGFyXG4gICAqL1xuICBmdW5jdGlvbiByZXBsYWNlcihtKSB7XG4gICAgcmV0dXJuIGVzY2FwZXJbbV07XG4gIH1cblxuICAvKipcbiAgICogRGVmYXVsdCBvcHRpb25zLmF0dHJpYnV0ZSBjYWxsYmFja1xuICAgKiBAcmV0dXJuICBudWxsXG4gICAqL1xuICBmdW5jdGlvbiByZXR1cm5OdWxsKCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLyoqXG4gICAqIEdpdmVuIGEgZ2VuZXJpYyB2YWx1ZSwgY3JlYXRlcyBpdHMgc3F1YXJlZCBjb3VudGVycGFydCBpZiBpdCdzIGEgbnVtYmVyLlxuICAgKiAgQXMgZXhhbXBsZSwgbnVtYmVyIDM2IHdpbGwgcmV0dXJuICczNngzNicuXG4gICAqIEBwYXJhbSAgIGFueSAgICAgYSBnZW5lcmljIHZhbHVlLlxuICAgKiBAcmV0dXJuICBhbnkgICAgIGEgc3RyaW5nIHJlcHJlc2VudGluZyBhc3NldCBzaXplLCBpLmUuIFwiMzZ4MzZcIlxuICAgKiAgICAgICAgICAgICAgICAgIG9ubHkgaW4gY2FzZSB0aGUgdmFsdWUgd2FzIGEgbnVtYmVyLlxuICAgKiAgICAgICAgICAgICAgICAgIFJldHVybnMgaW5pdGlhbCB2YWx1ZSBvdGhlcndpc2UuXG4gICAqL1xuICBmdW5jdGlvbiB0b1NpemVTcXVhcmVkQXNzZXQodmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJyA/XG4gICAgICB2YWx1ZSArICd4JyArIHZhbHVlIDpcbiAgICAgIHZhbHVlO1xuICB9XG5cblxuICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4gIC8vICBleHBvcnRlZCBmdW5jdGlvbnMgLy9cbiAgLy8gICAgIGRlY2xhcmF0aW9uICAgICAvL1xuICAvLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbiAgZnVuY3Rpb24gZnJvbUNvZGVQb2ludChjb2RlcG9pbnQpIHtcbiAgICB2YXIgY29kZSA9IHR5cGVvZiBjb2RlcG9pbnQgPT09ICdzdHJpbmcnID9cbiAgICAgICAgICBwYXJzZUludChjb2RlcG9pbnQsIDE2KSA6IGNvZGVwb2ludDtcbiAgICBpZiAoY29kZSA8IDB4MTAwMDApIHtcbiAgICAgIHJldHVybiBmcm9tQ2hhckNvZGUoY29kZSk7XG4gICAgfVxuICAgIGNvZGUgLT0gMHgxMDAwMDtcbiAgICByZXR1cm4gZnJvbUNoYXJDb2RlKFxuICAgICAgMHhEODAwICsgKGNvZGUgPj4gMTApLFxuICAgICAgMHhEQzAwICsgKGNvZGUgJiAweDNGRilcbiAgICApO1xuICB9XG5cbiAgZnVuY3Rpb24gcGFyc2Uod2hhdCwgaG93KSB7XG4gICAgaWYgKCFob3cgfHwgdHlwZW9mIGhvdyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgaG93ID0ge2NhbGxiYWNrOiBob3d9O1xuICAgIH1cbiAgICAvLyBpZiBmaXJzdCBhcmd1bWVudCBpcyBzdHJpbmcsIGluamVjdCBodG1sIDxpbWc+IHRhZ3NcbiAgICAvLyBvdGhlcndpc2UgdXNlIHRoZSBET00gdHJlZSBhbmQgcGFyc2UgdGV4dCBub2RlcyBvbmx5XG4gICAgcmV0dXJuICh0eXBlb2Ygd2hhdCA9PT0gJ3N0cmluZycgPyBwYXJzZVN0cmluZyA6IHBhcnNlTm9kZSkod2hhdCwge1xuICAgICAgY2FsbGJhY2s6ICAgaG93LmNhbGxiYWNrIHx8IGRlZmF1bHRJbWFnZVNyY0dlbmVyYXRvcixcbiAgICAgIGF0dHJpYnV0ZXM6IHR5cGVvZiBob3cuYXR0cmlidXRlcyA9PT0gJ2Z1bmN0aW9uJyA/IGhvdy5hdHRyaWJ1dGVzIDogcmV0dXJuTnVsbCxcbiAgICAgIGJhc2U6ICAgICAgIHR5cGVvZiBob3cuYmFzZSA9PT0gJ3N0cmluZycgPyBob3cuYmFzZSA6IHR3ZW1vamkuYmFzZSxcbiAgICAgIGV4dDogICAgICAgIGhvdy5leHQgfHwgdHdlbW9qaS5leHQsXG4gICAgICBzaXplOiAgICAgICBob3cuZm9sZGVyIHx8IHRvU2l6ZVNxdWFyZWRBc3NldChob3cuc2l6ZSB8fCB0d2Vtb2ppLnNpemUpLFxuICAgICAgY2xhc3NOYW1lOiAgaG93LmNsYXNzTmFtZSB8fCB0d2Vtb2ppLmNsYXNzTmFtZSxcbiAgICAgIG9uZXJyb3I6ICAgIGhvdy5vbmVycm9yIHx8IHR3ZW1vamkub25lcnJvclxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVwbGFjZSh0ZXh0LCBjYWxsYmFjaykge1xuICAgIHJldHVybiBTdHJpbmcodGV4dCkucmVwbGFjZShyZSwgY2FsbGJhY2spO1xuICB9XG5cbiAgZnVuY3Rpb24gdGVzdCh0ZXh0KSB7XG4gICAgLy8gSUU2IG5lZWRzIGEgcmVzZXQgYmVmb3JlIHRvb1xuICAgIHJlLmxhc3RJbmRleCA9IDA7XG4gICAgdmFyIHJlc3VsdCA9IHJlLnRlc3QodGV4dCk7XG4gICAgcmUubGFzdEluZGV4ID0gMDtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgZnVuY3Rpb24gdG9Db2RlUG9pbnQodW5pY29kZVN1cnJvZ2F0ZXMsIHNlcCkge1xuICAgIHZhclxuICAgICAgciA9IFtdLFxuICAgICAgYyA9IDAsXG4gICAgICBwID0gMCxcbiAgICAgIGkgPSAwO1xuICAgIHdoaWxlIChpIDwgdW5pY29kZVN1cnJvZ2F0ZXMubGVuZ3RoKSB7XG4gICAgICBjID0gdW5pY29kZVN1cnJvZ2F0ZXMuY2hhckNvZGVBdChpKyspO1xuICAgICAgaWYgKHApIHtcbiAgICAgICAgci5wdXNoKCgweDEwMDAwICsgKChwIC0gMHhEODAwKSA8PCAxMCkgKyAoYyAtIDB4REMwMCkpLnRvU3RyaW5nKDE2KSk7XG4gICAgICAgIHAgPSAwO1xuICAgICAgfSBlbHNlIGlmICgweEQ4MDAgPD0gYyAmJiBjIDw9IDB4REJGRikge1xuICAgICAgICBwID0gYztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHIucHVzaChjLnRvU3RyaW5nKDE2KSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByLmpvaW4oc2VwIHx8ICctJyk7XG4gIH1cblxufSgpKTtcbmlmICghbG9jYXRpb24ucHJvdG9jb2wpIHtcbiAgdHdlbW9qaS5iYXNlID0gdHdlbW9qaS5iYXNlLnJlcGxhY2UoL15odHRwOi8sIFwiXCIpO1xufVxubW9kdWxlLmV4cG9ydHMgPSB0d2Vtb2ppOyJdfQ==
