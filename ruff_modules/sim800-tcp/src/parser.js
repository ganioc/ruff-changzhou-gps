'use strict';

var EventEmitter = require('events');
var util = require('util');

var State = {
    head: 0,
    line: 1,
    promote: 2,
    data: 3
};

var HEAD = Buffer.from('\r\n');
var END = Buffer.from('\r\n');

function Parser() {
    EventEmitter.call(this);
    this.init();
}
util.inherits(Parser, EventEmitter);

Parser.prototype.init = function () {
    this._expectedPromote = null;
    this._expectedDataLength = 0;
    this._state = State.head;
    this._buffer = Buffer.alloc(0);
};

Parser.prototype.feed = function (data) {
    this._buffer = Buffer.concat([this._buffer, data]);
    debug('data in cache:', this._buffer.toString().replace('\r', '\\r').replace('\n', '\\n'));
    this._parse();
};

Parser.prototype._consume = function (length) {
    // empty _buffer
    this._buffer = this._buffer.slice(length);
};

Parser.prototype._parse = function () {
    // when _buffer is not empty
    while (this._buffer.length) {
        var parsed;
        debug('-----', this._state, '-----');
        switch (this._state) {
            case State.head:
                parsed = this._parseHead();
                break;
            case State.line:
                parsed = this._parseLine();
                break;
            case State.promote:
                parsed = this._parsePromote();
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

Parser.prototype._parseHead = function () {
    debug('in parser, parse head');
    var index = this._buffer.indexOf(HEAD);
    if (index >= 0) {
        this._state = State.line;
        this.emit('head');
        this._consume(index + 2);
        return true;
    } else {
        // this._buffer = Buffer.alloc(0);
        return false;
    }
};

Parser.prototype._parseLine = function () {
    debug('in parser, parse line');
    var index = this._buffer.indexOf(END);
    if (index >= 0) {
        this._state = State.line;
        this.emit('line', this._buffer.slice(0, index).toString());
        this._consume(index + 2);
        return true;
    }
    return false;
};

Parser.prototype._parsePromote = function () {
    debug('in parser, parse promote');
    var index = this._buffer.indexOf(this._expectedPromote);
    if (index >= 0) {
        this._state = State.head;
        this.emit('promote');
        this._consume(index + this._expectedPromote.length);
        return true;
    }
    return false;
};

Parser.prototype._parseData = function () {
    debug('in parser, parse data', this._buffer.length, this._expectedDataLength);
    if (this._buffer.length >= this._expectedDataLength) {
        this.emit('data', this._buffer.slice(0, this._expectedDataLength));
        this._consume(this._expectedDataLength);
        this._state = State.head;
        return true;
    }
    return false;
}

Parser.prototype.waitPromote = function (promote) {
    debug('in parser, now wait promote');
    this._state = State.promote;
    this._expectedPromote = Buffer.from(promote);
};

Parser.prototype.waitData = function (length) {
    debug('in parser, now wait data');
    this._state = State.data;
    this._expectedDataLength = length;
};

Parser.prototype.waitHead = function () {
    debug('in parser, now wait head');
    this._state = State.head;
};

module.exports = Parser;

var debug = function () {
    return;
    Array.prototype.unshift.call(arguments, '[' + __filename + ']');
    console.log.apply(this, arguments);
};