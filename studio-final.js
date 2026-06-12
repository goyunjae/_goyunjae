(function () {
  let selectedCard = null;

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  function boot() {
    simplifyTemplatePicker();
    installSelectedChartEditor();
    setTimeout(simplifyTemplatePicker, 200);
    setTimeout(simplifyTemplatePicker, 900);
  }

  function simplifyTemplatePicker() {
    document.querySelectorAll(".premium-presets").forEach((panel) => panel.remove());
    document.querySelectorAll("#chartPresets").forEach((panel) => panel.closest(".field")?.remove());
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      if (chip.textContent.trim().toLowerCase() === "all") chip.remove();
    });
    document.querySelectorAll(".filter-by .filter-chip[data-value='__ALL__']").forEach((chip) => {
      chip.dataset.value = "__SOURCE__";
      chip.dataset.enabled = "false";
      chip.classList.remove("active");
      chip.setAttribute("aria-disabled", "true");
    });
    const select = document.querySelector("#chartGroup");
    if (!select) return;
    Array.from(select.options).forEach((option) => {
      if (option.value === "__ALL__" || option.value === "ALL") option.remove();
    });
    if (select.value === "__ALL__" || select.value === "ALL") select.value = "";
    if (!select.dataset.finalNoAllObserver) {
      select.dataset.finalNoAllObserver = "true";
      new MutationObserver(() => simplifyTemplatePicker()).observe(select, { childList: true });
    }
  }

  function installSelectedChartEditor() {
    const grid = document.querySelector("#chartGrid");
    if (!grid || grid.dataset.finalInspector) return;
    grid.dataset.finalInspector = "true";
    grid.addEventListener("click", (event) => {
      if (event.target.closest("button,input,label,select,textarea")) return;
      const card = event.target.closest(".chart-card");
      if (card) selectCard(card);
    });
    new MutationObserver(() => {
      decorateCards();
      if (!selectedCard || !document.body.contains(selectedCard)) selectCard(document.querySelector(".chart-card"), false);
    }).observe(grid, { childList: true, subtree: true });
    decorateCards();
  }

  function decorateCards() {
    document.querySelectorAll(".chart-card").forEach((card) => {
      if (card.dataset.finalInspectable) return;
      card.dataset.finalInspectable = "true";
      card.tabIndex = 0;
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectCard(card);
        }
      });
    });
  }

  function selectCard(card, focusPanel = true) {
    if (!card) return;
    selectedCard = card;
    document.querySelectorAll(".chart-card.is-selected").forEach((item) => item.classList.remove("is-selected"));
    card.classList.add("is-selected");
    renderPanel();
    if (focusPanel) document.querySelector(".chart-editor-panel")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function renderPanel() {
    const panel = document.querySelector(".chart-editor-panel");
    if (!panel) return;
    let badge = panel.querySelector(".selected-chart-badge");
    if (!badge) {
      panel.querySelector("header")?.insertAdjacentHTML("beforeend", '<span class="selected-chart-badge"></span>');
      badge = panel.querySelector(".selected-chart-badge");
    }
    const title = selectedCard?.querySelector(".chart-card-header h3")?.textContent?.trim() || "Click a chart";
    badge.textContent = `Editing: ${title}`;

    let tools = panel.querySelector(".selected-chart-tools");
    if (!tools) {
      panel.querySelector("header")?.insertAdjacentHTML("afterend", '<section class="selected-chart-tools"></section>');
      tools = panel.querySelector(".selected-chart-tools");
    }
    const plot = selectedCard?.querySelector(".plot");
    const kind = chartKind(plot);
    panel.dataset.inspectorType = kind;
    tools.innerHTML = markup(kind, plot);
    tools.querySelector("#applySelectedChart")?.addEventListener("click", applyChartEdits);
    if (kind === "geo") hydrateStationBox(plot);
  }

  function chartKind(plot) {
    if (!plot?.data) return "empty";
    if (plot.data.some((trace) => trace.type === "scattergeo")) return "geo";
    if (plot.data.some((trace) => trace.type === "bar" || trace.type === "waterfall")) return "bar";
    if (plot.data.some((trace) => trace.type === "pie")) return "pie";
    if (plot.data.some((trace) => trace.type === "scatter" && String(trace.mode || "").includes("text"))) return "text";
    return "default";
  }

  function markup(kind, plot) {
    if (kind === "bar") {
      const barmode = plot?._fullLayout?.barmode || plot?.layout?.barmode || "group";
      const bargap = plot?._fullLayout?.bargap ?? plot?.layout?.bargap ?? 0.18;
      const textPosition = firstTraceValue(plot, "textposition", "auto");
      return [
        '<h3>Bar editor</h3>',
        '<div class="editor-field"><label for="barMode">Bar mode</label><select id="barMode">',
        opt("group", "Grouped", barmode),
        opt("stack", "Stacked", barmode),
        opt("relative", "Positive / negative", barmode),
        '</select></div>',
        `<div class="editor-field"><label for="barGap">Bar gap</label><input id="barGap" type="range" min="0" max="0.8" step="0.02" value="${Number(bargap).toFixed(2)}" /></div>`,
        '<div class="editor-field"><label for="barTextPosition">Value labels</label><select id="barTextPosition">',
        opt("auto", "Auto", textPosition),
        opt("outside", "Outside", textPosition),
        opt("inside", "Inside", textPosition),
        opt("none", "Hide", textPosition),
        '</select></div>',
        '<button type="button" id="applySelectedChart">Apply bar edits</button>',
      ].join("");
    }
    if (kind === "geo") return '<h3>Bubble map editor</h3><p class="tool-note">Edit bubble coordinates below. The base map stays fixed.</p>';
    if (kind === "pie") return '<h3>Pie editor</h3><p class="tool-note">Pie-specific editing will appear here.</p>';
    if (kind === "text") return '<h3>Text chart editor</h3><p class="tool-note">Use theme swatches to update text colors.</p>';
    return '<h3>Chart editor</h3><p class="tool-note">Click a chart to show its edit controls.</p>';
  }

  function applyChartEdits() {
    const plot = selectedCard?.querySelector(".plot");
    if (!plot || !window.Plotly || chartKind(plot) !== "bar") return;
    const barmode = document.querySelector("#barMode")?.value || "group";
    const bargap = Number(document.querySelector("#barGap")?.value || 0.18);
    const textposition = document.querySelector("#barTextPosition")?.value || "auto";
    const indexes = [];
    plot.data.forEach((trace, index) => {
      if (trace.type === "bar" || trace.type === "waterfall") indexes.push(index);
    });
    try { window.Plotly.relayout(plot, { barmode, bargap }); } catch (_) {}
    try { window.Plotly.restyle(plot, { textposition }, indexes); } catch (_) {}
  }

  function hydrateStationBox(plot) {
    const box = document.querySelector("#stationCoords");
    const trace = plot?.data?.find((item) => item.type === "scattergeo");
    if (!box || !trace) return;
    const rows = Array.from(trace.text || trace.hovertext || []).map((value, index) => {
      const name = String(value).split("<br>")[0].split(":")[0].trim();
      const lat = trace.lat?.[index];
      const lon = trace.lon?.[index];
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
      return `${name},${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
    }).filter(Boolean);
    if (rows.length) box.value = rows.join("\n");
  }

  function firstTraceValue(plot, key, fallback) {
    const found = plot?.data?.find((trace) => trace[key] != null)?.[key];
    return Array.isArray(found) ? found[0] || fallback : found || fallback;
  }

  function opt(value, label, selected) {
    return `<option value="${value}"${String(selected) === value ? " selected" : ""}>${label}</option>`;
  }
}());
