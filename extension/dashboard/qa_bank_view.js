// Dashboard Q&A Bank Renderer & Action Handlers

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
      const isUnfilled = !q.answer_text || q.answer_text.trim() === "" || q.answer_text.trim() === "[Unfilled]";
      const cardBorder = isUnfilled ? "border: 1px solid #fdba74; background: #fff7ed;" : "";
      const badge = isUnfilled ? `<span style="font-size:0.7rem; font-weight:700; background:#ffedd5; color:#c2410c; border:1px solid #fed7aa; padding:1px 6px; border-radius:4px; margin-left:6px;">Unfilled / Needs Review</span>` : "";
      const answerDisplay = isUnfilled ? "Not filled out" : escapeHtml(q.answer_text);

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
          body: JSON.stringify({ question_text: questionText, answer_text: answerText }),
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
            showToast("Answer copied to clipboard");
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
          showToast("Question response removed from bank");
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
    showToast("Answer copied to clipboard");
  } catch (e) {}
  document.body.removeChild(textarea);
}
