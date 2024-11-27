declare module 'gif.js' {
    interface GIFOptions {
      workers?: number;
      quality?: number;
      width?: number;
      height?: number;
      workerScript?: string;
      background?: string;
      transparent?: string;
      repeat?: number;
      delay?: number;
      dither?: boolean;
      debug?: boolean;
    }
  
    interface FrameOptions {
      delay?: number;
      copy?: boolean;
    }
  
    class GIF {
      constructor(options?: GIFOptions);
      addFrame(image: CanvasImageSource, options?: FrameOptions): void;
      on(event: 'finished', callback: (blob: Blob) => void): void;
      on(event: 'progress', callback: (progress: number) => void): void;
      render(): void;
    }
  
    export = GIF;
  }