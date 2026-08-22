/**
 * GRTS Autofill - Generic / Universal ATS Adapter
 * Handles standard form controls across Lever, Ashby, SmartRecruiters, Taleo, and custom application pages.
 */
window.GRTS = window.GRTS || {};
window.GRTS.Adapters = window.GRTS.Adapters || {};

window.GRTS.Adapters.Generic = (() => {
    /**
     * Smart Matcher for 'How Did You Hear About Us?' Dropdown
     */
    function fillHowHeardSelect(selectEl, profile) {
        if (!selectEl) return false;
        const currentDomain = (typeof window !== "undefined" && window.location) ? window.location.hostname.replace(/^www\./, '').split('.')[0] + ".com" : "";
        
        const priorityTargets = [
            profile?.how_heard || "LinkedIn",
            "linkedin",
            "company website",
            "careers website",
            "corporate website",
            currentDomain,
            "career site",
            "job board",
            "online job board",
            "internet",
            "other"
        ];

        for (const target of priorityTargets) {
            if (!target) continue;
            if (window.GRTS.DOM.setSelectValueFuzzy(selectEl, target)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Smart Matcher for 'Phone Device Type' Dropdown
     */
    function fillPhoneDeviceType(selectEl, profile) {
        if (!selectEl) return false;
        const priorityTargets = [
            profile?.phone_device_type || "Mobile",
            "mobile",
            "cellular",
            "cell",
            "homecellular",
            "home cellular",
            "home / cellular",
            "home",
            "primary mobile",
            "primary"
        ];

        for (const target of priorityTargets) {
            if (window.GRTS.DOM.setSelectValueFuzzy(selectEl, target)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Scans and populates all standard inputs, selects, textareas, checkboxes, and radio buttons
     */
    async function fillStandardControls(profile) {
        let count = 0;
        if (!profile) return 0;

        const todayDate = new Date().toISOString().split('T')[0];
        const inputs = document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="file"]), select, textarea');
        const radioGroups = {};

        inputs.forEach(el => {
            if (window.GRTS.DOM.isHoneypotOrHidden(el)) return;

            // Skip Workday specialized sub-sections already managed by dedicated handlers
            const elId = (el.id || "").toLowerCase();
            if (elId.startsWith('websites-') || elId.startsWith('workexperience-') || elId.startsWith('education-') || elId.includes('linkedinaccount')) {
                return;
            }

            // Group radio buttons
            if (el.type === 'radio') {
                const rName = el.name || el.getAttribute('data-automation-id') || 'unnamed_radio';
                if (!radioGroups[rName]) radioGroups[rName] = [];
                radioGroups[rName].push(el);
                return;
            }

            // Checkboxes
            if (el.type === 'checkbox') {
                if (el.dataset.grtsFilled === "true" || (el.checked && el.getAttribute('aria-checked') === 'true')) return;
                const id = (el.id || "").toLowerCase();
                const name = (el.name || "").toLowerCase();
                const autoId = (el.getAttribute('data-automation-id') || "").toLowerCase();
                const label = (window.GRTS.Matcher.getFieldLabel(el) || "").toLowerCase();

                // Explicitly skip preferred name, areas of interest, skills, availability, and multi-option checkboxes
                if (
                    id.includes('preferred') || name.includes('preferred') || autoId.includes('preferred') || label.includes('preferred') ||
                    label.includes('interest') || label.includes('skill') || label.includes('availab') || label.includes('internship') || label.includes('select all') || label.includes('select 1')
                ) {
                    return;
                }

                const fieldType = window.GRTS.Matcher.getFieldType(el);
                
                // ONLY check if specifically a standalone terms/consent agreement (single checkbox in container)
                if (fieldType === 'terms_consent') {
                    const container = el.closest('fieldset, [data-automation-id*="formField"], [data-automation-id*="question"], div[class*="css-"]');
                    const groupCheckboxes = container ? container.querySelectorAll('input[type="checkbox"]').length : 1;
                    if (groupCheckboxes === 1) {
                        if (window.GRTS.DOM.setCheckbox(el, true)) count++;
                    }
                } else if (fieldType === 'currently_work_here') {
                    if (window.GRTS.DOM.setCheckbox(el, profile.currently_work_here !== false)) count++;
                }
                return;
            }

            const fieldType = window.GRTS.Matcher.getFieldType(el);

            const activeExpList = (profile.experience_list || []).filter(e => e.enabled !== false && e.include_in_applications !== false && e.include !== false);
            const activeExp = activeExpList[0] || {
                company: profile.current_company || "",
                title: profile.current_title || "",
                location: profile.current_location || "",
                description: profile.experience_description || ""
            };

            const activeEduList = (profile.education_list || []).filter(e => e.enabled !== false && e.include_in_applications !== false && e.include !== false);
            const activeEdu = activeEduList[0] || {
                school: profile.school || "",
                degree: profile.degree || "",
                discipline: profile.discipline || "",
                gpa: profile.gpa || "",
                edu_start_year: profile.edu_start_year || "2023",
                grad_year: profile.grad_year || "2026"
            };

            // Text / Select Inputs with fuzzy dropdown fallback
            if (fieldType === 'first_name') {
                if (window.GRTS.DOM.setInputValue(el, profile.first_name)) count++;
            } else if (fieldType === 'last_name') {
                if (window.GRTS.DOM.setInputValue(el, profile.last_name)) count++;
            } else if (fieldType === 'full_name') {
                const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
                if (window.GRTS.DOM.setInputValue(el, fullName)) count++;
            } else if (fieldType === 'email') {
                if (window.GRTS.DOM.setInputValue(el, profile.email)) count++;
            } else if (fieldType === 'phone') {
                if (window.GRTS.DOM.setInputValue(el, profile.phone)) count++;
            } else if (fieldType === 'phone_extension') {
                if (profile.phone_extension) {
                    if (window.GRTS.DOM.setInputValue(el, profile.phone_extension)) count++;
                }
            } else if (fieldType === 'phone_device_type') {
                if (el.tagName === 'SELECT') {
                    if (fillPhoneDeviceType(el, profile)) count++;
                } else {
                    if (window.GRTS.DOM.setInputValue(el, profile.phone_device_type || "Mobile")) count++;
                }
            } else if (fieldType === 'how_heard') {
                if (el.tagName === 'SELECT') {
                    if (fillHowHeardSelect(el, profile)) count++;
                } else {
                    if (window.GRTS.DOM.setInputValue(el, profile.how_heard || "LinkedIn")) count++;
                }
            } else if (fieldType === 'linkedin') {
                if (window.GRTS.DOM.setInputValue(el, profile.linkedin)) count++;
            } else if (fieldType === 'github') {
                if (window.GRTS.DOM.setInputValue(el, profile.github)) count++;
            } else if (fieldType === 'portfolio') {
                let siteUrl = profile.portfolio || profile.github || profile.linkedin || "";
                if (siteUrl && !siteUrl.startsWith("http://") && !siteUrl.startsWith("https://")) {
                    siteUrl = `https://${siteUrl}`;
                }
                if (window.GRTS.DOM.setInputValue(el, siteUrl)) count++;
            } else if (fieldType === 'skills') {
                // Skills filling disabled per user request
            } else if (fieldType === 'address') {
                if (window.GRTS.DOM.setInputValue(el, profile.address)) count++;
            } else if (fieldType === 'address_line_2') {
                if (window.GRTS.DOM.setInputValue(el, profile.address_line_2 || "")) count++;
            } else if (fieldType === 'city') {
                if (window.GRTS.DOM.setInputValue(el, profile.city)) count++;
            } else if (fieldType === 'state') {
                if (el.tagName === 'SELECT') {
                    if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.state)) count++;
                } else {
                    if (window.GRTS.DOM.setInputValue(el, profile.state)) count++;
                }
            } else if (fieldType === 'postal_code') {
                if (window.GRTS.DOM.setInputValue(el, profile.postal_code)) count++;
            } else if (fieldType === 'current_location') {
                const locVal = activeExp.location || profile.current_location || (profile.city ? (profile.state ? `${profile.city}, ${profile.state}` : profile.city) : profile.address);
                if (window.GRTS.DOM.setInputValue(el, locVal)) count++;
            } else if (fieldType === 'general_location') {
                const fullLoc = [profile.city, profile.state, profile.country].filter(Boolean).join(', ');
                if (window.GRTS.DOM.setInputValue(el, fullLoc || profile.city || profile.address)) count++;
            } else if (fieldType === 'today_date') {
                if (window.GRTS.DOM.setInputValue(el, todayDate)) count++;
            } else if (fieldType === 'current_company') {
                if (window.GRTS.DOM.setInputValue(el, activeExp.company || profile.current_company)) count++;
            } else if (fieldType === 'current_title') {
                if (window.GRTS.DOM.setInputValue(el, activeExp.title || profile.current_title)) count++;
            } else if (fieldType === 'experience_description') {
                if (window.GRTS.DOM.setInputValue(el, activeExp.description || profile.experience_description)) count++;
            } else if (fieldType === 'school') {
                const sch = activeEdu.school || profile.school;
                if (el.tagName === 'SELECT') {
                    if (window.GRTS.DOM.setSelectValueFuzzy(el, sch)) count++;
                } else {
                    if (window.GRTS.DOM.setInputValue(el, sch)) count++;
                }
            } else if (fieldType === 'degree') {
                const deg = activeEdu.degree || profile.degree;
                if (el.tagName === 'SELECT') {
                    if (window.GRTS.DOM.setSelectValueFuzzy(el, deg)) count++;
                } else {
                    if (window.GRTS.DOM.setInputValue(el, deg)) count++;
                }
            } else if (fieldType === 'discipline') {
                if (window.GRTS.DOM.setInputValue(el, activeEdu.discipline || profile.discipline)) count++;
            } else if (fieldType === 'gpa') {
                if (window.GRTS.DOM.setInputValue(el, activeEdu.gpa || profile.gpa)) count++;
            } else if (fieldType === 'date_from') {
                const startYear = activeEdu.edu_start_year || profile.edu_start_year || (profile.edu_start_date ? profile.edu_start_date.split('-')[0] : "2023");
                if (window.GRTS.DOM.setInputValue(el, startYear)) count++;
            } else if (fieldType === 'date_to') {
                const gradYear = activeEdu.grad_year || profile.grad_year || (profile.edu_end_date ? profile.edu_end_date.split('-')[0] : "2026");
                if (window.GRTS.DOM.setInputValue(el, gradYear)) count++;
            } else if (fieldType === 'desired_salary') {
                if (window.GRTS.DOM.setInputValue(el, profile.desired_salary)) count++;
            } else if (fieldType === 'notice_period') {
                if (window.GRTS.DOM.setInputValue(el, profile.notice_period)) count++;
            } else if (fieldType === 'age_18_or_older' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.age_18_or_older || "Yes")) count++;
            } else if (fieldType === 'non_compete_obligation' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.non_compete_obligation || "No")) count++;
            } else if (fieldType === 'open_to_relocation' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.open_to_relocation || "Yes")) count++;
            } else if (fieldType === 'class_year' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.class_year || "Senior")) count++;
            } else if (fieldType === 'enrolled_in_program' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.enrolled_in_program || "Yes")) count++;
            } else if (fieldType === 'require_sponsorship') {
                const sponsStr = String(profile.require_sponsorship ?? "no").trim().toLowerCase();
                const isSponsYes = sponsStr === "yes" || sponsStr === "true" || sponsStr === "1";
                const sponsVal = isSponsYes ? "Yes" : "No";
                if (el.tagName === 'SELECT') {
                    if (window.GRTS.DOM.setSelectValueFuzzy(el, sponsVal)) count++;
                } else {
                    if (window.GRTS.DOM.setInputValue(el, sponsVal)) count++;
                }
            } else if (fieldType === 'work_authorized_us') {
                const authStr = String(profile.work_authorized_us ?? "yes").trim().toLowerCase();
                const isAuthNo = authStr === "no" || authStr === "false" || authStr === "0";
                const authVal = isAuthNo ? "No" : "Yes";
                if (el.tagName === 'SELECT') {
                    if (window.GRTS.DOM.setSelectValueFuzzy(el, authVal)) count++;
                } else {
                    if (window.GRTS.DOM.setInputValue(el, authVal)) count++;
                }
            } else if (fieldType === 'student_visa' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.student_visa || "No")) count++;
            } else if (fieldType === 'require_cpt_opt' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.require_cpt_opt || "No")) count++;
            } else if (fieldType === 'previous_worker' && el.tagName === 'SELECT') {
                const qLabel = window.GRTS.Matcher.getFieldLabel(el);
                const isPrev = window.GRTS.Profile.isPreviousWorkerAtCurrentCompany(profile, qLabel);
                if (window.GRTS.DOM.setSelectValueFuzzy(el, isPrev ? "Yes" : "No")) count++;
            } else if (fieldType === 'scholarship_recipient' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.scholarship_recipient || "No")) count++;
            } else if (fieldType === 'ai_consent' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, "Yes")) count++;
            } else if (fieldType === 'hispanic_latino' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.hispanic_latino || "No")) count++;
            } else if (fieldType === 'gender' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.gender)) count++;
            } else if (fieldType === 'veteran_status' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.veteran_status)) count++;
            } else if (fieldType === 'disability_status' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.disability_status)) count++;
            } else if (fieldType === 'race_ethnicity' && el.tagName === 'SELECT') {
                if (window.GRTS.DOM.setSelectValueFuzzy(el, profile.race_ethnicity)) count++;
            }
        });

        // Handle radio groups
        for (const [groupName, radios] of Object.entries(radioGroups)) {
            if (radios.length === 0) continue;
            const sample = radios[0];
            if (window.GRTS.DOM.isHoneypotOrHidden(sample)) continue;
            const fieldType = window.GRTS.Matcher.getFieldType(sample);

            if (fieldType === 'require_sponsorship') {
                const sponsStr = String(profile.require_sponsorship ?? "no").trim().toLowerCase();
                const isSponsYes = sponsStr === "yes" || sponsStr === "true" || sponsStr === "1";
                if (window.GRTS.DOM.checkRadio(radios, isSponsYes ? "yes" : "no")) count++;
            } else if (fieldType === 'work_authorized_us') {
                const authStr = String(profile.work_authorized_us ?? "yes").trim().toLowerCase();
                const isAuthNo = authStr === "no" || authStr === "false" || authStr === "0";
                if (window.GRTS.DOM.checkRadio(radios, isAuthNo ? "no" : "yes")) count++;
            } else if (fieldType === 'age_18_or_older') {
                if (window.GRTS.DOM.checkRadio(radios, profile.age_18_or_older || "Yes")) count++;
            } else if (fieldType === 'non_compete_obligation') {
                if (window.GRTS.DOM.checkRadio(radios, profile.non_compete_obligation || "No")) count++;
            } else if (fieldType === 'open_to_relocation') {
                if (window.GRTS.DOM.checkRadio(radios, profile.open_to_relocation || "Yes")) count++;
            } else if (fieldType === 'student_visa') {
                if (window.GRTS.DOM.checkRadio(radios, profile.student_visa || "No")) count++;
            } else if (fieldType === 'require_cpt_opt') {
                if (window.GRTS.DOM.checkRadio(radios, profile.require_cpt_opt || "No")) count++;
            } else if (fieldType === 'previous_worker') {
                const qLabel = window.GRTS.Matcher.getFieldLabel(sample);
                const isPrev = window.GRTS.Profile.isPreviousWorkerAtCurrentCompany(profile, qLabel);
                if (window.GRTS.DOM.checkRadio(radios, isPrev ? "yes" : "no")) count++;
            } else if (fieldType === 'scholarship_recipient') {
                if (window.GRTS.DOM.checkRadio(radios, profile.scholarship_recipient || "No")) count++;
            } else if (fieldType === 'ai_consent') {
                if (window.GRTS.DOM.checkRadio(radios, "Yes")) count++;
            } else if (fieldType === 'hispanic_latino') {
                if (window.GRTS.DOM.checkRadio(radios, profile.hispanic_latino || "No")) count++;
            } else if (fieldType === 'gender') {
                if (window.GRTS.DOM.checkRadio(radios, profile.gender)) count++;
            } else if (fieldType === 'race_ethnicity') {
                if (window.GRTS.DOM.checkRadio(radios, profile.race_ethnicity || "White")) count++;
            } else if (fieldType === 'veteran_status') {
                if (window.GRTS.DOM.checkRadio(radios, profile.veteran_status)) count++;
            } else if (fieldType === 'disability_status') {
                if (window.GRTS.DOM.checkRadio(radios, profile.disability_status)) count++;
            }
        }

        return count;
    }

    return {
        fillStandardControls,
        fillHowHeardSelect,
        fillPhoneDeviceType
    };
})();
