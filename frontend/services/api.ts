import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Note, Event, Reminder, DailyBriefing } from '../types';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
                process.env.EXPO_PUBLIC_BACKEND_URL || 
                'https://showapp-2.preview.emergentagent.com';

class ApiService {
  private async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || 'Request failed');
    }

    return response.json();
  }

  // Auth
  async register(email: string, password: string, name: string): Promise<{ token: string; user: User }> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async getMe(): Promise<User> {
    return this.request('/api/auth/me');
  }

  async updateProfile(data: { name?: string; avatar_url?: string; theme_preference?: string }): Promise<User> {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateSubscription(plan: 'free' | 'pro'): Promise<{ subscription: string }> {
    return this.request(`/api/auth/subscription?plan=${plan}`, {
      method: 'PUT',
    });
  }

  // Notes
  async getNotes(params?: { pinned?: boolean; journal?: boolean; journal_date?: string; search?: string }): Promise<Note[]> {
    const queryParams = new URLSearchParams();
    if (params?.pinned !== undefined) queryParams.append('pinned', String(params.pinned));
    if (params?.journal !== undefined) queryParams.append('journal', String(params.journal));
    if (params?.journal_date) queryParams.append('journal_date', params.journal_date);
    if (params?.search) queryParams.append('search', params.search);
    
    const query = queryParams.toString();
    return this.request(`/api/notes${query ? `?${query}` : ''}`);
  }

  async getNote(id: string): Promise<Note> {
    return this.request(`/api/notes/${id}`);
  }

  async createNote(note: Partial<Note>): Promise<Note> {
    return this.request('/api/notes', {
      method: 'POST',
      body: JSON.stringify(note),
    });
  }

  async updateNote(id: string, note: Partial<Note>): Promise<Note> {
    return this.request(`/api/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(note),
    });
  }

  async deleteNote(id: string): Promise<void> {
    return this.request(`/api/notes/${id}`, { method: 'DELETE' });
  }

  async summarizeNote(id: string): Promise<{ summary: string }> {
    return this.request(`/api/notes/${id}/summarize`, { method: 'POST' });
  }

  async suggestTags(id: string): Promise<{ tags: string[] }> {
    return this.request(`/api/notes/${id}/suggest-tags`, { method: 'POST' });
  }

  // Events
  async getEvents(params?: { date?: string; month?: string }): Promise<Event[]> {
    const queryParams = new URLSearchParams();
    if (params?.date) queryParams.append('date', params.date);
    if (params?.month) queryParams.append('month', params.month);
    
    const query = queryParams.toString();
    return this.request(`/api/events${query ? `?${query}` : ''}`);
  }

  async createEvent(event: Partial<Event>): Promise<Event> {
    return this.request('/api/events', {
      method: 'POST',
      body: JSON.stringify(event),
    });
  }

  async updateEvent(id: string, event: Partial<Event>): Promise<Event> {
    return this.request(`/api/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(event),
    });
  }

  async deleteEvent(id: string): Promise<void> {
    return this.request(`/api/events/${id}`, { method: 'DELETE' });
  }

  // Reminders
  async getReminders(completed?: boolean): Promise<Reminder[]> {
    const query = completed !== undefined ? `?completed=${completed}` : '';
    return this.request(`/api/reminders${query}`);
  }

  async createReminder(reminder: Partial<Reminder>): Promise<Reminder> {
    return this.request('/api/reminders', {
      method: 'POST',
      body: JSON.stringify(reminder),
    });
  }

  async updateReminder(id: string, reminder: Partial<Reminder>): Promise<Reminder> {
    return this.request(`/api/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reminder),
    });
  }

  async deleteReminder(id: string): Promise<void> {
    return this.request(`/api/reminders/${id}`, { method: 'DELETE' });
  }

  async clearCompletedReminders(): Promise<{ deleted_count: number }> {
    return this.request('/api/reminders/completed/clear', { method: 'DELETE' });
  }

  // Dashboard
  async getDailyBriefing(): Promise<DailyBriefing> {
    return this.request('/api/dashboard/briefing');
  }

  // ============== CHAT ==============
  async listChatUsers(search?: string): Promise<ChatUser[]> {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/api/chat/users${q}`);
  }

  async listChatRooms(): Promise<ChatRoom[]> {
    return this.request('/api/chat/rooms');
  }

  async getChatRoom(roomId: string): Promise<ChatRoom> {
    return this.request(`/api/chat/rooms/${roomId}`);
  }

  async createChatRoom(memberIds: string[], isGroup = false, name?: string): Promise<ChatRoom> {
    return this.request('/api/chat/rooms', {
      method: 'POST',
      body: JSON.stringify({ member_ids: memberIds, is_group: isGroup, name }),
    });
  }

  async getChatMessages(roomId: string, limit = 100): Promise<ChatMessage[]> {
    return this.request(`/api/chat/rooms/${roomId}/messages?limit=${limit}`);
  }

  async sendChatMessage(roomId: string, content: string): Promise<ChatMessage> {
    return this.request(`/api/chat/rooms/${roomId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }
}

export interface ChatUser {
  id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
}

export interface ChatRoom {
  id: string;
  name?: string | null;
  is_group: boolean;
  created_by?: string | null;
  created_at: string;
  last_message_at: string;
  last_message_preview?: string | null;
  members: ChatUser[];
  display_name: string;
  display_avatar?: string | null;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export const api = new ApiService();
