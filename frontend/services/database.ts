import { Platform } from 'react-native';
import { Note, Event, Reminder, User } from '../types';

// On web we provide an AsyncStorage-based shim (see database.web.ts).
// Metro's platform extension resolution will swap this file out automatically.
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const initDatabase = async (): Promise<void> => {
  db = await SQLite.openDatabaseAsync('lifeflow.db');
  
  // Create tables
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      name TEXT,
      avatar_url TEXT,
      theme_preference TEXT DEFAULT 'light',
      subscription TEXT DEFAULT 'free',
      sync_frequency TEXT DEFAULT 'manual',
      last_sync TEXT
    );
    
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      tags TEXT DEFAULT '[]',
      pinned INTEGER DEFAULT 0,
      journal_date TEXT,
      created_at TEXT,
      updated_at TEXT,
      synced INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      date TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      created_at TEXT,
      synced INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      due_date TEXT,
      created_at TEXT,
      synced INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT,
      record_id TEXT,
      action TEXT,
      data TEXT,
      created_at TEXT
    );
  `);
};

const getDb = (): SQLite.SQLiteDatabase => {
  if (!db) throw new Error('Database not initialized');
  return db;
};

const generateId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// ============== USER ==============
export const saveUser = async (user: User & { sync_frequency?: string }): Promise<void> => {
  const database = getDb();
  await database.runAsync(
    `INSERT OR REPLACE INTO users (id, email, name, avatar_url, theme_preference, subscription, sync_frequency)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [user.id, user.email, user.name, user.avatar_url || null, user.theme_preference, user.subscription, user.sync_frequency || 'manual']
  );
};

export const getLocalUser = async (): Promise<(User & { sync_frequency: string; last_sync: string | null }) | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<any>('SELECT * FROM users LIMIT 1');
  return result || null;
};

export const updateSyncFrequency = async (userId: string, frequency: string): Promise<void> => {
  const database = getDb();
  await database.runAsync('UPDATE users SET sync_frequency = ? WHERE id = ?', [frequency, userId]);
};

export const updateLastSync = async (userId: string): Promise<void> => {
  const database = getDb();
  await database.runAsync('UPDATE users SET last_sync = ? WHERE id = ?', [new Date().toISOString(), userId]);
};

// ============== NOTES ==============
export const getLocalNotes = async (userId: string, options?: { pinned?: boolean; journal?: boolean; journal_date?: string }): Promise<Note[]> => {
  const database = getDb();
  let query = 'SELECT * FROM notes WHERE user_id = ? AND deleted = 0';
  const params: any[] = [userId];
  
  if (options?.pinned !== undefined) {
    query += ' AND pinned = ?';
    params.push(options.pinned ? 1 : 0);
  }
  if (options?.journal === true) {
    query += ' AND journal_date IS NOT NULL';
  } else if (options?.journal === false) {
    query += ' AND journal_date IS NULL';
  }
  if (options?.journal_date) {
    query += ' AND journal_date = ?';
    params.push(options.journal_date);
  }
  
  query += ' ORDER BY pinned DESC, created_at DESC';
  
  const results = await database.getAllAsync<any>(query, params);
  return results.map(row => ({
    ...row,
    tags: JSON.parse(row.tags || '[]'),
    pinned: !!row.pinned,
  }));
};

export const getLocalNote = async (noteId: string): Promise<Note | null> => {
  const database = getDb();
  const result = await database.getFirstAsync<any>('SELECT * FROM notes WHERE id = ?', [noteId]);
  if (!result) return null;
  return { ...result, tags: JSON.parse(result.tags || '[]'), pinned: !!result.pinned };
};

export const createLocalNote = async (userId: string, note: Partial<Note>): Promise<Note> => {
  const database = getDb();
  const id = generateId();
  const now = new Date().toISOString();
  
  await database.runAsync(
    `INSERT INTO notes (id, user_id, title, content, tags, pinned, journal_date, created_at, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, userId, note.title || 'Untitled', note.content || '', JSON.stringify(note.tags || []), note.pinned ? 1 : 0, note.journal_date || null, now, now]
  );
  
  await addToSyncQueue('notes', id, 'create', { ...note, id, user_id: userId, created_at: now, updated_at: now });
  
  return { id, user_id: userId, title: note.title || 'Untitled', content: note.content || '', tags: note.tags || [], pinned: note.pinned || false, journal_date: note.journal_date, created_at: now, updated_at: now };
};

export const updateLocalNote = async (noteId: string, note: Partial<Note>): Promise<Note | null> => {
  const database = getDb();
  const now = new Date().toISOString();
  
  const updates: string[] = ['updated_at = ?', 'synced = 0'];
  const params: any[] = [now];
  
  if (note.title !== undefined) { updates.push('title = ?'); params.push(note.title); }
  if (note.content !== undefined) { updates.push('content = ?'); params.push(note.content); }
  if (note.tags !== undefined) { updates.push('tags = ?'); params.push(JSON.stringify(note.tags)); }
  if (note.pinned !== undefined) { updates.push('pinned = ?'); params.push(note.pinned ? 1 : 0); }
  
  params.push(noteId);
  await database.runAsync(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`, params);
  
  const updated = await getLocalNote(noteId);
  if (updated) await addToSyncQueue('notes', noteId, 'update', updated);
  return updated;
};

