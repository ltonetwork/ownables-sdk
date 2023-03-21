interface TypedCosmWasmMethod {
  required: string[];
  properties: {
    [methodName: string]: {}
  }
}

export interface TypedCosmWasmMsg {
  title: string;
  oneOf: Array<TypedCosmWasmMethod>;
}
