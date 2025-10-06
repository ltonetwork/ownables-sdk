import IDBService from './IDB.service';
import EventChainService from "./EventChain.service"
import OwnableService from "./Ownable.service"
import PackageService from "./Package.service"
import LocalStorageService from "./LocalStorage.service"
import { PollingService } from "./Polling.service"
import { RelayService } from "./Relay.service"
import EQTYService from "./EQTY.service"
import BuilderService from "./Builder.service"

export interface ServiceMap {
  relay: RelayService;
  localStorage: LocalStorageService;
  eqty: EQTYService;
  idb: IDBService;
  eventChains: EventChainService;
  packages: PackageService;
  ownables: OwnableService;
  polling: PollingService;
  builder: BuilderService;
}

export type ServiceKey = keyof ServiceMap;

type ServiceFactory<T = any> = (container: ServiceContainer) => Promise<T> | T;

export default class ServiceContainer {
  private readonly cache = new Map<ServiceKey, Promise<any>>();
  private readonly factories = new Map<ServiceKey, ServiceFactory>();

  constructor(public readonly address: string, public readonly chainId: number) {
    this.register('eqty', async (c) => new EQTYService(c.address!, c.chainId!));

    this.register('idb', async (c) =>
      IDBService.open(`${c.chainId}:${c.address}`),
    );

    this.register('localStorage', async (c) =>
      new LocalStorageService(`${c.chainId}:${c.address}`),
    );

    this.register('relay', async (c) =>
      new RelayService(await c.get('eqty')),
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

    this.register('builder', async (c) => new BuilderService(c.chainId!));
  }

  get key() {
    return `${this.address}:${this.chainId}`;
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

    const promise = this.factories.get(key)!(this);
    this.cache.set(key, promise);

    return await promise;
  }

  async dispose(): Promise<void> {
    if (this.cache.has('idb')) {
      (await this.cache.get('idb')).close();
    }
  }
}
