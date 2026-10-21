import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

interface ChatRequest {
  message: string;
  language?: "EN" | "FR" | "ES";
  callsign?: string;
  aircraft?: string;
  origin?: string;
  destination?: string;
  burnRate?: number;
}

// Built-in expert knowledge base for instant, deterministic, and offline fallback responses
const DOMAIN_KNOWLEDGE: Record<
  "EN" | "FR" | "ES",
  Record<string, string>
> = {
  EN: {
    fuel: "Fuel burn is modeled using OpenAP kinematic flight performance tables combined with a PyTorch neural surrogate regression. Instantaneous thrust requirements are calculated from aircraft mass, aerodynamic drag coefficient (CD0 + k*CL²), atmospheric density at cruise altitude, and true airspeed. Carbon emissions are calculated using the standard ICAO/EU ETS conversion factor of 3.16 kg CO₂ per kg of Jet A-1.",
    cost_index: "Cost Index (CI = Ct / Cf) is a key quantitative flight economics parameter representing the ratio of time-dependent operational costs ($/hr) to fuel cost ($/kg). A low CI (e.g. 20-30) prioritizes maximum fuel conservation via aerodynamic max-range cruise speed (MRC), whereas a high CI (e.g. 80-100) minimizes flight crew and aircraft utilization time by accelerating cruise Mach closer to MMO.",
    libraries: "SkyQuant's tech stack combines Next.js 16 (React 19, TypeScript) and Tailwind CSS v4 for the AeroGlass Vision interface; Leaflet & React-Leaflet with CartoDB Dark Matter for the tactical orthodromic radar; Recharts for multi-phase streamgraphs and radar profiles; and Python (FastAPI, OpenAP, PyTorch, FlightRadarAPI, airportsdata) for real-time ADS-B transponder telemetry, kinematic trajectory calculation, and surrogate fuel modeling.",
    ets: "Under EU ETS (Directive 2003/87/EC) and CORSIA, airlines operating within the European Economic Area must surrender carbon allowances (EUA) for their Scope 1 CO₂ emissions. At a carbon price of ~€72.40/ton, a widebody burning 2,500 kg/h emits 7.9 tons of CO₂/hr, creating an environmental liability of approximately €570/hr that directly penalizes sub-optimal flight level step-climbs.",
    default: "I'm your SkyQuant Copilot. Feel free to ask about this flight's fuel dynamics, Cost Index (CI), carbon impact, or how the platform models telemetry."
  },
  FR: {
    fuel: "Le débit de carburant est calculé via les tables cinématiques OpenAP couplées à un modèle neuronal de substitution PyTorch. La poussée requise dépend de la masse de l'appareil, de la traînée aérodynamique (CD0 + k*CL²), de la densité atmosphérique et de la vitesse vraie (TAS). Les émissions de carbone appliquent le facteur ICAO/EU ETS de 3,16 kg de CO₂ par kg de carburant Jet A-1.",
    cost_index: "L'Indice de Coût (Cost Index : CI = Ct / Cf) est un paramètre clé d'économie quantitative du vol. Il exprime le ratio entre les coûts opérationnels liés au temps ($/h) et le prix du carburant ($/kg). Un CI faible (20-30) maximise l'économie de kérosène (vitesse MRC), tandis qu'un CI élevé (80-100) réduit le temps de vol au détriment de la consommation.",
    libraries: "La suite technologique de SkyQuant intègre Next.js 16 (React 19, TypeScript) et Tailwind CSS v4 pour l'interface AeroGlass Vision ; Leaflet & CartoDB Dark Matter pour la cartographie orthodromique ; Recharts pour les flux et profils ; et Python (FastAPI, OpenAP, PyTorch, FlightRadarAPI, airportsdata) pour l'acquisition ADS-B et la modélisation prédictive du carburant.",
    ets: "Dans le cadre du système EU ETS et CORSIA, les compagnies doivent compenser leurs quotas de CO₂. À ~72,40 €/tonne, un gros-porteur consommant 2 500 kg/h émet 7,9 t de CO₂/h, générant une obligation environnementale d'environ 570 €/h qui sanctionne financièrement les paliers d'altitude sous-optimaux.",
    default: "Je suis votre copilote SkyQuant. N'hésitez pas à me poser vos questions sur le carburant, l'Indice de Coût (CI), l'impact carbone ou la modélisation du vol."
  },
  ES: {
    fuel: "El consumo de combustible se calcula mediante las tablas cinemáticas de OpenAP junto con un modelo subrogado neuronal en PyTorch. El empuje requerido se deriva de la masa de la aeronave, el coeficiente de resistencia aerodinámica (CD0 + k*CL²), la densidad a la altitud de crucero y la velocidad verdadera (TAS). Se aplica el factor estándar ICAO/EU ETS de 3,16 kg de CO₂ por kg de Jet A-1.",
    cost_index: "El Índice de Coste (Cost Index: CI = Ct / Cf) es un parámetro clave de economía de vuelo cuantitativa que equilibra los costes operativos horarios frente al precio del combustible. Un CI bajo (20-30) maximiza el ahorro de combustible a velocidad de máximo alcance (MRC), mientras que un CI alto (80-100) minimiza el tiempo de tripulación y rotación de flota.",
    libraries: "El stack de SkyQuant utiliza Next.js 16 (React 19, TypeScript) y Tailwind CSS v4 para la interfaz AeroGlass Vision; Leaflet y CartoDB Dark Matter para el radar ortodrómico táctico; Recharts para diagramas de flujo y radar; y Python (FastAPI, OpenAP, PyTorch, FlightRadarAPI, airportsdata) para telemetría ADS-B en tiempo real y cálculo de consumo.",
    ets: "Bajo el esquema EU ETS y CORSIA, los operadores deben entregar derechos de emisión de carbono (EUA). A un precio de ~72,40 €/tonelada, un bimotor que consume 2.500 kg/h emite 7,9 t de CO₂/h, generando un pasivo ambiental de ~570 €/h que penaliza las asignaciones de nivel de vuelo subóptimas.",
    default: "Soy tu copiloto SkyQuant. No dudes en preguntarme sobre el consumo de combustible, el Índice de Coste (CI), el impacto de carbono o cómo modelamos la telemetría del vuelo."
  }
};

