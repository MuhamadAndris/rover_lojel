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
import { formatCurrency, formatNumber } from '@/lib/utils';

interface DailyTrafficItem {
  _id: number;
  transaksi: number;
  omset: number;
}

interface Props {
  dailyTraffic: DailyTrafficItem[];
  month: number;
  year: number;
}

export default function DashboardCharts({ dailyTraffic, month, year }: Props) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const data = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const found = dailyTraffic.find((d) => d._id === day);
    return {
      day: `${day}`,
      transaksi: found?.transaksi ?? 0,
      omset: found?.omset ?? 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E6E9EF" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: '#8891A3' }}
          tickLine={false}
          axisLine={false}
          interval={4}
        />
        <YAxis
          yAxisId="omset"
          orientation="left"
          tick={{ fontSize: 10, fill: '#8891A3' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`}
          width={42}
        />
        <YAxis
          yAxisId="transaksi"
          orientation="right"
          tick={{ fontSize: 10, fill: '#8891A3' }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{
            background: '#161B27',
            border: 'none',
            borderRadius: '10px',
            padding: '10px 14px',
          }}
          labelStyle={{ color: '#8891A3', fontSize: 11, marginBottom: 4 }}
          itemStyle={{ color: '#E6E9EF', fontSize: 12 }}
          formatter={(value: number, name: string) =>
            name === 'omset'
              ? [formatCurrency(value), 'Omset']
              : [formatNumber(value), 'Transaksi']
          }
          labelFormatter={(label) => `Tanggal ${label}`}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#8891A3', paddingTop: 8 }}
          formatter={(value) => (value === 'omset' ? 'Omset' : 'Transaksi')}
        />
        <Bar
          yAxisId="omset"
          dataKey="omset"
          fill="#4DB3A2"
          radius={[3, 3, 0, 0]}
          maxBarSize={16}
        />
        <Line
          yAxisId="transaksi"
          dataKey="transaksi"
          stroke="#E8A93C"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#E8A93C', stroke: '#fff', strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
