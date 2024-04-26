import LocalStorageService from "./LocalStorage.service";
import LTOService from "./LTO.service";
import {
  TypedPackageCapabilities,
  TypedPackage,
  TypedPackageStub,
} from "../interfaces/TypedPackage";
import JSZip from "jszip";
import mime from "mime/lite";
import IDBService from "./IDB.service";
import calculateCid from "../utils/calculateCid";
import { TypedCosmWasmMsg } from "../interfaces/TypedCosmWasmMsg";
import TypedDict from "../interfaces/TypedDict";
import { readRelayData } from "./Relay.service";
import { EventChain } from "@ltonetwork/lto";
import OwnableService from "./Ownable.service";
import asDownload from "../utils/asDownload";

const exampleUrl = process.env.REACT_APP_OWNABLE_EXAMPLES_URL;
const examples: TypedPackageStub[] = exampleUrl
  ? [
      {
        title: "Antenna",
        name: "ownable-antenna",
        description: "Add-on for Robot",
        stub: true,
      },
      {
        title: "Armor",
        name: "ownable-armor",
        description: "Add-on for Robot",
        stub: true,
      },
      {
        title: "Car",
        name: "ownable-car",
        description: "Ride for HODLers",
        stub: true,
      },
      {
        title: "Paint",
        name: "ownable-paint",
        description: "Consumable for Robot",
        stub: true,
      },
      {
        title: "Potion",
        name: "ownable-potion",
        description: "Drink a colorful potion",
        stub: true,
      },
      {
        title: "Robot",
        name: "ownable-robot",
        description: "An adorable robot companion",
        stub: true,
      },
      {
        title: "Speakers",
        name: "ownable-speakers",
        description: "Add-on for Robot",
        stub: true,
      },
    ]
  : [];
export const HAS_EXAMPLES = exampleUrl !== "";

const capabilitiesStaticOwnable = {
  isDynamic: false,
  hasMetadata: false,
  hasWidgetState: false,
  isConsumable: false,
  isConsumer: false,
  isTransferable: false,
};

export default class PackageService {
  static list(): Array<TypedPackage | TypedPackageStub> {
    const local = (LocalStorageService.get("packages") || []) as TypedPackage[];
    for (const pkg of local) {
      pkg.versions = pkg.versions.map(({ date, cid }) => ({
        date: new Date(date),
        cid,
      }));
    }

    const set = new Map(
      [...examples, ...local].map((pkg) => [pkg.name, pkg])
    ).values();

    return Array.from(set).sort((a, b) => (a.title >= b.title ? 1 : -1));
  }

  static info(nameOrCid: string): TypedPackage {
    const packages = (LocalStorageService.get("packages") ||
      []) as TypedPackage[];
    const found = packages.find(
      (pkg) =>
        pkg.name === nameOrCid ||
        pkg.versions.map((v) => v.cid).includes(nameOrCid)
    );

    if (!found) throw new Error(`Package not found: ${nameOrCid}`);
    return found;
  }

  private static storePackageInfo(
    title: string,
    name: string,
    description: string | undefined,
    cid: string,
    capabilities: TypedPackageCapabilities
  ): TypedPackage {
    const packages = (LocalStorageService.get("packages") ||
      []) as TypedPackage[];
    let pkg = packages.find((pkg) => pkg.name === name);

    if (!pkg) {
      pkg = { title, name, description, cid, ...capabilities, versions: [] };
      packages.push(pkg);
    } else {
      Object.assign(pkg, { cid, description, ...capabilities });
    }

    pkg.versions.push({ date: new Date(), cid });
    LocalStorageService.set("packages", packages);

    return pkg;
  }

  private static async extractAssets(zipFile: File): Promise<File[]> {
    const zip = await JSZip.loadAsync(zipFile);

    return await Promise.all(
      Array.from(Object.entries(zip.files))
        .filter(
          ([filename]) => !filename.startsWith(".") && filename !== "chain.json"
        )
        .map(async ([filename, file]) => {
          const blob = await file.async("blob");
          const type = mime.getType(filename) || "application/octet-stream";

          return new File([blob], filename, { type });
        })
    );
  }

  private static async storeAssets(cid: string, files: File[]): Promise<void> {
    if (await IDBService.hasStore(`package:${cid}`)) return;

    await IDBService.createStore(`package:${cid}`);
    await IDBService.setAll(
      `package:${cid}`,
      Object.fromEntries(files.map((file) => [file.name, file]))
    );
  }

  private static async getPackageJson(
    filename: string,
    files: File[]
  ): Promise<any> {
    const file = files.find((file) => file.name === filename);
    if (!file) throw new Error(`Invalid package: missing ${filename}`);

    return JSON.parse(await file.text());
  }

  private static async getCapabilities(
    files: File[]
  ): Promise<TypedPackageCapabilities> {
    if (files.findIndex((file) => file.name === "package.json") < 0)
      throw new Error("Invalid package: missing package.json");

    if (files.findIndex((file) => file.name === "ownable_bg.wasm") < 0)
      return capabilitiesStaticOwnable;

    const query: TypedCosmWasmMsg = await this.getPackageJson(
      "query_msg.json",
      files
    );
    const execute: TypedCosmWasmMsg = await this.getPackageJson(
      "execute_msg.json",
      files
    );

    const hasMethod = (schema: TypedCosmWasmMsg, find: string) =>
      schema.oneOf.findIndex((method) => method.required.includes(find)) >= 0;

    if (!hasMethod(query, "get_info"))
      throw new Error("Invalid package: missing `get_info` query method");

    return {
      isDynamic: true,
      hasMetadata: hasMethod(query, "get_metadata"),
      hasWidgetState: hasMethod(query, "get_widget_state"),
      isConsumable: hasMethod(execute, "consume"),
      isConsumer: hasMethod(query, "is_consumer_of"),
      isTransferable: hasMethod(execute, "transfer"),
    };
  }

