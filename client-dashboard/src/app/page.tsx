import { redirect } from 'next/navigation'

// This project is only the client dashboard, so the root goes straight to it.
// The middleware sends anyone without a session on to /login.
export default function Home() {
  redirect('/dashboard')
}
