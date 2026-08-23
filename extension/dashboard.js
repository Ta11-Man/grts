// GRTS Application Lifecycle Dashboard
// Real-time table view, Drag-and-Drop Kanban pipeline, Chronological Time-Series Range Chart, Resume Git & PDF Versioning, Q&A Bank, and Journey Milestone Manager

const API_BASE =
  window.GRTS?.Dashboard?.api?.baseUrl || "http://127.0.0.1:8000";

let applicationsData = [];
let qaBankData = [];
let resumesData = [];
let detailedAnalyticsData = null;
let currentSelectedApp = null;
let activeSortBy = "recency";
let activeStatusFilter = "";
let activeCustomFilter = null; // null | 'interviewing' | 'offers' | 'hearback'
let activeSearchQuery = "";
let currentDraggedAppId = null;

/**
 * Toast Notification Utility
 */
function showToast(message) {
  const toast = document.getElementById("toastNotification");
  if (!toast) return;
  toast.innerText = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

/**
 * Workday Messy Location Cleaner
 */
function cleanWorkdayLocationString(raw) {
  if (!raw) return "";
  let str = raw.trim();
  const validStates = new Set([
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
    "DC",
    "PR",
  ]);
  const stCityMatches = [
    ...str.matchAll(
      /\b([A-Z]{2})-([A-Za-z\s]+?)(?:,\s*\d|\s+[A-Z]{2}-|\s*\(|$)/g,
    ),
  ];
  if (stCityMatches.length > 0) {
    const extracted = [];
    for (const m of stCityMatches) {
      const st = m[1].toUpperCase();
      const city = m[2].trim().replace(/^(city of|town of)\s+/i, "");
      if (validStates.has(st) && city.length >= 2 && city.length <= 35) {
        const titleCity = city
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
        extracted.push(`${titleCity}, ${st}`);
      }
    }
    if (extracted.length > 0) {
      let res = [...new Set(extracted)].join(" • ");
      if (/\(hybrid\)/i.test(str)) res += " (Hybrid)";
      else if (/\(remote\)/i.test(str)) res += " (Remote)";
      else if (/\(on-?site\)/i.test(str)) res += " (On-site)";
      return res;
    }
  }
  return str;
}

function isInterviewStatus(status) {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  if (
    [
      "applied",
      "save",
      "reject",
      "ghost",
      "skip",
      "expire",
      "offer",
      "decline",
    ].some((neg) => s.includes(neg))
  ) {
    return false;
  }
  return true;
}

/**
 * 1. View Tabs Switching
 */
function initViewTabs() {
  const tabBtns = document.querySelectorAll(".view-tab-btn");
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const targetViewId = btn.getAttribute("data-view");
      document.querySelectorAll(".view-container").forEach((view) => {
        view.classList.remove("active");
      });
      const targetView = document.getElementById(targetViewId);
      if (targetView) targetView.classList.add("active");

      if (targetViewId === "view-analytics") renderAnalyticsTab();
      if (targetViewId === "view-resumes") loadResumesData();
    });
  });
}

/**
 * 2. Search & Filter Controls & Clickable Funnel Metric Cards
 */
function updateMetricCardActiveState() {
  const totalAppsCard = document.getElementById("mTotalAppsCard");
  const savedCard = document.getElementById("mSavedCard");
  const interviewingCard = document.getElementById("mInterviewingCard");
  const offersCard = document.getElementById("mOffersCard");
  const hearbackCard = document.getElementById("mHearbackCard");

  document
    .querySelectorAll(".metric-card")
    .forEach((c) => c.classList.remove("active-filter"));
  if (activeCustomFilter === "interviewing" && interviewingCard)
    interviewingCard.classList.add("active-filter");
  else if (activeCustomFilter === "offers" && offersCard)
    offersCard.classList.add("active-filter");
  else if (activeCustomFilter === "hearback" && hearbackCard)
    hearbackCard.classList.add("active-filter");
  else if (activeStatusFilter === "Saved" && savedCard)
    savedCard.classList.add("active-filter");
  else if (!activeStatusFilter && !activeCustomFilter && totalAppsCard)
    totalAppsCard.classList.add("active-filter");
}

function initFiltersAndSearch() {
  const searchInput = document.getElementById("globalSearchInput");
  const sortSelect = document.getElementById("sortBySelect");
  const statusSelect = document.getElementById("statusFilterSelect");

  const totalAppsCard = document.getElementById("mTotalAppsCard");
  const savedCard = document.getElementById("mSavedCard");
  const interviewingCard = document.getElementById("mInterviewingCard");
  const offersCard = document.getElementById("mOffersCard");
  const hearbackCard = document.getElementById("mHearbackCard");

  let debounceTimer = null;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      activeSearchQuery = e.target.value.trim();
      loadDashboardData();
    }, 300);
  });

  sortSelect.addEventListener("change", (e) => {
    activeSortBy = e.target.value;
    loadDashboardData();
  });

  statusSelect.addEventListener("change", (e) => {
    activeStatusFilter = e.target.value;
    activeCustomFilter = null;
    updateMetricCardActiveState();
    loadDashboardData();
  });

  // 1. Total Applications Card -> Show All
  if (totalAppsCard) {
    totalAppsCard.addEventListener("click", () => {
      if (statusSelect) statusSelect.value = "";
      activeStatusFilter = "";
      activeCustomFilter = null;
      updateMetricCardActiveState();
      loadDashboardData();
      showToast("Showing All Applications");
    });
  }

  // 2. Saved Jobs Card -> Filter Saved
  if (savedCard) {
    savedCard.addEventListener("click", () => {
      if (statusSelect) statusSelect.value = "Saved";
      activeStatusFilter = "Saved";
      activeCustomFilter = null;
      updateMetricCardActiveState();
      loadDashboardData();
      showToast("Filtering Saved Jobs");
    });
  }

  // 3. Interviewing Card -> Filter Active Interview Rounds
  if (interviewingCard) {
    interviewingCard.addEventListener("click", () => {
      if (statusSelect) statusSelect.value = "";
      activeStatusFilter = "";
      activeCustomFilter = "interviewing";
      updateMetricCardActiveState();
      loadDashboardData();
      showToast("Filtering Active Interview Rounds");
    });
  }

  // 4. Offers Card -> Filter Offers
  if (offersCard) {
    offersCard.addEventListener("click", () => {
      if (statusSelect) statusSelect.value = "";
      activeStatusFilter = "";
      activeCustomFilter = "offers";
      updateMetricCardActiveState();
      loadDashboardData();
      showToast("Filtering Offers");
    });
  }

  // 5. Hearback Card -> Filter Roles With Company Responses
  if (hearbackCard) {
    hearbackCard.addEventListener("click", () => {
      if (statusSelect) statusSelect.value = "";
      activeStatusFilter = "";
      activeCustomFilter = "hearback";
      updateMetricCardActiveState();
      loadDashboardData();
      showToast("Filtering Roles With Company Responses");
    });
  }
}

/**
 * 3. Fetch Applications, Stats, and Q&A Bank from Backend
 */
async function loadDashboardData() {
  try {
    let url = `${API_BASE}/applications?sort_by=${encodeURIComponent(activeSortBy)}`;
    if (activeStatusFilter === "Saved") {
      url += `&status=Saved&include_saved=true`;
    } else if (activeStatusFilter) {
      url += `&status=${encodeURIComponent(activeStatusFilter)}`;
    }
    if (activeSearchQuery)
      url += `&search=${encodeURIComponent(activeSearchQuery)}`;

    const [appsRes, statsRes, qaRes, analyticsRes] = await Promise.all([
      fetch(url)
        .then((r) => r.json())
        .catch(() => ({ data: [] })),
      fetch(`${API_BASE}/stats`)
        .then((r) => r.json())
        .catch(() => ({ data: null })),
      fetch(`${API_BASE}/questions`)
        .then((r) => r.json())
        .catch(() => ({ data: [] })),
      fetch(`${API_BASE}/analytics/detailed`)
        .then((r) => r.json())
        .catch(() => ({ data: null })),
    ]);

    let rawApps = appsRes.data || [];
    qaBankData = qaRes.data || [];
    detailedAnalyticsData = analyticsRes.data || null;

    // Apply custom metric card filters client-side
    if (activeCustomFilter === "interviewing") {
      rawApps = rawApps.filter((app) => isInterviewStatus(app.status));
    } else if (activeCustomFilter === "offers") {
      rawApps = rawApps.filter((app) =>
        (app.status || "").toLowerCase().includes("offer"),
      );
    } else if (activeCustomFilter === "hearback") {
      rawApps = rawApps.filter(
        (app) => app.status !== "Applied" && app.status !== "Saved",
      );
    }

    applicationsData = rawApps;

    updateMetricCardActiveState();
    renderMetrics(statsRes.data);
    renderTable(applicationsData);
    renderKanban(applicationsData);
    renderQABank(qaBankData);
    if (
      document.getElementById("view-analytics").classList.contains("active")
    ) {
      renderAnalyticsTab();
    }
  } catch (err) {
    console.error("GRTS Dashboard load error:", err);
    const tbody = document.getElementById("applicationsTableBody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="color:#ef4444;">
                Could not connect to local backend (http://127.0.0.1:8000). Ensure the backend server is running.
            </td></tr>`;
    }
  }
}

/**
 * 4. Render Funnel Metrics Bar
 */
function renderMetrics(stats) {
  if (!stats) return;
  document.getElementById("mTotalApps").innerText =
    stats.total_applications || 0;

  let uniqueCompanies = stats.unique_companies_count;
  if (
    uniqueCompanies === undefined &&
    typeof applicationsData !== "undefined" &&
    Array.isArray(applicationsData)
  ) {
    const validApps = applicationsData.filter((a) => a.status !== "Saved");
    const compSet = new Set(
      validApps
        .map((a) => (a.company_name || "").trim().toLowerCase())
        .filter(Boolean),
    );
    uniqueCompanies = compSet.size;
  }
  const uCount = uniqueCompanies || 0;
  document.getElementById("mActiveApps").innerText =
    `${uCount} ${uCount === 1 ? "unique company" : "unique companies"}`;
  const mSaved = document.getElementById("mSavedApps");
  if (mSaved) mSaved.innerText = stats.saved_count || 0;
  document.getElementById("mInterviews").innerText = stats.interview_count || 0;
  document.getElementById("mOffers").innerText = stats.offer_count || 0;
  document.getElementById("mOfferRate").innerText =
    `${stats.offer_rate_percent || 0}% offer rate`;
  document.getElementById("mResponseRate").innerText =
    `${stats.positive_response_percent || 0}%`;
  const mResponseSub = document.getElementById("mResponseSub");
  if (mResponseSub) {
    mResponseSub.innerText = `${stats.response_rate_percent || 0}% including rejections`;
    mResponseSub.title = `${stats.positive_response_count || 0} of ${stats.total_applications || 0} applications advanced beyond initial apply without rejection. ${stats.response_rate_percent || 0}% received a response including rejections.`;
  }
}

/**
 * 5. Render Table View
 */
/**
 * OA Deadline / Expiration Badge Helper & Quick Skip Action (Clean Text, No Emojis)
 */
function renderOaDeadlineBadge(app) {
  if (!app || !app.oa_expiration_date) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(app.oa_expiration_date);
  expDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round((expDate - today) / (1000 * 60 * 60 * 24));
  let badgeClass = "ok";
  let text = `Due ${app.oa_expiration_date}`;
  let skipBtn = "";

  if (diffDays < 0) {
    badgeClass = "expired";
    text = `Expired ${Math.abs(diffDays)}d ago (${app.oa_expiration_date})`;
    skipBtn = `<button class="btn-skip-oa" onclick="event.stopPropagation(); markOaSkipped(${app.id})" title="Mark as Skipped / Expired OA">Mark Skipped</button>`;
  } else if (diffDays === 0) {
    badgeClass = "soon";
    text = `Due Today (${app.oa_expiration_date})`;
  } else if (diffDays <= 3) {
    badgeClass = "soon";
    text = `Due in ${diffDays}d (${app.oa_expiration_date})`;
  } else {
    badgeClass = "ok";
    text = `Due in ${diffDays}d (${app.oa_expiration_date})`;
  }

  return `<div style="margin-top: 4px;"><span class="oa-deadline-badge ${badgeClass}">${text}</span>${skipBtn}</div>`;
}

window.markOaSkipped = async function (appId) {
  try {
    await fetch(`${API_BASE}/applications/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Skipped / Expired OA" }),
    });
    await fetch(`${API_BASE}/applications/${appId}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: "Skipped / Expired OA",
        event_date: new Date().toISOString().split("T")[0],
        notes: "Marked OA as skipped/expired",
      }),
    });
    showToast("Marked OA as skipped/expired");
    loadDashboardData();
  } catch (e) {
    console.error("Error skipping OA:", e);
  }
};

function getCompanyFavicon(url) {
  if (!url) return null;
  try {
    const fullUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://${url}`;
    const domain = new URL(fullUrl).hostname.replace(/^www\./, "");
    return `https://${domain}/favicon.ico`;
  } catch {
    return null;
  }
}

window.handleLogoFallback = function (img, companyName, companyWebsite) {
  if (!img.dataset.fallbackStep) {
    img.dataset.fallbackStep = "1";
    let domain = "";
    if (companyWebsite) {
      try {
        const fullUrl = companyWebsite.startsWith("http")
          ? companyWebsite
          : `https://${companyWebsite}`;
        domain = new URL(fullUrl).hostname.replace(/^www\./, "");
      } catch (e) {}
    }
    if (!domain && companyName) {
      domain = companyName.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
    }
    if (domain) {
      img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
      return;
    }
  }
  img.onerror = null;
  img.src = "grts-logo-sqr.svg";
};

function renderTable(apps) {
  const tbody = document.getElementById("applicationsTableBody");
  if (!tbody) return;

  if (apps.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">
            <h3>No applications found</h3>
            <p>Applications will appear here automatically when submitted, or click "Add Application" to enter manually.</p>
        </td></tr>`;
    return;
  }

  tbody.innerHTML = apps
    .map((app) => {
      let logoSrc = app.company_logo;
      if (!logoSrc && app.company_website) {
        logoSrc = getCompanyFavicon(app.company_website);
      }
      if (!logoSrc && app.company_name) {
        const cleanName = app.company_name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanName) logoSrc = `https://${cleanName}.com/favicon.ico`;
      }
      logoSrc = logoSrc || "grts-logo-sqr.svg";

      const cleanStatus = getStatusClass(app.status);
      const starsHtml = renderClickableStars(app.id, app.priority || 1);

      // Format workplace & days in office badge
      let workplaceLabel = app.workplace_type || "Full-time";
      if (app.days_in_office !== null && app.days_in_office !== undefined) {
        if (app.days_in_office === 0) workplaceLabel = "Remote (0d in-office)";
        else if (app.days_in_office === 5)
          workplaceLabel = "On-site (5d in-office)";
        else workplaceLabel = `Hybrid (${app.days_in_office}d/wk)`;
      }

      const isOaActive =
        app.oa_expiration_date &&
        (app.status.includes("OA") || app.status.includes("Assessment"));
      const deadlineBadgeHtml = isOaActive ? renderOaDeadlineBadge(app) : "";
      const cleanLoc =
        cleanWorkdayLocationString(app.location) || "Remote / Unspecified";

      return `
            <tr class="clickable-row" data-id="${app.id}">
                <td>
                  <div class="company-cell">
                      <img 
                          src="${escapeHtml(logoSrc)}" 
                          class="company-logo" 
                          onerror="handleLogoFallback(this, '${escapeHtml(app.company_name || "")}', '${escapeHtml(app.company_website || "")}')" 
                          alt="${escapeHtml(app.company_name)} logo" 
                      />
                      <span>${escapeHtml(app.company_name)}</span>
                  </div>
              </td>
                <td>
                    <div class="role-title">${escapeHtml(app.job_title)}</div>
                    <div class="role-meta">
                        ${escapeHtml(workplaceLabel)} ${app.salary_range ? "• " + escapeHtml(app.salary_range) : ""}
                    </div>
                </td>
                <td onclick="event.stopPropagation();">
                    ${starsHtml}
                </td>
                <td>
                    <div class="location-cell-text" title="${escapeHtml(cleanLoc)}">
                        ${escapeHtml(cleanLoc)}
                    </div>
                </td>
                <td>
                    <span style="font-size: 0.82rem; font-weight: 600;">${escapeHtml(app.date_applied || "-")}</span>
                    <div style="margin-top: 3px;">
                        <span class="status-badge ${cleanStatus}">${escapeHtml(app.status)}</span>
                    </div>
                    ${deadlineBadgeHtml}
                </td>
                <td style="text-align: right;" onclick="event.stopPropagation();">
                    <button class="action-btn" onclick="openDetailDrawer(${app.id})">Details</button>
                    <button class="action-btn action-btn-danger" style="margin-left: 4px;" onclick="deleteApplication(${app.id})" title="Delete Application">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            </tr>
        `;
    })
    .join("");

  tbody.querySelectorAll("tr.clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      const id = parseInt(row.getAttribute("data-id"));
      openDetailDrawer(id);
    });
  });
}

