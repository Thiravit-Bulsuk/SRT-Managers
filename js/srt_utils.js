export function parseTime(timeStr) {
  // "HH:MM:SS,ms" -> ms
  const m = timeStr.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if(!m) return null;
  return (
    parseInt(m[1],10)*3600000 +
    parseInt(m[2],10)*60000 +
    parseInt(m[3],10)*1000 +
    parseInt(m[4],10)
  );
}

export function formatTime(msTotal) {
  let ms = Math.max(0, Math.round(msTotal));
  const h = Math.floor(ms / 3600000); ms%=3600000;
  const m = Math.floor(ms / 60000); ms%=60000;
  const s = Math.floor(ms / 1000);
  const mi = ms % 1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(mi).padStart(3,'0')}`;
}

export function parseSrtToBlocks(srtText) {
  // tolerant split: split on two+ newlines with optional spaces
  const normalized = srtText.replace(/\r\n/g,'\n').trim();
  const rawBlocks = normalized.split(/\n{2,}/);
  const blocks = [];
  for (let raw of rawBlocks) {
    const lines = raw.split('\n');
    if (lines.length < 2) continue;
    // id might be numeric, but sometimes missing - handle both
    let id = null;
    let timeLineIndex = -1;
    if (/^\d+$/.test(lines[0].trim())) {
      id = lines[0].trim();
      timeLineIndex = 1;
    } else {
      timeLineIndex = 0;
    }
    const timeLine = lines[timeLineIndex];
    const timeMatch = timeLine && timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
    if (!timeMatch) continue;
    const startMs = parseTime(timeMatch[1]);
    const endMs = parseTime(timeMatch[2]);
    const text = lines.slice(timeLineIndex+1).join('\n');
    blocks.push({
      id: id,
      startMs,
      endMs,
      rawText: text,
      metadata: null // to be filled by telemetry parser
    });
  }
  return blocks;
}

export function blocksToSrt(blocks) {
  // render blocks with stable indexing
  const parts = [];
  for (let i=0;i<blocks.length;i++) {
    const index = i+1;
    const b = blocks[i];
    const timeLine = `${formatTime(b.startMs)} --> ${formatTime(b.endMs)}`;
    const text = (b.renderText !== undefined) ? b.renderText : b.rawText;
    parts.push(`${index}\n${timeLine}\n${text}`);
  }
  return parts.join('\n\n') + '\n';
}

export function mergeFileTexts(fileTexts, options={ordering:'name', gapMs:0, policy:'concatenate'}) {
  // fileTexts: [{name, text}]  options.policy: 'concatenate'|'keep'|'pad'
  // returns combined blocks (parsed), already offsetted
  const allFiles = fileTexts.slice();
  // default ordering by name
  if (options.ordering === 'name') allFiles.sort((a,b)=>a.name.localeCompare(b.name));
  let cumulativeOffset = 0;
  let merged = [];
  for (const f of allFiles) {
    const blocks = parseSrtToBlocks(f.text);
    if (blocks.length === 0) continue;
    const minStart = Math.min(...blocks.map(b=>b.startMs));
    const maxEnd = Math.max(...blocks.map(b=>b.endMs));
    if (options.policy === 'keep') {
      // keep timestamps as-is (no offset)
      for (const b of blocks) merged.push({...b});
    } else {
      // concatenate or pad: shift so the first block starts at cumulativeOffset
      const shift = cumulativeOffset - minStart;
      for (const b of blocks) {
        merged.push({...b, startMs: b.startMs + shift, endMs: b.endMs + shift});
      }
      cumulativeOffset += (maxEnd - minStart) + (options.gapMs||0);
    }
  }
  // sort merged by startMs
  merged.sort((a,b)=>a.startMs - b.startMs);
  return merged;
}