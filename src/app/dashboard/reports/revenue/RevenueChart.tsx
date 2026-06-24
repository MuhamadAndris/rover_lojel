'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency } from '@/lib/utils';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

interface MonthlyData {
  month: number;
  omset: number;
  target?: number;
}

interface Props {
  monthlyA: MonthlyData[];
  monthlyB: MonthlyData[];
  yearA: number;
  yearB: number | null;
}

export default function RevenueChart({ monthlyA, monthlyB, yearA, yearB }: Props) {
  const data = monthlyA.map((m, i) => ({
    month: MONTH_NAMES[i],
    [`omset${yearA}`]: m.omset,
    ...(yearB ? { [`omset${yearB}`]: monthlyB[i]?.omset ?? 0 } : {}),
    target: m.target,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E6E9EF" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8891A3' }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 10, fill: '#8891A3' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`}
          width={42}
        />
        <Tooltip
          contentStyle={{ background: '#161B27', border: 'none', borderRadius: '10px', padding: '10px 14px' }}
          labelStyle={{ color: '#8891A3', fontSize: 11, marginBottom: 4 }}
          itemStyle={{ color: '#E6E9EF', fontSize: 12 }}
          formatter={(value: number) => formatCurrency(value)}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: '#8891A3', paddingTop: 8 }} />
        <Bar dataKey={`omset${yearA}`} name={`Omset ${yearA}`} fill="#1C7C71" radius={[3, 3, 0, 0]} maxBarSize={18} />
        {yearB && (
          <Bar dataKey={`omset${yearB}`} name={`Omset ${yearB}`} fill="#B8E5DA" radius={[3, 3, 0, 0]} maxBarSize={18} />
        )}
        <Line dataKey="target" name="Target" stroke="#E8A93C" strokeWidth={2} strokeDasharray="5 4" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
