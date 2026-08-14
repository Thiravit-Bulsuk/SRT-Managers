// lightweight telemetry extraction and manipulation

const keyValueRegex = /([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*([^,\n\r<>\]]+?)(?=\s*(?:,|$|\n|\r|<|>|\]))/g;
const quotedKeyRegex = /["']?([A-Za-z_][A-Za-z0-9_-]*)["']?\s*:\s*["']?([^"'\n\r,<>]+?)["']?(?=\s*(?:,|$|\n|\r|<|>|\]))/g;
const latLonRegex = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/;

function normalizeValue(raw) {
  if (raw === undefined || raw === null) return raw;
  let v = String(raw).trim();
  if (!v) return v;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  if (/^(true|false)$/i.test(v)) return v.toLowerCase() === 'true';
  const num = Number(v.replace(/[^0-9.\-+eE]/g, ''));
  if (!Number.isNaN(num) && v.match(/[0-9.\-+eE]/)) {
    return num;
  }
  return v;
}

function collectKeyValues(text) {
  const map = {};
  const patterns = [keyValueRegex, quotedKeyRegex];
  const seen = new Set();

  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      const key = String(m[1]).trim().toLowerCase();
      const rawValue = String(m[2]).trim();
      if (!key || !rawValue || seen.has(key)) continue;

      const value = normalizeValue(rawValue);
      map[key] = value;
      seen.add(key);
    }
  }

  return map;
}

export function extractMetadataFromText(text) {
  // returns a map of keys -> values (numbers when possible)
  const map = collectKeyValues(text || '');

  // also try inline "lat,lon" patterns
  const latlon = String(text || '').match(latLonRegex);
  if (latlon) {
    map.lat = parseFloat(latlon[1]);
    map.lon = parseFloat(latlon[2]);
  }

  // normalize known keys
  if (map.altitude !== undefined) map.height = map.altitude;
  if (map.alt !== undefined) map.height = map.alt;
  if (map.rel_alt !== undefined) map.height = map.rel_alt;
  if (map.latitude !== undefined) map.lat = map.latitude;
  if (map.longitude !== undefined) map.lon = map.longitude;
  if (map.gps_lat !== undefined) map.lat = map.gps_lat;
  if (map.gps_lon !== undefined) map.lon = map.gps_lon;

  return map;
}

export function applyAltitudeCorrection(blocks, opts={scale:1, baseOffset:null, auto:true}) {
  // compute base if auto and baseOffset not provided
  if (opts.auto && (opts.baseOffset === null)) {
    const firstWithHeight = blocks.find(b => (b.metadata && b.metadata.height !== undefined));
    if (firstWithHeight) opts.baseOffset = Number(firstWithHeight.metadata.height) || 0;
    else opts.baseOffset = 0;
  }
  for (const b of blocks) {
    if (!b.metadata) continue;
    if (b.metadata.height !== undefined && b.metadata.height !== null) {
      const raw = Number(b.metadata.height);
      const corrected = ((raw - (opts.baseOffset||0)) * (opts.scale||1));
      b.metadata.height = Number(corrected.toFixed(2));
    }
  }
  // update renderText for each block
  for (const b of blocks) {
    b.renderText = renderTextFromMetadata(b.rawText, b.metadata);
  }
  return blocks;
}

export function filterMetadata(blocks, allowedKeys=[]) {
  const allowSet = new Set(allowedKeys.map(k=>k.toLowerCase()));
  for (const b of blocks) {
    if (!b.metadata) continue;
    const kept = {};
    for (const k of Object.keys(b.metadata)) {
      if (allowSet.has(k.toLowerCase())) kept[k] = b.metadata[k];
    }
    b.metadata = kept;
    b.renderText = renderTextFromMetadata(b.rawText, b.metadata);
  }
  return blocks;
}

export function extractGPSTrack(blocks) {
  const track = [];
  for (const b of blocks) {
    if (!b.metadata) continue;
    if (b.metadata.lat !== undefined && b.metadata.lon !== undefined) {
      const t = b.startMs;
      track.push({tMs: t, lat: Number(b.metadata.lat), lon: Number(b.metadata.lon), extra: b.metadata});
    }
  }
  // sort by time
  track.sort((a,b)=>a.tMs - b.tMs);
  return track;
}

function renderTextFromMetadata(originalText, meta) {
  // Build text lines: include known keys in stable order, then any remaining free text parts
  const preserveLines = [];
  // We'll try to keep non-key parts of original text (lines without key:value) too
  const lines = originalText.split('\n').map(l=>l.trim()).filter(l=>l.length>0);
  for (const l of lines) {
    if (l.match(/^[a-zA-Z][a-zA-Z0-9_]*\s*:/)) continue; // skip key:value lines
    preserveLines.push(l);
  }
  const kvLines = [];
  const order = ['height','lat','lon','speed','heading','yaw'];
  for (const k of order) {
    if (meta && meta[k] !== undefined) kvLines.push(`${k}: ${meta[k]}`);
  }
  // remaining keys
  if (meta) {
    for (const k of Object.keys(meta)) {
      if (!order.includes(k)) kvLines.push(`${k}: ${meta[k]}`);
    }
  }
  return [...kvLines, ...preserveLines].join('\n');
}