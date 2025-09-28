import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['SUPABASE_URL'] || '';
const supabaseKey = process.env['SUPABASE_ANON_KEY'] || '';
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'] || '';

export class DatabaseService {
  private static supabase = createClient(supabaseUrl, supabaseKey);
  private static supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  static getClient() {
    return this.supabase;
  }

  static getAdminClient() {
    return this.supabaseAdmin;
  }

  static async testConnection() {
    try {
      const { error } = await this.supabase
        .from('profiles')
        .select('count')
        .limit(1);

      if (error) {
        throw new Error(`Database connection failed: ${error.message}`);
      }

      return { success: true, message: 'Database connection successful' };
    } catch (error) {
      return { 
        success: false, 
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  static async createTableIfNotExists(tableName: string, schema: string) {
    try {
      const { error } = await this.supabaseAdmin.rpc('create_table_if_not_exists', {
        table_name: tableName,
        table_schema: schema
      });

      if (error) {
        console.warn(`Table ${tableName} might already exist or creation failed:`, error.message);
      }

      return { success: true, message: `Table ${tableName} is ready` };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to create table ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  static async executeQuery(query: string, params: any[] = []) {
    try {
      const { data, error } = await this.supabaseAdmin.rpc('execute_sql', {
        query,
        params
      });

      if (error) {
        throw new Error(`Query execution failed: ${error.message}`);
      }

      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        message: `Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}
