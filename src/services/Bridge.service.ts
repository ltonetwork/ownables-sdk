import axios from "axios";
import LTOService from "./LTO.service";
import { sign } from "@ltonetwork/http-message-signatures";
// import { Transfer as TransferTx } from "@ltonetwork/lto";

export class BridgeService {
  private static obridgeUrl =
    process.env.REACT_APP_OBRIDGE || process.env.REACT_APP_LOCAL;

  //Get cost of bridging
  static async getBridgeCost(templateId: number) {
    const url = `${this.obridgeUrl}/api/v1/oBridgeCost?templateId=${templateId}`;
    try {
      const response = await axios.get(url);
      let oBridgeCost;
      if (process.env.REACT_APP_LTO_NETWORK_ID === "L") {
        oBridgeCost = response.data.L.arbitrum;
      } else {
        oBridgeCost = response.data.T.arbitrum;
      }

      return oBridgeCost;
    } catch (error) {
      console.error(`Error fetching bridge cost: ${error}`);
      return null;
    }
  }

  //get the bridge address
  static async getBridgeAddress() {
    const url = `${this.obridgeUrl}/api/v1/ServerLtoWalletAddresses`;
    try {
      const response = await axios.get(url);
      let bridgeAddress;
      if (process.env.REACT_APP_LTO_NETWORK_ID === "L") {
        bridgeAddress = response.data.serverLtoWalletAddress_L;
      } else {
        bridgeAddress = response.data.serverLtoWalletAddress_T;
      }
      return bridgeAddress;
    } catch (error) {
      console.error(`Error fetching bridge address: ${error}`);
      return null;
    }
  }

  //Pay bridging fee
  static async payBridgingFee(fee: number | null, bridgeAddress: string) {
    try {
      if (fee != null) {
        const amount = fee * Math.pow(10, 8);
        const transactionId = await LTOService.transfer(bridgeAddress, amount);
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
    // let tx: TransferTx;

    try {
      let bridgingCosts;
      let bridgeAddress;
      bridgingCosts = await this.getBridgeCost(1);
      if (bridgingCosts === null) {
        console.error("Bridging Costs undefined. Maybe oBridge not reachable?");
      }
      bridgeAddress = await this.getBridgeAddress();
      if (bridgeAddress === null) {
        console.error("Bridge Address undefined. Maybe oBridge not reachable?");
      }
      // tx = new TransferTx(bridgeAddress, bridgingCosts);
    } catch (err) {
      console.log("Error:", err);
    }
    try {
      const account = await LTOService.getAccount();
      const ltoNetworkId = LTOService.getNetwork(account.address);

      if (!account) {
        return;
      }

      const urlToSign = `${this.obridgeUrl}/api/v1/bridgeOwnable`;
      const request = {
        headers: {},
        method: "POST",
        url: urlToSign,
      };
      const signedRequest = await sign(request, { signer: account });
      request.url =
        request.url +
        `?ltoNetworkId=${ltoNetworkId}&ltoTransactionId=${txId}&nftReceiverAddress=${nftReceiverAddress}`;

      const headers1 = {
        "Content-Type": "multipart/form-data",
        Accept: "*/*",
      };
      const combinedHeaders = { ...signedRequest.headers, ...headers1 };
      //   console.log("combinedHeaders", combinedHeaders);

      const formData = new FormData();
      formData.append("file", ownable, filename);
      await axios.post(request.url, formData, {
        headers: combinedHeaders,
      });
    } catch (err) {
      console.error("bridging failed", err);
    }
  }
}
