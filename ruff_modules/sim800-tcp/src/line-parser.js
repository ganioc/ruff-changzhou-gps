'use strict';

var EventEmitter = require('events');
var util = require('util');

var State = {
    line: 1,
    data: 2
};
var LINE_MARKER = Buffer.from('\r\n');

function Parser() {
    EventEmitter.call(this);
    this.init();
}
util.inherits(Parser, EventEmitter);

Parser.prototype.init = function () {
    this._expectedDataLength = 0;
    this._tryPromote = false;
    this._lastLineStr = null;
    this._state = State.line;
    this._buffer = Buffer.alloc(0);
};

Parser.prototype.reset = Parser.prototype.init;

Parser.prototype.feed = function (data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    debug('data in cache:', this._buffer.toString().replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
    this._parse();
};

Parser.prototype._consume = function (length) {
    this._buffer = this._buffer.slice(length);
};

Parser.prototype._parse = function () {
    while (this._buffer.length) {
        var parsed;
        debug('-----', this._state, '-----');
        switch (this._state) {
            case State.line:
                parsed = this._parseLine();
                break;
            case State.data:
                parsed = this._parseData();
                break;
            default:
                break;
        }

        if (!parsed) {
            break;
        }
    }
};

Parser.prototype._parseLine = function () {
    debug('parse line');

    if (this._tryPromote === true) {
        this._tryParsePromote();
    }
    var index = this._buffer.indexOf(LINE_MARKER);
    if (index >= 0) {
        this._lastLineStr = this._buffer.slice(0, index).toString();
        // ignore echo line, we can use string.endsWith('\r') if available
        if (this._lastLineStr[this._lastLineStr.length - 1] === '\r') {
            this._lastLineStr = '';
        }
        this._consume(index + 2);
        debug('get line');
        this.emit('line', this._lastLineStr);
        return true;
    }
    return false;
};

Parser.prototype._tryParsePromote = function () {
    if (this._lastLineStr === '' && this._buffer.length >= this._expectedPromote.length) {
        debug('try parse promote');
        if (this._buffer.slice(0, this._expectedPromote.length).equals(this._expectedPromote) === true) {
            debug('get promote');
            this._tryPromote = false;
            this._consume(this._expectedPromote.length);
            this.emit('promote');
        }
    }
};

Parser.prototype._parseData = function () {
    debug('parse data', this._buffer.length, this._expectedDataLength);
    if (this._buffer.length >= this._expectedDataLength) {
        var data = this._buffer.slice(0, this._expectedDataLength);
        this._consume(this._expectedDataLength);
        this.emit('data', data);
        this._state = State.line;
        return true;
    }
    return false;
};

Parser.prototype.waitPromote = function (promote) {
    debug('in parser, now wait promote');
    this._tryPromote = true;
    this._expectedPromote = Buffer.from(promote);
};

Parser.prototype.waitData = function (length) {
    debug('in parser, now wait data');
    this._state = State.data;
    this._expectedDataLength = length;
};

module.exports = Parser;

function debug() {
    return;
    Array.prototype.unshift.call(arguments, '[' + __filename + ']');
    console.log.apply(this, arguments);
}