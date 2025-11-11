import {
  AnchorClient,
  Binary,
  Event,
  Message,
  ViemContract,
  ViemSigner,
} from "eqty-core";
import type { PublicClient, WalletClient } from "viem";
import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  parseAbiItem,
} from "viem";
import { base, baseSepolia } from "viem/chains";

const ZERO_HASH = Binary.fromHex("0x" + "0".repeat(64));

/**
 * EQTYService
 */
export default class EQTYService {
  private publicClient: PublicClient;
  private walletClient: WalletClient;
  private anchorClient: AnchorClient<any>;
  private anchorQueue: Array<{ key: Binary; value: Binary }> = [];
  public readonly signer: ViemSigner;

  private getChain() {
    switch (this.chainId) {
      case base.id:
        return base;
      case baseSepolia.id:
        return baseSepolia;
      default:
        throw new Error(`Unsupported chain ID: ${this.chainId}`);
    }
  }

  public constructor(
    public readonly address: string,
    public readonly chainId: number,
    walletClient?: WalletClient,
    publicClient?: PublicClient
  ) {
    const eth = EQTYService.ethereum;
    if (!eth) throw new Error("No Ethereum provider found. Connect a wallet.");

    const chain = this.getChain();

    this.walletClient =
      walletClient ||
      (createWalletClient({
        account: getAddress(address),
        chain,
        transport: custom(eth),
      }) as WalletClient);

    this.publicClient =
      publicClient ||
      (createPublicClient({
        chain,
        transport: custom(eth),
      }) as PublicClient);

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

  async anchor(
    ...anchors:
      | Array<{
          key: { hex: string } | Binary;
          value: { hex: string } | Binary;
        }>
      | Array<{ hex: string } | Binary>
  ): Promise<void> {
    if (anchors.length === 0) return;
    const toBinary = (b: any) =>
      b instanceof Binary ? b : Binary.fromHex(b.hex);
    const first = anchors[0] as any;

    if (first instanceof Binary || (first && (first as any).hex)) {
      const list = (anchors as Array<any>).map((b) => toBinary(b));
      for (const val of list) {
        this.anchorQueue.push({ key: val, value: ZERO_HASH });
      }
    } else {
      const list = (anchors as Array<any>).map(({ key, value }) => ({
        key: toBinary(key),
        value: toBinary(value),
      }));
      this.anchorQueue.push(...list);
    }
  }

  async submitAnchors(): Promise<string | undefined> {
    if (this.anchorQueue.length === 0) return undefined;

    const payload = this.anchorQueue.slice();
    this.anchorQueue = [];
    try {
      return await this.anchorClient.anchor(payload);
    } catch (err) {
      this.anchorQueue.unshift(...payload);
      throw err;
    }
  }

  async sign(...subjects: Array<Event | Message>): Promise<void> {
    for (const subject of subjects) {
      await subject.signWith(this.signer);
    }
  }

  async verifyAnchors(...anchors: any[]): Promise<{
    verified: boolean;
    anchors: Record<string, string | undefined>;
    map: Record<string, string>;
  }> {
    if (anchors.length === 0) {
      return { verified: false, anchors: {}, map: {} };
    }

    const contractAddress = AnchorClient.contractAddress(this.chainId);
    const anchorsMap: Record<string, string> = {};
    const txHashes: Record<string, string | undefined> = {};
    let allVerified = true;

    const anchorPairs: Array<{ key: Binary; value: Binary }> = [];

    const toBinary = (b: any) =>
      b instanceof Binary ? b : Binary.fromHex(b.hex);
    const first = anchors[0] as any;

    if (first instanceof Binary || (first && (first as any).hex)) {
      for (const anchor of anchors as Array<any>) {
        const key = toBinary(anchor);
        anchorPairs.push({ key, value: ZERO_HASH });
      }
    } else {
      for (const anchor of anchors as Array<any>) {
        anchorPairs.push({
          key: toBinary(anchor.key),
          value: toBinary(anchor.value),
        });
      }
    }

    const anchoredEvent = parseAbiItem(
      "event Anchored(bytes32 indexed key, bytes32 value, address indexed sender, uint64 timestamp)"
    );

    const currentBlock = await (this.publicClient as any).getBlockNumber();
    const maxBlockRange = BigInt(100000);
    const fromBlock =
      currentBlock > maxBlockRange ? currentBlock - maxBlockRange : BigInt(0);

    for (const { key, value } of anchorPairs) {
      try {
        const logs = await (this.publicClient as any).getLogs({
          address: contractAddress as `0x${string}`,
          event: anchoredEvent,
          args: {
            key: key.hex as `0x${string}`,
          },
          fromBlock: fromBlock,
          toBlock: currentBlock,
        });

        if (logs.length > 0) {
          const latestLog = logs[logs.length - 1];
          txHashes[key.hex] = latestLog.transactionHash;

          if (value.hex !== ZERO_HASH.hex) {
            const logValue = (latestLog.args as any).value;
            const normalizedLogValue =
              typeof logValue === "string" ? logValue.toLowerCase() : logValue;
            const normalizedExpectedValue = value.hex.toLowerCase();

            anchorsMap[key.hex] = normalizedLogValue;

            if (normalizedLogValue !== normalizedExpectedValue) {
              allVerified = false;
            }
          } else {
            anchorsMap[key.hex] = value.hex.toLowerCase();
          }
        } else {
          txHashes[key.hex] = undefined;
          anchorsMap[key.hex] = value.hex.toLowerCase();
          allVerified = false;
        }
      } catch (error) {
        console.error(`Failed to verify anchor ${key.hex}:`, error);
        txHashes[key.hex] = undefined;
        anchorsMap[key.hex] = value.hex.toLowerCase();
        allVerified = false;
      }
    }

    return {
      verified: allVerified,
      anchors: txHashes,
      map: anchorsMap,
    };
  }
}
