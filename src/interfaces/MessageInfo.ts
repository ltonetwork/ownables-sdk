import { Binary } from "@ltonetwork/lto";

export interface MessageInfo {
  hash: string;
  recipient: string;
  sender: string | Object;
  size: number;
  timestamp: Date;
  type: string;
}

export interface MessageExt extends MessageInfo {
  data: any;
  sender: Object;
  signature: Binary;
  _hash: Binary;
  parsedData: string;
  messageHash?: string | any;
  message?: MessageExt | any;
}
