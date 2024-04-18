export interface TypedPackageCapabilities {
  isDynamic: boolean;
  hasMetadata: boolean;
  hasWidgetState: boolean;
  isConsumable: boolean;
  isConsumer: boolean;
  isTransferable: boolean;
}

export interface TypedPackage extends TypedPackageCapabilities {
  title: string;
  name: string;
  description?: string;
  cid: string;
  versions: Array<{date: Date, cid: string}>;
}

export interface TypedPackageStub {
  title: string;
  name: string;
  description?: string;
  stub: true;
}
