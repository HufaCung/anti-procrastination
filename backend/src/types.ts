export type ID = string;
export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type Risk = 'on_track' | 'at_risk' | 'overdue' | 'done';
export type Theme = 'light' | 'dark';

export interface User {
  id: ID;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
  avatar?: string;
  passwordChangedAt?: string;
}

export type SafeUser = Omit<User, 'passwordHash'>;

export interface Settings {
  userId: ID;
  theme: Theme;
  dailyGoalMin: number;
  defaultTaskMin: 10 | 15;
  timeZone: string;
  weekStart: 'mon' | 'sun';
  autoReplan: boolean;
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
  dueDate: string;
  createdAt: string;
  completedAt?: string;
}

export interface Task {
  id: ID;
  userId: ID;
  projectId: ID;
  section: string;
  title: string;
  estimateMin: number;
  status: TaskStatus;
  order: number;
  scheduledFor?: string;
  completedAt?: string;
  createdAt: string;
  replannedFrom?: string;
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

export interface ActiveTimer {
  taskId?: ID;
  lengthMs: number;
  endsAt?: number;
  remainingMs: number;
  running: boolean;
  firstStartedAt?: string;
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
  shownAlerts: string[];
  snoozedAlerts: Record<ID, string>;
  timer?: ActiveTimer;
  parking: ParkingNote[];
  lastReplan?: ReplanUndo;
  onboarded?: boolean;
}

export interface AppData {
  projects: Project[];
  tasks: Task[];
  sessions: FocusSession[];
  settings: Settings;
  meta: Meta;
}
