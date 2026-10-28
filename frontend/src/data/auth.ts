/**
 * Mock, client-side auth. This is the only module that knows how users and sessions
 * are stored, so a real provider can replace it later.
 */
import type { User } from './types';
import { KEYS, deleteUserData, migrate, readJSON, usersRepo, writeJSON } from './storage';
import { uid } from '../logic/ids';
import { api, setAuthToken } from './api';

export interface AuthSession {
  userId: string;
  createdAt: string;
  remember: boolean;
}

export const EMAIL_RE = /^\S+@\S+\.\S+$/;

export const AUTH_ERRORS = {
  email: 'Enter a valid email address.',
  password: 'Password must be at least 8 characters.',
  name: 'Enter your full name.',
  terms: 'Please accept the Terms to continue.',
  duplicate: 'An account with this email already exists.',
  invalid: 'Email or password is incorrect.',
} as const;

export async function sha256(text: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback for non-secure contexts (e.g. http on a LAN IP). Not cryptographic; mock auth only.
  let h1 = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619) >>> 0;
  return `fnv-${h1.toString(16)}-${text.length}`;
}

/** Password strength 0–4: +1 each for length ≥ 8, upper+lower, digit, symbol or length ≥ 14. */
export function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 14) s++;
  return s;
}

/** Salted with the immutable user id, so changing email keeps the password valid. */
function hashFor(userId: string, password: string) {
  return sha256(`nt:${userId}:${password}`);
}

function setSession(userId: string, remember: boolean) {
  const s: AuthSession = { userId, createdAt: new Date().toISOString(), remember };
  try {
    if (remember) {
      writeJSON(KEYS.session, s);
      sessionStorage.removeItem(KEYS.session);
    } else {
      localStorage.removeItem(KEYS.session);
      sessionStorage.setItem(KEYS.session, JSON.stringify(s));
    }
  } catch {
    /* storage unavailable */
  }
  return s;
}

export function getSession(): AuthSession | null {
  migrate();
  let s: AuthSession | null = null;
  try {
    s = readJSON<AuthSession | null>(KEYS.session, null) ?? readJSON<AuthSession | null>(KEYS.session, null, sessionStorage);
  } catch {
    s = null;
  }
  if (!s || !usersRepo.byId(s.userId)) return null;
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  if (Date.now() - new Date(s.createdAt).getTime() > THIRTY_DAYS) {
    try {
      localStorage.removeItem(KEYS.session);
      sessionStorage.removeItem(KEYS.session);
    } catch {
      /* ignore */
    }
    return null;
  }
  return s;
}

export function currentUser(): User | null {
  const s = getSession();
  return s ? usersRepo.byId(s.userId) ?? null : null;
}

export type AuthResult = { ok: true; user: User } | { ok: false; errors: Record<string, string> };

export async function signUp(input: { name: string; email: string; password: string; agree: boolean }): Promise<AuthResult> {
  const errors: Record<string, string> = {};
  if (input.name.trim().length < 2) errors.name = AUTH_ERRORS.name;
  if (!EMAIL_RE.test(input.email.trim())) errors.email = AUTH_ERRORS.email;
  if (input.password.length < 8) errors.password = AUTH_ERRORS.password;
  if (!input.agree) errors.agree = AUTH_ERRORS.terms;
  if (!errors.email && usersRepo.byEmail(input.email)) errors.email = AUTH_ERRORS.duplicate;
  if (Object.keys(errors).length) return { ok: false, errors };
  const now = new Date().toISOString();
  const id = uid('u_');
  const user: User = {
    id,
    name: input.name.trim(),
    email: input.email.trim(),
    passwordHash: await hashFor(id, input.password),
    createdAt: now,
    passwordChangedAt: now,
  };
  usersRepo.save(user);
  setSession(user.id, true);
  try {
    await api.signUp({
      id: user.id,
      name: user.name,
      email: user.email,
      password: input.password,
      passwordHash: user.passwordHash,
    });
  } catch {
    /* fallback to local */
  }
  return { ok: true, user };
}

