// Authentication is backed by FastAPI; verification and dashboard data remain mocked.
export * from './mock'
export {
  currentSession,
  login,
  logout,
  register,
  requestPasswordReset,
  resetPassword,
} from './auth'
export type * from './types'
