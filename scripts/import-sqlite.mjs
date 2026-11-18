import 'dotenv/config';
import Database from 'better-sqlite3';
import path from 'node:path';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to the destination PostgreSQL database.');
if (!process.env.SQLITE_IMPORT_PATH) throw new Error('Set SQLITE_IMPORT_PATH to the source SQLite database file.');
const source = new Database(path.resolve(process.env.SQLITE_IMPORT_PATH), { readonly: true, fileMustExist: true });
let client;
let store;
try {
  store = await import('../backend/dist/db/database.js');
  const { pool } = await import('../backend/dist/db/postgres.js');
  client = await pool.connect();
  await client.query('BEGIN');
  await client.query('LOCK TABLE users,projects,tasks,focus_sessions,settings,meta,data_revisions IN ACCESS EXCLUSIVE MODE');
  if (Number((await client.query('SELECT count(*) AS count FROM users')).rows[0].count) !== 0) throw new Error('Destination is not empty. Import was refused; existing accounts were not changed.');
  const tables = new Set(source.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
  const read = table => tables.has(table) ? source.prepare(`SELECT * FROM ${table}`).all() : [];
  const users = read('users');
  const projects = read('projects');
  const tasks = read('tasks');
  const projectById = new Map(projects.map(row => [row.id,row]));
  const taskById = new Map(tasks.map(row => [row.id,row]));
  const insert = async (table, row) => {
    const keys = Object.keys(row);
    await client.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>`$${i+1}`).join(',')})`, Object.values(row));
  };
  for (const row of users) await insert('users',{ id:row.id,name:row.name,username:(row.username ?? row.email).trim().toLowerCase(),password_hash:row.password_hash,created_at:row.created_at,avatar:row.avatar ?? null,password_changed_at:row.password_changed_at ?? null,role:row.role ?? 'user',auth_version:row.auth_version ?? 0 });
  for (const row of projects) await insert('projects',row);
  for (const row of tasks) {
    if (projectById.get(row.project_id)?.user_id !== row.user_id) throw new Error('Source contains an invalid task/project owner. No data imported.');
    await insert('tasks',{ ...row,subtasks:row.subtasks ?? null,due_date:row.due_date ?? null });
  }
  for (const original of read('focus_sessions')) {
    const row={...original,completed_task:!!original.completed_task};
    const task=taskById.get(row.task_id);
    if (!task || task.user_id!==row.user_id || (row.project_id && task.project_id!==row.project_id)) row.task_id=null;
    if (projectById.get(row.project_id)?.user_id!==row.user_id) row.project_id=null;
    await insert('focus_sessions',row);
  }
  for (const original of read('settings')) {
    const row={...original};
    for(const key of ['auto_replan','deadline_alerts','weekly_digest','focus_sound']) row[key]=!!row[key];
    await insert('settings',row);
  }
  for (const original of read('meta')) await insert('meta',{...original,onboarded:!!original.onboarded});
  const revisions=new Map(read('data_revisions').map(row=>[row.user_id,row.revision]));
  for(const row of users) await client.query('INSERT INTO data_revisions(user_id,revision) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET revision=GREATEST(data_revisions.revision,EXCLUDED.revision)+1',[row.id,Number(revisions.get(row.id)??0)+1]);
  await client.query('COMMIT');
  console.log(`Import complete: ${users.length} users, ${projects.length} projects, ${tasks.length} tasks. Source was read-only.`);
} catch (error) {
  if(client)await client.query('ROLLBACK');
  console.error(error instanceof Error && ['Destination is not empty','Source contains'].some(prefix=>error.message.startsWith(prefix)) ? error.message : 'Import failed. Check source data and destination configuration. No account data was overwritten.');
  process.exitCode=1;
} finally {
  client?.release();
  source.close();
  if(store)await store.closeDatabase();
}
