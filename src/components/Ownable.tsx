import {Component, createRef, RefObject} from "react";
import {Paper} from "@mui/material";
import OwnableFrame from "./OwnableFrame";
import {connect as rpcConnect} from "simple-iframe-rpc";
import PackageService from "../services/Package.service";
import {EventChain} from "@ltonetwork/lto";
import OwnableActions from "./OwnableActions";
import OwnableInfo from "./OwnableInfo";
import OwnableService, {OwnableRPC, StateDump} from "../services/Ownable.service";
import {TypedMetadata} from "../interfaces/TypedMetadata";
import isObject from "../utils/isObject";
import AlertDialog from "./AlertDialog";
import {AlertColor} from "@mui/material/Alert/Alert";

interface OwnableProps {
  chain: EventChain;
  pkgKey: string;
  selected: boolean;
  onDelete: () => void;
  onConsume: () => void;
}

interface OwnableState {
  initialized: boolean;
  applied: EventChain;
  stateDump: StateDump;
  metadata?: TypedMetadata;
  alert: {title: string, message: string, severity: AlertColor}|null
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
      metadata: { name: PackageService.nameOf(this.pkgKey) },
      alert: null
    };
  }

  get id(): string {
    return this.chain.id;
  }

  private async refresh(stateDump?: StateDump): Promise<void> {
    if (!stateDump) stateDump = this.state.stateDump;

    await OwnableService.rpc(this.id).refresh(stateDump);

    const metadata = await OwnableService.rpc(this.id).query({get_ownable_metadata: {}}, stateDump) as TypedMetadata;
    this.setState({metadata});
  }

  private async apply(partialChain: EventChain): Promise<void> {
    if (this.busy) return;
    this.busy = true;

    const stateDump =
      await OwnableService.getStateDump(this.id, partialChain.state) || // Used stored statedump if available
      await OwnableService.apply(partialChain, this.state.stateDump);

    await this.refresh(stateDump);

    this.setState({applied: this.chain, stateDump});
    this.busy = false;
  }

  async onLoad(): Promise<void> {
    const iframeWindow = this.iframeRef.current!.contentWindow;
    const rpc = rpcConnect<Required<OwnableRPC>>(window, iframeWindow, "*", {timeout: 5000});

    const initialized = await OwnableService.init(this.chain, this.pkgKey, rpc);
    this.setState({initialized});
  }

  private windowMessageHandler = async (event: MessageEvent) => {
    if (!isObject(event.data) || !('ownable_id' in event.data) || event.data.ownable_id !== this.id) return;
    if (this.iframeRef.current!.contentWindow !== event.source)
      throw Error("Not allowed to execute msg on other Ownable");

    let stateDump: StateDump;

    try {
      stateDump = await OwnableService.execute(this.chain, event.data.msg, this.state.stateDump);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith('Custom Error val:')) throw error;
      this.setState({ alert: {
        title: "The Ownable returned an error",
        message: error.message.replace(/^Custom Error val: "(.+)"$/, '$1'),
        severity: "error",
      }})
      return;
    }

    await OwnableService.store(this.chain, stateDump);

    await this.refresh(stateDump);
    this.setState({applied: this.chain, stateDump});
  }

  async componentDidMount() {
    window.addEventListener("message", this.windowMessageHandler);
  }

  shouldComponentUpdate(nextProps: OwnableProps, nextState: OwnableState): boolean {
    if (!nextState.initialized) return false;

    return !this.state.initialized ||
      this.chain.state.hex !== nextState.applied.state.hex ||
      this.props.selected !== nextProps.selected ||
      this.state.metadata !== nextState.metadata ||
      this.state.alert !== nextState.alert;
  }

  async componentDidUpdate(_: OwnableProps, prev: OwnableState): Promise<void> {
    const partial = this.chain.startingAfter(this.state.applied.latestHash);

    if (partial.events.length > 0)
      await this.apply(partial);
    else if (this.state.initialized !== prev.initialized || this.state.applied.state.hex !== prev.applied.state.hex)
      await this.refresh();
  }

  componentWillUnmount() {
    OwnableService.clearRpc(this.id);
    window.removeEventListener("message", this.windowMessageHandler);
  }

  render() {
    return <>
      <Paper sx={{
        aspectRatio: "1/1",
        position: 'relative',
        animation: this.props.selected ? "bounce .4s ease infinite alternate" : ''
      }}>
        <OwnableInfo sx={{position: 'absolute', left: 5, top: 5}} chain={this.chain} metadata={this.state.metadata}/>
          <OwnableActions
            sx={{position: 'absolute', right: 5, top: 5}}
            onDelete={this.props.onDelete}
            onConsume={this.props.onConsume}
          />
        <OwnableFrame id={this.id} pkgKey={this.pkgKey} iframeRef={this.iframeRef} onLoad={() => this.onLoad()}/>
      </Paper>
      <AlertDialog
        open={this.state.alert !== null}
        onClose={() =>this.setState({alert: null})}
        {...this.state.alert}
      >
        <>{this.state.alert?.message}</>
      </AlertDialog>
    </>
  }
}
