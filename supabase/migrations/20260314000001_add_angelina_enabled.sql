-- Add angelina_enabled toggle to tenants table
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS angelina_enabled BOOLEAN NOT NULL DEFAULT true;
