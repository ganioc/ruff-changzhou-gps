"use strict";
var Startup = require("./startup.js");
//var GPIO = require("./gpio");
var EEPROM = require("./eeprom.js");
var Task = require("./task.js");
var GPIO = require("./gpio.js");
var GPRS = require("./gprs.js");
var GPS = require("./gps.js");
var INIT_GPRS_TIMEOUT = 60000;
var PON_GPRS_TIMEOUT = 60000;
var PORT = 1883;
var ADDR = "139.219.184.44"; // server IP
//var gprs;
var gprsHandle = undefined;
var canHandle = undefined;
var rs232Handle = undefined;
var rs485Handle = undefined;

var debug = (function () {
    var header = "[" + __filename + "]";
    return function () {
        Array.prototype.unshift.call(arguments, header);
        console.log.apply(this, arguments);
    };
    // return function(){};
})();

Startup.printVersion();
Startup.printUid();
Startup.hookUncaughtException();
Startup.enableWatchdog(30000);

$.ready(function (error) {
    if (error) {
        console.log("error", error);
        return;
    }
    // setInterval(function () {
    //     console.log("hello world");
    //     GPIO.beep(100);
    // }, 1000);
    debug("hello world");
    debug("Read E2prom:");
    debug(EEPROM.getCapacity());

    // debug("Read E2prom:");
    // debug(EEPROM.getCapacity());
    // // debug(EEPROM.read(0, 1));
    // for (var i = 0; i < 4; i++) {
    //     debug(EEPROM.read(i * 4, 1));
    // }
    Task.startGPSTask();

    GPIO.flashStatusLEDIdle();

    setInterval(function () {
        taskGPS();
    }, 10000);

    //runAin();

    //runCAN();

    //runRS232();

    //runRS485();

    // gprsHandle = new GPRS({
    //     gprs: $("#gprs"),
    //     initTimeout: INIT_GPRS_TIMEOUT,
    //     powerOnTimeout: PON_GPRS_TIMEOUT,
    //     port: PORT,
    //     addr: ADDR,
    //     callback: mainHandle, // main function
    //     dataCallback: dataHandle // TCP data handler
    // });

    //Startup.setTime();

    // setInterval(function () {
    //     Startup.getTime();
    // }, 1000);

});
// TCP data handler
function dataHandle(data) {
    debug("dataHandle");
    false && data;
}

// main fucntion
function mainHandle() {
    debug("main");
    // hook all peripheral devices
    // 
    gprsHandle.configGPRS(undefined);

    // task 1
    setInterval(function () {
        task1();

    }, 20000);

    // task2
    task2();

    // task3
    task3();

}

function taskTemp() {
    var chip = Buffer.from(ruff.id.chipId).toString("hex");
    gprsHandle.getCENG(function (err, data) {
        if (err) {
            debug("cant get CENG");
            return;
        }
        debug("Getting CENG succeed");
        var dataTemp = data.toString().replace(/\+CENG/g, "");
        debug(dataTemp);
        gprsHandle.write(chip + ":" + "GPS:" + dataTemp);
    });
}

function taskGPS() {
    var dataGPS = GPS.getGPS();

    if (dataGPS.latitude !== 0 || dataGPS.longitude !== 0) {
        debug("Getting real GPS succeed");
        debug("GPS:" + dataGPS.longitude + ":" + dataGPS.latitude);
        return;
    } else {
        debug("Getting real GPS fail");
    }
}

function task1() {

    var dataGPS = GPS.getGPS();
    var chip = Buffer.from(ruff.id.chipId).toString("hex");

    // if GPS is OK
    if (dataGPS.latitude !== 0 || dataGPS.longitude !== 0) {
        debug("Getting real GPS succeed");
        gprsHandle.write(chip + ":" + "GPS:" + dataGPS.longitude + ":" + dataGPS.latitude);
        return;
    } else {
        debug("Getting real GPS fail");
    }

    // get GPRS LBS data
    gprsHandle.getLBS(function (err, data) {
        if (err) {
            debug("getLBS failed:", err);
            // get GPRS 
            gprsHandle.getCENG(function (err, data) {
                if (err) {
                    debug("cant get CENG");
                    return;
                }
                debug("Getting CENG succeed");
                var dataTemp = data.toString().replace(/\+CENG/g, "");
                debug(dataTemp);
                gprsHandle.write(chip + ":" + "GPS:" + dataTemp);
            });
            return;
        }
        var dataLst = data.toString().split(",");
        console.log(dataLst);

        debug("getLBS succeed:" + dataLst[1] + " " + dataLst[2] + dataLst[3]);



        // send it to server
        gprsHandle.write(chip + ":" + "GPS:" + dataLst[1] + ":" + dataLst[2], function (err, data) {
            if (err) {
                debug("Send GPS fail:" + err);

                return;
            }
            false && data;
            debug("Send GPS OK");
        });
    });
}

function task2() {

}

function task3() {
    debug("Connect to OTA server");

    // connectEServer(gprs, config.getEConnConfig(sysconfig));

}

function runCAN() {
    canHandle = Task.startCANTask({
        baudRate: 500000
    });

    canHandle.on("error", function (error) {
        debug("error", error);
    });
    canHandle.on("data", function (data) {
        debug("dataId", data.id);
        debug("dataContent", data.data);
    });

    canHandle.write(0x28, Buffer.from("12345678"), function (error) {
        if (error) {
            debug("write err1:", error);
            return;
        }
        debug("send ok1");
        canHandle.write(0x29, Buffer.from("44444444"), function (error) {
            if (error) {
                debug("write err2:", error);
                return;
            }
            debug("send ok2");
        });
    });

}

function runRS232() {
    rs232Handle = Task.startRS232Task();


    rs232Handle.on("data", function (data) {
        console.log("receive data:", data);
    });
    setInterval(function () {
        rs232Handle.write(Buffer.from("abc"), function () {
            console.log("send data ok");
        });
    }, 100);

}

function runRS485() {
    rs485Handle = Task.startRS485Task();
    rs485Handle.on("data", function (data) {
        console.log("receive data:", data);
    });
    setInterval(function () {
        rs485Handle.write(Buffer.from("abc"), function () {
            console.log("send data ok");
        });
    }, 100);
}

function runDin() {
    // read digital input pin 
    setInterval(function () {
        GPIO.readDin0(function (err, data) {
            if (err) {
                debug(err);
                return;
            }
            debug(data);
        });
    }, 1000);
}

function runAin() {
    setInterval(function () {
        GPIO.readAin0(function (err, data) {
            if (err) {
                debug(err);
                return;
            }
            debug(data);
        });
    }, 1000);
}