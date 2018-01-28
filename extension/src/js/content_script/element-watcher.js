var ElementWatcher = (function () {
    var exports = {
        onRebind: NOOP,
        events: {}
    };

    var _currentElem = null;

    function bindEvents(elem) {
        for (var k in exports.events) {
            if (typeof exports.events[k] === "function") {
                elem.addEventListener(k, exports.events[k]);
            }
        }
    }

    function unbindEvents(elem) {
        for (var k in exports.events) {
            elem.removeEventListener(k, exports.events[k]);
        }
    }

    exports.changeElement = function (newElement) {
        if (_currentElem) {
            unbindEvents(_currentElem);
            _currentElem = null;
        }

        if (newElement) {
            bindEvents(newElement);
            _currentElem = newElement;

            exports.onRebind();
        }
    };

    exports.getElement = function () {
        return _currentElem;
    };

    return exports;
})();