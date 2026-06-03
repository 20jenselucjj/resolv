// business-hours.ts — Business hours calculation and awareness
// Used by notification scheduler to delay non-critical notifications outside business hours
// and by SLA calculations to count only business hours.

import { pool } from '../db/pool';

export interface BusinessHoursConfig {
  enabled: boolean;
  timezone: string;
  respect_for_notifications: boolean;
  respect_for_sla: boolean;
}

export interface DaySchedule {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_business_day: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

function getTimeInTimezone(date: Date, timezone: string): { hours: number; minutes: number; dayOfWeek: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hours = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);

  const dowFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  });
  const dowName = dowFormatter.format(date);
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return { hours, minutes, dayOfWeek: dowMap[dowName] ?? date.getDay() };
}

function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':');
  const hours = parseInt(parts[0] || '0', 10);
  const minutes = parseInt(parts[1] || '0', 10);
  return hours * 60 + minutes;
}

function minutesToTimeString(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function createDateInTimezone(date: Date, timezone: string, hours: number, minutes: number): Date {
  // Use the date's year/month/day in the target timezone, then set the time
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateParts = dateFormatter.formatToParts(date);
  const year = parseInt(dateParts.find(p => p.type === 'year')?.value || '0', 10);
  const month = parseInt(dateParts.find(p => p.type === 'month')?.value || '0', 10) - 1;
  const day = parseInt(dateParts.find(p => p.type === 'day')?.value || '0', 10);

  // Construct a Date in the local timezone that represents the target time in the target timezone
  // We use UTC to avoid local DST shifts
  const utcDate = new Date(Date.UTC(year, month, day, hours, minutes, 0, 0));

  // Convert from UTC to the target timezone offset, then back to a Date object
  // Get the target timezone offset for this UTC moment
  const tzOffset = getTimezoneOffset(timezone, utcDate);
  return new Date(utcDate.getTime() + tzOffset);
}

function getTimezoneOffset(timezone: string, date: Date): number {
  // Returns the offset in milliseconds to add to UTC to get the time in the target timezone
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
  });
  const parts = tzFormatter.formatToParts(date);
  const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
  // Parse offset like "GMT+7" or "GMT-05:00" or "GMT"
  const match = tzPart.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 0;
  const sign = match[1] === '+' ? 1 : -1;
  const tzHours = parseInt(match[2], 10);
  const tzMinutes = parseInt(match[3] || '0', 10);
  return sign * (tzHours * 60 + tzMinutes) * 60 * 1000;
}

// ── Config ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG: BusinessHoursConfig = {
  enabled: false,
  timezone: 'America/Denver',
  respect_for_notifications: false,
  respect_for_sla: true,
};

const DEFAULT_DAY_SCHEDULE: Omit<DaySchedule, 'day_of_week'> = {
  start_time: '08:00:00',
  end_time: '17:00:00',
  is_business_day: true,
};

/**
 * Load business hours config from system_settings.
 */
