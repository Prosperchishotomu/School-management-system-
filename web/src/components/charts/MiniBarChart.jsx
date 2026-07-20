import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts';

const COLORS = ['#2F6B5E', '#1E4A41', '#C98A2C', '#B3492F', '#6B7280'];

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

export const MiniBarChart = ({ data = [], xKey, yKey, height = 180, color = '#2F6B5E', label = '' }) => {
  if (!data.length) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-ink/40 font-sans">
        No data available
      </div>
    );
  }
  return (
    <div>
      {label && <p className="text-[10px] font-sans font-bold text-ink/50 uppercase tracking-wider mb-2">{label}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
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
          <Bar dataKey={yKey} radius={[6, 6, 0, 0]} maxBarSize={40}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MiniBarChart;
