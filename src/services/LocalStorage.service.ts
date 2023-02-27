export default class LocalStorageService {
  static get(key: string): any {
    const value: any = localStorage.getItem(key);
    return JSON.parse(value);
  }

  static set(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  static remove(key: string): void {
    localStorage.removeItem(key);
  }

  static clear(): void {
    localStorage.clear();
  }
}
