import { EventChain, Event, Binary } from "eqty-core";
import EQTYService from "./EQTY.service";
import IDBService from "./IDB.service";
import TypedDict from "../interfaces/TypedDict";
import PackageService from "./Package.service";
import { Cancelled } from "simple-iframe-rpc";
import JSZip from "jszip";
import { TypedPackage } from "../interfaces/TypedPackage";
import { TypedOwnableInfo } from "../interfaces/TypedOwnableInfo";
import EventChainService from "./EventChain.service";

// @ts-ignore - Loaded as string, see `craco.config.js`
import workerJsSource from "../assets/worker.js";
import { LogProgress, withProgress } from "../contexts/Progress.context";

export type StateDump = Array<[ArrayLike<number>, ArrayLike<number>]>;

interface MessageInfo {
  sender: string;
  funds: Array<{}>;
}

interface CosmWasmEvent {
  type: string;
  attributes: TypedDict<string>;
}

export interface OwnableRPC {
  init: (id: string, js: string, wasm: Uint8Array) => Promise<any>;
  instantiate: (
    msg: TypedDict,
    info: MessageInfo
  ) => Promise<{ attributes: TypedDict<string>; state: StateDump }>;
  execute: (
    msg: TypedDict,
    info: MessageInfo,
    state: StateDump
  ) => Promise<{
    attributes: TypedDict<string>;
    events: Array<CosmWasmEvent>;
    data: string;
    state: StateDump;
  }>;
  externalEvent: (
    msg: TypedDict,
    info: TypedDict,
    state: StateDump
  ) => Promise<{
    attributes: TypedDict<string>;
    events: Array<CosmWasmEvent>;
    data: string;
    state: StateDump;
  }>;
  query: (msg: TypedDict, state: StateDump) => Promise<any>;
  refresh: (state: StateDump) => Promise<void>;
}

interface StateSnapshot {
  eventIndex: number;
  blockHash: string;
  stateDump: StateDump;
  timestamp: Date;
}

export default class OwnableService {
  private readonly SNAPSHOT_INTERVAL = 50;

  constructor(
    private readonly idb: IDBService,
    private readonly eventChains: EventChainService,
    private readonly eqty: EQTYService,
    private readonly packages: PackageService
  ) {}

  private readonly _rpc = new Map<string, OwnableRPC>();

  get anchoring(): boolean {
    return this.eventChains.anchoring;
  }

  async loadAll(): Promise<
    Array<{
      chain: EventChain;
      package: string;
      created: Date;
      keywords: string[];
      uniqueMessageHash?: string;
    }>
  > {
    return this.eventChains.loadAll();
  }

  isReady(id: string): boolean {
    return this._rpc.has(id);
  }

  rpc(id: string): OwnableRPC {
    const rpc = this._rpc.get(id);
    if (!rpc) throw new Error(`No RPC for ownable ${id}`);
    return rpc;
  }

  clearRpc(id: string) {
    const rpc = this._rpc.get(id);
    if (!rpc) return;

    try {
      delete (rpc as any).handler;
    } catch (e) {
      if (e instanceof Cancelled) return;
      console.warn("Unexpected error clearing RPC:", e);
    }
    this._rpc.delete(id);
  }

  async create(
    pkg: TypedPackage,
    onProgress?: LogProgress
  ): Promise<{ chain: EventChain; txHash?: string }> {
    const address = this.eqty.address;
    const networkId = this.eqty.chainId;
    const chain = EventChain.create(address, networkId);
    const anchors: Array<any> = [];

    if (pkg.isDynamic || this.anchoring) {
      const msg: any = {
        "@context": "instantiate_msg.json",
        ownable_id: chain.id,
        package: pkg.cid,
        network_id: networkId,
        keywords: pkg.keywords ?? [],
      };

      await withProgress(onProgress)("signEvent", () =>
        this.eqty.sign(new Event(msg).addTo(chain))
      );
    }

    if (this.anchoring) {
      const hash = chain.latestHash.hex;
      anchors.push(...chain.startingWith(Binary.fromHex(hash)).anchorMap);
    }

    if (anchors.length > 0) {
      // Queue anchors and submit as single tx
      await this.eqty.anchor(...anchors);
      const txHash = await withProgress(onProgress)("anchorEvent", () =>
        this.eqty.submitAnchors()
      );
      return { chain, txHash };
    }

    return { chain };
  }

