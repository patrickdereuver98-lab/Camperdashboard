"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="nl">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f3f5f4", color: "#122033", margin: 0 }}>
        <main style={{ maxWidth: 420, margin: "0 auto", padding: "64px 20px" }}>
          <h1 style={{ fontSize: 26, margin: 0 }}>VrijStaan is even niet bereikbaar</h1>
          <p style={{ lineHeight: 1.55 }}>Er ging iets mis bij het laden. Probeer het over een paar seconden opnieuw.</p>
          <button
            onClick={reset}
            style={{ height: 52, padding: "0 24px", borderRadius: 12, border: 0, background: "#0f4c8a", color: "#fff", fontSize: 17, fontWeight: 600 }}
          >
            Opnieuw proberen
          </button>
        </main>
      </body>
    </html>
  );
}
