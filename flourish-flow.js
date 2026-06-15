(function () {
  const VERSION = "20260615-1525";
  ready(() => {
    document.body.classList.add("flourish-flow");
    topBar();
    removeProjectHome();
    removeTemplateGallery();
    dataMapping();
    style();
    observe();
  });
  function ready(fn) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn); else fn(); }
  function topBar() {
    if (document.querySelector(".studio-global-bar")) return;
    document.body.insertAdjacentHTML("afterbegin", '<header class="studio-global-bar"><button type="button" id="homeOpen" class="studio-logo">G2 Studio</button><div class="project-title"><input id="projectTitleInput" value="My visualisation"><span>by G2 Studio</span></div><div class="studio-actions"><button type="button" id="panelToggle">Hide panel</button></div></header>');
    document.querySelector("#homeOpen")?.addEventListener("click", () => showHome(false));
    document.querySelector("#panelToggle")?.addEventListener("click", togglePanel);
  }
  function removeProjectHome() { document.querySelectorAll(".project-home").forEach((node) => node.remove()); showHome(false); }
  function showHome(on) { const home = document.querySelector(".project-home"); const shell = document.querySelector(".app-shell"); if (home) home.hidden = !on; if (shell) shell.hidden = false; }
  function togglePanel() { document.body.classList.toggle("editor-collapsed"); const hidden = document.body.classList.contains("editor-collapsed"); const button = document.querySelector("#panelToggle"); if (button) button.textContent = hidden ? "Show panel" : "Hide panel"; window.dispatchEvent(new Event("resize")); }
  function removeTemplateGallery() { document.querySelectorAll(".template-gallery-board").forEach((node) => node.remove()); }
  function dataMapping() {
    document.addEventListener("click", (event) => { if (event.target.closest?.(".studio-tab[data-view='data']")) setTimeout(renderMapping, 80); });
    document.addEventListener("click", (event) => {
      if (!event.target.closest?.(".studio-tab[data-view='preview']")) return;
      setTimeout(() => {
        const card = document.querySelector(".chart-card.is-selected") || document.querySelector(".chart-card");
        if (card) card.click();
        window.__restoreFinalEditor?.();
        window.dispatchEvent(new Event("resize"));
      }, 120);
    });
    renderMapping();
  }
  function renderMapping() {
    if (document.body.dataset.view !== "data") return;
    const panel = document.querySelector(".final-editor-panel");
    if (!panel || panel.dataset.mapping === VERSION) return;
    panel.dataset.mapping = VERSION;
    panel.innerHTML = '<header><strong>Data</strong><span>Choose columns to visualise.</span><em class="editor-badge">Auto set columns</em></header><section class="editor-section"><h3>Columns</h3>' + mappingRow("Categories / nesting", "A,B") + mappingRow("Size by", "C") + mappingRow("Filter", "D") + mappingRow("Info for popups", "E") + '</section><section class="editor-section"><h3>Preview</h3><div class="mapping-preview"></div></section>';
  }
  function mappingRow(label, value) { return '<label class="mapping-row"><span>' + label + '</span><input value="' + value + '"></label>'; }
  function observe() { const grid = document.querySelector("#chartGrid"); if (!grid) return; new MutationObserver(removeTemplateGallery).observe(grid, { childList: true }); }
  function style() {
    if (document.querySelector("#flourish-flow-style")) return;
    const style = document.createElement("style");
    style.id = "flourish-flow-style";
    style.textContent = `body.flourish-flow{padding-top:64px}.studio-global-bar{position:fixed;inset:0 0 auto 0;height:64px;z-index:40;display:flex;align-items:center;gap:16px;padding:0 16px;background:#050505;color:#fff}.studio-logo{border:0;background:transparent;color:#fff;font-size:22px;font-weight:900;cursor:pointer}.project-title{display:grid;border-left:1px solid #444;padding-left:14px}.project-title input{border:0;background:transparent;color:#fff;font-size:15px;font-weight:800}.project-title span{font-size:11px;color:#bbb}.studio-actions{margin-left:auto;display:flex;gap:8px}.studio-actions button{height:36px;border-radius:5px;border:1px solid #444;background:#2c2c2c;color:#fff;font-weight:800;cursor:pointer}.flourish-flow .app-shell{width:100%!important;max-width:none!important;margin:0!important;padding-left:16px!important;padding-right:16px!important}.flourish-flow .content,.flourish-flow main,.flourish-flow .main-panel{width:100%!important;max-width:none!important}.flourish-flow .workspace{width:100%!important;max-width:none!important;grid-template-columns:minmax(250px,300px) minmax(680px,1fr) minmax(360px,400px)!important}.flourish-flow.editor-collapsed .workspace{grid-template-columns:minmax(250px,300px) minmax(0,1fr)!important}.flourish-flow #chartGrid{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))!important;align-items:stretch!important}.flourish-flow .chart-card{min-height:400px!important}.flourish-flow .chart-card .plot{min-height:292px!important}.project-home,.template-gallery-board{display:none!important}.mapping-row{display:grid;grid-template-columns:1fr 72px;align-items:center;gap:8px;font-size:12px;font-weight:800}.mapping-row input{height:28px;border:1px solid #ddd;border-radius:5px;text-align:center;background:#f8e1ef}.mapping-preview{height:130px;border-radius:5px;background:linear-gradient(135deg,#2563eb,#4ade80 60%,#f97316);opacity:.9}`;
    document.head.appendChild(style);
  }
}());
