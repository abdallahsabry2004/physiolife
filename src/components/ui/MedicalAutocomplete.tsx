import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  placeholder = "Search medical conditions...",
  className,
}: MedicalAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // إغلاق القائمة المنسدلة عند الضغط خارج المكون
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // نظام الـ Debounce والبحث في API الخارجي (NIH ClinicalTables)
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!value || value.length < 2) {
        setSuggestions([]);
        return;
      }

      setIsLoading(true);
      try {
        // نستخدم API أمريكي مجاني وموثوق للبحث في الحالات الطبية
        const response = await fetch(
          `https://clinicaltables.nlm.nih.gov/api/conditions/v3/search?terms=${encodeURIComponent(value)}&df=primary_name&maxList=10`
        );
        const data = await response.json();
        
        // الرد بيجي عبارة عن Array، العنصر الرابع فيه هو أسماء الحالات
        if (data && data[3]) {
          setSuggestions(data[3].map((item: string[]) => item[0]));
          setIsOpen(true);
        }
      } catch (error) {
        console.error("Failed to fetch medical terms:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // الانتظار 500 مللي ثانية بعد توقف المستخدم عن الكتابة قبل إرسال الطلب
    const delayDebounceFn = setTimeout(() => {
      // لا نبحث إذا كان النص المكتوب يطابق تماماً أحد الاقتراحات (بمعنى أن الطبيب اختاره بالفعل)
      if (!suggestions.includes(value)) {
        fetchSuggestions();
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [value]);

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          placeholder={placeholder}
          className="pr-10" // مساحة للأيقونة
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </div>
      </div>

      {/* قائمة الاقتراحات (Dropdown) */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() => {
                onChange(suggestion); // تعيين القيمة عند الاختيار
                setIsOpen(false); // إغلاق القائمة
              }}
              className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-3 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
