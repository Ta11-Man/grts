"""
Build script to assemble extension/dashboard.html from modular component partials in extension/dashboard/partials/.
Manages header, views, modals, and detail drawer overlays seamlessly.
"""
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DASHBOARD_HTML = os.path.join(BASE_DIR, "extension", "dashboard.html")
PARTIALS_DIR = os.path.join(BASE_DIR, "extension", "dashboard", "partials")

os.makedirs(PARTIALS_DIR, exist_ok=True)

def write_partial(name, content):
    p = os.path.join(PARTIALS_DIR, name)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content.strip() + "\n")
    print(f"Saved partial: {name} ({len(content.splitlines())} lines)")

def create_default_partials():
    # 1. header.html
    write_partial("header.html", """<!-- TOP BRANDING & NAVIGATION HEADER -->
<div class="header">
  <div class="brand">
    <img src="grts-logo.svg" class="logo" alt="GRTS Logo" />
    <div>
      <h1>GRTS <span>Workspace</span></h1>
      <div style="font-size: 0.82rem; color: var(--text-muted); font-weight: 500;">
        Reverse Tracking System, Pipeline Analytics, Resume Git & Autofill Engine
      </div>
    </div>
  </div>
  <div class="header-actions">
    <button class="btn-primary-gold" id="openAddModalBtn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      Add Application
    </button>
  </div>
</div>

<!-- METRICS SUMMARY CARDS -->
<div class="metrics-grid">
  <div class="metric-card active-filter" id="mcard-total" data-filter-status="">
    <div class="metric-title">Total Pipeline</div>
    <div class="metric-value" id="metricTotal">0</div>
    <div class="metric-sub">Active Applications</div>
  </div>
  <div class="metric-card" id="mcard-oa" data-filter-status="Online Assessment (OA)">
    <div class="metric-title">Active OAs</div>
    <div class="metric-value" id="metricOA">0</div>
    <div class="metric-sub">Pending Assessments</div>
  </div>
  <div class="metric-card" id="mcard-interview" data-filter-status="Interviewing">
    <div class="metric-title">Interviewing</div>
    <div class="metric-value" id="metricInterview">0</div>
    <div class="metric-sub">Screens & Rounds</div>
  </div>
  <div class="metric-card" id="mcard-offer" data-filter-status="Offer">
    <div class="metric-title">Offers</div>
    <div class="metric-value" id="metricOffers">0</div>
    <div class="metric-sub">Received</div>
  </div>
  <div class="metric-card" id="mcard-ghosted" data-filter-status="Ghosted">
    <div class="metric-title">Ghosted</div>
    <div class="metric-value" id="metricGhosted">0</div>
    <div class="metric-sub">30+ Days Inactive</div>
  </div>
</div>

<!-- CONTROLS & NAVIGATION TABS -->
<div class="controls-bar">
  <div class="view-tabs">
    <button class="view-tab-btn active" data-view="view-table">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
      Table View
    </button>
    <button class="view-tab-btn" data-view="view-kanban">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="1"></rect><rect x="14" y="3" width="7" height="10" rx="1"></rect></svg>
      Kanban Board
    </button>
    <button class="view-tab-btn" data-view="view-analytics">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
      Analytics
    </button>
    <button class="view-tab-btn" data-view="view-resumes">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
      Resume Versions
    </button>
    <button class="view-tab-btn" data-view="view-qa">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      Q&A Bank
    </button>
    <button class="view-tab-btn" data-view="view-profile">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
      Autofill Profile
    </button>
  </div>

  <div class="filter-tools">
    <div class="search-box">
      <input type="text" id="globalSearchInput" placeholder="Search company, role, notes..." />
    </div>
    <select id="sortBySelect" class="filter-select">
      <option value="recency">Most Recent</option>
      <option value="priority">Excitement Rating (1-5)</option>
      <option value="company">Company (A-Z)</option>
      <option value="status">Status Stage</option>
    </select>
    <select id="statusFilterSelect" class="filter-select">
      <option value="">All Applications (Active)</option>
      <option value="Saved">Saved / Bookmarked</option>
      <option value="Applied">Applied</option>
      <option value="Online Assessment (OA)">Online Assessment (OA)</option>
      <option value="Recruiter Screen">Recruiter Screen</option>
      <option value="Technical Interview">Technical Interview</option>
      <option value="Final Round / Onsite">Final Round / Onsite</option>
      <option value="Offer">Offer</option>
      <option value="Rejected">Rejected</option>
    </select>
  </div>
</div>""")

    # 2. view_table.html
    write_partial("view_table.html", """<!-- 1. TABLE VIEW -->
<div id="view-table" class="view-container active">
  <div class="table-card">
    <table>
      <thead>
        <tr>
          <th style="width: 22%">Company</th>
          <th style="width: 28%">Role & Workplace</th>
          <th style="width: 14%">Excitement</th>
          <th style="width: 14%">Location</th>
          <th style="width: 10%">Date Applied</th>
          <th style="width: 12%; text-align: right">Action</th>
        </tr>
      </thead>
      <tbody id="applicationsTableBody">
        <tr>
          <td colspan="6" class="empty-state">
            Loading applications from local database...
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</div>""")

    # 3. view_kanban.html
    write_partial("view_kanban.html", """<!-- 2. KANBAN BOARD VIEW -->
<div id="view-kanban" class="view-container">
  <div class="kanban-board">
    <div class="kanban-column" id="kcol-Saved">
      <div class="kanban-column-header"><div class="kanban-column-title"><span class="status-indicator status-saved"></span> Bookmarked</div><span class="kanban-count" id="kcount-Saved">0</span></div>
      <div class="kanban-cards" id="kcards-Saved"></div>
    </div>
    <div class="kanban-column" id="kcol-Applied">
      <div class="kanban-column-header"><div class="kanban-column-title"><span class="status-indicator status-applied"></span> Applied</div><span class="kanban-count" id="kcount-Applied">0</span></div>
      <div class="kanban-cards" id="kcards-Applied"></div>
    </div>
    <div class="kanban-column" id="kcol-Assessment">
      <div class="kanban-column-header"><div class="kanban-column-title"><span class="status-indicator status-oa"></span> Screening / OA</div><span class="kanban-count" id="kcount-Assessment">0</span></div>
      <div class="kanban-cards" id="kcards-Assessment"></div>
    </div>
    <div class="kanban-column" id="kcol-Interview">
      <div class="kanban-column-header"><div class="kanban-column-title"><span class="status-indicator status-interview"></span> Interviewing</div><span class="kanban-count" id="kcount-Interview">0</span></div>
      <div class="kanban-cards" id="kcards-Interview"></div>
    </div>
    <div class="kanban-column" id="kcol-Offer">
      <div class="kanban-column-header"><div class="kanban-column-title"><span class="status-indicator status-offer"></span> Offer</div><span class="kanban-count" id="kcount-Offer">0</span></div>
      <div class="kanban-cards" id="kcards-Offer"></div>
    </div>
    <div class="kanban-column" id="kcol-Rejected">
      <div class="kanban-column-header"><div class="kanban-column-title"><span class="status-indicator status-rejected"></span> Rejected</div><span class="kanban-count" id="kcount-Rejected">0</span></div>
      <div class="kanban-cards" id="kcards-Rejected"></div>
    </div>
  </div>
</div>""")

    # 4. view_analytics.html
    write_partial("view_analytics.html", """<!-- 3. ANALYTICS & INSIGHTS VIEW -->
<div id="view-analytics" class="view-container">
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
    <div class="analytics-card">
      <div class="analytics-card-title">Pipeline Conversion Breakdown</div>
      <div id="statusFunnelChart" style="display: flex; flex-direction: column; gap: 10px; margin-top: 14px;"></div>
    </div>
    <div class="analytics-card">
      <div class="analytics-card-title">Weekly Application Activity</div>
      <div id="weeklyPacingChart" style="display: flex; align-items: flex-end; gap: 8px; height: 180px; margin-top: 14px; border-bottom: 1px solid var(--border-color); padding-bottom: 8px;"></div>
    </div>
  </div>
  <div style="display: grid; grid-template-columns: 1fr 1.4fr; gap: 20px; margin-bottom: 24px;">
    <div class="analytics-card">
      <div class="analytics-card-title">US Geographic Distribution</div>
      <div id="usMapChart" style="margin-top: 14px; min-height: 240px; display: flex; align-items: center; justify-content: center;">
        <svg id="usMapSvg" viewBox="0 0 960 600" style="width: 100%; height: auto; max-height: 280px;"></svg>
      </div>
      <div id="usStateList" style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; font-size: 0.76rem;"></div>
    </div>
    <div class="analytics-card">
      <div class="analytics-card-title">Role Title Breakdown</div>
      <div id="titleStatsTable" style="overflow-x: auto; margin-top: 10px;"></div>
    </div>
  </div>
  <div class="analytics-card">
    <div class="analytics-card-title">Workplace & Internship Pacing</div>
    <div id="internVsFullTimeStats" style="overflow-x: auto; margin-top: 10px;"></div>
  </div>
</div>""")

    # 5. view_resumes.html
    write_partial("view_resumes.html", """<!-- 4. RESUME VERSIONS & TAILORING VIEW -->
<div id="view-resumes" class="view-container">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
    <div>
      <h2 style="margin: 0; font-size: 1.25rem; color: var(--text-main);">Resume Git & Version History</h2>
      <div style="font-size: 0.8rem; color: var(--text-muted);">Track custom resume versions, target job profiles, and PDF attachments.</div>
    </div>
    <button class="btn-primary-gold" id="openAddResumeModalBtn">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      Upload / Create Resume Version
    </button>
  </div>
  <div style="display: grid; grid-template-columns: 320px 1fr; gap: 20px;">
    <div class="analytics-card" style="padding: 14px;">
      <div style="font-weight: 700; font-size: 0.85rem; margin-bottom: 10px; color: var(--text-main);">Version Tree</div>
      <div id="resumesListContainer" style="display: flex; flex-direction: column; gap: 8px;"></div>
    </div>
    <div class="analytics-card" id="resumeDetailView" style="padding: 20px;">
      <div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; padding: 40px 0;">
        Select a resume version from the list to view PDF preview, notes, and attached applications.
      </div>
    </div>
  </div>
</div>""")

    # 6. view_qa.html
    write_partial("view_qa.html", """<!-- 5. QUESTION & ANSWER BANK VIEW -->
<div id="view-qa" class="view-container">
  <div style="margin-bottom: 16px;">
    <h2 style="margin: 0; font-size: 1.25rem; color: var(--text-main);">Application Q&A Bank</h2>
    <div style="font-size: 0.8rem; color: var(--text-muted);">Non-standard application questions cataloged automatically from ATS submissions for instant reuse.</div>
  </div>
  <div id="qaBankGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px;"></div>
</div>""")

    # 7. view_profile.html
    write_partial("view_profile.html", """<!-- 6. AUTOFILL USER PROFILE VIEW -->
<div id="view-profile" class="view-container">
  <div style="margin-bottom: 16px;">
    <h2 style="margin: 0; font-size: 1.25rem; color: var(--text-main);">Autofill Candidate Profile</h2>
    <div style="font-size: 0.8rem; color: var(--text-muted);">Configure your personal details, EEO preferences, work history, and custom field values for instant form filling.</div>
  </div>
  <form id="userProfileForm" class="analytics-card" style="padding: 24px;">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 20px;">
      <div class="form-group"><label>First Name</label><input type="text" id="prof_first_name" placeholder="Candidate First Name" /></div>
      <div class="form-group"><label>Last Name</label><input type="text" id="prof_last_name" placeholder="Candidate Last Name" /></div>
      <div class="form-group"><label>Email Address</label><input type="email" id="prof_email" placeholder="email@example.com" /></div>
      <div class="form-group"><label>Phone Number</label><input type="tel" id="prof_phone" placeholder="(555) 000-0000" /></div>
      <div class="form-group"><label>LinkedIn Profile URL</label><input type="url" id="prof_linkedin" placeholder="https://linkedin.com/in/username" /></div>
      <div class="form-group"><label>GitHub / Portfolio URL</label><input type="url" id="prof_github" placeholder="https://github.com/username" /></div>
      <div class="form-group"><label>City, State</label><input type="text" id="prof_location" placeholder="City, ST" /></div>
      <div class="form-group"><label>Work Authorization</label><select id="prof_work_auth"><option value="Authorized to work">Authorized to work (US Citizen / Permanent Resident)</option><option value="Requires visa sponsorship">Requires visa sponsorship</option></select></div>
    </div>
    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button type="submit" class="btn-primary-gold">Save Candidate Profile</button>
    </div>
  </form>
</div>""")

    # 8. modals.html
    write_partial("modals.html", """<!-- MANUAL APPLICATION ADD MODAL -->
<div class="center-modal-overlay" id="addAppModal">
  <div class="center-modal">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
      <h2 style="margin: 0; font-size: 1.2rem; color: var(--text-main)">Manually Add Job Application</h2>
      <button class="close-drawer-btn" id="closeAddModalBtn">&times;</button>
    </div>
    <form id="manualAppForm">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div class="form-group"><label>Company Name *</label><input type="text" id="m_company" required placeholder="e.g. Humana" /></div>
        <div class="form-group"><label>Job Title *</label><input type="text" id="m_title" required placeholder="e.g. Software Engineer Intern" /></div>
        <div class="form-group"><label>Location</label><input type="text" id="m_location" placeholder="City, ST or Remote" /></div>
        <div class="form-group"><label>Workplace Type</label><select id="m_workplace"><option value="Remote">Remote</option><option value="Hybrid">Hybrid</option><option value="Onsite">Onsite</option></select></div>
        <div class="form-group"><label>Days in Office / Wk</label><input type="number" id="m_days_in_office" min="0" max="5" placeholder="0 = Remote, 5 = Onsite" /></div>
        <div class="form-group"><label>Current Status</label><select id="m_status"><option value="Applied">Applied</option><option value="Saved">Saved / Bookmarked</option><option value="Online Assessment (OA)">Online Assessment (OA)</option><option value="Recruiter Screen">Recruiter Screen</option><option value="Technical Interview">Technical Interview</option><option value="Final Round / Onsite">Final Round / Onsite</option><option value="Offer">Offer</option></select></div>
        <div class="form-group"><label>Date Applied</label><input type="date" id="m_date" /></div>
        <div class="form-group"><label>Salary Range</label><input type="text" id="m_salary" placeholder="e.g. $120k - $140k" /></div>
        <div class="form-group"><label>Excitement / Priority</label><select id="m_priority"><option value="1">1 - Low</option><option value="2">2 - Medium-Low</option><option value="3" selected>3 - Good Match</option><option value="4">4 - High Interest</option><option value="5">5 - Top Choice</option></select></div>
        <div class="form-group"><label>Job URL</label><input type="url" id="m_url" placeholder="https://..." /></div>
      </div>
      <div class="form-group"><label>Notes</label><textarea id="m_notes" rows="2" placeholder="Referral, recruiter contact, notes..."></textarea></div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;">
        <button type="button" class="action-btn" id="cancelAddBtn">Cancel</button>
        <button type="submit" class="btn-primary-gold">Save Application</button>
      </div>
    </form>
  </div>
</div>

<!-- CREATE RESUME VERSION MODAL -->
<div class="center-modal-overlay" id="addResumeModal">
  <div class="center-modal">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
      <h2 style="margin: 0; font-size: 1.2rem; color: var(--text-main)">Create Resume Version (PDF & Markdown)</h2>
      <button class="close-drawer-btn" id="closeAddResumeBtn">&times;</button>
    </div>
    <form id="addResumeForm">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <div class="form-group"><label>Version Tag</label><input type="text" id="r_tag" value="v1.0" /></div>
        <div class="form-group"><label>Parent Version</label><select id="r_parent_id"><option value="">None (Master Version)</option></select></div>
      </div>
      <div class="form-group"><label>Upload Resume File (PDF / DOCX)</label><input type="file" id="r_pdf_file" accept=".pdf,.docx,.doc" /></div>
      <div class="form-group"><label>Version Notes / Focus</label><input type="text" id="r_commit_msg" placeholder="Highlights systems & cloud" /></div>
      <div class="form-group"><label>Extracted Summary Notes</label><textarea id="r_content" rows="3" placeholder="Optional notes..."></textarea></div>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;">
        <button type="button" class="action-btn" id="cancelAddResumeBtn">Cancel</button>
        <button type="submit" class="btn-primary-gold">Save Resume Version</button>
      </div>
    </form>
  </div>
</div>

<!-- APPLICATION DETAIL DRAWER OVERLAY -->
<div class="modal-overlay" id="appDetailModal">
  <div class="drawer">
    <div class="drawer-header">
      <div style="display: flex; gap: 12px; align-items: center;">
        <img id="dCompanyLogo" src="grts-logo-sqr.svg" style="width: 44px; height: 44px; border-radius: 8px; border: 1px solid var(--border-color); object-fit: contain;" />
        <div>
          <h2 id="dJobTitle" style="margin: 0; font-size: 1.25rem; color: var(--text-main);">Role Title</h2>
          <div id="dCompanyName" style="font-size: 0.9rem; color: var(--text-muted); font-weight: 600;">Company</div>
        </div>
      </div>
      <button class="close-drawer-btn" id="closeDrawerBtn">&times;</button>
    </div>

    <!-- Quick Status Bar -->
    <div style="display: flex; gap: 12px; align-items: center; justify-content: space-between; background: #f8fafc; padding: 10px 14px; border-radius: 10px; border: 1px solid var(--border-color); margin-bottom: 16px;">
      <div>
        <span style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Status:</span>
        <div style="margin-top: 2px;">
          <select id="dStatusSelect" class="filter-select" style="padding: 5px 8px; font-size: 0.82rem;">
            <option value="Saved">Saved / Bookmarked</option>
            <option value="Applied">Applied</option>
            <option value="Online Assessment (OA)">Online Assessment (OA)</option>
            <option value="Recruiter Screen">Recruiter Screen</option>
            <option value="Technical Interview">Technical Interview</option>
            <option value="Final Round / Onsite">Final Round / Onsite</option>
            <option value="Offer">Offer</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>
      </div>
      <div id="dLinksContainer" style="display: flex; gap: 6px;"></div>
    </div>

    <!-- Details View Mode -->
    <div id="roleDetailsViewMode" style="margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-weight: 700; font-size: 0.85rem; color: var(--text-main);">Role Information</span>
        <button type="button" id="editAppDetailsBtn" class="action-btn" style="padding: 2px 8px; font-size: 0.74rem;">Edit Details</button>
      </div>
      <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 10px 12px; font-size: 0.82rem;">
        <div id="dViewCompanyRole" style="font-weight: 700;">-</div>
        <div id="dViewWorkplaceSchedule" style="color: var(--text-muted); margin-top: 2px;">-</div>
        <div id="dViewTypeSalary" style="color: var(--text-muted); margin-top: 2px;">-</div>
        <div id="dViewUrl" style="margin-top: 4px;">-</div>
        <div id="dViewPriority" style="margin-top: 4px;">-</div>
        <div id="dViewOaWrapper" style="display: none; margin-top: 4px; color: #c2410c; font-weight: 600;">OA Deadline: <span id="dViewOaExpiration">-</span></div>
        <div id="dViewNotesWrapper" style="display: none; margin-top: 6px;"><div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted);">NOTES</div><div id="dViewNotes" style="white-space: pre-wrap;"></div></div>
        <div style="margin-top: 8px;"><div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted);">JOB DESCRIPTION</div><div id="dViewJobDescription" style="max-height: 120px; overflow-y: auto; white-space: pre-wrap; font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;"></div></div>
      </div>
    </div>

    <!-- Details Edit Mode -->
    <div id="roleDetailsEditMode" style="display: none; margin-bottom: 16px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.8rem;">
        <div class="form-group"><label>Company Name</label><input type="text" id="dEditCompanyName" /></div>
        <div class="form-group"><label>Job Title</label><input type="text" id="dEditJobTitle" /></div>
        <div class="form-group"><label>Location</label><input type="text" id="dEditLocation" /></div>
        <div class="form-group"><label>Workplace</label><select id="dEditWorkplace"><option value="Remote">Remote</option><option value="Hybrid">Hybrid</option><option value="Onsite">Onsite</option></select></div>
        <div class="form-group"><label>Days in Office</label><input type="number" id="dEditDaysInOffice" min="0" max="5" /></div>
        <div class="form-group"><label>Job Type</label><select id="dEditJobType"><option value="Full-time">Full-time</option><option value="Internship">Internship</option><option value="Contract">Contract</option><option value="Part-time">Part-time</option></select></div>
        <div class="form-group"><label>Salary Range</label><input type="text" id="dEditSalary" /></div>
        <div class="form-group"><label>Date Logged / Applied</label><input type="date" id="dEditDateApplied" /></div>
        <div class="form-group"><label>OA Expiration</label><input type="date" id="dEditOaExpirationDate" /></div>
        <div class="form-group"><label>Excitement (1-5)</label><select id="dEditPriority"><option value="1">1 - Low</option><option value="2">2 - Med-Low</option><option value="3">3 - Good</option><option value="4">4 - High</option><option value="5">5 - Dream Role</option></select></div>
        <div class="form-group"><label>Job URL</label><input type="url" id="dEditUrl" /></div>
      </div>
      <div class="form-group" style="margin-top: 6px;"><label>Company Logo URL</label><input type="url" id="dEditCompanyLogo" /></div>
      <div class="form-group" style="margin-top: 6px;"><label>Company Website</label><input type="url" id="dEditCompanyWebsite" /></div>
      <div class="form-group" style="margin-top: 6px;"><label>Notes</label><textarea id="dEditNotes" rows="2"></textarea></div>
      <div class="form-group" style="margin-top: 6px;"><label>Job Description</label><textarea id="dEditJobDescription" rows="4"></textarea></div>
      <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px;">
        <button type="button" id="cancelAppDetailsBtn" class="action-btn">Cancel</button>
        <button type="button" id="saveAppDetailsBtn" class="btn-primary-gold" style="padding: 4px 12px; font-size: 0.8rem;">Save Details</button>
      </div>
    </div>

    <!-- COVER LETTER SECTION -->
    <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; margin-bottom: 12px;">
      <div class="section-title" style="margin-bottom: 8px;">Cover Letter</div>
      <div id="dCoverLetterDisplay" style="font-size: 0.84rem; color: var(--text-muted); background: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; padding: 10px; min-height: 50px; max-height: 180px; overflow-y: auto; white-space: pre-wrap; margin-bottom: 8px;">No cover letter attached.</div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
        <button type="button" id="toggleCoverLetterEditBtn" class="action-btn">Edit Cover Letter</button>
        <button type="button" id="copyCoverLetterBtn" class="action-btn">Copy Text</button>
        <label class="action-btn" style="cursor: pointer; margin: 0;">
          Upload File
          <input type="file" id="uploadCoverLetterFile" accept=".pdf,.docx,.txt" style="display: none;" />
        </label>
        <span id="dCoverLetterFileName" style="font-size: 0.76rem; color: var(--text-muted); font-weight: 600;"></span>
      </div>
      <div id="dCoverLetterEditArea" style="display: none; margin-top: 10px;">
        <textarea id="dCoverLetterTextarea" rows="4" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 6px; font-family: inherit; font-size: 0.82rem;" placeholder="Paste or type cover letter content..."></textarea>
        <div style="display: flex; gap: 8px; margin-top: 6px; justify-content: flex-end;">
          <button type="button" id="cancelCoverLetterBtn" class="action-btn">Cancel</button>
          <button type="button" id="saveCoverLetterBtn" class="btn-primary-gold" style="padding: 4px 12px; font-size: 0.8rem;">Save Cover Letter</button>
        </div>
      </div>
    </div>

    <!-- PORTALS & TRACKING LINKS -->
    <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; margin-bottom: 12px;">
      <div class="section-title" style="margin-bottom: 8px;">Portals & Additional Links</div>
      <div id="dLinksList" style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;"></div>
      <div style="display: grid; grid-template-columns: 1fr 1.5fr auto; gap: 6px; align-items: center;">
        <input type="text" id="newLinkLabel" placeholder="Label (e.g. Candidate Portal)" style="padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem;" />
        <input type="url" id="newLinkUrl" placeholder="https://portal.company.com/..." style="padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem;" />
        <button type="button" id="addLinkBtn" class="action-btn" style="padding: 5px 10px;">Add Link</button>
      </div>
    </div>

    <!-- CONTACTS & PEOPLE TO REMEMBER -->
    <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; margin-bottom: 12px;">
      <div class="section-title" style="margin-bottom: 8px;">Contacts & People to Remember</div>
      <div id="dContactsList" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;"></div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
        <input type="text" id="newContactName" placeholder="Contact Name *" style="padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem;" />
        <input type="text" id="newContactRole" placeholder="Role (e.g. Recruiter, HM)" style="padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem;" />
      </div>
      <div style="display: grid; grid-template-columns: 1.5fr 1fr auto; gap: 6px; align-items: center;">
        <input type="text" id="newContactNotes" placeholder="Notes (e.g. Discussed team setup)" style="padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem;" />
        <input type="email" id="newContactEmail" placeholder="email@company.com" style="padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem;" />
        <button type="button" id="addContactBtn" class="action-btn" style="padding: 5px 10px;">Add Person</button>
      </div>
    </div>

    <!-- MILESTONES TIMELINE -->
    <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; margin-bottom: 12px;">
      <div class="section-title" style="margin-bottom: 8px;">Milestones & Interview History</div>
      <div id="dTimelineList" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 10px;"></div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
        <select id="logEventType" style="padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem;">
          <option value="Applied">Applied</option>
          <option value="Online Assessment (OA)">Online Assessment (OA)</option>
          <option value="Recruiter Screen">Recruiter Screen</option>
          <option value="Technical Interview">Technical Interview</option>
          <option value="System Design">System Design</option>
          <option value="Coding Assessment">Coding Assessment</option>
          <option value="Final Round / Onsite">Final Round / Onsite</option>
          <option value="Offer Received">Offer Received</option>
          <option value="Offer Accepted">Offer Accepted</option>
          <option value="Rejected">Rejected</option>
        </select>
        <input type="date" id="logEventDate" style="padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem;" />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
        <select id="logOaPlatform" style="padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem;"><option value="CodeSignal">CodeSignal</option><option value="HackerRank">HackerRank</option><option value="LeetCode">LeetCode</option><option value="Other">Other Platform</option></select>
        <input type="date" id="logOaExpirationDate" style="padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem;" placeholder="OA Deadline" />
      </div>
      <div class="form-group"><input type="text" id="logMeetingLink" placeholder="Meeting / Assessment Link (https://...)" style="padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem;" /></div>
      <div class="form-group" style="margin-top: 4px;"><textarea id="logEventNotes" rows="2" placeholder="Notes, topics covered, difficulty..." style="padding: 5px 8px; border: 1px solid var(--border-color); border-radius: 6px; font-size: 0.8rem;"></textarea></div>
      <button type="button" id="saveMilestoneBtn" class="btn-primary-gold" style="margin-top: 6px; padding: 5px 12px; font-size: 0.8rem;">Log Milestone</button>
    </div>

    <!-- CUSTOM QUESTION RESPONSES -->
    <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 10px; padding: 14px; margin-bottom: 12px;">
      <div class="section-title" style="margin-bottom: 8px;">Recorded Application Q&A Responses</div>
      <div id="dCustomQAList" style="display: flex; flex-direction: column; gap: 8px;"></div>
    </div>

    <!-- DELETE ACTION -->
    <div style="border-top: 1px solid var(--border-color); padding-top: 14px; display: flex; justify-content: flex-end;">
      <button type="button" id="deleteAppBtn" class="action-btn action-btn-danger">Delete Application Record</button>
    </div>
  </div>
</div>

<!-- TOAST NOTIFICATION CONTAINER -->
<div id="toastNotification" class="grts-toast"></div>""")