  async init(
    chain: any,
    cid: string,
    rpc: OwnableRPC,
    uniqueMessageHash?: string
  ): Promise<void> {
    if (this._rpc.has(chain.id)) {
      this.clearRpc(chain.id);
    }

    this._rpc.set(chain.id, rpc);
    const moduleJs = await this.packages.getAssetAsText(cid, "ownable.js");
    const js = workerJsSource + moduleJs;

    const wasm = (await this.packages.getAsset(
      cid,
      "ownable_bg.wasm",
      (fr, file) => fr.readAsArrayBuffer(file)
    )) as ArrayBuffer;
    await rpc.init(chain.id, js, new Uint8Array(wasm));

    const stateDump = await this.apply(chain, []);
    await this.initStore(chain, cid, uniqueMessageHash, stateDump);
  }

  private async createSnapshot(
    chain: EventChain,
    stateDump: StateDump,
    eventIndex: number
  ): Promise<void> {
    const chainId = chain.id;
    const storeId = `ownable:${chainId}`;
    const snapshotStoreId = `${storeId}.snapshots`;

    try {
      const snapshot: StateSnapshot = {
        eventIndex,
        blockHash: chain.latestHash.hex,
        stateDump,
        timestamp: new Date(),
      };

      if (!(await this.idb.hasStore(snapshotStoreId))) {
        await this.idb.createStore(snapshotStoreId);
      }

      await this.idb.set(snapshotStoreId, `snapshot_${eventIndex}`, snapshot);

      // Cleanup old snapshots (keep only last 3)
      const keys = await this.idb.keys(snapshotStoreId);
      if (keys.length > 3) {
        const sortedKeys = keys
          .map((key) => parseInt(key.replace("snapshot_", "")))
          .sort((a, b) => b - a);

        // Delete oldest snapshots, keep the 3 most recent
        const keysToDelete = sortedKeys
          .slice(3)
          .map((index) => `snapshot_${index}`);

        for (const key of keysToDelete) {
          await this.idb.delete(snapshotStoreId, key);
        }
      }
    } catch (error) {
      console.error("Error creating snapshot:", error);
    }
  }

  private async getLatestSnapshot(
    chainId: string
  ): Promise<StateSnapshot | null> {
    const storeId = `ownable:${chainId}`;
    const snapshotStoreId = `${storeId}.snapshots`;
    const exist = await this.idb.hasStore(snapshotStoreId);

    if (!exist) {
      return null;
    }

    const snapshots = await this.idb.keys(snapshotStoreId);
    if (snapshots.length === 0) return null;

    const latestKey = snapshots
      .map((key) => parseInt(key.replace("snapshot_", "")))
      .sort((a, b) => b - a)[0];

    return await this.idb.get(snapshotStoreId, `snapshot_${latestKey}`);
  }

  async listSnapshots(chainId: string): Promise<StateSnapshot[]> {
    const storeId = `ownable:${chainId}`;
    const snapshotStoreId = `${storeId}.snapshots`;

    if (!(await this.idb.hasStore(snapshotStoreId))) {
      return [];
    }

    const snapshots = await this.idb.keys(snapshotStoreId);
    const sortedKeys = snapshots
      .map((key) => parseInt(key.replace("snapshot_", "")))
      .sort((a, b) => a - b);

    return Promise.all(
      sortedKeys.map((index) =>
        this.idb.get(snapshotStoreId, `snapshot_${index}`)
      )
    );
  }

  async deleteSnapshots(chainId: string): Promise<void> {
    const storeId = `ownable:${chainId}`;
    const snapshotStoreId = `${storeId}.snapshots`;

    if (await this.idb.hasStore(snapshotStoreId)) {
      await this.idb.deleteStore(snapshotStoreId);
    }
  }

  private async applyEvent(
    rpc: OwnableRPC,
    event: Event,
    stateDump: StateDump,
    chain: EventChain,
    eventIndex: number
  ): Promise<{ result?: TypedDict; state: StateDump }> {
    const info = {
      sender: event.signerAddress || this.eqty.address,
      funds: [],
    } as MessageInfo;
    const { "@context": context, ...msg } = event.parsedData;

    let result;
    switch (context) {
      case "instantiate_msg.json":
        result = await rpc.instantiate(msg, info);
        break;
      case "execute_msg.json":
        result = await rpc.execute(msg, info, stateDump);
        break;
      case "external_event_msg.json":
        const message = {
          msg: {
            event_type: msg.type,
            attributes: msg.attributes,
            network: "",
          },
        };
        result = await rpc.externalEvent(message, info, stateDump);
        break;
      default:
        throw new Error(`Unknown event type`);
    }

    if ((eventIndex + 1) % this.SNAPSHOT_INTERVAL === 0) {
      await this.createSnapshot(chain, result.state, eventIndex);
    }

    return result;
  }

