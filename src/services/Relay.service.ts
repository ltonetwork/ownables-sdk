import { LTO, Account, Message, Relay } from "@ltonetwork/lto";
import SessionStorageService from "./SessionStorage.service";
import { Blob } from "buffer";
//const LTOService = require("./LTO.service");

const seed = SessionStorageService.get("@seed");
export const lto = new LTO(process.env.REACT_APP_LTO_NETWORK_ID);

//lto.relay = new Relay("https://relay.lto.network/");
lto.relay = new Relay("http://localhost:3000/");

const sender: Account = lto.account({ seed: seed });
//const Account = LTOService.Account;

export async function sendZip(recipient: string, content: any) {
  try {
    if (sender && recipient) {
      let message = new Message(content).to(recipient).signWith(sender);
      await lto.relay?.send(message);
      await lto.anchor(sender, message.hash);
      console.log("Message sent successfully!");
    } else {
      console.log("provide the signer and recipient");
    }
  } catch (error) {
    console.error("Error sending message:", error);
  }
}
