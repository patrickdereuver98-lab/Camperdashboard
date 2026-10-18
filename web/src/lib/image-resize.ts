"use client";

import { fitWithin } from "./image-size";

export type PreparedPhoto = { blob: Blob; width: number; height: number; ext: "webp" | "jpg" };

/**
 * Foto in de browser verkleinen en opnieuw opslaan. Dat scheelt data op een camping-wifi én haalt alle EXIF-gegevens
 * weg (zoals de GPS-locatie van je telefoon): het canvas neemt alleen de pixels over.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const size = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Je browser kan deze foto niet verwerken.");
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    const toBlob = (type: string) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.82));
    const webp = await toBlob("image/webp");
    if (webp && webp.type === "image/webp") return { blob: webp, ...size, ext: "webp" };
    const jpg = await toBlob("image/jpeg");
    if (!jpg) throw new Error("Je browser kan deze foto niet verwerken.");
    return { blob: jpg, ...size, ext: "jpg" };
  } finally {
    bitmap.close();
  }
}

/** Originele afmetingen (voor de minimale-grootte-check) */
export async function photoDimensions(file: File) {
  const bitmap = await createImageBitmap(file);
  const out = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return out;
}
