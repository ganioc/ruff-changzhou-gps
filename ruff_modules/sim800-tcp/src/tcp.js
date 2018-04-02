'use strict';
// var connectionManager = require('./connection-manager');
function TCP() {
    this._tcp = connectionManager.newConnection();
    this.bytesRead = 0;
}

TCP.prototype.close = function close(callback) {
    this._tcp.close(callback);
};

// TCP.prototype.shutdown = function (callback) {
//     this._tcp.shutdown(callback);
// };

TCP.prototype.readStop = function () {
    this._tcp.readStop();
};

TCP.prototype.readStart = function () {
    var that = this;

    this._tcp.readStart(function (error, data) {
        if (data) {
            that.bytesRead += data.length;
        }

        that.onread(error, data);
    });
};

TCP.prototype.write = function (data, callback) {
    // data must be Buffer
    this._tcp.write(data, callback);
};

TCP.prototype.connect = function (address, port, callback) {
    this._tcp.connect(address, port, callback);
};

TCP.prototype.ref = function () {
    // TODO:
};

TCP.prototype.unref = function () {
    // TODO:
};

Object.defineProperties(TCP.prototype, {
    readable: {
        get: function () {
            return true;
        }
    },
    writable: {
        get: function () {
            return true;
        }
    }
});

module.exports = TCP;
