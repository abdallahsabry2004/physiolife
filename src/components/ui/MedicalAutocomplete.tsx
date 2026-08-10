import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MedicalAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function MedicalAutocomplete({
  value,
  onChange,
  placeholder = "Start typing...",
  className,
}: MedicalAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // حالة لتتبع الكلمات الحالية التي يكتبها الطبيب ومكانها في النص
  const [searchContext, setSearchContext] = useState({ query: "", start: 0, end: 0 });

  // إغلاق القائمة المنسدلة عند الضغط في أي مكان خارج المكون
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🧠 الدالة الذكية لاستخراج الكلمات التي يتم كتابتها حالياً للبحث عنها
  const updateSearchContext = (target: HTMLTextAreaElement) => {
    const textValue = target.value;
    const cursorPosition = target.selectionStart;

    // 1. أخذ النص من البداية حتى مكان المؤشر الحالي
    const textBeforeCursor = textValue.slice(0, cursorPosition);
    
    // 2. تقسيم النص بناءً على الفواصل القاطعة للجملة (سطر جديد، نقطة، فاصلة)
    const delimiters = /[\n,.]/; 
    const sentences = textBeforeCursor.split(delimiters);
    const currentSentence = sentences[sentences.length - 1]; // الجملة الحالية

    // 3. تقسيم الجملة الحالية إلى كلمات بناءً على المسافات (Spaces)
    const words = currentSentence.split(' ');

    // 4. أخذ آخر 3 كلمات كحد أقصى للبحث (لدعم المصطلحات الطبية المركبة مثل Low back pain)
    const maxWordsToSearch = 3;
    const lastWords = words.slice(-maxWordsToSearch).join(' ');

    // 5. حساب نقطة البداية الدقيقة للاستبدال لضمان عدم مسح النص القديم
    const query = lastWords.trimStart();
    const finalStart = cursorPosition - query.length;

    setSearchContext({ query, start: finalStart, end: cursorPosition });
    
    // إغلاق القائمة إذا كانت الكلمة أقل من حرفين
    if (query.length < 2) {
      setIsOpen(false);
    }
  };

  // معالجة تغيير النص
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    updateSearchContext(e.target);
  };

  // تحديث مكان المؤشر عند تحريك الأسهم أو الضغط بالماوس
  const handleCursorMove = (e: React.MouseEvent<HTMLTextAreaElement> | React.KeyboardEvent<HTMLTextAreaElement>) => {
    updateSearchContext(e.currentTarget);
  };

  // نظام الـ Debounce للبحث في API الخارجي
  useEffect(() => {
    const { query } = searchContext;
    
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    // الانتظار 400 مللي ثانية بعد الكتابة لتقليل الضغط على السيرفر الخارجي
    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `https://clinicaltables.nlm.nih.gov/api/conditions/v3/search?terms=${encodeURIComponent(query)}&df=primary_name&maxList=8`
        );
        const data = await response.json();
        
        if (data && data[3]) {
          const results = data[3].map((item: string[]) => item[0]);
          setSuggestions(results);
          if (results.length > 0) setIsOpen(true);
        }
      } catch (error) {
        console.error("Failed to fetch medical terms:", error);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchContext.query]);

  // دالة الإدراج الذكي: استبدال الجملة الحالية فقط بالمصطلح المختار
  const handleSelectSuggestion = (suggestion: string) => {
    const { start, end } = searchContext;
    const textBefore = value.slice(0, start);
    const textAfter = value.slice(end);
    
    // دمج النص القديم مع المصطلح الجديد
    const newText = textBefore + suggestion + textAfter;
    onChange(newText);
    setIsOpen(false);
    
    // إعادة التركيز على حقل الإدخال ليتمكن الطبيب من إكمال الكتابة
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onClick={handleCursorMove}
          onKeyUp={handleCursorMove}
          placeholder={placeholder}
          className="min-h-[80px] pr-8 leading-relaxed" 
        />
        <div className="absolute right-3 top-3 text-muted-foreground pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Search className="h-4 w-4 opacity-30" />
          )}
        </div>
      </div>

      {/* قائمة الاقتراحات (Dropdown) */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="relative flex w-full cursor-pointer select-none items-center border-b border-border/50 last:border-0 px-3 py-2.5 text-sm outline-none hover:bg-muted hover:text-foreground font-medium transition-colors"
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
