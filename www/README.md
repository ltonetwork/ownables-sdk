# Demo Wallet app

To start the Demo Wallet, run `npm run start`.
At this point you should be able to open [http://localhost:8080](http://localhost:8080) in your browser and be able to
import, issue, and interact with Ownables.

In order to import an Ownable, we will first need to build and package it.

Building all Ownables in the `ownables/` directory is done with `npm run build-ownables`.

Building a specific Ownable can be done by providing a `--path`, e.g.:
`npm run build-ownable --path=potion`.

Both aforementioned ways will produce a `.zip` file under `/assets` directory.

## License

Licensed under
* MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)
