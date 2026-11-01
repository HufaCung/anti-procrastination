import 'dotenv/config';
import { databaseStartupDiagnostic } from './startup-diagnostic.js';
import type * as SQLite from './sqlite.js';
export { defaultSettings, defaultMeta } from './defaults.js';
export { DataValidationError, isDataValidationError } from './errors.js';

if (process.env.REQUIRE_DATABASE_URL === 'true' && !process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for this deployment.');
export const databaseKind = process.env.DATABASE_URL ? 'postgres' : 'sqlite';
const provider = await (async () => {
  try {
    if (databaseKind === 'postgres') { const store = await import('./postgres.js'); await store.initDb(); return store; }
    return await import('./sqlite.js');
  } catch (error) {
    throw new Error('Database initialization failed. ' + databaseStartupDiagnostic(error));
  }
})();

export const usersDb = {
  create: async (...args: Parameters<typeof SQLite.usersDb.create>) => provider.usersDb.create(...args),
  findById: async (...args: Parameters<typeof SQLite.usersDb.findById>) => provider.usersDb.findById(...args),
  findByUsername: async (...args: Parameters<typeof SQLite.usersDb.findByUsername>) => provider.usersDb.findByUsername(...args),
  update: async (...args: Parameters<typeof SQLite.usersDb.update>) => provider.usersDb.update(...args),
  upgradePasswordHash: async (...args: Parameters<typeof SQLite.usersDb.upgradePasswordHash>) => provider.usersDb.upgradePasswordHash(...args),
  changePassword: async (...args: Parameters<typeof SQLite.usersDb.changePassword>) => provider.usersDb.changePassword(...args),
  delete: async (...args: Parameters<typeof SQLite.usersDb.delete>) => provider.usersDb.delete(...args),
};

export const projectsDb = {
  getByUser: async (...args: Parameters<typeof SQLite.projectsDb.getByUser>) => provider.projectsDb.getByUser(...args),
  save: async (...args: Parameters<typeof SQLite.projectsDb.save>) => provider.projectsDb.save(...args),
  delete: async (...args: Parameters<typeof SQLite.projectsDb.delete>) => provider.projectsDb.delete(...args),
};

export const tasksDb = {
  getByUser: async (...args: Parameters<typeof SQLite.tasksDb.getByUser>) => provider.tasksDb.getByUser(...args),
  save: async (...args: Parameters<typeof SQLite.tasksDb.save>) => provider.tasksDb.save(...args),
  delete: async (...args: Parameters<typeof SQLite.tasksDb.delete>) => provider.tasksDb.delete(...args),
};

export const sessionsDb = {
  getByUser: async (...args: Parameters<typeof SQLite.sessionsDb.getByUser>) => provider.sessionsDb.getByUser(...args),
  save: async (...args: Parameters<typeof SQLite.sessionsDb.save>) => provider.sessionsDb.save(...args),
  delete: async (...args: Parameters<typeof SQLite.sessionsDb.delete>) => provider.sessionsDb.delete(...args),
};

export const settingsDb = {
  get: async (...args: Parameters<typeof SQLite.settingsDb.get>) => provider.settingsDb.get(...args),
  save: async (...args: Parameters<typeof SQLite.settingsDb.save>) => provider.settingsDb.save(...args),
};

export const metaDb = {
  get: async (...args: Parameters<typeof SQLite.metaDb.get>) => provider.metaDb.get(...args),
  save: async (...args: Parameters<typeof SQLite.metaDb.save>) => provider.metaDb.save(...args),
};
export const getAppData = async (...args: Parameters<typeof SQLite.getAppData>) => provider.getAppData(...args);
export const getAppDataSnapshot = async (...args: Parameters<typeof SQLite.getAppDataSnapshot>) => provider.getAppDataSnapshot(...args);
export const saveAppData = async (...args: Parameters<typeof SQLite.saveAppData>) => provider.saveAppData(...args);
export const syncAppData = async (...args: Parameters<typeof SQLite.syncAppData>) => provider.syncAppData(...args);
export const getDataRevision = async (...args: Parameters<typeof SQLite.getDataRevision>) => provider.getDataRevision(...args);
export const getAdminUsers = async (...args: Parameters<typeof SQLite.getAdminUsers>) => provider.getAdminUsers(...args);
export const createAdminAccount = async (...args: Parameters<typeof SQLite.createAdminAccount>) => provider.createAdminAccount(...args);
export const closeDatabase = async (...args: Parameters<typeof SQLite.closeDatabase>) => provider.closeDatabase(...args);
