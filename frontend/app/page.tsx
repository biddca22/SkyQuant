"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Map as MapIcon, Plane, Clock, Search, Radar, Layers, Leaf, X, Flame, Info,
} from "lucide-react";
import FuelStreamgraph from "./components/FuelStreamgraph";
import TrajectoryProfile from "./components/TrajectoryProfile";
import AviationEconomics from "./components/AviationEconomics";
import QuantTelemetryCard from "./components/QuantTelemetryCard";
import AICopilotCard from "./components/AICopilotCard";

const Map = dynamic(() => import("./components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[420px] rounded-3xl glass-deck-panel flex items-center justify-center">
      <div className="flex flex-col items-center text-slate-300 text-xs font-mono">
        <div className="w-10 h-10 border-2 border-transparent border-t-violet-400 border-r-cyan-400 rounded-full animate-spin mb-3"></div>
        <p className="glow-text-violet font-bold tracking-widest">INITIALIZING AEROGLASS TACTICAL RADAR...</p>
      </div>
    </div>
  ),
});

const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
};

const formatUtcTime = (utcStr: string) => {
  if (!utcStr || utcStr === "Unknown" || utcStr === "N/A") return "N/A";
  try {
    let safeStr = utcStr.replace(" ", "T");
    if (!safeStr.endsWith("Z") && !safeStr.includes("+")) safeStr += "Z";
    const d = new Date(safeStr);
    if (isNaN(d.getTime())) return "N/A";
    return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")} UTC`;
  } catch {
    return "N/A";
  }
};

const AIRLINE_NAME_MAP: Record<string, string> = {
  "DAL": "Delta Air Lines", "AAL": "American Airlines", "UAL": "United Airlines", "SWA": "Southwest Airlines",
  "JBU": "JetBlue Airways", "ASA": "Alaska Airlines", "ACA": "Air Canada", "WJA": "WestJet", "TSC": "Air Transat",
  "AMX": "Aeroméxico", "CMP": "Copa Airlines", "AVA": "Avianca", "LAN": "LATAM Airlines", "TAM": "LATAM Brasil",
  "GLO": "GOL Linhas Aéreas", "AZU": "Azul Brazilian Airlines", "ARG": "Aerolíneas Argentinas",
  "BAW": "British Airways", "VIR": "Virgin Atlantic", "EZY": "easyJet", "EJU": "easyJet", "EZS": "easyJet",
  "RYR": "Ryanair", "RUK": "Ryanair", "EIN": "Aer Lingus", "AFR": "Air France", "KLM": "KLM", "KLC": "KLM",
  "TRA": "Transavia", "TVF": "Transavia France", "DLH": "Lufthansa", "CLH": "Lufthansa", "EWG": "Eurowings",
  "CFG": "Condor", "SWR": "SWISS", "AUA": "Austrian Airlines", "BEL": "Brussels Airlines", "IBE": "Iberia",
  "IBS": "Iberia Express", "AEA": "Air Europa", "VLG": "Vueling", "ITY": "ITA Airways", "TAP": "TAP Air Portugal",
  "SAS": "SAS", "FIN": "Finnair", "NAX": "Norwegian", "NSZ": "Norwegian", "ICE": "Icelandair",
  "LOT": "LOT Polish Airlines", "WZZ": "Wizz Air", "WMT": "Wizz Air", "AEE": "Aegean Airlines",
  "THY": "Turkish Airlines", "PGT": "Pegasus Airlines", "BTI": "airBaltic", "EXS": "Jet2",
  "TOM": "TUI Airways", "TFL": "TUI fly", "TUI": "TUI fly", "UAE": "Emirates", "ETD": "Etihad Airways",
  "QTR": "Qatar Airways", "FDB": "flydubai", "ABY": "Air Arabia", "SVA": "Saudia", "OMA": "Oman Air",
  "KAC": "Kuwait Airways", "RJA": "Royal Jordanian", "MEA": "Middle East Airlines", "ELY": "El Al",
  "MSR": "EgyptAir", "RAM": "Royal Air Maroc", "ETH": "Ethiopian Airlines", "KQA": "Kenya Airways",
  "SAA": "South African Airways", "MAU": "Air Mauritius", "SIA": "Singapore Airlines", "TGW": "Scoot",
  "CPA": "Cathay Pacific", "HKE": "HK Express", "ANA": "All Nippon Airways", "JAL": "Japan Airlines",
  "KAL": "Korean Air", "AAR": "Asiana Airlines", "CAL": "China Airlines", "EVA": "EVA Air",
  "SJX": "STARLUX Airlines", "CCA": "Air China", "CSN": "China Southern Airlines", "CES": "China Eastern Airlines",
  "CHH": "Hainan Airlines", "CXA": "XiamenAir", "AIC": "Air India", "IGO": "IndiGo", "MAS": "Malaysia Airlines",
  "AXM": "AirAsia", "XAX": "AirAsia X", "THA": "Thai Airways", "HVN": "Vietnam Airlines", "VJC": "VietJet Air",
  "GIA": "Garuda Indonesia", "PAL": "Philippine Airlines", "CEB": "Cebu Pacific", "QFA": "Qantas",
  "JST": "Jetstar", "VOZ": "Virgin Australia", "ANZ": "Air New Zealand", "FJI": "Fiji Airways",
};

