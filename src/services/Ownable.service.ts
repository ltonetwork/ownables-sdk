import {EventChain} from "@ltonetwork/lto";
import LTOService from "./LTO.service";
import IDBService from "./IDB.service";
import LocalStorageService from "./LocalStorage.service";

export default class OwnableService {
  private static _anchoring = !!LocalStorageService.get('anchoring');

  static get anchoring(): boolean {
    return this._anchoring;
  }
  static set anchoring(enabled: boolean) {
    LocalStorageService.set('anchoring', enabled);
    this._anchoring = enabled;
  }

  static async createNew(pkg: string): Promise<void> {
    const chain = EventChain.create(LTOService.account);

    await IDBService.create(
      `ownable:${chain.id}.chain`,
      `ownable:${chain.id}.events`,
      `ownable:${chain.id}.state`,
    );
  }

  static async deleteAll(): Promise<void> {
    await IDBService.delete(/^ownable:.+/);
  }
}
