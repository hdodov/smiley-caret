var Matcher = (function () {
    var exports = {
        onMatch: NOOP,
        onColoncodeUpdate: NOOP,
        onFlagsUpdate: NOOP,
        onFlagsDown: NOOP
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
        var match = buffer.match(COLONCODE_REGEX);

        if (match !== null && match.length) {
            return match[1];
        } else {
            return false;
        }
    }

    function updateFlags(buffer) {
        if (BEHAVIOR.coloncodes) {
            if (buffer.length === 1 && buffer[0] === ":") {
                _flags.colonStart = true;
            }

            if (_flags.colonStart) {
                _flags.coloncode = isPartOfColoncode(buffer);
            }
        }

        if (BEHAVIOR.shortcodes) {
            _flags.shortcode = SmileyCaretShortcodes.isPart(buffer) ? buffer : false;
        }

        exports.onFlagsUpdate(_flags);
    }

    exports.reset = function () {
        resetFlags();
        updateColoncodes(null);
    };

    exports.checkMatch = function (buffer) {
        if (_flags.shortcode) {
            var shortcode = SmileyCaretShortcodes.get(_flags.shortcode);

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