"""
Build script to assemble extension/dashboard.html from modular component partials in extension/dashboard/partials/.
Manages header, views, modals, and detail drawer overlays seamlessly.
"""
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DASHBOARD_HTML = os.path.join(BASE_DIR, "extension", "dashboard.html")
PARTIALS_DIR = os.path.join(BASE_DIR, "extension", "dashboard", "partials")

def compile_dashboard_html():
    header_tmpl = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="grts-logo-sqr.svg" />
    <title>GRTS - Application Lifecycle & Tracking Dashboard</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="dashboard/dashboard.css" />
    <script>
      (function() {
        try {
          var t = localStorage.getItem('grts_theme') || 'light';
          if (t === 'system') {
            t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
          }
          document.documentElement.setAttribute('data-theme', t);
        } catch(e) {}
      })();
    </script>
  </head>
  <body>
    <div class="app-layout">
"""

    footer_tmpl = """
    </div>

    <!-- Dashboard Modular JavaScript Architecture -->
    <script src="us_map_data.js"></script>
    <script src="dashboard/api.js"></script>
    <script src="dashboard/state.js"></script>
    <script src="dashboard/utils.js"></script>
    <script src="dashboard/data.js"></script>
    <script src="dashboard/table_view.js"></script>
    <script src="dashboard/kanban_view.js"></script>
    <script src="dashboard/analytics_view.js"></script>
    <script src="dashboard/resumes_view.js"></script>
    <script src="dashboard/qa_bank_view.js"></script>
    <script src="dashboard/drawer_and_modals.js"></script>
    <script src="dashboard/profile_view.js"></script>
    <script src="dashboard/import_export_view.js"></script>
    <script src="dashboard/bootstrap.js"></script>
  </body>
</html>
"""

    partial_files = [
        "header.html",
        "view_table.html",
        "view_kanban.html",
        "view_analytics.html",
        "view_resumes.html",
        "view_qa.html",
        "view_profile.html",
        "view_import_export.html",
        "modals.html"
    ]

    content = header_tmpl
    for pf in partial_files:
        p_path = os.path.join(PARTIALS_DIR, pf)
        if os.path.exists(p_path):
            with open(p_path, "r", encoding="utf-8") as f:
                content += f.read() + "\n\n"
        else:
            print(f"Warning: Partial missing: {pf}")

    content += footer_tmpl

    with open(DASHBOARD_HTML, "w", encoding="utf-8") as out:
        out.write(content)

    print(f"Successfully compiled extension/dashboard.html ({len(content.splitlines())} lines)!")

if __name__ == "__main__":
    compile_dashboard_html()
