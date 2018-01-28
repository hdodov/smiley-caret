module.exports = {
    general: {
        domains_no_alter: ['facebook']
    },

    behavior: {
        active: true,
        copy: false,
        shortcodes: true,
        coloncodes: true
    },

    keys: {
        left:   37,
        up:     38,
        right:  39,
        down:   40,

        tab:    9,
        enter:  13,
        escape: 27,
        space:  32,
        backspace: 8
    }
};

// for (var i = 0; i < module.exports.general.domains_no_alter.length; i++) {
//     if (window.location.hostname.indexOf(module.exports.general.domains_no_alter[i]) !== -1) {
//         BEHAVIOR.copy = true;
//         break;
//     }
// }

// if (BEHAVIOR.copy) {
//     BEHAVIOR.shortcodes = false;
// }