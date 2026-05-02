import { api } from './api';
import * as db from './database';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const syncToCloud = async (userId: string): Promise<{ success: boolean; synced: number; errors: number }> => {
  let synced = 0;
  let errors = 0;
  
  try {
    const queue = await db.getSyncQueue();
    
    for (const item of queue) {
      try {
        const data = JSON.parse(item.data);
        
        switch (item.table_name) {
          case 'notes':
            if (item.action === 'create') {
              await api.createNote(data);
            } else if (item.action === 'update') {
              await api.updateNote(item.record_id, data);
            } else if (item.action === 'delete') {
              await api.deleteNote(item.record_id);
            }
            break;
          case 'events':
            if (item.action === 'create') {
              await api.createEvent(data);
            } else if (item.action === 'update') {
              await api.updateEvent(item.record_id, data);
            } else if (item.action === 'delete') {
              await api.deleteEvent(item.record_id);
            }
            break;
          case 'reminders':
            if (item.action === 'create') {
              await api.createReminder(data);
            } else if (item.action === 'update') {
              await api.updateReminder(item.record_id, data);
            } else if (item.action === 'delete') {
              await api.deleteReminder(item.record_id);
            }
            break;
        }
        synced++;
      } catch (e) {
        console.error('Sync error for item:', item, e);
        errors++;
      }
    }
    
    if (synced > 0) {
      await db.clearSyncQueue();
      await db.markAsSynced('notes');
      await db.markAsSynced('events');
      await db.markAsSynced('reminders');
      await db.updateLastSync(userId);
    }
    
    return { success: errors === 0, synced, errors };
  } catch (e) {
    console.error('Sync failed:', e);
    return { success: false, synced, errors: errors + 1 };
  }
};

export const syncFromCloud = async (userId: string): Promise<{ success: boolean; downloaded: number }> => {
  let downloaded = 0;
  
  try {
    // Get all data from cloud
    const [notes, events, reminders] = await Promise.all([
      api.getNotes(),
      api.getEvents(),
      api.getReminders(),
    ]);

    // Merge notes via abstraction (no direct expo-sqlite imports)
    for (const note of notes) {
      const inserted = await db.upsertNoteFromCloud(note);
      if (inserted) downloaded++;
    }

    // Merge events
    for (const event of events) {
      const inserted = await db.upsertEventFromCloud(event);
      if (inserted) downloaded++;
    }

    // Merge reminders
    for (const reminder of reminders) {
      const inserted = await db.upsertReminderFromCloud(reminder);
      if (inserted) downloaded++;
    }

    await db.updateLastSync(userId);
    return { success: true, downloaded };
  } catch (e) {
    console.error('Download from cloud failed:', e);
    return { success: false, downloaded };
  }
};

export const fullSync = async (userId: string): Promise<{ success: boolean; uploaded: number; downloaded: number; errors: number }> => {
  // First push local changes to cloud
  const uploadResult = await syncToCloud(userId);
  
  // Then pull from cloud
  const downloadResult = await syncFromCloud(userId);
  
  return {
    success: uploadResult.success && downloadResult.success,
    uploaded: uploadResult.synced,
    downloaded: downloadResult.downloaded,
    errors: uploadResult.errors,
  };
};

// Check if auto-sync is needed based on frequency
export const checkAutoSync = async (userId: string, frequency: string, lastSync: string | null): Promise<boolean> => {
  if (frequency === 'manual') return false;
  if (!lastSync) return true;
  
  const lastSyncDate = new Date(lastSync);
  const now = new Date();
  const diffMs = now.getTime() - lastSyncDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  
  switch (frequency) {
    case 'daily': return diffDays >= 1;
    case 'weekly': return diffDays >= 7;
    case 'monthly': return diffDays >= 30;
    default: return false;
  }
};
