var State = require('./State.js');
var Utils = require('./utils.js');
var ElementWatcher = require('./element-watcher.js');
var StringBuffer = require('./string-buffer.js');

module.exports = function (emoji) {
    var element = ElementWatcher.getElement();
    var search = StringBuffer.getBuffer();
    var copyBehavior = State.getBehavior('copy');

    if (copyBehavior) {
        Utils.clipWithSelection(emoji);
    }

    console.log("repl", element, emoji);

    if (element) {
        if (element.hasAttribute("contenteditable")) {
            Utils.matchSelection(search, function (node, start, end) {
                var selection = window.getSelection();

                var range = selection.getRangeAt(selection.rangeCount - 1);
                range.setStart(node, start);
                range.setEnd(node, end);

                if (!copyBehavior) {
                    range.deleteContents();
                    range.insertNode(document.createTextNode(emoji));

                    node.parentNode.normalize();
                    selection.collapseToEnd();
                }
            });
        } else {
            Utils.formReplace(element, search, emoji);
        }

        StringBuffer.reset();
    }
};