function updateActiveState() {
    chrome.storage.local.get("active", function (data) {
        BEHAVIOR.active = (data.active !== false);

        if (!BEHAVIOR.active) {
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