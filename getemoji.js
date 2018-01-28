var fs = require("fs");
var path = require("path");
var parse = require("unicode-emoji-parser");

var SHORTCODES = require("./data/shortcodes.js");
var CHARS = require("./data/chars.js");

function getKey(name) {
    var key = (name + "").toLowerCase();

    key = key.replace(/[^a-z0-9\-]/ig, "-"); // Convert strange characters to dashes.
    key = key.replace(/\-{2,}/g, "-"); // Remove more than two occurences of a dash.
    key = key.replace(/^\-|\-$/g, ""); // Remove starting and ending dashes.
    key = key.replace(/-face-/ig, "-");
    key = key.replace(/-face/ig, "");
    key = key.replace(/-tone/ig, "");

    return key;
}

function writeFile(filepath, name, data) {
    fs.writeFile(
        path.join(__dirname, filepath),
        "var " + name + "=" + JSON.stringify(data) + ";"
    );
}

var output = [];
var shortcodes = {};

parse({
    host: "unicode.org",
    port: 80,
    path: "/Public/emoji/5.0/emoji-test.txt"
}, function (emoji) {
    if (emoji.status === "fully-qualified") {
        for (var k in SHORTCODES) {
            if (SHORTCODES[k] === emoji.name) {
                shortcodes[k] = emoji.icon;
            }
        }

        output.push([getKey(emoji.name), emoji.icon]);
    }
}, function () {
    for (var k in CHARS) {
        output.push([k, CHARS[k]]);
    }

    for (var k in SHORTCODES) {
        // Indicate that a searched shortcode wasn't found.
        if (!shortcodes[k]) {
            shortcodes[k] = null;
        }
    }

    writeFile("extension/data/emoji.js", "EMOJI", output);
    writeFile("extension/data/shortcodes.js", "SHORTCODES", shortcodes);
});