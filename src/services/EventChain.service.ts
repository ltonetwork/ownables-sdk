import { Binary, EventChain } from "@ltonetwork/lto";
import LTOService from "./LTO.service";
import IDBService from "./IDB.service";
import { StateDump } from "./Ownable.service";
import LocalStorageService from "./LocalStorage.service";
import TypedDict from "../interfaces/TypedDict";
import { IEventChainJSON } from "@ltonetwork/lto/interfaces";

interface StoredChainInfo {
  chain: IEventChainJSON;
  state: string;
  package: string;
  created: Date;
}

export default class EventChainService {
  private static _anchoring = !!LocalStorageService.get("anchoring");

  static get anchoring(): boolean {
    return this._anchoring;
  }
  static set anchoring(enabled: boolean) {
    LocalStorageService.set("anchoring", enabled);
    this._anchoring = enabled;
  }

  static async loadAll(): Promise<
    Array<{ chain: EventChain; package: string; created: Date }>
  > {
    const ids = (await IDBService.listStores())
      .filter((name) => name.match(/^ownable:\w+$/))
      .map((name) => name.replace(/^ownable:(\w+)$/, "$1"));

    return (await Promise.all(ids.map((id) => this.load(id)))).sort(
      ({ created: a }, { created: b }) => a.getTime() - b.getTime()
    );
  }

  static async load(
    id: string
  ): Promise<{ chain: EventChain; package: string; created: Date }> {
    const chainInfo = (await IDBService.getMap(`ownable:${id}`).then((map) =>
      Object.fromEntries(map.entries())
    )) as StoredChainInfo;
    const { chain: chainJson, package: packageCid, created } = chainInfo;

    return {
      chain: EventChain.from(chainJson),
      package: packageCid,
      created,
    };
  }

  static async store(
    ...chains: Array<{ chain: EventChain; stateDump: StateDump }>
  ): Promise<void> {
    const anchors: Array<{ key: Binary; value: Binary }> = [];
    const data: TypedDict<TypedDict | Map<any, any>> = {};

    for (const { chain, stateDump } of chains) {
      const storedState = await IDBService.get(`ownable:${chain.id}`, "state");
      if (storedState === chain.state) continue;

      if (this.anchoring) {
        const previousHash = await IDBService.get(
          `ownable:${chain.id}`,
          "latestHash"
        );
        let prevHash;
        if (previousHash === undefined) {
          prevHash = chain.latestHash;
          anchors.push(...chain.startingAfter(Binary.from(prevHash)).anchorMap);
          return;
        }
        anchors.push(
          ...chain.startingAfter(Binary.fromHex(previousHash)).anchorMap
        );
      }

      console.log(chain.state);
      data[`ownable:${chain.id}`] = {
        chain: chain.toJSON(),
        state: chain.state.hex,
        latestHash: chain.latestHash.hex,
      };
      data[`ownable:${chain.id}.state`] = new Map(stateDump);
    }

    if (anchors.length > 0) {
      await LTOService.anchor(...anchors);
    }

    await IDBService.setAll(data);
  }

  static async getStateDump(
    id: string,
    state: string | Binary
  ): Promise<StateDump | null> {
    const storedState = (await IDBService.hasStore(`ownable:${id}`))
      ? await IDBService.get(`ownable:${id}`, "state")
      : undefined;
    if (storedState !== (state instanceof Binary ? state.hex : state))
      return null;

    return this.getCurrentStateDump(id);
  }

  private static async getCurrentStateDump(id: string): Promise<StateDump> {
    const map = await IDBService.getMap(`ownable:${id}.state`);
    return Array.from(map.entries());
  }

  static async delete(id: string): Promise<void> {
    await IDBService.deleteStore(new RegExp(`^ownable:${id}(\\..+)?$`));
  }

  static async deleteAll(): Promise<void> {
    await IDBService.deleteStore(/^ownable:.+/);
  }

  // public static async verify(chain: EventChain) {
  //   return await LTOService.verifyAnchors(...chain.anchorMap);
  // }

  public static async verify(chain: EventChain) {
    let anchors: any[];

    if (Array.isArray(chain.anchorMap)) {
      anchors = chain.anchorMap;
    } else if (chain.anchorMap && typeof chain.anchorMap === "object") {
      anchors = Object.values(chain.anchorMap);
    } else {
      throw new Error("chain.anchorMap is not an iterable or a valid object");
    }

    return await LTOService.verifyAnchors(...anchors);
  }
}
