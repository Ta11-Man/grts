// Content Script for GRTS Tracking Extension & Autofill
// Injected into job application pages across Greenhouse, Workday, Lever, Ashby, SmartRecruiters, LinkedIn, and generic ATS.

/**
 * Portal & Domain Classifier Guard
 * Ensures GRTS ONLY acts on real job boards and career portals,
 * strictly ignoring non-job sites (like GitHub PRs, search engines, social media, etc.).
 */
function isEligibleJobSite() {
    const hostname = window.location.hostname.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();

    // 1. Strict Blacklist for non-job sites
    const blacklist = [
        'github.com', 'gitlab.com', 'reddit.com', 'youtube.com', 
        'stackoverflow.com', 'stackexchange.com', 'twitter.com', 'x.com', 
        'facebook.com', 'instagram.com', 'threads.net', 'medium.com',
        'wikipedia.org', 'amazon.com', 'netflix.com', 'google.com/search',
        'mail.google.com', 'outlook.com', 'notion.so', 'figma.com'
    ];

    if (blacklist.some(domain => hostname.includes(domain) || `${hostname}${pathname}`.includes(domain))) {
        if (hostname.includes('google.com') && pathname.includes('/about/careers')) {
            return true;
        }
        return false;
    }

    // 2. Known Job ATS Whitelist
    const atsWhitelist = [
        'greenhouse.io', 'myworkdayjobs.com', 'workday.com', 
        'lever.co', 'ashbyhq.com', 'smartrecruiters.com', 
        'jobvite.com', 'rippling.com', 'bamboohr.com', 
        'icims.com', 'taleo.net', 'jazz.co', 'recruitee.com',
        'linkedin.com/jobs', 'ziprecruiter.com', 'indeed.com'
    ];

    if (atsWhitelist.some(domain => hostname.includes(domain) || `${hostname}${pathname}`.includes(domain))) {
        return true;
    }

    // 3. Localhost test files
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return true;
    }

    // 4. Heuristics for direct company career pages
    const isJobUrl = /\/(jobs|careers|career|apply|job|position|positions|requisition|openings)\b/i.test(pathname);
    const hasJobLdJson = !!document.querySelector('script[type="application/ld+json"]');
    const hasJobMeta = !!document.querySelector('meta[property="og:type"][content*="job"], [data-automation-id*="jobPosting"], [data-testid*="job"]');

    return isJobUrl || hasJobLdJson || hasJobMeta;
}

/**
 * Checks if current view is a login, account creation, or auth screen
 */
function isAuthOrLoginView() {
    // If a visible password field exists, it is a sign-in or create account form
    const passInput = document.querySelector('input[type="password"]');
    if (passInput) {
        const style = window.getComputedStyle(passInput);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
            return true;
        }
    }

    if (document.querySelector('[data-automation-id="signInModal"], [data-automation-id="createAccountPage"], [data-automation-id="signInPage"]')) {
        return true;
    }

    const path = window.location.pathname.toLowerCase();
    if (path.includes('/login') || path.includes('/signin') || path.includes('/createaccount')) {
        return true;
    }

    return false;
}

// Helpers to extract Workplace Type, Days in Office, Job Type, and Salary
function extractWorkplaceAndDays(textContext = "", locContext = "") {
    const combined = `${textContext} ${locContext}`.toLowerCase();
    let days = null;
    let workplace = "On-site";

    // 1. Look for explicit days in office patterns (e.g. "3 days in office", "Hybrid (2-3 days)", "3 days/wk on-site", "4 days a week in office")
    const daysMatch = combined.match(/(\d+)\s*(?:-|to\s*\d+)?\s*(?:days?|d)?\s*(?:per\s*week|a\s*week|\/wk|\/week)?\s*(?:in\s*office|on-?site|in\s*the\s*office|office)/i) ||
                      combined.match(/(?:in\s*office|on-?site|in\s*the\s*office)\s*(?:for\s*)?(\d+)\s*(?:days?|d)?/i);
    
    if (daysMatch) {
        days = parseInt(daysMatch[1], 10);
        if (days >= 0 && days <= 5) {
            if (days === 0) workplace = "Remote";
            else if (days === 5) workplace = "On-site";
            else workplace = "Hybrid";
        }
    }

    if (days === null) {
        if (combined.includes("remote") && !combined.includes("non-remote")) {
            workplace = "Remote";
            days = 0;
        } else if (combined.includes("hybrid")) {
            workplace = "Hybrid";
            days = 3; // Standard default for hybrid
        } else if (combined.includes("on-site") || combined.includes("onsite") || combined.includes("in-office")) {
            workplace = "On-site";
            days = 5;
        } else if (locContext.toLowerCase().includes("remote")) {
            workplace = "Remote";
            days = 0;
        }
    }

    return { workplace_type: workplace, days_in_office: days };
}

