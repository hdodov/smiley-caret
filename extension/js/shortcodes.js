;(function() {
"use strict";

var SHORTCODES={":D":"😀","':D":"😅","xD":"😆",";)":"😉","^^":"😊",":p":"😋","8)":"😎",":*":"😘",":3":"😗",":)":"🙂",":?":"🤔",":|":"😐","-_-":"😑",":x":"😶",":X":"😶","|-(":"🙄",":O":"😮",":o":"😯","D:":"😫","|-)":"😴",":P":"😛",";P":"😜",":/":"😕","(:":"🙃","8O":"😲",":(":"🙁",";(":"😢",":@":"🤬",">:)":"😈","<3":"❤️"};
window.SmileyCaretShortcodes = (function () {
    var exports = {};

    var _sets = getSets(SHORTCODES);

    function getSets(list) {
        var sets = [];

        for (var code in list) {
            for (var i = 0; i < code.length; i++) {
                sets[i] = sets[i] || [];

                if (sets[i].indexOf(code[i]) === -1) {
                    sets[i].push(code[i]);
                }
            }
        }

        return sets;
    }

    exports.isPart = function (str) {
        for (var i = str.length - 1; i >= 0; i--) {
            if (!_sets[i] || _sets[i].indexOf(str[i]) === -1) {
                return false;
            }
        }

        return true;
    };

    exports.get = function (key) {
        if (SHORTCODES[key]) {
            return SHORTCODES[key];
        } else {
            return null;
        }
    };

    exports.getAll = function () {
        return SHORTCODES;
    };

    return exports;
})();
}());