/**
 * 6. Render Clickable Star Ratings (Default: 1 Star)
 */
function renderClickableStars(appId, currentPriority) {
  let html = '<div style="display:inline-flex; align-items:center; gap:2px;">';
  for (let i = 1; i <= 5; i++) {
    const char = i <= currentPriority ? "★" : "☆";
    html += `<span class="star-click" title="Set excitement to ${i}/5" onclick="updatePriority(${appId}, ${i})">${char}</span>`;
  }
  html += "</div>";
  return html;
}

window.updatePriority = async function (appId, newPriority) {
  try {
    const res = await fetch(`${API_BASE}/applications/${appId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: newPriority }),
    });
    if (res.ok) {
      showToast(`Excitement set to ${newPriority}/5`);
      if (currentSelectedApp && currentSelectedApp.id === appId) {
        currentSelectedApp.priority = newPriority;
        const starsContainer = document.getElementById("dPriorityStars");
        if (starsContainer)
          starsContainer.innerHTML = renderClickableStars(appId, newPriority);
        const priorityEl = document.getElementById("dViewPriority");
        if (priorityEl) {
          const stars = "★".repeat(newPriority) + "☆".repeat(5 - newPriority);
          priorityEl.innerHTML = `<span style="color:#f59e0b; font-size:1.05rem; font-weight:700;">${stars}</span> <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">(${newPriority}/5)</span>`;
        }
        const editPrioEl = document.getElementById("dEditPriority");
        if (editPrioEl) editPrioEl.value = newPriority;
      }
      loadDashboardData();
    }
  } catch (e) {
    console.error("Failed to update priority:", e);
  }
};

/**
 * 7. Horizontal Single-Row Kanban Board with Robust Event Delegation
 */
function renderKanban(apps) {
  const kanbanContainer = document.getElementById("kanbanBoardContainer");
  if (!kanbanContainer) return;

  const columns = [
    { id: "Applied", label: "Applied", match: ["Applied"] },
    {
      id: "OA",
      label: "Assessment (OA)",
      match: ["Online Assessment (OA)", "OA", "Coding Challenge"],
    },
    {
      id: "Screening",
      label: "Screening",
      match: ["Recruiter Screen", "Screening", "Phone Screen"],
    },
    {
      id: "Technical",
      label: "Technical",
      match: ["Technical Interview", "System Design"],
    },
    {
      id: "Final Round",
      label: "Final Round",
      match: ["Final Round / Onsite", "Onsite"],
    },
    {
      id: "Offer",
      label: "Offer",
      match: ["Offer Received", "Offer Accepted", "Offer Declined", "Offer"],
    },
    {
      id: "Rejected",
      label: "Rejected / Skipped",
      match: [
        "Rejected",
        "Ghosted",
        "Skipped / Expired OA",
        "Skipped OA",
        "Expired OA",
      ],
    },
  ];

  kanbanContainer.innerHTML = columns
    .map((col) => {
      const colApps = apps.filter((app) => {
        if (col.match.includes(app.status)) return true;
        if (
          col.id === "Applied" &&
          !columns.some(
            (c) => c.id !== "Applied" && c.match.includes(app.status),
          )
        )
          return true;
        return false;
      });

      const cardsHtml = colApps
        .map((app) => {
          let deadlineHtml = "";
          if (app.oa_expiration_date && col.id === "OA") {
            deadlineHtml = renderOaDeadlineBadge(app);
          }

          return `
            <div class="kanban-card" draggable="true" data-app-id="${app.id}">
                <div class="kanban-card-company">
                    <span>${escapeHtml(app.company_name)}</span>
                    <span onclick="event.stopPropagation();">${renderClickableStars(app.id, app.priority || 1)}</span>
                </div>
                <div class="kanban-card-title">${escapeHtml(app.job_title)}</div>
                <div class="kanban-card-date">
                    ${escapeHtml(app.date_applied || "-")} ${app.location ? "• " + escapeHtml(app.location) : ""}
                </div>
                ${deadlineHtml}
            </div>
            `;
        })
        .join("");

      return `
            <div class="kanban-col" data-col-id="${col.id}">
                <div class="kanban-header">
                    <span>${col.label}</span>
                    <span class="kanban-count">${colApps.length}</span>
                </div>
                <div class="kanban-cards-wrapper" style="min-height: 460px;">
                    ${cardsHtml || '<div style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:30px 10px;">Drag roles here</div>'}
                </div>
            </div>
        `;
    })
    .join("");
}

/**
 * Document-Level Event Delegation for 100% Reliable Drag-and-Drop
 */
function initKanbanDragAndDropListeners() {
  // 1. Drag Start
  document.addEventListener("dragstart", (e) => {
    const card = e.target.closest(".kanban-card");
    if (!card) return;

    currentDraggedAppId = card.getAttribute("data-app-id");
    e.dataTransfer.setData("text/plain", currentDraggedAppId);
    e.dataTransfer.effectAllowed = "move";
    card.classList.add("dragging");
  });

  // 2. Drag End
  document.addEventListener("dragend", (e) => {
    const card = e.target.closest(".kanban-card");
    if (card) card.classList.remove("dragging");
    document
      .querySelectorAll(".kanban-col")
      .forEach((c) => c.classList.remove("drag-over"));
    currentDraggedAppId = null;
  });

  // 3. Drag Over
  document.addEventListener("dragover", (e) => {
    const col = e.target.closest(".kanban-col");
    if (col) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      col.classList.add("drag-over");
    }
  });

  // 4. Drag Leave
  document.addEventListener("dragleave", (e) => {
    const col = e.target.closest(".kanban-col");
    if (col && !col.contains(e.relatedTarget)) {
      col.classList.remove("drag-over");
    }
  });

  // 5. Drop
  document.addEventListener("drop", async (e) => {
    const col = e.target.closest(".kanban-col");
    if (!col) return;

    e.preventDefault();
    col.classList.remove("drag-over");

    const appId = currentDraggedAppId || e.dataTransfer.getData("text/plain");
    if (!appId) return;

    const targetColId = col.getAttribute("data-col-id");
    let targetStatus = "Applied";
    if (targetColId === "OA") targetStatus = "Online Assessment (OA)";
    else if (targetColId === "Screening") targetStatus = "Recruiter Screen";
    else if (targetColId === "Technical") targetStatus = "Technical Interview";
    else if (targetColId === "Final Round")
      targetStatus = "Final Round / Onsite";
    else if (targetColId === "Offer") targetStatus = "Offer Received";
    else if (targetColId === "Rejected") targetStatus = "Rejected";

    try {
      await fetch(`${API_BASE}/applications/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      await fetch(`${API_BASE}/applications/${appId}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: targetStatus,
          event_date: new Date().toISOString().split("T")[0],
          notes: `Stage moved to ${targetStatus}`,
        }),
      });

      showToast(`Moved application to ${targetStatus}`);
      loadDashboardData();
    } catch (err) {
      console.error("Failed to move Kanban card:", err);
    }
  });

  // 6. Click to Open Details
  document.addEventListener("click", (e) => {
    const card = e.target.closest(".kanban-card");
    if (card && !e.target.closest(".star-click")) {
      const appId = parseInt(card.getAttribute("data-app-id"));
      if (appId) openDetailDrawer(appId);
    }
  });
}

/**
 * 8. Render Chronological Time-Series Range Chart (SVG)
 */
function renderAnalyticsTab() {
  if (!detailedAnalyticsData) return;
  const {
    activity_timeline,
    ats_breakdown,
    priority_breakdown,
    location_breakdown,
    title_stats,
    intern_vs_fulltime,
  } = detailedAnalyticsData;

  // 1. Chronological Timeline Range Chart SVG
  const svg = document.getElementById("timelineRangeSvg");
  if (svg && activity_timeline) {
    renderTimelineRangeSvg(svg, activity_timeline);
  }

  // 2. ATS Breakdown
  const atsContainer = document.getElementById("atsBreakdownChart");
  if (atsContainer) {
    atsContainer.innerHTML =
      (ats_breakdown || [])
        .map(
          (item) => `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem;">
                <span style="font-weight:600; text-transform:capitalize;">${escapeHtml(item.platform)}</span>
                <span style="font-weight:700; background:#f1f5f9; padding:2px 8px; border-radius:6px;">${item.count} roles</span>
            </div>
        `,
        )
        .join("") ||
      '<div style="color:var(--text-muted);">No ATS data yet.</div>';
  }

  // 3. Priority Breakdown
  const priorityContainer = document.getElementById("priorityBreakdownChart");
  if (priorityContainer) {
    priorityContainer.innerHTML =
      (priority_breakdown || [])
        .map(
          (item) => `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem;">
                <span style="color:#f59e0b;">${"★".repeat(item.priority)}${"☆".repeat(5 - item.priority)}</span>
                <span style="font-weight:700; background:#f1f5f9; padding:2px 8px; border-radius:6px;">${item.count}</span>
            </div>
        `,
        )
        .join("") ||
      '<div style="color:var(--text-muted);">No priority data yet.</div>';
  }

  // 4. Role & Title Non-Rejection Response Rates & Interviews
  const titleContainer = document.getElementById("titleStatsTable");
  if (titleContainer) {
    if (!title_stats || title_stats.length === 0) {
      titleContainer.innerHTML = `<div style="color:var(--text-muted); padding:10px 0;">No title stats yet.</div>`;
    } else {
      const sortedTitleStats = [...title_stats].sort((a, b) => {
        if (b.interviews !== a.interviews) return b.interviews - a.interviews;
        if (b.positive_responses !== a.positive_responses)
          return b.positive_responses - a.positive_responses;
        return b.total - a.total;
      });
      titleContainer.innerHTML = `
                <table style="font-size:0.82rem; width:100%;">
                    <thead>
                        <tr>
                            <th>Role / Specialization</th>
                            <th style="text-align:center;">Applied</th>
                            <th style="text-align:center;" title="Applications that advanced beyond initial apply without rejection">Hearback (Non-Rej)</th>
                            <th style="text-align:center;" title="Applications reaching active interview rounds">Interviews</th>
                            <th style="text-align:right;">Offers</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sortedTitleStats
                          .map(
                            (ts) => `
                            <tr>
                                <td style="font-weight:700; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(ts.title)}">${escapeHtml(ts.title)}</td>
                                <td style="text-align:center; font-weight:600;">${ts.total}</td>
                                <td style="text-align:center; font-weight:700; color: ${ts.positive_response_rate > 20 ? "var(--success)" : "inherit"};">
                                    ${ts.positive_response_rate}% <span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">(${ts.positive_responses})</span>
                                </td>
                                <td style="text-align:center; font-weight:700; color: ${ts.interview_rate > 15 ? "var(--warning)" : "inherit"};">
                                    ${ts.interview_rate}% <span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">(${ts.interviews})</span>
                                </td>
                                <td style="text-align:right; font-weight:700; color: ${ts.offers > 0 ? "var(--success)" : "var(--text-muted)"};">
                                    ${ts.offers}
                                </td>
                            </tr>
                        `,
                          )
                          .join("")}
                    </tbody>
                </table>
            `;
    }
  }

  // 5. Internship vs. Full-Time Performance Comparison
  const internContainer = document.getElementById("internVsFullTimeStats");
  if (internContainer) {
    if (!intern_vs_fulltime) {
      internContainer.innerHTML = `<div style="color:var(--text-muted); padding:10px 0;">No comparison data available yet.</div>`;
    } else {
      const intern = intern_vs_fulltime.internship || {
        total: 0,
        active_pipeline: 0,
        positive_responses: 0,
        positive_response_rate: 0,
        interviews: 0,
        interview_rate: 0,
        offers: 0,
        offer_rate: 0,
        rejections: 0,
        rejection_rate: 0,
      };
      const fulltime = intern_vs_fulltime.fulltime || {
        total: 0,
        active_pipeline: 0,
        positive_responses: 0,
        positive_response_rate: 0,
        interviews: 0,
        interview_rate: 0,
        offers: 0,
        offer_rate: 0,
        rejections: 0,
        rejection_rate: 0,
      };

      internContainer.innerHTML = `
                <table style="font-size:0.82rem; width:100%;">
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th style="text-align:right; color:#4f46e5;">Internships</th>
                            <th style="text-align:right; color:#0284c7;">Full-Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="font-weight:600;">Total Applications</td>
                            <td style="text-align:right; font-weight:700;">${intern.total}</td>
                            <td style="text-align:right; font-weight:700;">${fulltime.total}</td>
                        </tr>
                        <tr>
                            <td style="font-weight:600;">Active In-Progress</td>
                            <td style="text-align:right; color:#0284c7; font-weight:700;">${intern.active_pipeline}</td>
                            <td style="text-align:right; color:#0284c7; font-weight:700;">${fulltime.active_pipeline}</td>
                        </tr>
                        <tr>
                            <td style="font-weight:600;">Non-Rejection Hearback</td>
                            <td style="text-align:right; font-weight:700; color:${intern.positive_response_rate > 20 ? "var(--success)" : "inherit"};">
                                ${intern.positive_response_rate}% <span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">(${intern.positive_responses})</span>
                            </td>
                            <td style="text-align:right; font-weight:700; color:${fulltime.positive_response_rate > 20 ? "var(--success)" : "inherit"};">
                                ${fulltime.positive_response_rate}% <span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">(${fulltime.positive_responses})</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="font-weight:600;">Interview Rate</td>
                            <td style="text-align:right; font-weight:700; color:${intern.interview_rate > 15 ? "var(--warning)" : "inherit"};">
                                ${intern.interview_rate}% <span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">(${intern.interviews})</span>
                            </td>
                            <td style="text-align:right; font-weight:700; color:${fulltime.interview_rate > 15 ? "var(--warning)" : "inherit"};">
                                ${fulltime.interview_rate}% <span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">(${fulltime.interviews})</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="font-weight:600;">Offers Received</td>
                            <td style="text-align:right; font-weight:700; color:var(--success);">
                                ${intern.offers} <span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">(${intern.offer_rate}%)</span>
                            </td>
                            <td style="text-align:right; font-weight:700; color:var(--success);">
                                ${fulltime.offers} <span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">(${fulltime.offer_rate}%)</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="font-weight:600;">Rejection Rate</td>
                            <td style="text-align:right; color:#ef4444; font-weight:600;">
                                ${intern.rejection_rate}% <span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">(${intern.rejections})</span>
                            </td>
                            <td style="text-align:right; color:#ef4444; font-weight:600;">
                                ${fulltime.rejection_rate}% <span style="font-size:0.72rem; color:var(--text-muted); font-weight:500;">(${fulltime.rejections})</span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            `;
    }
  }

  // 6. Location Breakdown & Interactive Geo Map
  const locContainer = document.getElementById("locationBreakdownChart");
  const locMapSvg = document.getElementById("locationMapSvg");
  if (locContainer) {
    locContainer.innerHTML =
      (location_breakdown || [])
        .map(
          (item) => `
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.82rem;">
                <span style="font-weight:600;">${escapeHtml(item.location)}</span>
                <span style="font-weight:700; background:#f1f5f9; padding:2px 8px; border-radius:6px;">${item.count} roles</span>
            </div>
        `,
        )
        .join("") ||
      '<div style="color:var(--text-muted);">No location data yet.</div>';
  }
  if (locMapSvg && location_breakdown) {
    renderLocationMapSvg(locMapSvg, location_breakdown);
  }
}

