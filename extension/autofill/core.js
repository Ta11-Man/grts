window.GRTS = window.GRTS || {};

window.GRTS.Core = (() => {
  let isAutofilling = false;
  let stepPasses = 0;
  let lastAutofillTime = 0;
  let lastStepSignature = "";
  let stepTransitionTimer = null;

  /**
   * Checks if the current page is the final Review / Submit page (with Submit button).
   * Workday uses data-automation-id="pageFooterNextButton" with text "Submit" on this final step.
   */
  function checkIsReviewPage() {
    const candidateButtons = Array.from(
      document.querySelectorAll(`
            button[data-automation-id="pageFooterNextButton"],
            button[data-automation-id="bottom-navigation-next-button"],
            button[data-automation-id="next-button"],
            button[data-automation-id="page-navigation-next-button"],
            button[type="submit"],
            input[type="submit"],
            button
        `),
    ).filter((b) => {
      if (b.offsetParent === null) return false;
      const style = window.getComputedStyle(b);
      return style.display !== "none" && style.visibility !== "hidden";
    });

    for (const btn of candidateButtons) {
      const text = (btn.textContent || btn.value || "").trim().toLowerCase();
      const autoId = (
        btn.getAttribute("data-automation-id") || ""
      ).toLowerCase();

      if (
        text === "submit" ||
        text === "submit application" ||
        text.includes("submit") ||
        text.includes("apply now") ||
        text.includes("finish") ||
        autoId.includes("submit")
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Creates a signature of the current step form to detect navigation transitions
   */
  function getFormSignature() {
    const titleEl = document.querySelector(
      '[data-automation-id*="pageHeader"], [data-automation-id*="step"], h2, h1, [data-automation-id="subPageTitle"], .css-1q8258',
    );
    const title = titleEl ? titleEl.textContent.trim() : "";
    const inputCount = document.querySelectorAll(
      'input:not([type="hidden"]), select, textarea',
    ).length;
    const pageBtn = document.querySelector(
      'button[data-automation-id="pageFooterNextButton"], button[data-automation-id="bottom-navigation-next-button"]',
    );
    const btnText = pageBtn ? pageBtn.textContent.trim() : "";
    return `${window.location.href}__${title}__${inputCount}__${btnText}`;
  }

  /**
   * Polls and watches for the next multi-step page to mount, then triggers autofill
   */
  function waitForNextStepAndAutofill(maxWaitMs = 12000) {
    const initialSignature = lastStepSignature || getFormSignature();
    const initialUrl = window.location.href;
    const startTime = Date.now();

    if (stepTransitionTimer) clearInterval(stepTransitionTimer);

    stepTransitionTimer = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > maxWaitMs) {
        clearInterval(stepTransitionTimer);
        stepTransitionTimer = null;
        return;
      }

      const currentSig = getFormSignature();
      const currentUrl = window.location.href;

      const nextBtn = document.querySelector(
        'button[data-automation-id="pageFooterNextButton"], button[data-automation-id="bottom-navigation-next-button"]',
      );
      const isReady =
        nextBtn &&
        !nextBtn.disabled &&
        nextBtn.getAttribute("aria-disabled") !== "true";

      if (
        (currentSig !== initialSignature || currentUrl !== initialUrl) &&
        isReady
      ) {
        clearInterval(stepTransitionTimer);
        stepTransitionTimer = null;
        stepPasses = 0;
        lastAutofillTime = 0;
        await new Promise((r) => setTimeout(r, 450));
        await autofillPage();
      }
    }, 250);
  }

  /**
   * Checks if the current page/step is filled with high confidence and no missing required fields,
   * and automatically clicks 'Save and Continue' / 'Next' to proceed to the next step.
   * Stops and waits when it reaches the Review page with the 'Submit' button.
   */
  async function checkAndAutoAdvance() {
    // 0. If we are on the Review / Final Submit page, NEVER auto-click Submit - wait for user
    if (checkIsReviewPage()) {
      window.GRTS.UI.updateBadgeStatus(
        "✓ Application review page reached! Review your details and click <strong>Submit</strong>.",
      );
      return false;
    }

    // 1. Check for any visible error messages on the page
    const errorElements = Array.from(
      document.querySelectorAll(`
            [data-automation-id*="error"],
            [data-uxi-widget-type*="error"],
            [role="alert"],
            .has-error,
            .error-message,
            .alert-danger
        `),
    ).filter((el) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        el.offsetParent !== null &&
        rect.height > 0 &&
        (el.textContent || "").trim().length > 0
      );
    });

    if (errorElements.length > 0) {
      return false;
    }

    // 2. Check for any unfilled REQUIRED inputs
    const requiredInputs = Array.from(
      document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="file"]), select, textarea',
      ),
    ).filter((el) => {
      if (window.GRTS.DOM.isHoneypotOrHidden(el)) return false;
      if (el.disabled || el.readOnly || el.offsetParent === null) return false;
      if (
        el.id === "globalSearchInput" ||
        el.id === "appSortSelect" ||
        el.id === "sortBySelect"
      )
        return false;

      const isReqAttr =
        el.hasAttribute("required") ||
        el.getAttribute("aria-required") === "true";
      const label = window.GRTS.Matcher.getFieldLabel(el);
      const isReqLabel =
        label.includes("*") || label.toLowerCase().includes("required");
      return isReqAttr || isReqLabel;
    });

    for (const reqEl of requiredInputs) {
      // Mandatory checkbox validation
      if (reqEl.type === "checkbox") {
        const group = reqEl.closest(
          'fieldset, [data-automation-id*="formField"], [data-automation-id*="question"], div[class*="css-"]',
        );
        if (group) {
          const chks = Array.from(
            group.querySelectorAll('input[type="checkbox"]'),
          );
          if (chks.length > 1) {
            // For a multi-checkbox question group, at least one checkbox must be checked if required
            const anyChecked = chks.some(
              (c) => c.checked || c.getAttribute("aria-checked") === "true",
            );
            if (!anyChecked) return false;
            continue;
          }
        }
        if (!reqEl.checked && reqEl.getAttribute("aria-checked") !== "true")
          return false;
        continue;
      }

      // If skills is disabled, don't let it block auto-advance
      const fieldType = window.GRTS.Matcher.getFieldType(reqEl);
      if (fieldType === "skills") continue;

      // If already marked filled by GRTS, skip
      if (reqEl.dataset.grtsFilled === "true") continue;

      // Skip Field of Study since handled by dedicated selector
      const reqId = (reqEl.id || "").toLowerCase();
      const reqName = (reqEl.name || "").toLowerCase();
      const reqAuto = (
        reqEl.getAttribute("data-automation-id") || ""
      ).toLowerCase();
      if (
        reqId.includes("fieldofstudy") ||
        reqName.includes("fieldofstudy") ||
        reqAuto.includes("fieldofstudy")
      )
        continue;

      // If inside a multiselect container with a selected pill tag, skip
      const container = reqEl.closest(
        '[data-automation-id*="multiSelectContainer"], [data-uxi-widget-type="multiselect"], [data-automation-id*="formField"], [data-automation-id*="inputContainer"], fieldset',
      );
      if (
        container &&
        (container.dataset.grtsFilled === "true" ||
          container.querySelector(
            '[data-automation-id*="selectedItem"], [data-automation-id*="pill"], [data-uxi-widget-type*="pill"], [data-automation-id*="delete"], [class*="pill"]',
          ))
      ) {
        continue;
      }

      if (reqEl.type === "radio") {
        const groupName = reqEl.name;
        const radios = document.querySelectorAll(
          `input[type="radio"][name="${groupName}"]`,
        );
        const anyChecked = Array.from(radios).some((r) => r.checked);
        if (!anyChecked) return false;
      } else {
        const val = (reqEl.value || "").trim();
        if (
          !val ||
          val === "--" ||
          val === "Select" ||
          val === "MM" ||
          val === "YYYY" ||
          val === "Prompt"
        ) {
          return false;
        }
      }
    }

    // 2b. Check for any unfilled REQUIRED custom button dropdowns (Work Auth, Sponsorship, How Heard, etc.)
    const requiredDropdownButtons = Array.from(
      document.querySelectorAll(`
            button[aria-haspopup="listbox"],
            button[data-automation-id*="dropdown"],
            button[data-automation-id*="select"],
            [data-automation-id*="formField"] button,
            [data-automation-id*="question"] button,
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
        autoId.includes("cancel")
      )
        return false;
      if (
        text === "save and continue" ||
        text === "next" ||
        text === "submit" ||
        text === "cancel" ||
        text === "add"
      )
        return false;

      const label = window.GRTS.Matcher.getFieldLabel(b).toLowerCase();
      const isReqAttr =
        b.hasAttribute("required") ||
        b.getAttribute("aria-required") === "true";
      const isReqLabel = label.includes("*") || label.includes("required");
      return isReqAttr || isReqLabel;
    });

    for (const btn of requiredDropdownButtons) {
      const text = (btn.textContent || "").trim().toLowerCase();
      if (
        !text ||
        text.includes("select") ||
        text.includes("prompt") ||
        text.includes("choose") ||
        text === "--"
      ) {
        return false;
      }
    }

    // 3. Find the 'Save and Continue' / 'Next' button
    const candidateButtons = Array.from(
      document.querySelectorAll(`
            button[data-automation-id="pageFooterNextButton"],
            button[data-automation-id="bottom-navigation-next-button"],
            button[data-automation-id="next-button"],
            button[data-automation-id="page-navigation-next-button"],
            button[type="submit"],
            input[type="submit"],
            button
        `),
    );

    let advanceBtn = null;
    for (const btn of candidateButtons) {
      if (btn.offsetParent === null) continue;
      const text = (btn.textContent || btn.value || "").trim().toLowerCase();
      const autoId = (
        btn.getAttribute("data-automation-id") || ""
      ).toLowerCase();

      // Strictly exclude final submission buttons so user can review before applying
      if (
        text === "submit" ||
        text.includes("submit") ||
        text.includes("apply now") ||
        text.includes("finish") ||
        autoId.includes("submit")
      ) {
        continue;
      }

      if (
        autoId === "pagefooternextbutton" ||
        autoId === "bottom-navigation-next-button" ||
        autoId === "next-button" ||
        text === "save and continue" ||
        text === "save & continue" ||
        text === "next" ||
        text === "next step" ||
        text === "continue" ||
        text === "save and next"
      ) {
        advanceBtn = btn;
        break;
      }
    }

    if (!advanceBtn) return false;

    // 4. Ensure advance button is enabled
    if (
      advanceBtn.disabled ||
      advanceBtn.getAttribute("aria-disabled") === "true"
    ) {
      return false;
    }

    // 5. Update badge status and trigger advance
    window.GRTS.UI.updateBadgeStatus(
      "✓ Section complete • Advancing to next step...",
    );
    await new Promise((r) => setTimeout(r, 600));

    advanceBtn.scrollIntoView({ behavior: "smooth", block: "center" });
    try {
      advanceBtn.dispatchEvent(
        new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
      );
      advanceBtn.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
      advanceBtn.dispatchEvent(
        new PointerEvent("pointerup", { bubbles: true, cancelable: true }),
      );
      advanceBtn.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
      );
    } catch (e) {}
    advanceBtn.click();

    // 6. Reset step signature and begin watching for next step
    lastStepSignature = getFormSignature();
    waitForNextStepAndAutofill();

    return true;
  }

  /**
   * Locates the topmost unfilled unique/custom/required field on the page,
   * smoothly scrolls it into view, and focuses it so the user can immediately begin typing.
   */
  function focusFirstUnfilledField() {
    const candidates = Array.from(
      document.querySelectorAll(`
            input:not([type="hidden"]):not([type="submit"]):not([type="file"]),
            textarea,
            select,
            button[aria-haspopup="listbox"],
            button[data-automation-id*="dropdown"],
            button[data-automation-id*="select"],
            [data-automation-id*="formField"] button,
            [data-automation-id*="question"] button,
            div[data-automation-id="select-widget"] button
        `),
    ).filter((el) => {
      if (window.GRTS.DOM.isHoneypotOrHidden(el)) return false;
      if (el.disabled || el.readOnly || el.offsetParent === null) return false;
      if (
        el.id === "globalSearchInput" ||
        el.id === "appSortSelect" ||
        el.id === "sortBySelect"
      )
        return false;

      const autoId = (
        el.getAttribute("data-automation-id") || ""
      ).toLowerCase();
      const text = (el.textContent || "").toLowerCase().trim();
      if (
        autoId.includes("next") ||
        autoId.includes("save") ||
        autoId.includes("submit") ||
        autoId.includes("cancel")
      )
        return false;
      if (
        text === "save and continue" ||
        text === "next" ||
        text === "submit" ||
        text === "cancel" ||
        text === "add" ||
        text === "add another"
      )
        return false;

      // Skip skills since skills filling is disabled
      const fieldType = window.GRTS.Matcher.getFieldType(el);
      if (fieldType === "skills") return false;

      // Skip if marked filled by GRTS
      if (el.dataset.grtsFilled === "true") return false;

      // Skip Field of Study since handled by dedicated selector
      const elId = (el.id || "").toLowerCase();
      const elName = (el.name || "").toLowerCase();
      const elAuto = (
        el.getAttribute("data-automation-id") || ""
      ).toLowerCase();
      if (
        elId.includes("fieldofstudy") ||
        elName.includes("fieldofstudy") ||
        elAuto.includes("fieldofstudy")
      )
        return false;

      // Skip Employee ID / internal employee fields if optional or candidate is external
      if (
        elId.includes("employeeid") ||
        elName.includes("employeeid") ||
        elAuto.includes("employeeid") ||
        elId.includes("workerid") ||
        elName.includes("workerid")
      ) {
        return false;
      }

      // Skip websites inputs if we have already filled at least one website
      if (
        elId.includes("website") ||
        elName.includes("website") ||
        elAuto.includes("website") ||
        elId.includes("url") ||
        elName.includes("url")
      ) {
        const websiteInputs = Array.from(
          document.querySelectorAll(
            'input[id*="website"], input[name*="website"], input[id*="url"], input[name*="url"]',
          ),
        );
        const anyFilled = websiteInputs.some(
          (inp) =>
            (inp.value || "").trim().length > 0 ||
            inp.dataset.grtsFilled === "true",
        );
        if (anyFilled) return false;
      }

      // Skip if inside a container with a selected pill tag
      const container = el.closest(
        '[data-automation-id*="multiSelectContainer"], [data-uxi-widget-type="multiselect"], [data-automation-id*="formField"], [data-automation-id*="inputContainer"], fieldset',
      );
      if (container) {
        if (container.dataset.grtsFilled === "true") return false;
        if (
          container.querySelector(
            '[data-automation-id*="selectedItem"], [data-automation-id*="pill"], [data-uxi-widget-type*="pill"], [data-automation-id*="delete"], [class*="pill"]',
          )
        )
          return false;
      }

      const style = window.getComputedStyle(el);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
      )
        return false;
      if (el.offsetParent === null) return false;

      if (el.tagName === "BUTTON") {
        const bText = (el.textContent || "").trim().toLowerCase();
        return (
          !bText ||
          bText.includes("select") ||
          bText.includes("prompt") ||
          bText.includes("choose") ||
          bText === "--"
        );
      } else if (
        el.tagName === "TEXTAREA" ||
        (el.tagName === "INPUT" &&
          el.type !== "checkbox" &&
          el.type !== "radio")
      ) {
        const val = (el.value || "").trim();
        return (
          !val ||
          val === "" ||
          val === "--" ||
          val === "Select" ||
          val === "MM" ||
          val === "YYYY" ||
          val === "Prompt"
        );
      } else if (el.tagName === "SELECT") {
        const idx = el.selectedIndex;
        return (
          idx <= 0 ||
          (el.options[idx] &&
            (el.options[idx].text.toLowerCase().includes("select") ||
              el.options[idx].text.toLowerCase().includes("prompt")))
        );
      } else if (
        el.type === "checkbox" &&
        (el.hasAttribute("required") ||
          el.getAttribute("aria-required") === "true")
      ) {
        return !el.checked;
      } else if (
        el.type === "radio" &&
        (el.hasAttribute("required") ||
          el.getAttribute("aria-required") === "true")
      ) {
        const radios = document.querySelectorAll(
          `input[type="radio"][name="${el.name}"]`,
        );
        return !Array.from(radios).some((r) => r.checked);
      }

      return false;
    });

    if (candidates.length === 0) return null;

    const requiredCandidate = candidates.find((el) => {
      const isReq =
        el.hasAttribute("required") ||
        el.getAttribute("aria-required") === "true";
      const lbl = window.GRTS.Matcher.getFieldLabel(el);
      return (
        isReq || lbl.includes("*") || lbl.toLowerCase().includes("required")
      );
    });

    const targetField = requiredCandidate || candidates[0];

    try {
      targetField.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        targetField.focus();
        targetField.style.transition =
          "box-shadow 0.25s ease, border-color 0.25s ease";
        targetField.style.borderColor = "#0284c7";
        targetField.style.boxShadow = "0 0 0 3px rgba(2, 132, 199, 0.25)";
      }, 300);
    } catch (e) {}

    return targetField;
  }

  /**
   * Master Autofill Entry Point
   */
  async function autofillPage(isUserTriggered = false) {
    if (isAutofilling) return 0;
    if (
      !isUserTriggered &&
      stepPasses >= window.GRTS.Config.CONSTANTS.MAX_AUTO_PASSES
    )
      return 0;
    stepPasses++;

    if (window.GRTS.DOM.isLoginOrAuthScreen()) {
      return 0;
    }

    isAutofilling = true;
    window.GRTS.DOM.injectHighlightStyles();

    const profile = await window.GRTS.Profile.loadProfile(isUserTriggered);

    // Autofill can be disabled without disabling submission tracking in content.js.
    if (profile.autofill_enabled === false) {
      isAutofilling = false;
      return 0;
    }

    let filledCount = 0;

    // 1. Workday Legal Name & Contact Info (First Name, Last Name, Email, Phone, Address)
    filledCount +=
      await window.GRTS.Adapters.Workday.fillWorkdayContactInfo(profile);

    // 2. Generic / Standard Form Controls (Cross-ATS Contact & Demographics)
    try {
      filledCount +=
        await window.GRTS.Adapters.Generic.fillStandardControls(profile);
    } catch (e) {}

    // 3. Work Experience Section
    filledCount +=
      await window.GRTS.Adapters.Workday.fillWorkdayExperience(profile);

    // 4. Education Section
    filledCount +=
      await window.GRTS.Adapters.Workday.fillWorkdayEducation(profile);

    // 5. Composite Dates for Work Experience & Education
    filledCount += window.GRTS.Adapters.Workday.fillWorkdayDates(profile);

    // 6. Resume PDF File Attachment
    if (window.GRTS.Profile.attachResumePdfIfPresent(profile)) {
      filledCount++;
    }

    // 7. Websites & Portfolio URLs
    filledCount +=
      await window.GRTS.Adapters.Workday.fillWorkdayWebsites(profile);

    // 8. Dedicated Social Network Accounts (LinkedIn)
    const linkedInInp = document.querySelector(
      'input[id*="socialNetworkAccounts--linkedInAccount"], input[id*="linkedInAccount"], input[name*="linkedInAccount"], [data-automation-id*="linkedInAccount"] input',
    );
    if (linkedInInp && profile.linkedin) {
      if (window.GRTS.DOM.setInputValue(linkedInInp, profile.linkedin, true)) {
        filledCount++;
      }
    }

    // 9. Workday Custom Dropdown Buttons (Work Auth, Sponsorship, How Heard, Demographics)
    filledCount +=
      await window.GRTS.Adapters.Workday.fillWorkdayCustomButtons(profile);

    // 10. Workday Terms & Conditions / Agreements Checkboxes
    filledCount +=
      await window.GRTS.Adapters.Workday.fillWorkdayTermsAndConditions(profile);

    // 11. Workday Radio Button Groups (Previous Worker, Demographics, etc.)
    filledCount +=
      await window.GRTS.Adapters.Workday.fillWorkdayRadios(profile);

    // 12. Workday Voluntary Disability Self-Identification (Form CC-305)
    filledCount +=
      await window.GRTS.Adapters.Workday.fillWorkdayDisability(profile);

    // 13. Greenhouse Fields
    filledCount +=
      await window.GRTS.Adapters.Greenhouse.fillGreenhouseFields(profile);

    // 14. Auto-populate previously answered custom questions from user's historical Q&A Bank
    try {
      filledCount += await fillFromQuestionBank(profile);
    } catch (e) {}

    try {
      if (!window.GRTS.UI.isBadgeDismissed()) {
        window.GRTS.UI.renderFloatingBadge(filledCount, async () => {
          stepPasses = 0;
          await window.GRTS.Profile.loadProfile(true);
          await autofillPage(true);
        });
      }

      // Check if we can automatically advance to the next step
      const advanced = await checkAndAutoAdvance();

      if (!advanced) {
        if (checkIsReviewPage()) {
          if (!window.GRTS.UI.isBadgeDismissed()) {
            window.GRTS.UI.updateBadgeStatus(
              "✓ All sections complete! Ready for review • Click <strong>Submit</strong> when ready.",
            );
          }
        } else {
          const target = focusFirstUnfilledField();
          if (target && !window.GRTS.UI.isBadgeDismissed()) {
            window.GRTS.UI.updateBadgeStatus(
              `GRTS Auto-Filled <strong>${filledCount}</strong> fields • Ready on custom field`,
            );
          }
        }
      }
    } catch (err) {
      console.error("[GRTS Autofill] Error:", err);
    } finally {
      lastAutofillTime = Date.now();
      isAutofilling = false;
    }

    return filledCount;
  }

  /**
   * Auto-populates previously answered custom questions from the user's historical Q&A bank
   */
  async function fillFromQuestionBank(profile) {
    let count = 0;
    let qaBank = [];

    try {
      const res = await fetch("http://127.0.0.1:8000/questions");
      if (res.ok) {
        qaBank = await res.json();
      }
    } catch (e) {}

    if (!qaBank || qaBank.length === 0) {
      try {
        const stored = await chrome.storage.local.get("grts_user_profile");
        qaBank = stored?.grts_user_profile?.custom_answers || [];
      } catch (e) {}
    }

    if (!qaBank || qaBank.length === 0) return 0;

    const findMatchingAnswer = (questionText) => {
      if (!questionText || questionText.length < 4) return null;
      const q = questionText.toLowerCase().trim();
      for (const item of qaBank) {
        const bankQ = (item.question_text || "").toLowerCase().trim();
        if (bankQ === q) return item;
        const sc = window.GRTS.DOM.scoreOptionMatch(bankQ, q);
        if (sc >= 600) return item;
      }
      return null;
    };

    // 1. Checkbox Groups
    const checkboxGroups = document.querySelectorAll(`
            [data-automation-id*="CheckboxGroup"],
            fieldset[id*="CheckboxGroup"],
            [data-automation-id*="formField"],
            fieldset.css-1s9yhc,
            fieldset
        `);

    for (const group of checkboxGroups) {
      const checkboxes = Array.from(
        group.querySelectorAll('input[type="checkbox"]'),
      );
      if (checkboxes.length <= 1) continue;

      const legendOrRich = group.querySelector(
        'legend, [data-automation-id="richText"], [id*="checkbox-group-label"], [id*="rich-label"]',
      );
      const qText = legendOrRich ? (legendOrRich.innerText || "").trim() : "";
      const matchedQA = findMatchingAnswer(qText);

      if (matchedQA && matchedQA.answer_text) {
        const targetTokens = matchedQA.answer_text
          .split(/[,;\n]+/)
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
        let matchedAny = false;

        for (const chk of checkboxes) {
          let labelText = "";
          if (chk.id) {
            try {
              const lbl = document.querySelector(
                `label[for="${CSS.escape(chk.id)}"]`,
              );
              if (lbl)
                labelText = (lbl.innerText || lbl.textContent || "").trim();
            } catch (e) {}
          }
          if (!labelText) {
            const parentLbl = chk.closest("label");
            if (parentLbl)
              labelText = (
                parentLbl.innerText ||
                parentLbl.textContent ||
                ""
              ).trim();
          }
          if (!labelText) {
            const row = chk.closest(
              '[role="row"], [role="cell"], div[class*="css-"]',
            );
            if (row) {
              const rowLbl = row.querySelector('label, span[class*="css-"]');
              if (rowLbl)
                labelText = (
                  rowLbl.innerText ||
                  rowLbl.textContent ||
                  ""
                ).trim();
            }
          }
          if (!labelText) labelText = (chk.value || "").trim();

          const lblLower = labelText.toLowerCase();
          const shouldBeChecked = targetTokens.some(
            (tok) =>
              lblLower === tok || (tok.length > 3 && lblLower.includes(tok)),
          );

          if (shouldBeChecked) {
            window.GRTS.DOM.setCheckbox(chk, true);
            chk.dataset.grtsFilled = "true";
            matchedAny = true;
          }
        }

        if (matchedAny) {
          group.dataset.grtsFilled = "true";
          window.GRTS.DOM.highlightElement(group);
          count++;
        }
      }
    }

    // 2. Custom Dropdown Buttons
    const customDropdowns = document.querySelectorAll(`
            button[aria-haspopup="listbox"],
            button[data-automation-id*="dropdown"],
            button[data-automation-id*="select"],
            [data-automation-id*="formField"] button[type="button"]
        `);

    for (const btn of customDropdowns) {
      const parentField = btn.closest(
        '[data-automation-id*="formField"], fieldset, .form-group, div[class*="question"]',
      );
      if (!parentField) continue;
      const qEl = parentField.querySelector(
        'legend, [data-automation-id="richText"], [id*="rich-label"], label, p',
      );
      const qText = qEl ? (qEl.innerText || "").trim() : "";
      const matchedQA = findMatchingAnswer(qText);

      if (matchedQA && matchedQA.answer_text) {
        if (
          await window.GRTS.Adapters.Workday.selectWorkdayDropdown(btn, [
            matchedQA.answer_text,
          ])
        ) {
          btn.dataset.grtsFilled = "true";
          window.GRTS.DOM.highlightElement(btn);
          count++;
        }
      }
    }

    // 3. Text and Textarea Inputs
    const textInputs = document.querySelectorAll(
      'input[type="text"], textarea',
    );
    for (const inp of textInputs) {
      if (inp.dataset.grtsFilled === "true" || inp.value.trim().length > 0)
        continue;
      if (window.GRTS.Matcher.getFieldType(inp) !== "unknown") continue;
      const label = window.GRTS.Matcher.getFieldLabel(inp);
      const matchedQA = findMatchingAnswer(label);
      if (matchedQA && matchedQA.answer_text) {
        if (window.GRTS.DOM.setInputValue(inp, matchedQA.answer_text, true)) {
          count++;
        }
      }
    }

    return count;
  }

  /**
   * Extracts non-standard question and answer pairs
   * Supports:
   * - Checkbox Groups (e.g. "When are you available...", "What are your areas of interest?", "Select skills...")
   * - Custom Dropdown Buttons (e.g. "Did you attend an NVIDIA university event in the past 3 months?")
   * - Standard inputs, selects, textareas, and radio buttons
   * STRICT SECURITY: Completely ignores passwords, passcodes, PINs, and SSNs.
   */
  function extractCustomQuestionsAndAnswers() {
    const qaPairs = [];
    const seenQuestions = new Set();
    const handledElements = new Set();

    const cleanQuestion = (q) => {
      if (!q) return "";
      return q
        .replace(/\*+/g, "")
        .replace(/\bIndicates a required field\b/gi, "")
        .replace(/\bRequired\b/gi, "")
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    };

    // 1. Process Checkbox Groups (e.g. Workday questionnaires, multi-select skill/interest/term checklists)
    const checkboxGroupContainers = document.querySelectorAll(`
            [data-automation-id*="CheckboxGroup"],
            fieldset[id*="CheckboxGroup"],
            [data-automation-id*="formField"],
            fieldset.css-1s9yhc,
            fieldset
        `);

    checkboxGroupContainers.forEach((container) => {
      const checkboxes = Array.from(
        container.querySelectorAll('input[type="checkbox"]'),
      );
      if (checkboxes.length <= 1) return;

      let groupQuestion = "";
      const legendOrRich = container.querySelector(
        'legend, [data-automation-id="richText"], [id*="checkbox-group-label"], [id*="rich-label"], [data-automation-id*="questionLabel"]',
      );
      if (legendOrRich) {
        groupQuestion = cleanQuestion(
          legendOrRich.innerText || legendOrRich.textContent || "",
        );
      } else {
        const parentField = container.closest(
          '[data-automation-id*="formField"]',
        );
        if (parentField) {
          const pHeader = parentField.querySelector(
            'legend, [data-automation-id="richText"], [id*="label"]',
          );
          if (pHeader)
            groupQuestion = cleanQuestion(
              pHeader.innerText || pHeader.textContent || "",
            );
        }
      }

      if (!groupQuestion || groupQuestion.length < 5) return;

      const gqLower = groupQuestion.toLowerCase();
      if (
        gqLower.includes("password") ||
        gqLower.includes("ssn") ||
        gqLower.includes("pin") ||
        gqLower.includes("secret")
      )
        return;

      checkboxes.forEach((c) => handledElements.add(c));

      const checkedLabels = [];
      checkboxes.forEach((chk) => {
        const isChecked =
          chk.checked || chk.getAttribute("aria-checked") === "true";
        if (isChecked) {
          let labelText = "";
          if (chk.id) {
            try {
              const lbl = document.querySelector(
                `label[for="${CSS.escape(chk.id)}"]`,
              );
              if (lbl)
                labelText = (lbl.innerText || lbl.textContent || "").trim();
            } catch (e) {}
          }
          if (!labelText) {
            const parentLbl = chk.closest("label");
            if (parentLbl)
              labelText = (
                parentLbl.innerText ||
                parentLbl.textContent ||
                ""
              ).trim();
          }
          if (!labelText) {
            const row = chk.closest(
              '[role="row"], [role="cell"], div[class*="css-"]',
            );
            if (row) {
              const rowLbl = row.querySelector('label, span[class*="css-"]');
              if (rowLbl)
                labelText = (
                  rowLbl.innerText ||
                  rowLbl.textContent ||
                  ""
                ).trim();
            }
          }
          if (!labelText) labelText = (chk.value || "").trim();

          if (
            labelText &&
            labelText.toLowerCase() !== "yes" &&
            labelText.toLowerCase() !== "true"
          ) {
            checkedLabels.push(labelText);
          }
        }
      });

      if (checkedLabels.length > 0) {
        const normQ = groupQuestion.toLowerCase();
        if (!seenQuestions.has(normQ)) {
          seenQuestions.add(normQ);
          qaPairs.push({
            question_text: groupQuestion,
            answer_text: checkedLabels.join(", "),
            field_type: "checkbox_group",
            field_name:
              container.id ||
              container.getAttribute("data-automation-id") ||
              null,
            is_standard: false,
          });
        }
      }
    });

    // 2. Process Custom Dropdown Buttons (Workday / Canvas Kit / Ashby)
    const customDropdowns = document.querySelectorAll(`
            button[aria-haspopup="listbox"],
            button[data-automation-id*="dropdown"],
            button[data-automation-id*="select"],
            [data-automation-id*="formField"] button[type="button"]
        `);

    customDropdowns.forEach((btn) => {
      if (handledElements.has(btn) || window.GRTS.DOM.isHoneypotOrHidden(btn))
        return;
      handledElements.add(btn);

      let questionLabel = "";
      const parentField = btn.closest(
        '[data-automation-id*="formField"], fieldset, .form-group, div[class*="question"]',
      );
      if (parentField) {
        const qEl = parentField.querySelector(
          'legend, [data-automation-id="richText"], [id*="rich-label"], [data-automation-id*="questionLabel"], label, p',
        );
        if (qEl && qEl !== btn) {
          questionLabel = cleanQuestion(qEl.innerText || qEl.textContent || "");
        }
      }

      if (!questionLabel && btn.getAttribute("aria-label")) {
        const aria = cleanQuestion(btn.getAttribute("aria-label"));
        if (
          !aria.toLowerCase().includes("select one") &&
          !aria.toLowerCase().includes("prompt")
        ) {
          questionLabel = aria;
        }
      }

      if (!questionLabel || questionLabel.length < 4) return;

      const qLower = questionLabel.toLowerCase();
      if (
        qLower.includes("password") ||
        qLower.includes("ssn") ||
        qLower.includes("pin") ||
        qLower.includes("secret")
      )
        return;

      const isStandard = [
        "first_name",
        "last_name",
        "email",
        "phone",
        "phone_device_type",
        "state",
        "country",
        "gender",
        "race_ethnicity",
        "veteran_status",
        "disability_status",
        "work_authorized_us",
        "require_sponsorship",
      ].includes(window.GRTS.Matcher.getFieldType(btn));

      if (isStandard) return;

      let val = (btn.textContent || "").trim();
      const valLower = val.toLowerCase();
      if (
        !val ||
        valLower.includes("select one") ||
        valLower.includes("prompt") ||
        valLower.includes("choose one") ||
        val === "--"
      ) {
        return;
      }

      const normQ = questionLabel.toLowerCase();
      if (!seenQuestions.has(normQ)) {
        seenQuestions.add(normQ);
        qaPairs.push({
          question_text: questionLabel,
          answer_text: val,
          field_type: "select",
          field_name:
            btn.name ||
            btn.id ||
            btn.getAttribute("data-automation-id") ||
            null,
          is_standard: false,
        });
      }
    });

    // 3. Process Standard Inputs, Selects, Textareas, and Standalone Radios/Checkboxes
    const elements = document.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="file"]):not([type="button"]), select, textarea',
    );

    elements.forEach((el) => {
      if (handledElements.has(el) || window.GRTS.DOM.isHoneypotOrHidden(el))
        return;
      if (el.type === "password") return;

      const autoId = (
        el.getAttribute("data-automation-id") || ""
      ).toLowerCase();
      const name = (el.name || "").toLowerCase();
      const id = (el.id || "").toLowerCase();
      const autocomplete = (el.autocomplete || "").toLowerCase();
      const rawLabel = window.GRTS.Matcher.getFieldLabel(el);
      const questionLabel = cleanQuestion(rawLabel);
      const labelLower = questionLabel.toLowerCase();

      if (
        autocomplete.includes("password") ||
        name.includes("password") ||
        name.includes("passcode") ||
        name.includes("pwd") ||
        name.includes("token") ||
        name.includes("secret") ||
        name.includes("ssn") ||
        id.includes("password") ||
        id.includes("passcode") ||
        id.includes("pwd") ||
        id.includes("token") ||
        id.includes("secret") ||
        id.includes("ssn") ||
        autoId.includes("password") ||
        autoId.includes("passcode") ||
        labelLower.includes("password") ||
        labelLower.includes("passcode") ||
        labelLower.includes("social security") ||
        labelLower.includes("pin") ||
        labelLower.includes("secret")
      ) {
        return;
      }

      if (!questionLabel || questionLabel.length < 3) return;

      let answerValue = "";
      if (el.type === "checkbox") {
        if (el.checked || el.getAttribute("aria-checked") === "true") {
          answerValue = "Yes";
        } else {
          return;
        }
      } else if (el.type === "radio") {
        if (el.checked || el.getAttribute("aria-checked") === "true") {
          let rLabel = "";
          if (el.id) {
            try {
              const lbl = document.querySelector(
                `label[for="${CSS.escape(el.id)}"]`,
              );
              if (lbl) rLabel = (lbl.innerText || lbl.textContent || "").trim();
            } catch (e) {}
          }
          answerValue = rLabel || el.value || "Yes";
        } else {
          return;
        }
      } else if (el.tagName === "SELECT") {
        if (el.selectedIndex >= 0) {
          const opt = el.options[el.selectedIndex];
          answerValue = opt.text || opt.value || "";
          if (
            answerValue.toLowerCase().includes("select") ||
            answerValue.toLowerCase().includes("choose")
          ) {
            answerValue = "";
          }
        }
      } else {
        answerValue = (el.value || "").trim();
      }

      if (!answerValue) return;

      const normalizedQ = questionLabel.toLowerCase().trim();
      if (seenQuestions.has(normalizedQ)) return;
      seenQuestions.add(normalizedQ);

      const isStandard = [
        "first_name",
        "last_name",
        "full_name",
        "email",
        "phone",
        "linkedin",
        "github",
        "portfolio",
        "address",
        "city",
        "state",
        "postal_code",
        "phone_device_type",
      ].includes(window.GRTS.Matcher.getFieldType(el));

      if (!isStandard) {
        qaPairs.push({
          question_text: questionLabel,
          answer_text: answerValue,
          field_type:
            el.tagName.toLowerCase() === "textarea"
              ? "textarea"
              : el.tagName.toLowerCase() === "select"
                ? "select"
                : el.type || "text",
          field_name:
            el.name || el.id || el.getAttribute("data-automation-id") || null,
          is_standard: false,
        });
      }
    });

    // 4. Merge into Session Storage QA Bank for multi-step persistence
    try {
      const sessionKey = "grts_session_qa_bank";
      const existingRaw = sessionStorage.getItem(sessionKey);
      let merged = existingRaw ? JSON.parse(existingRaw) : [];
      const map = new Map();
      merged.forEach((item) =>
        map.set(item.question_text.toLowerCase().trim(), item),
      );
      qaPairs.forEach((item) =>
        map.set(item.question_text.toLowerCase().trim(), item),
      );
      const fullQaList = Array.from(map.values());
      sessionStorage.setItem(sessionKey, JSON.stringify(fullQaList));
      return fullQaList;
    } catch (e) {
      return qaPairs;
    }
  }

  /**
   * Dynamic observer for multi-step transitions
   */
  function setupDynamicObserver() {
    setTimeout(() => autofillPage(), 800);

    let debounceTimer = null;
    let lastUrl = window.location.href;

    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        stepPasses = 0;
        lastAutofillTime = 0;
        setTimeout(() => autofillPage(), 600);
      }
    }, 800);

    const observer = new MutationObserver((mutations) => {
      if (isAutofilling) return;

      let hasNewPageSection = false;
      for (const m of mutations) {
        if (
          m.target &&
          (m.target.id === "grts-autofill-badge" ||
            m.target.closest?.("#grts-autofill-badge") ||
            m.target.closest?.(
              '[data-automation-id*="promptOption"], [data-automation-id*="menu"], [data-automation-id*="popup"]',
            ))
        ) {
          continue;
        }

        if (m.addedNodes.length > 0) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1) {
              if (
                node.matches?.(
                  '[data-automation-id="application-page"], .page-container, form[data-automation-id*="form"], [data-automation-id*="formSection"]',
                ) ||
                node.querySelector?.(
                  '[data-automation-id="application-page"], .page-container, form',
                )
              ) {
                hasNewPageSection = true;
                break;
              }
            }
          }
        }
        if (hasNewPageSection) break;
      }

      if (hasNewPageSection) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          autofillPage();
        }, window.GRTS.Config.CONSTANTS.DEBOUNCE_DELAY_MS);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  return {
    autofillPage,
    extractCustomQuestionsAndAnswers,
    setupDynamicObserver,
    loadProfile: (force) => window.GRTS.Profile.loadProfile(force),
    parseYamlOrMarkdownResume: (text) =>
      window.GRTS.Profile.parseYamlOrMarkdownResume(text),
  };
})();

// Global backwards compatibility alias for content.js and dashboard.js
window.GRTS_AUTOFILL = window.GRTS.Core;
