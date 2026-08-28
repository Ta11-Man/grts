"""
Local IMAP Email Scanner & Intelligent Matching Engine for GRTS.
Connects directly to user IMAP mailboxes (Gmail, Outlook, iCloud, Yahoo, Custom)
via secure SSL, detects Rejections, Online Assessments (OAs), and Interview requests,
extracts deadlines, and automatically updates the SQLite database.
"""
import imaplib
import email
from email.header import decode_header
import re
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, Tuple
import html

import database

# Known ATS Email Domains
ATS_DOMAINS = [
    "greenhouse-mail.io", "greenhouse.io", "ghmail.io",
    "myworkdayjobs.com", "myworkday.com", "workday.com",
    "lever.co", "ashbyhq.com", "smartrecruiters.com",
    "icims.com", "taleo.net", "oraclecloud.com",
    "jobvite.com", "rippling.com", "bamboohr.com",
    "jazz.co", "recruitee.com", "brassring.com",
    "successfactors.com", "adp.com", "eightfold.ai"
]

# OA Assessment Platforms
OA_PLATFORMS = [
    ("HackerRank", ["hackerrank", "hackerrank.com", "hr.gs"]),
    ("CodeSignal", ["codesignal", "codesignal.com"]),
    ("Karat", ["karat", "karat.io", "karat.com"]),
    ("HireVue", ["hirevue", "hirevue.com"]),
    ("Codility", ["codility", "codility.com"]),
    ("Byteboard", ["byteboard", "byteboard.dev"]),
    ("Glider.ai", ["glider.ai", "glider"]),
    ("TestGorilla", ["testgorilla", "testgorilla.com"]),
    ("Mettle", ["mettl", "mettl.com"]),
    ("Pymetrics", ["pymetrics", "pymetrics.com"])
]


def decode_str(header_val: Any) -> str:
    """Decodes MIME encoded headers (e.g. =?utf-8?B?...?=) into a standard string."""
    if not header_val:
        return ""
    try:
        decoded_parts = decode_header(header_val)
        result = []
        for content, encoding in decoded_parts:
            if isinstance(content, bytes):
                enc = encoding or "utf-8"
                try:
                    result.append(content.decode(enc, errors="replace"))
                except Exception:
                    result.append(content.decode("utf-8", errors="replace"))
            else:
                result.append(str(content))
        return "".join(result).strip()
    except Exception:
        return str(header_val).strip()


def extract_email_body(msg: email.message.Message) -> str:
    """Extracts clean plain text content from an email message object."""
    body_text = ""
    html_text = ""

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition", ""))

            if "attachment" in content_disposition:
                continue

            try:
                payload = part.get_payload(decode=True)
                if not payload:
                    continue
                charset = part.get_content_charset() or "utf-8"
                text = payload.decode(charset, errors="replace")

                if content_type == "text/plain":
                    body_text += "\n" + text
                elif content_type == "text/html":
                    html_text += "\n" + text
            except Exception:
                pass
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                text = payload.decode(charset, errors="replace")
                if msg.get_content_type() == "text/html":
                    html_text = text
                else:
                    body_text = text
        except Exception:
            pass

    content = body_text if body_text.strip() else html_text
    # Strip HTML tags if HTML is present
    if "<" in content and ">" in content:
        content = re.sub(r"<style[^>]*>[\s\S]*?</style>", "", content, flags=re.IGNORECASE)
        content = re.sub(r"<script[^>]*>[\s\S]*?</script>", "", content, flags=re.IGNORECASE)
        content = re.sub(r"<br\s*/?>", "\n", content, flags=re.IGNORECASE)
        content = re.sub(r"</p>", "\n\n", content, flags=re.IGNORECASE)
        content = re.sub(r"<[^>]+>", " ", content)
        content = html.unescape(content)

    # Normalize whitespace
    content = re.sub(r"[ \t]+", " ", content)
    content = re.sub(r"\n\s*\n", "\n\n", content)
    return content.strip()


