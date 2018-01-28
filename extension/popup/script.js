var inputs = document.getElementsByTagName("input");

for (var i = inputs.length; i--;) {
    inputs[i].addEventListener("click", saveSettings);
}

function saveSettings() {
    var obj = {};

    for (var i = inputs.length; i--;) {
        obj[inputs[i].id] = inputs[i].checked;
    }

    chrome.storage.sync.set({"settings": obj}, function () {
        console.log("Settings saved.");
    });
}

chrome.storage.sync.get("settings", function (res) {
    if (res.settings) {
        for (var i = inputs.length; i--;) {
            inputs[i].checked = (res.settings[inputs[i].id] === true);
        }
    }
});