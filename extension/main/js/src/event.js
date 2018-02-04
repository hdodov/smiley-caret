var ENTITIES = require('smiley-caret-data/entities');
var Fuse = require('fuse.js'); // .js is in the package name

var EntitiesFuse = new Fuse(ENTITIES, {
    shouldSort: true,
    threshold: 0.3,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 1,
    keys: [1, 2]
});

chrome.runtime.onMessage.addListener(function (request, sender, respond) {
    if (request.id !== "get_coloncode_emoji") return;

    var emoji = null;

    for (var i = 0; i < ENTITIES.length; i++) {
        if (ENTITIES[i][1] === request.coloncode) {
            emoji = ENTITIES[i][0];
            break;
        }
    }

    respond(emoji);
});

chrome.runtime.onMessage.addListener(function (request, sender, respond) {
    if (request.id !== "get_coloncodes") return;

    var result = EntitiesFuse.search(request.search);
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
                        id: "update_behavior",
                        data: {
                            active: newActiveState
                        }
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