//import { Cancelled, connect as rpcConnect } from "simple-iframe-rpc";
const { Cancelled, connect } = require("simple-iframe-rpc");
const { LTO } = require("@ltonetwork/lto");
const {
  EventChain,
  Event,
  Binary,
  Account,
  Transaction,
} = require("@ltonetwork/lto");
const { Relay, Message } = require("@ltonetwork/lto/messages");
const { IEventChainJSON } = require("@ltonetwork/lto");
const mime = require("mime/lite");
//const { BaseBlockstore } = require("blockstore-core");

module.exports = {
  Cancelled,
  connect,
  LTO,
  EventChain,
  Event,
  Binary,
  IEventChainJSON,
  Account,
  Transaction,
  mime,
  Relay,
  Message,
};