def parse_email_deadline(text: str, reference_date: Optional[datetime] = None) -> Optional[str]:
    """
    Extracts deadline / expiration date from text context (e.g., 'within 7 days', 'by August 28, 2026').
    Returns YYYY-MM-DD string if found.
    """
    ref_dt = reference_date or datetime.now()

    # Pattern 1: "within X days" / "in X days" / "within X business days"
    days_match = re.search(r'\b(?:within|in|have)\s+(\d{1,2})\s+(?:business\s+|calendar\s+)?days\b', text, re.IGNORECASE)
    if days_match:
        days = int(days_match.group(1))
        if 0 < days <= 60:
            target = ref_dt + timedelta(days=days)
            return target.strftime("%Y-%m-%d")

    # Pattern 2: "within X hours" / "in X hours"
    hours_match = re.search(r'\b(?:within|in)\s+(\d{1,3})\s+hours?\b', text, re.IGNORECASE)
    if hours_match:
        hrs = int(hours_match.group(1))
        if 0 < hrs <= 336: # up to 14 days
            target = ref_dt + timedelta(hours=hrs)
            return target.strftime("%Y-%m-%d")

    # Pattern 3: Explicit Date formats like "by August 28, 2026", "by Aug 28th", "before September 5"
    months = r"(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)"
    date_pattern = rf'\b(?:by|before|until|due|deadline(?:\s*is|\s*:)?)\s+({months}\s+\d{{1,2}}(?:st|nd|rd|th)?(?:,?\s+\d{{4}})?)\b'
    match = re.search(date_pattern, text, re.IGNORECASE)
    if match:
        raw_date = match.group(1).replace("st", "").replace("nd", "").replace("rd", "").replace("th", "").replace(",", "")
        parts = raw_date.split()
        if len(parts) >= 2:
            m_str, d_str = parts[0], parts[1]
            y_str = parts[2] if len(parts) >= 3 else str(ref_dt.year)
            for fmt in ("%B %d %Y", "%b %d %Y"):
                try:
                    dt = datetime.strptime(f"{m_str} {d_str} {y_str}", fmt)
                    # If date appears to be in past year, adjust to current/next
                    if dt < ref_dt - timedelta(days=30):
                        dt = dt.replace(year=ref_dt.year)
                    return dt.strftime("%Y-%m-%d")
                except ValueError:
                    pass

    return None


