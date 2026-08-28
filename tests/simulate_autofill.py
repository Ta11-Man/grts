from bs4 import BeautifulSoup
import re

with open("tests/workday/Systems Software Engineer - New College Grad 2026.htm", "r", encoding="utf-8", errors="ignore") as f:
    soup = BeautifulSoup(f.read(), "html.parser")

def get_field_label(el):
    # Check parent label, fieldset, or preceding label
    parent = el.find_parent(['fieldset', 'div'])
    lbl = parent.find(['label', 'legend']) if parent else None
    if lbl:
        return lbl.get_text(strip=True)
    if el.get('aria-label'):
        return el.get('aria-label')
    return ''

for el in soup.find_all(['input', 'select', 'textarea']):
    if el.get('type') in ['hidden', 'submit', 'file']:
        continue
    
    auto_id = el.get('data-automation-id', '').lower()
    name = el.get('name', '').lower()
    id_attr = el.get('id', '').lower()
    autocomplete = el.get('autocomplete', '').lower()
    label = get_field_label(el).lower()
    
    combined = f'{id_attr} {name} {auto_id} {label}'
    
    # Simulate getFieldType rules
    ft = 'custom'
    if auto_id.includes('phone-device-type') if hasattr(auto_id, 'includes') else 'phone-device-type' in auto_id or 'phonetype' in auto_id:
        ft = 'phone_device_type'
    elif 'extension' in auto_id or 'extension' in name or 'extension' in id_attr:
        ft = 'phone_extension'
    elif el.get('type') == 'tel' or 'phone-number' in auto_id or 'phonenumber' in auto_id or id_attr == 'phone' or name == 'phone':
        ft = 'phone'
    elif 'addresssection_addressline1' in auto_id or 'addressline1' in auto_id or id_attr == 'addr':
        ft = 'address'
    elif 'addresssection_city' in auto_id or id_attr == 'city' or name == 'city' or bool(re.search(r'\b(city|town|municipality)\b', combined)):
        ft = 'city'
    elif 'addresssection_countryregion' in auto_id or 'countryregion' in auto_id or id_attr == 'state' or name == 'state':
        ft = 'state'
    elif 'addresssection_postalcode' in auto_id or 'postalcode' in auto_id or id_attr == 'postal' or id_attr == 'zip':
        ft = 'postal_code'
    elif 'location' in id_attr or 'location' in name or 'location' in auto_id:
        if 'workexperience' in id_attr or 'experience' in id_attr:
            ft = 'current_location'
        else:
            ft = 'general_location'
    elif 'linkedin' in auto_id or 'linkedin' in name or 'linkedin' in id_attr or 'linkedin' in combined:
        ft = 'linkedin'
    elif 'github' in auto_id or 'github' in name or 'github' in id_attr or 'github' in combined:
        ft = 'github'
    elif 'website' in auto_id or 'website' in id_attr or 'website' in name or 'portfolio' in auto_id or bool(re.search(r'\b(portfolio|website|personal\s*site|url)\b', combined)):
        ft = 'portfolio'
    elif 'skill' in auto_id or 'skill' in name or 'skill' in id_attr:
        ft = 'skills'
    elif 'schoolname' in auto_id or 'school' in id_attr or 'school' in name or 'institution' in auto_id:
        ft = 'school'
    elif 'degree' in auto_id or 'degree' in id_attr or 'degree' in name:
        ft = 'degree'
    elif 'fieldofstudy' in auto_id or 'fieldofstudy' in id_attr or 'discipline' in auto_id:
        ft = 'discipline'
    elif 'gradeaverage' in auto_id or 'gpa' in id_attr or 'gradeaverage' in id_attr:
        ft = 'gpa'
    elif 'jobtitle' in id_attr or 'jobtitle' in name:
        ft = 'current_title'
    elif 'companyname' in id_attr or 'companyname' in name:
        ft = 'current_company'
    elif 'currentlyworkhere' in id_attr or 'currentlyworkhere' in name:
        ft = 'currently_work_here'
    elif 'roledescription' in id_attr or 'roledescription' in name:
        ft = 'experience_description'
        
    print(f"Tag: {el.name}, id={id_attr!r}, label={label!r} -> MATCHED: {ft}")
