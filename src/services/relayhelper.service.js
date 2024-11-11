//This .js file was created as a quick option for resolving
//ownable content truncation at the point of transfer in the
//relay service .ts file

//import { lto } from "./Relay.service";
const { Message } = require("@ltonetwork/lto");

export default async function sendFile(relay, content, sender, recipient) {
  try {
    let message;
    if (sender && recipient) {
      message = new Message(content).to(recipient).signWith(sender);
    } else {
      //console.log("provide the signer and recipient");
      return;
    }
    await relay.send(message);
    return message.hash.base58;
  } catch {
    return true;
  }
}