export async function loadBusinessHoursConfig(): Promise<BusinessHoursConfig> {
  try {
    const result = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'business_hours_config'"
    );
    if (result.rows.length > 0) {
      const parsed = JSON.parse(result.rows[0].value);
      return {
        enabled: parsed.enabled === true,
        timezone: parsed.timezone || DEFAULT_CONFIG.timezone,
        respect_for_notifications: parsed.respect_for_notifications === true,
        respect_for_sla: parsed.respect_for_sla !== false,
      };
    }
  } catch (err: any) {
    console.error('[business-hours] Error loading config:', err.message);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Save business hours config.
 */
export async function saveBusinessHoursConfig(config: BusinessHoursConfig): Promise<void> {
  try {
    const value = JSON.stringify(config);
    await pool.query(
      `INSERT INTO system_settings (key, value) VALUES ('business_hours_config', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [value]
    );
  } catch (err: any) {
    console.error('[business-hours] Error saving config:', err.message);
    throw err;
  }
}

// ── Day Schedule ─────────────────────────────────────────────────────

/**
 * Get the schedule for a specific day of the week.
 */
export async function getDaySchedule(dayOfWeek: number): Promise<DaySchedule> {
  try {
    const result = await pool.query(
      'SELECT day_of_week, start_time, end_time, is_business_day FROM business_hours WHERE day_of_week = $1',
      [dayOfWeek]
    );
    if (result.rows.length > 0) {
      return {
        day_of_week: result.rows[0].day_of_week,
        start_time: result.rows[0].start_time,
        end_time: result.rows[0].end_time,
        is_business_day: result.rows[0].is_business_day,
      };
    }
  } catch (err: any) {
    console.error('[business-hours] Error getting day schedule:', err.message);
  }
  return {
    day_of_week: dayOfWeek,
    ...DEFAULT_DAY_SCHEDULE,
  };
}

/**
 * Get the full week schedule.
 */
export async function getWeekSchedule(): Promise<DaySchedule[]> {
  try {
    const result = await pool.query(
      'SELECT day_of_week, start_time, end_time, is_business_day FROM business_hours ORDER BY day_of_week'
    );
    if (result.rows.length > 0) {
      return result.rows.map((row: any) => ({
        day_of_week: row.day_of_week,
        start_time: row.start_time,
        end_time: row.end_time,
        is_business_day: row.is_business_day,
      }));
    }
  } catch (err: any) {
    console.error('[business-hours] Error getting week schedule:', err.message);
  }
  // Return defaults for all 7 days
  return Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i,
    ...DEFAULT_DAY_SCHEDULE,
  }));
}

/**
 * Update a specific day's schedule.
 */
export async function updateDaySchedule(
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  isBusinessDay: boolean
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO business_hours (day_of_week, start_time, end_time, is_business_day)
       VALUES ($1, $2::time, $3::time, $4)
       ON CONFLICT (day_of_week) DO UPDATE SET
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         is_business_day = EXCLUDED.is_business_day`,
      [dayOfWeek, startTime, endTime, isBusinessDay]
    );
  } catch (err: any) {
    console.error('[business-hours] Error updating day schedule:', err.message);
    throw err;
  }
}

// ── Holidays ─────────────────────────────────────────────────────────

/**
 * Check if a specific date is a business holiday.
 */
export async function isHoliday(date: Date): Promise<boolean> {
  try {
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const mmdd = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const result = await pool.query(
      `SELECT id FROM business_holidays
       WHERE holiday_date = $1::date
          OR (is_annual = true AND to_char(holiday_date, 'MM-DD') = $2)`,
      [dateStr, mmdd]
    );
    return result.rows.length > 0;
  } catch (err: any) {
    console.error('[business-hours] Error checking holiday:', err.message);
    return false;
  }
}

/**
 * Add a business holiday.
 */
export async function addHoliday(
  name: string,
  holidayDate: Date,
  isAnnual: boolean = false
): Promise<void> {
  try {
    const dateStr = holidayDate.toISOString().split('T')[0];
    await pool.query(
      'INSERT INTO business_holidays (name, holiday_date, is_annual) VALUES ($1, $2::date, $3)',
      [name, dateStr, isAnnual]
    );
  } catch (err: any) {
    console.error('[business-hours] Error adding holiday:', err.message);
    throw err;
  }
}

/**
 * Remove a business holiday.
 */
export async function removeHoliday(id: string): Promise<void> {
  try {
    const result = await pool.query('DELETE FROM business_holidays WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      console.warn(`[business-hours] No holiday found with id ${id}`);
    }
  } catch (err: any) {
    console.error('[business-hours] Error removing holiday:', err.message);
    throw err;
  }
}

/**
 * Get all configured holidays.
 */
export async function getHolidays(): Promise<any[]> {
  try {
    const result = await pool.query(
      'SELECT id, name, holiday_date, is_annual FROM business_holidays ORDER BY holiday_date'
    );
    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      holiday_date: row.holiday_date,
      is_annual: row.is_annual,
    }));
  } catch (err: any) {
    console.error('[business-hours] Error getting holidays:', err.message);
    return [];
  }
}

