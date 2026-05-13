import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars missing — realtime chat will not connect');
}

// Resolve WebSocket transport - provide a fallback for Node.js < 22 environments
// (Metro SSG/SSR runs in Node.js 20 which lacks native WebSocket)
const resolveTransport = (): any => {
  if (typeof WebSocket !== 'undefined') return WebSocket;
  if (typeof globalThis !== 'undefined' && (globalThis as any).WebSocket) return (globalThis as any).WebSocket;
  // Graceful fallback - realtime will not work but app won't crash
  return class NoopWS {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    readyState = 3; url = ''; protocol = '';
    constructor(_url: string) {}
    close() {} send() {}
    onopen = null; onmessage = null; onclose = null; onerror = null;
    addEventListener() {} removeEventListener() {}
  };
};

// Use safe fallback so createClient never throws at bundle/runtime when env is missing.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    realtime: {
      transport: resolveTransport(),
      params: { eventsPerSecond: 10 },
    },
  }
);