function extractSalaryRange(textContext = "") {
    if (!textContext) return "";
    const match = textContext.match(/\$[\d,]+(?:\.\d{2})?(?:\s*(?:-|to)\s*\$[\d,]+(?:\.\d{2})?)?(?:\s*(?:\/hr|\/hour|\/yr|\/year|\s*per\s*(?:hour|hr|year|annum)))?/i);
    return match ? match[0].trim() : "";
}

function extractJobType(textContext = "") {
    if (!textContext) return "Full-time";
    const text = textContext.toLowerCase();
    if (text.includes("intern") || text.includes("co-op") || text.includes("student")) return "Internship";
    if (text.includes("contract") || text.includes("temporary") || text.includes("temp")) return "Contract";
    if (text.includes("part-time") || text.includes("part time")) return "Part-time";
    return "Full-time";
}

// Persistent Job Context Storage Helpers across multi-step forms and page refreshes
function getCachedJobContext() {
    try {
        const stored = sessionStorage.getItem("grts_active_job_context");
        if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
}

function saveCachedJobContext(data) {
    if (!data || (!data.title && !data.company && !data.description)) return;
    try {
        const existing = getCachedJobContext() || {};
        const merged = {
            company: data.company || existing.company || "",
            title: data.title || existing.title || "",
            location: data.location || existing.location || "",
            description: data.description || existing.description || "",
            website: data.website || existing.website || "",
            logo: data.logo || existing.logo || "",
            ats_job_id: data.ats_job_id || existing.ats_job_id || "",
            ats_platform: data.ats_platform || existing.ats_platform || "",
            salary_range: data.salary_range || existing.salary_range || "",
            workplace_type: data.workplace_type || existing.workplace_type || "",
            days_in_office: data.days_in_office !== undefined && data.days_in_office !== null ? data.days_in_office : existing.days_in_office,
            job_type: data.job_type || existing.job_type || "",
            url: data.url || existing.url || window.location.href,
            cached_at: Date.now()
        };
        sessionStorage.setItem("grts_active_job_context", JSON.stringify(merged));
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            const hostKey = "grts_job_context_" + window.location.hostname.replace(/[^a-z0-9]/gi, '_');
            chrome.storage.local.set({ [hostKey]: merged, grts_last_seen_job: merged });
        }
    } catch (e) {}
}

/**
 * Helper to determine if an extracted title string is just a generic site/portal header
 * (e.g. "Careers at NVIDIA", "Job Application", "My Information", "Search Results")
 */
function isGenericTitle(titleStr, companyName = "") {
    if (!titleStr) return true;
    const t = titleStr.toLowerCase().trim();
    if (t.length < 3) return true;

    const genericPatterns = [
        /^careers?\b/i,
        /^jobs?\b/i,
        /\bcareers?\s*(?:at|with)\b/i,
        /\bjobs?\s*(?:at|with)\b/i,
        /\bwork\s*(?:at|with)\b/i,
        /\blife\s*(?:at|with)\b/i,
        /\bjoin\s*(?:our\s*team|us)\b/i,
        /\bsearch\s*(?:results|jobs?|openings)\b/i,
        /\bopen\s*positions?\b/i,
        /\bcurrent\s*openings?\b/i,
        /\bjob\s*openings?\b/i,
        /\bjob\s*opportunities\b/i,
        /\bcareer\s*opportunities\b/i,
        /\bcandidate\s*(?:home|portal)\b/i,
        /\bapplicant\s*portal\b/i,
        /\bmy\s*(?:information|experience|applications?|documents?)\b/i,
        /\bapplication\s*(?:questions?|form|progress)?\b/i,
        /\bvoluntary\s*(?:disclosure|self-identification)\b/i,
        /\bself-identification\b/i,
        /\breview\s*(?:and\s*submit|application)?\b/i,
        /\bsign\s*in\b/i,
        /\blog\s*in\b/i,
        /\bcreate\s*account\b/i,
        /\bwelcome\b/i,
        /\bworkday\b/i,
        /\bgreenhouse\b/i,
        /\blever\b/i,
        /\bashby\b/i
    ];

    if (genericPatterns.some(pat => pat.test(t))) return true;

    // If title is identical to company name
    if (companyName && t === companyName.toLowerCase().trim()) return true;

    return false;
}