  static async import(zipFile: File): Promise<TypedPackage> {
    const files = await this.extractAssets(zipFile);
    const packageJson: TypedDict = await this.getPackageJson(
      "package.json",
      files
    );

    const name: string = packageJson.name || zipFile.name.replace(/\.\w+$/, "");
    const title = name
      .replace(/^ownable-|-ownable$/, "")
      .replace(/[-_]+/, " ")
      .replace(/\b\w/, (c) => c.toUpperCase());
    const description: string | undefined = packageJson.description;

    const cid = await calculateCid(files);
    const capabilities = await this.getCapabilities(files);
    await this.storeAssets(cid, files);
    return this.storePackageInfo(title, name, description, cid, capabilities);
  }

  static async importFromRelay() {
    try {
      const relayData = await readRelayData();
      if (!relayData || !Array.isArray(relayData)) {
        console.error("No relay data received or invalid data format");
        return null;
      }

      const processedPackages = await Promise.all(
        relayData.map(async (zipBuffer) => {
          const zip = new JSZip();
          const zipFile = await zip.loadAsync(zipBuffer.data.buffer);
          const files = Object.values(zipFile.files);

          const blobs = await Promise.all(
            files.map(async (file) => {
              const content = await file.async("blob");
              return new Blob([content], {
                type: file.dir
                  ? "application/octet-stream"
                  : file.name.split(".").pop(),
              });
            })
          );

          const processedFiles = blobs.map((blob, index) => {
            const file = new File([blob], files[index].name, {
              type: blob.type,
              lastModified: Date.now(),
            });
            return file;
          });

          const packageJsonFile = files.find(
            (file) => file.name === "package.json"
          );
          if (!packageJsonFile) {
            console.error("No package.json found in the ZIP file");
            return null;
          }

          const packageJsonContent = await packageJsonFile.async("text");
          const packageJson = JSON.parse(packageJsonContent);
          const name: string =
            packageJson.name || packageJsonFile.name.replace(/\.\w+$/, "");
          const title = name
            .replace(/^ownable-|-ownable$/, "")
            .replace(/[-_]+/, " ")
            .replace(/\b\w/, (c) => c.toUpperCase());
          const description: string | undefined = packageJson.description;

          const cid: any = await calculateCid(processedFiles);
          let chain: any;
          const handleChains = files
            .filter((file) => file.name === "chain.json")
            .map(async (chainFile) => {
              let counter = 0;
              const chainJsonContent = await chainFile.async("text");
              chain = JSON.parse(chainJsonContent);
              chain.networkId = LTOService.networkId;

              if (counter < 1) {
                const msg = {
                  "@context": "instantiate_msg.json",
                  ownable_id: chain.id,
                  package: cid,
                  network_id: LTOService.networkId,
                };
                chain.events[counter].parsedData = msg;
                counter++;
              }
              if (counter >= 1) {
                const msg = {
                  "@context": "execute_msg.json",
                  transfer: {
                    to: LTOService.account.address,
                  },
                };
                console.log(msg);
                chain.events[counter].parsedData = msg;
              }
            });

          const capabilities = await this.getCapabilities(processedFiles);
          await this.storeAssets(cid, processedFiles);
          const detail = await this.storePackageInfo(
            title,
            name,
            description,
            cid,
            capabilities
          );
          chain.isImport = true;
          return { detail, chain, cid };
        })
      );
      return processedPackages.filter((packageInfo) => packageInfo !== null);
    } catch (error) {
      console.error("Error:", error);
      return null;
    }
  }

  static async downloadExample(key: string): Promise<TypedPackage> {
    if (!exampleUrl)
      throw new Error("Unable to download example ownable: URL not configured");

    const filename = key.replace(/^ownable-/, "") + ".zip";

    const response = await fetch(`${exampleUrl}/${filename}`);
    if (!response.ok)
      throw new Error(
        `Failed to download example ownable: ${response.statusText}`
      );
    if (response.headers.get("Content-Type") !== "application/zip")
      throw new Error(
        "Failed to download example ownable: invalid content type"
      );

    const zipFile = new File([await response.blob()], `${key}.zip`, {
      type: "application/zip",
    });

    return this.import(zipFile);
  }

  static async getAsset(
    cid: string,
    name: string,
    read: (fr: FileReader, contents: Blob | File) => void
  ): Promise<string | ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      IDBService.get(`package:${cid}`, name).then(
        (mediaFile: File) => {
          if (!mediaFile) {
            reject(`Asset "${name}" is not in package ${cid}`);
          }

          fileReader.onload = (event) => {
            resolve(event.target?.result!);
          };

          read(fileReader, mediaFile);
        },
        (error) => reject(error)
      );
    });
  }

  static getAssetAsText(cid: string, name: string): Promise<string> {
    const read = (fr: FileReader, mediaFile: Blob | File) =>
      fr.readAsText(mediaFile);
    return this.getAsset(cid, name, read) as Promise<string>;
  }

  static getAssetAsDataUri(cid: string, name: string): Promise<string> {
    const read = (fr: FileReader, mediaFile: Blob | File) =>
      fr.readAsDataURL(mediaFile);
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
}
