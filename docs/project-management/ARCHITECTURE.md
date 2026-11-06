# Architecture

## Backend and database
apps/api: Node 24, Express 5, TypeScript, Prisma 7 with PostgreSQL adapter. PostgreSQL is authoritative operational storage; Drive is documentation/backup storage only.

14 models: Property, User, PropertyMembership, Room, CleaningTask, MaintenanceTicket, TicketEvent, RoomStatusEvent, Photo, Notification, AuditLog, RefreshToken, FrontDeskTask and ShiftHandover. 11 enums. Initial migration plus 20261106233500_operations. Both tested locally; neither applied to the cloud test branch by this session.

Membership roles: ADMIN, MANAGER, FRONT_DESK, HOUSEKEEPING, MAINTENANCE. Access tokens carry property identity; each authenticated request checks active membership. Passwords are Argon2id hashes; refresh tokens are random secrets stored hashed, rotated in serializable transactions.

Operational endpoints and permissions: see apps/api/OPERATIONS.md. Families: /properties/current, /employees, /users, /rooms, /housekeeping, /maintenance, /front-desk/tasks, /front-desk/handovers, /dashboard, /reports and /audit. Property identity is never accepted from operational request bodies. Assignee membership and roles are checked transactionally. Composite foreign keys protect room/task/ticket/photo tenant references. Audit writes are atomic with mutations. Room updates use versions; completed assignments cannot be reassigned.

## Web
apps/web: React 19 + TypeScript + Vite 7; production static build in dist. Eight pages call the actual backend. In-memory access tokens, HttpOnly refresh cookies, single-flight refresh. No permanent mocks, no localStorage credentials, no public registration. Dates use America/Phoenix. CSV accepts only normalized operational fields and requires an explicit save. No guest data or PMS imports.

Current tests: component/session/CSV tests and an enabled jsdom workflow through the real local API/database. Full browser/CORS/visual/print/device QA remains outstanding. Forms are minimal MVPs; pagination, recurring templates, monthly aggregates, PDF ingestion, photos and live updates need further work.

## Mobile
Expo/React Native is not implemented. apps/mobile/README.md specifies API usage, SecureStore, refresh serialization and device-test requirements. Reuse API endpoints and extract shared response contracts when the mobile package is added.

## Deployment
GitHub main; Render root apps/api; build npm ci --include=dev && npm run build; start npm start; health /api/health; Node 24; production runtime env; port 10000; auto-deploy off. Live source b4f909d predates operational endpoints. Neon render-test is independently verified and separate from production, but remains unmigrated due executor native PostgreSQL networking.

Recommended test frontend: free Render static hosting, root apps/web, build npm ci --include=dev && npm run build, publish dist. Select actual same-site HTTPS frontend/API custom domains before browser auth. No frontend hosting service or DNS change was created.