export const deleteLocalNote = async (noteId: string): Promise<void> => {
  const database = getDb();
  await database.runAsync('UPDATE notes SET deleted = 1, synced = 0 WHERE id = ?', [noteId]);
  await addToSyncQueue('notes', noteId, 'delete', { id: noteId });
};

// ============== EVENTS ==============
export const getLocalEvents = async (userId: string, options?: { date?: string; month?: string }): Promise<Event[]> => {
  const database = getDb();
  let query = 'SELECT * FROM events WHERE user_id = ? AND deleted = 0';
  const params: any[] = [userId];
  
  if (options?.date) {
    query += ' AND date = ?';
    params.push(options.date);
  }
  
  query += ' ORDER BY date ASC';
  
  const results = await database.getAllAsync<any>(query, params);
  
  if (options?.month) {
    return results.filter(e => e.date?.startsWith(options.month));
  }
  return results;
};

export const createLocalEvent = async (userId: string, event: Partial<Event>): Promise<Event> => {
  const database = getDb();
  const id = generateId();
  const now = new Date().toISOString();
  
  await database.runAsync(
    `INSERT INTO events (id, user_id, title, description, date, start_time, end_time, created_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [id, userId, event.title || '', event.description || '', event.date || '', event.start_time || null, event.end_time || null, now]
  );
  
  const created = { id, user_id: userId, title: event.title || '', description: event.description || '', date: event.date || '', start_time: event.start_time, end_time: event.end_time, created_at: now };
  await addToSyncQueue('events', id, 'create', created);
  return created;
};

export const updateLocalEvent = async (eventId: string, event: Partial<Event>): Promise<Event | null> => {
  const database = getDb();
  const updates: string[] = ['synced = 0'];
  const params: any[] = [];
  
  if (event.title !== undefined) { updates.push('title = ?'); params.push(event.title); }
  if (event.description !== undefined) { updates.push('description = ?'); params.push(event.description); }
  if (event.date !== undefined) { updates.push('date = ?'); params.push(event.date); }
  if (event.start_time !== undefined) { updates.push('start_time = ?'); params.push(event.start_time); }
  if (event.end_time !== undefined) { updates.push('end_time = ?'); params.push(event.end_time); }
  
  params.push(eventId);
  await database.runAsync(`UPDATE events SET ${updates.join(', ')} WHERE id = ?`, params);
  
  const updated = await database.getFirstAsync<Event>('SELECT * FROM events WHERE id = ?', [eventId]);
  if (updated) await addToSyncQueue('events', eventId, 'update', updated);
  return updated;
};

export const deleteLocalEvent = async (eventId: string): Promise<void> => {
  const database = getDb();
  await database.runAsync('UPDATE events SET deleted = 1, synced = 0 WHERE id = ?', [eventId]);
  await addToSyncQueue('events', eventId, 'delete', { id: eventId });
};

// ============== REMINDERS ==============
export const getLocalReminders = async (userId: string, completed?: boolean): Promise<Reminder[]> => {
  const database = getDb();
  let query = 'SELECT * FROM reminders WHERE user_id = ? AND deleted = 0';
  const params: any[] = [userId];
  
  if (completed !== undefined) {
    query += ' AND completed = ?';
    params.push(completed ? 1 : 0);
  }
  
  query += ' ORDER BY completed ASC, created_at DESC';
  
  const results = await database.getAllAsync<any>(query, params);
  return results.map(row => ({ ...row, completed: !!row.completed }));
};

export const createLocalReminder = async (userId: string, reminder: Partial<Reminder>): Promise<Reminder> => {
  const database = getDb();
  const id = generateId();
  const now = new Date().toISOString();
  
  await database.runAsync(
    `INSERT INTO reminders (id, user_id, title, completed, due_date, created_at, synced)
     VALUES (?, ?, ?, 0, ?, ?, 0)`,
    [id, userId, reminder.title || '', reminder.due_date || null, now]
  );
  
  const created = { id, user_id: userId, title: reminder.title || '', completed: false, due_date: reminder.due_date, created_at: now };
  await addToSyncQueue('reminders', id, 'create', created);
  return created;
};

export const updateLocalReminder = async (reminderId: string, reminder: Partial<Reminder>): Promise<Reminder | null> => {
  const database = getDb();
  const updates: string[] = ['synced = 0'];
  const params: any[] = [];
  
  if (reminder.title !== undefined) { updates.push('title = ?'); params.push(reminder.title); }
  if (reminder.completed !== undefined) { updates.push('completed = ?'); params.push(reminder.completed ? 1 : 0); }
  if (reminder.due_date !== undefined) { updates.push('due_date = ?'); params.push(reminder.due_date); }
  
  params.push(reminderId);
  await database.runAsync(`UPDATE reminders SET ${updates.join(', ')} WHERE id = ?`, params);
  
  const result = await database.getFirstAsync<any>('SELECT * FROM reminders WHERE id = ?', [reminderId]);
  if (result) {
    const updated = { ...result, completed: !!result.completed };
    await addToSyncQueue('reminders', reminderId, 'update', updated);
    return updated;
  }
  return null;
};

export const deleteLocalReminder = async (reminderId: string): Promise<void> => {
  const database = getDb();
  await database.runAsync('UPDATE reminders SET deleted = 1, synced = 0 WHERE id = ?', [reminderId]);
  await addToSyncQueue('reminders', reminderId, 'delete', { id: reminderId });
};

export const clearCompletedLocalReminders = async (userId: string): Promise<number> => {
  const database = getDb();
  const completed = await database.getAllAsync<any>('SELECT id FROM reminders WHERE user_id = ? AND completed = 1 AND deleted = 0', [userId]);
  
  for (const r of completed) {
    await deleteLocalReminder(r.id);
  }
  
  return completed.length;
};

// ============== SYNC QUEUE ==============
const addToSyncQueue = async (tableName: string, recordId: string, action: string, data: any): Promise<void> => {
  const database = getDb();
  await database.runAsync(
    'INSERT INTO sync_queue (table_name, record_id, action, data, created_at) VALUES (?, ?, ?, ?, ?)',
    [tableName, recordId, action, JSON.stringify(data), new Date().toISOString()]
  );
};

export const getSyncQueue = async (): Promise<any[]> => {
  const database = getDb();
  return await database.getAllAsync('SELECT * FROM sync_queue ORDER BY created_at ASC');
};

export const clearSyncQueue = async (): Promise<void> => {
  const database = getDb();
  await database.runAsync('DELETE FROM sync_queue');
};

export const markAsSynced = async (tableName: string): Promise<void> => {
  const database = getDb();
  await database.runAsync(`UPDATE ${tableName} SET synced = 1 WHERE synced = 0`);
};

export const getUnsyncedCount = async (): Promise<number> => {
  const database = getDb();
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM sync_queue'
  );
  return result?.count || 0;
};

export const clearAllData = async (): Promise<void> => {
  const database = getDb();
  await database.execAsync(`
    DELETE FROM notes;
    DELETE FROM events;
    DELETE FROM reminders;
    DELETE FROM sync_queue;
    DELETE FROM users;
  `);
};

// ============== CLOUD UPSERTS (no sync queue) ==============
export const upsertNoteFromCloud = async (note: any): Promise<boolean> => {
  const database = getDb();
  const existing = await database.getFirstAsync<any>('SELECT id FROM notes WHERE id = ?', [note.id]);
  if (existing) return false;
  await database.runAsync(
    `INSERT OR REPLACE INTO notes (id, user_id, title, content, tags, pinned, journal_date, created_at, updated_at, synced, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
    [
      note.id,
      note.user_id,
      note.title || '',
      note.content || '',
      JSON.stringify(note.tags || []),
      note.pinned ? 1 : 0,
      note.journal_date || null,
      note.created_at,
      note.updated_at,
    ]
  );
  return true;
};

export const upsertEventFromCloud = async (event: any): Promise<boolean> => {
  const database = getDb();
  const existing = await database.getFirstAsync<any>('SELECT id FROM events WHERE id = ?', [event.id]);
  if (existing) return false;
  await database.runAsync(
    `INSERT OR REPLACE INTO events (id, user_id, title, description, date, start_time, end_time, created_at, synced, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
    [
      event.id,
      event.user_id,
      event.title || '',
      event.description || '',
      event.date || '',
      event.start_time || null,
      event.end_time || null,
      event.created_at,
    ]
  );
  return true;
};

export const upsertReminderFromCloud = async (reminder: any): Promise<boolean> => {
  const database = getDb();
  const existing = await database.getFirstAsync<any>('SELECT id FROM reminders WHERE id = ?', [reminder.id]);
  if (existing) return false;
  await database.runAsync(
    `INSERT OR REPLACE INTO reminders (id, user_id, title, completed, due_date, created_at, synced, deleted)
     VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
    [
      reminder.id,
      reminder.user_id,
      reminder.title || '',
      reminder.completed ? 1 : 0,
      reminder.due_date || null,
      reminder.created_at,
    ]
  );
  return true;
};