export async function logIn(input: { email: string; password: string; remember: boolean }): Promise<AuthResult> {
  const errors: Record<string, string> = {};
  if (!EMAIL_RE.test(input.email.trim())) errors.email = AUTH_ERRORS.email;
  if (input.password.length < 8) errors.password = AUTH_ERRORS.password;
  if (Object.keys(errors).length) return { ok: false, errors };
  let user = usersRepo.byEmail(input.email);
  if (!user || user.passwordHash !== (await hashFor(user.id, input.password))) {
    // Try remote login in case account was created on another device/session
    try {
      const res = await api.logIn({
        email: input.email,
        password: input.password,
        passwordHash: '',
        remember: input.remember,
      });
      if (res?.user) {
        const passwordHash = await hashFor(res.user.id, input.password);
        user = { ...res.user, passwordHash };
        usersRepo.save(user);
      }
    } catch {
      /* ignore */
    }
  } else {
    // Local match succeeded, also log in to backend to get JWT token
    try {
      await api.logIn({
        email: input.email,
        password: input.password,
        passwordHash: user.passwordHash,
        remember: input.remember,
      });
    } catch {
      /* ignore */
    }
  }

  if (!user || user.passwordHash !== (await hashFor(user.id, input.password))) {
    return { ok: false, errors: { form: AUTH_ERRORS.invalid } };
  }
  setSession(user.id, input.remember);
  return { ok: true, user };
}

export function logOut(): void {
  try {
    localStorage.removeItem(KEYS.session);
    sessionStorage.removeItem(KEYS.session);
    setAuthToken(null);
  } catch {
    /* ignore */
  }
}

export function requestPasswordReset(email: string): { ok: boolean; error?: string } {
  if (!EMAIL_RE.test(email.trim())) return { ok: false, error: AUTH_ERRORS.email };
  if (import.meta.env?.DEV) {
    console.info(`[dev] Mock password reset requested for ${email.trim()}. No email is sent in the MVP.`);
  }
  return { ok: true };
}

export async function changePassword(userId: string, current: string, next: string): Promise<{ ok: boolean; error?: string }> {
  const user = usersRepo.byId(userId);
  if (!user) return { ok: false, error: 'Account not found.' };
  if (user.passwordHash !== (await hashFor(user.id, current))) return { ok: false, error: 'Current password is incorrect.' };
  if (next.length < 8) return { ok: false, error: AUTH_ERRORS.password };
  const newHash = await hashFor(user.id, next);
  usersRepo.save({ ...user, passwordHash: newHash, passwordChangedAt: new Date().toISOString() });
  try {
    await api.changePassword({ oldPasswordHash: user.passwordHash!, newPasswordHash: newHash });
  } catch {
    /* fallback to local */
  }
  return { ok: true };
}

export async function updateProfile(
  userId: string,
  patch: { name?: string; email?: string; avatar?: string | null },
): Promise<{ ok: boolean; errors?: Record<string, string>; user?: User }> {
  const user = usersRepo.byId(userId);
  if (!user) return { ok: false, errors: { form: 'Account not found.' } };
  const errors: Record<string, string> = {};
  const name = patch.name ?? user.name;
  const email = (patch.email ?? user.email).trim();
  if (name.trim().length < 2) errors.name = AUTH_ERRORS.name;
  if (!EMAIL_RE.test(email)) errors.email = AUTH_ERRORS.email;
  const other = usersRepo.byEmail(email);
  if (!errors.email && other && other.id !== userId) errors.email = AUTH_ERRORS.duplicate;
  if (Object.keys(errors).length) return { ok: false, errors };
  const next: User = { ...user, name: name.trim(), email };
  if (patch.avatar === null) delete next.avatar;
  else if (patch.avatar) next.avatar = patch.avatar;
  usersRepo.save(next);
  try {
    await api.updateProfile({ name: next.name, ...(next.avatar !== undefined ? { avatar: next.avatar } : {}) });
  } catch {
    /* fallback to local */
  }
  return { ok: true, user: next };
}

export function deleteAccount(userId: string): void {
  deleteUserData(userId);
  usersRepo.remove(userId);
  api.deleteAccount().catch(() => {});
  logOut();
}
