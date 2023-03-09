import {EventChain, Event} from "@ltonetwork/lto";
import LTOService from "./LTO.service";
import IDBService from "./IDB.service";
import LocalStorageService from "./LocalStorage.service";

export type Mem = Array<[ArrayLike<number>, ArrayLike<number>]>;

export default class OwnableService {
  private static _anchoring = !!LocalStorageService.get('anchoring');

  static get anchoring(): boolean {
    return this._anchoring;
  }
  static set anchoring(enabled: boolean) {
    LocalStorageService.set('anchoring', enabled);
    this._anchoring = enabled;
  }

  static create(): EventChain {
    const account = LTOService.account;

    const chain = EventChain.create(account);
    new Event({"@context": "instantiate_msg.json", ownable_id: chain.id})
      .addTo(chain)
      .signWith(account);

    return chain;
  }

  private static async init(chain: EventChain): Promise<void> {
    await IDBService.create(
      `ownable:${chain.id}.chain`,
      `ownable:${chain.id}.events`,
      `ownable:${chain.id}.state`,
    );
  }

  static async store(chain: EventChain, idb: Mem) {
    if (!IDBService.exists(`ownable:${chain.id}.chain`)) {
      await this.init(chain);
    }

    // TODO Store events and state
  }

  static async deleteAll(): Promise<void> {
    await IDBService.delete(/^ownable:.+/);
  }
}
