"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import the 3D Globe
const Globe = dynamic(() => import("./components/Globe"), { ssr: false });

export default function Home() {
  const [callsign, setCallsign] = useState("");
  const [loading, setLoading] = useState(false);
  const [flightData, setFlightData] = useState<any>(null);
  const [error, setError] = useState("");

  const searchFlight = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setFlightData(null);

    try {
      const response = await fetch(`http://127.0.0.1:8000/api/flight/${callsign}`);
      if (!response.ok) {
        throw new Error("Flight not found in live global airspace.");
      }
      const data = await response.json();
      setFlightData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 font-sans p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="border-b border-slate-800 pb-6">
          <h1 className="text-4xl font-bold text-white tracking-tight">SkyQuant Analytics</h1>
          <p className="text-slate-400 mt-2 text-lg">Enterprise Trajectory & Fuel Optimisation Engine</p>
        </header>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
          <form onSubmit={searchFlight} className="flex gap-4">
            <input
              type="text"
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              placeholder="Enter Flight Callsign (e.g., AFR123, RYR47FF)"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors uppercase"
              required
            />
            <button 
              type="submit" 
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-8 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Scanning Airspace..." : "Analyse Flight"}
            </button>
          </form>
          {error && <p className="text-red-400 mt-4">{error}</p>}
        </section>

        {flightData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
                <h2 className="text-xl font-semibold text-white mb-4 border-b border-slate-800 pb-2">Operational Telemetry</h2>
                <div className="space-y-3">
                  <p><span className="text-slate-400">Callsign:</span> <span className="text-blue-400 font-mono text-lg">{flightData.flight.callsign}</span></p>
                  <p><span className="text-slate-400">ICAO24 Hex:</span> <span className="font-mono">{flightData.flight.icao24}</span></p>
                  <p><span className="text-slate-400">Altitude:</span> {flightData.flight.altitude_m.toLocaleString()} metres</p>
                  <p><span className="text-slate-400">Velocity:</span> {flightData.flight.velocity_ms} m/s</p>
                  <p><span className="text-slate-400">Coordinates:</span> {flightData.flight.latitude.toFixed(4)}, {flightData.flight.longitude.toFixed(4)}</p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl border-l-4 border-l-emerald-500">
                <h2 className="text-xl font-semibold text-white mb-4 border-b border-slate-800 pb-2">OpenAP Fuel Diagnostics</h2>
                <div className="space-y-3">
                  <p><span className="text-slate-400">Aircraft Profile:</span> {flightData.fuel_metrics.aircraft_type_assumed}</p>
                  <p><span className="text-slate-400">Real-Time Burn Rate:</span> <span className="text-emerald-400 font-bold">{flightData.fuel_metrics.burn_rate_kg_s} kg/s</span></p>
                  <p><span className="text-slate-400">Hourly Fuel Consumption:</span> <span className="text-emerald-400 font-bold">{flightData.fuel_metrics.burn_rate_kg_hr.toLocaleString()} kg/hr</span></p>
                  
                  <div className="mt-6 pt-4 border-t border-slate-800">
                    <p className="text-sm text-slate-500">Metrics calculated via TU Delft open-source physics and kinematic models.</p>
                  </div>
                </div>
              </div>
            </div>

            <Globe 
              latitude={flightData.flight.latitude} 
              longitude={flightData.flight.longitude} 
              altitude={flightData.flight.altitude_m} 
            />
          </div>
        )}
      </div>
    </main>
  );
}