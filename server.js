const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Joi = require('joi');
const multer = require('multer');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'journalEntries.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const embeddedJournal = {
  entries: [
    { _id: "1", title: "Morning Reflections", date: "2025-09-25", img_name: "json/images/morning-reflection.png", mood: "Peaceful", summary: "Started my day with a walk and meditation. Felt calm and focused." },
    { _id: "2", title: "Busy Study Day", date: "2025-09-26", img_name: "json/images/midterm-exam.png", mood: "Productive", summary: "Had three classes and a project meeting. Stayed organized and motivated." },
    { _id: "3", title: "Weekend fun", date: "2025-09-27", img_name: "json/images/weekend-fun.png", mood: "Relaxed", summary: "Spent time with family in Georgia." },
    { _id: "4", title: "Gym time", date: "2025-09-28", img_name: "json/images/gym-time.png", mood: "Energized", summary: "Tried to work out with a friend after a long time." },
    { _id: "5", title: "Family time", date: "2025-09-29", img_name: "json/images/family-time.png", mood: "Happy", summary: "Had dinner with family after a while." },
    { _id: "6", title: "Rainy weather", date: "2025-09-30", img_name: "json/images/rainy-weather.png", mood: "Calm", summary: "Rainy day. Spent the evening with someone I like." },
    { _id: "7", title: "Midterm Stress", date: "2025-10-01", img_name: "json/images/midterm-exam.png", mood: "Stressed", summary: "Studying for midterms, I hated the math class." },
    { _id: "8", title: "Self-Care Sunday", date: "2025-10-02", img_name: "json/images/self-care.png", mood: "Refreshed", summary: "Did a face mask, listened to music, and journaled about my goals." }
  ]
};

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ entries: embeddedJournal.entries }, null, 2), 'utf8');
}

function readEntries() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch (err) {
    return embeddedJournal.entries.slice();
  }
}

function writeEntries(entries) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ entries }, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write entries file:', err);
    throw err;
  }
}

app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage });

const entrySchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  date: Joi.date().iso().required(),
  summary: Joi.string().min(1).max(5000).required(),
  mood: Joi.string().allow('').max(200),
  img_name: Joi.string().allow('').max(1000)
});

app.get('/', (req, res) => {
  res.send(`
    <h1>Journal Server</h1>
    <ul><li><a href="/api/journalEntries">/api/journalEntries</a></li></ul>
  `);
});

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

app.get('/api/journalEntries', (req, res) => {
  const entries = readEntries();
  res.json(entries);
});

app.get('/api/journalEntries/:id', (req, res) => {
  const entries = readEntries();
  const entry = entries.find(e => String(e._id) === String(req.params.id));
  if (!entry) return res.status(404).json({ message: 'Not found' });
  res.json(entry);
});

app.post('/api/journalEntries', upload.single('img'), (req, res) => {
  try {
    const payload = {
      title: req.body.title,
      date: req.body.date,
      summary: req.body.summary,
      mood: req.body.mood || '',
      img_name: req.file ? path.join('uploads', req.file.filename).replace(/\\/g, '/') : (req.body.img_name || '')
    };
    const { error, value } = entrySchema.validate(payload, { convert: true, stripUnknown: true });
    if (error) {
      if (req.file) {
        try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)); } catch (_) { /* ignore */ }
      }
      // Return Joi-style details so frontend can map field errors
      return res.status(400).json({
        message: 'Validation failed',
        details: error.details.map(d => ({
          message: d.message,
          path: d.path || [],
          context: d.context || {}
        }))
      });
    }
    const entries = readEntries();
    const newEntry = { ...value, _id: `${Date.now()}` };
    entries.push(newEntry);
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    writeEntries(entries);
    return res.status(201).json(newEntry);
  } catch (err) {
    console.error('POST /api/journalEntries error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.put('/api/journalEntries/:id', upload.single('img'), (req, res) => {
  try {
    const entries = readEntries();
    const idx = entries.findIndex(e => String(e._id) === String(req.params.id));
    if (idx === -1) {
      if (req.file) {
        try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)); } catch (_) { /* ignore */ }
      }
      return res.status(404).json({ message: 'Not found' });
    }
    const existing = entries[idx];

    const payload = {
      title: (req.body.title !== undefined) ? req.body.title : existing.title,
      date: (req.body.date !== undefined) ? req.body.date : existing.date,
      summary: (req.body.summary !== undefined) ? req.body.summary : existing.summary,
      mood: (req.body.mood !== undefined) ? req.body.mood : (existing.mood || ''),
      img_name: req.file
        ? path.join('uploads', req.file.filename).replace(/\\/g, '/')
        : (req.body.img_name !== undefined ? req.body.img_name : (existing.img_name || ''))
    };

    const { error, value } = entrySchema.validate(payload, { convert: true, stripUnknown: true });
    if (error) {
      if (req.file) {
        try { fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename)); } catch (_) { /* ignore */ }
      }
      // Return Joi-style details so frontend can map field errors
      return res.status(400).json({
        message: 'Validation failed',
        details: error.details.map(d => ({
          message: d.message,
          path: d.path || [],
          context: d.context || {}
        }))
      });
    }

    if (req.file && existing.img_name && typeof existing.img_name === 'string' && existing.img_name.startsWith('uploads/')) {
      const oldPath = path.join(__dirname, existing.img_name);
      try {
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      } catch (err) {
        console.warn('Failed to remove old uploaded file', oldPath, err);
      }
    }

    const updated = { ...existing, ...value, _id: existing._id };
    entries[idx] = updated;
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    writeEntries(entries);
    return res.json(updated);
  } catch (err) {
    console.error('PUT /api/journalEntries/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

app.delete('/api/journalEntries/:id', (req, res) => {
  try {
    const entries = readEntries();
    const idx = entries.findIndex(e => String(e._id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ message: 'Not found' });
    const [removed] = entries.splice(idx, 1);

    if (removed.img_name && typeof removed.img_name === 'string' && removed.img_name.startsWith('uploads/')) {
      const filePath = path.join(__dirname, removed.img_name);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (err) {
        console.warn('Failed to remove uploaded file during delete:', filePath, err);
      }
    }

    writeEntries(entries);
    return res.json({ message: 'Deleted', deletedId: removed._id });
  } catch (err) {
    console.error('DELETE /api/journalEntries/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
