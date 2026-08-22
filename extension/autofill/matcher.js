/**
 * GRTS Autofill - Semantic Field Classifier & Label Extractor
 */
window.GRTS = window.GRTS || {};

window.GRTS.Matcher = (() => {
    function splitWords(str) {
        if (!str) return "";
        return String(str)
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/[-_.:]+/g, ' ')
            .replace(/\s+/g, ' ')
            .toLowerCase()
            .trim();
    }

    /**
     * Retrieves label text associated with an input element
     */
    function getFieldLabel(el) {
        if (!el) return "";
        let labelText = "";
        let isOptionChoice = false;

        // 1. Explicit <label for="id">
        if (el.id) {
            try {
                const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
                if (label) {
                    const txt = (label.innerText || "").trim();
                    const txtLower = txt.toLowerCase();
                    if (txtLower === 'yes' || txtLower === 'no' || txtLower === 'true' || txtLower === 'false' || txtLower === 'agree' || txtLower === 'decline') {
                        isOptionChoice = true;
                    }
                    labelText = txt;
                }
            } catch (e) {}
        }

        // 2. Fieldset legend or questionnaire question container (Append question context to option label)
        if (!labelText || el.type === 'radio' || el.type === 'checkbox') {
            const fieldset = el.closest('fieldset');
            if (fieldset) {
                const legend = fieldset.querySelector('legend');
                if (legend) {
                    const lText = (legend.innerText || "").trim();
                    labelText = labelText ? `${labelText} ${lText}` : lText;
                }
            }
        }

        if (!labelText || el.type === 'radio' || el.type === 'checkbox') {
            const parentContainer = el.closest('[data-automation-id*="formField"], [data-fkit-id*="Questionnaire"], [data-automation-id*="question"], [data-automation-id*="formItem"], [data-automation-id*="form-group"], [id*="previousWorker"], div[class*="css-36bfwz"], .field, .form-group, div[class*="question"]');
            if (parentContainer) {
                const labelEl = parentContainer.querySelector('[data-automation-id="richText"], [data-automation-id*="questionLabel"], [data-automation-id*="Label"], legend, h3, h4, h5, p');
                if (labelEl && labelEl !== el) {
                    const pText = (labelEl.innerText || "").trim();
                    labelText = labelText ? `${labelText} ${pText}` : pText;
                }
            }
        }

        // 3. aria-labelledby on element or parent container (supports space-delimited multiple IDs)
        const labeledParent = el.getAttribute('aria-labelledby') ? el : el.closest('[aria-labelledby]');
        if (labeledParent) {
            try {
                const ids = labeledParent.getAttribute('aria-labelledby').split(/\s+/);
                const texts = ids.map(id => document.getElementById(id)?.innerText).filter(Boolean);
                if (texts.length > 0) {
                    const alText = texts.join(' ').trim();
                    labelText = labelText ? `${labelText} ${alText}` : alText;
                }
            } catch (e) {}
        }

        // 4. aria-label (ONLY if not a generic placeholder like "Select One", "Required")
        if (!labelText && el.getAttribute('aria-label')) {
            const aria = el.getAttribute('aria-label').trim();
            const ariaLower = aria.toLowerCase();
            if (ariaLower !== 'select one' && ariaLower !== 'select one required' && ariaLower !== 'prompt' && ariaLower !== 'required' && ariaLower !== 'choose one') {
                labelText = aria;
            }
        }

        // 5. Parent label
        if (!labelText) {
            const parentLabel = el.closest('label');
            if (parentLabel) labelText = parentLabel.innerText;
        }

        if (!labelText) {
            labelText = el.getAttribute('data-automation-id') || el.placeholder || el.name || "";
        }

        return labelText.replace(/[*:\n\r]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    /**
     * Semantic Matching Matrix across 37+ categories with strict precedence rules
     */
    function getFieldType(el) {
        const id = (el.id || "").toLowerCase();
        const name = (el.name || "").toLowerCase();
        const placeholder = (el.placeholder || "").toLowerCase();
        const autoId = (el.getAttribute('data-automation-id') || "").toLowerCase();
        const label = getFieldLabel(el).toLowerCase();
        const autocomplete = (el.autocomplete || "").toLowerCase();
        const className = (el.className || "").toLowerCase();

        const container = el.closest('[id*="--"], [id*="previousWorker"], [data-automation-id*="formField"], [data-automation-id*="question"], [data-fkit-id], div[class*="css-36bfwz"], fieldset');
        const containerId = (container?.id || "").toLowerCase();
        const containerName = (container?.getAttribute('name') || "").toLowerCase();
        const containerAuto = (container?.getAttribute('data-automation-id') || "").toLowerCase();

        const wordsId = splitWords(id);
        const wordsName = splitWords(name);
        const wordsAutoId = splitWords(autoId);
        const wordsContainerId = splitWords(containerId);
        const wordsContainerName = splitWords(containerName);
        const wordsContainerAuto = splitWords(containerAuto);

        const combined = `${id} ${wordsId} ${name} ${wordsName} ${placeholder} ${autoId} ${wordsAutoId} ${containerId} ${wordsContainerId} ${containerName} ${wordsContainerName} ${containerAuto} ${wordsContainerAuto} ${label} ${autocomplete} ${className}`;

        // 0. Website / Portfolio / URLs (TOP PRIORITY - NEVER MATCH AS CITY OR LOCATION)
        if (
            id.startsWith('websites-') || autoId.includes('website') || id.includes('website') || name.includes('website') ||
            autoId.includes('portfolio') || id.includes('portfolio') || name.includes('portfolio') || name.includes('urls[portfolio]') ||
            autoId.includes('formfield-url') || autoId.includes('formfield-website') ||
            (/\b(portfolio|website|personal\s*site|personal\s*website|blog|web\s*address|url)\b/.test(combined) && !id.includes('location') && !name.includes('location'))
        ) {
            return 'portfolio';
        }

        // 1. First Name
        if (
            id.includes('legalname--firstname') || name.includes('legalname--firstname') ||
            autoId.includes('legalname--firstname') || autoId.includes('legalnamesection_firstname') ||
            id.includes('firstname') || name.includes('firstname') ||
            autocomplete === 'given-name' || id === 'first_name' || name === 'first_name' || id === 'fname' ||
            /\b(first\s*name|given\s*name|fname|legal\s*first\s*name)\b/.test(combined)
        ) {
            if (!combined.includes('last') || id.includes('firstname') || name.includes('firstname')) return 'first_name';
        }

        // 2. Last Name
        if (
            id.includes('legalname--lastname') || name.includes('legalname--lastname') ||
            autoId.includes('legalname--lastname') || autoId.includes('legalnamesection_lastname') ||
            id.includes('lastname') || name.includes('lastname') ||
            autocomplete === 'family-name' || id === 'last_name' || name === 'last_name' || id === 'lname' ||
            /\b(last\s*name|family\s*name|surname|lname|legal\s*last\s*name)\b/.test(combined)
        ) {
            return 'last_name';
        }

        // 3. Full Name
        if (
            id.includes('selfidentifieddisabilitydata--name') ||
            (combined.includes('disability') && (id.includes('name') || name.includes('name'))) ||
            autocomplete === 'name' || name === 'name' || id === 'name' ||
            /\b(full\s*name|candidate\s*name|your\s*name)\b/.test(combined)
        ) {
            if (!combined.includes('first') && !combined.includes('last') && !combined.includes('company') && !combined.includes('school')) {
                return 'full_name';
            }
        }

        // 3b. Employee ID (Optional internal field, skip for external candidates)
        if (id.includes('employeeid') || name.includes('employeeid') || autoId.includes('employeeid') || id.includes('workerid')) {
            return 'employee_id';
        }

        // 4. Email
        if (
            el.type === 'email' || autocomplete === 'email' ||
            autoId.includes('email') || id.includes('email') || name.includes('email') ||
            /\b(email|e-mail|email\s*address)\b/.test(combined)
        ) {
            return 'email';
        }

        // 5. Phone Device Type
        if (autoId.includes('phone-device-type') || autoId.includes('phonetype') || /\b(phone\s*device\s*type|phone\s*type|device\s*type)\b/.test(combined)) {
            return 'phone_device_type';
        }

        // 6. Phone Extension (Must precede Phone Number)
        if (
            autoId.includes('extension') || name.includes('extension') || id.includes('extension') ||
            /\b(phone\s*extension|extension|ext)\b/.test(combined)
        ) {
            return 'phone_extension';
        }

        // 7. Phone Number
        if (
            el.type === 'tel' || autocomplete === 'tel' ||
            autoId.includes('phone-number') || autoId.includes('phonenumber') || id === 'phone' || name === 'phone' ||
            (/\b(phone|mobile|cell|telephone|contact\s*number)\b/.test(combined) && !combined.includes('type') && !combined.includes('extension') && !combined.includes('ext'))
        ) {
            return 'phone';
        }

        // 8. How Did You Hear About Us?
        if (
            autoId.includes('sourcedropdown') || autoId.includes('sourceprompt') || autoId.includes('source') ||
            /\b(how\s*did\s*you\s*hear|how\s*did\s*we\s*meet|referral\s*source)\b/.test(combined) ||
            /\b(source)\b/.test(label)
        ) {
            return 'how_heard';
        }

        // 9. Age 18+ question
        if (/\b(18\s*years\s*of\s*age|18\s*or\s*older|at\s*least\s*18)\b/.test(combined)) {
            return 'age_18_or_older';
        }

        // 10. Confidentiality / Non-compete clause
        if (/\b(confidentiality\s*obligation|non-compete|contractual\s*obligation)\b/.test(combined)) {
            return 'non_compete_obligation';
        }

        // 11. Previous Worker / Former Employee / Contractor
        if (
            autoId.includes('previousworker') || id.includes('previousworker') || name.includes('previousworker') || containerId.includes('previousworker') || containerName.includes('previousworker') ||
            autoId.includes('candidateispreviousworker') || id.includes('candidateispreviousworker') || name.includes('candidateispreviousworker') || containerId.includes('candidateispreviousworker') || containerName.includes('candidateispreviousworker') ||
            /\b(previous\s*worker|previous\s*employee|former\s*employee|former\s*worker|prior\s*employee|prior\s*worker|past\s*employee|past\s*worker|previously\s*employed|previously\s*worked|worked\s*(for|at|with|in|before)|ever\s*worked|ever\s*been\s*employed|employed\s*(by|at|with|for)|contractor\s*(for|at|with|in)|rehire|re-hire|previousworker|formerworker|priorworker)\b/i.test(combined)
        ) {
            return 'previous_worker';
        }

        // 12. Class / Year
        if (/\b(current\s*class|class\s*year|academic\s*standing|year\s*in\s*school)\b/.test(combined)) {
            return 'class_year';
        }

        // 13. Enrolled in degree program / Return to school
        if (/\b(enrolled\s*in\s*an\s*undergraduate|return\s*to\s*school\s*after)\b/.test(combined)) {
            return 'enrolled_in_program';
        }

        // 14. Open to Relocation
        if (/\b(open\s*to\s*relocation|willing\s*to\s*relocate|relocate)\b/.test(combined)) {
            return 'open_to_relocation';
        }

        // 15. Street Address (Address Line 1)
        if (
            autocomplete === 'street-address' || autocomplete === 'address-line1' ||
            autoId.includes('addresssection_addressline1') || autoId.includes('addressline1') ||
            id === 'addr' || id === 'address' || id === 'address1' || id === 'addressline1' ||
            name === 'address' || name === 'address1' || name === 'addressline1' ||
            /\b(street\s*address|address\s*line\s*1|address\s*1|home\s*address)\b/.test(label) ||
            /\b(street\s*address|address\s*line\s*1|address\s*1)\b/.test(combined)
        ) {
            return 'address';
        }

        // 15b. Address Line 2
        if (
            autocomplete === 'address-line2' ||
            autoId.includes('addresssection_addressline2') || autoId.includes('addressline2') ||
            id === 'address2' || id === 'addressline2' || name === 'address2' || name === 'addressline2' ||
            /\b(address\s*line\s*2|address\s*2|apt|suite|unit)\b/.test(label) ||
            /\b(address\s*line\s*2|address\s*2)\b/.test(combined)
        ) {
            return 'address_line_2';
        }

        // 16. City
        if (
            autoId.includes('addresssection_city') || id === 'city' || name === 'city' ||
            autocomplete === 'address-level2' ||
            (/\b(city|town|municipality)\b/.test(label) && !label.includes('address') && !label.includes('state') && !label.includes('postal') && !label.includes('zip')) ||
            (/\b(city|town|municipality)\b/.test(combined) && !combined.includes('addressline') && !combined.includes('postal') && !combined.includes('zip'))
        ) {
            return 'city';
        }

        // 17. State / Province
        if (
            autocomplete === 'address-level1' ||
            autoId.includes('addresssection_countryregion') || autoId.includes('countryregion') ||
            id === 'state' || name === 'state' || name === 'region' ||
            /\b(state|province|region)\b/.test(combined)
        ) {
            return 'state';
        }

        // 18. Postal / Zip Code
        if (
            autocomplete === 'postal-code' ||
            autoId.includes('addresssection_postalcode') || autoId.includes('postalcode') ||
            id === 'postal' || id === 'zip' || name === 'postal' || name === 'zip' ||
            /\b(postal\s*code|zip\s*code|zip)\b/.test(combined)
        ) {
            return 'postal_code';
        }

        // 19. General Location / Experience Location
        if (id.includes('location') || name.includes('location') || autoId.includes('location') || autoId.includes('jobapplicationlocation')) {
            if (id.includes('workexperience') || id.includes('experience') || autoId.includes('workexperience') || combined.includes('employer')) {
                return 'current_location';
            }
            if (!combined.includes('city') && !combined.includes('job_location')) return 'general_location';
        }

        // 20. LinkedIn URL
        if (autoId.includes('linkedin') || name.includes('linkedin') || id.includes('linkedin') || combined.includes('linkedin')) {
            return 'linkedin';
        }

        // 21. GitHub URL
        if (autoId.includes('github') || name.includes('github') || id.includes('github') || combined.includes('github')) {
            return 'github';
        }

        // 22. Portfolio / Website
        if (
            (autoId.includes('website') || id.includes('website') || name.includes('website') ||
             autoId.includes('portfolio') || id.includes('portfolio') || name.includes('portfolio') || name.includes('urls[portfolio]') ||
             /\b(portfolio|website|personal\s*site|personal\s*website|blog|web\s*address|url)\b/.test(combined)) &&
            !autoId.includes('beecatcher')
        ) {
            if (!combined.includes('linkedin') && !combined.includes('github')) return 'portfolio';
        }

        // 23. Skills / Technologies (Never match date)
        if (
            autoId.includes('skill') || name.includes('skill') || id.includes('skill') ||
            /\b(skills|technical\s*skills|programming\s*languages|technologies|tools)\b/.test(combined)
        ) {
            return 'skills';
        }

        // 24. Sponsorship Requirement / Employer Support (HIGHEST PRECEDENCE over general authorization)
        if (/\b(require\s*employer\s*support|employer\s*support|obtain\s*or\s*maintain|require\s*sponsorship|need\s*sponsorship|visa\s*sponsorship|future\s*sponsorship|work\s*permit|sponsorship\s*now\s*or\s*in\s*the\s*future|require\s*visa|h1b|h-1b|employment\s*visa\s*status)\b/.test(combined)) {
            return 'require_sponsorship';
        }

        // 25. Work Authorization
        if (/\b(authorized\s*to\s*work|legal\s*right\s*to\s*work|legally\s*authorized|eligible\s*to\s*work|authorization\s*to\s*work)\b/.test(combined)) {
            return 'work_authorized_us';
        }

        // 26. Student Visa (F1, M1, J1)
        if (/\b(student\s*exchange|visitor\s*visa|f1|m1|j1)\b/.test(combined)) {
            return 'student_visa';
        }

        // 27. CPT / OPT Authorization
        if (/\b(curricular\s*practical\s*training|optional\s*practical\s*training|cpt|opt)\b/.test(combined)) {
            return 'require_cpt_opt';
        }

        // 28. Scholarship Recipient
        if (/\b(scholarship\s*recipient|scholarship)\b/.test(combined)) {
            return 'scholarship_recipient';
        }

        // 29. AI Recruiting Consent
        if (/\b(ai\s*recruiting|ai-based\s*tools|artificial\s*intelligence|consent\s*to\s*the\s*use\s*of\s*ai)\b/.test(combined)) {
            return 'ai_consent';
        }

        // 30. Terms and Conditions / Consent Checkbox / Agreements
        if (
            autoId.includes('terms') || autoId.includes('agreement') || autoId.includes('consent') || autoId.includes('policy') ||
            id.includes('terms') || id.includes('agreement') || id.includes('consent') || id.includes('policy') ||
            name.includes('terms') || name.includes('agreement') || name.includes('consent') || name.includes('policy') ||
            /\b(terms\s*and\s*conditions|consent\s*to\s*the\s*terms|privacy\s*policy|agree\s*to\s*terms|accept\s*terms|accept\s*terms\s*and\s*agreements|termsandconditions|acceptterms|i\s*consent|i\s*agree|acknowledge|acknowledgement)\b/i.test(combined)
        ) {
            if (!combined.includes('preferred') && !id.includes('preferred') && !name.includes('preferred') && !label.includes('preferred')) {
                return 'terms_consent';
            }
        }

        // 31. Disability Form Date
        if (autoId.includes('disability') && (combined.includes('date') || el.type === 'date')) {
            return 'today_date';
        }

        // 32. Disability Self-Identification
        if (/\b(disability|handicap|physical\s*or\s*mental\s*impairment)\b/.test(combined)) {
            return 'disability_status';
        }

        // 33. Work Experience Sub-Fields
        if (autoId.includes('currentlyworkhere') || id.includes('currentlyworkhere') || /\b(currently\s*work\s*here|current\s*job|present)\b/.test(combined)) {
            return 'currently_work_here';
        }
        if (autoId.includes('jobtitle') || id.includes('jobtitle') || name.includes('jobtitle') || (combined.includes('job') && combined.includes('title')) || combined.includes('headline')) {
            return 'current_title';
        }
        if (autoId.includes('company') || id.includes('company') || name.includes('company') || name === 'org' || id === 'org' || combined.includes('employer')) {
            return 'current_company';
        }
        if ((autoId.includes('startdate') || combined.includes('from') || combined.includes('start date')) && !combined.includes('skill')) {
            return 'date_from';
        }
        if ((autoId.includes('enddate') || combined.includes('to') || combined.includes('end date') || combined.includes('anticipated graduation')) && !combined.includes('skill')) {
            return 'date_to';
        }
        if (autoId.includes('roledescription') || id.includes('roledescription') || autoId.includes('jobdescription') || combined.includes('duties') || combined.includes('responsibilities')) {
            return 'experience_description';
        }

        // 34. Education Sub-Fields (GPA must precede discipline)
        if (autoId.includes('school') || id.includes('school') || name.includes('school') || autoId.includes('university') || /\b(school|university|college|institution|alma\s*mater)\b/.test(combined)) {
            return 'school';
        }
        if (autoId.includes('degree') || id.includes('degree') || name.includes('degree') || /\b(degree|degree\s*type|level\s*of\s*education)\b/.test(combined)) {
            return 'degree';
        }
        if (autoId.includes('gpa') || autoId.includes('gradeaverage') || id.includes('gradeaverage') || name.includes('gradeaverage') || /\b(gpa|overall\s*gpa|grade\s*point\s*average|cumulative\s*gpa|grade\s*average|overall\s*result)\b/.test(combined)) {
            return 'gpa';
        }
        if (autoId.includes('fieldofstudy') || id.includes('fieldofstudy') || name.includes('fieldofstudy') || autoId.includes('major') || /\b(major|field\s*of\s*study|discipline|program\s*of\s*study)\b/.test(combined)) {
            return 'discipline';
        }

        // 35. EEO / Demographics
        if (/\b(hispanic|latino)\b/.test(combined)) return 'hispanic_latino';
        if (/\b(gender|sex)\b/.test(combined)) return 'gender';
        if (/\b(veteran|military)\b/.test(combined)) return 'veteran_status';
        if (/\b(ethnicity|race)\b/.test(combined)) return 'race_ethnicity';

        // 36. Desired Salary
        if (/\b(desired\s*salary|expected\s*salary|target\s*compensation|salary\s*expectation)\b/.test(combined)) {
            return 'desired_salary';
        }

        // 37. Notice Period
        if (/\b(notice\s*period|start\s*date|earliest\s*start|availability)\b/.test(combined)) {
            return 'notice_period';
        }

        return 'custom';
    }

    return {
        getFieldLabel,
        getFieldType
    };
})();
