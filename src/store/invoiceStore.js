import { db } from '../firebase';
import { ref, onValue } from "firebase/database";
import { create } from 'zustand';

export const useInvoiceStore = create((set) => ({
  invoices: [],
  currency: localStorage.getItem('sanad_currency') || 'YER',
  budget: parseFloat(localStorage.getItem('sanad_budget')) || 0,
 
  setCurrency: (newCurr) => {
    localStorage.setItem('sanad_currency', newCurr);
    set({ currency: newCurr });
    window.dispatchEvent(new Event('sanad_updated'));
  },
 
  setBudget: (newBudget) => {
    localStorage.setItem('sanad_budget', newBudget);
    set({ budget: newBudget });
    window.dispatchEvent(new Event('sanad_updated'));
  },
  addInvoice: (invoice) => set((state) => ({ invoices: [...state.invoices, invoice] })),
}));

const KEY = 'sanad_invoices';
const CURRENCY_KEY = 'sanad_currency';
const BUDGET_KEY = 'sanad_budget';
const NOTIFICATIONS_KEY = 'sanad_notifications';
const HF_TOKEN = "";

const currencies = {
  SAR: { symbol: 'ر.س', name: 'ريال سعودي', rate: 1 },
  USD: { symbol: '$', name: 'دولار أمريكي', rate: 3.75 },
  YER: { symbol: 'ر.ي', name: 'ريال يمني', rate: 250 },
};

// Exchange rates relative to SAR as base
const EXCHANGE_RATES = {
  SAR: { SAR: 1, USD: 0.267, YER: 66.9 },
  USD: { SAR: 3.75, USD: 1, YER: 250 },
  YER: { SAR: 0.01495, USD: 0.004, YER: 1 },
};

export function getCurrentCurrency() {
  return localStorage.getItem(CURRENCY_KEY) || 'YER';
}

export function setCurrency(currency) {
  localStorage.setItem(CURRENCY_KEY, currency);
  window.dispatchEvent(new Event('sanad_updated'));
}

export function getCurrencySymbol() {
  const curr = localStorage.getItem(CURRENCY_KEY) || 'YER';
  return currencies[curr]?.symbol || 'ر.ي';
}

export function getCurrencies() {
  return currencies;
}

export function convertAmount(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return parseFloat(amount);
  const base = parseFloat(amount);
  const rate = EXCHANGE_RATES[fromCurrency]?.[toCurrency] || 1;
  return (base * rate).toFixed(2);
}

// Convert any amount stored in YER to current currency
export function toCurrentCurrency(amount) {
  const stored = 'YER'; // invoices are stored in YER
  const current = getCurrentCurrency();
  if (stored === current) return parseFloat(amount);
  return parseFloat(convertAmount(amount, stored, current));
}

export function getBudget() {
  const saved = localStorage.getItem(BUDGET_KEY);
  return saved ? parseFloat(saved) : 0;
}

export function setBudget(budget) {
  localStorage.setItem(BUDGET_KEY, budget);
  window.dispatchEvent(new Event('sanad_updated'));
}

export function getNotificationSettings() {
  const saved = localStorage.getItem(NOTIFICATIONS_KEY);
  return saved ? JSON.parse(saved) : {
    emailAlerts: false,
    weeklyReport: false,
    budgetWarnings: true,
  };
}

export function setNotificationSettings(settings) {
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event('sanad_updated'));
}

// --- Donut AI Integration ---
export async function extractInvoiceWithDonut(imageBlob) {
  try {
    const response = await fetch(
      'https://api-inference.huggingface.co/models/naver-clova-ix/donut-base-finetuned-docvqa',
      {
        headers: { 
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/octet-stream" 
        },
        method: 'POST',
        body: imageBlob,
      }
    );
    if (!response.ok) return null;
    const result = await response.json();
    const text = result[0]?.generated_text || JSON.stringify(result);
    return {
      storeName: extractStoreName(text),
      totalAmount: extractAmount(text),
      date: extractDate(text),
      category: categorizeByStoreName(text),
      rawResponse: text
    };
  } catch (err) {
    console.error('Donut extraction error:', err);
    return null;
  }
}

function extractStoreName(text) {
  const match = text.match(/(?:store|متجر|محل)[:\s]*([\w\s\u0600-\u06FF]+)/i);
  return match ? match[1].trim() : 'متجر غير معروف';
}

function extractAmount(text) {
  const patterns = [
    /(?:total|الإجمالي|المجموع|المطلوب)[:\s]*(\d+[\.,]\d{1,2})/i,
    /(\d+[\.,]\d{1,2})\s*(?:sar|ر\.س|usd|\$|yer|ر\.ي|ريال)/im,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return parseFloat(match[1].replace(',', '.'));
  }
  return null;
}

