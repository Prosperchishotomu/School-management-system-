import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart
} from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-line-border shadow-lg rounded-xl px-3 py-2 text-xs font-sans">
        <p className="font-bold text-ink">{label}</p>
        <p className="text-teal-primary font-semibold mt-0.5">{payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export const MiniLineChart = ({ data = [], xKey, yKey, height = 160, color = '#2F6B5E', label = '', filled = true }) => {
  if (!data.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-ink/40 font-sans">
        No data available
      </div>
    );
  }

  const ChartComp = filled ? AreaChart : LineChart;

  return (
    <div>
      {label && <p className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-2">{label}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <ChartComp data={data} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(218,212,200,0.5)" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 9, fontFamily: 'Inter', fill: '#1C2530', opacity: 0.6 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fontFamily: 'Inter', fill: '#1C2530', opacity: 0.6 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          {filled ? (
            <Area
              type="monotone"
              dataKey={yKey}
              stroke={color}
              strokeWidth={2}
              fill="url(#lineGradient)"
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color }}
            />
          ) : (
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: color }}
            />
          )}
        </ChartComp>
      </ResponsiveContainer>
    </div>
  );
};

export default MiniLineChart;
