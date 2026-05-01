import { useState, useEffect } from 'react';
import {
  CurrencyDollarIcon,
  BellIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import {
  getBudget,
  setBudget,
  getCurrentCurrency,
  setCurrency,
  getCurrencySymbol,
  getStats,
  getNotificationSettings,
  setNotificationSettings,
} from '../store/invoiceStore';

const CURRENCIES = [
  { code: 'SAR', label: 'ريال سعودي', symbol: 'ر.س', flag: '🇸🇦' },
  { code: 'USD', label: 'دولار أمريكي', symbol: '$', flag: '🇺🇸' },
  { code: 'YER', label: 'ريال يمني', symbol: 'ر.ي', flag: '🇾🇪' },
];

function Toggle({ checked, onChange }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-indigo-600' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 mt-0.5 ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

export default function Settings() {
  const [budget, setBudgetState] = useState(getBudget());
  const [budgetInput, setBudgetInput] = useState(getBudget().toString());
  const [currency, setCurrencyState] = useState(getCurrentCurrency());
  const [notifications, setNotifications] = useState(getNotificationSettings());
  const [stats, setStats] = useState(getStats());
  const [savedMsg, setSavedMsg] = useState('');
  const [budgetSaved, setBudgetSaved] = useState(false);

  useEffect(() => {
    const update = () => {
      setStats(getStats());
      setBudgetState(getBudget());
      setCurrencyState(getCurrentCurrency());
    };
    window.addEventListener('sanad_updated', update);
    return () => window.removeEventListener('sanad_updated', update);
  }, []);

  const handleCurrencyChange = (code) => {
    setCurrencyState(code);
    setCurrency(code); // updates localStorage + fires event
    setSavedMsg('تم تغيير العملة بنجاح ✓');
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const handleBudgetSave = () => {
    const val = parseFloat(budgetInput);
    if (isNaN(val) || val < 0) return;
    setBudget(val);
    setBudgetState(val);
    setBudgetSaved(true);
    setSavedMsg('تم حفظ الميزانية بنجاح ✓');
    setTimeout(() => { setSavedMsg(''); setBudgetSaved(false); }, 2500);
  };

  const handleNotificationChange = (key, value) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    setNotificationSettings(updated);
    const labels = {
      emailAlerts: 'تنبيهات البريد الإلكتروني',
      weeklyReport: 'التقرير الأسبوعي',
      budgetWarnings: 'تحذيرات تجاوز الميزانية',
    };
    setSavedMsg(`${value ? '✓ تم تفعيل' : '✗ تم إيقاف'} ${labels[key]}`);
    setTimeout(() => setSavedMsg(''), 2500);
  };

  const symbol = CURRENCIES.find(c => c.code === currency)?.symbol || 'ر.ي';
  const budgetNum = parseFloat(budget) || 0;
  const totalSpent = parseFloat(stats.thisMonthTotal || stats.total || 0);
  const budgetPct = budgetNum > 0 ? Math.min(100, Math.round((totalSpent / budgetNum) * 100)) : 0;
  const remaining = Math.max(0, budgetNum - totalSpent);

  return (
    <div className="max-w-2xl mx-auto" dir="rtl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">الإعدادات</h2>
        <p className="text-sm text-slate-500 mt-1">تخصيص التطبيق وفق احتياجاتك</p>
      </div>

      {/* Toast */}
      {savedMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-lg text-sm font-semibold flex items-center gap-2 animate-bounce">
          <CheckCircleIcon className="w-4 h-4" />
          {savedMsg}
        </div>
      )}

      {/* ── Currency ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
        <div className="flex items-center gap-3 mb-4 justify-end">
          <h3 className="text-base font-bold text-slate-800">العملة الافتراضية</h3>
          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
            <CurrencyDollarIcon className="w-5 h-5 text-indigo-600" />
          </div>
        </div>
        <p className="text-xs text-slate-400 mb-4 text-right">
          سيتم تحويل جميع المبالغ في التطبيق تلقائياً حسب العملة المختارة.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              onClick={() => handleCurrencyChange(c.code)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                currency === c.code
                  ? 'border-indigo-500 bg-indigo-50 shadow-md'
                  : 'border-slate-100 bg-slate-50 hover:border-indigo-200'
              }`}
            >
              <span className="text-2xl">{c.flag}</span>
              <span className="text-sm font-bold text-slate-700">{c.symbol}</span>
              <span className="text-xs text-slate-500">{c.label}</span>
              {currency === c.code && (
                <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full">محدد</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Budget ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
        <div className="flex items-center gap-3 mb-4 justify-end">
          <h3 className="text-base font-bold text-slate-800">الميزانية الشهرية</h3>
          <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center">
            <ShieldCheckIcon className="w-5 h-5 text-green-600" />
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={handleBudgetSave}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            حفظ
          </button>
          <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-xl px-3 bg-slate-50">
            <span className="text-slate-400 text-sm">{symbol}</span>
            <input
              type="number"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleBudgetSave()}
              placeholder="أدخل الميزانية الشهرية"
              className="flex-1 bg-transparent py-2.5 text-right text-sm font-semibold text-slate-700 outline-none"
            />
          </div>
        </div>

        {budgetNum > 0 && (
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex justify-between items-center text-xs text-slate-500 mb-2">
              <span className={`font-semibold ${budgetPct >= 100 ? 'text-red-600' : budgetPct >= 80 ? 'text-orange-500' : 'text-green-600'}`}>
                {budgetPct}% مُستهلَك
              </span>
              <span>الميزانية: {symbol} {budgetNum.toLocaleString('ar-SA')}</span>
            </div>
            <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-orange-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(100, budgetPct)}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-3 text-right">
                <div className="text-xs text-slate-400 mb-1">المصروف حتى الآن</div>
                <div className="text-sm font-bold text-slate-700">{symbol} {totalSpent.toLocaleString('ar-SA')}</div>
              </div>
              <div className="bg-white rounded-lg p-3 text-right">
                <div className="text-xs text-slate-400 mb-1">المتبقي</div>
                <div className={`text-sm font-bold ${remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {symbol} {remaining.toLocaleString('ar-SA')}
                </div>
              </div>
            </div>
            {stats.forecastDate && (
              <div className={`mt-3 text-xs text-right font-semibold px-3 py-2 rounded-lg ${
                budgetPct >= 80 ? 'bg-orange-50 text-orange-600' : 'bg-blue-50 text-blue-600'
              }`}>
                {stats.forecastDate === 'تجاوزت الميزانية'
                  ? '🚨 لقد تجاوزت الميزانية المحددة'
                  : `📅 التوقع: ستستهلك ميزانيتك بحلول ${stats.forecastDate}`}
              </div>
            )}
          </div>
        )}

        {budgetNum === 0 && (
          <p className="text-xs text-slate-400 text-right">
            حدد ميزانية شهرية لتفعيل تنبيهات الإنفاق والتوقعات الذكية.
          </p>
        )}
      </div>

      {/* ── Notifications ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
        <div className="flex items-center gap-3 mb-4 justify-end">
          <h3 className="text-base font-bold text-slate-800">التنبيهات</h3>
          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
            <BellIcon className="w-5 h-5 text-amber-500" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <Toggle
              checked={notifications.emailAlerts}
              onChange={(v) => handleNotificationChange('emailAlerts', v)}
            />
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-700">تنبيهات البريد الإلكتروني</div>
              <div className="text-xs text-slate-400">استلام إشعارات على بريدك عند كل فاتورة جديدة</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <Toggle
              checked={notifications.weeklyReport}
              onChange={(v) => handleNotificationChange('weeklyReport', v)}
            />
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-700">التقرير الأسبوعي</div>
              <div className="text-xs text-slate-400">ملخص أسبوعي بمصاريفك وتحليلاتك</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <Toggle
              checked={notifications.budgetWarnings}
              onChange={(v) => handleNotificationChange('budgetWarnings', v)}
            />
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-700">تحذيرات تجاوز الميزانية</div>
              <div className="text-xs text-slate-400">
                تنبيه عند الوصول لـ 80% و100% من الميزانية
                {!budgetNum && <span className="text-orange-500"> (يتطلب تحديد ميزانية)</span>}
              </div>
            </div>
          </div>
        </div>

        {notifications.weeklyReport && (
          <div className="mt-3 bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-right text-xs text-indigo-700 font-semibold">
            ✓ سيتم إرسال تقرير أسبوعي كل يوم أحد بملخص مصاريفك.
          </div>
        )}
        {notifications.emailAlerts && (
          <div className="mt-3 bg-green-50 border border-green-100 rounded-xl p-3 text-right text-xs text-green-700 font-semibold">
            ✓ التنبيهات الفورية مفعّلة — ستصلك إشعارات عند كل عملية مسح.
          </div>
        )}
      </div>

      {/* ── App Info ── */}
      <div className="bg-slate-50 rounded-2xl p-5 text-right">
        <p className="text-xs text-slate-400 font-semibold mb-1">سند الذكي — نظام إدارة الفواتير</p>
        <p className="text-xs text-slate-400">الإصدار 1.0.0 • مدعوم بالذكاء الاصطناعي</p>
      </div>
    </div>
  );
}