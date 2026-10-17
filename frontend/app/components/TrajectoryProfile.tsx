"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ArrowUpRight, Compass, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function TrajectoryProfile({ telemetry, routeData }: { telemetry: any; routeData: any }) {
  const currentAlt = Math.round((telemetry?.altitude_m || 10972) / 0.3048); // meters to feet

  const profileData = [
    { waypoint: "DEP", actual: 0, optimal: 0 },
    { waypoint: "CLM-1", actual: 18000, optimal: 20000 },
    { waypoint: "CLM-2", actual: 29000, optimal: 31000 },
    { waypoint: "TOC", actual: 36000, optimal: 36000 },
    { waypoint: "CRZ-1", actual: currentAlt, optimal: 38000 },
    { waypoint: "CRZ-2", actual: 39000, optimal: 40000 },
    { waypoint: "TOD", actual: 39000, optimal: 40000 },
    { waypoint: "DES", actual: 12000, optimal: 12000 },
    { waypoint: "ARR", actual: 0, optimal: 0 },
  ];

  const altitudeDelta = 38000 - currentAlt;
  const isSuboptimal = altitudeDelta > 1500;

  return (
    <div className="w-full h-full bg-[#050507] rounded-2xl border border-[#1a1a1f] p-4 flex flex-col justify-between">
      {/* Upper Chart: Altitude vs Step Climb */}
      <div className="h-[62%] flex flex-col">
        <div className="flex justify-between items-center mb-2 px-1">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">Vertical Flight Profile & Step-Climb</h3>
            <p className="text-[0.65rem] text-gray-500">Live cruising altitude compared to minimum-burn aerodynamic flight level</p>
          </div>
          <div className="flex items-center gap-3 text-[0.65rem]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-cyan-400"></span> Flown Telemetry</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-0.5 bg-fuchsia-400 border-b border-dashed"></span> Optimal Step Schedule</span>
          </div>
        </div>

        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={profileData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#15151c" strokeDasharray="3 3" />
              <XAxis dataKey="waypoint" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 45000]} tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} unit=" ft" />
              <Tooltip contentStyle={{ backgroundColor: "#0b0b0e", borderColor: "#222", borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="actual" stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3, fill: "#22d3ee" }} />
              <Line type="stepAfter" dataKey="optimal" stroke="#e879f9" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lower Analytics Section */}
      <div className="h-[35%] grid grid-cols-3 gap-3 pt-2 border-t border-[#16161b]">
        {/* Metric 1 */}
        <div className="bg-[#09090c] border border-[#1a1a22] rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-[0.70rem]">
            <span className="font-bold uppercase tracking-wider">Step-Climb Efficiency</span>
            {isSuboptimal ? <ShieldAlert size={14} className="text-amber-400" /> : <CheckCircle2 size={14} className="text-emerald-400" />}
          </div>
          <div>
            <p className="text-sm font-bold text-white font-mono">
              FL{Math.round(currentAlt / 100)} <span className="text-gray-500 text-[0.65rem]">vs Opt FL380</span>
            </p>
            <p className={`text-[0.65rem] mt-0.5 ${isSuboptimal ? "text-amber-400" : "text-emerald-400"}`}>
              {isSuboptimal ? `+${(altitudeDelta * 0.045).toFixed(1)} kg/h low-alt drag penalty` : "Operating in optimal oceanic corridor"}
            </p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#09090c] border border-[#1a1a22] rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-[0.70rem]">
            <span className="font-bold uppercase tracking-wider">Filed vs Flown Track</span>
            <Compass size={14} className="text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white font-mono">98.2% <span className="text-gray-500 text-[0.65rem]">Great Circle Orthodrome</span></p>
            <p className="text-[0.65rem] text-cyan-400 mt-0.5">+14.2 NM lateral jetstream tactical routing</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#09090c] border border-[#1a1a22] rounded-xl p-3 flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-400 text-[0.70rem]">
            <span className="font-bold uppercase tracking-wider">Cost Index Optimisation</span>
            <ArrowUpRight size={14} className="text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white font-mono">CI 32 <span className="text-gray-500 text-[0.65rem]">kg/min trade-off</span></p>
            <p className="text-[0.65rem] text-gray-400 mt-0.5">Balancing crew flight-time vs kerosene cost</p>
          </div>
        </div>
      </div>
    </div>
  );
}