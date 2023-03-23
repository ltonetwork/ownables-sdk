export interface TypedPackageCapabilities {
  isConsumable: boolean;
  isConsumer: boolean;
  isTransferable: boolean;
}

export interface TypedPackage extends TypedPackageCapabilities {
  title: string;
  name: string;
  cid: string;
  versions: Array<{date: Date, cid: string}>;
}

export interface TypedPackageStub {
  title: string;
  name: string;
  stub: true;
}
