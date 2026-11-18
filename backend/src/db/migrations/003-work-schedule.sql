ALTER TABLE settings
  ADD COLUMN work_start_min INTEGER NOT NULL DEFAULT 540 CHECK (work_start_min BETWEEN 0 AND 1438),
  ADD COLUMN work_end_min INTEGER NOT NULL DEFAULT 1320 CHECK (work_end_min BETWEEN 1 AND 1439),
  ADD COLUMN days_off_mask INTEGER NOT NULL DEFAULT 0 CHECK (days_off_mask BETWEEN 0 AND 126),
  ADD CONSTRAINT settings_work_hours_order CHECK (work_end_min > work_start_min);
