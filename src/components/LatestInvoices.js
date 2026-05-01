import { useEffect, useState } from 'react';
import { getInvoices, getCurrencySymbol } from '../store/invoiceStore';

const categoryStyle = {
  نثريات: 'bg-indigo-100 text-indigo-700',
  تشغيلية: 'bg-green-100 text-green-700',
  مكتبية: 'bg-purple-100 text-purple-700',
  ضيافة: 'bg-amber-100 text-amber-700',
};

function StatusBadge({ status }) {
  if (status === 'approved')
    return <span className="w-7 h-7 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-sm font-bold">✓</span>;
  return <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center text-sm font-bold">!</span>;
}

export default function LatestInvoices({ onViewAll }) {
  const [invoices, setInvoices] = useState(getInvoices().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5));
  const [showAll, setShowAll] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState(getCurrencySymbol());

  useEffect(() => {
    const update = () => {
      const allInvoices = getInvoices().sort((a, b) => new Date(b.date) - new Date(a.date));
      setInvoices(showAll ? allInvoices : allInvoices.slice(0, 5));
      setCurrencySymbol(getCurrencySymbol());
    };
    window.addEventListener('sanad_updated', update);
    window.addEventListener('focus', update);
    return () => {
      window.removeEventListener('sanad_updated', update);
      window.removeEventListener('focus', update);
    };
  }, [showAll]);

  const handleViewAll = () => {
    if (onViewAll) {
      onViewAll();
    } else {
      setShowAll(!showAll);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handleViewAll}
          className="text-xs text-indigo-600 font-semibold hover:underline transition-colors"
        >
          {showAll ? 'إخفاء البعض' : 'عرض الكل'}
        </button>
        <h3 className="text-base font-bold text-slate-800">
          {showAll ? 'جميع الفواتير الممسوحة' : 'أحدث الفواتير الممسوحة'}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-slate-400 text-xs border-b border-slate-100">
              <th className="pb-3 font-medium text-right">الحالة</th>
              <th className="pb-3 font-medium text-right">الفئة</th>
              <th className="pb-3 font-medium text-right">المبلغ</th>
              <th className="pb-3 font-medium text-right">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length > 0 ? (
              invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="py-3"><StatusBadge status={inv.status} /></td>
                  <td className="py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${categoryStyle[inv.category] || 'bg-slate-100 text-slate-600'}`}>
                      {inv.category}
                    </span>
                  </td>
                  <td className="py-3 font-bold text-slate-700">
                    {currencySymbol} {parseFloat(inv.amount || 0).toLocaleString('ar-SA')}
                  </td>
                  <td className="py-3 text-slate-400 text-xs whitespace-nowrap">{inv.date}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="py-8 text-center text-slate-500 text-sm">
                  لا توجد فواتير حتى الآن
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}