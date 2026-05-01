import { useEffect, useState } from 'react';
import { CurrencyDollarIcon, ChartPieIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip } from 'chart.js';
import { getStats, getCurrencySymbol, getInvoices } from '../store/invoiceStore';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip);

function MiniChart({ color, values }) {
  const data = {
    labels: values.map((_, i) => i),
    datasets: [{
      data: values,
      borderColor: color,
      backgroundColor: 'transparent',
      tension: 0.4,
      borderWidth: 2,
      pointRadius: 0,
    }],
  };
  const options = {
    responsive: true,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false } },
    animation: false,
  };
  return (
    <div className="w-24 h-10">
      <Line data={data} options={options} />
    </div>
  );
}

export default function DashboardCards() {
  const [stats, setStats] = useState(getStats());
  const [currencySymbol, setCurrencySymbol] = useState(getCurrencySymbol());

  useEffect(() => {
    const update = () => {
      setStats(getStats());
      setCurrencySymbol(getCurrencySymbol());
    };
    window.addEventListener('focus', update);
    window.addEventListener('sanad_updated', update);
    return () => {
      window.removeEventListener('focus', update);
      window.removeEventListener('sanad_updated', update);
    };
  }, []);

  const invoices = getInvoices();
  const now = new Date();
  const lastMonthInvoices = invoices.filter((inv) => {
    const invDate = new Date(inv.date);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    return invDate.getMonth() === lastMonth.getMonth();
  });

  const lastMonthTotal = lastMonthInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
  const totalChange = lastMonthTotal > 0 ? (((parseFloat(stats.total) - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1) : '0';

  const cards = [
    {
      label: 'إجمالي المصاريف',
      value: `${currencySymbol} ${parseFloat(stats.total).toLocaleString('ar-SA')}`,
      sub: `${totalChange > 0 ? '▲ +' : '▼ '}${Math.abs(totalChange)}% من الشهر الماضي`,
      subColor: totalChange > 0 ? 'text-orange-600' : 'text-green-600',
      icon: CurrencyDollarIcon,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      border: 'border-green-100',
      chartColor: 'rgb(34,197,94)',
      chartValues: stats.recentAmounts,
    },
    {
      label: 'الفئة الأكثر استهلاكاً',
      value: stats.topCategory,
      sub: `${stats.catPercentages.find((c) => c.name === stats.topCategory)?.pct || 0}% من إجمالي المصاريف`,
      subColor: 'text-slate-500',
      icon: ChartPieIcon,
      iconBg: 'bg-indigo-100',
      iconColor: 'text-indigo-600',
      border: 'border-indigo-100',
      chartColor: 'rgb(99,102,241)',
      chartValues: stats.recentAmounts,
    },
    {
      label: 'فواتير تحتاج مراجعة',
      value: '0',
      sub: 'فواتير غير مصنفة',
      subColor: 'text-slate-500',
      labelColor: 'text-orange-500',
      icon: ExclamationTriangleIcon,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-500',
      border: 'border-orange-100',
      chartColor: 'rgb(249,115,22)',
      chartValues: stats.recentAmounts,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={`bg-white rounded-2xl p-5 shadow-sm border ${card.border} flex flex-col gap-2`}>
            <div className="flex items-start justify-between">
              <MiniChart color={card.chartColor} values={card.chartValues} />
              <div className="flex flex-col items-end gap-1">
                <span className={`text-sm font-semibold ${card.labelColor || 'text-slate-500'}`}>
                  {card.label}
                </span>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
              </div>
            </div>
            <div className="text-2xl font-extrabold text-slate-800 text-right leading-tight">
              {card.value}
            </div>
            <div className={`text-xs font-semibold text-right ${card.subColor}`}>
              {card.sub}
            </div>
          </div>
        );
      })}
    </div>
  );
}