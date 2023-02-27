import LocalStorageService from "./LocalStorage.service";
import {TypedPackage} from "../interfaces/TypedPackage";
import JSZip from "jszip";
import mime from "mime/lite";
import IDBService from "./IDB.service";

const exampleUrl = process.env.OWNABLE_EXAMPLES_URL;
const examples = exampleUrl ? [
  { name: 'Antenna', key: 'antenna' },
  { name: 'Armor', key: 'armor' },
  { name: 'Car', key: 'car' },
  { name: 'Paint', key: 'paint' },
  { name: 'Robot', key: 'robot' },
  { name: 'Speakers', key: 'speakers' },
] : [];

export default class PackageService {
  static list(): TypedPackage[] {
    const local = (LocalStorageService.get('packages') || [])  as TypedPackage[];

    return Array.from(new Set([...local, ...examples]))
      .sort((a, b) => a.name >= b.name ? 1 : -1);
  }

  static async importAssets(name: string, zipFile: File): Promise<void> {
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

    await IDBService.create(`package:${name}`);
    await IDBService.setAll(
      `package:${name}`,
      Object.fromEntries(files.map(file => [file.name, file])),
    );
  }

  static async import(zip: File): Promise<TypedPackage> {
    const key = zip.name.replace(/\.\w+$/, '');
    const name = key.replace(/[-_]+/, ' ').replace(/\b\w/, c => c.toUpperCase());
    const pkg = { name, key };

    await this.importAssets(name, zip);
    LocalStorageService.addToSet('packages', pkg);

    return pkg;
  }
}
