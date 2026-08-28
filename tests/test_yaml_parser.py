import sqlite3
import re
import os

SAMPLE_YAML = """
basics:
  name: Jane Doe
  email: jane@example.com
  phone: 555-555-5555
  location: San Francisco, CA
experience:
  - company: TechCorp
    position: Software Engineer
    location: San Francisco, CA
    date: Jun 2024 -- Present
education:
  - institution: Stanford University
    studyType: B.S.
    area: Computer Science
    score: 3.9
    date: 2026
skills:
  - keywords: Python, Go, TypeScript
"""

yaml_text = SAMPLE_YAML
if os.path.exists('backend/grts.db'):
    try:
        conn = sqlite3.connect('backend/grts.db')
        c = conn.cursor()
        row = c.execute('SELECT content FROM resumes WHERE id = 1').fetchone()
        if row and row[0]:
            yaml_text = row[0]
        conn.close()
    except Exception:
        pass

def parse_yaml_resume(text):
    profile = {}
    lines = text.split('\n')
    
    current_section = None
    current_item = None
    
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue
            
        # Top level sections
        if line.endswith(':') and not line.startswith('-') and not line.startswith(' '):
            current_section = line[:-1].lower().strip()
            continue
            
        # Basics section
        if current_section == 'basics':
            if ':' in line:
                k, v = line.split(':', 1)
                k = k.strip().lower()
                v = v.strip().strip("'\"")
                if k == 'name':
                    parts = v.split(' ')
                    profile['first_name'] = parts[0]
                    profile['last_name'] = ' '.join(parts[1:]) if len(parts) > 1 else ''
                elif k == 'email':
                    profile['email'] = v
                elif k == 'phone':
                    profile['phone'] = v
                elif k == 'linkedin':
                    profile['linkedin'] = v if v.startswith('http') else f"https://www.linkedin.com/in/{v}"
                elif k in ['url', 'website', 'portfolio']:
                    profile['portfolio'] = v if v.startswith('http') else f"https://{v}"
                elif k == 'location':
                    loc_parts = [p.strip() for p in v.split(',')]
                    profile['city'] = loc_parts[0]
                    if len(loc_parts) > 1:
                        profile['state'] = loc_parts[1]
                    profile['address'] = v
                elif k == 'summary':
                    profile['summary'] = v
                    
        # Experience section (first job = current/latest)
        elif current_section == 'experience':
            if line.startswith('- company:') or line.startswith('- name:'):
                if 'current_company' not in profile:
                    profile['current_company'] = line.split(':', 1)[1].strip().strip("'\"")
            elif ':' in line and 'current_company' in profile and 'current_title' not in profile:
                k, v = line.split(':', 1)
                k = k.strip().lower()
                v = v.strip().strip("'\"")
                if k in ['position', 'title', 'role']:
                    profile['current_title'] = v
                elif k == 'location' and 'current_location' not in profile:
                    profile['current_location'] = v
                elif k == 'date':
                    # Parse dates like "May 2026 -- August 2026" or "Jun 2025 -- Present"
                    profile['experience_date_str'] = v
                    if 'present' in v.lower():
                        profile['currently_work_here'] = True
                    else:
                        profile['currently_work_here'] = False
            elif line.startswith('- ') and 'highlights' in line or (current_section == 'experience' and 'current_company' in profile and 'experience_description' not in profile and len(line) > 20 and not line.startswith('date:') and not line.startswith('location:')):
                if line.startswith('- '):
                    desc = line[2:].strip().strip("'\"")
                    if len(desc) > 15:
                        profile['experience_description'] = (profile.get('experience_description', '') + ' ' + desc).strip()

        # Education section
        elif current_section == 'education':
            if line.startswith('- institution:') or line.startswith('- school:'):
                inst = line.split(':', 1)[1].strip().strip("'\"")
                # Strip college suffixes like " -- College of Science"
                clean_inst = inst.split('--')[0].strip()
                if 'school' not in profile:
                    profile['school'] = clean_inst
            elif ':' in line:
                k, v = line.split(':', 1)
                k = k.strip().lower()
                v = v.strip().strip("'\"")
                if k in ['studytype', 'degree'] and 'degree' not in profile:
                    if ',' in v:
                        deg_parts = [p.strip() for p in v.split(',')]
                        profile['degree'] = deg_parts[0]
                        profile['discipline'] = deg_parts[1]
                    else:
                        profile['degree'] = v
                elif k in ['area', 'major', 'discipline'] and 'discipline' not in profile:
                    profile['discipline'] = v
                elif k in ['score', 'gpa'] and 'gpa' not in profile:
                    gpa_match = re.search(r'([0-4]\.\d+)', v)
                    profile['gpa'] = gpa_match.group(1) if gpa_match else v
                elif k == 'date':
                    # e.g. "Expected: Dec 2026"
                    year_match = re.search(r'(20\d\d)', v)
                    if year_match:
                        profile['grad_year'] = year_match.group(1)
                        profile['edu_end_date'] = f"{year_match.group(1)}-12"

        # Skills section
        elif current_section == 'skills':
            if 'keywords:' in line:
                kws = line.split('keywords:', 1)[1].strip().strip("'\"")
                if kws:
                    profile['skills'] = (profile.get('skills', '') + ', ' + kws).strip(', ')
                    
    return profile

parsed = parse_yaml_resume(yaml_text)
print("=== PARSED PROFILE FROM USER RESUME ===")
for k, v in parsed.items():
    print(f"  {k}: {v}")
