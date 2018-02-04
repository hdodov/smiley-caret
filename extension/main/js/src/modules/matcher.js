var EventEmitter = require('event-emitter');
var Shortcodes = require('./shortcodes.js');
var State = require('./state.js');

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

    exports.checkMatch = function () {
        if (_flags.shortcode) {
            var shortcode = Shortcodes.get(_flags.shortcode);

            if (shortcode !== null) {
                exports.emit('match', shortcode);
            }
        }

        if (_flags.coloncode) {
            for (var i = 0; i < _coloncodes.length; i++) {
                if (_coloncodes[i][1] === _flags.coloncode) {
                    exports.emit('match', _coloncodes[i][0]);
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