// Dashboard Horizontal Single-Row Drag-and-Drop Kanban Board

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

  setSafeInnerHTML(kanbanContainer, columns
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
    .join(""));
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
