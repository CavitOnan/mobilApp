import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { formatTime } from '../utils/format.js';

const SERIES = [
  { key: 'cpuPercent', name: 'CPU', color: '#60a5fa' },
  { key: 'memPercent', name: 'RAM', color: '#f59e0b' },
  { key: 'diskPercent', name: 'Disk', color: '#a78bfa' },
  { key: 'gpuPercent', name: 'GPU', color: '#34d399' },
];

export default function HistoryChart({ data }) {
  if (!data || data.length < 2) {
    return <div className="chart-empty">Grafik için veri toplanıyor…</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatTime}
          stroke="#8b93a7"
          fontSize={12}
          minTickGap={40}
        />
        <YAxis domain={[0, 100]} stroke="#8b93a7" fontSize={12} unit="%" />
        <Tooltip
          labelFormatter={formatTime}
          formatter={(value, name) => [`%${Number(value).toFixed(0)}`, name]}
          contentStyle={{ background: '#1a1d24', border: '1px solid #2a2f3a', borderRadius: 8 }}
        />
        <Legend />
        {SERIES.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
