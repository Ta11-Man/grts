import bs4

with open('tests/workday/Systems Software Engineer - New College Grad 2026.htm', 'r', encoding='utf-8') as f:
    soup = bs4.BeautifulSoup(f.read(), 'html.parser')

def get_field_type(el):
    name = (el.get('name') or '').lower()
    elem_id = (el.get('id') or '').lower()
    auto_id = (el.get('data-automation-id') or '').lower()
    lbl = el.find_previous('label')
    lbl_text = (lbl.get_text(strip=True) if lbl else '').lower()
    combined = f"{name} {elem_id} {auto_id} {lbl_text}"

    if 'linkedin' in combined: return 'linkedin'
    if 'github' in combined: return 'github'
    if any(k in combined for k in ['website', 'portfolio', 'urls[portfolio]']) and 'beecatcher' not in auto_id and 'linkedin' not in combined and 'github' not in combined:
        return 'portfolio'
    if 'skills' in combined or 'skill' in auto_id: return 'skills'
    if 'currentlyworkhere' in auto_id or 'currentlyworkhere' in elem_id: return 'currently_work_here'
    if 'jobtitle' in auto_id or 'jobtitle' in elem_id or 'jobtitle' in name: return 'current_title'
    if 'company' in auto_id or 'company' in elem_id or 'company' in name: return 'current_company'
    if 'roledescription' in auto_id or 'roledescription' in elem_id: return 'experience_description'
    if 'school' in auto_id or 'school' in elem_id or 'school' in name: return 'school'
    if 'degree' in auto_id or 'degree' in elem_id or 'degree' in name: return 'degree'
    if 'gradeaverage' in auto_id or 'gradeaverage' in elem_id or 'gradeaverage' in name or 'gpa' in combined: return 'gpa'
    if 'fieldofstudy' in auto_id or 'fieldofstudy' in elem_id: return 'discipline'
    if 'location' in elem_id or 'location' in name: return 'current_location'
    return 'unknown: ' + combined

print("=== FIELD CLASSIFICATIONS ===")
for inp in soup.find_all(['input', 'textarea', 'button', 'select']):
    if inp.name in ['input', 'textarea', 'select'] or (inp.name == 'button' and 'degree' in (inp.get('id') or '')):
        ftype = get_field_type(inp)
        print(f"[{inp.name}] id='{inp.get('id')}' name='{inp.get('name')}' -> {ftype}")
