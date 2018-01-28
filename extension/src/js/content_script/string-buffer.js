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