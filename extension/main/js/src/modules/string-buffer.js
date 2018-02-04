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