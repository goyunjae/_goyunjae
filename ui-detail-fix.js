(function () {
  const VERSION = "20260617-1015";
  const SEGMENTS = [
    { key: "TREEMAP", label: "Treemap", switchType: "TREEMAP" },
    { key: "PIE", label: "Circles", switchType: "PIE" },
    { key: "SUNBURST", label: "Sunburst", switchType: "PIE" },
    { key: "BAR", label: "Bars", switchType: "BAR" },
    { key: "RADIAL", label: "Radial", switchType: "RADIAL" },
  ];

  ready(start);

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function start() {
    document.body.classList.add("ux-detail-clean");
    installStyles();
    bindEvents();
    runCleanup();
    [80, 220, 600, 1200].forEach((delay) => setTimeout(runCleanup, delay));
  }

  let cleanTimer = 0;

  function scheduleCleanup(delay = 60) {
    clearTimeout(cleanTimer);
    cleanTimer = setTimeout(runCleanup, delay);
  }

  function runCleanup() {
    removeTopBrand();
    renameSideBrand();
    removeByFilters();
    normalizeHierarchySegments();
    renameConfusingPanelCopy();
  }

  function removeTopBrand() {
    document.querySelectorAll(".studio-global-bar .studio-logo").forEach((node) => node.remove());
    document.querySelectorAll(".studio-global-bar .project-title span").forEach((node) => node.remove());
    document.querySelectorAll(".project-title input").forEach((input) => {
      input.setAttribute("aria-label", "Visualization title");
    });
  }

  function renameSideBrand() {
    document.querySelectorAll(".brand h1").forEach((heading) => {
      heading.textContent = "차트 스튜디오";
    });
    document.querySelectorAll(".brand-mark").forEach((mark) => {
      mark.hidden = true;
      mark.setAttribute("aria-hidden", "true");
    });
  }

  function removeByFilters() {
    document.querySelectorAll(".filter-section.filter-by").forEach((node) => node.remove());
    document.querySelectorAll(".filter-section").forEach((section) => {
      const heading = section.querySelector("h3");
      if (heading && heading.textContent.trim().toLowerCase() === "by") section.remove();
    });
  }

  function normalizeHierarchySegments() {
    document.querySelectorAll(".chart-type-segments").forEach((group) => {
      const existing = Array.from(group.querySelectorAll(".chart-type-segment"));
      const activeKey = preferredActiveKey(existing);
      const isClean = existing.length === SEGMENTS.length && SEGMENTS.every((item, index) => {
        const button = existing[index];
        return button?.dataset.uxType === item.key && button.dataset.type === item.switchType && button.textContent.trim() === item.label;
      });

      if (!isClean) {
        group.innerHTML = SEGMENTS.map((item) => segmentButton(item, activeKey)).join("");
        return;
      }

      existing.forEach((button) => {
        const isActive = activeKey ? button.dataset.uxType === activeKey : button.classList.contains("active");
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
    });
  }

  function renameConfusingPanelCopy() {
    const activeKey = displayedActiveKey();
    if (activeKey !== "PIE" && activeKey !== "SUNBURST") return;
    document.querySelectorAll(".editor-accordion .accordion-head span").forEach((label) => {
      const text = label.textContent.trim();
      if (activeKey === "PIE" && text === "Sunburst") label.textContent = "Circles";
      if (activeKey === "SUNBURST" && text === "Circles") label.textContent = "Sunburst";
    });
  }

  function segmentButton(item, activeKey) {
    const active = activeKey === item.key;
    return '<button type="button" class="chart-type-segment ' + (active ? "active" : "") +
      '" data-type="' + item.switchType + '" data-ux-type="' + item.key +
      '" aria-pressed="' + (active ? "true" : "false") + '">' + item.label + "</button>";
  }

  function preferredActiveKey(existing) {
    const plotKey = activeKeyFromPlot();
    const sticky = window.__uxHierarchyActiveKey;
    if (sticky && isCompatible(sticky, plotKey)) return sticky;
    if (plotKey) return plotKey;
    const active = existing.find((button) => button.classList.contains("active"));
    return active?.dataset.uxType || keyFromLabel(active?.textContent || "") || active?.dataset.type || "";
  }

  function displayedActiveKey() {
    const active = Array.from(document.querySelectorAll(".chart-type-segment.active")).find(Boolean);
    const fromButton = active?.dataset.uxType || keyFromLabel(active?.textContent || "") || active?.dataset.type || "";
    if (fromButton) return fromButton;
    const sticky = window.__uxHierarchyActiveKey;
    const plotKey = activeKeyFromPlot();
    if (sticky && isCompatible(sticky, plotKey)) return sticky;
    return plotKey;
  }

  function activeKeyFromPlot() {
    const plot = document.querySelector(".chart-card.is-selected .plot") || document.querySelector(".chart-card .plot");
    if (!plot?.data) return "";
    if (plot.data.some((trace) => trace.type === "treemap")) return "TREEMAP";
    if (plot.data.some((trace) => trace.type === "sunburst")) return "SUNBURST";
    if (plot.data.some((trace) => trace.type === "pie")) return "PIE";
    if (plot.data.some((trace) => trace.type === "bar" || trace.type === "waterfall")) return "BAR";
    if (plot.data.some((trace) => trace.type === "indicator" || trace.type === "barpolar")) return "RADIAL";
    return "";
  }

  function isCompatible(sticky, plotKey) {
    if (!plotKey) return true;
    if (sticky === plotKey) return true;
    return sticky === "SUNBURST" && plotKey === "PIE";
  }

  function keyFromLabel(label) {
    const text = String(label || "").trim().toLowerCase();
    const match = SEGMENTS.find((item) => item.label.toLowerCase() === text);
    return match?.key || "";
  }

  function bindEvents() {
    if (document.body.dataset.uxDetailFix === VERSION) return;
    document.body.dataset.uxDetailFix = VERSION;

    document.addEventListener("pointerdown", (event) => {
      const segment = event.target.closest?.(".chart-type-segment");
      if (segment) {
        window.__uxHierarchyActiveKey = segment.dataset.uxType || keyFromLabel(segment.textContent) || segment.dataset.type || "";
        scheduleCleanup(0);
        scheduleCleanup(120);
      }
    }, true);

    document.addEventListener("click", (event) => {
      const segment = event.target.closest?.(".chart-type-segment");
      if (segment) {
        window.__uxHierarchyActiveKey = segment.dataset.uxType || keyFromLabel(segment.textContent) || segment.dataset.type || "";
        scheduleCleanup(0);
        scheduleCleanup(180);
        return;
      }

      if (event.target.closest?.(".filter-chip,#chartGroup,.studio-tab")) {
        window.__uxHierarchyActiveKey = "";
        scheduleCleanup(100);
      }
    }, true);

    const observer = new MutationObserver(() => scheduleCleanup(40));
    ["body", ".studio-global-bar", ".template-filter-panel", ".final-editor-panel"].forEach((selector) => {
      const node = selector === "body" ? document.body : document.querySelector(selector);
      if (node) observer.observe(node, { childList: true, subtree: selector !== "body" });
    });
  }

  function installStyles() {
    if (document.querySelector("#ux-detail-fix-style")) return;
    const style = document.createElement("style");
    style.id = "ux-detail-fix-style";
    style.textContent = `
      body.ux-detail-clean.flourish-flow{padding-top:56px!important}
      body.ux-detail-clean .studio-global-bar{height:56px!important;padding:0 16px!important;grid-template-columns:1fr auto!important}
      body.ux-detail-clean .studio-global-bar .studio-logo,
      body.ux-detail-clean .studio-global-bar .project-title span,
      body.ux-detail-clean .filter-section.filter-by,
      body.ux-detail-clean .template-sidebar .brand-mark{display:none!important}
      body.ux-detail-clean .project-title{border-left:0!important;padding-left:0!important;min-width:0!important}
      body.ux-detail-clean .project-title input{max-width:280px!important}
      body.ux-detail-clean .template-filter-panel{gap:18px!important}
      body.ux-detail-clean .chart-type-segment{position:relative}
      body.ux-detail-clean .chart-type-segment.active{background:#eaf2ff!important;color:#1d4ed8!important;box-shadow:inset 0 -2px 0 #2f6cea!important}
      body.ux-detail-clean .chart-type-segment:focus-visible{outline:2px solid rgba(47,108,234,.45)!important;outline-offset:-2px!important}
    `;
    document.head.appendChild(style);
  }
}());
