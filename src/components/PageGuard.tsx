import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAuth, type PageKey } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

/**
 * يمنع عرض الصفحة إذا كان Super Admin قد ألغى صلاحية المستخدم لهذه الصفحة.
 */
export function PageGuard({ page, children }: { page: PageKey; children: ReactNode }) {
  const { canViewPage, loading } = useAuth();
  const { t } = useI18n();

  if (loading) return null;
  if (canViewPage(page)) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-12 text-center">
      <Lock className="h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">{t("perm.denied")}</p>
      <p className="text-xs text-muted-foreground">{t("perm.deniedHint")}</p>
    </div>
  );
}
