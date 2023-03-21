import {EventChain, Event, Binary} from "@ltonetwork/lto";
import LTOService from "./LTO.service";
import IDBService from "./IDB.service";
import LocalStorageService from "./LocalStorage.service";
import {IEventChainJSON} from "@ltonetwork/lto/interfaces";
import TypedDict from "../interfaces/TypedDict";
import PackageService from "./Package.service";
import {Cancelled} from "simple-iframe-rpc";

// @ts-ignore - Loaded as string, see `craco.config.js`
import workerJsSource from "../assets/worker.js";

export type StateDump = Array<[ArrayLike<number>, ArrayLike<number>]>;

interface MsgInfo {
  sender: string;
  funds: Array<never>;
}

interface CosmWasmEvent {
  ty: string;
  attributes: TypedDict<string>
}

export interface OwnableRPC {
  init: (id: string, js: string, wasm: Uint8Array) => Promise<any>;
  instantiate: (msg: TypedDict<any>, info: MsgInfo) => Promise<{attributes: TypedDict<string>, state: StateDump}>;
  execute: (msg: TypedDict<any>, info: MsgInfo, state: StateDump)
    => Promise<{attributes: TypedDict<string>, events: Array<CosmWasmEvent>, data: string, state: StateDump}>;
  externalEvent: (msg: TypedDict<any>, info: MsgInfo, state: StateDump)
    => Promise<{attributes: TypedDict<string>, events: Array<CosmWasmEvent>, data: string, state: StateDump}>;
  query: (msg: TypedDict<any>, state: StateDump) => Promise<TypedDict<any>>;
  refresh: (state: StateDump) => Promise<void>;
}

interface StoredChainInfo {
  chain: IEventChainJSON;
  state: string;
  package: string;
  created: Date;
}

export default class OwnableService {
  private static _anchoring = !!LocalStorageService.get('anchoring');
  private static readonly _rpc = new Map<string,OwnableRPC>();

  static get anchoring(): boolean {
    return this._anchoring;
  }
  static set anchoring(enabled: boolean) {
    LocalStorageService.set('anchoring', enabled);
    this._anchoring = enabled;
  }

  static rpc(id: string): OwnableRPC {
    const rpc = this._rpc.get(id);
    if (!rpc) throw new Error(`No RPC for ownable ${id}`);

    return rpc;
  }

  static clearRpc(id: string) {
    const rpc = this._rpc.get(id);
    if (!rpc) return;

    delete (rpc as any).handler;
    this._rpc.delete(id);
  }

  static async loadAll(): Promise<Array<{chain: EventChain, package: string, created: Date}>> {
    const ids = IDBService.list()
      .filter(name => name.match(/^ownable:\w+$/))
      .map(name => name.replace(/^ownable:(\w+)$/, '$1'));

    return (await Promise.all(ids.map(id => this.load(id))))
      .sort(({created: a}, {created: b}) => a.getTime() - b.getTime())
  }

  static async load(id: string): Promise<{chain: EventChain, package: string, created: Date}> {
    const chainInfo = await IDBService.getAll(`ownable:${id}`)
        .then(map => Object.fromEntries(map.entries())) as StoredChainInfo;

    const {chain: chainJson, package: packageCid, created} = chainInfo;

    return { chain: EventChain.from(chainJson), package: packageCid, created };
  }

  // Return `null` if the stored state dump doesn't match the requested event chain state
  static async getStateDump(id: string, state: string|Binary): Promise<StateDump|null> {
    const storedState = IDBService.exists(`ownable:${id}`)
      ? await IDBService.get(`ownable:${id}`, 'state')
      : undefined;
    if (storedState !== (state instanceof Binary ? state.hex : state)) return null;

    return this.getCurrentStateDump(id);
  }

  private static async getCurrentStateDump(id: string): Promise<StateDump> {
    const map = await IDBService.getAll(`ownable:${id}.state`);
    return Array.from(map.entries());
  }

  static create(packageCid: string): EventChain {
    const account = LTOService.account;
    const chain = EventChain.create(account);

    const msg = {
      "@context": "instantiate_msg.json",
      ownable_id: chain.id,
      package: packageCid,
      network_id: LTOService.networkId,
    };

    new Event(msg)
      .addTo(chain)
      .signWith(account);

    return chain;
  }

  static async init(chain: EventChain, pkg: string, rpc: OwnableRPC) {
    if (this._rpc.has(chain.id)) delete (this._rpc.get(chain.id) as any).handler;
    this._rpc.set(chain.id, rpc);

    const moduleJs = await PackageService.getAssetAsText(pkg, 'ownable.js');
    const js = workerJsSource + moduleJs;

    const wasm = await PackageService.getAsset(
      pkg,
      'ownable_bg.wasm',
      (fr, file) => fr.readAsArrayBuffer(file)
    ) as ArrayBuffer;

    try {
      await rpc.init(chain.id, js, new Uint8Array(wasm));
    } catch (e) {
      if (!(e instanceof Cancelled)) throw e;
      return false;
    }

    const stateDump = await this.apply(chain, []);
    await OwnableService.initStore(chain, pkg, stateDump);

    return true;
  }