  async apply(
    partialChain: EventChain,
    stateDump: StateDump
  ): Promise<StateDump> {
    const rpc = this.rpc(partialChain.id);
    const snapshot = await this.getLatestSnapshot(partialChain.id);
    let startIndex = 0;

    if (snapshot) {
      const snapshotEventIndex = partialChain.events.findIndex(
        (e) => e.hash?.hex === snapshot.blockHash
      );
      if (snapshotEventIndex !== -1) {
        stateDump = snapshot.stateDump;
        startIndex = snapshotEventIndex + 1;
      }
    }

    const BATCH_SIZE = 10;
    const totalEvents = partialChain.events.length;

    for (
      let batchStart = startIndex;
      batchStart < totalEvents;
      batchStart += BATCH_SIZE
    ) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, totalEvents);
      const batch = partialChain.events.slice(batchStart, batchEnd);

      for (let i = 0; i < batch.length; i++) {
        const globalIndex = batchStart + i;
        const event = batch[i];

        try {
          const result = await this.applyEvent(
            rpc,
            event,
            stateDump,
            partialChain,
            globalIndex
          );
          stateDump = result.state;
        } catch (error) {
          console.error(`Error applying event at index ${globalIndex}:`, error);

          if (globalIndex > startIndex) {
            await this.createSnapshot(partialChain, stateDump, globalIndex - 1);
          }
          throw error;
        }
      }

