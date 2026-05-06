import { PrismaClient } from '@prisma/client';
import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';

const prisma = new PrismaClient();
const AI_MODEL = 'llama-3.3-70b-versatile'; 

export class GameService {
  
  async processTurn(sessionId: string, command: string) {
    console.log(`\n[GameService] New command: "${command}"`);

    const player = await prisma.character.findFirst({
      where: { sessionId: sessionId, type: 'PLAYER' }
    });
    if (!player) throw new Error("Player not found!");

    // Ha a játékos már halott, nem csinálhat semmit!
    if (player.hp <= 0) {
        return {
            narrative: "You are dead. The adventure ends here.",
            status: "GAME_OVER",
            facts: ["Player is dead."],
            currentLocation: { x: player.coordX, y: player.coordY },
            map: [], inventory: [], hp: 0, maxHp: player.maxHp
        };
    }

    let currentRoom = await prisma.mapCell.findFirst({
      where: { sessionId: sessionId, coordX: player.coordX, coordY: player.coordY }
    });

    const npcsInRoom = await prisma.character.findMany({
      where: { sessionId: sessionId, type: 'NPC', coordX: player.coordX, coordY: player.coordY }
    });
    const npcContext = npcsInRoom.map(n => `${n.name} (${n.description})`).join(', ') || 'No one else is here.';

    const pastLogs = await prisma.historyLog.findMany({
      where: { sessionId: sessionId },
      orderBy: { createdAt: 'desc' },
      take: 3 
    });
    pastLogs.reverse();

    let historyContext = "No previous history.";
    if (pastLogs.length > 0) {
      historyContext = pastLogs.map(log => `Player: "${log.command}"\nDM: "${log.narrative}"`).join('\n\n');
    }

    let currentInventory = player.inventory ? player.inventory.split(',').filter(i => i.trim() !== '') : [];
    const inventoryString = currentInventory.length > 0 ? currentInventory.join(', ') : "Empty";

    // VILÁGGENERÁLÁS
    if (!currentRoom) {
      let newBiome = "Dark Area";
      let newDesc = "A mysterious dark location.";
      let newExits = "NORTH, SOUTH"; 

      try {
        const { text: roomJsonStr } = await generateText({
          model: groq(AI_MODEL),
          system: `You are a Dungeon Master procedurally generating a dark fantasy dungeon. 
          Respond with ONLY raw JSON.
          Format: {
            "biome": "Room Name", 
            "description": "Atmospheric description",
            "exits": ["NORTH", "EAST"],
            "npc": {"name": "Goblin Guard", "description": "A hostile, ugly goblin with a rusty knife."} // Sometimes create monsters!
          }`,
          prompt: `The player just walked into an unexplored area. Generate the next room.`
        });
        
        // JAVÍTÁS ITT: Biztonságos Regex a backtickekhez
        const cleanJsonStr = roomJsonStr.replace(/[`]{3}json/gi, '').replace(/[`]{3}/g, '').trim();
        const newRoomData = JSON.parse(cleanJsonStr);
        
        newBiome = newRoomData.biome || newBiome;
        newDesc = newRoomData.description || newDesc;
        if (newRoomData.exits && Array.isArray(newRoomData.exits)) newExits = newRoomData.exits.join(', ').toUpperCase();

        if (newRoomData.npc && newRoomData.npc.name) {
            await prisma.character.create({
                data: {
                    sessionId: sessionId, type: 'NPC', 
                    name: newRoomData.npc.name, description: newRoomData.npc.description,
                    coordX: player.coordX, coordY: player.coordY
                }
            });
        }
      } catch (error) {
        console.error("⚠️ Térkép API hiba:", error);
      }

      currentRoom = await prisma.mapCell.create({
        data: {
          sessionId: sessionId, coordX: player.coordX, coordY: player.coordY,
          biome: newBiome, description: newDesc, exits: newExits, isVisited: true
        }
      });
    }

    // ==========================================
    // STEP 1: THE SIMULATOR (ÚJ: Harc Logika!)
    // ==========================================
    let aiLogic: any = {
        actionResult: 'PARTIAL',
        worldEvents: ['The world stands still.'],
        playerMoved: false,
        newCoordX: player.coordX,
        newCoordY: player.coordY,
        addedItems: [],
        removedItems: [],
        hpChange: 0 
    };

    try {
        const { text: logicJsonStr } = await generateText({
            model: groq(AI_MODEL),
            system: `You are the Game Engine. 
            Current Room: "${currentRoom?.description}"
            Exits: [${currentRoom?.exits}]
            Entities in room: [${npcContext}]
            Player Inventory: [${inventoryString}]
            Player HP: ${player.hp}/${player.maxHp}
            
            RULES:
            1. If the player fights a hostile entity (or does something dangerous like falling), calculate damage. Set "hpChange" to a negative number (e.g. -15).
            2. If they heal, set "hpChange" to a positive number.
            3. Movement rules remain strict.
            
            Respond ONLY with raw JSON: 
            {
              "actionResult": "SUCCESS" or "FAILURE",
              "worldEvents": ["event 1"],
              "playerMoved": boolean,
              "newCoordX": integer,
              "newCoordY": integer,
              "addedItems": ["ItemName"],
              "removedItems": ["ItemName"],
              "hpChange": integer
            }`,
            prompt: `Command: "${command}"`
        });
        
        // JAVÍTÁS ITT: Biztonságos Regex a backtickekhez
        const cleanLogicStr = logicJsonStr.replace(/[`]{3}json/gi, '').replace(/[`]{3}/g, '').trim();
        aiLogic = JSON.parse(cleanLogicStr);
        if (aiLogic.newCoordX === undefined) aiLogic.newCoordX = player.coordX;
        if (aiLogic.newCoordY === undefined) aiLogic.newCoordY = player.coordY;
        if (aiLogic.hpChange === undefined) aiLogic.hpChange = 0;

    } catch (error) {
        console.error("⚠️ Logika API hiba:", error);
    }

    if (aiLogic.addedItems) currentInventory.push(...aiLogic.addedItems);
    if (aiLogic.removedItems) currentInventory = currentInventory.filter((i: string) => !aiLogic.removedItems.includes(i));

    // Életerő kiszámolása
    let newHp = player.hp + aiLogic.hpChange;
    if (newHp > player.maxHp) newHp = player.maxHp;
    if (newHp < 0) newHp = 0;

    await prisma.character.update({
      where: { id: player.id },
      data: { 
          coordX: aiLogic.newCoordX, 
          coordY: aiLogic.newCoordY, 
          inventory: currentInventory.join(','),
          hp: newHp 
      }
    });

    // ==========================================
    // STEP 2: THE NARRATOR
    // ==========================================
    let narrative = "";
    try {
      const { text } = await generateText({
        model: groq(AI_MODEL),
        system: `You are a Dungeon Master. Location: ${currentRoom?.biome}. Entities: [${npcContext}].
        Write a short, atmospheric response in the second person. Do not write JSON.`,
        prompt: `Recent History:\n${historyContext}\nCommand: "${command}"\nEvents: ${aiLogic.worldEvents.join(' ')}\nHP Change: ${aiLogic.hpChange} (If negative, describe the player taking damage!)`
      });
      narrative = text;
    } catch (error) {
      narrative = "The gods are silent. Your action was processed, but reality blurs.";
    }

    await prisma.historyLog.create({
      data: { sessionId: sessionId, command: command, narrative: narrative }
    });

    const exploredMap = await prisma.mapCell.findMany({
      where: { sessionId: sessionId },
      select: { coordX: true, coordY: true, biome: true }
    });

    const finalStatus = newHp <= 0 ? "GAME_OVER" : aiLogic.actionResult;

    return {
      narrative: narrative,
      status: finalStatus,
      facts: aiLogic.worldEvents,
      currentLocation: { x: aiLogic.newCoordX, y: aiLogic.newCoordY },
      map: exploredMap,
      inventory: currentInventory,
      hp: newHp,           
      maxHp: player.maxHp  
    };
  }

