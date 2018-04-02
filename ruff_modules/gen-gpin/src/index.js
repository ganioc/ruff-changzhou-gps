'use strict';

var driver = require('ruff-driver');

module.exports = driver({

    attach: function (inputs, context) {
        // this._<interface> = inputs['<interface>'];
	this._gpioIn = inputs['gpio-in'];
    },

    exports: {
        read: function (callback) {
            // this._<interface>.<method>
	    this._gpioIn.read(callback);
        }
    }

});
