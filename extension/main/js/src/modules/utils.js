var getCaretCoordinates = require('textarea-caret');

module.exports = {
    searchInput: function (elem, search, callback) {
        if (
            !elem ||
            typeof elem.value != "string" ||
            typeof elem.selectionEnd != "number"
        ) {
            return false;
        }

        var value = elem.value
        ,   endIndex = elem.selectionEnd
        ,   startIndex = endIndex - search.length;

        if (
            startIndex < 0 ||
            endIndex < startIndex ||
            value.substring(startIndex, endIndex) != search
        ) {
            return false;
        }

        return callback({
            start: startIndex,
            end: endIndex,
            before: value.substring(0, startIndex),
            after: value.substring(endIndex)
        });
    },

    searchSelection: function (search, callback) {
        var selection = window.getSelection();

        if (
            !selection ||
            !selection.focusNode ||
            !selection.focusNode.nodeValue
        ) {
            return false;
        }

        var node = selection.focusNode
        ,   endIndex = selection.focusOffset
        ,   startIndex = endIndex - search.length;

        if (
            startIndex < 0 ||
            endIndex < startIndex ||
            selection.rangeCount == 0 ||
            node.nodeValue.substring(startIndex, endIndex) != search
        ) {
            return false;
        }

        return callback({
            selection: selection,
            node: node,
            start: startIndex,
            end: endIndex
        });
    },

    isElementEditable: function (elem) {
        return (elem && (
            elem.hasAttribute("contenteditable") ||
            elem.tagName === "TEXTAREA" ||
            elem.tagName === "INPUT"
        ));
    },

    isElementEmojiEligible: function (elem) {
        var forbidden = ["email", "password", "tel"]
        ,   type = elem.getAttribute("type")
        ,   name = elem.getAttribute("name");

        return (
            this.isElementEditable(elem) &&
            forbidden.indexOf(type) == -1 &&
            forbidden.indexOf(name) == -1
        );
    },

    getElementBodyOffset: function (elem) {
        var viewportOffset = elem.getBoundingClientRect()
        ,   scrollTop = document.documentElement.scrollTop + document.body.scrollTop
        ,   scrollLeft = document.documentElement.scrollLeft + document.body.scrollLeft
        ,   offsetElem = elem
        ,   result = {
                top: 0,
                left: 0,
                fixed: false
            };

        do {
            var computed = window.getComputedStyle(offsetElem);

            if (computed && computed.position == "fixed") {
                result.fixed = true;
                break;
            }
        } while (offsetElem = offsetElem.offsetParent);

        result.top = viewportOffset.top;
        result.left = viewportOffset.left;

        if (!result.fixed) {
            result.top += scrollTop;
            result.left += scrollLeft;
        }

        return result;
    },

    getElementCaretOffset: function (elem) {
        var offset = null;

        if (elem.hasAttribute('contenteditable')) {
            var selection = window.getSelection()
            ,   range = selection.getRangeAt(selection.rangeCount - 1)
            ,   clonedRange = range.cloneRange();

            var node = document.createElement('span');
            clonedRange.insertNode(node);

            offset = this.getElementBodyOffset(node);

            var parent = node.parentNode;
            parent.removeChild(node);
            parent.normalize();
        } else {
            offset = this.getElementBodyOffset(elem);

            var caretOffset = getCaretCoordinates(elem, elem.selectionEnd);
            offset.top += caretOffset.top - elem.scrollTop;
            offset.left += caretOffset.left;
        }

        return offset;
    },

    clipWithInput: function (text) {
        var input = document.createElement("input");
        document.body.appendChild(input);

        input.addEventListener("focus", function (e) {
            e.preventDefault();
            e.stopPropagation();
        });

        input.value = text;
        input.select();

        document.execCommand("copy");
        document.body.removeChild(input);
    },

    clipWithSelection: function (text) {
        var node = document.createTextNode(text),
            selection = window.getSelection(),
            range = document.createRange(),
            clone = null;

        if (selection.rangeCount > 0) {
            clone = selection.getRangeAt(selection.rangeCount - 1).cloneRange();
        }

        document.body.appendChild(node);
        selection.removeAllRanges();
        range.selectNodeContents(node);
        selection.addRange(range);
        document.execCommand("copy");

        selection.removeAllRanges();
        document.body.removeChild(node);

        if (clone !== null) {
            selection.addRange(clone);
        }
    }
};