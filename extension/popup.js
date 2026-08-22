document.addEventListener('DOMContentLoaded', async () => {
    let currentPriority = 3;
    let extractedExtras = {
        job_description: "",
        company_logo: "",
        company_website: "",
        ats_job_id: "",
        ats_platform: "",
        workplace_type: ""
    };

    // 0. Backend Status & Offline Queue Monitor
    const statusPill = document.getElementById('backendStatusPill');
    const statusPillText = document.getElementById('statusPillText');
    const queueBanner = document.getElementById('offlineQueueBanner');
    const queueBannerText = document.getElementById('queueBannerText');
    const syncNowBtn = document.getElementById('syncNowBtn');

    function updateBackendStatus() {
        if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.sendMessage) return;
        chrome.runtime.sendMessage({ action: "getBackendStatus" }, (res) => {
            if (chrome.runtime.lastError || !res) {
                if (statusPill) {
                    statusPill.className = "backend-pill status-offline";
                    if (statusPillText) statusPillText.innerText = "Offline";
                }
                return;
            }

            if (statusPill) {
                statusPill.className = `backend-pill ${res.online ? 'status-online' : 'status-offline'}`;
                if (statusPillText) statusPillText.innerText = res.online ? "Online" : "Offline";
            }

            if (queueBanner && queueBannerText) {
                if (res.queuedCount > 0) {
                    queueBanner.style.display = "flex";
                    queueBannerText.innerText = `⚠️ ${res.queuedCount} item${res.queuedCount > 1 ? 's' : ''} queued offline`;
                } else {
                    queueBanner.style.display = "none";
                }
            }
        });
    }

    if (syncNowBtn) {
        syncNowBtn.addEventListener('click', () => {
            syncNowBtn.disabled = true;
            syncNowBtn.innerText = "Syncing...";
            chrome.runtime.sendMessage({ action: "syncQueue" }, () => {
                syncNowBtn.disabled = false;
                syncNowBtn.innerText = "Sync Now";
                updateBackendStatus();
            });
        });
    }

    updateBackendStatus();

    // 1. Tab Navigation
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            if (targetContent) targetContent.classList.add('active');

            if (targetId === 'tab-profile') loadProfileIntoForm();
            if (targetId === 'tab-qa') loadQABank();
        });
    });

    // 2. Star Rating Selector
    const stars = document.querySelectorAll('#priorityStars .star');
    stars.forEach(star => {
        star.addEventListener('click', () => {
            const val = parseInt(star.getAttribute('data-val'), 10);
            currentPriority = val;
            stars.forEach((s, idx) => {
                if (idx < val) {
                    s.classList.add('active');
                } else {
                    s.classList.remove('active');
                }
            });
        });
    });

    // 3. Pre-fill Date
    const today = new Date();
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const dateInput = document.getElementById('date_applied');
    if (dateInput) dateInput.value = localDate;

    // 4. Query Active Tab for Job Info
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;
        const currentTab = tabs[0];
        const urlInput = document.getElementById('url');
        if (urlInput) urlInput.value = currentTab.url || "";

        if (currentTab.url && (currentTab.url.includes("http://") || currentTab.url.includes("https://"))) {
            chrome.tabs.sendMessage(currentTab.id, { action: "getJobData" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log("No content script responded on this page.");
                    return;
                }
                if (response && response.data) {
                    const d = response.data;
                    if (d.company) document.getElementById('company').value = d.company;
                    if (d.title) document.getElementById('title').value = d.title;
                    if (d.location) document.getElementById('location').value = d.location;
                    if (d.workplace_type) {
                        const wp = document.getElementById('workplace_type');
                        if (wp) wp.value = d.workplace_type;
                    }
                    if (d.days_in_office !== undefined && d.days_in_office !== null) {
                        const daysEl = document.getElementById('days_in_office');
                        if (daysEl) daysEl.value = d.days_in_office;
                    }
                    if (d.salary_range) {
                        const salEl = document.getElementById('salary_range');
                        if (salEl && !salEl.value) salEl.value = d.salary_range;
                    }

                    extractedExtras.job_description = d.description || "";
                    extractedExtras.company_logo = d.logo || "";
                    extractedExtras.company_website = d.website || "";
                    extractedExtras.ats_job_id = d.ats_job_id || "";
                    extractedExtras.ats_platform = d.ats_platform || "";
                    extractedExtras.days_in_office = d.days_in_office;
                }
            });
        }
    });

    // 5. Autofill Button
    const autofillBtn = document.getElementById('autofillNowBtn');
    if (autofillBtn) {
        autofillBtn.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs || tabs.length === 0) return;
                const tabId = tabs[0].id;

                function sendAutofillMsg() {
                    chrome.tabs.sendMessage(tabId, { action: "triggerAutofill" }, (response) => {
                        if (chrome.runtime.lastError) {
                            alert("Could not trigger autofill on this page. Please refresh the job application tab and try again.");
                            return;
                        }
                        if (response && response.count !== undefined) {
                            autofillBtn.innerHTML = `Auto-Filled ${response.count} Fields!`;
                            setTimeout(() => {
                                autofillBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Autofill Page`;
                            }, 2500);
                        }
                    });
                }

                chrome.tabs.sendMessage(tabId, { action: "triggerAutofill" }, (response) => {
                    if (chrome.runtime.lastError) {
                        if (chrome.scripting && chrome.scripting.executeScript) {
                            chrome.scripting.executeScript({
                                target: { tabId: tabId },
                                files: [
                                    "autofill/config.js",
                                    "autofill/profile.js",
                                    "autofill/dom_utils.js",
                                    "autofill/matcher.js",
                                    "autofill/adapters/workday.js",
                                    "autofill/adapters/greenhouse.js",
                                    "autofill/adapters/generic.js",
                                    "autofill/ui.js",
                                    "autofill/core.js",
                                    "content.js"
                                ]
                            }).then(() => {
                                setTimeout(sendAutofillMsg, 350);
                            }).catch(() => {
                                alert("Could not trigger autofill on this page. Please refresh the job application tab and try again.");
                            });
                        } else {
                            alert("Could not trigger autofill on this page. Please refresh the job application tab and try again.");
                        }
                        return;
                    }
                    if (response && response.count !== undefined) {
                        autofillBtn.innerHTML = `Auto-Filled ${response.count} Fields!`;
                        setTimeout(() => {
                            autofillBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Autofill Page`;
                        }, 2500);
                    }
                });
            });
        });
    }

    // 6. Save for Later (Quick Button)
    const saveForLaterBtn = document.getElementById('saveJobForLaterBtn');
    if (saveForLaterBtn) {
        saveForLaterBtn.addEventListener('click', async () => {
            const company = document.getElementById('company').value.trim();
            const title = document.getElementById('title').value.trim();

            if (!company || !title) {
                const statusEl = document.getElementById('status');
                statusEl.innerText = "Company and Title are required to save!";
                statusEl.style.color = "#e74c3c";
                return;
            }

            const rawDays = document.getElementById('days_in_office').value;
            const daysInOffice = rawDays !== "" ? parseInt(rawDays, 10) : null;

            const payload = {
                company_name: company,
                job_title: title,
                location: document.getElementById('location').value.trim(),
                date_applied: document.getElementById('date_applied').value,
                status: "Saved",
                url: document.getElementById('url').value.trim(),
                notes: document.getElementById('notes').value.trim() || "Saved for later review",
                resume_version: document.getElementById('resume').value.trim(),
                salary_range: document.getElementById('salary_range').value.trim(),
                workplace_type: document.getElementById('workplace_type').value,
                days_in_office: daysInOffice,
                priority: currentPriority,
                job_description: extractedExtras.job_description,
                company_logo: extractedExtras.company_logo,
                company_website: extractedExtras.company_website,
                ats_job_id: extractedExtras.ats_job_id,
                ats_platform: extractedExtras.ats_platform,
                custom_answers: extractedExtras.custom_answers || []
            };

            const statusEl = document.getElementById('status');
            statusEl.innerText = "Saving job bookmark...";
            statusEl.style.color = "#64748b";
            saveForLaterBtn.disabled = true;

            try {
                let saved = false;
                try {
                    const res = await fetch('http://127.0.0.1:8000/apply', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (res.ok) {
                        saved = true;
                        statusEl.innerText = "Saved to GRTS Tracker (Status: Saved)";
                        statusEl.style.color = "#4f46e5";
                        const statusSelect = document.getElementById('app_status');
                        if (statusSelect) statusSelect.value = "Saved";
                        updateBackendStatus();
                    }
                } catch (e) {}

                if (!saved && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({ action: "saveJobDirectly", data: payload }, (bgRes) => {
                        if (bgRes && bgRes.success) {
                            if (bgRes.queued) {
                                statusEl.innerText = "⚡ Saved to offline queue (will auto-sync)";
                                statusEl.style.color = "#d97706";
                            } else {
                                statusEl.innerText = "Saved to GRTS Tracker (Status: Saved)";
                                statusEl.style.color = "#4f46e5";
                            }
                            const statusSelect = document.getElementById('app_status');
                            if (statusSelect) statusSelect.value = "Saved";
                            updateBackendStatus();
                        } else {
                            statusEl.innerText = "Failed to save job.";
                            statusEl.style.color = "#e74c3c";
                        }
                    });
                }
            } catch (err) {
                statusEl.innerText = "Error: " + err.message;
                statusEl.style.color = "#e74c3c";
            } finally {
                saveForLaterBtn.disabled = false;
            }
        });
    }

    // 7. Save Application / Form Submit
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            const company = document.getElementById('company').value.trim();
            const title = document.getElementById('title').value.trim();

            if (!company || !title) {
                const statusEl = document.getElementById('status');
                statusEl.innerText = "Company and Title are required!";
                statusEl.style.color = "#e74c3c";
                return;
            }

            const rawDays = document.getElementById('days_in_office').value;
            const daysInOffice = rawDays !== "" ? parseInt(rawDays, 10) : null;
            const targetStatus = document.getElementById('app_status')?.value || "Applied";

            const payload = {
                company_name: company,
                job_title: title,
                location: document.getElementById('location').value.trim(),
                date_applied: document.getElementById('date_applied').value,
                status: targetStatus,
                url: document.getElementById('url').value.trim(),
                notes: document.getElementById('notes').value.trim(),
                resume_version: document.getElementById('resume').value.trim(),
                salary_range: document.getElementById('salary_range').value.trim(),
                workplace_type: document.getElementById('workplace_type').value,
                days_in_office: daysInOffice,
                priority: currentPriority,
                job_description: extractedExtras.job_description,
                company_logo: extractedExtras.company_logo,
                company_website: extractedExtras.company_website,
                ats_job_id: extractedExtras.ats_job_id,
                ats_platform: extractedExtras.ats_platform,
                custom_answers: extractedExtras.custom_answers || []
            };

            const statusEl = document.getElementById('status');
            statusEl.innerText = "Saving application...";
            statusEl.style.color = "#64748b";
            submitBtn.disabled = true;

            try {
                let saved = false;
                try {
                    const res = await fetch('http://127.0.0.1:8000/apply', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (res.ok) {
                        saved = true;
                        statusEl.innerText = "✅ " + (data.message || "Application saved!");
                        statusEl.style.color = "#00b894";
                        updateBackendStatus();
                    }
                } catch (e) {}

                if (!saved && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({ action: "autoSubmit", data: payload }, (bgRes) => {
                        if (bgRes && bgRes.success) {
                            if (bgRes.queued) {
                                statusEl.innerText = "⚡ Saved to offline queue (will auto-sync)";
                                statusEl.style.color = "#d97706";
                            } else {
                                statusEl.innerText = "✅ Application saved!";
                                statusEl.style.color = "#00b894";
                            }
                            updateBackendStatus();
                        } else {
                            statusEl.innerText = "❌ Error: Could not save.";
                            statusEl.style.color = "#e74c3c";
                        }
                    });
                }
            } catch (err) {
                statusEl.innerText = "❌ Error: " + err.message;
                statusEl.style.color = "#e74c3c";
            } finally {
                submitBtn.disabled = false;
            }
        });
    }

    // 7. Profile Load & Save
    async function loadProfileIntoForm() {
        let profile = {};
        try {
            const stored = await chrome.storage.local.get("grts_user_profile");
            if (stored && stored.grts_user_profile) {
                profile = stored.grts_user_profile;
            } else {
                const res = await fetch("http://127.0.0.1:8000/profile");
                if (res.ok) {
                    const json = await res.json();
                    profile = json.data || {};
                }
            }
        } catch (e) {
            console.error("Profile load error:", e);
        }

        const map = {
            prof_first_name: profile.first_name || "",
            prof_last_name: profile.last_name || "",
            prof_email: profile.email || "",
            prof_phone: profile.phone || "",
            prof_address: profile.address || "",
            prof_city: profile.city || "",
            prof_state: profile.state || "",
            prof_postal_code: profile.postal_code || "",
            prof_linkedin: profile.linkedin || "",
            prof_github: profile.github || "",
            prof_portfolio: profile.portfolio || "",
            prof_school: profile.school || "",
            prof_degree: profile.degree || "",
            prof_salary: profile.desired_salary || "",
            prof_notice: profile.notice_period || ""
        };

        for (const [id, val] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (el) el.value = val;
        }

        if (document.getElementById('prof_autofill_enabled')) {
            document.getElementById('prof_autofill_enabled').checked = profile.autofill_enabled === true;
        }

        if (profile.work_authorized_us) {
            const el = document.getElementById('prof_work_auth');
            if (el) el.value = profile.work_authorized_us;
        }
        if (profile.require_sponsorship) {
            const el = document.getElementById('prof_sponsorship');
            if (el) el.value = profile.require_sponsorship;
        }
    }

    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            const existingStored = await chrome.storage.local.get("grts_user_profile");
            const existing = existingStored?.grts_user_profile || {};

            const profileData = {
                ...existing,
                autofill_enabled: document.getElementById('prof_autofill_enabled') ? document.getElementById('prof_autofill_enabled').checked : false,
                first_name: document.getElementById('prof_first_name').value.trim(),
                last_name: document.getElementById('prof_last_name').value.trim(),
                email: document.getElementById('prof_email').value.trim(),
                phone: document.getElementById('prof_phone').value.trim(),
                address: document.getElementById('prof_address').value.trim(),
                city: document.getElementById('prof_city').value.trim(),
                state: document.getElementById('prof_state').value.trim(),
                postal_code: document.getElementById('prof_postal_code').value.trim(),
                country: "United States",
                linkedin: document.getElementById('prof_linkedin').value.trim(),
                github: document.getElementById('prof_github').value.trim(),
                portfolio: document.getElementById('prof_portfolio').value.trim(),
                work_authorized_us: document.getElementById('prof_work_auth').value,
                require_sponsorship: document.getElementById('prof_sponsorship').value,
                school: document.getElementById('prof_school').value.trim(),
                degree: document.getElementById('prof_degree').value.trim(),
                desired_salary: document.getElementById('prof_salary').value.trim(),
                notice_period: document.getElementById('prof_notice').value.trim()
            };

            const statusEl = document.getElementById('profileStatus');
            statusEl.innerText = "Saving profile...";
            statusEl.style.color = "#64748b";

            try {
                // Save to local storage
                await chrome.storage.local.set({ grts_user_profile: profileData });

                // Sync to backend
                await fetch('http://127.0.0.1:8000/profile', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(profileData)
                });

                statusEl.innerText = "Profile updated and synced!";
                statusEl.style.color = "#00b894";
            } catch (err) {
                statusEl.innerText = "Saved locally (Backend sync error)";
                statusEl.style.color = "#f59e0b";
            }
        });
    }

    // 8. Q&A Bank Search
    async function loadQABank(query = "") {
        const container = document.getElementById('qaListContainer');
        if (!container) return;

        try {
            const url = query ? `http://127.0.0.1:8000/questions?query=${encodeURIComponent(query)}` : 'http://127.0.0.1:8000/questions';
            const res = await fetch(url);
            if (!res.ok) throw new Error("Could not fetch Q&A");
            const data = await res.json();
            const questions = data.data || [];

            if (questions.length === 0) {
                container.innerHTML = `<div style="font-size:11.5px; color:#64748b; text-align:center; padding:20px;">No matching responses recorded yet. As you submit applications, custom Q&A will appear here!</div>`;
                return;
            }

            container.innerHTML = questions.slice(0, 15).map(q => `
                <div class="qa-card">
                    <div class="qa-question">${escapeHTML(q.question_text)}</div>
                    <div class="qa-answer">${escapeHTML(q.answer_text)}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                        <span style="font-size:10px; color:#94a3b8;">${escapeHTML(q.company_name || "")}</span>
                        <button class="qa-copy-btn" onclick="navigator.clipboard.writeText('${escapeAttr(q.answer_text)}'); alert('Copied answer to clipboard!');">Copy Answer</button>
                    </div>
                </div>
            `).join('');
        } catch (e) {
            container.innerHTML = `<div style="font-size:11.5px; color:#ef4444; text-align:center; padding:15px;">FastAPI server offline or unreachable.</div>`;
        }
    }

    const qaSearch = document.getElementById('qaSearchInput');
    if (qaSearch) {
        let debounce = null;
        qaSearch.addEventListener('input', (e) => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                loadQABank(e.target.value.trim());
            }, 300);
        });
    }

    // 9. Open Dashboard Buttons
    const openDashboard = () => {
        chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
    };

    const dBtn = document.getElementById('dashboardBtn');
    if (dBtn) dBtn.addEventListener('click', openDashboard);
    const hdBtn = document.getElementById('headerDashboardBtn');
    if (hdBtn) hdBtn.addEventListener('click', openDashboard);

    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, tag => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
        }[tag] || tag));
    }

    function escapeAttr(str) {
        if (!str) return '';
        return str.replace(/['"\\]/g, '\\$&').replace(/\n/g, '\\n');
    }
});
