"use strict";
var Util = require("./util");
var Startup = require("./startup.js");
var GPIO = require("./gpio");
var series = require("ruff-async").series;


var beep = GPIO.beep;
var INIT_GPRS_TIMEOUT = 60000;
var PON_GPRS_TIMEOUT = 60000;

var debug = (function () {
    var header = "[" + __filename + "]";
    return function () {
        Array.prototype.unshift.call(arguments, header);
        console.log.apply(this, arguments);
    };
    // return function(){};
})();

function GPRS(option) {
    this.client = undefined;
    this.gprs = option.gprs;

    var that = this;

    Startup.enableNetDev(option.gprs, {
        initTimeout: option.initTimeout || INIT_GPRS_TIMEOUT,
        powerOnTimeout: option.powerOnTimeout || PON_GPRS_TIMEOUT,
        reboot: ruff.softReset,
        tag: "GPRS"
    }, function () {
        beep(500);
        // setTimeout(function () {
        //     that.configCENG();
        // }, 5000);
        GPIO.flashStatusLEDConnected();
        GPIO.turnOnGreen();

        // Begin the work
        that.client = option.gprs.connect({
            port: option.port,
            host: option.addr
        }, function () {
            debug("connected to server:" + option.addr + ":" + option.port);

            option.callback();
        });

        that.client.on("end", function () {
            debug("disconnected from server");
        });

        that.client.on("data", function (data) {
            debug(data);
            option.dataCallback(data);
        });

        that.client.on("error", function (err) {
            debug("gprs client has error:");
            debug(err);
            Util.delayedReboot(300000); // 5 min
        });
    });
}
GPRS.prototype.write = function (data, callback) {
    this.client.write(data, callback);
};
GPRS.prototype.configLBS = function (callback) {
    var that = this;
    debug("configLBS");

    series([
        that.gprs.generateATCmd(that.gprs.getAT),
        that.gprs.generateATCmd(that.gprs.setSAPBRMode),
        that.gprs.generateATCmd(that.gprs.setSAPBRApn),
        that.gprs.generateATCmd(that.gprs.setSAPBRPdp),
        that.gprs.generateATCmd(that.gprs.getSAPBRIp),
        that.gprs.generateATCmd(that.gprs.getCLBSUrl),
    ], function (err, values) {
        if (err) {
            debug("[configLBS]", err);
            callback && callback(err);
            return;
        }
        false && values;
        callback && callback(undefined, "OK");
    });
};
GPRS.prototype.getLBS = function (callback) {
    var that = this;
    debug("getLBS");

    series([
        that.gprs.generateATCmd(that.gprs.getCLBS),
    ], function (err, values) {
        debug("-----------------");
        if (err) {
            debug("[getLBS]", err);
            callback && callback(err);
            return;
        }
        debug("[getLBS]", "over");
        debug(values[values.length - 1]);
        debug("length:", values.length);

        callback && callback(undefined, values[values.length - 1]);
    });
};
GPRS.prototype.configCENG = function (callback) {
    var that = this;
    debug("configENG");

    series([
        that.gprs.generateATCmd(that.gprs.getCENG),
        that.gprs.generateATCmd(that.gprs.sleep1s),
        that.gprs.generateATCmd(that.gprs.setCENGon),

    ], function (err, values) {
        if (err) {
            debug("[configENG]", err);
            callback && callback(err);
            return;
        }
        false && values;
        callback && callback(undefined, "OK");
    });
};
GPRS.prototype.getCENG = function (callback) {
    this.gprs.getCENGinfo(function (err, data) {
        if (err) {
            callback && callback(err);
            return;
        }
        //
        callback && callback(undefined, data);
    });
};

GPRS.prototype.configGPRS = function (callback) {
    var that = this;

    this.configCENG(function () {
        that.configLBS();
    });
    false && callback;
};

module.exports = GPRS;