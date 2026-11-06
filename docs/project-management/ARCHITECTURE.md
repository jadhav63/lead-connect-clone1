# Architecture
Backend: apps/api, Node 24, Express 5, TypeScript, Prisma 7 with PostgreSQL adapter. Models: Property, User, PropertyMembership, Room, CleaningTask, MaintenanceTicket, TicketEvent, RoomStatusEvent, Photo, Notification, AuditLog, RefreshToken.

Existing API: /api/health, /api/ready, /api/auth/login, /refresh, /logout, /me; POST /api/users. Access tokens contain user/property identity; active memberships are rechecked on requests. Passwords use Argon2id; refresh tokens are hashed in the database.

Operational APIs, React web and Expo mobile are under development. Reuse existing models where practical; new requirements must have reviewed local migrations. No permanent mock API or public registration.

Deployment: GitHub main; Render root apps/api, build npm ci --include=dev && npm run build, start npm start, health /api/health, NODE_VERSION 24, NODE_ENV production. Auto-deploy off. Neon test endpoint is isolated from the production branch.

Future web: React/Vite under apps/web, same-site HTTPS frontend/API custom subdomains for strict cookies; credentialed requests and in-memory access tokens. Future Expo: same backend, OS secure refresh storage; no database URLs or signing secrets bundled into clients.
