// Checks the currently focused element over short interval and dispatches
// changes. The "focusin" event can't do the job because it can be cancelled.

module.exports = (function () {
    var _config = {
        interval: 250
    };

    var exports = {
        onChange: function () {}
    };

    var _active = null,
        _emitted = null;

    setInterval(function () {
        if (document.activeElement !== _active) {
            _active = document.activeElement;
            exports.onChange(_active);
        }
    }, _config.interval);

    return exports;
})();