/**
 * Evaluates the clean Blue colormap (White for 0/none -> Light Sky Blue -> Ocean Blue -> Deep Navy)
 */
function getBlueColor(t) {
  if (!t || t <= 0) return "#ffffff";
  const val = Math.max(0, Math.min(1, t));
  const blueStops = [
    { t: 0.0, r: 255, g: 255, b: 255 }, // #ffffff White
    { t: 0.12, r: 224, g: 242, b: 254 }, // #e0f2fe Softest light blue
    { t: 0.3, r: 186, g: 230, b: 253 }, // #bae6fd Light sky blue
    { t: 0.5, r: 56, g: 189, b: 248 }, // #38bdf8 Sky blue
    { t: 0.7, r: 2, g: 132, b: 199 }, // #0284c7 Ocean blue
    { t: 0.85, r: 3, g: 105, b: 161 }, // #0369a1 Marine blue
    { t: 1.0, r: 10, g: 25, b: 47 }, // #0a192f Deep dense navy
  ];

  for (let i = 0; i < blueStops.length - 1; i++) {
    const s0 = blueStops[i];
    const s1 = blueStops[i + 1];
    if (val >= s0.t && val <= s1.t) {
      const frac = (val - s0.t) / (s1.t - s0.t);
      const r = Math.round(s0.r + (s1.r - s0.r) * frac);
      const g = Math.round(s0.g + (s1.g - s0.g) * frac);
      const b = Math.round(s0.b + (s1.b - s0.b) * frac);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return "rgb(10, 25, 47)";
}

/**
 * Interactive SVG US Geographic Heatmap
 * Blue gradient from White (0 apps) -> Light Ice Blue -> Ocean Blue -> Deep Navy.
 * Features state-clipped localized city thermal heating radiating from active metro centers without edge bleeding.
 * Zero scatter dots / pins for a clean, professional aesthetic.
 */
function renderLocationMapSvg(svg, locations) {
  if (!svg) return;
  const tooltip = document.getElementById("mapTooltip");
  const container = document.getElementById("locationMapSvgContainer");

  const statesData =
    typeof US_STATES_DATA !== "undefined" ? US_STATES_DATA : {};

  // 1. Calculate overall counts, state distribution, and city coordinates per state
  let totalLocationApps = 0;
  const stateCounts = {};
  const stateCities = {}; // key: stateCode -> { cityName: count }
  const stateCityPoints = {}; // key: stateCode -> [ { x, y, label, count } ]

  (locations || []).forEach((loc) => {
    const count = loc.count || 1;
    totalLocationApps += count;
    const text = (loc.location || "").trim();
    if (
      !text ||
      text.toUpperCase().includes("REMOTE") ||
      text.toUpperCase().includes("UNSPECIFIED")
    )
      return;

    // Try city coordinate resolution
    const resolved =
      typeof resolveLocationCoordinates === "function"
        ? resolveLocationCoordinates(text)
        : null;
    if (resolved && resolved.state) {
      const st = resolved.state;
      stateCounts[st] = (stateCounts[st] || 0) + count;
      if (!stateCities[st]) stateCities[st] = {};
      if (!stateCityPoints[st]) stateCityPoints[st] = [];

      const cityName = resolved.label.split(",")[0].trim();
      stateCities[st][cityName] = (stateCities[st][cityName] || 0) + count;
      stateCityPoints[st].push({
        x: resolved.x,
        y: resolved.y,
        label: resolved.label,
        count: count,
      });
    } else {
      // Fallback match to state
      for (const [code, info] of Object.entries(statesData)) {
        const re = new RegExp(
          `\\b(${code}|${info.name.toUpperCase()})\\b`,
          "i",
        );
        if (re.test(text)) {
          stateCounts[code] = (stateCounts[code] || 0) + count;
          break;
        }
      }
    }
  });

  const maxStateCount = Math.max(...Object.values(stateCounts), 1);
  let allCityCounts = [1];
  Object.values(stateCityPoints).forEach((pts) =>
    pts.forEach((p) => allCityCounts.push(p.count)),
  );
  const maxCityCount = Math.max(...allCityCounts);

  // Dynamic State Base Fill using the Blue gradient
  function getStateBaseFill(count) {
    if (!count || count === 0) return "#ffffff";
    const ratio = count / maxStateCount;
    return getBlueColor(Math.max(0.12, ratio * 0.65));
  }

  function getStateStroke(count) {
    if (!count || count === 0) return "#cbd5e1";
    return "#64748b";
  }

  // Build SVG Definitions (ClipPaths per active state + City Heat Radial Gradients + Colorbar)
  let defsHtml = `
        <defs>
            <filter id="panelShadow" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.08"/>
            </filter>
            <filter id="stateElevationShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.25"/>
            </filter>

            <!-- Blue Gradient for Colorbar (White -> Light Blue -> Ocean -> Navy) -->
            <linearGradient id="blueColorbarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="12%" stop-color="#e0f2fe"/>
                <stop offset="30%" stop-color="#bae6fd"/>
                <stop offset="50%" stop-color="#38bdf8"/>
                <stop offset="70%" stop-color="#0284c7"/>
                <stop offset="85%" stop-color="#0369a1"/>
                <stop offset="100%" stop-color="#0a192f"/>
            </linearGradient>
    `;

  // Add state ClipPaths and city localized radial heat gradients
  let gradCounter = 0;
  for (const [code, info] of Object.entries(statesData)) {
    if ((stateCounts[code] || 0) > 0) {
      defsHtml += `
                <clipPath id="clip-state-${code}">
                    <path d="${info.d}"/>
                </clipPath>
            `;

      const pts = stateCityPoints[code] || [];
      pts.forEach((pt) => {
        const cRatio = pt.count / maxCityCount;
        pt.gradId = `cityHeatGrad_${code}_${gradCounter++}`;
        const op1 = Math.min(0.92, 0.65 + cRatio * 0.3);
        const op2 = Math.min(0.70, 0.40 + cRatio * 0.3);
        const op3 = Math.min(0.35, 0.15 + cRatio * 0.2);

        defsHtml += `
                    <radialGradient id="${pt.gradId}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                        <stop offset="0%" stop-color="#0284c7" stop-opacity="${op1}"/>
                        <stop offset="35%" stop-color="#38bdf8" stop-opacity="${op2}"/>
                        <stop offset="70%" stop-color="#bae6fd" stop-opacity="${op3}"/>
                        <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
                    </radialGradient>
                `;
      });
    }
  }

  defsHtml += `</defs>`;

  let svgHtml = `
        ${defsHtml}
        <!-- Canvas Background -->
        <rect x="0" y="0" width="960" height="600" fill="#f8fafc"/>
        
        <!-- Base State Geometries Group -->
        <g id="statesGroup">
    `;

  // 2. Render State Polygons with internal city thermal heating strictly clipped to GIS boundary
  for (const [code, info] of Object.entries(statesData)) {
    const count = stateCounts[code] || 0;
    const fill = getStateBaseFill(count);
    const stroke = getStateStroke(count);
    const strokeWidth = count > 0 ? "1.15" : "0.75";
    const citiesData = stateCities[code]
      ? JSON.stringify(stateCities[code])
      : "{}";
    const cityPts = stateCityPoints[code] || [];

    svgHtml += `
            <g id="state-container-${code}" 
               class="us-state-container" 
               data-state-code="${code}" 
               data-state-name="${info.name}" 
               data-count="${count}"
               data-cities='${citiesData.replace(/'/g, "&apos;")}'
               style="cursor: pointer; transform-origin: center center; transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.18s ease;">
                
                <!-- Base State Polygon -->
                <path id="state-path-${code}" 
                      class="us-state-boundary" 
                      d="${info.d}" 
                      fill="${fill}" 
                      stroke="${stroke}" 
                      stroke-width="${strokeWidth}" 
                      style="transition: stroke 0.18s ease, stroke-width 0.18s ease;"/>

                <!-- Strictly Boundary-Clipped City Thermal Heat Layer (Zero Edge Bleeding) -->
                ${
                  cityPts.length > 0
                    ? `
                    <g clip-path="url(#clip-state-${code})" style="pointer-events: none;">
                        ${cityPts
                          .map((pt) => {
                            const cRatio = pt.count / maxCityCount;
                            const radius = Math.max(
                              42,
                              Math.min(95, 42 + cRatio * 45),
                            );
                            return `<circle cx="${pt.x}" cy="${pt.y}" r="${radius}" fill="url(#${pt.gradId})"/>`;
                          })
                          .join("")}
                    </g>
                `
                    : ""
                }
            </g>
        `;
  }

  svgHtml += `</g>`;

  // 3. Render State Centroid Text Labels in overlay group
  svgHtml += `<g id="stateLabelsGroup" style="pointer-events: none;">`;
  for (const [code, info] of Object.entries(statesData)) {
    const count = stateCounts[code] || 0;
    if (info.center && info.center.x > 0) {
      let textColor = count > 0 ? "#0369a1" : "#64748b";

      svgHtml += `
                <text id="state-label-${code}" 
                      x="${info.center.x}" y="${info.center.y + 3.5}" 
                      fill="${textColor}" 
                      font-size="${count > 0 ? "10" : "8.5"}" 
                      font-weight="${count > 0 ? "800" : "600"}" 
                      text-anchor="middle" 
                      style="select:none; letter-spacing:0.5px;">
                    ${code}
                </text>
            `;
    }
  }
  svgHtml += `</g>`;

  // 4. Clean Matplotlib-Style Colorbar (Blue Gradient: White -> Navy)
  svgHtml += `
        <g transform="translate(24, 536)">
            <rect x="0" y="0" width="220" height="42" fill="#ffffff" rx="6" stroke="#cbd5e1" opacity="0.95" filter="url(#panelShadow)"/>
            
            <text x="12" y="16" font-size="9.5" fill="#1e293b" font-weight="700">Applications (City & State Density)</text>
            
            <!-- Continuous Blue Gradient Bar -->
            <rect x="12" y="22" width="196" height="8" rx="2" fill="url(#blueColorbarGrad)" stroke="#cbd5e1" stroke-width="0.5"/>
            
            <!-- Ticks & Labels -->
            <text x="12" y="38" font-size="7.5" fill="#64748b" font-weight="600">0 (None)</text>
            <text x="75" y="38" font-size="7.5" fill="#64748b" font-weight="600">Low</text>
            <text x="135" y="38" font-size="7.5" fill="#64748b" font-weight="600">Med</text>
            <text x="208" y="38" font-size="7.5" fill="#0a192f" font-weight="700" text-anchor="end">Max (${maxStateCount})</text>
        </g>
    `;

  svg.innerHTML = svgHtml;

  // 5. Interactive Pop-up Hover Handlers
  if (tooltip && container) {
    svg.querySelectorAll(".us-state-container").forEach((stateGroup) => {
      const path = stateGroup.querySelector(".us-state-boundary");
      const originalStroke = path ? path.getAttribute("stroke") : "#cbd5e1";
      const originalStrokeWidth = path
        ? path.getAttribute("stroke-width")
        : "0.75";
      const code = stateGroup.getAttribute("data-state-code");
      const name = stateGroup.getAttribute("data-state-name");
      const count = parseInt(stateGroup.getAttribute("data-count") || "0");
      let citiesObj = {};
      try {
        citiesObj = JSON.parse(stateGroup.getAttribute("data-cities") || "{}");
      } catch (e) {}

      stateGroup.addEventListener("mouseenter", (e) => {
        // Bring hovered state container to top of group so shadow renders cleanly
        const parent = stateGroup.parentNode;
        if (parent && parent.lastChild !== stateGroup) {
          parent.appendChild(stateGroup);
        }

        // Elevation pop-up effect
        stateGroup.style.transform = "translateY(-4px) scale(1.012)";
        stateGroup.style.filter = "url(#stateElevationShadow)";
        if (path) {
          path.style.stroke = "#0284c7";
          path.style.strokeWidth = "2.2px";
        }

        const pct =
          totalLocationApps > 0
            ? ((count / totalLocationApps) * 100).toFixed(1)
            : 0;

        let tooltipContent = `<strong>${name} (${code})</strong><br/>${count} application${count === 1 ? "" : "s"} (${pct}% of pipeline)`;

        const cityEntries = Object.entries(citiesObj);
        if (cityEntries.length > 0) {
          const cityListText = cityEntries
            .sort((a, b) => b[1] - a[1])
            .map(([cName, cCount]) => `${cName}: ${cCount}`)
            .join(", ");
          tooltipContent += `<br/><span style="color:#38bdf8; font-size:0.75rem; font-weight:700; display:inline-flex; align-items:center; gap:3px;"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${cityListText}</span>`;
        }

        tooltip.style.display = "block";
        tooltip.innerHTML = tooltipContent;
      });

      stateGroup.addEventListener("mouseleave", () => {
        // Reset state to resting position
        stateGroup.style.transform = "translateY(0) scale(1)";
        stateGroup.style.filter = "none";
        if (path) {
          path.style.stroke = originalStroke;
          path.style.strokeWidth = originalStrokeWidth;
        }

        tooltip.style.display = "none";
      });
    });

    container.addEventListener("mousemove", (e) => {
      if (tooltip.style.display === "block") {
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left + 12;
        const y = e.clientY - rect.top + 12;
        tooltip.style.left = `${Math.min(x, rect.width - 180)}px`;
        tooltip.style.top = `${Math.min(y, rect.height - 65)}px`;
      }
    });
  }
}

/**
 * Chronological SVG Timeline Range Renderer
 * X-axis: Chronological Time (earliest to latest)
 * Y-axis: Application Count (0 at bottom, rising upwards)
 * Top Line: Cumulative Total Applications (Ocean Blue)
 * Bottom Line: Cumulative Rejections (Crimson Red, rising from 0)
 * Range Band (Between Top and Bottom): Active In-Flight Pipeline
 */
function renderTimelineRangeSvg(svg, timelineData) {
  if (!timelineData || timelineData.length === 0) {
    svg.innerHTML = `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="13">No application activity recorded yet</text>`;
    return;
  }

  const width = Math.max(
    svg.clientWidth || (svg.parentElement ? svg.parentElement.clientWidth : 700),
    300,
  );
  const height = 260;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.overflow = "hidden";
  const paddingLeft = 45;
  const paddingRight = 35;
  const paddingTop = 30;
  const paddingBottom = 40;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingLeft - paddingRight;

  // Calculate maximum value for Y-axis scaling
  let maxVal = Math.max(
    ...timelineData.map((d) =>
      Math.max(
        d.cumulative_applied || d.applied || 0,
        d.cumulative_rejected || d.rejected || 0,
        d.open_active || 0,
      ),
    ),
    4,
  );
  const yTickCount = 4;
  const yStep = Math.ceil(maxVal / yTickCount);
  maxVal = yStep * yTickCount;

  const stepX = chartWidth / Math.max(timelineData.length - 1, 1);
  const zeroY = height - paddingBottom;

  function getY(val) {
    return zeroY - (val / maxVal) * chartHeight;
  }

  const topPoints = [];
  const botPoints = [];

  timelineData.forEach((d, i) => {
    const x = paddingLeft + i * stepX;
    const cumApp =
      d.cumulative_applied !== undefined
        ? d.cumulative_applied
        : d.applied || 0;
    const cumRej =
      d.cumulative_rejected !== undefined
        ? d.cumulative_rejected
        : d.rejected || 0;

    const yTop = getY(cumApp);
    const yBot = getY(cumRej);

    topPoints.push({ x, y: yTop, data: d, cumApp, cumRej });
    botPoints.push({ x, y: yBot, data: d, cumApp, cumRej });
  });

  /**
   * Fritsch-Carlson Monotone Cubic Spline Interpolation
   * Strictly preserves monotonicity so the cumulative curve NEVER dips before rising.
   */
  function getMonotoneCubicSplinePath(points) {
    if (!points || points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    if (points.length === 2)
      return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;

    const n = points.length;
    const deltas = [];
    for (let k = 0; k < n - 1; k++) {
      const dx = points[k + 1].x - points[k].x;
      const dy = points[k + 1].y - points[k].y;
      deltas.push(dx !== 0 ? dy / dx : 0);
    }

    const m = new Array(n).fill(0);
    m[0] = deltas[0];
    m[n - 1] = deltas[n - 2];
    for (let k = 1; k < n - 1; k++) {
      m[k] = (deltas[k - 1] + deltas[k]) / 2.0;
    }

    for (let k = 0; k < n - 1; k++) {
      if (deltas[k] === 0) {
        m[k] = 0;
        m[k + 1] = 0;
      } else {
        const alpha = m[k] / deltas[k];
        const beta = m[k + 1] / deltas[k];
        if (alpha < 0) m[k] = 0;
        if (beta < 0) m[k + 1] = 0;
        const norm = Math.sqrt(alpha * alpha + beta * beta);
        if (norm > 3) {
          const tau = 3.0 / norm;
          m[k] = tau * alpha * deltas[k];
          m[k + 1] = tau * beta * deltas[k];
        }
      }
    }

    let path = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
    for (let k = 0; k < n - 1; k++) {
      const p1 = points[k];
      const p2 = points[k + 1];
      const dx = (p2.x - p1.x) / 3.0;
      const cp1x = p1.x + dx;
      const cp1y = p1.y + m[k] * dx;
      const cp2x = p2.x - dx;
      const cp2y = p2.y - m[k + 1] * dx;
      path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return path;
  }

  function getRangeAreaPath(topPts, botPts) {
    if (topPts.length < 2) return "";
    const topSpline = getMonotoneCubicSplinePath(topPts);
    const revBot = [...botPts].reverse();

    let botPath = `L ${revBot[0].x.toFixed(1)},${revBot[0].y.toFixed(1)}`;
    for (let k = 1; k < revBot.length; k++) {
      botPath += ` L ${revBot[k].x.toFixed(1)},${revBot[k].y.toFixed(1)}`;
    }
    return `${topSpline} ${botPath} Z`;
  }

  function getRejectionFillPath(botPts) {
    if (botPts.length < 2) return "";
    const botSpline = getMonotoneCubicSplinePath(botPts);
    const lastX = botPts[botPts.length - 1].x.toFixed(1);
    const firstX = botPts[0].x.toFixed(1);
    return `${botSpline} L ${lastX},${zeroY} L ${firstX},${zeroY} Z`;
  }

  const rangeAreaD = getRangeAreaPath(topPoints, botPoints);
  const rejAreaD = getRejectionFillPath(botPoints);
  const topSplineD = getMonotoneCubicSplinePath(topPoints);
  const botSplineD = getMonotoneCubicSplinePath(botPoints);

  let svgHtml = `
        <defs>
            <linearGradient id="activeRangeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#0284c7" stop-opacity="0.35"/>
                <stop offset="100%" stop-color="#0284c7" stop-opacity="0.08"/>
            </linearGradient>
            <linearGradient id="rejectionAreaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ef4444" stop-opacity="0.25"/>
                <stop offset="100%" stop-color="#ef4444" stop-opacity="0.03"/>
            </linearGradient>
            <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
        </defs>
    `;

  // Horizontal Grid Lines & Y-Axis Labels
  for (let i = 0; i <= yTickCount; i++) {
    const val = i * yStep;
    const y = getY(val);
    svgHtml += `
            <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="${i === 0 ? "none" : "4 4"}"/>
            <text x="${paddingLeft - 8}" y="${y + 4}" font-size="10" fill="#94a3b8" text-anchor="end" font-weight="600">${val}</text>
        `;
  }

  // Active Pipeline Range Shaded Area
  if (rangeAreaD) {
    svgHtml += `<path d="${rangeAreaD}" fill="url(#activeRangeGrad)" />`;
  }

  // Rejection Under-curve Fill
  if (rejAreaD) {
    svgHtml += `<path d="${rejAreaD}" fill="url(#rejectionAreaGrad)" />`;
  }

  // Top Applications Spline Line (Ocean Blue)
  if (topSplineD) {
    svgHtml += `<path d="${topSplineD}" fill="none" stroke="#0284c7" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // Bottom Rejections Spline Line (Crimson Red)
  if (botSplineD) {
    svgHtml += `<path d="${botSplineD}" fill="none" stroke="#ef4444" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // 1. Identify active days where actual events occurred
  const activeDayIndices = [];
  timelineData.forEach((d, i) => {
    if ((d.applied && d.applied > 0) || (d.rejected && d.rejected > 0)) {
      activeDayIndices.push(i);
    }
  });

  // 2. Select non-overlapping date ticks ONLY on days that mattered
  const axisTickIndices = new Set();
  const minTickSpacing = 60; // minimum pixels between date labels to prevent any text overlap
  let lastLabeledX = -999;

  activeDayIndices.forEach((idx) => {
    const pt = topPoints[idx];
    if (pt.x - lastLabeledX >= minTickSpacing) {
      axisTickIndices.add(idx);
      lastLabeledX = pt.x;
    }
  });

  // If no active days yet or only 1, fallback to first/last clean boundary
  if (axisTickIndices.size === 0 && timelineData.length > 0) {
    axisTickIndices.add(0);
    if (timelineData.length > 1) axisTickIndices.add(timelineData.length - 1);
  }

  // 3. Render event markers and non-overlapping axis ticks
  timelineData.forEach((d, i) => {
    const ptTop = topPoints[i];
    const ptBot = botPoints[i];

    // BLUE (Applied) DOT: ONLY on days of new applications
    if (d.applied && d.applied > 0) {
      svgHtml += `
            <circle cx="${ptTop.x}" cy="${ptTop.y}" r="5" fill="#0284c7" stroke="#ffffff" stroke-width="2" />
            <text x="${ptTop.x}" y="${ptTop.y - 8}" font-size="9.5" font-weight="700" fill="#0369a1" text-anchor="middle">+${d.applied}</text>
        `;
    }

    // RED (Rejected) DOT: ONLY on days of new rejections
    if (d.rejected && d.rejected > 0) {
      svgHtml += `
            <circle cx="${ptBot.x}" cy="${ptBot.y}" r="5" fill="#ef4444" stroke="#ffffff" stroke-width="2" />
            <text x="${ptBot.x}" y="${ptBot.y + 14}" font-size="9.5" font-weight="700" fill="#b91c1c" text-anchor="middle">-${d.rejected}</text>
        `;
    }

    // X-AXIS TICKS: ONLY on days that mattered with collision avoidance
    if (axisTickIndices.has(i)) {
      const dateLabel = d.date.length > 5 ? d.date.substring(5) : d.date;
      svgHtml += `
            <line x1="${ptTop.x}" y1="${zeroY}" x2="${ptTop.x}" y2="${zeroY + 5}" stroke="#cbd5e1" stroke-width="1.2"/>
            <text x="${ptTop.x}" y="${zeroY + 18}" font-size="10" fill="#64748b" font-weight="600" text-anchor="middle">${dateLabel}</text>
        `;
    }
  });

  // Interactive Hover Tracking Group
  svgHtml += `
        <g id="timelineCrosshairGroup" style="display:none; pointer-events:none;">
            <line id="timelineCrosshairLine" x1="0" y1="${paddingTop}" x2="0" y2="${zeroY}" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3 3"/>
            <circle id="timelineTopHoverCircle" cx="0" cy="0" r="6" fill="#0284c7" stroke="#ffffff" stroke-width="2.5" filter="url(#glowEffect)"/>
            <circle id="timelineBotHoverCircle" cx="0" cy="0" r="6" fill="#ef4444" stroke="#ffffff" stroke-width="2.5" filter="url(#glowEffect)"/>
        </g>
    `;

  svg.innerHTML = svgHtml;

  // Attach Interactive Tooltip Mouse Movement
  const container = svg.closest("#timelineChartContainer") || svg.parentElement;
  let tooltip = document.getElementById("timelineTooltip");
  if (!tooltip && container) {
    tooltip = document.createElement("div");
    tooltip.id = "timelineTooltip";
    tooltip.style.cssText =
      "position:absolute; display:none; pointer-events:none; background:rgba(15,23,42,0.94); color:#ffffff; padding:8px 14px; border-radius:8px; font-size:0.78rem; box-shadow:0 8px 24px rgba(0,0,0,0.25); z-index:100; backdrop-filter:blur(4px); border:1px solid rgba(255,255,255,0.12);";
    container.style.position = "relative";
    container.appendChild(tooltip);
  }

  svg.onmousemove = (e) => {
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    if (mouseX < paddingLeft || mouseX > width - paddingRight) {
      if (tooltip) tooltip.style.display = "none";
      const ch = svg.querySelector("#timelineCrosshairGroup");
      if (ch) ch.style.display = "none";
      return;
    }

    const idx = Math.min(
      Math.max(0, Math.round((mouseX - paddingLeft) / stepX)),
      timelineData.length - 1,
    );
    const ptTop = topPoints[idx];
    const ptBot = botPoints[idx];
    const d = timelineData[idx];

    const ch = svg.querySelector("#timelineCrosshairGroup");
    const chLine = svg.querySelector("#timelineCrosshairLine");
    const topCirc = svg.querySelector("#timelineTopHoverCircle");
    const botCirc = svg.querySelector("#timelineBotHoverCircle");

    if (ch && chLine && topCirc && botCirc) {
      ch.style.display = "block";
      chLine.setAttribute("x1", ptTop.x);
      chLine.setAttribute("x2", ptTop.x);
      topCirc.setAttribute("cx", ptTop.x);
      topCirc.setAttribute("cy", ptTop.y);
      botCirc.setAttribute("cx", ptBot.x);
      botCirc.setAttribute("cy", ptBot.y);
    }

    if (tooltip) {
      tooltip.style.display = "block";
      const leftPos = Math.min(ptTop.x + 15, width - 190);
      const topPos = Math.max(10, ptTop.y - 30);
      tooltip.style.left = `${leftPos}px`;
      tooltip.style.top = `${topPos}px`;

      const activeCount = Math.max(0, ptTop.cumApp - ptBot.cumRej);
      tooltip.innerHTML = `
                <div style="font-weight:700; color:#f8fafc; margin-bottom:4px; font-size:0.82rem; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:3px; display:flex; align-items:center; gap:4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    <span>${escapeHtml(d.date)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin:3px 0; color:#bae6fd;">
                    <span style="display:inline-flex; align-items:center; gap:5px;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#0284c7;"></span>Total Applied:</span>
                    <strong>${ptTop.cumApp} <span style="font-size:0.7rem; color:#93c5fd;">(+${d.applied || 0})</span></strong>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin:3px 0; color:#fde047;">
                    <span style="display:inline-flex; align-items:center; gap:5px;"><span style="display:inline-block; width:8px; height:8px; border-radius:2px; background:rgba(2, 132, 199, 0.4); border:1px solid #0284c7;"></span>Active Pipeline:</span>
                    <strong>${activeCount} active</strong>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:16px; margin:3px 0; color:#fca5a5;">
                    <span style="display:inline-flex; align-items:center; gap:5px;"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#ef4444;"></span>Total Rejected:</span>
                    <strong>${ptBot.cumRej} <span style="font-size:0.7rem; color:#f87171;">(-${d.rejected || 0})</span></strong>
                </div>
            `;
    }
  };

  svg.onmouseleave = () => {
    if (tooltip) tooltip.style.display = "none";
    const ch = svg.querySelector("#timelineCrosshairGroup");
    if (ch) ch.style.display = "none";
  };
}

let currentSelectedResume = null;
let isPdfPreviewOpen = false;

/**
 * 9. Resume Version Manager with YAML & PDF File Upload, Preview, and Attachment
 */
function initResumeManager() {
  const openAddBtn = document.getElementById("openAddResumeBtn");
  const closeAddBtn = document.getElementById("closeAddResumeBtn");
  const cancelAddBtn = document.getElementById("cancelAddResumeBtn");
  const modal = document.getElementById("addResumeModal");
  const form = document.getElementById("createResumeForm");
  const pdfFileInput = document.getElementById("r_pdf_file");
  const pdfStatus = document.getElementById("pdfUploadStatus");

  const attachPdfToActiveBtn = document.getElementById("attachPdfToActiveBtn");
  const togglePdfViewBtn = document.getElementById("togglePdfViewBtn");
  const downloadPdfBtn = document.getElementById("downloadPdfBtn");

  let loadedPdfBase64 = null;
  let loadedPdfFileName = null;

  // Delegated click handler on resumes container (CSP-compliant, no inline onclick)
  const resumesContainer = document.getElementById("resumesListContainer");
  resumesContainer?.addEventListener("click", (e) => {
    const delBtn = e.target.closest(".delete-resume-btn");
    if (delBtn) {
      e.stopPropagation();
      const id = parseInt(delBtn.getAttribute("data-id"));
      if (id) deleteResumeVersion(id);
      return;
    }

    const attachBtn = e.target.closest(".attach-pdf-btn");
    if (attachBtn) {
      e.stopPropagation();
      const id = parseInt(attachBtn.getAttribute("data-id"));
      if (id) attachPdfToResumeVersion(id);
      return;
    }

    const card = e.target.closest(".resume-card-item");
    if (card) {
      const id = parseInt(card.getAttribute("data-id"));
      if (id) selectResumeVersion(id);
    }
  });

  attachPdfToActiveBtn?.addEventListener("click", () => {
    if (currentSelectedResume) {
      attachPdfToResumeVersion(currentSelectedResume.id);
    } else if (resumesData.length > 0) {
      attachPdfToResumeVersion(resumesData[0].id);
    } else {
      openAddBtn?.click();
    }
  });

  togglePdfViewBtn?.addEventListener("click", () => {
    const diffViewer = document.getElementById("resumeDiffViewer");
    const pdfFrame = document.getElementById("resumePdfPreviewFrame");
    if (!currentSelectedResume || !currentSelectedResume.pdf_base64) return;

    isPdfPreviewOpen = !isPdfPreviewOpen;
    if (isPdfPreviewOpen) {
      diffViewer.style.display = "none";
      pdfFrame.style.display = "block";
      pdfFrame.src = currentSelectedResume.pdf_base64;
      togglePdfViewBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>View YAML Diff`;
    } else {
      diffViewer.style.display = "block";
      pdfFrame.style.display = "none";
      togglePdfViewBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>Preview PDF`;
    }
  });

  downloadPdfBtn?.addEventListener("click", () => {
    if (!currentSelectedResume || !currentSelectedResume.pdf_base64) return;
    const link = document.createElement("a");
    link.href = currentSelectedResume.pdf_base64;
    link.download =
      currentSelectedResume.pdf_file_name ||
      `${currentSelectedResume.name}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  pdfFileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      loadedPdfFileName = file.name;
      const reader = new FileReader();
      reader.onload = () => {
        loadedPdfBase64 = reader.result;
        if (pdfStatus)
          pdfStatus.innerHTML = `<span style="display:inline-flex; align-items:center; gap:4px; color:#166534;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> PDF loaded: ${escapeHtml(file.name)} (${Math.round(file.size / 1024)} KB)</span>`;
      };
      reader.readAsDataURL(file);
    }
  });

  openAddBtn?.addEventListener("click", () => {
    populateParentResumeSelect();
    loadedPdfBase64 = null;
    loadedPdfFileName = null;
    if (pdfStatus) pdfStatus.innerText = "";
    modal.classList.add("open");
  });

  const closeModal = () => modal.classList.remove("open");
  closeAddBtn?.addEventListener("click", closeModal);
  cancelAddBtn?.addEventListener("click", closeModal);

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById("r_name").value.trim(),
      version_tag: document.getElementById("r_tag").value.trim() || "v1.0",
      parent_id: document.getElementById("r_parent_id").value
        ? parseInt(document.getElementById("r_parent_id").value)
        : null,
      commit_message:
        document.getElementById("r_commit_msg").value.trim() ||
        "Updated resume version",
      content: document.getElementById("r_content").value,
      pdf_base64: loadedPdfBase64,
      pdf_file_name: loadedPdfFileName,
    };

    try {
      const res = await fetch(`${API_BASE}/resumes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        form.reset();
        closeModal();
        showToast("Resume version committed!");
        loadResumesData();
      }
    } catch (err) {
      console.error("Error creating resume version:", err);
    }
  });
}

async function loadResumesData() {
  try {
    const res = await fetch(`${API_BASE}/resumes`);
    const json = await res.json();
    resumesData = json.data || [];
    renderResumesList(resumesData);
  } catch (err) {
    console.error("Failed to load resumes:", err);
  }
}

function renderResumesList(resumes) {
  const container = document.getElementById("resumesListContainer");
  if (!container) return;

  if (resumes.length === 0) {
    container.innerHTML = `<div style="font-size:0.85rem; color:var(--text-muted); padding:16px 0;">
            No resume versions tracked yet. Click "+ New Version" to add your master YAML/PDF resume.
        </div>`;
    return;
  }

  container.innerHTML = resumes
    .map((r) => {
      const isSelected =
        currentSelectedResume && currentSelectedResume.id === r.id;
      const pdfBadgeHtml = r.has_pdf
        ? `<span style="display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>${escapeHtml(r.pdf_file_name || "PDF Connected")}</span>`
        : `<span style="display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>Text/YAML (Auto-PDF)</span>`;

      return `
        <div class="resume-card-item ${isSelected ? "resume-card-active" : ""}" data-id="${r.id}" style="background:${isSelected ? "#fffdf5" : "#f8fafc"}; border:${isSelected ? "2px solid var(--accent-gold)" : "1px solid var(--border-color)"}; border-radius:8px; padding:12px; cursor:pointer; transition:all 0.15s ease;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:700; font-size:0.9rem; color:var(--text-main);">${escapeHtml(r.name)}</span>
                <span style="font-size:0.72rem; background:${isSelected ? "var(--accent-gold)" : "#e2e8f0"}; color:${isSelected ? "#ffffff" : "inherit"}; font-weight:700; padding:2px 6px; border-radius:4px;">${escapeHtml(r.version_tag)}</span>
            </div>
            <div style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;">
                ${escapeHtml(r.commit_message || "Version created")}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:0.72rem; color:var(--text-muted);">
                <span>${pdfBadgeHtml}</span>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button class="action-btn attach-pdf-btn" data-id="${r.id}" style="padding:2px 8px; font-size:0.7rem;">
                        ${r.has_pdf ? "Change PDF" : "+ Attach PDF"}
                    </button>
                    <button class="action-btn delete-resume-btn" data-id="${r.id}" style="padding:3px 8px; font-size:0.7rem; background:#fee2e2; color:#991b1b; border:1px solid #f87171; font-weight:600; cursor:pointer;">Delete</button>
                </div>
            </div>
        </div>
    `;
    })
    .join("");

  if (resumes.length > 0 && !currentSelectedResume) {
    selectResumeVersion(resumes[0].id);
  }
}

window.attachPdfToResumeVersion = function (resumeId) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result;
      try {
        const res = await fetch(`${API_BASE}/resumes/${resumeId}/pdf`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdf_base64: base64,
            pdf_file_name: file.name,
          }),
        });
        if (res.ok) {
          showToast(`Attached ${file.name} to resume version`);
          // Update chrome.storage.local cache immediately
          if (
            typeof chrome !== "undefined" &&
            chrome.runtime &&
            chrome.runtime.sendMessage
          ) {
            chrome.runtime.sendMessage({
              action: "getProfileAndResume",
              forceReload: true,
            });
          }
          loadResumesData();
          selectResumeVersion(resumeId);
        }
      } catch (err) {
        console.error("Failed to upload resume PDF:", err);
      }
    };
    reader.readAsDataURL(file);
  };
  input.click();
};

