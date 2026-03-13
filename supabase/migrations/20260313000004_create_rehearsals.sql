-- Rehearsal schedule module
CREATE TABLE IF NOT EXISTS rehearsals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  production_id uuid REFERENCES productions(id) ON DELETE SET NULL,
  title         text NOT NULL,
  date          date NOT NULL,
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  location      text,
  cast_groups   text[] NOT NULL DEFAULT '{}',
  notes         text,
  is_cancelled  boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_rehearsals_tenant_date ON rehearsals(tenant_id, date);
CREATE INDEX idx_rehearsals_production ON rehearsals(production_id);
CREATE INDEX idx_rehearsals_cast_groups ON rehearsals USING GIN(cast_groups);

CREATE TRIGGER set_rehearsals_updated_at
  BEFORE UPDATE ON rehearsals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE rehearsals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access to rehearsals"
  ON rehearsals FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Authenticated users can read rehearsals"
  ON rehearsals FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Public access for embed (anonymous read via anon key with production_id filter)
CREATE POLICY "Public can read rehearsals for embeds"
  ON rehearsals FOR SELECT
  USING (true);
