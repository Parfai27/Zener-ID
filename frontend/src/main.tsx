import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import './landing/landing.css'
import './styles.css'
import './shufti.css'
import { ToastProvider } from './components/ui'
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

function NotFound() {
  return (
    <div className="zapp" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', textAlign: 'center' }}>
      <div className="col" style={{ alignItems: 'center' }}>
        <h1 className="display" style={{ fontSize: 64 }}>404</h1>
        <p className="muted">This page does not exist.</p>
        <a href="/" className="btn btn-primary">Go to the home page</a>
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
          <Route path="/v/:token" element={<ApplicantFlow />} />
          {/* The backend builds links as <VERIFY_BASE_URL>/verify/<token>. */}
          <Route path="/verify/:token" element={<ApplicantFlow />} />

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
              <Route path="/admin/review/:reference" element={<CaseReview />} />
              <Route path="/admin/verifications" element={<AdminVerifications />} />
              <Route path="/admin/verifications/:reference" element={<VerificationDetail scope="staff" />} />
              <Route path="/admin/clients" element={<Clients />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
