"use strict";

var driver = require("ruff-driver");
var Level = require("gpio").Level;

var buffer = Buffer.alloc(256);
var indexBuffer = 0;
var state = 0;

var SYM_START = "$".charCodeAt(0);
var SYM_END1 = "\r".charCodeAt(0);
var SYM_END2 = "\n".charCodeAt(0);

var STATE_NONE = 0;
var STATE_START = 1;
var STATE_BODY = 2;
var STATE_END1 = 3;
var STATE_END2 = 4;

function AnalyzeByte(that, b) {
    // that.emit("data", data);
    // console.log("[gps-ana]", b);

    switch (state) {
        case STATE_NONE:
            if (b === SYM_START) {
                // console.log("[gps-ana]", b);
                buffer[indexBuffer++] = b;
                state = STATE_BODY;
            }
            break;
        case STATE_BODY:
            buffer[indexBuffer++] = b;
            if (b === SYM_END1) {
                state = STATE_END1;
            }
            break;
        case STATE_END1:
            if (b === SYM_END2) {
                buffer[indexBuffer++] = b;
                //console.log("emit data -->");
                that.emit("data", buffer.slice(0, indexBuffer));
            }
            indexBuffer = 0;
            state = STATE_NONE;
            break;
        case STATE_END2:
            break;
        default:
            throw new Error("Unhandled GPS driver state");
    }
}


function AnalyzeFrame(that, data) {
    var i;

    for (i = 0; i < data.length; i++) {
        AnalyzeByte(that, data[i]);
    }
}

module.exports = driver({

    attach: function (inputs, context) {
        // this._<interface> = inputs["<interface>"];
        var that = this;

        this._enPwr = inputs["enPwr"];
        this._uart = inputs["uart"];

        this._uart.on("data", function (data) {
            // console.log("[GPS^RX-raw]", data.toString().replace(/\r/g, "\\r").replace(/\n/g, "\\n"));
            AnalyzeFrame(that, data);
        });

        this._enPwr.write(Level.high);

    },

    exports: {
        func: function () {
            // this._<interface>.<method>
        }
    }

});