import { PrismaClient } from '@prisma/client';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const prisma = new PrismaClient();

export class GameService {
  
  async processTurn(sessionId: string, command: string) {
    console.log(`[GameService] Új parancs: "${command}"`);

    // 1. Jelenlegi állapot lekérése (Ezt adjuk oda az AI-nak, hogy képben legyen)
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) throw new Error("Nem található ilyen játékmenet!");

    // 2. AZ IGAZI AI HÍVÁS (The Simulator - GPT-4o)
    console.log("🤔 AI gondolkodik a lépésen...");
    
    const { object: aiLogic } = await generateObject({
     model: google('gemini-1.5-flash'),
      // Szigorú struktúrát követelünk meg (Zod séma)
      schema: z.object({
        actionResult: z.enum(['SUCCESS', 'FAILURE', 'PARTIAL']),
        // Nem regényt kérünk, csak rövid tényeket, amiből a Claude majd dolgozik
        worldEvents: z.array(z.string()).describe('Rövid, tényszerű megállapítások arról, hogy mi történt.'),
        // Mozgás érzékelése
        playerMoved: z.boolean().describe('Igaz, ha a játékos sikeresen átment egy másik szobába.')
      }),
      system: `
        Te vagy egy Text Adventure játék szigorú Szabálybírója (Game Engine).
        A te feladatod CSAK a cselekmény logikai kiértékelése. 
        Ne írj regényt! Csak a kért JSON struktúrát add vissza.
        A világ típusa: Sötét fantasy.
      `,
      prompt: `A játékos megpróbálja ezt tenni: "${command}". Értékeld ki az eredményt!`
    });

    console.log("✅ AI Válasz megérkezett:", aiLogic);

    // 3. Adatbázis frissítése (Később itt mozgatjuk a karaktert a 'playerMoved' alapján)

    // 4. Eredmény visszaadása a kliensnek
    // (A következő fázisban ezt a nyers listát átadjuk a Claude-nak, hogy szép szöveget írjon belőle)
    return {
      status: aiLogic.actionResult,
      facts: aiLogic.worldEvents,
      raw_ai_data: aiLogic
    };
  }

  async createTestSession() {
    const newSession = await prisma.gameSession.create({
      data: {
        playerName: "Teszt Elek",
        worldSettings: { theme: "Dark Fantasy" }
      }
    });
    return newSession.id;
  }
}