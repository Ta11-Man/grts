"""
Main entry point for the GRTS FastAPI application.
Provides RESTful endpoints for the Tracker Extension, Autofill engine,
Lifecycle Manager, and Analytics Dashboard.
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import Optional, Dict, Any, List

from models import (
    ApplicationCreate, 
    ApplicationUpdate, 
    ApplicationResponse, 
    TimelineEventCreate, 
    TimelineEventUpdate,
    UserProfileSchema,
    ResumeVersionCreate,
    ResumePdfUpdate,
    QuestionAnswerItem,
    QuestionAnswerUpdate
)
import database

@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    yield

app = FastAPI(
    title="GRTS Backend API",
    description="Local API for Gabe's Reverse Tracking System",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS for Chrome/Firefox Extension origins and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/ping")
def ping():
    """Health check endpoint to ensure API is up."""
    return {"status": "ok", "service": "GRTS API", "version": "2.0.0"}

@app.post("/apply", response_model=ApplicationResponse)
def submit_application(application: ApplicationCreate):
    """
    Endpoint for the Tracker Extension to submit a new application.
    Checks if Company/Job exists, creates if necessary, logs Application,
    and captures non-standard Q&A responses into the Question Bank.
    """
    try:
        data = application.model_dump()
        app_id = database.insert_application_data(data)
        
        return ApplicationResponse(
            id=app_id,
            status="success",
            message=f"Application for '{application.job_title}' at '{application.company_name}' recorded."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/applications")
def get_applications(
    include_archived: bool = Query(False, description="Include archived applications"),
    include_saved: bool = Query(False, description="Include saved applications"),
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None, description="Search term for company, title, location, notes"),
    sort_by: str = Query("recency", description="Sort by recency, priority, company, or status"),
    order: str = Query("desc", description="Sort order: desc or asc")
):
    """Endpoint for the Dashboard to fetch applications with timeline and custom answers."""
    try:
        apps = database.get_all_applications(
            include_archived=include_archived, 
            include_saved=include_saved,
            status=status, 
            search=search,
            sort_by=sort_by,
            order=order
        )
        return {"status": "success", "count": len(apps), "data": apps}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/applications", response_model=ApplicationResponse)
def create_manual_application(application: ApplicationCreate):
    """Endpoint for the Dashboard to manually add an application entry."""
    return submit_application(application)

@app.get("/applications/{app_id}")
def get_application(app_id: int):
    """Fetches full details for a single application."""
    try:
        app = database.get_application_by_id(app_id)
        if not app:
            raise HTTPException(status_code=404, detail="Application not found")
        return {"status": "success", "data": app}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/applications/{app_id}")
def update_application_details(app_id: int, payload: ApplicationUpdate):
    """Updates status, notes, priority, salary range, or archived status."""
    try:
        success = database.update_application(app_id, payload.model_dump(exclude_unset=True))
        if not success:
            raise HTTPException(status_code=404, detail="Application not found")
        return {"status": "success", "message": "Application updated successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/applications/{app_id}")
def delete_application_record(app_id: int):
    """Deletes an application and its timeline/Q&A history."""
    try:
        success = database.delete_application(app_id)
        if not success:
            raise HTTPException(status_code=404, detail="Application not found")
        return {"status": "success", "message": "Application deleted."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/applications/{app_id}/timeline")
def submit_timeline_event(app_id: int, event: TimelineEventCreate):
    """Adds an event to the application timeline and updates overall status."""
    try:
        event_id = database.insert_timeline_event(app_id, event.model_dump())
        return {"status": "success", "id": event_id, "message": f"Milestone '{event.event_type}' logged."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/timeline/{event_id}")
def update_timeline_event(event_id: int, event: TimelineEventUpdate):
    """Updates a timeline milestone."""
    try:
        success = database.update_timeline_event(event_id, event.model_dump(exclude_unset=True))
        if not success:
            raise HTTPException(status_code=404, detail="Timeline event not found")
        return {"status": "success", "message": "Timeline event updated."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/timeline/{event_id}")
def delete_timeline_event(event_id: int):
    """Deletes a timeline event."""
    try:
        success = database.delete_timeline_event(event_id)
        if not success:
            raise HTTPException(status_code=404, detail="Timeline event not found")
        return {"status": "success", "message": "Timeline event deleted."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/applications/{app_id}/timeline/reorder")
def reorder_application_timeline(app_id: int, payload: Dict[str, List[int]]):
    """Reorders timeline events for an application."""
    try:
        ordered_ids = payload.get("ordered_ids", [])
        database.reorder_timeline_events(app_id, ordered_ids)
        return {"status": "success", "message": "Timeline reordered."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/questions")
def get_questions_bank(query: Optional[str] = Query(None, description="Search term for Q&A")):
    """Retrieves all non-standard questions & answers saved across applications."""
    try:
        qa_list = database.get_all_questions(query=query)
        return {"status": "success", "count": len(qa_list), "data": qa_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/questions/{qa_id}")
def update_question_in_bank(qa_id: int, payload: QuestionAnswerUpdate):
    """Updates a recorded Q&A item."""
    try:
        updated = database.update_question_answer(
            qa_id=qa_id,
            question_text=payload.question_text,
            answer_text=payload.answer_text
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Question response not found.")
        return {"status": "success", "message": "Question response updated successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/applications/{app_id}/questions")
def add_question_to_application(app_id: int, payload: QuestionAnswerItem):
    """Adds a new recorded Q&A to an application."""
    try:
        new_id = database.add_question_answer(
            app_id=app_id,
            question_text=payload.question_text,
            answer_text=payload.answer_text,
            field_type=payload.field_type or "text"
        )
        return {"status": "success", "data": {"id": new_id}, "message": "Question response added successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/questions/{qa_id}")
def delete_question_from_bank(qa_id: int):
    """Deletes a question response from the Q&A bank."""
    try:
        success = database.delete_question_answer(qa_id)
        if not success:
            raise HTTPException(status_code=404, detail="Question answer not found")
        return {"status": "success", "message": "Question answer deleted."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ----------------- RESUME VERSIONING -----------------

@app.get("/resumes")
def get_all_resumes():
    """Retrieves all tracked resume versions."""
    try:
        resumes = database.get_all_resumes()
        return {"status": "success", "count": len(resumes), "data": resumes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/resumes/{resume_id}")
def get_resume(resume_id: int):
    """Retrieves a single resume version with parent details."""
    try:
        resume = database.get_resume_by_id(resume_id)
        if not resume:
            raise HTTPException(status_code=404, detail="Resume not found")
        return {"status": "success", "data": resume}
    except HTTPException:
        raise
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/resumes")
def create_resume_version(resume: ResumeVersionCreate):
    """Creates a new resume version."""
    try:
        resume_id = database.insert_resume_version(resume.model_dump())
        return {"status": "success", "id": resume_id, "message": f"Resume version '{resume.name}' created."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/resumes/{resume_id}")
def delete_resume_version(resume_id: int):
    """Deletes a resume version."""
    try:
        success = database.delete_resume(resume_id)
        if not success:
            raise HTTPException(status_code=404, detail="Resume not found")
        return {"status": "success", "message": "Resume deleted."}
        return {"status": "success", "message": "Resume PDF updated successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/resumes/{resume_id}")
def delete_resume_version(resume_id: int):
    """Deletes a resume version."""
    try:
        success = database.delete_resume(resume_id)
        if not success:
            raise HTTPException(status_code=404, detail="Resume not found")
        return {"status": "success", "message": "Resume deleted."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/profile")
def get_user_autofill_profile():
    """Retrieves the user's master autofill profile."""
    try:
        profile = database.get_user_profile()
        return {"status": "success", "data": profile}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/profile")
def save_user_autofill_profile(profile: UserProfileSchema):
    """Saves or updates the user's master autofill profile."""
    try:
        database.save_user_profile(profile.model_dump())
        return {"status": "success", "message": "Profile saved successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats")
def get_dashboard_stats():
    """Retrieves computed funnel metrics and conversion rates."""
    try:
        stats = database.get_analytics_stats()
        return {"status": "success", "data": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/analytics/detailed")
def get_detailed_analytics_data():
    """Retrieves comprehensive analytics for charts and breakdown views."""
    try:
        data = database.get_detailed_analytics()
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
