import allInline from "all-inline";
import PackageService from "../services/Package.service";
import { RefObject, useEffect, useLayoutEffect } from "react";
import { useService } from "../hooks/useService";

const baseUrl = window.location.href.replace(/\/*$/, "");
const trustedUrls = [`${baseUrl}/ownable.js`];

async function generateWidgetHTML(
  packageService: PackageService,
  packageCid: string
): Promise<string> {
  const html = await packageService.getAssetAsText(packageCid, "index.html");
  const doc = new DOMParser().parseFromString(html, "text/html");

  await allInline(
    doc,
    async (filename: string, encoding: "data-uri" | "text") => {
      filename = filename.replace(/^.\//, "");

      return encoding === "data-uri"
        ? packageService.getAssetAsDataUri(packageCid, filename)
        : packageService.getAssetAsText(packageCid, filename);
    }
  );

  return doc.documentElement.outerHTML;
}

async function generate(
  packageService: PackageService,
  packageCid: string,
  isDynamic: boolean
): Promise<string> {
  const doc = new DOMParser().parseFromString(
    "<html><head></head><body></body></html>",
    "text/html"
  );
  const head = doc.head;
  const body = doc.body;

  const meta = doc.createElement("meta");
  meta.httpEquiv = "Content-Security-Policy";
  meta.content = `default-src ${trustedUrls.join(
    " "
  )} data: blob: 'unsafe-inline' 'unsafe-eval'`;
  head.appendChild(meta);

  const style = doc.createElement("style");
  style.textContent = `
    html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
    iframe { height: 100%; width: 100%; border: none; }
  `;
  head.appendChild(style);

  const widget = doc.createElement("iframe");
  widget.setAttribute("sandbox", "allow-scripts");
  widget.srcdoc = await generateWidgetHTML(packageService, packageCid);
  body.appendChild(widget);

  if (isDynamic) {
    const script = doc.createElement("script");
    script.src = "./ownable.js";
    body.appendChild(script);
  }

  return doc.documentElement.outerHTML;
}

export interface OwnableFrameProps {
  id: string;
  packageCid: string;
  isDynamic: boolean;
  iframeRef: RefObject<HTMLIFrameElement>;
  onLoad: () => void;
}

export default function OwnableFrame(props: OwnableFrameProps) {
  const packages = useService('packages');

  useLayoutEffect(() => {
    let cancelled = false;
    (async () => {
      if (!packages || !props.iframeRef.current) return;
      const html = await generate(packages, props.packageCid, props.isDynamic);
      if (!cancelled && props.iframeRef.current) {
        props.iframeRef.current.srcdoc = html;
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages, props.id, props.packageCid, props.isDynamic]);

  return (
    <iframe
      id={props.id}
      title={`Ownable ${props.id}`}
      ref={props.iframeRef}
      onLoad={() => props.onLoad()}
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        border: "none",
      }}
    />
  );
}
