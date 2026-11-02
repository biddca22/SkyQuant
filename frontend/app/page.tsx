"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Map as MapIcon, Plane, Clock, Search, Radar, Layers, Leaf, X, Flame, Info,
} from "lucide-react";
import FuelStreamgraph from "./components/FuelStreamgraph";
import TrajectoryProfile from "./components/TrajectoryProfile";
import AviationEconomics from "./components/AviationEconomics";
import QuantTelemetryCard from "./components/QuantTelemetryCard";
import AICopilotCard from "./components/AICopilotCard";

const FlightMap = dynamic(() => import("./components/Map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[420px] rounded-3xl glass-deck-panel flex items-center justify-center">
      <div className="flex flex-col items-center text-slate-300 text-xs font-mono">
        <div className="w-10 h-10 border-2 border-transparent border-t-violet-400 border-r-cyan-400 rounded-full animate-spin mb-3"></div>
        <p className="font-bold tracking-widest text-violet-300">INITIALIZING AEROGLASS TACTICAL RADAR...</p>
      </div>
    </div>
  ),
});

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatUtcTime(utcStr: string) {
  if (!utcStr || utcStr === "Unknown" || utcStr === "N/A" || utcStr === "...") return "N/A";
  try {
    let safeStr = utcStr.replace(" ", "T");
    if (!safeStr.endsWith("Z") && !safeStr.includes("+")) safeStr += "Z";
    const d = new Date(safeStr);
    if (isNaN(d.getTime())) return "N/A";
    return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")} UTC`;
  } catch {
    return "N/A";
  }
}

export const formatNumber = (value: number, language: string, isInteger: boolean = true) => {
  const locale = language === "FR" ? "fr-FR" : language === "ES" ? "es-ES" : "en-US";
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: isInteger ? 0 : 2,
    minimumFractionDigits: isInteger ? 0 : 2,
  }).format(value).replace(/\s/g, " "); 
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

const AIRCRAFT_NAME_MAP: Record<string, string> = {
  "A319": "Airbus A319", "A320": "Airbus A320", "A20N": "Airbus A320neo",
  "A321": "Airbus A321", "A21N": "Airbus A321neo", "A332": "Airbus A330-200",
  "A333": "Airbus A330-300", "A338": "Airbus A330-800neo", "A339": "Airbus A330-900neo", 
  "A359": "Airbus A350-900", "A35K": "Airbus A350-1000", "A388": "Airbus A380-800",
  "B737": "Boeing 737", "B738": "Boeing 737-800", "B38M": "Boeing 737 MAX 8",
  "B739": "Boeing 737-900", "B39M": "Boeing 737 MAX 9", "B752": "Boeing 757-200",
  "B763": "Boeing 767-300", "B764": "Boeing 767-400", "B772": "Boeing 777-200",
  "B77W": "Boeing 777-300ER", "B77L": "Boeing 777F", "B788": "Boeing 787-8 Dreamliner",
  "B789": "Boeing 787-9 Dreamliner", "B78X": "Boeing 787-10 Dreamliner",
  "B744": "Boeing 747-400", "B748": "Boeing 747-8",
  "E170": "Embraer E170", "E175": "Embraer E175", "E190": "Embraer E190",
  "E195": "Embraer E195", "E290": "Embraer E190-E2", "BCS1": "Airbus A220-100", 
  "BCS3": "Airbus A220-300", "AT76": "ATR 72-600", "AT75": "ATR 72-500", 
  "AT45": "ATR 42-500", "CRJ2": "Bombardier CRJ-200", "CRJ7": "Bombardier CRJ-700", 
  "CRJ9": "Bombardier CRJ-900", "DH8D": "De Havilland Dash 8-Q400"
};

function getAircraftFullName(code?: string) {
  if (!code) return "Unknown Aircraft";
  const cleanCode = code.trim().toUpperCase();
  return AIRCRAFT_NAME_MAP[cleanCode] || cleanCode;
}

