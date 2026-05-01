import { useState, useEffect } from 'react';
import {
  HomeIcon,
  CameraIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import Header from './components/Header';
import DashboardCards from './components/DashboardCards';
import LatestInvoices from './components/LatestInvoices';
import ExpensePie from './components/ExpensePie';
import SmartCenter from './components/SmartCenter';
import ScanInvoice from './components/ScanInvoice';
import Reports from './components/Reports';
import Settings from './components/Settings';
import { listenToInvoices } from './store/invoiceStore';

const navItems = [
  { icon: HomeIcon, label: 'الرئيسية', page: 'الرئيسية' },
  { icon: CameraIcon, label: 'مسح فاتورة', page: 'الفواتير' },
  { icon: ChartBarIcon, label: 'التقارير', page: 'التقارير' },
  { icon: Cog6ToothIcon, label: 'الإعدادات', page: 'الإعدادات' },
];

function Sidebar({ activePage, setActivePage, onClose, mobile }) {
  return (
    <aside className={`${mobile ? 'w-64' : 'w-56'} bg-slate-800 text-white flex flex-col py-6 h-screen ${mobile ? '' : 'hidden md:flex'}`}>
      <div className="flex flex-col items-center gap-1 mb-8 px-4">
        {mobile && (
          <button onClick={onClose} className="self-end text-slate-400 hover:text-white mb-2">
            <XMarkIcon className="w-6 h-6" />
          </button>
        )}
                <div className="w-50 h-50  flex items-center justify-center text-3xl mb-1">
          <img src="/logo.png" alt="Logo" className="w-45 h-45 object-contain" onError={(e) => { e.target.style.display='none'; e.target.parentNode.innerHTML='🧾'; }} />
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.page;
          return (
            <button
              key={item.page}
              onClick={() => { setActivePage(item.page); onClose?.(); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all w-full text-right
                ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function App() {
  useEffect(() => {
    listenToInvoices();
  }, []);

  const [isOpen, setIsOpen] = useState(false);
  const [activePage, setActivePage] = useState('الرئيسية');

  const handleViewAll = () => {
    setActivePage('التقارير');
  };

  return (
    <div dir="rtl" className="flex h-screen bg-slate-100 overflow-hidden" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>

      <Sidebar activePage={activePage} setActivePage={setActivePage} />

      {isOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setIsOpen(false)} />
          <div className="relative z-10">
            <Sidebar activePage={activePage} setActivePage={setActivePage} onClose={() => setIsOpen(false)} mobile />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="md:hidden bg-slate-800 text-white flex items-center justify-between px-4 py-3 shrink-0">
          <button onClick={() => setIsOpen(true)}>
            <Bars3Icon className="w-6 h-6" />
          </button>
          <span className="font-bold text-base">سند الذكي</span>
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">ع</div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {activePage === 'الرئيسية' && (
            <div className="max-w-7xl mx-auto">
              <Header />
              <DashboardCards />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                <LatestInvoices onViewAll={handleViewAll} />
                <ExpensePie />
              </div>
              <SmartCenter />
            </div>
          )}
          {activePage === 'الفواتير' && <ScanInvoice />}
          {activePage === 'التقارير' && <Reports />}
          {activePage === 'الإعدادات' && <Settings />}
        </main>
      </div>
    </div>
  );
}

export default App;