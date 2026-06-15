(function () {
  const VERSION = "20260615-1630";
  const PALETTE = ["#2f6cea", "#2bb3a3", "#b8e6a3", "#f4c542", "#ef476f", "#7c3aed", "#0f766e"];

  ready(start);

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function start() {
    installTreemapSpecs();
    ensureTreemapControls();
    observeEditor();
    [80, 300, 900].forEach((delay) => setTimeout(() => {
      ensureTreemapControls();
      cleanHierarchyButtons();
    }, delay));
  }

  function installTreemapSpecs() {
    if (typeof window.chartSpecs !== "function" || window.chartSpecs.__treemapFixed === VERSION) return;
    const previous = window.chartSpecs;
    window.chartSpecs = function chartSpecsWithTreemap() {
      const specs = previous();
      const hasTreemap = specs.some((spec) => spec.group === "TREEMAP");
      const next = hasTreemap ? specs : [...specs, ...treemapSpecs()];
      return dedupe(next);
    };
    window.chartSpecs.__treemapFixed = VERSION;
  }

  function treemapSpecs() {
    return [
      { group: "TREEMAP", number: 1, label: "Report Treemap", build: reportTreemap },
      { group: "TREEMAP", number: 2, label: "Nested Treemap", build: nestedTreemap },
      { group: "TREEMAP", number: 3, label: "Top Treemap", build: topTreemap },
    ];
  }

  function ensureTreemapControls() {
    ensureChartOption();
    ensureFilterChip();
  }

  function ensureChartOption() {
    const select = document.querySelector("#chartGroup");
    if (!select || Array.from(select.options).some((option) => option.value === "TREEMAP")) return;
    const option = document.createElement("option");
    option.value = "TREEMAP";
    option.textContent = "TREEMAP - hierarchy";
    const before = Array.from(select.options).find((item) => item.value === "PIE" || item.value === "KPI" || item.value === "FUNNEL");
    select.insertBefore(option, before || null);
  }

  function ensureFilterChip() {
    if (document.querySelector(".filter-chip[data-value='TREEMAP']")) return;
    const typeSection = Array.from(document.querySelectorAll(".filter-section")).find((section) => {
      const heading = section.querySelector("h3");
      return heading && heading.textContent.trim().toLowerCase() === "type";
    });
    const holder = typeSection?.querySelector(".filter-chips");
    if (!holder) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filter-chip";
    button.dataset.value = "TREEMAP";
    button.dataset.enabled = "true";
    button.textContent = "Treemap";
    const before = Array.from(holder.children).find((item) => item.dataset.value === "PIE" || item.dataset.value === "KPI");
    holder.insertBefore(button, before || null);
  }

  function observeEditor() {
    const workspace = document.querySelector(".workspace") || document.body;
    if (workspace.dataset.treemapObserver === VERSION) return;
    workspace.dataset.treemapObserver = VERSION;
    new MutationObserver(cleanHierarchyButtons).observe(workspace, { childList: true, subtree: true });
    document.addEventListener("click", (event) => {
      if (event.target.closest?.(".chart-card,.studio-tab[data-view='preview']")) {
        setTimeout(cleanHierarchyButtons, 120);
      }
    }, true);
  }

  function cleanHierarchyButtons() {
    document.querySelectorAll(".chart-type-segments").forEach((group) => {
      const existing = Array.from(group.querySelectorAll(".chart-type-segment"));
      const wanted = [
        ["TREEMAP", "Treemap"],
        ["PIE", "Sunburst"],
        ["BAR", "Bars"],
        ["RADIAL", "Radial"],
      ];
      const alreadyClean = existing.length === wanted.length && wanted.every(([value, label], index) => {
        const button = existing[index];
        return button?.dataset.type === value && button.textContent.trim() === label;
      });
      if (alreadyClean) {
        existing.forEach((button) => button.classList.toggle("active", isActiveType(button.dataset.type)));
        return;
      }
      group.innerHTML = wanted.map(([value, label]) => {
        const old = existing.find((button) => button.dataset.type === value && button.textContent.trim() === label);
        const active = old?.classList.contains("active") || isActiveType(value);
        return '<button type="button" class="chart-type-segment ' + (active ? "active" : "") + '" data-type="' + value + '">' + label + "</button>";
      }).join("");
    });
  }

  function isActiveType(value) {
    const plot = document.querySelector(".chart-card.is-selected .plot") || document.querySelector(".chart-card .plot");
    if (!plot?.data) return false;
    if (value === "TREEMAP") return plot.data.some((trace) => trace.type === "treemap");
    if (value === "PIE") return plot.data.some((trace) => trace.type === "pie");
    if (value === "BAR") return plot.data.some((trace) => trace.type === "bar" || trace.type === "waterfall");
    if (value === "RADIAL") return plot.data.some((trace) => trace.type === "indicator" || trace.type === "barpolar");
    return false;
  }

  function reportTreemap(data) {
    const rows = seriesTotals(data).filter((item) => item.value > 0);
    return {
      traces: [{
        type: "treemap",
        labels: rows.map((item) => item.name),
        parents: rows.map(() => ""),
        values: rows.map((item) => item.value),
        textinfo: "label+value+percent root",
        marker: { colors: rows.map((_, index) => PALETTE[index % PALETTE.length]), line: { color: "#ffffff", width: 2 } },
        tiling: { pad: 3 },
        hovertemplate: "%{label}<br>%{value}<extra></extra>",
      }],
      layout: { margin: { l: 10, r: 10, t: 55, b: 10 } },
    };
  }

  function nestedTreemap(data) {
    const labels = ["Total"];
    const parents = [""];
    const values = [sum(data.values.flat())];
    const colors = ["#eef4ff"];
    data.series.forEach((series, rowIndex) => {
      const seriesTotal = sum(data.values[rowIndex]);
      labels.push(series);
      parents.push("Total");
      values.push(seriesTotal);
      colors.push(PALETTE[rowIndex % PALETTE.length]);
      data.labels.forEach((label, colIndex) => {
        const value = Number(data.values[rowIndex][colIndex]) || 0;
        if (value <= 0) return;
        labels.push(`${series} - ${label}`);
        parents.push(series);
        values.push(value);
        colors.push(PALETTE[(rowIndex + colIndex + 1) % PALETTE.length]);
      });
    });
    return {
      traces: [{
        type: "treemap",
        labels,
        parents,
        values,
        branchvalues: "total",
        textinfo: "label+value",
        marker: { colors, line: { color: "#ffffff", width: 2 } },
        tiling: { pad: 3 },
        hovertemplate: "%{label}<br>%{value}<extra></extra>",
      }],
      layout: { margin: { l: 10, r: 10, t: 55, b: 10 } },
    };
  }

  function topTreemap(data) {
    const rows = [...seriesTotals(data), ...labelTotals(data)]
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
    return {
      traces: [{
        type: "treemap",
        labels: rows.map((item) => item.name),
        parents: rows.map(() => ""),
        values: rows.map((item) => item.value),
        textinfo: "label+value+percent root",
        marker: { colors: rows.map((_, index) => PALETTE[index % PALETTE.length]), line: { color: "#ffffff", width: 2 } },
        tiling: { pad: 3 },
        hovertemplate: "%{label}<br>%{value}<extra></extra>",
      }],
      layout: { margin: { l: 10, r: 10, t: 55, b: 10 } },
    };
  }

  function seriesTotals(data) {
    return data.series.map((name, index) => ({ name, value: sum(data.values[index] || []) }));
  }

  function labelTotals(data) {
    return data.labels.map((name, index) => ({
      name,
      value: sum(data.values.map((row) => row[index] || 0)),
    }));
  }

  function sum(values) {
    return values.reduce((total, value) => total + (Number(value) || 0), 0);
  }

  function dedupe(specs) {
    const seen = new Set();
    return specs.filter((spec) => {
      const key = `${spec.group}:${spec.number}:${spec.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}());
