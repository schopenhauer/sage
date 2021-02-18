# sage

Smart meter reader designed to read _telegrams_ from [Sagemcom](https://www.sagemcom.com) smart meters. These are the new smart electricity and gas meters currently being installed in the Grand-Duchy of Luxembourg in order to comply with [EU law](https://ec.europa.eu/energy/en/topics/market-and-consumers/smart-grids-and-meters) by 2020.

According to [Enovos](https://www.enovos.lu/enovos_en/individuals/electricity/Smart-meter), a smart meter incorporates advanced technologies that enable the precise measurement and recording of your energy consumption and production (if you have a photovoltaic installation for example). Thanks to this connection, your smart meter will enable your network operator to monitor the level of consumption and therefore to better control the flow of electricity in order to guarantee an operational network at all times.

## Prerequisites

* [Sagemcom](https://www.sagemcom.com/) T210-D smart meter
* [P1 smart meter cable](https://www.aliexpress.com/item/FTDI-USB-Cable-for-P1-Port-Dutch-Slimme-Meter-Kamstrup-162-382-EN351-Landis-Gyr-E350/32945225256.html) (Dutch: _slimme meter kabel_), i.e. RJ-11 (phone connector) to USB
* P1 decryption key obtained from [Creos](mailto:customer.care@creos.net), [Diekirch](smarty@diekirch.lu), [Ettelbrück](sive@ettelbruck.lu), [Electris](smarty@electris.lu) (Mersch) or [Südstroum](backoffice@sudstroum.lu) (Esch-sur-Alzette)
* Node.js (e.g. running on Raspberry Pi)
* MongoDB instance (optional)

## Usage

### Backend

Please set the `KEY` environment variable with your P1 decryption key. Optionally, set the `DATABASE_URL` environment variable to store the received telegrams on your MongoDB instance.

Then, run the app:

```sh
node app.js
```

How to detect which serial ports are connected?

```sh
dmesg | grep tty
```

Use socat to make the serial port available as `/dev/ttyVUSB0` on the local network on port 2001.

```sh
socat -d -d /dev/ttyUSB0,raw,echo=0 tcp-listen:2001,reuseaddr # local pc
socat -d -d PTY,raw,echo=0,link=/dev/ttyVUSB0 tcp:192.168.1.123:2001 # remote pc
```

### Frontend

Simple, run the app:

```sh
node web.js
```

<img src="https://github.com/schopenhauer/sage/raw/master/docs/daily_power_consumption.png" width="650">


## Data structure

### Raw data

The smart meter sends data (647 bytes) with the below structure every 10 seconds.

<img src="https://github.com/schopenhauer/sage/raw/master/docs/datagram.png">

* Start byte: `0xDB` (1 byte)
* System title length: `0x08` (1 byte)
* System title: "SAGgp" + `0x0067C8` (8 bytes)
* Separator byte: `0x82` (1 byte)
* Length of subsequent bytes: `0x027A` (2 bytes)
* Separator byte: `0x30` (1 byte)
* Frame counter: `0x000069F1` (4 bytes)
* Cipher text: `...` (617 bytes)
* GCM tag: `0x25D438E5B41F6EECA46ED60C` (12 bytes)

The data is encrypted using [AES-128-GCM](http://csrc.nist.gov/publications/nistpubs/800-38D/SP-800-38D.pdf) (Galois Counter Mode) with the below parameters:

* Encryption key = `KEY` environment variable
* Initialisation vector (IV) = `System title` + `Frame counter`
* Additional authentication data = `AAD` environment variable, or `3000112233445566778899AABBCCDDEEFF` for Luxembourg meters
* Authentication tag = `GCM tag` (see above)

### Telegram structure

Please refer to the documentation of OBIS codes [here](https://github.com/schopenhauer/sage/raw/master/docs/OBIS-codes.xlsx).

## Tested equipment

You need to connect your computer/Raspberry Pi to the _Customer Port_ (Port P1) using the P1 smart meter cable. The technical specifications are available [here](https://www.electris.lu/files/Dokumente_und_Formulare/P1PortSpecification.pdf), [here](http://www.sagemcom.com/smart-city/smart-meter/electricity/smart-metering-multi-energy/t210-d-multi-energies-tri-phase-direct-connexion/) and [here](https://www.sibelga.be/en/connections-and-meters/smart-ready-meters/types-of-smart-ready-meters/detail/t210d).

<img src="https://github.com/schopenhauer/sage/raw/master/docs/sagemcom.png">

## Credits

The work was inspired by Michel Weimerskirch's [smarty_dsmr_proxy](https://github.com/mweimerskirch/smarty_dsmr_proxy), ndokter's [dsmr_parser](https://github.com/ndokter/dsmr_parser) and Robert Klep's [dsmr-parser](https://github.com/robertklep/node-dsmr-parser).
