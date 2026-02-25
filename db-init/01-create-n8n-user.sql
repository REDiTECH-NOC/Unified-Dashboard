-- Create a separate PostgreSQL user for n8n with limited permissions.
-- n8n only needs access to its own schema — not the main app tables.
--
-- This script runs on first DB container startup (mounted in /docker-entrypoint-initdb.d/).
-- For existing deployments, run manually:
--   docker exec -i rcc-db psql -U $POSTGRES_USER -d $POSTGRES_DB < db-init/01-create-n8n-user.sql

-- Create user if not exists (password is set via env var, replaced at deploy time)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'n8n') THEN
    CREATE ROLE n8n WITH LOGIN PASSWORD 'PLACEHOLDER_N8N_PASSWORD';
  END IF;
END
$$;

-- n8n needs CONNECT + CREATE on the database (CREATE for schema management at startup)
GRANT CONNECT, CREATE ON DATABASE :"POSTGRES_DB" TO n8n;

-- Create the n8n schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS n8n;

-- Grant n8n user full access to its schema
GRANT USAGE ON SCHEMA n8n TO n8n;
GRANT ALL PRIVILEGES ON SCHEMA n8n TO n8n;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA n8n TO n8n;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA n8n TO n8n;

-- Ensure future tables in the n8n schema are also accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA n8n GRANT ALL PRIVILEGES ON TABLES TO n8n;
ALTER DEFAULT PRIVILEGES IN SCHEMA n8n GRANT ALL PRIVILEGES ON SEQUENCES TO n8n;

-- Grant basic public schema usage (pg_catalog access) but no table access
GRANT USAGE ON SCHEMA public TO n8n;
