// Dashboard Detail Drawer, Role Edits, Journey Milestones, Cover Letters, Links, Contacts & Manual Add Modal

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

  const crEl = document.getElementById("dViewCompanyRole");
  if (crEl)
    crEl.innerText = `${app.company_name || "Unknown"} — ${app.job_title || "Unknown Role"}`;

  let wpText = app.workplace_type || "Remote";
  if (app.days_in_office !== null && app.days_in_office !== undefined) {
    if (app.days_in_office === 0) wpText += " (0d/wk in-office)";
    else if (app.days_in_office === 5) wpText += " (5d/wk in-office)";
    else wpText += ` (${app.days_in_office}d/wk in-office)`;
  }
  if (app.location) wpText += ` • ${app.location}`;
  const wpEl = document.getElementById("dViewWorkplaceSchedule");
  if (wpEl) wpEl.innerText = wpText;

  let tsText = app.job_type || "Full-time";
  if (app.salary_range) tsText += ` • ${app.salary_range}`;
  const tsEl = document.getElementById("dViewTypeSalary");
  if (tsEl) tsEl.innerText = tsText;

  const urlEl = document.getElementById("dViewUrl");
  if (urlEl) {
    if (app.url) {
      setSafeInnerHTML(urlEl, `<a href="${escapeHtml(app.url)}" target="_blank" style="color:var(--primary); text-decoration:underline; word-break:break-all;">${escapeHtml(app.url)}</a>`);
    } else {
      urlEl.innerText = "No URL attached";
    }
  }

  const priorityEl = document.getElementById("dViewPriority");
  if (priorityEl) {
    const prio = app.priority || 1;
    const stars = "★".repeat(prio) + "☆".repeat(5 - prio);
    setSafeInnerHTML(priorityEl, `<span style="color:#f59e0b; font-size:1.05rem; font-weight:700;">${stars}</span> <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600;">(${prio}/5)</span>`);
  }

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

  const descEl = document.getElementById("dViewJobDescription");
  if (descEl) {
    descEl.innerText =
      app.job_description ||
      "No job description captured for this application.";
  }
}

function renderCoverLetterSection(app) {
  const displayEl = document.getElementById("dCoverLetterDisplay");
  const fileNameEl = document.getElementById("dCoverLetterFileName");
  const textareaEl = document.getElementById("dCoverLetterTextarea");
  
  if (displayEl) {
    if (app.cover_letter && app.cover_letter.trim()) {
      displayEl.innerText = app.cover_letter;
      displayEl.style.color = "var(--text-main)";
    } else {
      displayEl.innerText = "No cover letter content saved.";
      displayEl.style.color = "var(--text-muted)";
    }
  }
  if (fileNameEl) {
    fileNameEl.innerText = app.cover_letter_file_name ? `File: ${app.cover_letter_file_name}` : "";
  }
  if (textareaEl) {
    textareaEl.value = app.cover_letter || "";
  }
}