function mergeWithCachedJobContext(liveData) {
    const cached = getCachedJobContext();
    if (!cached) return liveData;

    // Validate if live description is valid or just a form prompt/question
    const isLiveDescQuestion = !liveData.description || 
        liveData.description.length < 60 || 
        liveData.description.includes("?") || 
        liveData.description.includes("?*") ||
        liveData.description.toLowerCase().includes("legally authorized") ||
        liveData.description.toLowerCase().includes("sponsorship") ||
        liveData.description.toLowerCase().includes("preferred name");

    const bestDescription = (!isLiveDescQuestion && liveData.description && liveData.description.length > (cached.description || "").length) 
        ? liveData.description 
        : (cached.description || liveData.description || "");

    const effectiveCompany = liveData.company || cached.company || "";
    const isLiveTitleGeneric = isGenericTitle(liveData.title, effectiveCompany);

    const bestTitle = (!isLiveTitleGeneric && liveData.title) 
        ? liveData.title 
        : (cached.title && !isGenericTitle(cached.title, effectiveCompany) ? cached.title : (liveData.title || cached.title || ""));

    return {
        ...liveData,
        company: effectiveCompany,
        title: bestTitle,
        location: liveData.location || cached.location || "",
        description: bestDescription,
        website: liveData.website || cached.website || "",
        logo: liveData.logo || cached.logo || "",
        ats_job_id: liveData.ats_job_id || cached.ats_job_id || "",
        salary_range: liveData.salary_range || cached.salary_range || "",
        workplace_type: liveData.workplace_type || cached.workplace_type || "",
        days_in_office: liveData.days_in_office !== undefined && liveData.days_in_office !== null ? liveData.days_in_office : cached.days_in_office,
        job_type: liveData.job_type || cached.job_type || ""
    };
}

// Only initialize if on an eligible job site
if (isEligibleJobSite()) {
    if (window.GRTS_AUTOFILL) {
        window.GRTS_AUTOFILL.setupDynamicObserver();
    }
    setupAutoSubmitListener();
    // Cache any visible job posting details on initial page load
    setTimeout(() => {
        try { detectAndParseCurrentPage(); } catch (e) {}
    }, 800);
}

/**
 * Derives a crisp company logo from domain or page assets
 */
function resolveCompanyLogo(companyName, fallbackDomain = "") {
    // 1. Try explicit logo elements in ATS
    const pageLogo = document.querySelector('img[data-automation-id="companyLogo"], header img, .main-header-logo img, meta[property="og:image"]');
    if (pageLogo) {
        const src = pageLogo.src || pageLogo.content;
        if (src && !src.includes("data:") && src.startsWith("http")) return src;
    }

    // 2. Derive domain from company name or hostname
    let domain = fallbackDomain;
    if (!domain && companyName) {
        const cleanName = companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanName) domain = `${cleanName}.com`;
    }

    if (domain) {
        return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
    }

    return "grts-logo-sqr.svg";
}

/**
 * 1. Greenhouse Parser
 */
function parseGreenhouse() {
    let ogUrl = document.querySelector('meta[property="og:url"]')?.content || window.location.href;
    let ats_job_id = "";
    
    const ghMatch = ogUrl.match(/jobs\/(\d+)/) || window.location.pathname.match(/jobs\/(\d+)/);
    if (ghMatch) ats_job_id = ghMatch[1];

    let company = document.querySelector('.company-name') ? document.querySelector('.company-name').innerText.replace(/^at\s+/i, '').trim() : 
                  (document.querySelector('meta[property="og:site_name"]')?.content || "");
    
    if (!company && ogUrl.includes("greenhouse.io")) {
        const parts = ogUrl.split('/');
        if (parts.length >= 4) company = parts[3].replace(/[-_]/g, ' ');
    }

    const cleanCompany = company || document.title.split(/[-|]/)[0].trim();
    const loc = document.querySelector('.job__location div, .location, .job-location')?.innerText?.trim() || "";
    const desc = document.querySelector('.job__description, #content, .job-body')?.innerText?.trim() || "";
    let title = document.querySelector('.job__title h1, .app-title, [data-automation-id="job-title"]')?.innerText?.trim() || 
                document.querySelector('h1')?.innerText?.trim() || "";
    if (isGenericTitle(title, cleanCompany)) title = "";

    const { workplace_type, days_in_office } = extractWorkplaceAndDays(`${title} ${desc}`, loc);
    const salary_range = extractSalaryRange(desc);
    const job_type = extractJobType(`${title} ${desc}`);

    return {
        company: cleanCompany,
        title: title,
        location: loc,
        description: desc,
        workplace_type: workplace_type,
        days_in_office: days_in_office,
        salary_range: salary_range,
        job_type: job_type,
        website: document.querySelector('meta[property="og:url"]')?.content || window.location.origin,
        logo: resolveCompanyLogo(cleanCompany, window.location.hostname),
        ats_job_id: ats_job_id,
        ats_platform: "greenhouse"
    };
}

