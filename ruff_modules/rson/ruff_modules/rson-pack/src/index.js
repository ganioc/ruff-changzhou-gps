var dataMap = {

    'object' : 0x01,
    'array' : 0x02,

    'number' : 0x10,

    'double' : 0x11,
    'float' : 0x12,
    'zero' : 0x13,

    'int32' : 0x20,
    'uint32' : 0x21,
    'int16' : 0x22,
    'uint16' : 0x23,
    'int8' : 0x24,
    'uint8' : 0x25,

    'strings255' : 0x30,
    //'strings65535' : 0x31,

    'function' : 0x40,

    'true' : 0x71,
    'false' : 0x72,
    'null' : 0x73,

    'ref' : 0x80 //高位为 1
};

var TYPE_LENGTH = 1;

var INDEX_COUNT_LENGTH = 1;
var INDEX_OFFSET_LENGTH = 2;

function Pack() {
    this._symbol = {};
    this._index = {};
}

Pack.prototype = {

    addSymbol : function ( item ) {
        var buf = this.pack( item );
        var k = buf.toString( 'hex' );
        if ( !this._symbol.hasOwnProperty( k ) ) {
            this._symbol[ k ] = {
                item : item,
                count : 0,
                size : 0,
                buf : buf
            };
        }
        this._symbol[ k ][ 'count' ]++;
        this._symbol[ k ][ 'size' ] += buf.length;
        return this;
    },

    addSymbolRecursive : function ( item ) {
        var type = typeof item;
        if ( item === null || type === 'boolean' ) {
            return this;
        }
        if ( item instanceof Array ) {
            for ( var i = 0, n = item.length; i < n; i++ ) {
                this.addSymbolRecursive( item[ i ] );
            }
            return this;
        }
        if ( type === 'object' ) {
            for ( var key in item ) {
                if ( !item.hasOwnProperty( key ) ) {
                    continue;
                }
                this.addSymbolRecursive( key );
                this.addSymbolRecursive( item[ key ] );
            }
            return this;
        }
        if ( type === 'function' ) {
            this.addSymbol( item );
            return;
        }
        if ( type === 'string' ) {
            this.addSymbol( item );
            return;
        }
        if ( type === 'number' ) {
            this.addSymbol( item );
            return this;
        }
        throw new Error( "unsupported type:" + type );

    },

    _filterIndex : function () {

        var totalSize = [];

        for ( var key in this._symbol ) {
            if ( this._symbol[ key ].count == 1 ) {
                continue;
            }
            totalSize.push( this._symbol[ key ] );
        }

        totalSize.sort( function ( a, b ) {
            return b.size - a.size;
        } );

        return totalSize.slice( 0, 127 );

    },

    _buildIndex : function () {

        this._index = {};

        var dataBuffer = [];
        var indexOffset;
        var dataOffset;
        var index = 0;

        var indexData = this._filterIndex();
        var indexBuffer = Buffer.allocUnsafe( indexData.length * INDEX_OFFSET_LENGTH + INDEX_COUNT_LENGTH ); // index

        indexBuffer.writeUInt8( indexData.length, 0 );
        indexOffset = INDEX_COUNT_LENGTH;

        dataOffset = INDEX_COUNT_LENGTH + indexData.length * INDEX_OFFSET_LENGTH;

        indexData.forEach( function ( item ) {
            this._index[ item.buf.toString( 'hex' ) ] = {
                _offset : dataOffset,
                index : index
            };

            indexBuffer.writeUInt16BE( dataOffset, indexOffset );
            indexOffset += INDEX_OFFSET_LENGTH;

            dataBuffer.push( item.buf );
            dataOffset += item.buf.length;

            index += 1;
        }, this );

        //console.log( this._index );

        return Buffer.concat( [ indexBuffer, Buffer.concat( dataBuffer ) ] );
    },


    packString : function ( item ) {
        var itemLength = Buffer.byteLength( item );
        if ( itemLength.length > 255 ) {
            throw new Error( "length overflow." );
        }
        var buf = Buffer.allocUnsafe( TYPE_LENGTH + 1 + itemLength );
        buf[ 0 ] = dataMap.strings255;
        buf.writeUInt8( itemLength, 1 );
        buf.write( item, 2 );
        return buf;
    },

    packFunction : function ( item ) {
        var code = item.toString();
        var itemLength = Buffer.byteLength( code );
        if ( itemLength.length > 255 ) {
            throw new Error( "length overflow." );
        }
        var buf = Buffer.allocUnsafe( TYPE_LENGTH + 1 + itemLength );
        buf[ 0 ] = dataMap.function;
        buf.writeUInt8( itemLength, 1 );
        buf.write( code, 2 );
        return buf;
    },

    packNumber : function ( item ) {
        var buf;
        if ( item === 0 ) {
            buf = Buffer.allocUnsafe( TYPE_LENGTH );
            buf[ 0 ] = dataMap.zero;
            return buf;
        }
        if ( item <= 4294967295 && item >= -2147483648 && (item % 1) == 0 ) {
            // int
            if ( item >= 0 ) {
                if ( item <= 255 ) {
                    buf = Buffer.allocUnsafe( TYPE_LENGTH + 1 );
                    buf[ 0 ] = dataMap.uint8;
                    buf.writeUInt8( item, 1 );
                    return buf;
                }
                if ( item <= 65535 ) {
                    buf = Buffer.allocUnsafe( TYPE_LENGTH + 2 );
                    buf[ 0 ] = dataMap.uint16;
                    buf.writeUInt16BE( item, 1 );
                    return buf;
                }
                if ( item <= 4294967295 ) {
                    buf = Buffer.allocUnsafe( TYPE_LENGTH + 4 );
                    buf[ 0 ] = dataMap.uint32;
                    buf.writeUInt32BE( item, 1 );
                    return buf;
                }
            } else {
                if ( -128 <= item && item <= 127 ) {
                    buf = Buffer.allocUnsafe( TYPE_LENGTH + 1 );
                    buf[ 0 ] = dataMap.int8;
                    buf.writeInt8( item, 1 );
                    return buf;
                }
                if ( -32768 <= item && item <= 32767 ) {
                    buf = Buffer.allocUnsafe( TYPE_LENGTH + 2 );
                    buf[ 0 ] = dataMap.int16;
                    buf.writeInt16BE( item, 1 );
                    return buf;
                }
                if ( -2147483648 <= item && item <= 2147483647 ) {
                    buf = Buffer.allocUnsafe( TYPE_LENGTH + 4 );
                    buf[ 0 ] = dataMap.int32;
                    buf.writeInt32BE( item, 1 );
                    return buf;
                }
            }
        } else {
            //double or float
            if (
                0 && item.toString().length <= 7 //
            ) {
                buf = Buffer.allocUnsafe( TYPE_LENGTH + 4 );
                buf[ 0 ] = dataMap.float;
                buf.writeFloatBE( item, 1 );
                return buf;
            } else {
                buf = Buffer.allocUnsafe( TYPE_LENGTH + 8 );
                buf[ 0 ] = dataMap.double;
                buf.writeDoubleBE( item, 1 );
                return buf;

            }
        }
    },

    packRef : function ( item ) {
        var buf = Buffer.allocUnsafe( TYPE_LENGTH );
        buf.writeUInt8( item | 0x80, 0 ); // 高位置 1
        return buf;
    },

    packOther : function ( item ) {
        var buf = Buffer.allocUnsafe( TYPE_LENGTH );
        if ( item === null ) {
            buf[ 0 ] = dataMap.null;
        } else if ( (typeof item) === 'boolean' ) {
            if ( item ) {
                buf[ 0 ] = dataMap.true;
            } else {
                buf[ 0 ] = dataMap.false;
            }
        } else {
            throw new Error( "unknown other type:" + item );
        }
        return buf;
    },

    packObject : function ( item ) {

        var buf = [];

        for ( var key in item ) {
            buf.push( this.pack( key ) );
            buf.push( this.pack( item[ key ] ) );
        }

        var finalBuffer = Buffer.concat( [ Buffer.allocUnsafe( TYPE_LENGTH + 2 ), Buffer.concat( buf ) ] );

        if ( finalBuffer.length > 65535 ) {
            throw new Error( "length overflow." );
        }

        finalBuffer.writeUInt8( 0x01, 0 );
        finalBuffer.writeUInt16BE( finalBuffer.length - 3, 1 );

        return finalBuffer;
    },

    packArray : function ( item ) {
        var buf = [];

        item.forEach( function ( i ) {
            buf.push( this.pack( i ) );
        }, this );

        var finalBuffer = Buffer.concat( [ Buffer.allocUnsafe( TYPE_LENGTH + 2 + 2 ), Buffer.concat( buf ) ] );

        if ( finalBuffer.length > 65535 ) {
            throw new Error( "length overflow." );
        }

        finalBuffer.writeUInt8( 0x02, 0 );
        finalBuffer.writeUInt16BE( finalBuffer.length - 3, 1 );
        finalBuffer.writeUInt16BE( item.length, 3 );

        return finalBuffer;
    },

    pack : function ( item ) {
        var buf;
        var index;
        var type = typeof item;
        if ( item === null || type === 'boolean' ) {
            return this.packOther( item );
        } else if ( type === 'string' ) {
            buf = this.packString( item );
        } else if ( type === 'number' ) {
            buf = this.packNumber( item );
        } else if ( item instanceof Array ) {
            buf = this.packArray( item );
        } else if ( type === 'object' ) {
            buf = this.packObject( item );
        } else if ( type === 'function' ) {
            buf = this.packFunction( item );
        } else {
            throw new Error( "unsupported type:" + type );
        }

        if ( this._index ) {
            index = this._getIndex( buf );
            if ( index !== -1 ) {
                return this.packRef( index );
            }
        }
        return buf;
    },

    _getIndex : function ( buf ) {
        if ( this._index.hasOwnProperty( buf.toString( 'hex' ) ) ) {
            return this._index[ buf.toString( 'hex' ) ].index;
        }
        return -1;
    },

    getBuffer : function ( item ) {

        var indexBuffer = this._buildIndex();
        var itemBuffer = this.pack( item );
        var finalBuffer = Buffer.concat( [
            Buffer.from( 'RSON' ),
            Buffer.from( [ 0x01, 0x01 ] ),
            Buffer.allocUnsafe( 4 ),
            indexBuffer,
            Buffer.allocUnsafe( 4 ),
            itemBuffer ] );

        finalBuffer.writeUInt32BE( indexBuffer.length, 6 );
        finalBuffer.writeUInt32BE( itemBuffer.length, 6 + 4 + indexBuffer.length );

        return finalBuffer;
    }
};

exports.binify = function ( item ) {
    return new Pack().addSymbolRecursive( item ).getBuffer( item );
};

exports.Pack = Pack;