window.selectResumeVersion = async function (resumeId) {
  try {
    const res = await fetch(`${API_BASE}/resumes/${resumeId}`);
    const json = await res.json();
    const r = json.data;
    if (!r) return;

    currentSelectedResume = r;
    document.getElementById("resumeViewerTitle").innerText =
      `${r.name} (${r.version_tag}) ${r.parent_name ? "• Forked from " + r.parent_name : ""}`;

    const badge = document.getElementById("resumePdfBadge");
    const toggleBtn = document.getElementById("togglePdfViewBtn");
    const downloadBtn = document.getElementById("downloadPdfBtn");
    const diffViewer = document.getElementById("resumeDiffViewer");
    const pdfFrame = document.getElementById("resumePdfPreviewFrame");

    if (r.pdf_base64) {
      const sizeKb = Math.round((r.pdf_base64.length * 3) / 4 / 1024);
      badge.innerHTML = `<span style="color:#166534; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>Attached PDF:</span> <strong>${escapeHtml(r.pdf_file_name || "Resume.pdf")}</strong> (${sizeKb} KB)`;
      toggleBtn.style.display = "inline-flex";
      downloadBtn.style.display = "inline-flex";
      if (isPdfPreviewOpen) {
        pdfFrame.src = r.pdf_base64;
      }
    } else {
      badge.innerHTML = `<span style="color:#854d0e; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#854d0e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>No PDF file attached</span> — GRTS will auto-generate standard PDF on upload. Click "+ Attach / Replace PDF" to connect your compiled PDF.`;
      toggleBtn.style.display = "none";
      downloadBtn.style.display = "none";
      isPdfPreviewOpen = false;
      diffViewer.style.display = "block";
      pdfFrame.style.display = "none";
    }

    if (r.parent_content) {
      diffViewer.innerHTML = computeSimpleDiff(r.parent_content, r.content);
    } else {
      diffViewer.innerText = r.content;
    }
  } catch (e) {
    console.error("Error viewing resume:", e);
  }
};