function cleanWorkdayLocationString(raw) {
    if (!raw) return "";
    let str = raw.trim();
    const validStates = new Set([
        'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA',
        'MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN',
        'TX','UT','VT','VA','WA','WV','WI','WY','DC','PR'
    ]);
    const stCityMatches = [...str.matchAll(/\b([A-Z]{2})-([A-Za-z\s]+?)(?:,\s*\d|\s+[A-Z]{2}-|\s*\(|$)/g)];
    if (stCityMatches.length > 0) {
        const extracted = [];
        for (const m of stCityMatches) {
            const st = m[1].toUpperCase();
            const city = m[2].trim().replace(/^(city of|town of)\s+/i, '');
            if (validStates.has(st) && city.length >= 2 && city.length <= 35) {
                const titleCity = city.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                extracted.push(`${titleCity}, ${st}`);
            }
        }
        if (extracted.length > 0) {
            let res = [...new Set(extracted)].join(' • ');
            if (/\(hybrid\)/i.test(str)) res += ' (Hybrid)';
            else if (/\(remote\)/i.test(str)) res += ' (Remote)';
            else if (/\(on-?site\)/i.test(str)) res += ' (On-site)';
            return res;
        }
    }
    return str;
}

/**
 * 2. Workday Parser (Front Page and Application Form)
 */
function parseWorkday() {
    let company = "";
    let companyWebsite = "";
    let logoUrl = "";

    // 1. Extract real company website from logoLink if present
    const logoLink = document.querySelector('a[data-automation-id="logoLink"], a[data-automation-id="companyLogoLink"], header a.css-11upv47');
    if (logoLink && logoLink.href && logoLink.href.startsWith("http") && !logoLink.href.includes("myworkdayjobs.com")) {
        companyWebsite = logoLink.href;
        try {
            const parsedUrl = new URL(companyWebsite);
            const domainParts = parsedUrl.hostname.replace(/^www\./, '').split('.');
            if (domainParts.length >= 2) {
                company = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
            }
        } catch (e) {}
    }

    // 2. Extract image from logoLink
    const logoImg = document.querySelector('img[data-automation-id="logo"], img[data-automation-id="companyLogo"]');
    if (logoImg && logoImg.src && logoImg.src.startsWith("http")) {
        logoUrl = logoImg.src;
    }

    if (!company) {
        const hostParts = window.location.hostname.split('.');
        if (hostParts.length > 2 && (window.location.hostname.includes("myworkdayjobs.com") || window.location.hostname.includes("workday.com"))) {
            let co = hostParts[0].replace(/[-_]/g, ' ');
            co = co.replace(/\b(wd\d+|external|careers|jobs)\b/gi, '').trim();
            company = co ? (co.charAt(0).toUpperCase() + co.slice(1)) : hostParts[0];
        } else {
            company = document.title.split('-').pop().split('|').pop().trim();
        }
    }

    let title = "";
    const titleEl = document.querySelector(`
        [data-automation-id="jobPostingHeader"], 
        section[data-automation-id="jobDetails"] h2, 
        [data-automation-id="jobTitle"], 
        h2.css-h1zxlu, 
        h2[data-automation-id*="job"],
        [data-automation-id="page-header"]
    `);
    if (titleEl) {
        const raw = titleEl.innerText.trim();
        if (!isGenericTitle(raw, company)) {
            title = raw;
        }
    }

    // 2. If inside application form, look for job title breadcrumb or summary header
    if (!title) {
        const breadcrumbOrHeader = document.querySelector('[data-automation-id="job-title"], [data-automation-id="jobPostingTitle"], .job-title, [data-automation-id="subHeader"]');
        if (breadcrumbOrHeader) {
            const raw = breadcrumbOrHeader.innerText.trim();
            if (!isGenericTitle(raw, company)) {
                title = raw;
            }
        }
    }

    // 3. Fallback to document.title if not generic
    if (!title && document.title) {
        const candidateTitles = document.title.split(/[-|•–—]/).map(s => s.trim()).filter(Boolean);
        for (const cand of candidateTitles) {
            if (!isGenericTitle(cand, company)) {
                title = cand;
                break;
            }
        }
    }

    // 4. Fallback to Workday URL slug (e.g. /job/Location/Software-Engineering-Intern_JR123/apply)
    if (!title) {
        try {
            const pathParts = window.location.pathname.split('/').filter(Boolean);
            const jobIdx = pathParts.indexOf('job');
            if (jobIdx >= 0 && pathParts.length > jobIdx + 1) {
                const candSlug = pathParts[pathParts.length - 1] === 'apply' ? pathParts[pathParts.length - 2] : pathParts[pathParts.length - 1];
                if (candSlug && candSlug.length > 3 && !candSlug.toLowerCase().startsWith('us-') && candSlug !== 'job') {
                    const cleanSlug = candSlug.replace(/_[A-Za-z0-9]+$/, '').replace(/[-_]/g, ' ').trim();
                    if (!isGenericTitle(cleanSlug, company)) {
                        title = cleanSlug;
                    }
                }
            }
        } catch (e) {}
    }

    let location = "";
    const locEl = document.querySelector('[data-automation-id="locations"] dd, [data-automation-id="jobPostingLocation"], [data-automation-id="locations"], [data-automation-id="location"], div.css-129m7dg');
    if (locEl) {
        location = locEl.innerText.replace(/^(locations?|\d+\s*locations?)[:\s-]*/i, '').trim();
        location = cleanWorkdayLocationString(location);
    }

    let description = "";
    const descEl = document.querySelector('[data-automation-id="jobPostingDescription"], [tabindex="0"][aria-label="Job Posting Description"], [data-automation-id="jobDescription"], [data-automation-id="viewJobDescription"], .GWTCKEditor-Disabled');
    if (descEl) {
        const text = descEl.innerText.trim();
        if (text.length > 50 && !text.includes("legally authorized to work in the country")) {
            description = text;
        }
    }

    let ats_job_id = "";
    const reqEl = document.querySelector('[data-automation-id="requisitionId"] dd, [data-automation-id="requisitionId"], [data-automation-id="jobPostingId"]');
    if (reqEl) ats_job_id = reqEl.innerText.replace(/REQ[-:]?\s*/i, '').trim();

    // Workday Front Page Subtitle / Metadata Badges
    const subtitleEls = Array.from(document.querySelectorAll('[data-automation-id="subtitle"], [data-automation-id="workplaceTypes"], [data-automation-id="time"], [data-automation-id="postedOn"], [data-automation-id="salary"], div.css-129m7dg, div.css-8x7x0f'));
    const subtitleText = subtitleEls.map(el => el.innerText).join(" ");

    const { workplace_type, days_in_office } = extractWorkplaceAndDays(`${subtitleText} ${title} ${description}`, location);
    const salary_range = extractSalaryRange(`${subtitleText} ${description}`);
    const job_type = extractJobType(`${subtitleText} ${title} ${description}`);

    const liveData = {
        company: company,
        title: title,
        location: location,
        description: description,
        workplace_type: workplace_type,
        days_in_office: days_in_office,
        salary_range: salary_range,
        job_type: job_type,
        website: companyWebsite,
        logo: resolvedLogo,
        ats_job_id: ats_job_id,
        ats_platform: "workday"
    };

    const merged = mergeWithCachedJobContext(liveData);
    saveCachedJobContext(merged);
    return merged;
}

/**
 * 3. Lever Parser
 */
function parseLever() {
    const rawTitle = document.title.split('-')[0].trim();
    const headline = document.querySelector('.posting-headline h2, .job-title')?.innerText?.trim() || rawTitle;
    const company = document.querySelector('.main-header-logo img')?.alt || 
                    document.title.split('-')[1]?.trim() || 
                    window.location.pathname.split('/')[1]?.replace(/[-_]/g, ' ') || "";

    const location = document.querySelector('.posting-categories .sort-by-time, .posting-categories .location')?.innerText?.trim() || "";
    const workplace = document.querySelector('.posting-categories .workplaceTypes')?.innerText?.trim() || "";
    const commitment = document.querySelector('.posting-categories .commitment')?.innerText?.trim() || "";

    return {
        company: company,
        title: headline,
        location: location,
        description: document.querySelector('.section.description, .job-description, .posting-page')?.innerText?.trim() || "",
        workplace_type: workplace,
        job_type: commitment,
        website: window.location.origin,
        logo: resolveCompanyLogo(company),
        ats_platform: "lever"
    };
}

/**
 * 4. Ashby Parser
 */
function parseAshby() {
    let company = "";
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) company = pathParts[0].replace(/[-_]/g, ' ');

    const cleanCompany = company || document.title.split('|')[0].trim();

    return {
        company: cleanCompany,
        title: document.querySelector('h1, [data-testid="job-title"]')?.innerText?.trim() || "",
        location: document.querySelector('[data-testid="job-location"], .location')?.innerText?.trim() || "",
        description: document.querySelector('[data-testid="job-description"], .description')?.innerText?.trim() || "",
        website: window.location.origin,
        logo: resolveCompanyLogo(cleanCompany),
        ats_platform: "ashby"
    };
}

