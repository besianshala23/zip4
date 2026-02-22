(function () {
  "use strict";

  const STYLE_ID = "zip4-topbar-style";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      :root{
        --tb-h: 56px;
        --tb-bg: rgba(115,115,115,0.68);
        --tb-border: rgba(255,255,255,0.18);
        --tb-text: rgba(255,255,255,0.90);
        --tb-text-dim: rgba(255,255,255,0.65);
        --tb-shadow: 0 10px 28px rgba(0,0,0,0.22);
        --tb-radius: 18px;
      }

      /* Keep page content below the pinned bar */
      body { padding-top: var(--tb-h); }

      .zip4-topbar{
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: var(--tb-h);
        z-index: 9999;
        display: flex;
        align-items: center;
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        background: var(--tb-bg);
        border-bottom: 1px solid var(--tb-border);
        box-shadow: var(--tb-shadow);
      }

      /* GRID FOR PERFECT SYMMETRY */
      .zip4-topbar .tb-wrap{
        width: min(1180px, calc(100% - 36px));
        margin: 0 auto;
        display: grid;
        grid-template-columns: 1fr auto 1fr; /* 1fr sides, auto center */
        align-items: center;
        gap: 12px;
      }

      .zip4-topbar .tb-left{
        display: flex;
        align-items: center;
        justify-content: flex-start;
      }

      .zip4-topbar .tb-center{
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 22px;
      }

      .zip4-topbar .tb-right{
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }

      /* TEXT & LINKS */
      .zip4-topbar .tb-brand{
        font-weight: 600;
        letter-spacing: 0.08em;
        font-size: 12.5px;
        color: var(--tb-text);
        text-decoration: none;
        white-space: nowrap;
      }

      .zip4-topbar .tb-link{
        font-size: 13px;
        color: var(--tb-text-dim);
        text-decoration: none;
        padding: 6px 2px;
        position: relative;
        transition: color .18s ease;
        user-select: none;
      }

      .zip4-topbar .tb-link:hover,
      .zip4-topbar .tb-link.is-active{
        color: var(--tb-text);
      }

      .zip4-topbar .tb-link::after{
        content: "";
        position: absolute;
        left: 0; right: 0; bottom: -6px;
        height: 2px;
        border-radius: 2px;
        background: rgba(255,255,255,0.0);
        transition: background .18s ease;
      }

      .zip4-topbar .tb-link:hover::after{
        background: rgba(255,255,255,0.38);
      }

      .zip4-topbar .tb-link.is-active::after{
        background: rgba(255,255,255,0.70);
      }

      /* CTA BUTTON */
      .zip4-topbar .tb-cta{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 34px;
        padding: 0 14px;
        border-radius: 999px;
        color: rgba(255,255,255,0.92);
        background: rgba(0,0,0,0.60);
        border: 1px solid rgba(255,255,255,0.16);
        text-decoration: none;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.01em;
        transition: transform .15s ease, background .15s ease, border-color .15s ease;
        white-space: nowrap;
      }

      .zip4-topbar .tb-cta:hover{
        transform: translateY(-1px);
        background: rgba(0,0,0,0.68);
        border-color: rgba(255,255,255,0.22);
      }

      .zip4-topbar .tb-cta:active{
        transform: translateY(0px);
      }

      /* MOBILE MODE (Hide logo & download button) */
      @media (max-width: 720px){
        .zip4-topbar .tb-wrap{
          grid-template-columns: 1fr; /* Single center column */
          justify-content: center;
        }
        .zip4-topbar .tb-left,
        .zip4-topbar .tb-right{
          display: none;
        }
        .zip4-topbar .tb-center{
          gap: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const bar = document.createElement("header");
  bar.className = "zip4-topbar";

  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const isIndex = path === "" || path === "index.html";
  const isContact = path.includes("contact");
  const isPrivacy = path.includes("privacy");
  const isDownload = path.includes("download");

  bar.innerHTML = `
    <div class="tb-wrap">
      <div class="tb-left">
        <a class="tb-brand" href="./index.html" aria-label="ZIP 4 Home">ZIP 4</a>
      </div>

      <div class="tb-center" role="navigation" aria-label="Primary">
        <a class="tb-link ${isIndex ? "is-active" : ""}" href="./index.html">Home</a>
        <a class="tb-link ${isPrivacy ? "is-active" : ""}" href="./privacy.html">Privacy</a>
        <a class="tb-link ${isContact ? "is-active" : ""}" href="./contact.html">Contact</a>
      </div>

      <div class="tb-right">
        <a class="tb-cta ${isDownload ? "is-active" : ""}" href="./download.html">Download for macOS</a>
      </div>
    </div>
  `;

  document.body.prepend(bar);
})();
