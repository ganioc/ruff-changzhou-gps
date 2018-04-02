'use strict';

var series = require('ruff-async').series;
var isPowerOn = false;

var debug = (function () {
    var header = '[' + __filename + ']';
    return function () {
        Array.prototype.unshift.call(arguments, header);
        console.log.apply(this, arguments);
    };
    // return function(){};
})();

function createCommands(cmdManager) {
    var commands = Object.create(null);

    commands.sendAT1 = function (cmd, callback) {
        cmdManager.sendAT({
            content: cmd,
            responseFormat: 1
        }, callback);
    };
    commands.sendAT2 = function (cmd, callback) {
        cmdManager.sendAT({
            content: cmd,
            responseFormat: 2
        }, callback);
    };
    commands.sendAT3 = function (cmd, responseLines, callback) {
        cmdManager.sendAT({
            content: cmd,
            responseFormat: 3,
            responseLines: responseLines
        }, callback);
    };

    commands.startup = function (callback) {
        if (isPowerOn) {
            return;
        }

        var that = this;
        series([
            function (next) {
                that.sendAT1('ATE0', function (error, result) {
                    if (error) {
                        next(error, result);
                        return;
                    }
                    next(undefined, result[0]);
                });
            },
            this.shutIp.bind(this),
            function (next) {
                that.sendAT1('AT+CIPMUX=1', function (error, result) {
                    if (error) {
                        next(error, result);
                        return;
                    }
                    next(error, result[0]);
                });
            },
            function (next) {
                that.sendAT1('AT+GSMBUSY=1', function (error, result) {
                    if (error) {
                        next(error, result);
                        return;
                    }
                    next(error, result[0]);
                });
            }
        ], function (error, values) {
            if (error) {
                callback && callback(error, values);
                return;
            }
            if (values.every(function (v) {
                    return /OK/.test(v);
                })) {
                isPowerOn = true;
                callback && callback();
            } else {
                callback && callback(new Error('GPRS startup failed'), values);
            }
        });
    };

    commands.powerOff = function (callback) {
        if (!isPowerOn) {
            return;
        }
        this.sendAT1('AT+CPOWD=1', function (error, result) {
            if (error) {
                callback && callback(error, result);
                return;
            }
            isPowerOn = false;
            callback && callback(undefined, result[0]);
        });
    };

    commands.getSignalStrength = function (callback) {
        this.sendAT2('AT+CSQ', function (error, result) {
            if (error) {
                callback && callback(error, result);
                return;
            } else {
                callback && callback(undefined, result[0].split(':')[1].trim());
            }
        });
    };

    commands.getAttachStatus = function (callback) {
        this.sendAT2('AT+CGATT?', function (error, result) {
            if (error) {
                callback && callback(error, result);
                return;
            } else {
                callback && callback(undefined, result[0].split(':')[1].trim());
            }
        });
    };

    commands.getCellInfo = function (callback) {
        this.sendAT2('AT+CREG?', function (error, result) {
            if (error) {
                callback && callback(error, result);
                return;
            } else {
                callback && callback(undefined, result[0].split(':')[1].trim());
            }
        });
    };

    commands.getSimInfo = function (callback) {
        var that = this;
        series([
            function (next) {
                that.sendAT2('AT+CCID', function (error, result) {
                    if (error) {
                        next(error, result);
                        return;
                    }
                    console.log();
                    next(error, result[0]);
                });
            },
            function (next) {
                that.sendAT2('AT+CIMI', function (error, result) {
                    if (error) {
                        next(error, result);
                        return;
                    }
                    next(error, result[0]);
                });
            }
        ], function (error, values) {
            if (error) {
                callback && callback(error, values);
                return;
            }
            callback && callback(undefined, values[0], values[1]);
        });
    };

    // value = 0 to detach gprs service
    // value = 1 to attach gprs service
    commands.setGprsAttach = function (value, callback) {
        this.sendAT('AT+CGATT=' + value, function (error, result) {
            if (error) {
                callback && callback(error, result);
                return;
            }
            callback && callback(undefined, result[0]);
        });
    };

    commands.setApn = function (apn, user, passwd, callback) {
        this.sendAT1('AT+CSTT="' + apn + '","' + user + '","' + passwd + '"', function (error, result) {
            if (error) {
                callback && callback(error, result);
                return;
            }
            callback && callback(undefined, result[0]);
        });
    };

    commands.bringUpConnection = function (callback) {
        this.sendAT1('AT+CIICR', function (error, result) {
            if (error) {
                callback && callback(error, result);
                return;
            }
            callback && callback(undefined, result[0]);
        });
    };

    commands.getIp = function (callback) {
        this.sendAT1('AT+CIFSR', function (error, result) {
            if (error) {
                callback && callback(error, result);
                return;
            }
            callback && callback(undefined, result[0]);
        });
    };

    commands._waitAttach = function (callback) {
        var that = this;
        var times;
        _next();

        function _next() {
            that.getAttachStatus(function (error, status) {
                if (error || status === '0') {
                    if (times >= 3) {
                        callback && callback(new Error('GPRS attach timeout'));
                        return;
                    }
                    times++;
                    setTimeout(_next, 5000);
                } else {
                    callback && callback(undefined, 'OK');
                }
            });
        }
    };

    commands.init = function (apn, callback) {
        series([
            this._waitAttach.bind(this),
            this.setApn.bind(this, apn, '', ''),
            this.bringUpConnection.bind(this),
            this.getIp.bind(this)
        ], function (error, values) {
            if (error) {
                callback && callback(error, values);
                return;
            }
            callback && callback(undefined, values);
            cmdManager.emit('up', values[values.length - 1]);
        });
    };

    commands.autoInit = function (callback) {
        var APN = {
            46000: 'CMNET',
            46001: 'UNINET',
            46002: 'CMNET',
            46004: 'CMNET',
            46006: 'UNINET',
            46007: 'CMNET',
            46008: 'CMNET',
            46009: 'UNINET'
        };

        var that = this;
        this.sendAT2('AT+COPS?', function (error, res) {
            if (error) {
                callback && callback(error);
                return;
            }
            if (/UNICOM/.test(res[0])) {
                console.log('use CHN-UNICOM');
                that.init('UNINET', callback);
            } else if (/MOBILE/.test(res[0])) {
                console.log('use CHINA MOBILE');
                that.init('CMNET', callback);
            } else {
                that.sendAT2('AT+CIMI', function (error, res) {
                    if (error) {
                        callback && callback(error);
                        return;
                    }
                    var imsi = res[0].match(/[0-9]{14,}/g);
                    if (imsi) {
                        console.log('imsi is', imsi);
                        var apn = APN[imsi[0].slice(0, 5)];
                        if (apn) {
                            console.log('apn is', apn);
                            that.init(apn);
                            callback && callback();
                            return;
                        }
                    }
                    callback && callback(new Error('unknow ISP'));
                });
            }
        });
    };

    commands.shutIp = function (callback) {
        this.sendAT1('AT+CIPSHUT', function (error, result) {
            if (error) {
                callback && callback(error, result);
                return;
            }
            callback && callback(undefined, result[0]);
        });
    };

    commands.getConnections = function (callback) {
        this.sendAT3('AT+CIPSTATUS', 8, function (error, result) {
            if (error) {
                callback && callback(error, result);
                return;
            }
            callback && callback(undefined, result);
        });
    };
    // //////////////////
    // added by yang jun
    // //////////////////
    // commands.getAT = function (callback) {
    //     this.sendAT1('AT', function (error, result) {
    //         if (error) {
    //             callback && callback(error, result);
    //         } else {
    //             callback && callback(undefined, result[0]);
    //         }
    //     });
    //     // this.createAT1Cmd('AT');

    // };
    commands.createAT1Cmd = function (strCmd) {
        return function (callback) {
            commands.sendAT1(strCmd, function (error, result) {
                if (error) {
                    callback && callback(error, result);
                    return;
                }
                console.log(result);
                callback && callback(undefined, result);
            });
        }
    }
    commands.createAT2Cmd = function (strCmd) {
        return function (callback) {
            commands.sendAT2(strCmd, function (error, result) {
                if (error) {
                    callback && callback(error, result);
                    return;
                }
                callback && callback(undefined, result[0]);
            });
        }
    }
    commands.createAT3Cmd = function (strCmd) {
        return function (callback) {
            commands.sendAT3(strCmd, function (error, result) {
                if (error) {
                    callback && callback(error, result);
                    return;
                }
                callback && callback(undefined, result);
            });
        }
    }
    commands.getAT = commands.createAT1Cmd('AT');

    commands.getModuleVersion = commands.createAT2Cmd('AT+GMR');

    commands.sleep1s = function (callback) {
        setTimeout(function () {
            callback(undefined, 'sleep 1s');
        }, 1000);
    };
    commands.queryCENG = commands.createAT2Cmd('AT+CENG?');
    commands.enableCENG = commands.createAT1Cmd('AT+CENG=1,1');

    commands.setSAPBRMode = function (callback) {
        this.sendAT1('AT+SAPBR=3,1,"Contype","GPRS"', function (error, result) {
            if (error) {
                callback && callback(error, result);
            } else {
                callback && callback(undefined, result[0]);
            }
        });
    };
    commands.setSAPBRApn = function (callback) {
        this.sendAT1('AT+SAPBR=3,1,"APN","CMNET"', function (error, result) {
            if (error) {
                callback && callback(error, result);
            } else {
                callback && callback(undefined, result[0]);
            }
        });
    };
    commands.setSAPBRPdp = function (callback) {
        this.sendAT1('AT+SAPBR=1,1', function (error, result) {
            if (error) {
                callback && callback(error, result);
            } else {
                callback && callback(undefined, result[0]);
            }
        });
    };
    commands.getSAPBRIp = function (callback) {
        this.sendAT2('AT+SAPBR=2,1', function (error, result) {
            if (error) {
                callback && callback(error, result);
            } else {
                callback && callback(undefined, result[0]);
            }
        });
    };
    commands.getCLBSUrl = function (callback) {
        this.sendAT2('AT+CLBSCFG=0,3', function (error, result) {
            if (error) {
                callback && callback(error, result);
            } else {
                callback && callback(undefined, result[0]);
            }
        });
    };
    commands.getCLBS = function (callback) {
        this.sendAT2('AT+CLBS=1,1', function (error, result) {
            if (error) {
                callback && callback(error, result);
            } else {
                callback && callback(undefined, result);
            }
        });
    };
    commands.generateATCmd = function (cmd, cb) {
        return function (next) {
            debug('----->');
            cmd(function (err, data) {
                if (err) {
                    debug('[AT^RX]', err);
                    next(err, data);
                    return;
                }
                debug('[AT^RX]', data.toString().replace(/\r/g, '\\r').replace(/\n/g, '\\n'));

                cb && cb();

                next(undefined, data)

            });
        };
    };
    ////
    // commands.getCLBSCFG = function (callback) {
    //     this.sendAT2('AT+CLBSCFG=0,1', function (error, result) {
    //         if (error) {
    //             callback && callback(error, result);
    //         } else {
    //             callback && callback(undefined, result[0]);
    //         }
    //     });
    // };
    // commands.getCLBSCFG2 = function (callback) {
    //     this.sendAT2('AT+CLBSCFG=0,2', function (error, result) {
    //         if (error) {
    //             callback && callback(error, result);
    //         } else {
    //             callback && callback(undefined, result[0]);
    //         }
    //     });
    // };
    // commands.getCLBS = function (callback) {
    //     this.sendAT2('AT+CLBS=1,1', function (error, result) {
    //         if (error) {
    //             callback && callback(error, result);
    //         } else {
    //             callback && callback(undefined, result[0]);
    //         }
    //     });
    // };
    commands.getCENG = function (callback) {
        this.sendAT2('AT+CENG=?', function (error, result) {
            if (error) {
                callback && callback(error, result);
            } else {
                callback && callback(undefined, result[0]);
            }
        });
    };
    commands.setCENGon = function (callback) {
        this.sendAT1('AT+CENG=1,1', function (error, result) {
            if (error) {
                callback && callback(error, result);
            } else {
                callback && callback(undefined, result[0]);
            }
        });
    };
    commands.getCENGinfo = function (callback) {
        this.sendAT3('AT+CENG?', 8, function (error, result) {
            if (error) {
                callback && callback(error, result);
            } else {
                //debug(result);
                callback && callback(undefined, result);
            }
        });
    };
    return commands;
}

module.exports = createCommands;