/**
 * 5. SmartRecruiters Parser
 */
function parseSmartRecruiters() {
    const company = document.querySelector('.company-name, [data-qa="company-name"]')?.innerText?.trim() || document.title.split('-')[0].trim();
    return {
        company: company,
        title: document.querySelector('h1.job-title, [data-qa="job-title"]')?.innerText?.trim() || "",
        location: document.querySelector('.job-location, [data-qa="job-location"]')?.innerText?.trim() || "",
        description: document.querySelector('.job-sections, [data-qa="job-description"]')?.innerText?.trim() || "",
        website: window.location.origin,
        logo: resolveCompanyLogo(company),
        ats_platform: "smartrecruiters"
    };
}

/**
 * 6. LinkedIn Easy Apply Parser
 */
function parseLinkedIn() {
    const company = document.querySelector('.job-details-jobs-unified-top-card__company-name, .jobs-unified-top-card__company-name')?.innerText?.trim() || "";
    return {
        company: company,
        title: document.querySelector('.job-details-jobs-unified-top-card__job-title, .jobs-unified-top-card__job-title')?.innerText?.trim() || "",
        location: document.querySelector('.job-details-jobs-unified-top-card__bullet, .jobs-unified-top-card__bullet')?.innerText?.trim() || "",
        description: document.querySelector('.jobs-description__content, #job-details')?.innerText?.trim() || "",
        website: "https://www.linkedin.com",
        logo: resolveCompanyLogo(company),
        ats_platform: "linkedin"
    };
}

