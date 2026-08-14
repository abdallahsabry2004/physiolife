import { Code2 } from "lucide-react";

export function DeveloperCredit() {
  return (
    <a
      href="https://wa.me/201113515751"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-3 ltr:right-3 rtl:left-3 z-50 flex items-center gap-1.5 rounded-full bg-white/60 p-1 text-gray-400 shadow-sm backdrop-blur-sm transition-all duration-300 hover:bg-white hover:text-teal-600 hover:shadow-md border border-gray-100/50 opacity-60 hover:opacity-100 group print:hidden dark:bg-gray-900/50 dark:border-gray-800 dark:text-gray-500 dark:hover:bg-gray-900 dark:hover:text-teal-400"
      title="Contact Developer"
    >
      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-50/50 group-hover:bg-teal-50 transition-colors dark:bg-gray-800/50 dark:group-hover:bg-teal-900/30">
        <Code2 className="h-3 w-3" />
      </div>
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-[10px] font-medium tracking-wide transition-all duration-300 ease-in-out group-hover:max-w-[120px] group-hover:pr-2 group-hover:pl-0.5 rtl:group-hover:pl-2 rtl:group-hover:pr-0.5">
        Dr. Abdallah Sabry
      </span>
    </a>
  );
}
