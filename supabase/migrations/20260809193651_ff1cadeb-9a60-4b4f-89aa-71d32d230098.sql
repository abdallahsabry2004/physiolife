CREATE TABLE public.questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_ar text,
  category text,
  description text,
  scoring_method text NOT NULL DEFAULT 'sum',
  scoring_formula text,
  min_score numeric NOT NULL DEFAULT 0,
  max_score numeric,
  interpretation jsonb NOT NULL DEFAULT '[]'::jsonb,
  mcid numeric,
  mdc numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionnaires TO authenticated;
GRANT ALL ON public.questionnaires TO service_role;
ALTER TABLE public.questionnaires ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read questionnaires" ON public.questionnaires FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "clinical manage questionnaires" ON public.questionnaires FOR ALL TO authenticated USING (public.can_edit_clinical(auth.uid())) WITH CHECK (public.can_edit_clinical(auth.uid()));
CREATE TRIGGER trg_questionnaires_updated BEFORE UPDATE ON public.questionnaires FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.questionnaire_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  questionnaire_id uuid NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  text text NOT NULL,
  text_ar text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionnaire_questions TO authenticated;
GRANT ALL ON public.questionnaire_questions TO service_role;
ALTER TABLE public.questionnaire_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read questions" ON public.questionnaire_questions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "clinical manage questions" ON public.questionnaire_questions FOR ALL TO authenticated USING (public.can_edit_clinical(auth.uid())) WITH CHECK (public.can_edit_clinical(auth.uid()));

CREATE TABLE public.questionnaire_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questionnaire_questions(id) ON DELETE CASCADE,
  label text NOT NULL,
  label_ar text,
  score numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionnaire_options TO authenticated;
GRANT ALL ON public.questionnaire_options TO service_role;
ALTER TABLE public.questionnaire_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read options" ON public.questionnaire_options FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "clinical manage options" ON public.questionnaire_options FOR ALL TO authenticated USING (public.can_edit_clinical(auth.uid())) WITH CHECK (public.can_edit_clinical(auth.uid()));

CREATE TABLE public.patient_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  questionnaire_id uuid NOT NULL REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.treatment_sessions(id) ON DELETE SET NULL,
  session_number integer,
  assessed_on date NOT NULL DEFAULT CURRENT_DATE,
  raw_score numeric NOT NULL DEFAULT 0,
  final_score numeric NOT NULL DEFAULT 0,
  max_possible numeric,
  interpretation text,
  notes text,
  assessed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_assessments TO authenticated;
GRANT ALL ON public.patient_assessments TO service_role;
ALTER TABLE public.patient_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read assessments" ON public.patient_assessments FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "clinical manage assessments" ON public.patient_assessments FOR ALL TO authenticated USING (public.can_edit_clinical(auth.uid())) WITH CHECK (public.can_edit_clinical(auth.uid()));
CREATE TRIGGER trg_patient_assessments_updated BEFORE UPDATE ON public.patient_assessments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.patient_assessment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.patient_assessments(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questionnaire_questions(id) ON DELETE CASCADE,
  option_id uuid REFERENCES public.questionnaire_options(id) ON DELETE SET NULL,
  score numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_assessment_answers TO authenticated;
GRANT ALL ON public.patient_assessment_answers TO service_role;
ALTER TABLE public.patient_assessment_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read assessment answers" ON public.patient_assessment_answers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "clinical manage assessment answers" ON public.patient_assessment_answers FOR ALL TO authenticated USING (public.can_edit_clinical(auth.uid())) WITH CHECK (public.can_edit_clinical(auth.uid()));

CREATE INDEX idx_qq_questionnaire ON public.questionnaire_questions(questionnaire_id);
CREATE INDEX idx_qo_question ON public.questionnaire_options(question_id);
CREATE INDEX idx_pa_patient ON public.patient_assessments(patient_id);
CREATE INDEX idx_paa_assessment ON public.patient_assessment_answers(assessment_id);