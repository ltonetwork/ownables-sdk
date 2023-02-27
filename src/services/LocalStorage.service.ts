export default class LocalStorageService {
  static get(key: string): any {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : undefined;
  }

  static set(key: string, value: any): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  static append(key: string, value: any): void {
    const list = this.get(key) || [];
    if (!Array.isArray(list)) throw new Error(`Unable to append value in local storage: "${key} is not an array"`);

    list.push(value);
    this.set(key, list);
  }

  static addToSet(key: string, value: any): void {
    const list = this.get(key) || [];
    if (!Array.isArray(list)) throw new Error(`Unable to add value to set in local storage: "${key} is not an array"`);

    if (!list.includes(value)) list.push(value);
    this.set(key, list);
  }

  static remove(key: string): void {
    localStorage.removeItem(key);
  }

  static clear(): void {
    localStorage.clear();
  }
}
