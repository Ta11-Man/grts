/**
 * GRTS Autofill - Configuration & Defaults
 */
window.GRTS = window.GRTS || {};

window.GRTS.Config = (() => {
  const DEFAULT_PROFILE = {
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    country: "United States",
    linkedin: "",
    github: "",
    portfolio: "",
    twitter: "",
    work_authorized_us: "Yes",
    require_sponsorship: "No",
    future_sponsorship: "No",
    student_visa: "No",
    require_cpt_opt: "No",
    previous_worker: "No",
    scholarship_recipient: "No",
    phone_device_type: "Mobile",
    how_heard: "LinkedIn",
    age_18_or_older: "Yes",
    non_compete_obligation: "No",
    ai_recruiting_consent: "Yes",
    class_year: "Senior",
    enrolled_in_program: "Yes",
    return_to_school: "Yes",
    open_to_relocation: "Yes",
    hispanic_latino: "No",
    skills:
      "Python, Go, C++, JavaScript, TypeScript, Distributed Systems, SQL, Git, Linux, Docker, REST APIs",
    current_company: "",
    current_title: "",
    current_location: "",
    currently_work_here: false,
    experience_start_date: "",
    experience_end_date: "",
    experience_description: "",
    experience_list: [],
    school: "",
    degree: "",
    discipline: "",
    gpa: "",
    edu_start_date: "2023-08",
    edu_end_date: "2026-12",
    edu_start_year: "2023",
    grad_year: "2026",
    education_list: [],
    gender: "Decline to Self-Identify",
    veteran_status: "I am not a protected veteran",
    disability_status:
      "No, I do not have a disability and have not had one in the past",
    race_ethnicity: "White",
    notice_period: "Immediate / 2 Weeks",
    desired_salary: "",
    cover_letter_default: "",
    autofill_enabled: false,
    active_resume_tag: "v1.0",
    active_resume_pdf_base64: null,
    active_resume_pdf_name: null,
  };

  const CONSTANTS = {
    MAX_AUTO_PASSES: 6,
    DEBOUNCE_DELAY_MS: 800,
    STEP_TRANSITION_DELAY_MS: 1200,
    API_BASE_LOCAL: "http://127.0.0.1:8000/api",
  };

  return {
    DEFAULT_PROFILE,
    CONSTANTS,
  };
})();