window.deleteResumeVersion = async function (resumeId) {
  if (!confirm("Are you sure you want to delete this resume version?")) return;
  try {
    await fetch(`${API_BASE}/resumes/${resumeId}`, { method: "DELETE" });
    showToast("Resume version deleted");
    loadResumesData();
  } catch (e) {
    console.error("Failed to delete resume:", e);
  }
};

function populateParentResumeSelect() {
  const sel = document.getElementById("r_parent_id");
  if (!sel) return;
  sel.innerHTML =
    '<option value="">None (Master Base Resume)</option>' +
    resumesData
      .map(
        (r) =>
          `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.version_tag)})</option>`,
      )
      .join("");
}

function computeSimpleDiff(oldText, newText) {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  let html = "";

  const maxLines = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLines; i++) {
    const o = oldLines[i];
    const n = newLines[i];

    if (o === n) {
      html += `${escapeHtml(n || "")}\n`;
    } else {
      if (o !== undefined)
        html += `<span class="diff-removed">- ${escapeHtml(o)}</span>`;
      if (n !== undefined)
        html += `<span class="diff-added">+ ${escapeHtml(n)}</span>`;
    }
  }
  return html;
}

/**
 * 10. Q&A Bank View with Reliable Copy & Delete Event Delegation
 */
