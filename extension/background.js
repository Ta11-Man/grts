// Background service worker for GRTS Extension (Manifest V3)
// Routes all local backend API calls (127.0.0.1:8000) through this background worker
// with strict timeouts and automatic offline queueing/sync.

let isSyncInProgress = false;

function fetchWithTimeout(url, options = {}, timeoutMs = 1500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
        .then(res => {
            clearTimeout(timer);
            return res;
        })
        .catch(err => {
            clearTimeout(timer);
            throw err;
        });
}

// ----------------- PROFILE & RESUME CACHE -----------------

async function refreshCachedProfileAndResume() {
    try {
        const [profileRes, resumesRes] = await Promise.all([
            fetchWithTimeout("http://127.0.0.1:8000/profile").then(r => r.json()).catch(() => null),
            fetchWithTimeout("http://127.0.0.1:8000/resumes").then(r => r.json()).catch(() => null)
        ]);

        let profileData = {};
        if (profileRes && profileRes.data) {
            profileData = { ...profileRes.data };
        }

        if (resumesRes && resumesRes.data && resumesRes.data.length > 0) {
            const activeResume = resumesRes.data[0];
            profileData.active_resume_tag = activeResume.version_tag || "v1.0";
            
            try {
                const fullRes = await fetchWithTimeout(`http://127.0.0.1:8000/resumes/${activeResume.id}`).then(r => r.json()).catch(() => null);
                if (fullRes && fullRes.data) {
                    profileData.active_resume_pdf_base64 = fullRes.data.pdf_base64 || null;
                    profileData.active_resume_pdf_name = fullRes.data.pdf_file_name || `${fullRes.data.name}.pdf`;
                    profileData.active_resume_content = fullRes.data.content || "";
                }
            } catch (e) {}
        }

        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local && Object.keys(profileData).length > 0) {
            await chrome.storage.local.set({ grts_user_profile: profileData });
        }
        return profileData;
    } catch (err) {
        return null;
    }
}

// ----------------- OFFLINE QUEUE & SYNC -----------------

async function getOfflineQueue() {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return [];
    return new Promise((resolve) => {
        chrome.storage.local.get("grts_offline_queue", (res) => {
            resolve(res && Array.isArray(res.grts_offline_queue) ? res.grts_offline_queue : []);
        });
    });
}

async function saveOfflineQueue(queue) {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
    return new Promise((resolve) => {
        chrome.storage.local.set({ grts_offline_queue: queue }, () => {
            updateBadgeForQueue(queue.length);
            resolve();
        });
    });
}

async function queueOfflineApplication(payload, isSaveOnly) {
    const queue = await getOfflineQueue();
    const item = {
        id: "offline_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        payload: payload,
        isSaveOnly: isSaveOnly,
        queued_at: new Date().toISOString()
    };
    queue.push(item);
    await saveOfflineQueue(queue);
    console.log(`GRTS Offline Queue: Added item (${queue.length} pending).`);
    return item;
}

function updateBadgeForQueue(count) {
    if (typeof chrome === "undefined" || !chrome.action || !chrome.action.setBadgeText) return;
    if (count > 0) {
        chrome.action.setBadgeText({ text: `!${count}` });
        chrome.action.setBadgeBackgroundColor({ color: "#f59e0b" }); // Amber
    } else {
        chrome.action.setBadgeText({ text: "" });
    }
}

async function checkBackendOnline() {
    try {
        const res = await fetchWithTimeout("http://127.0.0.1:8000/ping", {}, 1000);
        return res.ok;
    } catch (e) {
        return false;
    }
}

async function syncOfflineQueue() {
    if (isSyncInProgress) return { syncing: true };
    isSyncInProgress = true;

    try {
        const isOnline = await checkBackendOnline();
        if (!isOnline) {
            const queue = await getOfflineQueue();
            updateBadgeForQueue(queue.length);
            isSyncInProgress = false;
            return { online: false, queued: queue.length };
        }

        // Also refresh cached profile since backend is confirmed online
        refreshCachedProfileAndResume().catch(() => {});

        const queue = await getOfflineQueue();
        if (queue.length === 0) {
            updateBadgeForQueue(0);
            isSyncInProgress = false;
            return { online: true, queued: 0, synced: 0 };
        }

        console.log(`GRTS Sync: Attempting to sync ${queue.length} offline applications...`);
        const remainingQueue = [];
        let syncedCount = 0;

        for (const item of queue) {
            try {
                const res = await fetchWithTimeout("http://127.0.0.1:8000/apply", {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.payload)
                }, 3000);

                if (res.ok) {
                    syncedCount++;
                } else {
                    remainingQueue.push(item);
                }
            } catch (err) {
                // Network error occurred during sync, keep this and remaining items
                remainingQueue.push(item);
                break;
            }
        }

        await saveOfflineQueue(remainingQueue);

        if (syncedCount > 0 && remainingQueue.length === 0) {
            if (chrome.action && chrome.action.setBadgeText) {
                chrome.action.setBadgeText({ text: "SYNC" });
                chrome.action.setBadgeBackgroundColor({ color: "#10b981" }); // Emerald green
                setTimeout(() => {
                    chrome.action.setBadgeText({ text: "" });
                }, 3500);
            }
        }

        console.log(`GRTS Sync: Finished. Synced ${syncedCount}, remaining ${remainingQueue.length}.`);
        isSyncInProgress = false;
        return { online: true, synced: syncedCount, remaining: remainingQueue.length };
    } catch (err) {
        isSyncInProgress = false;
        return { error: err.message };
    }
}