      if (batchEnd < totalEvents) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return stateDump;
  }

  async execute(
    chain: EventChain,
    msg: TypedDict,
    stateDump: StateDump,
    onProgress?: LogProgress
  ): Promise<StateDump> {
    const info = { sender: this.eqty.address, funds: [] } as MessageInfo;
    const { state: newStateDump } = await this.rpc(chain.id).execute(
      msg,
      info,
      stateDump
    );

    delete msg["@context"]; // Shouldn't be set

    await withProgress(onProgress)("signEvent", () =>
      this.eqty.sign(
        new Event({ "@context": "execute_msg.json", ...msg }).addTo(chain)
      )
    );

    // Store without submitting anchors yet; submission is controlled by caller
    await this.store(chain, newStateDump);

    return newStateDump;
  }

  async submitAnchors(onProgress?: LogProgress): Promise<string | undefined> {
    if (!this.anchoring) return undefined;
    return await withProgress(onProgress)("anchor", () =>
      this.eqty.submitAnchors()
    );
  }

  async canConsume(
    consumer: { chain: EventChain; package: string },
    info: TypedOwnableInfo
  ): Promise<boolean> {
    if (!this.packages.info(consumer.package).isConsumer) return false;

    try {
      const state = await this.eventChains.getStateDump(
        consumer.chain.id,
        consumer.chain.state.hex
      );
      if (!state) return false;

      const result = await this.rpc(consumer.chain.id).query(
        {
          is_consumer_of: {
            consumable_type: info.ownable_type,
            issuer: info.issuer,
          },
        },
        state
      );

      return result === true;
    } catch (error) {
      console.warn("Error checking canConsume:", error);
      return false;
    }
  }

  async consume(
    consumer: EventChain,
    consumable: EventChain,
    onProgress?: LogProgress
  ): Promise<void> {
    const info: MessageInfo = {
      sender: this.eqty.address,
      funds: [],
    };
    const consumeMessage = { consume: {} };
    const consumerState = await this.eventChains.getStateDump(
      consumer.id,
      consumer.state.hex
    );
    const consumableState = await this.eventChains.getStateDump(
      consumable.id,
      consumable.state.hex
    );
    if (!consumerState || !consumableState)
      throw Error("State mismatch for consume");

    const { events, state: consumableStateDump } = await this.rpc(
      consumable.id
    ).execute(consumeMessage, info, consumableState);

    const consumeEvent:
      | { contract?: string; type: string; attributes: TypedDict<string> }
      | undefined = events.find((event) => event.type === "consume");
    if (!consumeEvent) throw Error("No consume event emitted");
    consumeEvent.contract = consumable.id;

    const externalEventMsg = {
      msg: {
        attributes: consumeEvent.attributes,
        network: "",
        event_type: consumeEvent.type,
      },
    };

    const { state: consumerStateDump } = await this.rpc(
      consumer.id
    ).externalEvent(externalEventMsg, info, consumerState);

    await withProgress(onProgress)("signConsumableEvent", () =>
      this.eqty.sign(
        new Event({ "@context": "execute_msg.json", ...consumeMessage }).addTo(
          consumable
        )
      )
    );

    await withProgress(onProgress)("signConsumerEvent", () =>
      this.eqty.sign(
        new Event({
          "@context": "external_event_msg.json",
          ...consumeEvent,
        }).addTo(consumer)
      )
    );

    // Store both chains; emit anchor progress only once to represent anchoring both
    // Queue anchors for both chains without submitting yet
    await this.store(consumable, consumableStateDump);
    await this.store(consumer, consumerStateDump);

    // Submit a single anchor tx for both
    await this.submitAnchors(onProgress);
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.warn(`Attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay * attempt));
        }
      }
    }

    throw new Error(
      `Operation failed after ${maxRetries} attempts. Last error: `
    );
  }

  async initStore(
    chain: EventChain,
    pkg: string,
    uniqueMessageHash?: string,
    stateDump?: StateDump
  ): Promise<void> {
    const storeId = `ownable:${chain.id}`;
    const stateStoreId = `${storeId}.state`;

    const chainData = {
      chain: chain.toJSON(),
      state: chain.state.hex,
      package: pkg,
      created: new Date(),
      latestHash: chain.latestHash.hex,
      keywords: this.packages.info(pkg).keywords,
      uniqueMessageHash: this.packages.info(pkg, uniqueMessageHash)
        .uniqueMessageHash,
    };

    const stores = [storeId];
    if (stateDump) stores.push(stateStoreId);

    await this.retryOperation(async () => {
      const hasStore = await this.idb.hasStore(storeId);
      if (hasStore) {
        return;
      }

      await this.idb.createStore(...stores);

      const data: TypedDict = {
        [storeId]: chainData,
      };

      if (stateDump) {
        data[stateStoreId] = new Map(stateDump);
      }

      try {
        await this.idb.setAll(data);
      } catch (error) {
        // If setAll fails, attempt to clean up
        console.error("Failed to set data, cleaning up stores...");
        await Promise.all(
          stores.map((store) => this.idb.deleteStore(store).catch(() => {}))
        );
        throw error;
      }

      const verifyData = await Promise.all([
        this.idb.get(storeId, "state"),
        stateDump ? this.idb.getAll(stateStoreId) : Promise.resolve(null),
      ]);

      if (
        verifyData[0] !== chainData.state ||
        (stateDump && !verifyData[1]?.length)
      ) {
        throw new Error("Data verification failed after write");
      }
    });
  }

  async store(chain: EventChain, stateDump: StateDump): Promise<void> {
    const anchors: Array<any> = [];
    const storeId = `ownable:${chain.id}`;
    const stateStoreId = `${storeId}.state`;

    await this.retryOperation(async () => {
      const storedState = await this.idb.get(storeId, "state");
      if (storedState === chain.state) return;

      const data = {
        [storeId]: {
          chain: chain.toJSON(),
          state: chain.state.hex,
          latestHash: chain.latestHash.hex,
        },
        [stateStoreId]: new Map(stateDump),
      };

      if (this.anchoring) {
        const previousHash = await this.idb.get(
          `ownable:${chain.id}`,
          "latestHash"
        );
        anchors.push(
          ...chain.startingAfter(Binary.fromHex(previousHash)).anchorMap
        );
      }

      if (anchors.length > 0) {
        // Queue anchors only; submission handled separately to allow batching
        await this.eqty.anchor(...anchors);
      }

      await this.idb.setAll(data);

      const eventCount = chain.events.length;
      if (eventCount % this.SNAPSHOT_INTERVAL === 0) {
        await this.createSnapshot(chain, stateDump, eventCount - 1);
      }

      // Verify write
      const verifyState = await this.idb.get(storeId, "state");
      if (verifyState !== chain.state.hex) {
        throw new Error("State verification failed after write");
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.eventChains.delete(id);
  }

  async deleteAll(): Promise<void> {
    await this.eventChains.deleteAll();
  }

  async zip(chain: EventChain): Promise<JSZip> {
    const packageCid: string = chain.events[0].parsedData.package;

    const zip = await this.packages.zip(packageCid);
    zip.file("chain.json", JSON.stringify(chain.toJSON()));

    return zip;
  }
}