function getFallbackAnswer(message: string, lang: "EN" | "FR" | "ES"): string {
  const query = message.toLowerCase();
  const dict = DOMAIN_KNOWLEDGE[lang] || DOMAIN_KNOWLEDGE.EN;

  if (query.includes("fuel") || query.includes("carburant") || query.includes("combustible") || query.includes("burn") || query.includes("calcul") || query.includes("debit") || query.includes("caudal")) {
    return dict.fuel;
  }
  if (query.includes("cost index") || query.includes("ci") || query.includes("indice") || query.includes("coste") || query.includes("coût") || query.includes("trade-off") || query.includes("economics") || query.includes("economie") || query.includes("economía")) {
    return dict.cost_index;
  }
  if (query.includes("librar") || query.includes("biblioth") || query.includes("stack") || query.includes("tech") || query.includes("react") || query.includes("next") || query.includes("pytorch") || query.includes("openap")) {
    return dict.libraries;
  }
  if (query.includes("ets") || query.includes("carbon") || query.includes("co2") || query.includes("carbone") || query.includes("tax") || query.includes("corsia") || query.includes("emission")) {
    return dict.ets;
  }
  return dict.default;
}

export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();
    const { message, language = "EN", callsign, aircraft, origin, destination, burnRate } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Graceful domain-expert fallback
      const fallbackReply = getFallbackAnswer(message, language);
      return NextResponse.json({ reply: fallbackReply, source: "knowledge-engine" });
    }

    try {
      const ai = new GoogleGenAI();
      const systemInstruction = `You are SkyQuant AI, an expert aerospace copilot and quantitative flight economics assistant created for SkyQuant (developed by Carlos Biddle Miralles).
You specialize in explaining:
1. Flight telemetry and aerodynamics (Mach, True Airspeed, ISA deviation, pressure altitude, dynamic pressure).
2. Quantitative flight economics (Cost Index CI = Ct/Cf, fuel price sensitivities dC/dP_fuel, EU ETS carbon liability at €72.40/ton CO2, marginal abatement cost, CASM / CASK).
3. Technical implementation: Next.js 16, React 19, Tailwind CSS v4 AeroGlass Vision theme, Leaflet Great Circle maps, Recharts streamgraphs, OpenAP kinematic flight performance library, and PyTorch neural surrogate burn model.
Current context:
- Active Flight: ${callsign || "BAW177"} (${aircraft || "B777-300ER"})
- Route: ${origin || "LHR"} -> ${destination || "JFK"}
- Current Fuel Burn: ${burnRate ? burnRate.toFixed(2) + " kg/s" : "2.42 kg/s"}
- Target Language: ${language === "FR" ? "French" : language === "ES" ? "Spanish" : "English"}

Language rules:
- Answer strictly in ${language === "FR" ? "French (Français)" : language === "ES" ? "Spanish (Español)" : "English"}.
- Be concise (2-4 paragraphs maximum or clean bullet points).
- Professional, quantitative, aerospace-engineering tone.
- Do not mention other AI systems or models.`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: message,
        config: {
          systemInstruction,
          temperature: 0.3,
          maxOutputTokens: 600,
        },
      });

      const replyText = response.text || getFallbackAnswer(message, language);
      return NextResponse.json({ reply: replyText, source: "gemini" });
    } catch (apiError) {
      console.warn("Gemini API call failed, falling back to knowledge engine:", apiError);
      const fallbackReply = getFallbackAnswer(message, language);
      return NextResponse.json({ reply: fallbackReply, source: "knowledge-engine" });
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
