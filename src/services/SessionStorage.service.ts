export default class SessionStorageService {
  static get(key: string): any {
    const value = sessionStorage.getItem(key);
    return value ? JSON.parse(value) : undefined;
  }

  static set(key: string, value: any): void {
    sessionStorage.setItem(key, JSON.stringify(value));
  }

  static remove(key: string): void {
    sessionStorage.removeItem(key);
  }

  static clear(): void {
    sessionStorage.clear();
  }
}
