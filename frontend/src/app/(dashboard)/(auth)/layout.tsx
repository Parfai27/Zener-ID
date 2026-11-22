import Image from 'next/image'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="brand-glow relative hidden flex-col justify-between p-12 text-white lg:flex">
        <Image src="/brand/zenerid-logo-light.svg" alt="Zener ID" width={150} height={36} priority />
        <div className="max-w-md">
          <h1 className="text-4xl font-extrabold leading-tight">Verify your customers in minutes.</h1>
          <p className="mt-4 text-lg text-white/75">
            Send a link, let your customer capture their ID and a quick face check, and get a clear Verified or
            Declined with the reasons.
          </p>
        </div>
        <p className="text-sm text-white/50">Document OCR · Face match · Liveness · AML screening</p>
      </aside>
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
