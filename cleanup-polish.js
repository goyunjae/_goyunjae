(function () {
  const VERSION = "20260616-1135";

  ready(() => {
    clean();
    installEvents();
    style();
  });

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  let cleanTimer = 0;

  function installEvents() {
    if (document.body.dataset.cleanupPolishEvents === VERSION) return;
    document.body.dataset.cleanupPolishEvents = VERSION;
    ["click", "change", "input"].forEach((type) => {
      document.addEventListener(type, (event) => {
        if (!event.target.closest?.("#generateBtn,#clearBtn,#sampleDataBtn,#addRowBtn,#addColBtn,.filter-chip,.studio-tab,#manualTable,#reportTitle")) return;
        scheduleClean();
      }, true);
    });
    setTimeout(scheduleClean, 250);
    setTimeout(scheduleClean, 1200);
  }

  function scheduleClean() {
    clearTimeout(cleanTimer);
    cleanTimer = setTimeout(clean, 80);
  }

  function clean() {
    document.querySelectorAll(".toss-empty-visual").forEach((node) => node.remove());

    const empty = document.querySelector("#emptyState");
    if (empty && !empty.hidden && empty.dataset.cleanText !== VERSION) {
      empty.dataset.cleanText = VERSION;
      empty.innerHTML = '<strong>차트 미리보기</strong><span>생성된 차트가 이 영역에 표시됩니다.</span>';
    }

    const firstInput = document.querySelector("#manualTable tbody input");
    if (firstInput && firstInput.value.trim() === "연차평가 예시") firstInput.value = "사업 성과 추이";

    const title = document.querySelector("#reportTitle");
    if (title && title.textContent.trim() === "연차평가 예시") title.textContent = "사업 성과 추이";

    document.querySelectorAll(".brand h1").forEach((heading) => {
      if (heading.textContent.includes("연차평가")) heading.textContent = "G2 그래프";
    });
  }

  function style() {
    if (document.querySelector("#cleanup-polish-style")) return;
    const style = document.createElement("style");
    style.id = "cleanup-polish-style";
    style.textContent = `
      .toss-empty-visual{display:none!important}
      .toss-polish #emptyState{
        min-height:220px!important;
        display:flex!important;
        flex-direction:column!important;
        align-items:flex-start!important;
        justify-content:flex-start!important;
        gap:8px!important;
        padding:24px!important;
      }
      .toss-polish #emptyState strong{font-size:18px!important;font-weight:900!important;color:var(--toss-ink,#191f28)!important}
      .toss-polish #emptyState span{font-size:13px!important;color:var(--toss-muted,#8b95a1)!important}
    `;
    document.head.appendChild(style);
  }
}());
