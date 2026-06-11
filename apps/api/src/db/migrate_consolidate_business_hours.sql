-- migrate_consolidate_business_hours.sql
-- Consolidates duplicate business hours and holidays tables:
--   working_hours  → business_hours  (SLA + notif use same schedule)
--   holidays       → business_holidays (single holiday source)

-- 1. Transfer any working_hours data not already in business_hours
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

-- 2. Transfer any holidays data not already in business_holidays
INSERT INTO business_holidays (name, holiday_date, is_annual)
SELECT name, date, recurring
FROM holidays h
WHERE NOT EXISTS (
  SELECT 1 FROM business_holidays bh
  WHERE bh.holiday_date = h.date AND bh.name = h.name
);

-- 3. Drop the old tables (data now lives in business_hours / business_holidays)
DROP TABLE IF EXISTS working_hours CASCADE;
DROP TABLE IF EXISTS holidays CASCADE;

-- 4. Clean up old system_settings keys that are superseded by business_hours_config
-- (the 'timezone' key in system_settings is still used by general config, keep it)