  async createTestSession(theme: string = "Dark Fantasy") {
    const newSession = await prisma.gameSession.create({
      data: { playerName: "Hero", worldSettings: { theme: theme } }
    });
    await prisma.character.create({
      data: { sessionId: newSession.id, type: 'PLAYER', name: 'Hero', coordX: 0, coordY: 0, inventory: "", hp: 100, maxHp: 100 }
    });
    
    console.log(`🌍 Világ generálása indul. Műfaj: ${theme}...`);
    
    let startingBiome = "Kezdőpont";
    let startingDesc = "Egy ismeretlen helyen ébredsz fel.";

    try {
        const { text: roomJsonStr } = await generateText({
          model: groq(AI_MODEL),
          system: `You are a Dungeon Master creating a text adventure. The genre is: ${theme}.
          Generate the VERY FIRST starting room of the game.
          Respond ONLY with raw JSON. Format: 
          { 
            "biome": "Room Name", 
            "description": "Atmospheric description of where the player just woke up.", 
            "npc": {"name": "Enemy Name", "description": "Enemy description"} 
          }`,
          prompt: `Generate the starting location for a ${theme} game.`
        });
        
        const cleanJsonStr = roomJsonStr.replace(/[`]{3}json/gi, '').replace(/[`]{3}/g, '').trim();
        const startData = JSON.parse(cleanJsonStr);
        
        startingBiome = startData.biome || startingBiome;
        startingDesc = startData.description || startingDesc;

        if (startData.npc && startData.npc.name) {
            await prisma.character.create({
                data: { sessionId: newSession.id, type: 'NPC', name: startData.npc.name, description: startData.npc.description, coordX: 0, coordY: 0, inventory: "" }
            });
        }
    } catch (error) {
        console.error("⚠️ Kezdőszoba generálási hiba:", error);
    }

    await prisma.mapCell.create({
      data: {
        sessionId: newSession.id, coordX: 0, coordY: 0, biome: startingBiome,
        description: startingDesc, exits: 'NORTH, EAST, SOUTH, WEST', isVisited: true
      }
    });

    // ÚJ: Visszaküldjük a weblapnak a legenerált kezdőszöveget is!
    return { sessionId: newSession.id, startingText: startingDesc };
  }
}