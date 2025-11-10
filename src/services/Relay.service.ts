import { EventChain, Message, Relay, Binary, IMessageMeta } from "eqty-core";
import JSZip from "jszip";
import mime from "mime/lite";
import { MessageExt } from "../interfaces/MessageInfo";
import EQTYService from "./EQTY.service";
import { SIWEClient, SIWEAuthResult } from "./SIWE.service";
import { LogProgress, withProgress } from "../contexts/Progress.context";

const getMimeType = (filename: string): string | null | undefined =>
  (mime as any)?.getType?.(filename);

export class RelayService {
  public static readonly URL =
    process.env.REACT_APP_RELAY || process.env.REACT_APP_LOCAL;
  private static readonly STORAGE_PREFIX = "relay_siwe_token:";

  public readonly relay: Relay;
  private readonly siweClient: SIWEClient;
  private authToken: string | null = null;
  private authExpiry: number | null = null;
  private readonly storageKey: string;

  constructor(private readonly eqty: EQTYService) {
    this.relay = new Relay(`${RelayService.URL}`);
    this.siweClient = new SIWEClient();

    // Create unique storage key per wallet
    this.storageKey = `${this.eqty.address}:${this.eqty.chainId}`;

    // Load token from localStorage on initialization
    this.loadTokenFromStorage();
  }

