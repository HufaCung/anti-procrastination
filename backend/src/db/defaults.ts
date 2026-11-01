import type { Settings, Meta } from '../types.js';

export function defaultSettings(userId: string): Settings {
  return {
    userId,
    theme: 'light',
    dailyGoalMin: 180,
    defaultTaskMin: 15,
    timeZone: 'Asia/Ho_Chi_Minh',
    weekStart: 'mon',
    autoReplan: true,
    deadlineAlerts: true,
    weeklyDigest: false,
    focusSound: true,
  };
}

export function defaultMeta(userId: string): Meta {
  return { userId, shownAlerts: [], snoozedAlerts: {}, parking: [], onboarded: false };
}
