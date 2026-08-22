// Dashboard Master Profile Form Sync & Multi-Entry History Accordions

async function initMasterProfileForm() {
  const form = document.getElementById("masterProfileForm");
  const saveMsg = document.getElementById("profileSaveMsg");
  const eduContainer = document.getElementById("educationEntriesList");
  const expContainer = document.getElementById("experienceEntriesList");
  const addEduBtn = document.getElementById("addEducationBtn");
  const addExpBtn = document.getElementById("addExperienceBtn");

  let educationList = [];
  let experienceList = [];

  function parseDateTokens(dateStr) {
    if (!dateStr) return { month: "", year: "" };
    const clean = String(dateStr).trim();
    let m = clean.match(/^(\d{4})[-/](\d{1,2})$/);
    if (m) return { year: m[1], month: m[2].padStart(2, "0") };
    m = clean.match(/^(\d{1,2})[-/](\d{4})$/);
    if (m) return { year: m[2], month: m[1].padStart(2, "0") };
    const monthNames = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };
    m = clean.match(/([a-zA-Z]{3,9})\.?\s*(\d{4})/i);
    if (m) {
      const monKey = m[1].toLowerCase().slice(0, 3);
      return { year: m[2], month: monthNames[monKey] || "01" };
    }
    m = clean.match(/\b(\d{4})\b/);
    if (m) return { year: m[1], month: "01" };
    return { month: "", year: "" };
  }

  function parseDateRange(rangeStr) {
    if (!rangeStr)
      return {
        start: { month: "05", year: "2026" },
        end: { month: "08", year: "2026" },
      };
    const parts = rangeStr.split(/[-–—to]+/i);
    const start = parseDateTokens(parts[0] || "");
    const end = parseDateTokens(parts[1] || parts[0] || "");
    return {
      start: { month: start.month || "05", year: start.year || "2026" },
      end: { month: end.month || "08", year: end.year || "2026" },
    };
  }

  function getExperienceSortScore(exp) {
    if (!exp) return 0;
    if (exp.currently_work_here) return 999999;
    const end = parseDateTokens(exp.end_date || exp.date_to || "");
    if (end.year) {
      return parseInt(end.year, 10) * 100 + (parseInt(end.month, 10) || 12);
    }
    const start = parseDateTokens(exp.start_date || exp.date_from || "");
    if (start.year) {
      return parseInt(start.year, 10) * 100 + (parseInt(start.month, 10) || 1);
    }
    return 0;
  }

  function sortExperiencesDescending(list) {
    return (list || [])
      .slice()
      .sort((a, b) => getExperienceSortScore(b) - getExperienceSortScore(a));
  }

  document.querySelectorAll(".profile-section-header").forEach((hdr) => {
    hdr.addEventListener("click", () => {
      const card = hdr.closest(".profile-section-card");
      if (card) card.classList.toggle("collapsed");
    });
  });

  document
    .getElementById("expandAllSectionsBtn")
    ?.addEventListener("click", () => {
      document
        .querySelectorAll(".profile-section-card")
        .forEach((c) => c.classList.remove("collapsed"));
    });

  document
    .getElementById("collapseAllSectionsBtn")
    ?.addEventListener("click", () => {
      document
        .querySelectorAll(".profile-section-card")
        .forEach((c) => c.classList.add("collapsed"));
    });

  function renderEducationList() {
    if (!eduContainer) return;
    if (educationList.length === 0) {
      eduContainer.innerHTML = `<div style="font-size:0.82rem; color:var(--text-muted); padding:10px; background:#f8fafc; border-radius:6px;">
                No education history added yet. Click "+ Add Education" above.
            </div>`;
      return;
    }

    eduContainer.innerHTML = educationList
      .map((edu, idx) => {
        const isCollapsed = edu._collapsed === true;
        const isEnabled = edu.enabled !== false;
        const degreeTitle = edu.degree
          ? escapeHtml(edu.degree)
          : `Degree #${idx + 1}`;
        const schoolText = edu.school ? ` • ${escapeHtml(edu.school)}` : "";
        const gradText = edu.grad_year ? ` (${escapeHtml(edu.grad_year)})` : "";
        const statusBadge = isEnabled
          ? `<span style="font-size:0.7rem; font-weight:700; background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; padding:1px 6px; border-radius:4px;">Active</span>`
          : `<span style="font-size:0.7rem; font-weight:700; background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; padding:1px 6px; border-radius:4px;">Excluded</span>`;

        return `
                <div class="edu-entry-card ${isCollapsed ? "collapsed" : ""}" id="edu-card-${idx}">
                    <div class="edu-card-header" data-index="${idx}">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="card-chevron">▼</span>
                            <span style="font-size:0.88rem; font-weight:700; color:var(--text-main);">${degreeTitle}${schoolText}</span>
                            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:500;">${gradText}</span>
                            ${statusBadge}
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;" onclick="event.stopPropagation();">
                            <label style="font-size:0.75rem; font-weight:700; color:${isEnabled ? "#065f46" : "#64748b"}; margin:0; display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                                <input type="checkbox" class="edu-field-chk" data-field="enabled" data-index="${idx}" ${isEnabled ? "checked" : ""} style="width:auto; margin:0;" />
                                <span>${isEnabled ? "Use in Applications" : "Excluded"}</span>
                            </label>
                            <button type="button" class="remove-edu-btn action-btn action-btn-danger" data-index="${idx}" style="padding:2px 8px; font-size:0.72rem; background:#fee2e2; color:#991b1b; border:1px solid #f87171; font-weight:600;">Remove</button>
                        </div>
                    </div>
                    <div class="edu-card-body">
                        <div class="profile-grid">
                            <div class="form-group">
                                <label>School / University *</label>
                                <input type="text" class="edu-field" data-field="school" data-index="${idx}" value="${escapeHtml(edu.school || "")}" placeholder="e.g. Example University" />
                            </div>
                            <div class="form-group">
                                <label>Degree *</label>
                                <input type="text" class="edu-field" data-field="degree" data-index="${idx}" value="${escapeHtml(edu.degree || "")}" placeholder="e.g. Bachelor of Science" />
                            </div>
                            <div class="form-group">
                                <label>Major / Field of Study</label>
                                <input type="text" class="edu-field" data-field="discipline" data-index="${idx}" value="${escapeHtml(edu.discipline || "")}" placeholder="e.g. Computer Science" />
                            </div>
                            <div class="form-group">
                                <label>Education Start Year</label>
                                <input type="text" class="edu-field" data-field="edu_start_year" data-index="${idx}" value="${escapeHtml(edu.edu_start_year || "2023")}" placeholder="e.g. 2023" />
                            </div>
                            <div class="form-group">
                                <label>Graduation Year</label>
                                <input type="text" class="edu-field" data-field="grad_year" data-index="${idx}" value="${escapeHtml(edu.grad_year || "2026")}" placeholder="e.g. 2026" />
                            </div>
                            <div class="form-group">
                                <label>Overall GPA</label>
                                <input type="text" class="edu-field" data-field="gpa" data-index="${idx}" value="${escapeHtml(edu.gpa || "")}" placeholder="e.g. 3.2" />
                            </div>
                        </div>
                    </div>
                </div>
            `;
      })
      .join("");
  }

  function formatDateToMMYYYY(val) {
    if (!val) return "";
    const s = String(val).trim();
    if (/^\d{2}\/\d{4}$/.test(s)) return s;
    const m = s.match(/^(\d{4})[-/](\d{1,2})$/);
    if (m) return `${m[2].padStart(2, "0")}/${m[1]}`;
    const m6 = s.match(/^(\d{2})(\d{4})$/);
    if (m6) return `${m6[1]}/${m6[2]}`;
    return s;
  }

  function renderExperienceList() {
    if (!expContainer) return;
    if (experienceList.length === 0) {
      expContainer.innerHTML = `<div style="font-size:0.82rem; color:var(--text-muted); padding:10px; background:#f8fafc; border-radius:6px;">
                No work experience history added yet. Click "+ Add Experience" above.
            </div>`;
      return;
    }

    expContainer.innerHTML = experienceList
      .map((exp, idx) => {
        const isCollapsed = exp._collapsed === true;
        const isEnabled = exp.enabled !== false;
        const titleText = exp.title
          ? escapeHtml(exp.title)
          : `Role #${idx + 1}`;
        const companyText = exp.company ? ` at ${escapeHtml(exp.company)}` : "";
        const dateText = exp.currently_work_here
          ? `${formatDateToMMYYYY(exp.start_date) || "Start"} – Present`
          : `${formatDateToMMYYYY(exp.start_date) || "Start"} – ${formatDateToMMYYYY(exp.end_date) || "End"}`;
        const statusBadge = isEnabled
          ? `<span style="font-size:0.7rem; font-weight:700; background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0; padding:1px 6px; border-radius:4px;">Active</span>`
          : `<span style="font-size:0.7rem; font-weight:700; background:#f1f5f9; color:#64748b; border:1px solid #cbd5e1; padding:1px 6px; border-radius:4px;">Excluded</span>`;

        return `
                <div class="exp-entry-card ${isCollapsed ? "collapsed" : ""}" id="exp-card-${idx}">
                    <div class="exp-card-header" data-index="${idx}">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span class="card-chevron">▼</span>
                            <span style="font-size:0.88rem; font-weight:700; color:var(--text-main);">${titleText}${companyText}</span>
                            <span style="font-size:0.75rem; color:var(--text-muted); font-weight:500;">(${dateText})</span>
                            ${statusBadge}
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;" onclick="event.stopPropagation();">
                            <label style="font-size:0.75rem; font-weight:700; color:${isEnabled ? "#065f46" : "#64748b"}; margin:0; display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
                                <input type="checkbox" class="exp-field-chk" data-field="enabled" data-index="${idx}" ${isEnabled ? "checked" : ""} style="width:auto; margin:0;" />
                                <span>${isEnabled ? "Use in Applications" : "Excluded"}</span>
                            </label>
                            <button type="button" class="remove-exp-btn action-btn action-btn-danger" data-index="${idx}" style="padding:2px 8px; font-size:0.72rem; background:#fee2e2; color:#991b1b; border:1px solid #f87171; font-weight:600;">Remove</button>
                        </div>
                    </div>
                    <div class="exp-card-body">
                        <div class="profile-grid">
                            <div class="form-group">
                                <label>Company / Employer Name *</label>
                                <input type="text" class="exp-field" data-field="company" data-index="${idx}" value="${escapeHtml(exp.company || "")}" placeholder="e.g. Example Company" />
                            </div>
                            <div class="form-group">
                                <label>Job Title / Role *</label>
                                <input type="text" class="exp-field" data-field="title" data-index="${idx}" value="${escapeHtml(exp.title || "")}" placeholder="e.g. Business Informatics Intern" />
                            </div>
                            <div class="form-group">
                                <label>Work Location</label>
                                <input type="text" class="exp-field" data-field="location" data-index="${idx}" value="${escapeHtml(exp.location || "")}" placeholder="e.g. Indianapolis, IN" />
                            </div>
                            <div class="form-group">
                                <label>Start Date (MM/YYYY) *</label>
                                <input type="text" class="exp-field" data-field="start_date" data-index="${idx}" value="${escapeHtml(formatDateToMMYYYY(exp.start_date) || "05/2026")}" placeholder="05/2026 or 052026" />
                                <span style="font-size:0.7rem; color:var(--text-muted); margin-top:2px; display:block;">Format: <strong>MM/YYYY</strong> or 6 digits (e.g. 05/2026)</span>
                            </div>
                            <div class="form-group">
                                <label>End Date (MM/YYYY)</label>
                                <input type="text" class="exp-field" data-field="end_date" data-index="${idx}" value="${escapeHtml(formatDateToMMYYYY(exp.end_date) || "08/2026")}" placeholder="08/2026 or 082026" />
                                <span style="font-size:0.7rem; color:var(--text-muted); margin-top:2px; display:block;">Format: <strong>MM/YYYY</strong> or 6 digits (e.g. 08/2026)</span>
                            </div>
                            <div class="form-group" style="grid-column: span 2; display:flex; align-items:center; gap:8px;">
                                <input type="checkbox" class="exp-field-chk" data-field="currently_work_here" data-index="${idx}" ${exp.currently_work_here ? "checked" : ""} id="curr_chk_${idx}" style="width:auto; margin:0;" />
                                <label for="curr_chk_${idx}" style="margin:0; font-size:0.82rem; font-weight:600; cursor:pointer;">I currently work here</label>
                            </div>
                            <div class="form-group" style="grid-column: span 2;">
                                <label>Role Description & Bullet Points</label>
                                <textarea class="exp-field" data-field="description" data-index="${idx}" rows="2" style="width:100%; padding:8px 12px; border:1px solid var(--border-color); border-radius:6px; font-family:inherit; font-size:0.82rem;" placeholder="Key responsibilities and achievements...">${escapeHtml(exp.description || "")}</textarea>
                            </div>
                        </div>
                    </div>
                </div>
            `;
      })
      .join("");
  }

  eduContainer?.addEventListener("input", (e) => {
    const target = e.target;
    if (target.classList.contains("edu-field")) {
      const idx = parseInt(target.getAttribute("data-index"));
      const field = target.getAttribute("data-field");
      if (educationList[idx]) educationList[idx][field] = target.value;
    }
  });

  eduContainer?.addEventListener("change", (e) => {
    const target = e.target;
    if (target.classList.contains("edu-field-chk")) {
      const idx = parseInt(target.getAttribute("data-index"));
      const field = target.getAttribute("data-field");
      if (educationList[idx]) {
        educationList[idx][field] = target.checked;
        if (field === "enabled") renderEducationList();
      }
    }
  });

  eduContainer?.addEventListener("click", (e) => {
    const header = e.target.closest(".edu-card-header");
    if (
      header &&
      !e.target.closest(".remove-edu-btn") &&
      !e.target.closest("label")
    ) {
      const idx = parseInt(header.getAttribute("data-index"));
      if (educationList[idx]) {
        educationList[idx]._collapsed = !educationList[idx]._collapsed;
        renderEducationList();
      }
      return;
    }
    const btn = e.target.closest(".remove-edu-btn");
    if (btn) {
      const idx = parseInt(btn.getAttribute("data-index"));
      educationList.splice(idx, 1);
      renderEducationList();
    }
  });

  expContainer?.addEventListener("input", (e) => {
    const target = e.target;
    if (target.classList.contains("exp-field")) {
      const idx = parseInt(target.getAttribute("data-index"));
      const field = target.getAttribute("data-field");
      let val = target.value;
      const cleanDigits = val.replace(/\D/g, "");
      if (
        cleanDigits.length === 6 &&
        (field === "start_date" || field === "end_date")
      ) {
        const formatted = `${cleanDigits.slice(0, 2)}/${cleanDigits.slice(2, 6)}`;
        target.value = formatted;
        val = formatted;
      }
      if (experienceList[idx]) experienceList[idx][field] = val;
    }
  });

  expContainer?.addEventListener("change", (e) => {
    const target = e.target;
    if (target.classList.contains("exp-field-chk")) {
      const idx = parseInt(target.getAttribute("data-index"));
      const field = target.getAttribute("data-field");
      if (experienceList[idx]) {
        experienceList[idx][field] = target.checked;
        if (field === "enabled") renderExperienceList();
      }
    }
  });

  expContainer?.addEventListener("click", (e) => {
    const header = e.target.closest(".exp-card-header");
    if (
      header &&
      !e.target.closest(".remove-exp-btn") &&
      !e.target.closest("label")
    ) {
      const idx = parseInt(header.getAttribute("data-index"));
      if (experienceList[idx]) {
        experienceList[idx]._collapsed = !experienceList[idx]._collapsed;
        renderExperienceList();
      }
      return;
    }
    const btn = e.target.closest(".remove-exp-btn");
    if (btn) {
      const idx = parseInt(btn.getAttribute("data-index"));
      experienceList.splice(idx, 1);
      renderExperienceList();
    }
  });

  addEduBtn?.addEventListener("click", () => {
    educationList.unshift({
      school: "",
      degree: "Bachelor of Science",
      discipline: "Computer Science",
      edu_start_year: "2023",
      grad_year: "2026",
      gpa: "",
      enabled: true,
      _collapsed: false,
    });
    renderEducationList();
  });

  addExpBtn?.addEventListener("click", () => {
    experienceList.unshift({
      company: "",
      title: "",
      location: "Indianapolis, IN",
      start_date: "05/2026",
      end_date: "08/2026",
      currently_work_here: false,
      enabled: true,
      description: "",
      _collapsed: false,
    });
    renderExperienceList();
  });

  try {
    const res = await fetch(`${API_BASE}/profile`);
    if (res.ok) {
      const json = await res.json();
      const p = json.data || {};

      if (document.getElementById("p_autofill_enabled")) {
        document.getElementById("p_autofill_enabled").checked =
          p.autofill_enabled === true;
      }

      if (p.first_name)
        document.getElementById("p_first_name").value = p.first_name;
      if (p.last_name)
        document.getElementById("p_last_name").value = p.last_name;
      if (p.email) document.getElementById("p_email").value = p.email;
      if (p.phone) document.getElementById("p_phone").value = p.phone;
      if (p.phone_device_type)
        document.getElementById("p_phone_type").value = p.phone_device_type;
      if (p.how_heard)
        document.getElementById("p_how_heard").value = p.how_heard;
      if (p.address) document.getElementById("p_address").value = p.address;
      if (p.city) document.getElementById("p_city").value = p.city;
      if (p.state) document.getElementById("p_state").value = p.state;
      if (p.postal_code)
        document.getElementById("p_postal_code").value = p.postal_code;
      if (p.country) document.getElementById("p_country").value = p.country;
      if (p.linkedin) document.getElementById("p_linkedin").value = p.linkedin;
      if (p.github) document.getElementById("p_github").value = p.github;
      if (p.portfolio)
        document.getElementById("p_portfolio").value = p.portfolio;
      if (p.skills) document.getElementById("p_skills").value = p.skills;
      if (p.desired_salary)
        document.getElementById("p_salary").value = p.desired_salary;
      if (p.notice_period)
        document.getElementById("p_notice").value = p.notice_period;

      if (p.work_authorized_us && document.getElementById("p_work_auth"))
        document.getElementById("p_work_auth").value = p.work_authorized_us;
      if (p.require_sponsorship && document.getElementById("p_sponsorship"))
        document.getElementById("p_sponsorship").value = p.require_sponsorship;
      if (p.gender && document.getElementById("p_gender"))
        document.getElementById("p_gender").value = p.gender;
      if (p.race_ethnicity && document.getElementById("p_race"))
        document.getElementById("p_race").value = p.race_ethnicity;
      if (p.hispanic_latino && document.getElementById("p_hispanic"))
        document.getElementById("p_hispanic").value = p.hispanic_latino;
      if (p.veteran_status && document.getElementById("p_veteran"))
        document.getElementById("p_veteran").value = p.veteran_status;
      if (p.disability_status && document.getElementById("p_disability"))
        document.getElementById("p_disability").value = p.disability_status;

      if (
        p.education_list &&
        Array.isArray(p.education_list) &&
        p.education_list.length > 0
      ) {
        educationList = p.education_list;
      } else if (p.school || p.degree) {
        educationList = [
          {
            school: p.school || "",
            degree: p.degree || "",
            discipline: p.discipline || "",
            edu_start_year: p.edu_start_year || "",
            grad_year: p.grad_year || "",
            gpa: p.gpa || "",
            enabled: true,
          },
        ];
      } else {
        educationList = [];
      }
      renderEducationList();

      if (
        p.experience_list &&
        Array.isArray(p.experience_list) &&
        p.experience_list.length > 0
      ) {
        const mapped = p.experience_list.map((x) => ({
          ...x,
          enabled: x.enabled !== false,
          start_date:
            x.start_date ||
            (x.date_from
              ? parseDateRange(x.date_from).start.year +
                "-" +
                parseDateRange(x.date_from).start.month
              : "2026-05"),
          end_date:
            x.end_date ||
            (x.date_from
              ? parseDateRange(x.date_from).end.year +
                "-" +
                parseDateRange(x.date_from).end.month
              : "2026-08"),
        }));
        experienceList = sortExperiencesDescending(mapped);
      } else if (p.current_company || p.current_title) {
        experienceList = [
          {
            company: p.current_company || "",
            title: p.current_title || "",
            location: p.current_location || "",
            start_date: p.experience_start_date || "",
            end_date: p.experience_end_date || "",
            currently_work_here: false,
            enabled: true,
            description: p.experience_description || "",
          },
        ];
      } else {
        experienceList = [];
      }
      renderExperienceList();
    }
  } catch (e) {}

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const primaryEdu =
      educationList.find((e) => e.enabled !== false) || educationList[0] || {};
    const primaryExp =
      experienceList.find((e) => e.enabled !== false) ||
      experienceList[0] ||
      {};

    const profileData = {
      autofill_enabled: document.getElementById("p_autofill_enabled")
        ? document.getElementById("p_autofill_enabled").checked
        : false,
      first_name: document.getElementById("p_first_name").value.trim(),
      last_name: document.getElementById("p_last_name").value.trim(),
      email: document.getElementById("p_email").value.trim(),
      phone: document.getElementById("p_phone").value.trim(),
      phone_device_type: document.getElementById("p_phone_type").value,
      how_heard: document.getElementById("p_how_heard").value,
      address: document.getElementById("p_address").value.trim(),
      city: document.getElementById("p_city").value.trim(),
      state: document.getElementById("p_state").value.trim(),
      postal_code: document.getElementById("p_postal_code").value.trim(),
      country: document.getElementById("p_country").value.trim(),
      linkedin: document.getElementById("p_linkedin").value.trim(),
      github: document.getElementById("p_github").value.trim(),
      portfolio: document.getElementById("p_portfolio").value.trim(),
      skills: document.getElementById("p_skills").value.trim(),
      desired_salary: document.getElementById("p_salary").value.trim(),
      notice_period: document.getElementById("p_notice").value.trim(),

      work_authorized_us: document.getElementById("p_work_auth")
        ? document.getElementById("p_work_auth").value
        : "Yes",
      require_sponsorship: document.getElementById("p_sponsorship")
        ? document.getElementById("p_sponsorship").value
        : "No",
      gender: document.getElementById("p_gender")
        ? document.getElementById("p_gender").value
        : "Decline to Self-Identify",
      race_ethnicity: document.getElementById("p_race")
        ? document.getElementById("p_race").value
        : "White",
      hispanic_latino: document.getElementById("p_hispanic")
        ? document.getElementById("p_hispanic").value
        : "No",
      veteran_status: document.getElementById("p_veteran")
        ? document.getElementById("p_veteran").value
        : "I am not a protected veteran",
      disability_status: document.getElementById("p_disability")
        ? document.getElementById("p_disability").value
        : "No, I do not have a disability and have not had one in the past",

      education_list: educationList,
      experience_list: experienceList,

      school: primaryEdu.school || "",
      degree: primaryEdu.degree || "",
      discipline: primaryEdu.discipline || "",
      edu_start_year: primaryEdu.edu_start_year || "2023",
      grad_year: primaryEdu.grad_year || "2026",
      gpa: primaryEdu.gpa || "",
      current_company: primaryExp.company || "",
      current_title: primaryExp.title || "",
      current_location: primaryExp.location || "",
      experience_description: primaryExp.description || "",
    };

    try {
      await fetch(`${API_BASE}/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });

      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        chrome.storage.local.set({ grts_user_profile: profileData });
      }

      saveMsg.style.color = "var(--success)";
      saveMsg.innerText =
        "✓ Master profile saved and synced across all ATS autofillers!";
      showToast("Master profile saved");
      setTimeout(() => {
        saveMsg.innerText = "";
      }, 4000);
    } catch (err) {
      saveMsg.style.color = "var(--danger)";
      saveMsg.innerText = "Failed to save profile.";
    }
  });
}
