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

## Repository structure

Repository is split into a few parts:
- `www/` directory, which contains the `npm` project. It acts as a Demo wallet for our Ownables.
- `ownables/` directory which contains the CosmWasm smart contracts that define each individual Ownable.

## Running the project

Basic compilation is done with `cargo wasm`.

To help with the rust -> wasm workflow, install [wasm-pack](https://rustwasm.github.io/wasm-pack/).

Project can be operated (including producing the builds) from the `www/` directory. See the `README` there for more info.

After following the packaging instructions, the resulting package should be importable into the Demo Wallet.





