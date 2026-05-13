"""
LifeFlow Backend - Supabase Edition
"""
from fastapi import FastAPI, HTTPException, Depends, status, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timedelta
from supabase import create_client, Client
import jwt
import bcrypt
import os
import uuid
from dotenv import load_dotenv

load_dotenv()

# Environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
JWT_SECRET = os.getenv("JWT_SECRET", "lifeflow-secret-key-2025")
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY", "")

# Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="LifeFlow API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# Helper functions
def create_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> str:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["user_id"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    user_id = verify_token(credentials.credentials)
    result = supabase.table("users").select("*").eq("id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="User not found")
    return result.data[0]

# Pydantic Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    theme_preference: Optional[str] = None

class NoteCreate(BaseModel):
    title: str
    content: str = ""
    tags: List[str] = []
    pinned: bool = False
    journal_date: Optional[str] = None

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    pinned: Optional[bool] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    transcript: Optional[str] = None
    ai_summary: Optional[str] = None

class EventCreate(BaseModel):
    title: str
    description: str = ""
    date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None

class ReminderCreate(BaseModel):
    title: str
    due_date: Optional[str] = None

class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    completed: Optional[bool] = None
    due_date: Optional[str] = None

# ============== AUTH ENDPOINTS ==============

@app.post("/api/auth/register")
async def register(user: UserRegister):
    # Check if user exists
    existing = supabase.table("users").select("id").eq("email", user.email).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    password_hash = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()
    user_id = str(uuid.uuid4())
    
    # Create user
    user_doc = {
        "id": user_id,
        "email": user.email,
        "password_hash": password_hash,
        "name": user.name,
        "avatar_url": None,
        "theme_preference": "light",
        "subscription": "free",
        "created_at": datetime.utcnow().isoformat()
    }
    supabase.table("users").insert(user_doc).execute()
    
    token = create_token(user_id)
    return {
        "token": token,
        "user": {
            "id": user_id,
            "email": user.email,
            "name": user.name,
            "avatar_url": None,
            "theme_preference": "light",
            "subscription": "free"
        }
    }

@app.post("/api/auth/login")
async def login(credentials: UserLogin):
    result = supabase.table("users").select("*").eq("email", credentials.email).execute()
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user = result.data[0]
    if not bcrypt.checkpw(credentials.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "avatar_url": user.get("avatar_url"),
            "theme_preference": user.get("theme_preference", "light"),
            "subscription": user.get("subscription", "free")
        }
    }

@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "avatar_url": current_user.get("avatar_url"),
        "theme_preference": current_user.get("theme_preference", "light"),
        "subscription": current_user.get("subscription", "free")
    }

@app.put("/api/auth/profile")
async def update_profile(profile: ProfileUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if profile.name is not None:
        update_data["name"] = profile.name
    if profile.avatar_url is not None:
        update_data["avatar_url"] = profile.avatar_url
    if profile.theme_preference is not None:
        update_data["theme_preference"] = profile.theme_preference
    
    if update_data:
        supabase.table("users").update(update_data).eq("id", current_user["id"]).execute()
    
    # Get updated user
    result = supabase.table("users").select("*").eq("id", current_user["id"]).execute()
    user = result.data[0]
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "avatar_url": user.get("avatar_url"),
        "theme_preference": user.get("theme_preference", "light"),
        "subscription": user.get("subscription", "free")
    }

@app.put("/api/auth/subscription")
async def update_subscription(plan: str, current_user: dict = Depends(get_current_user)):
    if plan not in ["free", "pro"]:
        raise HTTPException(status_code=400, detail="Invalid plan")
    
    supabase.table("users").update({"subscription": plan}).eq("id", current_user["id"]).execute()
    return {"subscription": plan}

# ============== NOTES ENDPOINTS ==============

