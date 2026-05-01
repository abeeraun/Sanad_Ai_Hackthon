import { useState, useEffect } from 'react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { getStats, getCurrencySymbol, getInvoices, convertAmount, getCurrentCurrency } from '../store/invoiceStore';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = {
  نثريات: '#6366f1',
  تشغيلية: '#22c55e',
  مكتبية: '#a78bfa',
  ضيافة: '#f59e0b',
};

const filterOptions = [
  { label: 'حسب الفئة', value: 'category' },
  { label: 'حسب المتجر', value: 'store' },
  { label: 'حسب العملة', value: 'currency' },
];

export default function ExpensePie() {
  const [stats, setStats] = useState(getStats());
  const [invoices, setInvoices] = useState(getInvoices());
  const [filterType, setFilterType] = useState('category');
  const [currencySymbol, setCurrencySymbol] = useState(getCurrencySymbol());

  useEffect(() => {
    const update = () => {
      setStats(getStats());
      setInvoices(getInvoices());
      setCurrencySymbol(getCurrencySymbol());
    };
    window.addEventListener('sanad_updated', update);
    window.addEventListener('focus', update);
    return () => {
      window.removeEventListener('sanad_updated', update);
      window.removeEventListener('focus', update);
    };
  }, []);

  // حساب البيانات حسب نوع الفلتر
  const getFilteredData = () => {
    if (filterType === 'category') {
      return {
        labels: stats.catPercentages.map((c) => c.name),
        values: stats.catPercentages.map((c) => c.pct),
        amounts: stats.catPercentages.map((c) => parseFloat(c.amount)),
      };
    } else if (filterType === 'store') {
      const storeData = {};
      invoices.forEach((inv) => {
        const store = inv.storeName || 'متجر غير معروف';
        if (!storeData[store]) {
          storeData[store] = { amount: 0, count: 0 };
        }
        storeData[store].amount += parseFloat(inv.amount || 0);
        storeData[store].count += 1;
      });

      const total = Object.values(storeData).reduce((sum, s) => sum + s.amount, 0);
      const sorted = Object.entries(storeData)
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, 5);

      return {
        labels: sorted.map(([name]) => name),
        values: sorted.map(([, data]) => Math.round((data.amount / total) * 100)),
        amounts: sorted.map(([, data]) => data.amount),
      };
    } else if (filterType === 'currency') {
      const currencyData = {
        'SAR (ر.س)': 0,
        'USD ($)': 0,
        'YER (ر.ي)': 0,
      };

      invoices.forEach((inv) => {
        const amount = parseFloat(inv.amount || 0);
        currencyData['SAR (ر.س)'] += amount;
        currencyData['USD ($)'] += parseFloat(convertAmount(amount, 'SAR', 'USD'));
        currencyData['YER (ر.ي)'] += parseFloat(convertAmount(amount, 'SAR', 'YER'));
      });

      const total = currencyData['SAR (ر.س)'];
      const labels = Object.keys(currencyData);
      const values = Object.values(currencyData).map((v) => Math.round((v / total) * 100));
      const amounts = Object.values(currencyData);

      return {
        labels,
        values,
        amounts,
      };
    }
  };

  const filteredData = getFilteredData();
  const total = filteredData.amounts.reduce((sum, a) => sum + a, 0).toFixed(2);

  const labels = filteredData.labels;
  const values = filteredData.values;

  const data = {
    labels,
    datasets: [{
      data: values,
      backgroundColor: labels.map((l, i) => {
        if (filterType === 'category') {
          return (COLORS[l] || '#94a3b8') + 'cc';
        }
        const colors = ['#6366f1', '#22c55e', '#a78bfa', '#f59e0b', '#ec4899'];
        return colors[i % colors.length] + 'cc';
      }),
      borderColor: labels.map((l, i) => {
        if (filterType === 'category') {
          return COLORS[l] || '#94a3b8';
        }
        const colors = ['#6366f1', '#22c55e', '#a78bfa', '#f59e0b', '#ec4899'];
        return colors[i % colors.length];
      }),
      borderWidth: 2,
      hoverOffset: 8,
    }],
  };

  const options = {
    responsive: true,
    cutout: '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const amount = filteredData.amounts[ctx.dataIndex];
            return ` ${ctx.label}: ${ctx.parsed}% (${currencySymbol} ${amount.toLocaleString('ar-SA')})`;
          },
        },
      },
    },
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-600 bg-slate-50 focus:outline-none focus:border-indigo-300"
        >
          {filterOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <h3 className="text-base font-bold text-slate-800">تحليل المصاريف</h3>
      </div>

      <div className="flex items-center gap-4 flex-1">
        <div className="flex flex-col gap-3 flex-1">
          {labels.map((label, idx) => (
            <div key={label} className="flex items-center gap-2 justify-end">
              <span className="text-sm text-slate-600">{values[idx]}%</span>
              <span className="text-sm font-semibold text-slate-700">
                {currencySymbol} {parseFloat(filteredData.amounts[idx]).toLocaleString('ar-SA')}
              </span>
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{
                  backgroundColor: filterType === 'category'
                    ? COLORS[label] || '#94a3b8'
                    : ['#6366f1', '#22c55e', '#a78bfa', '#f59e0b', '#ec4899'][idx % 5]
                }}
              />
              <span className="text-sm font-semibold text-slate-700">{label}</span>
            </div>
          ))}
        </div>

        {labels.length > 0 ? (
          <div className="relative w-40 h-40 shrink-0">
            <Doughnut data={data} options={options} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] text-slate-400">الإجمالي</span>
              <span className="text-xs font-bold text-slate-800 leading-tight">
                {parseFloat(total).toLocaleString('ar-SA')}
              </span>
              <span className="text-[10px] text-slate-400">{currencySymbol}</span>
            </div>
          </div>
        ) : (
          <div className="w-40 h-40 flex items-center justify-center text-slate-400 text-sm">
            لا توجد بيانات
          </div>
        )}
      </div>
    </div>
  );
}