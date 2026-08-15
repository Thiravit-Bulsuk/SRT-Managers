# Install Docker Desktop for macOS

## Quick Install

### Option 1: Download Docker Desktop (Recommended)
1. Go to: https://www.docker.com/products/docker-desktop/
2. Click "Download for Mac"
3. Choose the correct version:
   - **Apple Silicon** (M1/M2/M3): ARM64 version
   - **Intel Mac**: Intel/x86_64 version
4. Open the DMG file and drag Docker.app to Applications folder
5. Launch Docker from Applications
6. Enter your Mac password when prompted (Docker needs sudo)
7. Verify installation:
   ```bash
   docker --version
   ```

### Option 2: Using Homebrew (if you have it)
```bash
brew install docker docker-compose
colima start  # Start the container runtime
```

### Option 3: Using MacPorts
```bash
sudo port install docker
```

## After Installing Docker

Once Docker is installed and running, you can build the DJI parser:

```bash
cd "/Users/koy/Documents/SRT Managers/FlightRecordParsingLib"

# Build the Docker image with your DJI App Key
docker build --build-arg SDK_KEY=e60bfac6a6a9d0a146924dff -t dji-parser .

# Verify the build
docker images | grep dji-parser
```

## Using the Docker-based Parser

The backend will call Docker to parse files:

```bash
docker run --rm \
  -v /Users/koy/Documents/SRT\ Managers:/data \
  dji-parser \
  /data/DJIFlightRecord_2026-08-14_[06-10-03]\ 2.txt
```

## Troubleshooting

### "Cannot connect to Docker daemon"
- Make sure Docker Desktop is running (check Applications → Docker)
- If Docker was just installed, restart your Mac

### "docker: command not found"
- Close and reopen your terminal
- Run: `export PATH="$PATH:/Applications/Docker.app/Contents/Resources/bin"`

### Build errors
- Check Docker has at least 4GB of memory allocated
- Ensure you have ~2GB free disk space
- Try: `docker system prune` to clean up old images

---

**Next Steps:**
1. Install Docker Desktop (recommended method above)
2. Run: `bash /Users/koy/Documents/SRT\ Managers/build-docker-parser.sh`
3. Backend will automatically use Docker for parsing
