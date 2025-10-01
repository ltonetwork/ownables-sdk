import { EventChain, Message, Relay, Binary, IMessageMeta } from "eqty-core";
import { LTO } from "@ltonetwork/lto";
import axios from "axios";
import JSZip from "jszip";
import mime from "mime/lite";
import { MessageExt, MessageInfo } from "../interfaces/MessageInfo";

import { sign } from "@ltonetwork/http-message-signatures";
import LTOService from "./LTO.service";
import PackageService from "./Package.service";

const getMimeType = (filename: string): string | null | undefined => (mime as any)?.getType?.(filename);

export const lto = new LTO(process.env.REACT_APP_LTO_NETWORK_ID);

export class RelayService {
  static relayURL = process.env.REACT_APP_RELAY || process.env.REACT_APP_LOCAL;
  private static relay = new Relay(`${this.relayURL}`);

  /*
   * Handle All Signed Requests
   */
  static async handleSignedRequest(
    method: string,
    url: string,
    options: { headers?: Record<string, string> } = {}
  ) {
    try {
      const sender = LTOService.account;
      const request = {
        method,
        url,
        headers: {
          ...options.headers, // Include optional headers in the request
        },
      };

      const signedRequest = await sign(request, { signer: sender });

      const response = await axios({
        method: signedRequest.method,
        url: signedRequest.url,
        headers: {
          ...signedRequest.headers,
        },
        validateStatus: (status) => {
          return (status >= 200 && status < 300) || status === 304;
        },
      });

      return response;
    } catch (error) {
      console.error("Error in handleSignedRequest:", error);
      throw error;
    }
  }

