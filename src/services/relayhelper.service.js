//This .js file was created as a quick option for resolving
//ownable content truncation at the point of transfer in the
//relay service .ts file

const { LTO } = require("@ltonetwork/lto");
const { Relay, Message } = require("@ltonetwork/lto");

export const lto = new LTO(process.env.REACT_APP_LTO_NETWORK_ID);
export const relayURL = process.env.REACT_APP_RELAY
  ? process.env.REACT_APP_RELAY
  : null;
export const relayLocalURL = process.env.REACT_APP_LOCAL_RELAY;

lto.relay = relayURL
  ? new Relay(`${relayURL}/`)
  : new Relay(`${relayLocalURL}/`);

export default async function sendFile(content, sender, recipient) {
  try {
    let message;
    if (sender && recipient) {
      message = new Message(content).to(recipient).signWith(sender);
    } else {
      console.log("provide the signer and recipient");
    }
    await lto.relay.send(message);
    console.log(message);
    console.log("Message sent successfully!");
  } catch (error) {
    console.error("Error sending message:", error);
  }
}
