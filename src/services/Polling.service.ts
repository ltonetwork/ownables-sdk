import { RelayService } from "./Relay.service";
import LocalStorageService from "./LocalStorage.service";

export class PollingService {
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
      const response = await this.relay.handleSignedRequest(
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

      return 0;
    } catch (error) {
      console.error("Error fetching message hashes:", error);
      return 0;
    }
  }

  /**
   * Start polling for message hash updates.
   */
  startPolling(
    address: string,
    onUpdate: (count: number) => void,
    interval = 15000
  ): () => void {
    this.checkForNewHashes(address).then(onUpdate);

    const fetchHashes = async () => {
      try {
        const newCount = await this.checkForNewHashes(address);
        onUpdate(newCount);
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    const intervalId = setInterval(fetchHashes, interval);

    //cleanup
    return () => {
      clearInterval(intervalId);
    };
  }

  /**
   * Clear cached headers and hashes
   */
  clearCache() {
    this.localStorage.remove("lastModified");
  }
}
