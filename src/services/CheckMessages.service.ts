import { io } from "socket.io-client";
import LocalStorageService from "./LocalStorage.service";
import { TypedPackage } from "../interfaces/TypedPackage";

export class CheckForMessages {
  static socket: any;

  static initializeWebSocket() {
    if (!this.socket) {
      this.socket = io("ws://localhost:8080/messages", {
        transports: ["websocket"],
      });

      // Listen for WebSocket events
      this.socket.on("connect", () => {
        console.log("Connected to WebSocket server");
      });

      this.socket.on("newMessageCount", (data: any) => {
        console.log("New message count:", data.count);
        console.log("New message hashes:", data.newHashes);
      });

      this.socket.on("connect_error", (error: any) => {
        console.error("Connection error:", error);
      });

      this.socket.on("disconnect", () => {
        console.log("Disconnected from WebSocket server");
      });
    }
  }

  static async getNewMessageCount(address: string) {
    try {
      this.initializeWebSocket();
      const packagesInfo = await LocalStorageService.get("packages");
      let knownHashes: any[];
      console.log(packagesInfo);

      if (packagesInfo) {
        knownHashes = packagesInfo
          .map((item: TypedPackage) => item.uniqueMessageHash)
          .filter(Boolean);
      } else {
        knownHashes = [];
      }

      if (this.socket.connected) {
        this.socket.emit("checkNewMessageCount", { address, knownHashes });
      } else {
        console.error("Socket is not connected yet.");
      }
    } catch (error) {
      console.error("Failed to get new message count:", error);
    }
  }

  static startPolling(address: string) {
    setInterval(() => {
      this.getNewMessageCount(address);
    }, 5000);
  }
}
