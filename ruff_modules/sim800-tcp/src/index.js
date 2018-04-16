'use strict';

var driver = require('ruff-driver');
var CmdManager = require('./cmd-manager');
var ConnectionManager = require('./connection-manager');
var createCommands = require('./cmds');
var socket = require('./socket');
var Level = require('gpio').Level;

module.exports = driver({
    attach: function (inputs) {
        this._enPwr = inputs['enPwr'];
        this._uart = inputs['uart'];
        if (0) {
            this._uart.on('data', function (data) {
                console.log('[U]', data.toString().replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
            });
        }
        this._enPwr.write(Level.high);
        var cmdManager = new CmdManager(this._uart);
        global.connectionManager = new ConnectionManager(6, cmdManager);
        var cmds = createCommands(cmdManager);
        var that = this;
        Object.keys(cmds).forEach(function (key) {
            that[key] = cmds[key].bind(cmds);
        });
        Object.keys(socket).forEach(function (key) {
            that[key] = socket[key];
        });

        this.powerOn = function () {
            cmdManager.once('sms', function () {
                that.startup(function (error, values) {
                    if (error) {
                        console.log('startup failed, result is', values);
                        that.emit('error', error);
                        return;
                    }
                    that.emit('ready');
                });
            });
            that._enPwr.write(Level.low, function (error) {
                if (error) {
                    that.emit('error', error);
                    return;
                }
                setTimeout(function () {
                    that.sendAT1('AT');
                }, 5000);
            });
        };

        cmdManager.on('up', function (localIP) {
            that.emit('up', localIP);
        });
        cmdManager.on('error', function (error) {
            that.emit('error', error);
        });
        cmdManager.on('pdp', function (value) {
            if (/DEACT/.test(value)) {
                that.emit('down');
            }
        });
    }
});