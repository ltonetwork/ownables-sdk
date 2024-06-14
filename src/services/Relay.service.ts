import { LTO, Account, Message, Relay } from "@ltonetwork/lto";
import SessionStorageService from "./SessionStorage.service";
import axios from "axios";
import sendFile from "./relayhelper.service";

const initializer = () => {
  const seed = SessionStorageService.get("@seed");
  const lto = new LTO(process.env.REACT_APP_LTO_NETWORK_ID);
  const relayURL =
    process.env.REACT_APP_RELAY || process.env.REACT_APP_LOCAL_RELAY;
  lto.relay = new Relay(`${relayURL}/`);
  const relay = lto.relay;
  const sender = lto.account({ seed });

  return { relay, lto, relayURL, sender };
};

export const { relay, lto, relayURL, sender } = initializer();

export class RelayService {
  static async sendOwnable(recipient: string, content?: Uint8Array) {
    try {
      if (sender && recipient) {
        await sendFile(content, sender, recipient);
      } else {
        console.error("No recipient provided");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  static async readRelayData() {
    try {
      const Address = sender.address;

      const responses = await axios.get(`${relayURL}/inboxes/${Address}/`);
      const ownableData = await Promise.all(
        responses.data.map(async (response: any) => {
          const infoResponse = await axios.get(
            `${relayURL}/inboxes/${Address}/${response.hash}`
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

  //Check whether relay is up before attempting to send a message
  static async checkTransferError(content: Uint8Array) {
    let receiver;
    //These addresses are catcher addresses that helps us to
    //know if a transfer will fail via the relay before initiating a transfer.
    //ownables sent here are lost
    if (process.env.REACT_APP_LTO_NETWORK_ID === "T") {
      receiver = "3N5iXP4b18uEW6M4pctyaAQw2yqfTk3M3iD";
    } else {
      receiver = "3JdXMYkcaySbAa2UUXZfKWJf8dSAyZV9Ca4";
    }
    const value = await sendFile(content, sender, receiver);
    return value;
  }
}
