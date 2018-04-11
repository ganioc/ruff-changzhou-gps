/**
 * Created by sunjinhu on 21/12/2016.
 */

function KeyNotFoundError( message ) {
    this.name = 'KeyNotFoundError';
    this.message = message || 'Default Message';
    this.stack = (new Error()).stack;
}

KeyNotFoundError.prototype = Object.create(Error.prototype);
KeyNotFoundError.prototype.constructor = KeyNotFoundError;

function Rson( b, _o ) {
    // console.log('construct Rson');
    this._b = b;
    this._i = b.slice( 6 + 4 );
    if ( _o ) {
        this._o = _o;
    } else {
        this.reset();
    }
}

Rson.prototype = {

    reset : function () {
        // console.log('reset');
        this._o = this._b.readUInt32BE( 6 + 0 ) + 4 + 4 + 6;
    },

    k : function ( k ) {
        var self = this;
        if ( !(k instanceof Array) ) {
            k = [ k ];
        }
        for ( var i = 0, l = k.length; i < l; i++ ) {
            // console.log( k[ i ] );
            self = self._k( k[ i ] );
        }
        return self;
    },

    _k : function ( k ) {
        var o_max;
        var o = this._o;
        var pl; // place length
        var _k = -1; // current key

        var type = this._b.readUInt8( o );
        switch ( type ) {
            case 0x01:
            case 0x02:
                o_max = _getPlaceLen( this._b, o ) + o;
                if ( type == 0x01 ) {
                    o = 1 + 2 + o;
                } else {
                    o = 1 + 4 + o;
                }
                for ( ; ; ) {
                    if ( o == o_max ) {
                        break;
                    } else if ( o > o_max ) {
                        throw new Error( 'o > o_max' );
                    }
                    if ( type == 0x01 ) {
                        _k = unpack( this._b, o, this._i );
                        pl = _getPlaceLen( this._b, o );
                        o += pl;
                    } else {
                        _k++;
                    }
                    if ( k == _k ) {
                        // console.log( 'k(ey):' + k + ' found, at offset:' + o + '.' );
                        return new Rson( this._b, o );
                        // this._o = o;
                        // return this;
                    }
                    pl = _getPlaceLen( this._b, o );
                    o += pl;
                }
                var error = new KeyNotFoundError( 'k(ey):' + k + ' not found.' );
                //console.log('error', error);
                throw error;
            default:
                throw new Error( 'k(ey) method only support Array or Object.' );
        }
    },

    hk : function ( k ) {
        try {
            this.k( k );
            return true;
        } catch ( e ) {
            if ( e instanceof KeyNotFoundError ) {
                return false;
            }
            console.log('e', e);
            throw e;
        }
    },

    l : function () {
        var type = this._b.readUInt8( this._o );
        switch ( type ) {
            case 0x02:
                return this._b.readUInt16BE( 1 + 2 + this._o );
            default:
                throw new Error( 'l(ength) method only support Array.' );
        }
    },

    v : function () {
        return unpack( this._b, this._o, this._i );
    },

    ks : function () {
        var o_max;
        var o = this._o;
        var pl; // place length
        var _k = -1; // current key
        var r = [];

        var type = this._b.readUInt8( o );
        switch ( type ) {
            case 0x01:
                o_max = _getPlaceLen( this._b, o ) + o;
                o = 1 + 2 + o;
                for ( ; ; ) {
                    if ( o == o_max ) {
                        break;
                    } else if ( o > o_max ) {
                        throw new Error( 'o > o_max' );
                    }

                    _k = unpack( this._b, o, this._i );
                    pl = _getPlaceLen( this._b, o );
                    o += pl;
                    r.push( _k );

                    pl = _getPlaceLen( this._b, o );
                    o += pl;
                }
                return r;
            default:
                throw new Error( 'k(ey)s method only support Object.' );
        }
    }
};

function _getPlaceLen( buf, offset ) {
    if ( !offset ) {
        offset = 0;
    }
    var type = buf.readUInt8( offset );
    switch ( type ) {
        case 0x01:
            return buf.readUInt16BE( 1 + offset ) + 3; // "+1+2" for dataType + totalLength
        case 0x02:
            return buf.readUInt16BE( 1 + offset ) + 3; // "+1+2" for dataType + totalLength
        case 0x10:
        case 0x12:
        case 0x20:
        case 0x21:
            return 4 + 1;
        case 0x13: // zero
            return 1;
        case 0x22:
        case 0x23:
            return 2 + 1;
        case 0x24:
        case 0x25:
            return 1 + 1;
        case 0x11:
            return 8 + 1;
        case 0x30:
            return buf.readUInt8( 1 + offset ) + 2; // for dataType + totalLength (1B)
        case 0x31:
            return buf.readUInt16BE( 1 + offset ) + 3; // for dataType + totalLength (2B)
        case 0x40:
            return buf.readUInt8( 1 + offset ) + 2; // for dataType + totalLength (1B)
        case 0x41:
            return buf.readUInt16BE( 1 + offset ) + 3; // for dataType + totalLength (2B)
        case 0x71:
        case 0x72:
        case 0x73:
            return 1;
        default:
            if ( type >>> 7 == 1 ) {
                return 1;
            }
            throw new Error( 'getPlaceLen unknown type:' + type );
    }
}

