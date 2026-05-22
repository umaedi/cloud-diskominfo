import { migrate } from 'drizzle-orm/mysql2/migrator';
import { db, pool } from '../config/db.js';

async function main() {
  console.log('⏳ Running database migrations...');
  try {
    await migrate(db, { migrationsFolder: 'drizzle' });
    console.log('✅ Migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
