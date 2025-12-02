const express = require("express");
const cors = require("cors");
const multer = require("multer");
const Joi = require("joi");
const mongoose = require("mongoose");
const app = express();
app.use(express.static("public"));
app.use(express.json());
app.use(cors());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/images/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

mongoose
  .connect("mongodb+srv://Ruchika:Ruchika1$@cluster0.fzmwstl.mongodb.net/")
  .then(() => {
    console.log("connected to mongodb");
  })
  .catch((error) => {
    console.log("couldn't connect to mongodb", error);
  });

const journalSchema = new mongoose.Schema({
  title: String,
  date: Date,
  img_name: String,
  mood: String,
  summary: String
});

const Journal = mongoose.model("Journal", journalSchema);

app.get("/api/journalEntries", async (req, res) => {
  const entries = await Journal.find().sort({ date: -1 });
  res.send(entries);
});

app.get("/api/journalEntries/:id", async (req, res) => {
  const entry = await Journal.findById(req.params.id);
  if (!entry) {
    res.status(404).send("Not found");
    return;
  }
  res.send(entry);
});

app.post("/api/journalEntries", upload.single("img"), async (req, res) => {
  const isValid = validateEntry(req.body);
  if (isValid.error) {
    res.status(400).send(isValid.error.details[0].message);
    return;
  }
  const entry = new Journal({
    title: req.body.title,
    date: req.body.date,
    summary: req.body.summary,
    mood: req.body.mood
  });
  if (req.file) {
    entry.img_name = req.file.filename;
  } else if (req.body.img_name) {
    entry.img_name = req.body.img_name;
  }
  const newEntry = await entry.save();
  res.status(200).send(newEntry);
});

app.put("/api/journalEntries/:id", upload.single("img"), async (req, res) => {
  const isValidUpdate = validateEntry(req.body);
  if (isValidUpdate.error) {
    res.status(400).send(isValidUpdate.error.details[0].message);
    return;
  }
  const fieldsToUpdate = {
    title: req.body.title,
    date: req.body.date,
    summary: req.body.summary,
    mood: req.body.mood
  };
  if (req.file) {
    fieldsToUpdate.img_name = req.file.filename;
  } else if (req.body.img_name) {
    fieldsToUpdate.img_name = req.body.img_name;
  }
  const success = await Journal.updateOne({ _id: req.params.id }, fieldsToUpdate);
  if (!success) {
    res.status(404).send("We couldn't locate the entry to edit");
    return;
  }
  const entry = await Journal.findById(req.params.id);
  res.status(200).send(entry);
});

app.delete("/api/journalEntries/:id", async (req, res) => {
  const entry = await Journal.findByIdAndDelete(req.params.id);
  if (!entry) {
    res.status(404).send("We couldn't locate the entry to delete");
    return;
  }
  res.status(200).send(entry);
});

const validateEntry = (entry) => {
  const schema = Joi.object({
    _id: Joi.allow(""),
    title: Joi.string().min(1).required(),
    date: Joi.date().iso().required(),
    summary: Joi.string().min(1).required(),
    mood: Joi.string().allow("").optional(),
    img_name: Joi.string().allow("").optional()
  });
  return schema.validate(entry);
};

app.listen(3001, () => {
  console.log("I'm listening...");
});
