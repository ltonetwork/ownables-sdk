# Ownable demo

![ownables](https://user-images.githubusercontent.com/100821/177121121-a1c3dc8c-8108-4c07-9e15-b83ebfdf8f98.png)

Ownables are CosmWasm smart contracts that define ownership. In addition to running on a cosmos blockchain, ownables
can run directly in a wallet using the [LTO Network](https://ltonetwork.com) private layer.

This repo defines a demo meant to display the basic functionality of an Ownable nft.

## Prerequisites

Go version of `v1.18+`.

Rustup, so that you can set up the wasm32 target:
```
rustup default stable
cargo version

rustup update stable

rustup target list --installed
rustup target add wasm32-unknown-unknown
```

wasmd which can be installed with:
```console
git clone https://github.com/CosmWasm/wasmd.git
cd wasmd
# If you are updating wasmd, first update your local repository by fetching the remote tags available
git fetch --tags
# replace the v0.27.0 with the most stable version on https://github.com/CosmWasm/wasmd/releases
git checkout v0.27.0
make install

# verify the installation
wasmd version
```

wasmd GO CLI or CosmJS Node Console are used to interact with the contracts.

## Running the project

Basic compilation is done with `cargo wasm`.

Optionally, JSON schemas can be generated with `cargo schema` and are helpful for interaction with the wasmd Go CLI.

With the `wasm` file in place, initialize and start the web:
```
cd www
npm i
npm run start
```

At this point you should be able to open [http://localhost:8080](http://localhost:8080) in your browser and see the demo.

