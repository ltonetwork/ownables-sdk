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

      // Fetch only hashes via a signed request
      const response = await RelayService.handleSignedRequest("GET", url);

      if (response.status === 304) {
        console.log("No new hashes");
        return 0; // No updates
      }

      if (response.status === 200) {
        const serverHashes = response.data.hashes;

        // Compare client and server hashes to find new ones
        const newHashes = serverHashes.filter(
          (hash: string) => !clientHashes.includes(hash)
        );

        // Update local storage with the new hashes
        //LocalStorageService.set("messageHashes", serverHashes);

        return newHashes.length; // Return the count of new messages
      }
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
    const fetchHashes = async () => {
      try {
        const newCount = await this.checkForNewHashes(address);
        onUpdate(newCount); // Pass the count of new messages to the callback
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    // Set up the polling interval
    const intervalId = setInterval(fetchHashes, interval);

    // Return a function to stop polling
    return () => clearInterval(intervalId);
  }
}
