# Lead Connect Clone

Hotel operations application (development in progress).

## Current contents

- `apps/api`: Node.js / Express / TypeScript API, property-scoped operations and Prisma migrations.
- `apps/web`: React/Vite dashboard connected to the actual API, locally verified.
- `apps/mobile`: precise Expo implementation handoff; mobile app not yet implemented.
- `docs/project-management`: resumable status, architecture, feature and deployment logs.

## Status

Backend foundation with a dependency lockfile, initial migration, and local validation tests. This has not been deployed or verified for production use. Do not store real guest or employee data until security and integration testing are completed.

## Project files

Project management files and backups are kept in the existing Google Drive `Lead Connect Clone` folder. Google Drive is not a live database or an automatic GitHub sync.

## Local setup

See `apps/api/README.md` for API setup and environment variable instructions. Never commit `.env` or credentials.

## Latest local verification

60 backend tests and 14 web tests passed, including a React-to-real-local-API workflow. Both migrations applied to fresh disposable PostgreSQL 18.3 without schema drift. Neon test migrations remain blocked by executor PostgreSQL DNS/network access. Render still runs b4f909d; do not assume the new operations are cloud-deployed.
