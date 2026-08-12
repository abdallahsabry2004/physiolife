import html2pdf from 'html2pdf.js';

/**
 * دالة مساعدة لتصدير أي عنصر HTML إلى ملف PDF
 * @param elementId الـ ID الخاص بالحاوية المراد طباعتها
 * @param filename اسم الملف عند التحميل
 */
export const generatePDF = async (elementId: string, filename: string = 'document.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  // إعدادات الـ PDF الاحترافية
  const opt = {
    margin: 10, // هوامش 10 مليمتر من كل الاتجاهات
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 }, // جودة صورة عالية
    html2canvas: { 
      scale: 2, // مضاعفة الدقة لضمان وضوح النصوص والرسوم
      useCORS: true, // السماح بتحميل الصور الخارجية (مثل اللوجو)
      logging: false 
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait' 
    },
    pagebreak: { 
      mode: ['css', 'avoid-all'] // احترام الكلاس break-inside-avoid لمنع قص العناصر
    }
  };

  // توليد وتحميل الملف
  await html2pdf().set(opt).from(element).save();
};
