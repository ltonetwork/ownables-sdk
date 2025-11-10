import { importer } from "ipfs-unixfs-importer";
import { BlackHoleBlockstore } from "blockstore-core";

export default async function calculateCid(files: File[]): Promise<string> {
  // Filter out chain.json and timestamp.txt to match oBuilder behavior
  // chain.json is separate metadata, timestamp.txt changes each time
  const filteredFiles = files.filter(
    (file) => file.name !== 'chain.json' && file.name !== 'timestamp.txt'
  );

  const source = await Promise.all(
    filteredFiles.map(async (file) => ({
      path: `./package/${file.name}`,
      content: new Uint8Array(await file.arrayBuffer()),
    }))
  );

  const blockstore = new BlackHoleBlockstore();

  for await (const entry of importer(source, blockstore)) {
    if (entry.path === "package" && entry.unixfs?.type === "directory")
      return entry.cid.toString();
  }

  throw new Error(
    "Failed to calculate directory CID: importer did not find a directory entry in the input files"
  );
}
