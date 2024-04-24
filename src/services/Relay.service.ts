import { LTO, Account, Message, Relay } from "@ltonetwork/lto";
import SessionStorageService from "./SessionStorage.service";
import axios from "axios";
import sendFile from "./relayhelper.service";

const seed = SessionStorageService.get("@seed");
export const lto = new LTO(process.env.REACT_APP_LTO_NETWORK_ID);
export const relayURL = process.env.REACT_APP_RELAY
  ? process.env.REACT_APP_RELAY
  : null;
export const relayLocalURL = process.env.REACT_APP_LOCAL_RELAY;

//lto.relay = new Relay("https://relay.lto.network/");
lto.relay = relayURL
  ? new Relay(`${relayURL}/`)
  : new Relay(`${relayLocalURL}/`);

const sender: Account = lto.account({ seed: seed });

export async function sendOwnable(recipient: string, content: Uint8Array) {
  try {
    if (sender && recipient) {
      sendFile(content, sender, recipient);
      // const file = await content;
      // let message = new Message(file).to(recipient).signWith(sender);
      // console.log(content, file, message);
      // await lto.relay?.send(message);
      // await lto.anchor(sender, message.hash);
      // console.log("Message sent successfully!");
    } else {
      console.log("provide the signer and recipient");
    }
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

export async function readRelayData() {
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
        //console.log(infoResponse.data);
        return Message.from(infoResponse.data);
      })
    );
    return ownableData;
  } catch (error) {
    console.error("Error:", error);
  }
}
