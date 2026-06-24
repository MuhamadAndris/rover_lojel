import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';
import { Transaction, SalesTarget, Stock } from '@/models';
import { formatCurrency, formatNumber } from '@/lib/utils';
import DashboardCharts from './DashboardCharts';
import {
  TrendingUp,
  Users,
  ShoppingBag,
  Package,
  Target,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

async function getDashboardData(role: string, userId: string, counterId: string | null) {
  await connectDB();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const txFilter: Record<string, unknown> = {
    date: { $gte: startOfMonth, $lte: endOfMonth },
    status: 'success',
  };
  if (role === 'sa') txFilter.saleByUserId = userId;
  else if (role === 'spv' && counterId) txFilter.counterId = counterId;

  const lastTxFilter = {
    ...txFilter,
    date: { $gte: startOfLastMonth, $lte: endOfLastMonth },
  };

  // This month aggregation
  const [currentAgg] = await Transaction.aggregate([
    { $match: txFilter },
    {
      $group: {
        _id: null,
        totalOmset: { $sum: '$totalFinalAmount' },
        totalTransaksi: { $sum: 1 },
        totalItem: { $sum: '$totalQty' },
        totalTrafik: { $sum: 1 }, // unique visitors proxy = distinct transactions
      },
    },
  ]);

  const [lastAgg] = await Transaction.aggregate([
    { $match: lastTxFilter },
    { $group: { _id: null, totalOmset: { $sum: '$totalFinalAmount' }, totalTransaksi: { $sum: 1 } } },
  ]);

  // Per-SA breakdown (only for spv/admin/super_admin)
  let saBreakdown: { saId: string; name?: string; omset: number; transaksi: number }[] = [];
  if (role !== 'sa') {
    const saAgg = await Transaction.aggregate([
      { $match: txFilter },
      {
        $group: {
          _id: '$saleByUserId',
          omset: { $sum: '$totalFinalAmount' },
          transaksi: { $sum: 1 },
        },
      },
      { $sort: { omset: -1 } },
      { $limit: 10 },
    ]);
    saBreakdown = saAgg.map((s) => ({ saId: s._id, omset: s.omset, transaksi: s.transaksi }));
  }

  // Target
  const targetFilter: Record<string, unknown> = { period };
  if (counterId) targetFilter.counterId = counterId;
  const target = await SalesTarget.findOne(targetFilter).lean();

  // Stock summary
  const stockQuery: Record<string, unknown> = {};
  if (counterId) stockQuery.counterId = counterId;
  const [stockSummary] = await Stock.aggregate([
    { $match: stockQuery },
    { $group: { _id: null, totalSKU: { $sum: 1 }, totalUnit: { $sum: '$qtyOnHand' } } },
  ]);

  // Traffic per day (for chart)
  const dailyTraffic = await Transaction.aggregate([
    { $match: txFilter },
    {
      $group: {
        _id: { $dayOfMonth: '$date' },
        transaksi: { $sum: 1 },
        omset: { $sum: '$totalFinalAmount' },
      },
    },
    { $sort: { '_id': 1 } },
  ]);

  return {
    currentOmset: currentAgg?.totalOmset ?? 0,
    currentTransaksi: currentAgg?.totalTransaksi ?? 0,
    currentItem: currentAgg?.totalItem ?? 0,
    lastOmset: lastAgg?.totalOmset ?? 0,
    lastTransaksi: lastAgg?.totalTransaksi ?? 0,
    storeTarget: target?.storeTargetAmount ?? 0,
    saTargets: target?.saTargets ?? [],
    saBreakdown,
    stockTotalSKU: stockSummary?.totalSKU ?? 0,
    stockTotalUnit: stockSummary?.totalUnit ?? 0,
    dailyTraffic,
    period,
    now: now.toISOString(),
  };
}

function pct(val: number, total: number) {
  if (!total) return 0;
  return Math.round((val / total) * 100);
}

function growthSign(curr: number, last: number) {
  if (!last) return null;
  const g = ((curr - last) / last) * 100;
  return { value: Math.abs(g).toFixed(1), up: g >= 0 };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const data = await getDashboardData(
    session.user.role,
    session.user.userId,
    session.user.counterId
  );

  const omsetGrowth = growthSign(data.currentOmset, data.lastOmset);
  const txGrowth = growthSign(data.currentTransaksi, data.lastTransaksi);
  const achievement = pct(data.currentOmset, data.storeTarget);

  const now = new Date(data.now);
  const monthLabel = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Period label */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-ink-400">Periode aktif</p>
          <p className="font-display font-semibold text-ink-900 text-lg">{monthLabel}</p>
        </div>
        {data.storeTarget > 0 && (
          <div className="text-right">
            <p className="text-xs text-ink-400 mb-1">
              Target Toko: {formatCurrency(data.storeTarget)}
            </p>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-ink-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all"
                  style={{ width: `${Math.min(achievement, 100)}%` }}
                />
              </div>
              <span
                className={`text-sm font-semibold ${achievement >= 100 ? 'text-brand-600' : achievement >= 75 ? 'text-amber-600' : 'text-rose-500'}`}
              >
                {achievement}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Omset */}
        <div className="stat-card col-span-2 xl:col-span-1">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-brand-100 flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-brand-600" />
            </div>
            {omsetGrowth && (
              <span
                className={`flex items-center gap-0.5 text-xs font-medium ${omsetGrowth.up ? 'text-brand-600' : 'text-rose-500'}`}
              >
                {omsetGrowth.up ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                )}
                {omsetGrowth.value}%
              </span>
            )}
          </div>
          <p className="text-2xl font-display font-semibold text-ink-900">
            {formatCurrency(data.currentOmset)}
          </p>
          <p className="text-sm text-ink-400 mt-0.5">Omset Bulan Ini</p>
        </div>

        {/* Transaksi */}
        <div className="stat-card">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
              <ShoppingBag className="w-4.5 h-4.5 text-amber-600" />
            </div>
            {txGrowth && (
              <span
                className={`flex items-center gap-0.5 text-xs font-medium ${txGrowth.up ? 'text-brand-600' : 'text-rose-500'}`}
              >
                {txGrowth.up ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {txGrowth.value}%
              </span>
            )}
          </div>
          <p className="text-2xl font-display font-semibold text-ink-900">
            {formatNumber(data.currentTransaksi)}
          </p>
          <p className="text-sm text-ink-400 mt-0.5">Total Transaksi</p>
        </div>

        {/* Item terjual */}
        <div className="stat-card">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-ink-100 flex items-center justify-center">
              <Package className="w-4.5 h-4.5 text-ink-500" />
            </div>
          </div>
          <p className="text-2xl font-display font-semibold text-ink-900">
            {formatNumber(data.currentItem)}
          </p>
          <p className="text-sm text-ink-400 mt-0.5">Item Terjual</p>
        </div>

        {/* Stok */}
        <div className="stat-card">
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl bg-ink-100 flex items-center justify-center">
              <Target className="w-4.5 h-4.5 text-ink-500" />
            </div>
          </div>
          <p className="text-2xl font-display font-semibold text-ink-900">
            {formatNumber(data.stockTotalUnit)}
          </p>
          <p className="text-sm text-ink-400 mt-0.5">
            Unit Stok ({formatNumber(data.stockTotalSKU)} SKU)
          </p>
        </div>
      </div>

      {/* Charts + SA breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Daily traffic chart */}
        <div className="xl:col-span-2 bg-white rounded-xl2 border border-ink-100 shadow-card p-5">
          <h2 className="font-semibold text-ink-800 mb-4 text-sm">
            Trafik &amp; Omset Harian
          </h2>
          <DashboardCharts
            dailyTraffic={data.dailyTraffic}
            month={now.getMonth()}
            year={now.getFullYear()}
          />
        </div>

        {/* Per-SA Ranking */}
        {session.user.role !== 'sa' && data.saBreakdown.length > 0 && (
          <div className="bg-white rounded-xl2 border border-ink-100 shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ink-800 text-sm">Omset per SA</h2>
              <div className="flex items-center gap-1 text-ink-400">
                <Users className="w-3.5 h-3.5" />
                <span className="text-xs">{data.saBreakdown.length} SA</span>
              </div>
            </div>
            <ul className="space-y-3">
              {data.saBreakdown.map((sa, idx) => {
                const saTarget = data.saTargets.find((t) => t.saId === sa.saId);
                const saAchv = saTarget ? pct(sa.omset, saTarget.targetAmount) : null;
                return (
                  <li key={sa.saId} className="flex items-center gap-3">
                    <span className="w-5 text-xs font-mono text-ink-400 shrink-0">
                      {idx + 1}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono text-ink-700">{sa.saId}</span>
                        <span className="text-xs text-ink-600 font-medium">
                          {formatCurrency(sa.omset)}
                        </span>
                      </div>
                      {saAchv !== null && (
                        <div className="w-full h-1.5 bg-ink-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${saAchv >= 100 ? 'bg-brand-500' : saAchv >= 75 ? 'bg-amber-500' : 'bg-rose-400'}`}
                            style={{ width: `${Math.min(saAchv, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {saAchv !== null && (
                      <span
                        className={`text-[10px] font-semibold w-9 text-right ${saAchv >= 100 ? 'text-brand-600' : saAchv >= 75 ? 'text-amber-600' : 'text-rose-500'}`}
                      >
                        {saAchv}%
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
