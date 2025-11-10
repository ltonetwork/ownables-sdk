import { EventChain, Message, Relay, Binary, IMessageMeta } from "eqty-core";
import JSZip from "jszip";
import mime from "mime/lite";
import { MessageExt } from "../interfaces/MessageInfo";
import EQTYService from "./EQTY.service";
import { SIWEClient, SIWEAuthResult } from "./SIWE.service";

const getMimeType = (filename: string): string | null | undefined =>
  (mime as any)?.getType?.(filename);

export class RelayService {
  public static readonly URL =
    process.env.REACT_APP_RELAY || process.env.REACT_APP_LOCAL;

  private static tokenStorage = new Map<
    string,
    { token: string; expiry: number }
  >();

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

    const stored = RelayService.tokenStorage.get(this.storageKey);
    if (stored) {
      this.authToken = stored.token;
      this.authExpiry = stored.expiry;
    }
  }

  /**
   * Clear authentication token for specific wallet (call when wallet changes)
   */
  static clearWalletAuth(address: string, chainId: number): void {
    const key = `${address}:${chainId}`;
    RelayService.tokenStorage.delete(key);
  }

  /**
   * Authenticate with the relay using SIWE
   */
  async authenticate(): Promise<SIWEAuthResult> {
    try {
      const result = await this.siweClient.authenticate(
        this.eqty.signer,
        RelayService.URL || "http://localhost:8000",
        this.eqty.chainId
      );

      if (result.success && result.token) {
        this.authToken = result.token;
        this.authExpiry = Date.now() + 24 * 60 * 60 * 1000;

        RelayService.tokenStorage.set(this.storageKey, {
          token: result.token,
          expiry: this.authExpiry,
        });
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

  /**
   * Check if authentication is valid and not expired
   */
  private isAuthenticated(): boolean {
    const hasToken = this.authToken !== null;
    const hasExpiry = this.authExpiry !== null;
    const notExpired = this.authExpiry !== null && Date.now() < this.authExpiry;

    const stored = RelayService.tokenStorage.get(this.storageKey);
    if (stored && Date.now() >= stored.expiry) {
      RelayService.tokenStorage.delete(this.storageKey);
      this.authToken = null;
      this.authExpiry = null;
    }

    return hasToken && hasExpiry && notExpired;
  }

  /**
   * Get authentication headers for API requests
   */
  getAuthHeaders(): Record<string, string> {
    if (!this.isAuthenticated()) {
      return {};
    }

    return {
      Authorization: `Bearer ${this.authToken}`,
    };
  }

  /**
   * Ensure authentication before making authenticated requests
   */
  async ensureAuthenticated(): Promise<boolean> {
    if (this.isAuthenticated()) {
      return true;
    }

    const result = await this.authenticate();

    return result.success;
  }

  /**
   * Send ownable to a recipient with optional anchoring.
   */
  async sendOwnable(
    recipient: string,
    content: Uint8Array,
    meta: Partial<IMessageMeta>,
    anchorBeforeSend: boolean = false
  ) {
    if (!recipient) {
      console.error("Recipient not provided");
      return;
    }

    try {
      const messageContent = Binary.from(content);
      const message = new Message(
        messageContent,
        "application/octet-stream",
        meta
      );

      await this.eqty.sign(message.to(recipient));

      if (anchorBeforeSend) {
        try {
          await this.eqty.anchor(message.hash);
        } catch (error) {
          console.warn(
            "RelayService: Failed to anchor message before sending:",
            error
          );
        }
      }

      await this.relay.send(message);
      return message.hash.base58;
    } catch (error) {
      console.error("Error sending message:", error);
      throw error;
    }
  }

  /**
   * Read a single message by its hash.
   */
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
      console.error("Error reading message:", error);
      throw error;
    }
  }

  /**
   * Read relay all messages for the current sender.
   */
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

  /**
   * Remove an ownable by its hash.
   */
  async removeOwnable(hash: string): Promise<void> {
    try {
      // Ensure authentication for inbox access
      await this.ensureAuthenticated();

      await this.relay.delete(
        `messages/${this.eqty.address}/${hash}`,
        this.getAuthHeaders()
      );
    } catch (error) {
      console.error("Error removing ownable:", error);
      throw new Error(`Failed to remove ownable from Relay: ${error}`);
    }
  }

  /**
   * Check if relay service is up.
   */
  async isAvailable(): Promise<boolean> {
    if (!RelayService.URL) return false;

    try {
      await this.relay.get("");
      return true;
    } catch (error) {
      console.error("Relay service is down:", error);
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
