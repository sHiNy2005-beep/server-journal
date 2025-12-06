// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const Joi = require('joi');
const multer = require('multer');
const mongoose = require('mongoose');

const app = express();

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://Ruchika:Ruchika1$@cluster0.fzmwstl.mongodb.net/";
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("connected to mongodb"))
  .catch((error) => console.log("couldn't connect to mongodb", error));

const journalSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  img_name: { type: String, default: '' },
  mood: { type: String, default: '' },
  summary: { type: String, required: true }
}, { timestamps: true });

const JournalEntry = mongoose.model("JournalEntry", journalSchema);

/* ----------------- Multer setup ----------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});
const upload = multer({ storage });

app.use('/uploads', express.static(UPLOADS_DIR));

/* ----------------- Validation schema ----------------- */
const entrySchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  date: Joi.date().iso().required(),
  summary: Joi.string().min(1).max(5000).required(),
  mood: Joi.string().allow('').max(200),
  img_name: Joi.string().allow('').max(1000)
});

/* ----------------- Routes ----------------- */

app.get('/', (req, res) => {
  res.send(`<h1>Journal Server</h1><ul><li><a href="/api/journalEntries">/api/journalEntries</a></li></ul>`);
});

app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// list all
app.get('/api/journalEntries', async (req, res) => {
  try {
    const entries = await JournalEntry.find().sort({ date: -1 }).lean();
    res.json(entries);
  } catch (err) {
    console.error('GET /api/journalEntries error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// get one
app.get('/api/journalEntries/:id', async (req, res) => {
  try {
    const entry = await JournalEntry.findById(req.params.id).lean();
    if (!entry) return res.status(404).json({ message: 'Not found' });
    res.json(entry);
  } catch (err) {
    console.error('GET /api/journalEntries/:id error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// create
app.post('/api/journalEntries', upload.single('img'), async (req, res) => {
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
        try { await fs.promises.unlink(path.join(UPLOADS_DIR, req.file.filename)); } catch (_) { /* ignore */ }
      }
      return res.status(400).json({
        message: 'Validation failed',
        details: error.details.map(d => ({ message: d.message, path: d.path || [], context: d.context || {} }))
      });
    }

    const entry = new JournalEntry(value);
    const saved = await entry.save();
    return res.status(201).json(saved);
  } catch (err) {
    console.error('POST /api/journalEntries error:', err);
    if (req.file) {
      try { await fs.promises.unlink(path.join(UPLOADS_DIR, req.file.filename)); } catch (_) { /* ignore */ }
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

// update
app.put('/api/journalEntries/:id', upload.single('img'), async (req, res) => {
  try {
    const existing = await JournalEntry.findById(req.params.id).lean();
    if (!existing) {
      if (req.file) {
        try { await fs.promises.unlink(path.join(UPLOADS_DIR, req.file.filename)); } catch (_) { /* ignore */ }
      }
      return res.status(404).json({ message: 'Not found' });
    }

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
        try { await fs.promises.unlink(path.join(UPLOADS_DIR, req.file.filename)); } catch (_) { /* ignore */ }
      }
      return res.status(400).json({
        message: 'Validation failed',
        details: error.details.map(d => ({ message: d.message, path: d.path || [], context: d.context || {} }))
      });
    }

    // remove old uploaded file if replaced
    if (req.file && existing.img_name && typeof existing.img_name === 'string' && existing.img_name.startsWith('uploads/')) {
      const oldPath = path.join(__dirname, existing.img_name);
      try { if (fs.existsSync(oldPath)) await fs.promises.unlink(oldPath); } catch (err) { console.warn('Failed to remove old uploaded file', oldPath, err); }
    }

    const updatedDoc = await JournalEntry.findByIdAndUpdate(req.params.id, { $set: value }, { new: true }).lean();
    if (!updatedDoc) return res.status(404).json({ message: "We couldn't locate the entry to edit" });

    return res.json(updatedDoc);
  } catch (err) {
    console.error('PUT /api/journalEntries/:id error:', err);
    if (req.file) {
      try { await fs.promises.unlink(path.join(UPLOADS_DIR, req.file.filename)); } catch (_) { /* ignore */ }
    }
    return res.status(500).json({ message: 'Server error' });
  }
});

// delete
app.delete('/api/journalEntries/:id', async (req, res) => {
  try {
    const removed = await JournalEntry.findByIdAndDelete(req.params.id).lean();
    if (!removed) return res.status(404).json({ message: 'Not found' });

    if (removed.img_name && typeof removed.img_name === 'string' && removed.img_name.startsWith('uploads/')) {
      const filePath = path.join(__dirname, removed.img_name);
      try { await fs.promises.unlink(filePath); } catch (err) { console.warn('Failed to remove uploaded file during delete:', filePath, err); }
    }

    return res.json({ message: 'Deleted', deletedId: removed._id });
  } catch (err) {
    console.error('DELETE /api/journalEntries/:id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

/* ----------------- Start server ----------------- */
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
