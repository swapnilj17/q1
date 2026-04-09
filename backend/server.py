"""
LifeFlow Backend - Personal Productivity Assistant API
"""
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timedelta
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient
import jwt
import bcrypt
import os
from dotenv import load_dotenv
from contextlib import asynccontextmanager

load_dotenv()

# Environment variables
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "lifeflow_db")
JWT_SECRET = os.getenv("JWT_SECRET", "lifeflow-secret-key-2025")
JWT_ALGORITHM = "HS256"
EMERGENT_LLM_KEY = os.getenv("EMERGENT_LLM_KEY", "")

# MongoDB client
client: AsyncIOMotorClient = None
db = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global client, db
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.notes.create_index([("user_id", 1), ("pinned", -1), ("created_at", -1)])
    await db.events.create_index([("user_id", 1), ("date", 1)])
    await db.reminders.create_index([("user_id", 1), ("completed", 1)])
    print("Connected to MongoDB")
    yield
    client.close()
    print("Disconnected from MongoDB")

app = FastAPI(title="LifeFlow API", lifespan=lifespan)

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
def serialize_doc(doc):
    """Convert MongoDB document to JSON-serializable dict"""
    if doc is None:
        return None
    doc["id"] = str(doc.pop("_id"))
    return doc

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
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return serialize_doc(user)

# Pydantic Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class NoteCreate(BaseModel):
    title: str
    content: str = ""
    tags: List[str] = []
    pinned: bool = False
    journal_date: Optional[str] = None  # ISO date string for journal entries

class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[List[str]] = None
    pinned: Optional[bool] = None

class EventCreate(BaseModel):
    title: str
    description: str = ""
    date: str  # ISO date string
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    linked_note_id: Optional[str] = None

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    linked_note_id: Optional[str] = None

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
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Hash password
    password_hash = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt()).decode()
    
    # Create user
    user_doc = {
        "email": user.email,
        "password_hash": password_hash,
        "name": user.name,
        "theme_preference": "light",
        "created_at": datetime.utcnow()
    }
    result = await db.users.insert_one(user_doc)
    
    token = create_token(str(result.inserted_id))
    return {
        "token": token,
        "user": {
            "id": str(result.inserted_id),
            "email": user.email,
            "name": user.name,
            "theme_preference": "light"
        }
    }

@app.post("/api/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not bcrypt.checkpw(credentials.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(str(user["_id"]))
    return {
        "token": token,
        "user": {
            "id": str(user["_id"]),
            "email": user["email"],
            "name": user["name"],
            "theme_preference": user.get("theme_preference", "light")
        }
    }

@app.get("/api/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "name": current_user["name"],
        "theme_preference": current_user.get("theme_preference", "light")
    }

@app.put("/api/auth/theme")
async def update_theme(theme: str, current_user: dict = Depends(get_current_user)):
    if theme not in ["light", "dark"]:
        raise HTTPException(status_code=400, detail="Theme must be 'light' or 'dark'")
    
    await db.users.update_one(
        {"_id": ObjectId(current_user["id"])},
        {"$set": {"theme_preference": theme}}
    )
    return {"theme_preference": theme}

# ============== NOTES ENDPOINTS ==============

@app.get("/api/notes")
async def get_notes(
    pinned: Optional[bool] = None,
    journal: Optional[bool] = None,
    journal_date: Optional[str] = None,
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    
    if pinned is not None:
        query["pinned"] = pinned
    
    if journal is True:
        query["journal_date"] = {"$exists": True, "$ne": None}
    elif journal is False:
        query["$or"] = [
            {"journal_date": {"$exists": False}},
            {"journal_date": None}
        ]
    
    if journal_date:
        query["journal_date"] = journal_date
    
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"content": {"$regex": search, "$options": "i"}},
            {"tags": {"$in": [search]}}
        ]
    
    cursor = db.notes.find(query).sort([("pinned", -1), ("created_at", -1)])
    notes = await cursor.to_list(length=100)
    return [serialize_doc(note) for note in notes]

