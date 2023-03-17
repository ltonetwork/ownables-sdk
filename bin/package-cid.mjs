import { importer } from 'ipfs-unixfs-importer';
import { BaseBlockstore } from 'blockstore-core/base';
import { argv, exit } from 'node:process';
import JSZip from "jszip";
import * as fs from "fs/promises";

if (argv.length < 3) {
  console.error("No package zip specified");
  exit(1);
}

const zipPath = argv[2];

const blockstore = new class extends BaseBlockstore {
  async put (key, val, options) {
  }
  async has (key, options) {
    return false;
  }
};

const zip = await fs.readFile(zipPath)
  .then(zipFile => JSZip.loadAsync(zipFile))
  .catch(err => {
    console.error(err.message || err);
    exit(1);
  });

const source = await Promise.all(Array.from(Object.entries(zip.files))
  .filter(([filename]) => !filename.startsWith('.') && !filename.includes('MAC'))
  .map(async ([filename, file]) => ({
    path: `./${filename}`,
    content: await file.async("nodebuffer"),
  }))
);

for await (const entry of importer(source, blockstore)) {
  console.info(entry.cid.toString(), entry.path);
}
