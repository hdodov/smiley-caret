var EventEmitter = require('event-emitter');

var _behavior = {
    active: true,
    shortcodes: true,
    coloncodes: true,
    copy: false
};

var State = {
    getBehavior: function (key) {
        return _behavior[key];
    },

    setBehavior: function (data, silent) {
        for (var k in data) {
            if (k in _behavior && data[k] !== _behavior[k]) {
                _behavior[k] = data[k];

                if (!silent) {
                    this.emit("behavior_change", k, _behavior[k]);
                }
            }
        }
    }
};

if (window.location.hostname.indexOf('facebook') !== -1) {
    State.setBehavior({
        copy: true,
        shortcodes: false
    }, true);
}

chrome.runtime.onMessage.addListener(function (request, sender, respond) {
    if (request.id == "update_behavior") {
        State.setBehavior(request.data);
    }
});

EventEmitter(State);
module.exports = State;