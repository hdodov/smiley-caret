(function () {
    var $container = $(".js-shortcodes")
    ,   shortcodes = SmileyCaretShortcodes.getAll();

    for (var k in shortcodes) {
        var $col = $('<div class="col-sm-3"></div>')
        ,   $code = $('<div class="shortcode"></div>')
        ,   $codeText = $('<span></span>')
        ,   $codeIcon = $('<i></i>');

        $codeText.text(k);
        $codeIcon.html(twemoji.parse(shortcodes[k]));

        $code.append($codeText, $codeIcon);
        $col.append($code);
        $container.append($col);
    }

    $(".editor").one("focus", function () {
        $(this).html("");
    });
})();