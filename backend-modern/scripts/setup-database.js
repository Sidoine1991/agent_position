#!/usr/bin/env node

/**
 * Database Setup Script for Presence CCR-B
 * This script helps set up the database schema and run migrations
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration(migrationFile) {
  try {
    console.log(`📄 Running migration: ${migrationFile}`);
    
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', migrationFile);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ Migration ${migrationFile} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Migration ${migrationFile} failed:`, error.message);
    return false;
  }
}

async function testConnection() {
  try {
    console.log('🔌 Testing database connection...');
    
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

async function setupDatabase() {
  console.log('🚀 Starting database setup for Presence CCR-B...\n');
  
  // Test connection first
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.error('❌ Cannot proceed without database connection');
    process.exit(1);
  }
  
  // Run migrations in order
  const migrations = [
    '001_initial_schema.sql',
    '002_rls_policies.sql',
    '003_user_handling.sql'
  ];
  
  let allSuccessful = true;
  
  for (const migration of migrations) {
    const success = await runMigration(migration);
    if (!success) {
      allSuccessful = false;
      break;
    }
  }
  
  if (allSuccessful) {
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Create your first admin user through the Supabase dashboard');
    console.log('   2. Start the API server with: npm run dev');
    console.log('   3. Test the API endpoints');
  } else {
    console.log('\n❌ Database setup failed. Please check the errors above.');
    process.exit(1);
  }
}

// Run the setup
setupDatabase().catch(console.error);
