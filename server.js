const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.static('public'));
app.use(cors());

app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

app.get('/', (req, res) => res.send('root OK'));

app.get('/api/journalEntries', (req, res) => {
  res.json([
    "Entry 1: Today I learned about Express.js",
    "Entry 2: I built my first API endpoint",
    "Entry 3: JavaScript is fun!"
  ]);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`I am listening on port ${PORT}`));
