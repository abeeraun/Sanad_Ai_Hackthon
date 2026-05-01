import { useState, useRef, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import {
  CameraIcon, ArrowUpTrayIcon, XMarkIcon,
  DocumentTextIcon, CheckCircleIcon, ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { SparklesIcon } from '@heroicons/react/24/solid';
import { extractInvoiceWithDonut, saveInvoice } from '../store/invoiceStore';
import {db} from '../firebase';
import { ref, push, set } from "firebase/database";
import {CloudArrowUpIcon,CheckIcon} from '@heroicons/react/24/outline';

// ── image pre-processing ──────────────────────────────────────────────────────
function preprocessImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(2400 / img.width, 2400 / img.height, 2);
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');

      // رسم الصورة مكبّرة
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // تحويل لـ grayscale + رفع التباين
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        // رفع التباين
        const contrast = Math.min(255, Math.max(0, (gray - 128) * 1.5 + 128));
        d[i] = d[i+1] = d[i+2] = contrast;
      }
      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob);
      }, 'image/png');
    };
    img.src = url;
  });
}

// ── invoice detection ─────────────────────────────────────────────────────────
function isLikelyInvoice(text) {
  if (text.trim().length < 15) return false;
  const keywords = [
    // عربي عام
    'فاتورة','فاتوره','المجموع','الإجمالي','اجمالي','مجموع','ضريبة',
    'مبلغ','سعر','قيمة','ر.س','ريال','رس','هللة','جنيه','جنيها',
    'كمية','وصف','بند','تاريخ','رقم','دفع','نقد','بطاقة','إيصال',
    // مصري / كهرباء
    'كهرباء','كهربساء','استهلاك','الاستهلاك','فرع','محاسبة','عداد',
    'اللوحة','الإصدار','مطلوب','سداد','أقساط','نظافة','خدمة عملاء',
    'القدرة','المتعاقدية','التحصيل','الرقم القومي',
    // إنجليزي
    'invoice','receipt','total','subtotal','vat','tax','amount',
    'price','qty','quantity','payment','cash','card','sar','bill','ref',
  ];
  const lower = text.toLowerCase();
  if (keywords.some((k) => lower.includes(k))) return true;
  const numbers = text.match(/\d+[\.,]\d+/g);
  if (numbers && numbers.length >= 2) return true;
  return false;
}

