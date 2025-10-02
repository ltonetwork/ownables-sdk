export default class LocalStorageService {
  private prefix: string;

  constructor(group: string = '') {
    this.prefix = group ? `${group}:` : '';
  }

  get(key: string): any {
    const value = localStorage.getItem(`${this.prefix}${key}`);
    return value ? JSON.parse(value) : undefined;
  }

  set(key: string, value: any): void {
    localStorage.setItem(`${this.prefix}${key}`, JSON.stringify(value));
  }

  append(key: string, value: any): void {
    const list = this.get(`${this.prefix}${key}`) || [];
    if (!Array.isArray(list))
      throw new Error(
        `Unable to append value in local storage: "${key} is not an array"`
      );

    list.push(value);
    this.set(`${this.prefix}${key}`, list);
  }

  remove(key: string): void {
    localStorage.removeItem(`${this.prefix}${key}`);
  }

  clear(): void {
    const keys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key);
      }
    }

    for (const key of keys) {
      localStorage.removeItem(key);
    }
  }

  removeItem(key: string, value: any): void {
    const list = this.get(`${this.prefix}${key}`);
    if (!Array.isArray(list))
      throw new Error(`"${this.prefix}${key}" is not an array in local storage`);

    const updatedList =
      typeof list[0] === "object"
        ? list.filter((item: any) => item[value] !== value)
        : list.filter((item: any) => item !== value);

    this.set(`${this.prefix}${key}`, updatedList);
  }

  removeByField(key: string, field: string, value: any): void {
    const list = this.get(`${this.prefix}${key}`);
    if (!Array.isArray(list))
      throw new Error(`"${this.prefix}${key}" is not an array in local storage`);
    const updatedList = list.filter((item: any) => item[field] !== value);
    this.set(`${this.prefix}${key}`, updatedList);
  }
}
