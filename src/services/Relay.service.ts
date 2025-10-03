import { EventChain, Message, Relay, Binary, IMessageMeta } from "eqty-core";
import axios from "axios";
import JSZip from "jszip";
import mime from "mime/lite";
import { MessageExt, MessageInfo } from "../interfaces/MessageInfo";

import EQTYService from "./EQTY.service"

const getMimeType = (filename: string): string | null | undefined => (mime as any)?.getType?.(filename);

export class RelayService {
  public static readonly URL = process.env.REACT_APP_RELAY || process.env.REACT_APP_LOCAL;

  private relay: Relay;

  constructor(private readonly eqty: EQTYService) {
    this.relay = new Relay(`${RelayService.URL}`);
  }

  /*
   * Handle all Requests
   */
  private async fetch(
    method: string,
    url: string,
    options: { headers?: Record<string, string> } = {}
  ) {
    try {
      return await axios({
        method,
        url,
        headers: {
          ...options.headers,
        },
        validateStatus: (status) => {
          return (status >= 200 && status < 300) || status === 304;
        },
      });
    } catch (error) {
      console.error("Error in Relay fetch:", error);
      throw error;
    }
  }

  /**
   * Send ownable to a recipient.
   */
  async sendOwnable(
    recipient: string,
    content: Uint8Array,
    meta: Partial<IMessageMeta>
  ) {
    if (!recipient) {
      console.error("Recipient not provided");
      return;
    }

    try {
      const messageContent = Binary.from(content);

      const message = await new Message(
        messageContent,
        "application/octet-stream",
        meta
      )
        .to(recipient)
        .signWith(this.eqty.signer)

      await this.relay.send(message);
      return message.hash.base58;
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  /**
   * Read a single message by its hash.
   */
  async readMessage(hash: string): Promise<{ message?: any; hash?: string }> {
    const url = `${RelayService.URL}/inboxes/${this.eqty.address}/${hash}`;

    const response = await this.fetch("GET", url);

    if (!response?.data) {
      throw new Error("Invalid response");
    }

    const message = Message.from(response.data);
    return { message, hash };
  }

  /**
   * Read relay all messages for the current sender.
   */
  async readAll() {
    const list = await this.list();

    const ownableData = await Promise.all(
      list.map(async (response: MessageInfo) => this.readMessage(response.hash).catch(() => null)),
    );

    return ownableData.filter((data) => data !== null);
  }

  /**
   * Remove an ownable by its hash.
   */
  async removeOwnable(hash: string): Promise<void> {
    const url = `${RelayService.URL}/inboxes/${this.eqty.address}/${hash}`;
    const response = await this.fetch("DELETE", url);

    if (response?.status !== 204) {
      throw new Error(`Failed to remove ownanble from Relay: Server responded with ${response}`);
    }
  }

  /**
   * Check if relay service is up.
   */
  async isRelayUp(): Promise<boolean> {
    if (!RelayService.URL) return false;

    try {
      const response = await this.fetch("HEAD", RelayService.URL);
      return response.status === 200;
    } catch (error) {
      console.error("Relay service is down:", error);
      return false;
    }
  }

  async list(offset: number = 0, limit: number = 0) {
    const isRelayAvailable = await this.isRelayUp();
    if (!isRelayAvailable) return null;

    const url = `${RelayService.URL}/v2/inboxes/${this.eqty.address}?limit=${limit}&offset=${offset}`;

    try {
      const response = await this.fetch("GET", url);
      return response.data || null;
    } catch (error) {
      console.error("Failed to read relay metadata:", error);
      return null;
    }
  }

  /**
   * Extract assets from a zip file.
   */
  async extractAssets(zipFile: File | JSZip): Promise<File[]> {
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
  private async getChainJson(
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
  async checkDuplicateMessage(messages: MessageExt[]) {
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
