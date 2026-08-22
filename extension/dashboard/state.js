// Dashboard Global State Management

const API_BASE =
  window.GRTS?.Dashboard?.api?.baseUrl || "http://127.0.0.1:8000";

let applicationsData = [];
let qaBankData = [];
let resumesData = [];
let detailedAnalyticsData = null;
let currentSelectedApp = null;
let activeSortBy = "recency";
let activeStatusFilter = "";
let activeCustomFilter = null; // null | 'interviewing' | 'offers' | 'hearback'
let activeSearchQuery = "";
let currentDraggedAppId = null;
let currentSelectedResume = null;
