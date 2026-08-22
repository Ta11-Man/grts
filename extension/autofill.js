/**
 * GRTS Autofill - Restructured & Modularized
 * 
 * The monolithic autofill engine has been refactored into modular components under:
 * extension/autofill/
 *   ├── config.js              - Default profile fallback & global thresholds
 *   ├── profile.js             - Profile loading, YAML resume parser & PDF attachment
 *   ├── dom_utils.js           - Keystroke simulators, value setters, highlight styles & scoring
 *   ├── matcher.js             - Semantic field classifier & label extractor (getFieldLabel / getFieldType)
 *   ├── adapters/
 *   │     ├── workday.js       - Workday composite UI, MultiSelect search, dates, multi-cards & listbox dropdowns
 *   │     ├── greenhouse.js    - Greenhouse custom fields & EEO demography selects
 *   │     └── generic.js       - Universal ATS form controls (input, select, textarea, radios, checkboxes)
 *   ├── ui.js                  - Floating GRTS pill badge UI
 *   └── core.js                - Core engine orchestrator, auto-advance, dynamic observer & GRTS_AUTOFILL export
 * 
 * Content scripts are automatically registered in dependency order in manifest.json.
 */
