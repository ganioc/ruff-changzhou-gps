'use strict';

var EventEmitter = require('events');
var stream = require('stream');
var util = require('util');
//var assert = require('assert');
function assert() {
}
assert.ok = function () {
};

var TCP = require('./tcp.js');

function errnoException(err, syscall) {
    var e = new Error('[' + syscall + '] ' + err.message);
    e.syscall = syscall;
    return e;
}

function exceptionWithHostPort(err, syscall, address, port, additional) {
    var e = new Error(syscall);
    e.syscall = syscall;
    return e;
}

function isLegalPort(port) {
    if ((typeof port !== 'number' && typeof port !== 'string') ||
            (typeof port === 'string' && port.trim().length === 0))
        return false;
    return +port === (+port >>> 0) && port <= 0xFFFF;
}

function assertPort(port) {
    if (typeof port !== 'undefined' && !isLegalPort(port))
        throw new RangeError('"port" argument must be >= 0 and < 65536');
}

function noop() {}

function createHandle(fd) {
    return new TCP();
}

var debug = function () {
    return;
    Array.prototype.unshift.call(arguments, '[' + __filename + ']');
    console.log.apply(this, arguments);
}

function isPipeName(s) {
    return typeof s === 'string' && toNumber(s) === false;
}

// Target API:
//
// var s = net.connect({port: 80, host: 'google.com'}, function() {
//   ...
// });
//
// There are various forms:
//
// connect(options, [cb])
// connect(port, [host], [cb])
// connect(path, [cb]);
//
exports.connect = exports.createConnection = function () {
    var argsLen = arguments.length;
    var args = new Array(argsLen);
    for (var i = 0; i < argsLen; i++)
        args[i] = arguments[i];
    args = normalizeConnectArgs(args);
    debug('createConnection', args);
    var s = new Socket(args[0]);
    return Socket.prototype.connect.apply(s, args);
};

