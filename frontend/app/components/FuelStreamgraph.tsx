"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Fuel, TrendingUp, DollarSign, Gauge, Flame, Sparkles } from "lucide-react";
import { FuelMetrics, FlightData } from "../types";

interface FuelProps {
  telemetry: FlightData;
  fuelMetrics: FuelMetrics;
  isMetric?: boolean;
  theme?: "glass" | "obsidian";
}

export default function FuelStreamgraph({
  telemetry,
  fuelMetrics,
  isMetric = true,
  theme = "glass",
}: FuelProps) {
  const baseBurn = fuelMetrics?.burn_rate_kg_s || 2.15;

  const streamData = [
    { seg: "Taxi-Out", thrust: baseBurn * 0.35, drag: baseBurn * 0.08, climb: baseBurn * 0.05, aux: 0.08 },
    { seg: "Climb (FL180)", thrust: baseBurn * 1.45, drag: baseBurn * 0.42, climb: baseBurn * 0.65, aux: 0.1 },
    { seg: "Climb (FL280)", thrust: baseBurn * 1.25, drag: baseBurn * 0.38, climb: baseBurn * 0.48, aux: 0.09 },
    { seg: "TOC (FL350)", thrust: baseBurn * 1.05, drag: baseBurn * 0.32, climb: baseBurn * 0.22, aux: 0.08 },
    { seg: "Cruise Seg 1", thrust: baseBurn * 0.76, drag: baseBurn * 0.24, climb: baseBurn * 0.04, aux: 0.07 },
    { seg: "Step (FL380)", thrust: baseBurn * 0.92, drag: baseBurn * 0.28, climb: baseBurn * 0.18, aux: 0.07 },
    { seg: "Cruise Seg 2", thrust: baseBurn * 0.70, drag: baseBurn * 0.21, climb: baseBurn * 0.03, aux: 0.07 },
    { seg: "Descent (TOD)", thrust: baseBurn * 0.28, drag: baseBurn * 0.16, climb: 0.01, aux: 0.06 },
    { seg: "Approach", thrust: baseBurn * 0.52, drag: baseBurn * 0.22, climb: 0.02, aux: 0.07 },
  ];

  const burnKgS = fuelMetrics?.burn_rate_kg_s || baseBurn;
  const burnKgHr = fuelMetrics?.burn_rate_kg_hr || Math.round(burnKgS * 3600);
  const burnDisplay = isMetric
    ? `${burnKgS.toFixed(2)} kg/s`
    : `${(burnKgS * 2.20462).toFixed(2)} lb/s`;
  const burnHourlyDisplay = isMetric
    ? `${burnKgHr.toLocaleString()} kg/h`
    : `${Math.round(burnKgHr * 2.20462).toLocaleString()} lb/h`;

  const isGlass = theme === "glass";

  return (
    <div
      className={`w-full h-full min-h-[480px] rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 ${
        isGlass
          ? "glass-deck-panel"
          : "obsidian-panel rounded-2xl"
      }`}
    >
      {/* Header and KPI Badges */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                isGlass
                  ? "bg-violet-500/20 border border-violet-400/40 text-violet-300 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                  : "bg-cyan-500/15 border border-cyan-400/40 text-cyan-400"
              }`}
            >
              <Flame size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white tracking-wide flex items-center gap-2">
                <span>Multi-Phase Propulsion Streamgraph</span>
                {isGlass && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-400/20 text-violet-300 border border-violet-400/30">
                    AERO-DYNAMIC
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Aerodynamic thrust, parasitic drag compensation, and climb vectors
              </p>
            </div>
          </div>
        </div>

        {/* 4 Glowing Mini KPI Pills */}
        <div className="flex items-center gap-3">
          <div
            className={`px-3.5 py-1.5 rounded-xl border transition-all ${
              isGlass
                ? "glass-deck-card"
                : "bg-slate-900 border-slate-700/80"
            }`}
          >
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              INSTANT FLOW
            </span>
            <span
              className={`text-xs font-mono font-bold ${
                isGlass ? "text-amber-300 glow-text-amber" : "text-cyan-300"
              }`}
            >
              {burnDisplay}
            </span>
          </div>

          <div
            className={`px-3.5 py-1.5 rounded-xl border transition-all ${
              isGlass
                ? "glass-deck-card"
                : "bg-slate-900 border-slate-700/80"
            }`}
          >
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              HOURLY MASS
            </span>
            <span
              className={`text-xs font-mono font-bold ${
                isGlass ? "text-violet-300 glow-text-violet" : "text-sky-300"
              }`}
            >
              {burnHourlyDisplay}
            </span>
          </div>

          <div
            className={`px-3.5 py-1.5 rounded-xl border transition-all ${
              isGlass
                ? "glass-deck-card"
                : "bg-slate-900 border-slate-700/80"
            }`}
          >
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
              FUEL COST
            </span>
            <span
              className={`text-xs font-mono font-bold ${
                isGlass ? "text-emerald-300 glow-text-emerald" : "text-emerald-400"
              }`}
            >
              ${Math.round(burnKgHr * 0.88).toLocaleString()}/h
            </span>
          </div>
        </div>
      </div>

      {/* Main Multi-Layer Streamgraph */}
      <div className="w-full h-[320px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={streamData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="thrustGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isGlass ? "#8b5cf6" : "#06b6d4"} stopOpacity={0.85} />
                <stop offset="95%" stopColor={isGlass ? "#6366f1" : "#0284c7"} stopOpacity={0.15} />
              </linearGradient>
              <linearGradient id="dragGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isGlass ? "#f43f5e" : "#f59e0b"} stopOpacity={0.85} />
                <stop offset="95%" stopColor={isGlass ? "#e11d48" : "#d97706"} stopOpacity={0.15} />
              </linearGradient>
              <linearGradient id="climbGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isGlass ? "#38bdf8" : "#3b82f6"} stopOpacity={0.85} />
                <stop offset="95%" stopColor={isGlass ? "#0284c7" : "#1d4ed8"} stopOpacity={0.15} />
              </linearGradient>
              <linearGradient id="auxGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isGlass ? "#34d399" : "#10b981"} stopOpacity={0.85} />
                <stop offset="95%" stopColor={isGlass ? "#059669" : "#047857"} stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isGlass ? "rgba(255,255,255,0.08)" : "#1e293b"} />
            <XAxis
              dataKey="seg"
              stroke={isGlass ? "#94a3b8" : "#64748b"}
              tick={{ fill: isGlass ? "#cbd5e1" : "#94a3b8", fontSize: 11, fontFamily: "monospace" }}
            />
            <YAxis
              stroke={isGlass ? "#94a3b8" : "#64748b"}
              tick={{ fill: isGlass ? "#cbd5e1" : "#94a3b8", fontSize: 11, fontFamily: "monospace" }}
              unit={isMetric ? " kg/s" : " lb/s"}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div
                    className={`p-3 rounded-2xl shadow-2xl border text-xs font-mono ${
                      isGlass
                        ? "glass-floating-hud text-slate-100 border-white/20"
                        : "bg-slate-900/95 text-slate-100 border-slate-700"
                    }`}
                  >
                    <p className="font-bold text-white mb-2 pb-1 border-b border-white/10">{label}</p>
                    <div className="space-y-1">
                      {payload.map((entry, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5" style={{ color: entry.color }}>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            {entry.name}:
                          </span>
                          <span className="font-bold text-white tabular-nums">
                            {Number(entry.value).toFixed(2)} {isMetric ? "kg/s" : "lb/s"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="thrust"
              name="Gross Engine Thrust"
              stroke={isGlass ? "#c084fc" : "#22d3ee"}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#thrustGrad)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="drag"
              name="Parasitic Drag Penalty"
              stroke={isGlass ? "#fb7185" : "#fbbf24"}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#dragGrad)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="climb"
              name="Climb Potential Vector"
              stroke={isGlass ? "#60a5fa" : "#60a5fa"}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#climbGrad)"
              stackId="1"
            />
            <Area
              type="monotone"
              dataKey="aux"
              name="Environmental & Systems"
              stroke={isGlass ? "#34d399" : "#34d399"}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#auxGrad)"
              stackId="1"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-center gap-6 pt-3 border-t border-white/10 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-violet-400 shadow-[0_0_8px_#c084fc]" />
          <span className="text-slate-300">Gross Engine Thrust</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-rose-400 shadow-[0_0_8px_#fb7185]" />
          <span className="text-slate-300">Parasitic Drag</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
          <span className="text-slate-300">Climb Vector</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <span className="text-slate-300">Aux & Bleed Air</span>
        </div>
      </div>
    </div>
  );
}
