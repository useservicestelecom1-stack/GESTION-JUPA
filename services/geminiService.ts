
import { GoogleGenAI } from "@google/genai";
import { AppState } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generatePoolReport = async (appState: AppState, userPrompt: string): Promise<string> => {
  if (!process.env.API_KEY) return "Error: API Key no configurada.";

  const systemPrompt = `
    Actúa como un experto administrador de la Junta Usuarios Piscina de Albrook.
    Tienes acceso a los siguientes datos en formato JSON (Socios, Finanzas, Inventario, Bitácora):
    ${JSON.stringify(appState)}
    
    Tu trabajo es responder preguntas sobre el estado de la piscina, generar reportes financieros, 
    resúmenes de mantenimiento, o borradores de comunicados para la comunidad de socios.
    Siempre refiérete a la organización como "la Junta".
    Sé conciso, profesional y servicial. Usa formato Markdown para la respuesta.
    Si te piden datos financieros, haz los cálculos basándote en la lista de transacciones provista.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
      }
    });

    return response.text || "No se pudo generar el reporte.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error al conectar con el asistente inteligente. Verifica la consola para más detalles.";
  }
};