// Returns an array [options] or [options, cb]
// It is the same as the argument of Socket.prototype.connect().
function normalizeConnectArgs(args) {
    var options = {};

    if (args[0] !== null && typeof args[0] === 'object') {
        // connect(options, [cb])
        options = args[0];
    } else if (isPipeName(args[0])) {
        // connect(path, [cb]);
        options.path = args[0];
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

// called when creating new Socket, or when re-using a closed Socket
function initSocketHandle(self) {
    self.destroyed = false;
    self._bytesDispatched = 0;

    // Handle creation may be deferred to bind() or connect() time.
    if (self._handle) {
        self._handle.owner = self;
        self._handle.onread = onread;
    }
}

function Socket(options) {
    this.connecting = false;
    this._hadError = false;
    this._handle = null;
    this._parent = null;
    this._host = null;

    options = options || {};
    stream.Duplex.call(this, options);

    if (options.handle) {
        this._handle = options.handle; // private
    } else if (options.fd !== undefined) {
        this._handle = createHandle(options.fd);
        this._handle.open(options.fd);
        this.readable = options.readable !== false;
        this.writable = options.writable !== false;
    } else {
        // these will be set once there is a connection
        this.readable = this.writable = false;
    }

    // shut down the socket when we're finished with it.
    this.on('finish', onSocketFinish);
    this.on('_socketEnd', onSocketEnd);

    this._init();

    this._pendingData = null;
    this._pendingEncoding = '';

    // handle strings directly
    this._writableState.decodeStrings = false;

    // default to *not* allowing half open sockets
    this.allowHalfOpen = options && options.allowHalfOpen || false;

    // if we have a handle, then start the flow of data into the
    // buffer.  if not, then this will happen when we connect
    if (this._handle && options.readable !== false) {
        if (options.pauseOnCreate) {
            // stop the handle from reading and pause the stream
            this._handle.reading = false;
            this._handle.readStop();
            this._readableState.flowing = false;
        } else {
            this.read(0);
        }
    }

    // Used after `.destroy()`
    this._bytesRead = 0;
}
util.inherits(Socket, stream.Duplex);

// called when creating new Socket, or when re-using a closed Socket
Socket.prototype._init = function () {
    this.destroyed = false;
    this._bytesDispatched = 0;
    // Handle creation may be deferred to bind() or connect() time.
    if (this._handle) {
        this._handle.owner = this;
        this._handle.onread = onread;
    }
}

Socket.prototype._unrefTimer = function unrefTimer() {
    for (var s = this; s !== null; s = s._parent)
        clearTimeout(s._timeoutTimer);
};

// the user has called .end(), and all the bytes have been
// sent out to the other side.
// If allowHalfOpen is false, or if the readable side has
// ended already, then destroy.
// If allowHalfOpen is true, then we need to do a shutdown,
// so that only the writable side will be cleaned up.
function onSocketFinish() {
    var that = this;

    // If still connecting - defer handling 'finish' until 'connect' will happen
    if (this.connecting) {
        debug('osF: not yet connected');
        return this.once('connect', onSocketFinish);
    }

    debug('onSocketFinish');

    if (!this.readable || this._readableState.ended) {
        debug('oSF: ended, destroy', this._readableState);
        return this.destroy();
    }

    debug('oSF: not ended, call shutdown()');

    // otherwise, just shutdown, or destroy() if not possible
    if (!this._handle || !this._handle.shutdown)
        return this.destroy();

    try {
        this._handle.shutdown(function () {
            afterShutdown(that);
        });
    } catch (err) {
        return this._destroy(errnoException(err, 'shutdown'));
    }
}


function afterShutdown(socket) {
    debug('afterShutdown destroyed=%j', socket.destroyed,
                socket._readableState);

    // callback may come after call to destroy.
    if (socket.destroyed)
        return;

    if (socket._readableState.ended) {
        debug('readableState ended, destroying');
        socket.destroy();
    } else {
        socket.once('_socketEnd', socket.destroy);
    }
}

// the EOF has been received, and no more bytes are coming.
// if the writable side has ended already, then clean everything
// up.
function onSocketEnd() {
    // XXX Should not have to do as much crap in this function.
    // ended should already be true, since this is called *after*
    // the EOF errno and onread has eof'ed
    debug('onSocketEnd', this._readableState);
    this._readableState.ended = true;
    if (this._readableState.endEmitted) {
        this.readable = false;
        maybeDestroy(this);
    } else {
        this.once('end', function () {
            this.readable = false;
            maybeDestroy(this);
        });
        this.read(0);
    }

    if (!this.allowHalfOpen) {
        this.write = writeAfterFIN;
        this.destroySoon();
    }
}

// Provide a better error message when we call end() as a result
// of the other side sending a FIN.  The standard 'write after end'
// is overly vague, and makes it seem like the user's code is to blame.
function writeAfterFIN(chunk, encoding, cb) {
    if (typeof encoding === 'function') {
        cb = encoding;
        encoding = null;
    }

    var er = new Error('This socket has been ended by the other party');
    er.code = 'EPIPE';
    // TODO: defer error events consistently everywhere, not just the cb
    this.emit('error', er);
    if (typeof cb === 'function') {
        process.nextTick(cb, er);
    }
}

Socket.prototype.read = function (n) {
    if (n === 0)
        return stream.Readable.prototype.read.call(this, n);

    this.read = stream.Readable.prototype.read;
    this._consuming = true;
    return this.read(n);
};

Socket.prototype.setTimeout = function (msecs, callback) {
    var that = this;

    clearTimeout(this._timeoutTimer);

    if (msecs === 0) {
        if (callback) {
            this.removeListener('timeout', callback);
        }
    } else {
        this._timeoutTimer = setTimeout(function () {
            that._onTimeout();
        }, msecs, this);
        if (callback) {
            this.once('timeout', callback);
        }
    }
    return this;
};

Socket.prototype._onTimeout = function () {
    debug('_onTimeout');
    this.emit('timeout');
};

Object.defineProperty(Socket.prototype, '_connecting', {
    get: function () {
        return this.connecting;
    }
});

Object.defineProperty(Socket.prototype, 'readyState', {
    get: function () {
        if (this.connecting) {
            return 'opening';
        } else if (this.readable && this.writable) {
            return 'open';
        } else if (this.readable && !this.writable) {
            return 'readOnly';
        } else if (!this.readable && this.writable) {
            return 'writeOnly';
        } else {
            return 'closed';
        }
    }
});

Object.defineProperty(Socket.prototype, 'bufferSize', {
    get: function () {
        if (this._handle) {
            return this._handle.writeQueueSize + this._writableState.length;
        }
    }
});

// Just call handle.readStart until we have enough in the buffer
Socket.prototype._read = function (n) {
    debug('_read');

    var that = this;

    if (this.connecting || !this._handle) {
        debug('_read wait for connection');
        this.once('connect', function () { return that._read(n); });
    } else if (!this._handle.reading) {
        // not already reading, start the flow
        debug('Socket._read readStart');
        this._handle.reading = true;
        try {
            this._handle.readStart();
        } catch (err) {
            this._destroy(errnoException(err, 'read'));
        }
    }
};

Socket.prototype.end = function (data, encoding) {
    stream.Duplex.prototype.end.call(this, data, encoding);
    this.writable = false;
    // DTRACE_NET_STREAM_END(this);
    // LTTNG_NET_STREAM_END(this);

    // just in case we're waiting for an EOF.
    if (this.readable && !this._readableState.endEmitted) {
        this.read(0);
    } else {
        maybeDestroy(this);
    }
};

// Call whenever we set writable=false or readable=false
function maybeDestroy(socket) {
    if (!socket.readable &&
            !socket.writable &&
            !socket.destroyed &&
            !socket.connecting &&
            !socket._writableState.length) {
        socket.destroy();
    }
}

Socket.prototype.destroySoon = function () {
    if (this.writable) {
        this.end();
    }

    if (this._writableState.finished) {
        this.destroy();
    } else {
        this.once('finish', this.destroy);
    }
};

Socket.prototype._destroy = function (exception, cb) {
    debug('_destroy', exception);

    function fireErrorCallbacks(self) {
        if (cb) {
            cb(exception);
        }
        if (exception && !self._writableState.errorEmitted) {
            process.nextTick(emitErrorNT, self, exception);
            self._writableState.errorEmitted = true;
        }
    }

    var that = this;

    if (this.destroyed) {
        debug('already destroyed, fire error callbacks');
        fireErrorCallbacks(this);
        return;
    }

    this.connecting = false;

    this.readable = this.writable = false;

    for (var s = this; s !== null; s = s._parent)
        clearTimeout(s._timeoutTimer);

    debug('close');
    if (this._handle) {
        if (this !== process.stderr)
            debug('close handle');
        var isException = exception ? true : false;
        // `bytesRead` should be accessible after `.destroy()`
        this._bytesRead = this._handle.bytesRead;

        this._handle.close(function () {
            debug('emit close');
            that.emit('close', isException);
        });
        this._handle.onread = noop;
        this._handle = null;
    }

    // we set destroyed to true before firing error callbacks in order
    // to make it re-entrance safe in case Socket.prototype.destroy()
    // is called within callbacks
    this.destroyed = true;
    fireErrorCallbacks(this);
};


Socket.prototype.destroy = function (exception) {
    debug('destroy', exception);
    this._destroy(exception);
};


// This function is called whenever the handle gets a
// buffer, or when there's an error reading.
function onread(error, data) {
    var handle = this;
    var self = handle.owner;
    assert(handle === self._handle, 'handle != self._handle');

    self._unrefTimer();

    debug('onread', data ? data.length : 0);

    if (error) {
        return self._destroy(errnoException(error, 'read'));
    }

    if (data) {
        debug('got data');

        // read success.
        // In theory (and in practice) calling readStop right now
        // will prevent this from being called again until _read() gets
        // called again.

        // Optimization: emit the original buffer with end points
        var ret = self.push(new Buffer(data));

        if (handle.reading && !ret) {
            handle.reading = false;
            debug('readStop');

            try {
                handle.readStop();
            } catch (err) {
                self._destroy(errnoException(err, 'read'));
            }
        }
        return;
    }

    debug('EOF');

    if (self._readableState.length === 0) {
        self.readable = false;
        maybeDestroy(self);
    }

    // push a null to signal the end of data.
    self.push(null);

    // internal end event so that we know that the actual socket
    // is no longer readable, and we can start the shutdown
    // procedure. No need to wait for all the data to be consumed.
    self.emit('_socketEnd');
}

function protoGetter(name, callback) {
    Object.defineProperty(Socket.prototype, name, {
        configurable: false,
        enumerable: true,
        get: callback
    });
}

protoGetter('bytesRead', function bytesRead() {
    return this._handle ? this._handle.bytesRead : this._bytesRead;
});

Socket.prototype.write = function (chunk, encoding, cb) {
    if (typeof chunk !== 'string' && !(chunk instanceof Buffer)) {
        throw new TypeError(
            'Invalid data, chunk must be a string or buffer, not ' + typeof chunk);
    }
    return stream.Duplex.prototype.write.apply(this, arguments);
};

Socket.prototype._write = function (data, encoding, cb) {
    var that = this;

    debug('_write');

    // If we are still connecting, then buffer this for later.
    // The Writable logic will buffer up any more writes while
    // waiting for this one to be done.
    if (this.connecting) {
        this._pendingData = data;
        this._pendingEncoding = encoding;
        this.once('connect', function () {
            this._write(data, encoding, cb);
        });
        return;
    }
    this._pendingData = null;
    this._pendingEncoding = '';

    this._unrefTimer();

    if (!this._handle) {
        this._destroy(new Error('This socket is closed'), cb);
        return false;
    }

    try {
        this._handle.write(data, function (error) {
            afterWrite(that, cb, error);
        });
    } catch (error) {
        return this._destroy(new Error('This socket is closed'), cb);
    }

    this._bytesDispatched += data.length;
};

protoGetter('bytesWritten', function bytesWritten() {
    var bytes = this._bytesDispatched;
    var state = this._writableState;
    var data = this._pendingData;
    var encoding = this._pendingEncoding;

    if (!state)
        return undefined;

    state.getBuffer().forEach(function (el) {
        if (el.chunk instanceof Buffer)
            bytes += el.chunk.length;
        else
            bytes += Buffer.byteLength(el.chunk, el.encoding);
    });

    if (data) {
        if (data instanceof Buffer)
            bytes += data.length;
        else
            bytes += Buffer.byteLength(data, encoding);
    }

    return bytes;
});

function afterWrite(socket, callback, error) {
    if (socket !== process.stderr && socket !== process.stdout)
        debug('afterWrite');

    // callback may come after call to destroy.
    if (socket.destroyed) {
        debug('afterWrite destroyed');
        return;
    }

    if (error) {
        debug('write failure', error);
        socket._destroy(error, callback);
        return;
    }

    socket._unrefTimer();

    if (socket !== process.stderr && socket !== process.stdout)
        debug('afterWrite call callback');

    if (callback)
        callback.call(socket);
}

function connect(socket, address, port) {
    // TODO return promise from Socket.prototype.connect which
    // wraps _connectReq.

    assert.ok(socket.connecting);

    try {
        socket._handle.connect(address, port, function (error) {
            afterConnect(socket, address, port, error);
        });
    } catch (err) {
        debug('connect error', err);
        var details;

        var ex = exceptionWithHostPort(err, 'connect', address, port, details);
        socket._destroy(ex);
        return;
    }
}

Socket.prototype.connect = function (options, cb) {
    if (this.write !== Socket.prototype.write)
        this.write = Socket.prototype.write;

    if (options === null || typeof options !== 'object') {
        // Old API:
        // connect(port, [host], [cb])
        // connect(path, [cb]);
        var argsLen = arguments.length;
        var args = new Array(argsLen);
        for (var i = 0; i < argsLen; i++)
            args[i] = arguments[i];
        args = normalizeConnectArgs(args);
        return Socket.prototype.connect.apply(this, args);
    }

    if (this.destroyed) {
        this._readableState.reading = false;
        this._readableState.ended = false;
        this._readableState.endEmitted = false;
        this._writableState.ended = false;
        this._writableState.ending = false;
        this._writableState.finished = false;
        this._writableState.errorEmitted = false;
        this.destroyed = false;
        this._handle = null;
    }

    if (!this._handle) {
        debug('======');
        this._handle = new TCP();
        this._init();
    }

    if (typeof cb === 'function') {
        this.once('connect', cb);
    }

    this._unrefTimer();

    this.connecting = true;
    this.writable = true;

    // lookupAndConnect(this, options);
    connect(this, options.host, options.port);
    return this;
};

function lookupAndConnect(self, options) {
    var dns = require('dns');
    var host = options.host || 'localhost';
    var port = options.port;
    var localAddress = options.localAddress;
    var localPort = options.localPort;

    if (localAddress && !exports.isIP(localAddress))
        throw new TypeError('"localAddress" option must be a valid IP: ' + localAddress);

    if (localPort && typeof localPort !== 'number')
        throw new TypeError('"localPort" option should be a number: ' + localPort);

    if (typeof port !== 'undefined') {
        if (typeof port !== 'number' && typeof port !== 'string')
            throw new TypeError('"port" option should be a number or string: ' + port);
        if (!isLegalPort(port))
            throw new RangeError('"port" option should be >= 0 and < 65536: ' + port);
    }
    port |= 0;

    // If host is an IP, skip performing a lookup
    var addressType = exports.isIP(host);
    if (addressType) {
        process.nextTick(function () {
            if (self.connecting)
                connect(self, host, port, addressType, localAddress, localPort);
        });
        return;
    }

    if (options.lookup && typeof options.lookup !== 'function')
        throw new TypeError('"lookup" option should be a function');

    var dnsopts = {
        family: options.family,
        hints: options.hints || 0
    };

    if (dnsopts.family !== 4 && dnsopts.family !== 6 && dnsopts.hints === 0) {
        // console.log('about to fail');
        dnsopts.hints = dns.ADDRCONFIG;
    }

    debug('connect: find host ' + host);
    debug('connect: dns options', dnsopts);
    self._host = host;
    var lookup = options.lookup || dns.lookup;
    lookup(host, dnsopts, function (err, ip, addressType) {
        self.emit('lookup', err, ip, addressType, host);

        // It's possible we were destroyed while looking this up.
        // XXX it would be great if we could cancel the promise returned by
        // the look up.
        if (!self.connecting) return;

        if (err) {
            // net.createConnection() creates a net.Socket object and
            // immediately calls net.Socket.connect() on it (that's us).
            // There are no event listeners registered yet so defer the
            // error event to the next tick.
            err.host = options.host;
            err.port = options.port;
            err.message = err.message + ' ' + options.host + ':' + options.port;
            process.nextTick(connectErrorNT, self, err);
        } else {
            self._unrefTimer();
            connect(
                self,
                ip,
                port,
                addressType,
                localAddress,
                localPort
            );
        }
    });
}

function connectErrorNT(self, err) {
    debug('connectErrorNT');
    self.emit('error', err);
    self._destroy();
}

function afterConnect(socket, address, port, error) {
    // callback may come after call to destroy
    if (socket.destroyed) {
        return;
    }

    debug('afterConnect');

    assert.ok(socket.connecting);
    socket.connecting = false;

    var readable = socket._handle.readable;
    var writable = socket._handle.writable;

    if (error) {
        socket.connecting = false;

        var ex = exceptionWithHostPort(
            error,
            'connect',
            address,
            port
        );
        socket._destroy(ex);
        return;
    }

    socket.readable = readable;
    socket.writable = writable;
    socket._unrefTimer();

    socket.emit('connect');

    // start the first read, or get an immediate EOF.
    // this doesn't actually consume any bytes, because len=0.
    if (readable && !socket.isPaused())
        socket.read(0);
}
exports.Socket = Socket;

function toNumber(x) { return (x = Number(x)) >= 0 ? x : false; }

function emitErrorNT(self, err) {
    debug('emitErrorNT');
    self.emit('error', err);
}
