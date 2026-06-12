declare module 'qrcode' {
  interface ToCanvasOptions {
    width?: number;
    margin?: number;
    color?: { dark: string; light: string };
  }
  interface ToDataURLOptions {
    width?: number;
    margin?: number;
    color?: { dark: string; light: string };
  }
  function toCanvas(el: HTMLCanvasElement, text: string, options?: ToCanvasOptions): Promise<void>;
  function toDataURL(text: string, options?: ToDataURLOptions): Promise<string>;
  export { toCanvas, toDataURL };
  export default { toCanvas, toDataURL };
}
