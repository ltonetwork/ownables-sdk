import {
  Account,
  Binary,
  LTO,
  Transaction,
} from "@ltonetwork/lto";
import LocalStorageService from "./LocalStorage.service";
import SessionStorageService from "./SessionStorage.service";

export const lto = new LTO(process.env.REACT_APP_LTO_NETWORK_ID);
if (process.env.REACT_APP_LTO_API_URL)
  lto.nodeAddress = process.env.REACT_APP_LTO_API_URL;

const sessionSeed = SessionStorageService.get("@seed");

export default class LTOService {
  public static readonly networkId = lto.networkId;
  private static _account?: Account = sessionSeed
    ? lto.account({ seed: sessionSeed })
    : undefined;

  public static accountExists(): boolean {
    return !!LocalStorageService.get("@accountData");
  }

  public static isUnlocked(): boolean {
    return !!this._account;
  }

  public static unlock(password: string): void {
    const [encryptedAccount] = LocalStorageService.get("@accountData") || [];
    this._account = lto.account({
      seedPassword: password,
      ...encryptedAccount,
    });
    SessionStorageService.set("@seed", this._account.seed);
  }

  public static lock(): void {
    delete this._account;
    SessionStorageService.remove("@seed");
  }

  public static get account(): Account {
    if (!this._account) {
      throw new Error("Not logged in");
    }

    return this._account;
  }

  public static get address(): string {
    if (!!this._account) return this._account!.address;

    const [encryptedAccount] = LocalStorageService.get("@accountData") || [];
    if (encryptedAccount) return encryptedAccount.address;

    return "";
  }

  public static storeAccount(nickname: string, password: string): void {
    if (!this._account) {
      throw new Error("Account not created");
    }

    LocalStorageService.set("@accountData", [
      {
        nickname: nickname,
        address: this._account.address,
        seed: this._account.encryptSeed(password),
      },
    ]);

    SessionStorageService.set("@seed", this._account.seed);
  }

  public static createAccount(): void {
    try {
      this._account = lto.account();
    } catch (error) {
      throw new Error("Error creating account");
    }
  }

  public static importAccount(seed: string): void {
    try {
      this._account = lto.account({ seed: seed });
    } catch (error) {
      throw new Error("Error importing account from seeds");
    }
  }

  private static apiUrl(path: string): string {
    return lto.nodeAddress.replace(/\/$/g, "") + path;
  }

  public static async getBalance(address?: string) {
    if (!address) address = this.account.address;

    try {
      const url = this.apiUrl(`/addresses/balance/details/${address}`);
      const response = await fetch(url);
      return response.json();
    } catch (error) {
      throw new Error("Error fetching account details");
    }
  }

  public static async broadcast(transaction: Transaction) {
    const url = this.apiUrl("/transactions/broadcast");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(transaction),
    });

    if (response.status >= 400)
      throw new Error(
        "Broadcast transaction failed: " + (await response.text())
      );
  }

  public static async anchor(
    ...anchors: Array<{ key: Binary; value: Binary }> | Array<Binary>
  ): Promise<void> {
    if (anchors[0] instanceof Uint8Array) {
      await lto.anchor(this.account, ...(anchors as Array<Binary>));
    } else {
      await lto.anchor(
        this.account,
        ...(anchors as Array<{ key: Binary; value: Binary }>)
      );
    }
  }

  public static async verifyAnchors(
    ...anchors: Array<{ key: Binary; value: Binary }> | Array<Binary>
  ): Promise<any> {
    const data =
      anchors[0] instanceof Uint8Array
        ? (anchors as Array<Binary>).map((anchor) => anchor.hex)
        : Object.fromEntries(
            (anchors as Array<{ key: Binary; value: Binary }>).map(
              ({ key, value }) => [key.hex, value.hex]
            )
          );

    const url = this.apiUrl("/index/hash/verify?encoding=hex");
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return await response.json();
  }

  public static isValidAddress(address: string): boolean {
    try {
      return lto.isValidAddress(address);
    } catch (e) {
      return false;
    }
  }

  public static accountOf(publicKey: Binary | string): string {
    return lto.account({
      publicKey: publicKey instanceof Binary ? publicKey.base58 : publicKey,
    }).address;
  }
}