/**
 * 7. Google Careers Parser
 */
function parseGoogleCareers() {
    return {
        company: "Google",
        title: document.querySelector('h1, [data-automation-id="job-title"]')?.innerText?.trim() || "",
        location: document.querySelector('[data-automation-id="job-location"]')?.innerText?.trim() || "",
        description: document.querySelector('[data-automation-id="job-description"]')?.innerText?.trim() || "",
        website: "https://careers.google.com",
        logo: "https://www.google.com/favicon.ico",
        ats_platform: "google"
    };
}

/**
 * 8. Generic ATS Fallback
 */
function parseGenericATS() {
    let data = {
        company: "",
        title: "",
        location: "",
        description: "",
        website: window.location.origin,
        logo: "",
        ats_platform: "custom"
    };

    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
        try {
            const parsed = JSON.parse(script.innerText);
            const item = parsed['@type'] === 'JobPosting' ? parsed : (Array.isArray(parsed) ? parsed.find(x => x['@type'] === 'JobPosting') : null);
            if (item) {
                if (item.title) data.title = item.title;
                if (item.hiringOrganization?.name) data.company = item.hiringOrganization.name;
                if (item.jobLocation?.address?.addressLocality) {
                    data.location = `${item.jobLocation.address.addressLocality}, ${item.jobLocation.address.addressRegion || ''}`.trim();
                }
                if (item.description) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = item.description;
                    data.description = tempDiv.innerText.trim();
                }
                break;
            }
        } catch (e) {}
    }

    if (!data.company) {
        data.company = document.querySelector('meta[property="og:site_name"]')?.content || document.title.split(/[-|]/)[0].trim();
    }
    if (!data.title) {
        data.title = document.querySelector('meta[property="og:title"]')?.content || document.querySelector('h1')?.innerText?.trim() || "";
    }
    data.logo = resolveCompanyLogo(data.company, window.location.hostname);

    return data;
}

