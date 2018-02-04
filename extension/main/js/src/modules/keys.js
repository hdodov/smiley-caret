module.exports = {
    codes: {
        left:   37,
        up:     38,
        right:  39,
        down:   40,

        backspace:  8,
        tab:        9,
        enter:      13,
        escape:     27,
        space:      32
    },

    isArrowKey: function (code) {
        return code >= this.codes.left && code <= this.codes.down;
    }
};