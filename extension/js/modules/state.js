var Config = require('./_config.js');

function updateActiveState() {
    chrome.storage.local.get("active", function (data) {
        Config.behavior.active = (data.active !== false);

        if (!Config.behavior.active) {
            StringBuffer.reset();
        }
    });
}

chrome.runtime.onMessage.addListener(function (request, sender, respond) {
    if (request.id == "update_active_state") {
        updateActiveState();
    }
});

updateActiveState();