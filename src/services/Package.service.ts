import LocalStorageService from "./LocalStorage.service";
import {TypedPackageCapabilities, TypedPackage, TypedPackageStub} from "../interfaces/TypedPackage";
import JSZip from "jszip";
import mime from "mime/lite";
import IDBService from "./IDB.service";
import calculateCid from "../utils/calculateCid";
import {TypedCosmWasmMsg} from "../interfaces/TypedCosmWasmMsg";
import TypedDict from "../interfaces/TypedDict";
import { EventChain } from "@ltonetwork/lto";
import axios from "axios";

const exampleUrl = process.env.REACT_APP_OWNABLE_EXAMPLES_URL;
const examples: TypedPackageStub[] = exampleUrl ? [
  { title: 'Antenna', name: 'ownable-antenna', description: 'Add-on for Robot', stub: true },
  { title: 'Armor', name: 'ownable-armor', description: 'Add-on for Robot', stub: true },
  { title: 'Car', name: 'ownable-car', description: 'Ride for HODLers', stub: true },
  { title: 'Paint', name: 'ownable-paint', description: 'Consumable for Robot', stub: true },
  { title: 'Potion', name: 'ownable-potion', description: 'Drink a colorful potion', stub: true },
  { title: 'Robot', name: 'ownable-robot', description: 'An adorable robot companion', stub: true },
  { title: 'Speakers', name: 'ownable-speakers', description: 'Add-on for Robot', stub: true },
] : [];
export const HAS_EXAMPLES = exampleUrl !== '';

const capabilitiesStaticOwnable = {
  isDynamic: false,
  hasMetadata: false,
  hasWidgetState: false,
  isConsumable: false,
  isConsumer: false,
  isTransferable: false,
};

export default class PackageService {
  static list(): Array<TypedPackage|TypedPackageStub> {
    const local = (LocalStorageService.get('packages') || []) as TypedPackage[];
    for (const pkg of local) {
      pkg.versions = pkg.versions.map(({date, cid}) => ({date: new Date(date), cid}));
    }

    const set = new Map([...examples, ...local].map(pkg => [pkg.name, pkg])).values();

    return Array.from(set)
      .sort((a, b) => a.title >= b.title ? 1 : -1);
  }

  static info(nameOrCid: string): TypedPackage {
    const packages = (LocalStorageService.get('packages') || []) as TypedPackage[];
    const found = packages.find(pkg => pkg.name === nameOrCid || pkg.versions.map(v => v.cid).includes(nameOrCid));

    if (!found) throw new Error(`Package not found: ${nameOrCid}`);
    return found;
  }

  private static storePackageInfo(
    title: string,
    name: string,
    description: string|undefined,
    cid: string,
    keywords: string[],
    capabilities: TypedPackageCapabilities,
    isNotLocal?: boolean
  ): TypedPackage {
    const packages = (LocalStorageService.get('packages') || []) as TypedPackage[];
    let pkg = packages.find(pkg => pkg.name === name);

    if (!pkg) {
      pkg = {title, name, description, cid, keywords, isNotLocal, ...capabilities, versions: []};
      packages.push(pkg);
    } else {
      Object.assign(pkg, {cid, description, keywords, ...capabilities});
    }

    pkg.versions.push({date: new Date(), cid});
    LocalStorageService.set('packages', packages);

    return pkg;
  }

  private static async extractAssets(zipFile: File): Promise<File[]> {
    const zip = await JSZip.loadAsync(zipFile);

    return await Promise.all(Array.from(Object.entries(zip.files))
      .filter(([filename]) => !filename.startsWith('.') && filename !== 'chain.json')
      .map(async ([filename, file]) => {
        const blob = await file.async("blob");
        const type = mime.getType(filename) || 'application/octet-stream';

        return new File([blob], filename, { type });
      })
    );
  }

  private static async storeAssets(cid: string, files: File[]): Promise<void> {
    console.log(`Storing ${files.length} files in ${cid}`);
    if (await IDBService.hasStore(`package:${cid}`)) return;

    await IDBService.createStore(`package:${cid}`);
    await IDBService.setAll(
      `package:${cid}`,
      Object.fromEntries(files.map(file => [file.name, file])),
    );
  }

