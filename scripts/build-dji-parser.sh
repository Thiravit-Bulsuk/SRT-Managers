#!/bin/bash
# DJI FRSample Build Script for macOS
# This script automates building the real DJI FRSample parser

set -e

DJI_REPO="/Users/koy/Documents/SRT Managers/FlightRecordParsingLib"
BUILD_DIR="$DJI_REPO/dji-flightrecord-kit/build/Mac/FRSample"
OUTPUT_BIN="$BUILD_DIR/FRSample"

echo "🔨 DJI FRSample Builder for macOS"
echo "=================================="
echo ""

# Step 1: Check for CMake
echo "Step 1: Checking for CMake..."
if command -v cmake &> /dev/null; then
    CMAKE_VERSION=$(cmake --version | head -1)
    echo "✅ CMake found: $CMAKE_VERSION"
else
    echo "❌ CMake not found"
    echo ""
    echo "Installing CMake..."
    echo ""
    echo "Choose an installation method:"
    echo "1) MacPorts (if installed): sudo port install cmake"
    echo "2) Direct download: https://cmake.org/download/"
    echo "3) Homebrew (if installed): brew install cmake"
    echo ""
    echo "After installing CMake, run this script again."
    exit 1
fi

echo ""
echo "Step 2: Checking dependencies..."

# Check for required libraries
echo "Checking for CURL..."
if pkg-config --exists libcurl; then
    echo "✅ CURL found"
else
    echo "⚠️  CURL not found via pkg-config (will use system default)"
fi

echo ""
echo "Step 3: Building FRSample..."
cd "$BUILD_DIR"

# Clean previous build
if [ -d "build" ]; then
    echo "Cleaning previous build..."
    rm -rf build
fi

# Run CMake build
echo "Running CMake (Release build)..."
cmake \
    -D platform=Mac \
    -DENABLE_SHARED_LIB=false \
    -DCMAKE_BUILD_TYPE=Release \
    ../../../dji-flightrecord-kit/source/FRSample

echo "Running make..."
make -j$(sysctl -n hw.ncpu)

echo ""
if [ -f "$OUTPUT_BIN" ]; then
    FILE_SIZE=$(stat -f%z "$OUTPUT_BIN" 2>/dev/null | numfmt --to=iec)
    echo "✅ Build successful!"
    echo "   Binary: $OUTPUT_BIN"
    echo "   Size: $FILE_SIZE"
    echo ""
    echo "📝 Next steps:"
    echo "1. Update server/.env with:"
    echo "   DJI_PARSER_COMMAND=$OUTPUT_BIN"
    echo "   DJI_PARSER_ARGS=--in {input} --key {key} --json"
    echo ""
    echo "2. Restart backend:"
    echo "   cd '/Users/koy/Documents/SRT Managers/server'"
    echo "   pkill -f 'node server.js' || true"
    echo "   node server.js"
    echo ""
    echo "3. Test with:"
    echo "   curl -X POST -F 'file=@DJIFlightRecord.txt' http://localhost:3001/api/flight-record/parse"
else
    echo "❌ Build failed - binary not found at $OUTPUT_BIN"
    exit 1
fi
