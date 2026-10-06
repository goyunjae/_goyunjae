(function () {
  if (typeof window.chartSpecs !== "function") return;

  const previous = window.chartSpecs;
  const palette = ["#2F95B8", "#45B8AC", "#B8E6A3", "#2D64A8", "#F2B75E", "#E56F76", "#8E7AD8", "#7FC8A9"];
  const groupLabels = {
    BAR: "비교",
    LINE: "추이",
    AREA: "누적",
    SCATTER: "분포",
    PIE: "비중",
    HEATMAP: "매트릭스",
    RANGE: "범위",
    RADIAL: "게이지",
    TIMELINE: "일정",
    FLOW: "흐름",
    TEXT: "텍스트",
    GEO: "지도",
    KPI: "요약",
    FUNNEL: "전환",
  };

  window.chartSpecs = function premiumChartSpecs() {
    const actual = previous()
      .filter((item) => item.group !== "전체")
      .filter((item) => !["Process Chevrons", "Scorecard Table", "Layered Gantt"].includes(item.label));

    const extras = [
      spec("KPI", "KPI 요약 카드", kpiCards),
      spec("KPI", "상위 항목 카드", topCards),
      spec("BAR", "파레토 막대", paretoBar),
      spec("BAR", "롤리팝 순위", lollipopRank),
      spec("FUNNEL", "전환 퍼널", funnelChart),
      spec("PIE", "도넛 KPI", donutKpi),
      spec("RANGE", "목표 대비", targetVsActual),
      spec("HEATMAP", "라벨 기여도", contributionHeatmap),
    ];

    return numberByGroup(unique([...actual, ...extras]));
  };

  window.addEventListener("DOMContentLoaded", () => {
    injectPremiumStyle();
    installQuickPresets();
    polishStaticText();
    observeCharts();
    setTimeout(renameGroups, 30);
  });

  function spec(group, label, build) {
    return { group, label, build: (data) => polishChart(build(data)) };
  }

  function unique(specs) {
    const seen = new Set();
    return specs.filter((item) => {
      const key = `${item.group}:${item.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function numberByGroup(specs) {
    const counts = new Map();
    return specs.map((item) => {
      const next = (counts.get(item.group) || 0) + 1;
      counts.set(item.group, next);
      return { ...item, number: next };
    });
  }

  function installQuickPresets() {
    const chartGroup = document.querySelector("#chartGroup");
    const anchor = chartGroup?.closest(".field");
    if (!anchor || document.querySelector("#chartPresets")) return;

    const panel = document.createElement("div");
    panel.className = "field premium-presets";
    panel.innerHTML = [
      '<label>추천 프리셋</label>',
      '<div id="chartPresets" class="preset-grid">',
      presetButton("보고서 전체", "__ALL__", "핵심 차트를 한 번에 보기"),
      presetButton("비교", "BAR", "순위와 차이를 보기"),
      presetButton("추이", "LINE", "시간 흐름을 보기"),
      presetButton("비중", "PIE", "구성비를 보기"),
      presetButton("지도", "GEO", "지역 데이터를 보기"),
      presetButton("요약", "KPI", "핵심 숫자를 보기"),
      "</div>",
    ].join("");
    anchor.insertAdjacentElement("afterend", panel);

    panel.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        chartGroup.value = button.dataset.group;
        chartGroup.dispatchEvent(new Event("change", { bubbles: true }));
        document.querySelector("#generateBtn")?.click();
      });
    });
  }

  function presetButton(title, group, caption) {
    return `<button type="button" class="preset-card" data-group="${group}"><strong>${title}</strong><span>${caption}</span></button>`;
  }

  function polishStaticText() {
    const empty = document.querySelector("#emptyState");
    if (empty) {
      empty.innerHTML = '<strong>데이터를 넣고 프리셋을 고르면 보고서용 차트가 바로 만들어집니다.</strong><span>색상 테마, 지도, KPI, 퍼널, 파레토, 워드클라우드까지 한 화면에서 비교해 보세요.</span>';
    }
    const meta = document.querySelector("#reportMeta");
    if (meta) {
      meta.textContent = "A1 제목, B1 이후 라벨, A2 이후 항목명. 값은 숫자만 넣어도 됩니다.";
    }
  }

  function renameGroups() {
    const select = document.querySelector("#chartGroup");
    if (!select) return;
    [...select.options].forEach((option) => {
      if (groupLabels[option.value]) option.textContent = `${option.value} · ${groupLabels[option.value]}`;
    });
  }

  function observeCharts() {
    const grid = document.querySelector("#chartGrid");
    if (!grid) return;
    const observer = new MutationObserver(() => enhanceCards());
    observer.observe(grid, { childList: true, subtree: false });
    enhanceCards();
  }

  function enhanceCards() {
    document.querySelectorAll(".chart-card:not([data-premium])").forEach((card) => {
      card.dataset.premium = "true";
      const title = card.querySelector("h3");
      const header = card.querySelector(".chart-card-header");
      if (!title || !header) return;
      const group = title.textContent.trim().split(" ")[0];
      const badge = document.createElement("span");
      badge.className = "chart-badge";
      badge.textContent = groupLabels[group] || group;
      header.appendChild(badge);
    });
  }

  function polishChart(chart) {
    const layout = chart.layout || {};
    return {
      traces: (chart.traces || []).map((trace, index) => polishTrace(trace, index)),
      layout: {
        ...layout,
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        colorway: palette,
        font: { family: "Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, Arial", color: "#20323A" },
        hoverlabel: { bgcolor: "#20323A", bordercolor: "#20323A", font: { color: "#ffffff" } },
        margin: { l: 62, r: 40, t: 68, b: 88, ...(layout.margin || {}) },
      },
    };
  }

  function polishTrace(trace, index) {
    const next = { ...trace };
    if (next.type === "bar") {
      const values = next.orientation === "h" ? next.x : next.y;
      next.text = Array.isArray(values) ? values.map(format) : next.text;
      next.textposition = next.textposition || "auto";
      next.marker = { ...(next.marker || {}), color: colorList(values, index), line: { color: "#ffffff", width: 1 } };
    }
    if (next.type === "scatter") {
      const values = next.y || next.x;
      if (next.mode && !String(next.mode).includes("text") && Array.isArray(values)) next.mode = `${next.mode}+text`;
      if (!next.text && Array.isArray(values)) next.text = values.map(format);
      next.textposition = next.textposition || "top center";
      next.line = { ...(next.line || {}), color: palette[index % palette.length], width: 2.6 };
      next.marker = { ...(next.marker || {}), color: palette[index % palette.length], line: { color: "#ffffff", width: 1 } };
    }
    if (next.type === "pie") {
      next.textinfo = "label+value+percent";
      next.marker = { ...(next.marker || {}), colors: palette, line: { color: "#ffffff", width: 2 } };
    }
    return next;
  }

  function kpiCards(data) {
    const totals = seriesTotals(data).sort((a, b) => b.value - a.value).slice(0, 6);
    return {
      traces: totals.map((item, index) => ({
        type: "indicator",
        mode: "number",
        value: item.value,
        title: { text: item.name, font: { size: 13, color: "#5E6C84" } },
        number: { font: { size: 30, color: palette[index % palette.length] } },
        domain: {
          x: [(index % 3) * 0.34, (index % 3) * 0.34 + 0.30],
          y: [index < 3 ? 0.55 : 0.08, index < 3 ? 0.95 : 0.48],
        },
      })),
      layout: { margin: { l: 30, r: 30, t: 60, b: 30 } },
    };
  }

  function topCards(data) {
    const totals = labelTotals(data).sort((a, b) => b.value - a.value).slice(0, 8);
    const annotations = totals.map((item, index) => ({
      xref: "paper",
      yref: "paper",
      x: 0.08 + (index % 4) * 0.24,
      y: 0.78 - Math.floor(index / 4) * 0.36,
      text: `<b>${item.name}</b><br><span style="font-size:24px">${format(item.value)}</span>`,
      showarrow: false,
      align: "center",
      font: { color: "#20323A", size: 12 },
    }));
    const shapes = totals.map((_, index) => ({
      type: "rect",
      xref: "paper",
      yref: "paper",
      x0: 0.01 + (index % 4) * 0.24,
      x1: 0.21 + (index % 4) * 0.24,
      y0: 0.62 - Math.floor(index / 4) * 0.36,
      y1: 0.95 - Math.floor(index / 4) * 0.36,
      fillcolor: `${palette[index % palette.length]}22`,
      line: { color: `${palette[index % palette.length]}66`, width: 1 },
    }));
    return { traces: [], layout: { annotations, shapes, xaxis: { visible: false }, yaxis: { visible: false }, margin: { l: 30, r: 30, t: 60, b: 30 } } };
  }

  function paretoBar(data) {
    const rows = labelTotals(data).sort((a, b) => b.value - a.value);
    const total = rows.reduce((sum, item) => sum + item.value, 0) || 1;
    let running = 0;
    const cumulative = rows.map((item) => {
      running += item.value;
      return running / total * 100;
    });
    return {
      traces: [
        { type: "bar", x: rows.map((d) => d.name), y: rows.map((d) => d.value), text: rows.map((d) => format(d.value)), textposition: "outside", name: "값", marker: { color: rows.map((_, i) => palette[i % palette.length]) } },
        { type: "scatter", x: rows.map((d) => d.name), y: cumulative, yaxis: "y2", mode: "lines+markers+text", text: cumulative.map((v) => `${v.toFixed(0)}%`), textposition: "top center", name: "누적", line: { color: "#2D64A8", width: 3 } },
      ],
      layout: { yaxis: { title: "값" }, yaxis2: { title: "누적 %", overlaying: "y", side: "right", range: [0, 105] }, margin: { b: 100 } },
    };
  }

  function lollipopRank(data) {
    const rows = labelTotals(data).sort((a, b) => a.value - b.value).slice(-12);
    return {
      traces: [
        ...rows.map((item, index) => ({ type: "scatter", mode: "lines", x: [0, item.value], y: [item.name, item.name], line: { color: `${palette[index % palette.length]}88`, width: 6 }, showlegend: false, hoverinfo: "skip" })),
        { type: "scatter", mode: "markers+text", x: rows.map((d) => d.value), y: rows.map((d) => d.name), text: rows.map((d) => format(d.value)), textposition: "middle right", marker: { size: 14, color: rows.map((_, i) => palette[i % palette.length]), line: { color: "#ffffff", width: 2 } }, showlegend: false },
      ],
      layout: { xaxis: { title: "값" }, margin: { l: 130, r: 80, b: 70 } },
    };
  }

  function funnelChart(data) {
    const rows = labelTotals(data).sort((a, b) => b.value - a.value).slice(0, 8);
    return {
      traces: [{ type: "funnel", y: rows.map((d) => d.name), x: rows.map((d) => d.value), textinfo: "value+percent initial", marker: { color: rows.map((_, i) => palette[i % palette.length]) } }],
      layout: { margin: { l: 120, r: 40, t: 60, b: 40 } },
    };
  }

  function donutKpi(data) {
    const rows = seriesTotals(data).sort((a, b) => b.value - a.value);
    const total = rows.reduce((sum, item) => sum + item.value, 0);
    return {
      traces: [{ type: "pie", labels: rows.map((d) => d.name), values: rows.map((d) => d.value), hole: 0.68, textinfo: "label+percent", marker: { colors: palette, line: { color: "#ffffff", width: 2 } } }],
      layout: { annotations: [{ text: `<b>${format(total)}</b><br>합계`, showarrow: false, font: { size: 20, color: "#20323A" } }], margin: { l: 30, r: 30, t: 60, b: 30 } },
    };
  }

  function targetVsActual(data) {
    const rows = labelTotals(data).sort((a, b) => b.value - a.value).slice(0, 10);
    const max = Math.max(...rows.map((d) => d.value), 1);
    return {
      traces: [
        { type: "bar", orientation: "h", y: rows.map((d) => d.name), x: rows.map(() => max), marker: { color: "#EEF4F5" }, hoverinfo: "skip", showlegend: false },
        { type: "bar", orientation: "h", y: rows.map((d) => d.name), x: rows.map((d) => d.value), text: rows.map((d) => format(d.value)), textposition: "outside", marker: { color: rows.map((_, i) => palette[i % palette.length]) }, showlegend: false },
      ],
      layout: { barmode: "overlay", xaxis: { range: [0, max * 1.18] }, margin: { l: 130, r: 70, b: 70 } },
    };
  }

  function contributionHeatmap(data) {
    const totals = labelTotals(data);
    const total = totals.reduce((sum, item) => sum + item.value, 0) || 1;
    const values = totals.map((item) => item.value / total * 100);
    return {
      traces: [{ type: "heatmap", x: totals.map((d) => d.name), y: ["기여도"], z: [values], text: [values.map((v) => `${v.toFixed(1)}%`)], texttemplate: "%{text}", colorscale: [[0, "#F7FCFB"], [0.45, "#B8E6A3"], [1, "#2F95B8"]], showscale: false }],
      layout: { margin: { l: 70, r: 30, t: 60, b: 90 } },
    };
  }

  function seriesTotals(data) {
    return data.series.map((name, index) => ({ name, value: data.values[index].reduce((sum, value) => sum + value, 0) }));
  }

  function labelTotals(data) {
    return data.labels.map((name, index) => ({ name, value: data.values.reduce((sum, row) => sum + (row[index] || 0), 0) }));
  }

  function colorList(values, index) {
    if (Array.isArray(values)) return values.map((_, i) => palette[(index + i) % palette.length]);
    return palette[index % palette.length];
  }

  function format(value) {
    return Number(value || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  }

  function injectPremiumStyle() {
    if (document.querySelector("#premium-polish-style")) return;
    const style = document.createElement("style");
    style.id = "premium-polish-style";
    style.textContent = `
      .app-shell{background:linear-gradient(180deg,#f6faf9 0%,#eef5f3 100%)}
      .controls{background:rgba(255,255,255,.92);backdrop-filter:blur(14px);border-color:#dce9e6}
      .brand h1{letter-spacing:0}.brand p{line-height:1.55}
      .premium-presets{gap:9px}.preset-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .preset-card{min-height:58px;text-align:left;padding:10px;border:1px solid #d9e8e4;border-radius:7px;background:#fbfefd;color:#20323a}
      .preset-card strong{display:block;font-size:13px}.preset-card span{display:block;margin-top:4px;font-size:11px;color:#6b7c83;line-height:1.25}
      .preset-card:hover{border-color:#45B8AC;background:#f3fbf8}
      .chart-card{border:1px solid #dce9e6;box-shadow:0 16px 34px rgba(32,50,58,.08)}
      .chart-card-header{gap:10px;border-bottom:1px solid #edf3f2}
      .chart-badge{margin-left:auto;padding:5px 8px;border-radius:999px;background:#eef8f6;color:#277a73;font-size:11px;font-weight:700;white-space:nowrap}
      .summary-card{border-color:#dce9e6;background:linear-gradient(180deg,#fff,#f9fcfb)}
      .plot{border-radius:6px;overflow:hidden}
    `;
    document.head.appendChild(style);
  }
}());
