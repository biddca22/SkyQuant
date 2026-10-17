"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { Fuel, TrendingUp, DollarSign, Gauge } from "lucide-react";

interface FuelProps {
  telemetry: any;
  fuelMetrics: any;
}

export default function FuelStreamgraph({ telemetry, fuelMetrics }: FuelProps) {
  const baseBurn = fuelMetrics?.burn_rate_kg_s || 0.72;

  // Synthesize mission-segment burn layers (Streamgraph)
  const streamData = [
    { seg: "Taxi-Out", thrust: baseBurn * 0.4, drag: baseBurn * 0.1, climb: baseBurn * 0.05, aux: 0.08 },
    { seg: "Climb (FL180)", thrust: baseBurn * 1.5, drag: baseBurn * 0.45, climb: baseBurn * 0.7, aux: 0.1 },
    { seg: "Climb (FL280)", thrust: baseBurn * 1.3, drag: baseBurn * 0.4, climb: baseBurn * 0.5, aux: 0.09 },
    { seg: "TOC (FL350)", thrust: baseBurn * 1.05, drag: baseBurn * 0.35, climb: baseBurn * 0.25, aux: 0.08 },
    { seg: "Cruise Seg 1", thrust: baseBurn * 0.75, drag: baseBurn * 0.25, climb: baseBurn * 0.05, aux: 0.07 },
    { seg: "Step (FL380)", thrust: baseBurn * 0.95, drag: baseBurn * 0.3, climb: baseBurn * 0.2, aux: 0.07 },
    { seg: "Cruise Seg 2", thrust: baseBurn * 0.68, drag: baseBurn * 0.22, climb: baseBurn * 0.03, aux: 0.07 },
    { seg: "Descent (TOD)", thrust: baseBurn * 0.25, drag: baseBurn * 0.15, climb: 0.01, aux: 0.06 },
    { seg: "Approach", thrust: baseBurn * 0.55, drag: baseBurn * 0.2, climb: 0.02, aux: 0.07 },
  ];

  return (
    <div className="w-full h-full bg-[#050507] rounded-2xl border border-[#1a1a1f] p-4 flex flex-col justify-between">
      {/* Streamgraph Section (65% Height) */}
      <div className="h-[64%] w-full flex flex-col">
        <div className="flex justify-between items-center mb-2 px-1">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Mission Fuel Streamgraph</h3>
            <p className="text-[0.65rem] text-gray-500">Continuous multi-spectral decomposition of energy vector burn (kg/s)</p>
          </div>
          <div className="flex gap-3 text-[0.65rem]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400"></span>Net Thrust</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-fuchsia-500"></span>Induced Drag</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-600"></span>Climb Gradient</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-cyan-400"></span>Auxiliary / APU</span>
          </div>
        </div>

        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={streamData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradThrust" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.85}/>
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0.15}/>
                </linearGradient>
                <linearGradient id="gradDrag" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d946ef" stopOpacity={0.85}/>
                  <stop offset="95%" stopColor="#a21caf" stopOpacity={0.15}/>
                </linearGradient>
                <linearGradient id="gradClimb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.85}/>
                  <stop offset="95%" stopColor="#6d28d9" stopOpacity={0.15}/>
                </linearGradient>
                <linearGradient id="gradAux" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.85}/>
                  <stop offset="95%" stopColor="#0891b2" stopOpacity={0.15}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="seg" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: "#0b0b0e", borderColor: "#222", borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="thrust" stackId="1" stroke="#fbbf24" fill="url(#gradThrust)" />
              <Area type="monotone" dataKey="drag" stackId="1" stroke="#e879f9" fill="url(#gradDrag)" />
              <Area type="monotone" dataKey="climb" stackId="1" stroke="#a78bfa" fill="url(#gradClimb)" />
              <Area type="monotone" dataKey="aux" stackId="1" stroke="#22d3ee" fill="url(#gradAux)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* KPI Section (34% Height) */}
      <div className="h-[34%] grid grid-cols-4 gap-2.5 pt-2 border-t border-[#16161b]">
        <div className="bg-[#09090c] border border-[#1a1a22] rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex justify-between items-center text-gray-500">
            <span className="text-[0.65rem] uppercase font-bold tracking-wider">Burn Velocity</span>
            <Fuel size={13} className="text-amber-400" />
          </div>
          <div>
            <p className="text-base font-bold text-white font-mono">{fuelMetrics?.burn_rate_kg_s || 0.72} <span className="text-[0.65rem] text-gray-400">kg/s</span></p>
            <p className="text-[0.60rem] text-emerald-400 mt-0.5">↓ 3.2% vs Base Cruise</p>
          </div>
        </div>

        <div className="bg-[#09090c] border border-[#1a1a22] rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex justify-between items-center text-gray-500">
            <span className="text-[0.65rem] uppercase font-bold tracking-wider">Hourly Mass Yield</span>
            <TrendingUp size={13} className="text-fuchsia-400" />
          </div>
          <div>
            <p className="text-base font-bold text-white font-mono">{fuelMetrics?.burn_rate_kg_hr?.toLocaleString() || "2,592"} <span className="text-[0.65rem] text-gray-400">kg/h</span></p>
            <p className="text-[0.60rem] text-gray-400 mt-0.5">Assumed Profile: {fuelMetrics?.aircraft_type_assumed || "A320"}</p>
          </div>
        </div>

        <div className="bg-[#09090c] border border-[#1a1a22] rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex justify-between items-center text-gray-500">
            <span className="text-[0.65rem] uppercase font-bold tracking-wider">CASM Fuel Direct</span>
            <DollarSign size={13} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-base font-bold text-white font-mono">$0.0384 <span className="text-[0.65rem] text-gray-400">/ ASM</span></p>
            <p className="text-[0.60rem] text-emerald-400 mt-0.5">Jet-A1 Spot: $2.42/gal</p>
          </div>
        </div>

        <div className="bg-[#09090c] border border-[#1a1a22] rounded-xl p-2.5 flex flex-col justify-between">
          <div className="flex justify-between items-center text-gray-500">
            <span className="text-[0.65rem] uppercase font-bold tracking-wider">Specific Range (SAR)</span>
            <Gauge size={13} className="text-violet-400" />
          </div>
          <div>
            <p className="text-base font-bold text-white font-mono">0.184 <span className="text-[0.65rem] text-gray-400">NM/kg</span></p>
            <p className="text-[0.60rem] text-violet-400 mt-0.5">Aerodynamic Optima: 97%</p>
          </div>
        </div>
      </div>
    </div>
  );
}