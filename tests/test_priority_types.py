from bs4 import BeautifulSoup
import re

with open("tests/workday/Systems Software Engineer - New College Grad 2026.htm", "r", encoding="utf-8", errors="ignore") as f:
    soup = BeautifulSoup(f.read(), "html.parser")

def get_field_type(id_attr, name_attr, auto_id_attr, label):
    combined = f'{id_attr} {name_attr} {auto_id_attr} {label}'.lower()
    
    # 0. Website / URL / Portfolio (TOP PRIORITY)
    if id_attr.startswith('websites-') or 'website' in auto_id_attr or 'website' in id_attr or 'website' in name_attr or 'portfolio' in auto_id_attr or 'formfield-url' in auto_id_attr or bool(re.search(r'\b(portfolio|website|personal\s*site|web\s*address|url)\b', combined)):
        if 'linkedin' in combined:
            return 'linkedin'
        if 'github' in combined:
            return 'github'
        return 'portfolio'
        
    if 'addresssection_city' in auto_id_attr or id_attr == 'city' or name_attr == 'city' or bool(re.search(r'\b(city|town|municipality)\b', combined)):
        return 'city'
        
    if 'location' in id_attr or 'location' in name_attr or 'location' in auto_id_attr:
        if 'workexperience' in id_attr or 'experience' in id_attr:
            return 'current_location'
        return 'general_location'
        
    if 'schoolname' in auto_id_attr or 'school' in id_attr:
        return 'school'
    if 'fieldofstudy' in auto_id_attr or 'fieldofstudy' in id_attr:
        return 'discipline'
    if 'gradeaverage' in auto_id_attr or 'gradeaverage' in id_attr:
        return 'gpa'
    if 'skill' in auto_id_attr or 'skill' in id_attr:
        return 'skills'
    if 'jobtitle' in id_attr or 'jobtitle' in name_attr:
        return 'current_title'
    if 'companyname' in id_attr or 'companyname' in name_attr:
        return 'current_company'
        
    return 'custom'

for inp in soup.find_all(['input', 'textarea']):
    id_attr = inp.get('id', '')
    name_attr = inp.get('name', '')
    auto_id = inp.get('data-automation-id', '')
    res = get_field_type(id_attr, name_attr, auto_id, '')
    print(f"id={id_attr!r} -> TYPE: {res}")

print("\nSimulated Websites Row 0 & 1:")
print("websites-0--url ->", get_field_type("websites-0--url", "websiteUrl", "website-url", "Websites URL*"))
print("websites-1--url ->", get_field_type("websites-1--url", "websiteUrl", "website-url", "Websites URL*"))
