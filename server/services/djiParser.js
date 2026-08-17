const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function normalizePoint(raw) {
  const lat = Number(raw.lat ?? raw.latitude ?? raw.gps_lat ?? raw.y);
  const lon = Number(raw.lon ?? raw.longitude ?? raw.gps_lon ?? raw.lng ?? raw.x);
  const tMs = Number(raw.tMs ?? raw.timeMs ?? raw.timestamp ?? raw.ms ?? raw.time ?? 0);
  const alt = Number(raw.alt ?? raw.altitude ?? raw.height ?? raw.rel_alt ?? raw.relative_altitude ?? 0);
  const speed = Number(raw.speed ?? raw.velocity ?? raw.ground_speed ?? 0);
  const heading = Number(raw.heading ?? raw.yaw ?? raw.course ?? raw.bearing ?? 0);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const merged = {
    ...raw,
    tMs: Number.isFinite(tMs) ? tMs : 0,
    lat,
    lon,
    alt: Number.isFinite(alt) ? alt : 0,
    speed: Number.isFinite(speed) ? speed : 0,
    heading: Number.isFinite(heading) ? heading : 0,
  };

  return Object.fromEntries(
    Object.entries(merged).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function extractPointsFromPayload(payload) {
  if (!payload) return [];

  const frames = payload.info?.frameTimeStates || payload.info?.frame_time_states;
  if (Array.isArray(frames)) {
    return frames.map((frame, index) => {
      let state = frame.flightControllerState || frame.flight_controller_state || {};
      let location = state.aircraftLocation || state.aircraft_location || {};
      let velocity = state.velocity || {};
      let attitude = state.attitude || {};

      if (location.latitude === undefined || location.longitude === undefined) {
        const findLocation = (value) => {
          if (!value || typeof value !== 'object') return null;
          const candidate = value.aircraftLocation || value.aircraft_location || value;
          if ((candidate.latitude !== undefined && candidate.longitude !== undefined) ||
              (candidate.lat !== undefined && candidate.lon !== undefined)) {
            return { holder: value, location: candidate };
          }
          for (const child of Object.values(value)) {
            const found = findLocation(child);
            if (found) return found;
          }
          return null;
        };
        const holder = findLocation(frame);
        if (holder) {
          state = holder.holder;
          location = holder.location;
          velocity = state.velocity || {};
          attitude = state.attitude || {};
        }
      }
      const speed = Math.sqrt(
        Number(velocity.velocityX ?? velocity.velocity_x ?? 0) ** 2 +
        Number(velocity.velocityY ?? velocity.velocity_y ?? 0) ** 2
      );

      const raw = {
        ...frame,
        ...state,
        ...location,
        ...velocity,
        ...attitude,
        tMs: index * 100,
        lat: location.latitude ?? location.lat,
        lon: location.longitude ?? location.lon,
        alt: state.altitude ?? state.altitude_m,
        speed,
        heading: attitude.yaw ?? attitude.heading,
        index,
      };

      return normalizePoint(raw);
    }).filter(Boolean);
  }

  if (Array.isArray(payload)) {
    return payload.map(normalizePoint).filter(Boolean);
  }

  const possibleKeys = ['points', 'track', 'trajectory', 'data', 'items', 'records'];
  for (const key of possibleKeys) {
    if (Array.isArray(payload[key])) {
      return payload[key].map(normalizePoint).filter(Boolean);
    }
  }

  if (Array.isArray(payload.result)) {
    return payload.result.map(normalizePoint).filter(Boolean);
  }

  if (payload.lat !== undefined || payload.lon !== undefined) {
    const point = normalizePoint(payload);
    return point ? [point] : [];
  }

  return [];
}

function parseStructuredOutput(stdoutText) {
  const text = String(stdoutText || '').trim();
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    const points = extractPointsFromPayload(parsed);
    if (points.length > 0) return { points, raw: parsed };
  } catch (err) {
    // ignore JSON parse errors and continue with heuristics below
  }

  const firstJsonStart = text.indexOf('{');
  const firstJsonEnd = text.lastIndexOf('}');
  if (firstJsonStart >= 0 && firstJsonEnd > firstJsonStart) {
    try {
      const snippet = text.slice(firstJsonStart, firstJsonEnd + 1);
      const parsed = JSON.parse(snippet);
      const points = extractPointsFromPayload(parsed);
      if (points.length > 0) return { points, raw: parsed };
    } catch (err) {
      // ignore
    }
  }

  const points = [];
  const coordinatePattern = /"(?:aircraftLocation|aircraft_location)"\s*:\s*\{[^{}]*?"latitude"\s*:\s*(-?\d+(?:\.\d+)?)[^{}]*?"longitude"\s*:\s*(-?\d+(?:\.\d+)?)/g;
  let coordinateMatch;
  while ((coordinateMatch = coordinatePattern.exec(text)) !== null) {
    points.push({
      tMs: points.length * 100,
      lat: Number(coordinateMatch[1]),
      lon: Number(coordinateMatch[2]),
      alt: 0,
      speed: 0,
      heading: 0,
    });
  }
  if (points.length > 0) return { points };

  const genericCoordinatePattern = /"latitude"\s*:\s*(-?\d+(?:\.\d+)?)[\s\S]{0,300}?"longitude"\s*:\s*(-?\d+(?:\.\d+)?)/g;
  while ((coordinateMatch = genericCoordinatePattern.exec(text)) !== null) {
    points.push({
      tMs: points.length * 100,
      lat: Number(coordinateMatch[1]),
      lon: Number(coordinateMatch[2]),
      alt: 0,
      speed: 0,
      heading: 0,
    });
  }
  if (points.length > 0) return { points };

  const latLonPattern = /lat(?:itude)?\s*[:=]\s*(-?\d+(?:\.\d+)?)[^\n\r]*\n?[^\n\r]*lon(?:gitude)?\s*[:=]\s*(-?\d+(?:\.\d+)?)/gi;
  let match;
  while ((match = latLonPattern.exec(text)) !== null) {
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      points.push({ tMs: 0, lat, lon, alt: 0, speed: 0, heading: 0 });
    }
  }

  return points.length > 0 ? { points } : null;
}

function resolveParserCommand() {
  const configured = process.env.DJI_PARSER_COMMAND || process.env.DJI_PARSER_BIN || process.env.DJI_BIN;
  if (configured) {
    return configured;
  }

  const candidatePaths = [
    '/Users/koy/Documents/SRT Managers/FlightRecordParsingLib/dji-flightrecord-kit/build/Mac/FRSample/FRSample',
    '/Users/koy/Documents/SRT Managers/dji-flightrecord-kit/build/Mac/FRSample/FRSample',
    '/Users/koy/Documents/SRT Managers/FRSample',
    '/opt/dji/FRSample',
    path.resolve(__dirname, '../../FRSample'),
    path.resolve(__dirname, '../../dji-flightrecord-kit/build/Mac/FRSample/FRSample'),
  ];

  for (const candidate of candidatePaths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildParserArgs(filePath, appKey) {
  const parserCommand = resolveParserCommand();
  if (!parserCommand) return null;

  const args = [];

  const commandName = path.basename(parserCommand).toLowerCase();
  if (commandName === 'docker' || commandName === 'podman') {
    return [
      '-v', `${path.dirname(filePath)}:/tmp:ro`,
      '--rm',
      'dji-flightrecord',
      '/tmp/' + path.basename(filePath),
      '--sdk_key', appKey,
    ];
  }

  const stdArgsFromEnv = process.env.DJI_PARSER_ARGS || '';
  if (stdArgsFromEnv.trim()) {
    const tokens = stdArgsFromEnv.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g) || [];
    for (const token of tokens) {
      const value = token.replace(/^(["'])|(["'])$/g, '');
      if (value === '{input}') {
        args.push(filePath);
      } else if (value === '{key}' || value === '{app_key}' || value === '{sdk_key}') {
        args.push(appKey);
      } else {
        args.push(value);
      }
    }
  } else {
    // Fallback if no args configured
    if (!args.includes('--input')) {
      args.push('--input', filePath);
    }
    if (!args.includes('--sdk_key') && !args.includes('--app_key')) {
      args.push('--sdk_key', appKey);
    }
    if (!args.includes('--json')) {
      args.push('--json');
    }
  }

  return args;
}

function runCommand(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args || [], {
      shell: false,
      env,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to launch DJI parser: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`DJI parser exited with code ${code}: ${stderr || stdout || 'unknown error'}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function runDjiParser(filePath, appKey) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const parserCommand = resolveParserCommand();
  if (!parserCommand) {
    throw new Error(
      'No DJI parser CLI found. Set DJI_PARSER_COMMAND=/path/to/FRSample or point to your built DJI FlightRecordParsingLib binary.'
    );
  }

  const args = buildParserArgs(filePath, appKey);
  if (!args) {
    throw new Error('Unable to construct DJI parser arguments. Please set DJI_PARSER_COMMAND or DJI_PARSER_ARGS.');
  }

  const { stdout, stderr } = await runCommand(parserCommand, args, {
    ...process.env,
    SDK_KEY: appKey,
  });
  const structured = parseStructuredOutput(stdout || stderr || '');
  if (!structured || !structured.points || structured.points.length === 0) {
    throw new Error(
      'DJI parser ran but did not return a valid track. Check the CLI output and the app key.\n' +
      (stderr || stdout || '').slice(0, 1000)
    );
  }

  return {
    points: structured.points,
    meta: {
      source: 'dji-parser-cli',
      parserCommand,
      filePath,
      appKeyPreview: `${appKey.slice(0, 8)}...`,
      stdoutPreview: (stdout || '').slice(0, 200),
    },
  };
}

module.exports = { runDjiParser, resolveParserCommand };
