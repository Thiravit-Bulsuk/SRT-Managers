    (function () {
      function parseTime(timeStr) {
        if (!timeStr) return null;
        const m = timeStr.match(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/);
        if (!m) return null;
        return parseInt(m[1], 10) * 3600000 + parseInt(m[2], 10) * 60000 + parseInt(m[3], 10) * 1000 + parseInt(m[4], 10);
      }

      function formatTime(msTotal) {
        let ms = Math.max(0, Math.round(msTotal));
        const h = Math.floor(ms / 3600000); ms %= 3600000;
        const min = Math.floor(ms / 60000); ms %= 60000;
        const s = Math.floor(ms / 1000);
        const msPart = ms % 1000;
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(msPart).padStart(3, '0')}`;
      }

      function parseSrtToBlocks(srtText) {
        const normalized = (srtText || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/^\uFEFF/, '').trim();
        if (!normalized) return [];
        const blocks = [];
        const rawBlocks = normalized.split(/\n{2,}/);

        for (const raw of rawBlocks) {
          const lines = raw.split('\n').map(line => line.replace(/\uFEFF/g, '').trimEnd());
          if (lines.length < 2) continue;

          let id = null;
          let timeLineIndex = 0;
          if (/^\d+$/.test(lines[0].trim())) {
            id = lines[0].trim();
            timeLineIndex = 1;
          }

          const timeLine = lines[timeLineIndex];
          const timeMatch = timeLine && timeLine.match(/(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/);
          if (!timeMatch) continue;

          const startMs = parseTime(timeMatch[1]);
          const endMs = parseTime(timeMatch[2]);
          if (startMs === null || endMs === null) continue;

          const text = lines.slice(timeLineIndex + 1).join('\n').trim();
          blocks.push({ id, startMs, endMs, rawText: text, metadata: null, renderText: text });
        }
        return blocks;
      }

      function splitRenderLines(text) {
        return String(text || '')
          .replace(/<\/?font\b[^>]*>/gi, '')
          .replace(/\r/g, '')
          .split('\n')
          .map(line => line.trim())
          .filter(Boolean);
      }

      function buildSrtCueText(block) {
        const lines = splitRenderLines(block.renderText !== undefined ? block.renderText : block.rawText);
        const coordinateLine = lines.find(line => /^(Lat:|Longitude:|Latitude:|Lon:)/i.test(line) || /\|\s*Lon:/i.test(line));
        const heightLine = lines.find(line => /^(Height:|Alt:)/i.test(line));
        const dateLine = lines.find(line => /^Date\/Time:/i.test(line) || /^Date:/i.test(line) || /^Time:/i.test(line));
        const coreLines = new Set([coordinateLine, heightLine, dateLine].filter(Boolean));
        const extraLines = lines.filter(line => !coreLines.has(line));

        const pieces = [];
        if (coordinateLine) pieces.push(coordinateLine);
        if (dateLine) pieces.push(dateLine);
        pieces.push(...extraLines);
        if (heightLine) pieces.push(heightLine);

        if (pieces.length) return pieces.join(' | ');
        return lines.join(' | ');
      }

      function blocksToSrt(blocks) {
        const parts = [];
        let cueId = 1;
        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i];
          const text = buildSrtCueText(b);
          if (!text || !text.trim()) continue;
          parts.push(`${cueId++}\n${formatTime(b.startMs)} --> ${formatTime(b.endMs)}\n${text}`);
        }
        return parts.join('\n\n') + '\n';
      }

      function assTime(msTotal) {
        let ms = Math.max(0, Math.round(msTotal));
        const h = Math.floor(ms / 3600000); ms %= 3600000;
        const min = Math.floor(ms / 60000); ms %= 60000;
        const sec = Math.floor(ms / 1000);
        const centis = Math.floor((ms % 1000) / 10);
        return `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
      }

      function assText(value) {
        return String(value || '')
          .replace(/<\/?font\b[^>]*>/gi, '')
          .replace(/[{}]/g, '')
          .replace(/\r?\n/g, '\\N');
      }

      function blocksToAss(blocks) {
        const header = [
          '[Script Info]',
          'ScriptType: v4.00+',
          'PlayResX: 1920',
          'PlayResY: 1080',
          'ScaledBorderAndShadow: yes',
          '',
          '[V4+ Styles]',
          'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
          'Style: Default,Arial,54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,2,40,40,35,1',
          'Style: Coordinate,Arial,54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,1,40,40,35,1',
          'Style: Height,Arial,54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,3,40,40,35,1',
          'Style: Altitude,Arial,54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,3,40,40,95,1',
          'Style: DateTime,Arial,54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,7,40,40,35,1',
          'Style: Extra,Arial,54,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,9,40,40,35,1',
          '',
          '[Events]',
          'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text'
        ];
        const events = [];

        for (const b of blocks) {
          const lines = splitRenderLines(b.renderText !== undefined ? b.renderText : b.rawText);
          if (!lines.length) continue;

          const start = assTime(b.startMs);
          const end = assTime(b.endMs);
          const extraLines = [];

          for (const line of lines) {
            if (/^(Lat|Longitude|Longitude\s*:|Latitude|Lon)/i.test(line) || /\|\s*Lon:/i.test(line)) {
              events.push(`Dialogue: 0,${start},${end},Coordinate,,0,0,0,,${assText(line)}`);
            } else if (/^Height\b|^Alt\b/i.test(line)) {
              events.push(`Dialogue: 0,${start},${end},Height,,0,0,0,,${assText(line)}`);
            } else if (/^Date\b|^Time\b|Date\/Time/i.test(line)) {
              events.push(`Dialogue: 0,${start},${end},DateTime,,0,0,0,,${assText(line)}`);
            } else {
              extraLines.push(line);
            }
          }

          if (extraLines.length) {
            // Join lines with ASS newline escape sequence
            events.push(`Dialogue: 0,${start},${end},Extra,,0,0,0,,${assText(extraLines.join('\n'))}`);
          }
        }

        return `${header.join('\n')}\n${events.join('\n')}\n`;
      }

      function mergeFileTexts(fileTexts, options) {
        const allFiles = (fileTexts || []).slice();
        if (options && options.ordering === 'name') {
          allFiles.sort((a, b) => a.name.localeCompare(b.name));
        }

        let cumulativeOffset = 0;
        const merged = [];

        for (const f of allFiles) {
          const blocks = parseSrtToBlocks(f.text);
          if (!blocks.length) continue;

          const minStart = Math.min(...blocks.map(b => b.startMs));
          const maxEnd = Math.max(...blocks.map(b => b.endMs));

          if (options && options.policy === 'keep') {
            for (const b of blocks) merged.push({ ...b });
          } else {
            const shift = cumulativeOffset - minStart;
            for (const b of blocks) {
              merged.push({
                ...b,
                startMs: b.startMs + shift,
                endMs: b.endMs + shift,
                renderText: b.renderText || b.rawText
              });
            }
            cumulativeOffset += (maxEnd - minStart) + ((options && options.gapMs) || 0);
          }
        }

        merged.sort((a, b) => a.startMs - b.startMs);
        return merged;
      }

      const bracketKeyValueRegex = /\[\s*([a-zA-Z][a-zA-Z0-9 _-]*?)\s*:\s*([^\]]+)\]/g;
      const inlineKeyValueRegex = /(?:^|\s)([a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*(.*?)(?=\s+[a-zA-Z][a-zA-Z0-9_-]*\s*:|$)/g;
      const latLonRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;

      function normalizeValue(value) {
        const raw = String(value || '').trim();
        if (!raw) return raw;
        const numberWithOptionalUnit = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?(?:[a-zA-Z%/]+)?$/;
        if (!numberWithOptionalUnit.test(raw)) return raw;
        const numeric = Number(raw.replace(/[^0-9.\-+eE]/g, ''));
        return Number.isFinite(numeric) ? numeric : raw;
      }

      function addMetadataValue(map, rawKey, rawValue) {
        const key = rawKey.trim().toLowerCase().replace(/[\s-]+/g, '_');
        const value = normalizeValue(rawValue);
        if (key && value !== '') map[key] = value;
      }

      function extractMetadataFromText(text) {
        const map = {};
        let m;

        // Regex for YYYY-MM-DD HH:MM:SS.ms format
        const dateTimeRegex = /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}[.,]\d{3})/;
        const dateTimeMatch = text.match(dateTimeRegex);
        if (dateTimeMatch && dateTimeMatch[1]) {
          addMetadataValue(map, 'datetime', dateTimeMatch[1]);
        }

        bracketKeyValueRegex.lastIndex = 0;
        while ((m = bracketKeyValueRegex.exec(text)) !== null) {
          addMetadataValue(map, m[1], m[2]);
        }

        inlineKeyValueRegex.lastIndex = 0;
        while ((m = inlineKeyValueRegex.exec(text)) !== null) {
          addMetadataValue(map, m[1], m[2]);
        }

        const latlon = text.match(latLonRegex);
        if (latlon) {
          map.lat = parseFloat(latlon[1]);
          map.lon = parseFloat(latlon[2]);
        }

        // normalize common latitude/longitude names into numeric lat/lon
        if (map.latitude !== undefined && map.lat === undefined) {
          const n = Number(map.latitude);
          if (Number.isFinite(n)) map.lat = n;
        }
        if (map.longitude !== undefined && map.lon === undefined) {
          const n = Number(map.longitude);
          if (Number.isFinite(n)) map.lon = n;
        }
        if (map.lng !== undefined && map.lon === undefined) {
          const n = Number(map.lng);
          if (Number.isFinite(n)) map.lon = n;
        }
        if (map.lat !== undefined) {
          const n = Number(map.lat);
          if (Number.isFinite(n)) map.lat = n;
        }
        if (map.lon !== undefined) {
          const n = Number(map.lon);
          if (Number.isFinite(n)) map.lon = n;
        }

        if (map.altitude !== undefined) {
          map.altitude = Number(map.altitude);
          if (map.height === undefined && Number.isFinite(map.altitude)) map.height = map.altitude;
        }
        if (map.alt !== undefined) map.height = map.alt;
        if (map.rel_alt !== undefined) map.height = map.rel_alt;

        return map;
      }

      function classifyTelemetrySource(blocks) {
        const keys = new Set();
        let hasCoordinates = false;
        for (const block of blocks) {
          const metadata = block.metadata || {};
          Object.keys(metadata).forEach(key => keys.add(key));
          if (Number.isFinite(Number(metadata.lat)) && Number.isFinite(Number(metadata.lon))) hasCoordinates = true;
        }
        const hasGogglesSignature = keys.has('glsbat') || keys.has('bitrate') || (keys.has('hs') && keys.has('vs'));
        const hasFPVDroneSignature = keys.has('roll') || keys.has('pitch') || keys.has('yaw');

        if (hasCoordinates) return 'drone-camera';
        if (hasGogglesSignature && !hasFPVDroneSignature) return 'goggles-telemetry';
        return 'generic';
      }

      function getNumericValue(metadata, key) {
        const value = metadata && metadata[key];
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : null;
      }

      function formatTelemetryValue(value, unit) {
        return value === null || value === undefined ? 'N/A' : `${value.toFixed(1)}${unit}`;
      }

      function renderGogglesTelemetry(blocks) {
        const telemetryCard = document.getElementById('telemetryCard');
        const notice = document.getElementById('telemetryNotice');
        const summary = document.getElementById('telemetrySummary');
        const slider = document.getElementById('telemetrySlider');
        const current = document.getElementById('telemetryCurrent');
        const valuesFor = key => blocks.map(block => getNumericValue(block.metadata, key)).filter(value => value !== null);
        const maximum = key => {
          const values = valuesFor(key);
          return values.length ? Math.max(...values) : null;
        };
        const minimum = key => {
          const values = valuesFor(key);
          return values.length ? Math.min(...values) : null;
        };
        const average = key => {
          const values = valuesFor(key);
          return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        };
        const metrics = [
          ['Max height', formatTelemetryValue(maximum('height'), ' m')],
          ['Max distance', formatTelemetryValue(maximum('distance'), ' m')],
          ['Max horizontal speed', formatTelemetryValue(maximum('hs'), ' m/s')],
          ['Max vertical speed', formatTelemetryValue(maximum('vs'), ' m/s')],
          ['Average bitrate', formatTelemetryValue(average('bitrate'), ' Mbps')],
          ['Delay range', minimum('delay') === null ? 'N/A' : `${minimum('delay').toFixed(0)}-${maximum('delay').toFixed(0)} ms`],
          ['GPS satellites', minimum('gpsnum') === null ? 'N/A' : `${minimum('gpsnum').toFixed(0)}-${maximum('gpsnum').toFixed(0)}`]
        ];
        notice.textContent = `Goggles telemetry detected: ${blocks.length} cues. GPS coordinates are not present, so no map or track is shown.`;
        summary.innerHTML = metrics.map(([label, value]) => `<div class="telemetry-metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
        slider.min = '0';
        slider.max = String(Math.max(0, blocks.length - 1));
        slider.value = '0';
        function updateCurrent(index) {
          const block = blocks[index] || blocks[0];
          if (!block) return;
          const metadata = block.metadata || {};
          const fields = [
            ['Time', formatTime(block.startMs)], ['Height', formatTelemetryValue(getNumericValue(metadata, 'height'), ' m')],
            ['Distance', formatTelemetryValue(getNumericValue(metadata, 'distance'), ' m')], ['Horizontal speed', formatTelemetryValue(getNumericValue(metadata, 'hs'), ' m/s')],
            ['Vertical speed', formatTelemetryValue(getNumericValue(metadata, 'vs'), ' m/s')], ['Goggles battery', formatTelemetryValue(getNumericValue(metadata, 'glsbat'), ' V')],
            ['Delay', formatTelemetryValue(getNumericValue(metadata, 'delay'), ' ms')], ['Bitrate', formatTelemetryValue(getNumericValue(metadata, 'bitrate'), ' Mbps')],
            ['GPS satellites', formatTelemetryValue(getNumericValue(metadata, 'gpsnum'), '')], ['Signal', metadata.signal || 'N/A']
          ];
          current.innerHTML = `<table><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody>${fields.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('')}</tbody></table>`;
        }
        slider.oninput = event => updateCurrent(Number(event.target.value));
        updateCurrent(0);
        telemetryCard.style.display = 'block';
      }

      function renderTextFromMetadata(originalText, meta) {
        const m = meta || {};
        const lines = [];

        const lat = m.lat ?? m.latitude;
        const lon = m.lon ?? m.longitude;
        if (lat !== undefined && lon !== undefined) {
          lines.push(`Lat: ${Number(lat).toFixed(6)} | Lon: ${Number(lon).toFixed(6)}`);
        }

        // Height above launch/ground point (relative height)
        const heightValue = m.height;
        if (heightValue !== undefined && heightValue !== null && heightValue !== '') {
          lines.push(`Height: ${Number(heightValue).toFixed(2)}`);
        }

        // Altitude above sea level (separate value from relative height)
        const altValue = m.alt ?? m.altitude;
        if (altValue !== undefined && altValue !== null && altValue !== '') {
          lines.push(`Altitude: ${Number(altValue).toFixed(2)}`);
        }

        const dateValue = m.date ?? m.datetime ?? m.timestamp ?? m.time;
        if (dateValue !== undefined && dateValue !== null && dateValue !== '') {
          const formattedDate = String(dateValue).replace('T', ' ');
          if (/\d{4}-\d{2}-\d{2}/.test(formattedDate)) {
            lines.push(`Date/Time: ${formattedDate}`);
          } else if (m.date && m.time) {
            lines.push(`Date/Time: ${m.date} ${m.time}`);
          } else {
            lines.push(`Date/Time: ${formattedDate}`);
          }
        }

        const orderedKeys = ['speed', 'heading', 'yaw', 'battery', 'gpsnum', 'signal', 'temperature', 'distance', 'flight_distance', 'flight_time', 'index'];
        for (const key of orderedKeys) {
          if (m[key] === undefined || m[key] === null || m[key] === '') continue;
          let value = Number(m[key]);
          if (key === 'speed') value *= 3.6; // Convert m/s from DJI to km/h
          const decimals = key === 'flight_distance' ? 3 : (value % 1 === 0 ? 0 : 2);
          const text = Number.isFinite(value) ? value.toFixed(decimals) : String(m[key]);
          const label = key === 'gpsnum' ? 'GPS Num' : key === 'flight_time' ? 'Flight Time'
            : key === 'distance' ? 'Distance' : key === 'flight_distance' ? 'Flight Distance'
            : key.charAt(0).toUpperCase() + key.slice(1);
          const unit = key === 'speed' ? ' km/h' : key === 'flight_time' ? ' s'
            : key === 'distance' ? ' m' : key === 'flight_distance' ? ' km' : '';
          lines.push(`${label}: ${text}${unit}`);
        }

        const extraKeys = Object.keys(m)
          .filter(key => !['lat', 'lon', 'latitude', 'longitude', 'height', 'alt', 'altitude', 'date', 'datetime', 'timestamp', 'time', ...orderedKeys].includes(String(key).toLowerCase()))
          .sort();
        for (const key of extraKeys) {
          if (m[key] === undefined || m[key] === null || m[key] === '') continue;
          const rawValue = m[key];
          const numericValue = Number(rawValue);
          const text = Number.isFinite(numericValue) && rawValue !== '' ? numericValue.toFixed(2) : String(rawValue);
          lines.push(`${key}: ${text}`);
        }

        if (lines.length) return lines.join('\n');

        const fallback = String(originalText || '').split('\n').map(line => line.trim()).filter(Boolean);
        return fallback.join('\n');
      }

      function applyAltitudeCorrection(blocks, opts) {
        const options = Object.assign({ scale: 1, baseOffset: null, auto: true }, opts || {});
        if (options.auto && options.baseOffset === null) {
          const firstWithHeight = blocks.find(b => b.metadata && b.metadata.height !== undefined);
          options.baseOffset = firstWithHeight ? Number(firstWithHeight.metadata.height) || 0 : 0;
        }

        for (const b of blocks) {
          if (!b.metadata) continue;
          if (b.metadata.height !== undefined && b.metadata.height !== null) {
            const raw = Number(b.metadata.height);
            const corrected = ((raw - (options.baseOffset || 0)) * (options.scale || 1));
            b.metadata.height = Number(corrected.toFixed(2));
          }
        }

        for (const b of blocks) {
          b.renderText = renderTextFromMetadata(b.rawText, b.metadata);
        }

        return blocks;
      }

      function filterMetadata(blocks, allowedKeys) {
        const allowSet = new Set((allowedKeys || []).map(k => String(k).toLowerCase()));
        for (const b of blocks) {
          if (!b.metadata) continue;
          const kept = {};
          Object.keys(b.metadata).forEach(k => {
            if (allowSet.has(String(k).toLowerCase())) kept[k] = b.metadata[k];
          });
          b.metadata = kept;
          b.renderText = renderTextFromMetadata(b.rawText, b.metadata);
        }
        return blocks;
      }

      // Great-circle distance between two GPS points, in meters (haversine formula)
      function haversineDistanceM(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const toRad = deg => deg * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
      }

      // Adds distance-from-first-fix and cumulative flight distance to blocks that carry lat/lon metadata
      function computeDistanceMetrics(blocks) {
        let homeLat = null, homeLon = null;
        let prevLat = null, prevLon = null;
        let cumulativeM = 0;
        let found = false;

        for (const b of blocks) {
          if (!b.metadata) continue;
          const lat = Number(b.metadata.lat ?? b.metadata.latitude);
          const lon = Number(b.metadata.lon ?? b.metadata.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

          if (homeLat === null) { homeLat = lat; homeLon = lon; }
          if (prevLat !== null) cumulativeM += haversineDistanceM(prevLat, prevLon, lat, lon);
          prevLat = lat; prevLon = lon;

          b.metadata.distance = Number(haversineDistanceM(homeLat, homeLon, lat, lon).toFixed(2));
          b.metadata.flight_distance = Number((cumulativeM / 1000).toFixed(3));
          found = true;
        }
        return found;
      }

      function extractGPSTrack(blocks) {
        const track = [];
        for (const b of blocks) {
          if (!b.metadata) continue;
          // accept several possible key names; metadata should already be normalized
          const getNum = (obj, ...names) => {
            for (const n of names) {
              if (obj[n] !== undefined) {
                const v = Number(obj[n]);
                if (Number.isFinite(v)) return v;
              }
            }
            return undefined;
          };

          const lat = getNum(b.metadata, 'lat', 'latitude', 'y');
          const lon = getNum(b.metadata, 'lon', 'longitude', 'lng', 'x');
          if (lat !== undefined && lon !== undefined) {
            track.push({ tMs: b.startMs, lat: lat, lon: lon, extra: b.metadata });
          }
        }
        track.sort((a, b) => a.tMs - b.tMs);
        return track;
      }

      function normalizeHeading(value) {
        let heading = Number(value);
        if (!Number.isFinite(heading)) return null;
        if (Math.abs(heading) > 360) heading /= 10;
        return ((heading % 360) + 360) % 360;
      }

      function createGoogleMap(containerId, options) {
        const center = options && options.center ? options.center : [0, 0];
        const googleCenter = { lat: center[0], lng: center[1] };
        const map = new google.maps.Map(document.getElementById(containerId), {
          center: googleCenter,
          zoom: options && options.zoom ? Math.min(options.zoom, 20) : 15,
          maxZoom: 19,
          mapTypeId: 'satellite',
          streetViewControl: false,
          mapTypeControl: true,
          fullscreenControl: true
        });
        const marker = new google.maps.Marker({
          map,
          position: googleCenter,
          title: 'Drone'
        });
        const infoWindow = new google.maps.InfoWindow();
        const polyline = new google.maps.Polyline({
          map,
          path: [],
          strokeColor: '#00ffcc',
          strokeOpacity: 1,
          strokeWeight: 3
        });
        const maxZoomService = new google.maps.MaxZoomService();
        let lastZoomLookup = '';
        function updateSatelliteZoomLimit() {
          const mapCenter = map.getCenter();
          if (!mapCenter) return;
          const lookupKey = `${mapCenter.lat().toFixed(3)},${mapCenter.lng().toFixed(3)}`;
          if (lookupKey === lastZoomLookup) return;
          lastZoomLookup = lookupKey;
          maxZoomService.getMaxZoomAtLatLng(mapCenter, response => {
            const availableZoom = response.status === 'OK' && Number.isFinite(response.zoom) ? response.zoom : 18;
            map.setOptions({ maxZoom: Math.max(1, Math.min(19, availableZoom)) });
          });
        }
        map.addListener('idle', updateSatelliteZoomLimit);
        updateSatelliteZoomLimit();

          // Responsive map sizing: cap height to viewport and container width
          const container = document.getElementById(containerId);
          function resizeSquare() {
            try {
              const containerWidth = Math.max(240, container.clientWidth || 0);
              const maxAllowed = Math.max(200, Math.floor(window.innerHeight * 0.72));
              const h = Math.min(containerWidth, maxAllowed);
              container.style.height = h + 'px';
              google.maps.event.trigger(map, 'resize');
            } catch (e) {
              try { google.maps.event.trigger(map, 'resize'); } catch (_) {}
            }
          }
          resizeSquare();
          window.addEventListener('resize', resizeSquare);
          window.addEventListener('orientationchange', function(){ setTimeout(resizeSquare, 200); });

        return { map, marker, poly: polyline, infoWindow };
      }

      function showTrackOnMap(mapObj, track) {
        if (!mapObj || !track || !track.length) return;
        const { map, marker, poly } = mapObj;
        const path = track.map(p => ({ lat: p.lat, lng: p.lon }));
        try { if (poly && typeof poly.setPath === 'function') poly.setPath(path); } catch (e) { console.warn('poly.setPath failed', e); }
        try { if (marker && typeof marker.setPosition === 'function') marker.setPosition(path[0]); } catch (e) { console.warn('marker.setPosition failed', e); }
        try {
          const bounds = new google.maps.LatLngBounds();
          path.forEach(point => bounds.extend(point));
          map.fitBounds(bounds);
        } catch (e) {
          try { if (map && typeof map.setCenter === 'function') map.setCenter(path[0]); } catch (e2) {}
        }
      }

      function animateOnMap(mapObj, track, opts) {
        // Returns a controller with play/pause/stop/seek/setSpeed
        if (!track || track.length < 2) return {
          play() {}, pause() {}, stop() {}, seekTo() {}, seekBy() {}, setSpeed() {}
        };

        const { map, marker, infoWindow } = mapObj;
        const startTime = track[0].tMs;
        const endTime = track[track.length - 1].tMs;
        let virtualTime = startTime;
        let playing = false;
        let speed = (opts && opts.speed) || 1;
        let rafId = null;
        let lastTs = null;
        let index = 0;

        function clamp(v) { return Math.max(startTime, Math.min(endTime, v)); }

        function updateMarkerAt(tMs) {
          // advance index to just before tMs
          while (index < track.length - 1 && track[index + 1].tMs <= tMs) index++;
          while (index > 0 && track[index].tMs > tMs) index--;
          const a = track[index];
          const b = track[Math.min(index + 1, track.length - 1)];
          const ratio = (b.tMs === a.tMs) ? 0 : ((tMs - a.tMs) / (b.tMs - a.tMs));
          const lat = a.lat + (b.lat - a.lat) * ratio;
          const lon = a.lon + (b.lon - a.lon) * ratio;
          try { marker.setPosition({ lat, lng: lon }); } catch (e) {}
          // update marker visual: arrow if heading available, otherwise dot
          try {
            const extraMeta = (track[index] && track[index].extra) || {};
            const h = (function () {
              const names = ['heading','yaw','hdg','course','bearing'];
              for (const n of names) {
                if (extraMeta[n] !== undefined) {
                  const v = Number(extraMeta[n]); if (Number.isFinite(v)) return v;
                }
              }
              return null;
            })();
            const rLat = (extraMeta.lat !== undefined) ? Number(extraMeta.lat) : lat;
            const rLon = (extraMeta.lon !== undefined) ? Number(extraMeta.lon) : lon;
            if (Number.isFinite(rLat) && Number.isFinite(rLon)) {
              if (marker && typeof marker.setPosition === 'function') marker.setPosition({ lat: rLat, lng: rLon });
              if (infoWindow && map) {
                infoWindow.setContent('Lat: ' + rLat.toFixed(6) + '<br>Lon: ' + rLon.toFixed(6));
                infoWindow.open({ map, anchor: marker });
              }
            }
          } catch (e) { /* ignore DOM update errors */ }

          if (opts && typeof opts.onTick === 'function') opts.onTick({ t: tMs, lat, lon, start: startTime, end: endTime });
        }

        function loop(ts) {
          if (!playing) return;
          if (lastTs === null) lastTs = ts;
          const dt = ts - lastTs;
          lastTs = ts;
          virtualTime = clamp(virtualTime + dt * speed);
          updateMarkerAt(virtualTime);
          if (virtualTime >= endTime) { 
            // ensure final tick reported
            if (opts && typeof opts.onTick === 'function') try { opts.onTick({ t: endTime, lat: track[track.length-1].lat, lon: track[track.length-1].lon, start: startTime, end: endTime }); } catch(e){}
            pause(); 
          }
          else { rafId = requestAnimationFrame(loop); }
        }

        function play() {
          if (playing) return;
          playing = true; lastTs = null;
          rafId = requestAnimationFrame(loop);
        }
        function pause() { playing = false; if (rafId) { cancelAnimationFrame(rafId); rafId = null; } lastTs = null; }
        function stop() { pause(); virtualTime = startTime; index = 0; updateMarkerAt(virtualTime); }
        function seekTo(tMs) { virtualTime = clamp(tMs); updateMarkerAt(virtualTime); }
        function seekBy(delta) { seekTo(virtualTime + delta); }
        function setSpeed(s) { speed = s; }

        // initialize marker position
        updateMarkerAt(virtualTime);

        return { play, pause, stop, seekTo, seekBy, setSpeed };
      }

      // exportTrackToWebM removed — video export disabled per user request

      const fileInput = document.getElementById('fileInput');
      const uploadBtn = document.getElementById('uploadBtn');
      const fileList = document.getElementById('fileList');
      const processBtn = document.getElementById('processBtn');
      const mergePolicy = document.getElementById('mergePolicy');
      const gapMs = document.getElementById('gapMs');
      const scaleInput = document.getElementById('scale');
      const offsetType = document.getElementById('offsetType');
      const manualOffset = document.getElementById('manualOffset');
      const keyContainer = document.getElementById('keyContainer');
      const filterCard = document.getElementById('filterCard');
      const previewBox = document.getElementById('previewBox');
      const downloadBtn = document.getElementById('downloadBtn');
      const downloadAssBtn = document.getElementById('downloadAssBtn');
      const selectAll = document.getElementById('selectAll');
      const deselectAll = document.getElementById('deselectAll');
      const status = document.getElementById('status');
      const mapCard = document.getElementById('mapCard');
      const playBtn = document.getElementById('playBtn');
      const pauseBtn = document.getElementById('pauseBtn');

      let selectedFiles = [];
      let mergedBlocks = [];
      let gpsTrack = [];
      let mapObj = null;
      let animHandle = null;
      let telemetrySource = 'generic';

      function syncControlsForSelectedFile() {
        const scaleControl = document.getElementById('scaleControl');
        if (!scaleControl) return;

        const selectedFile = selectedFiles[0] && selectedFiles[0].file;
        const isTxt = !selectedFile || !/\.srt$/i.test(selectedFile.name || '');
        scaleControl.style.display = isTxt ? 'none' : 'block';
      }

      uploadBtn.addEventListener('click', function (e) {
        e.preventDefault();
        fileInput.click();
      });

      fileInput.addEventListener('change', function (e) {
        selectedFiles = Array.from(e.target.files).map(f => ({ name: f.name, file: f }));
        fileList.innerHTML = '<ul>' + selectedFiles.map(f => '<li>' + f.name + '</li>').join('') + '</ul>';
        syncControlsForSelectedFile();
      });

      async function readAllFiles() {
        const arr = [];
        for (const sf of selectedFiles) {
          const text = await sf.file.text();
          arr.push({ name: sf.name, text });
        }
        return arr;
      }

      async function uploadDjiFlightRecord(file) {
        const form = new FormData();
        form.append('file', file);

        const apiBaseUrl = 'https://dji-rust-parser-334697705514.asia-southeast1.run.app';
        const response = await fetch(`${apiBaseUrl}/api/flight-record/parse`, {
          method: 'POST',
          body: form
        });

        const data = await response.json();
        if (!data.ok) {
          throw new Error(data.error || 'Parse failed');
        }

        return data.points || [];
      }

      function normalizeBackendTrack(points) {
        if (!Array.isArray(points)) return [];
        return points
          .filter(p => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lon)))
          .map(p => ({
            tMs: Number(p.tMs) || 0,
            lat: Number(p.lat),
            lon: Number(p.lon),
            extra: {
              ...p,
              lat: Number(p.lat),
              lon: Number(p.lon)
            }
          }))
          .sort((a, b) => a.tMs - b.tMs);
      }

      function createBlocksFromTrack(track) {
        if (!Array.isArray(track) || !track.length) return [];

        const blocks = [];
        for (let i = 0; i < track.length; i++) {
          const point = track[i] || {};
          const startMs = Number(point.tMs) || 0;
          const prevMs = i > 0 ? Number(track[i - 1].tMs) || startMs : startMs;
          const nextPoint = track[i + 1] || null;
          const nextMs = nextPoint ? (Number(nextPoint.tMs) || startMs) : startMs + Math.max(20, startMs - prevMs || 20);
          const endMs = nextMs > startMs ? nextMs : startMs + Math.max(20, startMs - prevMs || 20);
          const meta = {};

          const pointEntries = point && typeof point === 'object' ? point : {};
          Object.keys(pointEntries).forEach(key => {
            if (key === 'extra') return;
            const value = pointEntries[key];
            if (value !== undefined && value !== null && value !== '') meta[key] = value;
          });

          const extra = point.extra && typeof point.extra === 'object' ? point.extra : {};
          Object.keys(extra).forEach(key => {
            const value = extra[key];
            if (value !== undefined && value !== null && value !== '') meta[key] = value;
          });

          if (Number.isFinite(Number(meta.lat))) meta.lat = Number(meta.lat);
          if (Number.isFinite(Number(meta.lon))) meta.lon = Number(meta.lon);
          if (Number.isFinite(Number(meta.alt))) meta.alt = Number(meta.alt);
          if (Number.isFinite(Number(meta.height))) {
            meta.height = Number(meta.height);
          } else if (Number.isFinite(Number(meta.alt))) {
            // Fallback for older backend responses that don't provide a separate height field
            meta.height = Number(meta.alt);
          }
          if (Number.isFinite(Number(meta.speed))) meta.speed = Number(meta.speed);
          if (Number.isFinite(Number(meta.heading))) meta.heading = Number(meta.heading);

          const preferredOrder = ['lat', 'lon', 'height', 'alt', 'speed', 'heading', 'datetime', 'index', 'tMs'];
          const renderEntries = preferredOrder
            .filter(key => meta[key] !== undefined)
            .map(key => {
              const value = Number(meta[key]);
              const formatted = Number.isFinite(value)
                ? (key === 'lat' || key === 'lon' ? value.toFixed(6) : value.toFixed(2))
                : meta[key];
              return `${key}: ${formatted}`;
            });

          const extraEntries = Object.keys(meta)
            .filter(key => !preferredOrder.includes(key) && key !== 'extra')
            .map(key => {
              const rawValue = meta[key];
              const numericValue = Number(rawValue);
              const formatted = Number.isFinite(numericValue) && rawValue !== '' ? numericValue.toFixed(2) : rawValue;
              return `${key}: ${formatted}`;
            });

          const rawText = [...renderEntries, ...extraEntries].join('\n') || `lat: ${meta.lat ?? 'n/a'}\nlon: ${meta.lon ?? 'n/a'}`;

          blocks.push({
            id: i + 1,
            startMs,
            endMs,
            rawText,
            metadata: meta,
            renderText: rawText
          });
        }
        return blocks;
      }

      function updatePreview() {
        const out = mergedBlocks.slice(0, 5).map((b, i) => {
          const tl = `${formatTime(b.startMs)} --> ${formatTime(b.endMs)}`;
          const txt = b.renderText || b.rawText;
          return `${i + 1}\n${tl}\n${txt}`;
        }).join('\n\n');
        previewBox.innerText = out;
      }

      processBtn.addEventListener('click', async function () {
        if (!selectedFiles.length) {
          alert('โปรดเลือกไฟล์ก่อน');
          return;
        }

        const selectedFile = selectedFiles[0].file;
        status.innerText = 'Processing...';

        try {
          const fileName = selectedFile.name || '';
          syncControlsForSelectedFile(); // This function already checks the extension

          if (/\.srt$/i.test(fileName)) {
            const files = await readAllFiles();
            const policy = mergePolicy.value;
            const opts = { ordering: 'name', policy: policy, gapMs: Number(gapMs.value) || 0 };
            mergedBlocks = mergeFileTexts(files, opts);

            const discoveredKeys = new Set();
            for (const b of mergedBlocks) {
              b.metadata = extractMetadataFromText(b.rawText);
              if (b.metadata) {
                Object.keys(b.metadata).forEach(k => discoveredKeys.add(String(k).toLowerCase()));
              }
            }
            if (discoveredKeys.has('latitude')) discoveredKeys.delete('lat');
            if (discoveredKeys.has('longitude')) discoveredKeys.delete('lon');

            // Classify telemetry source based on filename first, then content if generic
            const fileName = selectedFiles[0].name.toUpperCase();
            if (fileName.includes('DJI_') && fileName.endsWith('.SRT')) {
              telemetrySource = 'drone-camera';
            } else if (fileName.includes('DJI') && fileName.endsWith('.SRT')) {
              telemetrySource = 'goggles-telemetry';
            } else {
              telemetrySource = classifyTelemetrySource(mergedBlocks); // Fallback to content-based classification
            }

            // Correct altitude for drone-camera source, as per user request, but leave height
            // for the UI controls to handle. This avoids double-correction.
            if (telemetrySource === 'drone-camera') {
              for (const block of mergedBlocks) {
                if (block.metadata && block.metadata.altitude !== undefined) {
                  const originalAltitude = Number(block.metadata.altitude);
                  if (Number.isFinite(originalAltitude)) {
                    block.metadata.altitude = originalAltitude * 10;
                    block.metadata.altitude = Number(block.metadata.altitude.toFixed(2));
                  }
                }
              }
            }

            const scale = Number(scaleInput.value) || 1;
            const auto = offsetType.value === 'auto';
            const base = auto ? null : (Number(manualOffset.value) || 0);

            // Distance from first GPS fix + cumulative flight distance, when lat/lon metadata is present
            const hasDistanceMetrics = computeDistanceMetrics(mergedBlocks);
            if (hasDistanceMetrics) {
              discoveredKeys.add('distance');
              discoveredKeys.add('flight_distance');
            }

            applyAltitudeCorrection(mergedBlocks, { scale, baseOffset: base, auto });

            keyContainer.innerHTML = '';
            discoveredKeys.forEach(k => {
              const lab = document.createElement('label');
              lab.className = 'k';
              const checkedByDefault = ['latitude', 'longitude', 'height', 'alt', 'altitude', 'date', 'time', 'datetime', 'distance', 'flight_distance'].includes(k);
              lab.innerHTML = `<input type="checkbox" value="${k}"${checkedByDefault ? ' checked' : ''}> ${k}`;
              keyContainer.appendChild(lab);
            });

            filterCard.style.display = 'block';
            updatePreview();

            gpsTrack = extractGPSTrack(mergedBlocks);
          } else if (/\.txt$/i.test(fileName)) {
            status.innerText = 'Uploading DJI flight record to backend...';
            const points = await uploadDjiFlightRecord(selectedFile);
            gpsTrack = normalizeBackendTrack(points);
            mergedBlocks = createBlocksFromTrack(gpsTrack);

            const discoveredKeys = new Set();
            for (const b of mergedBlocks) {
              b.metadata = b.metadata || {};
              Object.keys(b.metadata).forEach(k => discoveredKeys.add(String(k).toLowerCase()));
            }
            if (discoveredKeys.has('latitude')) discoveredKeys.delete('lat');
            if (discoveredKeys.has('longitude')) discoveredKeys.delete('lon');

            const auto = offsetType.value === 'auto';
            const base = auto ? null : (Number(manualOffset.value) || 0);
            applyAltitudeCorrection(mergedBlocks, { scale: 1, baseOffset: base, auto });

            keyContainer.innerHTML = '';
            discoveredKeys.forEach(k => {
              const lab = document.createElement('label');
              lab.className = 'k';
              const checkedByDefault = ['lat', 'lon', 'height', 'alt', 'altitude', 'date', 'time', 'datetime', 'distance', 'flight_distance'].includes(k);
              lab.innerHTML = `<input type="checkbox" value="${k}"${checkedByDefault ? ' checked' : ''}> ${k}`;
              keyContainer.appendChild(lab);
            });

            filterCard.style.display = 'block';
            updatePreview();
            previewBox.innerText = previewBox.innerText || JSON.stringify(points.slice(0, 5), null, 2);
            status.innerText = `Received ${gpsTrack.length} GPS points from backend. Choose fields to export as SRT.`;
            telemetrySource = 'drone-flight-record';
          } else {
            alert(`Unsupported file type: ${fileName}. Please select a .srt or .txt file.`);
            status.innerText = `Unsupported file type: ${fileName}.`;
          }

          if (gpsTrack.length > 0) {
            await window.googleMapsReady;
            document.getElementById('telemetryCard').style.display = 'none';
            mapCard.style.display = 'block';
            if (!mapObj) mapObj = createGoogleMap('map', { center: [gpsTrack[0].lat, gpsTrack[0].lon], zoom: 15 });
            showTrackOnMap(mapObj, gpsTrack);
            if (animHandle && animHandle.stop) animHandle.stop();
            animHandle = animateOnMap(mapObj, gpsTrack, {
              speed: 1,
              onTick: function (s) {
                const percent = ((s.t - s.start) / (s.end - s.start)) * 100;
                const slider = document.getElementById('timeSlider');
                const label = document.getElementById('timeLabel');
                if (slider) slider.value = isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
                if (label) label.innerText = formatTime(s.t);
                try { status.innerText = 'Playing: ' + formatTime(s.t); } catch (e) {}
              }
            });
            try {
              const p = document.getElementById('playBtn'); if (p) p.disabled = false;
              const z = document.getElementById('pauseBtn'); if (z) z.disabled = true;
              const rs = document.getElementById('rewindBtn'); if (rs) rs.disabled = false;
              const fsbtn = document.getElementById('ffBtn'); if (fsbtn) fsbtn.disabled = false;
              const sb = document.getElementById('stopBtn'); if (sb) sb.disabled = false;
              const slider = document.getElementById('timeSlider'); if (slider) { slider.disabled = false; slider.value = 0; }
            } catch (e) { console.warn('enable controls failed', e); }
          } else {
            mapCard.style.display = 'none';
            if (telemetrySource === 'goggles-telemetry') {
              renderGogglesTelemetry(mergedBlocks);
              status.innerText = `Processed ${mergedBlocks.length} goggles telemetry cues. Map disabled because this recording has no GPS coordinates.`;
            } else {
              document.getElementById('telemetryCard').style.display = 'none';
              status.innerText = `Processed ${mergedBlocks.length} blocks. No GPS coordinates found.`;
            }
          }
        } catch (err) {
          console.error('Process failed:', err);
          status.innerText = err.message || 'Failed to process file';
        }
      });

      selectAll.addEventListener('click', function () {
        document.querySelectorAll('#keyContainer input').forEach(cb => cb.checked = true);
      });

      deselectAll.addEventListener('click', function () {
        document.querySelectorAll('#keyContainer input').forEach(cb => cb.checked = false);
      });

      downloadBtn.addEventListener('click', function () {
        const checked = Array.from(document.querySelectorAll('#keyContainer input:checked')).map(cb => cb.value);
        filterMetadata(mergedBlocks, checked);
        const finalSrt = blocksToSrt(mergedBlocks);
        const blob = new Blob([finalSrt], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        const name = selectedFiles[0] && selectedFiles[0].name ? selectedFiles[0].name.replace(/\.[^/.]+$/, '') : 'merged';
        a.href = URL.createObjectURL(blob);
        a.download = `${name}.SRT`;
        a.click();
        URL.revokeObjectURL(a.href);
        status.innerText = `ดาวน์โหลด SRT เสร็จแล้ว: ${a.download}`;
      });

      downloadAssBtn.addEventListener('click', function () {
        const checked = Array.from(document.querySelectorAll('#keyContainer input:checked')).map(cb => cb.value);
        filterMetadata(mergedBlocks, checked);
        const finalAss = blocksToAss(mergedBlocks);
        const blob = new Blob([finalAss], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        const name = selectedFiles[0] && selectedFiles[0].name ? selectedFiles[0].name.replace(/\.[^/.]+$/, '') : 'merged';
        a.href = URL.createObjectURL(blob);
        a.download = `${name}.ass`;
        a.click();
        URL.revokeObjectURL(a.href);
        status.innerText = `ดาวน์โหลด ASS เสร็จแล้ว: ${a.download}`;
      });

      playBtn.addEventListener('click', async function () {
        try {
          console.log('play clicked, animHandle=', !!animHandle);
          status.innerText = 'Starting animation...';
          if (!animHandle) {
            console.log('animHandle missing — gpsTrack length=', gpsTrack && gpsTrack.length, 'mapObj=', !!mapObj);
            if (!gpsTrack || gpsTrack.length < 2) { status.innerText = 'No GPS track available'; return; }
            // create map if missing
            if (!mapObj) {
              try {
                await window.googleMapsReady;
                mapObj = createGoogleMap('map', { center: [gpsTrack[0].lat, gpsTrack[0].lon], zoom: 15 });
                showTrackOnMap(mapObj, gpsTrack);
                console.log('mapObj created in play handler');
              } catch (e) {
                console.error('failed to create map in play', e);
                // fallback: create a stub mapObj with no-op marker so animator can run without a map
                mapObj = { marker: { setPosition: function () {} }, map: null };
                console.log('mapObj fallback created (no-op marker)');
              }
            }
            if (mapObj && gpsTrack && gpsTrack.length > 1) {
              animHandle = animateOnMap(mapObj, gpsTrack, { speed: 1, onTick: function(s){
                const slider = document.getElementById('timeSlider');
                const label = document.getElementById('timeLabel');
                if (slider) slider.value = isFinite(((s.t - s.start)/(s.end - s.start))*100) ? Math.max(0, Math.min(100, ((s.t - s.start)/(s.end - s.start))*100)) : 0;
                if (label) label.innerText = formatTime(s.t);
                try { status.innerText = 'Playing: ' + formatTime(s.t); } catch(e){}
              } });
              console.log('animHandle created in play handler=', !!animHandle);
            }
          }
          if (!animHandle) { status.innerText = 'No animator available'; return; }
          // ensure marker shows current position immediately
          try { animHandle.seekTo(gpsTrack[0].tMs); } catch(e){}
          if (typeof animHandle.play === 'function') animHandle.play();
          playBtn.disabled = true;
          pauseBtn.disabled = false;
        } catch (e) { console.error('play handler error', e); status.innerText = 'Play failed'; }
      });

      pauseBtn.addEventListener('click', function () {
        try {
          console.log('pause clicked');
          if (!animHandle) { status.innerText = 'No animator'; return; }
          if (typeof animHandle.pause === 'function') animHandle.pause();
          playBtn.disabled = false;
          pauseBtn.disabled = true;
          status.innerText = 'Paused';
        } catch (e) { console.error('pause handler error', e); status.innerText = 'Pause failed'; }
      });

      // rewind / forward / stop controls
      const rewindBtn = document.getElementById('rewindBtn');
      const ffBtn = document.getElementById('ffBtn');
      const stopBtn = document.getElementById('stopBtn');
      const timeSlider = document.getElementById('timeSlider');

      if (rewindBtn) rewindBtn.addEventListener('click', function () { if (animHandle) animHandle.seekBy(-5000); });
      if (ffBtn) ffBtn.addEventListener('click', function () { if (animHandle) animHandle.seekBy(5000); });
      if (stopBtn) stopBtn.addEventListener('click', function () { if (animHandle) animHandle.stop(); });
      if (timeSlider) timeSlider.addEventListener('input', function (e) {
        if (!animHandle || !gpsTrack || gpsTrack.length < 2) return;
        const pct = Number(e.target.value) / 100;
        const start = gpsTrack[0].tMs;
        const end = gpsTrack[gpsTrack.length - 1].tMs;
        const t = start + pct * (end - start);
        animHandle.seekTo(t);
      });
      
    })();
