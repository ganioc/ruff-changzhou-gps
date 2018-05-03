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

    this.bFirstTime = true; // 首次开机为true, 中间重新拨号，已为false
    this.bFirstConnect = true;
    this.tag = option.tag || "netDev";
    this.timer = null; // timeout handle

    var that = this;
    var cmdManager = global.connectionManager.getCmdManager();
    var netDev = this.gprs;

    that.client = new netDev.Socket();
    this.eClient = undefined; // OTA client

    netDev.powerOff();

    netDev.on("poweroff", function () {
        netDev.powerOn();
        cmdManager.reset();
        global.connectionManager.reset();

        // this timer is for startup() failure, sms ready failure
        that.timer = setTimeout(function () {
            console.log("[" + that.tag + "] power off timeout");
            setTimeout(netDev.powerOff, 3000);
        }, PON_GPRS_TIMEOUT);
    });


    netDev.on("error", function (error) {
        console.log("[" + that.tag + "] error", error);
    });
    netDev.on("down", function () {
        console.log("[" + that.tag + "] gprs down");
        console.log("[" + that.tag + "] try to redial after 5 s");
        setTimeout(function () {
            that.powerOff();
        }, 5000);
    });
    // netDev.on("end", function () {
    //     console.log("[" + that.tag + "] socket end");
    // });
    // gprs 开机成功
    netDev.on("ready", function () {
        //Only dial once, this is ensured in sim800-tcp/index.js
        console.log("[" + that.tag + "] ready");
        clearTimeout(that.timer);

        if (netDev.getSignalStrength) {
            netDev.getSignalStrength(function (error, value) {
                if (error) {
                    console.log("[" + that.tag + "] get signal error", error);
                } else {
                    console.log("[" + that.tag + "] signal is", value);
                }
            });
        }

        // 拨号成功,
        netDev.once("up", function (ip) {
            clearTimeout(that.timer);
            console.log("[" + that.tag + "] ip is", ip);

            that.configGPRS(undefined);

            netDev.bUp = true; // Added by Yang Jun

            that.mainCallback(netDev, option);

        });

        // 设置拨号超时,定时器
        that.timer = setTimeout(function () {
            console.log("[" + that.tag + "] init timeout");
            setTimeout(netDev.powerOff, 5000);
        }, option.initTimeout);

        //开始拨号
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
}

GPRS.prototype.write = function (data, callback) {
    if (this.gprs.bUp === false) {
        console.log("bUp not ready");
        return;
    }
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

    if (this.gprs.bUp === false) {
        console.log("Not ready yet, network");
        callback("error", undefined);
        return;
    }

    series([
        that.gprs.generateATCmd(that.gprs.getCLBS),
    ], function (err, values) {
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

    if (this.gprs.bUp === false) {
        console.log("Not ready yet, network");
        callback("error", undefined);
        return;
    }
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

GPRS.prototype.mainCallback = function (netDev, option) {
    debug("Into MainCallback");
    if (option.afterConnect === undefined) {
        throw new Error("option.afterConnect missing");
    }
    option.afterConnect && option.afterConnect();

    var that = this;

    // netDev.powerOff();

    // return;

    if (that.bFirstTime === false) {
        debug("not 1st time boot up");
        return;
    }
    that.bFirstTime = false;

    // setInterval(function () {
    //     netDev.powerOff();
    // }, 240000);

    /////////////////////////////////////////////////////////////////////
    // Begin the work
    that.client.on("connect", function () {
        debug("connected to server:" + option.addr + ":" + option.port);
        if (that.bFirstConnect === true) {
            that.bFirstConnect = false;
            option.callback();
        }
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
    });
    that.client.on("close", function (error) {
        debug("socket closed, try to reconnect");
        debug(error);

        setTimeout(function () {
            that.client.connect({
                port: option.port,
                host: option.addr
            });
        }, 30000);
    });
    that.client.connect({
        port: option.port,
        host: option.addr
    });

    // Begin the eClient for OTA purpose
    debug("Try to connect to OTA server:");
    var eConfig = config.getEConnConfig(sysconfig);

    debug("OTA IP:", eConfig.host);
    debug("OTA Port:", eConfig.port);

    //  if you want to turnOn led after connected to explorer,
    //  assgin state property to this option
    // state: eClientLed,
    if (eConfig) {
        that.eClient = new EClient(option.gprs, eConfig, {
            reboot: ruff.softReset,
            timesHeartbeat: option.periodHeartbeat || 50, // -1 to forbit reboot
            timesOTAConnect: option.timesOTAConnect || 50,
            delayOTAConnect: option.delayOTAConnect || 20000,
            periodHeartbeat: option.periodHeartbeat || 20000
        });
        that.eClient._client.on("close", function (hasError) {
            debug("[Eclient close]", hasError);
            debug("reconnect");

            setTimeout(function () {
                that.eClient.connect();
            }, 36000);
        });
        setTimeout(function () {
            that.eClient.connect(); // 连接OTA server, 46秒后
        }, 36000);

    } else {
        log.error("Invalid explorer connConfig");
    }
};

module.exports = GPRS;