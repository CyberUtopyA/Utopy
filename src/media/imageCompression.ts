function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = String(fr.result || "");
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export async function compressImageFile(
  file: File,
  opt?: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    mimeType?: "image/jpeg" | "image/webp";
  },
): Promise<{
  file: File;
  dataUrl: string;
  mime: string;
  width: number;
  height: number;
}> {
  const maxWidth = opt?.maxWidth ?? 1600;
  const maxHeight = opt?.maxHeight ?? 1600;
  const quality = opt?.quality ?? 0.82;
  const mimeType = opt?.mimeType ?? "image/jpeg";

  const img = await loadImageFromFile(file);
  let { width, height } = img;

  const scale = Math.min(
    1,
    maxWidth / Math.max(1, width),
    maxHeight / Math.max(1, height),
  );

  const outW = Math.max(1, Math.round(width * scale));
  const outH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear canvas para compresión.");

  ctx.drawImage(img, 0, 0, outW, outH);
  const dataUrl = canvas.toDataURL(mimeType, quality);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) reject(new Error("No se pudo generar blob comprimido."));
        else resolve(b);
      },
      mimeType,
      quality,
    );
  });

  const ext = mimeType === "image/webp" ? "webp" : "jpg";
  const safeBase = (file.name || `img-${Date.now()}`)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_");

  const compressedFile = new File([blob], `${safeBase}.${ext}`, {
    type: mimeType,
  });

  return {
    file: compressedFile,
    dataUrl,
    mime: mimeType,
    width: outW,
    height: outH,
  };
}
