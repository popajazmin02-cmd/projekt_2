import express from 'express';
import path from 'path';
import { GameService } from './gameService';

const app = express();
const port = 3000;
const gameService = new GameService();

app.use(express.json()); // Ez KÖTELEZŐ, hogy értse a weblapról jövő JSON-t!
app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// JAVÍTOTT Új játék végpont (Soha nem fagy le)
app.post('/api/new-game', async (req, res) => {
  try {
    const { theme } = req.body || {};
    const result = await gameService.createTestSession(theme || 'Dark Fantasy');
    res.json(result);
  } catch (error) {
    console.error("Hiba az új játék indításakor:", error);
    // Ha hiba van, akkor is küldünk választ, hogy a weblap ne töltsön végtelenül!
    res.status(500).json({ error: 'Failed to create game session' });
  }
});

app.post('/api/action', async (req, res) => {
  try {
    const { sessionId, command } = req.body;
    if (!sessionId || !command) {
      return res.status(400).json({ error: 'Missing sessionId or command' });
    }
    const result = await gameService.processTurn(sessionId, command);
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => {
  console.log(`🚀 Szerver fut: http://localhost:${port}`);
});