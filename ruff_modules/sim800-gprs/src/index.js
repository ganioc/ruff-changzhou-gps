"use strict";
var series = require("ruff-async").series;
var otalib = require("otalib-1294-user");
var config = require("./config.js");
var EClient = require("./eclient.js");
var RSON = require("rson");
var sysconfig;

var INIT_GPRS_TIMEOUT = 60000;
var PON_GPRS_TIMEOUT = 60000;

try {
    sysconfig = RSON.rson(otalib.getSysconfig());
    log.info("sysconfig is:");
    log.info(sysconfig.explorer);

} catch (e) {
    log.error("Invalid sysconfig", e);
}

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
    this.eClient = undefined; // OTA client

    var that = this;

    enableNetDev(option.gprs, {
        initTimeout: option.initTimeout || INIT_GPRS_TIMEOUT,
        powerOnTimeout: option.powerOnTimeout || PON_GPRS_TIMEOUT,
        reboot: ruff.softReset,
        tag: "GPRS"
    }, function () {
        if (option.afterConnect === undefined) {
            throw new Error("option.afterConnect missing");
        }
        option.afterConnect && option.afterConnect();
        // beep(500);

        // GPIO.flashStatusLEDConnected();
        // GPIO.turnOnGreen();

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
            setTimeout(function () {
                ruff.softReset();
            }, 100000);
            // 5 min
        });

        // Begin the eClient for OTA purpose
        debug("Try to connect to OTA server:");
        var eConfig = config.getEConnConfig(sysconfig);

        debug("OTA IP:", eConfig.host);
        debug("OTA Port:", eConfig.port);

        if (eConfig) {
            that.eClient = new EClient(option.gprs, eConfig, {
                /*
                 * if you want to turnOn led after connected to explorer,
                 * assgin state property to this option
                 */
                // state: eClientLed,
                reboot: ruff.softReset
            });
            that.eClient.connect(46000); // 连接OTA server, 46秒后
        } else {
            log.error("Invalid explorer connConfig");
        }


    });
}

var enableNetDev = function (netDev, options, callback) {
    var initTimeout = options.initTimeout >= 0 ? options.initTimeout : 100;
    var powerOnTimeout = options.powerOnTimeout >= 0 ? options.powerOnTimeout : 100;
    var reboot = options.reboot || function () {
        console.log("reboot...");
    };
    var tag = options.tag || "netDev";
    var timer;

    netDev.on("error", function (error) {
        console.log("[" + tag + "] error", error);
    });
    netDev.on("down", function () {
        console.log("[" + tag + "] down, will reboot");
        setTimeout(reboot, 3000);
    });
    netDev.on("end", function () {
        console.log("[" + tag + "] power down");
    });

    netDev.once("ready", function () {
        console.log("[" + tag + "] ready");
        clearTimeout(timer);

        if (netDev.getSignalStrength) {
            netDev.getSignalStrength(function (error, value) {
                if (error) {
                    console.log("[" + tag + "] get signal error", error);
                } else {
                    console.log("[" + tag + "] signal is", value);
                }
            });
        }
        netDev.once("up", function (ip) {
            clearTimeout(timer);
            console.log("[" + tag + "] ip is", ip);
            callback && callback();
        });

        timer = setTimeout(function () {
            console.log("[" + tag + "] init timeout");
            setTimeout(reboot, 5000);
        }, initTimeout);

        if (netDev.autoInit) {
            console.log("AutoInit");
            netDev.autoInit(function (err, data) {
                if (err) {
                    console.log("autoInit failure");

                } else {
                    false && data;
                    console.log("autoInit succeed");
                }
            });
        } else if (netDev.init) {
            console.log("Init");
            netDev.init();
        }
    });

    timer = setTimeout(function () {
        console.log("[" + tag + "] poweron timeout");
        setTimeout(reboot, 3000);
    }, powerOnTimeout);

    netDev.powerOn && netDev.powerOn();
};
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