function renderQABank(questions) {
  const qaGrid = document.getElementById("qaBankGrid");
  if (!qaGrid) return;

  if (questions.length === 0) {
    qaGrid.innerHTML = `<div style="grid-column: 1/-1;" class="empty-state">
            <h3>Question Bank is Empty</h3>
            <p>Non-standard application questions and your answers will be automatically cataloged here for instant reuse.</p>
        </div>`;
    return;
  }

  qaGrid.innerHTML = questions
    .map((q) => {
      const isUnfilled =
        !q.answer_text ||
        q.answer_text.trim() === "" ||
        q.answer_text.trim() === "[Unfilled]";
      const cardBorder = isUnfilled
        ? "border: 1px solid #fdba74; background: #fff7ed;"
        : "";
      const badge = isUnfilled
        ? `<span style="font-size:0.7rem; font-weight:700; background:#ffedd5; color:#c2410c; border:1px solid #fed7aa; padding:1px 6px; border-radius:4px; margin-left:6px;">Unfilled / Needs Review</span>`
        : "";
      const answerDisplay = isUnfilled
        ? "Not filled out"
        : escapeHtml(q.answer_text);

      return `
        <div class="qa-bank-card" id="qabank-card-${q.id}" data-qa-id="${q.id}" style="${cardBorder}">
            <!-- View Mode -->
            <div id="qabank-view-${q.id}">
                <div>
                    <div class="qa-bank-question" style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
                        <span>${escapeHtml(q.question_text)}</span>
                        ${badge}
                    </div>
                    <div class="qa-bank-answer" data-answer-content="${escapeHtml(q.answer_text || "")}" style="color:${isUnfilled ? "#9a3412" : "var(--text-muted)"}; font-weight:${isUnfilled ? "600" : "400"}; white-space: pre-wrap;">${answerDisplay}</div>
                </div>
                <div class="qa-bank-footer">
                    <span>${escapeHtml(q.company_name || "Application")} • ${escapeHtml(q.job_title || "")}</span>
                    <div style="display:flex; gap:6px;">
                        <button class="action-btn qabank-edit-btn" data-qa-id="${q.id}">Edit</button>
                        <button class="action-btn qa-copy-btn" data-copy-text="${escapeHtml(q.answer_text || "")}">Copy</button>
                        <button class="action-btn action-btn-danger qa-delete-btn" data-qa-id="${q.id}">Delete</button>
                    </div>
                </div>
            </div>

            <!-- Edit Mode -->
            <div id="qabank-edit-${q.id}" style="display: none; padding: 4px 0;">
                <div style="margin-bottom: 6px;">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 2px;">Question</label>
                    <input type="text" id="qabank-input-q-${q.id}" value="${escapeHtml(q.question_text)}" style="width: 100%; box-sizing: border-box; padding: 6px 8px; font-size: 0.82rem; border: 1px solid var(--border-color); border-radius: 6px;" />
                </div>
                <div style="margin-bottom: 6px;">
                    <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 2px;">Answer</label>
                    <textarea id="qabank-input-a-${q.id}" rows="3" style="width: 100%; box-sizing: border-box; padding: 6px 8px; font-size: 0.82rem; border: 1px solid var(--border-color); border-radius: 6px;">${escapeHtml(q.answer_text || "")}</textarea>
                </div>
                <div style="display: flex; gap: 6px; justify-content: flex-end;">
                    <button type="button" class="btn-secondary qabank-cancel-edit-btn" data-qa-id="${q.id}" style="padding: 3px 8px; font-size: 0.75rem; cursor: pointer;">Cancel</button>
                    <button type="button" class="btn-primary-gold qabank-save-edit-btn" data-qa-id="${q.id}" style="padding: 3px 10px; font-size: 0.75rem; cursor: pointer;">Save</button>
                </div>
            </div>
        </div>
    `;
    })
    .join("");
}

