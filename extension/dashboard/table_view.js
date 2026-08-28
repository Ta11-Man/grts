// Dashboard Table View, Tab Controls, Search Filters & Excitement Stars

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
  document
    .querySelectorAll(".metric-card")
    .forEach((c) => c.classList.remove("active-filter"));

  const totalCard =
    document.getElementById("mTotalAppsCard") ||
    document.getElementById("mcard-total");
  const savedCard = document.getElementById("mSavedCard");
  const interviewingCard =
    document.getElementById("mInterviewingCard") ||
    document.getElementById("mcard-interview");
  const offersCard =
    document.getElementById("mOffersCard") ||
    document.getElementById("mcard-offer");
  const hearbackCard = document.getElementById("mHearbackCard");
  const oaCard = document.getElementById("mcard-oa");
  const ghostedCard = document.getElementById("mcard-ghosted");

  if (activeCustomFilter === "interviewing" && interviewingCard) {
    interviewingCard.classList.add("active-filter");
  } else if (activeCustomFilter === "offers" && offersCard) {
    offersCard.classList.add("active-filter");
  } else if (activeCustomFilter === "hearback" && hearbackCard) {
    hearbackCard.classList.add("active-filter");
  } else if (activeStatusFilter === "Saved" && savedCard) {
    savedCard.classList.add("active-filter");
  } else if (activeStatusFilter === "Online Assessment (OA)" && oaCard) {
    oaCard.classList.add("active-filter");
  } else if (activeStatusFilter === "Ghosted" && ghostedCard) {
    ghostedCard.classList.add("active-filter");
  } else if (!activeStatusFilter && !activeCustomFilter && totalCard) {
    totalCard.classList.add("active-filter");
  }
}

