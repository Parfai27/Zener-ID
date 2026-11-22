'use client'

// Catches what the dashboard layout itself cannot load, such as the backend
// being down when the signed-in account is looked up.
export default function RootError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-extrabold text-pine">The dashboard could not load</h1>
      <p className="text-ink-3">{error.message || 'Something went wrong.'}</p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <a href="/login" className="btn-secondary">
          Back to sign in
        </a>
      </div>
    </main>
  )
}
