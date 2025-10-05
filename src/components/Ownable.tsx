import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Paper, Tooltip } from "@mui/material";
import OwnableFrame from "./OwnableFrame";
import { Cancelled, connect as rpcConnect } from "simple-iframe-rpc";
import { Binary, EventChain, IMessageMeta } from "eqty-core";
import OwnableActions from "./OwnableActions";
import OwnableInfo from "./OwnableInfo";
import { OwnableRPC, StateDump } from "../services/Ownable.service";
import { TypedMetadata, TypedOwnableInfo } from "../interfaces/TypedOwnableInfo";
import isObject from "../utils/isObject";
import ownableErrorMessage from "../utils/ownableErrorMessage";
import TypedDict from "../interfaces/TypedDict";
import { TypedPackage } from "../interfaces/TypedPackage";
import Overlay, { OverlayBanner } from "./Overlay";
import If from "./If";
import { enqueueSnackbar } from "notistack";
import { PACKAGE_TYPE } from "../constants";
import { useService } from "../hooks/useService";
import { useAccount } from "wagmi"

interface OwnableProps {
  chain: EventChain;
  packageCid: string;
  selected: boolean;
  uniqueMessageHash?: string;
  onDelete: () => void;
  onConsume: (info: TypedOwnableInfo) => void;
  onRemove: () => void;
  onError: (title: string, message: string) => void;
  children?: ReactNode;
}

