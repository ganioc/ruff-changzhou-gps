'use strict';

var EventEmitter = require('events');
var util = require('util');
var Parser = require('./line-parser');
var Queue = require('ruff-async').Queue;

var RESPONSE_TIMEOUT = 5 * 1000; // 10 * 1000; change by yang jun
var PROMOTE_TIMEOUT = 5000 * 10; // 5000 * 10; change by yang jun

var SENDDATA_RESPONSE_TIMEOUT = 25000; // add by yang jun 2018-4-16

var ERROR_PATTERN = /ERROR/;
var OK_PATTERN = /OK/;
var CONNECTION_STATE_PATTERN = /^(\d), (CONNECT OK|CONNECT FAIL|ALREADY CONNECT|CLOSED)$/;
var CONNECTION_DATA_PATTERN = /^\+RECEIVE,(\d),(\d+):$/;
var UNI_UNSOLICITED_PATTERN = /^\+.*:/;
var CALL_READY_PATTERN = /Call Ready/;
var SMS_READY_PATTERN = /SMS Ready/;
var PDP_DEACT_PATTEN = /\+PDP: DEACT/;
// var CPIN_READY_PATTERN = /\+CPIN Ready/;
// var SMS_INDICATOR = new RegExp(/\+CMTI:\s"SM",\d+/);
var PROMOTE_STRING = '> ';

var State = {
    idle: 0,
    waitingResponse: 1
};

function CmdManager(port) {
    EventEmitter.call(this);

    this._cmdQueue = new Queue(this._processCmd);
    this._port = port;
    this._parser = new Parser();
    this._expectedStatus = false;
    this._responseData = [];

    this._port.on('data', this._parser.feed.bind(this._parser));
    this._port.on('error', this.emit.bind(this, 'error'));

    this._parser.on('line', this._handleEventLine.bind(this));

    if (debug('listen parser event') === true) {
        this._parser.on('line', function (line) {
            debug('parser get line', line);
        });
        this._parser.on('data', function (data) {
            debug('parser get data', data);
        });
        this._parser.on('promote', function () {
            debug('parser get promote');
        });
    }
}
util.inherits(CmdManager, EventEmitter);

CmdManager.prototype.reset = function () {
    this._parser.reset();
    this._expectedStatus = false;
    this._responseData = [];
};

CmdManager.prototype.sendAT = function (cmd, callback) {
    // cmd.content: AT content
    // cmd.timeout: timeout
    // cmd.responseFormat:
    // 1: \r\nERROR\r\n, 
    //      \r\nOK\r\n, 
    //      \r\n+ME:ERROR\r\n, 
    //      \r\n10.2.3.4\r\n
    // 2: \r\n...\r\n\r\n...\r\n\r\nOK\r\n
    //      OK is the 2nd part result[1]
    // 3: \r\nOK\r\n\r\n...\r\n\r\n...\r\n
    // cmd.responseLines: response maybe multiple lines

    cmd.type = 'at';
    cmd.content += '\r';
    this._cmdQueue.push(this, [cmd], callback);
};

CmdManager.prototype.sendData = function (fd, data, callback) {
    this._cmdQueue.push(this, [{
        type: 'data',
        content: [fd, data],
        responseForamt: 1
    }], callback);
};

CmdManager.prototype._genSendDataCmd = function (fd, length) {
    return Buffer.from('AT+CIPSEND=' + fd + ',' + length + '\r');
};

CmdManager.prototype._processCmd = function (cmd, callback) {
    debug('cmd is', JSON.stringify(cmd));

    var data;

    this._responseFormat = cmd.responseFormat || 1;

    this._getResponse(cmd, invokeCallbackOnce);


    if (cmd.type === 'at') {
        data = Buffer.from(cmd.content);
    } else if (cmd.type === 'data') {
        data = this._genSendDataCmd(cmd.content[0], cmd.content[1].length);
    } else {
        throw new Error('unsupported cmd type:', cmd.type);
    }

    // empty responseData
    this._responseData = [];

    this._port.write(data, function (error) {
        if (error) {
            invokeCallbackOnce(error);
            return;
        }
    });

    var callbackInvoked = false;

    function invokeCallbackOnce() {
        if (!callbackInvoked) {
            callbackInvoked = true;
            callback && callback.apply(undefined, arguments);
        }
    }
};

