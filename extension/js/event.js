var EMOJI = require('../data/emoji.js');
var Fuse = require('fuse.js');

var EmojiFuse = new Fuse(EMOJI, {
    shouldSort: true,
    threshold: 0.3,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 1,
    keys: [1]
});

chrome.runtime.onMessage.addListener(function (request, sender, respond) {
    if (request.id !== "get_coloncode_emoji") return;

    var emoji = null;

    for (var i = 0; i < EMOJI.length; i++) {
        if (EMOJI[i][0] === request.coloncode) {
            emoji = EMOJI[i][1];
        }
    }

    respond(emoji);
});

chrome.runtime.onMessage.addListener(function (request, sender, respond) {
    if (request.id !== "get_coloncodes") return;

    var result = EmojiFuse.search(request.search);
    console.log("Results for", request.search, "-", result.length);
    respond(result);
});

chrome.browserAction.onClicked.addListener(function (tab) {
    chrome.storage.local.get("active", function (data) {
        var isActive = (data.active !== false)
        ,   newActiveState = !isActive;

        chrome.storage.local.set({
            active: newActiveState
        }, function () {
            chrome.tabs.query({}, function (tabs) {
                for (var i = 0; i < tabs.length; i++) {
                    chrome.tabs.sendMessage(tabs[i].id, {
                        id: "update_active_state"
                    });
                }
            });

            updateExtensionIcon();
        });
    });  
});

function updateExtensionIcon() {
    chrome.storage.local.get("active", function (data) {
        chrome.browserAction.setIcon({
            path: (data.active !== false)
                ? "img/icon-16.png"
                : "img/icon-16-inactive.png"
        });
    });
}

updateExtensionIcon();