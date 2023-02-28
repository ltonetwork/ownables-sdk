import {Account, LTO, Transaction} from "@ltonetwork/lto"
import LocalStorageService from "./LocalStorage.service";

export const lto = new LTO(process.env.REACT_APP_LTO_NETWORK_ID)
if (process.env.REACT_APP_LTO_API_URL) lto.nodeAddress = process.env.REACT_APP_LTO_API_URL;

export default class LTOService {
  static _account?: Account;

  public static accountExists(): boolean {
    return !!LocalStorageService.get('@accountData');
  }

  public static isUnlocked(): boolean {
    return !!this._account;
  }

  public static unlock(password: string): void {
    const [encryptedAccount] = LocalStorageService.get('@accountData');
    this._account = lto.account({seedPassword: password, ...encryptedAccount});
  }

  public static lock(): void {
    delete this._account;
  }

  public static get account(): Account {
    if (!this._account) {
      throw new Error("Not logged in");
    }

    return this._account;
  }

  public static storeAccount(nickname: string, password: string): void {
    if (!this._account) {
      throw new Error("Account not created");
    }

    LocalStorageService.set('@accountData', [{
      nickname: nickname,
      address: this._account.address,
      seed: this._account.encryptSeed(password),
    }]);
  }

  public static createAccount(): void {
    try {
      this._account = lto.account();
    } catch (error) {
      throw new Error('Error creating account');
    }
  }

  public static importAccount(seed: string): void {
    try {
      this._account = lto.account({ seed: seed });
    } catch (error) {
      throw new Error('Error importing account from seeds');
    }
  }

  private static apiUrl(path: string): string {
    return lto.nodeAddress.replace(/\/$/g, '') + path;
  }

  public static async getBalance(address: string) {
    try {
      const url = this.apiUrl(`/addresses/balance/details/${address}`);
      const response = await fetch(url);
      return response.json();
    } catch (error) {
      throw new Error('Error fetching account details');
    }
  }

  public static async broadcast(transaction: Transaction) {
    const url = this.apiUrl('/transactions/broadcast');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transaction)
    });

    if (response.status >= 400) throw new Error('Broadcast transaction failed: ' + await response.text());
  }

  public static isValidAddress(address: string): boolean {
    try {
      return lto.isValidAddress(address);
    } catch (e) {
      return false;
    }
  }
}