def classify_email(sender: str, subject: str, body: str, date_str: str) -> Optional[Dict[str, Any]]:
    """
    Classifies email as:
    - 'rejection': Job rejection notification
    - 'oa': Online assessment invitation
    - 'interview': Interview / screening invitation
    - None: Unrelated email
    """
    combined = re.sub(r'\s+', ' ', f"{subject} {body}").lower()

    # Exclude obvious non-job marketing / newsletters
    if any(ignore in combined for ignore in [
        "unsubscribe", "view in browser", "privacy policy", "weekly newsletter",
        "order confirmation", "shipping update", "reset your password", "security alert"
    ]) and not any(ats in sender.lower() for ats in ATS_DOMAINS):
        # Double check if it explicitly mentions application status
        if "application" not in combined and "candidacy" not in combined:
            return None

    # 1. REJECTION CLASSIFICATION
    rejection_phrases = [
        "unfortunately",
        "decided to move forward with other candidates",
        "decided to pursue other candidates",
        "decided to pursue other applicants",
        "not moving forward with your application",
        "not moving forward with your candidacy",
        "will not be moving forward",
        "will not be advancing",
        "not selected for this role",
        "not selected for this position",
        "regret to inform you",
        "unable to offer you an interview",
        "unable to move forward",
        "high volume of qualified applicants",
        "high volume of applicants",
        "after careful consideration",
        "decided not to proceed",
        "not proceeding with your application",
        "we have chosen to move forward with",
        "at this time, we have chosen",
        "at this time, we will not",
        "we have decided to go in another direction",
        "position has been filled",
        "decided to close this role"
    ]

    has_rejection_phrase = any(phrase in combined for phrase in rejection_phrases)
    # Ensure it's not a generic application confirmation (e.g. "We received your application, unfortunately wait times...")
    is_mere_confirmation = "thank you for applying" in combined and not has_rejection_phrase

    if has_rejection_phrase and not is_mere_confirmation:
        return {
            "category": "rejection",
            "event_type": "Rejected",
            "event_date": date_str,
            "notes": f"Automated Rejection detected from: '{subject}'"
        }

    # 2. ONLINE ASSESSMENT (OA) CLASSIFICATION
    detected_platform = None
    for platform_name, keywords in OA_PLATFORMS:
        if any(k in combined for k in keywords):
            detected_platform = platform_name
            break

    oa_phrases = [
        "online assessment",
        "coding challenge",
        "technical assessment",
        "assessment invitation",
        "take your assessment",
        "complete your assessment",
        "complete the assessment",
        "assessment is ready",
        "screening assessment",
        "coding assessment",
        "skills assessment",
        "coding test",
        "online test invitation"
    ]

    has_oa_phrase = any(phrase in combined for phrase in oa_phrases)

    if detected_platform or has_oa_phrase:
        # Avoid false positives on test completion confirmations
        if "completed your assessment" in combined or "assessment has been submitted" in combined:
            return None

        deadline = parse_email_deadline(f"{subject} {body}")
        platform_label = detected_platform or "Online Assessment"
        notes = f"OA Invitation ({platform_label}) detected from: '{subject}'"
        if deadline:
            notes += f" | Deadline: {deadline}"

        return {
            "category": "oa",
            "event_type": "Online Assessment (OA)",
            "event_date": date_str,
            "oa_expiration_date": deadline,
            "platform": platform_label,
            "notes": notes
        }

    # 3. INTERVIEW / SCREEN CLASSIFICATION
    interview_phrases = [
        "invitation to interview",
        "schedule your interview",
        "schedule a call",
        "schedule a phone screen",
        "recruiter screen",
        "invitation to speak with",
        "chat with our team",
        "discuss your background",
        "next steps in the interview process",
        "selected for an interview",
        "schedule your technical screen"
    ]

    has_interview_phrase = any(phrase in combined for phrase in interview_phrases)
    scheduling_tool = None
    for tool in ["calendly.com", "goodtime.io", "modernloop.io", "hirevue.com"]:
        if tool in combined:
            scheduling_tool = tool
            break

    if has_interview_phrase or (scheduling_tool and ("interview" in combined or "screen" in combined or "chat" in combined)):
        return {
            "category": "interview",
            "event_type": "Recruiter Screen",
            "event_date": date_str,
            "notes": f"Interview / Screen invitation detected from: '{subject}'"
        }

    return None


