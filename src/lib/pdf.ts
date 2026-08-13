import { toast } from "sonner";

export async function generatePDF(elementId: string, filename: string = 'document.pdf') {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element with id ${elementId} not found`);
  }

  // التحقق مما إذا كان التطبيق يعمل داخل نافذة مضمنة (iframe) مثل بيئة المعاينة
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch (e) {
    inIframe = true;
  }

  if (inIframe) {
    toast.error("لا يمكن تصدير الـ PDF من داخل نافذة المعاينة", {
      description: "يرجى فتح التطبيق في علامة تبويب جديدة (New Tab) باستخدام الرابط أعلى الشاشة لتتمكن من استخراج الملف.",
      duration: 10000,
    });
    return;
  }

  // إنشاء عنصر ستايل لإخفاء كل شيء في الصفحة باستثناء العنصر المراد طباعته
  const style = document.createElement('style');
  style.innerHTML = `
    @media print {
      body > *:not(#print-wrapper) {
        display: none !important;
      }
      #print-wrapper {
        display: block !important;
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        background: white;
      }
      @page {
        size: a4 portrait;
        margin: 15mm;
      }
      body {
        background-color: white !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
        break-after: avoid;
      }
      li, tr, td, .avoid-break {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  `;
  document.head.appendChild(style);

  // نسخ محتوى العنصر إلى حاوية جديدة في الـ body مباشرة
  const wrapper = document.createElement('div');
  wrapper.id = 'print-wrapper';
  wrapper.className = 'print:block hidden'; // مخفي في العرض العادي، ظاهر في الطباعة
  wrapper.innerHTML = element.outerHTML;
  document.body.appendChild(wrapper);

  // تحديث عنوان الصفحة مؤقتاً ليكون اسم الملف عند الحفظ
  const originalTitle = document.title;
  document.title = filename.replace('.pdf', '');

  // الانتظار قليلاً لضمان تطبيق التنسيقات ثم فتح نافذة الطباعة
  setTimeout(() => {
    window.print();
    
    // تنظيف الصفحة بعد الطباعة
    document.title = originalTitle;
    document.head.removeChild(style);
    document.body.removeChild(wrapper);
  }, 100);
}
