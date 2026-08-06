-- ROLES
CREATE TYPE public.app_role AS ENUM ('super_admin','therapist','receptionist','assistant');

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL DEFAULT '',
  email text,
  phone text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_edit_clinical(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','therapist'))
$$;

CREATE POLICY "profiles readable by staff" ON public.profiles FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "admin deletes profiles" ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

CREATE POLICY "roles readable by staff" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE POLICY "admin manages roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), NEW.email)
  ON CONFLICT (id) DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin');
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- PATIENTS
CREATE TABLE public.patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('PL-' || lpad((floor(random()*999999))::text, 6, '0')),
  full_name text NOT NULL,
  gender text,
  age integer,
  date_of_birth date,
  occupation text,
  marital_status text,
  phone text,
  phone_alt text,
  email text,
  address text,
  referral_source text,
  status text NOT NULL DEFAULT 'active',
  primary_therapist_id uuid,
  diagnosis text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  deleted_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff read patients" ON public.patients FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff insert patients" ON public.patients FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "staff update patients" ON public.patients FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin delete patients" ON public.patients FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE INDEX idx_patients_name ON public.patients (full_name);
CREATE INDEX idx_patients_phone ON public.patients (phone);

-- FLEXIBLE CLINICAL FIELD CATALOG
CREATE TABLE public.clinical_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  section text,
  label text NOT NULL,
  label_ar text,
  field_type text NOT NULL DEFAULT 'text',
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_suggestion boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinical_fields TO authenticated;
GRANT ALL ON public.clinical_fields TO service_role;
ALTER TABLE public.clinical_fields ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_clinical_fields_updated BEFORE UPDATE ON public.clinical_fields FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff read fields" ON public.clinical_fields FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "clinical write fields" ON public.clinical_fields FOR INSERT TO authenticated WITH CHECK (public.can_edit_clinical(auth.uid()));
CREATE POLICY "clinical update fields" ON public.clinical_fields FOR UPDATE TO authenticated USING (public.can_edit_clinical(auth.uid()));
CREATE POLICY "admin delete fields" ON public.clinical_fields FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'super_admin'));

CREATE TABLE public.patient_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_id uuid,
  module text NOT NULL,
  label text NOT NULL,
  value text,
  sort_order integer NOT NULL DEFAULT 0,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_records TO authenticated;
GRANT ALL ON public.patient_records TO service_role;
ALTER TABLE public.patient_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_patient_records_updated BEFORE UPDATE ON public.patient_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff read records" ON public.patient_records FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "clinical insert records" ON public.patient_records FOR INSERT TO authenticated WITH CHECK (public.can_edit_clinical(auth.uid()));
CREATE POLICY "clinical update records" ON public.patient_records FOR UPDATE TO authenticated USING (public.can_edit_clinical(auth.uid()));
CREATE POLICY "clinical delete records" ON public.patient_records FOR DELETE TO authenticated USING (public.can_edit_clinical(auth.uid()));
CREATE INDEX idx_patient_records_patient ON public.patient_records (patient_id, module);

-- TREATMENT SESSIONS
CREATE TABLE public.treatment_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_number integer NOT NULL DEFAULT 1,
  session_date date NOT NULL DEFAULT current_date,
  therapist_id uuid,
  subjective text,
  objective text,
  assessment text,
  plan text,
  pain_before integer,
  pain_after integer,
  duration_minutes integer,
  attendance text NOT NULL DEFAULT 'attended',
  compliance text,
  response text,
  complications text,
  next_session_plan text,
  signature text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_sessions TO authenticated;
GRANT ALL ON public.treatment_sessions TO service_role;
ALTER TABLE public.treatment_sessions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_sessions_updated BEFORE UPDATE ON public.treatment_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff read sessions" ON public.treatment_sessions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "clinical insert sessions" ON public.treatment_sessions FOR INSERT TO authenticated WITH CHECK (public.can_edit_clinical(auth.uid()));
CREATE POLICY "clinical update sessions" ON public.treatment_sessions FOR UPDATE TO authenticated USING (public.can_edit_clinical(auth.uid()));
CREATE POLICY "clinical delete sessions" ON public.treatment_sessions FOR DELETE TO authenticated USING (public.can_edit_clinical(auth.uid()));

-- EXERCISES
CREATE TABLE public.exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  target_muscle text,
  difficulty text,
  description text,
  instructions text,
  image_url text,
  video_url text,
  repetitions text,
  sets text,
  duration text,
  frequency text,
  progression text,
  regression text,
  contraindications text,
  extra jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercises TO authenticated;
GRANT ALL ON public.exercises TO service_role;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_exercises_updated BEFORE UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff read exercises" ON public.exercises FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "clinical insert exercises" ON public.exercises FOR INSERT TO authenticated WITH CHECK (public.can_edit_clinical(auth.uid()));
CREATE POLICY "clinical update exercises" ON public.exercises FOR UPDATE TO authenticated USING (public.can_edit_clinical(auth.uid()));
CREATE POLICY "clinical delete exercises" ON public.exercises FOR DELETE TO authenticated USING (public.can_edit_clinical(auth.uid()));

