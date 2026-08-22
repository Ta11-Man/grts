"""
Database configuration and access layer for GRTS.
Uses local SQLite for lightweight, persistent storage.
Supports full lifecycle tracking, non-standard Q&A bank, and profile sync.
"""
import sqlite3
import os
import json
import re
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional

DB_NAME = os.path.join(os.path.dirname(__file__), "grts.db")

VALID_US_STATES = {
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA',
    'MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN',
    'TX','UT','VT','VA','WA','WV','WI','WY','DC','PR'
}

def clean_workday_location(raw_loc: Optional[str]) -> Optional[str]:
    """
    Parses messy Workday location dumps containing raw addresses and ST-CITY blocks.
    E.g. 'KY-LOUISVILLE, 3195 TERRA CROSSING BLVD, STE 202, 204 IN-INDIANAPOLIS, 220 VIRGINIA AVE OH-MASON, 4361 IRWIN SIMPSON RD (Hybrid)'
         -> 'Louisville, KY • Indianapolis, IN • Mason, OH (Hybrid)'
    """
    if not raw_loc:
        return raw_loc
    
    st_city_matches = re.findall(r'\b([A-Z]{2})-([A-Za-z\s]+?)(?:,\s*\d|\s+[A-Z]{2}-|\s*\(|$)', raw_loc)
    extracted = []
    for st, city in st_city_matches:
        st_up = st.upper()
        city_clean = city.strip()
        if st_up in VALID_US_STATES and 2 <= len(city_clean) <= 35:
            title_city = ' '.join(w.capitalize() for w in city_clean.split())
            extracted.append(f"{title_city}, {st_up}")
            
    if extracted:
        unique_locs = list(dict.fromkeys(extracted))
        res = " • ".join(unique_locs)
        if re.search(r'\(hybrid\)', raw_loc, re.IGNORECASE):
            res += " (Hybrid)"
        elif re.search(r'\(remote\)', raw_loc, re.IGNORECASE):
            res += " (Remote)"
        elif re.search(r'\(on-?site\)', raw_loc, re.IGNORECASE):
            res += " (On-site)"
        return res
        
    return raw_loc

