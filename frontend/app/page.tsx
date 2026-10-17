"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Plane, Hash, Mountain, Gauge, MapPin, Wind, Zap, Timer, Play, Pause, Radar, Layers, Activity, TrendingUp } from "lucide-react";
import FuelStreamgraph from "./components/FuelStreamgraph";
import TrajectoryProfile from "./components/TrajectoryProfile";
import AviationEconomics from "./components/AviationEconomics";

const Map = dynamic(() => import("./components/Map"), { ssr: false });

export default function Home() {
  const [callsign, setCallsign] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [flightData, setFlightData] = useState<any>(null);
  const [error, setError] = useState("");
  const [isLive, setIsLive] = useState(true);
  const [activeTab, setActiveTab] = useState<"map" | "fuel" | "trajectory" | "economics">("map");

  const searchFlight = async (searchCallsign: string) => {
    setLoading(true);
    setError("");
    setIsLive(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/flight/${searchCallsign}`);
      if (!response.ok) throw new Error("Flight not found in live global airspace.");
      const data = await response.json();
      setFlightData(data);
      setCallsign(searchCallsign);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const scanAirspace = async () => {
    setScannerLoading(true);
    setError("");
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/random-flight`);
      if (!res.ok) throw new Error("Airspace scan failed.");
      const data = await res.json();
      setCallsign(data.callsign);
      await searchFlight(data.callsign);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setScannerLoading(false);
    }
  };

  // 10-Second Telemetry Polling (Unlimited FlightRadar24 scraper)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLive && flightData) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`http://127.0.0.1:8000/api/telemetry/${flightData.flight.callsign}`);
          if (res.ok) {
            const freshData = await res.json();
            setFlightData((prev: any) => ({
              ...prev,
              flight: freshData.flight,
              fuel_metrics: freshData.fuel_metrics,
            }));
          }
        } catch (e) {
          console.error("Telemetry sync failed", e);
        }
      }, 10000); // 10 seconds
    }
    return () => clearInterval(interval);
  }, [isLive, flightData]);

  return (
    <main className="h-screen w-screen bg-[#000000] text-gray-300 overflow-hidden flex flex-col p-3 font-sans selection:bg-fuchsia-500/30">
      
      {/* Header Row */}
      <header className="flex justify-between items-center mb-2 px-2 h-14">
        <div className="flex flex-col">
          <h1 className="text-3xl text-white tracking-wide font-brand drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]">
            SkyQuant
          </h1>
          <p className="text-[0.65rem] text-gray-500 tracking-[0.25em] font-brand uppercase">
            DEVELOPED BY CARLOS BIDDLE MIRALLES
          </p>
        </div>

        {/* Prominent High-Visibility Airline Container */}
        {flightData?.route?.logo_url && (
          <div className="h-12 px-4 bg-[#0a0a0c] border border-[#222] rounded-xl flex items-center gap-3 shadow-[0_0_20px_rgba(0,0,0,0.8)]">
            <div className="bg-white/95 px-2 py-1 rounded-md flex items-center justify-center">
              <img 
                src={flightData.route.logo_url} 
                alt="Airline Logo" 
                className="h-6 max-w-[120px] object-contain" 
              />
            </div>
            <span className="text-xs font-bold text-white tracking-wider uppercase font-mono">
              {flightData.route.airline}
            </span>
          </div>
        )}
      </header>

      {/* Main 3-Column Content Body (Fits 100% at 100% zoom) */}
      <div className="flex-1 flex gap-3 min-h-0">
        
        {/* Left Column (Narrower: 20%) */}
        <div className="w-[20%] flex flex-col gap-2.5">
          {/* Search Box */}
          <div className="bg-[#08080a] border border-[#1a1a20] rounded-xl p-3 shadow-lg">
            <form onSubmit={(e) => { e.preventDefault(); searchFlight(callsign); }} className="flex flex-col gap-2.5">
              <input
                type="text"
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="CALLSIGN (E.G., CLX6225)"
                className="w-full bg-[#000000] border border-[#26262e] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors uppercase font-mono"
                required
              />
              <button 
                type="submit" 
                disabled={loading}
                className="bg-[#121216] hover:bg-[#1a1a20] border border-[#2c2c36] text-white text-[0.75rem] font-bold py-1.5 px-3 rounded-lg transition-all tracking-wider disabled:opacity-50"
              >
                {loading ? "SEARCHING..." : "ANALYSE FLIGHT"}
              </button>
            </form>
            {error && <p className="text-red-500 mt-2 text-[0.65rem] uppercase tracking-wider">{error}</p>}
          </div>

          {/* Airspace Scanner */}
          <div className="bg-[#08080a] border border-[#1a1a20] rounded-xl p-4 flex-1 flex flex-col items-center justify-center text-center relative overflow-hidden group shadow-lg">
            <div className="absolute inset-0 bg-fuchsia-600/5 group-hover:bg-fuchsia-600/10 transition-colors"></div>
            <Radar size={40} className={`text-fuchsia-500 mb-3 ${scannerLoading ? 'animate-spin' : ''}`} />
            <h2 className="text-[0.80rem] font-bold text-white tracking-widest uppercase mb-1.5">Live Radar Link</h2>
            <p className="text-[0.68rem] text-gray-500 mb-4 px-2 leading-relaxed">
              Tap into live transponder telemetry to intercept a cruising commercial flight.
            </p>
            <button 
              onClick={scanAirspace} 
              disabled={scannerLoading || loading}
              className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-[0.75rem] font-bold py-2 px-4 rounded-lg transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] disabled:opacity-50 relative z-10 w-full tracking-wider uppercase"
            >
              {scannerLoading ? "SCANNING..." : "SCAN LIVE AIRSPACE"}
            </button>
          </div>
        </div>

        {/* Centre Column: Glassmorphic Tabs + Canvas (Spacious: 51%) */}
        <div className="w-[51%] flex flex-col gap-2">
          
          {/* Glassmorphic Navigation Bar */}
          <div className="flex justify-between items-center bg-[#09090d]/80 backdrop-blur-xl border border-[#1f1f28] rounded-xl px-3 py-1.5 shadow-md">
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => setActiveTab("map")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[0.72rem] font-bold tracking-wider uppercase transition-all ${activeTab === 'map' ? 'bg-fuchsia-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <Layers size={12}/> Map
              </button>
              <button 
                onClick={() => setActiveTab("fuel")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[0.72rem] font-bold tracking-wider uppercase transition-all ${activeTab === 'fuel' ? 'bg-fuchsia-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <Activity size={12}/> Fuel Dynamics
              </button>
              <button 
                onClick={() => setActiveTab("trajectory")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[0.72rem] font-bold tracking-wider uppercase transition-all ${activeTab === 'trajectory' ? 'bg-fuchsia-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <TrendingUp size={12}/> Trajectory Profile
              </button>
              <button 
                onClick={() => setActiveTab("economics")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[0.72rem] font-bold tracking-wider uppercase transition-all ${activeTab === 'economics' ? 'bg-fuchsia-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.4)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
              >
                <Zap size={12}/> Economics & ESG
              </button>
            </div>

            {flightData && (
              <span className="text-[0.65rem] font-mono text-fuchsia-400 border border-fuchsia-500/20 px-2 py-0.5 rounded-md bg-fuchsia-500/5">
                {flightData.flight.callsign} • LIVE
              </span>
            )}
          </div>

          {/* Central Interactive Panel */}
          <div className="flex-1 rounded-2xl relative overflow-hidden flex flex-col min-h-0">
            {flightData ? (
              <>
                {activeTab === "map" && (
                  <>
                    <Map latitude={flightData.flight.latitude} longitude={flightData.flight.longitude} routeData={flightData.route} />
                    <button 
                      onClick={() => setIsLive(!isLive)}
                      className={`absolute bottom-3 left-3 z-[400] flex items-center gap-1.5 px-3 py-1 rounded-full text-[0.68rem] font-bold tracking-wider uppercase backdrop-blur-md border transition-all ${isLive ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20' : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20'}`}
                    >
                      {isLive ? <><Play size={10} className="animate-pulse"/> Live Radar</> : <><Pause size={10} /> Paused</>}
                    </button>
                  </>
                )}

                {activeTab === "fuel" && (
                  <FuelStreamgraph telemetry={flightData.flight} fuelMetrics={flightData.fuel_metrics} />
                )}

                {activeTab === "trajectory" && (
                  <TrajectoryProfile telemetry={flightData.flight} routeData={flightData.route} />
                )}

                {activeTab === "economics" && (
                  <AviationEconomics telemetry={flightData.flight} fuelMetrics={flightData.fuel_metrics} />
                )}
              </>
            ) : (
              <div className="flex-1 bg-[#050507] border border-[#1a1a20] rounded-2xl flex items-center justify-center text-gray-600 text-[0.75rem] uppercase tracking-widest">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 border border-[#222] border-t-fuchsia-500 rounded-full animate-spin mb-3"></div>
                  <p>Awaiting Radar Intercept</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 3 Cards Perfectly Fitted Vertically (Wider: 29%) */}
        <div className="w-[29%] flex flex-col gap-2.5 overflow-hidden">
          {flightData && (
            <>
              {/* Telemetry Card */}
              <div className="bg-[#08080a] border border-[#1a1a20] rounded-xl p-2.5 flex-1 flex flex-col justify-between shadow-lg">
                <h2 className="text-[0.72rem] font-bold text-white tracking-widest uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 animate-pulse"></span> Live Telemetry
                </h2>
                <div className="space-y-1">
                  <DataRow icon={<Plane size={11}/>} iconColor="text-fuchsia-400" label="Callsign" value={flightData.flight.callsign} />
                  <DataRow icon={<Hash size={11}/>} iconColor="text-gray-400" label="ICAO24 Hex" value={flightData.flight.icao24} />
                  <DataRow icon={<Mountain size={11}/>} iconColor="text-blue-400" label="Altitude" value={`${flightData.flight.altitude_m.toLocaleString()} m`} />
                  <DataRow icon={<Gauge size={11}/>} iconColor="text-emerald-400" label="Velocity" value={`${flightData.flight.velocity_ms.toFixed(1)} m/s`} />
                  <DataRow icon={<MapPin size={11}/>} iconColor="text-orange-400" label="Coordinates" value={`${flightData.flight.latitude.toFixed(3)}, ${flightData.flight.longitude.toFixed(3)}`} />
                </div>
              </div>

              {/* Route Card (Spacious width prevents airport name clipping) */}
              <div className="bg-[#08080a] border border-[#1a1a20] rounded-xl p-2.5 flex-1 flex flex-col justify-between shadow-lg">
                <h2 className="text-[0.72rem] font-bold text-white tracking-widest uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Route Matrix
                </h2>
                <div className="space-y-1">
                  <DataRow icon={<MapPin size={11}/>} iconColor="text-blue-400" label="Origin" value={flightData.route.origin} />
                  <DataRow icon={<MapPin size={11}/>} iconColor="text-emerald-400" label="Destination" value={flightData.route.destination} />
                  <DataRow icon={<Plane size={11}/>} iconColor="text-violet-400" label="Operator" value={flightData.route.airline} />
                  <DataRow icon={<Timer size={11}/>} iconColor="text-gray-400" label="Dep (UTC)" value={flightData.route.departure_time.split(" ")[1] || "Unknown"} />
                </div>
              </div>

              {/* OpenAP Physics Card */}
              <div className="bg-[#08080a] border border-[#1a1a20] rounded-xl p-2.5 flex-1 flex flex-col justify-between shadow-lg">
                <h2 className="text-[0.72rem] font-bold text-white tracking-widest uppercase flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span> OpenAP Physics
                </h2>
                <div className="space-y-1">
                  <DataRow icon={<Plane size={11}/>} iconColor="text-cyan-400" label="Profile" value={flightData.fuel_metrics.aircraft_type_assumed} />
                  <DataRow icon={<Zap size={11}/>} iconColor="text-yellow-400" label="Burn Rate" value={`${flightData.fuel_metrics.burn_rate_kg_s} kg/s`} />
                  <DataRow icon={<Wind size={11}/>} iconColor="text-red-400" label="Hourly Yield" value={`${flightData.fuel_metrics.burn_rate_kg_hr.toLocaleString()} kg/h`} />
                </div>
              </div>
            </>
          )}
        </div>

      </div>
    </main>
  );
}

function DataRow({ icon, iconColor, label, value }: { icon: any; iconColor: string; label: string; value: string }) {
  return (
    <div className="flex justify-between items-center bg-[#0d0d10] px-2.5 py-1 rounded-md border border-[#191920]">
      <div className="flex items-center gap-2 min-w-0">
        <div className={`p-0.5 rounded ${iconColor}`}>{icon}</div>
        <span className="text-gray-400 text-[0.68rem]">{label}</span>
      </div>
      <span className="text-white font-mono text-[0.72rem] truncate pl-2 max-w-[62%] text-right font-medium">
        {value}
      </span>
    </div>
  );
}