CREATE TABLE public.patient_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE SET NULL,
  sets text,
  repetitions text,
  frequency text,
  notes text,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_exercises TO authenticated;
GRANT ALL ON public.patient_exercises TO service_role;
ALTER TABLE public.patient_exercises ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_pex_updated BEFORE UPDATE ON public.patient_exercises FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff read pex" ON public.patient_exercises FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write pex" ON public.patient_exercises FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.exercise_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_exercise_id uuid NOT NULL REFERENCES public.patient_exercises(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT current_date,
  completed boolean NOT NULL DEFAULT true,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_logs TO authenticated;
GRANT ALL ON public.exercise_logs TO service_role;
ALTER TABLE public.exercise_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read elogs" ON public.exercise_logs FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write elogs" ON public.exercise_logs FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- FILES (Google Drive metadata)
CREATE TABLE public.patient_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other',
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  drive_file_id text,
  drive_web_view_link text,
  storage_account_id uuid,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_files TO authenticated;
GRANT ALL ON public.patient_files TO service_role;
ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read files" ON public.patient_files FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write files" ON public.patient_files FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.storage_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  label text,
  is_active boolean NOT NULL DEFAULT true,
  is_primary boolean NOT NULL DEFAULT false,
  root_folder_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.storage_accounts TO authenticated;
GRANT ALL ON public.storage_accounts TO service_role;
ALTER TABLE public.storage_accounts ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_storage_accounts_updated BEFORE UPDATE ON public.storage_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff read storage accounts" ON public.storage_accounts FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin manage storage accounts" ON public.storage_accounts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- BODY CHART
CREATE TABLE public.body_chart_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.treatment_sessions(id) ON DELETE SET NULL,
  view text NOT NULL DEFAULT 'front',
  mark_type text NOT NULL,
  x numeric NOT NULL,
  y numeric NOT NULL,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.body_chart_marks TO authenticated;
GRANT ALL ON public.body_chart_marks TO service_role;
ALTER TABLE public.body_chart_marks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read marks" ON public.body_chart_marks FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "clinical write marks" ON public.body_chart_marks FOR ALL TO authenticated USING (public.can_edit_clinical(auth.uid())) WITH CHECK (public.can_edit_clinical(auth.uid()));

-- MEASUREMENTS
CREATE TABLE public.measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.treatment_sessions(id) ON DELETE SET NULL,
  metric text NOT NULL,
  value numeric NOT NULL,
  unit text,
  measured_on date NOT NULL DEFAULT current_date,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.measurements TO authenticated;
GRANT ALL ON public.measurements TO service_role;
ALTER TABLE public.measurements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read measurements" ON public.measurements FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "clinical write measurements" ON public.measurements FOR ALL TO authenticated USING (public.can_edit_clinical(auth.uid())) WITH CHECK (public.can_edit_clinical(auth.uid()));

-- BILLING
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  invoice_number text NOT NULL UNIQUE DEFAULT ('INV-' || to_char(now(),'YYYYMM') || '-' || lpad((floor(random()*99999))::text,5,'0')),
  issue_date date NOT NULL DEFAULT current_date,
  description text,
  sessions_count integer,
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'unpaid',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff read invoices" ON public.invoices FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write invoices" ON public.invoices FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  method text NOT NULL DEFAULT 'cash',
  paid_on date NOT NULL DEFAULT current_date,
  is_refund boolean NOT NULL DEFAULT false,
  note text,
  received_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read payments" ON public.payments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write payments" ON public.payments FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- NOTIFICATIONS, AUDIT, SETTINGS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  due_at timestamptz,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read notifications" ON public.notifications FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write notifications" ON public.notifications FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity text,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read audit" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "staff insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.clinic_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.clinic_settings TO authenticated;
GRANT ALL ON public.clinic_settings TO service_role;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.clinic_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE POLICY "staff read settings" ON public.clinic_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "admin manage settings" ON public.clinic_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- Password reset OTP codes
CREATE TABLE public.password_reset_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.password_reset_codes TO service_role;
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Suggestion catalog seed
INSERT INTO public.clinical_fields (module, section, label, field_type, sort_order) VALUES
('history','Complaint','Chief Complaint','textarea',1),
('history','Complaint','History of Present Illness','textarea',2),
('history','Complaint','Mechanism of Injury','text',3),
('history','Complaint','Onset','text',4),
('history','Complaint','Duration','text',5),
('history','Pain','Pain Scale','number',6),
('history','Pain','Pain Nature','text',7),
('history','Pain','Pain Frequency','text',8),
('history','Pain','Aggravating Factors','text',9),
('history','Pain','Relieving Factors','text',10),
('history','Pain','Night Pain','text',11),
('history','Pain','Morning Stiffness','text',12),
('history','General','Sleep','text',13),
('history','General','Previous Episodes','text',14),
('history','General','Previous Treatment','text',15),
('history','Medical','Past Medical History','textarea',16),
('history','Medical','Past Surgical History','textarea',17),
('history','Medical','Family History','textarea',18),
('history','Medical','Medication History','textarea',19),
('history','Medical','Drug Allergies','text',20),
('history','Medical','Food Allergies','text',21),
('history','Lifestyle','Smoking','text',22),
('history','Lifestyle','Alcohol','text',23),
('history','Lifestyle','Lifestyle','text',24),
('history','Lifestyle','Occupation Risks','text',25),
('history','Lifestyle','Sports Activity','text',26),
('history','Lifestyle','Pregnancy History','text',27),
('history','Lifestyle','Falls History','text',28),
('history','Flags','Red Flags','textarea',29),
('history','Flags','Yellow Flags','textarea',30),
('history','Systems','System Review','textarea',31),
('history','Systems','Neurological Symptoms','text',32),
('history','Systems','Cardiovascular Diseases','text',33),
('history','Systems','Respiratory Diseases','text',34),
('history','Systems','Diabetes','text',35),
('history','Systems','Hypertension','text',36),
('history','Systems','Cancer','text',37),
('history','Systems','Osteoporosis','text',38),
('history','Systems','Rheumatoid Arthritis','text',39),
('history','Systems','Neurological Disorders','text',40),
('history','Systems','Psychological Conditions','text',41),
('history','Systems','Other Diseases','textarea',42),
('exam','Vital Signs','Blood Pressure','text',1),
('exam','Vital Signs','Pulse','text',2),
('exam','Vital Signs','Temperature','text',3),
('exam','Vital Signs','Respiratory Rate','text',4),
('exam','Vital Signs','Oxygen Saturation','text',5),
('exam','Observation','Observation','textarea',6),
('exam','Observation','Inspection','textarea',7),
('exam','Palpation','Palpation','textarea',8),
('exam','Palpation','Tenderness','text',9),
('exam','Palpation','Swelling','text',10),
('exam','Palpation','Skin Changes','text',11),
('exam','Movement','Posture Assessment','textarea',12),
('exam','Movement','Gait Analysis','textarea',13),
('exam','Movement','Functional Assessment','textarea',14),
('exam','ROM','Active ROM','textarea',15),
('exam','ROM','Passive ROM','textarea',16),
('exam','ROM','End Feel','text',17),
('exam','Strength','Muscle Strength (MMT)','textarea',18),
('exam','Strength','Muscle Length','text',19),
('exam','Strength','Flexibility','text',20),
('exam','Neuro','Balance','text',21),
('exam','Neuro','Coordination','text',22),
('exam','Neuro','Reflexes','text',23),
('exam','Neuro','Dermatomes','text',24),
('exam','Neuro','Myotomes','text',25),
('exam','Neuro','Neurological Examination','textarea',26),
('exam','Tests','Special Tests','textarea',27),
('exam','Tests','Orthopedic Examination','textarea',28),
('exam','Measurements','Limb Length','text',29),
('exam','Measurements','Edema Measurement','text',30),
('exam','Measurements','Circumference Measurements','text',31),
('exam','Measurements','Pain Scale','number',32),
('exam','Measurements','Outcome Measures','textarea',33),
('diagnosis','Diagnosis','Medical Diagnosis','textarea',1),
('diagnosis','Diagnosis','Physiotherapy Diagnosis','textarea',2),
('diagnosis','Diagnosis','Problem List','textarea',3),
('diagnosis','Goals','Short-term Goals','textarea',4),
('diagnosis','Goals','Long-term Goals','textarea',5),
('diagnosis','Goals','Prognosis','text',6),
('diagnosis','Safety','Contraindications','textarea',7),
('diagnosis','Safety','Precautions','textarea',8),
('diagnosis','Plan','Treatment Plan','textarea',9),
('session','Interventions','Exercises Performed','textarea',1),
('session','Interventions','Manual Therapy','textarea',2),
('session','Interventions','Electrotherapy','text',3),
('session','Interventions','Ultrasound','text',4),
('session','Interventions','Shockwave','text',5),
('session','Interventions','Laser','text',6),
('session','Interventions','Taping','text',7),
('session','Interventions','Dry Needling','text',8),
('session','Interventions','Massage','text',9),
('session','Interventions','Stretching','text',10),
('session','Interventions','Strengthening','text',11),
('session','Interventions','Balance Training','text',12),
('session','Interventions','Home Exercise Program','textarea',13),
('exercise','Details','Target Muscle','text',1),
('exercise','Details','Difficulty','text',2),
('exercise','Details','Progression','text',3),
('exercise','Details','Regression','text',4),
('exercise','Details','Contraindications','text',5);

INSERT INTO public.clinic_settings (key, value) VALUES
('general', '{"clinic_name":"Physio Life","currency":"EGP","session_timeout_minutes":60}'::jsonb);
