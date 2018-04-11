# RSON

RSON is short for **Ruff jSON**, which is aimed at reducing memory footprint.

## 要求

A JSON value MUST be an object, array, number, or string, or one of
the following three literal names: false null true

## 算法

压缩重复数据，生成 dictionary，将 dictionary 打包到文件开始的部分，使用一个字节的元数据(以下采用 data 来代替)来引用

dictionary: indexcount(1byte) index1 (2byte offset) index2 (2byte offset) data data

object array strings number 均可能是 引用类型

## data 格式

- strings: datatype length(1byte~2byte) rawdata
- number: datatype rawdata
- object: datatype totalLength(2byte) keydata valdata
- array: datatype totalLength(2byte) arrayLength(2byte) valdata valdata
- true false null: datatype (1 byte )
- ref: datatype (1byte，最高位代表是引用类型，其他七位为 index)

## 限制

- 最大字符串长度 byteLength < 255
- buffer 格式
- dictionaryLength(4Byte) dictionary allDataLength (4Byte)  allData

## 函数缩写

- k = key
- v = value
- ks = keys
- l = length
