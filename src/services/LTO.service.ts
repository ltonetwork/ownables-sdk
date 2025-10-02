// Dummy LTOService: intentionally does nothing. Always "unlocked" and never touches storage.
// This stub is temporary and will be removed later.

// Local placeholder types to keep the public API shape intact without importing @ltonetwork/lto
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Account = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Binary = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Transaction = any;

export default class LTOService {
  public static readonly networkId: string = "";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static _account?: Account;

  public static accountExists(): boolean {
    return false;
  }

  public static isUnlocked(): boolean {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static unlock(_password: string): void {
    // no-op
  }

  public static lock(): void {
    // no-op
  }

  public static get account(): Account {
    throw new Error("LTOService is a dummy service");
  }

  public static get address(): string {
    return "";
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static storeAccount(_nickname: string, _password: string): void {
    throw new Error("LTOService is a dummy service");
  }

  public static createAccount(): void {
    throw new Error("LTOService is a dummy service");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static importAccount(_seed: string): void {
    throw new Error("LTOService is a dummy service");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private static apiUrl(_path: string): string {
    throw new Error("LTOService is a dummy service");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static async getBalance(_address?: string): Promise<never> {
    throw new Error("LTOService is a dummy service");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static async broadcast(_transaction: Transaction): Promise<never> {
    throw new Error("LTOService is a dummy service");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static async anchor(
    ..._anchors: Array<{ key: Binary; value: Binary }> | Array<Binary>
  ): Promise<never> {
    throw new Error("LTOService is a dummy service");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static async transfer(
    _recipient: string,
    _amount: number | null
  ): Promise<never> {
    throw new Error("LTOService is a dummy service");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static async verifyAnchors(
    ..._anchors: Array<{ key: Binary; value: Binary }> | Array<Binary>
  ): Promise<never> {
    throw new Error("LTOService is a dummy service");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static isValidAddress(_address: string): boolean {
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static accountOf(_publicKey: Binary | string): string {
    throw new Error("LTOService is a dummy service");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static getNetwork(_ltoAddress: string): string {
    return "";
  }

  public static getAccount = async (): Promise<Account> => {
    throw new Error("LTOService is a dummy service");
  };
}