@app.post("/api/notes")
async def create_note(note: NoteCreate, current_user: dict = Depends(get_current_user)):
    note_doc = {
        "user_id": current_user["id"],
        "title": note.title,
        "content": note.content,
        "tags": note.tags,
        "pinned": note.pinned,
        "journal_date": note.journal_date,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    result = await db.notes.insert_one(note_doc)
    note_doc["_id"] = result.inserted_id
    return serialize_doc(note_doc)

@app.get("/api/notes/{note_id}")
async def get_note(note_id: str, current_user: dict = Depends(get_current_user)):
    note = await db.notes.find_one({
        "_id": ObjectId(note_id),
        "user_id": current_user["id"]
    })
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return serialize_doc(note)

@app.put("/api/notes/{note_id}")
async def update_note(note_id: str, note: NoteUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {"updated_at": datetime.utcnow()}
    if note.title is not None:
        update_data["title"] = note.title
    if note.content is not None:
        update_data["content"] = note.content
    if note.tags is not None:
        update_data["tags"] = note.tags
    if note.pinned is not None:
        update_data["pinned"] = note.pinned
    
    result = await db.notes.update_one(
        {"_id": ObjectId(note_id), "user_id": current_user["id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    
    updated_note = await db.notes.find_one({"_id": ObjectId(note_id)})
    return serialize_doc(updated_note)

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.notes.delete_one({
        "_id": ObjectId(note_id),
        "user_id": current_user["id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"message": "Note deleted"}

# ============== AI ENDPOINTS ==============

@app.post("/api/notes/{note_id}/summarize")
async def summarize_note(note_id: str, current_user: dict = Depends(get_current_user)):
    note = await db.notes.find_one({
        "_id": ObjectId(note_id),
        "user_id": current_user["id"]
    })
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
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
    note = await db.notes.find_one({
        "_id": ObjectId(note_id),
        "user_id": current_user["id"]
    })
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
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
    events = await db.events.find({
        "user_id": current_user["id"],
        "date": today
    }).to_list(length=10)
    
    # Get pending reminders
    reminders = await db.reminders.find({
        "user_id": current_user["id"],
        "completed": False
    }).to_list(length=10)
    
    # Get pinned notes count
    pinned_count = await db.notes.count_documents({
        "user_id": current_user["id"],
        "pinned": True
    })
    
    # Mock weather data
    weather = {
        "temperature": 72,
        "condition": "Partly Cloudy",
        "high": 78,
        "low": 65,
        "icon": "partly-cloudy"
    }
    
    if not EMERGENT_LLM_KEY:
        # Return basic briefing without AI
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
        
        message = UserMessage(
            text=f"""Create a brief daily summary for {current_user['name']}:

Today's Events:
{events_text}

Pending Tasks:
{reminders_text}

Weather: {weather['temperature']}°F, {weather['condition']}

Pinned Notes: {pinned_count}"""
        )
        
        briefing = await chat.send_message(message)
        
        return {
            "briefing": briefing,
            "events_count": len(events),
            "reminders_count": len(reminders),
            "pinned_notes_count": pinned_count,
            "weather": weather
        }
    except Exception as e:
        return {
            "briefing": f"Good day, {current_user['name']}! You have {len(events)} events and {len(reminders)} pending tasks today.",
            "events_count": len(events),
            "reminders_count": len(reminders),
            "pinned_notes_count": pinned_count,
            "weather": weather
        }

# ============== EVENTS ENDPOINTS ==============

@app.get("/api/events")
async def get_events(
    date: Optional[str] = None,
    month: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    
    if date:
        query["date"] = date
    elif month:
        # Get events for a specific month (format: YYYY-MM)
        query["date"] = {"$regex": f"^{month}"}
    
    cursor = db.events.find(query).sort("date", 1)
    events = await cursor.to_list(length=100)
    return [serialize_doc(event) for event in events]

@app.post("/api/events")
async def create_event(event: EventCreate, current_user: dict = Depends(get_current_user)):
    event_doc = {
        "user_id": current_user["id"],
        "title": event.title,
        "description": event.description,
        "date": event.date,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "linked_note_id": event.linked_note_id,
        "created_at": datetime.utcnow()
    }
    result = await db.events.insert_one(event_doc)
    event_doc["_id"] = result.inserted_id
    return serialize_doc(event_doc)

@app.get("/api/events/{event_id}")
async def get_event(event_id: str, current_user: dict = Depends(get_current_user)):
    event = await db.events.find_one({
        "_id": ObjectId(event_id),
        "user_id": current_user["id"]
    })
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return serialize_doc(event)

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
    if event.linked_note_id is not None:
        update_data["linked_note_id"] = event.linked_note_id
    
    result = await db.events.update_one(
        {"_id": ObjectId(event_id), "user_id": current_user["id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    
    updated_event = await db.events.find_one({"_id": ObjectId(event_id)})
    return serialize_doc(updated_event)

@app.delete("/api/events/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.events.delete_one({
        "_id": ObjectId(event_id),
        "user_id": current_user["id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event deleted"}

# ============== REMINDERS ENDPOINTS ==============

@app.get("/api/reminders")
async def get_reminders(
    completed: Optional[bool] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"user_id": current_user["id"]}
    
    if completed is not None:
        query["completed"] = completed
    
    cursor = db.reminders.find(query).sort([("completed", 1), ("created_at", -1)])
    reminders = await cursor.to_list(length=100)
    return [serialize_doc(reminder) for reminder in reminders]

@app.post("/api/reminders")
async def create_reminder(reminder: ReminderCreate, current_user: dict = Depends(get_current_user)):
    reminder_doc = {
        "user_id": current_user["id"],
        "title": reminder.title,
        "completed": False,
        "due_date": reminder.due_date,
        "created_at": datetime.utcnow()
    }
    result = await db.reminders.insert_one(reminder_doc)
    reminder_doc["_id"] = result.inserted_id
    return serialize_doc(reminder_doc)

@app.put("/api/reminders/{reminder_id}")
async def update_reminder(reminder_id: str, reminder: ReminderUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}
    if reminder.title is not None:
        update_data["title"] = reminder.title
    if reminder.completed is not None:
        update_data["completed"] = reminder.completed
    if reminder.due_date is not None:
        update_data["due_date"] = reminder.due_date
    
    result = await db.reminders.update_one(
        {"_id": ObjectId(reminder_id), "user_id": current_user["id"]},
        {"$set": update_data}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    updated_reminder = await db.reminders.find_one({"_id": ObjectId(reminder_id)})
    return serialize_doc(updated_reminder)

@app.delete("/api/reminders/{reminder_id}")
async def delete_reminder(reminder_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.reminders.delete_one({
        "_id": ObjectId(reminder_id),
        "user_id": current_user["id"]
    })
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"message": "Reminder deleted"}

@app.delete("/api/reminders/completed/clear")
async def clear_completed_reminders(current_user: dict = Depends(get_current_user)):
    result = await db.reminders.delete_many({
        "user_id": current_user["id"],
        "completed": True
    })
    return {"deleted_count": result.deleted_count}

# Health check
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "LifeFlow API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
