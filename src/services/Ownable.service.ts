import {EventChain} from "@ltonetwork/lto";
import LTOService from "./LTO.service";
import IDBService from "./IDB.service";

export default class OwnableService {
  public anchoring = false;

  static async createNew(pkg: string) {
    const chain = EventChain.create(LTOService.account);

    await IDBService.create(
      `ownable:${chain.id}.chain`,
      `ownable:${chain.id}.events`,
      `ownable:${chain.id}.state`,
    );
  }
}
