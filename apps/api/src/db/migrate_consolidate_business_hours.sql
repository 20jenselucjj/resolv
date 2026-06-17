-- migrate_consolidate_business_hours.sql
-- Consolidates duplicate business hours and holidays tables:
--   working_hours  → business_hours  (SLA + notif use same schedule)
--   holidays       → business_holidays (single holiday source)
-- Only runs if the old source tables exist.

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'working_hours') THEN
    INSERT INTO business_hours (day_of_week, start_time, end_time, is_business_day)
    SELECT
      CASE day
        WHEN 'Monday'    THEN 1
        WHEN 'Tuesday'   THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday'  THEN 4
        WHEN 'Friday'    THEN 5
        WHEN 'Saturday'  THEN 6
        WHEN 'Sunday'    THEN 0
      END,
      CASE WHEN start_time ~ '^\d{2}:\d{2}$' THEN start_time || ':00' ELSE start_time END::time,
      CASE WHEN end_time ~ '^\d{2}:\d{2}$' THEN end_time || ':00' ELSE end_time END::time,
      enabled
    FROM working_hours wh
    WHERE NOT EXISTS (
      SELECT 1 FROM business_hours bh
      WHERE bh.day_of_week = CASE wh.day
        WHEN 'Monday'    THEN 1
        WHEN 'Tuesday'   THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday'  THEN 4
        WHEN 'Friday'    THEN 5
        WHEN 'Saturday'  THEN 6
        WHEN 'Sunday'    THEN 0
      END
    )
    ON CONFLICT (day_of_week) DO NOTHING;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'holidays') THEN
    INSERT INTO business_holidays (name, holiday_date, is_annual)
    SELECT name, date, recurring
    FROM holidays h
    WHERE NOT EXISTS (
      SELECT 1 FROM business_holidays bh
      WHERE bh.holiday_date = h.date AND bh.name = h.name
    );
  END IF;
END $$;

-- Drop old tables only if they exist
DROP TABLE IF EXISTS working_hours CASCADE;
DROP TABLE IF EXISTS holidays CASCADE;