// ── Business Hours Checks ────────────────────────────────────────────

/**
 * Check if a given date/time is within business hours.
 */
export async function isWithinBusinessHours(date: Date = new Date()): Promise<boolean> {
  try {
    const config = await loadBusinessHoursConfig();
    if (!config.enabled) return true;

    // Check if date is a holiday
    const holiday = await isHoliday(date);
    if (holiday) return false;

    // Get time in the configured timezone
    const { hours, minutes, dayOfWeek } = getTimeInTimezone(date, config.timezone);

    // Get day schedule
    const schedule = await getDaySchedule(dayOfWeek);
    if (!schedule.is_business_day) return false;

    const currentMinutes = hours * 60 + minutes;
    const startMinutes = parseTimeToMinutes(schedule.start_time);
    const endMinutes = parseTimeToMinutes(schedule.end_time);

    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } catch (err: any) {
    console.error('[business-hours] Error checking business hours:', err.message);
    return true; // Default to available on error
  }
}

/**
 * Get the next business hours start time from a given date.
 * Used to delay notifications until business hours resume.
 */
export async function getNextBusinessHoursStart(fromDate: Date): Promise<Date> {
  try {
    const config = await loadBusinessHoursConfig();
    if (!config.enabled) return fromDate;

    // If currently within business hours, return now
    if (await isWithinBusinessHours(fromDate)) return fromDate;

    const { hours, minutes, dayOfWeek } = getTimeInTimezone(fromDate, config.timezone);

    // Start checking from today forward
    let checkDate = new Date(fromDate);
    const maxDaysForward = 14; // Safety limit

    for (let i = 0; i < maxDaysForward; i++) {
      const currentDOW = i === 0 ? dayOfWeek : getTimeInTimezone(checkDate, config.timezone).dayOfWeek;

      // Only check full days after the first iteration
      if (i > 0) {
        // Reset checkDate to start of day in the target timezone
        const { dayOfWeek: newDOW } = getTimeInTimezone(checkDate, config.timezone);

        if (await isHoliday(checkDate)) {
          checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
          continue;
        }

        const schedule = await getDaySchedule(newDOW);
        if (schedule.is_business_day) {
          // Return the start time of this day
          const startMinutes = parseTimeToMinutes(schedule.start_time);
          const startHours = Math.floor(startMinutes / 60);
          const startMins = startMinutes % 60;
          return createDateInTimezone(checkDate, config.timezone, startHours, startMins);
        }
      } else {
        // Today — check if there's remaining time today
        if (await isHoliday(checkDate)) {
          checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
          continue;
        }

        const schedule = await getDaySchedule(currentDOW);
        if (schedule.is_business_day) {
          const currentMinutes = hours * 60 + minutes;
          const endMinutes = parseTimeToMinutes(schedule.end_time);

          if (currentMinutes < endMinutes) {
            // Still have time today but current time is before start — return start time
            if (currentMinutes < parseTimeToMinutes(schedule.start_time)) {
              const startMinutes = parseTimeToMinutes(schedule.start_time);
              const startHours = Math.floor(startMinutes / 60);
              const startMins = startMinutes % 60;
              return createDateInTimezone(fromDate, config.timezone, startHours, startMins);
            }
          }
        }
      }

      checkDate = new Date(checkDate.getTime() + 24 * 60 * 60 * 1000);
    }

    // Fallback: 1 day from now at 08:00
    const tomorrow = new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
    return createDateInTimezone(tomorrow, config.timezone, 8, 0);
  } catch (err: any) {
    console.error('[business-hours] Error getting next business hours start:', err.message);
    return fromDate;
  }
}

/**
 * Calculate business hours between two dates.
 * Used for SLA calculations — only counts hours within business hours.
 * Returns total business milliseconds between the two dates.
 */
