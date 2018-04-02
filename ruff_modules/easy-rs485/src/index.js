/*!
 * Copyright (c) 2017 Nanchao Inc.
 * All rights reserved.
 */

'use strict';

var driver = require('ruff-driver');

module.exports = driver({
    attach: function (inputs, context) {
        var that = this;
        this._rs485 = inputs['rs485'];

        this._rs485.on('data', function (data) {
            that.emit('data', data);
        });

        this._rs485.on('error', function (error) {
            that.emit('error', error);
        });

    },
    detach: function (callback) {
    },
    exports: {
        write: function (data, callback) {
            this._rs485.write(data, callback);
        }
    }
});
