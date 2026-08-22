/**
 * GRTS Autofill - DOM Manipulation, Keystroke Simulator, Value Setters & Scoring
 */
window.GRTS = window.GRTS || {};

window.GRTS.DOM = (() => {
    /**
     * Injects CSS for visual field highlighting and PDF attach confirmation
     */
    function injectHighlightStyles() {
        if (document.getElementById('grts-highlight-styles')) return;
        const style = document.createElement('style');
        style.id = 'grts-highlight-styles';
        style.textContent = `
            @keyframes grtsPop {
                0% { background-color: #fde047; transform: scale(1.01); }
                100% { background-color: #fef9c3; transform: scale(1); }
            }
            .grts-filled-field,
            [data-grts-filled="true"],
            input[data-grts-filled="true"],
            textarea[data-grts-filled="true"],
            select[data-grts-filled="true"],
            button[data-grts-filled="true"],
            div[data-grts-filled="true"] {
                background-color: #fef9c3 !important;
                border: 2.5px solid #ca8a04 !important;
                outline: 2px solid rgba(202, 138, 4, 0.45) !important;
                box-shadow: 0 0 0 3.5px rgba(234, 179, 8, 0.3), 0 2px 6px rgba(0, 0, 0, 0.06) !important;
                transition: all 0.2s ease !important;
            }
            .grts-filled-container {
                outline: 2.5px solid #ca8a04 !important;
                background-color: #fefce8 !important;
                border-radius: 6px !important;
                box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.25) !important;
            }
            .grts-filled-field:focus, .grts-filled-field:hover,
            [data-grts-filled="true"]:focus, [data-grts-filled="true"]:hover {
                background-color: #fef08a !important;
                border: 2.5px solid #a16207 !important;
                outline: 3px solid rgba(161, 98, 7, 0.5) !important;
                box-shadow: 0 0 0 4.5px rgba(234, 179, 8, 0.45), 0 3px 8px rgba(0, 0, 0, 0.1) !important;
            }
            .grts-file-badge {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                background: #fefce8;
                border: 1.5px solid #ca8a04;
                color: #854d0e;
                padding: 5px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 700;
                margin-top: 6px;
                box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.2);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Applies persistent canary gold highlighting to element and its surrounding container
     */
    function highlightElement(el) {
        if (!el) return;
        el.dataset.grtsFilled = "true";
        el.classList.add("grts-filled-field");
        try {
            el.style.setProperty("background-color", "#fef9c3", "important");
            el.style.setProperty("border", "2.5px solid #ca8a04", "important");
            el.style.setProperty("outline", "2px solid rgba(202, 138, 4, 0.45)", "important");
        } catch (e) {}

        const wrapper = el.closest('[data-automation-id*="formField"], [data-automation-id*="multiSelect"], [data-automation-id*="inputContainer"], .css-1j0rjec, .form-group, fieldset, label');
        if (wrapper && wrapper !== el) {
            wrapper.dataset.grtsFilled = "true";
            wrapper.classList.add("grts-filled-container");
            try {
                wrapper.style.setProperty("outline", "2.5px solid #ca8a04", "important");
                wrapper.style.setProperty("background-color", "#fefce8", "important");
                wrapper.style.setProperty("border-radius", "6px", "important");
            } catch (e) {}
        }
    }

    /**
     * Checks if an element is a honeypot, hidden anti-bot trap, or invisible
     */
    function isHoneypotOrHidden(el) {
        if (!el) return true;
        const autoId = (el.getAttribute('data-automation-id') || '').toLowerCase();
        const name = (el.name || '').toLowerCase();
        const id = (el.id || '').toLowerCase();

        if (autoId.includes('beecatcher') || autoId.includes('honeypot') || name.includes('beecatcher') || id.includes('beecatcher')) {
            return true;
        }

        if (el.type === 'hidden') return true;

        // Radios and Checkboxes often have opacity:0 in custom frameworks (e.g. Workday Canvas Kit, Material, Tailwind)
        if (el.type === 'radio' || el.type === 'checkbox') {
            try {
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden') {
                    return true;
                }
            } catch (e) {}
            return false;
        }

        if (el.getAttribute('aria-hidden') === 'true' && el.tabIndex === -1) return true;

        try {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                return true;
            }
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return true;
        } catch (e) {}

        return false;
    }

    /**
     * Checks if current page/modal is a Login / Create Account screen
     */
    function isLoginOrAuthScreen() {
        const bodyText = (document.body.innerText || '').toLowerCase();
        const hasSignInHeading = Array.from(document.querySelectorAll('h1, h2, h3, button')).some(el => {
            const txt = (el.innerText || '').toLowerCase();
            return txt.includes('sign in') || txt.includes('log in') || txt.includes('create an account') || txt.includes('create account');
        });

        const pwInput = document.querySelector('input[type="password"]');
        const formAction = Array.from(document.querySelectorAll('form')).some(f => {
            const act = (f.action || '').toLowerCase();
            return act.includes('login') || act.includes('auth') || act.includes('signin');
        });

        return pwInput !== null && (hasSignInHeading || formAction);
    }

    /**
     * Dispatches proper React/Angular synthetic input events, value tracker bypass, and applies visual highlight
     */
    function setInputValue(el, value, forceOverwrite = false) {
        if (!el || value === undefined || value === null || value === "") return false;

        const strVal = String(value);

        try {
            const currentVal = (el.value || "").trim();
            const isBlank = !currentVal || currentVal === "" || currentVal === "--" || currentVal === "Select" || currentVal === "MM" || currentVal === "YYYY" || currentVal === "Prompt";
            if (!isBlank && !forceOverwrite && currentVal !== strVal) {
                return false;
            }

            el.focus();

            const isInput = el instanceof HTMLInputElement || el.tagName === 'INPUT';
            const isTextArea = el instanceof HTMLTextAreaElement || el.tagName === 'TEXTAREA';

            if (isInput) {
                const proto = window.HTMLInputElement.prototype;
                const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
                if (descriptor && descriptor.set) {
                    descriptor.set.call(el, strVal);
                } else {
                    el.value = strVal;
                }
            } else if (isTextArea) {
                const proto = window.HTMLTextAreaElement.prototype;
                const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
                if (descriptor && descriptor.set) {
                    descriptor.set.call(el, strVal);
                } else {
                    el.value = strVal;
                }
            } else {
                el.value = strVal;
            }

            el.setAttribute('value', strVal);
            if (el.getAttribute('role') === 'spinbutton') {
                el.setAttribute('aria-valuenow', strVal);
            }

            // React 16+ valueTracker bypass
            const tracker = el._valueTracker;
            if (tracker) {
                tracker.setValue("");
            }

            // Dispatch full synthetic event cascade
            try {
                el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: strVal }));
            } catch (e) {}
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.blur();

            highlightElement(el);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Simulates genuine character-by-character user keystrokes into Workday search inputs
     */
    async function typeTextIntoWorkdaySearch(inputEl, queryText) {
        if (!inputEl || !queryText) return;
        inputEl.focus();
        inputEl.value = "";
        if (inputEl._valueTracker) inputEl._valueTracker.setValue("");

        for (let i = 0; i < queryText.length; i++) {
            const char = queryText[i];
            const currentStr = queryText.slice(0, i + 1);

            inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: char, code: `Key${char.toUpperCase()}`, bubbles: true, cancelable: true }));
            inputEl.dispatchEvent(new KeyboardEvent('keypress', { key: char, code: `Key${char.toUpperCase()}`, bubbles: true, cancelable: true }));

            const proto = window.HTMLInputElement.prototype;
            const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
            if (descriptor && descriptor.set) {
                descriptor.set.call(inputEl, currentStr);
            } else {
                inputEl.value = currentStr;
            }

            try {
                inputEl.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: char }));
            } catch (e) {
                inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            }

            inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: char, code: `Key${char.toUpperCase()}`, bubbles: true, cancelable: true }));
            await new Promise(r => setTimeout(r, 20));
        }

        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Calculates precision match score between an option's text and search query
     */
    function scoreOptionMatch(optText, queryText) {
        if (!optText || !queryText) return 0;
        const o = String(optText).toLowerCase().trim();
        const q = String(queryText).toLowerCase().trim();

        if (o === q) return 1000;

        try {
            const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i').test(o)) {
                return 800;
            }
        } catch (e) {}

        if (o.startsWith(q)) return 600;

        const qTokens = q.split(/\s+/).filter(t => t.length > 2);
        if (qTokens.length > 0) {
            const allPresent = qTokens.every(tok => o.includes(tok));
            if (allPresent) {
                const penalty = Math.max(0, o.length - q.length);
                return Math.max(300, 500 - penalty);
            }
        }

        if (o.includes(q)) {
            const penalty = Math.max(0, o.length - q.length);
            return Math.max(100, 400 - penalty);
        }

        return 0;
    }

    /**
     * Selects option in HTML <select> element using exact and substring matching
     */
    function setSelectValueFuzzy(selectEl, targetValue) {
        if (!selectEl || !targetValue || selectEl.options.length === 0) return false;

        const currentIdx = selectEl.selectedIndex;
        if (currentIdx > 0 && selectEl.options[currentIdx] && !selectEl.options[currentIdx].text.toLowerCase().includes('select') && !selectEl.options[currentIdx].text.toLowerCase().includes('prompt')) {
            highlightElement(selectEl);
            return false;
        }

        const target = targetValue.toLowerCase().trim();
        const targetTokens = target.split(/[\s,/-]+/).filter(t => t.length > 2);

        let bestIndex = -1;
        let bestScore = 0;

        for (let i = 0; i < selectEl.options.length; i++) {
            const opt = selectEl.options[i];
            const text = (opt.text || opt.innerText || "").toLowerCase().trim();
            const val = (opt.value || "").toLowerCase().trim();

            if (!text && !val) continue;

            if (text === target || val === target) {
                bestIndex = i;
                bestScore = 100;
                break;
            }

            if (text.includes(target) || (target.length > 3 && target.includes(text))) {
                if (bestScore < 80) {
                    bestIndex = i;
                    bestScore = 80;
                }
            }

            let tokenMatches = 0;
            for (const tok of targetTokens) {
                if (text.includes(tok) || val.includes(tok)) tokenMatches++;
            }
            const tokenScore = (tokenMatches / Math.max(targetTokens.length, 1)) * 60;
            if (tokenScore > bestScore && tokenScore >= 40) {
                bestIndex = i;
                bestScore = tokenScore;
            }
        }

        if (bestIndex >= 0) {
            if (selectEl.selectedIndex === bestIndex) {
                highlightElement(selectEl);
                return false;
            }
            selectEl.selectedIndex = bestIndex;
            highlightElement(selectEl);
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            selectEl.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }

        return false;
    }

    /**
     * Checks/unchecks checkbox matching target state
     * Triggers clean React synthetic state updates and ensures the checkmark SVG is rendered.
     */
    function setCheckbox(checkboxEl, shouldCheck = true) {
        if (!checkboxEl) return false;

        // If already in target state, mark and return
        if (checkboxEl.checked === shouldCheck && checkboxEl.getAttribute('aria-checked') === (shouldCheck ? 'true' : 'false')) {
            checkboxEl.dataset.grtsFilled = "true";
            highlightElement(checkboxEl);
            return true;
        }

        try {
            checkboxEl.focus();

            // Method A: If unchecked, simulate a clean single click which naturally updates React Canvas Kit and renders the SVG checkmark
            if (checkboxEl.checked !== shouldCheck) {
                checkboxEl.click();
            }

            // Method B: If click didn't toggle it (e.g. detached or styled hidden), apply descriptor + change cascade
            if (checkboxEl.checked !== shouldCheck) {
                const proto = window.HTMLInputElement.prototype;
                const descriptor = Object.getOwnPropertyDescriptor(proto, 'checked');
                if (descriptor && descriptor.set) {
                    descriptor.set.call(checkboxEl, shouldCheck);
                } else {
                    checkboxEl.checked = shouldCheck;
                }

                if (checkboxEl._valueTracker) {
                    checkboxEl._valueTracker.setValue(!shouldCheck);
                }

                checkboxEl.dispatchEvent(new Event('input', { bubbles: true }));
                checkboxEl.dispatchEvent(new Event('change', { bubbles: true }));
            }

            checkboxEl.setAttribute('aria-checked', shouldCheck ? 'true' : 'false');
            if (shouldCheck) checkboxEl.setAttribute('checked', 'checked');
            else checkboxEl.removeAttribute('checked');

            checkboxEl.dataset.grtsFilled = "true";
            highlightElement(checkboxEl);

            const parentContainer = checkboxEl.closest('label, div[data-automation-id*="checkbox"], div[data-automation-id*="Checkbox"], div[class*="checkbox"], .css-d3pjdr, fieldset');
            if (parentContainer) {
                parentContainer.dataset.grtsFilled = "true";
                highlightElement(parentContainer);
            }

            return true;
        } catch (e) {
            console.error("[GRTS] Error setting checkbox:", e);
            return false;
        }
    }

    /**
     * Checks radio button matching label or value
     * Supports React prototype descriptor bypass and dispatches pointer/mouse click cascades to labels and Workday wrapper divs.
     */
    function checkRadio(radioGroup, targetOption) {
        if (!radioGroup || radioGroup.length === 0 || !targetOption) return false;
        const target = targetOption.toLowerCase().trim();

        const targetStartsNo = target.startsWith("no") || target === "0" || target === "false" || target.includes("do not have") || target.includes("don't have") || target.includes("no disability");
        const targetStartsYes = (target.startsWith("yes") || target === "1" || target === "true" || target.includes("have a disability")) && !targetStartsNo;
        const targetDecline = target.includes("decline") || target.includes("prefer not") || target.includes("do not wish") || target.includes("not to disclose") || target.includes("not wish to answer");

        for (const radio of radioGroup) {
            const val = (radio.value || "").toLowerCase().trim();
            let optLabel = "";
            if (radio.id) {
                try {
                    const explicitLbl = document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
                    if (explicitLbl) optLabel = (explicitLbl.innerText || "").toLowerCase().trim();
                } catch (e) {}
            }
            if (!optLabel) {
                const parentLbl = radio.closest('label');
                if (parentLbl) optLabel = (parentLbl.innerText || "").toLowerCase().trim();
            }

            const optStartsNo = optLabel.startsWith("no") || val === "0" || val === "no" || val === "false" || optLabel.includes("do not have") || optLabel.includes("don't have") || optLabel.includes("no disability");
            const optStartsYes = (optLabel.startsWith("yes") || val === "1" || val === "yes" || val === "true") && !optStartsNo;
            const optDecline = optLabel.includes("decline") || optLabel.includes("prefer not") || optLabel.includes("do not wish") || optLabel.includes("not to disclose") || optLabel.includes("not wish to answer");

            let isMatch = false;
            if (targetStartsNo && optStartsNo) isMatch = true;
            else if (targetStartsYes && optStartsYes) isMatch = true;
            else if (targetDecline && optDecline) isMatch = true;
            else if (val === target || (optLabel && optLabel === target)) isMatch = true;

            if (isMatch) {
                try {
                    radio.focus();

                    // 1. React 16+ prototype descriptor bypass
                    const proto = window.HTMLInputElement.prototype;
                    const descriptor = Object.getOwnPropertyDescriptor(proto, 'checked');
                    if (descriptor && descriptor.set) {
                        descriptor.set.call(radio, true);
                    } else {
                        radio.checked = true;
                    }

                    radio.setAttribute('checked', 'checked');
                    radio.setAttribute('aria-checked', 'true');

                    if (radio._valueTracker) {
                        radio._valueTracker.setValue(false);
                    }

                    radio.dispatchEvent(new Event('input', { bubbles: true }));
                    radio.dispatchEvent(new Event('change', { bubbles: true }));

                    // Uncheck other radios in group
                    for (const other of radioGroup) {
                        if (other !== radio) {
                            if (descriptor && descriptor.set) {
                                descriptor.set.call(other, false);
                            } else {
                                other.checked = false;
                            }
                            other.removeAttribute('checked');
                            other.setAttribute('aria-checked', 'false');
                        }
                    }

                    // 2. Dispatch click/pointer events on the label or radio
                    const explicitLabel = radio.id ? document.querySelector(`label[for="${CSS.escape(radio.id)}"]`) : null;
                    const clickTarget = explicitLabel || radio;
                    try {
                        clickTarget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
                        clickTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                        clickTarget.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
                        clickTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                        clickTarget.click();
                    } catch (e) {}

                    // 3. Guarantee checked state
                    if (!radio.checked) {
                        if (descriptor && descriptor.set) descriptor.set.call(radio, true);
                        else radio.checked = true;
                        radio.setAttribute('aria-checked', 'true');
                        radio.dispatchEvent(new Event('change', { bubbles: true }));
                    }

                    radio.dataset.grtsFilled = "true";
                    highlightElement(radio);

                    const groupContainer = radio.closest('[data-automation-id*="formField"], [id*="previousWorker"], div[class*="css-36bfwz"], fieldset, form');
                    if (groupContainer) {
                        groupContainer.dataset.grtsFilled = "true";
                        highlightElement(groupContainer);
                    }

                    return true;
                } catch (e) {
                    console.error("[GRTS] Error checking radio button:", e);
                    return false;
                }
            }
        }
        return false;
    }

    /**
     * Parse date string into 2-digit month and 4-digit year
     */
    function parseDateTokens(dateStr) {
        if (!dateStr) return { month: "", year: "" };
        const clean = String(dateStr).trim().replace(/[^\w\s/-]/g, '');

        let m = clean.match(/^(\d{4})[-/](\d{1,2})$/);
        if (m) return { year: m[1], month: m[2].padStart(2, '0') };

        m = clean.match(/^(\d{1,2})[-/](\d{4})$/);
        if (m) return { year: m[2], month: m[1].padStart(2, '0') };

        m = clean.match(/^(\d{2})(\d{4})$/);
        if (m) {
            const monNum = parseInt(m[1], 10);
            if (monNum >= 1 && monNum <= 12) {
                return { year: m[2], month: m[1] };
            }
        }

        m = clean.match(/^(\d{4})(\d{2})$/);
        if (m) {
            const monNum = parseInt(m[2], 10);
            if (monNum >= 1 && monNum <= 12) {
                return { year: m[1], month: m[2] };
            }
        }

        const monthNames = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
        m = clean.match(/([a-zA-Z]{3,9})\.?\s*(\d{4})/i);
        if (m) {
            const monKey = m[1].toLowerCase().slice(0, 3);
            return { year: m[2], month: monthNames[monKey] || "01" };
        }

        m = clean.match(/\b(\d{4})\b/);
        if (m) return { year: m[1], month: "01" };

        return { month: "", year: "" };
    }

    /**
     * Parse date range string
     */
    function parseDateRange(rangeStr) {
        if (!rangeStr) return { start: { month: "05", year: "2026" }, end: { month: "08", year: "2026" } };
        const parts = rangeStr.split(/[-–—to]+/i);
        const start = parseDateTokens(parts[0] || "");
        const end = parseDateTokens(parts[1] || parts[0] || "");
        return {
            start: { month: start.month || "05", year: start.year || "2026" },
            end: { month: end.month || "08", year: end.year || "2026" }
        };
    }

    return {
        injectHighlightStyles,
        highlightElement,
        isHoneypotOrHidden,
        isLoginOrAuthScreen,
        setInputValue,
        typeTextIntoWorkdaySearch,
        scoreOptionMatch,
        setSelectValueFuzzy,
        setCheckbox,
        checkRadio,
        parseDateTokens,
        parseDateRange
    };
})();