export async function calculateBusinessHoursBetween(start: Date, end: Date): Promise<number> {
  try {
    const config = await loadBusinessHoursConfig();
    if (!config.enabled) {
      return Math.max(0, end.getTime() - start.getTime());
    }

    let totalMs = 0;
    const current = new Date(start);

    // Cap iteration to prevent infinite loops
    const maxDays = 365;
    let daysChecked = 0;

    while (current < end && daysChecked < maxDays) {
      const { hours, minutes, dayOfWeek } = getTimeInTimezone(current, config.timezone);

      const isHolidayResult = await isHoliday(current);
      const schedule = await getDaySchedule(dayOfWeek);

      if (!isHolidayResult && schedule.is_business_day) {
        const currentMinutes = hours * 60 + minutes;
        const startMinutes = parseTimeToMinutes(schedule.start_time);
        const endMinutes = parseTimeToMinutes(schedule.end_time);

        // Calculate the effective business time window for this day
        const dayStartMinutes = Math.max(currentMinutes, startMinutes);
        const dayEndMinutes = Math.min(
          endMinutes,
          // If 'end' falls on the same day, cap at end's time
          current.toDateString() === end.toDateString()
            ? getTimeInTimezone(end, config.timezone).hours * 60 + getTimeInTimezone(end, config.timezone).minutes
            : endMinutes
        );

        if (dayStartMinutes < dayEndMinutes) {
          totalMs += (dayEndMinutes - dayStartMinutes) * 60 * 1000;
        }
      }

      // Move to next day at midnight in the target timezone
      const tomorrow = new Date(current);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      current.setTime(tomorrow.getTime());
      daysChecked++;
    }

    return totalMs;
  } catch (err: any) {
    console.error('[business-hours] Error calculating business hours between:', err.message);
    return Math.max(0, end.getTime() - start.getTime());
  }
}

/**
 * Add business hours to a date.
 * Used for SLA due date calculation — only adds hours within business hours.
 * Returns a new Date that is `hours` business hours after `startDate`.
 */
export async function addBusinessHours(startDate: Date, hours: number): Promise<Date> {
  try {
    const config = await loadBusinessHoursConfig();
    if (!config.enabled) {
      const result = new Date(startDate);
      result.setHours(result.getHours() + hours);
      return result;
    }

    if (hours <= 0) return new Date(startDate);

    let remainingMinutes = Math.round(hours * 60);
    const current = new Date(startDate);

    // Cap iteration to prevent infinite loops
    const maxDays = 365;
    let daysChecked = 0;

    while (remainingMinutes > 0 && daysChecked < maxDays) {
      const { hours: h, minutes: m, dayOfWeek } = getTimeInTimezone(current, config.timezone);

      const isHolidayResult = await isHoliday(current);
      const schedule = await getDaySchedule(dayOfWeek);

      if (!isHolidayResult && schedule.is_business_day) {
        const currentMinutes = h * 60 + m;
        const startMinutes = parseTimeToMinutes(schedule.start_time);
        const endMinutes = parseTimeToMinutes(schedule.end_time);

        // If we're before business hours, jump to start
        const effectiveStart = Math.max(currentMinutes, startMinutes);
        const availableMinutes = Math.max(0, endMinutes - effectiveStart);

        if (availableMinutes > 0) {
          if (remainingMinutes <= availableMinutes) {
            // We can finish today
            const targetMinutes = effectiveStart + remainingMinutes;
            const targetHours = Math.floor(targetMinutes / 60);
            const targetMins = targetMinutes % 60;
            return createDateInTimezone(current, config.timezone, targetHours, targetMins);
          }

          remainingMinutes -= availableMinutes;
        }
      }

      // Move to next day at start of business day
      const nextDay = new Date(current);
      nextDay.setDate(nextDay.getDate() + 1);
      current.setTime(nextDay.getTime());
      daysChecked++;
    }

    // If we exhausted the loop without finishing, return an estimate
    const result = new Date(startDate);
    result.setHours(result.getHours() + hours);
    return result;
  } catch (err: any) {
    console.error('[business-hours] Error adding business hours:', err.message);
    const result = new Date(startDate);
    result.setHours(result.getHours() + hours);
    return result;
  }
}
