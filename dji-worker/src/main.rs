use axum::{extract::{DefaultBodyLimit, Multipart}, http::StatusCode, response::Json, routing::{get, post}, Router};
use dji_log_parser::DJILog;
use dji_log_parser::keychain::KeychainFeaturePoint;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{env, fs, time::{SystemTime, UNIX_EPOCH}};
use tower_http::cors::CorsLayer;

async fn health() -> Json<Value> {
    Json(json!({"ok": true, "status": "rust parser ready"}))
}

async fn parse(mut multipart: Multipart) -> Result<Json<Value>, (StatusCode, String)> {
    let mut bytes = None;
    while let Some(field) = multipart.next_field().await.map_err(internal)? {
        if field.name() == Some("file") {
            bytes = Some(field.bytes().await.map_err(internal)?);
            break;
        }
    }
    let bytes = bytes.ok_or((StatusCode::BAD_REQUEST, "No file uploaded".to_string()))?;
    let key = env::var("DJI_API_KEY")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "DJI_API_KEY missing".to_string()))?
        .trim()
        .to_string();
    let path = format!("/tmp/dji-upload-{}-{}.txt", std::process::id(), SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos());
    fs::write(&path, &bytes).map_err(internal)?;

    let parser = DJILog::from_bytes(bytes.to_vec()).map_err(internal)?;
    let keychains = if parser.version >= 13 {
        Some(fetch_keychains(&parser, &key).await.map_err(internal)?)
    } else {
        None
    };
    let result = tokio::task::spawn_blocking(move || parse_parser(parser, keychains))
        .await
        .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    let _ = fs::remove_file(path);
    result.map(Json)
}

#[derive(Debug, Deserialize)]
struct KeychainResponse {
    data: Option<Vec<Vec<KeychainFeaturePoint>>>,
    result: KeychainResult,
}

#[derive(Debug, Deserialize)]
struct KeychainResult {
    code: u8,
    msg: String,
}

async fn fetch_keychains(parser: &DJILog, api_key: &str) -> Result<Vec<Vec<KeychainFeaturePoint>>, String> {
    let request = parser.keychains_request().map_err(|error| error.to_string())?;
    let body = serde_json::to_value(&request).map_err(|error| error.to_string())?;
    let response = reqwest::Client::new()
        .post("https://dev.dji.com/openapi/v1/flight-records/keychains")
        .header("Content-Type", "application/json")
        .header("Api-Key", api_key)
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("request: {error:?}"))?;
    let status = response.status();
    let payload: KeychainResponse = response.json().await.map_err(|error| error.to_string())?;
    if !status.is_success() || payload.result.code != 0 {
        return Err(format!("DJI keychain API {}: {}", status, payload.result.msg));
    }
    payload.data.ok_or_else(|| "DJI keychain API returned no data".to_string())
}

// Great-circle distance between two GPS points, in meters (haversine formula).
fn haversine_distance_m(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const EARTH_RADIUS_M: f64 = 6_371_000.0;
    let (lat1_r, lat2_r) = (lat1.to_radians(), lat2.to_radians());
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let a = (d_lat / 2.0).sin().powi(2) + lat1_r.cos() * lat2_r.cos() * (d_lon / 2.0).sin().powi(2);
    2.0 * EARTH_RADIUS_M * a.sqrt().asin()
}

fn parse_parser(parser: DJILog, keychains: Option<Vec<Vec<KeychainFeaturePoint>>>) -> Result<Value, (StatusCode, String)> {
    let frames = parser.frames(keychains).map_err(internal)?;
    let home = &parser.details;
    let mut prev_latlon: Option<(f64, f64)> = None;
    let mut cumulative_distance_m: f64 = 0.0;
    let mut points = Vec::new();

    for (index, frame) in frames.iter().enumerate() {
        if !frame.osd.is_gpd_used || !frame.osd.latitude.is_finite() || !frame.osd.longitude.is_finite() { continue; }

        // Calculate common attributes
        let speed = (frame.osd.x_speed.powi(2) + frame.osd.y_speed.powi(2)).sqrt();
        let t_ms = (frame.osd.fly_time * 1000.0) as i64;

        if let Some((prev_lat, prev_lon)) = prev_latlon {
            cumulative_distance_m += haversine_distance_m(prev_lat, prev_lon, frame.osd.latitude, frame.osd.longitude);
        }
        prev_latlon = Some((frame.osd.latitude, frame.osd.longitude));

        let distance_from_home_m = haversine_distance_m(home.latitude, home.longitude, frame.osd.latitude, frame.osd.longitude);

        points.push(json!({
            "tMs": t_ms, 
            "lat": frame.osd.latitude, 
            "lon": frame.osd.longitude, 
            "alt": frame.osd.altitude, // altitude above sea level (m)
            "height": frame.osd.height, // height above takeoff/ground level (m)
            "datetime": frame.custom.date_time,
            "speed": speed, 
            "heading": frame.osd.yaw,
            "pitch": frame.osd.pitch,
            "roll": frame.osd.roll,
            "battery": frame.battery.charge_level,
            "distance": distance_from_home_m, // distance from home point (m)
            "flight_distance": cumulative_distance_m / 1000.0, // cumulative flight distance / kilometrage (km)
            "gpsnum": frame.osd.gps_num,
            "signal": frame.rc.downlink_signal,
            "x_speed": frame.osd.x_speed,
            "y_speed": frame.osd.y_speed,
            "z_speed": frame.osd.z_speed,
            "flight_time": frame.osd.fly_time,
            "flight_mode": frame.osd.flyc_state,
            "index": index
        }));
    }
    Ok(json!({"ok": true, "version": parser.version, "frameCount": frames.len(), "pointCount": points.len(), "points": points}))
}

fn internal(error: impl std::fmt::Display) -> (StatusCode, String) {
    (StatusCode::INTERNAL_SERVER_ERROR, error.to_string())
}

#[tokio::main]
async fn main() {
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/flight-record/parse", post(parse))
        .layer(DefaultBodyLimit::max(200 * 1024 * 1024))
        .layer(CorsLayer::permissive());
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
