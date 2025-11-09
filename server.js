const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.static('public'));
app.use(cors());

app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

const embeddedJournal = {
  entries: [
    {_id:1, title:"Morning Reflections", date:"2025-09-25", img_name:"json/images/morning-reflection.png", mood:"Peaceful", summary:"Started my day with a walk and meditation. Felt calm and focused."},
    {_id:2, title:"Busy Study Day", date:"2025-09-26", img_name:"json/images/midterm-exam.png", mood:"Productive", summary:"Had three classes and a project meeting. Stayed organized and motivated."},
    {_id:3, title:"Weekend fun", date:"2025-09-27", img_name:"json/images/weekend-fun.png", mood:"Relaxed", summary:"Spent time with family in Georgia."},
    {_id:4, title:"Gym time", date:"2025-09-28", img_name:"json/images/gym-time.png", mood:"Energized", summary:"Tried to work out with a friend after a long time."},
    {_id:5, title:"Family time", date:"2025-09-29", img_name:"json/images/family-time.png", mood:"Happy", summary:"Had dinner with family after a while."},
    {_id:6, title:"Rainy weather", date:"2025-09-30", img_name:"json/images/rainy-weather.png", mood:"Calm", summary:"Rainy day. Spent the evening with someone I like."},
    {_id:7, title:"Midterm Stress", date:"2025-10-01", img_name:"json/images/midterm-exam.png", mood:"Stressed", summary:"Studying for midterms, I hated the math class."},
    {_id:8, title:"Self-Care Sunday", date:"2025-10-02", img_name:"json/images/self-care.png", mood:"Refreshed", summary:"Did a face mask, listened to music, and journaled about my goals."}
  ]
};

app.get('/', (req, res) => res.send('root OK'));

app.get('/api/journalEntries', (req, res) => {
  res.json(embeddedJournal);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`I am listening on port ${PORT}`));
