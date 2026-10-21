"use client";

import { useState, useEffect, useRef } from "react";
import { Bot, Send, RotateCcw } from "lucide-react";

interface AICopilotCardProps {
  telemetry: any;
  route: any;
  fuelMetrics: any;
  theme?: "glass" | "obsidian";
  language?: "EN" | "FR" | "ES";
}

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
  time: string;
}

const COPILOT_TEXT: Record<
  "EN" | "FR" | "ES",
  {
    title: string;
    online: string;
    welcome: string;
    placeholder: string;
    qFuel: string;
    qCost: string;
    qCarbon: string;
    qStatus: string;
  }
> = {
  EN: {
    title: "SKYQUANT AI COPILOT",
    online: "ONLINE",
    welcome:
      "Welcome aboard! I'm your SkyQuant Copilot. Ask me anything.",
    placeholder: "Ask a question",
    qFuel: "Fuel burn",
    qCost: "Cost Index",
    qCarbon: "Carbon impact",
    qStatus: "Flight status",
  },
  FR: {
    title: "COPILOTE SKYQUANT IA",
    online: "EN LIGNE",
    welcome:
      "Bienvenue à bord ! Je suis votre copilote SkyQuant. Posez-moi toutes vos questions.",
    placeholder: "Posez votre question",
    qFuel: "Carburant",
    qCost: "Cost Index",
    qCarbon: "Impact carbone",
    qStatus: "Statut du vol",
  },
  ES: {
    title: "COPILOTO SKYQUANT IA",
    online: "EN LÍNEA",
    welcome:
      "¡Bienvenido a bordo! Soy tu copiloto de SkyQuant. Pregúntame lo que quieras.",
    placeholder: "Haz una pregunta",
    qFuel: "Combustible",
    qCost: "Cost Index",
    qCarbon: "Impacto CO2",
    qStatus: "Estado del vuelo",
  },
};