  private static async getPackageJson(filename: string, files: File[]): Promise<any> {
    const file = files.find(file => file.name === filename);
    if (!file) throw new Error(`Invalid package: missing ${filename}`);

    return JSON.parse(await file.text());
  }

  private static async getCapabilities(files: File[]): Promise<TypedPackageCapabilities> {
    if (files.findIndex(file => file.name === 'package.json') < 0)
      throw new Error('Invalid package: missing package.json');

    if (files.findIndex(file => file.name === 'ownable_bg.wasm') < 0) return capabilitiesStaticOwnable;

    const query: TypedCosmWasmMsg = await this.getPackageJson('query_msg.json', files);
    const execute: TypedCosmWasmMsg = await this.getPackageJson('execute_msg.json', files);

    const hasMethod = (schema: TypedCosmWasmMsg, find: string) =>
      schema.oneOf.findIndex(method => method.required.includes(find)) >= 0;

    if (!hasMethod(query, 'get_info')) throw new Error('Invalid package: missing `get_info` query method');

    return {
      isDynamic: true,
      hasMetadata: hasMethod(query, 'get_metadata'),
      hasWidgetState: hasMethod(query, 'get_widget_state'),
      isConsumable: hasMethod(execute, 'consume'),
      isConsumer: hasMethod(query, 'is_consumer_of'),
      isTransferable: hasMethod(execute, 'transfer'),
    };
  }

  static async import(zipFile: File): Promise<TypedPackage> {
    const files = await this.extractAssets(zipFile);
    console.log(files);
    const packageJson: TypedDict = await this.getPackageJson('package.json', files);

    const name: string = packageJson.name || zipFile.name.replace(/\.\w+$/, '');
    const title = name
      .replace(/^ownable-|-ownable$/, '')
      .replace(/[-_]+/, ' ')
      .replace(/\b\w/, c => c.toUpperCase());
    const description: string|undefined = packageJson.description;

    const cid = await calculateCid(files);
    console.log(cid);
    const capabilities = await this.getCapabilities(files);
    const keywords: string[] = packageJson.keywords || '';

    await this.storeAssets(cid, files);
    return this.storePackageInfo(title, name, description, cid, keywords, capabilities);
  }

  static async downloadExample(key: string): Promise<TypedPackage> {
    if (!exampleUrl) throw new Error("Unable to download example ownable: URL not configured");

    const filename = key.replace(/^ownable-/, '') + '.zip';

    const response = await fetch(`${exampleUrl}/${filename}`);
    if (!response.ok) throw new Error(`Failed to download example ownable: ${response.statusText}`);
    if (response.headers.get('Content-Type') !== 'application/zip')
      throw new Error('Failed to download example ownable: invalid content type');

    const zipFile = new File([await response.blob()], `${key}.zip`, { type: 'application/zip' });

    return this.import(zipFile);
  }

  static async downloadOwnable(ownable: { link: string, name: string }): Promise<TypedPackage> {
    const { link, name } = ownable;
    console.log(link);
  
    if (!link) throw new Error("Unable to download ownable: URL not configured");
  
    const response = await fetch(link);
    if (!response.ok) throw new Error(`Failed to download ownable: ${response.statusText}`);
  //   if (response.headers.get('Content-Type') !== 'application/octet-stream')
  // throw new Error('Failed to download ownable: invalid content type');
  
    const zipFile = new File([await response.blob()], `ownable-${name}.zip`, { type: 'application/zip' });
    console.log(zipFile);
    return this.import(zipFile);
  }

