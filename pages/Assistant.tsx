
import React, { useState } from 'react';
import { AppState } from '../types';
import { generatePoolReport } from '../services/geminiService';
import { Bot, Sparkles, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AssistantProps {
  appState: AppState;
}

const Assistant: React.FC<AssistantProps> = ({ appState }) => {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const predefinedPrompts = [
    "Genera un reporte financiero de este mes para la junta directiva.",
    "¿Cuál es el estado actual del inventario de químicos?",
    "Redacta un comunicado solicitando el pago de cuotas atrasadas.",
    "Resume las actividades de mantenimiento recientes."
  ];

  const handleGenerate = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setResponse(null);
    const result = await generatePoolReport(appState, text);
    setResponse(result);
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center p-3 bg-gradient-to-r from-teal-500 to-blue-600 rounded-full mb-4 shadow-lg">
          <Bot className="text-white w-8 h-8" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800">Asistente Virtual Inteligente</h2>
        <p className="text-slate-500 mt-2">
          Utiliza IA para analizar los datos de la piscina, generar reportes y redactar comunicados para la comunidad.
        </p>
      </div>

      {/* Input Area */}
      <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100">
        <div className="relative">
            <textarea 
                className="w-full border border-slate-200 rounded-lg p-4 pr-12 h-32 outline-none focus:ring-2 focus:ring-teal-500 resize-none text-slate-700"
                placeholder="Ej: ¿Cuánto gastamos en cloro el mes pasado?..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
            ></textarea>
            <button 
                onClick={() => handleGenerate(prompt)}
                disabled={loading || !prompt}
                className={`absolute bottom-4 right-4 p-2 rounded-full transition-colors ${loading || !prompt ? 'bg-slate-200 text-slate-400' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
            >
                <Send size={20} />
            </button>
        </div>
        
        {/* Quick Prompts */}
        <div className="mt-4 flex flex-wrap gap-2">
            {predefinedPrompts.map((p, i) => (
                <button 
                    key={i}
                    onClick={() => { setPrompt(p); handleGenerate(p); }}
                    className="flex items-center gap-1 text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 px-3 py-2 rounded-full border border-slate-200 transition-colors"
                >
                    <Sparkles size={12} className="text-yellow-500" />
                    {p}
                </button>
            ))}
        </div>
      </div>

      {/* Result Area */}
      {loading && (
          <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
              <p className="text-slate-500 animate-pulse">Analizando datos y generando respuesta...</p>
          </div>
      )}

      {response && !loading && (
          <div className="bg-white p-8 rounded-xl shadow-md border border-slate-100 prose prose-slate max-w-none">
              <ReactMarkdown>{response}</ReactMarkdown>
          </div>
      )}
    </div>
  );
};

export default Assistant;
