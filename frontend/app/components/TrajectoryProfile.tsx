"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ArrowUpRight, Compass, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function TrajectoryProfile({ telemetry, isMetric }: { telemetry: any; isMetric: boolean }) {
  const currentAltMeters = telemetry?.altitude_m || 10972;
  const currentAltDisplay = isMetric ? currentAltMeters : currentAltMeters / 0.3048;
  const optAltDisplay = isMetric ? 11500 : 38000;
  
  const profileData = [
    { waypoint: "DEP", actual: 0, optimal: 0 },
    { waypoint: "CLM-1", actual: isMetric ? 5500 : 18000, optimal: isMetric ? 6100 : 20000 },
    { waypoint: "CLM-2", actual: isMetric ? 8800 : 29000, optimal: isMetric ? 9400 : 31000 },
    { waypoint: "TOC", actual: isMetric ? 11000 : 36000, optimal: isMetric ? 11000 : 36000 },
    { waypoint: "CRZ-1", actual: currentAltDisplay, optimal: optAltDisplay },
    { waypoint: "CRZ-2", actual: isMetric ? 11900 : 39000, optimal: isMetric ? 12200 : 40000 },
    { waypoint: "TOD", actual: isMetric ? 11900 : 39000, optimal: isMetric ? 12200 : 40000 },
    { waypoint: "DES", actual: isMetric ? 3600 : 12000, optimal: isMetric ? 3600 : 12000 },
    { waypoint: "ARR", actual: 0, optimal: 0 },
  ];

  const altitudeDelta = optAltDisplay - currentAltDisplay;
  const isSuboptimal = altitudeDelta > (isMetric ? 450 : 1500);

  return (
    <div className="w-full h-full bg-white/[0.02] rounded-2xl p-4 flex flex-col justify-between">
      <div className="h-[62%] flex flex-col">
        <div className="flex justify-between items-center mb-2 px-1">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Vertical Flight Profile</h3>
            <p className="text-[0.65rem] text-gray-500">Cruising altitude vs minimum-burn aerodynamic flight level</p>
          </div>
          <div className="flex items-center gap-3 text-[0.65rem]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-cyan-400"></span> Telemetry</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-blue-600 border-b border-dashed"></span> Step Schedule</span>
          </div>
        </div>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={profileData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#15151c" strokeDasharray="3 3" />
              <XAxis dataKey="waypoint" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} unit={isMetric ? "m" : "ft"} />
              <Tooltip contentStyle={{ backgroundColor: "#0b0b0e", borderColor: "#222", borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="actual" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3, fill: "#22d3ee" }} />
              <Line type="stepAfter" dataKey="optimal" stroke="#2563eb" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="h-[35%] grid grid-cols-3 gap-3 pt-2">
        <div className="bg-white/[0.03] rounded-xl p-3 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
          <div className="flex items-center justify-between text-gray-400 text-[0.70rem]">
            <span className="font-bold uppercase tracking-wider">Efficiency</span>
            {isSuboptimal ? <ShieldAlert size={14} className="text-amber-400" /> : <CheckCircle2 size={14} className="text-emerald-400" />}
          </div>
          <div>
            <p className="text-sm font-bold text-white font-mono">{Math.round(currentAltDisplay).toLocaleString()} <span className="text-gray-500 text-[0.65rem]">vs Opt {Math.round(optAltDisplay).toLocaleString()}</span></p>
            <p className={`text-[0.65rem] mt-0.5 ${isSuboptimal ? "text-amber-400" : "text-emerald-400"}`}>
              {isSuboptimal ? `Low altitude drag penalty active` : "Operating in optimal oceanic corridor"}
            </p>
          </div>
        </div>

        <div className="bg-white/[0.03] rounded-xl p-3 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
          <div className="flex items-center justify-between text-gray-400 text-[0.70rem]">
            <span className="font-bold uppercase tracking-wider">Filed vs Flown</span>
            <Compass size={14} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white font-mono">98.2% <span className="text-gray-500 text-[0.65rem]">Orthodrome</span></p>
            <p className="text-[0.65rem] text-cyan-400 mt-0.5">+14.2 NM lateral tactical routing</p>
          </div>
        </div>

        <div className="bg-white/[0.03] rounded-xl p-3 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
          <div className="flex items-center justify-between text-gray-400 text-[0.70rem]">
            <span className="font-bold uppercase tracking-wider">Cost Index</span>
            <ArrowUpRight size={14} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white font-mono">CI 32 <span className="text-gray-500 text-[0.65rem]">trade-off</span></p>
            <p className="text-[0.65rem] text-gray-400 mt-0.5">Balancing flight-time vs fuel cost</p>
          </div>
        </div>
      </div>
    </div>
  );
}