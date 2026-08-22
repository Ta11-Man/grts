/**
 * GRTS Autofill - Profile Loader, YAML Resume Parser & PDF Attachment
 */
window.GRTS = window.GRTS || {};

window.GRTS.Profile = (() => {
  let cachedProfile = null;

  /**
   * Parses structured YAML or Markdown Resume content into rich profile fields
   * Supports JSON Resume schema, nested YAML blocks, and flat format with multiple jobs and educations.
   */
  function parseYamlOrMarkdownResume(text) {
    if (!text) return {};
    const profile = {
      experience_list: [],
      education_list: [],
    };
    const lines = text.split("\n");
    let currentSection = null;
    let currentExp = null;
    let currentEdu = null;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      // Section header detection
      if (
        line.endsWith(":") &&
        !line.startsWith("-") &&
        !rawLine.startsWith(" ") &&
        !rawLine.startsWith("\t")
      ) {
        currentSection = line.replace(":", "").toLowerCase().trim();
        currentExp = null;
        currentEdu = null;
        continue;
      }

      // 1. Basics Section
      if (currentSection === "basics" || !currentSection) {
        if (line.includes(":")) {
          const colonIdx = line.indexOf(":");
          const k = line
            .substring(0, colonIdx)
            .replace(/^-\s*/, "")
            .toLowerCase()
            .trim();
          let v = line
            .substring(colonIdx + 1)
            .trim()
            .replace(/^['"]|['"]$/g, "");

          if (k === "name") {
            const parts = v.split(" ");
            profile.first_name = parts[0] || "";
            profile.last_name = parts.slice(1).join(" ") || "";
          } else if (k === "email") {
            profile.email = v;
          } else if (k === "phone") {
            profile.phone = v;
          } else if (k === "linkedin") {
            profile.linkedin = v.startsWith("http")
              ? v
              : `https://www.linkedin.com/in/${v}`;
          } else if (k === "github") {
            profile.github = v.startsWith("http")
              ? v
              : v.startsWith("github.com")
                ? `https://${v}`
                : `https://github.com/${v}`;
          } else if (k === "url" || k === "website" || k === "portfolio") {
            profile.portfolio = v.startsWith("http") ? v : `https://${v}`;
          } else if (k === "location" && !profile.address) {
            profile.address = v;
            const locParts = v.split(",");
            profile.city = locParts[0]?.trim() || "";
            if (locParts.length > 1) profile.state = locParts[1]?.trim() || "";
          } else if (k === "summary" && !profile.summary) {
            profile.summary = v;
          }
        }
      }

      // 2. Experience Section (All Jobs)
      else if (currentSection === "experience" || currentSection === "work") {
        if (
          line.startsWith("- company:") ||
          line.startsWith("- name:") ||
          line.startsWith("- employer:")
        ) {
          const colonIdx = line.indexOf(":");
          const compVal = line
            .substring(colonIdx + 1)
            .trim()
            .replace(/^['"]|['"]$/g, "");
          currentExp = {
            company: compVal,
            title: "",
            location: "",
            start_date: "",
            end_date: "",
            currently_work_here: false,
            description: "",
          };
          profile.experience_list.push(currentExp);
        } else if (line.includes(":") && currentExp) {
          const colonIdx = line.indexOf(":");
          const k = line
            .substring(0, colonIdx)
            .replace(/^-\s*/, "")
            .toLowerCase()
            .trim();
          const v = line
            .substring(colonIdx + 1)
            .trim()
            .replace(/^['"]|['"]$/g, "");

          if (k === "position" || k === "title" || k === "role") {
            currentExp.title = v;
          } else if (k === "location") {
            currentExp.location = v;
          } else if (k === "date" || k === "dates") {
            currentExp.date = v;
            currentExp.currently_work_here = /present|current/i.test(v);
            const matchYears = v.match(/(20\d\d)/g);
            if (matchYears && matchYears.length > 0) {
              currentExp.start_date = `${matchYears[0]}-05`;
              if (matchYears.length > 1) {
                currentExp.end_date = `${matchYears[1]}-08`;
              } else if (currentExp.currently_work_here) {
                currentExp.end_date = "";
              } else {
                currentExp.end_date = "2026-08";
              }
            }
          } else if (k === "start_date" || k === "start") {
            currentExp.start_date = v;
          } else if (k === "end_date" || k === "end") {
            currentExp.end_date = v;
            currentExp.currently_work_here = /present|current/i.test(v);
          } else if (k === "summary" || k === "description") {
            currentExp.description = v;
          }
        } else if (line.startsWith("- ") && currentExp) {
          const desc = line
            .substring(2)
            .trim()
            .replace(/^['"]|['"]$/g, "");
          if (
            desc.length > 10 &&
            !desc.startsWith("date:") &&
            !desc.startsWith("location:")
          ) {
            currentExp.description = currentExp.description
              ? `${currentExp.description}\n• ${desc}`
              : `• ${desc}`;
          }
        }
      }

      // 3. Education Section (All Schools)
      else if (currentSection === "education") {
        if (line.startsWith("- institution:") || line.startsWith("- school:")) {
          const colonIdx = line.indexOf(":");
          const instVal = line
            .substring(colonIdx + 1)
            .trim()
            .replace(/^['"]|['"]$/g, "");
          currentEdu = {
            school: instVal.split("--")[0].trim(),
            degree: "",
            discipline: "",
            gpa: "",
            edu_start_year: "2023",
            grad_year: "2026",
            start_date: "2023-08",
            end_date: "2026-12",
          };
          profile.education_list.push(currentEdu);
        } else if (line.includes(":") && currentEdu) {
          const colonIdx = line.indexOf(":");
          const k = line
            .substring(0, colonIdx)
            .replace(/^-\s*/, "")
            .toLowerCase()
            .trim();
          const v = line
            .substring(colonIdx + 1)
            .trim()
            .replace(/^['"]|['"]$/g, "");

          if (k === "studytype" || k === "degree") {
            if (v.includes(",")) {
              const degParts = v.split(",");
              currentEdu.degree = degParts[0].trim();
              currentEdu.discipline = degParts[1].trim();
            } else {
              currentEdu.degree = v;
            }
          } else if (k === "area" || k === "major" || k === "discipline") {
            currentEdu.discipline = v;
          } else if (k === "score" || k === "gpa") {
            const gpaMatch = v.match(/([0-4]\.\d+)/);
            currentEdu.gpa = gpaMatch ? gpaMatch[1] : v;
          } else if (k === "date" || k === "dates") {
            const matchYears = v.match(/(20\d\d)/g);
            if (matchYears && matchYears.length > 0) {
              if (matchYears.length > 1) {
                currentEdu.edu_start_year = matchYears[0];
                currentEdu.grad_year = matchYears[1];
                currentEdu.start_date = `${matchYears[0]}-08`;
                currentEdu.end_date = `${matchYears[1]}-12`;
              } else {
                currentEdu.grad_year = matchYears[0];
                currentEdu.end_date = `${matchYears[0]}-12`;
              }
            }
          }
        }
      }

      // 4. Skills Section
      else if (currentSection === "skills") {
        if (line.includes("keywords:")) {
          const kws = line
            .split("keywords:")[1]
            .trim()
            .replace(/^['"]|['"]$/g, "");
          if (kws) {
            profile.skills = (
              profile.skills ? `${profile.skills}, ${kws}` : kws
            )
              .replace(/#.*$/, "")
              .trim();
          }
        } else if (line.startsWith("skills:")) {
          profile.skills = line
            .substring(7)
            .trim()
            .replace(/^['"]|['"]$/g, "");
        }
      }
    }

    // Populate top-level experience fields from first entry if present
    if (profile.experience_list.length > 0) {
      const first = profile.experience_list[0];
      profile.current_company = first.company || profile.current_company;
      profile.current_title = first.title || profile.current_title;
      profile.current_location = first.location || profile.current_location;
      profile.experience_description =
        first.description || profile.experience_description;
      profile.currently_work_here = first.currently_work_here;
      profile.experience_start_date = first.start_date || "2026-05";
      profile.experience_end_date = first.end_date || "2026-08";
    }

    // Populate top-level education fields from first entry if present
    if (profile.education_list.length > 0) {
      const firstEdu = profile.education_list[0];
      profile.school = firstEdu.school || profile.school;
      profile.degree = firstEdu.degree || profile.degree;
      profile.discipline = firstEdu.discipline || profile.discipline;
      profile.gpa = firstEdu.gpa || profile.gpa;
      profile.edu_start_year = firstEdu.edu_start_year || "2023";
      profile.grad_year = firstEdu.grad_year || "2026";
      profile.edu_start_date = firstEdu.start_date || "2023-08";
      profile.edu_end_date = firstEdu.end_date || "2026-12";
    }

    return profile;
  }

  /**
   * Converts Base64 data to Blob
   */
  function b64toBlob(
    b64Data,
    contentType = "application/pdf",
    sliceSize = 512,
  ) {
    const cleanB64 = b64Data.replace(/^data:application\/pdf;base64,/, "");
    const byteCharacters = atob(cleanB64);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: contentType });
  }

  /**
   * Generates a valid standard PDF-1.4 binary Blob from text in pure JS
   */
  function generateSimplePdf(text, author = "") {
    const lines = (text || "Resume")
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .slice(0, 48);
    let streamContent = "BT /F1 10 Tf 50 750 Td 13 TL\n";
    for (const l of lines) {
      const sanitized = l.replace(/[\(\)\\]/g, " ").substring(0, 85);
      streamContent += `(${sanitized}) '\n`;
    }
    streamContent += "ET";

    const pdfData = `%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>>>> endobj
4 0 obj <</Length ${streamContent.length}>> stream
${streamContent}
endstream
endobj
5 0 obj <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>> endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000231 00000 n 
0000000${(300 + streamContent.length).toString().padStart(3, "0")} 00000 n 
trailer <</Size 6 /Root 1 0 R>>
startxref
${380 + streamContent.length}
%%EOF`;

    return new Blob([pdfData], { type: "application/pdf" });
  }

  /**
   * Merges user profile data with structured fields parsed from the active resume
   * Ensures profile data (experience_list, education_list, etc.) takes absolute priority for reliability.
   */
  function mergeProfileWithResume(profileData) {
    const defaultProfile = window.GRTS.Config.DEFAULT_PROFILE;
    let merged = { ...defaultProfile };

    if (profileData && typeof profileData === "object") {
      for (const [k, v] of Object.entries(profileData)) {
        if (v !== undefined && v !== null && String(v).trim() !== "") {
          merged[k] = v;
        }
      }
    }

    // Ensure experience_list and education_list from profile are preserved with highest priority
    if (
      profileData &&
      Array.isArray(profileData.experience_list) &&
      profileData.experience_list.length > 0
    ) {
      merged.experience_list = profileData.experience_list;
    }

    if (
      profileData &&
      Array.isArray(profileData.education_list) &&
      profileData.education_list.length > 0
    ) {
      merged.education_list = profileData.education_list;
    }

    if (profileData && profileData.active_resume_content) {
      const yamlFields = parseYamlOrMarkdownResume(
        profileData.active_resume_content,
      );
      for (const [k, v] of Object.entries(yamlFields)) {
        if (v !== undefined && v !== null && v !== "") {
          if (k === "experience_list") {
            if (
              !merged.experience_list ||
              merged.experience_list.length === 0
            ) {
              merged.experience_list = v;
            }
          } else if (k === "education_list") {
            if (!merged.education_list || merged.education_list.length === 0) {
              merged.education_list = v;
            }
          } else if (
            !merged[k] ||
            merged[k] === "" ||
            (k === "gpa" && !/^[0-4]\./.test(String(merged[k])))
          ) {
            merged[k] = v;
          }
        }
      }
    }
    if (
      merged.portfolio &&
      !merged.portfolio.startsWith("http://") &&
      !merged.portfolio.startsWith("https://")
    ) {
      merged.portfolio = `https://${merged.portfolio}`;
    }
    return merged;
  }

  /**
   * Loads user profile and active resume from local extension storage or background proxy
   */
  async function loadProfile(forceReload = false) {
    if (!forceReload && cachedProfile) return cachedProfile;

    // 1. Read from chrome.storage.local first
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        const stored = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve(null), 800);
          chrome.storage.local.get("grts_user_profile", (res) => {
            clearTimeout(timer);
            resolve(res?.grts_user_profile || null);
          });
        });
        if (stored && Object.keys(stored).length > 0 && !forceReload) {
          cachedProfile = mergeProfileWithResume(stored);
          return cachedProfile;
        }
      }
    } catch (e) {}

    // 2. Request profile via background script message (isolated extension context with 1200ms timeout)
    try {
      if (
        typeof chrome !== "undefined" &&
        chrome.runtime &&
        chrome.runtime.sendMessage
      ) {
        const bgRes = await new Promise((resolve) => {
          const timer = setTimeout(() => resolve(null), 1200);
          chrome.runtime.sendMessage(
            { action: "getProfileAndResume", forceReload: forceReload },
            (res) => {
              clearTimeout(timer);
              resolve(res?.data || null);
            },
          );
        });

        if (bgRes && Object.keys(bgRes).length > 0) {
          cachedProfile = mergeProfileWithResume(bgRes);
          return cachedProfile;
        }
      }
    } catch (e) {}

    cachedProfile = mergeProfileWithResume({});
    return cachedProfile;
  }

  /**
   * Checks if a resume file is already attached or present on the page
   */
  function hasExistingResumeAttachment() {
    if (window._grtsResumeUploadedOnPage) return true;

    if (document.querySelector(".grts-file-badge")) return true;

    const existingPill = document.querySelector(`
            [data-automation-id*="file-upload-item"],
            [data-automation-id*="uploaded-file"],
            [data-automation-id*="file-item"],
            [data-automation-id*="fileUploadItem"],
            [data-automation-id*="attachment-item"],
            [data-automation-id*="fileUpload-file"],
            [data-automation-id*="uploadedFile"],
            [data-automation-id="file-upload-item"]
        `);
    if (existingPill) return true;

    const uploadContainers = document.querySelectorAll(
      '[data-automation-id*="attachments"], [data-automation-id*="file-upload"], .file-upload, fieldset[data-automation-id*="attachment"], [data-automation-id="attachments-FileUpload"]',
    );
    for (const cont of uploadContainers) {
      const deleteBtn = cont.querySelector(
        'button[data-automation-id*="delete"], button[data-automation-id*="trash"], button[aria-label*="Delete"], button[aria-label*="Remove"], button[title*="Delete"], button[title*="Remove"]',
      );
      if (deleteBtn) return true;

      const text = (cont.textContent || "").toLowerCase();
      if (
        text.includes(".pdf") ||
        text.includes(".docx") ||
        text.includes(".doc")
      ) {
        return true;
      }
    }

    const fileInputs = document.querySelectorAll(
      'input[type="file"], input[data-automation-id*="file-upload-input"]',
    );
    for (const inp of fileInputs) {
      if (
        (inp.files && inp.files.length > 0) ||
        inp.dataset.grtsFileAttached === "true"
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Automatically attaches the active PDF Resume file to portal file upload inputs
   */
  function attachResumePdfIfPresent(profile) {
    if (!profile) return false;

    if (hasExistingResumeAttachment()) {
      window._grtsResumeUploadedOnPage = true;
      const uploadContainer = document.querySelector(
        '[data-automation-id*="attachments"], [data-automation-id*="file-upload"], .file-upload',
      );
      if (uploadContainer) window.GRTS.DOM.highlightElement(uploadContainer);
      return true;
    }

    const fileInputs = Array.from(
      document.querySelectorAll(
        'input[type="file"], input[data-automation-id*="file-upload-input"]',
      ),
    );
    let attached = false;

    for (const input of fileInputs) {
      const name = (
        input.name ||
        input.id ||
        input.getAttribute("data-automation-id") ||
        ""
      ).toLowerCase();
      const label = window.GRTS.Matcher.getFieldLabel(input).toLowerCase();
      const combined = `${name} ${label}`;

      const isResumeInput =
        combined.includes("resume") ||
        combined.includes("cv") ||
        combined.includes("curriculum") ||
        combined.includes("file-upload") ||
        combined.includes("upload a file") ||
        fileInputs.length === 1;

      if (
        isResumeInput &&
        !combined.includes("cover") &&
        !combined.includes("transcript")
      ) {
        try {
          let blob = null;
          const fileName =
            profile.active_resume_pdf_name ||
            `${profile.first_name || "Resume"}_${profile.last_name || "Draft"}_Resume.pdf`;

          if (profile.active_resume_pdf_base64) {
            blob = b64toBlob(
              profile.active_resume_pdf_base64,
              "application/pdf",
            );
          } else {
            const eduText =
              profile.education_list && profile.education_list.length > 0
                ? profile.education_list
                    .map(
                      (e) =>
                        `${e.school || ""} - ${e.degree || ""} (${e.discipline || ""}) GPA: ${e.gpa || ""}`,
                    )
                    .join("\n")
                : `${profile.school || ""} - ${profile.degree || ""}, ${profile.discipline || ""}`;
            const expText =
              profile.experience_list && profile.experience_list.length > 0
                ? profile.experience_list
                    .map(
                      (x) =>
                        `${x.company || ""} - ${x.title || ""}\n${x.description || ""}`,
                    )
                    .join("\n")
                : `${profile.current_company || ""} - ${profile.current_title || ""}\n${profile.experience_description || ""}`;

            const resumeContent = `${profile.first_name || ""} ${profile.last_name || ""}\n${profile.email || ""} | ${profile.phone || ""}\n${profile.portfolio || ""} | ${profile.linkedin || ""}\n\nEDUCATION:\n${eduText}\n\nEXPERIENCE:\n${expText}\n\nSKILLS:\n${profile.skills || ""}`;
            blob = generateSimplePdf(
              resumeContent,
              `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
            );
          }

          if (!blob) break;

          const file = new File([blob], fileName, { type: "application/pdf" });
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
          input.dataset.grtsFileAttached = "true";
          window._grtsResumeUploadedOnPage = true;

          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.dispatchEvent(new Event("input", { bubbles: true }));

          const parent =
            input.closest(
              '.file-upload, [data-automation-id*="file"], [data-automation-id*="attachments"], [data-automation-id="attachments-FileUpload"]',
            ) || input.parentElement;
          if (parent) {
            window.GRTS.DOM.highlightElement(parent);
            if (!parent.querySelector(".grts-file-badge")) {
              const badge = document.createElement("div");
              badge.className = "grts-file-badge";
              badge.innerHTML = `
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                <span>GRTS Attached: <strong>${fileName}</strong></span>
                            `;
              parent.appendChild(badge);
            }
          }

          attached = true;
          break;
        } catch (err) {
          console.error("[GRTS] Failed to auto-attach resume PDF:", err);
        }
      }
    }

    return attached;
  }

  /**
   * Intelligently determines if candidate has worked for the company being applied to,
   * comparing the target employer against all entries in profile.experience_list and profile.current_company.
   */
  function isPreviousWorkerAtCurrentCompany(profile, questionText = "") {
    if (!profile) return false;

    // 1. Gather all past/current company names from profile
    const profileCompanies = [];
    if (profile.current_company) profileCompanies.push(profile.current_company);
    if (profile.experience_list && Array.isArray(profile.experience_list)) {
      for (const exp of profile.experience_list) {
        if (exp.company) profileCompanies.push(exp.company);
        if (exp.name) profileCompanies.push(exp.name);
        if (exp.employer) profileCompanies.push(exp.employer);
      }
    }

    const normalizedPastCompanies = profileCompanies
      .map((c) =>
        String(c)
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(
            /\b(inc|llc|corp|corporation|ltd|co|group|services|tech|technologies)\b/g,
            "",
          )
          .trim(),
      )
      .filter((c) => c.length >= 2);

    if (normalizedPastCompanies.length === 0) {
      const raw = String(profile.previous_worker ?? "no")
        .trim()
        .toLowerCase();
      return raw === "yes" || raw === "true" || raw === "1";
    }

    // 2. Check if any past company name appears directly inside the question prompt text
    const qClean = String(questionText || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ");
    for (const pastCo of normalizedPastCompanies) {
      const escaped = pastCo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (pastCo.length > 2 && qClean.includes(pastCo)) {
        return true;
      }
      if (new RegExp(`(^|\\s)${escaped}(\\s|$)`, "i").test(qClean)) {
        return true;
      }
    }

    // 3. Detect the target company from current page URL & DOM
    let targetHostCo = "";
    try {
      const host = window.location.hostname.toLowerCase();
      const hostParts = host.split(".");
      if (
        hostParts.length > 2 &&
        (host.includes("myworkdayjobs.com") ||
          host.includes("workday.com") ||
          host.includes("greenhouse.io") ||
          host.includes("lever.co"))
      ) {
        targetHostCo = hostParts[0]
          .replace(/[-_]/g, " ")
          .replace(/[^a-z0-9\s]/g, "")
          .trim();
      } else {
        targetHostCo = hostParts[0];
      }
    } catch (e) {}

    const targetLogoAria = (
      document
        .querySelector(
          'a[data-automation-id*="logo"], a[data-automation-id*="companyLogo"], header a',
        )
        ?.getAttribute("aria-label") || ""
    ).toLowerCase();
    const pageTitle = (document.title || "").toLowerCase();

    const combinedPageTarget =
      `${targetHostCo} ${targetLogoAria} ${pageTitle}`.replace(
        /[^a-z0-9\s]/g,
        " ",
      );

    for (const pastCo of normalizedPastCompanies) {
      const escaped = pastCo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (
        pastCo.length > 2 &&
        (combinedPageTarget.includes(pastCo) ||
          (targetHostCo && targetHostCo.includes(pastCo)))
      ) {
        return true;
      }
      const pastTokens = pastCo
        .split(/\s+/)
        .filter(
          (t) =>
            t.length > 3 &&
            ![
              "health",
              "solutions",
              "systems",
              "consulting",
              "digital",
              "global",
            ].includes(t),
        );
      for (const tok of pastTokens) {
        if (combinedPageTarget.includes(tok)) {
          return true;
        }
      }
    }

    // 4. Default to profile setting if explicitly defined, otherwise false ("No")
    const fallback = String(profile.previous_worker ?? "no")
      .trim()
      .toLowerCase();
    return fallback === "yes" || fallback === "true" || fallback === "1";
  }

  return {
    loadProfile,
    parseYamlOrMarkdownResume,
    attachResumePdfIfPresent,
    b64toBlob,
    generateSimplePdf,
    isPreviousWorkerAtCurrentCompany,
  };
})();
