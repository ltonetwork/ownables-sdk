import LocalStorageService from "./LocalStorage.service";
import {TypedPackage} from "../interfaces/TypedPackage";
import JSZip from "jszip";
import mime from "mime/lite";
import IDBService from "./IDB.service";

const exampleUrl = process.env.REACT_APP_OWNABLE_EXAMPLES_URL;
const examples: TypedPackage[] = exampleUrl ? [
  { name: 'Antenna', key: 'antenna', stub: true },
  { name: 'Armor', key: 'armor', stub: true },
  { name: 'Car', key: 'car', stub: true },
  { name: 'Paint', key: 'paint', stub: true },
  { name: 'Robot', key: 'robot', stub: true },
  { name: 'Speakers', key: 'speakers', stub: true },
] : [];
export const HAS_EXAMPLES = exampleUrl !== '';

export default class PackageService {
  static list(): TypedPackage[] {
    const local = (LocalStorageService.get('packages') || [])  as TypedPackage[];
    const set = new Map([...examples, ...local].map(pkg => [pkg.key, pkg])).values();

    return Array.from(set)
      .sort((a, b) => a.name >= b.name ? 1 : -1);
  }

  static nameOf(key: string): string {
    return key
      .replace(/[-_]+/, ' ')
      .replace(/\b\w/, c => c.toUpperCase());
  }

  static async importAssets(key: string, zipFile: File): Promise<void> {
    const zip = await JSZip.loadAsync(zipFile);

    const files = await Promise.all(Array.from(Object.entries(zip.files))
      .filter(([filename]) => !filename.startsWith('.') && !filename.includes('MAC'))
      .map(async ([filename, file]) => {
        const blob = await file.async("blob");
        const ext = filename.substring(filename.indexOf('.'));
        const type = mime.getType(ext) || 'application/octet-stream';

        return new File([blob], filename, { type });
      })
    );

    await IDBService.createForced(`package:${key}`);
    await IDBService.setAll(
      `package:${key}`,
      Object.fromEntries(files.map(file => [file.name, file])),
    );
  }

  static async import(zipFile: File): Promise<TypedPackage> {
    const key = zipFile.name.replace(/\.\w+$/, '');
    const name = this.nameOf(key);
    const pkg = { name, key };

    await this.importAssets(key, zipFile);
    LocalStorageService.addToSet('packages', pkg);

    return pkg;
  }

  static async download(key: string): Promise<TypedPackage> {
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

  static getAssetAsText(key: string, name: string): Promise<string> {
    const read = (fr: FileReader, mediaFile: Blob | File) => fr.readAsText(mediaFile);
    return this.getAsset(key, name, read) as Promise<string>;
  }

  static getAssetAsDataUri(key: string, name: string): Promise<string> {
    const read = (fr: FileReader, mediaFile: Blob | File) => fr.readAsDataURL(mediaFile);
    return this.getAsset(key, name, read) as Promise<string>;
  }
}
