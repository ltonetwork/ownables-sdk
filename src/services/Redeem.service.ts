import { EventChain } from "@ltonetwork/lto";
import LTOService from "./LTO.service";
import axios from "axios";

export class RedeemService {
  private static swapUrl = process.env.REACT_APP_SWAP_API;

  static async getOwnableCreator(event: any) {
    const genesisEvent = event[0];
    const address = LTOService.accountOf(genesisEvent?.signKey.publicKey);
    return address;
  }

  static async isRedeemable(address: string, title: string) {
    const url = `${this.swapUrl}/info/${address}/${title}`;
    const response = await axios.get(url);

    if (response.data.isRedeemable) {
      return {
        isRedeemable: true,
        value: response.data.value,
        title: response.data.title,
      };
    }

    return { isRedeemable: false };
  }

  static async redeemAddress() {
    const url = `${this.swapUrl}/info`;
    const response = await axios.get(url);
    return response.data.address;
  }
}
