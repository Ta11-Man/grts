/**
 * GRTS Autofill - Floating UI Badge & Notifications
 */
window.GRTS = window.GRTS || {};

window.GRTS.UI = (() => {
    let badgeDismissed = false;

    /**
     * Floating non-intrusive GRTS Quick-Fill Pill UI in Bottom-Left with Clean SVG Dismiss Button
     */
    function setSafeInnerHTML(el, html) {
        if (!el) return;
        el.textContent = "";
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        while (doc.body.firstChild) {
            el.appendChild(doc.body.firstChild);
        }
    }

    function renderFloatingBadge(count, onRerun) {
        if (badgeDismissed) return;

        let badge = document.getElementById('grts-autofill-badge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'grts-autofill-badge';
            badge.style.cssText = `
                position: fixed;
                bottom: 24px;
                left: 24px;
                background: #ffffff;
                color: #2d3436;
                border: 1px solid #b6a25b;
                box-shadow: 0 8px 24px rgba(0,0,0,0.12);
                border-radius: 30px;
                padding: 7px 14px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 999999;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            `;
            document.body.appendChild(badge);
        }

        setSafeInnerHTML(badge, `
            <span style="display:inline-flex; align-items:center; justify-content:center; width:20px; height:20px; background:#b6a25b; color:white; border-radius:50%; font-size:10px; font-weight:bold;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            </span>
            <span>GRTS Auto-Filled <strong>${count}</strong> fields</span>
            <button id="grts-rerun-btn" style="background:none; border:none; color:#857744; font-size:11px; text-decoration:underline; cursor:pointer; padding:2px;">Re-run</button>
            <button id="grts-close-badge-btn" style="background:none; border:none; color:#94a3b8; font-size:14px; cursor:pointer; padding:0 4px; display:inline-flex; align-items:center; line-height:1;" title="Dismiss">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        `);

        document.getElementById('grts-rerun-btn')?.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (typeof onRerun === 'function') {
                await onRerun();
            }
        });

        document.getElementById('grts-close-badge-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            badgeDismissed = true;
            if (badge) badge.remove();
        });

        setTimeout(() => {
            if (badge && !badgeDismissed) badge.style.opacity = '0.6';
        }, 6000);
        badge.onmouseenter = () => { if (!badgeDismissed) badge.style.opacity = '1'; };
        badge.onmouseleave = () => { if (!badgeDismissed) badge.style.opacity = '0.6'; };
    }

    function updateBadgeStatus(textHtml) {
        if (badgeDismissed) return;
        const badgeText = document.querySelector('#grts-autofill-badge span:nth-child(2)');
        if (badgeText) {
            setSafeInnerHTML(badgeText, textHtml);
        }
    }

    function isBadgeDismissed() {
        return badgeDismissed;
    }

    return {
        renderFloatingBadge,
        updateBadgeStatus,
        isBadgeDismissed
    };
})();