// ----------------- LIFECYCLE & TIMERS -----------------

chrome.runtime.onInstalled.addListener(() => {
    console.log("GRTS Tracker extension installed.");
    refreshCachedProfileAndResume();
    syncOfflineQueue();
});

if (chrome.runtime.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
        refreshCachedProfileAndResume();
        syncOfflineQueue();
    });
}

// Periodic background check & sync (every 25 seconds)
setInterval(() => {
    syncOfflineQueue().catch(() => {});
}, 25000);

// ----------------- MESSAGE LISTENER -----------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getBackendStatus") {
        (async () => {
            const online = await checkBackendOnline();
            const queue = await getOfflineQueue();
            sendResponse({ online, queuedCount: queue.length });
        })();
        return true;
    }

    if (request.action === "syncQueue") {
        syncOfflineQueue().then(res => {
            sendResponse(res);
        });
        return true;
    }

    if (request.action === "getProfileAndResume") {
        if (request.forceReload) {
            refreshCachedProfileAndResume().then(fresh => {
                sendResponse({ data: fresh || {} });
            });
        } else {
            chrome.storage.local.get("grts_user_profile", async (res) => {
                if (res && res.grts_user_profile && Object.keys(res.grts_user_profile).length > 0) {
                    sendResponse({ data: res.grts_user_profile });
                } else {
                    const fresh = await refreshCachedProfileAndResume();
                    sendResponse({ data: fresh || {} });
                }
            });
        }
        return true;
    }

    if (request.action === "autoSubmit" || request.action === "saveJobDirectly") {
        const d = request.data || {};
        
        let compName = (d.company || d.company_name || "").trim();
        let roleTitle = (d.title || d.job_title || "").trim();

        // Infer company name from URL if missing
        if (!compName && (request.url || d.url)) {
            try {
                const u = new URL(request.url || d.url);
                const parts = u.hostname.replace(/^www\./, '').split('.');
                if (parts.length >= 2) {
                    let c = parts[0].replace(/\b(careers|jobs|myworkdayjobs|workday|external)\b/gi, '').replace(/[-_]/g, ' ').trim();
                    compName = c ? (c.charAt(0).toUpperCase() + c.slice(1)) : parts[0];
                }
            } catch (e) {}
        }

        if (!compName) compName = "Applied Company";
        if (!roleTitle) roleTitle = "Job Applicant";

        const today = new Date();
        const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const isSaveOnly = request.action === "saveJobDirectly" || d.status === "Saved";

        const payload = {
            company_name: compName,
            job_title: roleTitle,
            location: d.location || "",
            date_applied: localDate,
            status: isSaveOnly ? "Saved" : (d.status || "Applied"),
            url: request.url || d.url || "",
            notes: d.notes || (isSaveOnly ? "Saved job posting for later review" : "Auto-captured on application submission"),
            resume_version: d.resume_version || "Default",
            resume_file_name: d.resume_file_name || null,
            job_description: d.description || d.job_description || "",
            company_logo: d.logo || d.company_logo || "",
            company_website: d.website || d.company_website || "",
            ats_job_id: d.ats_job_id || "",
            ats_platform: d.ats_platform || "auto",
            workplace_type: d.workplace_type || null,
            days_in_office: d.days_in_office !== undefined && d.days_in_office !== null ? d.days_in_office : null,
            salary_range: d.salary_range || null,
            job_type: d.job_type || null,
            priority: d.priority || 3,
            cover_letter: d.cover_letter || null,
            cover_letter_file_name: d.cover_letter_file_name || null,
            links: d.links || null,
            contacts: d.contacts || null,
            custom_answers: d.custom_answers || []
        };

        console.log(`GRTS Background: Sending ${isSaveOnly ? 'Save Job' : 'Application'} payload...`, payload);

        // Attempt direct submission to backend
        fetchWithTimeout('http://127.0.0.1:8000/apply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }, 2000)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(resData => {
            console.log(`GRTS Background: Successfully logged ${isSaveOnly ? 'saved job' : 'submission'}:`, resData);
            if (chrome.action && chrome.action.setBadgeText) {
                chrome.action.setBadgeText({ text: isSaveOnly ? "SAVE" : "OK" });
                chrome.action.setBadgeBackgroundColor({ color: isSaveOnly ? "#6366f1" : "#00b894" });
                setTimeout(() => {
                    chrome.action.setBadgeText({ text: "" });
                }, 4000);
            }
            sendResponse({ success: true, queued: false, data: resData });
        })
        .catch(async (err) => {
            // Backend is offline or request timed out: queue safely in local storage
            console.warn("GRTS Background: Backend unreachable. Queuing application locally:", err.message);
            await queueOfflineApplication(payload, isSaveOnly);
            sendResponse({
                success: true,
                queued: true,
                message: "Backend offline. Saved to offline queue (will auto-sync when GRTS starts)."
            });
        });

        return true;
    }
});
