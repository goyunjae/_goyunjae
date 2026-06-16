(function () {
  const VERSION = "20260616-1135";
  let polishTimer = 0;

  ready(() => {
    document.body.classList.add("toss-polish");
    injectStyle();
    polish();
    installEvents();
  });

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function installEvents() {
    if (document.body.dataset.tossPolishEvents === VERSION) return;
    document.body.dataset.tossPolishEvents = VERSION;
    ["click", "change", "input"].forEach((type) => {
      document.addEventListener(type, (event) => {
        if (!event.target.closest?.("#generateBtn,#clearBtn,#sampleDataBtn,#addRowBtn,#addColBtn,.filter-chip,.studio-tab,.chart-card,.final-editor-panel,#manualTable")) return;
        schedulePolish();
      }, true);
    });
    setTimeout(schedulePolish, 300);
    setTimeout(schedulePolish, 1200);
  }

  function schedulePolish() {
    clearTimeout(polishTimer);
    polishTimer = setTimeout(polish, 80);
  }

  function polish() {
    document.querySelectorAll(".template-sidebar > label, .template-sidebar > .theme-field").forEach((node) => node.classList.add("soft-section"));
    document.querySelectorAll(".summary-card").forEach((card, index) => {
      card.style.setProperty("--summary-accent", ["#3182f6", "#00b894", "#f59f00", "#7048e8"][index % 4]);
    });
    document.querySelectorAll(".toss-empty-visual").forEach((node) => node.remove());
    const empty = document.querySelector("#emptyState");
    if (empty && empty.dataset.tossClean !== VERSION) {
      empty.dataset.tossClean = VERSION;
      empty.innerHTML = '<strong>차트 미리보기</strong><span>생성된 차트가 이 영역에 표시됩니다.</span>';
    }
  }

  function injectStyle() {
    if (document.querySelector("#toss-polish-style")) return;
    const style = document.createElement("style");
    style.id = "toss-polish-style";
    style.textContent = `
      :root{--toss-blue:#3182f6;--toss-blue-strong:#1b64da;--toss-mint:#00b894;--toss-amber:#f59f00;--toss-purple:#7048e8;--toss-ink:#191f28;--toss-text:#333d4b;--toss-muted:#8b95a1;--toss-line:#e5e8eb;--toss-bg:#f7f9fc;--toss-card:#fff;--toss-shadow:0 10px 30px rgba(25,31,40,.08);--toss-shadow-sm:0 4px 14px rgba(25,31,40,.06)}
      body.toss-polish{background:var(--toss-bg)!important;color:var(--toss-text)!important;font-family:Inter,"Pretendard","Segoe UI",Arial,sans-serif!important;letter-spacing:0!important;overflow-x:hidden!important}.toss-polish,.toss-polish *,.toss-polish *::before,.toss-polish *::after{box-sizing:border-box!important}
      .toss-polish .studio-global-bar{height:64px!important;padding:0 22px!important;background:rgba(255,255,255,.94)!important;color:var(--toss-ink)!important;border-bottom:1px solid rgba(229,232,235,.88)!important;box-shadow:0 1px 0 rgba(25,31,40,.03)!important;backdrop-filter:blur(14px)!important}.toss-polish .studio-logo{color:var(--toss-blue)!important;font-size:22px!important;font-weight:900!important;text-shadow:none!important}.toss-polish .project-title{border-left:1px solid var(--toss-line)!important}.toss-polish .project-title input{color:var(--toss-ink)!important}.toss-polish .project-title span{color:var(--toss-muted)!important}.toss-polish .studio-actions button,.toss-polish #panelToggle{height:38px!important;padding:0 14px!important;border:0!important;border-radius:8px!important;background:#eef4ff!important;color:var(--toss-blue-strong)!important;box-shadow:none!important}
      .toss-polish .app-shell{background:transparent!important;padding:22px!important;width:100%!important;max-width:100%!important;overflow-x:hidden!important}.toss-polish .workspace{gap:18px!important;min-width:0!important}.toss-polish .main-panel,.toss-polish .template-sidebar,.toss-polish .final-editor-panel,.toss-polish .content{min-width:0!important}.toss-polish .template-sidebar,.toss-polish .final-editor-panel,.toss-polish .topbar,.toss-polish .summary-card,.toss-polish .chart-card,.toss-polish #emptyState{background:var(--toss-card)!important;border:1px solid rgba(229,232,235,.96)!important;border-radius:8px!important;box-shadow:var(--toss-shadow-sm)!important}
      .toss-polish .template-sidebar{padding:16px!important}.toss-polish .template-sidebar,.toss-polish .final-editor-panel{scrollbar-width:thin;scrollbar-color:#c8d1dc transparent}.toss-polish .template-sidebar label,.toss-polish .template-sidebar strong{color:var(--toss-ink)!important;font-size:13px!important;font-weight:850!important}.toss-polish select,.toss-polish input,.toss-polish textarea{border:1px solid #dfe5ec!important;border-radius:8px!important;background:#fff!important;color:var(--toss-text)!important;transition:border-color .15s ease,box-shadow .15s ease!important}.toss-polish select:focus,.toss-polish input:focus,.toss-polish textarea:focus{outline:0!important;border-color:var(--toss-blue)!important;box-shadow:0 0 0 3px rgba(49,130,246,.14)!important}
      .toss-polish .filter-chip{min-height:34px!important;padding:8px 12px!important;border:1px solid #dfe5ec!important;border-radius:999px!important;background:#fff!important;color:var(--toss-text)!important;font-weight:800!important;box-shadow:none!important;transition:transform .14s ease,background .14s ease,border-color .14s ease,box-shadow .14s ease!important}.toss-polish .filter-chip:hover{transform:translateY(-1px)!important;background:#f8fbff!important;border-color:#bdd7ff!important}.toss-polish .filter-chip.active{background:var(--toss-blue)!important;border-color:var(--toss-blue)!important;color:#fff!important;box-shadow:0 8px 18px rgba(49,130,246,.24)!important}
      .toss-polish .theme-icons{gap:9px!important}.toss-polish .theme-icon,.toss-polish .palette-button{border-radius:8px!important;border:1px solid #dfe5ec!important;box-shadow:0 1px 0 rgba(25,31,40,.04)!important}.toss-polish .theme-icon.active,.toss-polish .palette-button:focus-visible{outline:3px solid rgba(49,130,246,.18)!important;border-color:var(--toss-blue)!important}
      .toss-polish .studio-tabs{height:54px!important;margin:0 0 16px!important;padding:0 14px!important;align-items:center!important;gap:8px!important;border:1px solid var(--toss-line)!important;border-radius:8px!important;background:#fff!important;box-shadow:var(--toss-shadow-sm)!important}.toss-polish .studio-tab{height:36px!important;padding:0 14px!important;border:0!important;border-radius:8px!important;background:transparent!important;color:var(--toss-muted)!important;font-weight:850!important}.toss-polish .studio-tab.active{background:#eef4ff!important;color:var(--toss-blue-strong)!important;border-bottom-color:transparent!important}
      .toss-polish .topbar{padding:18px 20px!important;margin-bottom:16px!important}.toss-polish .topbar h1,.toss-polish .topbar h2,.toss-polish .topbar strong{color:var(--toss-ink)!important;letter-spacing:0!important}.toss-polish .topbar p,.toss-polish #status{color:var(--toss-muted)!important}.toss-polish button.primary,.toss-polish #generateBtn,.toss-polish #applySelectedChart,.toss-polish .editor-actions #generateFromEditor{border:0!important;border-radius:8px!important;background:var(--toss-blue)!important;color:#fff!important;font-weight:850!important;box-shadow:0 8px 18px rgba(49,130,246,.22)!important}.toss-polish button.secondary,.toss-polish .secondary,.toss-polish .editor-hide,.toss-polish #themeRefresh{border:1px solid #dfe5ec!important;border-radius:8px!important;background:#fff!important;color:var(--toss-text)!important;font-weight:850!important;box-shadow:0 1px 0 rgba(25,31,40,.04)!important}
      .toss-polish #summary{gap:12px!important}.toss-polish .summary-card{position:relative!important;overflow:hidden!important;padding:18px!important}.toss-polish .summary-card::before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:var(--summary-accent,var(--toss-blue))}.toss-polish .summary-card span{color:var(--toss-muted)!important;font-size:12px!important;font-weight:800!important}.toss-polish .summary-card strong{color:var(--toss-ink)!important;font-size:22px!important;letter-spacing:0!important}
      .toss-polish #chartGrid{gap:16px!important}.toss-polish .chart-card{padding:16px!important;overflow:hidden!important;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease!important}.toss-polish .chart-card:hover{transform:translateY(-2px)!important;border-color:#bdd7ff!important;box-shadow:var(--toss-shadow)!important}.toss-polish .chart-card.is-selected{border-color:var(--toss-blue)!important;outline:3px solid rgba(49,130,246,.16)!important;outline-offset:0!important;box-shadow:0 14px 34px rgba(49,130,246,.14)!important}.toss-polish .chart-card-header{min-height:42px!important;align-items:center!important;gap:10px!important}.toss-polish .chart-card-header h3,.toss-polish .chart-title-control{color:var(--toss-ink)!important;font-weight:900!important;letter-spacing:0!important}.toss-polish .chart-card .plot{border-radius:8px!important;background:#fff!important}.toss-polish .chart-select{accent-color:var(--toss-blue)!important}
      .toss-polish .final-editor-panel{background:#fff!important;overflow:hidden auto!important}.toss-polish .final-editor-panel header{padding:18px!important;border-bottom:1px solid var(--toss-line)!important;background:linear-gradient(180deg,#fff 0%,#fbfdff 100%)!important}.toss-polish .final-editor-panel header strong{color:var(--toss-ink)!important;font-size:19px!important;font-weight:900!important}.toss-polish .final-editor-panel header span,.toss-polish .tool-note,.toss-polish .empty-editor span{color:var(--toss-muted)!important}.toss-polish .editor-badge{border-radius:999px!important;background:#eef4ff!important;color:var(--toss-blue-strong)!important}.toss-polish .editor-theme,.toss-polish .editor-section,.toss-polish .editor-accordion{border-bottom:1px solid var(--toss-line)!important;background:#fff!important}.toss-polish .section-head{background:#f7f9fc!important;color:var(--toss-ink)!important}.toss-polish .chart-type-segments{border-color:#dfe5ec!important;border-radius:8px!important}.toss-polish .chart-type-segment{background:#fff!important;color:var(--toss-text)!important}.toss-polish .chart-type-segment.active{background:#eef4ff!important;color:var(--toss-blue-strong)!important;box-shadow:inset 0 -2px 0 var(--toss-blue)!important}.toss-polish button.accordion-head,.toss-polish .accordion-head{border:0!important;border-radius:0!important;background:#fff!important;color:var(--toss-ink)!important;box-shadow:none!important}.toss-polish .editor-accordion.open > button.accordion-head,.toss-polish .editor-accordion.open > .accordion-head{background:#f8fbff!important}.toss-polish .accordion-head span,.toss-polish .accordion-head b{color:var(--toss-ink)!important}
      .toss-polish #emptyState{min-height:220px!important;display:flex!important;flex-direction:column!important;align-items:flex-start!important;justify-content:flex-start!important;gap:8px!important;padding:24px!important}.toss-polish #emptyState strong{font-size:18px!important;font-weight:900!important;color:var(--toss-ink)!important}.toss-polish #emptyState span{font-size:13px!important;color:var(--toss-muted)!important}.toss-polish .toss-empty-visual{display:none!important}
      .toss-polish #manualTable{border-collapse:separate!important;border-spacing:0!important}.toss-polish #manualTable th,.toss-polish #manualTable td{border-color:#edf1f5!important}.toss-polish #manualTable input{border-radius:7px!important}body.toss-polish[data-view="data"] .workspace{grid-template-columns:minmax(260px,300px) minmax(0,1fr)!important}@media (max-width:1180px){.toss-polish .app-shell{padding:14px!important}}@media (max-width:760px){.toss-polish .studio-global-bar{padding:0 14px!important}.toss-polish .app-shell{padding:10px!important}.toss-polish .studio-tabs{padding:0 8px!important}}
    `;
    document.head.appendChild(style);
  }
}());
