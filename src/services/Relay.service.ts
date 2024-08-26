import { EventChain, LTO, Message, Relay } from "@ltonetwork/lto";
import SessionStorageService from "./SessionStorage.service";
import axios from "axios";
import sendFile from "./relayhelper.service";
import JSZip from "jszip";
import mime from "mime/lite";
import { MessageExt, MessageInfo } from "../interfaces/MessageInfo";
import { sign } from "@ltonetwork/http-message-signatures";

export const lto = new LTO(process.env.REACT_APP_LTO_NETWORK_ID);
export class RelayService {
  private static seed = SessionStorageService.get("@seed");

  private static relayURL =
    process.env.REACT_APP_RELAY || process.env.REACT_APP_LOCAL_RELAY;
  private static relay = new Relay(`${RelayService.relayURL}`);
  private static sender = lto.account({ seed: RelayService.seed });

  static async sendOwnable(recipient: string, content?: Uint8Array) {
    try {
      if (RelayService.sender && recipient) {
        await sendFile(
          RelayService.relay,
          content,
          RelayService.sender,
          recipient
        );
      } else {
        console.error("No recipient provided");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  static async readRelayData() {
    try {
      const Address = this.sender.address;
      const isRelayAvailable = await RelayService.isRelayUp();
      if (!isRelayAvailable) return null;

      const responses = await axios.get(`${this.relayURL}/inboxes/${Address}/`);

      const ownableData = await Promise.all(
        responses.data.map(async (response: MessageInfo) => {
          const infoResponse = await axios.get(
            `${this.relayURL}/inboxes/${Address}/${response.hash}`
          );
          const messageHash = infoResponse.data.hash;
          const message = Message.from(infoResponse.data);
          return { message, messageHash };
        })
      );

      if (ownableData.length < 1) return null;
      return ownableData;
    } catch (error) {
      console.error("Error reading relay data:", error);
      return null;
    }
  }

  static async removeOwnable(hash: string) {
    const address = this.sender.address;
    //const signerPublicKey = this.sender.publicKey;

    const request = {
      method: "DELETE",
      url: `${this.relayURL}/${address}/${hash}/`,
      headers: {},
    };

    const signedRequest = await sign(request, { signer: this.sender });

    const response = await fetch(signedRequest.url, {
      method: signedRequest.method,
      headers: signedRequest.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to delete: ${response.statusText}`);
    }

    console.log("Ownable deleted successfully");
  }

  static async isRelayUp(): Promise<boolean> {
    try {
      const url: string | undefined = RelayService.relayURL;
      if (!url) return false;
      const response = await fetch(url, {
        method: "HEAD",
      });
      return response.ok;
    } catch (error) {
      console.error("Server is down:", error);
      return false;
    }
  }

  static async extractAssets(zipFile: File | JSZip): Promise<File[]> {
    let zip;
    if (!(zipFile instanceof JSZip)) {
      zip = await JSZip.loadAsync(zipFile);
    } else {
      zip = zipFile;
    }

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
  ): Promise<EventChain> {
    const file = files.find((file) => file.name === filename);
    if (!file) throw new Error(`Invalid package: missing ${filename}`);
    return JSON.parse(await file.text());
  }

  static async checkDuplicateMessage(messages: MessageExt[]) {
    const uniqueItems = new Map();

    for (const theMessage of messages) {
      const { message, ...theHash } = theMessage;
      const data = message?.data;
      const assets = await this.extractAssets(data.buffer);
      const chain = await this.getChainJson("chain.json", assets);
      const id = chain.id;
      const eventsLength = chain.events.length;

      if (
        !uniqueItems.has(id) ||
        eventsLength > uniqueItems.get(id).eventsLength
      ) {
        const { messageHash } = theHash;
        uniqueItems.set(id, { message, eventsLength, messageHash });
      }
    }

    return Array.from(uniqueItems.values()).map((item) => ({
      message: item.message,
      messageHash: item.messageHash,
    }));
  }
}
