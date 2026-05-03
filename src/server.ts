import 'dotenv/config';
import express from 'express';
import { GameService } from './gameService';

const app = express();
app.use(express.json()); // Hogy a szerver tudjon JSON-t olvasni

const gameService = new GameService();

// Egy végpont a parancsok fogadására
app.post('/api/action', async (req, res) => {
  try {
    const { sessionId, command } = req.body;

    if (!sessionId || !command) {
       res.status(400).json({ error: "Hiányzó sessionId vagy command!" });
       return;
    }

    // Meghívjuk a logikánkat
    const result = await gameService.processTurn(sessionId, command);
    
    // Visszaküldjük a választ a játékosnak
    res.json(result);

  } catch (error: any) {
    console.error("Hiba történt:", error);
    res.status(500).json({ error: error.message });
  }
});

// Teszt végpont: Csinálunk egy új játékot, hogy legyen egy Session ID-nk
app.post('/api/new-game', async (req, res) => {
    try {
        const newSessionId = await gameService.createTestSession();
        res.json({ message: "Új játék elindítva!", sessionId: newSessionId });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Szerver indítása a 3000-es porton
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Szerver fut: http://localhost:${PORT}`);
});