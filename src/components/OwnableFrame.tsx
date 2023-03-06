import allInline from "all-inline";
import PackageService from "../services/Package.service";
import {RefObject, useEffect, useState} from "react";

async function generateWidgetHTML(id: string, pkgKey: string): Promise<string> {
  const root = document.createElement('div');
  root.innerHTML = await PackageService.getAssetAsText(pkgKey, 'index.html');
  root.style.height = "100%";

  await allInline(root, async (fileName: string, encoding: 'data-uri' | 'text') => {
    return encoding === 'data-uri'
      ? PackageService.getAssetAsDataUri(pkgKey, fileName)
      : PackageService.getAssetAsText(pkgKey, fileName);
  });

  return root.outerHTML;
}

async function generate(id: string, pkgKey: string) {
  const widgetHTML = await generateWidgetHTML(id, pkgKey);

  // generate widget iframe
  const ownableWidget = document.createElement('iframe');
  ownableWidget.setAttribute("sandbox", "allow-scripts");
  ownableWidget.srcdoc = widgetHTML;

  const ownableScript = document.createElement('script');
  ownableScript.src = './ownable.js';

  const ownableStyle = document.createElement('style');
  ownableStyle.textContent = `
    html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
    iframe { height: 100%; width: 100%; border: none; }
  `;

  const ownableBody = document.createElement('body');
  ownableBody.appendChild(ownableStyle)
  ownableBody.appendChild(ownableWidget);
  ownableBody.appendChild(ownableScript);

  return ownableBody.outerHTML;
}

export interface OwnableFrameProps {
  id: string;
  pkgKey: string;
  iframeRef: RefObject<HTMLIFrameElement>;
}

const iframeStyle = {
  display: 'block',
  width: '100%',
  height: '100%',
  border: 'none',
}

export default function OwnableFrame(props: OwnableFrameProps) {
  const {id, pkgKey, iframeRef} = props;
  const [html, setHtml] = useState<string>();

  useEffect(() => {
    generate(id, pkgKey).then(doc => setHtml(doc));
  }, []);

  return <iframe id={id} srcDoc={html} ref={iframeRef} style={iframeStyle} />
}
