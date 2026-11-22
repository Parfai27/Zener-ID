// The single import point for data. Today it re-exports the in-browser mock.
// To connect the backend, add src/api/http.ts with the same function names
// (calling /v1/...) and switch the export below.
export * from './mock'
export type * from './types'
