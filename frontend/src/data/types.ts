export type ID = string;
export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type Risk = 'on_track' | 'at_risk' | 'overdue' | 'done';
export type Theme = 'light' | 'dark';

export interface User {
  id: ID;
  name: string;
  email: string;
  passwordHash?: string; // mock auth: SHA-256 via SubtleCrypto
  createdAt: string;
  avatar?: string; // data URL
  passwordChangedAt?: string;
}

export interface Settings {
  userId: ID;
  theme: Theme;
  dailyGoalMin: number; // default 180
  defaultTaskMin: 10 | 15; // default 15
  timeZone: string; // default 'Asia/Ho_Chi_Minh'
  weekStart: 'mon' | 'sun'; // default 'mon'
  autoReplan: boolean; // nightly at 22:00 local
  deadlineAlerts: boolean;
  weeklyDigest: boolean;
  focusSound: boolean;
}

export interface Project {
  id: ID;
  userId: ID;
  name: string;
  color: string;
  description?: string;
  priority: Priority;
  dueDate: string; // ISO date (YYYY-MM-DD), end of day local
  createdAt: string;
  completedAt?: string;
}

export interface Task {
  id: ID;
  userId: ID;
  projectId: ID;
  section: string; // e.g. "3.2 Participants"; "Inbox" default
  title: string;
  estimateMin: number; // 10–15 typical, 5–30 allowed
  status: TaskStatus;
  order: number;
  scheduledFor?: string; // ISO datetime (slot start)
  completedAt?: string;
  createdAt: string;
  replannedFrom?: string; // previous scheduledFor, for "replanned" labels
}

export interface FocusSession {
  id: ID;
  userId: ID;
  taskId?: ID;
  projectId?: ID;
  startedAt: string;
  endedAt: string;
  minutes: number;
  completedTask: boolean;
}

/** Active focus timer, persisted so it survives reloads and sleeping laptops. */
export interface ActiveTimer {
  taskId?: ID;
  lengthMs: number; // total planned length (presets + extensions)
  endsAt?: number; // epoch ms, set while running
  remainingMs: number; // used while paused
  running: boolean;
  firstStartedAt?: string; // ISO, first time Start was pressed
}

export interface ParkingNote {
  id: ID;
  text: string;
  createdAt: string;
}

export interface ReplanUndo {
  at: string;
  entries: { taskId: ID; scheduledFor?: string; replannedFrom?: string }[];
}

export interface Meta {
  userId: ID;
  lastAutoReplanAt?: string;
  shownAlerts: string[]; // "<projectId>:<kind>"
  snoozedAlerts: Record<ID, string>; // projectId -> YYYY-MM-DD hidden for that day
  timer?: ActiveTimer;
  parking: ParkingNote[];
  lastReplan?: ReplanUndo;
  onboarded?: boolean; // false right after sign-up until onboarding is finished or skipped
}

export interface AppData {
  projects: Project[];
  tasks: Task[];
  sessions: FocusSession[];
  settings: Settings;
  meta: Meta;
}
