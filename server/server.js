const express = require('express');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const { runDjiParser } = require('./services/djiParser');

dotenv.config();

const app = express();
const upload = multer({
  dest: path.join(__dirname, 'tmp/uploads'),
  limits: { fileSize: 200 * 1024 * 1024 },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use((req, res, next) => {
  const allowedOrigin = process.env.FRONTEND_ORIGIN || '*';
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'backend ready' });
});

app.post('/api/flight-record/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }

    const appKey = process.env.DJI_APP_KEY;
    if (!appKey || appKey === 'your_app_key_here') {
      return res.status(500).json({
        ok: false,
        error: 'DJI_APP_KEY missing or not set in .env',
      });
    }

    const result = await runDjiParser(req.file.path, appKey);

    res.json({
      ok: true,
      points: result.points || [],
      meta: result.meta || {},
    });
  } catch (err) {
    console.error('Parse error:', err);
    res.status(500).json({
      ok: false,
      error: err.message || 'Failed to parse flight record',
    });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