def compile_dashboard_html():
    header_tmpl = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="grts-logo-sqr.svg" />
    <title>GRTS - Application Lifecycle & Tracking Dashboard</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="dashboard/dashboard.css" />
  </head>
  <body>
    <div class="app-layout">
"""

    footer_tmpl = """
    </div>

    <!-- Dashboard Modular JavaScript Architecture -->
    <script src="us_map_data.js"></script>
    <script src="dashboard/utils.js"></script>
    <script src="dashboard/state.js"></script>
    <script src="dashboard/data.js"></script>
    <script src="dashboard/table_view.js"></script>
    <script src="dashboard/kanban_view.js"></script>
    <script src="dashboard/analytics_view.js"></script>
    <script src="dashboard/resumes_view.js"></script>
    <script src="dashboard/qa_bank_view.js"></script>
    <script src="dashboard/drawer_and_modals.js"></script>
    <script src="dashboard/profile_view.js"></script>
    <script src="dashboard.js"></script>
  </body>
</html>
"""

    partial_files = [
        "header.html",
        "view_table.html",
        "view_kanban.html",
        "view_analytics.html",
        "view_resumes.html",
        "view_qa.html",
        "view_profile.html",
        "modals.html"
    ]

    content = header_tmpl
    for pf in partial_files:
        p_path = os.path.join(PARTIALS_DIR, pf)
        if os.path.exists(p_path):
            with open(p_path, "r", encoding="utf-8") as f:
                content += f.read() + "\n\n"

    content += footer_tmpl

    with open(DASHBOARD_HTML, "w", encoding="utf-8") as out:
        out.write(content)

    print(f"Successfully compiled extension/dashboard.html ({len(content.splitlines())} lines)!")

if __name__ == "__main__":
    create_default_partials()
    compile_dashboard_html()
