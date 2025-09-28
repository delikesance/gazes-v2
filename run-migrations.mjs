import { Client } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  // Get connection string from environment
  const connectionString = process.env.POSTGRES_URL || process.env.gazes_POSTGRES_URL;

  if (!connectionString) {
    console.error('❌ POSTGRES_URL environment variable not found');
    console.log('Please set POSTGRES_URL in your .env file');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: false
  });

  try {
    console.log('🚀 Connecting to database...');
    await client.connect();

    // Read migration files
    const migration1Path = path.join(__dirname, 'database/migrations/001_initial_schema.sql');
    const migration2Path = path.join(__dirname, 'database/migrations/002_rls_policies.sql');

    // Execute first migration
    const migration1Sql = fs.readFileSync(migration1Path, 'utf-8');
    console.log('📋 Executing migration 1...');
    await client.query(migration1Sql);

    // Execute second migration
    const migration2Sql = fs.readFileSync(migration2Path, 'utf-8');
    console.log('📋 Executing migration 2...');
    await client.query(migration2Sql);

    console.log('✅ Migrations executed successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();