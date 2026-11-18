import { DataValidationError } from './errors.js';
import type { Settings } from '../types.js';

export function validateWorkSchedule(settings: Settings): void {
  const { workStartMin, workEndMin, daysOffMask } = settings;
  const start = workStartMin === undefined ? 540 : workStartMin;
  const end = workEndMin === undefined ? 1320 : workEndMin;
  const daysOff = daysOffMask === undefined ? 0 : daysOffMask;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1439 || start >= end
    || !Number.isInteger(daysOff) || daysOff < 0 || daysOff > 126) {
    throw new DataValidationError('Invalid working hours or days off');
  }
}
