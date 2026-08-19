# SRT Managers

A web-based utility for managing, parsing, and merging drone flight data, with a focus on DJI SRT files and flight records.

## Description

This project provides a set of tools to handle drone telemetry data. It allows users to upload SRT subtitle files containing flight data, parse them, and merge multiple files. It also includes components for parsing proprietary DJI flight record formats using both a Rust-based service and DJI's own C++ parsing library.

The application consists of a simple frontend to interact with the services, a Node.js backend for serving the application and handling uploads, and a Rust worker for advanced parsing tasks.

## Features

- **SRT Parsing:** In-browser parsing of SRT files to extract telemetry data.
- **Merge SRT Files:** Combine multiple SRT files into a single file, with options for ordering and gap adjustment.
- **DJI Flight Record Parsing:** Backend services for parsing detailed flight logs from DJI drones.
- **Web-based UI:** Simple user interface for uploading and managing files.

## Project Structure

The project is organized into several key directories:

- **`/`**: The root directory contains Docker files for building the parser and various utility scripts.
- **`/public`**: The frontend served by the Node.js backend.
  - `index.html`: The single-page web UI (upload, merge, map/animation, export).
  - `js/`: Frontend JavaScript modules (`srt_utils.js`, `map_anim.js`, `telemetry.js`).
- **`/server`**: A Node.js/Express backend.
  - `server.js`: The main server entry point, handles file uploads and serves the frontend.
- **`/dji-worker`**: A Rust-based service for parsing DJI log files.
- **`/FlightRecordParsingLib`**: A submodule containing the official DJI C++ library for parsing flight records.

## Getting Started

To run this project, you will need to start the Node.js server and, for full functionality, the Rust `dji-worker`.

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Rust](https://www.rust-lang.org/)
- [Docker](https://www.docker.com/) (for building and running the C++ parser)

### Installation & Running

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd srt-managers
    ```

2.  **Start the Node.js server:**
    ```bash
    cd server
    npm install
    npm start
    ```
    The web interface will be available at `http://localhost:3000`.

3.  **Run the Rust `dji-worker` (optional):**
    ```bash
    cd ../dji-worker
    cargo run
    ```
    The worker will run on a separate port and handle requests for DJI log parsing.

4.  **Build the DJI C++ Parser (optional):**
    Follow the instructions in `FlightRecordParsingLib/README.md` and the associated shell scripts (`build-dji-parser.sh`, `build-docker-parser.sh`) to build the Docker container for the C++ parser.

## Usage

1.  Open your web browser and navigate to `http://localhost:3000`.
2.  Use the web interface to upload one or more `.srt` or DJI flight record files.
3.  The application will process the files and display the extracted data.
4.  For multiple SRT files, you can use the merge functionality to combine them.
