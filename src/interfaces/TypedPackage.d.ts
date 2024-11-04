export interface TypedPackageCapabilities {
  isDynamic: boolean;
  hasMetadata: boolean;
  hasWidgetState: boolean;
  isConsumable: boolean;
  isConsumer: boolean;
  isTransferable: boolean;
  isBridgeable?: boolean;
}

export interface TypedPackage extends TypedPackageCapabilities {
  title: string;
  detail?;
  name: string;
  description?: string;
  cid: string;
  chain?;
  isNotLocal?: boolean;
  uniqueMessageHash?: string;
  versions: Array<{ date: Date; cid: string; uniqueMessageHash?: string }>;
  keywords?: string[];
}

export interface TypedPackageStub {
  title: string;
  name: string;
  description?: string;
  stub: true;
  isNotLocal?: boolean;
}