function cleanAirlineLabel(name?: string, callsign?: string) {
  const prefix = (callsign || "").slice(0, 3).toUpperCase();
  const stripped = (name || "").replace(/\s*[\(\[][^)\]]*[\)\]]/g, "").trim();
  if (prefix && AIRLINE_NAME_MAP[prefix] && (!stripped || stripped.length <= 3 || stripped.toUpperCase() === prefix)) {
    return AIRLINE_NAME_MAP[prefix];
  }
  if (stripped && stripped.length > 3) return stripped;
  return AIRLINE_NAME_MAP[prefix] || stripped || prefix || "Commercial Carrier";
}

type Language = "EN" | "FR" | "ES";

const TRANSLATIONS: Record<Language, any> = {
  EN: { placeholder: "Enter callsign", scanAirspace: "Scan Airspace", metric: "METRIC", imperial: "IMPERIAL", map: "Map", fuel: "Fuel", trajectory: "Trajectory", economics: "Economics", developedBy: "Developed by Carlos Biddle Miralles", callsign: "Callsign", operator: "Operator", origin: "Origin", destination: "Destination", departure: "Departure", arrival: "Arrival", aircraftType: "Aircraft Type", rangeRemaining: "Range Remaining", transponder: "Transponder", enroute: "Enroute", propulsionTitle: "PROPULSION & FUEL BURN", engineThrustLabel: "N1 Speed", burnRate: "Burn Rate", hourlyBurn: "Hourly Burn", ecoIndex: "Eco-Flight Index", etsLiability: "EU ETS Liability", notFound: "Flight not found. Please ensure the code belongs to an active commercial passenger flight.", cooldown: (t: number) => `Available in ${t}s`, aboutButton: "About", gasTemp: "Exhaust Gas Temp" },
  FR: { placeholder: "Saisir un indicatif", scanAirspace: "Scanner le trafic", metric: "MÉTRIQUE", imperial: "IMPÉRIAL", map: "Carte", fuel: "Carburant", trajectory: "Trajectoire", economics: "Économie", developedBy: "Développé par Carlos Biddle Miralles", callsign: "Indicatif", operator: "Compagnie", origin: "Origine", destination: "Destination", departure: "Départ", arrival: "Arrivée", aircraftType: "Modèle", rangeRemaining: "Distance restante", transponder: "Transpondeur", enroute: "En vol", propulsionTitle: "PROPULSION & CONSOMMATION", engineThrustLabel: "Régime N1", burnRate: "Débit de carburant", hourlyBurn: "Consommation horaire", ecoIndex: "Indice Éco-vol", etsLiability: "Obligation EU ETS", notFound: "Vol introuvable. Vérifiez que l'indicatif correspond à un vol commercial de passagers en cours.", cooldown: (t: number) => `Disponible dans ${t} s`, aboutButton: "À propos", gasTemp: "Temp. gaz d'échappement" },
  ES: { placeholder: "Introducir un indicativo", scanAirspace: "Detectar vuelos", metric: "MÉTRICO", imperial: "IMPERIAL", map: "Mapa", fuel: "Combustible", trajectory: "Trayectoria", economics: "Economía", developedBy: "Desarrollado por Carlos Biddle Miralles", callsign: "Indicativo", operator: "Operador", origin: "Origen", destination: "Destino", departure: "Salida", arrival: "Llegada", aircraftType: "Modelo", rangeRemaining: "Distancia restante", transponder: "Transpondedor", enroute: "En vuelo", propulsionTitle: "PROPULSIÓN Y CONSUMO", engineThrustLabel: "Régimen N1", burnRate: "Caudal de combustible", hourlyBurn: "Consumo horario", ecoIndex: "Índice Eco-vuelo", etsLiability: "Pasivo EU ETS", notFound: "Vuelo no encontrado. Comprueba que el código identifique un vuelo comercial de pasajeros activo.", cooldown: (t: number) => `Disponible en ${t} s`, aboutButton: "Acerca de", gasTemp: "Temp. gases de escape" },
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

const INITIAL_PLACEHOLDER_DATA = {
  status: "Initializing",
  flight: {
    icao24: "SCANNING...",
    callsign: "SCANNING",
    longitude: 0,
    latitude: 0,
    altitude_m: 0,
    velocity_ms: 0,
    heading_deg: 0,
  },
  route: {
    origin: "...",
    destination: "...",
    origin_iata: "...",
    dest_iata: "...",
    origin_country: "",
    dest_country: "",
    airline: "Locating Aircraft...",
    logo_url: "",
    departure_time: "...",
    arrival_time: "...",
    origin_lat: null,
    origin_lng: null,
    dest_lat: null,
    dest_lng: null,
  },
  fuel_metrics: {
    burn_rate_kg_s: 0,
    burn_rate_kg_hr: 0,
    aircraft_type_assumed: "...",
  },
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [callsignInput, setCallsignInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [flightData, setFlightData] = useState<any>(null);
  const [nearbyFlights, setNearbyFlights] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number; label?: string }>({
    lat: 40.4168,
    lon: -3.7038,
  });
  const [hasError, setHasError] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [cooldownTime, setCooldownTime] = useState(0);
  const initFetchedRef = useRef(false);

  const [viewMode, setViewMode] = useState<"map" | "fuel" | "trajectory" | "economics">("map");
  const [isMetric, setIsMetric] = useState(true);
  const [language, setLanguage] = useState<Language>("EN");
  const t = TRANSLATIONS[language];
  const aboutText = ABOUT_CONTENT[language] || ABOUT_CONTENT.EN;
  const [theme] = useState<"glass">("glass");
  const [showAboutModal, setShowAboutModal] = useState(false);

  async function loadFlightSilently(targetCallsign: string, candidatesList: any[] = []) {
    const cleanQuery = targetCallsign.trim().toUpperCase();
    if (!cleanQuery) return false;
    setLoading(true);
    setIsLive(true);

    try {
      const response = await fetch(`/api/flight/${encodeURIComponent(cleanQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setFlightData(data);
        setCallsignInput(data.flight.callsign);
        return true;
      }
      for (const item of candidatesList.slice(0, 5)) {
        if (!item?.callsign || item.callsign === cleanQuery) continue;
        const retryRes = await fetch(`/api/flight/${encodeURIComponent(item.callsign)}`);
        if (retryRes.ok) {
          const retryData = await retryRes.json();
          setFlightData(retryData);
          setCallsignInput(retryData.flight.callsign);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMounted(true);
    if (initFetchedRef.current) return;
    initFetchedRef.current = true;

    async function loadRegionalAirspace(lat: number, lon: number, label?: string) {
      setUserLocation({ lat, lon, label });
      try {
        const res = await fetch(`/api/flights/nearby?lat=${lat}&lon=${lon}&radius_km=350`);
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.flights) && data.flights.length > 0) {
          setNearbyFlights(data.flights);
          const initialTarget = data.featured_callsign || data.flights[0].callsign;
          if (initialTarget) {
            await loadFlightSilently(initialTarget, data.flights);
          }
        } else {
          const wideRes = await fetch(`/api/flights/nearby?lat=${lat}&lon=${lon}&radius_km=800`);
          if (wideRes.ok) {
            const wideData = await wideRes.json();
            if (Array.isArray(wideData.flights) && wideData.flights.length > 0) {
              setNearbyFlights(wideData.flights);
              const initialTarget = wideData.featured_callsign || wideData.flights[0].callsign;
              if (initialTarget) {
                await loadFlightSilently(initialTarget, wideData.flights);
              }
            }
          }
        }
      } catch {
      }
    }

    async function detectLocationAndLoad() {
      let resolved = false;
      try {
        const ipRes = await fetch("https://ipapi.co/json/", { cache: "no-store" });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (typeof ipData.latitude === "number" && typeof ipData.longitude === "number") {
            resolved = true;
            await loadRegionalAirspace(ipData.latitude, ipData.longitude, ipData.city);
          }
        }
      } catch {
      }

      if (!resolved) {
        try {
          const ipRes2 = await fetch("https://get.geojs.io/v1/ip/geo.json", { cache: "no-store" });
          if (ipRes2.ok) {
            const ipData2 = await ipRes2.json();
            const lat = parseFloat(ipData2.latitude);
            const lon = parseFloat(ipData2.longitude);
            if (!isNaN(lat) && !isNaN(lon)) {
              resolved = true;
              await loadRegionalAirspace(lat, lon, ipData2.city);
            }
          }
        } catch {
        }
      }

      if (!resolved) {
        await loadRegionalAirspace(40.4168, -3.7038, "Madrid");
      }

      if (typeof navigator !== "undefined" && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            loadRegionalAirspace(pos.coords.latitude, pos.coords.longitude);
          },
          () => {},
          { timeout: 6000, maximumAge: 300000 }
        );
      }
    }

    detectLocationAndLoad();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/flights/nearby?lat=${userLocation.lat}&lon=${userLocation.lon}&radius_km=350`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.flights) && data.flights.length > 0) {
            setNearbyFlights(data.flights);
          }
        }
      } catch {
      }
    }, 25000);
    return () => clearInterval(interval);
  }, [mounted, userLocation.lat, userLocation.lon]);

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

  async function searchFlight(searchCallsign: string) {
    const cleanQuery = searchCallsign.trim().toUpperCase();
    if (!cleanQuery || loading || cooldownTime > 0) return;

    setLoading(true);
    setIsLive(true);
    setCooldownTime(12);

    try {
      const response = await fetch(`/api/flight/${encodeURIComponent(cleanQuery)}`);
      if (!response.ok) return;
      const data = await response.json();
      setFlightData(data);
      setCallsignInput(data.flight.callsign);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  function handleSelectNearbyFlight(selectedCs: string) {
    if (cooldownTime > 0) return;
    searchFlight(selectedCs);
  }

  async function handleScanAirspace() {
    if (loading || cooldownTime > 0) return;
    setLoading(true);
    setIsLive(true);
    setCooldownTime(12);

    try {
      const res = await fetch(`/api/random-flight`);
      if (!res.ok) return;
      const data = await res.json();
      setCallsignInput(data.callsign);

      const response = await fetch(`/api/flight/${encodeURIComponent(data.callsign)}`);
      if (!response.ok) return;
      const flightRes = await response.json();
      setFlightData(flightRes);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const activeCallsign = flightData?.flight?.callsign;
    if (!isLive || !activeCallsign) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/telemetry/${encodeURIComponent(activeCallsign)}`);
        if (res.ok) {
          const freshData = await res.json();
          setFlightData((prev: any) => prev ? { ...prev, flight: freshData.flight, fuel_metrics: freshData.fuel_metrics } : prev);
        }
      } catch {
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isLive, flightData?.flight?.callsign]);

  if (!mounted) return <main className="min-h-screen w-screen bg-[#020202]" suppressHydrationWarning />;

  const activeData = flightData || {
    ...INITIAL_PLACEHOLDER_DATA,
    flight: {
      ...INITIAL_PLACEHOLDER_DATA.flight,
      latitude: userLocation.lat,
      longitude: userLocation.lon,
    },
  };

  const isControlsDisabled = loading || cooldownTime > 0;
  const isGlass = theme === "glass";

  let totalDistance = 1265;
  let distanceFlown = 610;
  let progressScrubber = 0.48;

  if (activeData && activeData.route.origin_lat) {
    totalDistance = haversineDistance(activeData.route.origin_lat, activeData.route.origin_lng, activeData.route.dest_lat, activeData.route.dest_lng);
    distanceFlown = haversineDistance(activeData.route.origin_lat, activeData.route.origin_lng, activeData.flight.latitude, activeData.flight.longitude);
    progressScrubber = Math.min(1, Math.max(0, distanceFlown / Math.max(1, totalDistance)));
  }

  const distanceRemaining = Math.max(0, totalDistance - distanceFlown);
  const progressPercent = Math.round(progressScrubber * 100);

  const engineN1 = activeData ? Math.min(96.5, 70 + (activeData.fuel_metrics.burn_rate_kg_s * 8)).toFixed(1) : "0.0";
  const engineEGT = activeData ? Math.min(820, 400 + (activeData.fuel_metrics.burn_rate_kg_s * 130)).toFixed(0) : "0";

  const safeVelocity = typeof activeData?.flight?.velocity_ms === "number" && !isNaN(activeData.flight.velocity_ms) ? activeData.flight.velocity_ms : 0;
  const enrichedTelemetry = {
    ...activeData.flight,
    altitude: activeData.flight.altitude_m || 0,
    speed: safeVelocity,
    velocity: safeVelocity,
    groundSpeed: safeVelocity,
  };

  const originCity = CITY_OVERRIDES[activeData.route.origin_iata] || activeData.route.origin || "";
  const destCity = CITY_OVERRIDES[activeData.route.dest_iata] || activeData.route.destination || "";
  const cleanAirline = cleanAirlineLabel(activeData?.route?.airline, activeData?.flight?.callsign);
  const activeRouteProp = flightData
    ? {
        ...activeData.route,
        origin: originCity,
        destination: destCity,
      }
    : null;
  const activeCallsignProp = flightData ? activeData.flight.callsign : undefined;
  
  const displayAircraftType = getAircraftFullName(activeData.fuel_metrics?.aircraft_type_assumed || activeData.flight?.aircraft_code);

  return (
    <main className={`min-h-screen w-full overflow-x-hidden overflow-y-auto relative select-none px-3 pt-2 pb-6 lg:px-4 lg:pt-2.5 lg:pb-8 transition-colors duration-700 flex flex-col ${isGlass ? "bg-[#060814] text-slate-100 font-sans" : "bg-[#0a0f1d] text-slate-100 font-sans"}`}>
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
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            
            <div className="flex items-center gap-3 shrink-0 pr-3 sm:pr-4 border-r border-white/10">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all shrink-0 ${isGlass ? "bg-gradient-to-tr from-violet-600/35 via-fuchsia-500/25 to-cyan-400/25 border border-white/20 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)]" : "bg-cyan-500/20 border border-cyan-400/40 text-cyan-400"}`}>
                <Radar size={22} className={loading ? "animate-spin" : "animate-spin-slow"} />
              </div>
              <div className="flex flex-col justify-center">
                <h1 className={`text-lg font-black tracking-widest font-mono leading-none ${isGlass ? "holo-gradient-text glow-text-white" : "text-white glow-cyan"}`}>SKYQUANT</h1>
                <p className="text-[11px] text-slate-400 font-sans tracking-tight mt-1 whitespace-nowrap">{t.developedBy}</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-start gap-1.5 min-w-0">
              <div className="flex items-center gap-2 max-w-[28rem] w-full">
                <div className="relative flex items-center flex-1 min-w-[140px]">
                  <Search size={13} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder={t.placeholder}
                    value={callsignInput}
                    disabled={isControlsDisabled}
                    onChange={(e) => setCallsignInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchFlight(callsignInput)}
                    className="w-full rounded-xl pl-7 pr-6 py-1 text-xs text-white placeholder-slate-400 font-mono focus:outline-none transition-all glass-deck-card focus:border-violet-400/80 focus:shadow-[0_0_15px_rgba(168,85,247,0.3)] disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={handleScanAirspace}
                  disabled={isControlsDisabled}
                  className="flex items-center gap-1.5 px-3.5 py-1 font-bold text-xs rounded-xl transition-all shadow-lg active:scale-95 disabled:opacity-50 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-white hover:brightness-110 shadow-[0_0_15px_rgba(168,85,247,0.4)] whitespace-nowrap cursor-pointer shrink-0"
                >
                  <Radar size={13} className={loading ? "animate-spin" : ""} />
                  <span>{cooldownTime > 0 ? t.cooldown(cooldownTime) : t.scanAirspace}</span>
                </button>
              </div>

              <nav className="flex items-center gap-1 min-w-0 flex-wrap">
                {[
                  { id: "map", label: t.map, icon: <MapIcon size={13} />, color: "text-cyan-300" },
                  { id: "fuel", label: t.fuel, icon: <Flame size={13} />, color: "text-amber-300" },
                  { id: "trajectory", label: t.trajectory, icon: <Layers size={13} />, color: "text-sky-300" },
                  { id: "economics", label: t.economics, icon: <Leaf size={13} />, color: "text-emerald-300" },
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
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1.5 pl-3 sm:pl-4 border-l border-white/10 pt-0.5">
              
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded-lg text-xs font-mono font-bold tracking-wider flex items-center gap-1.5 glass-deck-card text-slate-200">
                  <Clock size={12} className="text-amber-400 animate-pulse" />
                  <span>{clockString}</span>
                </div>
                <button
                  onClick={() => setShowAboutModal(true)}
                  title={t.aboutButton}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-sans font-medium transition-all border bg-white/[0.04] border-white/10 text-slate-300 hover:text-white hover:border-violet-400/50 hover:bg-violet-500/10 active:scale-95 group cursor-pointer"
                >
                  <Info size={13} className="text-violet-300 group-hover:text-white transition-colors" />
                  <span className="whitespace-nowrap">{t.aboutButton}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={() => setIsMetric(!isMetric)} className="flex items-center p-0.5 rounded-xl text-xs font-sans font-medium transition-all border bg-white/[0.04] border-white/10">
                  <span className={`px-2 py-0.5 rounded-lg ${isMetric ? "bg-violet-400/25 text-white font-bold border border-violet-400/40 shadow-sm" : "text-slate-400"}`}>{t.metric}</span>
                  <span className={`px-2 py-0.5 rounded-lg ${!isMetric ? "bg-violet-400/25 text-white font-bold border border-violet-400/40 shadow-sm" : "text-slate-400"}`}>{t.imperial}</span>
                </button>
                <div className="flex items-center p-0.5 rounded-xl text-xs font-mono font-bold transition-all border bg-white/[0.04] border-white/10">
                  {(["EN", "FR", "ES"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`px-2 py-0.5 rounded-lg transition-all ${language === lang ? "bg-violet-400/25 text-white border border-violet-400/40 shadow-sm" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </header>

        {hasError && (
          <div className="px-4 py-2 bg-rose-500/20 backdrop-blur-md border border-rose-500/40 text-rose-200 text-xs rounded-2xl flex items-center justify-between shadow-xl shrink-0">
            <span>{t.notFound}</span>
            <button onClick={() => setHasError(false)} className="text-rose-400 hover:text-rose-200"><X size={13} /></button>
          </div>
        )}

        {viewMode === "map" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 items-stretch">
            
            {/* LEFT PANEL: Flight Route Summary & Quant Telemetry */}
            <div className="lg:col-span-3 flex flex-col justify-between gap-3">
              <div className={`p-4 rounded-2xl flex flex-col justify-between transition-all duration-300 border border-white/10 ${isGlass ? "glass-deck-panel" : "obsidian-panel"}`}>
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="group relative w-11 h-11 rounded-xl shrink-0 cursor-help">
                      <div className={`w-full h-full rounded-xl overflow-hidden flex items-center justify-center border ${isGlass ? "border-white/20 bg-white/[0.04]" : "border-slate-700 bg-white/10"}`}>
                        {activeData.route.logo_url ? (
                          <img
                            src={activeData.route.logo_url}
                            alt={cleanAirline}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLElement).style.display = "none"; }}
                          />
                        ) : (
                          <Plane size={20} className="text-violet-300" />
                        )}
                      </div>
                      <div className="pointer-events-none absolute bottom-full mb-1.5 left-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/90 backdrop-blur-md text-xs text-white font-sans px-2.5 py-1 rounded-md border border-white/15 whitespace-nowrap z-30 shadow-xl">
                        {cleanAirline}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-sans font-medium text-slate-400 block mb-0.5">{t.callsign}</span>
                      <h2 className="text-lg font-extrabold text-white font-mono tracking-tight glow-text-white leading-none uppercase">{activeData.flight.callsign}</h2>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-sans px-2.5 py-1 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/30 font-bold block">{t.enroute}</span>
                  </div>
                </div>

                <div className="my-4 py-2 px-1">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-left group relative w-16">
                      <span className="text-[26px] font-black font-mono text-white block glow-text-cyan cursor-help leading-none" title={`${originCity} (${activeData.route.origin_iata})`}>{activeData.route.origin_iata}</span>
                      <div className="pointer-events-none absolute top-full mt-1 left-0 w-max opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/90 backdrop-blur-md text-[11px] text-cyan-300 font-sans px-2 py-1 rounded-md border border-cyan-500/30 z-30 shadow-xl">{originCity}</div>
                      <span className="text-xs font-mono text-slate-300 font-medium block mt-1">{formatUtcTime(activeData.route.departure_time)}</span>
                    </div>

                    <div className="flex-1 px-3 flex flex-col items-center">
                      <div className="relative w-full flex items-center h-4">
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-400 transition-all duration-1000" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <div className="absolute top-1/2 -translate-y-1/2 text-cyan-300 transition-all duration-1000" style={{ left: `calc(${progressPercent}% - 8px)` }}>
                          <Plane size={16} className="rotate-90 text-white drop-shadow-[0_0_8px_#c084fc]" />
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 mt-1 whitespace-nowrap">
                        {isMetric
                          ? `${formatNumber(distanceFlown, language)} / ${formatNumber(totalDistance, language)} km`
                          : `${formatNumber(distanceFlown * 0.539957, language)} / ${formatNumber(totalDistance * 0.539957, language)} nm`
                        } ({progressPercent}%)
                      </span>
                    </div>

                    <div className="text-right group relative w-16 flex flex-col items-end">
                      <span className="text-[26px] font-black font-mono text-white block glow-text-emerald cursor-help leading-none" title={`${destCity} (${activeData.route.dest_iata})`}>{activeData.route.dest_iata}</span>
                      <div className="pointer-events-none absolute top-full mt-1 right-0 w-max opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/90 backdrop-blur-md text-[11px] text-emerald-300 font-sans px-2 py-1 rounded-md border border-emerald-500/30 z-30 shadow-xl">{destCity}</div>
                      <span className="text-xs font-mono text-emerald-400 font-bold block mt-1">{formatUtcTime(activeData.route.arrival_time)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 space-y-1.5 text-[11px] font-sans">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">{t.aircraftType}:</span>
                    <span className="font-bold text-white text-right break-words pl-2">{displayAircraftType}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">{t.transponder}:</span>
                    <span className="font-mono text-violet-300 uppercase">{activeData.flight.icao24}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-medium">{t.rangeRemaining}:</span>
                    <span className="font-bold text-sky-300 font-mono">
                      {isMetric ? `${formatNumber(distanceRemaining, language)} km` : `${formatNumber(distanceRemaining * 0.539957, language)} nm`}
                    </span>
                  </div>
                </div>
              </div>

              <QuantTelemetryCard
                telemetry={enrichedTelemetry}
                fuelMetrics={activeData.fuel_metrics}
                isMetric={isMetric}
                theme={theme}
                language={language}
              />
            </div>

            {/* CENTRAL PANEL: Main Leaflet Map */}
            <div className="lg:col-span-6 min-h-[440px] relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
              <FlightMap
                latitude={activeData.flight.latitude}
                longitude={activeData.flight.longitude}
                routeData={activeRouteProp}
                telemetry={activeData.flight}
                callsign={activeCallsignProp}
                theme={theme}
                isMetric={isMetric}
                language={language}
                nearbyFlights={nearbyFlights}
                userLocation={userLocation}
                cooldownTime={cooldownTime}
                onSelectFlight={handleSelectNearbyFlight}
              />
            </div>

            {/* RIGHT PANEL: Copilot & Engine Dashboard */}
            <div className="lg:col-span-3 flex flex-col justify-between gap-3">
              <AICopilotCard
                telemetry={activeData.flight}
                route={activeData.route}
                fuelMetrics={activeData.fuel_metrics}
                theme={theme}
                language={language}
              />

              <div className={`p-4 rounded-2xl flex-1 flex flex-col justify-between transition-all duration-300 border border-white/10 ${isGlass ? "glass-deck-panel" : "obsidian-panel"}`}>
                <h3 className="text-xs font-sans font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2 pb-3 border-b border-white/10">
                  <span className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_#a855f7]" />
                  <span>{t.propulsionTitle}</span>
                </h3>

                <div className={`p-3 my-3 rounded-xl border flex items-center justify-between ${isGlass ? "glass-deck-card border-white/10" : "bg-[#141c2e] border-slate-700"}`}>
                  <div>
                    <span className="text-[10px] font-sans font-medium text-slate-400 block mb-0.5">{t.engineThrustLabel}</span>
                    <span className="text-xl font-bold font-mono text-violet-300 glow-text-violet block">{formatNumber(Number(engineN1), language, false)} %</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-sans font-medium text-slate-400 block mb-0.5">{t.gasTemp}</span>
                    <span className="text-base font-bold font-mono text-amber-300 block mt-1">EGT: {engineEGT} °C</span>
                  </div>
                </div>

                <div className="space-y-3 text-[11px] font-sans">
                  <div className="pt-2 border-t border-white/10 space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">{t.burnRate}:</span>
                      <span className="font-extrabold text-amber-300 glow-text-amber text-sm font-mono">
                        {isMetric ? `${formatNumber(activeData.fuel_metrics.burn_rate_kg_s, language, false)} kg/s` : `${formatNumber(activeData.fuel_metrics.burn_rate_kg_s * 2.20462, language, false)} lb/s`}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 font-medium">{t.hourlyBurn}:</span>
                      <span className="font-bold text-white font-mono">
                        {isMetric ? `${formatNumber(activeData.fuel_metrics.burn_rate_kg_hr, language)} kg/h` : `${formatNumber(activeData.fuel_metrics.burn_rate_kg_hr * 2.20462, language)} lb/h`}
                      </span>
                    </div>
                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mt-1">
                      <div className="h-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all duration-700" style={{ width: `${Math.min(100, activeData.fuel_metrics.burn_rate_kg_s * 30)}%` }} />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-sans font-medium mb-1">{t.ecoIndex}</span>
                      <span className="text-[13px] font-bold text-emerald-300 glow-text-emerald font-mono">
                        {formatNumber(Math.max(72, Math.min(99, 98.4 - activeData.fuel_metrics.burn_rate_kg_s * 2.1)), language, false)} / 100
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block font-sans font-medium mb-1">{t.etsLiability}</span>
                      <span className="text-xs font-bold text-white font-mono">€{formatNumber((((activeData.fuel_metrics.burn_rate_kg_hr * 3.16) / 1000) * 72.4), language)}/h</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode !== "map" && (
          <div className="flex-1 min-h-[500px]">
            {viewMode === "fuel" && <div className="h-full min-h-[500px]"><FuelStreamgraph telemetry={activeData.flight} fuelMetrics={activeData.fuel_metrics} isMetric={isMetric} theme={theme} language={language} /></div>}
            {viewMode === "trajectory" && <div className="h-full min-h-[500px]"><TrajectoryProfile telemetry={activeData.flight} isMetric={isMetric} theme={theme} language={language} /></div>}
            {viewMode === "economics" && <div className="h-full min-h-[500px]"><AviationEconomics telemetry={activeData.flight} fuelMetrics={activeData.fuel_metrics} theme={theme} language={language} /></div>}
          </div>
        )}
      </div>

      {/* About Modal */}
      {showAboutModal && (
        <div
          className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-md animate-in fade-in duration-200 select-text"
          onClick={() => setShowAboutModal(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl p-6 sm:p-8 overflow-hidden shadow-2xl transition-all border glass-deck-panel border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_1px_rgba(255,255,255,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-24 -right-24 w-52 h-52 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />

            <button
              onClick={() => setShowAboutModal(false)}
              title={aboutText.close}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.14] border border-white/10 text-slate-400 hover:text-white transition-all active:scale-95 z-20 cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="flex items-center gap-4 pb-5 border-b border-white/10 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-cyan-400 p-0.5 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)] shrink-0">
                <div className="w-full h-full bg-[#060814]/90 rounded-[14px] flex items-center justify-center text-violet-300">
                  <Radar size={22} />
                </div>
              </div>
              <div>
                <span className="text-[10px] font-sans font-bold tracking-widest text-violet-300 uppercase block mb-1">
                  {aboutText.badge}
                </span>
                <h2 className="text-xl font-black font-mono text-white tracking-tight leading-none">
                  {aboutText.title}
                </h2>
              </div>
            </div>

            <div className="py-5 space-y-4 text-sm text-slate-300 leading-relaxed relative z-10 font-sans">
              <p>{aboutText.p1}</p>
              <p>{aboutText.p2}</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}