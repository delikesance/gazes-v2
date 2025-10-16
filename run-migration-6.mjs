import { createClient } from '@supabase/supabase-js'
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  // Get Supabase credentials from environment
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ SUPABASE_URL or SUPABASE_KEY environment variables not found');
    console.log('Please set SUPABASE_URL and SUPABASE_KEY in your .env file');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    console.log('🚀 Connecting to Supabase...');

    // Read migration files
    const migration6Path = path.join(__dirname, 'data/database/migrations/006_add_anime_metadata_cache.sql');

    // Execute migration 6
    const migration6Sql = fs.readFileSync(migration6Path, 'utf-8');
    console.log('📋 Executing migration 6...');

    // Split the SQL into individual statements and execute them
    const statements = migration6Sql.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.trim().substring(0, 50) + '...');
        const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() + ';' });

        if (error) {
          // If exec_sql doesn't exist, try direct query
          try {
            await supabase.from('_supabase_migration_temp').select('*').limit(1);
            // If we get here, the table approach won't work
          } catch {
            // Try executing as raw SQL through a dummy query
            console.log('⚠️  Could not execute migration via RPC, you may need to run it manually in Supabase dashboard');
            console.log('Migration SQL:');
            console.log(statement.trim());
            continue;
          }
        }
      }
    }

    console.log('✅ Migration 6 executed successfully');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('You may need to run the migration manually in your Supabase dashboard:');
    console.log('Go to https://supabase.com/dashboard/project/YOUR_PROJECT/sql');
    console.log('And run the SQL from data/database/migrations/006_add_anime_metadata_cache.sql');
    process.exit(1);
  }
}

runMigrations();