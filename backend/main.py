"""
Main entry point for the GRTS FastAPI application.
Provides RESTful endpoints for the Tracker Extension, Autofill engine,
Lifecycle Manager, and Analytics Dashboard.
"""
import asyncio
from fastapi import FastAPI, HTTPException, Query, Request, Header, Depends, status
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
    QuestionAnswerUpdate,
    EmailConfigSchema,
    EmailTestRequestSchema,
    UserRegisterRequest,
    UserLoginRequest,
    TokenResponse,
    PromoRedeemRequest,
    UserQuotaResponse
)
import database
import email_scanner
import security
import auth
import tier_service

async def email_background_worker():
    """Background task that runs catch-up sync on startup and periodic polling."""
    await asyncio.sleep(2)
    while True:
        try:
            cfg = database.get_email_config(mask_password=False)
            if cfg and cfg.get("auto_sync") and cfg.get("email_address") and cfg.get("password"):
                await asyncio.to_thread(email_scanner.scan_and_sync_inbox)
        except Exception as e:
            print(f"[Email Worker Error] {e}")
        
        # Poll every 10 minutes (600s)
        await asyncio.sleep(600)

@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    worker_task = asyncio.create_task(email_background_worker())
    yield
    worker_task.cancel()

app = FastAPI(
    title="GRTS Backend API",
    description="Multi-Tenant Cloud & Local API for Gabe's Reverse Tracking System",
    version="2.1.0",
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

@app.middleware("http")
async def tenant_and_rate_limit_middleware(request: Request, call_next):
    """
    Middleware that:
    1. Extracts JWT auth token if present and sets thread-local user context.
    2. Enforces sliding-window rate limits per IP/user.
    3. Guarantees thread-local cleanup after request execution.
    """
    client_ip = request.client.host if request.client else "unknown"
    auth_hdr = request.headers.get("authorization")
    token = auth.extract_token_from_header(auth_hdr)
    user = None

    if token:
        payload = auth.decode_access_token(token)
        if payload and "sub" in payload:
            user = {
                "id": payload.get("sub"),
                "email": payload.get("email"),
                "tier": payload.get("tier", "free")
            }
            database.set_current_user_id(user["id"])
        else:
            database.set_current_user_id(None)
    else:
        database.set_current_user_id(None)

    # Rate Limiting
    rate_key = f"user:{user['id']}" if user else f"ip:{client_ip}"
    path = request.url.path

    if path in ("/api/auth/login", "/api/auth/register"):
        allowed, retry_after = security.rate_limiter.is_allowed(f"auth:{client_ip}", max_requests=10, window_seconds=900)
    elif request.method in ("POST", "PUT", "DELETE"):
        allowed, retry_after = security.rate_limiter.is_allowed(f"write:{rate_key}", max_requests=60, window_seconds=60)
    else:
        allowed, retry_after = security.rate_limiter.is_allowed(f"read:{rate_key}", max_requests=180, window_seconds=60)

    if not allowed:
        database.set_current_user_id(None)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )

    try:
        response = await call_next(request)
        return response
    finally:
        database.set_current_user_id(None)

# ----------------- AUTHENTICATION & ACCOUNT ENDPOINTS -----------------

@app.post("/api/auth/register", response_model=TokenResponse)
def register_user(req: UserRegisterRequest):
    """Registers a new user account with secure password hashing."""
    email_clean = req.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="A valid email address is required.")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters.")

    existing = database.get_user_by_email(email_clean)
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    tier = "free"
    if req.promo_code:
        is_valid_code, _ = tier_service.validate_vip_promo_code(req.promo_code)
        if is_valid_code:
            tier = "vip_friend"

    pwd_hash = security.hash_password(req.password)
    user = database.create_user_account(email_clean, pwd_hash, tier=tier)
    token = auth.create_access_token({"sub": user["id"], "email": user["email"], "tier": user["tier"]})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user["id"],
        email=user["email"],
        tier=user["tier"]
    )

@app.post("/api/auth/login", response_model=TokenResponse)
def login_user(req: UserLoginRequest):
    """Authenticates a user and returns a 90-day persistent JWT token."""
    email_clean = req.email.strip().lower()
    user = database.get_user_by_email(email_clean)
    if not user or not security.verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = auth.create_access_token({"sub": user["id"], "email": user["email"], "tier": user["tier"]})

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user_id=user["id"],
        email=user["email"],
        tier=user["tier"]
    )

@app.get("/api/auth/me")
async def get_current_user_profile(user: Optional[Dict[str, Any]] = Depends(auth.get_current_user_optional)):
    """Returns profile for currently authenticated user."""
    if not user:
        return {"authenticated": False, "mode": "local", "tier": "local"}
    
    full_user = database.get_user_by_id(user["id"])
    if not full_user:
        raise HTTPException(status_code=404, detail="User record not found.")

    app_count = database.count_user_applications(user["id"])
    db_path = database.get_user_db_path(user["id"])
    db_size = os.path.getsize(db_path) if os.path.exists(db_path) else 0

    return {
        "authenticated": True,
        "user_id": full_user["id"],
        "email": full_user["email"],
        "tier": full_user["tier"],
        "total_applications": app_count,
        "storage_bytes": db_size,
        "limit": 100 if full_user["tier"] == "free" else None
    }

