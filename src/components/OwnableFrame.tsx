import allInline from 'all-inline';
import PackageService from '../services/Package.service';
import {Component, RefObject} from 'react';

const baseUrl = window.location.href.replace(/\/*$/, '');
const trustedUrls = [
  `${baseUrl}/ownable.js`,
];

async function generateWidgetHTML(id: string, packageCid: string): Promise<string> {
  const html = await PackageService.getAssetAsText(packageCid, 'index.html');
  const doc = new DOMParser().parseFromString(html, 'text/html');

  await allInline(doc, async (filename: string, encoding: 'data-uri' | 'text') => {
    filename = filename.replace(/^.\//, '');

    return encoding === 'data-uri'
      ? PackageService.getAssetAsDataUri(packageCid, filename)
      : PackageService.getAssetAsText(packageCid, filename);
  });

  return doc.documentElement.outerHTML;
}

async function generate(id: string, packageCid: string, isDynamic: boolean): Promise<string> {
  const doc = new DOMParser().parseFromString('<html><head></head><body></body></html>', 'text/html');
  const head = doc.head;
  const body = doc.body;

  const meta = doc.createElement('meta');
  meta.httpEquiv = 'Content-Security-Policy';
  meta.content = `default-src ${trustedUrls.join(' ')} data: blob: 'unsafe-inline' 'unsafe-eval'`;
  head.appendChild(meta);

  const style = doc.createElement('style');
  style.textContent = `
    html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
    iframe { height: 100%; width: 100%; border: none; }
  `;
  head.appendChild(style);

  const widget = doc.createElement('iframe');
  widget.setAttribute('sandbox', 'allow-scripts');
  widget.srcdoc = await generateWidgetHTML(id, packageCid);
  body.appendChild(widget);

  if (isDynamic) {
    const script = doc.createElement('script');
    script.src = './ownable.js';
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

export default class OwnableFrame extends Component<OwnableFrameProps> {
  async componentDidMount(): Promise<void> {
    this.props.iframeRef.current!.srcdoc = await generate(this.props.id, this.props.packageCid, this.props.isDynamic);
  }

  shouldComponentUpdate(): boolean {
    return false; // Never update this component. We rely on the iframe not to be replaced.
  }

  render() {
    return <iframe id={this.props.id}
                   title={`Ownable ${this.props.id}`}
                   ref={this.props.iframeRef}
                   onLoad={() => this.props.onLoad()}
                   style={{display: 'block', width: '100%', height: '100%', border: 'none'}} />
  }
}
