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