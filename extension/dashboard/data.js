// Dashboard Data Fetcher & Top Metrics Renderer

/**
 * Fetch Applications, Stats, and Q&A Bank from Backend
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
 * Render Funnel Metrics Bar
 */
function renderMetrics(stats) {
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
