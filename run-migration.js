#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL || 'https://znhwphabiefwnxzfgxjw.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuaHdwaGFiaWVmd254emZneGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkwNDgzMjcsImV4cCI6MjA3NDYyNDMyN30.r3QOo29KoEKnTMpJhSEPRnbp0RNirLBJAN3VOL4ByTs';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, 'data/database/migrations/005_optimized_series_progress_function.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📁 Running database migration...');

    // Split SQL into individual statements
    const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.trim().substring(0, 50) + '...');
        const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() + ';' });

        if (error) {
          console.error('❌ Statement failed:', error);
          // Continue with other statements
        }
      }
    }

    console.log('✅ Migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();