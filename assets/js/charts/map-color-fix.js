(function () {
  const VERSION = "20260616-1235";
  const THEMES = {
    Mint: ["#45B8AC", "#B8E6A3", "#2F95B8", "#2D64A8", "#F2B75E", "#E56F76"],
    Ocean: ["#1CA7A8", "#76D7C4", "#247BA0", "#173F5F", "#F6D55C", "#ED553B"],
    Forest: ["#2E7D32", "#81C784", "#A5D6A7", "#546E7A", "#F9A825", "#D84315"],
    Sunset: ["#FF6B6B", "#FFD166", "#F4A261", "#2A9D8F", "#264653", "#8E7AD8"],
    Nord: ["#5E81AC", "#88C0D0", "#A3BE8C", "#EBCB8B", "#D08770", "#B48EAD"],
    Berry: ["#7B2CBF", "#C77DFF", "#FF4D6D", "#FFB3C1", "#00B4D8", "#90E0EF"],
    Slate: ["#334E68", "#627D98", "#9FB3C8", "#38B2AC", "#F6AD55", "#E53E3E"],
    Pastel: ["#8FD6C8", "#B8E6A3", "#9BD7E8", "#F2B75E", "#D88C9A", "#8E7AD8"],
    Bold: ["#006D77", "#83C5BE", "#FFDDD2", "#E29578", "#2D64A8", "#F2B75E"],
    Clean: ["#2F95B8", "#7FC8A9", "#C9EFB7", "#5E6C84", "#F2B75E", "#E56F76"],
  };
  let selectedEditorColors = null;
  let timer = 0;

  ready(() => {
    installEvents();
    scheduleColorSync(400);
    scheduleColorSync(1200);
  });

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function installEvents() {
    if (document.body.dataset.mapColorFix === VERSION) return;
    document.body.dataset.mapColorFix = VERSION;
    document.addEventListener("click", (event) => {
      const palette = event.target.closest?.(".palette-button");
      const theme = event.target.closest?.(".theme-icon");
      if (palette?.dataset.colors) selectedEditorColors = palette.dataset.colors.split("|").filter(Boolean);
      if (theme) selectedEditorColors = null;
      if (event.target.closest?.("#generateBtn,.filter-chip,.theme-icon,.palette-button,.chart-card,.studio-tab")) {
        scheduleColorSync(120);
        scheduleColorSync(520);
      }
    }, true);

    const grid = document.querySelector("#chartGrid");
    if (grid && !grid.dataset.mapColorObserver) {
      grid.dataset.mapColorObserver = VERSION;
      new MutationObserver(() => scheduleColorSync(180)).observe(grid, { childList: true });
    }
  }

  function scheduleColorSync(delay = 120) {
    clearTimeout(timer);
    timer = setTimeout(syncMapColors, delay);
  }

  function syncMapColors() {
    const colors = selectedEditorColors || activeThemeColors();
    document.querySelectorAll(".plot").forEach((plot) => {
      if (!plot.data?.some((trace) => trace.type === "scattergeo")) return;
      plot.data.forEach((trace, index) => {
        if (trace.type !== "scattergeo") return;
        const count = pointCount(trace);
        if (count < 1) return;
        const next = Array.from({ length: count }, (_, colorIndex) => colors[(index + colorIndex) % colors.length]);
        try {
          Plotly.restyle(plot, { "marker.color": [next] }, [index]);
        } catch (_) {}
      });
      delete plot.dataset.mapPolishSignature;
    });
  }

  function activeThemeColors() {
    const active = document.querySelector(".theme-icon.active");
    const name = active?.getAttribute("title") || "Mint";
    return THEMES[name] || THEMES.Mint;
  }

  function pointCount(trace) {
    if (Array.isArray(trace.lat)) return trace.lat.length;
    if (Array.isArray(trace.lon)) return trace.lon.length;
    if (Array.isArray(trace.marker?.size)) return trace.marker.size.length;
    if (Array.isArray(trace.text)) return trace.text.length;
    return 1;
  }
}());
