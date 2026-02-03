/* ZIP 4 — Core (NO UI)
   Level 1 client-side:

   Always available:
   - ZIP
   - BASE64
   - SHA-256

   Text-like inputs:
   - TXT
   - JSON_PRETTY
   - JSON_MINIFY
   - JSON (from CSV)
   - CSV (from JSON)

   Image-like inputs (png/jpg/webp/gif + heic/heif/tif/tiff in menu):
   - PNG
   - JPG
   - WEBP
   - AVIF (if browser supports it)

   Controls:
   - Quality: only for JPG / WEBP / AVIF (0.40 – 0.95)
   - Resize: optional, downscale-only (max dimension). NEVER upscale.
*/
(function () {
  "use strict";

  /* ---------------------------------------------------- */
  /* Helpers                                              */
  /* ---------------------------------------------------- */
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

  const isImageLike = (file) =>
    ["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) ||
    isHeic(file) || isTiff(file);

  const isTextLike = (file) => {
    const n = file.name.toLowerCase();
    return (
      file.type.startsWith("text/") ||
      file.type === "application/json" ||
      n.endsWith(".csv") ||
      n.endsWith(".md") ||
      n.endsWith(".txt") ||
      n.endsWith(".log") ||
      n.endsWith(".json")
    );
  };

  const isJsonLike = (file) =>
    file.type === "application/json" || file.name.toLowerCase().endsWith(".json");

  const isCsvLike = (file) =>
    file.type === "text/csv" || file.name.toLowerCase().endsWith(".csv");

  const extFromMime = (mime) => {
    if (mime === "image/png") return "png";
    if (mime === "image/jpeg") return "jpg";
    if (mime === "image/webp") return "webp";
    if (mime === "image/avif") return "avif";
    return "bin";
  };

  async function canEncode(mime) {
    const c = document.createElement("canvas");
    c.width = 1;
    c.height = 1;
    return await new Promise((resolve) => c.toBlob((b) => resolve(!!b), mime));
  }

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

  /* ---------------------------------------------------- */
  /* SHA-256                                              */
  /* ---------------------------------------------------- */
  async function sha256Hex(file) {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    const u8 = new Uint8Array(hash);
    return Array.from(u8).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /* ---------------------------------------------------- */
  /* Base64                                               */
  /* ---------------------------------------------------- */
  function base64FromU8(u8) {
    let s = "";
    const chunk = 0x8000;
    for (let i = 0; i < u8.length; i += chunk) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    return btoa(s);
  }

  /* ---------------------------------------------------- */
  /* CSV helpers                                          */
  /* ---------------------------------------------------- */
  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else field += c;
      } else {
        if (c === '"') inQuotes = true;
        else if (c === ",") {
          row.push(field);
          field = "";
        } else if (c === "\n") {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
        } else if (c !== "\r") {
          field += c;
        }
      }
    }
    row.push(field);
    rows.push(row);
    return rows;
  }

  function toObjectsFromCsv(rows) {
    if (!rows.length) return [];
    const header = rows[0].map((h) => h.trim());
    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (row.length === 1 && row[0] === "" && r === rows.length - 1) continue;
      const obj = {};
      for (let c = 0; c < header.length; c++) {
        obj[header[c] || `col${c + 1}`] = row[c] ?? "";
      }
      out.push(obj);
    }
    return out;
  }

  function csvEscape(v) {
    const s = (v ?? "").toString();
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function toCsvFromObjects(arr) {
    if (!Array.isArray(arr)) arr = [arr];
    const keys = [];
    const seen = new Set();
    for (const obj of arr) {
      if (obj && typeof obj === "object") {
        for (const k of Object.keys(obj)) {
          if (!seen.has(k)) {
            seen.add(k);
            keys.push(k);
          }
        }
      }
    }
    if (!keys.length) return "";
    const lines = [];
    lines.push(keys.map(csvEscape).join(","));
    for (const obj of arr) {
      lines.push(keys.map((k) => csvEscape(obj?.[k] ?? "")).join(","));
    }
    return lines.join("\n") + "\n";
  }

  /* ---------------------------------------------------- */
  /* ZIP (store only, single file)                        */
  /* ---------------------------------------------------- */
  const CRC32_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      t[i] = c >>> 0;
    }
    return t;
  })();

  const crc32 = (u8) => {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) {
      c = CRC32_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };

  const u16 = (n) => new Uint8Array([n & 255, (n >>> 8) & 255]);
  const u32 = (n) =>
    new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
  const enc = (s) => new TextEncoder().encode(s);

  const cat = (arr) => {
    const len = arr.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const a of arr) {
      out.set(a, o);
      o += a.length;
    }
    return out;
  };

  async function makeZipSingleFile(fileName, fileBlob) {
    const name = enc(fileName);
    const data = await blobToU8(fileBlob);
    const crc = crc32(data);
    const size = data.length >>> 0;

    const localHeader = cat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(size),
      u32(size),
      u16(name.length),
      u16(0),
      name,
    ]);

    const centralHeader = cat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(size),
      u32(size),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(0),
      name,
    ]);

    const centralOffset = localHeader.length + data.length;
    const eocd = cat([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(1),
      u16(1),
      u32(centralHeader.length),
      u32(centralOffset),
      u16(0),
    ]);

    return new Blob([localHeader, data, centralHeader, eocd], {
      type: "application/zip",
    });
  }

  /* ---------------------------------------------------- */
  /* Output list (never empty)                            */
  /* ---------------------------------------------------- */
  async function getOutputsForFile(file) {
    const outputs = [
      { value: "application/zip", label: "ZIP" },
      { value: "text/plain;base64", label: "BASE64" },
      { value: "text/plain;sha256", label: "SHA-256" },
    ];

    if (isTextLike(file)) {
      outputs.push({ value: "text/plain", label: "TXT" });
      if (isJsonLike(file)) {
        outputs.push({ value: "application/json;pretty", label: "JSON_PRETTY" });
        outputs.push({ value: "application/json;minify", label: "JSON_MINIFY" });
        outputs.push({ value: "text/csv;fromjson", label: "CSV" });
      }
      if (isCsvLike(file)) outputs.push({ value: "application/json;fromcsv", label: "JSON" });
    }

    if (isImageLike(file)) {
      outputs.push({ value: "image/png", label: "PNG" });
      outputs.push({ value: "image/jpeg", label: "JPG" });
      outputs.push({ value: "image/webp", label: "WEBP" });
      try {
        if (await canEncode("image/avif")) outputs.push({ value: "image/avif", label: "AVIF" });
      } catch {}
    }

    return outputs;
  }

  /* ---------------------------------------------------- */
  /* Convert                                              */
  /* ---------------------------------------------------- */
  async function convert(file, outType, opts = {}) {
    const q = clamp(Number(opts.quality ?? 0.9), 0.4, 0.95);
    const resizeMax = Number(opts.resizeMax ?? 0) || 0;

    if (outType === "application/zip") {
      const zip = await makeZipSingleFile(file.name, file);
      return { blob: zip, outName: `${baseName(file.name)}.zip`, previewUrl: null };
    }

    if (outType === "text/plain;base64") {
      const u8 = await blobToU8(file);
      const b64 = base64FromU8(u8);
      return {
        blob: new Blob([b64 + "\n"], { type: "text/plain" }),
        outName: `${baseName(file.name)}.base64.txt`,
        previewUrl: null,
      };
    }

    if (outType === "text/plain;sha256") {
      const hex = await sha256Hex(file);
      return {
        blob: new Blob([hex + "\n"], { type: "text/plain" }),
        outName: `${baseName(file.name)}.sha256.txt`,
        previewUrl: null,
      };
    }

    if (outType === "text/plain") {
      if (!isTextLike(file)) throw new Error("TXT requires text input.");
      const text = await file.text();
      return {
        blob: new Blob([text], { type: "text/plain" }),
        outName: `${baseName(file.name)}.txt`,
        previewUrl: null,
      };
    }

    if (outType === "application/json;pretty" || outType === "application/json;minify") {
      if (!isJsonLike(file)) throw new Error("JSON requires JSON input.");
      const raw = await file.text();
      let obj;
      try {
        obj = JSON.parse(raw);
      } catch {
        throw new Error("Invalid JSON.");
      }
      const json =
        outType === "application/json;pretty"
          ? JSON.stringify(obj, null, 2)
          : JSON.stringify(obj);
      return {
        blob: new Blob([json + "\n"], { type: "application/json" }),
        outName: `${baseName(file.name)}.${outType.endsWith("pretty") ? "pretty" : "min"}.json`,
        previewUrl: null,
      };
    }

    if (outType === "application/json;fromcsv") {
      if (!isCsvLike(file)) throw new Error("JSON requires CSV input.");
      const raw = await file.text();
      const rows = parseCsv(raw);
      const arr = toObjectsFromCsv(rows);
      const json = JSON.stringify(arr, null, 2);
      return {
        blob: new Blob([json + "\n"], { type: "application/json" }),
        outName: `${baseName(file.name)}.json`,
        previewUrl: null,
      };
    }

    if (outType === "text/csv;fromjson") {
      if (!isJsonLike(file)) throw new Error("CSV requires JSON input.");
      const raw = await file.text();
      const obj = JSON.parse(raw);
      const csv = toCsvFromObjects(obj);
      return {
        blob: new Blob([csv], { type: "text/csv" }),
        outName: `${baseName(file.name)}.csv`,
        previewUrl: null,
      };
    }

    const imgOut = ["image/png", "image/jpeg", "image/webp", "image/avif"];
    if (imgOut.includes(outType)) {
      if (!isImageLike(file)) throw new Error("Image output requires image input.");
      if (!(await canEncode(outType))) throw new Error("Format not supported.");

      let img;
      try {
        img = await fileToImage(file);
      } catch {
        throw new Error("Image decoding failed.");
      }

      let w = img.naturalWidth;
      let h = img.naturalHeight;

      if (resizeMax > 0) {
        const maxDim = Math.max(w, h);
        if (maxDim > resizeMax) {
          const scale = resizeMax / maxDim;
          w = Math.floor(w * scale);
          h = Math.floor(h * scale);
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      const blob = await new Promise((resolve) => {
        outType === "image/png"
          ? canvas.toBlob(resolve, outType)
          : canvas.toBlob(resolve, outType, q);
      });

      if (!blob) throw new Error("Conversion failed.");

      return {
        blob,
        outName: `${baseName(file.name)}.${extFromMime(outType)}`,
        previewUrl: URL.createObjectURL(blob),
      };
    }

    throw new Error("Unsupported output format.");
  }

  window.Zip4Core = { getOutputsForFile, convert };
})();