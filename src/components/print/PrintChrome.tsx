// src/components/print/PrintChrome.tsx
//
// هيدر وفوتر ثابتان يتكرران تلقائيًا في أعلى/أسفل كل صفحة طباعة.
// يعتمدان على position: fixed المعرّف في styles.css + هامش @page
// المحجوز مسبقًا بنفس الارتفاع، لذلك لا يتم تغطية أي محتوى تحت الفوتر
// ولا فوق الهيدر مهما زاد عدد الصفحات.
//
// مهم: حافظ على أن يبقى كل سطر هنا سطرًا واحدًا بدون التفاف (لا تُدخل
// فقرات طويلة) حتى يبقى الارتفاع ثابتًا ومطابقًا للقيم المحسوبة في
// --print-header-h و --print-footer-h داخل styles.css.

import type { ReactNode } from "react";
import logo from "@/assets/physio-life-logo.png";

type PrintHeaderProps = {
  /** نوع المستند الظاهر أعلى يمين كل صفحة، مثال: "Clinical Record" / "Invoice Statement" */
  documentTitle: string;
  /** اسم المريض (اختياري) */
  patientName?: string | null;
  /** كود/رقم ملف المريض (اختياري) */
  patientCode?: string | null;
};

export function PrintHeader({ documentTitle, patientName, patientCode }: PrintHeaderProps) {
  return (
    <div className="print-page-header">
      <div className="print-header-brand">
        <img src={logo} alt="Physio Life" />
        <div>
          <p className="print-header-clinic">Physio Life PT Center</p>
          <p className="print-header-sub">Physical Therapy &amp; Rehabilitation</p>
        </div>
      </div>
      <div className="print-header-doc">
        <p className="print-header-title">{documentTitle}</p>
        {(patientName || patientCode) && (
          <p className="print-header-patient">
            {patientName}
            {patientName && patientCode ? " · " : ""}
            {patientCode}
          </p>
        )}
      </div>
    </div>
  );
}

type PrintFooterProps = {
  /** سطر إضافي مخصص لهذا المستند (اختياري) — يظهر أسفل السطر الثابت في كل صفحة */
  note?: ReactNode;
};

export function PrintFooter({ note }: PrintFooterProps) {
  return (
    <div className="print-page-footer">
      <p className="print-footer-line">
        <strong>Physio Life PT Center</strong> — Physical Therapy &amp; Rehabilitation Clinic
      </p>
      {note && <p className="print-footer-line">{note}</p>}
    </div>
  );
}