function initQABankActionListeners() {
  document.addEventListener("click", async (e) => {
    // Edit Action in Bank
    const editBtn = e.target.closest(".qabank-edit-btn");
    if (editBtn) {
      const qaId = editBtn.getAttribute("data-qa-id");
      const viewEl = document.getElementById(`qabank-view-${qaId}`);
      const editEl = document.getElementById(`qabank-edit-${qaId}`);
      if (viewEl && editEl) {
        viewEl.style.display = "none";
        editEl.style.display = "block";
      }
      return;
    }

    // Cancel Edit in Bank
    const cancelBtn = e.target.closest(".qabank-cancel-edit-btn");
    if (cancelBtn) {
      const qaId = cancelBtn.getAttribute("data-qa-id");
      const viewEl = document.getElementById(`qabank-view-${qaId}`);
      const editEl = document.getElementById(`qabank-edit-${qaId}`);
      if (viewEl && editEl) {
        viewEl.style.display = "block";
        editEl.style.display = "none";
      }
      return;
    }

    // Save Edit in Bank
    const saveBtn = e.target.closest(".qabank-save-edit-btn");
    if (saveBtn) {
      const qaId = saveBtn.getAttribute("data-qa-id");
      const qInput = document.getElementById(`qabank-input-q-${qaId}`);
      const aInput = document.getElementById(`qabank-input-a-${qaId}`);
      if (!qInput || !aInput) return;
      const questionText = qInput.value.trim();
      const answerText = aInput.value.trim();
      if (!questionText) {
        alert("Question text cannot be empty.");
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/questions/${qaId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question_text: questionText,
            answer_text: answerText,
          }),
        });
        if (res.ok) {
          showToast("Question response updated");
          loadDashboardData();
        } else {
          const err = await res.json();
          alert(err.detail || "Failed to update question");
        }
      } catch (err) {
        console.error("Failed to update Q&A:", err);
      }
      return;
    }

    // Copy Action
    const copyBtn = e.target.closest(".qa-copy-btn");
    if (copyBtn) {
      const textToCopy = copyBtn.getAttribute("data-copy-text") || "";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(textToCopy)
          .then(() => {
            showToast("✓ Answer copied to clipboard!");
          })
          .catch(() => fallbackCopy(textToCopy));
      } else {
        fallbackCopy(textToCopy);
      }
      return;
    }

    // Delete Action
    const deleteBtn = e.target.closest(".qa-delete-btn");
    if (deleteBtn) {
      const qaId = deleteBtn.getAttribute("data-qa-id");
      if (!qaId) return;

      if (!confirm("Are you sure you want to delete this question response?"))
        return;

      try {
        const res = await fetch(`${API_BASE}/questions/${qaId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          showToast("✓ Question response removed from bank");
          loadDashboardData();
        }
      } catch (err) {
        console.error("Failed to delete Q&A:", err);
      }
    }
  });
}

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand("copy");
    showToast("✓ Answer copied to clipboard!");
  } catch (e) {}
  document.body.removeChild(textarea);
}

/**
 * 11. Detail Drawer & Role Details (View Mode by Default / Edit Toggle)
 */
function setRoleDetailsEditMode(isEditing) {
  const viewModeEl = document.getElementById("roleDetailsViewMode");
  const editModeEl = document.getElementById("roleDetailsEditMode");
  const editBtn = document.getElementById("editAppDetailsBtn");

  if (isEditing) {
    if (viewModeEl) viewModeEl.style.display = "none";
    if (editModeEl) editModeEl.style.display = "block";
    if (editBtn) editBtn.style.display = "none";
  } else {
    if (viewModeEl) viewModeEl.style.display = "block";
    if (editModeEl) editModeEl.style.display = "none";
    if (editBtn) editBtn.style.display = "inline-flex";
  }
}

function populateRoleDetailsView(app) {
  if (!app) return;

  // Company & Role
  const crEl = document.getElementById("dViewCompanyRole");
  if (crEl)
    crEl.innerText = `${app.company_name || "Unknown"} — ${app.job_title || "Unknown Role"}`;

  // Workplace & Schedule
  let wpText = app.workplace_type || "Remote";
  if (app.days_in_office !== null && app.days_in_office !== undefined) {
    if (app.days_in_office === 0) wpText += " (0d/wk in-office)";
    else if (app.days_in_office === 5) wpText += " (5d/wk in-office)";
    else wpText += ` (${app.days_in_office}d/wk in-office)`;
  }
  if (app.location) wpText += ` • ${app.location}`;
  const wpEl = document.getElementById("dViewWorkplaceSchedule");
  if (wpEl) wpEl.innerText = wpText;

  // Job Type & Salary
  let tsText = app.job_type || "Full-time";
  if (app.salary_range) tsText += ` • ${app.salary_range}`;
  const tsEl = document.getElementById("dViewTypeSalary");
  if (tsEl) tsEl.innerText = tsText;

  // URL
  const urlEl = document.getElementById("dViewUrl");
  if (urlEl) {
    if (app.url) {
      urlEl.innerHTML = `<a href="${escapeHtml(app.url)}" target="_blank" style="color:var(--primary); text-decoration:underline; word-break:break-all;">${escapeHtml(app.url)}</a>`;
    } else {
      urlEl.innerText = "No URL attached";
    }
  }

  // Excitement Priority
  const priorityEl = document.getElementById("dViewPriority");
  if (priorityEl) {
    const prio = app.priority || 1;
    const stars = "★".repeat(prio) + "☆".repeat(5 - prio);
    priorityEl.innerHTML = `<span style="color:#f59e0b; font-size:1.05rem; font-weight:700;">${stars}</span> <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">(${prio}/5)</span>`;
  }

  // OA Expiration / Deadline
  const oaWrapper = document.getElementById("dViewOaWrapper");
  const oaEl = document.getElementById("dViewOaExpiration");
  if (oaWrapper && oaEl) {
    if (app.oa_expiration_date) {
      oaWrapper.style.display = "block";
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expDate = new Date(app.oa_expiration_date);
      expDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((expDate - today) / (1000 * 60 * 60 * 24));
      let statusNote = "";
      if (diffDays < 0) statusNote = ` (Expired ${Math.abs(diffDays)}d ago)`;
      else if (diffDays === 0) statusNote = ` (Due Today!)`;
      else statusNote = ` (Due in ${diffDays}d)`;
      oaEl.innerText = `${app.oa_expiration_date}${statusNote}`;
    } else {
      oaWrapper.style.display = "none";
    }
  }

  // Notes
  const notesEl = document.getElementById("dViewNotes");
  const notesWrapper = document.getElementById("dViewNotesWrapper");
  if (notesEl && notesWrapper) {
    if (app.notes) {
      notesWrapper.style.display = "block";
      notesEl.innerText = app.notes;
    } else {
      notesWrapper.style.display = "none";
    }
  }

  // Description
  const descEl = document.getElementById("dViewJobDescription");
  if (descEl) {
    descEl.innerText =
      app.job_description ||
      "No job description captured for this application.";
  }
}

function initDetailDrawer() {
  const modal = document.getElementById("appDetailModal");
  const closeBtn = document.getElementById("closeDrawerBtn");
  const statusSelect = document.getElementById("dStatusSelect");
  const saveMilestoneBtn = document.getElementById("saveMilestoneBtn");
  const editBtn = document.getElementById("editAppDetailsBtn");
  const cancelDetailsBtn = document.getElementById("cancelAppDetailsBtn");
  const saveDetailsBtn = document.getElementById("saveAppDetailsBtn");
  const deleteBtn = document.getElementById("deleteAppBtn");

  closeBtn.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.classList.remove("open");
  });

  editBtn?.addEventListener("click", () => {
    if (currentSelectedApp) {
      const editPrioEl = document.getElementById("dEditPriority");
      if (editPrioEl) editPrioEl.value = currentSelectedApp.priority || 1;
    }
    setRoleDetailsEditMode(true);
  });

  cancelDetailsBtn?.addEventListener("click", () => {
    if (currentSelectedApp) {
      document.getElementById("dEditCompanyName").value =
        currentSelectedApp.company_name || "";
      document.getElementById("dEditJobTitle").value =
        currentSelectedApp.job_title || "";
      document.getElementById("dEditLocation").value =
        currentSelectedApp.location || "";
      document.getElementById("dEditWorkplace").value =
        currentSelectedApp.workplace_type || "Remote";
      document.getElementById("dEditDaysInOffice").value =
        currentSelectedApp.days_in_office !== null &&
        currentSelectedApp.days_in_office !== undefined
          ? currentSelectedApp.days_in_office
          : "";
      document.getElementById("dEditJobType").value =
        currentSelectedApp.job_type || "Full-time";
      document.getElementById("dEditSalary").value =
        currentSelectedApp.salary_range || "";
      document.getElementById("dEditOaExpirationDate").value =
        currentSelectedApp.oa_expiration_date || "";
      const editPrioEl = document.getElementById("dEditPriority");
      if (editPrioEl) editPrioEl.value = currentSelectedApp.priority || 1;
      document.getElementById("dEditUrl").value = currentSelectedApp.url || "";
      document.getElementById("dEditNotes").value =
        currentSelectedApp.notes || "";
      document.getElementById("dEditJobDescription").value =
        currentSelectedApp.job_description || "";
      const logoEl = document.getElementById("dEditCompanyLogo");
      if (logoEl) logoEl.value = currentSelectedApp.company_logo || "";
      const websiteEl = document.getElementById("dEditCompanyWebsite");
      if (websiteEl) websiteEl.value = currentSelectedApp.company_website || "";
      const prevEl = document.getElementById("dEditLogoPreview");
      if (prevEl) {
        if (currentSelectedApp.company_logo) {
          prevEl.src = currentSelectedApp.company_logo;
          prevEl.style.display = "block";
        } else {
          prevEl.src = "";
          prevEl.style.display = "none";
        }
      }
    }
    setRoleDetailsEditMode(false);
  });

  // Live preview for edit panel logo input
  const dEditLogoInput = document.getElementById("dEditCompanyLogo");
  const dEditLogoPreview = document.getElementById("dEditLogoPreview");
  if (dEditLogoInput && dEditLogoPreview) {
    dEditLogoInput.addEventListener("input", () => {
      const url = dEditLogoInput.value.trim();
      if (url) {
        dEditLogoPreview.src = url;
        dEditLogoPreview.style.display = "block";
      } else {
        dEditLogoPreview.src = "";
        dEditLogoPreview.style.display = "none";
      }
    });
  }

  saveDetailsBtn?.addEventListener("click", async () => {
    if (!currentSelectedApp) return;

    const rawDays = document.getElementById("dEditDaysInOffice").value;
    const editPriority =
      parseInt(document.getElementById("dEditPriority")?.value || "1", 10) || 1;
    const newLogo =
      document.getElementById("dEditCompanyLogo")?.value.trim() || null;
    const newWebsite =
      document.getElementById("dEditCompanyWebsite")?.value.trim() || null;
    const updatedData = {
      company_name: document.getElementById("dEditCompanyName").value.trim(),
      job_title: document.getElementById("dEditJobTitle").value.trim(),
      location: document.getElementById("dEditLocation").value.trim(),
      workplace_type: document.getElementById("dEditWorkplace").value,
      days_in_office: rawDays !== "" ? parseInt(rawDays, 10) : null,
      job_type: document.getElementById("dEditJobType").value,
      salary_range: document.getElementById("dEditSalary").value.trim(),
      oa_expiration_date:
        document.getElementById("dEditOaExpirationDate").value || null,
      priority: editPriority,
      url: document.getElementById("dEditUrl").value.trim(),
      company_logo: newLogo,
      company_website: newWebsite,
      notes: document.getElementById("dEditNotes").value.trim(),
      job_description: document
        .getElementById("dEditJobDescription")
        .value.trim(),
    };

    try {
      const res = await fetch(
        `${API_BASE}/applications/${currentSelectedApp.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedData),
        },
      );

      if (res.ok) {
        showToast("✓ Role & application details updated");
        currentSelectedApp = { ...currentSelectedApp, ...updatedData };
        document.getElementById("dJobTitle").innerText =
          updatedData.job_title || currentSelectedApp.job_title;
        document.getElementById("dCompanyName").innerText =
          updatedData.company_name || currentSelectedApp.company_name;

        // Update header logo immediately
        if (
          updatedData.company_logo !== null &&
          updatedData.company_logo !== undefined
        ) {
          const drawerLogo = document.getElementById("dCompanyLogo");
          if (drawerLogo)
            drawerLogo.src = updatedData.company_logo || "grts-logo-sqr.svg";
        }

        let locDisplay = updatedData.location || "Remote / Unspecified";
        if (
          updatedData.days_in_office !== null &&
          updatedData.days_in_office !== undefined
        ) {
          locDisplay += ` (${updatedData.days_in_office}d/wk in-office)`;
        } else if (updatedData.workplace_type) {
          locDisplay += ` (${updatedData.workplace_type})`;
        }
        document.getElementById("dLocation").innerText = locDisplay;
        document.getElementById("dSalary").innerText =
          updatedData.salary_range || "-";

        const starsContainer = document.getElementById("dPriorityStars");
        if (starsContainer)
          starsContainer.innerHTML = renderClickableStars(
            currentSelectedApp.id,
            currentSelectedApp.priority || 1,
          );

        populateRoleDetailsView(currentSelectedApp);
        setRoleDetailsEditMode(false);
        loadDashboardData();
      } else {
        showToast("Failed to update application details");
      }
    } catch (err) {
      console.error("Error updating application details:", err);
      showToast("Network error updating application");
    }
  });

  statusSelect.addEventListener("change", async (e) => {
    if (!currentSelectedApp) return;
    const newStatus = e.target.value;
    try {
      await fetch(`${API_BASE}/applications/${currentSelectedApp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      await fetch(
        `${API_BASE}/applications/${currentSelectedApp.id}/timeline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: newStatus,
            event_date: new Date().toISOString().split("T")[0],
            notes: `Status changed to ${newStatus}`,
          }),
        },
      );

      showToast(`Status updated to ${newStatus}`);
      openDetailDrawer(currentSelectedApp.id);
      loadDashboardData();
    } catch (err) {
      console.error("Error updating status:", err);
    }
  });

  saveMilestoneBtn.addEventListener("click", async () => {
    if (!currentSelectedApp) return;
    const eventType = document.getElementById("logEventType").value;
    const oaPlatform = document.getElementById("logOaPlatform").value;
    const eventDate =
      document.getElementById("logEventDate").value ||
      new Date().toISOString().split("T")[0];
    const oaExpDate =
      document.getElementById("logOaExpirationDate")?.value || null;
    const meetingLink = document.getElementById("logMeetingLink").value;
    let notes = document.getElementById("logEventNotes").value.trim();

    if (eventType.includes("OA") || eventType.includes("Assessment")) {
      notes = `Platform: ${oaPlatform}${notes ? " • " + notes : ""}`;
    }

    try {
      await fetch(
        `${API_BASE}/applications/${currentSelectedApp.id}/timeline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_type: eventType,
            event_date: eventDate,
            oa_expiration_date: oaExpDate,
            meeting_link: meetingLink || null,
            notes: notes || null,
          }),
        },
      );

      document.getElementById("logMeetingLink").value = "";
      document.getElementById("logEventNotes").value = "";

      showToast("✓ Milestone recorded");
      openDetailDrawer(currentSelectedApp.id);
      loadDashboardData();
    } catch (err) {
      console.error("Error logging milestone:", err);
    }
  });

  // Q&A Creation Handlers
  const addQABtn = document.getElementById("dAddQABtn");
  const newQAForm = document.getElementById("dNewQAForm");
  const cancelNewQABtn = document.getElementById("dCancelNewQABtn");
  const saveNewQABtn = document.getElementById("dSaveNewQABtn");

  if (addQABtn && newQAForm) {
    addQABtn.addEventListener("click", () => {
      newQAForm.style.display =
        newQAForm.style.display === "none" ? "block" : "none";
      if (newQAForm.style.display === "block") {
        document.getElementById("dNewQAQuestion")?.focus();
      }
    });
  }

  if (cancelNewQABtn && newQAForm) {
    cancelNewQABtn.addEventListener("click", () => {
      newQAForm.style.display = "none";
      if (document.getElementById("dNewQAQuestion"))
        document.getElementById("dNewQAQuestion").value = "";
      if (document.getElementById("dNewQAAnswer"))
        document.getElementById("dNewQAAnswer").value = "";
    });
  }

  if (saveNewQABtn && newQAForm) {
    saveNewQABtn.addEventListener("click", async () => {
      if (!currentSelectedApp) return;
      const qInput = document.getElementById("dNewQAQuestion");
      const aInput = document.getElementById("dNewQAAnswer");
      const questionText = qInput ? qInput.value.trim() : "";
      const answerText = aInput ? aInput.value.trim() : "";
      if (!questionText) {
        alert("Please enter a question.");
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/applications/${currentSelectedApp.id}/questions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question_text: questionText,
              answer_text: answerText,
            }),
          },
        );
        if (res.ok) {
          showToast("Question response recorded");
          newQAForm.style.display = "none";
          if (qInput) qInput.value = "";
          if (aInput) aInput.value = "";
          openDetailDrawer(currentSelectedApp.id);
          loadDashboardData();
        } else {
          const err = await res.json();
          alert(err.detail || "Failed to add question response");
        }
      } catch (err) {
        console.error("Error adding question:", err);
      }
    });
  }

  // Delegated Q&A card handlers (Edit, Cancel, Save, Delete)
  document
    .getElementById("dCustomQAList")
    ?.addEventListener("click", async (e) => {
      // Edit
      const editBtn = e.target.closest(".drawer-qa-edit-btn");
      if (editBtn) {
        const qaId = editBtn.getAttribute("data-qa-id");
        const viewEl = document.getElementById(`drawer-qa-view-${qaId}`);
        const editEl = document.getElementById(`drawer-qa-edit-${qaId}`);
        if (viewEl && editEl) {
          viewEl.style.display = "none";
          editEl.style.display = "block";
        }
        return;
      }

      // Cancel Edit
      const cancelBtn = e.target.closest(".drawer-qa-cancel-btn");
      if (cancelBtn) {
        const qaId = cancelBtn.getAttribute("data-qa-id");
        const viewEl = document.getElementById(`drawer-qa-view-${qaId}`);
        const editEl = document.getElementById(`drawer-qa-edit-${qaId}`);
        if (viewEl && editEl) {
          viewEl.style.display = "block";
          editEl.style.display = "none";
        }
        return;
      }

      // Save Edit
      const saveBtn = e.target.closest(".drawer-qa-save-btn");
      if (saveBtn) {
        const qaId = saveBtn.getAttribute("data-qa-id");
        const qInput = document.getElementById(`drawer-qa-input-q-${qaId}`);
        const aInput = document.getElementById(`drawer-qa-input-a-${qaId}`);
        if (!qInput || !aInput) return;
        const questionText = qInput.value.trim();
        const answerText = aInput.value.trim();
        if (!questionText) {
          alert("Question text cannot be empty.");
          return;
        }
        try {
          const res = await fetch(`${API_BASE}/questions/${qaId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question_text: questionText,
              answer_text: answerText,
            }),
          });
          if (res.ok) {
            showToast("Question response updated");
            if (currentSelectedApp) {
              openDetailDrawer(currentSelectedApp.id);
            }
            loadDashboardData();
          } else {
            const err = await res.json();
            alert(err.detail || "Failed to update question");
          }
        } catch (err) {
          console.error("Error updating question:", err);
        }
        return;
      }

      // Delete
      const deleteBtn = e.target.closest(".drawer-qa-delete-btn");
      if (deleteBtn) {
        const qaId = deleteBtn.getAttribute("data-qa-id");
        if (!qaId) return;
        if (!confirm("Are you sure you want to delete this question response?"))
          return;
        try {
          const res = await fetch(`${API_BASE}/questions/${qaId}`, {
            method: "DELETE",
          });
          if (res.ok) {
            showToast("Question response removed");
            if (currentSelectedApp) {
              openDetailDrawer(currentSelectedApp.id);
            }
            loadDashboardData();
          } else {
            const err = await res.json();
            alert(err.detail || "Failed to delete question");
          }
        } catch (err) {
          console.error("Error deleting question:", err);
        }
        return;
      }
    });

  deleteBtn.addEventListener("click", () => {
    if (currentSelectedApp) {
      deleteApplication(currentSelectedApp.id);
    }
  });
}

function renderDrawerQAList(app) {
  const qaContainer = document.getElementById("dCustomQAList");
  if (!qaContainer) return;
  const customQAs = app.custom_answers || [];
  if (customQAs.length === 0) {
    qaContainer.innerHTML = `<div style="font-size:0.82rem; color:var(--text-muted); padding:4px 0;">Standard fields used (no unique questions). Click "+ Add Q&A" to record custom questions for this application.</div>`;
    return;
  }

  qaContainer.innerHTML = customQAs
    .map((qa) => {
      const isUnfilled =
        !qa.answer_text ||
        qa.answer_text.trim() === "" ||
        qa.answer_text.trim() === "[Unfilled]";
      const cardBg = isUnfilled
        ? "background:#fff7ed; border:1px solid #fdba74;"
        : "background:#f8fafc; border:1px solid var(--border-color);";
      const badge = isUnfilled
        ? `<span style="font-size:0.7rem; font-weight:700; background:#ffedd5; color:#c2410c; border:1px solid #fed7aa; padding:1px 6px; border-radius:4px; margin-left:6px;">Unfilled / Needs Review</span>`
        : "";

      return `
        <div class="qa-item-card" id="drawer-qa-card-${qa.id}" style="${cardBg} border-radius:8px; padding:10px 12px; font-size:0.82rem;">
            <!-- View Mode -->
            <div id="drawer-qa-view-${qa.id}">
                <div style="font-weight:700; color:var(--text-main); margin-bottom:4px; display:flex; align-items:flex-start; justify-content:space-between; gap:8px;">
                    <div style="flex:1;">
                        <span>${escapeHtml(qa.question_text)}</span>
                        ${badge}
                    </div>
                    <div style="display:flex; gap:4px; flex-shrink:0;">
                        <button type="button" class="btn-icon drawer-qa-edit-btn" data-qa-id="${qa.id}" title="Edit Question & Answer" style="padding:2px 6px; font-size:0.72rem; color:#475569; border:1px solid #cbd5e1; border-radius:4px; background:#ffffff; cursor:pointer;">
                            Edit
                        </button>
                        <button type="button" class="btn-icon drawer-qa-delete-btn" data-qa-id="${qa.id}" title="Delete Question" style="padding:2px 6px; font-size:0.72rem; color:#ef4444; border:1px solid #fca5a5; border-radius:4px; background:#ffffff; cursor:pointer;">
                            &times;
                        </button>
                    </div>
                </div>
                <div style="color:${isUnfilled ? "#9a3412" : "var(--text-muted)"}; font-weight:${isUnfilled ? "600" : "400"}; white-space:pre-wrap;">${escapeHtml(qa.answer_text || "Not filled out")}</div>
            </div>

            <!-- Edit Mode -->
            <div id="drawer-qa-edit-${qa.id}" style="display:none; padding:4px 0;">
                <div style="margin-bottom:6px;">
                    <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:2px;">Question</label>
                    <input type="text" id="drawer-qa-input-q-${qa.id}" value="${escapeHtml(qa.question_text)}" style="width:100%; box-sizing:border-box; padding:5px 8px; font-size:0.8rem; border:1px solid var(--border-color); border-radius:6px;" />
                </div>
                <div style="margin-bottom:6px;">
                    <label style="font-size:0.72rem; font-weight:700; color:var(--text-muted); display:block; margin-bottom:2px;">Answer</label>
                    <textarea id="drawer-qa-input-a-${qa.id}" rows="3" style="width:100%; box-sizing:border-box; padding:5px 8px; font-size:0.8rem; border:1px solid var(--border-color); border-radius:6px;">${escapeHtml(qa.answer_text || "")}</textarea>
                </div>
                <div style="display:flex; gap:6px; justify-content:flex-end;">
                    <button type="button" class="btn-secondary drawer-qa-cancel-btn" data-qa-id="${qa.id}" style="padding:3px 8px; font-size:0.75rem; cursor:pointer;">Cancel</button>
                    <button type="button" class="btn-primary-gold drawer-qa-save-btn" data-qa-id="${qa.id}" style="padding:3px 10px; font-size:0.75rem; cursor:pointer;">Save</button>
                </div>
            </div>
        </div>
      `;
    })
    .join("");
}

window.openDetailDrawer = async function (appId) {
  const modal = document.getElementById("appDetailModal");
  modal.classList.add("open");

  // Reset role details card to View Mode by default
  setRoleDetailsEditMode(false);

  // Reset new Q&A form if open
  const newQAForm = document.getElementById("dNewQAForm");
  if (newQAForm) {
    newQAForm.style.display = "none";
    if (document.getElementById("dNewQAQuestion"))
      document.getElementById("dNewQAQuestion").value = "";
    if (document.getElementById("dNewQAAnswer"))
      document.getElementById("dNewQAAnswer").value = "";
  }

  document.getElementById("logEventDate").value = new Date()
    .toISOString()
    .split("T")[0];

  try {
    const res = await fetch(`${API_BASE}/applications/${appId}`);
    const json = await res.json();
    const app = json.data;
    currentSelectedApp = app;

    document.getElementById("dJobTitle").innerText = app.job_title;
    document.getElementById("dCompanyName").innerText = app.company_name;

    let locText = app.location || "Remote / Unspecified";
    if (app.days_in_office !== null && app.days_in_office !== undefined) {
      locText += ` (${app.days_in_office}d/wk in-office)`;
    } else if (app.workplace_type) {
      locText += ` (${app.workplace_type})`;
    }
    document.getElementById("dLocation").innerText = locText;
    document.getElementById("dSalary").innerText = app.salary_range || "-";
    document.getElementById("dDateApplied").innerText = app.date_applied || "-";
    document.getElementById("dCompanyLogo").src =
      app.company_logo || "grts-logo-sqr.svg";
    document.getElementById("dStatusSelect").value = app.status;

    // Render drawer priority stars
    const starsContainer = document.getElementById("dPriorityStars");
    if (starsContainer) {
      starsContainer.innerHTML = renderClickableStars(
        app.id,
        app.priority || 1,
      );
    }

    // Populate View Mode
    populateRoleDetailsView(app);
    renderDrawerQAList(app);

    // Populate Editable Fields
    document.getElementById("dEditCompanyName").value = app.company_name || "";
    document.getElementById("dEditJobTitle").value = app.job_title || "";
    document.getElementById("dEditLocation").value = app.location || "";
    document.getElementById("dEditWorkplace").value =
      app.workplace_type || "Remote";
    document.getElementById("dEditDaysInOffice").value =
      app.days_in_office !== null && app.days_in_office !== undefined
        ? app.days_in_office
        : "";
    document.getElementById("dEditJobType").value = app.job_type || "Full-time";
    document.getElementById("dEditSalary").value = app.salary_range || "";
    document.getElementById("dEditOaExpirationDate").value =
      app.oa_expiration_date || "";
    const editPrioEl = document.getElementById("dEditPriority");
    if (editPrioEl) editPrioEl.value = app.priority || 1;
    document.getElementById("logOaExpirationDate").value =
      app.oa_expiration_date || "";
    document.getElementById("dEditUrl").value = app.url || "";
    document.getElementById("dEditNotes").value = app.notes || "";
    document.getElementById("dEditJobDescription").value =
      app.job_description || "";

    // Populate company logo and website edit fields
    const dEditLogoEl = document.getElementById("dEditCompanyLogo");
    if (dEditLogoEl) dEditLogoEl.value = app.company_logo || "";
    const dEditWebsiteEl = document.getElementById("dEditCompanyWebsite");
    if (dEditWebsiteEl) dEditWebsiteEl.value = app.company_website || "";
    const dEditLogoPreviewEl = document.getElementById("dEditLogoPreview");
    if (dEditLogoPreviewEl) {
      if (app.company_logo) {
        dEditLogoPreviewEl.src = app.company_logo;
        dEditLogoPreviewEl.style.display = "block";
      } else {
        dEditLogoPreviewEl.src = "";
        dEditLogoPreviewEl.style.display = "none";
      }
    }

    const linksContainer = document.getElementById("dLinksContainer");
    linksContainer.innerHTML = "";
    if (app.url) {
      linksContainer.innerHTML += `<a href="${escapeHtml(app.url)}" target="_blank" class="action-btn">Job Post</a>`;
    }
    if (app.company_website) {
      linksContainer.innerHTML += `<a href="${escapeHtml(app.company_website)}" target="_blank" class="action-btn">Company</a>`;
    }

    // Timeline with Re-orderable and Removable Milestone items
    const timelineContainer = document.getElementById("dTimelineList");
    const timelineEvents = app.timeline || [];
    if (timelineEvents.length === 0) {
      timelineContainer.innerHTML = `<div style="font-size:0.82rem; color:var(--text-muted); padding:8px 0;">No milestones logged yet.</div>`;
    } else {
      timelineContainer.innerHTML = timelineEvents
        .map(
          (t, idx) => `
                <div class="timeline-node" id="tnode-${t.id}">
                    <div class="timeline-marker"></div>
                    <div class="timeline-card">
                        <div class="timeline-top">
                            <div class="timeline-event-name">${escapeHtml(t.event_type)}</div>
                            <div style="display:flex; align-items:center; gap:4px;">
                                <span class="timeline-date-str" style="margin-right:4px;">${escapeHtml(t.event_date || "-")}</span>
                                <button class="action-btn milestone-move-btn" data-direction="up" data-index="${idx}" title="Move Up" style="padding:2px 5px; display:inline-flex; align-items:center;">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                </button>
                                <button class="action-btn milestone-move-btn" data-direction="down" data-index="${idx}" title="Move Down" style="padding:2px 5px; display:inline-flex; align-items:center;">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </button>
                                <button class="action-btn action-btn-danger milestone-delete-btn" data-milestone-id="${t.id}" title="Delete Milestone" style="padding:2px 5px; display:inline-flex; align-items:center;">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>
                        ${t.notes ? `<div class="timeline-detail-text">${escapeHtml(t.notes)}</div>` : ""}
                        <div class="timeline-meta-chips">
                            ${t.meeting_link ? `<a href="${escapeHtml(t.meeting_link)}" target="_blank" class="meta-chip">Assessment / Video Link</a>` : ""}
                            ${t.rating ? `<span class="meta-chip">Rating: ${t.rating}/5</span>` : ""}
                        </div>
                    </div>
                </div>
            `,
        )
        .join("");
    }

    const qaContainer = document.getElementById("dCustomQAList");
    const customQAs = app.custom_answers || [];
    if (customQAs.length === 0) {
      qaContainer.innerHTML = `<div style="font-size:0.82rem; color:var(--text-muted);">Standard fields used (no unique questions).</div>`;
    } else {
      qaContainer.innerHTML = customQAs
        .map(
          (qa) => `
                <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:8px; padding:10px 12px; font-size:0.82rem;">
                    <div style="font-weight:700; color:var(--text-main); margin-bottom:3px;">${escapeHtml(qa.question_text)}</div>
                    <div style="color:var(--text-muted);">${escapeHtml(qa.answer_text)}</div>
                </div>
            `,
        )
        .join("");
    }
  } catch (err) {
    console.error("Error opening detail drawer:", err);
  }
};

function initMilestoneActionListeners() {
  document.addEventListener("click", async (e) => {
    // Milestone Delete Action
    const delBtn = e.target.closest(".milestone-delete-btn");
    if (delBtn) {
      const milestoneId = delBtn.getAttribute("data-milestone-id");
      if (!milestoneId) return;

      if (!confirm("Are you sure you want to remove this milestone?")) return;
      try {
        const res = await fetch(`${API_BASE}/timeline/${milestoneId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          showToast("✓ Milestone removed");
          if (currentSelectedApp) openDetailDrawer(currentSelectedApp.id);
          loadDashboardData();
        }
      } catch (err) {
        console.error("Failed to delete milestone:", err);
      }
      return;
    }

    // Milestone Re-order Action (Move Up / Down)
    const moveBtn = e.target.closest(".milestone-move-btn");
    if (moveBtn && currentSelectedApp && currentSelectedApp.timeline) {
      const dir = moveBtn.getAttribute("data-direction");
      const idx = parseInt(moveBtn.getAttribute("data-index"));
      const list = [...currentSelectedApp.timeline];

      if (dir === "up" && idx > 0) {
        const temp = list[idx - 1];
        list[idx - 1] = list[idx];
        list[idx] = temp;
      } else if (dir === "down" && idx < list.length - 1) {
        const temp = list[idx + 1];
        list[idx + 1] = list[idx];
        list[idx] = temp;
      } else {
        return;
      }

      const orderedIds = list.map((item) => item.id);
      try {
        await fetch(
          `${API_BASE}/applications/${currentSelectedApp.id}/timeline/reorder`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ordered_ids: orderedIds }),
          },
        );

        showToast("Milestone order updated");
        openDetailDrawer(currentSelectedApp.id);
      } catch (err) {
        console.error("Failed to reorder milestones:", err);
      }
    }
  });
}

