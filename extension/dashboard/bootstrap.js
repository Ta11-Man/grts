// Dashboard application bootstrap.
window.GRTS = window.GRTS || {};
window.GRTS.Dashboard = window.GRTS.Dashboard || {};

window.GRTS.Dashboard.start = function startDashboard() {
  initViewTabs();
  initFiltersAndSearch();
  initDetailDrawer();
  initManualAddModal();
  initEmailSyncModal();
  initResumeManager();
  initMasterProfileForm();
  initImportExportView();
  initKanbanDragAndDropListeners();
  initQABankActionListeners();
  initMilestoneActionListeners();
  loadDashboardData();

  document
    .getElementById("refreshBtn")
    ?.addEventListener("click", loadDashboardData);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.GRTS.Dashboard.start();
  });
} else {
  window.GRTS.Dashboard.start();
}

