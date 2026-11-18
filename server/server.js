const express = require('express');
const path = require('path');

const app = express();

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'static server ready' });
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`Static server listening on http://localhost:${port}`);
});