  /**
   * Send ownable to a recipient.
   */
  static async sendOwnable(
    recipient: string,
    content: Uint8Array,
    meta: Partial<IMessageMeta>
  ) {
    const sender = LTOService.account;

    if (!recipient) {
      console.error("Recipient not provided");
      return;
    }

    try {
      if (sender) {
        const messageContent = Binary.from(content);

        //const recipientAccount = await lto.resolveAccount(recipient);

        const message = new Message(
          messageContent,
          "application/octet-stream",
          meta
        )
          .to(recipient)
          .signWith(sender);

        await this.relay.send(message);
        return message.hash.base58;
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  /**
   * Read a single message by its hash.
   */
  static async readMessage(hash: string) {
    const sender = LTOService.account;
    if (!sender) {
      console.error("Account not initialized");
      return null;
    }

    const address = sender.address;
    const url = `${this.relayURL}/inboxes/${address}/${hash}`;

    try {
      const response = await this.handleSignedRequest("GET", url);

      if (response?.data) {
        const message = Message.from(response.data);

        if (message.isEncrypted()) {
          message.decryptWith(sender);
        }

        return await PackageService.processPackage(message, hash, true);
      }

      return null;
    } catch (error) {
      console.error("Error reading single message:", error);
      return null;
    }
  }

  /**
   * Read relay data for the current sender.
   */
  static async readRelayData() {
    const sender = LTOService.account;

    if (!sender) {
      console.error("Account not initialized");
      return null;
    }

    const address = sender.address;
    const isRelayAvailable = await this.isRelayUp();
    if (!isRelayAvailable) return null;

    const url = `${this.relayURL}/v2/inboxes/${address}`;

    try {
      const responses = await this.handleSignedRequest("GET", url);

      if (!responses.data.messages?.length) return null;

      const ownableData = await Promise.all(
        responses.data.messages.map(async (response: MessageInfo) => {
          if (!response.hash) {
            console.warn("Skipping response without a hash:", response);
            return null;
          }

          const messageUrl = `${this.relayURL}/inboxes/${address}/${response.hash}`;
          try {
            const infoResponse = await this.handleSignedRequest(
              "GET",
              messageUrl
            );

            if (!infoResponse.data.sender) {
              console.warn("Skipping response without a sender:", infoResponse);
              return null;
            }

            const message = Message.from(infoResponse.data).decryptWith(sender);

            return { message, messageHash: infoResponse.data.hash };
          } catch (error) {
            console.error(
              `Failed to process message with hash ${response.hash}:`,
              error
            );
            return null;
          }
        })
      );
      return ownableData.filter((data) => data !== null);
    } catch (error) {
      console.error("Failed to read relay data:", error);
      return null;
    }
  }

  /**
   * Remove an ownable by its hash.
   */
  static async removeOwnable(hash: string): Promise<string> {
    const sender = LTOService.account;
    if (!sender) {
      throw new Error("Sender not initialized");
    }

    const address = sender.address;
    const url = `${this.relayURL}/inboxes/${address}/${hash}`;

    try {
      const response = await this.handleSignedRequest("DELETE", url);

      if (response?.status === 204) {
        return "Successfully cleared ownable";
      } else {
        throw new Error(`${response}`);
      }
    } catch (error) {
      console.error("Failed to remove ownable:", error);
      throw new Error("Failed to clear: " + error);
    }
  }

  /**
   * Check if relay service is up.
   */
  static async isRelayUp(): Promise<boolean> {
    if (!this.relayURL) return false;
    try {
      const response = await this.handleSignedRequest("HEAD", this.relayURL);
      if (response.status === 200) {
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error("Relay service is down:", error);
      return false;
    }
  }

  static async list(offset: number, limit: number) {
    const sender = await LTOService.getAccount();

    if (!sender) {
      console.error("Account not initialized");
      return null;
    }

    const address = sender.address;
    const isRelayAvailable = await this.isRelayUp();
    if (!isRelayAvailable) return null;

    const url = `${this.relayURL}/v2/inboxes/${address}?limit=${limit}&offset=${offset}`;

    try {
      const response = await this.handleSignedRequest("GET", url);
      return response.data || null;
    } catch (error) {
      console.error("Failed to read relay metadata:", error);
      return null;
    }
  }

  /**
   * Extract assets from a zip file.
   */
  static async extractAssets(zipFile: File | JSZip): Promise<File[]> {
    const zip =
      zipFile instanceof JSZip ? zipFile : await JSZip.loadAsync(zipFile);
    const assetFiles = await Promise.all(
      Object.entries(zip.files)
        .filter(([filename]) => !filename.startsWith("."))
        .map(async ([filename, file]) => {
          const blob = await file.async("blob");
          const type = getMimeType(filename) || "application/octet-stream";
          return new File([blob], filename, { type });
        })
    );
    return assetFiles;
  }

  /**
   * Get chain.json from a list of files.
   */
  private static async getChainJson(
    filename: string,
    files: File[]
  ): Promise<EventChain> {
    const file = files.find((f) => f.name === filename);
    if (!file) throw new Error(`Invalid package: missing ${filename}`);
    return JSON.parse(await file.text());
  }

  /**
   * Check and return unique messages, avoiding duplicates.
   */
  static async checkDuplicateMessage(messages: MessageExt[]) {
    const uniqueItems = new Map<
      string,
      { message: Message; eventsLength: number; messageHash: string }
    >();

    for (const messageExt of messages) {
      const { message, messageHash } = messageExt;

      if (!message || !messageHash) {
        console.error("Message or messageHash is missing.");
        continue;
      }

      const data = message.data;
      if (!data) {
        console.error("Message data is missing.");
        continue;
      }

      const assets = await this.extractAssets(data.buffer);
      const chain = await this.getChainJson("chain.json", assets);

      const currentLength = uniqueItems.get(chain.id)?.eventsLength || 0;
      if (chain.events.length > currentLength) {
        uniqueItems.set(chain.id, {
          message,
          eventsLength: chain.events.length,
          messageHash,
        });
      }
    }

    return Array.from(uniqueItems.values()).map(({ message, messageHash }) => ({
      message,
      messageHash,
    }));
  }
}