function renderLinksSection(app) {
  const container = document.getElementById("dLinksList");
  if (!container) return;
  const links = app.additional_links || [];
  if (links.length === 0) {
    setSafeInnerHTML(container, `<div style="font-size:0.8rem; color:var(--text-muted);">No additional tracking links added yet.</div>`);
    return;
  }
  setSafeInnerHTML(container, links.map((link, idx) => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid var(--border-color); border-radius:6px; padding:6px 10px; font-size:0.82rem;">
      <a href="${escapeHtml(link.url)}" target="_blank" style="font-weight:700; color:var(--primary); text-decoration:underline; word-break:break-all;">${escapeHtml(link.label || link.url)}</a>
      <button type="button" class="action-btn action-btn-danger remove-link-btn" data-index="${idx}" style="padding:1px 6px; font-size:0.72rem;">Remove</button>
    </div>
  `).join(""));
}

function renderContactsSection(app) {
  const container = document.getElementById("dContactsList");
  if (!container) return;
  const contacts = app.contacts || [];
  if (contacts.length === 0) {
    setSafeInnerHTML(container, `<div style="font-size:0.8rem; color:var(--text-muted);">No key contacts added yet.</div>`);
    return;
  }
  setSafeInnerHTML(container, contacts.map((c, idx) => `
    <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:8px; padding:8px 12px; font-size:0.82rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
        <span style="font-weight:700; color:var(--text-main);">${escapeHtml(c.name)}${c.role ? ` — <span style="font-weight:500; color:var(--text-muted);">${escapeHtml(c.role)}</span>` : ""}</span>
        <button type="button" class="action-btn action-btn-danger remove-contact-btn" data-index="${idx}" style="padding:1px 6px; font-size:0.72rem;">Remove</button>
      </div>
      ${c.email ? `<div style="font-size:0.78rem; color:var(--primary); margin-bottom:2px;"><a href="mailto:${escapeHtml(c.email)}">${escapeHtml(c.email)}</a></div>` : ""}
      ${c.notes ? `<div style="font-size:0.78rem; color:var(--text-muted); white-space:pre-wrap;">${escapeHtml(c.notes)}</div>` : ""}
    </div>
  `).join(""));
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
      const editDateEl = document.getElementById("dEditDateApplied");
      if (editDateEl)
        editDateEl.value = currentSelectedApp.date_applied
          ? currentSelectedApp.date_applied.split(" ")[0]
          : "";
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
      const editDateEl = document.getElementById("dEditDateApplied");
      if (editDateEl)
        editDateEl.value = currentSelectedApp.date_applied
          ? currentSelectedApp.date_applied.split(" ")[0]
          : "";
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
      date_applied:
        document.getElementById("dEditDateApplied")?.value ||
        currentSelectedApp.date_applied ||
        null,
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
        showToast("Role and application details updated");
        currentSelectedApp = { ...currentSelectedApp, ...updatedData };
        document.getElementById("dJobTitle").innerText =
          updatedData.job_title || currentSelectedApp.job_title;
        document.getElementById("dCompanyName").innerText =
          updatedData.company_name || currentSelectedApp.company_name;

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
          setSafeInnerHTML(starsContainer, renderClickableStars(
            currentSelectedApp.id,
            currentSelectedApp.priority || 1,
          ));

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

  // Cover Letter Handlers
  const toggleEditCL = document.getElementById("toggleCoverLetterEditBtn");
  const editAreaCL = document.getElementById("dCoverLetterEditArea");
  const cancelCL = document.getElementById("cancelCoverLetterBtn");
  const saveCL = document.getElementById("saveCoverLetterBtn");
  const copyCL = document.getElementById("copyCoverLetterBtn");
  const uploadCL = document.getElementById("uploadCoverLetterFile");

  toggleEditCL?.addEventListener("click", () => {
    if (editAreaCL) {
      editAreaCL.style.display = editAreaCL.style.display === "none" ? "block" : "none";
    }
  });

  cancelCL?.addEventListener("click", () => {
    if (editAreaCL) editAreaCL.style.display = "none";
  });

  saveCL?.addEventListener("click", async () => {
    if (!currentSelectedApp) return;
    const newText = document.getElementById("dCoverLetterTextarea")?.value || "";
    try {
      const res = await fetch(`${API_BASE}/applications/${currentSelectedApp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cover_letter: newText }),
      });
      if (res.ok) {
        showToast("Cover letter saved");
        currentSelectedApp.cover_letter = newText;
        renderCoverLetterSection(currentSelectedApp);
        if (editAreaCL) editAreaCL.style.display = "none";
      }
    } catch (err) {
      console.error("Failed to save cover letter:", err);
    }
  });

  copyCL?.addEventListener("click", () => {
    const text = currentSelectedApp?.cover_letter || "";
    if (!text) {
      showToast("No cover letter text to copy");
      return;
    }
    navigator.clipboard.writeText(text);
    showToast("Cover letter text copied to clipboard");
  });

  uploadCL?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file || !currentSelectedApp) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target.result;
      try {
        const res = await fetch(`${API_BASE}/applications/${currentSelectedApp.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cover_letter: content,
            cover_letter_file_name: file.name,
          }),
        });
        if (res.ok) {
          showToast(`Cover letter file "${file.name}" attached`);
          currentSelectedApp.cover_letter = content;
          currentSelectedApp.cover_letter_file_name = file.name;
          renderCoverLetterSection(currentSelectedApp);
        }
      } catch (err) {
        console.error("Failed to upload cover letter file:", err);
      }
    };
    reader.readAsText(file);
  });

  // Additional Links Handlers
  const addLinkBtn = document.getElementById("addLinkBtn");
  addLinkBtn?.addEventListener("click", async () => {
    if (!currentSelectedApp) return;
    const labelInput = document.getElementById("newLinkLabel");
    const urlInput = document.getElementById("newLinkUrl");
    const label = labelInput?.value.trim() || "";
    const url = urlInput?.value.trim() || "";
    if (!url) {
      alert("Please enter a valid URL.");
      return;
    }
    const currentLinks = currentSelectedApp.additional_links || [];
    const updatedLinks = [...currentLinks, { label: label || url, url }];
    try {
      const res = await fetch(`${API_BASE}/applications/${currentSelectedApp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additional_links: updatedLinks }),
      });
      if (res.ok) {
        showToast("Tracking link added");
        currentSelectedApp.additional_links = updatedLinks;
        renderLinksSection(currentSelectedApp);
        if (labelInput) labelInput.value = "";
        if (urlInput) urlInput.value = "";
      }
    } catch (err) {
      console.error("Failed to add tracking link:", err);
    }
  });

  document.getElementById("dLinksList")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".remove-link-btn");
    if (!btn || !currentSelectedApp) return;
    const idx = parseInt(btn.getAttribute("data-index"), 10);
    const links = [...(currentSelectedApp.additional_links || [])];
    links.splice(idx, 1);
    try {
      const res = await fetch(`${API_BASE}/applications/${currentSelectedApp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additional_links: links }),
      });
      if (res.ok) {
        showToast("Tracking link removed");
        currentSelectedApp.additional_links = links;
        renderLinksSection(currentSelectedApp);
      }
    } catch (err) {
      console.error("Failed to remove tracking link:", err);
    }
  });

  // Contacts Handlers
  const addContactBtn = document.getElementById("addContactBtn");
  addContactBtn?.addEventListener("click", async () => {
    if (!currentSelectedApp) return;
    const nameInput = document.getElementById("newContactName");
    const roleInput = document.getElementById("newContactRole");
    const emailInput = document.getElementById("newContactEmail");
    const notesInput = document.getElementById("newContactNotes");
    const name = nameInput?.value.trim() || "";
    if (!name) {
      alert("Please enter a contact name.");
      return;
    }
    const newContact = {
      name,
      role: roleInput?.value.trim() || "",
      email: emailInput?.value.trim() || "",
      notes: notesInput?.value.trim() || "",
    };
    const currentContacts = currentSelectedApp.contacts || [];
    const updatedContacts = [...currentContacts, newContact];
    try {
      const res = await fetch(`${API_BASE}/applications/${currentSelectedApp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: updatedContacts }),
      });
      if (res.ok) {
        showToast("Contact added");
        currentSelectedApp.contacts = updatedContacts;
        renderContactsSection(currentSelectedApp);
        if (nameInput) nameInput.value = "";
        if (roleInput) roleInput.value = "";
        if (emailInput) emailInput.value = "";
        if (notesInput) notesInput.value = "";
      }
    } catch (err) {
      console.error("Failed to add contact:", err);
    }
  });

  document.getElementById("dContactsList")?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".remove-contact-btn");
    if (!btn || !currentSelectedApp) return;
    const idx = parseInt(btn.getAttribute("data-index"), 10);
    const contacts = [...(currentSelectedApp.contacts || [])];
    contacts.splice(idx, 1);
    try {
      const res = await fetch(`${API_BASE}/applications/${currentSelectedApp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts }),
      });
      if (res.ok) {
        showToast("Contact removed");
        currentSelectedApp.contacts = contacts;
        renderContactsSection(currentSelectedApp);
      }
    } catch (err) {
      console.error("Failed to remove contact:", err);
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

      showToast("Milestone recorded");
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
    setSafeInnerHTML(qaContainer, `<div style="font-size:0.82rem; color:var(--text-muted); padding:4px 0;">Standard fields used (no unique questions). Click "+ Add Q&A" to record custom questions for this application.</div>`);
    return;
  }

  setSafeInnerHTML(qaContainer, customQAs
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
    .join(""));
}

window.openDetailDrawer = async function (appId) {
  const modal = document.getElementById("appDetailModal");
  modal.classList.add("open");

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
    const dLogoEl = document.getElementById("dCompanyLogo");
    if (dLogoEl) {
      delete dLogoEl.dataset.fallbackStep;
      let logoSrc = app.company_logo;
      if (!logoSrc && app.company_website) {
        try {
          const fullUrl = app.company_website.startsWith("http")
            ? app.company_website
            : `https://${app.company_website}`;
          const host = new URL(fullUrl).hostname.toLowerCase();
          const isAts = [
            "oraclecloud.com", "oracle.com", "taleo.net",
            "myworkdayjobs.com", "workday.com",
            "greenhouse.io", "lever.co", "ashbyhq.com",
            "smartrecruiters.com", "icims.com", "jobvite.com"
          ].some((ats) => host.includes(ats));
          if (!isAts) {
            const d = host.replace(/^www\./, "");
            logoSrc = `https://${d}/favicon.ico`;
          }
        } catch (e) {}
      }
      if (!logoSrc && app.company_name) {
        const slug = app.company_name.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (slug.includes("jpmorgan") || slug.includes("jpmc")) {
          logoSrc = `https://jpmorganchase.com/favicon.ico`;
        } else if (slug) {
          logoSrc = `https://${slug}.com/favicon.ico`;
        }
      }
      dLogoEl.src = logoSrc || "grts-logo-sqr.svg";
      dLogoEl.onerror = function () {
        if (typeof handleLogoFallback === "function") {
          handleLogoFallback(dLogoEl, app.company_name, app.company_website);
        } else {
          dLogoEl.onerror = null;
          dLogoEl.src = "grts-logo-sqr.svg";
        }
      };
    }
    document.getElementById("dStatusSelect").value = app.status;

    const starsContainer = document.getElementById("dPriorityStars");
    if (starsContainer) {
      setSafeInnerHTML(starsContainer, renderClickableStars(
        app.id,
        app.priority || 1,
      ));
    }

    populateRoleDetailsView(app);
    renderCoverLetterSection(app);
    renderLinksSection(app);
    renderContactsSection(app);
    renderDrawerQAList(app);

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
    const dEditDateEl = document.getElementById("dEditDateApplied");
    if (dEditDateEl)
      dEditDateEl.value = app.date_applied ? app.date_applied.split(" ")[0] : "";
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
    let linksHtml = "";
    if (app.url) {
      linksHtml += `<a href="${escapeHtml(app.url)}" target="_blank" class="action-btn">Job Post</a>`;
    }
    if (app.company_website) {
      linksHtml += `<a href="${escapeHtml(app.company_website)}" target="_blank" class="action-btn">Company</a>`;
    }
    setSafeInnerHTML(linksContainer, linksHtml);

    const timelineContainer = document.getElementById("dTimelineList");
    const timelineEvents = app.timeline || [];
    if (timelineEvents.length === 0) {
      setSafeInnerHTML(timelineContainer, `<div style="font-size:0.82rem; color:var(--text-muted); padding:8px 0;">No milestones logged yet.</div>`);
    } else {
      setSafeInnerHTML(timelineContainer, timelineEvents
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
        .join(""));
    }
  } catch (err) {
    console.error("Error opening detail drawer:", err);
  }
};

