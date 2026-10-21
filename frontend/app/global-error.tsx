'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <h2>System Error</h2>
          <button onClick={() => reset()}>Retry</button>
        </div>
      </body>
    </html>
  );
}
