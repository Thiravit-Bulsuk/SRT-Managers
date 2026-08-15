# Docker-Based DJI Parser Setup Guide

**Status:** Ready to build with Docker ✅

## Prerequisites

- macOS (Intel or Apple Silicon)
- Docker Desktop installed
- ~2GB free disk space

## Installation Path

### Step 1: Install Docker Desktop

**Download:** https://www.docker.com/products/docker-desktop/

Choose the correct version for your Mac:
- **Apple Silicon** (M1/M2/M3): ARM64 version
- **Intel Mac**: Intel/x86_64 version

**After Installation:**
1. Open Applications → Docker.app
2. Wait for Docker to fully start (icon appears in top menu bar)
3. Verify: `docker --version`

---

### Step 2: Build the Docker Image

Once Docker is running, execute:

```bash
bash "/Users/koy/Documents/SRT Managers/build-docker-parser.sh"
```

This script will:
✅ Verify Docker is installed and running
✅ Build the DJI parser Docker image
✅ Inject your App Key into the image
✅ Test the build

**Expected output:**
```
✅ Docker image built successfully
✅ Build complete!
```

Build time: ~2-5 minutes (first time), ~30 seconds (cached)

---

### Step 3: Update Backend Configuration

Execute:

```bash
bash "/Users/koy/Documents/SRT Managers/update-backend-docker.sh"
```

This will:
✅ Update `server/.env` to use Docker wrapper
✅ Configure the parser command properly
✅ Show next steps

---

### Step 4: Restart Backend

```bash
cd "/Users/koy/Documents/SRT Managers/server"
pkill -f "node server.js" || true
node server.js
```

Expected output:
```
Backend listening on http://localhost:3001
```

---

### Step 5: Test the Parser

```bash
curl -X POST \
  -F "file=@/Users/koy/Documents/SRT Managers/DJIFlightRecord_2026-08-14_[06-10-03] 2.txt" \
  http://localhost:3001/api/flight-record/parse | jq .
```

Expected response:
```json
{
  "ok": true,
  "points": [
    {
      "tMs": 0,
      "lat": ...,
      "lon": ...,
      "alt": ...,
      "speed": ...,
      "heading": ...
    }
  ]
}
```

---

## Architecture

### Flow with Docker

```
1. Browser uploads DJI file to http://localhost:3001/api/flight-record/parse
                                    ↓
2. Node.js backend receives file, saves to temp directory
                                    ↓
3. Backend invokes: bash dji-parser-docker.sh --in {file} --key {key} --json
                                    ↓
4. Docker wrapper script prepares volume mount
                                    ↓
5. Docker runs: docker run --rm -v {dir}:/data dji-parser /data/{file} --sdk_key {key} --json
                                    ↓
6. Docker container runs real DJI FRSample parser
                                    ↓
7. Parser decrypts & parses binary flight record
                                    ↓
8. Returns JSON: {"ok": true, "points": [...]}
                                    ↓
9. Backend sends to frontend
                                    ↓
10. Frontend renders track on Leaflet map
```

### Files Created

| File | Purpose |
|------|---------|
| `build-docker-parser.sh` | Build the Docker image |
| `dji-parser-docker.sh` | Wrapper script (called by backend) |
| `update-backend-docker.sh` | Update backend .env configuration |
| `DOCKER_INSTALL.md` | Installation troubleshooting |

---

## Troubleshooting

### "Docker daemon is not running"
- Start Docker Desktop: Applications → Docker.app
- Wait 30 seconds for startup
- Try again

### "Docker image not found"
```bash
# Build the image
bash "/Users/koy/Documents/SRT Managers/build-docker-parser.sh"
```

### "Failed to start service backend"
```bash
# Check .env is correct
cat "/Users/koy/Documents/SRT Managers/server/.env"

# Check Docker wrapper is executable
ls -la "/Users/koy/Documents/SRT Managers/dji-parser-docker.sh"

# Restart backend
pkill -f "node server.js" || true
cd "/Users/koy/Documents/SRT Managers/server"
node server.js
```

### "Cannot connect to Docker socket"
```bash
# Restart Docker
pkill -9 Docker || true
open -a Docker

# Wait 30 seconds, then test
docker --version
```

### Docker build fails
```bash
# Clean up old images
docker system prune -a

# Rebuild
bash "/Users/koy/Documents/SRT Managers/build-docker-parser.sh"
```

---

## Quick Start Commands

```bash
# One-liner to set up everything (after Docker is installed)
bash "/Users/koy/Documents/SRT Managers/build-docker-parser.sh" && \
bash "/Users/koy/Documents/SRT Managers/update-backend-docker.sh" && \
pkill -f "node server.js" || true && \
cd "/Users/koy/Documents/SRT Managers/server" && \
node server.js
```

---

## Advantages of Docker Approach

✅ No need to install CMake or build tools
✅ Consistent environment (works exactly as DJI intended)
✅ Isolated from system dependencies
✅ Easy to upgrade or downgrade
✅ Works on all macOS versions
✅ Real, production-grade DJI parser

---

## Next Steps After Setup

1. **Test with sample file** (see Step 5 above)
2. **Open web UI:** [index.html](../index.html) in browser
3. **Upload real DJI flight record file** and see track on map
4. **Done!** 🎉

---

**Questions?** Check DOCKER_INSTALL.md or BUILD_DJI_PARSER.md for more details.
