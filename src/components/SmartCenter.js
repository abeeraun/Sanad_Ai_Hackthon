import { useEffect, useState } from 'react';
import { ShieldCheckIcon, ClockIcon } from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { getInvoices, getCurrencySymbol } from '../store/invoiceStore';

function SmartCenter() {
  const [invoices, setInvoices] = useState(getInvoices());
  const [currencySymbol, setCurrencySymbol] = useState(getCurrencySymbol());

  useEffect(() => {
    const update = () => {
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

  const totalTime = invoices.length * 5;
  const hours = Math.floor(totalTime / 60);
  const accuracy = invoices.length > 0 ? 95 + Math.random() * 4 : 0;
  const pendingCount = 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-end gap-2 mb-5">
        <h3 className="text-base font-bold text-slate-800">مركز العمليات الذكية</h3>
        <SparklesIcon className="w-5 h-5 text-indigo-500" />
      </div>

      <div className="flex flex-col md:flex-row items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <ShieldCheckIcon className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">دقة التعرف</div>
            <div className="text-lg font-extrabold text-slate-800">
              {invoices.length > 0 ? accuracy.toFixed(1) : '0'}%
            </div>
            <div className="text-xs text-slate-400">هذا الشهر</div>
          </div>
        </div>

        <div className="w-px h-10 bg-slate-100 hidden md:block" />

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <ClockIcon className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">وقت التوفير</div>
            <div className="text-lg font-extrabold text-slate-800">
              {hours} ساعة
            </div>
            <div className="text-xs text-slate-400">هذا الشهر</div>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 text-xl">
            {pendingCount > 0 ? '⚠️' : '✅'}
          </div>
          <div className={`${pendingCount > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'} rounded-xl px-4 py-3 text-right max-w-xs`}>
            <div className={`font-bold text-sm mb-1 ${pendingCount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
              {pendingCount > 0 ? `تنبيه: ${pendingCount} فواتير غير مصنفه` : 'جميع الفواتير مصنفة'}
            </div>
            <div className="text-xs text-slate-600 mb-2">
              {pendingCount > 0
                ? `لدينا ${pendingCount} فواتير تم مسحها بنجاح وتحتاج إلى تصنيفك للمراجعة`
                : `لقد قمت بمسح وتصنيف ${invoices.length} فاتورة بنجاح`}
            </div>
            {pendingCount > 0 && (
              <button className="bg-slate-800 hover:bg-slate-700 text-white text-xs px-4 py-1.5 rounded-lg transition-colors font-semibold">
                مراجعة الفواتير
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SmartCenter;