  private loadTokenFromStorage(): void {
    try {
      const storageKey = `${RelayService.STORAGE_PREFIX}${this.storageKey}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.expiry && Date.now() < data.expiry) {
          this.authToken = data.token;
          this.authExpiry = data.expiry;
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {}
  }

  private saveTokenToStorage(token: string, expiry: number): void {
    try {
      const storageKey = `${RelayService.STORAGE_PREFIX}${this.storageKey}`;
      localStorage.setItem(storageKey, JSON.stringify({ token, expiry }));
    } catch (error) {}
  }

  static clearWalletAuth(address: string, chainId: number): void {
    const key = `${RelayService.STORAGE_PREFIX}${address}:${chainId}`;
    localStorage.removeItem(key);
  }

  async authenticate(): Promise<SIWEAuthResult> {
    try {
      const result = await this.siweClient.authenticate(
        this.eqty.signer,
        RelayService.URL || "http://localhost:8000",
        this.eqty.chainId
      );

      if (result.success && result.token) {
        this.authToken = result.token;
        let expiresIn: number;
        if (result.expiresIn) {
          const expiresInStr = String(result.expiresIn);

          if (expiresInStr.endsWith("h")) {
            const hours = parseInt(expiresInStr);
            expiresIn = hours * 60 * 60 * 1000;
          } else if (expiresInStr.endsWith("m")) {
            const minutes = parseInt(expiresInStr);
            expiresIn = minutes * 60 * 1000;
          } else {
            expiresIn = parseInt(expiresInStr) * 1000;
          }
        } else {
          expiresIn = 24 * 60 * 60 * 1000;
        }
        this.authExpiry = Date.now() + expiresIn;

        this.saveTokenToStorage(this.authToken, this.authExpiry);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Authentication failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  }

  private isAuthenticated(): boolean {
    if (this.authToken === null || this.authExpiry === null) {
      this.loadTokenFromStorage();
    }

    const hasToken = this.authToken !== null;
    const hasExpiry = this.authExpiry !== null;
    const notExpired = this.authExpiry !== null && Date.now() < this.authExpiry;

    if (hasExpiry && !notExpired) {
      this.authToken = null;
      this.authExpiry = null;
      const storageKey = `${RelayService.STORAGE_PREFIX}${this.storageKey}`;
      localStorage.removeItem(storageKey);
      return false;
    }

    return hasToken && hasExpiry && notExpired;
  }

  getAuthHeaders(): Record<string, string> {
    if (!this.isAuthenticated()) {
      return {};
    }

    return {
      Authorization: `Bearer ${this.authToken}`,
    };
  }

  async ensureAuthenticated(): Promise<boolean> {
    if (this.isAuthenticated()) {
      return true;
    }

    const result = await this.authenticate();
    return result.success;
  }

  async sendOwnable(
    recipient: string,
    content: Uint8Array,
    meta: Partial<IMessageMeta>,
    anchorBeforeSend: boolean = false,
    onProgress?: LogProgress
  ) {
    if (!recipient) {
      throw new Error("Recipient not provided");
    }

    const step = withProgress(onProgress);

    try {
      await this.ensureAuthenticated();

      const messageContent = Binary.from(content);
      const message = new Message(
        messageContent,
        "application/octet-stream",
        meta
      );

      // Step: Sign relay message and send (will be represented as a single UI step)
      await step(
        "signMessage",
        () => this.eqty.sign(message.to(recipient)),
        () => ({ hash: message.hash.base58 })
      );

      if (anchorBeforeSend) {
        try {
          // Queue message hash; actual submission will include any previously queued event anchors
          await this.eqty.anchor(message.hash);
        } catch (error) {
          console.warn(
            "RelayService: Failed during anchoring before sending:",
            error
          );
        }
      }

      await this.relay.send(message);

      return message.hash.base58;
    } catch (error) {
      throw error;
    }
  }

  async readMessage(hash: string): Promise<{ message?: any; hash?: string }> {
    try {
      await this.ensureAuthenticated();

      const response = await this.relay.get(
        `messages/${this.eqty.address}/${hash}`,
        this.getAuthHeaders()
      );

      let messageData;
      if (response && typeof response === "object") {
        if ("message" in response) {
          messageData = response.message;
        } else {
          messageData = response;
        }
      } else {
        throw new Error("Invalid response format");
      }

      if (!messageData) {
        throw new Error("No message data found in response");
      }

      const message = Message.from(messageData);
      return { message, hash };
    } catch (error) {
      throw error;
    }
  }

  async readAll() {
    const list = await this.list();

    if (!list) return [];

    const ownableData = await Promise.all(
      list.messages.map(async (response: any) =>
        this.readMessage(response.hash).catch(() => null)
      )
    );

    return ownableData.filter((data) => data !== null);
  }

  async removeOwnable(hash: string): Promise<void> {
    try {
      await this.ensureAuthenticated();

      await this.relay.delete(
        `messages/${this.eqty.address}/${hash}`,
        this.getAuthHeaders()
      );
    } catch (error) {
      throw new Error(`Failed to remove ownable from Relay: ${error}`);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!RelayService.URL) return false;

    try {
      await this.relay.get("");
      return true;
    } catch (error) {
      return false;
    }
  }

  async list(
    offset: number = 0,
    limit: number = 0
  ): Promise<{ messages: any[]; total: number; hasMore: boolean } | null> {
    const isRelayAvailable = await this.isAvailable();
    if (!isRelayAvailable) return null;

    try {
      await this.ensureAuthenticated();

      const response = await this.relay.get(
        `messages/${this.eqty.address}?limit=${limit}&offset=${offset}`,
        this.getAuthHeaders()
      );
      const responseData = response as any;
      if (responseData.messages) {
        return {
          messages: responseData.messages || [],
          total: responseData.total || responseData.messages.length,
          hasMore: responseData.hasMore || false,
        };
      } else if (Array.isArray(responseData)) {
        return {
          messages: responseData,
          total: responseData.length,
          hasMore: false,
        };
      } else {
        return {
          messages: [],
          total: 0,
          hasMore: false,
        };
      }
    } catch (error) {
      return null;
    }
  }

  async extractAssets(zipFile: File | JSZip): Promise<File[]> {
    const zip =
      zipFile instanceof JSZip ? zipFile : await JSZip.loadAsync(zipFile);

    return await Promise.all(
      Object.entries(zip.files)
        .filter(([filename]) => !filename.startsWith("."))
        .map(async ([filename, file]) => {
          const blob = await file.async("blob");
          const type = getMimeType(filename) || "application/octet-stream";
          return new File([blob], filename, { type });
        })
    );
  }

  private async getChainJson(
    filename: string,
    files: File[]
  ): Promise<EventChain> {
    const file = files.find((f) => f.name === filename);
    if (!file) throw new Error(`Invalid package: missing ${filename}`);
    return JSON.parse(await file.text());
  }

  async checkDuplicateMessage(messages: MessageExt[]) {
    const uniqueItems = new Map<
      string,
      { message: Message; eventsLength: number; messageHash: string }
    >();

    for (const messageExt of messages) {
      const { message, messageHash } = messageExt;

      if (!message || !messageHash) {
        continue;
      }

      const data = message.data;
      if (!data) {
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