def get_connection():
    """Returns a Row-based SQLite connection for dictionary-like access."""
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the database schema if it doesn't already exist and runs migrations."""
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Companies
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            website TEXT,
            logo TEXT
        )
    ''')
    
    # 2. Jobs
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            location TEXT,
            description TEXT,
            ats_job_id TEXT,
            ats_platform TEXT,
            job_type TEXT,
            workplace_type TEXT,
            days_in_office INTEGER,
            salary_range TEXT,
            FOREIGN KEY(company_id) REFERENCES companies(id)
        )
    ''')
    
    # 3. Applications
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            date_applied TEXT NOT NULL,
            status TEXT DEFAULT 'Applied',
            notes TEXT,
            resume_version TEXT,
            rejection_date TEXT,
            url TEXT,
            priority INTEGER DEFAULT 3,
            referral_source TEXT,
            archived INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY(job_id) REFERENCES jobs(id)
        )
    ''')
    
    # 4. Timeline Events
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS timeline (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            event_date TEXT NOT NULL,
            notes TEXT,
            round_number INTEGER,
            interviewer_name TEXT,
            interviewer_email TEXT,
            meeting_link TEXT,
            rating INTEGER,
            compensation_offered TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY(application_id) REFERENCES applications(id)
        )
    ''')
    
    # 5. Non-Standard Application Question Responses (Q&A Bank)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS application_responses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            answer_text TEXT NOT NULL,
            field_type TEXT DEFAULT 'text',
            field_name TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY(application_id) REFERENCES applications(id)
        )
    ''')
    
    # 6. User Profile for Autofill Sync
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            data_json TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now', 'localtime'))
        )
    ''')
    
    # 7. Resume Git-Style Versioning Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS resumes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            version_tag TEXT DEFAULT 'v1.0',
            commit_message TEXT,
            parent_id INTEGER,
            pdf_base64 TEXT,
            pdf_file_name TEXT,
            created_at TEXT DEFAULT (datetime('now', 'localtime')),
            updated_at TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY(parent_id) REFERENCES resumes(id)
        )
    ''')

    # Safe Schema Migrations for existing databases
    migrations = [
        ("companies", "website", "TEXT"),
        ("companies", "logo", "TEXT"),
        ("jobs", "description", "TEXT"),
        ("jobs", "ats_job_id", "TEXT"),
        ("jobs", "ats_platform", "TEXT"),
        ("jobs", "job_type", "TEXT"),
        ("jobs", "workplace_type", "TEXT"),
        ("jobs", "days_in_office", "INTEGER"),
        ("jobs", "salary_range", "TEXT"),
        ("applications", "oa_expiration_date", "TEXT"),
        ("applications", "priority", "INTEGER DEFAULT 1"),
        ("applications", "referral_source", "TEXT"),
        ("applications", "archived", "INTEGER DEFAULT 0"),
        ("applications", "created_at", "TEXT"),
        ("applications", "updated_at", "TEXT"),
        ("timeline", "round_number", "INTEGER"),
        ("timeline", "interviewer_name", "TEXT"),
        ("timeline", "interviewer_email", "TEXT"),
        ("timeline", "meeting_link", "TEXT"),
        ("timeline", "rating", "INTEGER"),
        ("timeline", "compensation_offered", "TEXT"),
        ("timeline", "created_at", "TEXT"),
        ("timeline", "sort_order", "INTEGER DEFAULT 0"),
        ("applications", "cover_letter", "TEXT"),
        ("applications", "cover_letter_file_name", "TEXT"),
        ("applications", "links", "TEXT"),
        ("applications", "contacts", "TEXT"),
        ("resumes", "pdf_base64", "TEXT"),
        ("resumes", "pdf_file_name", "TEXT"),
        ("user_profile", "data_json", "TEXT"),
        ("user_profile", "profile_data", "TEXT")
    ]

    for table, col, col_type in migrations:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
        except sqlite3.OperationalError:
            pass

    # Ensure user_profile data_json and profile_data are in sync
    try:
        cursor.execute("UPDATE user_profile SET data_json = profile_data WHERE (data_json IS NULL OR data_json = '') AND profile_data IS NOT NULL")
        cursor.execute("UPDATE user_profile SET profile_data = data_json WHERE (profile_data IS NULL OR profile_data = '') AND data_json IS NOT NULL")
    except Exception:
        pass

    # Security: Purge any password or passcode entries from Question Bank
    cursor.execute("""
        DELETE FROM application_responses 
        WHERE LOWER(question_text) LIKE '%password%' 
           OR LOWER(question_text) LIKE '%passcode%' 
           OR LOWER(COALESCE(field_name, '')) LIKE '%password%'
    """)

    # Backfill default values for newly added columns on existing rows
    cursor.execute("UPDATE applications SET created_at = COALESCE(date_applied, datetime('now', 'localtime')) WHERE created_at IS NULL OR created_at = ''")
    cursor.execute("UPDATE applications SET updated_at = COALESCE(date_applied, datetime('now', 'localtime')) WHERE updated_at IS NULL OR updated_at = ''")
    cursor.execute("UPDATE applications SET priority = 1 WHERE priority IS NULL")
    cursor.execute("UPDATE applications SET archived = 0 WHERE archived IS NULL")
    cursor.execute("UPDATE timeline SET created_at = COALESCE(event_date, datetime('now', 'localtime')) WHERE created_at IS NULL OR created_at = ''")

    # Backfill initial Applied event if missing
    cursor.execute("""
        INSERT INTO timeline (application_id, event_type, event_date, notes)
        SELECT id, 'Applied', date_applied, 'Initial Application'
        FROM applications a
        WHERE NOT EXISTS (SELECT 1 FROM timeline t WHERE t.application_id = a.id)
    """)
    
    conn.commit()
    conn.close()

def insert_application_data(data: Dict[str, Any]) -> int:
    """
    Inserts an application into the database, handling company and job
    creation if they do not exist. Also saves non-standard Q&A responses.
    Returns the application ID.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Get or create company
        company_name = data['company_name'].strip()
        cursor.execute("SELECT id FROM companies WHERE name = ?", (company_name,))
        company_row = cursor.fetchone()
        if company_row:
            company_id = company_row['id']
            if data.get('company_website') or data.get('company_logo'):
                cursor.execute(
                    "UPDATE companies SET website = COALESCE(?, website), logo = COALESCE(?, logo) WHERE id = ?",
                    (data.get('company_website'), data.get('company_logo'), company_id)
                )
        else:
            cursor.execute("INSERT INTO companies (name, website, logo) VALUES (?, ?, ?)", 
                           (company_name, data.get('company_website'), data.get('company_logo')))
            company_id = cursor.lastrowid
            
        # 2. Get or create job under company
        job_title = data['job_title'].strip()
        loc_val = clean_workday_location(data.get('location')) if data.get('location') else None
        cursor.execute(
            "SELECT id FROM jobs WHERE company_id = ? AND title = ?", 
            (company_id, job_title)
        )
        job_row = cursor.fetchone()
        if job_row:
            job_id = job_row['id']
            cursor.execute(
                """UPDATE jobs SET 
                    location = COALESCE(?, location), 
                    description = COALESCE(?, description), 
                    ats_job_id = COALESCE(?, ats_job_id),
                    ats_platform = COALESCE(?, ats_platform),
                    job_type = COALESCE(?, job_type),
                    workplace_type = COALESCE(?, workplace_type),
                    days_in_office = COALESCE(?, days_in_office),
                    salary_range = COALESCE(?, salary_range)
                   WHERE id = ?""",
                (loc_val, data.get('job_description'), data.get('ats_job_id'),
                 data.get('ats_platform'), data.get('job_type'), data.get('workplace_type'),
                 data.get('days_in_office'), data.get('salary_range'), job_id)
            )
        else:
            cursor.execute(
                """INSERT INTO jobs 
                   (company_id, title, location, description, ats_job_id, ats_platform, job_type, workplace_type, days_in_office, salary_range) 
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (company_id, job_title, loc_val, data.get('job_description'), 
                 data.get('ats_job_id'), data.get('ats_platform'), data.get('job_type'), 
                 data.get('workplace_type'), data.get('days_in_office'), data.get('salary_range'))
            )
            job_id = cursor.lastrowid
            
        # 3. Check for existing application for this job (deduplication)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        target_status = data.get('status') or 'Applied'
        date_applied_val = data.get('date_applied') or datetime.now().strftime("%Y-%m-%d")

        cursor.execute(
            "SELECT id, status FROM applications WHERE job_id = ? ORDER BY id DESC LIMIT 1",
            (job_id,)
        )
        existing_app = cursor.fetchone()
        
        if existing_app:
            app_id = existing_app['id']
            # If current app was Saved and incoming is Applied, upgrade status
            update_status = target_status
            if existing_app['status'] == 'Saved' and target_status == 'Applied':
                update_status = 'Applied'
            elif target_status == 'Saved' and existing_app['status'] != 'Saved':
                # Preserve active applied status if already applied
                update_status = existing_app['status']

            cursor.execute(
                """UPDATE applications SET 
                    status = COALESCE(?, status),
                    url = COALESCE(?, url),
                    notes = COALESCE(?, notes),
                    resume_version = COALESCE(?, resume_version),
                    priority = COALESCE(?, priority),
                    referral_source = COALESCE(?, referral_source),
                    oa_expiration_date = COALESCE(?, oa_expiration_date),
                    cover_letter = COALESCE(?, cover_letter),
                    cover_letter_file_name = COALESCE(?, cover_letter_file_name),
                    links = COALESCE(?, links),
                    contacts = COALESCE(?, contacts),
                    updated_at = ?
                   WHERE id = ?""",
                (update_status, data.get('url'), data.get('notes'), data.get('resume_version'),
                 data.get('priority'), data.get('referral_source'), data.get('oa_expiration_date'),
                 data.get('cover_letter'), data.get('cover_letter_file_name'),
                 data.get('links'), data.get('contacts'), now_str, app_id)
            )
        else:
            cursor.execute(
                """INSERT INTO applications 
                    (job_id, date_applied, status, url, notes, resume_version, priority, referral_source, oa_expiration_date, cover_letter, cover_letter_file_name, links, contacts, created_at, updated_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (job_id, date_applied_val, target_status, data.get('url'), 
                 data.get('notes'), data.get('resume_version'), data.get('priority', 3),
                 data.get('referral_source'), data.get('oa_expiration_date'),
                 data.get('cover_letter'), data.get('cover_letter_file_name'),
                 data.get('links'), data.get('contacts'), now_str, now_str)
            )
            app_id = cursor.lastrowid
            
            # Initial timeline event
            event_type = target_status
            event_note = "Job Saved / Bookmarked" if target_status == "Saved" else (data.get('notes') or "Initial Application Submitted")
            cursor.execute(
                """INSERT INTO timeline (application_id, event_type, event_date, notes, created_at) 
                   VALUES (?, ?, ?, ?, ?)""",
                (app_id, event_type, date_applied_val, event_note, now_str)
            )
        
        # 4. Insert custom Q&A responses if provided (avoiding duplicate questions)
        custom_answers = data.get('custom_answers') or []
        for qa in custom_answers:
            q_text = qa['question_text'] if isinstance(qa, dict) else qa.question_text
            a_text = qa['answer_text'] if isinstance(qa, dict) else qa.answer_text
            f_type = (qa.get('field_type') if isinstance(qa, dict) else getattr(qa, 'field_type', 'text')) or 'text'
            f_name = qa.get('field_name') if isinstance(qa, dict) else getattr(qa, 'field_name', None)
            
            if q_text and str(a_text).strip():
                # Check if question already recorded for this application
                cursor.execute(
                    "SELECT id FROM application_responses WHERE application_id = ? AND question_text = ?",
                    (app_id, q_text.strip())
                )
                if not cursor.fetchone():
                    cursor.execute(
                        """INSERT INTO application_responses 
                            (application_id, question_text, answer_text, field_type, field_name, created_at) 
                            VALUES (?, ?, ?, ?, ?, ?)""",
                        (app_id, q_text.strip(), str(a_text).strip(), f_type, f_name, now_str)
                    )
        
        conn.commit()
        return app_id
        
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()

def get_all_applications(include_archived: bool = False, include_saved: bool = False, status: Optional[str] = None, search: Optional[str] = None, sort_by: str = "recency", order: str = "desc"):
    """
    Retrieve all applications with attached Job, Company, Timeline, and Custom Q&A details.
    By default, excludes 'Saved' jobs from the active pipeline unless requested or filtered for.
    Supports flexible sorting by recency, priority (excitement), company, and status.
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        query = '''
            SELECT a.id, a.job_id, c.name as company_name, j.title as job_title, j.location, 
                   a.date_applied, a.status, a.url, a.notes, a.resume_version, a.priority,
                   a.referral_source, a.oa_expiration_date, a.archived, a.created_at, a.updated_at,
                   a.cover_letter, a.cover_letter_file_name, a.links, a.contacts,
                   j.description as job_description, j.ats_job_id, j.ats_platform,
                   j.job_type, j.workplace_type, j.days_in_office, j.salary_range,
                   c.website as company_website, c.logo as company_logo
            FROM applications a
            JOIN jobs j ON a.job_id = j.id
            JOIN companies c ON j.company_id = c.id
            WHERE 1=1
        '''
        params = []
        
        if not include_archived:
            query += " AND (a.archived = 0 OR a.archived IS NULL)"
            
        if status:
            query += " AND a.status = ?"
            params.append(status)
        elif not include_saved:
            query += " AND (a.status != 'Saved' OR a.status IS NULL)"
            
        if search:
            query += " AND (c.name LIKE ? OR j.title LIKE ? OR j.location LIKE ? OR a.notes LIKE ?)"
            term = f"%{search}%"
            params.extend([term, term, term, term])
            
        # Order / Sorting
        if sort_by == "priority":
            query += " ORDER BY a.priority DESC, a.date_applied DESC, a.id DESC"
        elif sort_by == "company":
            query += " ORDER BY c.name ASC, a.date_applied DESC"
        elif sort_by == "status":
            query += " ORDER BY a.status ASC, a.date_applied DESC"
        else: # default recency
            query += " ORDER BY a.date_applied DESC, a.id DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        apps = [dict(row) for row in rows]
        
        if apps:
            app_ids = [app['id'] for app in apps]
            placeholders = ', '.join(['?'] * len(app_ids))
            
            # 1. Fetch Timeline Entries
            cursor.execute(
                f"""SELECT id, application_id, event_type, event_date, notes, 
                           round_number, interviewer_name, interviewer_email, meeting_link, 
                           rating, compensation_offered, created_at 
                    FROM timeline 
                    WHERE application_id IN ({placeholders}) 
                    ORDER BY COALESCE(sort_order, 0) ASC, id ASC""",
                app_ids
            )
            timeline_rows = cursor.fetchall()
            timeline_map = {}
            for trow in timeline_rows:
                aid = trow['application_id']
                if aid not in timeline_map:
                    timeline_map[aid] = []
                timeline_map[aid].append(dict(trow))
            
            # 2. Fetch Custom Q&A Responses
            cursor.execute(
                f"""SELECT id, application_id, question_text, answer_text, field_type, field_name, created_at 
                    FROM application_responses 
                    WHERE application_id IN ({placeholders}) 
                    ORDER BY id ASC""",
                app_ids
            )
            qa_rows = cursor.fetchall()
            qa_map = {}
            for qrow in qa_rows:
                aid = qrow['application_id']
                if aid not in qa_map:
                    qa_map[aid] = []
                qa_map[aid].append(dict(qrow))
                
            for app in apps:
                app['timeline'] = timeline_map.get(app['id'], [])
                app['custom_answers'] = qa_map.get(app['id'], [])
        
        return apps
    finally:
        conn.close()

def get_application_by_id(app_id: int):
    """Fetches a single application by ID with full details."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute('''
            SELECT a.id, a.job_id, c.name as company_name, j.title as job_title, j.location, 
                   a.date_applied, a.status, a.url, a.notes, a.resume_version, a.priority,
                   a.referral_source, a.oa_expiration_date, a.archived, a.created_at, a.updated_at,
                   a.cover_letter, a.cover_letter_file_name, a.links, a.contacts,
                   j.description as job_description, j.ats_job_id, j.ats_platform,
                   j.job_type, j.workplace_type, j.days_in_office, j.salary_range,
                   c.website as company_website, c.logo as company_logo
            FROM applications a
            JOIN jobs j ON a.job_id = j.id
            JOIN companies c ON j.company_id = c.id
            WHERE a.id = ?
        ''', (app_id,))
        row = cursor.fetchone()
        if not row:
            return None
        app = dict(row)
        
        # Timeline
        cursor.execute(
            """SELECT id, application_id, event_type, event_date, notes, 
                      round_number, interviewer_name, interviewer_email, meeting_link, 
                      rating, compensation_offered, sort_order, created_at 
               FROM timeline WHERE application_id = ? ORDER BY COALESCE(sort_order, 0) ASC, id ASC""",
            (app_id,)
        )
        app['timeline'] = [dict(r) for r in cursor.fetchall()]
        
        # Custom Q&A
        cursor.execute(
            """SELECT id, application_id, question_text, answer_text, field_type, field_name, created_at 
               FROM application_responses WHERE application_id = ? ORDER BY id ASC""",
            (app_id,)
        )
        app['custom_answers'] = [dict(r) for r in cursor.fetchall()]
        return app
    finally:
        conn.close()

def update_application(app_id: int, data: Dict[str, Any]) -> bool:
    """Updates fields of an existing application, its job info, and company name."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT a.job_id, j.company_id FROM applications a JOIN jobs j ON a.job_id = j.id WHERE a.id = ?", (app_id,))
        app_row = cursor.fetchone()
        if not app_row:
            return False
        job_id = app_row['job_id']
        company_id = app_row['company_id']
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        app_updates = []
        app_params = []
        
        for key in ['status', 'notes', 'priority', 'resume_version', 'archived', 'referral_source', 'url', 'oa_expiration_date', 'date_applied', 'cover_letter', 'cover_letter_file_name', 'links', 'contacts']:
            if key in data and data[key] is not None:
                app_updates.append(f"{key} = ?")
                app_params.append(data[key])
                
        if app_updates:
            app_updates.append("updated_at = ?")
            app_params.append(now_str)
            app_params.append(app_id)
            cursor.execute(f"UPDATE applications SET {', '.join(app_updates)} WHERE id = ?", app_params)

        job_updates = []
        job_params = []
        for key in ['salary_range', 'workplace_type', 'days_in_office', 'job_type']:
            if key in data and data[key] is not None:
                job_updates.append(f"{key} = ?")
                job_params.append(data[key])
                
        if 'location' in data and data['location'] is not None:
            job_updates.append("location = ?")
            job_params.append(clean_workday_location(data['location']))
                
        # Support description / job_description
        desc_val = data.get('job_description') if 'job_description' in data else data.get('description')
        if desc_val is not None:
            job_updates.append("description = ?")
            job_params.append(desc_val)

        # Support title / job_title
        title_val = data.get('job_title') if 'job_title' in data else data.get('title')
        if title_val is not None:
            job_updates.append("title = ?")
            job_params.append(title_val)
                
        if job_updates:
            job_params.append(job_id)
            cursor.execute(f"UPDATE jobs SET {', '.join(job_updates)} WHERE id = ?", job_params)

        if data.get('company_name'):
            cursor.execute("UPDATE companies SET name = ? WHERE id = ?", (data['company_name'].strip(), company_id))

        # Update company logo / website if provided
        company_updates = []
        company_params = []
        if data.get('company_logo') is not None:
            company_updates.append("logo = ?")
            company_params.append(data['company_logo'])
        if data.get('company_website') is not None:
            company_updates.append("website = ?")
            company_params.append(data['company_website'])
        if company_updates:
            company_params.append(company_id)
            cursor.execute(f"UPDATE companies SET {', '.join(company_updates)} WHERE id = ?", company_params)

        conn.commit()
        return True
    finally:
        conn.close()

def delete_application(app_id: int) -> bool:
    """Deletes an application and its associated timeline events and custom answers."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM timeline WHERE application_id = ?", (app_id,))
        cursor.execute("DELETE FROM application_responses WHERE application_id = ?", (app_id,))
        cursor.execute("DELETE FROM applications WHERE id = ?", (app_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

def insert_timeline_event(app_id: int, data: Dict[str, Any]) -> int:
    """
    Inserts a new event into an application's timeline and updates the primary status.
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute(
            """INSERT INTO timeline 
               (application_id, event_type, event_date, notes, round_number, 
                interviewer_name, interviewer_email, meeting_link, rating, compensation_offered, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (app_id, data['event_type'], data['event_date'], data.get('notes'),
             data.get('round_number'), data.get('interviewer_name'), data.get('interviewer_email'),
             data.get('meeting_link'), data.get('rating'), data.get('compensation_offered'), now_str)
        )
        event_id = cursor.lastrowid
        
        # Update main application status to the latest event_type
        if data.get('event_type') in ('Applied', 'Application Submitted'):
            cursor.execute(
                "UPDATE applications SET status = 'Applied', date_applied = COALESCE(?, date_applied), updated_at = ? WHERE id = ?",
                (data.get('event_date'), now_str, app_id)
            )
        elif data.get('oa_expiration_date'):
            cursor.execute(
                "UPDATE applications SET status = ?, oa_expiration_date = ?, updated_at = ? WHERE id = ?",
                (data['event_type'], data['oa_expiration_date'], now_str, app_id)
            )
        else:
            cursor.execute(
                "UPDATE applications SET status = ?, updated_at = ? WHERE id = ?",
                (data['event_type'], now_str, app_id)
            )
        
        conn.commit()
        return event_id
    finally:
        conn.close()

def update_timeline_event(event_id: int, data: Dict[str, Any]) -> bool:
    """Updates an existing timeline event."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        updates = []
        params = []
        for key in ['event_type', 'event_date', 'notes', 'round_number', 
                    'interviewer_name', 'interviewer_email', 'meeting_link', 'rating', 'compensation_offered']:
            if key in data and data[key] is not None:
                updates.append(f"{key} = ?")
                params.append(data[key])
        if not updates:
            return False
        params.append(event_id)
        cursor.execute(f"UPDATE timeline SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

def delete_timeline_event(event_id: int) -> bool:
    """Deletes a timeline event."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM timeline WHERE id = ?", (event_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

def reorder_timeline_events(app_id: int, ordered_event_ids: List[int]) -> bool:
    """Updates the display sort order for milestones in an application."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        for idx, eid in enumerate(ordered_event_ids):
            cursor.execute("UPDATE timeline SET sort_order = ? WHERE id = ? AND application_id = ?", (idx, eid, app_id))
        conn.commit()
        return True
    finally:
        conn.close()

def get_all_questions(query: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetches all captured question-answer records from the Q&A bank,
    enriched with company and role info.
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        sql = '''
            SELECT ar.id, ar.application_id, ar.question_text, ar.answer_text, ar.field_type, ar.created_at,
                   c.name as company_name, j.title as job_title
            FROM application_responses ar
            JOIN applications a ON ar.application_id = a.id
            JOIN jobs j ON a.job_id = j.id
            JOIN companies c ON j.company_id = c.id
        '''
        params = []
        if query:
            sql += " WHERE ar.question_text LIKE ? OR ar.answer_text LIKE ? OR c.name LIKE ?"
            term = f"%{query}%"
            params.extend([term, term, term])
        sql += " ORDER BY ar.id DESC"
        
        cursor.execute(sql, params)
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

def update_question_answer(qa_id: int, question_text: Optional[str] = None, answer_text: Optional[str] = None) -> bool:
    """Updates question and/or answer text of an existing recorded response."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        updates = []
        params = []
        if question_text is not None:
            updates.append("question_text = ?")
            params.append(question_text.strip())
        if answer_text is not None:
            updates.append("answer_text = ?")
            params.append(answer_text.strip())
        if not updates:
            return True
        params.append(qa_id)
        cursor.execute(f"UPDATE application_responses SET {', '.join(updates)} WHERE id = ?", params)
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

def add_question_answer(app_id: int, question_text: str, answer_text: str, field_type: str = "text") -> int:
    """Adds a new recorded Q&A response to an application."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """INSERT INTO application_responses (application_id, question_text, answer_text, field_type)
               VALUES (?, ?, ?, ?)""",
            (app_id, question_text.strip(), answer_text.strip(), field_type)
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()

def delete_question_answer(qa_id: int) -> bool:
    """Deletes a Q&A record from the question bank."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM application_responses WHERE id = ?", (qa_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

# ----------------- RESUME VERSIONING -----------------

def get_all_resumes() -> List[Dict[str, Any]]:
    """Retrieves all tracked resume versions."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT r.id, r.name, r.content, r.version_tag, r.commit_message, r.parent_id, 
                   r.pdf_file_name, (CASE WHEN r.pdf_base64 IS NOT NULL AND r.pdf_base64 != '' THEN 1 ELSE 0 END) as has_pdf,
                   r.created_at, r.updated_at,
                   p.name as parent_name
            FROM resumes r
            LEFT JOIN resumes p ON r.parent_id = p.id
            ORDER BY r.id DESC
        """)
        return [dict(row) for row in cursor.fetchall()]
    finally:
        conn.close()

def get_resume_by_id(resume_id: int) -> Optional[Dict[str, Any]]:
    """Fetches a single resume version with parent details."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT r.id, r.name, r.content, r.version_tag, r.commit_message, r.parent_id, 
                   r.pdf_base64, r.pdf_file_name,
                   r.created_at, r.updated_at,
                   p.content as parent_content, p.name as parent_name
            FROM resumes r
            LEFT JOIN resumes p ON r.parent_id = p.id
            WHERE r.id = ?
        """, (resume_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    finally:
        conn.close()

def insert_resume_version(data: Dict[str, Any]) -> int:
    """Creates a new resume version."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            INSERT INTO resumes (name, content, version_tag, commit_message, parent_id, pdf_base64, pdf_file_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (data['name'], data['content'], data.get('version_tag', 'v1.0'),
              data.get('commit_message'), data.get('parent_id'),
              data.get('pdf_base64'), data.get('pdf_file_name'), now_str, now_str))
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()

def update_resume_pdf(resume_id: int, pdf_base64: str, pdf_file_name: Optional[str] = None) -> bool:
    """Updates the PDF binary for an existing resume version."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cursor.execute("""
            UPDATE resumes 
            SET pdf_base64 = ?, pdf_file_name = ?, updated_at = ?
            WHERE id = ?
        """, (pdf_base64, pdf_file_name, now_str, resume_id))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

def delete_resume(resume_id: int) -> bool:
    """Deletes a resume version."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM resumes WHERE id = ?", (resume_id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()

# ----------------- USER PROFILE -----------------

def save_user_profile(profile_dict: Dict[str, Any]) -> bool:
    """Saves or updates the user's master autofill profile."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        data_json = json.dumps(profile_dict)
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        try:
            cursor.execute(
                """INSERT INTO user_profile (id, data_json, updated_at) 
                   VALUES (1, ?, ?) 
                   ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at""",
                (data_json, now_str)
            )
        except sqlite3.OperationalError:
            cursor.execute(
                """INSERT INTO user_profile (id, profile_data, updated_at) 
                   VALUES (1, ?, ?) 
                   ON CONFLICT(id) DO UPDATE SET profile_data = excluded.profile_data, updated_at = excluded.updated_at""",
                (data_json, now_str)
            )
        conn.commit()
        return True
    finally:
        conn.close()

def get_user_profile() -> Dict[str, Any]:
    """Retrieves the user's master autofill profile."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        try:
            cursor.execute("SELECT data_json FROM user_profile WHERE id = 1")
            row = cursor.fetchone()
            if row and row['data_json']:
                return json.loads(row['data_json'])
        except sqlite3.OperationalError:
            pass
            
        try:
            cursor.execute("SELECT profile_data FROM user_profile WHERE id = 1")
            row = cursor.fetchone()
            if row and row['profile_data']:
                return json.loads(row['profile_data'])
        except sqlite3.OperationalError:
            pass

        return {}
    finally:
        conn.close()

# ----------------- DETAILED ANALYTICS -----------------

def is_interview_status(status_str: str) -> bool:
    if not status_str:
        return False
    s = status_str.lower().strip()
    # Any status indicating initial, saved, rejected, skipped, expired, ghosted, or offer is NOT active interviewing
    if any(neg in s for neg in ['applied', 'save', 'reject', 'ghost', 'skip', 'expire', 'offer', 'decline']):
        return False
    return True

def get_analytics_stats() -> Dict[str, Any]:
    """
    Computes summary analytics for the dashboard metrics bar and funnel.
    Excludes 'Saved' jobs from the applied pipeline count while tracking saved_count.
    active_pipeline_count accurately excludes rejected, ghosted, skipped/expired OAs, and offer declines.
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # Total Applied applications (non-saved)
        cursor.execute("SELECT COUNT(*) FROM applications WHERE (archived = 0 OR archived IS NULL) AND status != 'Saved'")
        total_applied_all = cursor.fetchone()[0]

        # Total Unique Companies applied to
        cursor.execute("""
            SELECT COUNT(DISTINCT LOWER(TRIM(c.name))) 
            FROM applications a
            JOIN jobs j ON a.job_id = j.id
            JOIN companies c ON j.company_id = c.id
            WHERE (a.archived = 0 OR a.archived IS NULL) 
              AND a.status != 'Saved' 
              AND c.name IS NOT NULL 
              AND TRIM(c.name) != ''
        """)
        unique_companies_count = cursor.fetchone()[0]

        # Active pipeline (open applications still actively in-progress, excluding rejected/ghosted/skipped/expired)
        cursor.execute("""
            SELECT COUNT(*) FROM applications 
            WHERE (archived = 0 OR archived IS NULL) 
              AND status NOT IN ('Saved', 'Rejected', 'Ghosted', 'Skipped / Expired OA', 'Skipped OA', 'Expired OA', 'Offer Declined')
        """)
        active_pipeline_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM applications WHERE status = 'Saved'")
        saved_count = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT status, COUNT(*) as cnt 
            FROM applications 
            WHERE (archived = 0 OR archived IS NULL) AND status != 'Saved'
            GROUP BY status
        """)
        status_counts = {row['status']: row['cnt'] for row in cursor.fetchall()}
        
        applied_count = status_counts.get('Applied', 0)
        rejected_count = status_counts.get('Rejected', 0)
        ghosted_count = status_counts.get('Ghosted', 0)
        skipped_count = status_counts.get('Skipped / Expired OA', 0)
        offer_count = status_counts.get('Offer', 0) + status_counts.get('Offer Received', 0) + status_counts.get('Offer Accepted', 0)

        interview_count = sum(cnt for status, cnt in status_counts.items() if is_interview_status(status))
        
        # Non-rejection responses: Status changed to anything after applying that was not rejected, skipped, or ghosted
        positive_response_count = sum(
            cnt for status, cnt in status_counts.items()
            if not any(neg in status.lower() for neg in ['applied', 'save', 'reject', 'ghost', 'skip', 'expire'])
        )
        
        # Total hearback/response rate (including rejections)
        total_responses = total_applied_all - applied_count
        response_rate = round((total_responses / total_applied_all * 100), 1) if total_applied_all > 0 else 0.0
        
        # Percent of applied roles that received a non-rejection response
        positive_response_percent = round((positive_response_count / total_applied_all * 100), 1) if total_applied_all > 0 else 0.0
        
        offer_rate = round((offer_count / total_applied_all * 100), 1) if total_applied_all > 0 else 0.0
        rejection_rate = round((rejected_count / total_applied_all * 100), 1) if total_applied_all > 0 else 0.0
        
        return {
            "total_applications": total_applied_all,
            "unique_companies_count": unique_companies_count,
            "active_applications": active_pipeline_count,
            "active_pipeline_count": active_pipeline_count,
            "saved_count": saved_count,
            "status_breakdown": status_counts,
            "applied_count": applied_count,
            "interview_count": interview_count,
            "offer_count": offer_count,
            "rejected_count": rejected_count,
            "positive_response_count": positive_response_count,
            "positive_response_percent": positive_response_percent,
            "response_rate_percent": response_rate,
            "offer_rate_percent": offer_rate,
            "rejection_rate_percent": rejection_rate
        }
    finally:
        conn.close()

def normalize_job_title(raw_title: str) -> str:
    """
    Normalizes job titles to canonical categories without over-generalizing distinct disciplines.
    E.g.:
      - 'SWE', 'Software Engineer 2026', 'Software Development Engineer' -> 'Software Engineer'
      - 'Firmware Engineer', 'Embedded Systems Engineer' -> 'Firmware Engineer'
      - 'Cyber Security Engineer', 'Cyber Security Specialist', 'InfoSec Analyst' -> 'Cybersecurity Specialist'
      - 'Operational Intelligence Specialist', 'Operations Research Analyst' -> 'Operational Intelligence Specialist'
      - 'Sales Specialist', 'Sales Engineer', 'Account Executive' -> 'Sales Specialist'
      - 'Business Informatics Intern' -> 'Informatics Intern'
      - Keeps internship distinction ('Software Engineering Intern' vs 'Software Engineer', 'Firmware Intern' vs 'Firmware Engineer')
    """
    if not raw_title:
        return "Software Engineer"
    
    t_clean = raw_title.strip()
    # Strip years (2024, 2025, 2026, 2027, FY26, etc.)
    t_clean = re.sub(r'\b(202\d|FY\d{2})\b', '', t_clean, flags=re.IGNORECASE)
    # Strip requisition/internal tags
    t_clean = re.sub(r'[-–/]?\s*(New\s*College\s*Grad|NCG|Entry\s*Level|University\s*Grad|Grad\s*202\d|Req-?\d+|Job\s*ID:?\s*\d+|Full\s*Time|Part\s*Time|Remote|Hybrid)\b', '', t_clean, flags=re.IGNORECASE)
    t_clean = re.sub(r'[-–/,\(\)]+', ' ', t_clean).strip()
    t_clean = re.sub(r'\s+', ' ', t_clean)

    t_lower = t_clean.lower()
    is_intern = bool(re.search(r'\b(intern|internship|co-?op|student)\b', raw_title, re.IGNORECASE) or re.search(r'\b(intern|internship|co-?op)\b', t_lower))

    # 1. Operational Intelligence / Operations
    if any(k in t_lower for k in ['operational intelligence', 'operations analyst', 'operational analyst', 'operations research', 'business operations', 'bizops', 'revops']):
        return "Operational Intelligence Intern" if is_intern else "Operational Intelligence Specialist"

    # 2. Sales / Business Development
    if any(k in t_lower for k in ['sales specialist', 'sales engineer', 'account executive', 'sdr', 'bdr', 'sales representative', 'sales development', 'inside sales', 'sales associate']):
        return "Sales Intern" if is_intern else "Sales Specialist"

    # 3. Cybersecurity / Information Security
    if any(k in t_lower for k in ['cyber security', 'cybersecurity', 'security engineer', 'security specialist', 'infosec', 'information security', 'soc analyst', 'threat intelligence', 'cloud security', 'appsec']):
        return "Cybersecurity Intern" if is_intern else "Cybersecurity Specialist"

    # 4. Firmware / Embedded Systems
    if any(k in t_lower for k in ['firmware', 'embedded', 'microcontroller', 'mcu', 'rtos', 'low-level', 'board support', 'bsp']):
        return "Firmware Intern" if is_intern else "Firmware Engineer"

    # 5. Hardware / Electrical / Silicon
    if any(k in t_lower for k in ['hardware', 'silicon', 'asic', 'fpga', 'electrical engineer', 'pcb', 'rf engineer', 'vlsi', 'semiconductor']):
        return "Hardware Engineering Intern" if is_intern else "Hardware Engineer"

    # 6. Machine Learning / AI
    if any(k in t_lower for k in ['machine learning', 'deep learning', 'ai engineer', 'mle', 'nlp', 'computer vision', 'generative ai', 'llm']):
        return "Machine Learning Intern" if is_intern else "Machine Learning Engineer"

    # 7. Data Science
    if any(k in t_lower for k in ['data scientist', 'data science', 'applied scientist', 'decision scientist']):
        return "Data Science Intern" if is_intern else "Data Scientist"

    # 8. Data Engineering
    if any(k in t_lower for k in ['data engineer', 'data engineering', 'data infrastructure', 'analytics engineer', 'etl developer']):
        return "Data Engineering Intern" if is_intern else "Data Engineer"

    # 9. Data / Business Intelligence (BI) Analyst
    if any(k in t_lower for k in ['data analyst', 'business intelligence', 'bi analyst', 'business analytics', 'reporting analyst']):
        return "Data / BI Analyst Intern" if is_intern else "Data / BI Analyst"

    # 10. Informatics / Health Tech
    if any(k in t_lower for k in ['informatics', 'health informatics', 'medical informatics', 'bioinformatics', 'clinical informatics']):
        return "Informatics Intern" if is_intern else "Informatics Specialist"

    # 11. DevOps / SRE / Cloud / Infrastructure
    if any(k in t_lower for k in ['devops', 'site reliability', 'sre', 'cloud engineer', 'cloud architect', 'infrastructure engineer', 'platform engineer']):
        return "DevOps / Infrastructure Intern" if is_intern else "DevOps / Infrastructure Engineer"

    # 12. Systems / Distributed Systems
    if any(k in t_lower for k in ['distributed system', 'distributed systems', 'systems software', 'systems engineer', 'kernel developer', 'os engineer']):
        return "Systems Engineering Intern" if is_intern else "Systems Engineer"

    # 13. Frontend Engineering
    if any(k in t_lower for k in ['frontend', 'front-end', 'ui engineer', 'web developer', 'ui/ux developer']):
        return "Frontend Engineering Intern" if is_intern else "Frontend Engineer"

    # 14. Backend Engineering
    if any(k in t_lower for k in ['backend', 'back-end', 'server engineer', 'api developer']):
        return "Backend Engineering Intern" if is_intern else "Backend Engineer"

    # 15. Full Stack Engineering
    if any(k in t_lower for k in ['full stack', 'fullstack', 'full-stack']):
        return "Full Stack Intern" if is_intern else "Full Stack Engineer"

    # 16. QA / Test Automation
    if any(k in t_lower for k in ['qa engineer', 'qa analyst', 'quality assurance', 'sdet', 'test engineer', 'test automation']):
        return "QA / Test Intern" if is_intern else "QA / Test Automation Engineer"

    # 17. Product Management
    if any(k in t_lower for k in ['product manager', 'technical product manager', 'tpm', 'associate product manager', 'apm']):
        return "Product Management Intern" if is_intern else "Product Manager"

    # 18. Program / Project Management
    if any(k in t_lower for k in ['program manager', 'project manager', 'scrum master', 'agile coach']):
        return "Program Management Intern" if is_intern else "Program / Project Manager"

    # 19. Marketing / Growth
    if any(k in t_lower for k in ['marketing', 'growth specialist', 'content specialist', 'seo specialist']):
        return "Marketing Intern" if is_intern else "Marketing Specialist"

    # 20. General Software Engineering / SWE / SDE
    if any(k in t_lower for k in ['swe', 'software engineer', 'software development engineer', 'sde', 'software developer', 'application developer', 'software']):
        return "Software Engineering Intern" if is_intern else "Software Engineer"

    # 21. Custom / Domain Title (Clean Title Case fallback)
    words = [w.capitalize() for w in t_clean.split() if w.lower() not in ['intern', 'internship', 'co-op', 'coop']]
    clean_base = ' '.join(words) if words else "Software Engineer"
    if is_intern:
        return f"{clean_base} Intern" if not clean_base.endswith("Intern") else clean_base
    return clean_base

US_STATE_NAMES_MAP = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
    'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
    'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
    'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
    'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
    'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
    'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
    'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY'
}

def normalize_and_split_locations(raw_loc: str) -> List[str]:
    """
    Cleans Workday 'locations' prefixes, splits multi-location lists by newline/semicolon/pipe,
    normalizes state names to abbreviations, and strips trailing country names.
    E.g. 'locations\nFridley, Minnesota, United States of America\nTempe, Arizona, United States of America'
         -> ['Fridley, MN', 'Tempe, AZ']
    """
    if not raw_loc:
        return ["Remote / Unspecified"]

    cleaned_raw = clean_workday_location(raw_loc.strip())
    loc = cleaned_raw.strip() if cleaned_raw else ""
    prev = None
    while prev != loc:
        prev = loc
        loc = re.sub(r'^(locations?|\d+\s*locations?|posted\s*locations?|[\s,:-])+', '', loc, flags=re.IGNORECASE).strip()
    
    if not loc:
        return ["Remote / Unspecified"]

    # Split on newlines, semicolons, pipes, or bullets
    parts = re.split(r'[\n;|\/•]+', loc)
    cleaned = []
    
    for p in parts:
        item = re.sub(r'^(locations?|\d+\s*locations?|posted\s*locations?|[\s,:-])+', '', p.strip(), flags=re.IGNORECASE).strip()
        item = re.sub(r',\s*(United States of America|United States|USA|US)$', '', item, flags=re.IGNORECASE).strip()
        item = re.sub(r'\s*\((Hybrid|Remote|On-?site)\)$', '', item, flags=re.IGNORECASE).strip()
        if not item:
            continue
        
        # Check for multiple comma-separated city, ST pairs: e.g. "Austin, TX, San Jose, CA"
        comma_tokens = [c.strip() for c in item.split(',') if c.strip()]
        if len(comma_tokens) >= 4 and len(comma_tokens) % 2 == 0:
            for i in range(0, len(comma_tokens), 2):
                c_city = comma_tokens[i]
                c_state = comma_tokens[i+1]
                if c_state.upper() in US_STATE_NAMES_MAP:
                    c_state = US_STATE_NAMES_MAP[c_state.upper()]
                cleaned.append(f"{c_city}, {c_state}")
        else:
            if re.search(r'\bremote\b', item, re.IGNORECASE):
                cleaned.append("Remote")
            else:
                tokens = [t.strip() for t in item.split(',')]
                if len(tokens) >= 2:
                    state_cand = tokens[-1].upper()
                    if state_cand in US_STATE_NAMES_MAP:
                        tokens[-1] = US_STATE_NAMES_MAP[state_cand]
                        item = ', '.join(tokens)
                cleaned.append(item)

    return cleaned if cleaned else [loc]

def get_detailed_analytics() -> Dict[str, Any]:
    """
    Computes comprehensive analytics:
    - Activity timeline range chart with time on X-axis (applied top, rejected bottom, open active in middle)
    - ATS platform distribution
    - Excitement / priority distribution
    - Location breakdown with split multi-locations and normalized names
    - Generalized top titles and response rates
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        # 1. Activity Timeline (Chronological X-Axis from earliest to latest)
        cursor.execute("""
            SELECT date_applied as date, COUNT(*) as applied_count
            FROM applications
            WHERE date_applied IS NOT NULL AND date_applied != '' AND status != 'Saved'
            GROUP BY date_applied
            ORDER BY date_applied ASC
        """)
        applied_by_date = {row['date']: row['applied_count'] for row in cursor.fetchall()}

        cursor.execute("""
            SELECT t.event_date as date, COUNT(*) as rejected_count
            FROM timeline t
            JOIN applications a ON t.application_id = a.id
            WHERE t.event_type IN ('Rejected', 'Ghosted', 'Skipped / Expired OA') 
              AND t.event_date IS NOT NULL 
              AND a.status != 'Saved'
            GROUP BY t.event_date
            ORDER BY t.event_date ASC
        """)
        rejected_by_date = {row['date']: row['rejected_count'] for row in cursor.fetchall()}

        all_raw_dates = sorted(set(list(applied_by_date.keys()) + list(rejected_by_date.keys())))
        
        # Calculate open active applications range over a continuous day-by-day time sequence
        cumulative_applied = 0
        cumulative_rejected = 0
        activity_timeline = []
        
        if all_raw_dates:
            try:
                min_d = datetime.strptime(all_raw_dates[0], "%Y-%m-%d")
                # Expand up to today so inactive gap between last application and today is visible
                today_d = datetime.now()
                latest_event_d = datetime.strptime(all_raw_dates[-1], "%Y-%m-%d")
                max_d = max(latest_event_d, datetime(today_d.year, today_d.month, today_d.day))
                
                cur_d = min_d
                while cur_d <= max_d:
                    d_str = cur_d.strftime("%Y-%m-%d")
                    app_cnt = applied_by_date.get(d_str, 0)
                    rej_cnt = rejected_by_date.get(d_str, 0)
                    cumulative_applied += app_cnt
                    cumulative_rejected += rej_cnt
                    open_active = max(0, cumulative_applied - cumulative_rejected)
                    
                    activity_timeline.append({
                        "date": d_str,
                        "applied": app_cnt,
                        "rejected": rej_cnt,
                        "open_active": open_active,
                        "cumulative_applied": cumulative_applied,
                        "cumulative_rejected": cumulative_rejected
                    })
                    cur_d += timedelta(days=1)
            except Exception:
                # Fallback to sparse if parsing error
                for d in all_raw_dates:
                    app_cnt = applied_by_date.get(d, 0)
                    rej_cnt = rejected_by_date.get(d, 0)
                    cumulative_applied += app_cnt
                    cumulative_rejected += rej_cnt
                    activity_timeline.append({
                        "date": d,
                        "applied": app_cnt,
                        "rejected": rej_cnt,
                        "open_active": max(0, cumulative_applied - cumulative_rejected),
                        "cumulative_applied": cumulative_applied,
                        "cumulative_rejected": cumulative_rejected
                    })

        # 2. ATS Platform Breakdown
        cursor.execute("""
            SELECT COALESCE(NULLIF(j.ats_platform, ''), 'custom') as platform, COUNT(*) as count
            FROM applications a
            JOIN jobs j ON a.job_id = j.id
            WHERE a.status != 'Saved'
            GROUP BY platform
            ORDER BY count DESC
        """)
        ats_breakdown = [dict(row) for row in cursor.fetchall()]

        # 3. Excitement / Priority Breakdown
        cursor.execute("""
            SELECT COALESCE(priority, 1) as priority, COUNT(*) as count
            FROM applications
            WHERE status != 'Saved'
            GROUP BY priority
            ORDER BY priority DESC
        """)
        priority_breakdown = [dict(row) for row in cursor.fetchall()]

        # 4. Location Breakdown (Splitting multi-locations and normalizing)
        cursor.execute("""
            SELECT j.location
            FROM applications a
            JOIN jobs j ON a.job_id = j.id
            WHERE j.location IS NOT NULL AND j.location != '' AND a.status != 'Saved'
        """)
        loc_rows = cursor.fetchall()
        loc_counts = {}
        for r in loc_rows:
            split_locs = normalize_and_split_locations(r['location'])
            for l in split_locs:
                loc_counts[l] = loc_counts.get(l, 0) + 1

        location_breakdown = [
            {"location": loc_name, "count": cnt}
            for loc_name, cnt in sorted(loc_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]
        if not location_breakdown:
            location_breakdown = [{"location": "Remote / Unspecified", "count": len(loc_rows)}]

        # 5. Normalized Titles & Granular Response / Interview Rates
        cursor.execute("""
            SELECT j.title, j.job_type, a.status
            FROM applications a
            JOIN jobs j ON a.job_id = j.id
            WHERE a.status != 'Saved' AND (a.archived = 0 OR a.archived IS NULL)
        """)
        raw_rows = cursor.fetchall()
        
        grouped_titles = {}
        intern_stats = {"total": 0, "active_pipeline": 0, "positive_responses": 0, "interviews": 0, "offers": 0, "rejections": 0}
        fulltime_stats = {"total": 0, "active_pipeline": 0, "positive_responses": 0, "interviews": 0, "offers": 0, "rejections": 0}

        for r in raw_rows:
            raw_title = r['title'] or ''
            raw_job_type = r['job_type'] or ''
            status = r['status'] or 'Applied'
            norm = normalize_job_title(raw_title)

            # Intern classification
            is_intern = bool(
                re.search(r'\b(intern|internship|co-?op|student)\b', raw_title, re.IGNORECASE) or 
                'intern' in raw_job_type.lower()
            )

            target_type_stats = intern_stats if is_intern else fulltime_stats
            target_type_stats["total"] += 1

            if norm not in grouped_titles:
                grouped_titles[norm] = {
                    "total": 0,
                    "positive_responses": 0,
                    "interviews": 0,
                    "offers": 0,
                    "rejections": 0
                }
            grouped_titles[norm]["total"] += 1

            # Positive response = reached any milestone beyond initial applied that is not a terminal rejection/ghost/skipped
            is_positive = status not in ('Applied', 'Saved', 'Rejected', 'Ghosted', 'Skipped / Expired OA', 'Skipped OA', 'Expired OA')
            if is_positive:
                grouped_titles[norm]["positive_responses"] += 1
                target_type_stats["positive_responses"] += 1

            # Interviews = active interview or assessment rounds
            if is_interview_status(status):
                grouped_titles[norm]["interviews"] += 1
                target_type_stats["interviews"] += 1

            # Offers
            if status in ('Offer', 'Offer Received', 'Offer Accepted'):
                grouped_titles[norm]["offers"] += 1
                target_type_stats["offers"] += 1

            # Rejections & Active Pipeline
            if status in ('Rejected', 'Ghosted', 'Skipped / Expired OA', 'Skipped OA', 'Expired OA', 'Offer Declined'):
                grouped_titles[norm]["rejections"] += 1
                target_type_stats["rejections"] += 1
            else:
                target_type_stats["active_pipeline"] += 1

        title_stats = []
        for norm_title, stat in sorted(grouped_titles.items(), key=lambda x: (x[1]['interviews'], x[1]['positive_responses'], x[1]['total']), reverse=True)[:15]:
            tot = stat['total']
            pos_resp = stat['positive_responses']
            ints = stat['interviews']
            offs = stat['offers']
            title_stats.append({
                "title": norm_title,
                "total": tot,
                "positive_responses": pos_resp,
                "interviews": ints,
                "offers": offs,
                "positive_response_rate": round((pos_resp / tot * 100), 1) if tot > 0 else 0.0,
                "interview_rate": round((ints / tot * 100), 1) if tot > 0 else 0.0,
                "offer_rate": round((offs / tot * 100), 1) if tot > 0 else 0.0
            })

        def finalize_type_stats(st):
            tot = st["total"]
            return {
                **st,
                "positive_response_rate": round((st["positive_responses"] / tot * 100), 1) if tot > 0 else 0.0,
                "interview_rate": round((st["interviews"] / tot * 100), 1) if tot > 0 else 0.0,
                "offer_rate": round((st["offers"] / tot * 100), 1) if tot > 0 else 0.0,
                "rejection_rate": round((st["rejections"] / tot * 100), 1) if tot > 0 else 0.0
            }

        intern_vs_fulltime = {
            "internship": finalize_type_stats(intern_stats),
            "fulltime": finalize_type_stats(fulltime_stats)
        }

        return {
            "activity_timeline": activity_timeline,
            "ats_breakdown": ats_breakdown,
            "priority_breakdown": priority_breakdown,
            "location_breakdown": location_breakdown,
            "title_stats": title_stats,
            "intern_vs_fulltime": intern_vs_fulltime
        }
    finally:
        conn.close()
