import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Image d'aperçu des liens partagés (WhatsApp, Facebook, X…), dans le design
 * PRONEX : photo de l'en-tête de la landing sous un voile bleu nuit, symbole
 * « P + ballon », titre et pastille citron. Générée par next/og.
 */
export const alt = "PRONEX — Le football analysé par l'intelligence artificielle. Prédisez. Analysez. Dominez.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"><path fill="#fff" fill-rule="evenodd" d="M0 14A14 14 0 0 1 14 0H54A48 48 0 0 1 54 96H38V106A14 14 0 0 1 24 120H14A14 14 0 0 1 0 106ZM54 24A24 24 0 1 0 54 72A24 24 0 1 0 54 24Z"/><circle cx="54" cy="48" r="12" fill="#c9f13e"/><path d="M54 40.5l7 5.1-2.7 8.2h-8.6l-2.7-8.2z" fill="#fff"/></svg>`;

export default async function Image() {
  // Chemin fixe (évite le traçage de tout le projet par le compilateur).
  const background = await readFile(join(process.cwd(), "public/landing/v2/og-bg.jpg"));
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: "#042644", color: "#ffffff" }}>
        <img src={`data:image/jpeg;base64,${background.toString("base64")}`} width={1200} height={630} alt="" style={{ position: "absolute", inset: 0 }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", backgroundImage: "linear-gradient(90deg, rgba(4,38,68,0.96) 0%, rgba(4,38,68,0.75) 48%, rgba(4,38,68,0.1) 100%)" }} />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px", width: 760 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <img src={`data:image/svg+xml;base64,${Buffer.from(MARK).toString("base64")}`} width={50} height={60} alt="" />
            <span style={{ marginLeft: 16, fontSize: 44, fontWeight: 600, letterSpacing: -2 }}>PRONEX</span>
          </div>
          <div style={{ display: "flex", marginTop: 40, fontSize: 66, lineHeight: 1.05, letterSpacing: -3 }}>
            Le football analysé par l&apos;intelligence artificielle.
          </div>
          <div style={{ display: "flex", marginTop: 36 }}>
            <span style={{ display: "flex", padding: "12px 26px", borderRadius: 99, backgroundColor: "#c9f13e", color: "#000000", fontSize: 26, fontWeight: 600 }}>
              Prédisez. Analysez. Dominez.
            </span>
          </div>
          <div style={{ display: "flex", marginTop: 28, fontSize: 22, color: "rgba(255,255,255,0.8)" }}>
            13 types de pronostics · Performances publiques · 18+
          </div>
        </div>
      </div>
    ),
    size,
  );
}