/**
 * 12. Manual Application Entry Modal
 */
function initManualAddModal() {
  const modal = document.getElementById("addAppModal");
  const openBtn = document.getElementById("openAddModalBtn");
  const closeBtn = document.getElementById("closeAddModalBtn");
  const cancelBtn = document.getElementById("cancelAddBtn");
  const form = document.getElementById("manualAppForm");

  const openModal = () => {
    document.getElementById("m_date").value = new Date()
      .toISOString()
      .split("T")[0];
    modal.classList.add("open");
  };
  const closeModal = () => {
    modal.classList.remove("open");
    const prev = document.getElementById("m_logo_preview");
    if (prev) {
      prev.src = "";
      prev.style.display = "none";
    }
  };

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Live logo preview in the Add form
  const mLogoInput = document.getElementById("m_company_logo");
  const mLogoPreview = document.getElementById("m_logo_preview");
  if (mLogoInput && mLogoPreview) {
    mLogoInput.addEventListener("input", () => {
      const url = mLogoInput.value.trim();
      if (url) {
        mLogoPreview.src = url;
        mLogoPreview.style.display = "block";
      } else {
        mLogoPreview.src = "";
        mLogoPreview.style.display = "none";
      }
    });
  }

  // Auto-fill Clearbit URL from company name
  const mCompanyInput = document.getElementById("m_company");
  if (mCompanyInput && mLogoInput) {
    mCompanyInput.addEventListener("blur", () => {
      if (!mLogoInput.value.trim() && mCompanyInput.value.trim()) {
        const slug = mCompanyInput.value
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "")
          .replace(/[^a-z0-9]/g, "");
        if (slug) {
          mLogoInput.value = `https://logo.clearbit.com/${slug}.com`;
          if (mLogoPreview) {
            mLogoPreview.src = mLogoInput.value;
            mLogoPreview.style.display = "block";
          }
        }
      }
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const rawDays = document.getElementById("m_days_in_office")?.value;
    const targetStatus =
      document.getElementById("m_status")?.value || "Applied";

    const payload = {
      company_name: document.getElementById("m_company").value.trim(),
      job_title: document.getElementById("m_title").value.trim(),
      location: document.getElementById("m_location").value.trim() || null,
      workplace_type: document.getElementById("m_workplace").value,
      days_in_office:
        rawDays !== "" && rawDays !== undefined ? parseInt(rawDays, 10) : null,
      status: targetStatus,
      oa_expiration_date:
        document.getElementById("m_oa_expiration_date")?.value || null,
      date_applied:
        document.getElementById("m_date").value ||
        new Date().toISOString().split("T")[0],
      priority: parseInt(document.getElementById("m_priority").value) || 1,
      salary_range: document.getElementById("m_salary").value.trim() || null,
      url: document.getElementById("m_url").value.trim() || null,
      company_website:
        document.getElementById("m_company_website")?.value.trim() || null,
      company_logo:
        document.getElementById("m_company_logo")?.value.trim() || null,
      notes:
        document.getElementById("m_notes").value.trim() ||
        (targetStatus === "Saved"
          ? "Saved job bookmark"
          : "Manual dashboard entry"),
      custom_answers: [],
    };

    try {
      const res = await fetch(`${API_BASE}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        form.reset();
        closeModal();
        showToast(
          targetStatus === "Saved"
            ? "Job saved to bookmarks"
            : "Application logged to database",
        );
        loadDashboardData();
      } else {
        alert("Error adding application.");
      }
    } catch (err) {
      console.error("Failed to manually create application:", err);
    }
  });
}

/**
 * 13. Delete Application
 */
window.deleteApplication = async function (appId) {
  if (!confirm("Are you sure you want to delete this job application record?"))
    return;

  try {
    const res = await fetch(`${API_BASE}/applications/${appId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      const modal = document.getElementById("appDetailModal");
      if (modal) modal.classList.remove("open");
      showToast("Application deleted");
      loadDashboardData();
    }
  } catch (err) {
    console.error("Failed to delete application:", err);
  }
};

window.selectResumeVersion = async function (resumeId) {
  try {
    const res = await fetch(`${API_BASE}/resumes/${resumeId}`);
    const json = await res.json();
    const r = json.data;
    if (!r) return;

    currentSelectedResume = r;
    document.getElementById("resumeViewerTitle").innerText =
      `${r.name} (${r.version_tag}) ${r.parent_name ? "• Forked from " + r.parent_name : ""}`;

    const badge = document.getElementById("resumePdfBadge");
    const toggleBtn = document.getElementById("togglePdfViewBtn");
    const downloadBtn = document.getElementById("downloadPdfBtn");
    const diffViewer = document.getElementById("resumeDiffViewer");
    const pdfFrame = document.getElementById("resumePdfPreviewFrame");

    if (r.pdf_base64) {
      const sizeKb = Math.round((r.pdf_base64.length * 3) / 4 / 1024);
      const isDocx =
        (r.pdf_file_name || "").endsWith(".docx") ||
        (r.pdf_file_name || "").endsWith(".doc");
      badge.innerHTML = `<span style="color:#166534; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>Connected Resume File:</span> <strong>${escapeHtml(r.pdf_file_name || (isDocx ? "Resume.docx" : "Resume.pdf"))}</strong> (${sizeKb} KB)`;
      toggleBtn.style.display = r.content ? "inline-flex" : "none";
      downloadBtn.style.display = "inline-flex";

      if (isDocx) {
        pdfFrame.style.display = "none";
        diffViewer.style.display = "block";
        diffViewer.innerHTML = `<div style="padding:16px; background:#f8fafc; border-radius:8px;">
                    <div style="font-weight:700; display:inline-flex; align-items:center; gap:5px; margin-bottom:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>DOCX Resume Document Connected: ${escapeHtml(r.pdf_file_name)}</div><br/>
                    <span style="color:var(--text-muted); font-size:0.82rem;">This DOCX file will be automatically attached during job applications.</span>
                    ${r.content ? `<div style="margin-top:12px; font-family:monospace; white-space:pre-wrap; font-size:0.8rem; background:#ffffff; padding:10px; border:1px solid #e2e8f0; border-radius:6px;">${escapeHtml(r.content)}</div>` : ""}
                </div>`;
      } else {
        pdfFrame.style.display = "block";
        diffViewer.style.display = "none";
        pdfFrame.src = r.pdf_base64;
      }
    } else {
      badge.innerHTML = `<span style="color:#854d0e; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#854d0e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>No PDF/DOCX document uploaded</span> — Click "+ Replace PDF / DOCX" to connect your resume file.`;
      toggleBtn.style.display = "none";
      downloadBtn.style.display = "none";
      pdfFrame.style.display = "none";
      diffViewer.style.display = "block";
      diffViewer.innerText = r.content || "No document notes attached.";
    }

    renderResumesList(resumesData);
  } catch (e) {
    console.error("Error viewing resume:", e);
  }
};

/**
 * 14. Master Profile Form Sync (Ordered & Multi-Entry)
 */
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

  // Accordion Global & Section Handlers
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
      // Auto-format 6-digit MMYYYY input (e.g. 052026 -> 05/2026)
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
    // Add new experience at the TOP (index 0) and keep it expanded
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
        // Sort chronologically with newest at the top
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

  form.addEventListener("submit", async (e) => {
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

function getStatusClass(status) {
  if (!status) return "status-Applied";
  if (status.includes("Skipped") || status.includes("Expired"))
    return "status-Skipped";
  if (status === "Saved" || status.includes("Saved")) return "status-Saved";
  if (status.includes("OA") || status.includes("Assessment"))
    return "status-OA";
  if (status.includes("Screen") || status.includes("Recruiter"))
    return "status-Screening";
  if (status.includes("Tech") || status.includes("Design"))
    return "status-Technical";
  if (status.includes("Final") || status.includes("Onsite"))
    return "status-Final";
  if (status.includes("Offer")) return "status-Offer";
  if (status.includes("Reject") || status.includes("Ghost"))
    return "status-Rejected";
  return "status-Applied";
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
