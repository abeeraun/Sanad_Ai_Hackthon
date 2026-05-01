import { useState, useEffect } from 'react';
import { BellIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getStats, getBudget } from '../store/invoiceStore';

function Header() {
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  
  // --- التعديل هنا: نستخدم State لتخزين القيم بدلاً من استدعائها مباشرة ---
  const [headerStats, setHeaderStats] = useState(getStats());
  const [headerBudget, setHeaderBudget] = useState(getBudget());

  useEffect(() => {
    // تحديث البيانات عند حدوث أي تغيير في التطبيق
    const updateHeaderData = () => {
      setHeaderStats(getStats());
      setHeaderBudget(getBudget());
    };

    window.addEventListener('sanad_updated', updateHeaderData);
    
    const generateNotifications = () => {
      const newNotifications = [];
      const currentStats = getStats();
      const currentBudget = getBudget();

      // Check budget alert
      if (currentBudget > 0) {
        const percentage = (parseFloat(currentStats.total) / currentBudget) * 100;
        if (percentage >= 80 && percentage < 100) {
          newNotifications.push({
            id: 'budget_warning',
            type: 'warning',
            icon: '⚠️',
            title: 'تحذير الميزانية',
            message: `استهلكت ${Math.round(percentage)}% من الميزانية`,
            time: 'الآن'
          });
        } else if (percentage >= 100) {
          newNotifications.push({
            id: 'budget_exceeded',
            type: 'danger',
            icon: '🚨',
            title: 'تجاوزت الميزانية',
            message: `استهلكت ${Math.round(percentage)}% من الميزانية المحددة`,
            time: 'الآن'
          });
        }
      }

      // Check high spending in category
      if (currentStats.catPercentages.length > 0) {
        const topCat = currentStats.catPercentages[0];
        if (topCat.pct > 50) {
          newNotifications.push({
            id: 'high_category',
            type: 'info',
            icon: '📊',
            title: 'إنفاق عالي في الفئة',
            message: `فئة "${topCat.name}" تشكل ${topCat.pct}% من المصاريف`,
            time: 'منذ ساعة'
          });
        }
      }

      // Check new invoices
      if (currentStats.invoiceCount > 0) {
        newNotifications.push({
          id: 'new_invoices',
          type: 'success',
          icon: '✓',
          title: 'فواتير جديدة',
          message: `تمت إضافة ${currentStats.invoiceCount} فاتورة هذا الشهر`,
          time: 'منذ قليل'
        });
      }

      return newNotifications;
    };

    setNotifications(generateNotifications());

    return () => window.removeEventListener('sanad_updated', updateHeaderData);
  }, []); // المصفوفة فارغة لمنع اللوب اللانهائي

  const unreadCount = notifications.length;

  return (
    <div className="flex justify-between items-center mb-6">
      <div className="text-right">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 justify-end">
          مرحباً، عبير <span className="text-2xl">👋</span>
        </h2>
        <p className="text-sm text-slate-500">إليك ملخص أعمالك اليوم</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-lg">ع</div>
       
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-10 h-10 rounded-full bg-white shadow flex items-center justify-center hover:bg-slate-50 transition"
          >
            <BellIcon className="w-5 h-5 text-slate-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute -right-80 top-12 w-96 bg-white rounded-2xl shadow-lg border border-slate-100 z-50 max-h-96 overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex justify-between items-center">
                <button
                  onClick={() => setShowNotifications(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
                <h3 className="font-bold text-slate-800">التنبيهات</h3>
              </div>

              <div className="divide-y divide-slate-100">
                {notifications.length > 0 ? (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 hover:bg-slate-50 cursor-pointer transition ${
                        notif.type === 'danger' ? 'border-l-4 border-red-500' :
                        notif.type === 'warning' ? 'border-l-4 border-orange-500' :
                        notif.type === 'success' ? 'border-l-4 border-green-500' :
                        'border-l-4 border-blue-500'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{notif.icon}</span>
                        <div className="flex-1 text-right">
                          <p className="font-bold text-slate-800 text-sm">{notif.title}</p>
                          <p className="text-xs text-slate-600 mt-1">{notif.message}</p>
                          <p className="text-[10px] text-slate-400 mt-2">{notif.time}</p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-500">
                    <p>لا توجد تنبيهات</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Header;
