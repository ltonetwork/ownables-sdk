import { ViemSigner } from "eqty-core";

export interface SIWEMessage {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}

export interface SIWEAuthResult {
  success: boolean;
  address?: string;
  token?: string;
  expiresIn?: string;
  error?: string;
}

export class SIWEClient {
  private readonly domain: string;
  private readonly version: string = "1";

  constructor(domain?: string) {
    this.domain = domain || "localhost:8000";
  }

  /**
   * Generates a nonce for SIWE authentication
   */
  generateNonce(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  /**
   * Creates a SIWE message template
   */
  createMessage(
    address: string,
    uri: string,
    chainId: number = 84532
  ): SIWEMessage {
    return {
      domain: this.domain,
      address,
      statement: "Sign in with Ethereum to the EQTY Relay",
      uri,
      version: this.version,
      chainId,
      nonce: this.generateNonce(),
      issuedAt: new Date().toISOString(),
    };
  }

  /**
   * Signs a SIWE message with the connected wallet
   */
  async signMessage(message: SIWEMessage, signer: ViemSigner): Promise<string> {
    const domain = {
      name: "Sign-In with Ethereum",
      version: this.version,
      chainId: message.chainId,
    };

    const types = {
      Message: [
        { name: "domain", type: "string" },
        { name: "address", type: "address" },
        { name: "statement", type: "string" },
        { name: "uri", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "nonce", type: "string" },
        { name: "issuedAt", type: "string" },
        { name: "expirationTime", type: "string" },
        { name: "notBefore", type: "string" },
        { name: "requestId", type: "string" },
        { name: "resources", type: "string[]" },
      ],
    };

    const value = {
      domain: message.domain,
      address: message.address,
      statement: message.statement || "",
      uri: message.uri,
      version: message.version,
      chainId: message.chainId,
      nonce: message.nonce,
      issuedAt: message.issuedAt,
      expirationTime: message.expirationTime || "",
      notBefore: message.notBefore || "",
      requestId: message.requestId || "",
      resources: message.resources || [],
    };

    return await signer.signTypedData(domain, types, value);
  }

  /**
   * Authenticates with the relay using SIWE
   */
  async authenticate(
    signer: ViemSigner,
    relayUrl: string,
    chainId: number = 84532
  ): Promise<SIWEAuthResult> {
    try {
      const address = await signer.getAddress();
      const uri = `${relayUrl}/auth/verify`;

      console.log("SIWEClient: Starting authentication", {
        address,
        relayUrl,
        chainId,
        uri,
      });

      // Create SIWE message
      const message = this.createMessage(address, uri, chainId);

      console.log("SIWEClient: Created message", {
        domain: message.domain,
        address: message.address,
        statement: message.statement,
        uri: message.uri,
        version: message.version,
        chainId: message.chainId,
        nonce: message.nonce,
        issuedAt: message.issuedAt,
      });

      // Sign the message
      const signature = await this.signMessage(message, signer);

      console.log("SIWEClient: Message signed", {
        signature: signature.substring(0, 10) + "...",
        signatureLength: signature.length,
      });

      // Send to relay for verification
      const response = await fetch(`${relayUrl}/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          signature,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.error || "Authentication failed",
        };
      }

      const result = await response.json();
      return {
        success: true,
        address: result.address,
        token: result.token,
        expiresIn: result.expiresIn,
      };
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
   * Gets a nonce from the relay
   */
  async getNonce(relayUrl: string): Promise<string> {
    try {
      const response = await fetch(`${relayUrl}/auth/nonce`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to get nonce");
      }

      const result = await response.json();
      return result.nonce;
    } catch (error) {
      throw new Error(
        `Failed to get nonce: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}
