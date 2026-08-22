/**
 * GRTS Autofill - Workday ATS Adapter
 * Handles Workday-specific composite UI:
 * - Work Experience & Education multi-card forms
 * - Composite Date Inputs (Month & Year spinbuttons)
 * - Field of Study MultiSelect comboboxes & Keystroke Search
 * - Custom listbox button dropdowns (Work Auth, Sponsorship, How Heard, Demographics)
 * - Websites section multi-entry URLs
 */
window.GRTS = window.GRTS || {};
window.GRTS.Adapters = window.GRTS.Adapters || {};

window.GRTS.Adapters.Workday = (() => {
  function pressArrowDown(targetEl, times = 1) {
    for (let i = 0; i < times; i++) {
      const ev = {
        key: "ArrowDown",
        code: "ArrowDown",
        keyCode: 40,
        which: 40,
        bubbles: true,
        cancelable: true,
      };
      targetEl.dispatchEvent(new KeyboardEvent("keydown", ev));
      targetEl.dispatchEvent(new KeyboardEvent("keypress", ev));
      targetEl.dispatchEvent(new KeyboardEvent("keyup", ev));
      if (document.activeElement && document.activeElement !== targetEl) {
        document.activeElement.dispatchEvent(new KeyboardEvent("keydown", ev));
        document.activeElement.dispatchEvent(new KeyboardEvent("keyup", ev));
      }
    }
  }

  function pressEnter(targetEl) {
    const ev = {
      key: "Enter",
      code: "Enter",
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    };
    targetEl.dispatchEvent(new KeyboardEvent("keydown", ev));
    targetEl.dispatchEvent(new KeyboardEvent("keypress", ev));
    targetEl.dispatchEvent(new KeyboardEvent("keyup", ev));
    if (document.activeElement && document.activeElement !== targetEl) {
      document.activeElement.dispatchEvent(new KeyboardEvent("keydown", ev));
      document.activeElement.dispatchEvent(new KeyboardEvent("keyup", ev));
    }
  }

  /**
   * Specialized handler for Workday MultiSelect Comboboxes (e.g. Field of Study, School)
   */
  async function selectWorkdayMultiSelect(
    inputEl,
    queryText,
    maxWaitMs = 2500,
  ) {
    if (!inputEl || !queryText) return false;

    const container = inputEl.closest(
      '[data-automation-id="multiSelectContainer"], [data-uxi-widget-type="multiselect"], [data-automation-id*="formField"], [data-automation-id*="inputContainer"], fieldset',
    );

    if (
      container &&
      container.querySelector(
        '[data-automation-id*="selectedItem"], [data-automation-id*="pill"], [data-uxi-widget-type*="pill"], [data-automation-id*="delete"], [class*="pill"]',
      )
    ) {
      window.GRTS.DOM.highlightElement(inputEl);
      if (container) {
        container.dataset.grtsFilled = "true";
        window.GRTS.DOM.highlightElement(container);
      }
      inputEl.dataset.grtsFilled = "true";
      return true;
    }

    try {
      await window.GRTS.DOM.typeTextIntoWorkdaySearch(inputEl, queryText);
      await new Promise((r) => setTimeout(r, 200));

      pressEnter(inputEl);

      let options = [];
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        await new Promise((r) => setTimeout(r, 120));
        options = Array.from(
          document.querySelectorAll(`
                    [role="option"],
                    [data-automation-id*="promptOption"],
                    [data-automation-id*="menuItem"],
                    [data-automation-id*="multiselectOption"],
                    li[role="option"],
                    div[role="option"],
                    [data-uxi-element-id*="promptOption"],
                    [id*="promptOption"]
                `),
        ).filter((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            (el.textContent || "").trim().length > 0
          );
        });

        if (options.length > 0) break;
      }

      if (options.length > 0) {
        const q = queryText.toLowerCase().trim();
        const qTokens = q.split(/\s+/).filter((t) => t.length > 2);

        // 1. Exact match (HIGHEST PRIORITY: e.g. "Computer Science" exactly)
        let bestOpt = options.find((opt) => {
          const t = (opt.textContent || "").toLowerCase().trim();
          return t === q;
        });

        // 2. Exact word boundary / prefix match (e.g. "Computer Science (BS)")
        if (!bestOpt) {
          bestOpt = options.find((opt) => {
            const t = (opt.textContent || "").toLowerCase().trim();
            return (
              t.startsWith(q + " ") ||
              t.startsWith(q + ",") ||
              t.startsWith(q + "(") ||
              t.startsWith(q + " -")
            );
          });
        }

        // 3. Highest fuzzy score match (must meet threshold)
        if (!bestOpt) {
          let bestScore = -1;
          options.forEach((opt) => {
            const sc = window.GRTS.DOM.scoreOptionMatch(
              opt.textContent,
              queryText,
            );
            if (sc > bestScore && sc >= 200) {
              bestScore = sc;
              bestOpt = opt;
            }
          });
        }

        // 4. Token-overlap fallback: pick the option that contains the MOST query tokens
        //    (never blindly pick options[0] — that causes "Accounting" to win for "Computer Science")
        if (!bestOpt && qTokens.length > 0) {
          let bestTokenCount = 0;
          options.forEach((opt) => {
            const t = (opt.textContent || "").toLowerCase().trim();
            const hits = qTokens.filter((tok) => t.includes(tok)).length;
            if (hits > bestTokenCount) {
              bestTokenCount = hits;
              bestOpt = opt;
            }
          });
          // Only accept if at least one token matched
          if (bestTokenCount === 0) bestOpt = null;
        }

        if (bestOpt) {
          bestOpt.scrollIntoView({ block: "nearest" });
          await new Promise((r) => setTimeout(r, 80));

          const chk = bestOpt.querySelector('input[type="checkbox"]');
          const lbl = bestOpt.querySelector("label");
          const span = bestOpt.querySelector("span");

          if (chk) {
            chk.click();
            if (!chk.checked) {
              window.GRTS.DOM.setCheckbox(chk, true);
            }
          }
          if (lbl) lbl.click();
          if (span) span.click();

          bestOpt.dispatchEvent(
            new PointerEvent("pointerdown", {
              bubbles: true,
              cancelable: true,
            }),
          );
          bestOpt.dispatchEvent(
            new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
          );
          bestOpt.dispatchEvent(
            new PointerEvent("pointerup", { bubbles: true, cancelable: true }),
          );
          bestOpt.dispatchEvent(
            new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
          );
          bestOpt.click();

          await new Promise((r) => setTimeout(r, 150));
        }
      } else {
        pressArrowDown(inputEl, 1);
        await new Promise((r) => setTimeout(r, 100));
        pressEnter(inputEl);
      }

      const promptOkBtn = document.querySelector(
        '[data-automation-id="promptOptionButton"], [data-automation-id="wd-CommandButton_uic_okButton"], button[title="OK"], button[aria-label="OK"]',
      );
      if (promptOkBtn && promptOkBtn.offsetParent !== null) {
        promptOkBtn.click();
      }

      await new Promise((r) => setTimeout(r, 300));

      inputEl.dataset.grtsFilled = "true";
      if (container) {
        container.dataset.grtsFilled = "true";
        window.GRTS.DOM.highlightElement(container);
      }
      window.GRTS.DOM.highlightElement(inputEl);
      return true;
    } catch (e) {
      console.error("[GRTS] Error selecting Workday multi-select:", e);
      return false;
    }
  }

  /**
   * Workday Custom Listbox Button Dropdown Selector
   */
  async function selectWorkdayDropdown(
    buttonEl,
    searchTerms,
    maxWaitMs = 2000,
  ) {
    if (!buttonEl) return false;
    const curText = (buttonEl.textContent || "").trim().toLowerCase();
    if (
      curText &&
      !curText.includes("select") &&
      !curText.includes("prompt") &&
      !curText.includes("choose") &&
      !curText.includes("--") &&
      curText.length > 1
    ) {
      window.GRTS.DOM.highlightElement(buttonEl);
      buttonEl.dataset.grtsFilled = "true";
      return true;
    }

    try {
      buttonEl.focus();
      buttonEl.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
      );
      buttonEl.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
      buttonEl.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, cancelable: true }),
      );
      buttonEl.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
      );
      buttonEl.click();

      const terms = Array.isArray(searchTerms)
        ? searchTerms.map((t) => String(t).toLowerCase().trim())
        : [String(searchTerms).toLowerCase().trim()];
      let matched = false;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        await new Promise((r) => setTimeout(r, 100));
        const options = Array.from(
          document.querySelectorAll(`
                    [role="option"],
                    [data-automation-id*="promptOption"],
                    [data-automation-id*="menuItem"],
                    [data-automation-id*="selectOption"],
                    [data-automation-id*="dropdownOption"],
                    li[role="option"],
                    div[role="option"],
                    [data-uxi-element-id*="promptOption"]
                `),
        ).filter((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            (el.textContent || "").trim().length > 0
          );
        });

        if (options.length > 0) {
          let bestOpt = null;
          let bestScore = -1;

          for (const term of terms) {
            for (const opt of options) {
              const optText = (opt.textContent || "").trim();
              const sc = window.GRTS.DOM.scoreOptionMatch(optText, term);
              if (sc > bestScore && sc >= 200) {
                bestScore = sc;
                bestOpt = opt;
              }
            }
            if (bestOpt) break;
          }

          if (!bestOpt) {
            for (const term of terms) {
              bestOpt = options.find((opt) => {
                const optText = (opt.textContent || "").toLowerCase().trim();
                return (
                  optText.includes(term) ||
                  (term.length > 2 && optText.startsWith(term)) ||
                  (optText.length > 2 && term.startsWith(optText))
                );
              });
              if (bestOpt) break;
            }
          }

          if (
            !bestOpt &&
            (terms.includes("other") ||
              terms.includes("linkedin") ||
              terms.includes("career site") ||
              terms.includes("job board"))
          ) {
            bestOpt =
              options.find((opt) => {
                const t = (opt.textContent || "").toLowerCase();
                return (
                  t.includes("other") ||
                  t.includes("online") ||
                  t.includes("job") ||
                  t.includes("career") ||
                  t.includes("internet")
                );
              }) || options[0];
          }

          if (bestOpt) {
            bestOpt.scrollIntoView({ block: "nearest" });
            bestOpt.dispatchEvent(
              new PointerEvent("pointerdown", {
                bubbles: true,
                cancelable: true,
              }),
            );
            bestOpt.dispatchEvent(
              new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
            );
            bestOpt.dispatchEvent(
              new PointerEvent("pointerup", {
                bubbles: true,
                cancelable: true,
              }),
            );
            bestOpt.dispatchEvent(
              new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
            );
            bestOpt.click();
            matched = true;
            break;
          }
        }
      }

      await new Promise((r) => setTimeout(r, 200));
      document.body.click();
      buttonEl.dataset.grtsFilled = "true";
      window.GRTS.DOM.highlightElement(buttonEl);
      return matched;
    } catch (e) {
      return false;
    }
  }

  /**
   * Scans and populates all Workday custom button-based dropdowns across any page/questionnaire.
   */
  async function fillWorkdayCustomButtons(profile) {
    let count = 0;
    const buttons = Array.from(
      document.querySelectorAll(`
            button[aria-haspopup="listbox"],
            button[data-automation-id*="dropdown"],
            button[data-automation-id*="Dropdown"],
            button[data-automation-id*="Prompt"],
            button[data-automation-id*="prompt"],
            button[data-automation-id*="select"],
            button[data-automation-id*="Select"],
            [data-automation-id*="question"] button,
            [data-automation-id*="formField"] button,
            [data-automation-id*="formItem"] button,
            [role="combobox"][tabindex],
            div[data-automation-id="select-widget"] button
        `),
    ).filter((b) => {
      if (b.offsetParent === null) return false;
      const autoId = (b.getAttribute("data-automation-id") || "").toLowerCase();
      const text = (b.textContent || "").toLowerCase().trim();
      if (
        autoId.includes("next") ||
        autoId.includes("save") ||
        autoId.includes("submit") ||
        autoId.includes("add") ||
        autoId.includes("delete") ||
        autoId.includes("remove") ||
        autoId.includes("cancel")
      ) {
        return false;
      }
      if (
        text === "save and continue" ||
        text === "next" ||
        text === "add" ||
        text === "submit" ||
        text === "cancel" ||
        text === "add another"
      ) {
        return false;
      }
      return true;
    });

    for (const btn of buttons) {
      const fieldType = window.GRTS.Matcher.getFieldType(btn);
      const label = window.GRTS.Matcher.getFieldLabel(btn).toLowerCase();
      const autoId = (
        btn.getAttribute("data-automation-id") || ""
      ).toLowerCase();
      const id = (btn.id || "").toLowerCase();
      const combined = `${id} ${autoId} ${label}`;

      // 1. Employer Support / Visa Sponsorship Requirement (HIGHEST PRECEDENCE)
      if (
        fieldType === "require_sponsorship" ||
        /\b(require\s*employer\s*support|employer\s*support|obtain\s*or\s*maintain|require\s*sponsorship|need\s*sponsorship|visa\s*sponsorship|future\s*sponsorship|work\s*permit|sponsorship\s*now\s*or\s*in\s*the\s*future|require\s*visa|h1b|h-1b)\b/.test(
          combined,
        )
      ) {
        const sponsStr = String(profile.require_sponsorship ?? "no")
          .trim()
          .toLowerCase();
        const isSponsYes =
          sponsStr === "yes" || sponsStr === "true" || sponsStr === "1";
        const terms = isSponsYes
          ? ["Yes", "Yes, I will", "Require"]
          : ["No", "No, I will not", "Do not require", "Not required"];
        if (await selectWorkdayDropdown(btn, terms)) count++;
      }
      // 2. Legal Authorization to Work
      else if (
        fieldType === "work_authorized_us" ||
        /\b(legally\s*authorized|authorized\s*to\s*work|legal\s*right\s*to\s*work|eligible\s*to\s*work|authorization\s*to\s*work)\b/.test(
          combined,
        )
      ) {
        const authStr = String(profile.work_authorized_us ?? "yes")
          .trim()
          .toLowerCase();
        const isAuthNo =
          authStr === "no" || authStr === "false" || authStr === "0";
        const terms = isAuthNo
          ? ["No", "No, I am not", "Not authorized"]
          : ["Yes", "Yes, I am", "Authorized"];
        if (await selectWorkdayDropdown(btn, terms)) count++;
      }
      // 3. How Did You Hear About Us?
      else if (
        fieldType === "how_heard" ||
        /\b(how\s*did\s*you\s*hear|how\s*did\s*we\s*meet|source|referral\s*source)\b/.test(
          combined,
        )
      ) {
        const terms = [
          profile?.how_heard,
          "LinkedIn",
          "Career Site",
          "Corporate Career Site",
          "Company Careers",
          "Job Board",
          "Indeed",
          "Glassdoor",
          "Online",
          "Internet",
          "Social Media",
          "Other",
        ].filter(Boolean);
        if (await selectWorkdayDropdown(btn, terms)) count++;
      }
      // 4. Phone Device Type
      else if (
        fieldType === "phone_device_type" ||
        /\b(phone\s*device\s*type|phone\s*type|device\s*type)\b/.test(combined)
      ) {
        if (
          await selectWorkdayDropdown(btn, [
            profile?.phone_device_type || "Mobile",
            "Cellular",
            "Cell",
            "Personal Mobile",
            "Home",
            "Work",
          ])
        )
          count++;
      }
      // 5. State / Country Region
      else if (
        fieldType === "state" ||
        /\b(country\s*region|state|province)\b/.test(combined)
      ) {
        if (
          await selectWorkdayDropdown(btn, [profile?.state || "Indiana", "IN"])
        )
          count++;
      }
      // 6. Veteran Status
      else if (
        fieldType === "veteran_status" ||
        /\b(veteran|military)\b/.test(combined)
      ) {
        if (
          await selectWorkdayDropdown(btn, [
            "I am not a protected veteran",
            "Not a veteran",
            "No",
            "I do not wish to answer",
            "Decline",
          ])
        )
          count++;
      }
      // 7. Disability Status
      else if (
        fieldType === "disability_status" ||
        /\b(disability|handicap|impairment)\b/.test(combined)
      ) {
        if (
          await selectWorkdayDropdown(btn, [
            "No, I do not have a disability",
            "No",
            "I do not wish to answer",
            "Decline",
          ])
        )
          count++;
      }
      // 8. Gender
      else if (fieldType === "gender" || /\b(gender|sex)\b/.test(combined)) {
        if (
          await selectWorkdayDropdown(btn, [
            profile?.gender || "Decline to specify",
            "I choose not to disclose",
            "Prefer not to say",
            "Male",
            "Female",
          ])
        )
          count++;
      }
      // 9. Race / Ethnicity
      else if (
        fieldType === "race_ethnicity" ||
        /\b(race|ethnicity)\b/.test(combined)
      ) {
        if (
          await selectWorkdayDropdown(btn, [
            profile?.race_ethnicity || "Decline to specify",
            "I choose not to disclose",
            "Prefer not to say",
            "Asian",
            "White",
          ])
        )
          count++;
      }
      // 10. Previous Worker
      else if (
        fieldType === "previous_worker" ||
        /\b(previously\s*worked|former\s*employee|prior\s*employee)\b/.test(
          combined,
        )
      ) {
        const isPrev = window.GRTS.Profile.isPreviousWorkerAtCurrentCompany(
          profile,
          label,
        );
        if (
          await selectWorkdayDropdown(
            btn,
            isPrev ? ["Yes", "True"] : ["No", "False"],
          )
        )
          count++;
      }
      // 11. Age 18+
      else if (
        fieldType === "age_18_or_older" ||
        /\b(18\s*years\s*of\s*age|18\s*or\s*older)\b/.test(combined)
      ) {
        if (await selectWorkdayDropdown(btn, ["Yes", "True"])) count++;
      }
    }
    return count;
  }

  /**
   * Fills an entire Workday dateInputWrapper (Month, Day & Year) synchronously
   */
  function fillWorkdayDateInputWrapper(wrapper, monthStr, yearStr, dayStr) {
    if (!wrapper) return false;

    const monthInput = wrapper.querySelector(
      'input[data-automation-id="dateSectionMonth-input"], input[id*="dateSectionMonth-input"], input[aria-label="Month"], input[id*="Month"]',
    );
    const monthDisplay = wrapper.querySelector(
      '[data-automation-id="dateSectionMonth-display"], [id*="dateSectionMonth-display"]',
    );

    const dayInput = wrapper.querySelector(
      'input[data-automation-id="dateSectionDay-input"], input[id*="dateSectionDay-input"], input[aria-label="Day"], input[id*="Day"]',
    );
    const dayDisplay = wrapper.querySelector(
      '[data-automation-id="dateSectionDay-display"], [id*="dateSectionDay-display"]',
    );

    const yearInput = wrapper.querySelector(
      'input[data-automation-id="dateSectionYear-input"], input[id*="dateSectionYear-input"], input[aria-label="Year"], input[id*="Year"]',
    );
    const yearDisplay = wrapper.querySelector(
      '[data-automation-id="dateSectionYear-display"], [id*="dateSectionYear-display"]',
    );

    function typeDigits(inputEl, displayEl, digitStr) {
      if (!inputEl || !digitStr) return;
      try {
        inputEl.focus();
        inputEl.value = "";
        inputEl.setAttribute("value", "");

        let runningVal = "";
        for (const char of String(digitStr)) {
          runningVal += char;
          inputEl.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: char,
              code: `Digit${char}`,
              keyCode: char.charCodeAt(0),
              which: char.charCodeAt(0),
              bubbles: true,
              cancelable: true,
            }),
          );
          inputEl.dispatchEvent(
            new KeyboardEvent("keypress", {
              key: char,
              code: `Digit${char}`,
              keyCode: char.charCodeAt(0),
              which: char.charCodeAt(0),
              bubbles: true,
              cancelable: true,
            }),
          );

          try {
            const proto = window.HTMLInputElement.prototype;
            const desc = Object.getOwnPropertyDescriptor(proto, "value");
            if (desc && desc.set) desc.set.call(inputEl, runningVal);
            else inputEl.value = runningVal;
          } catch (e) {
            inputEl.value = runningVal;
          }

          inputEl.setAttribute("value", runningVal);
          inputEl.setAttribute("aria-valuenow", parseInt(runningVal, 10));
          inputEl.setAttribute("aria-valuetext", runningVal);

          try {
            inputEl.dispatchEvent(
              new InputEvent("input", {
                bubbles: true,
                cancelable: true,
                inputType: "insertText",
                data: char,
              }),
            );
          } catch (e) {}
          inputEl.dispatchEvent(new Event("input", { bubbles: true }));

          inputEl.dispatchEvent(
            new KeyboardEvent("keyup", {
              key: char,
              code: `Digit${char}`,
              keyCode: char.charCodeAt(0),
              which: char.charCodeAt(0),
              bubbles: true,
              cancelable: true,
            }),
          );
        }

        if (displayEl) {
          displayEl.textContent = String(digitStr);
          displayEl.innerText = String(digitStr);
        }

        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
        inputEl.dataset.grtsFilled = "true";
      } catch (err) {
        console.error("[GRTS] Error typing into date spinbutton:", err);
      }
    }

    if (monthInput && monthStr) {
      const cleanMonth = String(monthStr).padStart(2, "0");
      typeDigits(monthInput, monthDisplay, cleanMonth);
    }

    if (dayInput && dayStr) {
      const cleanDay = String(dayStr).padStart(2, "0");
      typeDigits(dayInput, dayDisplay, cleanDay);
    }

    if (yearInput && yearStr) {
      const cleanYear = String(yearStr).trim();
      typeDigits(yearInput, yearDisplay, cleanYear);
      yearInput.dispatchEvent(new Event("blur", { bubbles: true }));
    }

    wrapper.dataset.grtsFilled = "true";
    window.GRTS.DOM.highlightElement(wrapper);
    return true;
  }

  /**
   * Fills Workday composite Month/Day/Year date input spinbuttons accurately by row index.
   * Dates are grouped by their workExperience-N ancestor so each row maps to the correct
   * expList entry, rather than relying on a flat global index that breaks when selectors
   * return mixed-section containers.
   */
  function fillWorkdayDates(profile) {
    let count = 0;
    if (!profile) return 0;

    const expList = (
      profile.experience_list && profile.experience_list.length > 0
        ? profile.experience_list
        : [
            {
              start_date: profile.experience_start_date || "05/2026",
              end_date: profile.experience_end_date || "08/2026",
            },
          ]
    ).filter(
      (e) =>
        e.enabled !== false &&
        e.include_in_applications !== false &&
        e.include !== false,
    );

    const eduList = (
      profile.education_list && profile.education_list.length > 0
        ? profile.education_list
        : [
            {
              edu_start_year: profile.edu_start_year || "2023",
              grad_year: profile.grad_year || "2026",
            },
          ]
    ).filter(
      (e) =>
        e.enabled !== false &&
        e.include_in_applications !== false &&
        e.include !== false,
    );

    // ── 1. Work Experience Dates (anchored by workExperience-N ancestor rows) ──────────
    // Strategy: find all unique workExperience-N containers in DOM order,
    // then for each one look for its start/end date wrappers internally.
    // This avoids the flat-index problem where broad selectors collect containers
    // from education and other sections, causing all dates to use expList[0].
    const workExpRowContainers = [];
    {
      // Collect all top-level workExperience section containers (each work entry)
      const allExpEls = Array.from(
        document.querySelectorAll('[id*="workExperience-"]'),
      );
      const seen = new Set();
      for (const el of allExpEls) {
        // Walk up to find the outermost workExperience-N grouping element
        let ancestor = el;
        let candidate = null;
        while (ancestor && ancestor !== document.body) {
          const id = ancestor.id || "";
          const autoId = ancestor.getAttribute("data-automation-id") || "";
          if (
            /workExperience-\d+/.test(id) ||
            /workExperience-\d+/.test(autoId)
          ) {
            candidate = ancestor;
          }
          ancestor = ancestor.parentElement;
        }
        if (candidate && !seen.has(candidate)) {
          seen.add(candidate);
          workExpRowContainers.push(candidate);
        }
      }
    }

    if (workExpRowContainers.length > 0) {
      // Map each row container to the corresponding expList entry
      workExpRowContainers.forEach((rowEl, rowIdx) => {
        const exp = expList[rowIdx] || expList[expList.length - 1] || {};

        // Start date within this row
        const startWrap = rowEl.querySelector(`
                    [id*="startDate"],
                    [data-automation-id="dateInputWrapper"][id*="start"],
                    fieldset[data-automation-id*="startDate"],
                    div[data-automation-id*="startDate"]
                `);
        if (startWrap && !startWrap.dataset.grtsFilled) {
          const parsed = window.GRTS.DOM.parseDateTokens(
            exp.start_date || exp.date_from || "05/2026",
          );
          if (
            fillWorkdayDateInputWrapper(
              startWrap,
              parsed.month || "05",
              parsed.year || "2026",
            )
          )
            count++;
        }

        // End date within this row (skip if currently working here)
        if (!exp.currently_work_here) {
          const endWrap = rowEl.querySelector(`
                        [id*="endDate"],
                        [data-automation-id="dateInputWrapper"][id*="end"],
                        fieldset[data-automation-id*="endDate"],
                        div[data-automation-id*="endDate"]
                    `);
          if (endWrap && !endWrap.dataset.grtsFilled) {
            const parsed = window.GRTS.DOM.parseDateTokens(
              exp.end_date || exp.date_to || "08/2026",
            );
            if (
              fillWorkdayDateInputWrapper(
                endWrap,
                parsed.month || "08",
                parsed.year || "2026",
              )
            )
              count++;
          }
        }
      });
    } else {
      // Fallback: global selectors — use only when no workExperience-N IDs exist
      const expStartContainers = Array.from(
        document.querySelectorAll(
          '[id*="workExperience-"][id*="startDate"], fieldset[id*="workExperience"][id*="startDate"]',
        ),
      );
      expStartContainers.forEach((cont, idx) => {
        if (cont.dataset.grtsFilled === "true") return;
        const exp = expList[idx] || expList[0] || {};
        const parsed = window.GRTS.DOM.parseDateTokens(
          exp.start_date || exp.date_from || "05/2026",
        );
        if (
          fillWorkdayDateInputWrapper(
            cont,
            parsed.month || "05",
            parsed.year || "2026",
          )
        )
          count++;
      });
      const expEndContainers = Array.from(
        document.querySelectorAll(
          '[id*="workExperience-"][id*="endDate"], fieldset[id*="workExperience"][id*="endDate"]',
        ),
      );
      expEndContainers.forEach((cont, idx) => {
        if (cont.dataset.grtsFilled === "true") return;
        const exp = expList[idx] || expList[0] || {};
        if (exp.currently_work_here) return;
        const parsed = window.GRTS.DOM.parseDateTokens(
          exp.end_date || exp.date_to || "08/2026",
        );
        if (
          fillWorkdayDateInputWrapper(
            cont,
            parsed.month || "08",
            parsed.year || "2026",
          )
        )
          count++;
      });
    }

    // ── 2. Education First Year Attended ─────────────────────────────────────────────
    const eduStartContainers = Array.from(
      document.querySelectorAll(`
            [id*="education-"][id*="firstYearAttended"],
            [data-automation-id="dateInputWrapper"][id*="firstYearAttended"],
            fieldset[id*="education"][id*="firstYearAttended"],
            fieldset[data-automation-id*="firstYearAttended"],
            div[data-automation-id*="firstYearAttended"]
        `),
    );
    eduStartContainers.forEach((cont, idx) => {
      if (cont.dataset.grtsFilled === "true") return;
      const edu = eduList[idx] || eduList[0] || {};
      const parsed = window.GRTS.DOM.parseDateTokens(
        edu.edu_start_year ||
          edu.start_date ||
          profile.edu_start_year ||
          "2023",
      );
      if (
        fillWorkdayDateInputWrapper(
          cont,
          parsed.month || "08",
          parsed.year || "2023",
        )
      )
        count++;
    });

    // ── 3. Education Graduation / Degree Dates ───────────────────────────────────────
    const eduGradContainers = Array.from(
      document.querySelectorAll(`
            [id*="education-"][id*="lastYearAttended"],
            [id*="education-"][id*="graduationDate"],
            [data-automation-id="dateInputWrapper"][id*="lastYearAttended"],
            [data-automation-id="dateInputWrapper"][id*="graduationDate"]
        `),
    );
    eduGradContainers.forEach((cont, idx) => {
      if (cont.dataset.grtsFilled === "true") return;
      const edu = eduList[idx] || eduList[0] || {};
      const parsed = window.GRTS.DOM.parseDateTokens(
        edu.grad_year || edu.end_date || profile.grad_year || "2026",
      );
      if (
        fillWorkdayDateInputWrapper(
          cont,
          parsed.month || "05",
          parsed.year || "2026",
        )
      )
        count++;
    });

    // ── 4. Signature / Voluntary Disability Form "dateSignedOn" (Today's Date) ───────
    const today = new Date();
    const todayMonth = String(today.getMonth() + 1).padStart(2, "0");
    const todayDay = String(today.getDate()).padStart(2, "0");
    const todayYear = String(today.getFullYear());

    const signatureDateWrappers = Array.from(
      document.querySelectorAll(`
            [id*="dateSignedOn"],
            [data-automation-id*="dateSignedOn"],
            [id*="selfIdentifiedDisabilityData--dateSignedOn"],
            [id*="signatureDate"],
            [data-automation-id="dateInputWrapper"][id*="SignedOn"]
        `),
    );

    for (const sigWrap of signatureDateWrappers) {
      if (sigWrap.dataset.grtsFilled === "true") continue;
      if (
        fillWorkdayDateInputWrapper(sigWrap, todayMonth, todayYear, todayDay)
      ) {
        count++;
      }
    }

    // ── 5. Standalone Date Inputs fallback ───────────────────────────────────────────
    const standaloneDateInputs = Array.from(
      document.querySelectorAll(
        'input[data-automation-id*="dateSection"], input[id*="dateSection"]',
      ),
    ).filter((inp) => !inp.dataset.grtsFilled);
    standaloneDateInputs.forEach((input) => {
      const id = (input.id || "").toLowerCase();
      const autoId = (
        input.getAttribute("data-automation-id") || ""
      ).toLowerCase();
      const ariaLabel = (input.getAttribute("aria-label") || "").toLowerCase();
      const parentLabel = (
        input.closest('fieldset, [data-automation-id*="formField"], div')
          ?.textContent || ""
      ).toLowerCase();
      const combined = `${id} ${autoId} ${ariaLabel} ${parentLabel}`;

      const isMonth =
        autoId.includes("month") ||
        ariaLabel.includes("month") ||
        id.includes("month");
      const isYear =
        autoId.includes("year") ||
        ariaLabel.includes("year") ||
        id.includes("year");

      if (combined.includes("start") || combined.includes("from")) {
        const parsed = window.GRTS.DOM.parseDateTokens(
          expList[0]?.start_date || profile.experience_start_date || "05/2026",
        );
        if (
          isMonth &&
          window.GRTS.DOM.setInputValue(input, parsed.month || "05", true)
        )
          count++;
        if (
          isYear &&
          window.GRTS.DOM.setInputValue(input, parsed.year || "2026", true)
        )
          count++;
      } else if (
        combined.includes("end") ||
        combined.includes("to") ||
        combined.includes("graduat")
      ) {
        const parsed = window.GRTS.DOM.parseDateTokens(
          expList[0]?.end_date || profile.experience_end_date || "08/2026",
        );
        if (
          isMonth &&
          window.GRTS.DOM.setInputValue(input, parsed.month || "08", true)
        )
          count++;
        if (
          isYear &&
          window.GRTS.DOM.setInputValue(input, parsed.year || "2026", true)
        )
          count++;
      }
    });

    return count;
  }

  /**
   * Dedicated populator for Workday Education section
   */
  async function fillWorkdayEducation(profile) {
    let count = 0;
    if (!profile) return 0;

    const eduList = (
      profile.education_list && profile.education_list.length > 0
        ? profile.education_list
        : [
            {
              school: profile.school || "",
              degree: profile.degree || "Bachelor of Science",
              discipline: profile.discipline || "Computer Science",
              gpa: profile.gpa || "3.2",
            },
          ]
    ).filter(
      (e) =>
        e.enabled !== false &&
        e.include_in_applications !== false &&
        e.include !== false,
    );
    const primaryEdu = eduList[0] || {};

    const headings = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, legend, label, div"),
    ).filter((el) => el.textContent.trim().toLowerCase() === "education");
    let eduContainer = null;
    for (const h of headings) {
      const parent = h.closest(
        '[data-automation-id*="section"], fieldset, form, div',
      );
      if (parent && parent.querySelector("button")) {
        eduContainer = parent;
        break;
      }
    }

    // Expand as many education slots as needed
    if (eduContainer && eduList.length > 0) {
      let schoolInputs = Array.from(
        document.querySelectorAll(
          'input[id*="education-"][id*="schoolName"], input[id*="schoolName"], input[name*="schoolName"], [data-automation-id*="schoolName"] input',
        ),
      );
      if (schoolInputs.length === 0) {
        const addBtn = Array.from(eduContainer.querySelectorAll("button")).find(
          (b) => (b.textContent || "").trim().toLowerCase() === "add",
        );
        if (addBtn) {
          addBtn.click();
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      for (let i = 0; i < eduList.length - 1; i++) {
        schoolInputs = Array.from(
          document.querySelectorAll(
            'input[id*="education-"][id*="schoolName"], input[id*="schoolName"], input[name*="schoolName"], [data-automation-id*="schoolName"] input',
          ),
        );
        if (schoolInputs.length >= eduList.length) break;

        const addAnotherBtn = Array.from(
          eduContainer.querySelectorAll("button"),
        ).find((b) => {
          const txt = (b.textContent || "").toLowerCase().trim();
          return txt.includes("add another") || txt === "add";
        });
        if (addAnotherBtn) {
          addAnotherBtn.click();
          await new Promise((r) => setTimeout(r, 450));
        } else {
          break;
        }
      }
    }

    const schoolInputs = Array.from(
      document.querySelectorAll(
        'input[id*="education-"][id*="schoolName"], input[id*="schoolName"], input[name*="schoolName"], [data-automation-id*="schoolName"] input',
      ),
    );
    for (let idx = 0; idx < schoolInputs.length; idx++) {
      const inp = schoolInputs[idx];
      const edu = eduList[idx] || primaryEdu;
      if (edu.school) {
        if (await selectWorkdayMultiSelect(inp, edu.school)) {
          count++;
        } else if (await selectWorkdayDropdown(inp, [edu.school])) {
          count++;
        } else {
          if (window.GRTS.DOM.setInputValue(inp, edu.school, true)) count++;
        }
      }
    }

    const degreeInputs = Array.from(
      document.querySelectorAll(
        'input[id*="education-"][id*="degree"], input[id*="degree"], input[name*="degree"], [data-automation-id*="degree"] input, button[id*="degree"], button[data-automation-id*="degree"], [data-automation-id*="formField-degree"] button',
      ),
    );
    for (let idx = 0; idx < degreeInputs.length; idx++) {
      const inp = degreeInputs[idx];
      const edu = eduList[idx] || primaryEdu;
      const deg = edu.degree || "Bachelor of Science";
      if (inp.tagName === "INPUT") {
        if (await selectWorkdayMultiSelect(inp, deg)) {
          count++;
        } else if (
          await selectWorkdayDropdown(inp, [
            deg,
            "Bachelor of Science",
            "Bachelor",
            "Bachelors",
          ])
        ) {
          count++;
        } else {
          if (window.GRTS.DOM.setInputValue(inp, deg, true)) count++;
        }
      } else {
        if (
          await selectWorkdayDropdown(inp, [
            deg,
            "Bachelor of Science",
            "Bachelor",
            "Bachelors",
          ])
        )
          count++;
      }
    }

    const discInputs = Array.from(
      document.querySelectorAll(
        'input[id*="education-"][id*="fieldOfStudy"], input[id*="fieldOfStudy"], input[name*="fieldOfStudy"], [data-automation-id*="fieldOfStudy"] input, input[id*="discipline"], input[name*="discipline"]',
      ),
    );
    for (let idx = 0; idx < discInputs.length; idx++) {
      const inp = discInputs[idx];
      const edu = eduList[idx] || primaryEdu;
      const major = edu.discipline || "Computer Science";
      if (major) {
        if (await selectWorkdayMultiSelect(inp, major)) {
          count++;
        } else if (
          await selectWorkdayDropdown(inp, [major, "Computer Science"])
        ) {
          count++;
        }
      }
    }

    const gpaInputs = Array.from(
      document.querySelectorAll(
        'input[id*="education-"][id*="gpa"], input[id*="gpa"], input[name*="gpa"], [data-automation-id*="gpa"] input',
      ),
    );
    for (let idx = 0; idx < gpaInputs.length; idx++) {
      const inp = gpaInputs[idx];
      const edu = eduList[idx] || primaryEdu;
      if (edu.gpa) {
        if (window.GRTS.DOM.setInputValue(inp, edu.gpa, true)) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Dedicated populator for Workday Websites section
   */
  async function fillWorkdayWebsites(profile) {
    let count = 0;
    const portfolioUrl = profile.portfolio
      ? profile.portfolio.startsWith("http")
        ? profile.portfolio
        : `https://${profile.portfolio}`
      : "";
    const githubUrl = profile.github
      ? profile.github.startsWith("http")
        ? profile.github
        : profile.github.startsWith("github.com")
          ? `https://${profile.github}`
          : `https://github.com/${profile.github}`
      : "";

    const hasDedicatedLinkedIn =
      document.querySelector(
        'input[id*="socialNetworkAccounts--linkedInAccount"], input[id*="linkedInAccount"], input[name*="linkedInAccount"]',
      ) !== null;

    const urls = [portfolioUrl, githubUrl];
    if (!hasDedicatedLinkedIn && profile.linkedin) {
      urls.push(profile.linkedin);
    }

    const headings = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, legend, label, div"),
    ).filter((el) => el.textContent.trim().toLowerCase() === "websites");

    let websitesContainer = null;
    for (const h of headings) {
      const parent = h.closest(
        '[data-automation-id*="section"], fieldset, form, div',
      );
      if (parent && parent.querySelector("button")) {
        websitesContainer = parent;
        break;
      }
    }

    // Expand as many website slots as needed
    if (websitesContainer && urls.length > 0) {
      let websiteInputs = Array.from(
        document.querySelectorAll(`
                input[id*="websites-"][id*="url"],
                input[id*="websites-"][id*="website"],
                input[id*="websites-"][data-automation-id*="input"],
                input[name*="websiteUrl"],
                input[name*="url"],
                [data-automation-id*="formField-url"] input,
                [data-automation-id*="formField-website"] input
            `),
      ).filter(
        (inp) =>
          !inp.id.includes("linkedInAccount") &&
          !inp.name.includes("linkedInAccount"),
      );

      if (websiteInputs.length === 0) {
        const addBtn = websitesContainer.querySelector(
          'button[data-automation-id="add-button"], button',
        );
        if (
          addBtn &&
          (addBtn.textContent || "").trim().toLowerCase() === "add"
        ) {
          addBtn.click();
          await new Promise((r) => setTimeout(r, 450));
        }
      }

      for (let i = 0; i < urls.length - 1; i++) {
        websiteInputs = Array.from(
          document.querySelectorAll(`
                    input[id*="websites-"][id*="url"],
                    input[id*="websites-"][id*="website"],
                    input[id*="websites-"][data-automation-id*="input"],
                    input[name*="websiteUrl"],
                    input[name*="url"],
                    [data-automation-id*="formField-url"] input,
                    [data-automation-id*="formField-website"] input
                `),
        ).filter(
          (inp) =>
            !inp.id.includes("linkedInAccount") &&
            !inp.name.includes("linkedInAccount"),
        );

        if (websiteInputs.length >= urls.length) break;

        const addAnotherBtn = Array.from(
          websitesContainer.querySelectorAll("button"),
        ).find((b) =>
          (b.textContent || "").toLowerCase().includes("add another"),
        );
        if (addAnotherBtn) {
          addAnotherBtn.click();
          await new Promise((r) => setTimeout(r, 450));
        } else {
          break;
        }
      }
    }

    const websiteInputs = Array.from(
      document.querySelectorAll(`
            input[id*="websites-"][id*="url"],
            input[id*="websites-"][id*="website"],
            input[id*="websites-"][data-automation-id*="input"],
            input[name*="websiteUrl"],
            input[name*="url"],
            [data-automation-id*="formField-url"] input,
            [data-automation-id*="formField-website"] input
        `),
    ).filter(
      (inp) =>
        !inp.id.includes("linkedInAccount") &&
        !inp.name.includes("linkedInAccount"),
    );

    for (let index = 0; index < websiteInputs.length; index++) {
      const input = websiteInputs[index];
      const urlVal = urls[index] || urls[0];
      if (urlVal) {
        if (window.GRTS.DOM.setInputValue(input, urlVal, true)) {
          count++;
        }
      }
    }

    const typeButtons = document.querySelectorAll(
      'button[id*="websites-"][id*="type"], button[aria-label*="Website Type"], [data-automation-id*="formField-websiteType"] button',
    );
    for (let i = 0; i < typeButtons.length; i++) {
      const btn = typeButtons[i];
      const searchTerms =
        i === 0
          ? ["portfolio", "website", "personal", "blog"]
          : ["github", "other", "git", "repository", "code"];
      await selectWorkdayDropdown(btn, searchTerms, 1200);
    }

    return count;
  }

  /**
   * Dedicated populator for Workday Work Experience section
   * Fills any number of experience entries (0 to N) based on profile.experience_list
   */
  async function fillWorkdayExperience(profile) {
    let count = 0;
    if (!profile) return 0;

    const expList = (
      profile.experience_list && profile.experience_list.length > 0
        ? profile.experience_list
        : [
            {
              company: profile.current_company || "",
              title: profile.current_title || "Business Informatics Intern",
              location: profile.current_location || "Indianapolis, IN",
              currently_work_here: profile.currently_work_here !== false,
              description:
                profile.experience_description ||
                "Driving compliant AI use in healthcare, writing backend processing tools.",
            },
          ]
    ).filter(
      (e) =>
        e.enabled !== false &&
        e.include_in_applications !== false &&
        e.include !== false,
    );
    const primaryExp = expList[0] || {};

    const headings = Array.from(
      document.querySelectorAll("h1, h2, h3, h4, legend, label, div"),
    ).filter((el) => el.textContent.trim().toLowerCase() === "work experience");
    let expContainer = null;
    for (const h of headings) {
      const parent = h.closest(
        '[data-automation-id*="section"], fieldset, form, div',
      );
      if (parent && parent.querySelector("button")) {
        expContainer = parent;
        break;
      }
    }

    // Expand as many work experience slots as we have in expList (between 0 and any number)
    if (expContainer && expList.length > 0) {
      let titleInputs = Array.from(
        document.querySelectorAll(
          'input[id*="workExperience-"][id*="jobTitle"], input[id*="jobTitle"], input[name*="jobTitle"], [data-automation-id*="formField-jobTitle"] input',
        ),
      );

      if (titleInputs.length === 0) {
        const addBtn = Array.from(expContainer.querySelectorAll("button")).find(
          (b) => (b.textContent || "").trim().toLowerCase() === "add",
        );
        if (addBtn) {
          addBtn.click();
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      for (let i = 0; i < expList.length - 1; i++) {
        titleInputs = Array.from(
          document.querySelectorAll(
            'input[id*="workExperience-"][id*="jobTitle"], input[id*="jobTitle"], input[name*="jobTitle"], [data-automation-id*="formField-jobTitle"] input',
          ),
        );
        if (titleInputs.length >= expList.length) break;

        const addAnotherBtn = Array.from(
          expContainer.querySelectorAll("button"),
        ).find((b) => {
          const txt = (b.textContent || "").toLowerCase().trim();
          return txt.includes("add another") || txt === "add";
        });
        if (addAnotherBtn) {
          addAnotherBtn.click();
          await new Promise((r) => setTimeout(r, 450));
        } else {
          break;
        }
      }
    }

    const titleInputs = Array.from(
      document.querySelectorAll(
        'input[id*="workExperience-"][id*="jobTitle"], input[id*="jobTitle"], input[name*="jobTitle"], [data-automation-id*="formField-jobTitle"] input',
      ),
    );
    titleInputs.forEach((inp, idx) => {
      const exp = expList[idx] || primaryExp;
      if (
        window.GRTS.DOM.setInputValue(
          inp,
          exp.title || "Business Informatics Intern",
          true,
        )
      )
        count++;
    });

    const compInputs = Array.from(
      document.querySelectorAll(
        'input[id*="workExperience-"][id*="companyName"], input[id*="companyName"], input[name*="companyName"], [data-automation-id*="formField-companyName"] input',
      ),
    );
    compInputs.forEach((inp, idx) => {
      const exp = expList[idx] || primaryExp;
      if (window.GRTS.DOM.setInputValue(inp, exp.company || "", true)) count++;
    });

    const locInputs = Array.from(
      document.querySelectorAll(
        'input[id*="workExperience-"][id*="location"], [data-automation-id*="formField-location"] input',
      ),
    );
    locInputs.forEach((inp, idx) => {
      const exp = expList[idx] || primaryExp;
      const loc =
        exp.location ||
        profile.current_location ||
        (profile.city
          ? profile.state
            ? `${profile.city}, ${profile.state}`
            : profile.city
          : "Indianapolis, IN");
      if (window.GRTS.DOM.setInputValue(inp, loc, true)) count++;
    });

    const currCheckboxes = Array.from(
      document.querySelectorAll(
        'input[id*="currentlyWorkHere"], input[name*="currentlyWorkHere"], [data-automation-id*="formField-currentlyWorkHere"] input',
      ),
    );
    currCheckboxes.forEach((chk, idx) => {
      const exp = expList[idx] || primaryExp;
      if (window.GRTS.DOM.setCheckbox(chk, exp.currently_work_here === true))
        count++;
    });

    const descAreas = Array.from(
      document.querySelectorAll(
        'textarea[id*="roleDescription"], textarea[id*="workExperience-"], textarea[name*="roleDescription"], [data-automation-id*="formField-roleDescription"] textarea',
      ),
    );
    descAreas.forEach((ta, idx) => {
      const exp = expList[idx] || primaryExp;
      const desc =
        exp.description ||
        profile.experience_description ||
        "Driving compliant AI use in healthcare, writing backend processing tools.";
      if (desc && window.GRTS.DOM.setInputValue(ta, desc, true)) count++;
    });

    return count;
  }

  /**
   * Dedicated populator for Workday Terms and Conditions / Agreements checkboxes
   */
  async function fillWorkdayTermsAndConditions(profile) {
    let count = 0;
    const termsCheckboxes = Array.from(
      document.querySelectorAll(`
            input[id*="termsAndConditions"],
            input[id*="acceptTermsAndAgreements"],
            input[name*="acceptTermsAndAgreements"],
            input[name*="termsAndConditions"],
            input[data-automation-id*="termsAndConditions"],
            input[data-automation-id*="acceptTermsAndAgreements"],
            div[data-automation-id*="terms"] input[type="checkbox"],
            div[data-automation-id*="agreement"] input[type="checkbox"],
            div[data-automation-id*="consent"] input[type="checkbox"],
            div[data-automation-id*="acknowledge"] input[type="checkbox"]
        `),
    );

    for (const chk of termsCheckboxes) {
      const id = (chk.id || "").toLowerCase();
      const name = (chk.name || "").toLowerCase();
      const autoId = (
        chk.getAttribute("data-automation-id") || ""
      ).toLowerCase();
      const label = (
        window.GRTS.Matcher.getFieldLabel(chk) || ""
      ).toLowerCase();

      // Strictly exclude preferred name and work experience checkboxes
      if (
        id.includes("preferred") ||
        name.includes("preferred") ||
        autoId.includes("preferred") ||
        label.includes("preferred") ||
        id.includes("currentlyworkhere") ||
        name.includes("currentlyworkhere") ||
        autoId.includes("currentlyworkhere")
      ) {
        continue;
      }

      if (window.GRTS.DOM.setCheckbox(chk, true)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Dedicated populator for Workday Radio Button Groups (Previous Worker, Legal Questions, etc.)
   */
  async function fillWorkdayRadios(profile) {
    let count = 0;
    const radioGroups = {};

    const radioInputs = Array.from(
      document.querySelectorAll(`
            input[type="radio"]
        `),
    );

    for (const r of radioInputs) {
      if (window.GRTS.DOM.isHoneypotOrHidden(r)) continue;
      const groupKey =
        r.name ||
        r.closest(
          '[data-automation-id*="formField"], [id*="--"], div[class*="css-36bfwz"], fieldset',
        )?.id ||
        r.name ||
        "unnamed_radio";
      if (!radioGroups[groupKey]) radioGroups[groupKey] = [];
      radioGroups[groupKey].push(r);
    }

    for (const [key, radios] of Object.entries(radioGroups)) {
      if (radios.length === 0) continue;
      const sample = radios[0];
      const fieldType = window.GRTS.Matcher.getFieldType(sample);

      if (
        fieldType === "previous_worker" ||
        key.toLowerCase().includes("previousworker")
      ) {
        const qLabel = window.GRTS.Matcher.getFieldLabel(sample);
        const isPrev = window.GRTS.Profile.isPreviousWorkerAtCurrentCompany(
          profile,
          qLabel,
        );
        if (window.GRTS.DOM.checkRadio(radios, isPrev ? "yes" : "no")) count++;
      } else if (fieldType === "require_sponsorship") {
        const sponsStr = String(profile.require_sponsorship ?? "no")
          .trim()
          .toLowerCase();
        const isSponsYes =
          sponsStr === "yes" || sponsStr === "true" || sponsStr === "1";
        if (window.GRTS.DOM.checkRadio(radios, isSponsYes ? "yes" : "no"))
          count++;
      } else if (fieldType === "work_authorized_us") {
        const authStr = String(profile.work_authorized_us ?? "yes")
          .trim()
          .toLowerCase();
        const isAuthNo =
          authStr === "no" || authStr === "false" || authStr === "0";
        if (window.GRTS.DOM.checkRadio(radios, isAuthNo ? "no" : "yes"))
          count++;
      } else if (fieldType === "age_18_or_older") {
        if (
          window.GRTS.DOM.checkRadio(radios, profile.age_18_or_older || "Yes")
        )
          count++;
      } else if (fieldType === "non_compete_obligation") {
        if (
          window.GRTS.DOM.checkRadio(
            radios,
            profile.non_compete_obligation || "No",
          )
        )
          count++;
      } else if (fieldType === "open_to_relocation") {
        if (
          window.GRTS.DOM.checkRadio(
            radios,
            profile.open_to_relocation || "Yes",
          )
        )
          count++;
      } else if (fieldType === "gender") {
        if (
          window.GRTS.DOM.checkRadio(
            radios,
            profile.gender || "Decline to Self-Identify",
          )
        )
          count++;
      } else if (fieldType === "veteran_status") {
        if (
          window.GRTS.DOM.checkRadio(
            radios,
            profile.veteran_status || "I am not a protected veteran",
          )
        )
          count++;
      } else if (fieldType === "disability_status") {
        if (
          window.GRTS.DOM.checkRadio(radios, profile.disability_status || "No")
        )
          count++;
      }
    }

    return count;
  }

  /**
   * Dedicated populator for Workday Voluntary Self-Identification of Disability (Form CC-305)
   */
  async function fillWorkdayDisability(profile) {
    let count = 0;
    if (!profile) return 0;

    const fullName =
      profile.full_name ||
      `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    const disabilityTarget = (profile.disability_status || "no")
      .toLowerCase()
      .trim();

    // 1. Fill Name Input
    const nameInputs = Array.from(
      document.querySelectorAll(`
            input[id*="selfIdentifiedDisabilityData--name"],
            input[name="name"][id*="selfIdentified"],
            input[id*="disability"][id*="name"],
            input[name*="disability"][name*="name"],
            input[data-ddg-inputtype="identities.fullName"],
            [data-automation-id*="selfIdentifiedDisabilityData"] input[type="text"]:not([id*="employeeId"]):not([name*="employeeId"]),
            fieldset[id*="disability"] input[type="text"]:not([id*="employeeId"]):not([name*="employeeId"]),
            [data-automation-id*="formField-name"] input,
            input[id*="selfIdentified"][id*="name"]
        `),
    );

    for (const nameInp of nameInputs) {
      if (nameInp.offsetParent === null) continue;
      if (!nameInp.value || nameInp.value.trim() === "") {
        window.GRTS.DOM.setInputValue(nameInp, fullName, true);
        if (nameInp.value !== fullName) {
          await window.GRTS.DOM.typeTextIntoWorkdaySearch(nameInp, fullName);
        }
        nameInp.dataset.grtsFilled = "true";
        count++;
      }
    }

    // 2. Mark Employee ID as handled (it's optional for external job applicants)
    const empIdInputs = Array.from(
      document.querySelectorAll(`
            input[id*="employeeId"],
            input[name*="employeeId"],
            [data-automation-id*="employeeId"] input
        `),
    );
    empIdInputs.forEach((inp) => {
      inp.dataset.grtsFilled = "true";
    });

    // 3. Fill Date Signed On (Today's Date)
    const today = new Date();
    const todayMonth = String(today.getMonth() + 1).padStart(2, "0");
    const todayDay = String(today.getDate()).padStart(2, "0");
    const todayYear = String(today.getFullYear());

    const dateWrappers = Array.from(
      document.querySelectorAll(`
            [id*="selfIdentifiedDisabilityData--dateSignedOn"],
            [data-automation-id*="dateSignedOn"],
            [id*="dateSignedOn"],
            [id*="signatureDate"]
        `),
    );
    for (const wrap of dateWrappers) {
      if (fillWorkdayDateInputWrapper(wrap, todayMonth, todayYear, todayDay)) {
        count++;
      }
    }

    // 4. Select Disability Option (Checkboxes or Radios)
    const disabilityOptions = Array.from(
      document.querySelectorAll(`
            fieldset[data-automation-id*="disabilityStatus"] input,
            fieldset[id*="disabilityStatus"] input,
            fieldset[id*="selfIdentifiedDisabilityData"] input,
            [data-automation-id*="selfIdentifiedDisabilityData"] input[type="checkbox"],
            [data-automation-id*="selfIdentifiedDisabilityData"] input[type="radio"],
            [data-automation-id*="disabilityStatus"] input,
            [data-automation-id*="formField-disabilityStatus"] input,
            input[id*="disabilityStatus"],
            fieldset[id*="disability"] input[type="checkbox"],
            fieldset[id*="disability"] input[type="radio"],
            div[id*="disability"] input[type="checkbox"],
            div[id*="disability"] input[type="radio"]
        `),
    ).filter((inp) => inp.type === "checkbox" || inp.type === "radio");

    if (disabilityOptions.length > 0) {
      const wantsYes =
        disabilityTarget.startsWith("yes") ||
        disabilityTarget === "1" ||
        disabilityTarget === "true" ||
        (disabilityTarget.includes("have a disability") &&
          !disabilityTarget.includes("do not") &&
          !disabilityTarget.includes("don't"));
      const wantsDecline =
        disabilityTarget.includes("decline") ||
        disabilityTarget.includes("prefer not") ||
        disabilityTarget.includes("do not wish") ||
        disabilityTarget.includes("do not want");
      const wantsNo = !wantsYes && !wantsDecline;

      for (const opt of disabilityOptions) {
        const optId = (opt.id || "").toLowerCase();
        const optName = (opt.name || "").toLowerCase();
        const optVal = (opt.value || "").toLowerCase();

        let optLabel = "";
        if (opt.id) {
          const l = document.querySelector(
            `label[for="${CSS.escape(opt.id)}"]`,
          );
          if (l) optLabel = (l.innerText || "").toLowerCase().trim();
        }
        if (!optLabel) {
          const pl = opt.closest("label");
          if (pl) optLabel = (pl.innerText || "").toLowerCase().trim();
        }
        if (!optLabel) {
          const row = opt.closest('[role="row"], .css-1utp272, div');
          const rl = row ? row.querySelector("label") : null;
          if (rl) optLabel = (rl.innerText || "").toLowerCase().trim();
        }
        if (!optLabel) {
          optLabel = (
            window.GRTS.Matcher.getFieldLabel(opt) || ""
          ).toLowerCase();
        }

        const combined = `${optId} ${optName} ${optVal} ${optLabel}`;

        let isTarget = false;
        if (wantsNo) {
          if (
            optLabel.includes("do not have a disability") ||
            optLabel.includes("don't have a disability") ||
            optLabel.includes("not had one in the past") ||
            optLabel.includes("no disability") ||
            (optLabel.startsWith("no") && !optLabel.includes("yes")) ||
            combined.includes("do not have a disability") ||
            combined.includes("not had one in the past")
          ) {
            isTarget = true;
          }
        } else if (wantsYes) {
          if (
            (optLabel.includes("have a disability") ||
              optLabel.includes("history/record") ||
              optLabel.startsWith("yes")) &&
            !optLabel.includes("do not") &&
            !optLabel.includes("don't")
          ) {
            isTarget = true;
          }
        } else if (wantsDecline) {
          if (
            optLabel.includes("do not want to answer") ||
            optLabel.includes("do not wish to answer") ||
            optLabel.includes("decline") ||
            optLabel.includes("prefer not")
          ) {
            isTarget = true;
          }
        }

        if (isTarget) {
          if (opt.type === "checkbox") {
            if (window.GRTS.DOM.setCheckbox(opt, true)) count++;
          } else if (opt.type === "radio") {
            if (window.GRTS.DOM.checkRadio([opt], optLabel || "no")) count++;
          }
        } else {
          if (
            opt.type === "checkbox" &&
            (opt.checked || opt.getAttribute("aria-checked") === "true")
          ) {
            window.GRTS.DOM.setCheckbox(opt, false);
          }
        }
      }
    }

    return count;
  }

  /**
   * Fills Workday Legal Name & Contact Information section
   */
  async function fillWorkdayContactInfo(profile) {
    let count = 0;
    const firstName = profile?.first_name || "";
    const lastName = profile?.last_name || "";
    const email = profile?.email || "";
    const phone = profile?.phone || "3176046777";
    const city = profile?.city || "Indianapolis";
    const state = profile?.state || "IN";
    const zip = profile?.postal_code || "";
    const address = profile?.address || "";

    // 1. Legal First Name
    const fnInputs = document.querySelectorAll(
      'input[id*="legalName--firstName"], input[name*="legalName--firstName"], input[id*="legalName_firstName"], input[data-automation-id*="legalName--firstName"] input, input[data-automation-id*="legalName--firstName"]',
    );
    fnInputs.forEach((inp) => {
      if (window.GRTS.DOM.setInputValue(inp, firstName, true)) count++;
    });

    // 2. Legal Last Name
    const lnInputs = document.querySelectorAll(
      'input[id*="legalName--lastName"], input[name*="legalName--lastName"], input[id*="legalName_lastName"], input[data-automation-id*="legalName--lastName"] input, input[data-automation-id*="legalName--lastName"]',
    );
    lnInputs.forEach((inp) => {
      if (window.GRTS.DOM.setInputValue(inp, lastName, true)) count++;
    });

    // 3. Email
    const emailInputs = document.querySelectorAll(
      'input[id*="email"], input[name*="email"], input[data-automation-id*="email"] input',
    );
    emailInputs.forEach((inp) => {
      if (inp.type !== "checkbox" && inp.type !== "radio") {
        if (window.GRTS.DOM.setInputValue(inp, email, false)) count++;
      }
    });

    // 4. Phone
    const phoneInputs = document.querySelectorAll(
      'input[id*="phone-number"], input[name*="phone-number"], input[id*="phoneNumber"], input[name*="phoneNumber"], input[data-automation-id*="phoneNumber"] input',
    );
    phoneInputs.forEach((inp) => {
      if (window.GRTS.DOM.setInputValue(inp, phone, true)) count++;
    });

    // 5. Address Lines
    const addrInputs = document.querySelectorAll(
      'input[id*="addressSection_addressLine1"], input[name*="addressLine1"], input[data-automation-id*="addressLine1"] input',
    );
    addrInputs.forEach((inp) => {
      if (address && window.GRTS.DOM.setInputValue(inp, address, true)) count++;
    });

    // 6. City
    const cityInputs = document.querySelectorAll(
      'input[id*="addressSection_city"], input[name*="city"], input[data-automation-id*="city"] input',
    );
    cityInputs.forEach((inp) => {
      if (city && window.GRTS.DOM.setInputValue(inp, city, true)) count++;
    });

    // 7. Postal Code
    const zipInputs = document.querySelectorAll(
      'input[id*="addressSection_postalCode"], input[name*="postalCode"], input[data-automation-id*="postalCode"] input',
    );
    zipInputs.forEach((inp) => {
      if (zip && window.GRTS.DOM.setInputValue(inp, zip, true)) count++;
    });

    return count;
  }

  return {
    selectWorkdayMultiSelect,
    selectWorkdayDropdown,
    fillWorkdayContactInfo,
    fillWorkdayCustomButtons,
    fillWorkdayDates,
    fillWorkdayEducation,
    fillWorkdayWebsites,
    fillWorkdayExperience,
    fillWorkdayTermsAndConditions,
    fillWorkdayRadios,
    fillWorkdayDisability,
  };
})();
