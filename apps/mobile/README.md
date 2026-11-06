# Expo mobile next phase — not implemented

The web/API workflow now works against disposable local PostgreSQL. Cloud schema installation, real browser cookie/CORS verification and mobile/device testing remain blockers before a verified mobile application can be declared complete.

Next implementation:
1. Add an Expo/React Native TypeScript client in this directory after selecting a supported Expo SDK and installing its compatible dependencies with a lockfile.
2. Use the same API: POST /auth/login with propertyCode/email/password and X-Client-Platform: mobile, then /auth/me to determine roles. Store refresh tokens only in expo-secure-store; keep access tokens in memory. Send the current refreshToken in the refresh body, serialize rotations, and replace the saved token only on success. Never embed a signing secret or database connection.
3. Fetch /housekeeping?date=YYYY-MM-DD (assigned tasks are scoped on the server), update task status through /housekeeping/:id, and display only valid transitions.
4. Fetch/report/update /maintenance with assigned technician permissions and required resolution notes. Handle denied writes and stale/conflicting records visibly.
5. Verify login, logout, token rotation, secure storage, role isolation, network failures and background/resume behavior on Android and iOS development builds. Do not store operational records in an unencrypted offline cache.

Known limitations to resolve: current native header is response negotiation, not client authentication; review native-client identity before production. Existing refresh replay invalidates all sessions for a user. Build/OS/app-store signing or publication is not authorized here. No executable mobile app, Expo project, paid service, or distribution build has been created.
