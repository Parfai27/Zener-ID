/** An error from the API (the backend, or the mock for the parts not connected yet). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** The backend's reason for each refused field (422), keyed by field name. */
    public fields?: Record<string, string>,
  ) {
    super(message)
  }
}
