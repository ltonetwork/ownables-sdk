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
    private readonly eventChains: EventChainService,
    private readonly eqty: EQTYService,
    private readonly packages: PackageService,
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
      throw e;
    }
    this._rpc.delete(id);
  }

  async create(pkg: TypedPackage): Promise<EventChain> {
    const address = this.eqty.address;
    const networkId = this.eqty.chainId;
    const chain = EventChain.create(address, networkId);
    const anchors: Array<any> = [];

    if (pkg.isDynamic || this.anchoring) {
      const msg = {
        "@context": "instantiate_msg.json",
        ownable_id: chain.id,
        package: pkg.cid,
        network_id: networkId,
        keywords: pkg.keywords ?? [],
      };
      const signer = this.eqty.signer;
      await new Event(msg).addTo(chain).signWith(signer);
    }

    if (this.anchoring) {
      const hash = chain.latestHash.hex;
      anchors.push(...chain.startingWith(Binary.fromHex(hash)).anchorMap);
    }

    if (anchors.length > 0) {
      await this.eqty.anchor(...anchors);
    }

    return chain;
  }

  async init(
    chain: any,
    cid: string,
    rpc: OwnableRPC,
    uniqueMessageHash?: string
  ): Promise<void> {
    if (this._rpc.has(chain.id)) {
      try {
        delete (this._rpc.get(chain.id) as any).handler;
      } catch (e) {}
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

  // private async createSnapshot(
  //   chain: EventChain,
  //   stateDump: StateDump,
  //   eventIndex: number
  // ): Promise<void> {
  //   try {
  //     const snapshot: StateSnapshot = {
  //       eventIndex,
  //       blockHash: chain.latestHash.hex,
  //       stateDump,
  //       timestamp: new Date(),
  //     };

  //     const storeId = `ownable:${chain.id}`;
  //     const snapshotStoreId = `${storeId}.snapshots`;

  //     // Ensure snapshot store exists
  //     if (!(await IDBService.hasStore(snapshotStoreId))) {
  //       await IDBService.createStore(snapshotStoreId);
  //     }

  //     await IDBService.set(snapshotStoreId, `snapshot_${eventIndex}`, snapshot);

  //     // Cleanup old snapshots (keep only last 3)
  //     const snapshots = await IDBService.keys(snapshotStoreId);
  //     if (snapshots.length > 3) {
  //       const sortedKeys = snapshots
  //         .map((key) => parseInt(key.replace("snapshot_", "")))
  //         .sort((a, b) => b - a);

  //       // Delete all but the 3 most recent snapshots
  //       const keysToDelete = sortedKeys
  //         .slice(3)
  //         .map((index) => `snapshot_${index}`);
  //       for (const key of keysToDelete) {
  //         await IDBService.delete(snapshotStoreId, key);
  //       }
  //     }
  //   } catch (error) {
  //     console.error("Error creating snapshot:", error);
  //   }
  // }

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

      if (!(await IDBService.hasStore(snapshotStoreId))) {
        await IDBService.createStore(snapshotStoreId);
      }

      await IDBService.set(snapshotStoreId, `snapshot_${eventIndex}`, snapshot);

      // Cleanup old snapshots (keep only last 3)
      const keys = await IDBService.keys(snapshotStoreId);
      if (keys.length > 3) {
        const sortedKeys = keys
          .map((key) => parseInt(key.replace("snapshot_", "")))
          .sort((a, b) => a - b); // Sort ascending by event index

        // Delete oldest snapshots, keep the 3 most recent
        const keysToDelete = sortedKeys
          .slice(0, sortedKeys.length - 3)
          .map((index) => `snapshot_${index}`);

        for (const key of keysToDelete) {
          await IDBService.delete(snapshotStoreId, key);
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
    const exist = await IDBService.hasStore(snapshotStoreId);

    if (!exist) {
      return null;
    }

    const snapshots = await IDBService.keys(snapshotStoreId);
    if (snapshots.length === 0) return null;

    const latestKey = snapshots
      .map((key) => parseInt(key.replace("snapshot_", "")))
      .sort((a, b) => b - a)[0];

    console.log("Latest snapshot key:", latestKey);

    return await IDBService.get(snapshotStoreId, `snapshot_${latestKey}`);
  }

  async listSnapshots(chainId: string): Promise<StateSnapshot[]> {
    const storeId = `ownable:${chainId}`;
    const snapshotStoreId = `${storeId}.snapshots`;

    if (!(await IDBService.hasStore(snapshotStoreId))) {
      return [];
    }

    const snapshots = await IDBService.keys(snapshotStoreId);
    const sortedKeys = snapshots
      .map((key) => parseInt(key.replace("snapshot_", "")))
      .sort((a, b) => a - b);

    return Promise.all(
      sortedKeys.map((index) =>
        IDBService.get(snapshotStoreId, `snapshot_${index}`)
      )
    );
  }

  async deleteSnapshots(chainId: string): Promise<void> {
    const storeId = `ownable:${chainId}`;
    const snapshotStoreId = `${storeId}.snapshots`;

    if (await IDBService.hasStore(snapshotStoreId)) {
      await IDBService.deleteStore(snapshotStoreId);
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
      sender: this.eqty.address,
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

    // Check if we need to create a snapshot after this event
    if ((eventIndex + 1) % this.SNAPSHOT_INTERVAL === 0) {
      console.log(`Creating snapshot at event ${eventIndex + 1}`);
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

    // Process events in batches for better performance
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

          // Attempt recovery by creating a checkpoint
          if (globalIndex > startIndex) {
            console.log(
              `Creating recovery snapshot at event ${globalIndex - 1}`
            );
            await this.createSnapshot(partialChain, stateDump, globalIndex - 1);
          }
          throw error;
        }
      }

      // to prevent blocking
      if (batchEnd < totalEvents) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return stateDump;
  }

  async execute(
    chain: EventChain,
    msg: TypedDict,
    stateDump: StateDump
  ): Promise<StateDump> {
    const info = { sender: this.eqty.address, funds: [] } as MessageInfo;
    const { state: newStateDump } = await this.rpc(chain.id).execute(
      msg,
      info,
      stateDump
    );

    delete msg["@context"]; // Shouldn't be set
    await new Event({ "@context": "execute_msg.json", ...msg })
      .addTo(chain)
      .signWith(this.eqty.signer);

    await this.store(chain, newStateDump);

    return newStateDump;
  }

  async canConsume(
    consumer: { chain: EventChain; package: string },
    info: TypedOwnableInfo
  ): Promise<boolean> {
    if (!this.packages.info(consumer.package).isConsumer) return false;

    return true; // TODO: The check below is not working

    /*const state = await this.eventChains.getStateDump(consumer.chain.id, consumer.chain.state);
    if (!state) return false;

    return await this.rpc(consumer.chain.id)
      .query({is_consumer_of: {consumable_type: info.ownable_type, issuer: info.issuer}}, state!);*/
  }

  async consume(
    consumer: EventChain,
    consumable: EventChain
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

    await Promise.all([
      new Event({ "@context": "execute_msg.json", ...consumeMessage })
        .addTo(consumable)
        .signWith(this.eqty.signer),
      new Event({ "@context": "external_event_msg.json", ...consumeEvent })
        .addTo(consumer)
        .signWith(this.eqty.signer),
    ]);

    await this.eventChains.store(
      { chain: consumable, stateDump: consumableStateDump },
      { chain: consumer, stateDump: consumerStateDump }
    );
  }

  private async ensureDBConnection(): Promise<void> {
    try {
      await IDBService.listStores();
    } catch (e) {
      console.warn("IDB connection lost, attempting to reconnect...");
      await IDBService.open();
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.ensureDBConnection();
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
      const hasStore = await IDBService.hasStore(storeId);
      if (hasStore) {
        return;
      }

      await IDBService.createStore(...stores);

      const data: TypedDict = {
        [storeId]: chainData,
      };

      if (stateDump) {
        data[stateStoreId] = new Map(stateDump);
      }

      try {
        await IDBService.setAll(data);
      } catch (error) {
        // If setAll fails, attempt to clean up
        console.error("Failed to set data, cleaning up stores...");
        await Promise.all(
          stores.map((store) =>
            IDBService.deleteStore(store).catch((e) =>
              console.warn(`Failed to clean up store ${store}:`, e)
            )
          )
        );
        throw error;
      }

      const verifyData = await Promise.all([
        IDBService.get(storeId, "state"),
        stateDump ? IDBService.getAll(stateStoreId) : Promise.resolve(null),
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
      const storedState = await IDBService.get(storeId, "state");
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
        const previousHash = await IDBService.get(
          `ownable:${chain.id}`,
          "latestHash"
        );
        anchors.push(
          ...chain.startingAfter(Binary.fromHex(previousHash)).anchorMap
        );
      }

      //anchor
      if (anchors.length > 0) {
        await this.eqty.anchor(...anchors);
      }

      await IDBService.setAll(data);

      // Check if we need to create a snapshot
      const eventCount = chain.events.length;
      if (eventCount % this.SNAPSHOT_INTERVAL === 0) {
        console.log(`Creating snapshot after ${eventCount} events`);
        await this.createSnapshot(chain, stateDump, eventCount - 1);
      }

      // Verify the write
      const verifyState = await IDBService.get(storeId, "state");
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