function extractDate(text) {
  const patterns = [
    /(\d{4}[-\/]\d{2}[-\/]\d{2})/,
    /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
    /(\d{1,2}\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+\d{4})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return new Date().toLocaleDateString('ar-SA');
}

function categorizeByStoreName(text) {
  if (!text) return 'نثريات';
  const lower = text.toLowerCase();
  const categoryMap = {
    تشغيلية: ['كهرباء', 'وقود', 'مياه', 'غاز', 'أرامكو', 'محطة', 'fuel', 'gas'],
    ضيافة: ['مطعم', 'كافيه', 'قهوة', 'food', 'restaurant', 'cafe', 'coffee'],
    مكتبية: ['مكتبة', 'قرطاسية', 'جرير', 'stationery', 'jarir', 'طباعة', 'print'],
    نثريات: ['بقالة', 'سوبرماركت', 'لولو', 'carrefour', 'panda', 'أسواق'],
  };
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(k => lower.includes(k))) return cat;
  }
  return 'نثريات';
}

export function listenToInvoices() {
  const invoicesRef = ref(db, 'invoices');
  onValue(invoicesRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const list = Object.keys(data).map(key => ({
        id: key,
        ...data[key],
        status: 'approved',
      })).reverse();
      localStorage.setItem(KEY, JSON.stringify(list));
      useInvoiceStore.getState().addInvoice(list);
      window.dispatchEvent(new Event('sanad_updated'));
    }
  });
}

export function getInvoices() {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveInvoice(invoice) {
  const list = getInvoices();
  const newInvoice = {
    id: Date.now(),
    ...invoice,
    status: 'approved',
    scannedAt: new Date().toISOString(),
  };
  list.unshift(newInvoice);
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('sanad_updated'));
  return newInvoice;
}

