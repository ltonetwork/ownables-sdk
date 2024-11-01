// import { io } from "socket.io-client";
// import LocalStorageService from "./LocalStorage.service";
// import { TypedPackage } from "../interfaces/TypedPackage";

// export class CheckForMessages {
//   static socket: any;

//   static initializeWebSocket() {
//     if (!this.socket) {
//       const relayUrl =
//         process.env.RELAY_WS_URL || "http://localhost:8080/messages";

//       const wsUrl = relayUrl.replace(/^http(s)?:\/\//, (match, isSecure) =>
//         isSecure ? "wss://" : "ws://"
//       );

//       this.socket = io(wsUrl, {
//         transports: ["websocket"],
//       });

//       // Listen for WebSocket events
//       this.socket.on("connect", () => {
//         console.log("Connected to WebSocket server");
//       });

//       this.socket.on("newMessageCount", (data: any) => {
//         console.log("New message count:", data.count);
//         console.log("New message hashes:", data.newHashes);
//       });

//       this.socket.on("connect_error", (error: any) => {
//         console.error("Connection error:", error);
//       });

//       this.socket.on("disconnect", () => {
//         console.log("Disconnected from WebSocket server");
//       });
//     }
//   }

//   static async getNewMessageCount(address: string) {
//     try {
//       this.initializeWebSocket();
//       const packagesInfo = await LocalStorageService.get("packages");
//       let knownHashes: any[];
//       console.log(packagesInfo);

//       if (packagesInfo) {
//         knownHashes = packagesInfo
//           .map((item: TypedPackage) => item.uniqueMessageHash)
//           .filter(Boolean);
//       } else {
//         knownHashes = [];
//       }

//       if (this.socket.connected) {
//         this.socket.emit("checkNewMessageCount", { address, knownHashes });
//       } else {
//         console.error("Socket is not connected yet.");
//       }
//     } catch (error) {
//       console.error("Failed to get new message count:", error);
//     }
//   }

//   static startPolling(address: string) {
//     setInterval(() => {
//       this.getNewMessageCount(address);
//     }, 5000);
//   }
// }

//import { TypedPackage } from "../interfaces/TypedPackage";
import LocalStorageService from "./LocalStorage.service";
import { RelayService } from "./Relay.service";

export class CheckForMessages {
  static async getMessageHashOnClient(): Promise<string[]> {
    const knownHashes = await LocalStorageService.get("messageHashes");
    return Array.isArray(knownHashes) ? knownHashes : [];
  }

  static async getServerHashes() {
    const serverHashes = await RelayService.readInboxHashes();
    return serverHashes;
  }

  static async getNewMessageCount() {
    try {
      const clientHashes = await this.getMessageHashOnClient();
      const serverHashes = (await this.getServerHashes()) || [];

      const newMessages = serverHashes.filter(
        (hash) => !clientHashes.includes(hash)
      );

      return newMessages.length;
    } catch (error) {
      console.error("Failed to get new message count:", error);
      return 0;
    }
  }
}