export default function AICopilotCard({
  telemetry,
  route,
  fuelMetrics,
  theme = "glass",
  language = "EN",
}: AICopilotCardProps) {
  const isGlass = theme === "glass";
  const t = COPILOT_TEXT[language] || COPILOT_TEXT.EN;
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const getNowTime = () => {
    const d = new Date();
    return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`;
  };

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: t.welcome, time: getNowTime() },
  ]);

  useEffect(() => {
    setMessages([{ role: "assistant", text: t.welcome, time: getNowTime() }]);
  }, [language, t.welcome]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const buildReply = (query: string): string => {
    const q = query.toLowerCase();
    const cs = telemetry?.callsign || "this aircraft";
    const ac = fuelMetrics?.aircraft_type_assumed || "commercial jet";
    const burnS = Number(fuelMetrics?.burn_rate_kg_s ?? 1.2).toFixed(2);
    const burnHr = Math.round(Number(fuelMetrics?.burn_rate_kg_hr ?? 4300)).toLocaleString();
    const altM = Math.round(Number(telemetry?.altitude_m ?? 10500)).toLocaleString();
    const spdKmh = Math.round(Number(telemetry?.velocity_ms ?? 230) * 3.6).toLocaleString();
    const co2Hr = (((Number(fuelMetrics?.burn_rate_kg_hr ?? 4300) * 3.16) / 1000)).toFixed(1);
    const etsCost = (((Number(fuelMetrics?.burn_rate_kg_hr ?? 4300) * 3.16) / 1000) * 72.4).toFixed(0);

    if (language === "FR") {
      if (q.includes("carburant") || q.includes("fuel") || q.includes("burn")) {
        return `${cs} (${ac}) consomme actuellement ${burnS} kg/s (${burnHr} kg/h) selon le modèle aérodynamique OpenAP à ${altM} m.`;
      }
      if (q.includes("cost") || q.includes("coût") || q.includes("index")) {
        return `Le Cost Index optimise le compromis entre le coût horaire d'exploitation et le débit de carburant à ${spdKmh} km/h.`;
      }
      if (q.includes("carbone") || q.includes("co2") || q.includes("ets")) {
        return `Les émissions atteignent ${co2Hr} t CO2/h (facteur 3,16 kg CO2/kg kérosène), soit une exposition EU ETS d'environ €${etsCost}/h.`;
      }
      return `${cs} relie ${route?.origin_iata || "DEP"} à ${route?.dest_iata || "ARR"} à une altitude de ${altM} m et ${spdKmh} km/h.`;
    }

    if (language === "ES") {
      if (q.includes("combustible") || q.includes("fuel") || q.includes("burn")) {
        return `${cs} (${ac}) consume actualmente ${burnS} kg/s (${burnHr} kg/h) calculado mediante OpenAP a ${altM} m de altitud.`;
      }
      if (q.includes("cost") || q.includes("index") || q.includes("costo")) {
        return `El Cost Index equilibra el costo del tiempo de vuelo frente al consumo marginal de combustible a ${spdKmh} km/h.`;
      }
      if (q.includes("carbon") || q.includes("co2") || q.includes("ets")) {
        return `La tasa actual genera ${co2Hr} t CO2/h, lo que representa un pasivo estimado bajo EU ETS de €${etsCost}/h.`;
      }
      return `${cs} vuela de ${route?.origin_iata || "DEP"} a ${route?.dest_iata || "ARR"} a ${altM} m y ${spdKmh} km/h.`;
    }

    if (q.includes("fuel") || q.includes("burn")) {
      return `${cs} (${ac}) is burning ${burnS} kg/s (${burnHr} kg/h), computed live via OpenAP drag-polar physics at ${altM} m.`;
    }
    if (q.includes("cost") || q.includes("index")) {
      return `Cost Index balances time-related operating costs against fuel burn sensitivity at a groundspeed of ${spdKmh} km/h.`;
    }
    if (q.includes("carbon") || q.includes("co2") || q.includes("ets")) {
      return `Current burn yields ${co2Hr} t CO2/h (3.16x stoichiometric factor), translating to ~€${etsCost}/h in EU ETS allowance liability.`;
    }
    return `${cs} is enroute from ${route?.origin_iata || "DEP"} to ${route?.dest_iata || "ARR"} cruising at ${altM} m and ${spdKmh} km/h.`;
  };

  const handleSend = (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query) return;
    const now = getNowTime();
    const reply = buildReply(query);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: query, time: now },
      { role: "assistant", text: reply, time: now },
    ]);
    if (!textToSend) setInput("");
  };

  return (
    <div
      className={`p-3 rounded-2xl flex flex-col justify-between transition-all duration-300 ${
        isGlass ? "glass-deck-panel" : "obsidian-panel rounded-2xl"
      }`}
    >
      {/* Single-line responsive header for EN, FR, and ES */}
      <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-white/10 flex-nowrap">
        <div className="flex items-center gap-2 min-w-0 flex-nowrap">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-violet-600 to-fuchsia-500 flex items-center justify-center text-white shadow-[0_0_12px_rgba(168,85,247,0.4)] shrink-0">
            <Bot size={14} />
          </div>
          <h3 className="text-[10px] xl:text-[11px] font-mono font-bold uppercase tracking-tight text-white whitespace-nowrap truncate">
            {t.title}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[9px] font-mono font-bold flex items-center gap-1 whitespace-nowrap shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>{t.online}</span>
          </span>
          <button
            onClick={() =>
              setMessages([{ role: "assistant", text: t.welcome, time: getNowTime() }])
            }
            title="Reset Copilot"
            className="p-1 text-slate-400 hover:text-white transition-colors shrink-0 cursor-pointer"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* Quick Prompt Pills */}
      <div className="grid grid-cols-2 gap-1.5 my-2">
        {[t.qFuel, t.qCost, t.qCarbon, t.qStatus].map((q) => (
          <button
            key={q}
            onClick={() => handleSend(q)}
            className="px-2 py-1 rounded-lg text-[10px] font-mono text-slate-300 hover:text-white border border-white/10 bg-white/[0.03] hover:bg-violet-500/15 hover:border-violet-400/40 transition-all truncate cursor-pointer"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Message Stream */}
      <div
        ref={scrollRef}
        className="h-24 overflow-y-auto space-y-1.5 pr-1 my-1 text-[11px] font-mono"
      >
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`p-2 rounded-xl border leading-relaxed ${
              m.role === "assistant"
                ? "bg-black/30 border-white/10 text-slate-200"
                : "bg-violet-600/20 border-violet-400/30 text-violet-100 ml-4"
            }`}
          >
            <p>{m.text}</p>
            <span className="text-[9px] text-slate-500 block text-right mt-0.5">
              {m.time}
            </span>
          </div>
        ))}
      </div>

      {/* Input Box */}
      <div className="relative flex items-center mt-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={t.placeholder}
          className="w-full rounded-xl pl-3 pr-8 py-1.5 text-[11px] text-white placeholder-slate-400 font-mono bg-black/30 border border-white/10 focus:outline-none focus:border-violet-400/70 transition-all"
        />
        <button
          onClick={() => handleSend()}
          className="absolute right-2 text-slate-400 hover:text-violet-300 transition-colors cursor-pointer"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}