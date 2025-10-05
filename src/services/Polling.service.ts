import { RelayService } from "./Relay.service";
import LocalStorageService from "./LocalStorage.service";

export class PollingService {
  private tries = 3;
  private intervalId?: ReturnType<typeof setInterval>;

  constructor(private readonly relay: RelayService, private readonly localStorage: LocalStorageService) {}

  /**
   * Fetch new message hashes from the server and compare with client hashes.
   */
  async checkForNewHashes(address: string) {
    const pkgs = this.localStorage.get("packages") || [];
    const clientHashes = pkgs.map((msg: any) => {
      return msg.uniqueMessageHash;
    });

    try {
      const url = `${RelayService.URL}/inboxes/${encodeURIComponent(
        address
      )}`;

      const headers: Record<string, string> = {};
      const lastModified = this.localStorage.get("lastModified");

      if (lastModified) {
        headers["If-Modified-Since"] = lastModified;
      }

      const requestOptions = Object.keys(headers).length > 0 ? { headers } : {};
      const response = await this.relay.fetch(
        "GET",
        url,
        requestOptions
      );

      if (response.status === 304) {
        return this.localStorage.get("messageCount") || 0;
      }

      if (response.status === 200) {
        const serverHashes = response.data
          .filter((message: any) => message.hash)
          .map((message: any) => message.hash);

        const newLastModified = response.headers?.["last-modified"];
        if (newLastModified) {
          this.localStorage.set("lastModified", newLastModified);
        }
        const newHashes = serverHashes.filter(
          (hash: string) => !clientHashes.includes(hash)
        );

        this.localStorage.set("messageCount", newHashes.length);

        return newHashes.length;
      }
    } catch (error) {
      console.error("Error fetching message hashes:", error);

      if (this.tries-- <= 0) {
        this.tries = 3;
        this.stopPolling();
      }
    }

    return 0;
  }

  /**
   * Start polling for message hash updates.
   */
  startPolling(
    address: string,
    onUpdate: (count: number) => void,
    interval = 15000
  ): () => void {
    if (this.intervalId || !RelayService.URL) {
      return () => {};
    }

    this.checkForNewHashes(address).then(onUpdate);

    const fetchHashes = async () => {
      try {
        const newCount = await this.checkForNewHashes(address);
        onUpdate(newCount);
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    this.intervalId = setInterval(fetchHashes, interval);

    //cleanup
    return () => {
      clearInterval(this.intervalId);
    };
  }

  stopPolling(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  /**
   * Clear cached headers and hashes
   */
  clearCache() {
    this.localStorage.remove("lastModified");
  }
}
