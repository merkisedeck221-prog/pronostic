"use client";

/** Erreur dans la mise en page racine : page autonome (sans styles de l'application). */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, padding: 16 }}>
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ color: "#666", fontSize: 14 }}>Erreur 500</p>
          <h1 style={{ fontSize: 24 }}>Une erreur est survenue</h1>
          <p style={{ color: "#666", fontSize: 14 }}>Le service est momentanément indisponible. Réessayez dans quelques instants.</p>
          {error.digest ? <p style={{ color: "#999", fontSize: 12 }}>Référence : {error.digest}</p> : null}
          <button type="button" onClick={() => reset()} style={{ padding: "8px 16px", fontSize: 14, cursor: "pointer" }}>
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
