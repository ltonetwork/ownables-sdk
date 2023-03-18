import LocalStorageService from "./LocalStorage.service";
import {TypedPackage, TypedPackageStub} from "../interfaces/TypedPackage";
import JSZip from "jszip";
import mime from "mime/lite";
import IDBService from "./IDB.service";
import {importer} from "ipfs-unixfs-importer";
import {BaseBlockstore} from "blockstore-core/base";

const exampleUrl = process.env.REACT_APP_OWNABLE_EXAMPLES_URL;
const examples: TypedPackageStub[] = exampleUrl ? [
  { name: 'Antenna', key: 'antenna', stub: true },
  { name: 'Armor', key: 'armor', stub: true },
  { name: 'Car', key: 'car', stub: true },
  { name: 'Paint', key: 'paint', stub: true },
  { name: 'Potion', key: 'potion', stub: true },
  { name: 'Robot', key: 'robot', stub: true },
  { name: 'Speakers', key: 'speakers', stub: true },
] : [];
export const HAS_EXAMPLES = exampleUrl !== '';

export default class PackageService {
  static list(): Array<TypedPackage|TypedPackageStub> {
    const local = (LocalStorageService.get('packages') || []) as TypedPackage[];
    for (const pkg of local) {
      pkg.versions = pkg.versions.map(({date, cid}) => ({date: new Date(date), cid}));
    }

    const set = new Map([...examples, ...local].map(pkg => [pkg.key, pkg])).values();

    return Array.from(set)
      .sort((a, b) => a.name >= b.name ? 1 : -1);
  }

  static info(keyOrCid: string): TypedPackage {
    const packages = (LocalStorageService.get('packages') || []) as TypedPackage[];
    const found = packages.find(pkg => pkg.key === keyOrCid || pkg.cid === keyOrCid);

    if (!found) throw new Error(`Package not found: ${keyOrCid}`);
    return found;
  }

  private static storePackageInfo(name: string, key: string, cid: string): TypedPackage {
    const packages = (LocalStorageService.get('packages') || []) as TypedPackage[];
    let pkg = packages.find(pkg => pkg.key === key);

    if (!pkg) {
      pkg = {name, key, cid, versions: []};
      packages.push(pkg);
    } else {
      pkg.cid = cid;
    }

    pkg.versions.push({date: new Date(), cid});
    LocalStorageService.set('packages', packages);

    return pkg;
  }

  private static async extractAssets(zipFile: File): Promise<File[]> {
    const zip = await JSZip.loadAsync(zipFile);

    return await Promise.all(Array.from(Object.entries(zip.files))
      .filter(([filename]) => !filename.startsWith('.') && !filename.includes('MAC'))
      .map(async ([filename, file]) => {
        const blob = await file.async("blob");
        const ext = filename.substring(filename.indexOf('.'));
        const type = mime.getType(ext) || 'application/octet-stream';

        return new File([blob], filename, { type });
      })
    );
  }

  private static async calculateCid(files: File[]): Promise<string> {
    const source = await Promise.all(
      files.map(async file => ({
        path: `./${file.name}`,
        content: new Uint8Array(await file.arrayBuffer()),
      }))
    );

    const blockstore = new class extends BaseBlockstore {
      async put () { }
      async has () { return false; }
    }();

    for await (const entry of importer(source, blockstore)) {
      if (entry.path === '' && entry.unixfs?.type === 'directory') return entry.cid.toString();
    }

    throw new Error("Importer did not return the directory CID");
  }

  private static async storeAssets(cid: string, files: File[]): Promise<void> {
    if (IDBService.exists(`package:${cid}`)) return;

    await IDBService.create(`package:${cid}`);
    await IDBService.setAll(
      `package:${cid}`,
      Object.fromEntries(files.map(file => [file.name, file])),
    );
  }

  static async import(zipFile: File): Promise<TypedPackage> {
    const key = zipFile.name.replace(/\.\w+$/, '');
    const name = key
      .replace(/[-_]+/, ' ')
      .replace(/\b\w/, c => c.toUpperCase());

    const files = await this.extractAssets(zipFile);
    const cid = await this.calculateCid(files);
    await this.storeAssets(cid, files);

    return this.storePackageInfo(name, key, cid);
  }

  static async downloadExample(key: string): Promise<TypedPackage> {
    if (!exampleUrl) throw new Error("Unable to download example ownable: URL not configured");

    const response = await fetch(`${exampleUrl}/${key}.zip`);
    const zipFile = new File([await response.blob()], `${key}.zip`, { type: 'application/zip' });

    return this.import(zipFile);
  }

  static async getAsset(
    key: string,
    name: string,
    read: (fr: FileReader, contents: Blob | File) => void,
  ): Promise<string|ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      IDBService.get(`package:${key}`, name).then((mediaFile: File) => {
        if (!mediaFile) {
          reject(`Asset "${name}" is not in package ${key}`);
        }

        fileReader.onload = (event) => {
          resolve(event.target?.result!);
        };

        read(fileReader, mediaFile);
      }, error => reject(error));
    });
  }

  static getAssetAsText(cid: string, name: string): Promise<string> {
    const read = (fr: FileReader, mediaFile: Blob | File) => fr.readAsText(mediaFile);
    return this.getAsset(cid, name, read) as Promise<string>;
  }

  static getAssetAsDataUri(cid: string, name: string): Promise<string> {
    const read = (fr: FileReader, mediaFile: Blob | File) => fr.readAsDataURL(mediaFile);
    return this.getAsset(cid, name, read) as Promise<string>;
  }
}
