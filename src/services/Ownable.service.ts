import {EventChain, Event, Binary} from "@ltonetwork/lto";
import LTOService from "./LTO.service";
import IDBService from "./IDB.service";
import LocalStorageService from "./LocalStorage.service";
import {IEventChainJSON} from "@ltonetwork/lto/interfaces";

export type StateDump = Array<[ArrayLike<number>, ArrayLike<number>]>;

interface StoredChainInfo {
  chain: IEventChainJSON;
  state: string;
  package: string;
  created: Date;
}

export default class OwnableService {
  private static _anchoring = !!LocalStorageService.get('anchoring');

  static get anchoring(): boolean {
    return this._anchoring;
  }
  static set anchoring(enabled: boolean) {
    LocalStorageService.set('anchoring', enabled);
    this._anchoring = enabled;
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

    const {chain: chainJson, package: pkg, created} = chainInfo;

    return {
      chain: EventChain.from(chainJson),
      package: pkg,
      created,
    };
  }

  // Return `null` if the stored state dump doesn't match the requested event chain state
  static async getStateDump(id: string, state: string|Binary): Promise<StateDump|null> {
    const storedState = IDBService.exists(`ownable:${id}`)
      ? await IDBService.get(`ownable:${id}`, 'state')
      : undefined;
    if (storedState !== (state instanceof Binary ? state.hex : state)) return null;

    const map = await IDBService.getAll(`ownable:${id}.state`);
    return Array.from(map.entries());
  }

  static create(): EventChain {
    const account = LTOService.account;

    const chain = EventChain.create(account);
    new Event({"@context": "instantiate_msg.json", ownable_id: chain.id})
      .addTo(chain)
      .signWith(account);

    return chain;
  }

  static async init(chain: EventChain, pkg: string): Promise<void> {
    if (IDBService.exists(`ownable:${chain.id}`)) {
      return;
    }

    await IDBService.create(
      `ownable:${chain.id}`,
      `ownable:${chain.id}.state`,
    );

    await IDBService.setAll(`ownable:${chain.id}`, {
      chain: chain.toJSON(),
      state: chain.state.hex,
      package: pkg,
      created: new Date(),
    });
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
