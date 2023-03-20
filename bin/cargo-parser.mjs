import toml from 'toml';
import { argv, exit } from 'node:process';
import { readFile, writeFileSync, createWriteStream } from "fs";

if (argv.length < 3) {
  console.error("No package path specified");
  exit(1);
}

const path = argv[2];
let tomlFile = {};
readFile(`ownables/${path}/Cargo.toml`, "utf8", (err, data) => {
  if (err) {
    console.error("No package path specified");
    exit(1);
  }
  const cargoMetadata = toml.parse(data).package;
  tomlFile.name = cargoMetadata.name;
  tomlFile.description = cargoMetadata.description;
  tomlFile.version = cargoMetadata.version;
  tomlFile.authors = cargoMetadata.authors;

  writeFileSync(`./ownables/${path}/cargo.json`, JSON.stringify(tomlFile));
})

