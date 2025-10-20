import { Binary, EventChain, IEventChainJSON } from "eqty-core";
import EQTYService from "./EQTY.service";
import IDBService from "./IDB.service";
import { StateDump } from "./Ownable.service";
import LocalStorageService from "./LocalStorage.service";
import TypedDict from "../interfaces/TypedDict";

interface StoredChainInfo {
  chain: IEventChainJSON;
  state: string;
  package: string;
  uniqueMessageHash: string;
  created: Date;
  latestHash: string;
  keywords: string[];
}

export default class EventChainService {
  constructor(private idb: IDBService, private eqty: EQTYService) {}

  private static _localStorage = new LocalStorageService();
  private static _anchoring = !!this._localStorage.get("anchoring");

  static get anchoring(): boolean {
    return this._anchoring;
  }
  static set anchoring(enabled: boolean) {
    this._localStorage.set("anchoring", enabled);
    this._anchoring = enabled;
  }

  get anchoring(): boolean {
    return EventChainService._anchoring;
  }

  async loadAll(): Promise<
    Array<{
      chain: EventChain;
      package: string;
      created: Date;
      keywords: string[];
      latestHash?: string;
      uniqueMessageHash: string;
    }>
  > {
    const ids = (await this.idb.listStores())
      .filter((name) => name.match(/^ownable:\w+$/))
      .map((name) => name.replace(/^ownable:(\w+)$/, "$1"));

    const BATCH_SIZE = 10;
    const results: Array<any> = [];

    const isFulfilled = <T>(
      result: PromiseSettledResult<T>
    ): result is PromiseFulfilledResult<T> => {
      return result.status === "fulfilled";
    };

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (id) => {
          try {
            return await this.load(id);
          } catch (error) {
            console.error(`Failed to load chain with id ${id}:`, error);
            return null;
          }
        })
      );

      results.push(
        ...batchResults
          .filter(isFulfilled)
          .map((result) => result.value)
          .filter((value) => value !== null)
      );
    }

    return results.sort(
      ({ created: a }, { created: b }) => a.getTime() - b.getTime()
    );
  }

  async load(id: string): Promise<{
    chain: EventChain;
    package: string;
    created: Date;
    keywords: string[];
    uniqueMessageHash: string;
    latestHash?: string;
  }> {
    const chainInfo = (await this.idb
      .getMap(`ownable:${id}`)
      .then((map) => Object.fromEntries(map.entries()))) as StoredChainInfo;

    const {
      chain: chainJson,
      package: packageCid,
      latestHash,
      created,
      keywords,
      uniqueMessageHash,
    } = chainInfo;

    return {
      chain: EventChain.from(chainJson),
      package: packageCid,
      latestHash,
      created,
      keywords,
      uniqueMessageHash,
    };
  }

  async store(
    ...chains: Array<{
      chain: EventChain;
      stateDump: StateDump;
      keywords?: string[];
      uniqueMessageHash?: string;
    }>
  ): Promise<void> {
    const anchors: Array<any> = [];
    const data: TypedDict<TypedDict | Map<any, any>> = {};

    for (const { chain, stateDump } of chains) {
      const storedState = await this.idb.get(`ownable:${chain.id}`, "state");
      if (storedState === chain.state) continue;

      if (EventChainService.anchoring) {
        const previousHash = await this.idb.get(
          `ownable:${chain.id}`,
          "latestHash"
        );
        const newAnchors = previousHash
          ? chain.startingAfter(Binary.fromHex(previousHash)).anchorMap
          : chain.anchorMap;
        anchors.push(...newAnchors);
      }

      data[`ownable:${chain.id}`] = {
        chain: chain.toJSON(),
        state: chain.state.hex,
        latestHash: chain.latestHash.hex,
      };
      data[`ownable:${chain.id}.state`] = new Map(stateDump);
    }

    if (anchors.length > 0) {
      await this.eqty.anchor(...anchors);
    }

    // Only perform storage operation if there are changes
    if (Object.keys(data).length > 0) {
      await this.idb.setAll(data);
    }
  }

  async getStateDump(
    id: string,
    state: string | Binary
  ): Promise<StateDump | null> {
    const storedState = (await this.idb.hasStore(`ownable:${id}`))
      ? await this.idb.get(`ownable:${id}`, "state")
      : undefined;
    if (storedState !== (state instanceof Binary ? state.hex : state))
      return null;

    return this.getCurrentStateDump(id);
  }

  private async getCurrentStateDump(id: string): Promise<StateDump> {
    const map = await this.idb.getMap(`ownable:${id}.state`);
    return Array.from(map.entries());
  }

  async delete(id: string): Promise<void> {
    await this.idb.deleteStore(new RegExp(`^ownable:${id}(\\..+)?$`));
  }

  async deleteAll(): Promise<void> {
    await this.idb.deleteStore(/^ownable:.+/);
  }

  public async verify(chain: EventChain) {
    const anchors = chain.anchorMap;
    return await this.eqty.verifyAnchors(...anchors);
  }
}
