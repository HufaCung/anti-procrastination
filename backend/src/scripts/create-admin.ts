import 'dotenv/config';
import { createAdmin } from '../services/admin-account.js';
import { db } from '../db/database.js';

try {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('Set ADMIN_PASSWORD before running admin:create.');
  const username = process.env.ADMIN_USERNAME || 'admin';
  const result = createAdmin(username, password);
  console.log(result.created ? `Admin account created: ${username}` : `Admin account already exists: ${username}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Could not create admin account.');
  process.exitCode = 1;
} finally {
  db.close();
}
