#!/usr/bin/env python3
"""
Mock DJI Flight Record Parser Wrapper
This simulates the DJI FRSample parser output for testing.
Replace this with the real binary path once built.

Usage:
  python3 dji-parser-mock.py --in <file_path> --key <app_key> --json
"""

import sys
import json
import argparse
from pathlib import Path

def parse_dji_flight_record(file_path, app_key):
    """
    Mock parser that extracts basic telemetry from DJI flight record file.
    Returns JSON-formatted track data.
    """
    file_path = Path(file_path)
    
    if not file_path.exists():
        print(json.dumps({
            "error": f"File not found: {file_path}",
            "ok": False
        }))
        sys.exit(1)
    
    # For now, return mock data
    # In real implementation, this would parse the binary DJI format
    mock_data = {
        "ok": True,
        "points": [
            {
                "tMs": 0,
                "lat": 13.7563,
                "lon": 100.5018,
                "alt": 12.5,
                "speed": 8.1,
                "heading": 45
            },
            {
                "tMs": 1000,
                "lat": 13.7564,
                "lon": 100.502,
                "alt": 13.0,
                "speed": 8.5,
                "heading": 50
            },
            {
                "tMs": 2000,
                "lat": 13.7565,
                "lon": 100.5022,
                "alt": 13.5,
                "speed": 9.0,
                "heading": 55
            }
        ],
        "meta": {
            "file": str(file_path),
            "source": "mock-parser",
            "note": "Replace with real DJI parser binary once built. See BUILD_DJI_PARSER.md"
        }
    }
    
    print(json.dumps(mock_data))
    return 0

def main():
    parser = argparse.ArgumentParser(
        description='Mock DJI Flight Record Parser'
    )
    parser.add_argument('--in', dest='input_file', required=True,
                        help='Input flight record file path')
    parser.add_argument('--key', dest='app_key', required=True,
                        help='DJI App Key')
    parser.add_argument('--json', dest='json_output', action='store_true',
                        help='Output in JSON format')
    
    args = parser.parse_args()
    
    return parse_dji_flight_record(args.input_file, args.app_key)

if __name__ == '__main__':
    sys.exit(main())
