// Web stub for database.ts — uses AsyncStorage (localStorage) for basic persistence on web preview.
// Full SQLite functionality is available on iOS/Android via database.ts.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, Event, Reminder, User } from '../types';

type WebUser = User & { sync_frequency?: string; last_sync?: string | null };

const KEYS = {
  users: 'lf_web_users',
  notes: 'lf_web_notes',
  events: 'lf_web_events',
  reminders: 'lf_web_reminders',
  queue: 'lf_web_sync_queue',
};

const generateId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });

const readArr = async <T,>(key: string): Promise<T[]> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const writeArr = async <T,>(key: string, arr: T[]) => {
  await AsyncStorage.setItem(key, JSON.stringify(arr));
};

export const initDatabase = async (): Promise<void> => {
  // no-op on web; AsyncStorage initialises lazily.
};

// ============== USER ==============
export const saveUser = async (user: WebUser): Promise<void> => {
  await writeArr<WebUser>(KEYS.users, [{ ...user, sync_frequency: user.sync_frequency || 'manual' }]);
};

export const getLocalUser = async (): Promise<(User & { sync_frequency: string; last_sync: string | null }) | null> => {
  const users = await readArr<WebUser>(KEYS.users);
  if (!users.length) return null;
  const u = users[0];
  return { ...u, sync_frequency: u.sync_frequency || 'manual', last_sync: u.last_sync || null } as any;
};

export const updateSyncFrequency = async (userId: string, frequency: string): Promise<void> => {
  const users = await readArr<WebUser>(KEYS.users);
  const updated = users.map((u) => (u.id === userId ? { ...u, sync_frequency: frequency } : u));
  await writeArr(KEYS.users, updated);
};

export const updateLastSync = async (userId: string): Promise<void> => {
  const users = await readArr<WebUser>(KEYS.users);
  const updated = users.map((u) => (u.id === userId ? { ...u, last_sync: new Date().toISOString() } : u));
  await writeArr(KEYS.users, updated);
};

// ============== NOTES ==============
export const getLocalNotes = async (
  userId: string,
  options?: { pinned?: boolean; journal?: boolean; journal_date?: string }
): Promise<Note[]> => {
  const all = await readArr<any>(KEYS.notes);
  return all
    .filter((n) => n.user_id === userId && !n.deleted)
    .filter((n) => (options?.pinned !== undefined ? !!n.pinned === options.pinned : true))
    .filter((n) => (options?.journal === true ? !!n.journal_date : options?.journal === false ? !n.journal_date : true))
    .filter((n) => (options?.journal_date ? n.journal_date === options.journal_date : true))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.created_at || '').localeCompare(a.created_at || ''));
};

export const getLocalNote = async (noteId: string): Promise<Note | null> => {
  const all = await readArr<any>(KEYS.notes);
  return all.find((n) => n.id === noteId) || null;
};

export const createLocalNote = async (userId: string, note: Partial<Note>): Promise<Note> => {
  const id = generateId();
  const now = new Date().toISOString();
  const created: any = {
    id,
    user_id: userId,
    title: note.title || 'Untitled',
    content: note.content || '',
    tags: note.tags || [],
    pinned: !!note.pinned,
    journal_date: note.journal_date || null,
    created_at: now,
    updated_at: now,
    synced: 0,
    deleted: 0,
  };
  const all = await readArr<any>(KEYS.notes);
  await writeArr(KEYS.notes, [...all, created]);
  await addToSyncQueue('notes', id, 'create', created);
  return created;
};

export const updateLocalNote = async (noteId: string, note: Partial<Note>): Promise<Note | null> => {
  const all = await readArr<any>(KEYS.notes);
  let updated: any = null;
  const next = all.map((n) => {
    if (n.id !== noteId) return n;
    updated = { ...n, ...note, updated_at: new Date().toISOString(), synced: 0 };
    return updated;
  });
  await writeArr(KEYS.notes, next);
  if (updated) await addToSyncQueue('notes', noteId, 'update', updated);
  return updated;
};

export const deleteLocalNote = async (noteId: string): Promise<void> => {
  const all = await readArr<any>(KEYS.notes);
  const next = all.map((n) => (n.id === noteId ? { ...n, deleted: 1, synced: 0 } : n));
  await writeArr(KEYS.notes, next);
  await addToSyncQueue('notes', noteId, 'delete', { id: noteId });
};

// ============== EVENTS ==============
export const getLocalEvents = async (
  userId: string,
  options?: { date?: string; month?: string }
): Promise<Event[]> => {
  const all = await readArr<any>(KEYS.events);
  return all
    .filter((e) => e.user_id === userId && !e.deleted)
    .filter((e) => (options?.date ? e.date === options.date : true))
    .filter((e) => (options?.month ? (e.date || '').startsWith(options.month) : true))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
};

