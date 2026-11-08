-- DRAFT. Run only on the newly approved, empty production project after schema deployment.
-- Create unique leadconnect_app and leadconnect_backup roles privately beforehand.
-- Never run against the existing project/branch or existing production service.
DO $$ BEGIN
  IF current_database() <> 'leadconnect_production' THEN RAISE EXCEPTION 'Unexpected database'; END IF;
END $$;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE leadconnect_production TO leadconnect_app, leadconnect_backup;
GRANT USAGE ON SCHEMA public TO leadconnect_app, leadconnect_backup;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO leadconnect_app;
REVOKE UPDATE, DELETE ON TABLE public.audit_logs FROM leadconnect_app;
REVOKE ALL ON TABLE public._prisma_migrations FROM leadconnect_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO leadconnect_backup;
-- No DDL, role administration or CREATE privileges for the runtime/backup roles.
-- Re-review grants whenever a future migration adds objects. No broad default grants.
