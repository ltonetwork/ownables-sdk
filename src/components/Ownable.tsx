import {Component, createRef, RefObject} from "react";
import TypedDict from "../interfaces/TypedDict";
import {Paper} from "@mui/material";
import OwnableFrame from "./OwnableFrame";
import {Cancelled, connect as rpcConnect} from "simple-iframe-rpc";
import PackageService from "../services/Package.service";
import {EventChain, Event} from "@ltonetwork/lto";

// @ts-ignore - Loaded as string, see `craco.config.js`
import workerJsSource from "../assets/worker.js";
import OwnableActions from "./OwnableActions";
import OwnableInfo from "./OwnableInfo";
import LTOService from "../services/LTO.service";
import OwnableService, {StateDump} from "../services/Ownable.service";
import {TypedMetadata} from "../interfaces/TypedMetadata";

interface MsgInfo {
  sender: string;
  funds: Array<never>;
}

interface OwnableRPC {
  init: (id: string, js: string, wasm: Uint8Array) => Promise<any>;
  instantiate: (msg: TypedDict<any>, info: MsgInfo) => Promise<{result: TypedDict<any>, state: StateDump}>;
  execute: (msg: TypedDict<any>, info: MsgInfo, state: StateDump) => Promise<{result: TypedDict<any>, state: StateDump}>;
  externalEvent: (msg: TypedDict<any>, info: MsgInfo, state: StateDump) => Promise<{result: TypedDict<any>, state: StateDump}>;
  query: (msg: TypedDict<any>, state: StateDump) => Promise<TypedDict<any>>;
  refresh: (state: StateDump) => Promise<void>;
}

interface OwnableProps {
  chain: EventChain;
  pkgKey: string;
  onDelete: () => void;
}

interface OwnableState {
  rpc?: OwnableRPC;
  initialized: boolean;
  applied: EventChain;
  stateDump: StateDump;
  metadata?: TypedMetadata;
}

export default class Ownable extends Component<OwnableProps, OwnableState> {
  private readonly chain: EventChain;
  private readonly pkgKey: string;
  private readonly iframeRef: RefObject<HTMLIFrameElement>;
  private busy = false;

  constructor(props: OwnableProps) {
    super(props);

    this.chain = props.chain;
    this.pkgKey = props.pkgKey;
    this.iframeRef = createRef();

    this.state = {
      initialized: false,
      applied: new EventChain(this.chain.id),
      stateDump: [],
      metadata: { name: PackageService.nameOf(this.pkgKey) }
    };
  }

  get id(): string {
    return this.chain.id;
  }

  private async init(rpc: OwnableRPC): Promise<void> {
    const bindgenJs = await PackageService.getAssetAsText(this.pkgKey, 'bindgen.js');
    const js = workerJsSource + bindgenJs;

    const wasm = await PackageService.getAsset(
      this.pkgKey,
      'ownable_bg.wasm',
      (fr, file) => fr.readAsArrayBuffer(file)
    ) as ArrayBuffer;

    try {
      await rpc.init(this.id, js, new Uint8Array(wasm));
      await OwnableService.init(this.chain, this.pkgKey);
      this.setState({initialized: true});
    } catch (e) {
      if (!(e instanceof Cancelled)) throw e;
    }
  }

  private async refresh(stateDump?: StateDump, rpc?: OwnableRPC): Promise<void> {
    if (!rpc) rpc = this.state.rpc!;
    if (!stateDump) stateDump = this.state.stateDump;

    await rpc.refresh(stateDump);

    const metadata = await rpc.query({get_ownable_metadata: {}}, stateDump) as TypedMetadata;
    this.setState({metadata});
  }

  private async apply(partialChain: EventChain): Promise<void> {
    if (this.busy) return;
    this.busy = true;

    const rpc = this.state.rpc!;
    let stateDump = this.state.stateDump;
    let response: {result: TypedDict<any>, state: StateDump};

    for (const event of partialChain.events) {
      response = await this.applyEvent(rpc, event, stateDump);
      stateDump = response.state;
    }

    await this.refresh(stateDump, rpc);
    await OwnableService.store(this.chain, stateDump);

    this.setState({applied: this.chain, stateDump: stateDump});
    this.busy = false;
  }

  async applyEvent(rpc: OwnableRPC, event: Event, stateDump: StateDump) {
    const info = {
      sender: LTOService.account.publicKey,
      funds: [],
    }
    const {'@context': context, ...msg} = event.parsedData;

    switch (context) {
      case "instantiate_msg.json":
        return await rpc.instantiate(msg, info);
      case "execute_msg.json":
        return await rpc.execute(msg, info, stateDump);
      case "external_event_msg.json":
        return await rpc.execute(msg, info, stateDump);
      default:
        throw new Error(`Unknown event type`);
    }
  }

  async onLoad(): Promise<void> {
    if (this.state.rpc) {
      delete (this.state.rpc as any).handler; // In development mode, iframe might be replaced
      this.setState({initialized: false});
    }

    const iframeWindow = this.iframeRef.current!.contentWindow;
    const rpc = rpcConnect<Required<OwnableRPC>>(window, iframeWindow, "*", {timeout: 5000});
    this.setState({rpc});

    await this.init(rpc);
  }

  private windowMessageHandler = async (event: MessageEvent) => {
    if (!('ownable_id' in event.data) || event.data.ownable_id !== this.id || event.data.type !== 'execute') return;
    if (this.iframeRef.current!.contentWindow !== event.source)
      throw Error("Not allowed to execute msg on other Ownable");

    const {msg} = event.data;
    delete msg['@context']; // Shouldn't be set by widget

    const {state: stateDump} = await this.state.rpc!.execute(
      msg,
      {sender: LTOService.account.publicKey, funds: []},
      this.state.stateDump
    );

    new Event({"@context": `execute_msg.json`, ...msg}).addTo(this.chain).signWith(LTOService.account);
    await OwnableService.store(this.chain, stateDump);

    await this.refresh(stateDump);
    this.setState({applied: this.chain, stateDump});
  }

  async componentDidMount() {
    const stateDump = await OwnableService.getStateDump(this.chain.id, this.chain.state);
    if (stateDump !== null) {
      this.setState({applied: this.chain, stateDump});
    }

    window.addEventListener("message", this.windowMessageHandler);
  }

  shouldComponentUpdate(next: OwnableProps, {initialized, applied, metadata}: OwnableState): boolean {
    if (!initialized) return false;

    return !this.state.initialized ||
      this.chain.state.hex !== applied.state.hex ||
      this.state.metadata !== metadata;
  }

  async componentDidUpdate(_: OwnableProps, prev: OwnableState): Promise<void> {
    const partial = this.chain.startingAfter(this.state.applied.latestHash);

    if (partial.events.length > 0)
      await this.apply(partial);
    else if (this.state.initialized !== prev.initialized || this.state.applied.state.hex !== prev.applied.state.hex)
      await this.refresh();
  }

  componentWillUnmount() {
    if (this.state.rpc) delete (this.state.rpc as any).handler;
    window.removeEventListener("message", this.windowMessageHandler);
  }

  render() {
    return (
      <Paper sx={{aspectRatio: "1/1", position: 'relative'}}>
        <OwnableInfo sx={{position: 'absolute', left: 5, top: 5}} chain={this.chain} metadata={this.state.metadata}/>
        <OwnableActions
          sx={{position: 'absolute', right: 5, top: 5}}
          onDelete={this.props.onDelete}
        />
        <OwnableFrame id={this.id} pkgKey={this.pkgKey} iframeRef={this.iframeRef} onLoad={() => this.onLoad()}/>
      </Paper>
    )
  }
}
