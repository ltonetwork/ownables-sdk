export interface TypedPackage {
  title: string;
  name: string;
  cid: string;
  versions: Array<{date: Date, cid: string}>,
}

export interface TypedPackageStub {
  title: string;
  name: string;
  stub: true;
}
