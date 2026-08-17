# Building DJI FRSample Parser

This document explains how to build the DJI FRSample parser binary on macOS.

## Prerequisites

You need CMake installed. Install it using one of these methods:

### Option 1: Using Homebrew (Recommended)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install cmake
```

### Option 2: Using MacPorts
```bash
sudo port install cmake
```

### Option 3: Direct CMake Installation
Download and install from: https://cmake.org/download/

### Option 4: Using Xcode (Alternative - No CMake needed)
1. Navigate to `dji-flightrecord-kit/build/Mac/FRSample`
2. Run: `sh generate.sh`
3. Select option `1` to create Xcode project
4. Open `FRSample.xcodeproj` in Xcode
5. Edit `source/FRSample/main.cc` to configure file path and SDK key
6. Build in Xcode
7. Find the binary at: `dji-flightrecord-kit/build/Mac/FRSample/cmake_build_release/FRSample`

## Building with CMake (Once Installed)

```bash
cd "/Users/koy/Documents/SRT Managers/FlightRecordParsingLib/dji-flightrecord-kit/build/Mac/FRSample"
bash generate.sh
# Select: 0
# This will create a Makefile and build the executable
```

The compiled binary will be at:
```
dji-flightrecord-kit/build/Mac/FRSample/FRSample
```

## Update Server Configuration

Once the binary is built, update [server/.env]:

```env
DJI_PARSER_COMMAND=/Users/koy/Documents/SRT Managers/FlightRecordParsingLib/dji-flightrecord-kit/build/Mac/FRSample/FRSample
DJI_PARSER_ARGS=--in {input} --key {key} --json
```

## Verify Build

Test the binary:
```bash
"/Users/koy/Documents/SRT Managers/FlightRecordParsingLib/dji-flightrecord-kit/build/Mac/FRSample/FRSample" --help
```

Then restart the backend:
```bash
cd "/Users/koy/Documents/SRT Managers/server"
node server.js
```

Upload a DJI flight record file to `http://localhost:3001/api/flight-record/parse` to test the real parsing.
