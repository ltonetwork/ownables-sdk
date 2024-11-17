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
      )}/hashes`;

      // Get cached ETag and Last-Modified values if they exist
      const headers: Record<string, string> = {};
      const etag = LocalStorageService.get("messageEtag");
      const lastModified = LocalStorageService.get("lastModified");

      if (etag) {
        headers["If-None-Match"] = etag;
      }
      if (lastModified) {
        headers["If-Modified-Since"] = lastModified;
      }

      //pass headers
      const requestOptions = Object.keys(headers).length > 0 ? { headers } : {};
      const response = await RelayService.handleSignedRequest(
        "GET",
        url,
        requestOptions
      );

      // Handle 304 Not Modified
      if (response.status === 304) {
        const messageCount = LocalStorageService.get("messageCount") || 0;
        return messageCount;
      }

      if (response.status === 200) {
        const serverHashes = response.data.hashes;

        const newEtag = response.headers?.etag;
        if (newEtag) {
          LocalStorageService.set("messageEtag", newEtag);
        }

        // Store new Last-Modified if available
        const newLastModified = response.headers?.["last-modified"];
        if (newLastModified) {
          LocalStorageService.set("lastModified", newLastModified);
        }

        // Compare client and server hashes to find new ones
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

    //cleanup function
    return () => {
      clearInterval(intervalId);
    };
  }

  /**
   * Clear cached headers and hashes - call this on logout
   */
  static clearCache() {
    LocalStorageService.remove("messageEtag");
    LocalStorageService.remove("lastModified");
    LocalStorageService.remove("messageHashes");
  }
}
