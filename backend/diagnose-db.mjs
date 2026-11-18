// Chạy từ thư mục backend:  node diagnose-db.mjs
// Chỉ ĐỌC, không sửa gì. Không in DATABASE_URL hay mật khẩu.
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) { console.log('Không đọc được DATABASE_URL (thiếu backend/.env?)'); process.exit(1); }
const u = new URL(url);
console.log('Host:', u.hostname, '| port:', u.port || '(mặc định)', '| user:', decodeURIComponent(u.username));

const c = new pg.Client({ connectionString: url.split('?')[0], ssl: { rejectUnauthorized: false } }); // chỉ để chẩn đoán
try {
  await c.connect();
  const who = (await c.query('select current_database() db, current_user usr')).rows[0];
  console.log('Kết nối OK →', who);

  const tables = (await c.query("select table_name from information_schema.tables where table_schema='public' order by 1")).rows.map(r => r.table_name);
  console.log('Bảng trong schema public:', tables.length ? tables.join(', ') : '(trống)');

  let applied = {};
  if (tables.includes('tinydo_schema_migrations')) {
    for (const r of (await c.query('select version, checksum from tinydo_schema_migrations order by 1')).rows) applied[r.version] = r.checksum;
    console.log('Migration đã ghi nhận:', Object.keys(applied).join(', ') || '(không có)');
  } else console.log('Chưa có bảng tinydo_schema_migrations');

  const dir = new URL('./src/db/migrations/', import.meta.url);
  for (const f of readdirSync(dir).filter(n => n.endsWith('.sql')).sort()) {
    const sql = readFileSync(new URL(f, dir), 'utf8');
    const sum = createHash('sha256').update(sql).digest('hex');
    const v = f.slice(0, 3);
    const crlf = (sql.match(/\r/g) || []).length;
    console.log(`File ${f}: CRLF=${crlf}`, v in applied ? (applied[v] === sum ? '| checksum KHỚP' : '| checksum KHÁC (!)') : '| chưa áp dụng');
  }

  // Thử chạy migration 001 trong transaction rồi ROLLBACK để thấy lỗi thật
  if (!('001' in applied)) {
    await c.query('BEGIN');
    try {
      await c.query(readFileSync(new URL('001-initial.sql', dir), 'utf8'));
      console.log('Migration 001: chạy thử OK (đã ROLLBACK, không để lại gì)');
    } catch (e) {
      console.log('Migration 001 LỖI THẬT → code:', e.code, '| message:', e.message);
    }
    await c.query('ROLLBACK');
  }
} catch (e) {
  console.log('LỖI → code:', e.code, '| message:', e.message);
} finally { await c.end().catch(() => {}); }
