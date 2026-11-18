import 'dotenv/config';
import { closeDatabase, databaseKind } from '../db/database.js';
console.log(`Database ready: ${databaseKind}`);
await closeDatabase();