function initMilestoneActionListeners() {
  document.addEventListener("click", async (e) => {
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
          showToast("Milestone removed");
          if (currentSelectedApp) openDetailDrawer(currentSelectedApp.id);
          loadDashboardData();
        }
      } catch (err) {
        console.error("Failed to delete milestone:", err);
      }
      return;
    }

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
    manualCoverLetterFileName = "";
    const fnEl = document.getElementById("m_cover_letter_filename");
    if (fnEl) fnEl.innerText = "";
  };

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

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

  let manualCoverLetterFileName = "";
  const mCoverLetterFileInput = document.getElementById("m_cover_letter_file");
  const mCoverLetterFileNameEl = document.getElementById("m_cover_letter_filename");
  const mCoverLetterTextarea = document.getElementById("m_cover_letter");

  if (mCoverLetterFileInput) {
    mCoverLetterFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      manualCoverLetterFileName = file.name;
      if (mCoverLetterFileNameEl) mCoverLetterFileNameEl.innerText = file.name;

      if (file.name.endsWith(".txt")) {
        const reader = new FileReader();
        reader.onload = (re) => {
          if (mCoverLetterTextarea) mCoverLetterTextarea.value = re.target.result;
        };
        reader.readAsText(file);
      }
    });
  }

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
          mLogoInput.value = `https://${slug}.com/favicon.ico`;
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
      cover_letter: document.getElementById("m_cover_letter")?.value.trim() || null,
      cover_letter_file_name: manualCoverLetterFileName || null,
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

