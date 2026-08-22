// Dashboard Resume Version Manager & Document Previewer

let isPdfPreviewOpen = false;

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

  // Delegated click handler on resumes container
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
          setSafeInnerHTML(pdfStatus, `<span style="display:inline-flex; align-items:center; gap:4px; color:#166534;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Document loaded: ${escapeHtml(file.name)} (${Math.round(file.size / 1024)} KB)</span>`);
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
    setSafeInnerHTML(container, `<div style="font-size:0.85rem; color:var(--text-muted); padding:16px 0;">
            No resume versions tracked yet. Click "+ New Version" to add your master YAML/PDF resume.
        </div>`);
    return;
  }

  setSafeInnerHTML(container, resumes
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
                        ${r.has_pdf ? "Change File" : "+ Attach File"}
                    </button>
                    <button class="action-btn delete-resume-btn" data-id="${r.id}" style="padding:3px 8px; font-size:0.7rem; background:#fee2e2; color:#991b1b; border:1px solid #f87171; font-weight:600; cursor:pointer;">Delete</button>
                </div>
            </div>
        </div>
    `;
    })
    .join(""));

  if (resumes.length > 0 && !currentSelectedResume) {
    selectResumeVersion(resumes[0].id);
  }
}

window.attachPdfToResumeVersion = function (resumeId) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".pdf,.docx,.doc";
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
        console.error("Failed to upload resume document:", err);
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
      const isDocx =
        (r.pdf_file_name || "").endsWith(".docx") ||
        (r.pdf_file_name || "").endsWith(".doc");
      setSafeInnerHTML(badge, `<span style="color:#166534; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#166534" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>Connected Resume File:</span> <strong>${escapeHtml(r.pdf_file_name || (isDocx ? "Resume.docx" : "Resume.pdf"))}</strong> (${sizeKb} KB)`);
      toggleBtn.style.display = r.content ? "inline-flex" : "none";
      downloadBtn.style.display = "inline-flex";

      if (isDocx) {
        pdfFrame.style.display = "none";
        diffViewer.style.display = "block";
        setSafeInnerHTML(diffViewer, `<div style="padding:16px; background:#f8fafc; border-radius:8px;">
                    <div style="font-weight:700; display:inline-flex; align-items:center; gap:5px; margin-bottom:4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>DOCX Resume Document Connected: ${escapeHtml(r.pdf_file_name)}</div><br/>
                    <span style="color:var(--text-muted); font-size:0.82rem;">This DOCX file will be automatically attached during job applications.</span>
                    ${r.content ? `<div style="margin-top:12px; font-family:monospace; white-space:pre-wrap; font-size:0.8rem; background:#ffffff; padding:10px; border:1px solid #e2e8f0; border-radius:6px;">${escapeHtml(r.content)}</div>` : ""}
                </div>`);
      } else {
        pdfFrame.style.display = "block";
        diffViewer.style.display = "none";
        pdfFrame.src = r.pdf_base64;
      }
    } else {
      setSafeInnerHTML(badge, `<span style="color:#854d0e; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#854d0e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>No PDF/DOCX document uploaded</span> — Click "+ Replace PDF / DOCX" to connect your resume file.`);
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
  setSafeInnerHTML(sel,
    '<option value="">None (Master Base Resume)</option>' +
    resumesData
      .map(
        (r) =>
          `<option value="${r.id}">${escapeHtml(r.name)} (${escapeHtml(r.version_tag)})</option>`,
      )
      .join(""));
}

function computeSimpleDiff(oldText, newText) {
  const oldLines = (oldText || "").split("\n");
  const newLines = (newText || "").split("\n");
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
