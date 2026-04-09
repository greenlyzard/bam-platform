-- Prevent duplicate active opportunities of the same type per student.
-- Partial unique index — only enforces uniqueness while status = 'active'.
-- Dismissed/snoozed/converted rows can coexist freely.
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_opp_unique_active
  ON student_opportunities(student_id, opportunity_type)
  WHERE status = 'active';
