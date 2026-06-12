(function () {
  if (typeof window.chartSpecs !== "function") return;

  const ALL = "전체";
  const previous = window.chartSpecs;
  const themes = [
    ["Mint", ["#45B8AC", "#B8E6A3", "#2F95B8", "#2D64A8", "#F2B75E", "#E56F76"]],
    ["Ocean", ["#1CA7A8", "#76D7C4", "#247BA0", "#173F5F", "#F6D55C", "#ED553B"]],
    ["Forest", ["#2E7D32", "#81C784", "#A5D6A7", "#546E7A", "#F9A825", "#D84315"]],
    ["Sunset", ["#FF6B6B", "#FFD166", "#F4A261", "#2A9D8F", "#264653", "#8E7AD8"]],
    ["Nord", ["#5E81AC", "#88C0D0", "#A3BE8C", "#EBCB8B", "#D08770", "#B48EAD"]],
    ["Berry", ["#7B2CBF", "#C77DFF", "#FF4D6D", "#FFB3C1", "#00B4D8", "#90E0EF"]],
    ["Slate", ["#334E68", "#627D98", "#9FB3C8", "#38B2AC", "#F6AD55", "#E53E3E"]],
    ["Pastel", ["#8FD6C8", "#B8E6A3", "#9BD7E8", "#F2B75E", "#D88C9A", "#8E7AD8"]],
    ["Bold", ["#006D77", "#83C5BE", "#FFDDD2", "#E29578", "#2D64A8", "#F2B75E"]],
    ["Clean", ["#2F95B8", "#7FC8A9", "#C9EFB7", "#5E6C84", "#F2B75E", "#E56F76"]],
  ].map(([name, colors]) => ({ name, colors }));
  let theme = themes[0];

  const remap = {
    "Butterfly Compare": ["BAR", "Butterfly Compare"],
    "Progress Bar": ["BAR", "Progress Bar"],
    "Floating Waterfall": ["BAR", "Floating Waterfall"],
    "Half Donut": ["PIE", "Half Donut"],
    "Value Projection": ["RANGE", "Value Projection"],
    "Gauge Cards": ["RADIAL", "Gauge Cards"],
    "Radial Rings": ["RADIAL", "Radial Rings"],
    "Timeline Dots": ["TIMELINE", "Timeline Dots"],
    "Profile Lines": ["LINE", "Profile Lines"],
    "Alluvial Before After": ["FLOW", "Alluvial Before After"],
  };

  const wanted = [
    ["BAR", "그룹 막대"],
    ["BAR", "누적 막대"],
    ["BAR", "가로 순위 막대"],
    ["BAR", "플로팅 컬럼"],
    ["BAR", "Progress Bar"],
    ["BAR", "Floating Waterfall"],
    ["LINE", "기본 추이"],
    ["LINE", "부드러운 추이"],
    ["LINE", "슬로프 차트"],
    ["LINE", "Profile Lines"],
    ["AREA", "누적 면적"],
    ["AREA", "100% 누적 면적"],
    ["SCATTER", "버블 산점"],
    ["SCATTER", "사분면 산점"],
    ["PIE", "도넛"],
    ["PIE", "중첩 도넛"],
    ["PIE", "Half Donut"],
    ["HEATMAP", "주석 매트릭스"],
    ["HEATMAP", "정규화 히트맵"],
    ["RANGE", "범위 밴드"],
    ["RANGE", "Value Projection"],
    ["RADIAL", "Gauge Cards"],
    ["RADIAL", "Radial Rings"],
    ["TIMELINE", "Timeline Dots"],
    ["FLOW", "Alluvial Before After"],
    ["TEXT", "Word Cloud"],
    ["GEO", "지역 지도"],
    ["GEO", "지도 버블"],
  ];

  window.chartSpecs = function chartSpecs() {
    const source = previous().map(normalize);
    const specs = wanted.map(([group, label]) => {
      if (group === "TEXT") return { group, label, build: wordCloud };
      if (group === "GEO" && label === "지역 지도") return { group, label, build: geoMap };
      if (group === "GEO" && label === "지도 버블") return { group, label, build: geoBubble };
      return source.find((item) => item.group === group && item.label === label) || null;
    }).filter(Boolean);
    const numbered = numberByGroup(uniqueByGroupLabel(specs));
    const appHasNativeAll = typeof window.renderCharts === "function" && String(window.renderCharts).includes("ALL_CHART_GROUP");
    if (appHasNativeAll) return numbered;
    return [
      ...numbered.map((item, index) => ({ ...item, group: ALL, number: index + 1, label: `${item.group} · ${item.label}` })),
      ...numbered,
    ];
  };

  window.addEventListener("DOMContentLoaded", () => {
    injectStyle();
    installThemePicker();
    setTimeout(cleanSelect, 20);
  });

  function normalize(item) {
    const mapped = item.group === "VIZZLO" ? remap[item.label] : null;
    return {
      ...item,
      group: mapped ? mapped[0] : item.group,
      label: mapped ? mapped[1] : item.label,
      build: (data) => styleChart(item.build(data)),
    };
  }

  function uniqueByGroupLabel(specs) {
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

  function installThemePicker() {
    const anchor = document.querySelector("#chartGroup")?.closest(".field");
    if (!anchor || document.querySelector("#themeIcons")) return;
    const field = document.createElement("div");
    field.className = "field theme-field";
    field.innerHTML = '<label>색상 테마</label><div id="themeIcons" class="theme-icons" role="list"></div>';
    anchor.insertAdjacentElement("afterend", field);
    renderThemeIcons();
  }

  function renderThemeIcons() {
    const box = document.querySelector("#themeIcons");
    if (!box) return;
    box.innerHTML = "";
    themes.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `theme-icon${item === theme ? " active" : ""}`;
      button.title = item.name;
      button.setAttribute("aria-label", `${item.name} 색상 테마`);
      button.innerHTML = item.colors.slice(0, 4).map((color) => `<span style="background:${color}"></span>`).join("");
      button.addEventListener("click", () => {
        theme = item;
        renderThemeIcons();
        if (document.querySelectorAll(".chart-card").length) document.querySelector("#generateBtn")?.click();
      });
      box.appendChild(button);
    });
  }

  function cleanSelect() {
    const select = document.querySelector("#chartGroup");
    if (!select) return;
    [...select.options].forEach((option) => {
      if (option.value === "ALL" || option.value === "VIZZLO" || option.textContent === "VIZZLO") option.remove();
    });
    if (select.value === "ALL" || select.value === "VIZZLO") select.value = "";
  }

  function styleChart(chart) {
    const layout = chart.layout || {};
    return {
      traces: (chart.traces || []).map(styleTrace),
      layout: {
        ...layout,
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        colorway: theme.colors,
        font: { family: "Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, Arial", color: "#21313A" },
        hoverlabel: { bgcolor: "#21313A", bordercolor: "#21313A", font: { color: "#ffffff" } },
        legend: { orientation: "h", x: 0, y: -0.22, font: { size: 10, color: "#5E6C84" }, ...(layout.legend || {}) },
        xaxis: axis(layout.xaxis),
        yaxis: axis(layout.yaxis),
      },
    };
  }

  function styleTrace(trace, index) {
    const next = { ...trace };
    const color = theme.colors[index % theme.colors.length];
    const values = traceValues(next);
    if (["bar", "waterfall", "barpolar"].includes(next.type)) {
      next.marker = { ...(next.marker || {}), color: colorsFor(next, index), line: { color: "#ffffff", width: 1 } };
      addValueText(next, values, next.orientation === "h" ? "outside" : "auto");
    }
    if (["scatter", "scatterpolar", "scattergeo"].includes(next.type)) {
      next.line = { ...(next.line || {}), color, width: next.line?.width || 2.4 };
      next.marker = { ...(next.marker || {}), color: colorsFor(next, index), size: next.marker?.size || 9, line: { color: "#ffffff", width: 1 } };
      if (next.mode && !String(next.mode).includes("text")) next.mode = `${next.mode}+text`;
      addValueText(next, values, next.type === "scattergeo" ? "top center" : "top center");
    }
    if (next.type === "pie") {
      next.marker = { ...(next.marker || {}), colors: pieColors(next.marker?.colors), line: { color: "#ffffff", width: 2 } };
      next.textinfo = "label+value+percent";
      next.insidetextorientation = "radial";
    }
    if (next.type === "heatmap") {
      next.colorscale = [[0, "#F7FCFB"], [0.35, "#DDF3EC"], [0.7, theme.colors[1]], [1, theme.colors[0]]];
      if (!next.text) next.text = Array.isArray(next.z) ? next.z.map((row) => row.map(format)) : undefined;
      next.texttemplate = "%{text}";
      next.textfont = { color: "#21313A", size: 11 };
    }
    if (next.type === "choropleth") {
      next.colorscale = [[0, "#F7FCFB"], [0.35, "#DDF3EC"], [0.7, theme.colors[1]], [1, theme.colors[0]]];
      next.marker = { line: { color: "#ffffff", width: 0.8 }, ...(next.marker || {}) };
    }
    if (next.type === "indicator" && next.gauge) {
      next.gauge = { ...next.gauge, bar: { ...(next.gauge.bar || {}), color }, bgcolor: "#F4FAF8" };
    }
    return next;
  }

  function addValueText(trace, values, position) {
    if (!values || values.length === 0) return;
    trace.text = values.map(format);
    trace.textposition = position;
    trace.textfont = { color: "#21313A", size: 11, ...(trace.textfont || {}) };
  }

  function traceValues(trace) {
    if (trace.type === "barpolar") return trace.r;
    if (trace.type === "scattergeo") return trace.marker?.size;
    if (trace.orientation === "h") return trace.x;
    return trace.y || trace.r || trace.z;
  }

  function colorsFor(trace, index) {
    const count = Array.isArray(trace.x) ? trace.x.length : Array.isArray(trace.y) ? trace.y.length : 0;
    if (count > 1 && Array.isArray(trace.marker?.color)) {
      return trace.marker.color.map((_, colorIndex) => theme.colors[(index + colorIndex) % theme.colors.length]);
    }
    return theme.colors[index % theme.colors.length];
  }

  function pieColors(colors) {
    if (!Array.isArray(colors)) return theme.colors;
    return colors.map((color, index) => String(color).includes("rgba(0,0,0,0)") ? color : theme.colors[index % theme.colors.length]);
  }

  function axis(axisLayout = {}) {
    return {
      showline: true,
      linecolor: "#B8C8C5",
      gridcolor: "#E5F0EE",
      zerolinecolor: "#C8D6D3",
      tickfont: { size: 10, color: "#5E6C84" },
      titlefont: { size: 11, color: "#21313A" },
      automargin: true,
      ...axisLayout,
    };
  }

  function wordCloud(data) {
    const words = combinedTotals(data).filter((item) => item.text && item.value > 0).sort((a, b) => b.value - a.value).slice(0, 48);
    const max = Math.max(...words.map((item) => item.value), 1);
    const points = words.map((_, index) => spiral(index));
    return {
      traces: [{
        type: "scatter",
        mode: "text",
        x: points.map((point) => point.x),
        y: points.map((point) => point.y),
        text: words.map((item) => `${item.text}<br>${format(item.value)}`),
        textfont: {
          size: words.map((item) => 14 + (item.value / max) * 34),
          color: words.map((_, index) => theme.colors[index % theme.colors.length]),
        },
        hovertext: words.map((item) => `${item.text}: ${format(item.value)}`),
        hoverinfo: "text",
        showlegend: false,
      }],
      layout: { xaxis: { visible: false }, yaxis: { visible: false, scaleanchor: "x" }, margin: { l: 20, r: 20, t: 55, b: 20 } },
    };
  }

  function geoMap(data) {
    const totals = labelTotals(data);
    return styleChart({
      traces: [{
        type: "choropleth",
        locationmode: "country names",
        locations: totals.map((item) => item.name),
        z: totals.map((item) => item.value),
        text: totals.map((item) => `${item.name}: ${format(item.value)}`),
        hoverinfo: "text",
        colorbar: { title: "값" },
      }],
      layout: {
        geo: {
          scope: "world",
          projection: { type: "natural earth" },
          showframe: false,
          showcoastlines: false,
          landcolor: "#E7ECEF",
          bgcolor: "#ffffff",
        },
        margin: { l: 20, r: 20, t: 55, b: 20 },
        annotations: totals.slice(0, 8).map((item, index) => ({
          xref: "paper",
          yref: "paper",
          x: 0.02,
          y: 0.95 - index * 0.055,
          text: `${item.name} ${format(item.value)}`,
          showarrow: false,
          align: "left",
          font: { size: 11, color: "#21313A" },
        })),
      },
    });
  }

  function geoBubble(data) {
    const rows = labelTotals(data).map((item, index) => ({ ...item, coord: coordinate(item.name, index) }));
    const max = Math.max(...rows.map((item) => item.value), 1);
    return styleChart({
      traces: [{
        type: "scattergeo",
        mode: "markers+text",
        lon: rows.map((item) => item.coord.lon),
        lat: rows.map((item) => item.coord.lat),
        text: rows.map((item) => `${item.name}<br>${format(item.value)}`),
        textposition: "top center",
        marker: {
          size: rows.map((item) => 10 + (item.value / max) * 34),
          color: rows.map((_, index) => theme.colors[index % theme.colors.length]),
          opacity: 0.78,
        },
        hovertext: rows.map((item) => `${item.name}: ${format(item.value)}`),
        hoverinfo: "text",
      }],
      layout: {
        geo: {
          scope: "asia",
          projection: { type: "mercator" },
          showland: true,
          landcolor: "#E7ECEF",
          countrycolor: "#ffffff",
          coastlinecolor: "#ffffff",
          bgcolor: "#ffffff",
        },
        margin: { l: 20, r: 20, t: 55, b: 20 },
      },
    });
  }

  function combinedTotals(data) {
    const totals = [];
    data.series.forEach((series, rowIndex) => totals.push({ text: series, value: data.values[rowIndex].reduce((sum, value) => sum + value, 0) }));
    data.labels.forEach((label, colIndex) => totals.push({ text: label, value: data.values.reduce((sum, row) => sum + row[colIndex], 0) }));
    return totals;
  }

  function labelTotals(data) {
    return data.labels.map((name, index) => ({ name, value: data.values.reduce((sum, row) => sum + (row[index] || 0), 0) }));
  }

  function coordinate(name, index) {
    const key = String(name).trim().toLowerCase();
    const map = {
      "서울": [37.5665, 126.9780], "seoul": [37.5665, 126.9780],
      "부산": [35.1796, 129.0756], "busan": [35.1796, 129.0756],
      "대구": [35.8714, 128.6014], "daegu": [35.8714, 128.6014],
      "인천": [37.4563, 126.7052], "incheon": [37.4563, 126.7052],
      "광주": [35.1595, 126.8526], "gwangju": [35.1595, 126.8526],
      "대전": [36.3504, 127.3845], "daejeon": [36.3504, 127.3845],
      "울산": [35.5384, 129.3114], "ulsan": [35.5384, 129.3114],
      "세종": [36.4800, 127.2890], "경기": [37.4138, 127.5183],
      "강원": [37.8228, 128.1555], "충북": [36.8000, 127.7000],
      "충남": [36.5184, 126.8000], "전북": [35.7175, 127.1530],
      "전남": [34.8679, 126.9910], "경북": [36.4919, 128.8889],
      "경남": [35.4606, 128.2132], "제주": [33.4996, 126.5312],
      "china": [35.8617, 104.1954], "japan": [36.2048, 138.2529],
      "korea": [36.5, 127.8], "south korea": [36.5, 127.8],
      "usa": [37.0902, -95.7129], "united states": [37.0902, -95.7129],
      "france": [46.2276, 2.2137], "germany": [51.1657, 10.4515],
    };
    const found = map[key];
    if (found) return { lat: found[0], lon: found[1] };
    const angle = index * 0.9;
    return { lat: 36.2 + Math.sin(angle) * 3.8, lon: 127.8 + Math.cos(angle) * 4.8 };
  }

  function spiral(index) {
    if (index === 0) return { x: 0, y: 0 };
    const angle = index * 2.399963;
    const radius = 0.12 * Math.sqrt(index);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  function format(value) {
    return Number(value || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  }

  function injectStyle() {
    if (document.querySelector("#chart-theme-style")) return;
    const style = document.createElement("style");
    style.id = "chart-theme-style";
    style.textContent = ".theme-field{gap:8px}.theme-icons{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}.theme-icon{height:34px;display:grid;grid-template-columns:repeat(4,1fr);gap:0;overflow:hidden;padding:0;border:1px solid rgba(22,34,45,.16);border-radius:5px;background:#fff;cursor:pointer}.theme-icon span{display:block;height:100%}.theme-icon:hover{transform:translateY(-1px);box-shadow:0 6px 14px rgba(22,34,45,.12)}.theme-icon.active{outline:2px solid var(--accent);outline-offset:2px}";
    document.head.appendChild(style);
  }
}());
