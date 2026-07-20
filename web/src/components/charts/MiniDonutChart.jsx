import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

const COLORS = {
  paid:    '#2F6B5E',
  partial: '#C98A2C',
  unpaid:  '#B3492F',
  full:    '#2F6B5E',
  basic:   '#C98A2C',
  default0:'#2F6B5E',
  default1:'#C98A2C',
  default2:'#B3492F',
  default3:'#6B7280',
};

const getColor = (name, index) => {
  const key = (name || '').toLowerCase();
  return COLORS[key] || COLORS[`default${index}`] || '#6B7280';
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-line-border shadow-lg rounded-xl px-3 py-2 text-xs font-sans">
        <p className="font-bold text-ink capitalize">{payload[0].name}</p>
        <p className="text-teal-primary font-semibold">{payload[0].value}</p>
      </div>
    );
  }
  return null;
};

export const MiniDonutChart = ({ data = [], nameKey = 'name', valueKey = 'value', height = 200, label = '' }) => {
  if (!data.length || data.every(d => !d[valueKey])) {
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
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={3}
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell key={index} fill={getColor(entry[nameKey], index)} fillOpacity={0.9} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => (
              <span style={{ fontSize: 10, fontFamily: 'Inter', color: '#1C2530', textTransform: 'capitalize' }}>{v}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MiniDonutChart;
