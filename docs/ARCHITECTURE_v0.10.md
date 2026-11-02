# Kanonyar Arak — Android split v0.10

The project is designed as **two Android apps** sharing one FastAPI backend and PostgreSQL-compatible persistence.

- `android/student-app`: students browse clubs/events, sign in, view their tickets and later download PDFs.
- `android/management-app`: owner, 31 club secretaries, registration assistants, and printed-ticket entry checkers.
- `backend`: central identity, ticketing, attendance, certificates and accounting. Authorization remains server-side.

**Current implementation status:** Source refactoring and 14 passing backend tests are available in the v0.10 development archive; the full source archive has **not** been uploaded to this GitHub repository yet. Neither Android APK has been built or tested on a device. Real payments are disabled.

**Public repository safety:** No credentials, signing keys, financial secrets, real student data, or `.env` files should ever be committed. Branding remains provisional until a final name is selected.

**Implementation follow-up:** Import the tested v0.10 source tree, then configure Android CI and PostgreSQL integration tests. Release gates: role isolation, printed-ticket check-in, PDF, capacity concurrency, settlement audit, and device testing.
