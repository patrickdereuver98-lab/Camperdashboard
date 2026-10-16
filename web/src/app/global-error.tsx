"use client";

// Vervangt de hele layout, dus zonder globals.css: de kleuren van het thema staan hier zelf, ook voor donker.
const CSS = `
  :root { --paper: #f5f0e6; --ink: #1f2b24; --ink-2: #46524a; --forest: #2d5a43; --on-forest: #fffcf6; color-scheme: light; }
  @media (prefers-color-scheme: dark) {
    :root { --paper: #111713; --ink: #ece7db; --ink-2: #c7c2b6; --forest: #8dbf9f; --on-forest: #0f1612; color-scheme: dark; }
  }
  body { margin: 0; background: var(--paper); color: var(--ink); font-family: system-ui, sans-serif; font-size: 17px; }
  main { max-width: 420px; margin: 0 auto; padding: 64px 20px; }
  h1 { font-size: 26px; margin: 0; }
  p { line-height: 1.55; color: var(--ink-2); }
  button { height: 52px; padding: 0 24px; border-radius: 12px; border: 0; background: var(--forest); color: var(--on-forest); font-size: 17px; font-weight: 600; }
`;

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="nl">
      <head>
        <style>{CSS}</style>
      </head>
      <body>
        <main>
          <h1>VrijStaan is even niet bereikbaar</h1>
          <p>Er ging iets mis bij het laden. Probeer het over een paar seconden nog een keer.</p>
          <button onClick={reset}>Opnieuw proberen</button>
        </main>
      </body>
    </html>
  );
}