@app.get("/api/notes")
async def get_notes(
    pinned: Optional[bool] = None,
    journal: Optional[bool] = None,
    journal_date: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = supabase.table("notes").select("*").eq("user_id", current_user["id"])
    
    if pinned is not None:
        query = query.eq("pinned", pinned)
    
    if journal is True:
        query = query.not_.is_("journal_date", "null")
    elif journal is False:
        query = query.is_("journal_date", "null")
    
    if journal_date:
        query = query.eq("journal_date", journal_date)
    
    result = query.order("pinned", desc=True).order("created_at", desc=True).execute()
    notes = result.data
    
    if search:
        search_lower = search.lower()
        notes = [n for n in notes if search_lower in n.get("title", "").lower() or search_lower in n.get("content", "").lower()]
    
    return notes

@app.post("/api/notes")
async def create_note(note: NoteCreate, current_user: dict = Depends(get_current_user)):
    note_id = str(uuid.uuid4())
    note_doc = {
        "id": note_id,
        "user_id": current_user["id"],
        "title": note.title,
        "content": note.content,
        "tags": note.tags,
        "pinned": note.pinned,
        "journal_date": note.journal_date,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat()
    }
    supabase.table("notes").insert(note_doc).execute()
    return note_doc

@app.get("/api/notes/{note_id}")
async def get_note(note_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase.table("notes").select("*").eq("id", note_id).eq("user_id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Note not found")
    return result.data[0]

@app.put("/api/notes/{note_id}")
async def update_note(note_id: str, note: NoteUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {"updated_at": datetime.utcnow().isoformat()}
    if note.title is not None:
        update_data["title"] = note.title
    if note.content is not None:
        update_data["content"] = note.content
    if note.tags is not None:
        update_data["tags"] = note.tags
    if note.pinned is not None:
        update_data["pinned"] = note.pinned
    
    supabase.table("notes").update(update_data).eq("id", note_id).eq("user_id", current_user["id"]).execute()
    result = supabase.table("notes").select("*").eq("id", note_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Note not found")
    return result.data[0]

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str, current_user: dict = Depends(get_current_user)):
    supabase.table("notes").delete().eq("id", note_id).eq("user_id", current_user["id"]).execute()
    return {"message": "Note deleted"}

# ============== AI ENDPOINTS ==============

@app.post("/api/notes/{note_id}/summarize")
async def summarize_note(note_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase.table("notes").select("*").eq("id", note_id).eq("user_id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Note not found")
    note = result.data[0]
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"summarize-{note_id}",
            system_message="You are a helpful assistant that summarizes notes concisely. Provide a clear, brief summary in 2-3 sentences."
        ).with_model("gemini", "gemini-2.5-flash")
        
        message = UserMessage(text=f"Please summarize this note:\n\nTitle: {note['title']}\n\nContent: {note['content']}")
        summary = await chat.send_message(message)
        return {"summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

@app.post("/api/notes/{note_id}/suggest-tags")
async def suggest_tags(note_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase.table("notes").select("*").eq("id", note_id).eq("user_id", current_user["id"]).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Note not found")
    note = result.data[0]
    
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"tags-{note_id}",
            system_message="You are a helpful assistant that suggests relevant tags for notes. Respond with ONLY a comma-separated list of 3-5 relevant single-word tags, nothing else."
        ).with_model("gemini", "gemini-2.5-flash")
        
        message = UserMessage(text=f"Suggest tags for this note:\n\nTitle: {note['title']}\n\nContent: {note['content']}")
        response = await chat.send_message(message)
        tags = [tag.strip().lower() for tag in response.split(",") if tag.strip()]
        return {"tags": tags[:5]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

@app.get("/api/dashboard/briefing")
async def get_daily_briefing(current_user: dict = Depends(get_current_user)):
    today = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Get today's events
    events_result = supabase.table("events").select("*").eq("user_id", current_user["id"]).eq("date", today).execute()
    events = events_result.data or []
    
    # Get pending reminders
    reminders_result = supabase.table("reminders").select("*").eq("user_id", current_user["id"]).eq("completed", False).execute()
    reminders = reminders_result.data or []
    
    # Get pinned notes count
    pinned_result = supabase.table("notes").select("id").eq("user_id", current_user["id"]).eq("pinned", True).execute()
    pinned_count = len(pinned_result.data) if pinned_result.data else 0
    
    # Mock weather
    weather = {"temperature": 72, "condition": "Partly Cloudy", "high": 78, "low": 65, "icon": "partly-cloudy"}
    
    if not EMERGENT_LLM_KEY:
        return {
            "briefing": f"Good day, {current_user['name']}! You have {len(events)} events and {len(reminders)} pending tasks today.",
            "events_count": len(events),
            "reminders_count": len(reminders),
            "pinned_notes_count": pinned_count,
            "weather": weather
        }
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        events_text = "\n".join([f"- {e['title']} at {e.get('start_time', 'TBD')}" for e in events]) or "No events scheduled"
        reminders_text = "\n".join([f"- {r['title']}" for r in reminders]) or "No pending reminders"
        
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"briefing-{current_user['id']}-{today}",
            system_message="You are a friendly personal assistant providing a brief, motivating daily summary. Keep it under 3 sentences."
        ).with_model("gemini", "gemini-2.5-flash")
        
        message = UserMessage(text=f"Create a brief daily summary for {current_user['name']}:\n\nToday's Events:\n{events_text}\n\nPending Tasks:\n{reminders_text}\n\nWeather: {weather['temperature']}°F, {weather['condition']}\n\nPinned Notes: {pinned_count}")
        briefing = await chat.send_message(message)
        
        return {
            "briefing": briefing,
            "events_count": len(events),
            "reminders_count": len(reminders),
            "pinned_notes_count": pinned_count,
            "weather": weather
        }
    except:
        return {
            "briefing": f"Good day, {current_user['name']}! You have {len(events)} events and {len(reminders)} pending tasks today.",
            "events_count": len(events),
            "reminders_count": len(reminders),
            "pinned_notes_count": pinned_count,
            "weather": weather
        }

# ============== EVENTS ENDPOINTS ==============

@app.get("/api/events")
async def get_events(date: Optional[str] = None, month: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    query = supabase.table("events").select("*").eq("user_id", current_user["id"])
    
    if date:
        query = query.eq("date", date)
    
    result = query.order("date").execute()
    events = result.data or []
    
    if month:
        events = [e for e in events if e.get("date", "").startswith(month)]
    
    return events

@app.post("/api/events")
async def create_event(event: EventCreate, current_user: dict = Depends(get_current_user)):
    event_id = str(uuid.uuid4())
    event_doc = {
        "id": event_id,
        "user_id": current_user["id"],
        "title": event.title,
        "description": event.description,
        "date": event.date,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "created_at": datetime.utcnow().isoformat()
    }
    supabase.table("events").insert(event_doc).execute()
    return event_doc

@app.put("/api/events/{event_id}")
async def update_event(event_id: str, event: EventUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if event.title is not None:
        update_data["title"] = event.title
    if event.description is not None:
        update_data["description"] = event.description
    if event.date is not None:
        update_data["date"] = event.date
    if event.start_time is not None:
        update_data["start_time"] = event.start_time
    if event.end_time is not None:
        update_data["end_time"] = event.end_time
    
    supabase.table("events").update(update_data).eq("id", event_id).eq("user_id", current_user["id"]).execute()
    result = supabase.table("events").select("*").eq("id", event_id).execute()
    return result.data[0] if result.data else {}

@app.delete("/api/events/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(get_current_user)):
    supabase.table("events").delete().eq("id", event_id).eq("user_id", current_user["id"]).execute()
    return {"message": "Event deleted"}

# ============== REMINDERS ENDPOINTS ==============

@app.get("/api/reminders")
async def get_reminders(completed: Optional[bool] = None, current_user: dict = Depends(get_current_user)):
    query = supabase.table("reminders").select("*").eq("user_id", current_user["id"])
    
    if completed is not None:
        query = query.eq("completed", completed)
    
    result = query.order("completed").order("created_at", desc=True).execute()
    return result.data or []

@app.post("/api/reminders")
async def create_reminder(reminder: ReminderCreate, current_user: dict = Depends(get_current_user)):
    reminder_id = str(uuid.uuid4())
    reminder_doc = {
        "id": reminder_id,
        "user_id": current_user["id"],
        "title": reminder.title,
        "completed": False,
        "due_date": reminder.due_date,
        "created_at": datetime.utcnow().isoformat()
    }
    supabase.table("reminders").insert(reminder_doc).execute()
    return reminder_doc

@app.put("/api/reminders/{reminder_id}")
async def update_reminder(reminder_id: str, reminder: ReminderUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if reminder.title is not None:
        update_data["title"] = reminder.title
    if reminder.completed is not None:
        update_data["completed"] = reminder.completed
    if reminder.due_date is not None:
        update_data["due_date"] = reminder.due_date
    
    supabase.table("reminders").update(update_data).eq("id", reminder_id).eq("user_id", current_user["id"]).execute()
    result = supabase.table("reminders").select("*").eq("id", reminder_id).execute()
    return result.data[0] if result.data else {}

@app.delete("/api/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, current_user: dict = Depends(get_current_user)):
    supabase.table("reminders").delete().eq("id", reminder_id).eq("user_id", current_user["id"]).execute()
    return {"message": "Reminder deleted"}

@app.delete("/api/reminders/completed/clear")
async def clear_completed_reminders(current_user: dict = Depends(get_current_user)):
    result = supabase.table("reminders").delete().eq("user_id", current_user["id"]).eq("completed", True).execute()
    return {"deleted_count": len(result.data) if result.data else 0}

# ============== CHAT ENDPOINTS ==============

class ChatRoomCreate(BaseModel):
    member_ids: List[str] = Field(min_length=1)  # excluding current user
    name: Optional[str] = None
    is_group: bool = False

class ChatMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)

@app.get("/api/chat/users")
async def list_chat_users(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List other users available to chat with."""
    query = supabase.table("users").select("id, email, name, avatar_url").neq("id", current_user["id"])
    result = query.execute()
    users = result.data or []
    if search:
        s = search.lower()
        users = [u for u in users if s in (u.get("name") or "").lower() or s in (u.get("email") or "").lower()]
    return users[:100]

def _hydrate_room(room: dict, current_user_id: str):
    """Attach members (excluding current user for DMs) and display name/avatar."""
    room_id = room["id"]
    members = supabase.table("chat_room_members").select("user_id").eq("room_id", room_id).execute().data or []
    member_ids = [m["user_id"] for m in members]
    users_res = supabase.table("users").select("id, email, name, avatar_url").in_("id", member_ids).execute().data or []
    # Determine display
    if room.get("is_group"):
        display_name = room.get("name") or ", ".join([u["name"] for u in users_res if u["id"] != current_user_id][:3])
        display_avatar = None
    else:
        other = next((u for u in users_res if u["id"] != current_user_id), None)
        display_name = other["name"] if other else "Chat"
        display_avatar = other.get("avatar_url") if other else None
    return {
        **room,
        "members": users_res,
        "display_name": display_name,
        "display_avatar": display_avatar,
    }

@app.get("/api/chat/rooms")
async def list_chat_rooms(current_user: dict = Depends(get_current_user)):
    """List rooms the current user is a member of, ordered by last message."""
    memberships = supabase.table("chat_room_members").select("room_id").eq("user_id", current_user["id"]).execute().data or []
    room_ids = [m["room_id"] for m in memberships]
    if not room_ids:
        return []
    rooms = supabase.table("chat_rooms").select("*").in_("id", room_ids).order("last_message_at", desc=True).execute().data or []
    return [_hydrate_room(r, current_user["id"]) for r in rooms]

@app.post("/api/chat/rooms")
async def create_chat_room(body: ChatRoomCreate, current_user: dict = Depends(get_current_user)):
    """Create a 1:1 or group chat. For 1:1, reuses existing room if one already exists."""
    all_member_ids = list({*body.member_ids, current_user["id"]})
    if len(all_member_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least one other member")

    # For a 1:1, attempt to find existing room containing exactly these two users
    if not body.is_group and len(all_member_ids) == 2:
        # Pull all rooms current user belongs to that are not groups
        myrooms = supabase.table("chat_room_members").select("room_id").eq("user_id", current_user["id"]).execute().data or []
        my_room_ids = [m["room_id"] for m in myrooms]
        if my_room_ids:
            rooms = supabase.table("chat_rooms").select("*").in_("id", my_room_ids).eq("is_group", False).execute().data or []
            for r in rooms:
                mems = supabase.table("chat_room_members").select("user_id").eq("room_id", r["id"]).execute().data or []
                mids = sorted([m["user_id"] for m in mems])
                if mids == sorted(all_member_ids):
                    return _hydrate_room(r, current_user["id"])

    # Create new room
    room_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    supabase.table("chat_rooms").insert({
        "id": room_id,
        "name": body.name,
        "is_group": body.is_group or len(all_member_ids) > 2,
        "created_by": current_user["id"],
        "created_at": now,
        "last_message_at": now,
    }).execute()
    # Add all members
    supabase.table("chat_room_members").insert([
        {"room_id": room_id, "user_id": uid, "joined_at": now} for uid in all_member_ids
    ]).execute()
    created = supabase.table("chat_rooms").select("*").eq("id", room_id).execute().data[0]
    return _hydrate_room(created, current_user["id"])

def _assert_member(room_id: str, user_id: str):
    r = supabase.table("chat_room_members").select("user_id").eq("room_id", room_id).eq("user_id", user_id).execute().data or []
    if not r:
        raise HTTPException(status_code=403, detail="Not a member of this room")

@app.get("/api/chat/rooms/{room_id}")
async def get_chat_room(room_id: str, current_user: dict = Depends(get_current_user)):
    _assert_member(room_id, current_user["id"])
    room = supabase.table("chat_rooms").select("*").eq("id", room_id).execute().data
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return _hydrate_room(room[0], current_user["id"])

@app.get("/api/chat/rooms/{room_id}/messages")
async def get_chat_messages(
    room_id: str,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    _assert_member(room_id, current_user["id"])
    msgs = (
        supabase.table("chat_messages")
        .select("*")
        .eq("room_id", room_id)
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
        .data
        or []
    )
    return msgs

@app.post("/api/chat/rooms/{room_id}/messages")
async def send_chat_message(
    room_id: str,
    body: ChatMessageCreate,
    current_user: dict = Depends(get_current_user),
):
    _assert_member(room_id, current_user["id"])
    msg_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Empty message")

    supabase.table("chat_messages").insert({
        "id": msg_id,
        "room_id": room_id,
        "sender_id": current_user["id"],
        "content": content,
        "created_at": now,
    }).execute()
    # Update room metadata for list preview
    supabase.table("chat_rooms").update({
        "last_message_at": now,
        "last_message_preview": content[:120],
    }).eq("id", room_id).execute()

    return {
        "id": msg_id,
        "room_id": room_id,
        "sender_id": current_user["id"],
        "content": content,
        "created_at": now,
    }

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "LifeFlow API", "backend": "Supabase"}

# ─────────────────────── MEDIA ───────────────────────

@app.post("/api/media/upload")
async def upload_media(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    note_id: str = Form(...),
    media_type: str = Form(...),
    current_user: dict = Depends(get_current_user),
):
    """Upload an audio/video file to Supabase Storage media-vault bucket."""
    if user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    ext = "m4a" if media_type == "audio" else "mp4"
    content_type = "audio/m4a" if media_type == "audio" else "video/mp4"
    timestamp = int(datetime.now().timestamp() * 1000)
    path = f"notes/{user_id}/{note_id}/{timestamp}.{ext}"

    file_bytes = await file.read()

    try:
        supabase.storage.from_("media-vault").upload(
            path=path,
            file=file_bytes,
            file_options={"content-type": content_type, "upsert": True},
        )
    except Exception as e:
        # If already exists with same path, that's fine
        if "already exists" not in str(e).lower():
            raise HTTPException(status_code=500, detail=f"Storage upload failed: {str(e)}")

    public_url = supabase.storage.from_("media-vault").get_public_url(path)

    return {"url": public_url, "path": path, "media_type": media_type}


@app.post("/api/media/process")
async def process_media(
    note_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Placeholder for AI processing (Groq Whisper + Llama) — activate by adding GROQ_API_KEY."""
    groq_key = os.getenv("GROQ_API_KEY")
    if not groq_key:
        return {
            "note_id": note_id,
            "status": "pending",
            "message": "Add GROQ_API_KEY to backend/.env to enable AI transcription & summarisation.",
        }
    # TODO: implement Groq Whisper + Llama 3.3 when key is provided
    return {"note_id": note_id, "status": "not_implemented"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
