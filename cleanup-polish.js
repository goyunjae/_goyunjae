(function () {
  const VERSION = "20260616-1115";

  ready(() => {
    clean();
    observe();
    style();
  });

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function observe() {
    const root = document.querySelector(".app-shell") || document.body;
    if (root.dataset.cleanupPolish === VERSION) return;
    root.dataset.cleanupPolish = VERSION;
    new MutationObserver(clean).observe(root, { childList: true, subtree: true });
  }

  function clean() {
    document.querySelectorAll(".toss-empty-visual").forEach((node) => node.remove());
    const empty = document.querySelector("#emptyState");
    if (empty && empty.dataset.cleanText !== VERSION) {
      empty.dataset.cleanText = VERSION;
      empty.innerHTML = '<strong>차트 미리보기</strong><span>생성된 차트가 이 영역에 표시됩니다.</span>';
    }
    document.querySelectorAll("input").forEach((input) => {
      if (input.value.trim() === "연차평가 예시") input.value = "";
    });
    const title = document.querySelector("#reportTitle");
    if (title && title.textContent.trim() === "연차평가 예시") {
      title.textContent = "그래프 미리보기";
    }
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