function extractCoverLetterFromPage() {
    const clSelectors = [
        'textarea[id*="cover" i]',
        'textarea[name*="cover" i]',
        'textarea[data-automation-id*="cover" i]',
        'textarea[aria-label*="cover" i]',
        'textarea[placeholder*="cover letter" i]',
        'div[data-automation-id*="cover" i] textarea',
        'div[id*="cover" i] textarea'
    ];
    for (const sel of clSelectors) {
        try {
            const el = document.querySelector(sel);
            if (el && el.value && el.value.trim().length > 15) {
                return el.value.trim();
            }
        } catch (e) {}
    }
    return null;
}

/**
 * Main dispatcher to parse whatever ATS is active
 */
function detectAndParseCurrentPage() {
    let data;
    const hostname = window.location.hostname.toLowerCase();
    const ogUrl = (document.querySelector('meta[property="og:url"]')?.content || "").toLowerCase();

    if (hostname.includes("greenhouse.io") || ogUrl.includes("greenhouse.io") || document.querySelector('#application-form, #application_form, .greenhouse-job-application')) {
        data = parseGreenhouse();
    } else if (hostname.includes("workday.com") || hostname.includes("myworkdayjobs.com") || document.querySelector('[data-automation-id*="jobPosting"], [data-automation-id*="apply"]')) {
        data = parseWorkday();
    } else if (hostname.includes("lever.co") || document.querySelector('.lever-application-form')) {
        data = parseLever();
    } else if (hostname.includes("ashbyhq.com")) {
        data = parseAshby();
    } else if (hostname.includes("smartrecruiters.com")) {
        data = parseSmartRecruiters();
    } else if (hostname.includes("linkedin.com")) {
        data = parseLinkedIn();
    } else if (hostname.includes("google.com") && window.location.pathname.includes("careers")) {
        data = parseGoogleCareers();
    } else {
        data = parseGenericATS();
    }

    const merged = mergeWithCachedJobContext(data);

    // Extract cover letter if typed into a form field
    const cl = extractCoverLetterFromPage();
    if (cl) {
        merged.cover_letter = cl;
    }

    if (window.GRTS_AUTOFILL && window.GRTS_AUTOFILL.extractCustomQuestionsAndAnswers) {
        try {
            merged.custom_answers = window.GRTS_AUTOFILL.extractCustomQuestionsAndAnswers();
        } catch (e) {}
    }
    saveCachedJobContext(merged);
    return merged;
}

/**
 * Captures submission events and attaches non-standard Q&A responses
 * Strictly prevents capturing intermediate navigation in multi-step wizards or auth/login screens.
 */