  static async getAsset(
    cid: string,
    name: string,
    read: (fr: FileReader, contents: Blob | File) => void,
  ): Promise<string|ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      IDBService.get(`package:${cid}`, name).then((mediaFile: File) => {
        if (!mediaFile) {
          reject(`Asset "${name}" is not in package ${cid}`);
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

  static async zip(cid: string): Promise<JSZip> {
    const zip = new JSZip();
    const files = await IDBService.getAll(`package:${cid}`);

    for (const file of files) {
      zip.file(file.name, file);
    }

    return zip;
  }

  static async importFromGenerator(RID:string, CID:string) {
    try {
      const response = await axios.get("http://localhost:3000/api/v1/claim?requestId="+RID, { responseType: 'arraybuffer' });
      const assets = await this.extractAssets(response.data);
      console.log("assets ", assets);
        const zip = new JSZip();
        const zipData = await zip.loadAsync(response.data);
        console.log("zipData", zipData);

      //   async function extractFilesFromZip(zip: JSZip): Promise<File[]> {
      //     const filePromises = Object.values(zip.files)
      //         .filter(file => !file.dir)
      //         .map(async file => {
      //             const blob = await file.async('blob');
      //             return new File([blob], file.name);
      //         });
      
      //     return Promise.all(filePromises);
      // }
      // const files = await extractFilesFromZip(zipData);
      // console.log("files:", files);

        const chainFile = zipData.file("chain.json");
        if (!chainFile) {
            throw new Error("chain.json not found in zip file");
        }

        const chainJson = await chainFile.async("string");
        const chain = JSON.parse(chainJson);
        console.log("chain", chain);
        
        // Validate the event chain
        if (!this.validateEventChain(chain)) {
          throw new Error("Invalid event chain.");
            }

            if (await IDBService.hasStore(`package:${CID}`)) {
              console.log("already in IDB");
              return null;
            }

            // const packageFile = zipData.file("package.json")
            // if (!packageFile) {
            //   throw new Error("package.json not found in zip file");
            // }
            // const jsonPackage =  await packageFile.async("string");
            // const packageJson = JSON.parse(jsonPackage);
            // console.log("package.json", packageJson);
            const packageJson: TypedDict = await this.getPackageJson(
              "package.json",
              assets
            );
            const name = packageJson.name;
            const description: string = packageJson.description ?? '';
            const title = name
              .replace(/^ownable_|-ownable$/, "")
              .replace(/[-_]+/, " ")
              .replace(/\b\w/, (c: any) => c.toUpperCase());
            // const capabilities = await this.getCapabilities(assets);
            // const capabilitiesArray = Object.keys(capabilities);
            const capabilitiesArray = await this.getCapabilities(assets)
            const keywords = packageJson.keywords || [];
            const isNotLocal = true;
            console.log("title: " + title, ", description:", + description, " capa: ", capabilitiesArray, keywords );

            await this.storeAssets(CID, assets);
            const pkg = this.storePackageInfo(
              title,
              name,
              description,
              CID,
              keywords,
              capabilitiesArray,
              isNotLocal
            );
            const eventchain = EventChain.from(chain);
            console.log("chain: ", chain);
            pkg.chain = eventchain;
            console.log("pkg in package.service: ", pkg);
            return pkg;
    } catch (error) {
      console.error("Error:", error);
      return null;
    }
  }

  // // Function to validate the event chain
  // private static async validateEventChain(chain: { events: { previous: string; hash: string; }[] }, assets: any): Promise<boolean> {
  //   if (!Array.isArray(chain.events) || chain.events.length === 0) {
  //     return false;
  //   }

  //   let previousHash = chain.events[0].previous;
  //   for (let event of chain.events) {
  //     if (event.previous !== previousHash) {
  //       return false;
  //     }
  //     previousHash = event.hash;
  //   }

  //   // Check if the last event in the chain has been transferred already
  //   const lastEvent = chain.events[chain.events.length - 1];
  //   const matchingAsset = assets.find((asset: any) => asset.hash === lastEvent.hash);
  //   if (!matchingAsset || matchingAsset.status !== 'available') {
  //     throw new Error('The last event in the chain has already been transferred.');
  //   }

  //   // Add additional checks as needed

  //   return true;
  // }

  // Function to validate the event chain
  private static validateEventChain = (chain: { events: { previous: string; hash: string; }[] }) => {
    if (!Array.isArray(chain.events) || chain.events.length === 0) {
      return false;
    }

    let previousHash = chain.events[0].previous;
    for (let event of chain.events) {
      if (event.previous !== previousHash) {
        return false;
      }
      previousHash = event.hash;
    }
    return true;
  };
}