export default function Ownable(props: OwnableProps) {
  const { chain, packageCid, uniqueMessageHash, selected, children } = props;

  const ownables = useService('ownables');
  const packages = useService('packages');
  const idb = useService('idb');
  const eventChains = useService('eventChains');
  const relay = useService('relay');
  const { address } = useAccount();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const busyRef = useRef(false);

  const pkg: TypedPackage | undefined = useMemo(() => {
    if (!packages) return undefined;
    return packages.info(packageCid, uniqueMessageHash);
  }, [packages, packageCid, uniqueMessageHash]);

  const [initialized, setInitialized] = useState(false);
  const [applied, setApplied] = useState<any>(
    new EventChain(chain.id).latestHash
  );
  const [stateDump, setStateDump] = useState<StateDump>([]);
  const [info, setInfo] = useState<TypedOwnableInfo | undefined>(undefined);
  const [metadata, setMetadata] = useState<TypedMetadata>({
    name: pkg?.title ?? '',
    description: pkg?.description,
  });
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Keep metadata in sync once pkg becomes available
  useEffect(() => {
    if (pkg) {
      setMetadata({ name: pkg.title, description: pkg.description });
    }
  }, [pkg]);

  const isTransferred = !!info && info.owner !== address && info.owner !== undefined;

  const resizeToThumbnail = useCallback(async (file: File): Promise<Blob> => {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = URL.createObjectURL(file);
    });

    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get canvas context");

    ctx.drawImage(img, 0, 0, 50, 50);

    const quality = 0.8;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );

    if (!blob) throw new Error("Failed to create thumbnail blob");
    if (blob.size > 256 * 1024) throw new Error("Compressed thumbnail still exceeds 256KB");
    return blob;
  }, []);

  const constructMeta = useCallback(async (): Promise<Partial<IMessageMeta>> => {
    if (!pkg || !idb) return {};
    const title = pkg.title;
    const description = pkg.description ?? "";
    const type = PACKAGE_TYPE;

    let thumbnail: Binary | undefined;

    const thumbnailFile = await idb.get(
      `package:${pkg.cid}`,
      "thumbnail.webp"
    );

    if (thumbnailFile) {
      const resizedFile = await resizeToThumbnail(thumbnailFile);
      const buffer = await resizedFile.arrayBuffer();
      thumbnail = Binary.from(new Uint8Array(buffer));
    }

    return { type, title, description, thumbnail: thumbnail?.base64 };
  }, [idb, pkg, resizeToThumbnail]);

  const refresh = useCallback(async (sd?: StateDump): Promise<void> => {
    if (!ownables || !pkg) return;
    let effective = sd ?? stateDump;

    if (pkg.hasWidgetState) await ownables.rpc(chain.id).refresh(effective);

    const infoResp = (await ownables.rpc(chain.id).query(
      { get_info: {} },
      effective
    )) as TypedOwnableInfo;

    const metadataResp = pkg.hasMetadata
      ? ((await ownables.rpc(chain.id).query(
          { get_metadata: {} },
          effective
        )) as TypedMetadata)
      : metadata;

    setInfo(infoResp);
    setMetadata(metadataResp);
  }, [chain.id, metadata, ownables, pkg, stateDump]);

  const apply = useCallback(async (partialChain: EventChain): Promise<void> => {
    if (!ownables || !eventChains) return;
    if (busyRef.current) return;
    busyRef.current = true;
    setIsApplying(true);

    try {
      const sd =
        (await eventChains.getStateDump(chain.id, partialChain.state.hex)) ||
        (await ownables.apply(partialChain, stateDump));

      await refresh(sd);
      setApplied(chain.latestHash);
      setStateDump(sd);
    } catch (e) {
      console.error("Error applying chain:", e);
      props.onError("Failed to apply chain", ownableErrorMessage(e as Error));
    } finally {
      busyRef.current = false;
      setIsApplying(false);
    }
  }, [chain.id, chain.latestHash, eventChains, ownables, props, refresh, stateDump]);

  const execute = useCallback(async (msg: TypedDict): Promise<void> => {
    if (!ownables) return;
    try {
      const sd = await ownables.execute(chain, msg, stateDump);
      await ownables.store(chain, sd);
      await refresh(sd);
      setApplied(chain.latestHash);
      setStateDump(sd);
    } catch (e) {
      props.onError("The Ownable returned an error", ownableErrorMessage(e));
    }
  }, [chain, ownables, props, refresh, stateDump]);

  const onLoad = useCallback(async (): Promise<void> => {
    if (!ownables || !pkg) return;

    if (!pkg.isDynamic) {
      await ownables.initStore(chain, pkg.cid, pkg.uniqueMessageHash);
      return;
    }

    const iframeWindow = iframeRef.current!.contentWindow!;
    const rpc = rpcConnect<Required<OwnableRPC>>(window, iframeWindow, "*", { timeout: 5000 });

    try {
      await ownables.init(chain, pkg.cid, rpc, uniqueMessageHash);
      setInitialized(true);
    } catch (e) {
      if (e instanceof Cancelled) return;
      props.onError("Failed to forge Ownable", ownableErrorMessage(e));
    }
  }, [chain, ownables, pkg, props, uniqueMessageHash]);

  const windowMessageHandler = useCallback(async (event: MessageEvent) => {
    if (!isObject(event.data) || !("ownable_id" in event.data) || event.data.ownable_id !== chain.id) return;
    if (iframeRef.current?.contentWindow !== event.source) throw Error("Not allowed to execute msg on other Ownable");
    await execute(event.data.msg);
  }, [chain.id, execute]);

  // Lifecycle: subscribe to window messages
  useEffect(() => {
    window.addEventListener("message", windowMessageHandler);
    return () => window.removeEventListener("message", windowMessageHandler);
  }, [windowMessageHandler]);

  // Cleanup rpc on unmount when service ready
  useEffect(() => {
    return () => {
      ownables?.clearRpc(chain.id);
    };
  }, [chain.id, ownables]);

  // Effect for applying partial chains and refreshing
  const prev = useRef({ initialized, appliedHex: applied.hex });
  useEffect(() => {
    if (isApplying || error) return;

    const partial = chain.startingAfter(applied);
    if (partial.events.length > 0) {
      apply(partial).catch((e) => {
        console.error("Error applying chain:", e);
        setError(ownableErrorMessage(e as Error));
      });
    } else if (initialized !== prev.current.initialized || applied.hex !== prev.current.appliedHex) {
      refresh().then();
    }
    prev.current = { initialized, appliedHex: applied.hex };
  }, [apply, applied, chain, error, initialized, isApplying, refresh]);

  // If services or package not ready yet, don't render
  if (!ownables || !packages || !idb || !eventChains || !relay || !pkg) return <></>;

  return (
    <Paper
      elevation={selected ? 8 : 1}
      sx={{
        aspectRatio: "1/1",
        position: "relative",
        animation: selected ? "bounce .4s ease infinite alternate" : "",
      }}
    >
      <OwnableFrame
        id={chain.id}
        packageCid={pkg.cid}
        isDynamic={pkg.isDynamic}
        iframeRef={iframeRef}
        onLoad={() => onLoad()}
      />
      <OwnableInfo
        sx={{ position: "absolute", left: 5, top: 5, zIndex: 10 }}
        chain={chain}
        metadata={metadata}
      />
      <OwnableActions
        sx={{ position: "absolute", right: 5, top: 5, zIndex: 10 }}
        title={pkg.title}
        isConsumable={pkg.isConsumable && !isTransferred}
        isTransferable={pkg.isTransferable && !isTransferred}
        onDelete={props.onDelete}
        chain={chain}
        onConsume={() => !!info && props.onConsume(info)}
        onTransfer={(address) => transfer(address)}
      />
      {children}

      <If condition={isApplying}>
        <Overlay>
          <OverlayBanner>Applying state...</OverlayBanner>
        </Overlay>
      </If>
      <If condition={isTransferred}>
        <Tooltip
          title="You're unable to interact with this Ownable, because it has been transferred to a different account."
          followCursor
        >
          <Overlay sx={{ backgroundColor: "rgba(255, 255, 255, 0.8)" }}>
            <OverlayBanner>Transferred</OverlayBanner>
          </Overlay>
        </Tooltip>
      </If>
    </Paper>
  );

  async function transfer(to: string): Promise<void> {
    try {
      if (!relay || !ownables || !pkg) return;
      const value = await relay.isAvailable();

      if (value) {
        await execute({ transfer: { to } });
        const zip = await ownables.zip(chain);
        const content = await zip.generateAsync({ type: "uint8array" });

        const meta = await constructMeta();
        await relay.sendOwnable(to, content, meta);
        enqueueSnackbar(`Ownable sent Successfully!!`, { variant: "success" });

        if (pkg.uniqueMessageHash) {
          await relay.removeOwnable(pkg.uniqueMessageHash);
          await ownables.delete(chain.id);
        }
      } else {
        enqueueSnackbar("Server is down", { variant: "error" });
      }
    } catch (error) {
      console.error("Error during transfer:", error);
    }
  }
}
