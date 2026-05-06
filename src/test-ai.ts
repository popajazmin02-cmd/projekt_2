import 'dotenv/config';

async function checkGoogleModels() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    console.log("🔍 Lekérdezzük a Google szervereitől az elérhető modelleket...");
    
    try {
        // Közvetlen hívás a Google REST API-jához
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        
        if (data.error) {
            console.log("❌ A Google visszautasította a kulcsot. Hibaüzenet:");
            console.log(data.error.message);
            return;
        }
        
        // Csak a generatív modelleket szűrjük ki
        const modelNames = data.models
            .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => m.name.replace('models/', '')); // Levágjuk a "models/" előtagot a szebb megjelenésért
            
        console.log("✅ Ezzel az API kulccsal az alábbi modelleket tudod használni:");
        console.log("--------------------------------------------------");
        console.log(modelNames.join('\n'));
        console.log("--------------------------------------------------");
        
    } catch (e) {
        console.error("❌ Hálózati hiba:", e);
    }
}

checkGoogleModels();