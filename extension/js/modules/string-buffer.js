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