import { useEffect, useState } from "react";
import { createPixQrImage } from "./pix-qr";

export function PixQrCode({ value }: { value: string }) {
  const [image, setImage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void createPixQrImage(value)
      .then((src) => {
        if (active) setImage(src);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [value]);

  if (failed)
    return (
      <p className="mst-foot" role="alert">
        Não foi possível exibir o QR Code. Use o código Pix Copia e Cola abaixo.
      </p>
    );
  return (
    <div className="mst-qr" aria-busy={!image}>
      {image ? (
        <img
          src={image}
          alt="QR Code do PIX"
          width={240}
          height={240}
          onError={() => setFailed(true)}
        />
      ) : (
        <p className="mst-foot" aria-live="polite">
          Gerando QR Code…
        </p>
      )}
    </div>
  );
}
