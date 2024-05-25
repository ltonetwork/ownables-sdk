import { EventChain, Event } from "@ltonetwork/lto";
import LTOService from "./LTO.service";
import IDBService from "./IDB.service";
import TypedDict from "../interfaces/TypedDict";
import PackageService from "./Package.service";
import { Cancelled } from "simple-iframe-rpc";

// @ts-ignore - Loaded as string, see `craco.config.js`
import workerJsSource from "../assets/worker.js";
import JSZip from "jszip";
import { TypedPackage } from "../interfaces/TypedPackage";
import { TypedOwnableInfo } from "../interfaces/TypedOwnableInfo";
import EventChainService from "./EventChain.service";

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

export default class OwnableService {
  private static readonly _rpc = new Map<string, OwnableRPC>();

  static async loadAll(): Promise<
    Array<{ chain: EventChain; package: string; created: Date }>
  > {
    return EventChainService.loadAll();
  }

  static rpc(id: string): OwnableRPC {
    const rpc = this._rpc.get(id);
    if (!rpc) throw new Error(`No RPC for ownable ${id}`);
    return rpc;
  }

  static clearRpc(id: string) {
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

  static create(pkg: TypedPackage): EventChain {
    const account = LTOService.account;
    const chain = EventChain.create(account);

    if (pkg.isDynamic) {
      const msg = {
        "@context": "instantiate_msg.json",
        ownable_id: chain.id,
        package: pkg.cid,
        network_id: LTOService.networkId,
      };

      new Event(msg).addTo(chain).signWith(account);
    }

    return chain;
  }

  static async init(chain: any, cid: string, rpc: OwnableRPC): Promise<void> {
    if (this._rpc.has(chain.id)) {
      try {
        delete (this._rpc.get(chain.id) as any).handler;
      } catch (e) {}
    }

    this._rpc.set(chain.id, rpc);
    const moduleJs = await PackageService.getAssetAsText(cid, "ownable.js");
    const js = workerJsSource + moduleJs;

    const wasm = (await PackageService.getAsset(
      cid,
      "ownable_bg.wasm",
      (fr, file) => fr.readAsArrayBuffer(file)
    )) as ArrayBuffer;
    await rpc.init(chain.id, js, new Uint8Array(wasm));
    const stateDump = await this.apply(chain, []);
    await EventChainService.initStore(chain, cid, stateDump);
  }

  static async apply(
    partialChain: EventChain,
    stateDump: StateDump
  ): Promise<StateDump> {
    const rpc = this.rpc(partialChain.id);

    for (const event of partialChain.events) {
      console.log(event);
      stateDump = (await this.applyEvent(rpc, event, stateDump)).state;
    }

    return stateDump;
  }

  private static async applyEvent(
    rpc: OwnableRPC,
    event: Event,
    stateDump: StateDump
  ): Promise<{ result?: TypedDict; state: StateDump }> {
    const info = {
      sender: event.signKey!.publicKey.base58
        ? event.signKey!.publicKey.base58
        : event.signKey!.publicKey.toString(),
      funds: [],
    };
    const { "@context": context, ...msg } = event.parsedData;

    switch (context) {
      case "instantiate_msg.json":
        return await rpc.instantiate(msg, info);
      case "execute_msg.json":
        return await rpc.execute(msg, info, stateDump);
      case "external_event_msg.json":
        const message = {
          msg: {
            event_type: msg.type,
            attributes: msg.attributes,
            network: "",
          },
        };
        return await rpc.externalEvent(message, info, stateDump);
      default:
        throw new Error(`Unknown event type`);
    }
  }

  static async execute(
    chain: EventChain,
    msg: TypedDict,
    stateDump: StateDump
  ): Promise<StateDump> {
    const info = { sender: LTOService.account.publicKey, funds: [] };
    const { state: newStateDump } = await this.rpc(chain.id).execute(
      msg,
      info,
      stateDump
    );

    console.log("Reached 2");
    console.log(chain, msg, stateDump);

    delete msg["@context"]; // Shouldn't be set
    new Event({ "@context": "execute_msg.json", ...msg })
      .addTo(chain)
      .signWith(LTOService.account);

    console.log(chain, stateDump);

    await EventChainService.store({ chain, stateDump });

    return newStateDump;
  }

  static async canConsume(
    consumer: { chain: EventChain; package: string },
    info: TypedOwnableInfo
  ): Promise<boolean> {
    if (!PackageService.info(consumer.package).isConsumer) return false;

    return true; // TODO: The check below is not working

    /*const state = await EventChainService.getStateDump(consumer.chain.id, consumer.chain.state);
    if (!state) return false;

    return await this.rpc(consumer.chain.id)
      .query({is_consumer_of: {consumable_type: info.ownable_type, issuer: info.issuer}}, state!);*/
  }

  static async consume(
    consumer: EventChain,
    consumable: EventChain
  ): Promise<void> {
    const info: MessageInfo = {
      sender: LTOService.account.publicKey,
      funds: [],
    };
    const consumeMessage = { consume: {} };

    console.log(consumer);
    console.log(consumable);

    const consumerState = await EventChainService.getStateDump(
      consumer.id,
      consumer.state
    );
    const consumableState = await EventChainService.getStateDump(
      consumable.id,
      consumable.state
    );
    console.log(consumable.id);
    console.log(consumable.state);
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

    new Event({ "@context": "execute_msg.json", ...consumeMessage })
      .addTo(consumable)
      .signWith(LTOService.account);
    new Event({ "@context": "external_event_msg.json", ...consumeEvent })
      .addTo(consumer)
      .signWith(LTOService.account);

    await EventChainService.store(
      { chain: consumable, stateDump: consumableStateDump },
      { chain: consumer, stateDump: consumerStateDump }
    );
  }

  static async initStore(
    chain: EventChain,
    pkg: string,
    stateDump?: StateDump
  ): Promise<void> {
    console.log(chain, pkg, stateDump);
    if (await IDBService.hasStore(`ownable:${chain.id}`)) {
      return;
    }
    const dbs = [`ownable:${chain.id}`];
    if (stateDump) dbs.push(`ownable:${chain.id}.state`);

    console.log(chain);

    const chainData = {
      chain: chain,
      state: chain.state.hex,
      package: pkg,
      created: new Date(),
    };

    const data: TypedDict = {};
    data[`ownable:${chain.id}`] = chainData;
    if (stateDump) data[`ownable:${chain.id}.state`] = new Map(stateDump);

    await IDBService.createStore(...dbs);
    await IDBService.setAll(data);
  }

  static async store(chain: EventChain, stateDump: StateDump): Promise<void> {
    console.log("reached store");

    const storedState = await IDBService.get(`ownable:${chain.id}`, "state");

    if (storedState === chain.state) return;
    await IDBService.setAll(
      Object.fromEntries([
        [
          `ownable:${chain.id}`,
          { chain: chain.toJSON(), state: chain.state.hex },
        ],
        [`ownable:${chain.id}.state`, new Map(stateDump)],
      ])
    );
  }

  static async delete(id: string): Promise<void> {
    await EventChainService.delete(id);
  }

  static async deleteAll(): Promise<void> {
    await EventChainService.deleteAll();
  }

  static async zip(chain: EventChain, files?: File[]): Promise<JSZip> {
    console.log(`package:${chain.events[0].parsedData.package}`);
    const packageCid: string = chain.events[0].parsedData.package;

    const zip = await PackageService.zip(packageCid);
    zip.file("chain.json", JSON.stringify(chain));

    return zip;
  }
}
