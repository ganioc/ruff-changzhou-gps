'use strict';

var driver = require('ruff-driver');

module.exports = driver({

    attach: function (inputs, context) {
        // this._<interface> = inputs['<interface>'];
        this._uart = inputs['uart'];

        var that = this;

        this._uart.on('data', function (data) {

            that.emit('data', data);
        });
    },

    exports: {
        write: function (buf, cb) {
            // this._<interface>.<method>
            this._uart.write(buf, cb);
        }
    }

});