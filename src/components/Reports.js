import { useEffect, useState } from 'react';
import { Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, Filler } from 'chart.js';
import { getInvoices, getStats, getCurrencySymbol, generateInsights, getBudget } from '../store/invoiceStore';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import {
  TagIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  SparklesIcon,
} from '@heroicons/react/24/solid';

ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, Filler);

const categoryColors = {
  نثريات: '#6366f1',
  تشغيلية: '#22c55e',
  مكتبية: '#a78bfa',
  ضيافة: '#f59e0b',
};

function StatCard({ label, value, change, icon, color }) {
  const colors = {
    green: { bg: 'bg-green-50', border: 'border-green-100' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-100' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-100' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-100' },
  };
  const c = colors[color] || colors.green;
  return (
    <div className={`rounded-2xl p-5 border ${c.bg} ${c.border}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-2xl">{icon}</div>
      </div>
      <div className="text-right">
        <h3 className="text-xs font-semibold text-slate-500 mb-1">{label}</h3>
        <p className="text-2xl font-extrabold text-slate-800 mb-1">{value}</p>
        {change && (
          <p className={`text-xs font-semibold ${change.includes('+') ? 'text-orange-600' : 'text-green-600'}`}>
            {change}
          </p>
        )}
      </div>
    </div>
  );
}

export default function Reports() {
  const [stats, setStats] = useState(getStats());
  const [allInvoices, setAllInvoices] = useState(getInvoices());
  const [invoices, setInvoices] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());
  const [showAllInsights, setShowAllInsights] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState(getCurrencySymbol());
  const [insights, setInsights] = useState(generateInsights());
  const [lineChartMode, setLineChartMode] = useState('daily');
  const [showInsightDetail, setShowInsightDetail] = useState(false);

  const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  useEffect(() => {
    const updateData = () => {
      const all = getInvoices();
      setAllInvoices(all);
      setStats(getStats());
      setCurrencySymbol(getCurrencySymbol());
      setInsights(generateInsights());
    };
    updateData();
    window.addEventListener('sanad_updated', updateData);
    window.addEventListener('focus', updateData);
    return () => {
      window.removeEventListener('sanad_updated', updateData);
      window.removeEventListener('focus', updateData);
    };
  }, []);

  // Filter invoices by selected month/year
  useEffect(() => {
    const filtered = allInvoices.filter((inv) => {
      const d = new Date(inv.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    setInvoices(filtered);
  }, [month, year, allInvoices]);

  // Compute filtered stats from invoices
  const filteredTotal = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);
  const filteredAvg = invoices.length > 0 ? (filteredTotal / new Date(year, month + 1, 0).getDate()).toFixed(2) : '0.00';

  const filteredCategoryTotals = {};
  invoices.forEach((inv) => {
    const cat = inv.category || 'نثريات';
    filteredCategoryTotals[cat] = (filteredCategoryTotals[cat] || 0) + parseFloat(inv.amount || 0);
  });
  const filteredCatPcts = Object.entries(filteredCategoryTotals).map(([name, amount]) => ({
    name,
    pct: filteredTotal > 0 ? Math.round((amount / filteredTotal) * 100) : 0,
    amount: amount.toFixed(2),
  })).sort((a, b) => b.pct - a.pct);

  const dateStr = `${monthNames[month]} ${year}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dateRangeStr = `01 ${monthNames[month]} ${year} - ${daysInMonth} ${monthNames[month]} ${year}`;
  const totalChange = stats.monthChangePercent || 0;
  const budget = getBudget();
  const budgetPct = budget > 0 ? Math.round((filteredTotal / budget) * 100) : 0;

  const pieData = {
    labels: filteredCatPcts.map((c) => c.name),
    datasets: [{
      data: filteredCatPcts.map((c) => c.pct),
      backgroundColor: filteredCatPcts.map((c) => (categoryColors[c.name] || '#94a3b8') + 'cc'),
      borderColor: filteredCatPcts.map((c) => categoryColors[c.name] || '#94a3b8'),
      borderWidth: 2,
      hoverOffset: 8,
    }],
  };

  // Build daily/weekly chart data from filtered invoices
  const groupedByDay = {};
  invoices.forEach((inv) => {
    const day = (inv.date || '').split('T')[0] || inv.date;
    groupedByDay[day] = (groupedByDay[day] || 0) + parseFloat(inv.amount || 0);
  });

  const groupedByWeek = {};
  invoices.forEach((inv) => {
    const invDate = new Date(inv.date);
    const weekKey = `الأسبوع ${Math.ceil(invDate.getDate() / 7)}`;
    groupedByWeek[weekKey] = (groupedByWeek[weekKey] || 0) + parseFloat(inv.amount || 0);
  });

  const sortedDays = Object.keys(groupedByDay).sort();
  const sortedWeeks = Object.keys(groupedByWeek).sort();

  const lineData = lineChartMode === 'daily' ? {
    labels: sortedDays.length > 0 ? sortedDays : ['لا توجد بيانات'],
    datasets: [{
      label: 'المصروفات اليومية',
      data: sortedDays.length > 0 ? sortedDays.map((d) => groupedByDay[d]) : [0],
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
      borderWidth: 2.5,
      tension: 0.4,
      fill: true,
      pointRadius: 4,
      pointBackgroundColor: '#6366f1',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
    }],
  } : {
    labels: sortedWeeks.length > 0 ? sortedWeeks : ['لا توجد بيانات'],
    datasets: [{
      label: 'المصروفات الأسبوعية',
      data: sortedWeeks.length > 0 ? sortedWeeks.map((w) => groupedByWeek[w]) : [0],
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
      borderWidth: 2.5,
      tension: 0.4,
      fill: true,
      pointRadius: 4,
      pointBackgroundColor: '#6366f1',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
    }],
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { display: true, labels: { font: { size: 12 }, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${currencySymbol} ${ctx.parsed.y.toFixed(2)}`,
        },
      },
    },
    scales: {
      y: { beginAtZero: true },
      x: { ticks: { font: { size: 11 } } },
    },
  };

  const handleExport = () => {
    const content = `
تقرير المصاريف - ${dateStr}
الفترة: ${dateRangeStr}

ملخص الإحصائيات:
- إجمالي المصاريف: ${currencySymbol} ${filteredTotal.toFixed(2)}
- متوسط المصروف اليومي: ${currencySymbol} ${filteredAvg}
- عدد الفواتير: ${invoices.length}
- أعلى فئة: ${filteredCatPcts[0]?.name || 'لا توجد'}
${budget > 0 ? `- الميزانية الشهرية: ${currencySymbol} ${budget}\n- نسبة الاستهلاك: ${budgetPct}%` : ''}

توزيع المصاريف حسب الفئة:
${filteredCatPcts.map((c) => `${c.name}: ${currencySymbol} ${c.amount} (${c.pct}%)`).join('\n')}

أبرز الملاحظات:
${insights.observations.map(o => `• ${o.text}`).join('\n')}

تم إنشاء التقرير في: ${new Date().toLocaleString('ar-SA')}
    `.trim();

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير-المصاريف-${dateStr}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-slate-800">التقارير</h2>
        <p className="text-sm text-slate-500 mt-1">{dateRangeStr}</p>
        <p className="text-sm text-slate-500">تحليل شامل لمصروفاتك وأداء أعمالك</p>
      </div>

      {/* Month/Year filter */}
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (month === 0) { setMonth(11); setYear(y => y - 1); }
              else setMonth(m => m - 1);
            }}
            className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >◀</button>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-300"
          >
            {monthNames.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-300"
          >
            {[2023, 2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => {
              if (month === 11) { setMonth(0); setYear(y => y + 1); }
              else setMonth(m => m + 1);
            }}
            className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >▶</button>
        </div>
        <div className="flex items-center gap-2">
          {invoices.length === 0 && (
            <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg">لا توجد فواتير في هذا الشهر</span>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-2 text-sm font-semibold text-indigo-600 px-4 py-2 hover:bg-indigo-50 rounded-lg transition"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            تصدير التقرير
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="إجمالي المصاريف"
          value={`${currencySymbol} ${parseFloat(filteredTotal).toLocaleString('ar-SA')}`}
          change={totalChange !== 0 ? `${totalChange > 0 ? '▲ +' : '▼ '}${Math.abs(totalChange)}% من الشهر الماضي` : undefined}
          color="green"
          icon={<CurrencyDollarIcon className="h-6 w-6 text-green-500" />}
        />
        <StatCard
          label="متوسط المصروف اليومي"
          value={`${currencySymbol} ${parseFloat(filteredAvg).toLocaleString('ar-SA')}`}
          color="blue"
          icon={<ChartBarIcon className="h-6 w-6 text-blue-500" />}
        />
        <StatCard
          label="عدد الفواتير"
          value={`${invoices.length} فاتورة`}
          color="purple"
          icon={<DocumentTextIcon className="h-6 w-6 text-purple-500" />}
        />
        <StatCard
          label="أعلى فئة مصروفات"
          value={filteredCatPcts[0]?.name || 'لا توجد'}
          change={filteredCatPcts[0] ? `${filteredCatPcts[0].pct}% من الإجمالي` : undefined}
          color="orange"
          icon={<TagIcon className="h-6 w-6 text-orange-500" />}
        />
      </div>

      {/* Budget bar (if set) */}
      {budget > 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-bold ${budgetPct >= 100 ? 'text-red-600' : budgetPct >= 80 ? 'text-orange-500' : 'text-green-600'}`}>
              {budgetPct}% من الميزانية
            </span>
            <span className="text-sm font-bold text-slate-700">
              الميزانية الشهرية: {currencySymbol} {budget.toLocaleString('ar-SA')}
            </span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-orange-500' : 'bg-indigo-500'}`}
              style={{ width: `${Math.min(100, budgetPct)}%` }}
            />
          </div>
          {stats.forecastDate && (
            <p className="text-xs text-slate-500 mt-2 text-right">
              {stats.forecastDate === 'تجاوزت الميزانية'
                ? '🚨 تجاوزت الميزانية الشهرية'
                : `📅 التوقع: استهلاك الميزانية بحلول ${stats.forecastDate}`}
            </p>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-lg font-bold text-slate-800 text-right mb-4">توزيع المصاريف حسب الفئة</h3>
          {filteredCatPcts.length > 0 ? (
            <div className="flex items-center justify-between">
              <div className="w-40 h-40">
                <Doughnut data={pieData} options={{ responsive: true, cutout: '65%', plugins: { legend: { display: false } } }} />
              </div>
              <div className="flex flex-col gap-3">
                {filteredCatPcts.map((cat) => (
                  <div key={cat.name} className="flex items-center gap-2 justify-end text-sm">
                    <span className="text-slate-600">{cat.pct}%</span>
                    <span className="text-slate-700 font-semibold">{currencySymbol} {parseFloat(cat.amount).toLocaleString('ar-SA')}</span>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: categoryColors[cat.name] || '#94a3b8' }} />
                    <span className="text-slate-700 font-semibold">{cat.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
              لا توجد بيانات لهذا الشهر
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex bg-slate-50 rounded-xl p-1">
              <button
                onClick={() => setLineChartMode('daily')}
                className={`px-4 py-1 text-xs font-bold rounded-lg transition ${lineChartMode === 'daily' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
              >يومي</button>
              <button
                onClick={() => setLineChartMode('weekly')}
                className={`px-4 py-1 text-xs font-bold rounded-lg transition ${lineChartMode === 'weekly' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400'}`}
              >أسبوعي</button>
            </div>
            <h3 className="text-lg font-bold text-slate-800">المصروفات على مدار الوقت</h3>
          </div>
          <div className="h-64">
            <Line data={lineData} options={lineOptions} />
          </div>
        </div>
      </div>

      {/* Category table */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h3 className="text-lg font-bold text-slate-800 mb-4 text-right">تفصيل المصروفات حسب الفئة</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-500 text-xs">
                <th className="py-3 font-medium text-right">النسبة</th>
                <th className="py-3 font-medium text-right">المبلغ</th>
                <th className="py-3 font-medium text-right">الفئة</th>
              </tr>
            </thead>
            <tbody>
              {filteredCatPcts.length > 0 ? filteredCatPcts.map((cat) => (
                <tr key={cat.name} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-3">{cat.pct}%</td>
                  <td className="py-3 font-semibold text-slate-700">{currencySymbol} {parseFloat(cat.amount).toLocaleString('ar-SA')}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <span>{cat.name}</span>
                      <div className="h-2 rounded-full" style={{ width: `${Math.max(cat.pct, 5)}%`, maxWidth: '80px', backgroundColor: categoryColors[cat.name] || '#94a3b8' }} />
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="3" className="py-6 text-center text-slate-400 text-sm">لا توجد بيانات لهذا الشهر</td></tr>
              )}
              {filteredCatPcts.length > 0 && (
                <tr className="font-bold bg-slate-50 border-t-2 border-slate-200">
                  <td className="py-3">100%</td>
                  <td className="py-3 text-slate-800">{currencySymbol} {filteredTotal.toLocaleString('ar-SA')}</td>
                  <td className="py-3">الإجمالي</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Tip */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start gap-4">
          <img src="/ai-tip.png" alt="AI Tip" className="w-32 h-32 object-cover rounded-full" onError={e => e.target.style.display='none'} />
          <div className="text-right flex-1">
            <h3 className="text-lg font-bold text-indigo-900 mb-2 flex items-center gap-2 justify-end">
              نصيحة الذكاء الاصطناعي
              <SparklesIcon className="h-6 w-6 text-indigo-500" />
            </h3>
            <p className="text-indigo-800 mb-3">{insights.recommendation}</p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowInsightDetail(!showInsightDetail)}
                className="px-4 py-2 text-sm font-semibold text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-100 transition"
              >
                {showInsightDetail ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
              </button>
              <button
                onClick={() => alert(`🎯 تم تطبيق التوصية!\n\nسيتم تتبع مصروفات "${insights.observations[0]?.text || stats.topCategory}" بشكل أدق.`)}
                className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition"
              >
                تطبيق التوصية
              </button>
            </div>
            {showInsightDetail && (
              <div className="mt-4 space-y-2">
                {insights.observations.map((obs, i) => (
                  <div key={i} className="flex items-start gap-2 bg-white/70 rounded-lg px-3 py-2 text-right">
                    <span className="text-base">{obs.icon}</span>
                    <span className={`text-xs font-semibold ${obs.color}`}>{obs.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Observations */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowAllInsights(!showAllInsights)}
            className="text-sm font-semibold text-indigo-600 hover:underline"
          >
            {showAllInsights ? 'إخفاء التفاصيل' : 'عرض جميع الملاحظات'}
          </button>
          <h3 className="text-lg font-bold text-slate-800">أبرز الملاحظات</h3>
        </div>
        <ul className={`space-y-3 overflow-hidden transition-all ${showAllInsights ? '' : 'max-h-48'}`}>
          {insights.observations.map((obs, i) => (
            <li key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
              <span className={`font-bold text-lg min-w-max ${obs.color}`}>{obs.icon}</span>
              <span className="text-slate-700 text-sm text-right">{obs.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}