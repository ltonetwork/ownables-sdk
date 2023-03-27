import allInline from "all-inline";
import PackageService from "../services/Package.service";
import {Component, RefObject} from "react";

async function generateWidgetHTML(id: string, packageCid: string): Promise<string> {
  const root = document.createElement('div');
  root.innerHTML = await PackageService.getAssetAsText(packageCid, 'index.html');
  root.style.height = "100%";

  await allInline(root, async (fileName: string, encoding: 'data-uri' | 'text') => {
    return encoding === 'data-uri'
      ? PackageService.getAssetAsDataUri(packageCid, fileName)
      : PackageService.getAssetAsText(packageCid, fileName);
  });

  return root.outerHTML;
}

async function generate(id: string, packageCid: string, isDynamic: boolean): Promise<string> {
  const body = document.createElement('body');

  const style = document.createElement('style');
  style.textContent = `
    html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
    iframe { height: 100%; width: 100%; border: none; }
  `;
  body.appendChild(style)

  const widget = document.createElement('iframe');
  widget.setAttribute("sandbox", "allow-scripts");
  widget.srcdoc = await generateWidgetHTML(id, packageCid);
  body.appendChild(widget);

  if (isDynamic) {
    const script = document.createElement('script');
    script.src = './ownable.js';
    body.appendChild(script);
  }

  return body.outerHTML;
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
