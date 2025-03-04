import { RelayService } from "./Relay.service";
import LocalStorageService from "./LocalStorage.service";

export class PollingService {
  /**
   * Fetch new message hashes from the server and compare with client hashes.
   */
  static async checkForNewHashes(address: string) {
    const clientHashes = LocalStorageService.get("messageHashes") || [];

    try {
      const url = `${RelayService.relayURL}/inboxes/${encodeURIComponent(
        address
      )}/list`;

      // const url = `${RelayService.relayURL}/inboxes/${encodeURIComponent(
      //   address
      // )}/list?limit=4&offset=0`;

      const headers: Record<string, string> = {};
      const lastModified = LocalStorageService.get("lastModified");

      if (!lastModified) {
        headers["If-Modified-Since"] = lastModified;
      }

      const requestOptions = Object.keys(headers).length > 0 ? { headers } : {};
      const response = await RelayService.handleSignedRequest(
        "GET",
        url,
        requestOptions
      );

      if (response.status === 304) {
        const messageCount = LocalStorageService.get("messageCount") || 0;
        return messageCount;
      }

      if (response.status === 200) {
        const serverHashes = response.data.metadata
          .filter((message: any) => message.hash)
          .map((message: any) => message.hash);

        const newLastModified = response.headers?.["last-modified"];
        if (newLastModified) {
          LocalStorageService.set("lastModified", newLastModified);
        }
        const newHashes = serverHashes.filter(
          (hash: string) => !clientHashes.includes(hash)
        );

        // Update local storage with messagehash count
        LocalStorageService.set("messageCount", newHashes.length);

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
  static startPolling(
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
  static clearCache() {
    LocalStorageService.remove("lastModified");
    LocalStorageService.remove("messageHashes");
  }
}
