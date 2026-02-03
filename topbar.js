(() => {
  const cfg = window.ZIP4_SITE || {};
  const DOWNLOAD_URL = cfg.downloadUrl || "#";
  const RELEASE_ISO = cfg.releaseIso || "2026-03-01T12:00:00+01:00";
  const releaseTime = new Date(RELEASE_ISO).getTime();
  const LIVE = Number.isFinite(releaseTime) ? Date.now() >= releaseTime : false;

  const TB_THEME = "#161618";
  const TB_HEIGHT = 64;

  function ensureMeta(name, content) {
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", name);
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", content);
  }

  function applySystemIntegration() {
    ensureMeta("theme-color", TB_THEME);
    ensureMeta("color-scheme", "dark light");
    document.documentElement.style.backgroundColor = "#ffffff";
    document.body.style.paddingTop = `${TB_HEIGHT}px`;
  }

  const downloadLink = LIVE
    ? `<a class="tb-link tb-cta" href="${DOWNLOAD_URL}">Download</a>`
    : `<a class="tb-link tb-cta tb-disabled" href="./download.html" aria-disabled="true">Download</a>`;

  const HTML = `
    <header class="tb" role="banner">
      <div class="tb-wrap">
        <div class="tb-inner">
          <div class="tb-left">
            <a class="tb-brand" href="./index.html" aria-label="ZIP 4 Home">ZIP 4</a>
          </div>

          <nav class="tb-center" aria-label="Primary">
            <a class="tb-link" href="./index.html">Converter</a>
            <a class="tb-link" href="./download.html">Download</a>
            <a class="tb-link" href="./contact.html">Contact</a>
          </nav>

          <div class="tb-right" aria-label="Secondary">
            ${downloadLink}
          </div>
        </div>
      </div>
    </header>
  `;

  const CSS = `
    :root{
      --tb-bg: rgba(22, 22, 24, .62);
      --tb-hair: rgba(255,255,255,.10);
      --tb-ink: rgba(255,255,255,.88);
      --tb-inkSub: rgba(255,255,255,.72);
      --tb-hover: rgba(255,255,255,.10);
      --tb-focus: rgba(255,255,255,.26);
      --tb-shadow: rgba(0,0,0,.30);
      --tb-height: ${TB_HEIGHT}px;
      --tb-wrap: 1040px;
      --tb-font: 14.5px;
      --tb-padY: 10px;
      --tb-padX: 12px;
      --tb-radius: 12px;
    }

    .tb{
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 1000;
      backdrop-filter: saturate(220%) blur(26px);
      -webkit-backdrop-filter: saturate(220%) blur(26px);
      background: var(--tb-bg);
      border-bottom: 1px solid var(--tb-hair);
      box-shadow: 0 1px 0 rgba(255,255,255,.06), 0 18px 60px var(--tb-shadow);
    }

    .tb-wrap{
      width: min(var(--tb-wrap), 100%);
      margin: 0 auto;
      padding: 0 18px;
    }

    .tb-inner{
      height: var(--tb-height);
      position: relative;
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
    }

    .tb-left,.tb-right{
      display:flex;
      align-items:center;
      gap:12px;
      min-width:0;
    }

    .tb-center{
      position:absolute;
      left:50%;
      transform:translateX(-50%);
      display:flex;
      align-items:center;
      gap:14px;
      white-space:nowrap;
    }

    .tb-brand{
      text-decoration:none;
      font-size: var(--tb-font);
      letter-spacing:-.01em;
      color: var(--tb-ink);
      opacity:.95;
      white-space:nowrap;
      padding: var(--tb-padY) var(--tb-padX);
      border-radius: var(--tb-radius);
      transition: background .15s ease, color .15s ease;
    }
    .tb-brand:hover{ background: var(--tb-hover); }

    .tb-link{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding: var(--tb-padY) var(--tb-padX);
      border-radius: var(--tb-radius);
      background: transparent;
      border: 0;
      font-size: var(--tb-font);
      color: var(--tb-inkSub);
      text-decoration:none;
      transition: background .15s ease, color .15s ease, opacity .15s ease;
      white-space:nowrap;
    }
    .tb-link:hover{ background: var(--tb-hover); color: var(--tb-ink); }

    .tb-cta{ color: var(--tb-ink); font-weight:650; }

    .tb-link:focus-visible,
    .tb-brand:focus-visible{
      outline: 2px solid var(--tb-focus);
      outline-offset: 2px;
    }

    .tb-disabled{
      opacity:.55 !important;
      pointer-events:none !important;
      cursor:default !important;
    }

    @media (max-width: 900px){
      .tb-inner{
        height:auto;
        padding:10px 0;
        flex-direction:column;
        align-items:center;
      }
      .tb-center{
        position:static;
        transform:none;
        flex-wrap:wrap;
        justify-content:center;
        gap:10px;
      }
      .tb-left,.tb-right{
        justify-content:center;
        flex-wrap:wrap;
        gap:10px;
      }
    }
  `;

  function injectStyle(){
    const id = "zip4-topbar-style";
    const old = document.getElementById(id);
    if (old) old.remove();
    const style = document.createElement("style");
    style.id = id;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function mount(){
    const id = "zip4-topbar";
    const old = document.getElementById(id);
    if (old) old.remove();
    const mountPoint = document.createElement("div");
    mountPoint.id = id;
    mountPoint.innerHTML = HTML.trim();
    document.body.prepend(mountPoint);
  }

  applySystemIntegration();
  injectStyle();
  mount();
})();