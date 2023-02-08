# Demo Wallet app

To start the Demo Wallet, run `npm run start`.
At this point you should be able to open [http://localhost:8080](http://localhost:8080) in your browser and be able to
import, issue, and interact with Ownables.

In order to import an Ownable, we will first need to build and package it.

Building all Ownables in the `ownables/` directory is done with `npm run build-ownables`.

In case you are using mac, some prerequisites are needed for the build:
- install `clang` and `llvm` and set the suggested path variables
```
brew install clang
brew install llvm
```
- prepend the following to the `build-ownable` npm script in *package.json*:
```
CC=/usr/local/opt/llvm/bin/clang AR=/usr/local/opt/llvm/bin/llvm-ar
```
so that the full entry looks like the following:
```
"build-ownable": "CC=/usr/local/opt/llvm/bin/clang AR=/usr/local/opt/llvm/bin/llvm-ar wasm-pack build --target web ../ownables/$npm_config_path/ && rm ../ownables/$npm_config_path/assets/$npm_config_path.zip && zip -r -j ../ownables/$npm_config_path/assets/$npm_config_path.zip ../ownables/$npm_config_path/assets/ ../ownables/$npm_config_path/pkg/*.js ../ownables/$npm_config_path/pkg/*.wasm ",
```

Building a specific Ownable can be done by providing a `--path`, e.g.:
`npm run build-ownable --path=potion`.

Both aforementioned ways will produce a `.zip` file under `/assets` directory.

## License

Licensed under
* MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)