function unpack( buf, offset, iBuf ) {
    if ( !offset ) {
        offset = 0;
    }
    var type = buf.readUInt8( offset );
    switch ( type ) {
        case 0x01:
            return unpackObj( buf, offset, iBuf );
        case 0x02:
            return unpackArray( buf, offset, iBuf );
        case 0x10:
        case 0x11:
        case 0x12:
        case 0x13:
        case 0x20:
        case 0x21:
        case 0x22:
        case 0x23:
        case 0x24:
        case 0x25:
            return unpackNumber( buf, offset );
        case 0x30:
        case 0x31:
            return unpackString( buf, offset );
        case 0x40:
        case 0x41:
            return unpackFunction( buf, offset );
        case 0x71:
        case 0x72:
        case 0x73:
            return unpackOther( buf, offset );
        default:
            if ( type >>> 7 == 1 ) {
                return unpackRef( buf, offset, iBuf );
            }
            throw new Error( 'unpack unknown type:' + type );
    }
}

function unpackRef( buf, offset, iBuf ) {
    if ( !iBuf ) {
        throw new Error( 'dictionary not set.' );
    }
    if ( !offset ) {
        offset = 0;
    }
    var index = buf.readUInt8( offset ) & 0x7F;
    var o = iBuf.readUInt16BE( index * 2 + 1 ); // "+ 1" for indexCount
    return unpack( iBuf, o );
}

function unpackArray( buf, offset, iBuf ) {
    if ( !offset ) {
        offset = 0;
    }
    var type = buf.readUInt8( offset );
    switch ( type ) {
        case 0x02:
            var o_max = _getPlaceLen( buf, offset ) + offset;
            var o = 5 + offset;
            var r = [];
            var pl; // place length
            var v; // val
            for ( ; ; ) {
                if ( o == o_max ) {
                    break;
                } else if ( o > o_max ) {
                    throw new Error( 'o > o_max' );
                }
                pl = _getPlaceLen( buf, o );
                v = unpack( buf, o, iBuf );
                o += pl;

                r.push( v );
            }
            return r;
            break;
        default:
            throw new Error( 'Unknown Array type:' + type );
    }
}

function unpackObj( buf, offset, iBuf ) {
    if ( !offset ) {
        offset = 0;
    }
    var type = buf.readUInt8( offset );
    switch ( type ) {
        case 0x01:
            var o_max = _getPlaceLen( buf, offset ) + offset;
            var o = 3 + offset; // start read offset
            var r = {};
            var pl; // place length
            var k; // key
            var v; // val

            for ( ; ; ) {
                if ( o == o_max ) {
                    break;
                } else if ( o > o_max ) {
                    throw new Error( 'o > o_max' );
                }
                pl = _getPlaceLen( buf, o );
                k = unpack( buf, o, iBuf );
                o += pl;

                pl = _getPlaceLen( buf, o );
                v = unpack( buf, o, iBuf );
                o += pl;

                r[ k ] = v;
            }
            return r;
            break;
        default:
            throw new Error( 'Unknown object type:' + type );
    }
}

function unpackNumber( buf, offset ) {
    if ( !offset ) {
        offset = 0;
    }
    var type = buf.readUInt8( offset );
    switch ( type ) {
        case 0x10:
        case 0x12:
            return buf.readFloatBE( 1 + offset );
            break;
        case 0x11:
            // console.log('read double');
            return buf.readDoubleBE( 1 + offset );
            break;
        case 0x13:
            return 0;
        case 0x20:
            return buf.readInt32BE( 1 + offset );
        case 0x21:
            return buf.readUInt32BE( 1 + offset );
        case 0x22:
            return buf.readInt16BE( 1 + offset );
        case 0x23:
            return buf.readUInt16BE( 1 + offset );
        case 0x24:
            return buf.readInt8( 1 + offset );
        case 0x25:
            return buf.readUInt8( 1 + offset );
            break;
        default:
            throw new Error( 'Unknown number type:' + type );
    }
}

function unpackString( buf, offset ) {
    if ( !offset ) {
        offset = 0;
    }
    var type = buf.readUInt8( offset );
    switch ( type ) {
        case 0x30:
            var l = buf.readUInt8( 1 + offset );
            // return buf.slice(2 + offset, 2 + offset + l).toString();
            return buf.toString( 'utf8', 2 + offset, 2 + offset + l );
        case 0x31:
            var l = buf.readUInt16BE( 1 + offset );
            // return buf.slice(3 + offset, 3 + offset + l).toString();
            return buf.toString( 'utf8', 3 + offset, 3 + offset + l );
        default:
            throw new Error( 'Unknown string type:' + type );
    }
}

var evalFunction = function ( functionString ) {
    var value = null;
    eval( 'value = ' + functionString );
    return value;
};

function unpackFunction( buf, offset ) {
    if ( !offset ) {
        offset = 0;
    }
    var type = buf.readUInt8( offset );
    switch ( type ) {
        case 0x40:
            var l = buf.readUInt8( 1 + offset );
            return evalFunction( buf.toString( 'utf8', 2 + offset, 2 + offset + l ) );
        case 0x41:
            var l = buf.readUInt16BE( 1 + offset );
            return evalFunction( buf.toString( 'utf8', 3 + offset, 3 + offset + l ) );
        default:
            throw new Error( 'Unknown string type:' + type );
    }
}

function unpackOther( buf, offset ) {
    if ( !offset ) {
        offset = 0;
    }
    var type = buf.readUInt8( offset );
    switch ( type ) {
        case 0x71:
            return true;
            break;
        case 0x72:
            return false;
            break;
        case 0x73:
            return null;
            break;
        default:
            throw new Error( 'Unknown other type:' + type );
    }
}

exports.rson = function ( b ) {
    return new Rson( b );
};

exports.parse = function ( b ) {
    return new Rson( b ).v();
};

exports.unpack = unpack;
