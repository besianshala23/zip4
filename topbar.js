(() => {
  // ---- CONFIG from each page ----
  // window.ZIP4_SITE = { downloadUrl: "...", releaseIso: "2026-02-01T12:00:00+01:00" }
  const cfg = (window.ZIP4_SITE || {});
  const DOWNLOAD_URL = (cfg.downloadUrl || "#");

  // Release gate (default: Feb 1, 2026 12:00 Europe/Rome)
  const RELEASE_ISO = (cfg.releaseIso || "2026-02-01T12:00:00+01:00");
  const releaseTime = new Date(RELEASE_ISO).getTime();
  const now = Date.now();
  const LIVE = now >= releaseTime;

  const changelogLink = LIVE
    ? `<a class="tb-link" href="./changelog.html">Changelog</a>`
    : `<a class="tb-link tb-disabled" href="./changelog.html" aria-disabled="true">Changelog</a>`;

  const downloadLink = LIVE
    ? `<a class="tb-link" href="${DOWNLOAD_URL}">Download</a>`
    : `<a class="tb-link tb-disabled" href="#" aria-disabled="true">Coming soon</a>`;

  const HTML = `
    <header class="tb">
      <div class="tb-wrap tb-inner">
        <div class="tb-side tb-left">
          <a class="tb-brand" href="./index.html" aria-label="ZIP 4 Home">
            <img class="tb-logo" src="Logo.png" alt="ZIP 4 logo" />
            <span class="tb-brandText">ZIP 4</span>
          </a>
        </div>

        <nav class="tb-center" aria-label="Navigation">
          ${changelogLink}
          <a class="tb-link" href="./index.html#about" data-center-about="1">About</a>
          <a class="tb-link" href="./contact.html">Contact</a>
        </nav>

        <div class="tb-side tb-right">
          <a class="tb-link" href="./shala-software.html">Shala Software</a>
          ${downloadLink}
        </div>
      </div>
    </header>
    <div class="tb-fade" id="tbFade" aria-hidden="true"></div>
  `;

  const CSS = `
    :root{
      --tb-ink: rgba(0,0,0,.82);
      --tb-border: rgba(0,0,0,.10);
      --tb-hair: rgba(0,0,0,.08);
      --tb-bg: rgba(244,244,244,.86);
      --tb-pill: rgba(255,255,255,.70);
    }
    .tb-wrap{width:min(1040px,100%);margin:0 auto;padding:0 18px}

    .tb{
      position:sticky; top:0; z-index:1000;
      backdrop-filter:saturate(180%) blur(18px);
      background: var(--tb-bg);
      border-bottom: 1px solid var(--tb-hair);
    }
    .tb-inner{
      height:58px;
      display:flex;
      align-items:center;
      justify-content:space-between;
      position:relative;
    }
    .tb-side{
      display:flex;
      align-items:center;
      gap:14px;
      min-width:360px;
    }
    .tb-right{justify-content:flex-end}

    .tb-brand{
      display:flex; align-items:center; gap:10px;
      font-weight:650; user-select:none;
      text-decoration:none; color: var(--tb-ink);
    }
    .tb-logo{
      width:28px;height:28px;border-radius:8px;
      border:1px solid rgba(0,0,0,.06);
      background:rgba(255,255,255,.55);
      object-fit:contain; display:block;
    }
    .tb-brandText{font-size:14px}

    .tb-center{
      position:absolute;
      left:50%;
      transform:translateX(-50%);
      display:flex;
      align-items:center;
      gap:22px;
      white-space:nowrap;
    }

    .tb-link{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:9px 12px;
      border-radius:999px;
      border:1px solid var(--tb-border);
      background: var(--tb-pill);
      font-size:13px;
      color: rgba(0,0,0,.72);
      text-decoration:none;
      transition: background .15s ease, border-color .15s ease, color .15s ease, opacity .15s ease;
      white-space:nowrap;
    }
    .tb-link:hover{
      background:rgba(255,255,255,.88);
      border-color:rgba(0,0,0,.12);
      color: rgba(0,0,0,.82);
    }

    .tb-disabled{
      opacity:.55 !important;
      pointer-events:none !important;
      cursor:not-allowed !important;
      filter:saturate(.85);
    }

    .tb-fade{
      position:fixed; inset:0;
      background:#fff;
      opacity:0;
      pointer-events:none;
      z-index:999;
      transition: opacity .18s ease;
    }
    .tb-fade.is-on{opacity:1;pointer-events:auto}

    @media (max-width: 860px){
      .tb-center{display:none}
      .tb-side{min-width:0}
    }
  `;

  function injectStyle() {
    const id = "tb-style";
    const old = document.getElementById(id);
    if (old) old.remove();
    const style = document.createElement("style");
    style.id = id;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function mount() {
    const mountNode = document.getElementById("topbar");
    if (!mountNode) return;
    mountNode.innerHTML = HTML;
  }

  function onIndexPage() {
    const p = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    return p === "" || p === "index.html";
  }

  function centerScrollToAbout() {
    const el = document.getElementById("about");
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const elementCenter = rect.top + window.scrollY + rect.height / 2;
    const viewportCenter = window.innerHeight / 2;
    const topbarOffset = 24;
    const y = Math.max(0, elementCenter - viewportCenter - topbarOffset);
    window.scrollTo({ top: y, behavior: "smooth" });
  }

  function enableNavLogic() {
    const fade = document.getElementById("tbFade");
    if (!fade) return;

    document.addEventListener("click", (e) => {
      const a = e.target?.closest?.("a");
      if (!a) return;

      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === "_blank") return;
      if (a.classList.contains("tb-disabled") || a.getAttribute("aria-disabled") === "true") return;

      const href = a.getAttribute("href") || "";

      // About centered on index
      if (a.dataset.centerAbout === "1" && onIndexPage()) {
        e.preventDefault();
        centerScrollToAbout();
        return;
      }

      // No fade for hash jumps
      if (href.includes("#")) return;

      // No fade for external
      if (href.startsWith("http://") || href.startsWith("https://")) return;

      e.preventDefault();
      fade.classList.add("is-on");
      setTimeout(() => { window.location.href = href; }, 160);
    });
  }

  injectStyle();
  mount();
  enableNavLogic();
})();