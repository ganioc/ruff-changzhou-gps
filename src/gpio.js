var stateLed = true;
var periodStatusLED = 1000;
var handleStatusLED;

exports.beep = function (duration) {
    console.log("beep");
    $("#BEEP").turnOn();
    setTimeout(function () {
        $("#BEEP").turnOff();
    }, duration);
};

var falshStatusLED = function () {
    var state = 0;
    handleStatusLED = setInterval(function () {
        if (state === 0) {
            state = 1;
            $("#CTRL_LED_2").turnOn(function () {});
        } else {
            state = 0;
            $("#CTRL_LED_2").turnOff(function () {});
        }
    }, periodStatusLED);
};
exports.flashStatusLEDIdle = function () {
    clearInterval(handleStatusLED);
    periodStatusLED = 250;
    falshStatusLED();
};
exports.flashStatusLEDConnected = function () {
    clearInterval(handleStatusLED);
    periodStatusLED = 1000;
    falshStatusLED();
};

exports.flashLED = function () {
    setInterval(
        function () {
            if (stateLed === true) {
                stateLed = false;
                $("#CTRL_LED_0").turnOn(function () {});
                $("#CTRL_LED_1").turnOn(function () {});
                $("#CTRL_LED_2").turnOn(function () {});
            } else {
                stateLed = true;
                $("#CTRL_LED_0").turnOff(function () {});
                $("#CTRL_LED_1").turnOff(function () {});
                $("#CTRL_LED_2").turnOff(function () {});
            }
        }, 1000);
};

exports.turnOnRed = function (cb) {
    $("#CTRL_LED_0").turnOn(cb);
};
exports.turnOnGreen = function (cb) {
    $("#CTRL_LED_1").turnOn(cb);
};
exports.turnOnBlue = function (cb) {
    $("#CTRL_LED_2").turnOn(cb);
};
exports.turnOffRed = function (cb) {
    $("#CTRL_LED_0").turnOff(cb);
};
exports.turnOffGreen = function (cb) {
    $("#CTRL_LED_1").turnOff(cb);
};
exports.turnOffBlue = function (cb) {
    $("#CTRL_LED_2").turnOff(cb);
};

exports.turnOnDout0 = function (cb) {
    $("#dout0").turnOff(cb);
};
exports.turnOffDout0 = function (cb) {
    $("#dout0").turnOn(cb);
};
exports.turnOnDout1 = function (cb) {
    $("#dout1").turnOff(cb);
};
exports.turnOffDout1 = function (cb) {
    $("#dout1").turnOn(cb);
};

exports.readDin0 = function (cb) {
    $("#din0").read(function (err, data) {
        if (err) {
            cb(err, undefined);
            return;
        }
        if (data == 0) {
            cb(undefined, 0);
        } else {
            cb(undefined, 1);
        }
    });
};
exports.readDin1 = function (cb) {
    $("#din1").read(function (err, data) {
        if (err) {
            cb(err, undefined);
            return;
        }
        if (data == 0) {
            cb(undefined, 0);
        } else {
            cb(undefined, 1);
        }
    });
};

exports.readAin0 = function (cb) {
    $("#an-0").getVoltage(function (error, voltage) {
        if (error) {
            cb(error);
            return;
        }
        cb(undefined, voltage);
    });
};

exports.readAin1 = function (cb) {
    $("#an-1").getVoltage(function (error, voltage) {
        if (error) {
            cb(error);
            return;
        }
        cb(undefined, voltage);
    });
};