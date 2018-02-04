var fs = require("fs");
var path = require("path");
var parse = require("unicode-emoji-parser");

var CHARS = require("./data/chars.js");
var KEYWORDS = require("./data/keywords.js");
var SHORTCODES = require("./data/shortcodes.js");

function getKey(name) {
    var key = (name + "").toLowerCase();

    key = key.replace(/[^a-z0-9\-]/ig, "-"); // Convert strange characters to dashes.
    key = key.replace(/\-{2,}/g, "-"); // Remove more than two occurences of a dash.
    key = key.replace(/^\-|\-$/g, ""); // Remove starting and ending dashes.
    key = key.replace(/-face(-)?/ig, "$1");
    key = key.replace(/-tone/ig, "");

    return key;
}

function writeFile(filepath, data) {
    fs.writeFile(
        path.join(__dirname, filepath),
        "module.exports=" + JSON.stringify(data) + ";"
    );
}

function formatEntity(data) {
    var keywords = [];

    for (var k in KEYWORDS) {
        if (
            data.name.indexOf(k) != -1 ||
            (
                data.nameUnaltered &&
                data.nameUnaltered.indexOf(k) != -1
            )
        ) {
            keywords = keywords.concat(KEYWORDS[k]);
        }
    }

    if (keywords.length) {
        return [data.entity, data.name, keywords];
    } else {
        return [data.entity, data.name];
    }
}

var output = [];
var shortcodes = {};

parse({
    host: "unicode.org",
    port: 80,
    path: "/Public/emoji/5.0/emoji-test.txt"
}, function (emoji) {
    if (emoji.status === "fully-qualified") {
        for (var code in SHORTCODES) {
            if (SHORTCODES[code] === emoji.name) {
                shortcodes[code] = emoji.icon;
            }
        }

        output.push(formatEntity({
            entity: emoji.icon,
            name: getKey(emoji.name),
            nameUnaltered: emoji.name
        }));
    }
}, function () {
    for (var charName in CHARS) {
        output.push(formatEntity({
            entity: CHARS[charName],
            name: "char-" + charName,
            nameUnaltered: charName
        }));
    }

    for (var k in SHORTCODES) {
        // Indicate that a searched shortcode wasn't found.
        if (!shortcodes[k]) {
            shortcodes[k] = null;
        }
    }

    writeFile("node_modules/smiley-caret-data/entities.js", output);
    writeFile("node_modules/smiley-caret-data/shortcodes.js", shortcodes);
});