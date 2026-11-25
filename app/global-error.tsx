"use client";

/** Erreur dans la mise en page racine : page autonome (styles en ligne aux couleurs PRONEX). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
          padding: 16,
          background: "#080b20",
          color: "#ffffff",
        }}
      >
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <p
            style={{
              fontSize: 64,
              fontWeight: 800,
              fontStyle: "italic",
              margin: 0,
              background: "linear-gradient(90deg, #ff1493, #a000ff)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            500
          </p>
          <h1 style={{ fontSize: 24 }}>Une erreur est survenue</h1>
          <p style={{ color: "#9ca3af", fontSize: 14 }}>Le service PRONEX est momentanément indisponible. Réessayez dans quelques instants.</p>
          {error.digest ? <p style={{ color: "#9ca3af", fontSize: 12 }}>Référence : {error.digest}</p> : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 8,
              padding: "12px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: "#ffffff",
              border: 0,
              borderRadius: 12,
              cursor: "pointer",
              background: "linear-gradient(90deg, rgb(255 20 147 / 0.85), #a000ff)",
            }}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
