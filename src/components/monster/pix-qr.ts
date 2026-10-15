/** Generate the QR locally; the original Pix string is never sent to another service. */
export async function createPixQrImage(payload: string): Promise<string> {
  if (!payload.trim()) throw new Error("Missing Pix code");
  const bytes = new TextEncoder().encode(payload);
  // Stay inside the encoder's byte capacity and bound rendering work.
  if (bytes.length > 2000) throw new Error("Pix code exceeds QR capacity");
  const { default: qrcode } = await import("qrcode-generator");
  const qr = qrcode(0, "M");
  // The encoder consumes single-byte characters: preserve the original UTF-8 bytes.
  const data = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  qr.addData(data, "Byte");
  qr.make();
  const svg = qr
    .createSvgTag({ cellSize: 4, margin: 16, scalable: true })
    .replace("<svg ", '<svg shape-rendering="crispEdges" ');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
