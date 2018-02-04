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