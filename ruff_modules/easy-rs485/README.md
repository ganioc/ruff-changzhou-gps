[![Build Status](https://travis-ci.org/ruff-drivers/easy-rs485.svg)](https://travis-ci.org/ruff-drivers/easy-rs485)

# RS485 interface wrapper

A simple driver to wrap rs485 interface.

## Supported Engines

* Ruff Lite: >=0.8.0 <1.0.0

## Supported Models

- [easy-rs485](https://rap.ruff.io/devices/easy-rs485)

## Installing

Execute following command and enter a **supported model** to install.

```sh
# Please replace `<device-id>` with a proper ID.
# And this will be what you are going to query while `$('#<device-id>')`.
rap device add <device-id>

# Then enter a supported model, for example:
# ? model: easy-rs485
# ? value (number) for argument "baudRate": (9600)
# ? value (number) for argument "stopBits": (1)
# ? value (number) for argument "dataBits": (8)
# ? value (string) for argument "parity": (none)
# ? value (number) for argument "rs485TxTimeout": (1)
# ? value (number) for argument "rs485RxTimeout": (-1)
```

## Usage

Here is the basic usage of this driver.

```js
$('#<device-id>').write(data, callback);
$('#<device-id>').on('data', function (data) {
    console.log('data is ', data);
});
```

## API References

### Methods

#### `write(data[, callback])`

Write data to the rs485 bus.

- **callback:** No argument other than a possible error is given to the completion callback.

## Events

#### `data`

Emitted when data is received from rs485 bus.

#### `error`

Emitted when error happens.

## Contributing

Contributions to this project are warmly welcome. But before you open a pull request, please make sure your changes are passing code linting and tests.

You will need the latest [Ruff SDK](https://ruff.io/zh-cn/docs/download.html) to install rap dependencies and then to run tests.

### Installing Dependencies

```sh
npm install
rap install
```

### Running Tests

```sh
npm test
```

## License

The MIT License (MIT)

Copyright (c) 2016 Nanchao Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
