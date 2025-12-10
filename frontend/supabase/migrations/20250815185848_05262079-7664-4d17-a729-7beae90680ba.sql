-- Habilitar RLS nas tabelas Django que estão expostas
ALTER TABLE public.auth_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_user_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_user_user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.django_admin_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.django_content_type ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.django_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.django_session ENABLE ROW LEVEL SECURITY;

-- Criar políticas restritivas para as tabelas Django - negar acesso por padrão
CREATE POLICY "No access to django auth_group" ON public.auth_group FOR ALL USING (false);
CREATE POLICY "No access to django auth_group_permissions" ON public.auth_group_permissions FOR ALL USING (false);
CREATE POLICY "No access to django auth_permission" ON public.auth_permission FOR ALL USING (false);
CREATE POLICY "No access to django auth_user" ON public.auth_user FOR ALL USING (false);
CREATE POLICY "No access to django auth_user_groups" ON public.auth_user_groups FOR ALL USING (false);
CREATE POLICY "No access to django auth_user_user_permissions" ON public.auth_user_user_permissions FOR ALL USING (false);
CREATE POLICY "No access to django admin_log" ON public.django_admin_log FOR ALL USING (false);
CREATE POLICY "No access to django content_type" ON public.django_content_type FOR ALL USING (false);
CREATE POLICY "No access to django migrations" ON public.django_migrations FOR ALL USING (false);
CREATE POLICY "No access to django session" ON public.django_session FOR ALL USING (false);

-- Corrigir search path da função update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;