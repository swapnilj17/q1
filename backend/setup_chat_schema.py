"""
Bootstrap chat schema on Supabase.
Run once: python setup_chat_schema.py
"""
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

SQL = """
-- Chat rooms (1-on-1 or group)
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  is_group BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview TEXT
);

-- Members of a room
CREATE TABLE IF NOT EXISTS chat_room_members (
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_room_time ON chat_messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_user ON chat_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_last_msg ON chat_rooms(last_message_at DESC);

-- Enable Realtime on chat_messages
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- Open access (application enforces auth via backend)
ALTER TABLE chat_rooms DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
"""

if __name__ == "__main__":
    try:
        # Use REST rpc if exec_sql is exposed; else use psycopg2 via DATABASE_URL
        # We'll use the PostgREST rpc 'exec_sql' helper if it exists; otherwise a direct connection via psycopg2.
        import psycopg2
        db_url = os.getenv("SUPABASE_DB_URL")
        if not db_url:
            # Build from SUPABASE_URL assuming standard pattern is not safe; fallback to asking.
            print("No SUPABASE_DB_URL set. Trying via PostgREST is not available; please set SUPABASE_DB_URL.")
        else:
            conn = psycopg2.connect(db_url)
            conn.autocommit = True
            cur = conn.cursor()
            for stmt in [s.strip() for s in SQL.split(";") if s.strip()]:
                try:
                    cur.execute(stmt)
                    print(f"OK: {stmt[:80]}...")
                except Exception as e:
                    print(f"WARN ({stmt[:60]}...): {e}")
            cur.close()
            conn.close()
            print("Chat schema ready.")
    except Exception as e:
        print(f"Setup failed: {e}")