const cleanAirlineLabel = (name?: string, callsign?: string) => {
  const prefix = (callsign || "").slice(0, 3).toUpperCase();
  const stripped = (name || "").replace(/\s*[\(\[][^)\]]*[\)\]]/g, "").trim();
  if (prefix && AIRLINE_NAME_MAP[prefix] && (!stripped || stripped.length <= 3 || stripped.toUpperCase() === prefix)) {
    return AIRLINE_NAME_MAP[prefix];
  }
  if (stripped && stripped.length > 3) return stripped;
  return AIRLINE_NAME_MAP[prefix] || stripped || prefix || "Commercial Carrier";
};

type Language = "EN" | "FR" | "ES";

const TRANSLATIONS: Record<Language, any> = {
  EN: { placeholder: "Enter callsign", scanAirspace: "Scan Airspace", metric: "METRIC", imperial: "IMPERIAL", map: "Map", fuel: "Fuel", trajectory: "Trajectory", economics: "Economics", developedBy: "Developed by Carlos Biddle Miralles", callsign: "Callsign", operator: "Operator", origin: "Origin", destination: "Destination", departure: "Departure", arrival: "Arrival", aircraftType: "Aircraft Type", rangeRemaining: "Range Remaining", transponder: "Transponder", enroute: "ENROUTE", propulsionTitle: "Propulsion & Fuel Burn", engineThrustLabel: "TURBOFAN THRUST (N1)", burnRate: "Burn Rate", hourlyBurn: "Hourly Burn", ecoIndex: "ECO-FLIGHT INDEX", etsLiability: "EU ETS LIABILITY", notFound: "Flight not found. Please ensure the code belongs to an active commercial passenger flight.", cooldown: (t: number) => `Available in ${t}s`, aboutButton: "About" },
  FR: { placeholder: "Saisir un indicatif", scanAirspace: "Scanner le trafic", metric: "MÉTRIQUE", imperial: "IMPÉRIAL", map: "Carte", fuel: "Carburant", trajectory: "Trajectoire", economics: "Économie", developedBy: "Développé par Carlos Biddle Miralles", callsign: "Indicatif", operator: "Compagnie", origin: "Origine", destination: "Destination", departure: "Départ", arrival: "Arrivée", aircraftType: "Modèle", rangeRemaining: "Distance restante", transponder: "Transpondeur", enroute: "EN ROUTE", propulsionTitle: "Propulsion & Consommation", engineThrustLabel: "POUSSÉE TURBORÉACTEUR (N1)", burnRate: "Débit de carburant", hourlyBurn: "Consommation horaire", ecoIndex: "INDICE ÉCO-VOL", etsLiability: "OBLIGATION EU ETS", notFound: "Vol introuvable. Vérifiez que l'indicatif correspond à un vol commercial de passagers en cours.", cooldown: (t: number) => `Disponible dans ${t} s`, aboutButton: "À propos" },
  ES: { placeholder: "Introducir un indicativo", scanAirspace: "Detectar vuelos", metric: "MÉTRICO", imperial: "IMPERIAL", map: "Mapa", fuel: "Combustible", trajectory: "Trayectoria", economics: "Economía", developedBy: "Desarrollado por Carlos Biddle Miralles", callsign: "Indicativo", operator: "Operador", origin: "Origen", destination: "Destino", departure: "Salida", arrival: "Llegada", aircraftType: "Modelo", rangeRemaining: "Alcance restante", transponder: "Transpondedor", enroute: "EN RUTA", propulsionTitle: "Propulsión y Combustible", engineThrustLabel: "EMPUJE TURBOFÁN (N1)", burnRate: "Caudal de combustible", hourlyBurn: "Consumo horario", ecoIndex: "ÍNDICE ECO-VUELO", etsLiability: "PASIVO EU ETS", notFound: "Vuelo no encontrado. Comprueba que el código identifique un vuelo comercial de pasajeros activo.", cooldown: (t: number) => `Disponible en ${t} s`, aboutButton: "Acerca de" },
};

const ABOUT_CONTENT: Record<Language, any> = {
  EN: { badge: "ABOUT SKYQUANT", title: "SkyQuant", p1: "SkyQuant is a real-time quantitative flight intelligence platform developed by Carlos Biddle Miralles.", p2: "Carlos graduated with an MSc in Quantitative Economics from Université Paris Dauphine - PSL in 2026, passionate about aviation and working with data to build innovative systems.", close: "Close" },
  FR: { badge: "À PROPOS DE SKYQUANT", title: "SkyQuant", p1: "SkyQuant est une plateforme d'intelligence de vol quantitative en temps réel développée par Carlos Biddle Miralles.", p2: "Carlos est diplômé d'un Master en Économie Quantitative à l'Université Paris Dauphine - PSL en 2026, passionné par l'aviation et la création de systèmes axés sur les données.", close: "Fermer" },
  ES: { badge: "ACERCA DE SKYQUANT", title: "SkyQuant", p1: "SkyQuant es una plataforma de inteligencia cuantitativa de vuelo en tiempo real desarrollada por Carlos Biddle Miralles.", p2: "Carlos se graduó de un Máster en Economía Cuantitativa en la Université Paris Dauphine - PSL en 2026, apasionado por la aviación y el desarrollo de sistemas basados en datos.", close: "Cerrar" },
};