function setupAutoSubmitListener() {
    const triggerSubmitCapture = (e) => {
        if (!isEligibleJobSite()) return;
        if (isAuthOrLoginView()) {
            console.log("GRTS: Skipped submission capture (auth/login screen detected).");
            return;
        }

        const jobData = detectAndParseCurrentPage();

        if (!jobData.company && !jobData.title) {
            console.log("GRTS: Skipped submission capture (no job metadata found on this page).");
            return;
        }

        let customAnswers = [];
        if (window.GRTS_AUTOFILL && window.GRTS_AUTOFILL.extractCustomQuestionsAndAnswers) {
            try {
                customAnswers = window.GRTS_AUTOFILL.extractCustomQuestionsAndAnswers();
            } catch (e) {}
        }

        jobData.custom_answers = customAnswers;

        // Attach active resume version metadata if available
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get("grts_user_profile", (res) => {
                const p = res?.grts_user_profile || {};
                if (p.active_resume_tag) {
                    jobData.resume_version = p.active_resume_tag;
                }
                if (p.active_resume_pdf_name) {
                    jobData.resume_file_name = p.active_resume_pdf_name;
                }

                console.log("GRTS: Verified job submission capture. Sending payload to backend...", jobData.company, jobData.title, jobData.resume_version);

                if (chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({
                        action: "autoSubmit",
                        data: jobData,
                        url: window.location.href
                    });
                }
            });
            return;
        }

        console.log("GRTS: Verified job submission capture. Sending payload to backend...", jobData.company, jobData.title);

        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                action: "autoSubmit",
                data: jobData,
                url: window.location.href
            });
        }
    };

    // 1. Listen for genuine HTML form submissions on job sites
    document.addEventListener('submit', (e) => {
        if (!isEligibleJobSite() || isAuthOrLoginView()) return;
        triggerSubmitCapture(e);
    }, true);

    // 2. Listen for Workday / React Final Submit buttons ONLY
    document.addEventListener('click', (e) => {
        if (!isEligibleJobSite() || isAuthOrLoginView()) return;

        const target = e.target.closest('button, [role="button"], input[type="submit"], a');
        if (!target) return;

        const rawText = (target.innerText || target.textContent || target.value || target.getAttribute('aria-label') || '').toLowerCase();
        const cleanText = rawText.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
        const autoId = (target.getAttribute('data-automation-id') || '').toLowerCase().trim();

        // Accumulate Q&A pairs when user clicks "Next" / "Save and Continue" on multi-step forms
        if (cleanText === 'next' || cleanText === 'continue' || cleanText === 'save and continue' || cleanText === 'save & continue') {
            try {
                if (window.GRTS_AUTOFILL && window.GRTS_AUTOFILL.extractCustomQuestionsAndAnswers) {
                    window.GRTS_AUTOFILL.extractCustomQuestionsAndAnswers();
                }
            } catch (e) {}
            return;
        }

        if (cleanText === 'back' || cleanText === 'previous' || cleanText.includes('sign in') || cleanText.includes('log in') || cleanText.includes('create account')) {
            return;
        }

        // Only trigger on genuine final SUBMIT buttons
        const isFinalSubmit = 
            cleanText === 'submit' ||
            cleanText === 'submit application' ||
            cleanText === 'review and submit' ||
            cleanText === 'complete application' ||
            cleanText.startsWith('submit ') ||
            autoId === 'submitbutton' ||
            (autoId.includes('pagefooter') && cleanText.includes('submit')) ||
            (autoId.includes('nextbutton') && cleanText.includes('submit')) ||
            (autoId === 'bottom-navigation-next-button' && (cleanText.includes('submit') || window.location.pathname.includes('/review'))) ||
            (window.location.pathname.includes('/review') && cleanText.includes('submit'));

        if (isFinalSubmit) {
            triggerSubmitCapture(e);
            setTimeout(() => triggerSubmitCapture(e), 300);
        }
    }, true);

    // 3. Listen for clicks on "Apply" buttons to capture front-page job context before entering the wizard
    document.addEventListener('click', (e) => {
        const applyBtn = e.target.closest('a[data-automation-id*="adventureButton"], a[data-automation-id*="apply"], button[data-automation-id*="apply"], a[href*="/apply"], .apply-button');
        if (applyBtn) {
            try {
                const liveData = detectAndParseCurrentPage();
                if (liveData.description && liveData.description.length > 50) {
                    saveCachedJobContext(liveData);
                    console.log("GRTS: Captured and cached job context before applying:", liveData.title, liveData.company);
                }
            } catch (err) {}
        }
    }, true);
}

/**
 * Message listener for Extension Popup & Dashboard
 */
if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "getJobData") {
            try {
                const extracted = detectAndParseCurrentPage();
                sendResponse({ data: extracted });
            } catch (err) {
                sendResponse({ data: null, error: err.message });
            }
        } else if (request.action === "saveJob") {
            try {
                const jobData = detectAndParseCurrentPage();
                jobData.status = "Saved";
                if (chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({
                        action: "saveJobDirectly",
                        data: jobData,
                        url: window.location.href
                    }, (res) => {
                        sendResponse(res || { success: true });
                    });
                    return true;
                }
                sendResponse({ success: false });
            } catch (e) {
                sendResponse({ success: false, error: e.message });
            }
        } else if (request.action === "triggerAutofill") {
            if (window.GRTS_AUTOFILL) {
                window.GRTS_AUTOFILL.autofillPage(true).then(count => {
                    sendResponse({ success: true, count: count });
                });
                return true;
            }
            sendResponse({ success: false, message: "Autofill engine unavailable" });
        }
        return true;
    });
}
