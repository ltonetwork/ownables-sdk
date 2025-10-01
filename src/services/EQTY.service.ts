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
  private static _publicClient?: PublicClient;
  private static _walletClient?: WalletClient;
  private static _anchorClient?: AnchorClient<any>;
  private static _lastChainId?: number;
  private static _lastAddress?: `0x${string}`;

  private static get ethereum(): any {
    return (window as any).ethereum;
  }

  private static async getChainId(): Promise<number> {
    const eth = this.ethereum;
    if (!eth) throw new Error('No Ethereum provider found. Connect a wallet.');
    const hex = (await eth.request({ method: 'eth_chainId' })) as string;
    return parseInt(hex, 16);
  }

  private static async getAddress(requireAccount = false): Promise<`0x${string}` | undefined> {
    const eth = this.ethereum;
    if (!eth) throw new Error('No Ethereum provider found.');
    const method = requireAccount ? 'eth_requestAccounts' : 'eth_accounts';
    const accounts: string[] = await eth.request({ method });
    return (accounts?.[0] as `0x${string}` | undefined) ?? undefined;
  }

  private static async getClients(requireAccount = false): Promise<{
    walletClient: WalletClient;
    publicClient: PublicClient;
    anchorClient: AnchorClient<any>;
    chainId: number;
  }> {
    const eth = this.ethereum;
    if (!eth) throw new Error('No Ethereum provider found. Connect a wallet.');

    const [rawAddress, chainId] = await Promise.all([
      this.getAddress(requireAccount),
      this.getChainId(),
    ]);

    if (!rawAddress) throw new Error('Wallet not connected');

    const address = getAddress(rawAddress);

    // Return cached clients if chain and address are unchanged
    if (this.isCached(chainId, address)) {
      return {
        walletClient: this._walletClient!,
        publicClient: this._publicClient!,
        anchorClient: this._anchorClient!,
        chainId,
      };
    }

    const walletClient = createWalletClient({
      account: address,
      transport: custom(eth),
    });

    const publicClient = createPublicClient({
      transport: custom(eth),
    });

    const contract = new ViemContract(
      publicClient,
      walletClient,
      AnchorClient.contractAddress(chainId)
    );

    const anchorClient = new AnchorClient(contract);
    this._publicClient = publicClient;
    this._walletClient = walletClient;
    this._anchorClient = anchorClient;
    this._lastChainId = chainId;
    this._lastAddress = address as `0x${string}`;

    return { walletClient, publicClient, anchorClient, chainId };
  }

  private static isCached(chainId: number, address: string): boolean {
    return !!(this._publicClient && this._walletClient && this._anchorClient
      && this._lastChainId === chainId
      && this._lastAddress && this._lastAddress.toLowerCase() === address.toLowerCase());
  }

  static async signer(): Promise<ViemSigner> {
    const { walletClient } = await this.getClients(true);
    return new ViemSigner(walletClient);
  }

  /**
   * Current connected address from the wallet (via viem). Empty string if unavailable.
   * Prefer wagmi useAccount() in components.
   */
  static async address(): Promise<string> {
    try {
      const acc = await this.getAddress(false);
      return acc ? getAddress(acc) : '';
    } catch {
      return '';
    }
  }

  /**
   * Anchor one or multiple entries to Base (or Base Sepolia) using eqty-core.
   * Accepts an array of Binary values or key/value pairs of Binaries.
   */
  static async anchor(
    ...anchors: Array<{ key: { hex: string } | Binary; value: { hex: string } | Binary }> | Array<{ hex: string } | Binary>
  ): Promise<void> {
    if (anchors.length === 0) return;

    const { anchorClient } = await this.getClients(true);

    const first = anchors[0] as any;

    const toBinary = (b: any) => (b instanceof Binary ? b : Binary.fromHex(b.hex));

    if (first instanceof Binary || (first && (first as any).hex)) {
      // list of Binary or IBinary
      const list = (anchors as Array<any>).map((b) => toBinary(b));
      await anchorClient.anchor(list);
    } else {
      // list of { key, value }
      const list = (anchors as Array<any>).map(({ key, value }) => ({
        key: toBinary(key),
        value: toBinary(value),
      }));
      await anchorClient.anchor(list);
    }
  }

  /**
   * Verifies anchors via Ownable bridge
   */
  static async verifyAnchors(
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

  // ---------------- Deprecated LTO-like methods (kept temporarily) ----------------

  /** @deprecated */
  static accountExists(): boolean {
    console.warn('[EQTYService] accountExists is deprecated. Accounts are managed by external wallets.');
    return false;
  }
  /** @deprecated */
  static isUnlocked(): boolean {
    console.warn('[EQTYService] isUnlocked is deprecated. Use wagmi useAccount().');
    return false;
  }
  /** @deprecated */
  static unlock(_password: string): void {
    console.warn('[EQTYService] unlock is deprecated and has no effect.');
  }
  /** @deprecated */
  static lock(): void {
    console.warn('[EQTYService] lock is deprecated. Disconnect via your wallet UI.');
  }
  /** @deprecated */
  static get account(): any {
    console.warn('[EQTYService] account getter is deprecated. Use wagmi useAccount() and viem clients.');
    return undefined;
  }
  /** Get current chain id from provider. Prefer wagmi in components. */
  static async networkId(): Promise<number> {
    return this.getChainId();
  }
  /** @deprecated */
  static get addressSync(): string {
    console.warn('[EQTYService] address getter is deprecated. Use wagmi useAccount().');
    return '';
  }
  /** @deprecated */
  static storeAccount(_nickname: string, _password: string): void {
    console.warn('[EQTYService] storeAccount is deprecated and disabled.');
  }
  /** @deprecated */
  static createAccount(): void {
    console.warn('[EQTYService] createAccount is deprecated. Use an external wallet.');
  }
  /** @deprecated */
  static importAccount(_seed: string): void {
    console.warn('[EQTYService] importAccount is deprecated. Use your wallet to import accounts.');
  }
  /** @deprecated */
  static async getBalance(_address?: string): Promise<any> {
    console.warn('[EQTYService] getBalance is deprecated. Query via viem publicClient instead.');
    return {};
  }
  /** @deprecated */
  static async broadcast(_tx: any): Promise<any> {
    console.warn('[EQTYService] broadcast is deprecated. Use viem/wagmi for transactions.');
    return {};
  }
  /** @deprecated */
  static async transfer(_recipient: string, _amount: number | null) {
    console.warn('[EQTYService] transfer is deprecated. Use your wallet for transfers.');
    return 'deprecated';
  }
  /** @deprecated */
  static isValidAddress(address: string): boolean {
    try {
      return !!getAddress(address as `0x${string}`);
    } catch {
      return false;
    }
  }
  /** @deprecated */
  static accountOf(_publicKey: any): string {
    console.warn('[EQTYService] accountOf is deprecated.');
    return '';
  }
  /** @deprecated */
  static getNetwork(_address: string): string {
    console.warn('[EQTYService] getNetwork is deprecated.');
    return '';
  }
  /** @deprecated */
  static async getAccount(): Promise<any> {
    console.warn('[EQTYService] getAccount is deprecated. Use wagmi useAccount() and viem.');
    return undefined;
  }
}
