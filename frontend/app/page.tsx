"use client";

import { useState, useEffect } from "react";
import { 
  Plane, Hash, Mountain, Gauge, MapPin, Wind, Zap, 
  Timer, Clock, Radio, Globe, Play, Pause, Search, 
  Radar, PlaneTakeoff, PlaneLanding 
} from "lucide-react";
import Map from "./components/Map";
import FuelStreamgraph from "./components/FuelStreamgraph";
import TrajectoryProfile from "./components/TrajectoryProfile";
import AviationEconomics from "./components/AviationEconomics";

const formatLocalTime = (utcStr: string) => {
  if (!utcStr || utcStr === "Unknown" || utcStr === "N/A") return "N/A";
  try {
    let safeStr = utcStr.replace(" ", "T");
    if (!safeStr.endsWith("Z") && !safeStr.includes("+")) safeStr += "Z";
    const d = new Date(safeStr);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return "N/A";
  }
};

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [callsign, setCallsign] = useState("");
  const [loading, setLoading] = useState(false);
  const [flightData, setFlightData] = useState<any>(null);
  const [error, setError] = useState("");
  const [isLive, setIsLive] = useState(true);
  const [activeTab, setActiveTab] = useState<"map" | "fuel" | "trajectory" | "economics">("map");
  const [isMetric, setIsMetric] = useState(true);
  const [cooldownTime, setCooldownTime] = useState(0);

  // Prevents SSR Hydration mismatches caused by browser extensions
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldownTime > 0) {
      timer = setInterval(() => setCooldownTime(prev => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldownTime]);

  const searchFlight = async (searchCallsign: string) => {
    if (!searchCallsign.trim() || cooldownTime > 0) return;
    
    setLoading(true); setError(""); setIsLive(true);
    setCooldownTime(30);
    
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/flight/${searchCallsign}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Flight not located.");
      setFlightData(data);
      setCallsign(searchCallsign);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const scanAirspace = async () => {
    if (cooldownTime > 0) return;
    
    setLoading(true); setError(""); 
    setCooldownTime(30);
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/random-flight`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Scanner unavailable.");
      setCallsign(data.callsign);
      
      const response = await fetch(`http://127.0.0.1:8000/api/flight/${data.callsign}`);
      const flightRes = await response.json();
      if (!response.ok) throw new Error(flightRes.detail || "Flight not located.");
      setFlightData(flightRes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive && flightData) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://127.0.0.1:8000/api/telemetry/${flightData.flight.callsign}`);
          if (res.ok) {
            const freshData = await res.json();
            setFlightData((prev: any) => ({ ...prev, flight: freshData.flight, fuel_metrics: freshData.fuel_metrics }));
          }
        } catch (e) {
          console.error("Telemetry sync failed", e);
        }
      }, 10000); 
    }
    return () => clearInterval(interval);
  }, [isLive, flightData]);

  if (!mounted) {
    return <main className="h-screen w-screen bg-[#020202]" suppressHydrationWarning />;
  }

  const isControlsDisabled = loading || cooldownTime > 0;

  return (
    <main className="h-screen w-screen bg-[#020202] text-gray-300 overflow-hidden flex flex-col px-6 py-4 font-sans selection:bg-cyan-500/30 relative">
      
      <div className="fixed top-[-10%] left-[20%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] right-[20%] w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-[150px] pointer-events-none z-0"></div>

      <div className="flex-1 flex gap-6 min-h-0 relative z-10">
        
        <div className="w-[18%] flex flex-col gap-5 pt-2">
          <div className="flex flex-col items-stretch w-max mb-3">
            <h1 className="text-[3rem] text-white font-iceberg leading-none tracking-wide m-0 p-0 drop-shadow-md pb-2">
              SkyQuant
            </h1>
            <div className="flex justify-between w-full text-[0.60rem] text-gray-400 px-0.5 tracking-widest" style={{ fontFamily: "'Century Schoolbook', Georgia, serif" }}>
              <span>Developed</span><span>by</span><span>Carlos</span><span>Biddle</span><span>Miralles</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <form onSubmit={(e) => { e.preventDefault(); searchFlight(callsign); }} className="flex flex-col gap-3">
              <input
                type="text"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="Callsign..."
                disabled={isControlsDisabled}
                className="w-full bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-2.5 text-[0.80rem] text-white focus:outline-none focus:bg-white/[0.06] transition-colors uppercase font-mono disabled:opacity-50"
                required
              />
              <button 
                type="submit" 
                disabled={isControlsDisabled} 
                className="bg-blue-600 hover:bg-blue-500 text-white text-[0.75rem] font-bold py-2.5 px-4 rounded-xl transition-all tracking-wider disabled:opacity-50 flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(37,99,235,0.3)] disabled:shadow-none"
              >
                {loading ? "SEARCHING..." : cooldownTime > 0 ? `API RECHARGING (${cooldownTime}s)` : <><Search size={14} /> Analyse Flight</>}
              </button>
            </form>
            {error && <p className="text-red-400 bg-red-400/10 px-3 py-2 rounded-lg mt-1 text-[0.60rem] uppercase tracking-wider">{error}</p>}
          </div>

          <div className="flex flex-col gap-2 w-full mt-2">
            <button 
              onClick={scanAirspace} 
              disabled={isControlsDisabled} 
              className="group flex items-center justify-center gap-3 w-full bg-transparent border border-cyan-600/40 hover:border-cyan-400 hover:bg-cyan-500/10 py-3 rounded-xl transition-all disabled:opacity-30 disabled:hover:border-cyan-600/40 disabled:hover:bg-transparent shadow-[0_0_10px_rgba(6,182,212,0.1)] disabled:shadow-none"
            >
              <Radar size={18} className={`text-cyan-400 opacity-90 group-hover:opacity-100 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-[0.70rem] font-bold text-cyan-300 tracking-wider">
                {loading ? "LOCKING ON..." : cooldownTime > 0 ? `SYSTEM COOLING (${cooldownTime}s)` : "Discover Live Flight"}
              </span>
            </button>
          </div>
        </div>

        <div className="w-[52%] flex flex-col">
          <div className="flex items-center justify-center gap-10 px-8 py-3.5 mb-2 bg-transparent">
            {[{ id: "map", label: "Map" }, { id: "fuel", label: "Fuel Dynamics" }, { id: "trajectory", label: "Trajectory" }, { id: "economics", label: "Economics & ESG" }].map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`relative text-[0.70rem] font-bold tracking-[0.15em] uppercase transition-all duration-300 ${activeTab === tab.id ? 'text-white' : 'text-gray-600 hover:text-gray-400'}`}>
                {tab.label}
                {activeTab === tab.id && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-[2px] bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>}
              </button>
            ))}
          </div>

          <div className="flex-1 rounded-2xl relative overflow-hidden flex flex-col min-h-0 bg-transparent border border-white/[0.05] shadow-2xl">
            {flightData ? (
              <>
                {activeTab === "map" && (
                  <>
                    <Map latitude={flightData.flight.latitude} longitude={flightData.flight.longitude} routeData={flightData.route} />
                    <button onClick={() => setIsLive(!isLive)} className={`absolute bottom-4 left-4 z-[400] flex items-center gap-2 px-4 py-1.5 rounded-full text-[0.65rem] font-bold tracking-wider uppercase backdrop-blur-xl transition-all shadow-lg border border-white/5 ${isLive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {isLive ? <><Play size={10} className="animate-pulse"/> Live</> : <><Pause size={10} /> Paused</>}
                    </button>
                  </>
                )}
                {activeTab === "fuel" && <FuelStreamgraph telemetry={flightData.flight} fuelMetrics={flightData.fuel_metrics} />}
                {activeTab === "trajectory" && <TrajectoryProfile telemetry={flightData.flight} isMetric={isMetric} />}
                {activeTab === "economics" && <AviationEconomics telemetry={flightData.flight} fuelMetrics={flightData.fuel_metrics} />}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-700 text-[0.70rem] uppercase tracking-widest">
                <div className="flex flex-col items-center">
                  <div className="w-6 h-6 border-2 border-transparent border-t-cyan-600 rounded-full animate-spin mb-3"></div>
                  <p>AWAITING INTERCEPT</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-[30%] flex flex-col gap-3 overflow-hidden pt-2">
          <div className="flex items-center justify-end gap-5 h-16 w-full pr-1 mb-2">
            <div className="flex flex-col gap-2">
              <button className="bg-transparent border border-white/10 hover:border-white/20 text-cyan-400 text-[0.55rem] font-bold px-3 py-1 rounded-full transition-all uppercase tracking-widest text-center">EN / FR / ES</button>
              <button onClick={() => setIsMetric(!isMetric)} className="bg-transparent border border-white/10 hover:border-white/20 text-[0.55rem] font-bold px-3 py-1 rounded-full transition-all uppercase tracking-widest flex items-center justify-between gap-2">
                <span className={isMetric ? "text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]" : "text-gray-600"}>METRIC</span> 
                <span className={!isMetric ? "text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]" : "text-gray-600"}>IMPERIAL</span>
              </button>
            </div>
            {flightData?.route?.logo_url ? (
              <div className="flex justify-center items-center bg-white/[0.02] backdrop-blur-xl px-4 py-2 rounded-xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.5)] h-[46px] w-[140px]">
                <img src={flightData.route.logo_url} alt="Airline Logo" className="h-full w-full object-contain drop-shadow-md opacity-90" />
              </div>
            ) : <div className="h-[46px] w-[140px]"></div>}
          </div>

          {flightData && (
            <div className="flex-1 flex flex-col justify-between pb-2 pr-1">
              <div className="flex-1 flex flex-col justify-center">
                <h2 className="text-[0.60rem] font-bold text-gray-600 tracking-widest uppercase mb-1 flex items-center gap-2 pl-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span> Telemetry
                </h2>
                <div className="space-y-1.5">
                  <DataRow icon={<Radio size={13}/>} iconColor="text-cyan-400" label="Callsign" value={flightData.flight.callsign} />
                  <DataRow icon={<Hash size={13}/>} iconColor="text-purple-400" label="ICAO24" value={flightData.flight.icao24} />
                  <DataRow icon={<Mountain size={13}/>} iconColor="text-sky-400" label="Altitude" value={isMetric ? `${Math.round(flightData.flight.altitude_m).toLocaleString()} m` : `${Math.round(flightData.flight.altitude_m / 0.3048).toLocaleString()} ft`} />
                  <DataRow icon={<Gauge size={13}/>} iconColor="text-teal-400" label="Velocity" value={isMetric ? `${flightData.flight.velocity_ms.toFixed(1)} m/s` : `${(flightData.flight.velocity_ms * 1.94384).toFixed(1)} kts`} />
                  <DataRow icon={<MapPin size={13}/>} iconColor="text-rose-400" label="Location" value={`${flightData.flight.latitude.toFixed(2)}, ${flightData.flight.longitude.toFixed(2)}`} />
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center border-t border-white/[0.05] pt-1 mt-2">
                <h2 className="text-[0.60rem] font-bold text-gray-600 tracking-widest uppercase mb-1 flex items-center gap-2 pl-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span> Routing
                </h2>
                <div className="space-y-1.5">
                  <RouteRow label="Origin" iata={flightData.route.origin_iata} location={flightData.route.origin} icon={<PlaneTakeoff size={13}/>} color="text-blue-500" />
                  <RouteRow label="Destination" iata={flightData.route.dest_iata} location={flightData.route.destination} icon={<PlaneLanding size={13}/>} color="text-emerald-500" />
                  <DataRow icon={<Globe size={13}/>} iconColor="text-indigo-400" label="Operator" value={flightData.route.airline} />
                  <DataRow icon={<Timer size={13}/>} iconColor="text-amber-400" label="Departure" value={formatLocalTime(flightData.route.departure_time)} />
                  <DataRow icon={<Clock size={13}/>} iconColor="text-orange-400" label="Arrival" value={formatLocalTime(flightData.route.arrival_time)} />
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center border-t border-white/[0.05] pt-1 mt-2">
                <h2 className="text-[0.60rem] font-bold text-gray-600 tracking-widest uppercase mb-1 flex items-center gap-2 pl-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></span> Physics
                </h2>
                <div className="space-y-1.5">
                  <DataRow icon={<Plane size={13}/>} iconColor="text-violet-400" label="Profile" value={flightData.fuel_metrics.aircraft_type_assumed} />
                  <DataRow icon={<Zap size={13}/>} iconColor="text-yellow-400" label="Burn" value={isMetric ? `${flightData.fuel_metrics.burn_rate_kg_s} kg/s` : `${(flightData.fuel_metrics.burn_rate_kg_s * 2.20462).toFixed(2)} lb/s`} />
                  <DataRow icon={<Wind size={13}/>} iconColor="text-cyan-300" label="Yield" value={isMetric ? `${flightData.fuel_metrics.burn_rate_kg_hr.toLocaleString()} kg/h` : `${Math.round(flightData.fuel_metrics.burn_rate_kg_hr * 2.20462).toLocaleString()} lb/h`} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function DataRow({ icon, iconColor, label, value }: { icon: any; iconColor: string; label: string; value: string }) {
  return (
    <div className="flex justify-between items-center px-2 py-0.5">
      <div className="flex items-center gap-3">
        <div className={iconColor}>{icon}</div>
        <span className="text-gray-500 text-[0.60rem] uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-white font-mono text-[0.70rem] font-medium tracking-wide truncate pl-2 max-w-[55%] text-right">{value}</span>
    </div>
  );
}

function RouteRow({ label, iata, location, icon, color }: { label: string, iata: string, location: string, icon: any, color: string }) {
  return (
    <div className="flex justify-between items-center px-2 py-0.5">
      <div className="flex items-center gap-3">
        <div className={color}>{icon}</div>
        <span className="text-gray-500 text-[0.60rem] uppercase tracking-widest">{label}</span>
      </div>
      <div className="flex items-center justify-end gap-2 w-[60%]">
        <span className="text-white text-[0.70rem] font-medium truncate shrink">{location}</span>
        <span className="text-gray-500 font-mono text-[0.65rem] shrink-0">{iata}</span>
      </div>
    </div>
  );
}