export const createLocalEvent = async (userId: string, event: Partial<Event>): Promise<Event> => {
  const id = generateId();
  const now = new Date().toISOString();
  const created: any = {
    id,
    user_id: userId,
    title: event.title || '',
    description: event.description || '',
    date: event.date || '',
    start_time: event.start_time || null,
    end_time: event.end_time || null,
    created_at: now,
    synced: 0,
    deleted: 0,
  };
  const all = await readArr<any>(KEYS.events);
  await writeArr(KEYS.events, [...all, created]);
  await addToSyncQueue('events', id, 'create', created);
  return created;
};

export const updateLocalEvent = async (eventId: string, event: Partial<Event>): Promise<Event | null> => {
  const all = await readArr<any>(KEYS.events);
  let updated: any = null;
  const next = all.map((e) => {
    if (e.id !== eventId) return e;
    updated = { ...e, ...event, synced: 0 };
    return updated;
  });
  await writeArr(KEYS.events, next);
  if (updated) await addToSyncQueue('events', eventId, 'update', updated);
  return updated;
};

export const deleteLocalEvent = async (eventId: string): Promise<void> => {
  const all = await readArr<any>(KEYS.events);
  const next = all.map((e) => (e.id === eventId ? { ...e, deleted: 1, synced: 0 } : e));
  await writeArr(KEYS.events, next);
  await addToSyncQueue('events', eventId, 'delete', { id: eventId });
};

// ============== REMINDERS ==============
export const getLocalReminders = async (userId: string, completed?: boolean): Promise<Reminder[]> => {
  const all = await readArr<any>(KEYS.reminders);
  return all
    .filter((r) => r.user_id === userId && !r.deleted)
    .filter((r) => (completed !== undefined ? !!r.completed === completed : true))
    .sort(
      (a, b) =>
        (a.completed ? 1 : 0) - (b.completed ? 1 : 0) ||
        (b.created_at || '').localeCompare(a.created_at || '')
    );
};

export const createLocalReminder = async (userId: string, reminder: Partial<Reminder>): Promise<Reminder> => {
  const id = generateId();
  const now = new Date().toISOString();
  const created: any = {
    id,
    user_id: userId,
    title: reminder.title || '',
    completed: false,
    due_date: reminder.due_date || null,
    created_at: now,
    synced: 0,
    deleted: 0,
  };
  const all = await readArr<any>(KEYS.reminders);
  await writeArr(KEYS.reminders, [...all, created]);
  await addToSyncQueue('reminders', id, 'create', created);
  return created;
};

export const updateLocalReminder = async (
  reminderId: string,
  reminder: Partial<Reminder>
): Promise<Reminder | null> => {
  const all = await readArr<any>(KEYS.reminders);
  let updated: any = null;
  const next = all.map((r) => {
    if (r.id !== reminderId) return r;
    updated = { ...r, ...reminder, synced: 0 };
    return updated;
  });
  await writeArr(KEYS.reminders, next);
  if (updated) await addToSyncQueue('reminders', reminderId, 'update', updated);
  return updated;
};

export const deleteLocalReminder = async (reminderId: string): Promise<void> => {
  const all = await readArr<any>(KEYS.reminders);
  const next = all.map((r) => (r.id === reminderId ? { ...r, deleted: 1, synced: 0 } : r));
  await writeArr(KEYS.reminders, next);
  await addToSyncQueue('reminders', reminderId, 'delete', { id: reminderId });
};

export const clearCompletedLocalReminders = async (userId: string): Promise<number> => {
  const all = await readArr<any>(KEYS.reminders);
  const completed = all.filter((r) => r.user_id === userId && r.completed && !r.deleted);
  for (const r of completed) await deleteLocalReminder(r.id);
  return completed.length;
};

// ============== SYNC QUEUE ==============
const addToSyncQueue = async (table_name: string, record_id: string, action: string, data: any): Promise<void> => {
  const queue = await readArr<any>(KEYS.queue);
  queue.push({
    id: queue.length + 1,
    table_name,
    record_id,
    action,
    data: JSON.stringify(data),
    created_at: new Date().toISOString(),
  });
  await writeArr(KEYS.queue, queue);
};

export const getSyncQueue = async (): Promise<any[]> => readArr<any>(KEYS.queue);

export const clearSyncQueue = async (): Promise<void> => {
  await writeArr(KEYS.queue, []);
};

export const markAsSynced = async (tableName: string): Promise<void> => {
  const k = (KEYS as any)[tableName];
  if (!k) return;
  const all = await readArr<any>(k);
  await writeArr(
    k,
    all.map((row: any) => ({ ...row, synced: 1 }))
  );
};

export const getUnsyncedCount = async (): Promise<number> => {
  const queue = await readArr<any>(KEYS.queue);
  return queue.length;
};

export const clearAllData = async (): Promise<void> => {
  await Promise.all(Object.values(KEYS).map((k) => AsyncStorage.removeItem(k)));
};
