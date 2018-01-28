for (var i = 0; i < DOMAINS_NO_ALTER.length; i++) {
    if (window.location.hostname.indexOf(DOMAINS_NO_ALTER[i]) !== -1) {
        BEHAVIOR.copy = true;
        break;
    }
}

if (BEHAVIOR.copy) {
    BEHAVIOR.shortcodes = false;
}