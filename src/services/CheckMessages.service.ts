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

      const uniqueCids = new Set<string>();

      await Promise.all(
        ownables.map(async (data: any) => {
          const { message } = data;
          const value = message?.data;
          const asset = await PackageService.extractAssets(value.buffer);
          const thisCid = await calculateCid(asset);

          if (await IDBService.hasStore(`package:${thisCid}`)) {
            const chainJson = await PackageService.getChainJson(
              "chain.json",
              value.buffer
            );
            if (await PackageService.isCurrentEvent(chainJson)) {
              uniqueCids.add(thisCid);
            }
          } else {
            uniqueCids.add(thisCid);
          }
        })
      );

      return Array.from(uniqueCids);
    } catch (error) {
      console.log("Failed to get valid CIDs");
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