export const getStats = () => {
  const invoices = getInvoices();
  const currentCurrency = getCurrentCurrency();

  if (invoices.length === 0) {
    return {
      total: '0.00',
      invoiceCount: 0,
      recentAmounts: [0, 0, 0, 0, 0, 0],
      topCategory: 'لا توجد بيانات',
      dailyAvg: '0.00',
      catPercentages: [],
      monthChangePercent: 0,
      forecastDate: null,
      daysElapsed: 0,
      currency: currentCurrency,
    };
  }

  // Convert amounts to current currency
  const convertedInvoices = invoices.map(inv => ({
    ...inv,
    convertedAmount: parseFloat(convertAmount(parseFloat(inv.amount) || 0, 'YER', currentCurrency)),
  }));

  const totalNum = convertedInvoices.reduce((sum, inv) => sum + inv.convertedAmount, 0);

  // Recent 6 amounts for mini chart (use last 6 invoices)
  const recent = convertedInvoices.slice(0, 6).reverse();
  const recentAmounts = recent.length >= 2
    ? recent.map(inv => inv.convertedAmount)
    : [...Array(6 - recent.length).fill(0), ...recent.map(inv => inv.convertedAmount)];

  // Category totals
  const categoryTotals = {};
  convertedInvoices.forEach((inv) => {
    const cat = inv.category || 'نثريات';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + inv.convertedAmount;
  });

  const catPercentages = Object.entries(categoryTotals)
    .map(([name, amount]) => ({
      name,
      pct: Math.round((amount / totalNum) * 100),
      amount: amount.toFixed(2),
    }))
    .sort((a, b) => b.pct - a.pct);

  // Month change
  const now = new Date();
  const thisMonthInvoices = convertedInvoices.filter(inv => {
    const d = new Date(inv.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonthInvoices = convertedInvoices.filter(inv => {
    const d = new Date(inv.date);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
    return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
  });

  const thisMonthTotal = thisMonthInvoices.reduce((s, i) => s + i.convertedAmount, 0);
  const lastMonthTotal = lastMonthInvoices.reduce((s, i) => s + i.convertedAmount, 0);
  const monthChangePercent = lastMonthTotal > 0
    ? parseFloat(((thisMonthTotal - lastMonthTotal) / lastMonthTotal * 100).toFixed(1))
    : 0;

  // Daily average & forecast
  const daysElapsed = now.getDate();
  const dailyAvg = daysElapsed > 0 ? (thisMonthTotal / daysElapsed) : 0;
  const budget = getBudget();
  let forecastDate = null;
  if (budget > 0 && dailyAvg > 0) {
    const remainingBudget = budget - thisMonthTotal;
    if (remainingBudget > 0) {
      const daysLeft = Math.ceil(remainingBudget / dailyAvg);
      const forecastD = new Date(now);
      forecastD.setDate(now.getDate() + daysLeft);
      forecastDate = forecastD.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' });
    } else {
      forecastDate = 'تجاوزت الميزانية';
    }
  }

  return {
    total: totalNum.toFixed(2),
    invoiceCount: invoices.length,
    recentAmounts,
    topCategory: catPercentages[0]?.name || 'نثريات',
    dailyAvg: dailyAvg.toFixed(2),
    catPercentages,
    monthChangePercent,
    forecastDate,
    daysElapsed,
    thisMonthTotal: thisMonthTotal.toFixed(2),
    currency: currentCurrency,
  };
};

export const generateInsights = () => {
  const stats = getStats();
  const invoices = getInvoices();
  const budget = getBudget();
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysElapsed = now.getDate();
  const daysRemaining = daysInMonth - daysElapsed;
  const currentCurrency = getCurrentCurrency();
  const symbol = getCurrencySymbol();

  const thisMonthInvoices = invoices.filter(inv => {
    const d = new Date(inv.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const thisMonthTotal = parseFloat(stats.thisMonthTotal || 0);
  const dailyAvg = parseFloat(stats.dailyAvg || 0);
  const projectedMonthEnd = dailyAvg * daysInMonth;

  const observations = [];

  // Budget observations
  if (budget > 0) {
    const budgetPct = Math.round((thisMonthTotal / budget) * 100);
    if (budgetPct >= 100) {
      observations.push({
        icon: '🚨',
        text: `تجاوزت ميزانية الشهر بنسبة ${budgetPct - 100}%. يُنصح بمراجعة المصاريف فوراً.`,
        color: 'text-red-600',
      });
    } else if (budgetPct >= 80) {
      observations.push({
        icon: '⚠️',
        text: `استهلكت ${budgetPct}% من ميزانيتك خلال ${daysElapsed} يوماً فقط، لديك ${daysRemaining} يوم متبقية.`,
        color: 'text-orange-500',
      });
    } else {
      observations.push({
        icon: '✅',
        text: `أنت على المسار الصحيح. استهلكت ${budgetPct}% من الميزانية في ${daysElapsed} يوماً.`,
        color: 'text-green-600',
      });
    }

    if (stats.forecastDate && stats.forecastDate !== 'تجاوزت الميزانية') {
      observations.push({
        icon: '📅',
        text: `بناءً على معدل إنفاقك الحالي (${symbol} ${dailyAvg.toLocaleString('ar-SA')} / يوم)، ستستهلك ميزانيتك بحلول ${stats.forecastDate}.`,
        color: 'text-blue-600',
      });
    }
  }

  // Top category insight
  if (stats.catPercentages.length > 0) {
    const topCat = stats.catPercentages[0];
    if (topCat.pct > 50) {
      observations.push({
        icon: '📊',
        text: `فئة "${topCat.name}" تستحوذ على ${topCat.pct}% من إجمالي المصاريف — يُنصح بمراجعة هذه الفئة.`,
        color: 'text-purple-600',
      });
    }
  }

  // Weekly spending pattern
  if (thisMonthInvoices.length >= 3) {
    const weeklySpend = (dailyAvg * 7).toFixed(2);
    observations.push({
      icon: '📈',
      text: `متوسط إنفاقك الأسبوعي ${symbol} ${parseFloat(weeklySpend).toLocaleString('ar-SA')}. المتوقع بنهاية الشهر: ${symbol} ${Math.round(projectedMonthEnd).toLocaleString('ar-SA')}.`,
      color: 'text-indigo-600',
    });
  }

  // Invoice frequency
  if (thisMonthInvoices.length > 0) {
    const invoicesPerDay = (thisMonthInvoices.length / daysElapsed).toFixed(1);
    observations.push({
      icon: '🧾',
      text: `سجّلت ${thisMonthInvoices.length} فاتورة هذا الشهر، بمعدل ${invoicesPerDay} فاتورة يومياً.`,
      color: 'text-slate-600',
    });
  }

  // Month-over-month
  if (stats.monthChangePercent !== 0) {
    const arrow = stats.monthChangePercent > 0 ? '↑' : '↓';
    const changeText = stats.monthChangePercent > 0
      ? `ارتفعت مصاريفك بنسبة ${Math.abs(stats.monthChangePercent)}% مقارنة بالشهر الماضي ${arrow}`
      : `انخفضت مصاريفك بنسبة ${Math.abs(stats.monthChangePercent)}% مقارنة بالشهر الماضي ${arrow} — أداء ممتاز!`;
    observations.push({
      icon: stats.monthChangePercent > 0 ? '📉' : '🎉',
      text: changeText,
      color: stats.monthChangePercent > 0 ? 'text-orange-500' : 'text-green-600',
    });
  }

  if (observations.length === 0) {
    observations.push({
      icon: '💡',
      text: 'ابدأ بمسح فواتيرك لتحصل على تحليلات ذكية مخصصة لك.',
      color: 'text-slate-500',
    });
  }

  // Main recommendation
  let recommendation = `يمكنك توفير مبالغ جيدة بتقليل مصروفات فئة "${stats.topCategory}".`;
  if (budget > 0 && thisMonthTotal > 0) {
    const budgetPct = Math.round((thisMonthTotal / budget) * 100);
    if (budgetPct >= 80) {
      recommendation = `لقد استهلكت ${budgetPct}% من ميزانيتك. حاول تقليل المصاريف في فئة "${stats.topCategory}" التي تشكّل ${stats.catPercentages[0]?.pct || 0}% من إجمالي إنفاقك.`;
    } else if (stats.forecastDate) {
      recommendation = `بمعدل إنفاقك الحالي، ستنفد ميزانيتك بحلول ${stats.forecastDate}. يُنصح بخفض إنفاق "${stats.topCategory}" للحفاظ على ميزانيتك حتى نهاية الشهر.`;
    }
  }

  const details = observations.map(o => o.text);

  return { recommendation, observations, details };
};