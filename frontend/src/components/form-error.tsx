import { AlertCircle } from 'lucide-react'

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-bad-tint px-4 py-3 text-sm text-bad">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  )
}
