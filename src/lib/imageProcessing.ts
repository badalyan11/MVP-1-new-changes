export interface ProcessedImage {
  width: number; // original pixel size, after EXIF orientation
  height: number;
  display: Blob; // ~2000px JPEG used on pages
  thumb: Blob; // ~400px JPEG used in the photo library
  takenAt: string | null;
}

const DISPLAY_MAX = 2000;
const THUMB_MAX = 400;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`${file.name} couldn't be read. Try a JPG or PNG.`));
    };
    img.src = url;
  });
}

function resizeToBlob(img: HTMLImageElement, max: number, quality: number): Promise<Blob> {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas isn't supported in this browser."));
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't prepare the photo."))), "image/jpeg", quality);
  });
}

/** Reads an image and produces the smaller copies the app displays. The original file is stored as-is. */
export async function processImage(file: File): Promise<ProcessedImage> {
  if (!file.type.startsWith("image/")) throw new Error(`${file.name} isn't an image.`);
  const img = await loadImage(file);
  const [display, thumb] = await Promise.all([resizeToBlob(img, DISPLAY_MAX, 0.88), resizeToBlob(img, THUMB_MAX, 0.8)]);
  return {
    width: img.naturalWidth,
    height: img.naturalHeight,
    display,
    thumb,
    takenAt: file.lastModified ? new Date(file.lastModified).toISOString() : null,
  };
}
