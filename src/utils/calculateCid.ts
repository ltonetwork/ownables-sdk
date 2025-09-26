import {importer} from "ipfs-unixfs-importer";
import { BlackHoleBlockstore } from "blockstore-core"

export default async function calculateCid(files: File[]): Promise<string> {
  const source = await Promise.all(
    files.map(async file => ({
      path: `./package/${file.name}`,
      content: new Uint8Array(await file.arrayBuffer()),
    }))
  );

  const blockstore = new BlackHoleBlockstore();

  for await (const entry of importer(source, blockstore)) {
    if (entry.path === 'package' && entry.unixfs?.type === 'directory') return entry.cid.toString();
  }

  throw new Error("Failed to calculate directory CID: importer did not find a directory entry in the input files");
}
