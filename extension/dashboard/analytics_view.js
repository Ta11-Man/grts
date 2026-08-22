// Dashboard Analytics Tab, US Heatmap & SVG Timeline Range Renderer

/**
 * Render Chronological Time-Series Range Chart & Maps (SVG)
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
    setSafeInnerHTML(atsContainer,
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
      '<div style="color:var(--text-muted);">No ATS data yet.</div>');
  }

  // 3. Priority Breakdown
  const priorityContainer = document.getElementById("priorityBreakdownChart");
  if (priorityContainer) {
    setSafeInnerHTML(priorityContainer,
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
      '<div style="color:var(--text-muted);">No priority data yet.</div>');
  }

  // 4. Role & Title Non-Rejection Response Rates & Interviews
  const titleContainer = document.getElementById("titleStatsTable");
  if (titleContainer) {
    if (!title_stats || title_stats.length === 0) {
      setSafeInnerHTML(titleContainer, `<div style="color:var(--text-muted); padding:10px 0;">No title stats yet.</div>`);
    } else {
      const sortedTitleStats = [...title_stats].sort((a, b) => {
        if (b.interviews !== a.interviews) return b.interviews - a.interviews;
        if (b.positive_responses !== a.positive_responses)
          return b.positive_responses - a.positive_responses;
        return b.total - a.total;
      });
      setSafeInnerHTML(titleContainer, `
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
            `);
    }
  }

  // 5. Internship vs. Full-Time Performance Comparison
  const internContainer = document.getElementById("internVsFullTimeStats");
  if (internContainer) {
    if (!intern_vs_fulltime) {
      setSafeInnerHTML(internContainer, `<div style="color:var(--text-muted); padding:10px 0;">No comparison data available yet.</div>`);
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

      setSafeInnerHTML(internContainer, `
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
            `);
    }
  }

  // 6. Location Breakdown & Interactive Geo Map
  const locContainer = document.getElementById("locationBreakdownChart");
  const locMapSvg = document.getElementById("locationMapSvg");
  if (locContainer) {
    setSafeInnerHTML(locContainer,
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
      '<div style="color:var(--text-muted);">No location data yet.</div>');
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
 */
