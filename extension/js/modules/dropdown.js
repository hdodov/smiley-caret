var Config = require('./_config.js');
var Utils = require('./utils.js');
var twemoji = require('twemoji');

function Dropdown(parent) {
    this.items = {};
    this.selectedItem = null;
    this.onChoose = function () {};
    this.parent = parent || document.body;

    this.dropdown = document.createElement("div");
    this.dropdown.classList.add("smiley-caret-dropdown");

    this.container = document.createElement("div");
    this.container.classList.add("smiley-caret-container");
    this.dropdown.appendChild(this.container);

    if (Config.behavior.copy) {
        this.container.classList.add("behavior-copy");
    }

    this.parent.appendChild(this.dropdown);
} Dropdown.prototype = {
    createItem: function (name, emoji) {
        if (this.items[name]) return;

        var item = document.createElement("div");
        var emojiElem = document.createElement("span");
        var emojiElemChar = document.createElement("i");
        var emojiElemImg = document.createElement("img");
        var nameElem = document.createElement("p");

        emojiElemChar.appendChild(document.createTextNode(emoji));
        emojiElem.appendChild(emojiElemChar);
        emojiElem.appendChild(emojiElemImg);

        var imageMarkup = twemoji.parse(emoji)
        ,   imageSrcMatch = /src\=\"(.*)\"/.exec(imageMarkup)
        ,   imageSrc = (imageSrcMatch && imageSrcMatch[1]);
        
        if (imageSrc) {
            var tempImage = new Image();
            tempImage.onload = function () {
                emojiElem.classList.add("is-loaded");
            };

            tempImage.src = imageSrc;
            emojiElemImg.src = imageSrc;
        }

        item.appendChild(emojiElem);

        nameElem.appendChild(document.createTextNode(name));
        item.appendChild(nameElem);

        item.smileyCaret = {
            emoji: emoji,
            name: name
        };

        var self = this;
        item.addEventListener("mouseenter", function () {
            self.selectItem(this);
        });

        item.addEventListener("mousedown", function (event) {
            self.selectItem(this);
            self.chooseItem();
            event.preventDefault(); // to prevent loss of focus
            event.stopImmediatePropagation();
        });

        this.container.appendChild(item);
        this.items[name] = item;
    },

    chooseItem: function () {
        if (
            this.selectedItem &&
            this.selectedItem.smileyCaret &&
            this.selectedItem.smileyCaret.emoji
        ) {
            this.onChoose(this.selectedItem.smileyCaret.emoji);
        }  
    },

    selectItem: function (item) {
        if (this.selectedItem) {
            this.selectedItem.classList.remove("selected");
            this.selectedItem = null;
        }

        if (item) {
            item.classList.add("selected");
            this.selectedItem = item;
        }
    },

    updateList: function (list) {
        if (list.length === 0) return;

        for (var k in this.items) {
            this.items[k].parentNode.removeChild(this.items[k]);

            var exists = false;
            for (var i = 0; i < list.length; i++) {
                if (list[i][0] === k) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                delete this.items[k];
            }
        }

        for (var i = 0; i < list.length; i++) {
            var name = list[i][0]
            ,   emoji = list[i][1];

            if (this.items[name]) {
                this.container.appendChild(this.items[name]);
            } else {
                this.createItem(name, emoji);
            }
        }

        if (this.container.firstElementChild) {
            this.selectItem(this.container.firstElementChild);
        }
    },

    alignTo: function (elem) {
        var offset = null;

        if (elem.hasAttribute("contenteditable")) {
            offset = Utils.getContenteditableCaretBodyOffset();
        } else {
            offset = Utils.getElementBodyOffset(elem);
            offset.left += elem.clientWidth;
        }

        if (offset) {
            this.dropdown.style.left = offset.left + "px";
            this.dropdown.style.top = offset.top + "px";

            if (offset.fixed) {
                this.dropdown.classList.add("is-fixed");
            } else {
                this.dropdown.classList.remove("is-fixed");
            }
        }
    },

    show: function () {
        this.active = true;
        this.dropdown.classList.add("is-visible");
    },

    hide: function () {
        this.active = false;
        this.dropdown.classList.remove("is-visible");
    },

    remove: function () {
        this.hide();

        var self = this;
        setTimeout(function () {
            self.destroy();
        }, 500);
    },

    destroy: function () {
        if (this.destroyed) return;
        
        if (this.dropdown.parentNode) {
            this.dropdown.parentNode.removeChild(this.dropdown);
        }

        this.parent = null;
        this.items = null;
        this.selectedItem = null;
        this.dropdown = null;
        this.container = null;

        this.destroyed = true;
    }
};

module.exports = Dropdown;