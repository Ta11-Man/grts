"""
GRTS Scout - Automated Job Discovery Engine
Scrapes target career pages, deduplicates against local SQLite database, 
and outputs findings to a local JSON feed for the Dashboard.
"""
import yaml
import json
import sqlite3
import os
import requests
from datetime import datetime

# Paths relative to script location
DB_PATH = os.path.join("..", "backend", "grts.db")
FEED_PATH = "scout_feed.json"
CONFIG_PATH = "config.yaml"

def load_config():
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)

def load_feed():
    if os.path.exists(FEED_PATH):
        try:
            with open(FEED_PATH, "r") as f:
                return json.load(f)
        except json.JSONDecodeError:
            return []
    return []

def save_feed(feed_data):
    with open(FEED_PATH, "w") as f:
        json.dump(feed_data, f, indent=4)

def db_job_exists(company_name, job_title):
    """Cross-references the SQLite DB to see if the job is already applied to or logged."""
    if not os.path.exists(DB_PATH):
        # Database might not exist yet if Backend hasn't run, handle gracefully
        return False
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT j.id FROM jobs j
        JOIN companies c ON j.company_id = c.id
        WHERE c.name = ? AND j.title = ?
    """, (company_name, job_title))
    row = cursor.fetchone()
    conn.close()
    return row is not None

def parse_with_llm(html_content, url):
    """
    Fallback method using a local LLM (e.g., Ollama).
    Instructions: Requires Ollama running internally (e.g. `ollama run llama3`).
    """
    prompt = f"Extract a JSON array of software engineering internships containing 'Title' and 'Apply_URL' from the following text based on this URL ({url}). Return ONLY valid JSON and nothing else.\n\nText:\n{html_content[:5000]}"
    
    try:
        print(f"[LLM] Parsing {url}...")
        response = requests.post("http://localhost:11434/api/generate", json={
            "model": "llama3",
            "prompt": prompt,
            "stream": False,
            "format": "json" # Local Ollama JSON mode
        }, timeout=30)
        
        if response.ok:
            data = json.loads(response.json()['response'])
            return data # Expected format: [{"Title": "...", "Apply_URL": "..."}]
    except Exception as e:
        print(f"LLM parsing failed: {e}")
    
    return []

def parse_greenhouse(url, company):
    # Stub logic for standard parsing
    print(f"Parsing Greenhouse: {company}")
    return [{"Title": "Software Engineering Intern", "Apply_URL": f"{url}/test/intern"}]
    
def parse_lever(url, company):
    # Stub logic for standard parsing
    print(f"Parsing Lever: {company}")
    return [{"Title": "Frontend Engineer", "Apply_URL": f"{url}/test/frontend"}]

def run_scout():
    print("Starting GRTS Scout...")
    config = load_config()
    feed = load_feed()
    
    new_jobs_found = 0
    
    for target in config.get('targets', []):
        company = target['company']
        url = target['url']
        type_ = target['type']
        
        extracted_jobs = []
        
        if type_ == "greenhouse":
            extracted_jobs = parse_greenhouse(url, company)
        elif type_ == "lever":
            extracted_jobs = parse_lever(url, company)
        elif type_ == "custom":
            print(f"Skipping custom LLM target demo for now: {url}")
            extracted_jobs = []
            
        # Deduplication Process
        for job in extracted_jobs:
            title = job.get('Title')
            apply_url = job.get('Apply_URL')
            
            # 1. Check if it's already in the feed
            already_in_feed = any(f['company'] == company and f['title'] == title for f in feed)
            
            # 2. Check if it's in the DB
            already_in_db = db_job_exists(company, title)
            
            if not already_in_feed and not already_in_db:
                print(f"New Data Found! {company} - {title}")
                feed.insert(0, {
                    "company": company,
                    "title": title,
                    "url": apply_url,
                    "discovered_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                })
                new_jobs_found += 1
                
    if new_jobs_found > 0:
        save_feed(feed)
        print(f"Scout complete. Appended {new_jobs_found} new roles to the feed.")
    else:
        print("Scout complete. No new roles to add.")

if __name__ == "__main__":
    run_scout()
