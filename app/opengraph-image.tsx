import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Image d'aperçu des liens partagés (WhatsApp, Facebook, X…) : fond noir nuit,
 * halos de marque, logotype et symbole officiels (fichiers fournis par le
 * porteur, non redessinés), slogan. Générée au build par next/og, sans
 * dépendance supplémentaire.
 */
export const alt = "PRONEX — Prédisez. Analysez. Dominez. Pronostics football assistés par intelligence artificielle.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function dataUri(file: Buffer): string {
  return `data:image/png;base64,${file.toString("base64")}`;
}

export default async function Image() {
  // Chemins fixes (évite le traçage de tout le projet par le compilateur).
  const [wordmarkFile, symbolFile] = await Promise.all([
    readFile(join(process.cwd(), "public/brand/pronex-wordmark.png")),
    readFile(join(process.cwd(), "public/brand/pronex-symbol.png")),
  ]);
  const wordmark = dataUri(wordmarkFile);
  const symbol = dataUri(symbolFile);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          backgroundColor: "#080b20",
          backgroundImage:
            "radial-gradient(circle at 85% 20%, rgba(160,0,255,0.35), transparent 45%), radial-gradient(circle at 10% 95%, rgba(255,20,147,0.25), transparent 40%)",
          color: "#ffffff",
        }}
      >
        <img src={symbol} width={300} height={142} alt="" style={{ position: "absolute", right: 70, bottom: 60, opacity: 0.9 }} />
        <img src={wordmark} width={560} height={78} alt="" />
        <div style={{ display: "flex", marginTop: 44, fontSize: 60, fontWeight: 800, fontStyle: "italic", letterSpacing: -1 }}>
          <span>Prédisez.&nbsp;</span>
          <span style={{ color: "#ff1493" }}>Analysez.&nbsp;</span>
          <span>Dominez.</span>
        </div>
        <div style={{ display: "flex", marginTop: 22, fontSize: 30, color: "#9ca3af", maxWidth: 720 }}>
          Pronostics football assistés par intelligence artificielle
        </div>
        <div style={{ display: "flex", marginTop: 40, fontSize: 22, color: "#9ca3af" }}>
          13 types de pronostics · Performances publiques · 18+
        </div>
      </div>
    ),
    size,
  );
}
