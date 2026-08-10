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

// تعريف نوع البيانات للاحتفاظ بالكلمات ومواقعها الدقيقة في النص
type SearchWord = { word: string; index: number };
type SuggestionItem = { text: string; startIdx: number };

export function MedicalAutocomplete({
  value,
  onChange,
  placeholder = "Start typing...",
  className,
}: MedicalAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  // حالة لمنع البحث التلقائي مباشرة بعد اختيار الطبيب لاقتراح
  const [skipNextSearch, setSkipNextSearch] = useState(false);
  
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [searchContext, setSearchContext] = useState<{ lastWords: SearchWord[], cursorPosition: number }>({ lastWords: [], cursorPosition: 0 });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 🧠 الخوارزمية الذكية لاستخراج آخر 1، 2، و 3 كلمات
  const updateSearchContext = (target: HTMLTextAreaElement) => {
    const textValue = target.value;
    const cursorPosition = target.selectionStart;

    const textBeforeCursor = textValue.slice(0, cursorPosition);
    const delimiters = /[\n,.]/; 
    const sentences = textBeforeCursor.split(delimiters);
    const currentSentence = sentences[sentences.length - 1];

    const wordRegex = /\S+/g;
    let match;
    const wordsInfo: SearchWord[] = [];
    
    // حساب نقطة بداية الجملة الحالية بالنسبة للنص كله
    const sentenceStart = textBeforeCursor.length - currentSentence.length;

    while ((match = wordRegex.exec(currentSentence)) !== null) {
      wordsInfo.push({ 
        word: match[0], 
        index: sentenceStart + match.index 
      });
    }

    // أخذ آخر 3 كلمات فقط كحد أقصى لتكوين اقتراحات مركبة
    const lastWords = wordsInfo.slice(-3);
    setSearchContext({ lastWords, cursorPosition });
    
    if (lastWords.length === 0) {
      setIsOpen(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    updateSearchContext(e.target);
  };

  const handleCursorMove = (e: React.MouseEvent<HTMLTextAreaElement> | React.KeyboardEvent<HTMLTextAreaElement>) => {
    updateSearchContext(e.currentTarget);
  };

  // 🚀 نظام إرسال الطلبات المتوازية (Parallel Requests) للاقتراحات
  useEffect(() => {
    if (skipNextSearch) {
      setSkipNextSearch(false);
      return;
    }

    const { lastWords } = searchContext;
    
    if (!lastWords || lastWords.length === 0) {
      setSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsLoading(true);
      try {
        const fetchPromises = [];
        const queriesInfo: { query: string; startIdx: number }[] = [];

        // بناء طلبات بحث للكلمة الأخيرة، الكلمتين، والـ 3 كلمات
        for (let i = 1; i <= lastWords.length; i++) {
          const wordsSubset = lastWords.slice(-i);
          const query = wordsSubset.map(w => w.word).join(' ');
          
          if (query.length >= 2) {
             queriesInfo.push({ query, startIdx: wordsSubset[0].index });
             // نطلب 5 اقتراحات كحد أقصى لكل تركيبة لعدم ازدحام القائمة
             fetchPromises.push(
               fetch(`https://clinicaltables.nlm.nih.gov/api/conditions/v3/search?terms=${encodeURIComponent(query)}&df=primary_name&maxList=5`).then(r => r.json())
             );
          }
        }

        if (fetchPromises.length === 0) {
          setIsLoading(false);
          return;
        }

        const results = await Promise.all(fetchPromises);
        const newSuggestions: SuggestionItem[] = [];
        const seen = new Set<string>();

        // دمج النتائج مع إعطاء الأولوية للكلمات المركبة (3 كلمات ثم 2 ثم 1)
        for (let i = results.length - 1; i >= 0; i--) {
           const data = results[i];
           const qInfo = queriesInfo[i];
           
           if (data && data[3]) {
              data[3].forEach((item: string[]) => {
                 const text = item[0];
                 if (!seen.has(text.toLowerCase())) {
                    seen.add(text.toLowerCase());
                    newSuggestions.push({ text, startIdx: qInfo.startIdx });
                 }
              });
           }
        }

        setSuggestions(newSuggestions);
        if (newSuggestions.length > 0) setIsOpen(true);

      } catch (error) {
        console.error("Failed to fetch medical terms:", error);
      } finally {
        setIsLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchContext]);

  // ✨ دالة الإدراج الذكي: تستبدل فقط الكلمات التي تم البحث بناءً عليها
  const handleSelectSuggestion = (suggestion: SuggestionItem) => {
    const { startIdx } = suggestion;
    const { cursorPosition } = searchContext;
    
    const textBefore = value.slice(0, startIdx);
    const textAfter = value.slice(cursorPosition);
    
    const newText = textBefore + suggestion.text + textAfter;
    
    setSkipNextSearch(true); // منع البحث التلقائي بعد اختيار الاقتراح
    onChange(newText);
    setIsOpen(false);
    
    // إعادة التركيز للمربع ليستمر الطبيب في الكتابة
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

      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() => handleSelectSuggestion(suggestion)}
              className="relative flex w-full cursor-pointer select-none items-center border-b border-border/50 last:border-0 px-3 py-2.5 text-sm outline-none hover:bg-muted hover:text-foreground font-medium transition-colors"
            >
              {suggestion.text}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
