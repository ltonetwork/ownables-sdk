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

Project can be operated from the `www/` directory.

To start the Demo Wallet, run `npm run start`.
At this point you should be able to open [http://localhost:8080](http://localhost:8080) in your browser and be able to import, issue, and interact with Ownables.

In order to import an Ownable, we will first need to build and package it.

Building all Ownables in the `ownables/` directory is done with `npm run build-ownables`.

Building a specific Ownable can be done by providing a `--path`, e.g.:
`npm run build-ownable --path=potion`.

With the build in place, only thing left is to package the Ownable. It should contain:
- The `.wasm` binary found under `/pkg/ownable_bg.wasm`
- The `.js` glue code found under `/pkg/ownable.js`
- The `.html` template which should be under `/assets`
- Any media files needed to for the `.html` file sources

After compressing (zipping) the aforementioned files, the package should be importable into the Demo Wallet.





