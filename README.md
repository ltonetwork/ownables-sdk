# Ownable SDK

![ownables](https://user-images.githubusercontent.com/100821/177121121-a1c3dc8c-8108-4c07-9e15-b83ebfdf8f98.png)

Ownables are CosmWasm smart contracts that define ownership. In addition to running on a Cosmos blockchain, Ownables
can run directly in a wallet using the [LTO Network](https://ltonetwork.com) private layer.

The SDK contains examples and tools for developing Ownables.

## Quickstart

```
npm i
npm run rustup
npm run ownables:build-all
npm start
```

Once that is done, navigate to http://localhost:3000/ and you should see an empty wallet that is ready to import Ownable
packages.

In the wallet, click the ＋ icon at the bottom right. This will open an action menu in which we can choose to import a
new Ownable from a file and select a zipped package. The packages are located in the `ownables` folder.

Please read the [documentation](https://docs.ltonetwork.com/ownables/what-are-ownables) to learn more about Ownables.


# SDK Wallet

The wallet is a React application that can be used to test Ownables.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.
The page will reload if you make edits. You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode. See the section about
[running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder. It correctly bundles React in production mode and optimizes the
build for the best performance.

The build is minified and the filenames include the hashes. Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.


# Ownables

## Prerequisites

Rustup, so that you can set up the wasm32 target:
```
curl https://sh.rustup.rs -sSf | sh
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

rustup default stable
cargo version

rustup update stable

rustup target list --installed
rustup target add wasm32-unknown-unknown
```

Alternatively run `npm run rustup`.

## Build

```
npm run ownable:build --path=car
```

## Examples

### Car

A static Ownable, with a widget that shows an MP4 of a car.

### Potion

An Ownable with at state. The potion gets a random color when instantiated. You can
drink a portion of the potion, until it's empty.

### Robot

An Ownable to showcase Consumables. The robot will change as it consumes an upgrade.

The following Consumables are available:

#### Paint

A Consumable with a random color. Consume it to change the color of the robot.

#### Antenna

Adds an antenna to the robot. Only one antenna can be added.

#### Shield

Adds a shield to the robot. Only one shield can be added.

#### Speakers

Adds speakers to the robot. Only one set of speakers can be added.

