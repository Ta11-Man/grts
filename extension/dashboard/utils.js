// Dashboard Utility Functions

/**
 * Toast Notification Utility
 */
function showToast(message) {
  const toast = document.getElementById("toastNotification");
  if (!toast) return;
  toast.innerText = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}

/**
 * Workday Messy Location Cleaner
 */
function cleanWorkdayLocationString(raw) {
  if (!raw) return "";
  let str = raw.trim();
  const validStates = new Set([
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
    "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
    "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
    "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
    "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    "DC", "PR"
  ]);
  const stCityMatches = [
    ...str.matchAll(
      /\b([A-Z]{2})-([A-Za-z\s]+?)(?:,\s*\d|\s+[A-Z]{2}-|\s*\(|$)/g,
    ),
  ];
  if (stCityMatches.length > 0) {
    const extracted = [];
    for (const m of stCityMatches) {
      const st = m[1].toUpperCase();
      const city = m[2].trim().replace(/^(city of|town of)\s+/i, "");
      if (validStates.has(st) && city.length >= 2 && city.length <= 35) {
        const titleCity = city
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ");
        extracted.push(`${titleCity}, ${st}`);
      }
    }
    if (extracted.length > 0) {
      let res = [...new Set(extracted)].join(" • ");
      if (/\(hybrid\)/i.test(str)) res += " (Hybrid)";
      else if (/\(remote\)/i.test(str)) res += " (Remote)";
      else if (/\(on-?site\)/i.test(str)) res += " (On-site)";
      return res;
    }
  }
  return str;
}

function isInterviewStatus(status) {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  if (
    [
      "applied",
      "save",
      "reject",
      "ghost",
      "skip",
      "expire",
      "offer",
      "decline",
    ].some((neg) => s.includes(neg))
  ) {
    return false;
  }
  return true;
}

function getStatusClass(status) {
  if (!status) return "status-Applied";
  if (status.includes("Skipped") || status.includes("Expired"))
    return "status-Skipped";
  if (status === "Saved" || status.includes("Saved")) return "status-Saved";
  if (status.includes("OA") || status.includes("Assessment"))
    return "status-OA";
  if (status.includes("Screen") || status.includes("Recruiter"))
    return "status-Screening";
  if (status.includes("Tech") || status.includes("Design"))
    return "status-Technical";
  if (status.includes("Final") || status.includes("Onsite"))
    return "status-Final";
  if (status.includes("Offer")) return "status-Offer";
  if (status.includes("Reject") || status.includes("Ghost"))
    return "status-Rejected";
  return "status-Applied";
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setSafeInnerHTML(el, html) {
  if (!el) return;
  el.textContent = "";
  if (!html) return;

  // 1. Handle SVG elements (template with <svg> creates elements in SVG namespace)
  if (el instanceof SVGElement || (el.tagName && el.tagName.toLowerCase() === "svg")) {
    const template = document.createElement("template");
    template.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${html}</svg>`;
    const svgContent = template.content.querySelector("svg");
    if (svgContent && svgContent.childNodes.length > 0) {
      while (svgContent.firstChild) {
        el.appendChild(svgContent.firstChild);
      }
      return;
    }
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(
        `<svg xmlns="http://www.w3.org/2000/svg">${html}</svg>`,
        "image/svg+xml",
      );
      const svgRoot = doc.documentElement;
      if (svgRoot && svgRoot.nodeName !== "parsererror") {
        while (svgRoot.firstChild) {
          el.appendChild(svgRoot.firstChild);
        }
        return;
      }
    } catch (e) {}
  }

  // 2. Handle HTML elements (template tag preserves <tr>, <td>, and all HTML fragment structures)
  const template = document.createElement("template");
  template.innerHTML = html;
  el.appendChild(template.content.cloneNode(true));
}
