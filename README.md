# smart-contract-experiments

Experiments for WASM based contracts on the private chain

# wasm game of life:
The wasm-game-of-life folder is based on the wasmpack template. It creates a js library that reads .wasm files based on the rust code written in rust. 

To get the example website running do this in the root dir
`wasm-pack build`

then `cd` to the www dir and run:
`npm start`

### prerequisites:
- npm installed
- [Rust installed](https://doc.rust-lang.org/cargo/getting-started/installation.html)
- [wasm-pack installed](https://rustwasm.github.io/wasm-pack/installer/) mac m1 requires installing from source: `cargo install wasm-pack`

### Mac M1 workarounds
If `npm start` doesnt work try setting this first"
```export NODE_OPTIONS=--openssl-legacy-provider```


### Sources
[google docs file](https://docs.google.com/document/d/1Xl2XafnHi23MNX3fybREtzYsC7czphoEg3EZsccwJgY/edit?usp=sharing)


### applying eddits
If you want to make changes to the current wasm this is the way to go:
1. edit the `src/lib.rs` code 
2. run `wasm-pack build` from within the wasm-game-of-life folder
