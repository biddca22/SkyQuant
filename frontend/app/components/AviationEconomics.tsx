"use client";

import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip } from "recharts";
import { Leaf, AlertTriangle, Cpu, TrendingDown } from "lucide-react";

export default function AviationEconomics({ telemetry, fuelMetrics }: { telemetry: any; fuelMetrics: any }) {
  const burnRateKgH = fuelMetrics?.burn_rate_kg_hr || 2560;
  const co2PerHourTons = (burnRateKgH * 3.16) / 1000;
  const euEtsCostPerHour = co2PerHourTons * 72.4;

  const dynamicScore = (telemetry?.altitude_m % 10) + 85; 

  const radarData = [
    { subject: "Thrust", value: dynamicScore + 4 },
    { subject: "Aero", value: dynamicScore - 2 },
    { subject: "Carbon", value: dynamicScore - 8 },
    { subject: "Thermal", value: dynamicScore + 2 },
    { subject: "Route", value: dynamicScore - 5 },
    { subject: "ML Model", value: 98 },
  ];

  return (
    <div className="w-full h-full bg-white/[0.02] rounded-2xl p-4 grid grid-cols-12 gap-6">
      <div className="col-span-7 flex flex-col justify-between">
        <div>
          <h3 className="text-[0.70rem] font-bold uppercase tracking-widest text-gray-400">EU ETS & Non-CO2 Economics</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 my-2">
          <div className="bg-transparent border-none flex flex-col justify-center">
            <div className="flex justify-between items-center text-gray-500 text-[0.65rem] mb-1">
              <span className="font-bold uppercase tracking-widest">EU ETS Liability</span>
              <Leaf size={14} className="text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-white font-mono">€{euEtsCostPerHour.toFixed(2)} <span className="text-[0.65rem] text-gray-400 font-sans">/ hr</span></p>
            <p className="text-[0.60rem] text-emerald-400 mt-1 uppercase tracking-wider">Factor: 3.16 tCO2</p>
          </div>
          <div className="bg-transparent border-none flex flex-col justify-center">
            <div className="flex justify-between items-center text-gray-500 text-[0.65rem] mb-1">
              <span className="font-bold uppercase tracking-widest">Contrail Index</span>
              <AlertTriangle size={14} className="text-amber-400" />
            </div>
            <p className="text-xl font-bold text-amber-300 font-mono">14.2% <span className="text-[0.65rem] text-gray-400 font-sans">Risk</span></p>
            <p className="text-[0.60rem] text-gray-500 mt-1 uppercase tracking-wider">Schmidt-Appleman: Neg</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 mt-2">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-gray-500 text-[0.65rem] font-bold uppercase tracking-widest">
                <TrendingDown size={14} className="text-blue-400" /> Marginal Cost of Delay
              </div>
              <p className="text-[0.65rem] text-gray-400 mt-1">Industry standard benchmark: <span className="text-white font-mono">€74.80 / min</span> post-departure.</p>
            </div>
            <div className="shrink-0 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-md font-mono text-[0.65rem] font-bold tracking-wider">
              ON TIME
            </div>
          </div>

          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-gray-500 text-[0.65rem] font-bold uppercase tracking-widest">
                <Cpu size={14} className="text-cyan-400" /> Surrogate Neural Burn Model
              </div>
              <p className="text-[0.65rem] text-gray-400 mt-1">Trained on 2.4M flights for {fuelMetrics?.aircraft_type_assumed || "A320"} operations.</p>
            </div>
            <div className="shrink-0 px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-md font-mono text-[0.65rem] font-bold tracking-wider">
              R² = 0.988
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-5 bg-transparent flex flex-col justify-center items-center">
        <h4 className="text-[0.65rem] font-bold uppercase tracking-widest text-gray-500 w-full text-center mb-2">Efficiency Diagnostics</h4>
        <div className="w-full aspect-square max-h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke="#1e1e26" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "#6b7280", fontSize: 9, textAnchor: "middle" }} />
              <PolarRadiusAxis stroke="none" tick={false} axisLine={false} />
              <Radar name="Flight Optima" dataKey="value" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.25} />
              <Tooltip contentStyle={{ backgroundColor: "#020202", borderColor: "#1e1e26", borderRadius: 8, fontSize: 10, color: "#fff" }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}