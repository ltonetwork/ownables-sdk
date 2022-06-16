# Ownable demo

Potion demo meant to display the basic functionality of an Ownable nft.

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
```
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

JSON schemas can be generated with `cargo schema` and are helpful for interaction with the wasmd Go CLI.