@app.post("/api/auth/redeem-code")
async def redeem_vip_promo_code(req: PromoRedeemRequest, user: Dict[str, Any] = Depends(auth.require_authenticated_user)):
    """Allows users / friends to redeem a VIP promo code for free unlimited access."""
    is_valid, msg = tier_service.validate_vip_promo_code(req.code)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired promo code.")

    database.record_promo_redemption(user["id"], req.code.strip().upper())
    new_token = auth.create_access_token({"sub": user["id"], "email": user["email"], "tier": "vip_friend"})

    return {
        "status": "success",
        "message": f"Promo code redeemed! Upgraded to VIP Friend lifetime tier ({msg}).",
        "new_token": new_token,
        "tier": "vip_friend"
    }

@app.get("/api/auth/quota", response_model=UserQuotaResponse)
async def check_user_quota(user: Optional[Dict[str, Any]] = Depends(auth.get_current_user_optional)):
    """Returns active tier limits, storage usage, and application counts."""
    uid = user["id"] if user else None
    tier = user["tier"] if user else "local"
    app_count = database.count_user_applications(uid)
    db_path = database.get_user_db_path(uid) if uid else database.DB_NAME
    db_size = os.path.getsize(db_path) if os.path.exists(db_path) else 0

    limit = 100 if tier == "free" else None
    storage_limit = security.MAX_USER_DB_SIZE_BYTES if tier == "free" else security.MAX_PREMIUM_DB_SIZE_BYTES
    is_exceeded = bool(limit and app_count >= limit) or (db_size >= storage_limit)

    return UserQuotaResponse(
        tier=tier,
        total_applications=app_count,
        limit=limit,
        storage_bytes=db_size,
        storage_limit_bytes=storage_limit,
        is_quota_exceeded=is_exceeded
    )

# ----------------- TRACKING & APPLICATION ENDPOINTS -----------------

@app.get("/ping")
def ping():
    """Health check endpoint to ensure API is up."""
    return {"status": "ok", "service": "GRTS API", "version": "2.1.0"}

@app.post("/apply", response_model=ApplicationResponse)
async def submit_application(application: ApplicationCreate, user: Optional[Dict[str, Any]] = Depends(auth.get_current_user_optional)):
    """
    Endpoint for Tracker Extension & Dashboard to record applications.
    Enforces quota limits (100 cap for Free tier, storage size caps) and input sanitization.
    """
    try:
        uid = user["id"] if user else None
        db_path = database.get_user_db_path(uid) if uid else database.DB_NAME
        app_count = database.count_user_applications(uid)

        allowed, quota_msg = tier_service.can_user_add_application(user, app_count, db_path)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail=quota_msg
            )

        data = security.sanitize_application_payload(application.model_dump())
        app_id = database.insert_application_data(data)
        
        return ApplicationResponse(
            id=app_id,
            status="success",
            message=f"Application for '{application.job_title}' at '{application.company_name}' recorded."
        )
    except HTTPException:
        raise
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

# -------------------------------------------------------------
# EMAIL AUTO-SCANNER & MATCHING API ENDPOINTS
# -------------------------------------------------------------

@app.get("/api/email/config")
def get_email_configuration():
    """Retrieves saved IMAP email configuration (with password masked)."""
    try:
        cfg = database.get_email_config(mask_password=True)
        return {"status": "success", "data": cfg or {}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/email/config")
def save_email_configuration(config: EmailConfigSchema):
    """Saves or updates the IMAP email configuration."""
    try:
        saved = database.save_email_config(config.model_dump())
        return {"status": "success", "message": "Email configuration saved.", "data": saved}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/email/test")
def test_email_credentials(req: EmailTestRequestSchema):
    """Tests IMAP connection with provided credentials."""
    try:
        password = req.password.strip() if req.password else ""
        if not password or password == "••••••••":
            cfg = database.get_email_config(mask_password=False)
            if cfg and cfg.get("password"):
                password = cfg["password"]

        if not password:
            return {"status": "error", "message": "App Password is required to test the connection. Please enter your 16-character App Password."}

        success, message = email_scanner.test_connection(
            host=req.imap_host,
            port=req.imap_port or 993,
            email_addr=req.email_address.strip(),
            password=password,
            use_ssl=bool(req.use_ssl)
        )
        if success:
            return {"status": "success", "message": message}
        return {"status": "error", "message": message}
    except Exception as e:
        return {"status": "error", "message": f"Connection test failed: {str(e)}"}

@app.post("/api/email/sync")
async def trigger_email_sync(force: bool = False):
    """Triggers an immediate scan and lifecycle matching of the user's inbox."""
    try:
        result = await asyncio.to_thread(email_scanner.scan_and_sync_inbox, force_full_scan=force)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/email/logs")
def get_email_sync_activity_logs(limit: int = Query(50, ge=1, le=200)):
    """Retrieves history of processed emails, classifications, and matched applications."""
    try:
        logs = database.get_email_sync_logs(limit=limit)
        return {"status": "success", "data": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