  static async apply(partialChain: EventChain, stateDump: StateDump): Promise<StateDump> {
    const rpc = this.rpc(partialChain.id);

    for (const event of partialChain.events) {
      stateDump = (await this.applyEvent(rpc, event, stateDump)).state;
    }

    return stateDump;
  }

  private static async applyEvent(
    rpc: OwnableRPC,
    event: Event,
    stateDump: StateDump
  ): Promise<{result?: TypedDict<any>, state: StateDump}> {
    const info = {
      sender: event.signKey!.publicKey.base58,
      funds: [],
    }
    const {'@context': context, ...msg} = event.parsedData;

    switch (context) {
      case "instantiate_msg.json":
        return await rpc.instantiate(msg, info);
      case "execute_msg.json":
        return await rpc.execute(msg, info, stateDump);
      case "external_event_msg.json":
        return await rpc.externalEvent(msg, info, stateDump);
      default:
        throw new Error(`Unknown event type`);
    }
  }

  static async execute(chain: EventChain, msg: TypedDict<any>, stateDump: StateDump): Promise<StateDump> {
    const info = {sender: LTOService.account.publicKey, funds: []};
    const {state: newStateDump} = await this.rpc(chain.id).execute(msg, info, stateDump);

    delete msg['@context']; // Shouldn't be set
    new Event({"@context": 'execute_msg.json', ...msg}).addTo(chain).signWith(LTOService.account);

    await OwnableService.store(chain, stateDump);

    return newStateDump;
  }

  static async consume(consumer: EventChain, consumable: EventChain) {
    const info = {sender: LTOService.account.publicKey, funds: []};
    const consumeMessage = {consume: {}}; //{consume: {ownable_id: consumer.id}};

    const consumerState = await this.getStateDump(consumer.id, consumer.state);
    const consumableState = await this.getStateDump(consumable.id, consumable.state);
    if (!consumerState || !consumableState) throw Error("State mismatch for consume");

    const {events, state: consumableStateDump} =
      await this.rpc(consumable.id).execute(consumeMessage, info, consumableState);

    const consumeEvent: {contract?: string, ty: string, attributes: TypedDict<string>}|undefined
      = events.find(event => event.ty === 'consume');
    if (!consumeEvent) throw Error("No consume event emitted");
    consumeEvent.contract = consumable.id;

    const {state: consumerStateDump} =
      await this.rpc(consumer.id).externalEvent(consumeEvent, info, consumerState);

    // Race condition because we're modifying the event chain before storing?

    new Event({"@context": 'execute_msg.json', ...consumeMessage}).addTo(consumable).signWith(LTOService.account);
    new Event({"@context": 'external_event_msg.json', ...consumeEvent}).addTo(consumer).signWith(LTOService.account);

    await IDBService.setAll(Object.fromEntries([
      [`ownable:${consumer.id}`, { chain: consumer.toJSON(), state: consumer.state.hex }],
      [`ownable:${consumer.id}.state`, new Map(consumerStateDump)],
      [`ownable:${consumable.id}`, { chain: consumable.toJSON(), state: consumable.state.hex }],
      [`ownable:${consumable.id}.state`, new Map(consumableStateDump)],
    ]));
  }

  private static async initStore(chain: EventChain, pkg: string, stateDump: StateDump): Promise<void> {
    if (IDBService.exists(`ownable:${chain.id}`)) {
      return;
    }

    await IDBService.create(
      `ownable:${chain.id}`,
      `ownable:${chain.id}.state`,
    );

    const chainData = {
      chain: chain.toJSON(),
      state: chain.state.hex,
      package: pkg,
      created: new Date(),
    };

    await IDBService.setAll(Object.fromEntries([
      [`ownable:${chain.id}`, chainData],
      [`ownable:${chain.id}.state`, new Map(stateDump)],
    ]));
  }

  static async store(chain: EventChain, stateDump: StateDump): Promise<void> {
    const storedState = await IDBService.get(`ownable:${chain.id}`, 'state');
    if (storedState === chain.state) return;

    await IDBService.setAll(Object.fromEntries([
      [`ownable:${chain.id}`, { chain: chain.toJSON(), state: chain.state.hex }],
      [`ownable:${chain.id}.state`, new Map(stateDump)],
    ]));
  }

  static async delete(id: string): Promise<void> {
    await IDBService.delete(new RegExp(`^ownable:${id}(\\..+)?$`));
  }

  static async deleteAll(): Promise<void> {
    await IDBService.delete(/^ownable:.+/);
  }
}
