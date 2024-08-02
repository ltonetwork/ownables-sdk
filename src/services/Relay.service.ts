import { LTO, Message, Relay } from "@ltonetwork/lto";
import SessionStorageService from "./SessionStorage.service";
import axios from "axios";
import sendFile from "./relayhelper.service";
import JSZip from "jszip";
import mime from "mime/lite";

const initializer = () => {
  const seed = SessionStorageService.get("@seed");
  const lto = new LTO(process.env.REACT_APP_LTO_NETWORK_ID);
  const relayURL =
    process.env.REACT_APP_RELAY || process.env.REACT_APP_LOCAL_RELAY;
  lto.relay = new Relay(`${relayURL}`);
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
      const value = await this.isRelayUp();
      if (value === false) return null;

      const responses = relayURL
        ? await axios.get(`${relayURL}/inboxes/${Address}/`)
        : null;

      if (responses !== null) {
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
      } else {
        return;
      }
    } catch {
      console.error("can't connect");
    }
  }

  static async isRelayUp() {
    try {
      const url: string | undefined = process.env.REACT_APP_RELAY;
      if (url === undefined) return;
      const response = await fetch(url, {
        method: "HEAD",
        //mode: "no-cors",
      });
      if (response.ok) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.log(`Server is down`);
      return false;
    }
  }

  static async extractAssets(zipFile: File): Promise<File[]> {
    const zip = await JSZip.loadAsync(zipFile);

    const assetFiles = await Promise.all(
      Array.from(Object.entries(zip.files))
        .filter(([filename]) => !filename.startsWith("."))
        .map(async ([filename, file]) => {
          const blob = await file.async("blob");
          const type = mime.getType(filename) || "application/octet-stream";
          return new File([blob], filename, { type });
        })
    );

    return assetFiles;
  }

  private static async getChainJson(
    filename: string,
    files: File[]
  ): Promise<any> {
    const file = files.find((file) => file.name === filename);
    if (!file) throw new Error(`Invalid package: missing ${filename}`);
    return JSON.parse(await file.text());
  }

  static async checkDuplicateMessage(messages: any[]) {
    const uniqueItems = new Map();

    for (const message of messages) {
      const assets = await this.extractAssets(message.data.buffer);
      const chain = await this.getChainJson("chain.json", assets);
      const id = chain.id;
      const eventsLength = chain.events.length;

      if (
        !uniqueItems.has(id) ||
        eventsLength > uniqueItems.get(id).eventsLength
      ) {
        uniqueItems.set(id, { message, eventsLength });
      }
    }

    const uniqueMessages = Array.from(uniqueItems.values()).map(
      (item) => item.message
    );

    return uniqueMessages;
  }
}
