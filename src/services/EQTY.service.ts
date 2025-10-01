import { AnchorClient, Binary, ViemContract, ViemSigner } from 'eqty-core';
import type { PublicClient, WalletClient } from 'viem';
import { createPublicClient, createWalletClient, custom, getAddress } from 'viem';

const BRIDGE_URL = process.env.REACT_APP_BRIDGE;

/**
 * EQTYService
 *
 * Migration shim replacing LTOService anchoring with eqty-core AnchorClient using viem.
 * Prefer using wagmi hooks in React components to retrieve account information.
 */
export default class EQTYService {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private anchorClient: AnchorClient<any>;
  public readonly signer: ViemSigner;

  public constructor(
    public readonly address: string,
    public readonly chainId: number,
  ) {
    const eth = EQTYService.ethereum;
    if (!eth) throw new Error('No Ethereum provider found. Connect a wallet.');

    this.walletClient = createWalletClient({
      account: getAddress(address),
      transport: custom(eth),
    });

    this.publicClient = createPublicClient({
      transport: custom(eth),
    });

    const contract = new ViemContract(
      this.publicClient,
      this.walletClient,
      AnchorClient.contractAddress(this.chainId)
    );
    this.anchorClient = new AnchorClient(contract);

    this.signer = new ViemSigner(this.walletClient);
  }

  private static get ethereum(): any {
    return (window as any).ethereum;
  }

  /**
   * Anchor one or multiple entries to Base (or Base Sepolia) using eqty-core.
   * Accepts an array of Binary values or key/value pairs of Binaries.
   */
  async anchor(
    ...anchors: Array<{ key: { hex: string } | Binary; value: { hex: string } | Binary }> | Array<{ hex: string } | Binary>
  ): Promise<void> {
    if (anchors.length === 0) return;

    const first = anchors[0] as any;

    const toBinary = (b: any) => (b instanceof Binary ? b : Binary.fromHex(b.hex));

    if (first instanceof Binary || (first && (first as any).hex)) {
      // list of Binary or IBinary
      const list = (anchors as Array<any>).map((b) => toBinary(b));
      await this.anchorClient.anchor(list);
    } else {
      // list of { key, value }
      const list = (anchors as Array<any>).map(({ key, value }) => ({
        key: toBinary(key),
        value: toBinary(value),
      }));
      await this.anchorClient.anchor(list);
    }
  }

  /**
   * Verifies anchors via Ownable bridge
   */
  async verifyAnchors(
    ...anchors: any[]
  ): Promise<any> {
    if (!BRIDGE_URL) return { verified: false, anchors: {}, map: {} };

    const data =
      anchors[0] instanceof Uint8Array
        ? (anchors as Array<Binary>).map((anchor) => anchor.hex)
        : Object.fromEntries(
          (anchors as Array<{ key: Binary; value: Binary }>).map(
            ({ key, value }) => [key.hex, value.hex]
          )
        );
    const url = `${BRIDGE_URL}/verify`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return await response.json();
  }
}