const CITY_OVERRIDES: Record<string, string> = {
  "YVR": "Vancouver", "YYZ": "Toronto", "YTZ": "Toronto", "YUL": "Montreal", "YYC": "Calgary",
  "YEG": "Edmonton", "YOW": "Ottawa", "YWG": "Winnipeg", "YHZ": "Halifax", "YQB": "Quebec City",
  "JFK": "New York", "LGA": "New York", "EWR": "Newark", "IAD": "Washington D.C.", "DCA": "Washington D.C.",
  "BWI": "Baltimore", "ORD": "Chicago", "MDW": "Chicago", "LAX": "Los Angeles", "BUR": "Los Angeles",
  "SFO": "San Francisco", "OAK": "Oakland", "SJC": "San Jose", "DFW": "Dallas", "DAL": "Dallas",
  "IAH": "Houston", "HOU": "Houston", "MIA": "Miami", "FLL": "Fort Lauderdale", "MCO": "Orlando",
  "TPA": "Tampa", "ATL": "Atlanta", "BOS": "Boston", "DTW": "Detroit", "MSP": "Minneapolis",
  "SEA": "Seattle", "DEN": "Denver", "PHX": "Phoenix", "LAS": "Las Vegas", "SLC": "Salt Lake City",
  "SAN": "San Diego", "PDX": "Portland", "PHL": "Philadelphia", "CLT": "Charlotte", "HNL": "Honolulu",
  "ANC": "Anchorage", "MEX": "Mexico City", "NLU": "Mexico City", "CUN": "Cancún", "GDL": "Guadalajara",
  "MTY": "Monterrey", "PTY": "Panama City", "SJO": "San José", "BOG": "Bogotá", "MDE": "Medellín",
  "LIM": "Lima", "UIO": "Quito", "GYE": "Guayaquil", "SCL": "Santiago", "EZE": "Buenos Aires",
  "AEP": "Buenos Aires", "MVD": "Montevideo", "ASU": "Asunción", "GRU": "São Paulo", "CGH": "São Paulo",
  "VCP": "São Paulo", "GIG": "Rio de Janeiro", "SDU": "Rio de Janeiro", "BSB": "Brasília",
  "LHR": "London", "LGW": "London", "STN": "London", "LTN": "London", "LCY": "London", "SEN": "London",
  "MAN": "Manchester", "BHX": "Birmingham", "EDI": "Edinburgh", "GLA": "Glasgow", "BRS": "Bristol",
  "LPL": "Liverpool", "BFS": "Belfast", "DUB": "Dublin", "CDG": "Paris", "ORY": "Paris", "BVA": "Paris",
  "NCE": "Nice", "LYS": "Lyon", "MRS": "Marseille", "TLS": "Toulouse", "BOD": "Bordeaux", "NTE": "Nantes",
  "BSL": "Basel", "AMS": "Amsterdam", "EIN": "Eindhoven", "RTM": "Rotterdam", "BRU": "Brussels",
  "CRL": "Brussels", "LUX": "Luxembourg", "FRA": "Frankfurt", "HHN": "Frankfurt", "MUC": "Munich",
  "BER": "Berlin", "DUS": "Düsseldorf", "HAM": "Hamburg", "STR": "Stuttgart", "CGN": "Cologne",
  "ZRH": "Zurich", "GVA": "Geneva", "VIE": "Vienna", "MAD": "Madrid", "BCN": "Barcelona",
  "PMI": "Palma de Mallorca", "AGP": "Málaga", "ALC": "Alicante", "VLC": "Valencia", "SVQ": "Seville",
  "BIO": "Bilbao", "TFN": "Tenerife", "TFS": "Tenerife", "LPA": "Gran Canaria", "ACE": "Lanzarote",
  "FUE": "Fuerteventura", "IBZ": "Ibiza", "LIS": "Lisbon", "OPO": "Porto", "FAO": "Faro", "FNC": "Madeira",
  "FCO": "Rome", "CIA": "Rome", "MXP": "Milan", "LIN": "Milan", "BGY": "Milan", "VCE": "Venice",
  "TSF": "Venice", "NAP": "Naples", "BLQ": "Bologna", "FLR": "Florence", "PSA": "Pisa", "CTA": "Catania",
  "PMO": "Palermo", "CPH": "Copenhagen", "BLL": "Billund", "OSL": "Oslo", "BGO": "Bergen",
  "ARN": "Stockholm", "NYO": "Stockholm", "GOT": "Gothenburg", "HEL": "Helsinki", "KEF": "Reykjavik",
  "WAW": "Warsaw", "WMI": "Warsaw", "KRK": "Kraków", "GDN": "Gdańsk", "PRG": "Prague", "BUD": "Budapest",
  "OTP": "Bucharest", "SOF": "Sofia", "BEG": "Belgrade", "ZAG": "Zagreb", "ATH": "Athens",
  "SKG": "Thessaloniki", "HER": "Heraklion", "LCA": "Larnaca", "PFO": "Paphos", "MLA": "Malta",
  "IST": "Istanbul", "SAW": "Istanbul", "AYT": "Antalya", "ESB": "Ankara", "ADB": "Izmir",
  "RIX": "Riga", "TLL": "Tallinn", "VNO": "Vilnius", "DXB": "Dubai", "DWC": "Dubai", "AUH": "Abu Dhabi",
  "SHJ": "Sharjah", "DOH": "Doha", "RUH": "Riyadh", "JED": "Jeddah", "MCT": "Muscat", "KWI": "Kuwait City",
  "BAH": "Bahrain", "AMM": "Amman", "BEY": "Beirut", "TLV": "Tel Aviv", "CAI": "Cairo", "SPX": "Cairo",
  "CMN": "Casablanca", "RAK": "Marrakech", "TUN": "Tunis", "ALG": "Algiers", "ADD": "Addis Ababa",
  "NBO": "Nairobi", "DAR": "Dar es Salaam", "LOS": "Lagos", "ACC": "Accra", "DSS": "Dakar",
  "JNB": "Johannesburg", "CPT": "Cape Town", "DUR": "Durban", "MPM": "Maputo", "MRU": "Mauritius",
  "DEL": "New Delhi", "BOM": "Mumbai", "BLR": "Bengaluru", "MAA": "Chennai", "HYD": "Hyderabad",
  "CCU": "Kolkata", "COK": "Kochi", "AMD": "Ahmedabad", "GOI": "Goa", "CMB": "Colombo", "KTM": "Kathmandu",
  "MLE": "Malé", "SIN": "Singapore", "KUL": "Kuala Lumpur", "PEN": "Penang", "BKK": "Bangkok",
  "DMK": "Bangkok", "HKT": "Phuket", "CNX": "Chiang Mai", "CGK": "Jakarta", "DPS": "Bali", "SUB": "Surabaya",
  "MNL": "Manila", "CEB": "Cebu", "SGN": "Ho Chi Minh City", "HAN": "Hanoi", "DAD": "Da Nang",
  "HKG": "Hong Kong", "MFM": "Macau", "TPE": "Taipei", "PEK": "Beijing", "PKX": "Beijing",
  "PVG": "Shanghai", "SHA": "Shanghai", "CAN": "Guangzhou", "SZX": "Shenzhen", "CTU": "Chengdu",
  "TFU": "Chengdu", "CKG": "Chongqing", "XIY": "Xi'an", "HGH": "Hangzhou", "WUH": "Wuhan", "XMN": "Xiamen",
  "ICN": "Seoul", "GMP": "Seoul", "PUS": "Busan", "NRT": "Tokyo", "HND": "Tokyo", "KIX": "Osaka",
  "ITM": "Osaka", "NGO": "Nagoya", "FUK": "Fukuoka", "CTS": "Sapporo", "OKA": "Okinawa",
  "SYD": "Sydney", "MEL": "Melbourne", "BNE": "Brisbane", "PER": "Perth", "ADL": "Adelaide",
  "OOL": "Gold Coast", "AKL": "Auckland", "WLG": "Wellington", "CHC": "Christchurch", "ZQN": "Queenstown",
  "NAN": "Nadi", "PPT": "Tahiti",
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [callsignInput, setCallsignInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [flightData, setFlightData] = useState<any>(null);
  const [hasError, setHasError] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [cooldownTime, setCooldownTime] = useState(0);
  
  const [viewMode, setViewMode] = useState<"map" | "fuel" | "trajectory" | "economics">("map");
  const [isMetric, setIsMetric] = useState(true);
  const [language, setLanguage] = useState<Language>("EN");
  const t = TRANSLATIONS[language];
  const aboutText = ABOUT_CONTENT[language] || ABOUT_CONTENT.EN;
  const [theme] = useState<"glass">("glass");
  const [showAboutModal, setShowAboutModal] = useState(false);

  useEffect(() => {
    setMounted(true);
    handleScanAirspace();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setShowAboutModal(false); };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldownTime > 0) timer = setInterval(() => setCooldownTime(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldownTime]);

  const [clockString, setClockString] = useState("12:00:00 UTC");
  useEffect(() => {
    const clockInterval = setInterval(() => {
      const now = new Date();
      setClockString(`${now.getUTCHours().toString().padStart(2, "0")}:${now.getUTCMinutes().toString().padStart(2, "0")}:${now.getUTCSeconds().toString().padStart(2, "0")} UTC`);
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const searchFlight = async (searchCallsign: string) => {
    const cleanQuery = searchCallsign.trim().toUpperCase();
    if (!cleanQuery || loading || cooldownTime > 0) return;
    setLoading(true); setHasError(false); setIsLive(true); setCooldownTime(30);

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/flight/${encodeURIComponent(cleanQuery)}`);
      const data = await response.json();
      if (!response.ok) throw new Error();
      setFlightData(data);
      setCallsignInput(data.flight.callsign);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleScanAirspace = async () => {
    if (loading || cooldownTime > 0) return;
    setLoading(true); setHasError(false); setIsLive(true); setCooldownTime(30);
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/random-flight`);
      const data = await res.json();
      if (!res.ok) throw new Error();
      setCallsignInput(data.callsign);
      
      const response = await fetch(`http://127.0.0.1:8000/api/flight/${encodeURIComponent(data.callsign)}`);
      const flightRes = await response.json();
      if (!response.ok) throw new Error();
      setFlightData(flightRes);
    } catch {
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const activeCallsign = flightData?.flight?.callsign;
    if (!isLive || !activeCallsign) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/telemetry/${encodeURIComponent(activeCallsign)}`);
        if (res.ok) {
          const freshData = await res.json();
          setFlightData((prev: any) => prev ? { ...prev, flight: freshData.flight, fuel_metrics: freshData.fuel_metrics } : prev);
        }
      } catch {
        // Silent recovery
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isLive, flightData?.flight?.callsign]);

  if (!mounted) return <main className="min-h-screen w-screen bg-[#020202]" suppressHydrationWarning />;

  const isControlsDisabled = loading || cooldownTime > 0;
  const isGlass = theme === "glass";

  let totalDistance = 5540;
  let distanceFlown = 0;
  let progressScrubber = 0;

  if (flightData && flightData.route.origin_lat) {
    totalDistance = haversineDistance(flightData.route.origin_lat, flightData.route.origin_lng, flightData.route.dest_lat, flightData.route.dest_lng);
    distanceFlown = haversineDistance(flightData.route.origin_lat, flightData.route.origin_lng, flightData.flight.latitude, flightData.flight.longitude);
    progressScrubber = Math.min(1, Math.max(0, distanceFlown / Math.max(1, totalDistance)));
  }
  
  const distanceRemaining = Math.max(0, totalDistance - distanceFlown);
  const progressPercent = Math.round(progressScrubber * 100);

  const engineN1 = flightData ? Math.min(96.5, 70 + (flightData.fuel_metrics.burn_rate_kg_s * 8)).toFixed(1) : "0.0";
  const engineEGT = flightData ? Math.min(820, 400 + (flightData.fuel_metrics.burn_rate_kg_s * 130)).toFixed(0) : "0";

  const safeVelocity = typeof flightData?.flight?.velocity_ms === 'number' && !isNaN(flightData.flight.velocity_ms) ? flightData.flight.velocity_ms : 0;
  const enrichedTelemetry = flightData ? {
    ...flightData.flight,
    altitude: flightData.flight.altitude_m || 0,
    speed: safeVelocity,
    velocity: safeVelocity,
    groundSpeed: safeVelocity
  } : null;

  const originCity = flightData ? (CITY_OVERRIDES[flightData.route.origin_iata] || flightData.route.origin) : "";
  const destCity = flightData ? (CITY_OVERRIDES[flightData.route.dest_iata] || flightData.route.destination) : "";
  const cleanAirline = cleanAirlineLabel(flightData?.route?.airline, flightData?.flight?.callsign);

  return (
    <main className={`min-h-screen w-full overflow-x-hidden overflow-y-auto relative select-none px-3 pt-2 pb-6 lg:px-4 lg:pt-2.5 lg:pb-8 transition-colors duration-700 flex flex-col ${isGlass ? "bg-[#060814] text-slate-100" : "bg-[#0a0f1d] text-slate-100"}`}>
      
      {/* Futuristic Subtle AeroGlass Scrollbar & Next.js Dev Badge Removal */}
      <style dangerouslySetInnerHTML={{ __html: `
        nextjs-portal, #nextjs-build-indicator { display: none !important; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: rgba(6, 8, 20, 0.35); }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(168, 85, 247, 0.35), rgba(34, 211, 238, 0.35));
          border-radius: 9999px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, rgba(168, 85, 247, 0.7), rgba(34, 211, 238, 0.7));
        }
        * { scrollbar-width: thin; scrollbar-color: rgba(168, 85, 247, 0.35) rgba(6, 8, 20, 0.35); }
      ` }} />

      {isGlass && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="aurora-violet w-[750px] h-[750px] -top-64 -left-48 opacity-80" />
          <div className="aurora-indigo w-[680px] h-[680px] top-1/4 -right-40 opacity-70" />
          <div className="aurora-rose w-[550px] h-[550px] top-2/3 -left-32 opacity-50" />
          <div className="aurora-emerald w-[650px] h-[650px] -bottom-48 right-1/4 opacity-60" />
          <div className="aurora-amber w-[450px] h-[450px] top-1/2 left-1/3 opacity-35" />
          <div className="aurora-cyan w-[580px] h-[580px] -bottom-32 -left-20 opacity-55" />
        </div>
      )}

      <div className="relative z-10 flex flex-col flex-1 w-full max-w-[1780px] mx-auto space-y-2.5">
        <header className="px-1 sm:px-2 py-1.5 border-b border-white/[0.08] transition-all duration-300 shrink-0">
          <div className="flex items-stretch justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 shrink-0 pr-3 sm:pr-4 border-r border-white/10">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shrink-0 ${isGlass ? "bg-gradient-to-tr from-violet-600/35 via-fuchsia-500/25 to-cyan-400/25 border border-white/20 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)]" : "bg-cyan-500/20 border border-cyan-400/40 text-cyan-400"}`}>
                <Radar size={22} className={loading ? "animate-spin" : "animate-spin-slow"} />
              </div>
              <div className="flex flex-col justify-center">
                <h1 className={`text-lg font-black tracking-widest font-mono leading-none ${isGlass ? "holo-gradient-text glow-text-white" : "text-white glow-cyan"}`}>SKYQUANT</h1>
                <p className="text-[11px] text-slate-400 font-sans tracking-tight mt-1">{t.developedBy}</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-between gap-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2.5 min-w-0">
                <div className="flex items-center gap-2 min-w-0 flex-1 max-w-lg">
                  <div className="relative flex items-center flex-1 min-w-[160px] max-w-sm">
                    <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder={t.placeholder}
                      value={callsignInput}
                      disabled={isControlsDisabled}
                      onChange={(e) => setCallsignInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchFlight(callsignInput)}
                      className="w-full rounded-xl pl-7 pr-6 py-1 text-xs text-white placeholder-slate-400 font-mono focus:outline-none transition-all glass-deck-card focus:border-violet-400/80 focus:shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50"
                    />
                  </div>
                  <button
                    onClick={handleScanAirspace}
                    disabled={isControlsDisabled}
                    className="flex items-center gap-1.5 px-3.5 py-1 font-bold text-xs rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-white hover:brightness-110 shadow-[0_0_15px_rgba(168,85,247,0.4)] whitespace-nowrap cursor-pointer shrink-0"
                  >
                    <Radar size={13} className={loading ? 'animate-spin' : ''} />
                    <span>{cooldownTime > 0 ? t.cooldown(cooldownTime) : t.scanAirspace}</span>
                  </button>
                </div>
                <div className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold tracking-wider hidden sm:flex items-center gap-1.5 glass-deck-card text-slate-200 shrink-0">
                  <Clock size={12} className="text-amber-400 animate-pulse" />
                  <span>{clockString}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2.5 min-w-0">
                <nav className="flex items-center gap-1 min-w-0 flex-wrap">
                  {[
                    { id: "map", label: t.map, icon: <MapIcon size={13}/>, color: "text-cyan-300" },
                    { id: "fuel", label: t.fuel, icon: <Flame size={13}/>, color: "text-amber-300" },
                    { id: "trajectory", label: t.trajectory, icon: <Layers size={13}/>, color: "text-sky-300" },
                    { id: "economics", label: t.economics, icon: <Leaf size={13}/>, color: "text-emerald-300" }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setViewMode(tab.id as any)}
                      className={`px-3 py-1 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${viewMode === tab.id ? (isGlass ? "glass-pill-active" : "bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm") : "text-slate-400 hover:text-white hover:bg-white/[0.05]"}`}
                    >
                      <div className={viewMode === tab.id ? tab.color : ""}>{tab.icon}</div>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </nav>
                <button onClick={() => setIsMetric(!isMetric)} className="flex items-center p-0.5 rounded-xl text-xs font-mono transition-all border bg-white/[0.04] border-white/10 shrink-0">
                  <span className={`px-2 py-0.5 rounded-lg text-[11px] ${isMetric ? "bg-violet-400/25 text-white font-bold border border-violet-400/40 shadow-sm" : "text-slate-400"}`}>{t.metric}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[11px] ${!isMetric ? "bg-violet-400/25 text-white font-bold border border-violet-400/40 shadow-sm" : "text-slate-400"}`}>{t.imperial}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col justify-between items-end gap-1.5 shrink-0 pl-3 sm:pl-4 border-l border-white/10">
              <div className="flex items-center p-0.5 rounded-xl text-xs font-mono transition-all border bg-white/[0.04] border-white/10">
                {(["EN", "FR", "ES"] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] transition-all ${language === lang ? "bg-violet-400/25 text-white font-bold border border-violet-400/40 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowAboutModal(true)}
                title={t.aboutButton}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-mono transition-all border bg-white/[0.04] border-white/10 text-slate-300 hover:text-white hover:border-violet-400/50 hover:bg-violet-500/10 active:scale-95 shadow-sm group cursor-pointer"
              >
                <Info size={13} className="text-violet-300 group-hover:text-white transition-colors" />
                <span className="text-[11px] font-sans font-medium whitespace-nowrap">{t.aboutButton}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Multi-Language Error Banner (Automatically updates when EN/FR/ES is toggled) */}
        {hasError && (
          <div className="px-4 py-2 bg-rose-500/20 backdrop-blur-md border border-rose-500/40 text-rose-200 text-xs rounded-2xl flex items-center justify-between shadow-xl shrink-0">
            <span>{t.notFound}</span>
            <button onClick={() => setHasError(false)} className="text-rose-400 hover:text-rose-200"><X size={13} /></button>
          </div>
        )}

        {viewMode === "map" && flightData && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 flex-1 items-stretch">
            <div className="lg:col-span-3 flex flex-col justify-between gap-2.5">
                <div className={`p-3 rounded-2xl flex flex-col justify-between transition-all duration-300 ${isGlass ? "glass-deck-panel" : "obsidian-panel rounded-2xl"}`}>
                  <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="group relative w-10 h-10 rounded-xl shrink-0 cursor-help">
                        <div className={`w-full h-full rounded-xl overflow-hidden flex items-center justify-center border ${isGlass ? "border-white/20 bg-white/[0.04]" : "border-slate-700 bg-white/10"}`}>
                          {flightData.route.logo_url ? (
                            <img
                              src={flightData.route.logo_url}
                              alt={cleanAirline}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                            />
                          ) : (
                            <Plane size={18} className="text-violet-300" />
                          )}
                        </div>
                        <div className="pointer-events-none absolute bottom-full mb-1.5 left-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/90 backdrop-blur-md text-[10px] text-white font-mono px-2.5 py-0.5 rounded-md border border-white/15 whitespace-nowrap z-30 shadow-xl">
                          {cleanAirline}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block">{t.callsign}</span>
                        <h2 className="text-base font-extrabold text-white font-mono tracking-tight glow-text-white">{flightData.flight.callsign}</h2>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 font-bold block">{t.enroute}</span>
                    </div>
                  </div>

                  <div className="my-2 py-1.5 px-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-left group relative">
                        <span className="text-2xl font-black font-mono text-white block glow-text-cyan cursor-help" title={`${originCity} (${flightData.route.origin_iata})`}>{flightData.route.origin_iata}</span>
                        <div className="pointer-events-none absolute top-full mt-0.5 left-0 w-max opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/90 backdrop-blur-md text-[10px] text-cyan-300 font-mono px-2 py-0.5 rounded-md border border-cyan-500/30 z-30 shadow-xl">{originCity}</div>
                        <span className="text-xs font-mono text-slate-300 font-medium block mt-0.5">{formatUtcTime(flightData.route.departure_time)}</span>
                      </div>

                      <div className="flex-1 px-4 flex flex-col items-center">
                        <div className="relative w-full flex items-center">
                          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400" style={{ width: `${progressPercent}%` }} />
                          </div>
                          <div className="absolute -top-2.5 text-cyan-300" style={{ left: `calc(${progressPercent}% - 8px)` }}>
                            <Plane size={16} className="rotate-90 text-white drop-shadow-[0_0_8px_#c084fc]" />
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 mt-1.5 whitespace-nowrap">
                          {isMetric
                            ? `${Math.round(distanceFlown).toLocaleString()} / ${Math.round(totalDistance).toLocaleString()} km`
                            : `${Math.round(distanceFlown * 0.539957).toLocaleString()} / ${Math.round(totalDistance * 0.539957).toLocaleString()} nm`
                          } ({progressPercent}%)
                        </span>
                      </div>

                      <div className="text-right group relative">
                        <span className="text-2xl font-black font-mono text-white block glow-text-emerald cursor-help" title={`${destCity} (${flightData.route.dest_iata})`}>{flightData.route.dest_iata}</span>
                        <div className="pointer-events-none absolute top-full mt-0.5 right-0 w-max opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/90 backdrop-blur-md text-[10px] text-emerald-300 font-mono px-2 py-0.5 rounded-md border border-emerald-500/30 z-30 shadow-xl">{destCity}</div>
                        <span className="text-xs font-mono text-emerald-400 font-bold block mt-0.5">{formatUtcTime(flightData.route.arrival_time)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 space-y-1 text-xs font-mono">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">{t.aircraftType}:</span>
                      <span className="font-bold text-white">{flightData.fuel_metrics?.aircraft_type_assumed || "Boeing 777"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">{t.transponder} (ICAO24):</span>
                      <span className="font-bold text-violet-300">{flightData.flight.icao24}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">{t.rangeRemaining}:</span>
                      <span className="font-bold text-sky-300">{isMetric ? `${Math.round(distanceRemaining).toLocaleString()} km` : `${Math.round(distanceRemaining * 0.539957).toLocaleString()} nm`}</span>
                    </div>
                  </div>
                </div>

                <QuantTelemetryCard
                  telemetry={enrichedTelemetry}
                  fuelMetrics={flightData.fuel_metrics}
                  isMetric={isMetric}
                  theme={theme}
                  language={language}
                />
            </div>

            <div className="lg:col-span-6 min-h-[440px] relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
              <Map
                latitude={flightData.flight.latitude}
                longitude={flightData.flight.longitude}
                routeData={{
                  ...flightData.route,
                  origin: originCity,
                  destination: destCity,
                }}
                telemetry={flightData.flight}
                callsign={flightData.flight.callsign}
                theme={theme}
                isMetric={isMetric}
              />
            </div>

            <div className="lg:col-span-3 flex flex-col justify-between gap-2.5">
              <AICopilotCard
                telemetry={flightData.flight}
                route={flightData.route}
                fuelMetrics={flightData.fuel_metrics}
                theme={theme}
                language={language}
              />

              <div className={`p-3 rounded-2xl flex-1 flex flex-col justify-between transition-all duration-300 ${isGlass ? "glass-deck-panel" : "obsidian-panel rounded-2xl"}`}>
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 pb-2 border-b border-white/10">
                  <span className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_#a855f7]" />
                  <span>{t.propulsionTitle}</span>
                </h3>

                <div className={`p-2.5 my-2 rounded-xl border flex items-center justify-between ${isGlass ? "glass-deck-card" : "bg-[#141c2e] border-slate-700"}`}>
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block">{t.engineThrustLabel}</span>
                    <span className="text-lg font-bold font-mono text-violet-300 glow-text-violet block mt-0.5">{engineN1}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-400 block">EXHAUST GAS TEMP</span>
                    <span className="text-sm font-bold font-mono text-amber-300 block mt-0.5">EGT: {engineEGT}°C</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="pt-2 border-t border-white/10 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">{t.burnRate}:</span>
                      <span className="font-extrabold text-amber-300 glow-text-amber text-sm">{isMetric ? `${flightData.fuel_metrics.burn_rate_kg_s.toFixed(2)} kg/s` : `${(flightData.fuel_metrics.burn_rate_kg_s * 2.20462).toFixed(2)} lb/s`}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">{t.hourlyBurn}:</span>
                      <span className="font-bold text-white font-mono">{isMetric ? `${Math.round(flightData.fuel_metrics.burn_rate_kg_hr).toLocaleString()} kg/h` : `${Math.round(flightData.fuel_metrics.burn_rate_kg_hr * 2.20462).toLocaleString()} lb/h`}</span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-rose-400" style={{ width: `${Math.min(100, flightData.fuel_metrics.burn_rate_kg_s * 30)}%` }} />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-slate-400 block font-mono uppercase">{t.ecoIndex}</span>
                      <span className="text-sm font-bold text-emerald-300 glow-text-emerald">
                        {Math.max(72, Math.min(99, 98.4 - flightData.fuel_metrics.burn_rate_kg_s * 2.1)).toFixed(1)} / 100
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 block font-mono uppercase">{t.etsLiability}</span>
                      <span className="text-xs font-bold text-white font-mono">€{(((flightData.fuel_metrics.burn_rate_kg_hr * 3.16) / 1000) * 72.4).toFixed(0)}/h</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode !== "map" && flightData && (
          <div className="flex-1 min-h-[500px]">
            {viewMode === "fuel" && <div className="h-full min-h-[500px]"><FuelStreamgraph telemetry={flightData.flight} fuelMetrics={flightData.fuel_metrics} isMetric={isMetric} theme={theme} /></div>}
            {viewMode === "trajectory" && <div className="h-full min-h-[500px]"><TrajectoryProfile telemetry={flightData.flight} isMetric={isMetric} theme={theme} /></div>}
            {viewMode === "economics" && <div className="h-full min-h-[500px]"><AviationEconomics telemetry={flightData.flight} fuelMetrics={flightData.fuel_metrics} theme={theme} /></div>}
          </div>
        )}
      </div>

      {showAboutModal && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200 select-text"
          onClick={() => setShowAboutModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl p-6 sm:p-7 overflow-hidden shadow-2xl transition-all border glass-deck-panel border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-24 -right-24 w-52 h-52 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

            <button
              onClick={() => setShowAboutModal(false)}
              title={aboutText.close}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-slate-400 hover:text-white transition-all active:scale-95 z-20 cursor-pointer"
            >
              <X size={15} />
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-white/10 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-cyan-400 p-0.5 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.4)] shrink-0">
                <div className="w-full h-full bg-[#060814]/90 rounded-[14px] flex items-center justify-center text-violet-300">
                  <Radar size={18} />
                </div>
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-violet-300 uppercase block">
                  {aboutText.badge}
                </span>
                <h2 className="text-lg font-bold font-mono text-white tracking-tight">
                  {aboutText.title}
                </h2>
              </div>
            </div>

            <div className="py-4 space-y-3.5 text-[13px] text-slate-300 leading-relaxed relative z-10">
              <p>{aboutText.p1}</p>
              <p>{aboutText.p2}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}