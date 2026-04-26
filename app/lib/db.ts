import * as SQLite from 'expo-sqlite';

/**
 * Interface representing a gold purchase entry in the Digital Vault.
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
 * Modern initialization function for expo-sqlite/next.
 * This runs when the SQLiteProvider starts.
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
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
  }
}

/**
 * Database access service for the Digital Vault.
 * Methods use the DB instance provided by the caller or hook.
 */
export const dbService = {
  async addEntry(db: SQLite.SQLiteDatabase, entry: Omit<VaultEntry, 'created_at'>) {
    await db.runAsync(
      'INSERT INTO vault_entries (id, label, karat, weight, price_per_gram, purchase_date) VALUES (?, ?, ?, ?, ?, ?)',
      [entry.id, entry.label || null, entry.karat, entry.weight, entry.price_per_gram, entry.purchase_date]
    );
  },

  async getEntries(db: SQLite.SQLiteDatabase): Promise<VaultEntry[]> {
    return await db.getAllAsync<VaultEntry>('SELECT * FROM vault_entries ORDER BY purchase_date DESC');
  },

  async deleteEntry(db: SQLite.SQLiteDatabase, id: string) {
    await db.runAsync('DELETE FROM vault_entries WHERE id = ?', [id]);
  }
};