function initEmailSyncModal() {
  const openBtn = document.getElementById("openEmailSyncModalBtn");
  const modal = document.getElementById("emailSyncModal");
  const closeBtn = document.getElementById("closeEmailSyncModalBtn");
  if (!modal || !openBtn) return;

  const openModal = async () => {
    modal.style.display = "flex";
    await loadEmailConfig();
    await loadEmailLogs();
  };

  const closeModal = () => {
    modal.style.display = "none";
  };

  openBtn.addEventListener("click", openModal);
  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  const tabSettingsBtn = document.getElementById("emailTabSettingsBtn");
  const tabLogsBtn = document.getElementById("emailTabLogsBtn");
  const settingsView = document.getElementById("emailSettingsView");
  const logsView = document.getElementById("emailLogsView");

  if (tabSettingsBtn && tabLogsBtn) {
    tabSettingsBtn.addEventListener("click", () => {
      tabSettingsBtn.classList.add("active");
      tabSettingsBtn.style.background = "#fef3c7";
      tabSettingsBtn.style.color = "#92400e";
      tabLogsBtn.classList.remove("active");
      tabLogsBtn.style.background = "transparent";
      tabLogsBtn.style.color = "var(--text-muted)";
      if (settingsView) settingsView.style.display = "block";
      if (logsView) logsView.style.display = "none";
    });

    tabLogsBtn.addEventListener("click", () => {
      tabLogsBtn.classList.add("active");
      tabLogsBtn.style.background = "#fef3c7";
      tabLogsBtn.style.color = "#92400e";
      tabSettingsBtn.classList.remove("active");
      tabSettingsBtn.style.background = "transparent";
      tabSettingsBtn.style.color = "var(--text-muted)";
      if (settingsView) settingsView.style.display = "none";
      if (logsView) logsView.style.display = "block";
      loadEmailLogs();
    });
  }

  const providerSelect = document.getElementById("em_provider");
  const hostInput = document.getElementById("em_host");
  const portInput = document.getElementById("em_port");
  const sslSelect = document.getElementById("em_ssl");

  if (providerSelect) {
    providerSelect.addEventListener("change", () => {
      const p = providerSelect.value;
      if (p === "gmail") {
        if (hostInput) hostInput.value = "imap.gmail.com";
        if (portInput) portInput.value = "993";
        if (sslSelect) sslSelect.value = "1";
      } else if (p === "outlook") {
        if (hostInput) hostInput.value = "outlook.office365.com";
        if (portInput) portInput.value = "993";
        if (sslSelect) sslSelect.value = "1";
      } else if (p === "yahoo") {
        if (hostInput) hostInput.value = "imap.mail.yahoo.com";
        if (portInput) portInput.value = "993";
        if (sslSelect) sslSelect.value = "1";
      } else if (p === "icloud") {
        if (hostInput) hostInput.value = "imap.mail.me.com";
        if (portInput) portInput.value = "993";
        if (sslSelect) sslSelect.value = "1";
      }
    });
  }

  async function loadEmailConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/email/config`);
      if (res.ok) {
        const json = await res.json();
        const d = json.data || {};
        if (d.provider && providerSelect) providerSelect.value = d.provider;
        if (d.email_address) document.getElementById("em_address").value = d.email_address;
        if (d.imap_host && hostInput) hostInput.value = d.imap_host;
        if (d.imap_port && portInput) portInput.value = d.imap_port;
        if (d.use_ssl !== undefined && sslSelect) sslSelect.value = d.use_ssl ? "1" : "0";
        if (d.auto_sync !== undefined) {
          const autoSyncEl = document.getElementById("em_auto_sync");
          if (autoSyncEl) autoSyncEl.checked = Boolean(d.auto_sync);
        }
        if (d.last_synced_at) {
          const syncText = document.getElementById("emailLastSyncText");
          if (syncText) syncText.innerText = d.last_synced_at;
        }
      }
    } catch (err) {
      console.error("Failed to load email configuration:", err);
    }
  }

  const testBtn = document.getElementById("testEmailBtn");
  if (testBtn) {
    testBtn.addEventListener("click", async () => {
      const addr = document.getElementById("em_address")?.value.trim();
      const pwd = document.getElementById("em_password")?.value.trim();
      const host = hostInput ? hostInput.value.trim() : "imap.gmail.com";
      const port = portInput ? parseInt(portInput.value, 10) : 993;
      const ssl = sslSelect ? sslSelect.value === "1" : true;

      if (!addr) {
        alert("Please enter your Email Address to test.");
        return;
      }

      const origText = testBtn.innerText;
      testBtn.innerText = "Testing...";
      testBtn.disabled = true;

      const feedbackBox = document.getElementById("emailConnectionFeedback");
      if (feedbackBox) {
        feedbackBox.style.display = "none";
        feedbackBox.innerText = "";
      }

      try {
        const res = await fetch(`${API_BASE}/api/email/test`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imap_host: host,
            imap_port: port,
            use_ssl: ssl,
            email_address: addr,
            password: pwd || null
          })
        });
        const result = await res.json().catch(() => ({}));
        const errMsg = result.message || (typeof result.detail === "string" ? result.detail : (result.detail ? JSON.stringify(result.detail) : "Unknown error"));

        if (feedbackBox) {
          feedbackBox.style.display = "block";
          if (res.ok && result.status === "success") {
            feedbackBox.style.background = "#ecfdf5";
            feedbackBox.style.color = "#065f46";
            feedbackBox.style.border = "1px solid #a7f3d0";
            feedbackBox.innerHTML = `✓ <strong>Connected Successfully:</strong> ${escapeHtml(result.message || "Mailbox is accessible.")}`;
            showToast("IMAP connection verified");
          } else {
            feedbackBox.style.background = "#fff1f2";
            feedbackBox.style.color = "#9f1239";
            feedbackBox.style.border = "1px solid #fecdd3";
            feedbackBox.innerHTML = `✕ <strong>Connection Failed:</strong> ${escapeHtml(errMsg)}`;
          }
        }
      } catch (err) {
        if (feedbackBox) {
          feedbackBox.style.display = "block";
          feedbackBox.style.background = "#fff1f2";
          feedbackBox.style.color = "#9f1239";
          feedbackBox.style.border = "1px solid #fecdd3";
          feedbackBox.innerHTML = `✕ <strong>API / Network Error:</strong> ${escapeHtml(err.message)}`;
        }
      } finally {
        testBtn.innerText = origText;
        testBtn.disabled = false;
      }
    });
  }

  const configForm = document.getElementById("emailConfigForm");
  if (configForm) {
    configForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        provider: providerSelect?.value || "gmail",
        email_address: document.getElementById("em_address")?.value.trim(),
        password: document.getElementById("em_password")?.value.trim() || undefined,
        imap_host: hostInput?.value.trim() || "imap.gmail.com",
        imap_port: parseInt(portInput?.value || "993", 10),
        use_ssl: sslSelect?.value === "1",
        auto_sync: document.getElementById("em_auto_sync")?.checked ?? true,
        sync_interval_mins: 10
      };

      try {
        const res = await fetch(`${API_BASE}/api/email/config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          showToast("Email sync settings saved");
        } else {
          alert("Failed to save email settings.");
        }
      } catch (err) {
        console.error("Error saving email settings:", err);
      }
    });
  }

  const syncNowBtn = document.getElementById("syncNowEmailBtn");
  if (syncNowBtn) {
    syncNowBtn.addEventListener("click", async () => {
      const origText = syncNowBtn.innerText;
      syncNowBtn.innerText = "Scanning Inbox...";
      syncNowBtn.disabled = true;

      try {
        const res = await fetch(`${API_BASE}/api/email/sync?force=true`, { method: "POST" });
        const data = await res.json();
        if (res.ok && data.status === "success") {
          showToast(`Scanned ${data.scanned} emails: ${data.matched_and_updated} matched and updated!`);
          if (data.last_synced_at) {
            const syncText = document.getElementById("emailLastSyncText");
            if (syncText) syncText.innerText = data.last_synced_at;
          }
          loadDashboardData();
          loadEmailLogs();
        } else {
          alert(`Sync result: ${data.message || "Failed"}`);
        }
      } catch (err) {
        alert(`Error triggering sync: ${err.message}`);
      } finally {
        syncNowBtn.innerText = origText;
        syncNowBtn.disabled = false;
      }
    });
  }

  const refreshLogsBtn = document.getElementById("refreshLogsBtn");
  if (refreshLogsBtn) {
    refreshLogsBtn.addEventListener("click", loadEmailLogs);
  }

  async function loadEmailLogs() {
    const container = document.getElementById("emailLogsContainer");
    if (!container) return;

    try {
      const res = await fetch(`${API_BASE}/api/email/logs?limit=50`);
      if (!res.ok) return;
      const json = await res.json();
      const logs = json.data || [];

      if (logs.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 0.82rem;">No sync events recorded yet. Click "Sync Inbox Now" to scan.</div>`;
        return;
      }

      container.innerHTML = logs.map((item) => {
        let badgeColor = "#64748b";
        let badgeBg = "#f1f5f9";
        let badgeText = item.category ? item.category.toUpperCase() : "LOG";

        if (item.category === "rejection") {
          badgeColor = "#dc2626";
          badgeBg = "#fee2e2";
          badgeText = "REJECTION";
        } else if (item.category === "oa") {
          badgeColor = "#d97706";
          badgeBg = "#fef3c7";
          badgeText = "OA INVITE";
        } else if (item.category === "interview") {
          badgeColor = "#16a34a";
          badgeBg = "#dcfce7";
          badgeText = "INTERVIEW";
        }

        const matchedText = item.matched_company
          ? `<span style="color: #1e293b; font-weight: 600;">Matched: ${item.matched_company}</span>`
          : `<span style="color: #94a3b8;">Unmatched</span>`;

        return `
          <div style="background: #ffffff; border: 1px solid var(--border-color); border-radius: 6px; padding: 8px 10px; font-size: 0.8rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${badgeBg}; color: ${badgeColor};">${badgeText}</span>
                ${matchedText}
              </div>
              <span style="font-size: 0.72rem; color: var(--text-muted);">${item.email_date || item.created_at || ""}</span>
            </div>
            <div style="color: var(--text-main); font-weight: 500; margin-bottom: 2px;">${item.subject || "(No Subject)"}</div>
            <div style="font-size: 0.74rem; color: var(--text-muted);">${item.sender || ""}</div>
          </div>
        `;
      }).join("");

    } catch (err) {
      console.error("Error loading email logs:", err);
    }
  }
}

