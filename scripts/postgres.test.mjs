import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { startTestPostgres } from './helpers/embedded-postgres.mjs';
import { seedDemo } from './seed-demo.mjs';

test('PostgreSQL migration and API integration', { timeout: 120000 }, async t => {
  const cluster = await startTestPostgres();
  const control = new pg.Client({ connectionString: cluster.connectionString });
  let server; let store; let child;
  try {
    await control.connect();
    // Match Supabase's browser roles/default table grants before applying migration.
    await control.query('CREATE ROLE anon; CREATE ROLE authenticated; ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,authenticated');
    process.env.DATABASE_URL = cluster.connectionString;
    process.env.REQUIRE_DATABASE_URL = 'true';
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = randomUUID();
    const { app } = await import('../backend/dist/server.js');
    store = await import('../backend/dist/db/database.js');
    const native = await import('../backend/dist/db/postgres.js');
    server = await new Promise(resolve => { const instance = app.listen(0,'127.0.0.1', () => resolve(instance)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (route, method = 'GET', data, token) => {
      const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
      return { status: response.status, data: await response.json() };
    };
    const password = randomUUID();
    let a; let b; let admin;
    const signup = async () => (await call('/api/auth/signup','POST',{ username: `pg-${randomUUID()}`, password })).data;
    await t.test('migration is repeatable and Supabase browser roles cannot read tables', async () => {
      await native.initDb();
      assert.equal((await control.query('SELECT count(*)::int AS count FROM tinydo_schema_migrations')).rows[0].count,1);
      const rows = (await control.query("SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('users','projects','tasks','focus_sessions','settings','meta','data_revisions','tinydo_schema_migrations')")).rows;
      assert.equal(rows.length,8); assert.ok(rows.every(row => row.relrowsecurity));
      assert.equal((await control.query("SELECT has_table_privilege('anon','users','SELECT') AS allowed")).rows[0].allowed,false);
      await control.query('BEGIN; SET LOCAL ROLE anon');
      await assert.rejects(control.query('SELECT * FROM users'), error => error.code === '42501');
      await control.query('ROLLBACK');
    });
    await t.test('signup, case-insensitive login, admin bootstrap and safe statistics work', async () => {
      a = await signup(); b = await signup();
      assert.equal(a.user.role,'user');
      assert.equal((await call('/api/auth/login','POST',{ username: a.user.username.toUpperCase(), password })).status,200);
      assert.equal((await call('/api/admin/users','GET',undefined,a.token)).status,403);
      const { bootstrapAdmin } = await import('../backend/dist/services/admin-bootstrap.js');
      assert.equal(await bootstrapAdmin({ BOOTSTRAP_ADMIN: 'true', ADMIN_USERNAME: 'pg-admin', ADMIN_PASSWORD: password }),'created');
      assert.equal(await bootstrapAdmin({ BOOTSTRAP_ADMIN: 'true', ADMIN_USERNAME: 'pg-admin', ADMIN_PASSWORD: 'stale-secret' }),'existing');
      admin = (await call('/api/auth/login','POST',{ username: 'pg-admin', password })).data;
      const listing = await call('/api/admin/users?q=pg-admin','GET',undefined,admin.token);
      assert.equal(listing.status,200); assert.equal(listing.data.total,1);
      assert.ok(!JSON.stringify(listing.data).includes('passwordHash'));
    });
    let pa; let pb; let ta;
    await t.test('projects, tasks, subtasks and settings round-trip without API shape changes', async () => {
      const create = token => call('/api/projects','POST',{ name:'Postgres project', dueDate:'2027-01-01' },token);
      pa = (await create(a.token)).data.project; pb = (await create(b.token)).data.project;
      const result = await call('/api/tasks','POST',{ projectId:pa.id,title:'PG task',estimateMin:15,dueDate:'2026-12-30',subtasks:[{id:randomUUID(),title:'Step',done:false}] },a.token);
      assert.equal(result.status,201); ta=result.data.task;
      const snapshot = (await call('/api/data','GET',undefined,a.token)).data;
      assert.equal(snapshot.data.tasks[0].subtasks[0].done,false);
      assert.equal(snapshot.data.settings.autoReplan,true);
      assert.equal(typeof snapshot.revision,'number');
    });
    await t.test('cross-user writes and invalid session references roll back atomically', async () => {
      assert.equal((await call('/api/projects','POST',{ ...pa,name:'Steal' },b.token)).status,400);
      for (const reference of [{ projectId:pb.id },{ taskId:randomUUID() },{ taskId:ta.id,projectId:pb.id }]) {
        assert.equal((await call('/api/sessions','POST',{ ...reference,startedAt:'2026-11-01T01:00:00Z',endedAt:'2026-11-01T01:15:00Z',minutes:15 },a.token)).status,400);
      }
      const before = (await call('/api/data','GET',undefined,a.token)).data;
      const invalid = structuredClone(before); invalid.data.projects[0].name='Should roll back';
      invalid.data.sessions.push({ id:randomUUID(),userId:a.user.id,projectId:pb.id,startedAt:'2026-11-01T01:00:00Z',endedAt:'2026-11-01T01:15:00Z',minutes:15,completedTask:false });
      assert.equal((await call('/api/data','PUT',invalid,a.token)).status,400);
      assert.deepEqual((await call('/api/data','GET',undefined,a.token)).data,before);
      await assert.rejects(control.query('INSERT INTO tasks(id,user_id,project_id,section,title,estimate_min,status,task_order,created_at) VALUES($1,$2,$3,$4,$5,15,$6,0,$7)',[randomUUID(),a.user.id,pb.id,'Inbox','Foreign','todo',new Date().toISOString()]), error => error.code==='23503');
    });
    await t.test('two concurrent snapshots produce one success and one conflict', async () => {
      const snapshot = (await call('/api/data','GET',undefined,a.token)).data;
      const results = await Promise.all(['First','Second'].map(name => { const payload=structuredClone(snapshot);payload.data.projects[0].name=name;return call('/api/data','PUT',payload,a.token); }));
      assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
      const winner = results.find(r=>r.status===200);
      assert.equal((await call('/api/data','GET',undefined,a.token)).data.revision,winner.data.revision);
    });
    await t.test('database triggers reject mismatched session/task projects and deletion preserves history', async () => {
      const second=(await call('/api/projects','POST',{name:'Other',dueDate:'2027-01-01'},a.token)).data.project;
      await assert.rejects(control.query('INSERT INTO focus_sessions(id,user_id,task_id,project_id,started_at,ended_at,minutes) VALUES($1,$2,$3,$4,$5,$6,15)',[randomUUID(),a.user.id,ta.id,second.id,'2026-11-01T01:00:00Z','2026-11-01T01:15:00Z']),error=>error.code==='23514');
      assert.equal((await call('/api/sessions','POST',{ taskId:ta.id,projectId:pa.id,startedAt:'2026-11-01T01:00:00Z',endedAt:'2026-11-01T01:15:00Z',minutes:15 },a.token)).status,201);
      assert.equal((await call(`/api/tasks/${ta.id}`,'DELETE',undefined,a.token)).status,200);
      const history=(await call('/api/sessions','GET',undefined,a.token)).data.sessions;
      assert.equal(history.length,1);assert.equal(history[0].taskId,undefined);assert.equal(history[0].minutes,15);
    });
    await t.test('legacy password upgrades and revocation survive PostgreSQL persistence', async () => {
      const id=randomUUID();const username=`legacy-${id}`;
      await store.usersDb.create({ id,name:'Legacy',username,passwordHash:createHash('sha256').update(`nt:${id}:${password}`).digest('hex'),createdAt:new Date().toISOString() });
      const login=(await call('/api/auth/login','POST',{ username,password })).data;
      assert.ok((await store.usersDb.findById(id)).passwordHash.startsWith('scrypt$'));
      const changed=await call('/api/auth/change-password','POST',{oldPassword:password,newPassword:randomUUID()},login.token);
      assert.equal(changed.status,200);
      assert.equal((await call('/api/auth/me','GET',undefined,login.token)).status,401);
      assert.equal((await call('/api/auth/me','GET',undefined,changed.data.token)).status,200);
    });
    await t.test('100-record seeder persists and reruns without duplicates', async () => {
      const options={baseUrl:base,username:`seed-${randomUUID()}`,password};
      assert.deepEqual((await seedDemo(options)).added,{projects:10,tasks:70,sessions:20});
      assert.deepEqual((await seedDemo(options)).added,{projects:0,tasks:0,sessions:0});
    });
    await t.test('SQLite import preserves identities, password hashes and history, and refuses a nonempty target', async () => {
      process.env.DATA_DIR=cluster.directory;
      process.env.DATABASE_PATH=path.join(cluster.directory,'source.db');
      const sqlite=await import('../backend/dist/db/sqlite.js');
      const id=randomUUID();
      const hash=createHash('sha256').update(`nt:${id}:${password}`).digest('hex');
      sqlite.usersDb.create({id,name:'Imported',username:'imported-user',passwordHash:hash,createdAt:new Date().toISOString()});
      sqlite.db.prepare('UPDATE users SET auth_version=3 WHERE id=?').run(id);
      const project={id:randomUUID(),userId:id,name:'Imported project',color:'#000',priority:'high',dueDate:'2027-01-01',createdAt:new Date().toISOString()};
      sqlite.projectsDb.save(project);
      const task={id:randomUUID(),userId:id,projectId:project.id,section:'Inbox',title:'Imported task',estimateMin:15,status:'todo',order:0,createdAt:new Date().toISOString(),subtasks:[{id:randomUUID(),title:'Step',done:false}]};
      sqlite.tasksDb.save(task);
      sqlite.sessionsDb.save({id:randomUUID(),userId:id,taskId:task.id,projectId:project.id,startedAt:'2026-11-01T01:00:00Z',endedAt:'2026-11-01T01:15:00Z',minutes:15,completedTask:false});
      sqlite.metaDb.save({...sqlite.defaultMeta(id),onboarded:true});
      sqlite.settingsDb.save(sqlite.defaultSettings(id));
      sqlite.db.close();
      const original=await readFile(process.env.DATABASE_PATH);
      await control.query('CREATE DATABASE tinydo_import');
      const destination=new URL(cluster.connectionString);destination.pathname='/tinydo_import';
      const runImport=()=>new Promise((resolve,reject)=>{
        const process=spawn(globalThis.process.execPath,['scripts/import-sqlite.mjs'],{windowsHide:true,env:{...globalThis.process.env,DATABASE_URL:destination.toString(),SQLITE_IMPORT_PATH:globalThis.process.env.DATABASE_PATH},stdio:'pipe'});
        process.once('error',reject);process.once('exit',resolve);
      });
      assert.equal(await runImport(),0);
      const target=new pg.Client({connectionString:destination.toString()});await target.connect();
      try {
        const imported=(await target.query('SELECT id,password_hash,auth_version FROM users')).rows;
        assert.deepEqual(imported,[{id,password_hash:hash,auth_version:3}]);
        assert.equal((await target.query('SELECT minutes FROM focus_sessions')).rows[0].minutes,15);
        assert.equal((await target.query('SELECT subtasks FROM tasks')).rows[0].subtasks[0].title,'Step');
        assert.equal(await runImport(),1);
        assert.equal((await target.query('SELECT count(*)::int AS count FROM users')).rows[0].count,1);
        assert.deepEqual(await readFile(globalThis.process.env.DATABASE_PATH),original);
      } finally {await target.end();}
    });
    await t.test('a new production process loads existing PostgreSQL users and admin', async () => {
      await new Promise(resolve=>server.close(resolve));server=undefined;
      let output='';
      const started=new Promise((resolve,reject)=>{
        child=spawn(process.execPath,['backend/dist/server.js'],{windowsHide:true,env:{...process.env,NODE_ENV:'production',PORT:'0',BOOTSTRAP_ADMIN:'true',ADMIN_USERNAME:'pg-admin',ADMIN_PASSWORD:password},stdio:['ignore','pipe','pipe']});
        const timer=setTimeout(()=>reject(new Error('Production startup timed out')),15000);
        child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/localhost:(\d+)/);if(match){clearTimeout(timer);resolve(`http://127.0.0.1:${match[1]}`);}});
        child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Production exited ${code}`));});
      });
      const url=await started;
      const response=await fetch(url+'/api/admin/users',{headers:{Authorization:`Bearer ${admin.token}`}});
      assert.equal(response.status,200); assert.ok((await response.json()).summary.users>=4);
      assert.match(output,/Admin bootstrap: existing/);
    });
  } finally {
    if(child && child.exitCode===null){const exited=new Promise(resolve=>child.once('exit',resolve));child.kill();await exited;}
    if(server)await new Promise(resolve=>server.close(resolve));
    if(store)await store.closeDatabase();
    await control.end();
    await cluster.stop();
  }
});
