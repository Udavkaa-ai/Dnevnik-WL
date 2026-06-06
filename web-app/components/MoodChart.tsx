'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { formatDateShort } from '@/lib/utils';

interface MoodDataPoint {
  date: string;
  mood: number | null;
}

interface MoodChartProps {
  data: MoodDataPoint[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number | null }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (active && payload && payload.length && payload[0].value !== null) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 px-3 py-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
          Настроение: {payload[0].value}/10
        </p>
      </div>
    );
  }
  return null;
}

export default function MoodChart({ data }: MoodChartProps) {
  const chartData = data.map((d) => ({
    date: formatDateShort(d.date),
    mood: d.mood,
  }));

  const hasData = data.some((d) => d.mood !== null);

  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-400 dark:text-gray-500">
        <p className="text-4xl mb-2">📊</p>
        <p className="text-sm">Нет данных о настроении</p>
        <p className="text-xs mt-1">Заполняйте дневник каждый день</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <defs>
          <linearGradient id="moodGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3d6b8e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3d6b8e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeOpacity={0.5} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[1, 10]}
          ticks={[1, 3, 5, 7, 10]}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="mood"
          stroke="#3d6b8e"
          strokeWidth={2.5}
          fill="url(#moodGradient)"
          dot={{ fill: '#3d6b8e', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, fill: '#3d6b8e' }}
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
