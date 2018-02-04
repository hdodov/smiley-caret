var State = require('./state.js');
var Utils = require('./utils.js');
var ElementWatcher = require('./element-watcher.js');
var StringBuffer = require('./string-buffer.js');

module.exports = function (emoji) {
    var element = ElementWatcher.getElement();
    var search = StringBuffer.getBuffer();
    var copyBehavior = State.getBehavior('copy');

    if (!element) {
        return false;
    }

    if (element.hasAttribute("contenteditable")) {
        if (copyBehavior) {
            Utils.clipWithSelection(emoji);
        }

        Utils.searchSelection(search, function (result) {
            var range = result.selection.getRangeAt(result.selection.rangeCount - 1);
            range.setStart(result.node, result.start);
            range.setEnd(result.node, result.end);

            // If the behavior is copy, it should only select the match. If
            // it’s not - it should also replace it with the emoji.
            if (!copyBehavior) {
                range.deleteContents();
                range.insertNode(document.createTextNode(emoji));

                result.node.parentNode.normalize();
                result.node.parentElement.normalize();
                result.selection.collapseToEnd();
            }
        });
    } else {
        Utils.searchInput(element, search, function (result) {
            if (copyBehavior) {
                // clipWithSelection() removes the caret position, so it must
                // be done after the start and end of the match is found, I.E.
                // in the callback.
                Utils.clipWithSelection(emoji);

                element.selectionStart = result.start;
                element.selectionEnd = result.end;
            } else {
                element.value = result.before + emoji + result.after;
                element.selectionEnd = result.before.length + emoji.length;
            }
        });
    }

    StringBuffer.clear();
};