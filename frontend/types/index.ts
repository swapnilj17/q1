export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  theme_preference: 'light' | 'dark';
  subscription: 'free' | 'pro';
}

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  journal_date?: string;
  created_at: string;
  updated_at: string;
  // Media fields for Voice/Video Notes
  media_url?: string | null;
  media_type?: 'audio' | 'video' | null;
  transcript?: string | null;
}

export interface Event {
  id: string;
  user_id: string;
  title: string;
  description: string;
  date: string;
  start_time?: string;
  end_time?: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  title: string;
  completed: boolean;
  due_date?: string;
  created_at: string;
}

export interface Weather {
  temperature: number;
  condition: string;
  high: number;
  low: number;
  icon: string;
}

export interface DailyBriefing {
  briefing: string;
  events_count: number;
  reminders_count: number;
  pinned_notes_count: number;
  weather: Weather;
}
