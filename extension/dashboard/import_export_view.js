// CSV Import & Export Engine for GRTS Dashboard
// Handles fuzzy column mapping, robust CSV parsing, pre-import preview table, and 5-column export.

window.GRTS = window.GRTS || {};
window.GRTS.Dashboard = window.GRTS.Dashboard || {};

function initImportExportView() {
  const dropZone = document.getElementById("csvDropZone");
  const fileInput = document.getElementById("csvFileInput");
  const loader = document.getElementById("csvParseLoader");
  const previewContainer = document.getElementById("csvPreviewContainer");
  const previewTbody = document.getElementById("csvPreviewTbody");
  const confirmBtn = document.getElementById("confirmImportBtn");
  const cancelBtn = document.getElementById("csvCancelBtn");
  const badgeCount = document.getElementById("csvParsedCountBadge");
  const summaryText = document.getElementById("csvMatchSummaryText");
  const skipDuplicatesChk = document.getElementById("csvSkipDuplicatesChk");
  const exportBtn = document.getElementById("exportCsvBtn");
  const quickExportHeaderBtn = document.getElementById("quickExportHeaderBtn");
  const importProgressContainer = document.getElementById("importProgressContainer");
  const importProgressBar = document.getElementById("importProgressBar");
  const importProgressPercent = document.getElementById("importProgressPercent");
  const importStatusMsg = document.getElementById("importStatusMsg");

  let parsedRecords = [];

  // ----------------- DRAG & DROP AND FILE SELECTION -----------------

  if (dropZone && fileInput) {
    dropZone.addEventListener("click", () => fileInput.click());

    dropZone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "var(--primary)";
      dropZone.style.background = "var(--primary-light)";
    });

    dropZone.addEventListener("dragleave", () => {
      dropZone.style.borderColor = "var(--border-color)";
      dropZone.style.background = "var(--bg-color)";
    });

    dropZone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "var(--border-color)";
      dropZone.style.background = "var(--bg-color)";
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processCsvFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files.length > 0) {
        processCsvFile(e.target.files[0]);
      }
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      resetImportView();
    });
  }

  function resetImportView() {
    parsedRecords = [];
    if (fileInput) fileInput.value = "";
    if (previewContainer) previewContainer.style.display = "none";
    if (dropZone) dropZone.style.display = "block";
    if (loader) loader.style.display = "none";
    if (badgeCount) badgeCount.style.display = "none";
    if (importProgressContainer) importProgressContainer.style.display = "none";
    if (importStatusMsg) importStatusMsg.innerText = "";
  }

  // ----------------- CSV PARSING & FUZZY MATCHING -----------------

  function parseCsvText(text) {
    const lines = [];
    let currentRow = [];
    let currentField = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++; // Skip escaped quote
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        currentRow.push(currentField.trim());
        currentField = "";
      } else if ((char === "\r" || char === "\n") && !insideQuotes) {
        if (char === "\r" && nextChar === "\n") i++;
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          lines.push(currentRow);
        }
        currentRow = [];
        currentField = "";
      } else {
        currentField += char;
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        lines.push(currentRow);
      }
    }

    return lines;
  }

  function normalizeDate(val) {
    if (!val) return "";
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // MM/DD/YYYY or M/D/YYYY
    let m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m) {
      return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
    }

    // YYYY/MM/DD
    m = s.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (m) {
      return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
    }

    // Jan 15, 2026 or 15 Jan 2026
    const parsed = Date.parse(s);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      return d.toISOString().split("T")[0];
    }

    return s;
  }

  function normalizeStatus(val) {
    if (!val) return "Applied";
    const s = String(val).toLowerCase().trim();
    if (/reject|deni|turn|not\s*selected|archive/i.test(s)) return "Rejected";
    if (/offer/i.test(s)) return "Offer Received";
    if (/final|onsite/i.test(s)) return "Final Round / Onsite";
    if (/tech|coding/i.test(s)) return "Technical Interview";
    if (/screen|phone|recruiter/i.test(s)) return "Recruiter Screen";
    if (/oa|assessment|hackerrank|codesignal/i.test(s)) return "Online Assessment (OA)";
    if (/save|book/i.test(s)) return "Saved";
    return "Applied";
  }

  function detectHeaderMappings(headers) {
    const mappings = {
      company: -1,
      title: -1,
      location: -1,
      date_applied: -1,
      status: -1,
      rejection_date: -1
    };

    const rules = {
      company: /^(company|company[\s_]?name|business|organization|organisation|employer|firm|corp)$/i,
      title: /^(job|title|role|position|job[\s_]?title|role[\s_]?title|position[\s_]?title)$/i,
      location: /^(location|city|workplace|geo|office|job[\s_]?location|city[\s_]?state)$/i,
      date_applied: /^(date|applied|app|date[\s_]?applied|applied[\s_]?date|filled|date[\s_]?filled|timestamp|created|submission[\s_]?date)$/i,
      status: /^(status|update|current|stage|pipeline[\s_]?stage|application[\s_]?status|state)$/i,
      rejection_date: /^(rejected|date[\s_]?rejected|rejection[\s_]?date|rejected[\s_]?date|denial[\s_]?date)$/i
    };

    headers.forEach((h, idx) => {
      const cleanH = h.replace(/[^a-zA-Z0-9_\s]/g, "").trim();
      for (const [key, regex] of Object.entries(rules)) {
        if (mappings[key] === -1 && regex.test(cleanH)) {
          mappings[key] = idx;
          break;
        }
      }
    });

    return mappings;
  }

  async function processCsvFile(file) {
    if (!file) return;
    if (dropZone) dropZone.style.display = "none";
    if (loader) loader.style.display = "block";

    try {
      const text = await file.text();
      const rows = parseCsvText(text);

      if (rows.length < 2) {
        alert("The CSV file must contain at least a header row and one data row.");
        resetImportView();
        return;
      }

      const headers = rows[0];
      const mappings = detectHeaderMappings(headers);

      // Fallback heuristics if column header names were slightly off
      if (mappings.company === -1) {
        mappings.company = headers.findIndex((h) => /comp|org|bus/i.test(h));
      }
      if (mappings.title === -1) {
        mappings.title = headers.findIndex((h) => /job|title|role|pos/i.test(h));
      }
      if (mappings.date_applied === -1) {
        mappings.date_applied = headers.findIndex((h) => /date|appl/i.test(h));
      }

      const existingApps = (window.GRTS.State && window.GRTS.State.applications) || [];
      const existingLookup = new Set(
        existingApps.map((a) => `${(a.company_name || "").toLowerCase()}|${(a.job_title || "").toLowerCase()}`)
      );

      parsedRecords = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0 || row.every((c) => !c)) continue;

        const rawComp = mappings.company !== -1 ? row[mappings.company] || "" : row[0] || "";
        const rawTitle = mappings.title !== -1 ? row[mappings.title] || "" : row[1] || "";
        const rawLoc = mappings.location !== -1 ? row[mappings.location] || "" : "";
        const rawDate = mappings.date_applied !== -1 ? row[mappings.date_applied] || "" : "";
        const rawStatus = mappings.status !== -1 ? row[mappings.status] || "" : "";
        const rawRejDate = mappings.rejection_date !== -1 ? row[mappings.rejection_date] || "" : "";

        const company = rawComp.trim();
        const title = rawTitle.trim();
        const location = rawLoc.trim();
        const dateApplied = normalizeDate(rawDate) || new Date().toISOString().split("T")[0];
        const status = normalizeStatus(rawStatus);
        const rejectionDate = normalizeDate(rawRejDate);

        const isDuplicate = existingLookup.has(`${company.toLowerCase()}|${title.toLowerCase()}`);
        const isValid = Boolean(company && title);

        parsedRecords.push({
          index: i,
          company,
          title,
          location,
          date_applied: dateApplied,
          status: status,
          rejection_date: rejectionDate || null,
          isDuplicate,
          isValid
        });
      }

      renderPreviewTable(parsedRecords, mappings);

      if (loader) loader.style.display = "none";
      if (previewContainer) previewContainer.style.display = "block";
      if (badgeCount) {
        badgeCount.style.display = "inline-block";
        badgeCount.innerText = `${parsedRecords.length} Applications Detected`;
      }
    } catch (err) {
      console.error("CSV Parse Error:", err);
      alert(`Failed to parse CSV file: ${err.message}`);
      resetImportView();
    }
  }

  function renderPreviewTable(records, mappings) {
    if (!previewTbody) return;

    if (records.length === 0) {
      previewTbody.innerHTML = `<tr><td colspan="7" class="empty-state">No valid data rows found in CSV.</td></tr>`;
      return;
    }

    const matchedKeys = Object.values(mappings).filter((v) => v !== -1).length;
    if (summaryText) {
      summaryText.innerText = `Auto-matched ${matchedKeys} of 6 standard columns`;
    }

    previewTbody.innerHTML = records
      .map((r, idx) => {
        const dupBadge = r.isDuplicate
          ? `<span style="font-size:0.7rem; background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px; font-weight:700; margin-left:6px;">Duplicate</span>`
          : "";
        const invalidBadge = !r.isValid
          ? `<span style="font-size:0.7rem; background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-weight:700; margin-left:6px;">Missing Fields</span>`
          : "";

        return `
          <tr style="border-bottom: 1px solid var(--border-color); ${!r.isValid ? "opacity:0.65; background:#fffbeb;" : ""}">
            <td style="padding: 8px 12px; color: var(--text-muted);">${idx + 1}</td>
            <td style="padding: 8px 12px; font-weight: 700; color: var(--text-main);">
              ${escapeHtml(r.company || "—")}
              ${dupBadge}
              ${invalidBadge}
            </td>
            <td style="padding: 8px 12px; color: var(--text-main);">${escapeHtml(r.title || "—")}</td>
            <td style="padding: 8px 12px; color: var(--text-muted);">${escapeHtml(r.location || "—")}</td>
            <td style="padding: 8px 12px; font-variant-numeric: tabular-nums;">${escapeHtml(r.date_applied || "—")}</td>
            <td style="padding: 8px 12px;">
              <span class="status-badge" style="font-size:0.75rem;">${escapeHtml(r.status)}</span>
            </td>
            <td style="padding: 8px 12px; font-variant-numeric: tabular-nums; color: var(--danger);">${escapeHtml(r.rejection_date || "—")}</td>
          </tr>
        `;
      })
      .join("");
  }

  // ----------------- BATCH IMPORT EXECUTION -----------------

  if (confirmBtn) {
    confirmBtn.addEventListener("click", async () => {
      const skipDuplicates = skipDuplicatesChk ? skipDuplicatesChk.checked : true;
      const recordsToImport = parsedRecords.filter((r) => {
        if (!r.isValid) return false;
        if (skipDuplicates && r.isDuplicate) return false;
        return true;
      });

      if (recordsToImport.length === 0) {
        alert("No eligible applications to import (either all rows are invalid or duplicate).");
        return;
      }

      confirmBtn.disabled = true;
      if (importProgressContainer) importProgressContainer.style.display = "block";
      if (importStatusMsg) importStatusMsg.innerText = "Importing...";

      let importedCount = 0;
      let errorCount = 0;

      for (let i = 0; i < recordsToImport.length; i++) {
        const item = recordsToImport[i];
        const payload = {
          company_name: item.company,
          job_title: item.title,
          location: item.location,
          date_applied: item.date_applied,
          status: item.status,
          rejection_date: item.rejection_date,
          notes: "Imported from CSV spreadsheet",
          priority: 3
        };

        try {
          const res = await fetch(`${API_BASE}/apply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            importedCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          errorCount++;
        }

        const pct = Math.round(((i + 1) / recordsToImport.length) * 100);
        if (importProgressBar) importProgressBar.style.width = `${pct}%`;
        if (importProgressPercent) importProgressPercent.innerText = `${pct}% (${i + 1}/${recordsToImport.length})`;
      }

      if (importStatusMsg) {
        importStatusMsg.style.color = errorCount === 0 ? "var(--success)" : "var(--warning)";
        importStatusMsg.innerText = `✓ Successfully imported ${importedCount} applications!`;
      }

      showToast(`Imported ${importedCount} applications`);
      loadDashboardData();

      setTimeout(() => {
        resetImportView();
        confirmBtn.disabled = false;
      }, 2500);
    });
  }

  // ----------------- 5-COLUMN CSV EXPORT -----------------

  function generateAndDownloadCsv() {
    const apps = (window.GRTS.State && window.GRTS.State.applications) || [];
    if (apps.length === 0) {
      alert("No applications available to export.");
      return;
    }

    // Required 5 columns strictly: Role, Company, Location, Date Applied, Date Rejected
    const headers = ["Job Title", "Company Name", "Location", "Date Applied", "Date Rejected"];
    
    const rows = apps.map((app) => {
      const title = `"${(app.job_title || "").replace(/"/g, '""')}"`;
      const company = `"${(app.company_name || "").replace(/"/g, '""')}"`;
      const location = `"${(app.location || "").replace(/"/g, '""')}"`;
      const dateApplied = `"${app.date_applied || ""}"`;
      const dateRejected = `"${app.rejection_date || ""}"`;
      return [title, company, location, dateApplied, dateRejected].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const todayStr = new Date().toISOString().split("T")[0];
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `grts_applications_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${apps.length} applications to CSV`);
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", generateAndDownloadCsv);
  }
  if (quickExportHeaderBtn) {
    quickExportHeaderBtn.addEventListener("click", generateAndDownloadCsv);
  }
}
