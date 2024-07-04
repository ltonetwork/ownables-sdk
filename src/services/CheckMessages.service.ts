//Check the relay for messages
import PackageService from "./Package.service";
import calculateCid from "../utils/calculateCid";
import IDBService from "./IDB.service";
import { RelayService } from "./Relay.service";

export class checkForMessages {
  static async getValidCids() {
    try {
      const ownables = await RelayService.readRelayData();
      if (ownables == null) return [];

      const cids = await Promise.all(
        ownables.map(async (data: any) => {
          const asset = await PackageService.extractAssets(data.data.buffer);
          const thisCid = await calculateCid(asset);
          if (await IDBService.hasStore(`package:${thisCid}`)) {
            const chainJson = await PackageService.getChainJson(
              "chain.json",
              data.data.buffer
            );
            if (await PackageService.compareEvent(chainJson)) {
              return thisCid;
            } else {
              return null;
            }
          } else {
            return thisCid;
          }
        })
      );
      return cids.filter((cid) => cid !== null);
    } catch (error) {
      console.log("Failed to get valid ids");
      return [];
    }
  }

  static async valueOfValidCids() {
    try {
      const validCids = await this.getValidCids();
      if (validCids.length === 0) return null;
      return validCids.length;
    } catch (error) {
      console.log(`${error}, could not get value`);
      return null;
    }
  }
}