def match_email_to_application(sender: str, subject: str, body: str, active_apps: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """
    Matches an incoming email to an existing application record in grts.db.
    Checks:
    1. Direct sender domain vs company website / clean company domain.
    2. ATS sender display name vs company name.
    3. Subject line parsing (e.g. 'Your application to Stripe').
    4. Fuzzy company name occurrences in subject and body.
    """
    if not active_apps:
        return None

    sender_lower = sender.lower()
    subject_lower = subject.lower()

    # Extract sender email address and display name
    sender_name = ""
    sender_email = sender_lower
    name_match = re.match(r'^(.*?)\s*<([^>]+)>', sender)
    if name_match:
        sender_name = name_match.group(1).replace('"', '').replace("'", "").strip().lower()
        sender_email = name_match.group(2).strip().lower()

    sender_domain = sender_email.split('@')[-1] if '@' in sender_email else ""

    # Check 1: Direct Domain Match (e.g. careers@uber.com -> matches uber)
    is_ats = any(ats in sender_domain for ats in ATS_DOMAINS)
    if not is_ats and sender_domain:
        domain_root = sender_domain.split('.')[0]
        for app in active_apps:
            comp = app["company_name"].lower().strip()
            comp_clean = re.sub(r'[^a-z0-9]', '', comp)
            web = (app.get("company_website") or "").lower()
            if comp_clean and comp_clean == domain_root:
                return app
            if web and domain_root in web:
                return app

    # Check 2: Sender Display Name (e.g., "Stripe Careers <no-reply@greenhouse.io>")
    if sender_name:
        for app in active_apps:
            comp = app["company_name"].lower().strip()
            if len(comp) >= 3 and comp in sender_name:
                return app

    # Check 3: Subject line matching (e.g. "Your application to Citadel", "Update from Citadel", "Citadel - Software Engineer")
    for app in active_apps:
        comp = app["company_name"].lower().strip()
        if len(comp) >= 3:
            if re.search(rf'\b{re.escape(comp)}\b', subject_lower):
                return app

    # Check 4: Body header matching (first 500 characters of email body)
    body_snippet = body[:500].lower()
    for app in active_apps:
        comp = app["company_name"].lower().strip()
        if len(comp) >= 4 and re.search(rf'\b{re.escape(comp)}\b', body_snippet):
            return app

    return None


def test_connection(host: str, port: int, email_addr: str, password: str, use_ssl: bool = True) -> Tuple[bool, str]:
    """Tests IMAP connection and credentials without modifying state."""
    try:
        cleaned_password = password.replace(" ", "").strip()
        cleaned_email = email_addr.strip()

        if not cleaned_email or not cleaned_password:
            return False, "Email address and App Password must not be blank."

        if use_ssl:
            client = imaplib.IMAP4_SSL(host, port, timeout=12)
        else:
            client = imaplib.IMAP4(host, port, timeout=12)

        client.login(cleaned_email, cleaned_password)
        status, _ = client.select("INBOX", readonly=True)
        client.logout()

        if status == "OK":
            return True, "Connection and authentication successful. Mailbox is accessible."
        return False, f"Logged in successfully, but inbox selection returned status: {status}"
    except imaplib.IMAP4.error as e:
        err_str = str(e)
        if "AUTHENTICATIONFAILED" in err_str.upper() or "INVALID CREDENTIALS" in err_str.upper():
            return False, f"Authentication failed. Please verify your Email Address and 16-character App Password. (Details: {err_str})"
        return False, f"IMAP authentication failed: {err_str}"
    except TimeoutError:
        return False, f"Connection timed out reaching {host}:{port}. Check your host and port settings."
    except Exception as e:
        return False, f"Connection error ({host}:{port}): {str(e)}"


def scan_and_sync_inbox(force_full_scan: bool = False) -> Dict[str, Any]:
    """
    Main background scanner:
    1. Connects to the user's IMAP inbox.
    2. Fetches emails received since last sync (or last 14 days on first run).
    3. Detects Rejections, OAs, and Interviews.
    4. Matches emails to existing applications and updates grts.db.
    5. Deduplicates messages so each email is processed exactly once.
    """
    cfg = database.get_email_config(mask_password=False)
    if not cfg:
        return {"status": "error", "message": "Email sync is not configured yet."}

    if not cfg.get("auto_sync") and not force_full_scan:
        return {"status": "skipped", "message": "Email auto-sync is paused in settings."}

    host = cfg.get("imap_host", "imap.gmail.com")
    port = int(cfg.get("imap_port", 993))
    email_addr = cfg.get("email_address", "").strip()
    password = (cfg.get("password") or "").replace(" ", "").strip()
    use_ssl = bool(cfg.get("use_ssl", 1))

    if not email_addr or not password:
        return {"status": "error", "message": "Email address or App Password is missing."}

    try:
        if use_ssl:
            client = imaplib.IMAP4_SSL(host, port, timeout=20)
        else:
            client = imaplib.IMAP4(host, port, timeout=20)

        client.login(email_addr, password)
        client.select("INBOX", readonly=True)
    except Exception as e:
        return {"status": "error", "message": f"Failed to connect to IMAP server ({host}): {str(e)}"}

    try:
        # Determine date filter for IMAP query
        lookback_date = datetime.now() - timedelta(days=14)
        if cfg.get("last_synced_at") and not force_full_scan:
            try:
                last_dt = datetime.strptime(cfg["last_synced_at"].split()[0], "%Y-%m-%d")
                lookback_date = max(last_dt - timedelta(days=3), datetime.now() - timedelta(days=60))
            except Exception:
                pass

        date_criteria = lookback_date.strftime("%d-%b-%Y")
        status, data = client.search(None, f'(SINCE "{date_criteria}")')
        if status != "OK" or not data or not data[0]:
            status, data = client.search(None, "ALL")

        msg_ids = data[0].split() if (data and data[0]) else []
        recent_msg_ids = msg_ids[-60:] if len(msg_ids) > 60 else msg_ids

        active_apps = database.get_active_applications_for_matching()

        scanned_count = 0
        processed_count = 0
        matched_count = 0
        events_applied = []

        for m_id in reversed(recent_msg_ids):
            scanned_count += 1
            try:
                res, msg_data = client.fetch(m_id, "(RFC822)")
                if res != "OK" or not msg_data or not msg_data[0]:
                    continue

                raw_email = msg_data[0][1]
                if not isinstance(raw_email, bytes):
                    continue

                msg = email.message_from_bytes(raw_email)

                # Extract Headers
                subject = decode_str(msg.get("Subject", ""))
                sender = decode_str(msg.get("From", ""))
                date_hdr = msg.get("Date", "")
                raw_msg_id = msg.get("Message-ID", "")

                email_date_str = datetime.now().strftime("%Y-%m-%d")
                try:
                    parsed_date = email.utils.parsedate_to_datetime(date_hdr)
                    if parsed_date:
                        email_date_str = parsed_date.strftime("%Y-%m-%d")
                except Exception:
                    pass

                unique_key = raw_msg_id.strip() if raw_msg_id else hashlib.sha256(f"{sender}_{subject}_{date_hdr}".encode()).hexdigest()

                if database.is_email_already_processed(unique_key):
                    continue

                processed_count += 1
                body_content = extract_email_body(msg)

                classification = classify_email(sender, subject, body_content, email_date_str)
                if not classification:
                    database.log_email_sync_event({
                        "message_id": unique_key,
                        "sender": sender,
                        "subject": subject,
                        "email_date": email_date_str,
                        "category": "ignored",
                        "matched_company": None,
                        "matched_application_id": None,
                        "details": {},
                        "status": "ignored"
                    })
                    continue

                category = classification["category"]
                matched_app = match_email_to_application(sender, subject, body_content, active_apps)

                if matched_app:
                    app_id = matched_app["id"]
                    comp_name = matched_app["company_name"]
                    matched_count += 1

                    database.apply_email_match_to_application(app_id, category, classification)

                    database.log_email_sync_event({
                        "message_id": unique_key,
                        "sender": sender,
                        "subject": subject,
                        "email_date": email_date_str,
                        "category": category,
                        "matched_company": comp_name,
                        "matched_application_id": app_id,
                        "details": classification,
                        "status": "applied"
                    })

                    events_applied.append({
                        "company": comp_name,
                        "job_title": matched_app.get("job_title", ""),
                        "category": category,
                        "subject": subject,
                        "notes": classification.get("notes")
                    })
                else:
                    database.log_email_sync_event({
                        "message_id": unique_key,
                        "sender": sender,
                        "subject": subject,
                        "email_date": email_date_str,
                        "category": category,
                        "matched_company": None,
                        "matched_application_id": None,
                        "details": classification,
                        "status": "no_match"
                    })

            except Exception as e:
                print(f"[GRTS Email Scanner] Error processing email {m_id}: {e}")

        database.update_email_last_synced()
        client.logout()

        return {
            "status": "success",
            "scanned": scanned_count,
            "new_emails_checked": processed_count,
            "matched_and_updated": matched_count,
            "events": events_applied,
            "last_synced_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }

    except Exception as e:
        try:
            client.logout()
        except Exception:
            pass
        return {"status": "error", "message": f"Scan failed: {str(e)}"}
