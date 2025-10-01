import IDBService from './IDB.service';
import EventChainService from "./EventChain.service"
import OwnableService from "./Ownable.service"
import PackageService from "./Package.service"
import LocalStorageService from "./LocalStorage.service"
import { PollingService } from "./Polling.service"
import { RelayService } from "./Relay.service"
import EQTYService from "./EQTY.service"

export type ServiceKey = 'idb' | string;

type Disposable = { dispose?: () => Promise<void> | void; close?: () => Promise<void> | void };

type ServiceFactory<T = any> = (container: ServiceContainer) => T;

export default class ServiceContainer {
  private readonly cache = new Map<ServiceKey, any>();
  private readonly factories = new Map<ServiceKey, ServiceFactory>();

  constructor(public readonly address?: string, public readonly chainId?: number) {
    this.register('relay', (c) => new RelayService());

    if (address && chainId) {
      this.register('eqty', (c) => new EQTYService(c.address!, c.chainId!));
      this.register('idb', (c) => new IDBService(`${c.chainId}:${c.address}`));
      this.register('localStorage', (c) => new LocalStorageService(`${c.chainId}:${c.address}`));
      this.register('eventChains', (c) => new EventChainService(c.get('idb'), c.get('eqty')));
      this.register('packages', (c) => new PackageService(c.get('relay'), c.get('localStorage')));
      this.register('ownables', (c) => new OwnableService(c.get('eventChains'), c.get('eqty'), c.get('packages')));
      this.register('polling', (c) => new PollingService(c.get('relay'), c.get('localStorage')));
    }
  }

  register<T>(key: ServiceKey, factory: ServiceFactory<T>): void {
    this.factories.set(key, factory as ServiceFactory);
  }

  has(key: ServiceKey): boolean {
    return this.factories.has(key);
  }

  get<T = any>(key: ServiceKey): T {
    if (this.cache.has(key)) return this.cache.get(key);
    const factory = this.factories.get(key);
    if (!factory) throw new Error(`No service factory registered for key: ${key}`);
    const instance = factory(this);
    this.cache.set(key, instance);
    return instance as T;
  }

  async dispose(): Promise<void> {
    const entries = Array.from(this.cache.values()) as Array<Disposable>;
    this.cache.clear();
    for (const svc of entries) {
      try {
        if (typeof svc.close === 'function') await svc.close();
        else if (typeof svc.dispose === 'function') await svc.dispose();
      } catch (_) {
        // swallow individual service dispose errors
      }
    }
  }
}
