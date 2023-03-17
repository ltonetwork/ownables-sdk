export interface TypedPackage {
  name: string;
  key: string;
  cid: string;
  versions: Array<{date: Date, cid: string}>,
}

export interface TypedPackageStub {
  name: string;
  key: string;
  stub: true;
}
