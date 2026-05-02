import * as SQLite from 'expo-sqlite';

/**
 * VaultEntry Interface
 * 
 * Represents a single gold asset record within the local private vault.
 * 
 * Security Note: These records are stored EXCLUSIVELY in the application's local 
 * SQLite sandbox and are never transmitted to external cloud services (Supabase or otherwise).
 */
export interface VaultEntry {
  id: string;
  label: string | null;
  karat: number;
  weight: number;
  price_per_gram: number;
  purchase_date: string;
  created_at: string;
}

export const DATABASE_NAME = 'vault.db';

/**
 * onDatabaseInit
 * 
 * Orchestrates the lifecycle of the local database schema. 
 * Runs synchronously on application mount via SQLiteProvider.
 * 
 * Optimization: Uses WAL (Write-Ahead Logging) mode for enhanced performance 
 * during rapid portfolio updates.
 */
export async function onDatabaseInit(db: SQLite.SQLiteDatabase) {
  try {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS vault_entries (
        id TEXT PRIMARY KEY NOT NULL,
        label TEXT,
        karat INTEGER NOT NULL,
        weight REAL NOT NULL,
        price_per_gram REAL NOT NULL,
        purchase_date TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('[LocalDB] Private vault schema initialized successfully.');
  } catch (error) {
    console.error('[LocalDB] Critical failure during schema initialization:', error);
  }
}

/**
 * dbService
 * 
 * Provides an asynchronous abstraction layer for all local gold asset operations.
 * Implements standard CRUD patterns to maintain data sovereignty.
 */
export const dbService = {
  /**
   * Adds a new gold asset to the local vault.
   */
  async addEntry(db: SQLite.SQLiteDatabase, entry: Omit<VaultEntry, 'created_at'>) {
    await db.runAsync(
      'INSERT INTO vault_entries (id, label, karat, weight, price_per_gram, purchase_date) VALUES (?, ?, ?, ?, ?, ?)',
      [entry.id, entry.label || null, entry.karat, entry.weight, entry.price_per_gram, entry.purchase_date]
    );
  },

  /**
   * Retrieves the entire portfolio, sorted by purchase date (descending).
   */
  async getEntries(db: SQLite.SQLiteDatabase): Promise<VaultEntry[]> {
    return await db.getAllAsync<VaultEntry>('SELECT * FROM vault_entries ORDER BY purchase_date DESC');
  },

  /**
   * Permanently removes an asset from the local vault.
   */
  async deleteEntry(db: SQLite.SQLiteDatabase, id: string) {
    await db.runAsync('DELETE FROM vault_entries WHERE id = ?', [id]);
  }
};
