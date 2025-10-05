import allInline from 'all-inline';
import React, { RefObject, useLayoutEffect, useRef } from 'react';
import { useService } from '../hooks/useService';
import PackageService from '../services/Package.service';

const baseUrl = window.location.href.replace(/\/*$/, '');
const trustedUrls = [`${baseUrl}/ownable.js`];

async function generateWidgetHTML(
  packageService: PackageService,
  packageCid: string
): Promise<string> {
  const html = await packageService.getAssetAsText(packageCid, 'index.html');
  const doc = new DOMParser().parseFromString(html, 'text/html');

  await allInline(
    doc,
    async (filename: string, encoding: 'data-uri' | 'text') => {
      filename = filename.replace(/^.\//, '');
      return encoding === 'data-uri'
        ? packageService.getAssetAsDataUri(packageCid, filename)
        : packageService.getAssetAsText(packageCid, filename);
    }
  );

  return doc.documentElement.outerHTML;
}

async function generateOuterHTML(
  packageService: PackageService,
  packageCid: string,
  isDynamic: boolean
): Promise<string> {
  const doc = new DOMParser().parseFromString(
    '<html><head></head><body></body></html>',
    'text/html'
  );
  const { head, body } = doc;

  const meta = doc.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = `default-src ${trustedUrls.join(
    ' '
  )} data: blob: 'unsafe-inline' 'unsafe-eval'`;
  head.appendChild(meta);

  const style = doc.createElement('style');
  style.textContent = `
    html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
    iframe { height: 100%; width: 100%; border: none; }
  `;
  head.appendChild(style);

  const widget = doc.createElement('iframe');
  widget.setAttribute('sandbox', 'allow-scripts');
  widget.srcdoc = await generateWidgetHTML(packageService, packageCid);
  body.appendChild(widget);

  if (isDynamic) {
    const script = doc.createElement('script');
    script.src = './ownable.js';
    body.appendChild(script);
  }

  return doc.documentElement.outerHTML;
}

export interface OwnableFrameProps {
  id: string;                 // stable per ownable
  packageCid: string;         // read only at mount
  isDynamic: boolean;         // read only at mount
  iframeRef: RefObject<HTMLIFrameElement>;
  onLoad: () => void;         // can be stable or not, does not trigger re-render
}

function OwnableFrameInner(props: OwnableFrameProps) {
  const packages = useService('packages');

  // Freeze initial values so later prop changes are ignored
  const init = useRef({
    packageCid: props.packageCid,
    isDynamic: props.isDynamic,
  });

  // Set srcdoc exactly once on mount
  useLayoutEffect(() => {
    let cancelled = false;
    (async () => {
      if (!packages || !props.iframeRef.current) return;
      const html = await generateOuterHTML(
        packages,
        init.current.packageCid,
        init.current.isDynamic
      );
      if (!cancelled && props.iframeRef.current) {
        props.iframeRef.current.srcdoc = html;
      }
    })();
    return () => {
      cancelled = true;
    };
    // empty deps, intentional one-time init
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packages]);

  return (
    <iframe
      id={props.id}
      title={`Ownable ${props.id}`}
      ref={props.iframeRef}
      onLoad={props.onLoad}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        border: 'none',
      }}
    />
  );
}

// Never re-render after first mount for a given id.
// If you need a fresh frame, change the React key or the id.
const OwnableFrame = React.memo(OwnableFrameInner, (prev, next) => prev.id === next.id);

export default OwnableFrame;