function renderLocationMapSvg(svg, locations) {
  if (!svg) return;
  const tooltip = document.getElementById("mapTooltip");
  const container = document.getElementById("locationMapSvgContainer");

  const statesData =
    typeof US_STATES_DATA !== "undefined" ? US_STATES_DATA : {};

  let totalLocationApps = 0;
  const stateCounts = {};
  const stateCities = {};
  const stateCityPoints = {};

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

  function getStateBaseFill(count) {
    if (!count || count === 0) return "#ffffff";
    const ratio = count / maxStateCount;
    // Soft, light sky-to-slate background shading so state never gets darker than highlighted city points
    const r = Math.round(242 - ratio * 48);
    const g = Math.round(249 - ratio * 24);
    const b = Math.round(255 - ratio * 4);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function getStateStroke(count) {
    if (!count || count === 0) return "#cbd5e1";
    return "#94a3b8";
  }  let defsHtml = `
        <defs>
            <filter id="panelShadow" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.08"/>
            </filter>
            <filter id="stateElevationShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.25"/>
            </filter>

            <linearGradient id="blueColorbarGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#ffffff"/>
                <stop offset="25%" stop-color="#f0f9ff"/>
                <stop offset="50%" stop-color="#bae6fd"/>
                <stop offset="75%" stop-color="#38bdf8"/>
                <stop offset="100%" stop-color="#0284c7"/>
            </linearGradient>
    `;

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
        <rect x="0" y="0" width="960" height="600" fill="#f8fafc"/>
        <g id="statesGroup">
    `;

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
                
                <path id="state-path-${code}" 
                      class="us-state-boundary" 
                      d="${info.d}" 
                      fill="${fill}" 
                      stroke="${stroke}" 
                      stroke-width="${strokeWidth}" 
                      style="transition: stroke 0.18s ease, stroke-width 0.18s ease;"/>

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

  svgHtml += `
        <g transform="translate(24, 536)">
            <rect x="0" y="0" width="220" height="42" fill="#ffffff" rx="6" stroke="#cbd5e1" opacity="0.95" filter="url(#panelShadow)"/>
            
            <text x="12" y="16" font-size="9.5" fill="#1e293b" font-weight="700">Applications (City & State Density)</text>
            
            <rect x="12" y="22" width="196" height="8" rx="2" fill="url(#blueColorbarGrad)" stroke="#cbd5e1" stroke-width="0.5"/>
            
            <text x="12" y="38" font-size="7.5" fill="#64748b" font-weight="600">0 (None)</text>
            <text x="75" y="38" font-size="7.5" fill="#64748b" font-weight="600">Low</text>
            <text x="135" y="38" font-size="7.5" fill="#64748b" font-weight="600">Med</text>
            <text x="208" y="38" font-size="7.5" fill="#0369a1" font-weight="700" text-anchor="end">Max (${maxStateCount})</text>
        </g>
    `;

  setSafeInnerHTML(svg, svgHtml);

  if (container && tooltip) {
    container.querySelectorAll(".us-state-container").forEach((stateGroup) => {
      const code = stateGroup.getAttribute("data-state-code");
      const name = stateGroup.getAttribute("data-state-name");
      const count = parseInt(stateGroup.getAttribute("data-count") || "0", 10);
      let citiesObj = {};
      try {
        citiesObj = JSON.parse(
          stateGroup.getAttribute("data-cities") || "{}",
        );
      } catch (e) {}

      const path = stateGroup.querySelector(".us-state-boundary");
      const originalStroke = path ? path.getAttribute("stroke") : "#cbd5e1";
      const originalStrokeWidth = path
        ? path.getAttribute("stroke-width")
        : "0.75";

      stateGroup.addEventListener("mouseenter", (e) => {
        const parent = stateGroup.parentNode;
        if (parent && parent.lastChild !== stateGroup) {
          parent.appendChild(stateGroup);
        }

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
        setSafeInnerHTML(tooltip, tooltipContent);
      });

      stateGroup.addEventListener("mouseleave", () => {
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
 */
function renderTimelineRangeSvg(svg, timelineData) {
  if (!timelineData || timelineData.length === 0) {
    setSafeInnerHTML(svg, `<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="13">No application activity recorded yet</text>`);
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

  for (let i = 0; i <= yTickCount; i++) {
    const val = i * yStep;
    const y = getY(val);
    svgHtml += `
            <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="${i === 0 ? "none" : "4 4"}"/>
            <text x="${paddingLeft - 8}" y="${y + 4}" font-size="10" fill="#94a3b8" text-anchor="end" font-weight="600">${val}</text>
        `;
  }

  if (rangeAreaD) {
    svgHtml += `<path d="${rangeAreaD}" fill="url(#activeRangeGrad)" />`;
  }

  if (rejAreaD) {
    svgHtml += `<path d="${rejAreaD}" fill="url(#rejectionAreaGrad)" />`;
  }

  if (topSplineD) {
    svgHtml += `<path d="${topSplineD}" fill="none" stroke="#0284c7" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

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

  svgHtml += `
        <g id="timelineCrosshairGroup" style="display:none; pointer-events:none;">
            <line id="timelineCrosshairLine" x1="0" y1="${paddingTop}" x2="0" y2="${zeroY}" stroke="#64748b" stroke-width="1.5" stroke-dasharray="3 3"/>
            <circle id="timelineTopHoverCircle" cx="0" cy="0" r="6" fill="#0284c7" stroke="#ffffff" stroke-width="2.5" filter="url(#glowEffect)"/>
            <circle id="timelineBotHoverCircle" cx="0" cy="0" r="6" fill="#ef4444" stroke="#ffffff" stroke-width="2.5" filter="url(#glowEffect)"/>
        </g>
    `;

  setSafeInnerHTML(svg, svgHtml);

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
      const activityTag =
        d.applied > 0 || d.rejected > 0
          ? `<span style="font-size:0.7rem; color:#38bdf8; font-weight:600;">(+${d.applied || 0} applied)</span>`
          : `<span style="font-size:0.7rem; color:#94a3b8; font-weight:500;">(no applications)</span>`;

      setSafeInnerHTML(tooltip, `
                <div style="font-weight:700; color:#f8fafc; margin-bottom:4px; font-size:0.82rem; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:3px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span style="display:flex; align-items:center; gap:4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>${escapeHtml(d.date)}</span>
                    </span>
                    ${activityTag}
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
            `);
    }
  };

  svg.onmouseleave = () => {
    if (tooltip) tooltip.style.display = "none";
    const ch = svg.querySelector("#timelineCrosshairGroup");
    if (ch) ch.style.display = "none";
  };
}
