(function () {
  "use strict";

  /* =====================================================
     ZIP 4 — Core Engine (Browser)
     - Real ZIP (store-only, single file)
     - PDF + HEIC support (realistic)
     - Target size with thresholds: "<2MB" / "<5MB" / "<7MB" (rule-based)
     - UI can ask for compatible outputs + target options
     ===================================================== */

  const MB = 1024 * 1024;

  /* ---------------- Helpers ---------------- */
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const baseName = (name) => name.replace(/\.[^/.]+$/, "");
  const extLower = (name) => (name.split(".").pop() || "").toLowerCase();

  const isHeic = (file) => {
    const ext = extLower(file.name);
    return file.type === "image/heic" || file.type === "image/heif" || ext === "heic" || ext === "heif";
  };

  const isTiff = (file) => {
    const ext = extLower(file.name);
    return file.type === "image/tiff" || ext === "tif" || ext === "tiff";
  };

  const isPdf = (file) => file.type === "application/pdf" || extLower(file.name) === "pdf";

  const isImageLike = (file) => {
    const ext = extLower(file.name);
    return (
      [
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/gif",
        "image/bmp",
        "image/x-ms-bmp",
        "image/svg+xml",
      ].includes(file.type) ||
      ["bmp", "svg"].includes(ext) ||
      isHeic(file) ||
      isTiff(file)
    );
  };

  const isLossyOut = (mime) =>
    mime === "image/jpeg" || mime === "image/webp" || mime === "image/avif";

  const extFromMime = (mime) => {
    if (mime === "image/png") return "png";
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/webp") return "webp";
    if (mime === "image/avif") return "avif";
    if (mime === "image/gif") return "gif";
    if (mime === "image/tiff") return "tiff";
    if (mime === "image/heic") return "heic";
    if (mime === "image/heif") return "heif";
    if (mime === "image/bmp" || mime === "image/x-ms-bmp") return "bmp";
    if (mime === "image/svg+xml") return "svg";
    return "bin";
  };

  /* ---------------- Encode support cache ---------------- */
  const _canEncodeCache = new Map();
  async function canEncode(mime) {
    if (_canEncodeCache.has(mime)) return _canEncodeCache.get(mime);
    const ok = await new Promise((resolve) => {
      try {
        const c = document.createElement("canvas");
        c.width = 1;
        c.height = 1;
        c.toBlob((b) => resolve(!!b), mime);
      } catch {
        resolve(false);
      }
    });
    _canEncodeCache.set(mime, ok);
    return ok;
  }

  /* ---------------- File decode helpers ---------------- */
  async function fileToImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error("decode"));
      });
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function blobToU8(blob) {
    return new Uint8Array(await blob.arrayBuffer());
  }

  /* ---------------- SHA-256 ---------------- */
  async function sha256Hex(file) {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    const u8 = new Uint8Array(hash);
    return Array.from(u8).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /* ---------------- Base64 ---------------- */
  function base64FromU8(u8) {
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    return btoa(s);
  }

  /* =====================================================
     REAL ZIP (store-only, single file)
     ===================================================== */
  const CRC32_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();

  const crc32 = (u8) => {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC32_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };

  const u16 = (n) => new Uint8Array([n & 255, (n >>> 8) & 255]);
  const u32 = (n) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
  const enc = (s) => new TextEncoder().encode(s);

  const cat = (arr) => {
    const len = arr.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const a of arr) { out.set(a, o); o += a.length; }
    return out;
  };

  async function makeZipSingleFile(fileName, fileBlob) {
    const name = enc(fileName);
    const data = await blobToU8(fileBlob);
    const crc = crc32(data);
    const size = data.length >>> 0;

    // Local file header
    const localHeader = cat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size),
      u16(name.length), u16(0),
      name
    ]);

    // Central directory file header
    const centralHeader = cat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0),
      u16(0), u16(0),
      u32(crc), u32(size), u32(size),
      u16(name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(0),
      name
    ]);

    const centralOffset = localHeader.length + data.length;

    // End of central directory
    const eocd = cat([
      u32(0x06054b50), u16(0), u16(0),
      u16(1), u16(1),
      u32(centralHeader.length),
      u32(centralOffset),
      u16(0)
    ]);

    return new Blob([localHeader, data, centralHeader, eocd], { type: "application/zip" });
  }

  /* =====================================================
     Output formats (compatible-only)
     ===================================================== */
  async function getOutputsForFile(file) {
    // Universal outputs
    const outputs = [
      { value: "application/zip", label: "ZIP" },
      { value: "text/plain;base64", label: "BASE64" },
      { value: "text/plain;sha256", label: "SHA-256" },
    ];

    // PDF: realistic conversions
    if (isPdf(file)) return outputs;

    // Images: encode to common formats
    if (isImageLike(file)) {
      outputs.push({ value: "image/png",  label: "PNG",  enabled: true });
      outputs.push({ value: "image/jpeg", label: "JPG",  enabled: true });
      outputs.push({ value: "image/webp", label: "WEBP", enabled: true });

      const avifOk = await canEncode("image/avif");
      if (avifOk) outputs.push({ value: "image/avif", label: "AVIF", enabled: true });

      // Extra formats (most browsers cannot encode these yet; we expose them as disabled placeholders)
      const gifOk  = await canEncode("image/gif");
      outputs.push({ value: "image/gif",  label: "GIF",  enabled: !!gifOk });

      const tiffOk = await canEncode("image/tiff");
      outputs.push({ value: "image/tiff", label: "TIFF", enabled: !!tiffOk });

      const heicOk = await canEncode("image/heic");
      outputs.push({ value: "image/heic", label: "HEIC", enabled: !!heicOk });

      const heifOk = await canEncode("image/heif");
      outputs.push({ value: "image/heif", label: "HEIF", enabled: !!heifOk });
    }

    return outputs;
  }

  /* =====================================================
     Target options (thresholds only)
     - Only meaningful for lossy outputs
     - Only offered when input is large enough
     ===================================================== */
  function getTargetOptionsForFile(file, outType) {
    if (!isLossyOut(outType)) return [];
    const s = Number(file?.size || 0);

    // New rule you asked:
    // >=10MB => "<7MB" and "<5MB"
    // >=5MB  => "<2MB"
    // else   => none
    if (s >= 10 * MB) return ["<7MB", "<5MB"]; 
    if (s >= 5 * MB)  return ["<2MB"]; 
    return [];
  }

  function targetLabelToBytes(label) {
    if (label === "<2MB") return 2 * MB;
    if (label === "<5MB") return 5 * MB;
    if (label === "<7MB") return 7 * MB;
    return 0;
  }

  /* =====================================================
     Image encode helpers
     ===================================================== */
  async function encodeImageFromCanvas(canvas, outType, quality) {
    // For lossy formats, quality is used; for PNG it's ignored.
    const q = clamp(Number(quality ?? 0.85), 0.40, 0.92);

    const blob = await new Promise((resolve) => {
      if (outType === "image/png") canvas.toBlob(resolve, outType);
      else canvas.toBlob(resolve, outType, q);
    });

    if (!blob) throw new Error("Conversion failed.");
    return blob;
  }

  // Fast + stable "best-effort under threshold":
  // - binary search is accurate but can feel slow on huge images
  // - we do 7 steps max (quick), and keep the best <= target
  async function encodeUnderTarget(canvas, outType, targetBytes) {
    const target = Number(targetBytes) || 0;
    if (target <= 0) throw new Error("Invalid targetBytes.");

    let lo = 0.40, hi = 0.92;
    let best = null;

    for (let i = 0; i < 7; i++) {
      const mid = (lo + hi) / 2;
      const b = await encodeImageFromCanvas(canvas, outType, mid);

      if (b.size <= target) {
        best = b;
        lo = mid;     // try higher quality
      } else {
        hi = mid;     // too big => compress more
      }
    }

    // If never <= target, return most compressed attempt
    if (!best) best = await encodeImageFromCanvas(canvas, outType, 0.40);
    return best;
  }

  /* =====================================================
     Convert
     opts:
       - target: "<2MB" | "<5MB" (lossy outputs only, threshold-based)
       - resizeMax: px (downscale only; optional)
     ===================================================== */
  async function convert(file, outType, opts = {}) {
    const resizeMax = Number(opts.resizeMax ?? 0) || 0;

    // ZIP
    if (outType === "application/zip") {
      const zip = await makeZipSingleFile(file.name, file);
      return { blob: zip, outName: `${baseName(file.name)}.zip`, previewUrl: null };
    }

    // BASE64
    if (outType === "text/plain;base64") {
      const u8 = await blobToU8(file);
      const b64 = base64FromU8(u8);
      return {
        blob: new Blob([b64 + "\n"], { type: "text/plain" }),
        outName: `${baseName(file.name)}.base64.txt`,
        previewUrl: null
      };
    }

    // SHA-256
    if (outType === "text/plain;sha256") {
      const hex = await sha256Hex(file);
      return {
        blob: new Blob([hex + "\n"], { type: "text/plain" }),
        outName: `${baseName(file.name)}.sha256.txt`,
        previewUrl: null
      };
    }

    // Image outputs
    const imgOut = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/avif",
      "image/gif",
      "image/tiff",
      "image/heic",
      "image/heif",
    ];
    if (imgOut.includes(outType)) {
      if (!isImageLike(file)) throw new Error("Image output requires image input.");
      if (!(await canEncode(outType))) throw new Error("This output format cannot be encoded in this browser yet.");

      // Decode
      let img;
      try { img = await fileToImage(file); }
      catch { throw new Error("Image decoding failed (HEIC may require Safari / supported macOS)."); }

      let w = img.naturalWidth;
      let h = img.naturalHeight;

      // Downscale-only (optional)
      if (resizeMax > 0) {
        const maxDim = Math.max(w, h);
        if (maxDim > resizeMax) {
          const scale = resizeMax / maxDim;
          w = Math.max(1, Math.floor(w * scale));
          h = Math.max(1, Math.floor(h * scale));
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      // Target size thresholds (lossy only)
      let blob;
      const targetBytes = isLossyOut(outType) ? targetLabelToBytes(opts.target) : 0;

      if (isLossyOut(outType) && targetBytes > 0) {
        // Only apply if the option is actually allowed for this file
        const allowed = getTargetOptionsForFile(file, outType);
        if (allowed.includes(opts.target)) blob = await encodeUnderTarget(canvas, outType, targetBytes);
        else blob = await encodeImageFromCanvas(canvas, outType, 0.88);
      } else {
        // Default good quality
        blob = await encodeImageFromCanvas(canvas, outType, outType === "image/png" ? null : 0.88);
      }

      return {
        blob,
        outName: `${baseName(file.name)}.${extFromMime(outType)}`,
        previewUrl: null
      };
    }

    // PDF + others -> unsupported conversion types are blocked by design
    throw new Error("Unsupported output format.");
  }

  // Public API
  window.Zip4Core = {
    getOutputsForFile,
    getTargetOptionsForFile,
    convert
  };
})();