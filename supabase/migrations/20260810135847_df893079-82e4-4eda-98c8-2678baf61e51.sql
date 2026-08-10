CREATE TABLE public.user_page_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  page text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, page)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_page_permissions TO authenticated;
GRANT ALL ON public.user_page_permissions TO service_role;

ALTER TABLE public.user_page_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read page permissions"
ON public.user_page_permissions FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Super admins manage page permissions"
ON public.user_page_permissions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER trg_user_page_permissions_updated
BEFORE UPDATE ON public.user_page_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();