// ── data extraction ───────────────────────────────────────────────────────────
function extractInvoiceData(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // المبلغ
  const amountPatterns = [
    /(?:الإجمالي|اجمالي|المجموع|مجموع|مطلوب\s*سداده?|المطلوب|total|grand\s*total)[^\d]*(\d[\d,\.]+)/i,
    /(\d[\d,\.]+)\s*(?:ر\.س|sar|رس|ريال|جنيه|sr)\b/i,
    /(?:ر\.س|sar|رس|ريال|جنيه)\s*(\d[\d,\.]+)/i,
  ];
  let amount = null;
  for (const p of amountPatterns) {
    const m = text.match(p);
    if (m) { amount = m[1].replace(/,/g, ''); break; }
  }
  if (!amount) {
    const nums = [...text.matchAll(/(\d+[\.,]\d{1,2})/g)]
      .map((m) => parseFloat(m[1].replace(',', '.')))
      .filter((n) => n > 1 && n < 999999);
    if (nums.length) amount = nums[nums.length - 1].toFixed(2);
  }

  // التاريخ
const datePatterns = [
  /(\d{4}[-\/]\d{2}[-\/]\d{2})/, // 2030-12-22
  /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/, // 22/12/2030
  /(\d{1,2}\s+(يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)\s+\d{4})/ // 22 ديسمبر 2030
];

let date = new Date().toLocaleDateString('ar-SA'); // التاريخ الافتراضي

for (const p of datePatterns) { 
  const m = text.match(p); 
  if (m) { 
    date = m[0]; 
    break; 
  } 
}


  // رقم الفاتورة
  const invMatch = text.match(/(?:رقم\s*الفاتورة|رقم\s*فاتورة|invoice\s*#?|inv\s*#?|receipt\s*#?|ref\s*#?)[^\d]*(\w+)/i);

  // الفئة
  const categoryMap = {
    تشغيلية: ['كهرباء','كهربساء','وقود','محطة','fuel','gas','أرامكو','aramco','اتصالات','stc','zain','mobily','مياه','غاز'],
    ضيافة:   ['مطعم','كافيه','restaurant','cafe','coffee','قهوة','food','مكدونالدز','kfc','burger','pizza','herfy','هرفي'],
    مكتبية:  ['مكتبة','قرطاسية','stationery','jarir','جرير','طباعة','print'],
    نثريات:  ['بقالة','سوبرماركت','grocery','supermarket','hypermarket','lulu','carrefour','danube','panda','أسواق'],
  };
  let category = 'نثريات';
  const lower = text.toLowerCase();
  for (const [cat, kws] of Object.entries(categoryMap)) {
    if (kws.some((k) => lower.includes(k))) { category = cat; break; }
  }

  return {
    amount: amount ? parseFloat(amount).toFixed(2) : null,
    date,
    invoiceNumber: invMatch ? invMatch[1] : null,
    category,
    rawText: lines.slice(0, 6).join(' | '),
  };
}

// ── stages ────────────────────────────────────────────────────────────────────
const STAGES = {
  idle:        { label: '',                        pct: 0   },
  processing:  { label: 'تحسين جودة الصورة…',      pct: 20  },
  recognizing: { label: 'قراءة النصوص بالذكاء الاصطناعي…', pct: 60 },
  analyzing:   { label: 'تحليل بيانات الفاتورة…',  pct: 90  },
  done:        { label: 'اكتمل!',                  pct: 100 },
};

// ── main component ────────────────────────────────────────────────────────────
export default function ScanInvoice() {
  const [image, setImage]         = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [stage, setStage]         = useState('idle');
  const [progress, setProgress]   = useState(0);
  const [result, setResult]       = useState(null);
  const [saved, setSaved]         = useState(false);
  const [dragOver, setDragOver]   = useState(false);
  const [editableData, setEditableData] = useState({amount: '', date: '', category: '',invoiceNumber: ''});

  const fileInputRef   = useRef();
  const cameraInputRef = useRef();

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImageFile(file);
    setResult(null); setSaved(false); setStage('idle');
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  const onFileChange = (e) => handleFile(e.target.files[0]);
  const onDrop       = (e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); };

  const runOCR = async () => {
    if (!imageFile) return;
    setStage('processing'); setProgress(20);
    setResult(null); setSaved(false);
    try {
      // تحسين الصورة
      const processed = await preprocessImage(imageFile);
      setStage('recognizing'); setProgress(40);

      const { data: { text } } = await Tesseract.recognize(processed, 'ara+eng',{
        tessedit_pageseg_mode:6,
        tessedit_ocr_engine_mode:3 ,
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(40 + Math.round(m.progress * 40));
          }
        },
      });

      setStage('analyzing'); setProgress(90);

      const isInvoice = isLikelyInvoice(text);
      let data = isInvoice ? extractInvoiceData(text) : null;
      if(data && !data.amount){
        const backupData = await extractInvoiceWithDonut(processed);
        if (backupData && backupData.totalAmount) {
          data.amount=backupData.totalAmount.toFixed(2);
        }
        const nums =[...text.matchAll(/(\d+[\.,]\d+)/g)]
        .map(m => parseFloat(m[1].replace(',','.')))
        .filter(n=>n>1);
        if(nums.length){
          data.amount=nums.sort((a,b)=>b-a)[0].toFixed(2)
        }
      }

      setTimeout(() => {
        setStage('done'); setProgress(100);
        setResult({ isInvoice, data, rawText: text });
      }, 300);
      if (data) setEditableData(data);

    } catch (err) {
      console.error(err);
      setStage('idle'); setProgress(0);
      setResult({ isInvoice: false, error: true });
    }
  };

      const handleSave = async () => {
    if (!result?.data) return;
    
    try {
      const invoicesRef = ref(db, 'invoices');
      const newInvoiceRef = push(invoicesRef); 

      await set(newInvoiceRef, {
        amount: editableData.amount || result.data.amount,
        category: editableData.category || result.data.category,
        date: editableData.date || result.data.date,
        invoiceNumber: editableData.invoiceNumber || result.data.invoiceNumber || "N/A",
        createdAt: new Date().toISOString()
      });

      setSaved(true);
      window.dispatchEvent(new Event('sanad_updated'));
      
    } catch (error) {
      console.error("Firebase Save Error:", error);
      alert("خطأ في الاتصال بالسحابة، يرجى التحقق من القواعد.");
    }
  };



  const reset = () => {
    setImage(null); setImageFile(null);
    setStage('idle'); setProgress(0);
    setResult(null); setSaved(false);
  };

  const scanning = stage !== 'idle' && stage !== 'done';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800">مسح فاتورة</h2>
        <p className="text-sm text-slate-500 mt-1">ارفع صورة الفاتورة وسنستخرج بياناتها تلقائياً</p>
      </div>

      {!image ? (
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => fileInputRef.current.click()}
          className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 transition-all cursor-pointer
            ${dragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-300 bg-white hover:border-indigo-300 hover:bg-slate-50'}`}
        >
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center">
            <DocumentTextIcon className="w-8 h-8 text-indigo-500" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-slate-700">اسحب الصورة هنا أو انقر للاختيار</p>
            <p className="text-sm text-slate-400 mt-1">PNG · JPG · WEBP — حتى 10MB</p>
          </div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={(e) => { e.stopPropagation(); fileInputRef.current.click(); }}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <ArrowUpTrayIcon className="w-4 h-4" /> رفع صورة
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); cameraInputRef.current.click(); }}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            >
              <CameraIcon className="w-4 h-4" /> كاميرا
            </button>
          </div>
          <input ref={fileInputRef}   type="file" accept="image/*"           className="hidden" onChange={onFileChange} />
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
        </div>

      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* معاينة الصورة */}
          <div className="relative">
            <img src={image} alt="preview" className="w-full max-h-80 object-contain bg-slate-50 p-4" />
            {!scanning && (
              <button onClick={reset} className="absolute top-3 left-3 w-8 h-8 bg-white rounded-full shadow flex items-center justify-center hover:bg-red-50">
                <XMarkIcon className="w-4 h-4 text-slate-500" />
              </button>
            )}
          </div>

          {/* شريط التقدم */}
          {scanning && (
            <div className="px-6 py-4 border-t border-slate-100">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>{progress}%</span>
                <span>{STAGES[stage]?.label}</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {/* زر المسح */}
          {stage === 'idle' && (
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
              <button onClick={runOCR} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                <SparklesIcon className="w-4 h-4" /> استخراج البيانات
              </button>
            </div>
          )}

          {/* النتائج */}
          {stage === 'done' && result && (
            <div className="px-6 py-5 border-t border-slate-100">
              {!result.isInvoice ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
                    <ExclamationCircleIcon className="w-7 h-7 text-red-500" />
                  </div>
                  <p className="text-base font-bold text-slate-800">لم يتم التعرف على الفاتورة</p>
                  <p className="text-sm text-slate-500 text-center">
                    تأكد أن الصورة واضحة وغير مائلة.<br />يمكنك المحاولة مرة أخرى بصورة أوضح.
                  </p>
                  {/* النص المستخرج للمساعدة في التشخيص */}
                  {result.rawText && (
                    <details className="w-full text-xs text-slate-400 mt-2">
                      <summary className="cursor-pointer text-indigo-500">عرض النص المستخرج</summary>
                      <pre className="mt-2 bg-slate-50 rounded-lg p-3 whitespace-pre-wrap text-right leading-relaxed max-h-40 overflow-y-auto">
                        {result.rawText}
                      </pre>
                    </details>
                  )}
                  <button onClick={reset} className="mt-1 bg-slate-800 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors">
                    مسح فاتورة أخرى
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    <span className="font-bold text-slate-800">تم التعرف على الفاتورة بنجاح ✓</span>
                  </div>
              <div className="grid grid-cols-2 gap-3 mb-4 text-right">
  {/* حقل المبلغ */}
  <div className="rounded-xl p-3 bg-indigo-50 border border-indigo-100">
    <label className="text-xs text-slate-400 mb-1 block">المبلغ الإجمالي</label>
    <div className="flex items-center gap-1">
       <input 
        type="text"
        value={editableData.amount || ''}
        onChange={(e) => setEditableData({...editableData, amount: e.target.value})}
        className="bg-transparent font-bold text-indigo-700 text-lg w-full text-right outline-none"
      />
      <span className="text-indigo-700 font-bold">ر.ي</span>
    </div>
  </div>

  {/* حقل الفئة */}
  <div className="rounded-xl p-3 bg-slate-50">
    <label className="text-xs text-slate-400 mb-1 block">الفئة</label>
    <select 
      value={editableData.category || 'نثريات'}
      onChange={(e) => setEditableData({...editableData, category: e.target.value})}
      className="bg-transparent font-bold text-slate-700 w-full text-right outline-none"
    >
      <option value="تشغيلية">تشغيلية</option>
      <option value="ضيافة">ضيافة</option>
      <option value="مكتبية">مكتبية</option>
      <option value="نثريات">نثريات</option>
    </select>
  </div>

  {/* حقل التاريخ */}
  <div className="rounded-xl p-3 bg-slate-50">
    <label className="text-xs text-slate-400 mb-1 block">التاريخ</label>
    <input 
      type="text"
      value={editableData.date || ''}
      onChange={(e) => setEditableData({...editableData, date: e.target.value})}
      className="bg-transparent font-bold text-slate-700 w-full text-right outline-none"
    />
  </div>

  {/* حقل رقم الفاتورة */}
  <div className="rounded-xl p-3 bg-slate-50">
              <label className="text-xs text-slate-400 mb-1 block">رقم الفاتورة</label>
              <input 
                type="text"
                value={editableData.invoiceNumber || ''}
                onChange={(e) => setEditableData({...editableData, invoiceNumber: e.target.value})}
                className="bg-transparent font-bold text-slate-700 w-full text-right outline-none"
              />
            </div>
          </div>


                  {/* النص الخام للمراجعة */}
                  <details className="mb-4 text-xs text-slate-400">
                    <summary className="cursor-pointer text-indigo-500 mb-1">عرض النص المستخرج كاملاً</summary>
                    <pre className="bg-slate-50 rounded-lg p-3 whitespace-pre-wrap text-right leading-relaxed max-h-40 overflow-y-auto">
                      {result.rawText}
                    </pre>
                  </details>

                  <div className="flex gap-3 justify-end">
                    <button onClick={reset} className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">
                      مسح فاتورة أخرى
                    </button>
                    {!saved ? (
                      <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors">
                        <CheckCircleIcon className="w-4 h-4" /> حفظ الفاتورة
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-green-100 text-green-700">
                        <CheckCircleIcon className="w-4 h-4" /> تم الحفظ!
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}