function initFiltersAndSearch() {
  const searchInput = document.getElementById("globalSearchInput");
  const sortSelect = document.getElementById("sortBySelect");
  const statusSelect = document.getElementById("statusFilterSelect");

  let debounceTimer = null;
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        activeSearchQuery = e.target.value.trim();
        loadDashboardData();
      }, 300);
    });
  }

  if (sortSelect) {
    sortSelect.addEventListener("change", (e) => {
      activeSortBy = e.target.value;
      loadDashboardData();
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener("change", (e) => {
      activeStatusFilter = e.target.value;
      activeCustomFilter = null;
      updateMetricCardActiveState();
      loadDashboardData();
    });
  }

  const activateTableView = () => {
    const tableTabBtn = document.querySelector(
      '.view-tab-btn[data-view="view-table"]',
    );
    if (tableTabBtn && !tableTabBtn.classList.contains("active")) {
      tableTabBtn.click();
    }
  };

  // 1. Total Applications Card -> Show All
  const totalAppsCard =
    document.getElementById("mTotalAppsCard") ||
    document.getElementById("mcard-total");
  if (totalAppsCard) {
    totalAppsCard.addEventListener("click", () => {
      if (statusSelect) statusSelect.value = "";
      activeStatusFilter = "";
      activeCustomFilter = null;
      activateTableView();
      updateMetricCardActiveState();
      loadDashboardData();
      showToast("Showing All Applications");
    });
  }

  // 2. Saved Jobs Card -> Filter Saved
  const savedCard = document.getElementById("mSavedCard");
  if (savedCard) {
    savedCard.addEventListener("click", () => {
      if (statusSelect) statusSelect.value = "Saved";
      activeStatusFilter = "Saved";
      activeCustomFilter = null;
      activateTableView();
      updateMetricCardActiveState();
      loadDashboardData();
      showToast("Filtering Saved Jobs");
    });
  }

  // 3. Interviewing Card -> Filter Active Interview Rounds
  const interviewingCard =
    document.getElementById("mInterviewingCard") ||
    document.getElementById("mcard-interview");
  if (interviewingCard) {
    interviewingCard.addEventListener("click", () => {
      if (statusSelect) statusSelect.value = "";
      activeStatusFilter = "";
      activeCustomFilter = "interviewing";
      activateTableView();
      updateMetricCardActiveState();
      loadDashboardData();
      showToast("Filtering Active Interview Rounds");
    });
  }

  // 4. Offers Card -> Filter Offers
  const offersCard =
    document.getElementById("mOffersCard") ||
    document.getElementById("mcard-offer");
  if (offersCard) {
    offersCard.addEventListener("click", () => {
      if (statusSelect) statusSelect.value = "";
      activeStatusFilter = "";
      activeCustomFilter = "offers";
      activateTableView();
      updateMetricCardActiveState();
      loadDashboardData();
      showToast("Filtering Offers");
    });
  }

  // 5. Hearback Card -> Filter Roles With Company Responses
  const hearbackCard = document.getElementById("mHearbackCard");
  if (hearbackCard) {
    hearbackCard.addEventListener("click", () => {
      if (statusSelect) statusSelect.value = "";
      activeStatusFilter = "";
      activeCustomFilter = "hearback";
      activateTableView();
      updateMetricCardActiveState();
      loadDashboardData();
      showToast("Filtering Roles With Company Responses");
    });
  }

  // 6. Generic fallback for any other metric card with data-filter-status
  document.querySelectorAll(".metric-card").forEach((card) => {
    if (
      ![
        "mTotalAppsCard",
        "mSavedCard",
        "mInterviewingCard",
        "mOffersCard",
        "mHearbackCard",
        "mcard-total",
        "mcard-interview",
        "mcard-offer",
      ].includes(card.id)
    ) {
      card.addEventListener("click", () => {
        const filterStatus = card.getAttribute("data-filter-status");
        if (filterStatus !== null && filterStatus !== undefined) {
          if (statusSelect) statusSelect.value = filterStatus;
          activeStatusFilter = filterStatus;
          activeCustomFilter = null;
          activateTableView();
          showToast(
            filterStatus
              ? `Filtering ${filterStatus}`
              : "Showing All Applications",
          );
          updateMetricCardActiveState();
          loadDashboardData();
        }
      });
    }
  });
}

/**
 * OA Deadline / Expiration Badge Helper & Quick Skip Action
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

const ATS_DOMAINS_LIST = [
  "oraclecloud.com", "oracle.com", "taleo.net",
  "myworkdayjobs.com", "workday.com",
  "greenhouse.io", "lever.co", "ashbyhq.com",
  "smartrecruiters.com", "icims.com", "jobvite.com",
  "rippling.com", "bamboohr.com", "jazz.co", "jazzhr.com",
  "recruitee.com", "brassring.com", "successfactors.com",
  "adp.com", "paylocity.com", "phenompeople.com", "eightfold.ai"
];

function getCompanyFavicon(url) {
  if (!url) return null;
  try {
    const fullUrl =
      url.startsWith("http://") || url.startsWith("https://")
        ? url
        : `https://${url}`;
    const host = new URL(fullUrl).hostname.toLowerCase();
    if (ATS_DOMAINS_LIST.some((ats) => host.includes(ats))) {
      return null;
    }
    const domain = host.replace(/^www\./, "");
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
        const host = new URL(fullUrl).hostname.toLowerCase();
        if (!ATS_DOMAINS_LIST.some((ats) => host.includes(ats))) {
          domain = host.replace(/^www\./, "");
        }
      } catch (e) {}
    }
    if (!domain && companyName) {
      const clean = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (clean.includes("jpmorgan") || clean.includes("jpmc")) {
        domain = "jpmorganchase.com";
      } else if (clean) {
        domain = clean + ".com";
      }
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
    setSafeInnerHTML(tbody, `<tr><td colspan="6" class="empty-state">
            <h3>No applications found</h3>
            <p>Applications will appear here automatically when submitted, or click "Add Application" to enter manually.</p>
        </td></tr>`);
    return;
  }

  setSafeInnerHTML(tbody, apps
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
    .join(""));

  tbody.querySelectorAll("tr.clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      const id = parseInt(row.getAttribute("data-id"));
      openDetailDrawer(id);
    });
  });
}

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
          setSafeInnerHTML(starsContainer, renderClickableStars(appId, newPriority));
        const priorityEl = document.getElementById("dViewPriority");
        if (priorityEl) {
          const stars = "★".repeat(newPriority) + "☆".repeat(5 - newPriority);
          setSafeInnerHTML(priorityEl, `<span style="color:#f59e0b; font-size:1.05rem; font-weight:700;">${stars}</span> <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">(${newPriority}/5)</span>`);
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
