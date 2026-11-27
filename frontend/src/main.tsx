import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './landing/landing.css'
import './styles.css'
import { ToastProvider, buttonClass } from './components/ui'
import { AdminShell, ClientShell, RequireClient, RequireStaff } from './layouts/Shells'
import { LandingPage, ResetPasswordPage, SignInPage, SignUpPage } from './landing/pages'
import { Dashboard } from './pages/client/Dashboard'
import { Verifications } from './pages/client/Verifications'
import { NewVerification } from './pages/client/NewVerification'
import { VerificationDetail } from './pages/client/VerificationDetail'
import { ApiKeys } from './pages/client/ApiKeys'
import { Settings } from './pages/client/Settings'
import { ApplicantFlow } from './pages/applicant/Flow'
import { AdminOverview, AdminVerifications, CaseReview, Clients, ReviewQueue } from './pages/admin/Admin'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

/** The verification pages, inside the wrapper that gives them their own shades. */
const Verify = () => <div className="zid-ui"><ApplicantFlow /></div>

function NotFound() {
  return (
    <div className="zid-ui grid min-h-screen place-items-center p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-6xl">404</h1>
        <p className="text-muted">This page does not exist.</p>
        <a href="/" className={buttonClass('primary')}>Go to the home page</a>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <ToastProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/v/:token" element={<Verify />} />
          {/* The backend builds links as <VERIFY_BASE_URL>/verify/<token>. */}
          <Route path="/verify/:token" element={<Verify />} />

          <Route element={<RequireClient />}>
            <Route element={<ClientShell />}>
              <Route path="/app" element={<Dashboard />} />
              <Route path="/app/verifications" element={<Verifications />} />
              <Route path="/app/verifications/new" element={<NewVerification />} />
              <Route path="/app/verifications/:reference" element={<VerificationDetail />} />
              <Route path="/app/api-keys" element={<ApiKeys />} />
              <Route path="/app/settings" element={<Settings />} />
            </Route>
          </Route>

          <Route path="/admin/login" element={<Navigate to="/login" replace />} />
          <Route element={<RequireStaff />}>
            <Route element={<AdminShell />}>
              <Route path="/admin" element={<AdminOverview />} />
              <Route path="/admin/review" element={<ReviewQueue />} />
              <Route path="/admin/review/:id" element={<CaseReview />} />
              <Route path="/admin/verifications" element={<AdminVerifications />} />
              <Route path="/admin/verifications/:id" element={<VerificationDetail scope="staff" />} />
              <Route path="/admin/clients" element={<Clients />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
