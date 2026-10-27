declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    margin?: number;
    scale?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
  export function toDataURL(text: string, callback: (error: Error | null, url: string) => void): void;
  export function toDataURL(text: string, options: QRCodeToDataURLOptions, callback: (error: Error | null, url: string) => void): void;

  const qrcode: {
    toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>;
    toDataURL(text: string, callback: (error: Error | null, url: string) => void): void;
    toDataURL(text: string, options: QRCodeToDataURLOptions, callback: (error: Error | null, url: string) => void): void;
  };
  export default qrcode;
}
