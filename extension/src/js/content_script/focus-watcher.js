// Checks the currently focused element over short interval and dispatches
// changes. The "focusin" event can't do the job because it can be cancelled.

var FocusWatcher = (function () {
    var exports = {
        onChange: NOOP
    };

    var _active = null,
        _emitted = null;

    setInterval(function () {
        if (document.activeElement !== _active) {
            _active = document.activeElement;
            exports.onChange(_active);
        }
    }, FOCUS_WATCHER_DELAY);

    return exports;
})();