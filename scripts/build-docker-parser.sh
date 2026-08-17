#!/bin/bash
# Build DJI Parser Docker Image and Create Wrapper

set -e

DJI_REPO="/Users/koy/Documents/SRT Managers/FlightRecordParsingLib"
DJI_APP_KEY="e60bfac6a6a9d0a146924dff"
IMAGE_NAME="dji-parser"
IMAGE_TAG="latest"

echo "🐳 DJI Parser Docker Builder"
echo "============================="
echo ""

# Step 1: Check Docker installation
echo "Step 1: Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    echo ""
    echo "Please install Docker Desktop for macOS:"
    echo "  https://www.docker.com/products/docker-desktop/"
    echo ""
    echo "See: DOCKER_INSTALL.md for detailed instructions"
    exit 1
fi

DOCKER_VERSION=$(docker --version)
echo "✅ $DOCKER_VERSION found"
echo ""

# Step 2: Check if Docker daemon is running
echo "Step 2: Checking Docker daemon..."
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker daemon is not running"
    echo "Please start Docker Desktop and try again"
    exit 1
fi
echo "✅ Docker daemon is running"
echo ""

# Step 3: Build Docker image
echo "Step 3: Building Docker image..."
echo "   Image: $IMAGE_NAME:$IMAGE_TAG"
echo "   App Key: ${DJI_APP_KEY:0:8}..."
echo ""

cd "$DJI_REPO"
docker build \
    --build-arg SDK_KEY="$DJI_APP_KEY" \
    -t "$IMAGE_NAME:$IMAGE_TAG" \
    .

echo ""
echo "✅ Docker image built successfully"
echo ""

# Step 4: Verify image
echo "Step 4: Verifying image..."
DOCKER_IMAGES=$(docker images | grep "$IMAGE_NAME" | wc -l)
if [ "$DOCKER_IMAGES" -gt 0 ]; then
    echo "✅ Image verified"
    docker images | grep "$IMAGE_NAME"
else
    echo "❌ Image not found"
    exit 1
fi

echo ""
echo "✅ Build complete!"
echo ""
echo "📝 Next steps:"
echo "1. Update server/.env with:"
echo "   DJI_PARSER_COMMAND=docker"
echo "   DJI_PARSER_ARGS=run --rm -v {input_dir}:/data dji-parser /data/{input_file} --sdk_key {key} --json"
echo ""
echo "2. Or simply run:"
echo "   bash /Users/koy/Documents/SRT\\ Managers/update-backend-docker.sh"
echo ""
echo "3. Then restart backend:"
echo "   cd '/Users/koy/Documents/SRT Managers/server'"
echo "   pkill -f 'node server.js' || true"
echo "   node server.js"
