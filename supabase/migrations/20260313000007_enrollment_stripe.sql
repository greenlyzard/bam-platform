-- ============================================================
-- Enrollment Stripe Integration
-- Creates: enrollment_carts, enrollment_cart_items
-- Alters: enrollments (add Stripe payment columns)
-- ============================================================

-- ── ENROLLMENT CARTS ──────────────────────────────────────
CREATE TABLE enrollment_carts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  family_id       UUID,
  session_token   TEXT UNIQUE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active'
    CHECK (status  IN ('active', 'checked_out', 'completed', 'expired')),
  stripe_session_id TEXT,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_carts_session ON enrollment_carts(session_token);
CREATE INDEX idx_carts_family  ON enrollment_carts(family_id);

ALTER TABLE enrollment_carts ENABLE ROW LEVEL SECURITY;

-- Public insert (anonymous carts), admin full access
CREATE POLICY "anon_insert_carts" ON enrollment_carts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_select_own_cart" ON enrollment_carts
  FOR SELECT USING (true);

CREATE POLICY "anon_update_own_cart" ON enrollment_carts
  FOR UPDATE USING (true);

CREATE POLICY "admins_carts" ON enrollment_carts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );


-- ── CART LINE ITEMS ───────────────────────────────────────
CREATE TABLE enrollment_cart_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id     UUID NOT NULL REFERENCES enrollment_carts(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id),
  class_id    UUID NOT NULL REFERENCES classes(id),
  student_id  UUID,
  student_name TEXT,
  price_cents INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cart_items_cart ON enrollment_cart_items(cart_id);

ALTER TABLE enrollment_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_insert_cart_items" ON enrollment_cart_items
  FOR INSERT WITH CHECK (true);

CREATE POLICY "anon_select_cart_items" ON enrollment_cart_items
  FOR SELECT USING (true);

CREATE POLICY "anon_delete_cart_items" ON enrollment_cart_items
  FOR DELETE USING (true);

CREATE POLICY "admins_cart_items" ON enrollment_cart_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('super_admin','admin'))
  );


-- ── ALTER ENROLLMENTS — add Stripe columns ────────────────
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid_cents INT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Expand enrollment_type check to include 'paid' and 'staff'


CREATE INDEX IF NOT EXISTS idx_enrollments_stripe ON enrollments(stripe_payment_intent_id);


-- ── TRIGGERS ──────────────────────────────────────────────
CREATE TRIGGER set_enrollment_carts_updated_at
  BEFORE UPDATE ON enrollment_carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── ADD ENROLLMENTS MODULE TO PLATFORM_MODULES ────────────
INSERT INTO platform_modules (key, label, description, nav_group, icon, href, sort_order, platform_enabled, tenant_enabled, nav_visible)
VALUES ('enrollments', 'Enrollments', 'Enrollment management and payment tracking', 'Students & Families', '🎓', '/admin/enrollments', 30, true, true, true)
ON CONFLICT (key) DO NOTHING;
