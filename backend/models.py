"""
Pydantic models for the GRTS Backend API.
Defines schemas for incoming tracking requests, lifecycle milestones,
user profiles, non-standard Q&A bank, and Resume Git-style versioning.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class QuestionAnswerItem(BaseModel):
    question_text: str
    answer_text: str
    field_type: Optional[str] = "text"
    field_name: Optional[str] = None

class QuestionAnswerUpdate(BaseModel):
    question_text: Optional[str] = None
    answer_text: Optional[str] = None

class ApplicationCreate(BaseModel):
    company_name: str
    job_title: str
    location: Optional[str] = None
    date_applied: Optional[str] = None
    status: Optional[str] = "Applied"     # "Applied" or "Saved"
    url: Optional[str] = None
    notes: Optional[str] = None
    resume_version: Optional[str] = None
    job_description: Optional[str] = None
    company_website: Optional[str] = None
    company_logo: Optional[str] = None
    ats_job_id: Optional[str] = None
    ats_platform: Optional[str] = None
    salary_range: Optional[str] = None
    workplace_type: Optional[str] = None  # e.g., Remote, Hybrid, On-site
    days_in_office: Optional[int] = None  # e.g., 0 for remote, 2-3 for hybrid, 5 for onsite
    job_type: Optional[str] = None        # e.g., Full-time, Internship, Contract
    oa_expiration_date: Optional[str] = None # e.g., "2026-08-25"
    priority: Optional[int] = 1           # Default 1 (Low Priority) to 5 (Dream Job)
    cover_letter: Optional[str] = None
    cover_letter_file_name: Optional[str] = None
    links: Optional[str] = None
    contacts: Optional[str] = None
    custom_answers: Optional[List[QuestionAnswerItem]] = None

class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    priority: Optional[int] = None
    resume_version: Optional[str] = None
    salary_range: Optional[str] = None
    workplace_type: Optional[str] = None
    days_in_office: Optional[int] = None
    job_type: Optional[str] = None
    oa_expiration_date: Optional[str] = None
    archived: Optional[int] = None
    location: Optional[str] = None
    job_description: Optional[str] = None
    description: Optional[str] = None
    job_title: Optional[str] = None
    company_name: Optional[str] = None
    company_logo: Optional[str] = None
    company_website: Optional[str] = None
    url: Optional[str] = None
    date_applied: Optional[str] = None
    cover_letter: Optional[str] = None
    cover_letter_file_name: Optional[str] = None
    links: Optional[str] = None
    contacts: Optional[str] = None

class ApplicationResponse(BaseModel):
    id: int
    status: str
    message: str

class TimelineEventCreate(BaseModel):
    event_type: str                       # e.g., Online Assessment (OA), Recruiter Screen, Technical Interview, System Design, Final Round, Offer, Rejected, Skipped OA
    event_date: str
    oa_expiration_date: Optional[str] = None
    notes: Optional[str] = None
    round_number: Optional[int] = None
    interviewer_name: Optional[str] = None
    interviewer_email: Optional[str] = None
    meeting_link: Optional[str] = None
    rating: Optional[int] = None          # 1 to 5 performance/feel rating
    compensation_offered: Optional[str] = None

class TimelineEventUpdate(BaseModel):
    event_type: Optional[str] = None
    event_date: Optional[str] = None
    notes: Optional[str] = None
    round_number: Optional[int] = None
    interviewer_name: Optional[str] = None
    interviewer_email: Optional[str] = None
    meeting_link: Optional[str] = None
    rating: Optional[int] = None
    compensation_offered: Optional[str] = None

class ResumeVersionCreate(BaseModel):
    name: str                             # e.g., "Master Backend Resume", "Robotics Tailored"
    content: Optional[str] = ""           # Optional plain text / notes (YAML is not required)
    version_tag: Optional[str] = "v1.0"   # e.g., "v1.0", "v1.1", "Apex-Tailored"
    commit_message: Optional[str] = None  # e.g., "Highlighted distributed systems & Go experience"
    parent_id: Optional[int] = None       # ID of parent resume for version tree
    pdf_base64: Optional[str] = None      # Base64 encoded PDF / DOCX for automated portal upload
    pdf_file_name: Optional[str] = None   # e.g., "resume-2026.pdf"

class ResumePdfUpdate(BaseModel):
    pdf_base64: str
    pdf_file_name: Optional[str] = None

class UserProfileSchema(BaseModel):
    first_name: Optional[str] = ""
    last_name: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    phone_device_type: Optional[str] = "Mobile"
    how_heard: Optional[str] = "LinkedIn"
    address: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    postal_code: Optional[str] = ""
    country: Optional[str] = "United States"
    linkedin: Optional[str] = ""
    github: Optional[str] = ""
    portfolio: Optional[str] = ""
    twitter: Optional[str] = ""
    work_authorized_us: Optional[str] = "Yes" # Yes / No
    require_sponsorship: Optional[str] = "No"  # Yes / No
    future_sponsorship: Optional[str] = "No"   # Yes / No
    student_visa: Optional[str] = "No"
    require_cpt_opt: Optional[str] = "No"
    previous_worker: Optional[str] = "No"
    scholarship_recipient: Optional[str] = "No"
    
    # Ordered Multi-Entry Collections
    experience_list: Optional[List[Dict[str, Any]]] = None
    education_list: Optional[List[Dict[str, Any]]] = None
    
    # Scalar / Legacy Compatibility Fields
    current_company: Optional[str] = ""
    current_title: Optional[str] = ""
    current_location: Optional[str] = ""
    experience_description: Optional[str] = ""
    school: Optional[str] = ""
    degree: Optional[str] = ""
    discipline: Optional[str] = ""
    edu_start_year: Optional[str] = "2023"
    grad_year: Optional[str] = "2026"
    gpa: Optional[str] = ""
    skills: Optional[str] = ""
    gender: Optional[str] = "Decline to Self-Identify"
    veteran_status: Optional[str] = "I am not a protected veteran"
    disability_status: Optional[str] = "No, I do not have a disability and have not had one in the past"
    race_ethnicity: Optional[str] = "Decline to Self-Identify"
    notice_period: Optional[str] = "Immediate / 2 Weeks"
    desired_salary: Optional[str] = ""
    cover_letter_default: Optional[str] = ""
    autofill_enabled: Optional[bool] = False
    custom_fields: Optional[Dict[str, Any]] = None
