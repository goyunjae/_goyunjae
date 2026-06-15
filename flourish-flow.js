(function () {
  const VERSION = "20260615-1115";

  ready(() => {
    document.body.classList.add("flourish-flow");
    topBar();
    projectHome();
    templateGallery();
    dataMapping();
    storyModal();
    style();
    observe();
  });

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function topBar() {
    if (document.querySelector(".studio-global-bar")) return;
    document.body.insertAdjacentHTML("afterbegin", [
      '<header class="studio-global-bar">',
      '<button type="button" id="homeOpen" class="studio-logo">G2 Studio</button>',
      '<div class="project-title"><input id="projectTitleInput" value="My visualisation" /><span>by G2 Studio</span></div>',
      '<div class="studio-actions">',
      '<button type="button" id="shareBtn">Share</button>',
      '<button type="button" id="storyBtn">Create a story</button>',
      '<button type="button" id="publishBtn">Export & publish</button>',
      '</div>',
      '</header>',
    ].join(""));
    document.querySelector("#homeOpen")?.addEventListener("click", () => showHome(true));
    document.querySelector("#shareBtn")?.addEventListener("click", () => openModal("Share", "Private preview link copied for this report workspace."));
    document.querySelector("#storyBtn")?.addEventListener("click", openStory);
    document.querySelector("#publishBtn")?.addEventListener("click", () => openModal("Export & publish", "Use the existing selected chart download buttons, or publish this preview as a report story."));
  }

  function projectHome() {
    if (document.querySelector(".project-home")) return;
    document.body.insertAdjacentHTML("beforeend", [
      '<section class="project-home" hidden>',
      '<div class="project-home-head"><strong>My projects</strong><button type="button" id="homeClose">Open editor</button></div>',
      '<aside class="project-nav"><button class="active">My projects</button><button>Drafts</button><button>Maps</button><button>Published projects</button><button>All projects</button></aside>',
      '<main class="project-grid">',
      projectCard("Income per country", "sunburst"),
      projectCard("Audience Growth", "bar"),
      projectCard("Growth", "folder"),
      '</main>',
      '</section>',
    ].join(""));
    document.querySelector("#homeClose")?.addEventListener("click", () => showHome(false));
    document.querySelectorAll(".project-card").forEach((card) => {
      card.addEventListener("click", () => {
        showHome(false);
        if (card.dataset.type === "bar") choose("BAR");
        else if (card.dataset.type === "sunburst") choose("PIE");
      });
    });
  }

  function projectCard(title, type) {
    return '<button type="button" class="project-card" data-type="' + type + '"><span class="project-thumb ' + type + '"></span><b>' + title + '</b></button>';
  }

  function showHome(on) {
    const home = document.querySelector(".project-home");
    const shell = document.querySelector(".app-shell");
    if (home) home.hidden = !on;
    if (shell) shell.hidden = on;
  }

  function templateGallery() {
    const content = document.querySelector(".content");
    if (!content || document.querySelector(".template-gallery-board")) return;
    content.insertAdjacentHTML("afterbegin", [
      '<section class="template-gallery-board">',
      '<div class="gallery-head"><strong>Choose a template</strong><span>Select a card, then generate a preview.</span></div>',
      '<div class="template-group"><h3>Line, bar and pie charts</h3><div class="template-card-row">',
      template("Line chart", "LINE"), template("Area chart", "AREA"), template("Bar chart", "BAR"), template("Column + line", "BAR"), template("Pie / donut", "PIE"),
      '</div></div>',
      '<div class="template-group"><h3>Maps and hierarchy</h3><div class="template-card-row">',
      template("Bubble map", "GEO"), template("Treemap", "TREEMAP"), template("Radial", "RADIAL"), template("Funnel", "FUNNEL"), template("Text cloud", "TEXT"),
      '</div></div>',
      '</section>',
    ].join(""));
    document.querySelectorAll(".template-tile").forEach((tile) => {
      tile.addEventListener("click", () => {
        choose(tile.dataset.type);
        document.querySelector(".template-gallery-board")?.classList.add("is-picked");
      });
    });
  }

  function template(title, type) {
    return '<button type="button" class="template-tile" data-type="' + type + '"><span class="mini-chart ' + type.toLowerCase() + '"></span><b>' + title + '</b></button>';
  }

  function choose(type) {
    const select = document.querySelector("#chartGroup");
    if (!select) return;
    const option = Array.from(select.options).find((item) => item.value === type);
    if (!option) return;
    select.value = type;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.value === type));
    document.querySelector("#generateBtn")?.focus();
  }

  function dataMapping() {
    document.addEventListener("click", (event) => {
      if (!event.target.closest?.(".studio-tab[data-view='data']")) return;
      setTimeout(renderMapping, 80);
    });
    document.addEventListener("click", (event) => {
      if (!event.target.closest?.(".studio-tab[data-view='preview']")) return;
      setTimeout(() => window.dispatchEvent(new Event("resize")), 80);
    });
    renderMapping();
  }

  function renderMapping() {
    if (document.body.dataset.view !== "data") return;
    const panel = document.querySelector(".chart-editor-panel");
    if (!panel || panel.dataset.mapping === VERSION) return;
    panel.dataset.mapping = VERSION;
    panel.innerHTML = [
      '<header><strong>Data</strong><span>Choose columns to visualise.</span><em class="editor-badge">Auto set columns</em></header>',
      '<section class="editor-section"><h3>Columns</h3>',
      mappingRow("Categories / nesting", "A,B"), mappingRow("Size by", "C"), mappingRow("Filter", "D"), mappingRow("Info for popups", "E"),
      '</section>',
      '<section class="editor-section"><h3>Preview</h3><div class="mapping-preview"></div></section>',
    ].join("");
  }

  function mappingRow(label, value) {
    return '<label class="mapping-row"><span>' + label + '</span><input value="' + value + '" /></label>';
  }

  function observe() {
    const grid = document.querySelector("#chartGrid");
    if (!grid) return;
    new MutationObserver(() => {
      document.querySelector(".template-gallery-board")?.classList.toggle("has-output", Boolean(grid.children.length));
    }).observe(grid, { childList: true });
  }

  function storyModal() {
    if (document.querySelector(".studio-modal")) return;
    document.body.insertAdjacentHTML("beforeend", '<dialog class="studio-modal"><form method="dialog"><button class="modal-close">Close</button><div class="modal-body"></div></form></dialog>');
  }

  function openModal(title, text) {
    const modal = document.querySelector(".studio-modal");
    modal.querySelector(".modal-body").innerHTML = '<h2>' + title + '</h2><p>' + text + '</p>';
    modal.showModal();
  }

  function openStory() {
    const selected = document.querySelector(".chart-card.is-selected") || document.querySelector(".chart-card");
    const title = selected?.querySelector(".chart-card-header h3")?.textContent || "Report story";
    const modal = document.querySelector(".studio-modal");
    modal.querySelector(".modal-body").innerHTML = [
      '<h2>Story preview</h2>',
      '<div class="story-preview">',
      '<aside><b>Your Feed</b><span>Home</span><span>Search</span><span>Explore</span><span>Messages</span></aside>',
      '<article><div class="story-chart">' + title + '</div><p><b>G2 Studio</b> This chart is ready to share as a report story.</p></article>',
      '</div>',
    ].join("");
    modal.showModal();
  }

  function style() {
    if (document.querySelector("#flourish-flow-style")) return;
    const style = document.createElement("style");
    style.id = "flourish-flow-style";
    style.textContent = `
      body.flourish-flow{padding-top:64px}
      .studio-global-bar{position:fixed;inset:0 0 auto 0;height:64px;z-index:40;display:flex;align-items:center;gap:16px;padding:0 16px;background:#050505;color:#fff}
      .studio-logo{border:0;background:transparent;color:#fff;font-size:22px;font-weight:900;cursor:pointer}.project-title{display:grid;border-left:1px solid #444;padding-left:14px}.project-title input{border:0;background:transparent;color:#fff;font-size:15px;font-weight:800}.project-title span{font-size:11px;color:#bbb}.studio-actions{margin-left:auto;display:flex;gap:8px}.studio-actions button,.project-home-head button{height:36px;border-radius:5px;border:1px solid #444;background:#2c2c2c;color:#fff;font-weight:800;cursor:pointer}.studio-actions #publishBtn,.project-home-head button{background:#fff;color:#111;border-color:#fff}
      .project-home{position:fixed;inset:64px 0 0 0;z-index:35;display:grid;grid-template-columns:260px 1fr;grid-template-rows:74px 1fr;background:#f6f6f6;padding:24px 32px;gap:0 24px}.project-home[hidden]{display:none}.project-home-head{grid-column:1/-1;display:flex;align-items:center;gap:14px}.project-home-head strong{font-size:24px}.project-nav{display:grid;align-content:start;gap:8px}.project-nav button{height:34px;border:0;border-radius:4px;background:transparent;text-align:left;font-size:14px}.project-nav button.active{background:#ddd}.project-grid{display:flex;gap:24px;align-items:start}.project-card{width:166px;height:150px;border:1px solid #d5d5d5;border-radius:5px;background:#fff;display:grid;gap:8px;padding:8px;text-align:left;cursor:pointer}.project-thumb{height:92px;border-radius:4px;background:linear-gradient(135deg,#6aa8ff,#a879ff,#f97399)}.project-thumb.bar{background:linear-gradient(90deg,#3b82f6 20%,transparent 20%),linear-gradient(90deg,#60a5fa 45%,transparent 45%),linear-gradient(90deg,#2563eb 70%,transparent 70%);background-color:#eef2ff}.project-thumb.folder{background:#999;clip-path:polygon(20% 25%,42% 25%,50% 35%,80% 35%,80% 72%,20% 72%)}
      .template-gallery-board{display:grid;gap:18px;margin-bottom:18px}.template-gallery-board.has-output{display:none}.gallery-head{display:grid;gap:4px;border-bottom:1px solid #ddd;padding-bottom:10px}.gallery-head strong{font-size:24px}.gallery-head span{color:#697586}.template-group{border:1px solid #d6d6d6;border-radius:5px;background:#fff;padding:16px}.template-group h3{margin:0 0 10px}.template-card-row{display:flex;flex-wrap:wrap;gap:10px}.template-tile{width:146px;border:1px solid #ccc;border-radius:4px;background:#fff;padding:5px;display:grid;gap:6px;cursor:pointer}.template-tile b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mini-chart{height:84px;border-radius:3px;background:linear-gradient(160deg,#edf2ff,#fff)}.mini-chart.bar{background:repeating-linear-gradient(90deg,#60a5fa 0 12px,transparent 12px 20px),linear-gradient(#fff,#eff6ff)}.mini-chart.line{background:linear-gradient(145deg,transparent 48%,#2563eb 49%,#2563eb 52%,transparent 53%),#fff}.mini-chart.area{background:linear-gradient(145deg,transparent 30%,rgba(59,130,246,.35) 31%,rgba(59,130,246,.35) 80%,transparent 81%)}.mini-chart.geo{background:radial-gradient(circle at 55% 45%,#2f6cea 0 5px,transparent 6px),radial-gradient(circle at 35% 55%,#2bb3a3 0 4px,transparent 5px),#eef2f7}.mini-chart.pie,.mini-chart.radial{background:conic-gradient(#2f6cea,#2bb3a3,#f97316,#8b5cf6,#2f6cea);border-radius:50%;width:84px;margin:auto}
      .mapping-row{display:grid;grid-template-columns:1fr 72px;align-items:center;gap:8px;font-size:12px;font-weight:800}.mapping-row input{height:28px;border:1px solid #ddd;border-radius:5px;text-align:center;background:#f8e1ef}.mapping-preview{height:130px;border-radius:5px;background:linear-gradient(135deg,#2563eb,#4ade80 60%,#f97316);opacity:.9}
      .studio-modal{width:min(960px,92vw);border:0;border-radius:8px;padding:0}.studio-modal::backdrop{background:rgba(0,0,0,.35)}.studio-modal form{margin:0}.modal-close{float:right;margin:12px}.modal-body{padding:28px}.story-preview{display:grid;grid-template-columns:220px 1fr;border:1px solid #ddd}.story-preview aside{display:grid;align-content:start;gap:22px;padding:24px;border-right:1px solid #ddd}.story-preview aside b{font-size:24px}.story-preview article{padding:28px}.story-chart{height:360px;border:1px solid #ddd;border-radius:6px;display:grid;place-items:center;background:linear-gradient(135deg,#f7e1ff,#dbfff0);font-size:28px;font-weight:900}
    `;
    document.head.appendChild(style);
  }
}());
