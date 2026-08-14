// Map + animation helpers. We use Leaflet for interactive view.
// For video export we draw a simple canvas representation (no tiles) to avoid CORS issues.

export function createLeafletMap(containerId, options={center:[0,0], zoom:3}) {
  const map = L.map(containerId, {zoomControl:true}).setView(options.center, options.zoom);
  // default tile (may be blocked for recording due to CORS) - we still show it interactively
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19}).addTo(map);
  const marker = L.circleMarker(options.center, {radius:6, color:'#ff0000'}).addTo(map);
  const poly = L.polyline([], {color:'#00ffcc', weight:3}).addTo(map);
  return {map, marker, poly};
}

export function showTrackOnMap(mapObj, track) {
  const {map, marker, poly} = mapObj;
  if (!track || track.length===0) return;
  const latlngs = track.map(p=>[p.lat,p.lon]);
  poly.setLatLngs(latlngs);
  marker.setLatLng(latlngs[0]);
  map.fitBounds(poly.getBounds().pad(0.2));
}

export function animateOnMap(mapObj, track, opts={speed:1, onTick:null}) {
  // step through track based on time deltas; speed multiplies realtime
  if (!track || track.length<2) return {stop:()=>{}};
  const {marker} = mapObj;
  let i = 0;
  let playing = true;
  let lastT = performance.now();
  const startTime = track[0].tMs;
  const endTime = track[track.length-1].tMs;
  let virtualTime = startTime;
  function step(now) {
    if (!playing) return;
    const dt = now - lastT;
    lastT = now;
    virtualTime += dt * opts.speed;
    // clamp
    if (virtualTime > endTime) {
      virtualTime = endTime;
      playing = false;
    }
    // find nearest segment
    while (i < track.length-1 && track[i+1].tMs <= virtualTime) i++;
    // interpolate between i and i+1
    const a = track[i], b = track[Math.min(i+1, track.length-1)];
    const ratio = (b.tMs === a.tMs) ? 0 : ((virtualTime - a.tMs)/(b.tMs - a.tMs));
    const lat = a.lat + (b.lat - a.lat)*ratio;
    const lon = a.lon + (b.lon - a.lon)*ratio;
    marker.setLatLng([lat, lon]);
    if (opts.onTick) opts.onTick({t:virtualTime, lat, lon});
    if (playing) requestAnimationFrame(step);
  }
  requestAnimationFrame((ts)=>{ lastT = ts; step(ts); });
  return {
    stop() { playing = false; }
  };
}

export function exportTrackToWebM(track, opts={width:640,height:360,fps:25,speed:1}) {
  // Draw simple canvas: background + polyline + moving dot. No tiles to avoid CORS.
  const w = opts.width, h = opts.height;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const stream = canvas.captureStream(opts.fps);
  const rec = new MediaRecorder(stream, {mimeType:'video/webm;codecs=vp8'});
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  return new Promise((resolve, reject) => {
    rec.onstop = () => {
      const blob = new Blob(chunks, {type:'video/webm'});
      resolve(blob);
    };
    rec.onerror = (ev)=>reject(ev);
    // prepare drawing transform: map lat/lon to canvas box
    const lats = track.map(p=>p.lat); const lons = track.map(p=>p.lon);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const pad = 0.05;
    const latRange = (maxLat - minLat) || 0.0001;
    const lonRange = (maxLon - minLon) || 0.0001;
    const toX = lon => ((lon - minLon)/lonRange)*(w*(1-2*pad)) + w*pad;
    const toY = lat => (1 - (lat - minLat)/latRange)*(h*(1-2*pad)) + h*pad;
    // precompute points
    const pts = track.map(p=>({t:p.tMs, x:toX(p.lon), y:toY(p.lat)}));
    const start = pts[0].t, end = pts[pts.length-1].t;
    const durationMs = (end - start)/opts.speed;
    const frameMs = 1000/opts.fps;
    let t = 0;
    rec.start();
    function drawFrame() {
      // clear
      ctx.fillStyle = '#0f1720';
      ctx.fillRect(0,0,w,h);
      // draw polyline
      ctx.strokeStyle = '#00ffcc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i=0;i<pts.length;i++) {
        const p = pts[i];
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      // compute virtual time
      const vt = start + t*opts.speed;
      // find position via interpolation
      let i = 0;
      while (i < pts.length-1 && pts[i+1].t <= vt) i++;
      const a = pts[i], b = pts[Math.min(i+1, pts.length-1)];
      const ratio = (b.t === a.t) ? 0 : ((vt - a.t)/(b.t - a.t));
      const x = a.x + (b.x - a.x)*ratio;
      const y = a.y + (b.y - a.y)*ratio;
      // draw drone
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(x,y,6,0,Math.PI*2);
      ctx.fill();
      // advance
      t += frameMs;
      if (t*opts.speed <= (end-start)) {
        setTimeout(()=>requestAnimationFrame(drawFrame), frameMs);
      } else {
        // finish
        setTimeout(()=>rec.stop(), 200);
      }
    }
    drawFrame();
  });
}