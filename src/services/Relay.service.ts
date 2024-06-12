import { LTO, Account, Message, Relay } from "@ltonetwork/lto";
import SessionStorageService from "./SessionStorage.service";
import axios from "axios";
import sendFile from "./relayhelper.service";
import { SnackbarProvider, enqueueSnackbar } from "notistack";

const seed = SessionStorageService.get("@seed");
export const lto = new LTO(process.env.REACT_APP_LTO_NETWORK_ID);
export const relayURL = process.env.REACT_APP_RELAY
  ? process.env.REACT_APP_RELAY
  : null;
export const relayLocalURL = process.env.REACT_APP_LOCAL_RELAY;

lto.relay = relayURL
  ? new Relay(`${relayURL}/`)
  : new Relay(`${relayLocalURL}/`);

const sender: Account = lto.account({ seed: seed });

export class RelayService {
  static async sendOwnable(recipient: string, content: Uint8Array) {
    try {
      if (sender && recipient) {
        sendFile(content, sender, recipient);
      } else {
        enqueueSnackbar("No recipient provided");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  static async readRelayData() {
    try {
      const Address = sender.address;

      const responses = await axios.get(
        `${relayURL ? relayURL : relayLocalURL}/inboxes/${Address}/`
      );
      const ownableData = await Promise.all(
        responses.data.map(async (response: any) => {
          const infoResponse = await axios.get(
            `${relayURL ? relayURL : relayLocalURL}/inboxes/${Address}/${
              response.hash
            }`
          );
          return Message.from(infoResponse.data);
        })
      );
      const validData = ownableData;
      if (validData.length < 1) return null;
      return ownableData;
    } catch (error) {
      console.error("Error:", error);
    }
  }
}
