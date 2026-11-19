# SRT Managers

A browser-based tool for working with DJI subtitle files and flight records. Merge SRT files, inspect telemetry, animate GPS tracks on satellite maps, and export subtitles or flight videos.

**Web app:** https://srt-managers-web-334697705514.asia-southeast1.run.app/

**Source code repository:** https://github.com/Thiravit-Bulsuk/SRT-Managers

<img src="docs/repo-qr.png" alt="QR code repository" width="180">

## Features

- Parse one or more `.srt` files and merge them by concatenating, preserving timestamps, or inserting a gap.
- Adjust selected telemetry fields, time zones, and altitude values.
- Export filtered telemetry as SRT or ASS subtitles.
- Parse DJI flight-record `.txt` files and display the GPS track and flight telemetry.
- Animate drone position over a satellite map.
- Export an MP4 video with satellite imagery, the flight path, drone position, and selected telemetry text.

## DJI Flight-Record Parser

The browser uploads `.txt` flight records to this project's Rust service on Google Cloud Run:

`https://srt-managers-dji-parser-334697705514.asia-southeast1.run.app`

The worker reads the DJI log, requests a decryption keychain from DJI for version 13 or later, decodes the records, and returns normalized telemetry points to the browser. The HTTP service and telemetry conversion are in `dji-worker/`; DJI binary decoding uses the `dji-log-parser` Rust crate.

The DJI API key is stored in Google Secret Manager as `dji-app-key` and injected into Cloud Run at runtime. It is not included in the frontend or repository.

## Run Locally

### Requirements

