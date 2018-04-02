"use strict";
var GPS = require("./gps.js");
var GPIO = require("./gpio");
var Can = require("./can.js");

var debug = (function () {
    var header = "[" + __filename + "]";
    return function () {
        Array.prototype.unshift.call(arguments, header);
        console.log.apply(this, arguments);
    };
    // return function(){};
})();

exports.startLEDTask = function () {
    GPIO.flashLED();
};

exports.startGPSTask = function () {
    GPS.attach($("#gps"));
};

exports.startCANTask = function (options) {
    debug("start CAN task");
    var can = new Can("/dev/can1", options.baudRate || 500000);
    return can;
};

exports.startRS232Task = function () {
    var rs232 = $("#rs232");
    return rs232;
};

exports.startRS485Task = function () {
    var rs485 = $("#rs485");

    return rs485;
};

exports.startEClientTask = function () {};