CmdManager.prototype._getResponse = function (cmd, callback) {
    this._cs = State.waitingResponse;
    var that = this;
    var responseTimerHandler;
    var promoteTimerHandler;

    function promoteHandler() {
        clearTimeout(promoteTimerHandler);

        responseTimerHandler = setTimeout(function () {
            responseDoneCleanup(new Error('CIPSEND data response timeout, id is ' + cmd.content[0]));
        }, SENDDATA_RESPONSE_TIMEOUT); // change by yang jun , 60000

        // send out the data after receive '>' prompt character
        that._port.write(cmd.content[1], function (error) {
            if (error) {
                callback(error);
                return;
            }
        });
    }

    if (cmd.type === 'data') {

        promoteTimerHandler = setTimeout(function () {
            debug('promote timeout');
            that._parser.removeListener('promote', promoteHandler);
            console.log(JSON.stringify(cmd));
            console.log(cmd.content[0], cmd.content[1]);
            console.log(that._parser._buffer);
            responseDoneCleanup(new Error('AT+CIPSEND response timeout, id is ' + cmd.content[0]));
        }, PROMOTE_TIMEOUT);

        debug('promote timer starts');
        this._parser.once('promote', promoteHandler);
        this._parser.waitPromote(PROMOTE_STRING);

    } else if (cmd.type === 'at') {
        if (cmd.responseFormat === 3) {
            this._responseLines = cmd.responseLines;
        }
        responseTimerHandler = setTimeout(function () {
            responseDoneCleanup(new Error('AT Response Timeout, cmd is ' + cmd.content.toString().replace('\r', '')));
        }, cmd.timeout || RESPONSE_TIMEOUT); // changed by yang jun 2018-4-16, cmd.timeout
    }

    this._responseCallback = responseDoneCleanup;

    function responseDoneCleanup(error, response) {
        clearTimeout(responseTimerHandler);

        if (cmd.type === 'data' && response && response[0] === 'ERROR') {
            // case: AT+CIPSEND=x,x return ERROR
            clearTimeout(promoteTimerHandler);
            that._parser.removeListener('promote', promoteHandler);
            error = new Error('AT+CIPSEND returns ERROR, please check GPRS status');
        }
        that._cs = State.idle;

        if (error) {
            console.log('====== error ======\n', error);
        }
        callback(error, response);
    }
};

CmdManager.prototype._handleEventLine = function (lineData) {
    if (lineData === '') {
        debug('get empty line');
        return;
    }
    if (this._cs === State.waitingResponse) {
        if (this._checkUnsolicited(lineData) === true) {
            debug('case 1 ====');
        } else {
            if (this._responseData.length === 0) {
                debug('case 2 ====');
                if (this._responseFormat === 1 && this._checkUniUnslolicitedPattern(lineData) === true) {
                    console.log('unsolicited data 1:', lineData);
                    return;
                }
                this._responseData.push(lineData);
                if (lineData.match(ERROR_PATTERN) !== null || // got ERROR, then response finished
                    this._responseFormat === 1) { // response only one line
                    debug('case 2.1 ====');
                    this._cs = State.idle;
                    this._responseCallback(undefined, this._responseData);
                }
            } else if (this._responseFormat === 2) {
                debug('case 3 ====');
                if (lineData !== '') {
                    this._responseData.push(lineData);
                }
                if (lineData.match(OK_PATTERN) !== null) {
                    debug('case 4 ====');
                    this._cs = State.idle;
                    this._responseCallback(undefined, this._responseData);
                }
            } else if (this._responseFormat === 3) {
                debug('case 5 ====');
                if (lineData !== '') {
                    this._responseData.push(lineData);
                }
                if (this._responseData.length === this._responseLines) {
                    debug('case 6 ====');
                    this._cs = State.idle;
                    this._responseCallback(undefined, this._responseData);
                }
            }
        }
    } else if (this._cs === State.idle) {
        if (this._checkUnsolicited(lineData) === true) {} else if (this._checkUniUnslolicitedPattern(lineData) === true) {
            console.log('unsolicited data 2:', lineData);
        } else {
            console.log('[warning] unexpected data 1:', lineData);
        }
    } else {
        console.log('[warning] unexpected data 2:', lineData);
    }
};

CmdManager.prototype._checkResponseLine = function (lineData) {
    if (lineData.match(ERROR_PATTERN) !== null) {
        this._responseData.push(lineData);
    }
};

CmdManager.prototype._checkUnsolicited = function (lineData) {
    var ret = true;
    if (this._checkConnectionState(lineData) === true) {
        // get connection status
    } else if (this._checkConnectionData(lineData) === true) {
        // get connection data
    } else if (lineData.match(CALL_READY_PATTERN) !== null) {
        // get call ready
        this.emit('call', lineData);
    } else if (lineData.match(SMS_READY_PATTERN) !== null) {
        // get sms ready
        this.emit('sms', lineData);
    } else if (lineData.match(PDP_DEACT_PATTEN) !== null) {
        console.log('PDP data:', lineData);
        this.emit('pdp', lineData);
    } else {
        ret = false;
    }
    return ret;
};

CmdManager.prototype._checkUniUnslolicitedPattern = function (lineData) {
    return lineData.match(UNI_UNSOLICITED_PATTERN) !== null;
};

CmdManager.prototype._checkConnectionState = function (lineData) {
    var result = lineData.match(CONNECTION_STATE_PATTERN);
    if (result === null) {
        return false;
    }
    var that = this;
    process.nextTick(function () {
        that.emit('connectionState', result[1], result[2]);
    });
    return true;
};

CmdManager.prototype._checkConnectionData = function (lineData) {
    var result = lineData.match(CONNECTION_DATA_PATTERN);
    if (result === null) {
        return false;
    }
    var that = this;
    this._parser.once('data', function (data) {
        that.emit('connectionData', result[1], data);
    });
    // receive length of data
    this._parser.waitData(result[2]);
    debug('wait data', result);
    return true;
};

module.exports = CmdManager;

function debug() {
    return false;
    Array.prototype.unshift.call(arguments, '[' + __filename + ']');
    console.log.apply(this, arguments);
    return true;
}