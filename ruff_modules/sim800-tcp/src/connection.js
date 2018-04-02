'use strict';

var EventEmitter = require('events');
var util = require('util');

var State = {
    closed: 0,
    connecting: 1,
    connected: 2,
    closing: 3
};

function Connection(fd, cmdManager) {
    EventEmitter.call(this);
    this.fd = fd;
    this._cmdManager = cmdManager;
    this._dataQueue = [];
    this._state = State.closed;
    this._connectCallback = null;
}

util.inherits(Connection, EventEmitter);

Connection.prototype.feed = function (data) {
    // this.emit('data', data);
    if (typeof this._dataListener === 'function') {
        this._dataListener.call(undefined, undefined, data);
    } else {
        console.log('[warning] data lost in connection ' + this.fd);
    }
};

Connection.prototype.readStart = function (dataListener) {
    debug('readStart');
    this._dataListener = dataListener;
};

Connection.prototype.readStop = function () {
    debug('readStop');
    this._dataListener = null;
};

Connection.prototype.connect = function (address, port, callback) {
    if (this._state !== State.closed) {
        process.nextTick(function () {
            callback && callback(new Error('already connected or connecting'));
        });
        return;
    }
    this._state = State.connecting;
    if (typeof callback === 'function') {
        this._connectCallback = callback;
        debug('wait connect');
        this.once('connect', callback);
    } else {
        this._connectCallback = null;
    }
    var that = this;
    this._ipStart(this.fd, address, port, function (error, status, result) {
        if (error) {
            that.emit('error', error);
            callback && callback(error);
            // that._close(true);
        } else if (status === false) {
            var e = new Error(result);
            that.emit('error', e);
            callback && callback(e);
            // that._close(true);
        }
    });
    // var args = Array.prototype.slice.call(arguments, 0);
    // args = normalizeConnectArgs(args);
    // // args: [options, cb] or [options]
    // var options = args[0];
    // var callback = args[1];
    // this._host = options.host || '127.0.0.1';
    // this._port = options.port;
    // if (typeof this._host !== 'string') {
    //     throw new Error('host should be a string:', this._host);
    // }
    // if (typeof this._port !== 'number') {
    //     throw new Error('port should be a number:', this._port);
    // }
    // if (typeof callback === 'function') {
    //     this.once('connect', callback);
    // }
    // this._state = State.connecting;
    // this._ipStart(this._fd, this._host, this._port, function (error, status, result) {
    //     if (error) {
    //         that.emit('error', error);
    //         that._close(true);
    //     } else if (status === false) {
    //         that.emit('error', new Error(result));
    //         that._close(true);
    //     }
    // });
};

Connection.prototype.setStatus = function (status) {
    debug('connection ' + this.fd + ' event: ' + status);
    debug('current satate is', this._state);
    if (this._state === State.connecting) {
        if (status === 'ALREADY CONNECT' || status === 'CONNECT OK') {
            this._state = State.connected;
            debug('will emit connect event');
            this.emit('connect');
        } else if (status === 'CONNECT FAIL') {
            var e = new Error('CONNECT FAIL');
            this.emit('error', e);
            this._connectCallback && this._connectCallback(e);
            // this._close(true);
        } else {
            console.log('[warning] unexpected status', status);
        }
    } else if (this._state === State.connected) {
        if (status === 'SEND OK') {
            if (this._dataQueue.length === 0) {
                this.emit('drain');
            }
        } else if (status === 'CLOSED') {
            this._close(false);
            if (typeof this._dataListener === 'function') {
                this._dataListener.call(undefined, undefined, undefined);
            }
        } else {
            console.log('[warning] unexpected status', status);
        }
    }
};

Connection.prototype._cleanup = function () {
    this._clientCommunication.setConnectionUnused(this._index);
    this._clientCommunication.removeListener('msg' + this._index, this._msgListener);
    this._clientCommunication.removeListener('client' + this._index, this._clientListener);
};

Connection.prototype._close = function (hasError) {
    this._state = State.closed;
    this.emit('close', hasError);
};

Connection.prototype._ipStart = function (index, host, port, callback) {
    this._cmdManager.sendAT({
        content: 'AT+CIPSTART=' + index + ',"TCP","' + host + '","' + port + '"',
        responseFormat: 1
    }, function (error, result) {
        if (error) {
            callback && callback(error);
            return;
        }
        callback && callback(undefined, result[0] === 'OK', result[0]);
    });
};

Connection.prototype.write = function (data, callback) {
    if (typeof data === 'string') {
        data = Buffer.from(data);
    }
    this._write(data, callback);
    // process.nextTick(function () {
    //     callback && callback();
    // });
};

Connection.prototype._write = function (data, callback) {
    var that = this;
    if (this._dataQueue.length > 0) {
        this._dataQueue.push(data);
        console.log('[info] cache write data');
        process.nextTick(function () {
            callback && callback();
        });
        return;
    }
    nextWrite(data);
    function nextWrite(wdata) {
        that._cmdManager.sendData(that.fd, wdata, function (error) {
            if (error) {
                that.emit('error', error);
                callback && callback(error);
                // that._close(true);
                return;
            }
            if (that._dataQueue.length === 0) {
                callback && callback();
                return;
            } else {
                process.nextTick(function () {
                    nextWrite(that._dataQueue.shift());
                });
            }
        });
    }
};

Connection.prototype.destroy = function () {
    if (this._state !== State.connected && this._state !== State.connecting) {
        console.log('[warning] invalid state when invoke destroy,', this._state);
        return;
    }
    var that = this;
    this._state = State.closing;
    this._cmdManager.sendAT({
        content: 'AT+CIPCLOSE=' + this.fd,
        responseFormat: 1
    }, function (error, response) {
        if (error) {
            debug('close response is', response);
            that.emit('error', error);
            that._close(true);
            return;
        }
        that._close(false);
    });
};

Connection.prototype.close = function (callback) {
    debug('[connection] state is', this._state);
    if (this._state === State.closed) {
        callback && process.nextTick(callback);
    } else if (this._state === State.connected || this._state === State.connecting) {
        if (typeof callback === 'function') {
            this.once('close', callback);
        }
        this.destroy();
    } else {
        console.log('[warning] invalid state when invoke close,', this._state);
    }
};

function normalizeConnectArgs(args) {
    var options = {};

    if (args[0] !== null && typeof args[0] === 'object') {
        // connect(options, [cb])
        options = args[0];
    } else {
        // connect(port, [host], [cb])
        options.port = args[0];
        if (typeof args[1] === 'string') {
            options.host = args[1];
        }
    }

    var cb = args[args.length - 1];
    return typeof cb === 'function' ? [options, cb] : [options];
}

module.exports = Connection;

function debug() {
    return;
    Array.prototype.unshift.call(arguments, '[' + __filename + ']');
    console.log.apply(this, arguments);
}
