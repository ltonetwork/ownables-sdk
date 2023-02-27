import {Account, LTO, Transaction} from "@ltonetwork/lto"
import LocalStorageService from "./LocalStorage.service";
import {TypedTransaction} from "../interfaces/TypedTransaction";

export const lto = new LTO(process.env.REACT_APP_LTO_NETWORK_ID)
if (process.env.REACT_APP_LTO_API_URL) lto.nodeAddress = process.env.REACT_APP_LTO_API_URL;

export default class LTOService {
  static account?: Account;

  public static isUnlocked = (): boolean => {
    return !!LTOService.account;
  }

  public static unlock = async (password: string) => {
    const [encryptedAccount] = await LocalStorageService.get('@accountData');
    LTOService.account = lto.account({seedPassword: password, ...encryptedAccount});
  }

  public static lock = () => {
    delete LTOService.account;
  }

  public static getAccount = async (): Promise<Account> => {
    if (!LTOService.account) {
      throw new Error("Not logged in");
    }

    return LTOService.account;
  }

  public static storeAccount = async (nickname: string, password: string) => {
    if (!LTOService.account) {
      throw new Error("Account not created");
    }

    await LocalStorageService.set('@accountData', [{
      nickname: nickname,
      address: LTOService.account.address,
      seed: LTOService.account.encryptSeed(password),
    }]);
  }

  public static createAccount = async () => {
    try {
      LTOService.account = lto.account();
    } catch (error) {
      throw new Error('Error creating account');
    }
  }

  public static importAccount = async (seed: string) => {
    try {
      LTOService.account = lto.account({ seed: seed });
    } catch (error) {
      throw new Error('Error importing account from seeds');
    }
  }

  private static apiUrl = (path: string): string => {
    return lto.nodeAddress.replace(/\/$/g, '') + path;
  }

  public static getBalance = async (address: string) => {
    try {
      const url = LTOService.apiUrl(`/addresses/balance/details/${address}`);
      const response = await fetch(url);
      return response.json();
    } catch (error) {
      throw new Error('Error fetching account details');
    }
  }

  public static getTransactions = async (address: string, limit?: number, page = 1) => {
    const pending = await LTOService.getPendingTransactions(address);

    let offset
    if (!limit) {
      offset = 0;
      limit = 100;
    } else {
      offset = limit * (page - 1) - pending.length;
      if (offset < 0) {
        limit = limit + offset;
        offset = 0;
      }
    }

    return ([] as TypedTransaction[]).concat(
      pending.slice(limit * (page - 1), limit),
      limit > 0 ? await LTOService.getProcessedTransactions(address, limit, offset) : []
    );
  }

  private static getPendingTransactions = async (address: string) => {
    const url = LTOService.apiUrl(`/transactions/unconfirmed`);
    const response = await fetch(url);
    const utx: TypedTransaction[] = await response.json();

    const txs = utx.filter(tx => tx.sender === address || tx.recipient === address);
    txs.forEach(tx => { tx.pending = true });

    return txs;
  }

  private static getProcessedTransactions = async (address: string, limit = 100, offset = 0) => {
    const url = LTOService.apiUrl(`/transactions/address/${address}?limit=${limit}&offset=${offset}`);
    const response = await fetch(url);
    const [txs] = await response.json();

    return txs;
  }

  public static broadcast = async (transaction: Transaction) => {
    const url = LTOService.apiUrl('/transactions/broadcast');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transaction)
    });

    if (response.status >= 400) throw new Error('Broadcast transaction failed: ' + await response.text());
  }

  public static isValidAddress = (address: string): boolean => {
    try {
      return lto.isValidAddress(address);
    } catch (e) {
      return false;
    }
  }
}
