import axios from "axios";
import LTOService from "./LTO.service";
import { sign } from "@ltonetwork/http-message-signatures";

export class BridgeService {
  private static obridgeUrl =
    process.env.REACT_APP_OBRIDGE || process.env.REACT_APP_LOCAL;

  //Get cost of bridging
  static async getBridgeCost(templateId: number) {
    const url = `${this.obridgeUrl}/oBridgeCost?templateId=${templateId}`;
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error(`Error fetching bridge cost: ${error}`);
      return null;
    }
  }

  //get the bridge address
  static async getBridgeAddress() {
    const url = `${this.obridgeUrl}/GetObridgeWallet`;
    try {
      const response = await axios.get(url);
      return response.data.oBridgeWalletAddressLTO;
    } catch (error) {
      console.error(`Error fetching bridge address: ${error}`);
      return null;
    }
  }

  //Pay bridging fee
  static async payBridgingFee(fee: number | null) {
    const bridgeAddr = await this.getBridgeAddress();
    try {
      if (fee != null) {
        const amount = fee * Math.pow(10, 8);
        const transactionId = await LTOService.transfer(bridgeAddr, amount);
        return transactionId;
      }
    } catch (err) {
      console.error("Fee not provided", err);
    }
  }

  //Bridge the ownable
  static async bridgeOwnableToNft(
    nftReceiverAddress: string,
    txId: string,
    filename: string,
    ownable: Blob
  ) {
    const urlToSign = `${this.obridgeUrl}/bridgeOwnable?nftReceiverAddress=${nftReceiverAddress}`;
    try {
      const request = {
        headers: { Accept: "multipart/form-data" },
        method: "POST",
        url: urlToSign,
      };

      const account = LTOService.account;

      if (!account) {
        return;
      }

      const signedRequest = await sign(request, { signer: account });

      const formData = new FormData();
      formData.append("file", ownable, filename);
      const url = `${this.obridgeUrl}/bridgeOwnable?nftReceiverAddress=${nftReceiverAddress}&ltoTransactionId=${txId}&signedLtoRequest=${signedRequest}`;

      const res = await axios.post(url, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Accept: "*/*",
        },
      });
      console.log(res.data);
    } catch (err) {
      console.error("bridging failed", err);
    }
  }
}
