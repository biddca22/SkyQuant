"use client";

import { useState } from "react";
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip } from "recharts";
import { Leaf, AlertTriangle, Cpu, TrendingDown, DollarSign, BarChart3, Sliders } from "lucide-react";
import { FlightData, FuelMetrics } from "../types";

interface EconomicsProps {
  telemetry: FlightData;
  fuelMetrics: FuelMetrics;
  theme?: "glass" | "obsidian";
}

export default function AviationEconomics({ telemetry, fuelMetrics, theme = "glass" }: EconomicsProps) {
  const [fuelPricePerTon, setFuelPricePerTon] = useState(880); // USD per metric ton Jet A-1
  const [loadFactor, setLoadFactor] = useState(82); // % passenger load factor

  const burnRateKgH = fuelMetrics?.burn_rate_kg_hr || 2560;
  const co2PerHourTons = fuelMetrics?.co2_per_hr_tons || (burnRateKgH * 3.16) / 1000;
  const euEtsCostPerHour = fuelMetrics?.eu_ets_cost_hr_eur || co2PerHourTons * 72.4;

  const hourlyFuelCost = (burnRateKgH / 1000) * fuelPricePerTon;
  const seatCapacity = 312; // B777 / A350 average
  const totalCostPerHour = hourlyFuelCost + euEtsCostPerHour * 1.08 + 1850; // Crew + maintenance + nav fees
  const costPerSeatHour = totalCostPerHour / (seatCapacity * (loadFactor / 100));

  const dynamicScore = 91;
  const radarData = [
    { subject: "Thrust Efficiency", value: dynamicScore + 3 },
    { subject: "Aero L/D", value: dynamicScore - 2 },
    { subject: "Carbon Abatement", value: dynamicScore - 4 },
    { subject: "Thermal Yield", value: dynamicScore + 5 },
    { subject: "Corridor Optima", value: dynamicScore + 1 },
    { subject: "Surrogate Model", value: 98 },
  ];

  const isGlass = theme === "glass";

  return (
    <div
      className={`w-full h-full min-h-[480px] rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 ${
        isGlass
          ? "glass-deck-panel"
          : "obsidian-panel rounded-2xl"
      }`}
    >
      {/* Header with Title & Eco Badge */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isGlass
                ? "bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                : "bg-cyan-500/15 border border-cyan-400/40 text-cyan-400"
            }`}
          >
            <Leaf size={18} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-wide flex items-center gap-2">
              <span>EU ETS & Quantitative Aviation Economics</span>
              {isGlass && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  EU ETS COMPLIANT
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Fuel sensitivity, CORSIA carbon credits, and operating margins
            </p>
          </div>
        </div>

        {/* Real-time ETS ticker */}
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-mono ${
            isGlass ? "glass-deck-card" : "bg-slate-900 border-slate-700"
          }`}
        >
          <span className="text-slate-400">ETS ALLOWANCE:</span>
          <span className="font-bold text-emerald-300 glow-text-emerald">€72.40 / TON</span>
        </div>
      </div>

      {/* Main Grid: Radar Chart & Interactive Sensitivity Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-2">
        {/* Radar Performance Chart */}
        <div className="h-[260px] flex items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
              <PolarGrid stroke={isGlass ? "rgba(255,255,255,0.12)" : "#1e293b"} />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: isGlass ? "#cbd5e1" : "#94a3b8", fontSize: 10, fontFamily: "monospace" }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[50, 100]}
                tick={{ fill: isGlass ? "#64748b" : "#475569", fontSize: 9 }}
              />
              <Radar
                name="Yield Score"
                dataKey="value"
                stroke={isGlass ? "#34d399" : "#06b6d4"}
                fill={isGlass ? "#34d399" : "#06b6d4"}
                fillOpacity={isGlass ? 0.35 : 0.25}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div
                      className={`p-2.5 rounded-xl border text-xs font-mono shadow-xl ${
                        isGlass
                          ? "glass-floating-hud text-slate-100 border-white/20"
                          : "bg-slate-900 text-slate-100 border-slate-700"
                      }`}
                    >
                      <p className="font-bold text-emerald-300">{payload[0]?.name}</p>
                      <p className="text-white">Index: {payload[0]?.value} / 100</p>
                    </div>
                  );
                }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Quant Interactive Sliders & Live Financial Metrics */}
        <div className="flex flex-col justify-center space-y-4">
          {/* Jet A-1 Fuel Price Slider */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              isGlass ? "glass-deck-card" : "bg-slate-900/80 border-slate-800"
            }`}
          >
            <div className="flex justify-between items-center mb-1.5 text-xs font-mono">
              <span className="text-slate-300 flex items-center gap-1.5">
                <DollarSign size={13} className="text-amber-400" />
                Jet A-1 Market Price:
              </span>
              <span className="font-bold text-amber-300 font-mono">${fuelPricePerTon} / Metric Ton</span>
            </div>
            <input
              type="range"
              min="500"
              max="1500"
              step="20"
              value={fuelPricePerTon}
              onChange={(e) => setFuelPricePerTon(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>

          {/* Load Factor Slider */}
          <div
            className={`p-3.5 rounded-2xl border transition-all ${
              isGlass ? "glass-deck-card" : "bg-slate-900/80 border-slate-800"
            }`}
          >
            <div className="flex justify-between items-center mb-1.5 text-xs font-mono">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Sliders size={13} className="text-violet-400" />
                Passenger Load Factor:
              </span>
              <span className="font-bold text-violet-300 font-mono">{loadFactor}% Capacity</span>
            </div>
            <input
              type="range"
              min="50"
              max="100"
              step="1"
              value={loadFactor}
              onChange={(e) => setLoadFactor(Number(e.target.value))}
              className="w-full accent-violet-400 cursor-pointer h-1.5 bg-white/10 rounded-lg"
            />
          </div>

          {/* Quant Live Output Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div
              className={`p-3 rounded-xl border ${
                isGlass ? "glass-deck-card" : "bg-slate-900 border-slate-800"
              }`}
            >
              <span className="text-[10px] text-slate-400 block">HOURLY FUEL BURN COST</span>
              <span className="text-sm font-bold text-white mt-0.5 block">
                ${Math.round(hourlyFuelCost).toLocaleString()} / hr
              </span>
            </div>
            <div
              className={`p-3 rounded-xl border ${
                isGlass ? "glass-deck-card" : "bg-slate-900 border-slate-800"
              }`}
            >
              <span className="text-[10px] text-slate-400 block">COST / SEAT-HOUR</span>
              <span className="text-sm font-bold text-emerald-300 mt-0.5 block">
                ${costPerSeatHour.toFixed(2)} / pax-hr
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer KPI Ribbon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <span className="text-slate-300">
            Carbon Liability: <strong className="text-white">€{euEtsCostPerHour.toFixed(1)}/hr</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-violet-400 shadow-[0_0_8px_#c084fc]" />
          <span className="text-slate-300">
            Specific Air Range: <strong className="text-white">0.184 nm/kg</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
          <span className="text-slate-300">
            CO₂ Intensity: <strong className="text-white">{(co2PerHourTons).toFixed(2)} tons/hr</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
