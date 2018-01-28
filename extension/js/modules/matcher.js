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