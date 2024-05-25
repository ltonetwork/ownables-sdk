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
import asDownload from "../utils/asDownload";
import OwnableService from "./Ownable.service";

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

  static async extractAssets(zipFile: File, chain?: boolean): Promise<File[]> {
    const zip = await JSZip.loadAsync(zipFile);

    if (chain) {
      const chainFiles = await Promise.all(
        Array.from(Object.entries(zip.files))
          .filter(([filename]) => !filename.startsWith("."))
          .map(async ([filename, file]) => {
            const blob = await file.async("blob");
            const type = mime.getType(filename) || "application/octet-stream";
            return new File([blob], filename, { type });
          })
      );
      console.log(chainFiles);
      return chainFiles;
    }

    const assetFiles = await Promise.all(
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

    return assetFiles;
  }

  private static async storeAssets(cid: string, files: File[]): Promise<void> {
    if (await IDBService.hasStore(`package:${cid}`)) return;

    await IDBService.createStore(`package:${cid}`);
    await IDBService.setAll(
      `package:${cid}`,
      Object.fromEntries(files.map((file) => [file.name, file]))
    );
  }

  private static async reviewAsset(cid: string, chainLength?: string) {
    // Get the chain.json file from IndexedDB
    console.log("REVIEWING");
    const existingChainJson = await IDBService.get(
      `ownable:${cid}`,
      "chain.json"
    );

    console.log(existingChainJson);

    if (!existingChainJson) {
      console.error(`No chain.json found for package: ${cid}`);
      return;
    }

    // Read the chain.json file
    const existingChain = JSON.parse(await existingChainJson.text());
    const existingChainLength = existingChain.events.length;

    // If the provided chainLength is not defined or the existing chain is longer, do nothing
    if (!chainLength || existingChainLength > parseInt(chainLength, 10)) {
      return;
    }

    // Get the new chain.json file
    const newChainJson = await this.getAsset(
      cid,
      "chain.json",
      (fr, contents) => fr.readAsText(contents)
    );
    console.log(newChainJson);
    const newChain = JSON.parse(newChainJson as string);
    const newChainLength = newChain.events.length;

    // Check if the new chain.json file has more events than the existing one
    if (newChainLength > existingChainLength) {
      // Delete the existing chain.json file
      await IDBService.deleteStore(`ownable:${cid}`);

      // Replace with the new chain.json file
      const files = await IDBService.getAll(`ownable:${cid}`);
      const updatedFiles = files.filter((file) => file.name !== "chain.json");
      updatedFiles.push(
        new File([new Blob([JSON.stringify(newChain)])], "chain.json", {
          type: "application/json",
        })
      );

      console.log("ownable cid reached");
      await IDBService.setAll(
        `package:${cid}`,
        Object.fromEntries(updatedFiles.map((file) => [file.name, file]))
      );
    }
  }

  private static async getChainJson(
    filename: string,
    files: any
  ): Promise<any> {
    const extractedFile = await this.extractAssets(files, true);
    console.log(extractedFile);
    const file = extractedFile.find((file) => file.name === filename);
    if (!file) throw new Error(`Invalid package: missing ${filename}`);

    return JSON.parse(await file.text());
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
    console.log("using import");
    const files = await this.extractAssets(zipFile);
    const packageJson: TypedDict = await this.getPackageJson(
      "package.json",
      files
    );

    const name: string = packageJson.name || zipFile.name.replace(/\.\w+$/, "");
    console.log(zipFile);
    const title = name
      .replace(/^ownable-|-ownable$/, "")
      .replace(/[-_]+/, " ")
      .replace(/\b\w/, (c) => c.toUpperCase());
    const description: string | undefined = packageJson.description;

    const cid = await calculateCid(files);
    const capabilities = await this.getCapabilities(files);
    console.log(cid);
    await this.storeAssets(cid, files);
    return this.storePackageInfo(title, name, description, cid, capabilities);
  }

  static async importFromRelay() {
    try {
      const relayData = await readRelayData();
      console.log(relayData);

      if (!relayData || !Array.isArray(relayData) || relayData.length === 0) {
        console.error("No relay data received or invalid data format");
        return null;
      }

      const recipient = relayData[0]?.recipient || "";

      const results = await Promise.all(
        relayData.map(async (data) => {
          console.log(data);

          const asset = await this.extractAssets(data.data.buffer);

          const cid = await calculateCid(asset);

          // Check if the CID already exists
          if (await IDBService.hasStore(`package:${cid}`)) {
            console.log(`CID ${cid} already exists. Skipping...`);
            return null;
          }

          const chainJson = await this.getChainJson(
            "chain.json",
            data.data.buffer
          );
          const packageJson = await this.getPackageJson("package.json", asset);
          const name = packageJson.name;
          const title = name
            .replace(/^ownable-|-ownable$/, "")
            .replace(/[-_]+/, " ")
            .replace(/\b\w/, (c: any) => c.toUpperCase());
          const description = packageJson.description;
          const capabilities = await this.getCapabilities(asset);

          this.storeAssets(cid, asset);
          const pkg = this.storePackageInfo(
            title,
            name,
            description,
            cid,
            capabilities
          );

          const eventsLength = chainJson.events.length;

          // Temporary solution - needs to be dynamic and accurate
          for (let counter = 0; counter < eventsLength; counter++) {
            let msg;
            if (counter === 0) {
              msg = {
                "@context": "instantiate_msg.json",
                ownable_id: chainJson.id,
                package: cid,
                network_id: LTOService.networkId,
              };
            } else if (counter == eventsLength - 1) {
              msg = {
                "@context": "execute_msg.json",
                transfer: {
                  to: "",
                },
              };
            }
            chainJson.events[counter].parsedData = msg;
          }

          pkg.chain = chainJson;
          pkg.chain.isRelay = true;
          console.log(pkg);

          return pkg;
        })
      );

      return results.filter((pkg) => pkg !== null);
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
    console.log(cid);
    const files = await IDBService.getAll(`package:${cid}`);
    await IDBService.setAll(
      `package:${cid}`,
      Object.fromEntries(files.map((file) => [file.name, file]))
    );
    for (const file of files) {
      zip.file(file.name, file);
    }
    return zip;
  }
}
