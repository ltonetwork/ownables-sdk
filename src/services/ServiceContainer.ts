import IDBService from './IDB.service';
import EventChainService from "./EventChain.service"
import OwnableService from "./Ownable.service"
import PackageService from "./Package.service"
import LocalStorageService from "./LocalStorage.service"
import { PollingService } from "./Polling.service"
import { RelayService } from "./Relay.service"
import EQTYService from "./EQTY.service"

export interface ServiceMap {
  relay: RelayService;
  localStorage: LocalStorageService;
  eqty: EQTYService;
  idb: IDBService;
  eventChains: EventChainService;
  packages: PackageService;
  ownables: OwnableService;
  polling: PollingService;
}

export type ServiceKey = keyof ServiceMap;

type ServiceFactory<T = any> = (container: ServiceContainer) => Promise<T> | T;

export default class ServiceContainer {
  private readonly cache = new Map<ServiceKey, any>();
  private readonly factories = new Map<ServiceKey, ServiceFactory>();

  constructor(public readonly address?: string, public readonly chainId?: number) {
    this.register('relay', async (c) => new RelayService());

    if (address && chainId) {
      this.register('eqty', async (c) => new EQTYService(c.address!, c.chainId!));

      this.register('idb', async (c) => {
        const s = new IDBService(`${c.chainId}:${c.address}`);
        await s.open();
        return s;
      });

      this.register('localStorage', async (c) =>
        new LocalStorageService(`${c.chainId}:${c.address}`),
      );

      this.register('eventChains', async (c) =>
        new EventChainService(await c.get('idb'), await c.get('eqty')),
      );

      this.register('packages', async (c) =>
        new PackageService(await c.get('idb'), await c.get('relay'), await c.get('localStorage')),
      );

      this.register('ownables', async (c) => new OwnableService(
        await c.get('idb'),
        await c.get('eventChains'),
        await c.get('eqty'),
        await c.get('packages'),
      ));

      this.register('polling', async (c) =>
        new PollingService(await c.get('relay'), await c.get('localStorage')),
      );
    }
  }

  private register<K extends ServiceKey>(key: K, factory: ServiceFactory<ServiceMap[K]>): void {
    this.factories.set(key, factory as ServiceFactory);
  }

  has(key: ServiceKey): boolean {
    return this.factories.has(key);
  }

  async get<K extends ServiceKey>(key: K): Promise<ServiceMap[K]> {
    if (!this.factories.has(key)) throw new Error(`No service factory registered for key: ${key}`);
    if (this.cache.has(key)) return this.cache.get(key)!;

    const instance = await this.factories.get(key)!(this);
    this.cache.set(key, instance);
    return instance;
  }

  async dispose(): Promise<void> {
    if (this.cache.has('idb')) {
      this.cache.get('idb').close();
    }
  }
}
