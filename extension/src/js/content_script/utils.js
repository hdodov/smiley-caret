function formReplace(elem, search, replace) {
    if (
        !elem ||
        typeof elem.value !== "string" ||
        typeof elem.selectionStart !== "number"
    ) {
        return false;
    }

    var value = elem.value,
        endIndex = elem.selectionStart,
        startIndex = endIndex - search.length;

    if (
        startIndex >= 0 &&
        endIndex > startIndex &&
        value.substr(startIndex, endIndex) === search
    ) {
        var before = value.substr(0, startIndex);
        var after = value.substr(endIndex);

        elem.value = before + replace + after;
    }
}

function matchSelection(search, callback) {
    var selection = window.getSelection();

    if (
        selection &&
        selection.focusNode &&
        selection.focusNode.nodeValue
    ) {
        var node = selection.focusNode;
        var endIndex = selection.focusOffset;
        var startIndex = endIndex - search.length;

        if (
            startIndex >= 0 &&
            endIndex > startIndex &&
            selection.rangeCount > 0 &&
            node.nodeValue.substring(startIndex, endIndex) === search
        ) {
            callback(node, startIndex, endIndex);
            return true;
        }
    }

    return false;
}

function isElementEmojiEligible(elem) {
    var forbidden = ["email", "password", "tel"]
    ,   type = elem.getAttribute("type")
    ,   name = elem.getAttribute("name");

    return (
        isElementEditable(elem) &&
        forbidden.indexOf(type) == -1 &&
        forbidden.indexOf(name) == -1
    );
}

function isElementEditable(elem) {
    return (elem && (
        elem.hasAttribute("contenteditable") ||
        elem.tagName === "TEXTAREA" ||
        elem.tagName === "INPUT"
    ));
}

function getElementBodyOffset(elem) {
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
}

function getContenteditableCaretBodyOffset() {
    var selection = window.getSelection(),
        range = selection.getRangeAt(selection.rangeCount - 1),
        clonedRange = range.cloneRange();

    var node = document.createElement("span");
    clonedRange.insertNode(node);

    var offset = getElementBodyOffset(node);

    var parent = node.parentNode;
    parent.removeChild(node);
    parent.normalize();

    return offset;
}

function isArrowKey(code) {
    return code >= KEYS.left && code <= KEYS.down;
}

function clipWithInput(text) {
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
}

function clipWithSelection(text) {
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