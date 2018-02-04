var EventEmitter = require('event-emitter');

var _behavior = {
    active: true,
    shortcodes: true,
    coloncodes: true,
    copy: false
};

module.exports = (function () {
    var exports = EventEmitter();

    exports.getBehavior = function (key) {
        return _behavior[key];
    };

    exports.setBehavior = function (data, silent) {
        for (var k in data) {
            if (k in _behavior && data[k] !== _behavior[k]) {
                _behavior[k] = data[k];

                if (!silent) {
                    exports.emit("behavior_change", k, _behavior[k]);
                }
            }
        }
    };

    return exports;
})();

// Turn off replacing functionality because facebook is a pain in the ass.
if (window.location.hostname.indexOf('facebook') !== -1) {
    module.exports.setBehavior({
        copy: true,
        shortcodes: false
    }, true);
}

chrome.storage.local.get({
    active: true
}, function (data) {
    module.exports.setBehavior({
        active: !!data.active
    });
});

chrome.runtime.onMessage.addListener(function (request, sender, respond) {
    if (request.id == "update_behavior") {
        module.exports.setBehavior(request.data);
    }
});