/**
 * GRTS Autofill - Greenhouse ATS Adapter
 * Handles Greenhouse-specific custom field formats, EEO demography selects, and multi-entry sections.
 */
window.GRTS = window.GRTS || {};
window.GRTS.Adapters = window.GRTS.Adapters || {};

window.GRTS.Adapters.Greenhouse = (() => {
    /**
     * Fills Greenhouse-specific custom questions and application controls
     */
    async function fillGreenhouseFields(profile) {
        let count = 0;
        if (!profile) return 0;

        const isGreenhouse = window.location.hostname.includes('greenhouse.io') || document.querySelector('#application_form, #apply_form, .greenhouse-form');
        if (!isGreenhouse) return 0;

        // 1. Demographic Dropdowns on Greenhouse
        const genderSelect = document.querySelector('select[id*="gender"], select[name*="gender"]');
        if (genderSelect && profile.gender) {
            if (window.GRTS.DOM.setSelectValueFuzzy(genderSelect, profile.gender)) count++;
        }

        const raceSelect = document.querySelector('select[id*="race"], select[name*="race"], select[id*="ethnicity"]');
        if (raceSelect && profile.race_ethnicity) {
            if (window.GRTS.DOM.setSelectValueFuzzy(raceSelect, profile.race_ethnicity)) count++;
        }

        const vetSelect = document.querySelector('select[id*="veteran"], select[name*="veteran"]');
        if (vetSelect && profile.veteran_status) {
            if (window.GRTS.DOM.setSelectValueFuzzy(vetSelect, profile.veteran_status)) count++;
        }

        const disSelect = document.querySelector('select[id*="disability"], select[name*="disability"]');
        if (disSelect && profile.disability_status) {
            if (window.GRTS.DOM.setSelectValueFuzzy(disSelect, profile.disability_status)) count++;
        }

        return count;
    }

    return {
        fillGreenhouseFields
    };
})();