- [Node.js](https://nodejs.org/)
- A Google Maps API key with Maps JavaScript API and Maps Static API enabled

### Setup

```bash
git clone https://github.com/Thiravit-Bulsuk/SRT-Managers.git
cd SRT-Managers
cp .env.example .env
```

Set `GOOGLE_MAPS_API_KEY` in `.env`, then generate the local browser config:

```bash
./scripts/setup-local-google-maps-key.sh --env-file .env
```

Start the local Express server:

```bash
cd server
npm install
npm start
```

Open http://localhost:3001. The browser uses the deployed Cloud Run parser for DJI `.txt` uploads.

`public/config.js` is generated locally and is ignored by Git. Do not commit it.

## Google Maps Key

The map preview uses the Maps JavaScript API. MP4 export loads satellite imagery through the Maps Static API.

For local development, the setup script generates `public/config.js` from the root `.env` file. The Cloud Run web container generates it at startup from the `google-maps-api-key` Secret Manager secret.

Restrict the browser key to the app's website referrer, including:

`https://srt-managers-web-334697705514.asia-southeast1.run.app/*`

Allow both Maps JavaScript API and Maps Static API in the key's API restrictions. Browser API keys are visible to users; protect them with API and referrer restrictions.

## Deploy the DJI Parser

The Cloud Run service is named `srt-managers-dji-parser` in project `dji-flight-parser`, region `asia-southeast1`. It runs with the `srt-managers-parser` service account, which has access to the `dji-app-key` secret.

With the Google Cloud CLI installed and authenticated to an account with deployment permissions, deploy from the repository root:

```bash
gcloud run deploy srt-managers-dji-parser \
  --source=dji-worker \
  --project=dji-flight-parser \
  --region=asia-southeast1 \
  --service-account=srt-managers-parser@dji-flight-parser.iam.gserviceaccount.com \
  --set-secrets=DJI_API_KEY=dji-app-key:latest \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --max=20 \
  --min=0 \
  --timeout=300
```

The endpoint is public so the browser can call it. CORS allows the deployed Cloud Run website origin, the previous GitHub Pages origin during migration, and local development origins. CORS is not authentication for non-browser clients.

Check service health:

```bash
curl https://srt-managers-dji-parser-334697705514.asia-southeast1.run.app/api/health
```

## Tests

Run the Rust worker tests:

```bash
cargo test --locked --manifest-path dji-worker/Cargo.toml
```

## Repository Layout

- `public/` — Browser app and frontend assets.
- `server/` — Express server for serving the app locally during development.
- `dji-worker/` — Rust HTTP parser service deployed to Cloud Run.
- `scripts/` — Local Google Maps key setup helper.
- `docs/` — Setup and implementation notes.

## Cloud Run Website Deployment

The static website is served by Nginx in Cloud Run. Deploy it from the repository root with the Google Cloud CLI:

```bash
gcloud run deploy srt-managers-web \
  --source=public \
  --project=dji-flight-parser \
  --region=asia-southeast1 \
  --service-account=srt-managers-web@dji-flight-parser.iam.gserviceaccount.com \
  --set-secrets=GOOGLE_MAPS_API_KEY=google-maps-api-key:latest \
  --allow-unauthenticated \
  --port=8080 \
  --memory=256Mi \
  --cpu=1 \
  --max=20 \
  --min=0
```

The public website URL is `https://srt-managers-web-334697705514.asia-southeast1.run.app/`.

---

# SRT Managers (ภาษาไทย)

เครื่องมือบนเว็บสำหรับจัดการไฟล์คำบรรยายและ flight record ของ DJI สามารถรวมไฟล์ SRT ตรวจดูข้อมูล telemetry แสดงแอนิเมชันเส้นทาง GPS บนแผนที่ดาวเทียม และส่งออกคำบรรยายหรือวิดีโอการบินได้

**เว็บแอป:** https://srt-managers-web-334697705514.asia-southeast1.run.app/

## ความสามารถ

- อ่านและรวมไฟล์ `.srt` ได้หลายไฟล์ โดยเลือกต่อเนื่อง คง timestamp เดิม หรือเว้นช่วงระหว่างไฟล์
- ปรับข้อมูล telemetry, เขตเวลา และค่าความสูงได้
- เลือกข้อมูลที่ต้องการแล้วส่งออกเป็นคำบรรยาย SRT หรือ ASS
- อ่านไฟล์ DJI flight record `.txt` เพื่อแสดงเส้นทาง GPS และข้อมูลการบิน
- แสดงแอนิเมชันตำแหน่งโดรนบนแผนที่ดาวเทียม
- ส่งออกวิดีโอ MP4 พร้อมภาพดาวเทียม เส้นทาง ตำแหน่งโดรน และข้อความ telemetry ที่เลือก

## Parser สำหรับ DJI Flight Record

เบราว์เซอร์อัปโหลดไฟล์ flight record `.txt` ไปยังบริการ Rust ของโปรเจกต์นี้บน Google Cloud Run:

`https://srt-managers-dji-parser-334697705514.asia-southeast1.run.app`

Worker อ่านไฟล์ DJI และสำหรับ log version 13 ขึ้นไป จะขอ keychain สำหรับถอดรหัสจาก DJI จากนั้นจึงถอดรหัส records และส่งข้อมูล telemetry ที่จัดรูปแบบแล้วกลับไปยังเบราว์เซอร์ ตัว HTTP service และการแปลง telemetry อยู่ใน `dji-worker/`; การถอดรหัส binary ของ DJI ใช้ Rust crate `dji-log-parser`

เก็บ DJI API key ไว้ใน Google Secret Manager ชื่อ `dji-app-key` และส่งให้ Cloud Run ตอนรัน ไม่ได้ฝังไว้ใน frontend หรือใน repository

## รันในเครื่อง

### สิ่งที่ต้องมี

- [Node.js](https://nodejs.org/)
- Google Maps API key ที่เปิดใช้ Maps JavaScript API และ Maps Static API

### ตั้งค่า

```bash
git clone https://github.com/Thiravit-Bulsuk/SRT-Managers.git
cd SRT-Managers
cp .env.example .env
```

ใส่ค่า `GOOGLE_MAPS_API_KEY` ใน `.env` แล้วสร้าง config สำหรับเบราว์เซอร์:

```bash
./scripts/setup-local-google-maps-key.sh --env-file .env
```

เริ่ม Express server ในเครื่อง:

```bash
cd server
npm install
npm start
```

เปิด http://localhost:3001 เบราว์เซอร์จะใช้ parser บน Cloud Run ที่ deploy ไว้สำหรับอัปโหลด DJI `.txt`

ไฟล์ `public/config.js` จะถูกสร้างในเครื่องและถูก Git ignore ห้าม commit ไฟล์นี้

## Google Maps API Key

แผนที่ตัวอย่างใช้ Maps JavaScript API ส่วนการส่งออก MP4 โหลดภาพดาวเทียมผ่าน Maps Static API

สำหรับการพัฒนาในเครื่อง สคริปต์ setup จะสร้าง `public/config.js` จากไฟล์ `.env` ที่ root ส่วน container บน Cloud Run จะสร้างไฟล์นี้ตอนเริ่มทำงานจาก Secret Manager secret ชื่อ `google-maps-api-key`

จำกัด website referrer ของ browser key ให้ตรงกับเว็บแอป รวมถึง:

`https://srt-managers-web-334697705514.asia-southeast1.run.app/*`

ใน API restrictions ให้อนุญาตทั้ง Maps JavaScript API และ Maps Static API เนื่องจาก browser API key มองเห็นได้จากผู้ใช้ จึงควรจำกัด API และ referrer ให้เหมาะสม

## Deploy DJI Parser

Cloud Run service ชื่อ `srt-managers-dji-parser` อยู่ในโปรเจกต์ `dji-flight-parser` และ region `asia-southeast1` ใช้ service account `srt-managers-parser` ซึ่งได้รับสิทธิ์เข้าถึง secret `dji-app-key`

ติดตั้งและลงชื่อเข้าใช้ Google Cloud CLI ด้วยบัญชีที่มีสิทธิ์ deploy จากนั้นรันคำสั่งต่อไปนี้จาก root ของ repository:

```bash
gcloud run deploy srt-managers-dji-parser \
  --source=dji-worker \
  --project=dji-flight-parser \
  --region=asia-southeast1 \
  --service-account=srt-managers-parser@dji-flight-parser.iam.gserviceaccount.com \
  --set-secrets=DJI_API_KEY=dji-app-key:latest \
  --allow-unauthenticated \
  --memory=1Gi \
  --cpu=1 \
  --max=20 \
  --min=0 \
  --timeout=300
```

เปิด endpoint ให้เรียกได้จากเว็บเพื่อให้เบราว์เซอร์ใช้งาน CORS จำกัด origin ของเว็บไซต์ Cloud Run, GitHub Pages เดิมระหว่างย้ายระบบ และ origin สำหรับพัฒนาในเครื่อง แต่ CORS ไม่ใช่ระบบยืนยันตัวตนสำหรับ client ที่ไม่ใช่เบราว์เซอร์

ตรวจสถานะ service:

```bash
curl https://srt-managers-dji-parser-334697705514.asia-southeast1.run.app/api/health
```

## ทดสอบ

รัน tests ของ Rust worker:

```bash
cargo test --locked --manifest-path dji-worker/Cargo.toml
```

## โครงสร้าง Repository

- `public/` — เว็บแอปและ frontend assets
- `server/` — Express server สำหรับเปิดเว็บในเครื่องตอนพัฒนา
- `dji-worker/` — Rust HTTP parser service ที่ deploy บน Cloud Run
- `scripts/` — สคริปต์ตั้งค่า Google Maps key ในเครื่อง
- `docs/` — เอกสาร setup และรายละเอียดการพัฒนา

## Deploy เว็บไซต์บน Cloud Run

เว็บไซต์ static ให้บริการด้วย Nginx บน Cloud Run deploy จาก root ของ repository ด้วย Google Cloud CLI:

```bash
gcloud run deploy srt-managers-web \
  --source=public \
  --project=dji-flight-parser \
  --region=asia-southeast1 \
  --service-account=srt-managers-web@dji-flight-parser.iam.gserviceaccount.com \
  --set-secrets=GOOGLE_MAPS_API_KEY=google-maps-api-key:latest \
  --allow-unauthenticated \
  --port=8080 \
  --memory=256Mi \
  --cpu=1 \
  --max=20 \
  --min=0
```

URL เว็บไซต์สาธารณะคือ `https://srt-managers-web-334697705514.asia-southeast1.run.app/`
