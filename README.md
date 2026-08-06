# Physio Life Suite

Build a Complete Physical Therapy Clinic Management System ( Physio Life )

Create a modern, secure, responsive web application for a Physical Therapy Center ( Physio Life )

This is NOT an appointment booking website.

The primary goal is to build a complete Electronic Medical Record (EMR) and Clinic Management System where therapists can store, organize, update and retrieve every patient's medical information throughout their treatment journey.

The design should be modern, clean, fast, professional and optimized for desktop, tablet and mobile.

---

USER ROLES

The system must support multiple roles with different permissions.

1. Super Admin

Has full access to everything.

Can:

- Manage users , manage their permissions

- Create therapists

- Create receptionists

- Create assistants

- Delete users

- Restore deleted data

- View reports

- Manage clinic settings

- Export database

- View audit logs

---

2. Physical Therapist

Can:

- Create patients

- Edit patients

- Record assessments

- Record treatment sessions

- Upload files like ( X-rays، MRI، CT، Ultrasound، EMG )

- Add measurements

- View progress

- Write notes

- Create reassessment 

- Open a new visit

- Generate reports

- Print reports

Cannot manage users.

---

3. Receptionist

Can:

- Register patient

- Search patient

- Update contact information

- Create invoices

- Receive payments

- Print receipts

Cannot access medical notes unless allowed.

--

4. Assistant (pt doctor also)

Can:

- View assigned patients

- View treatment plan

- Record exercise completion

- Record attendance

- Upload exercise photos/videos

---

LOGIN

Secure login.

Forgot password. ( By email , sending an OTP for the email, by the clinic gemail )

Reset password.

Remember me.

Session timeout.

Role-based permissions.

---

DASHBOARD

Beautiful dashboard showing:

Today's patients

Total patients

Active patients

Discharged patients

New patients this month

Revenue

Pending payments

Completed sessions

Recent activities

Notifications

Upcoming follow-ups

---

PATIENT PROFILE

Every patient should have one permanent profile.

Include:

Patient ID

Full Name

Gender

Age

Date of Birth ( optional )

Occupation ( optional )

Marital Status ( optional )

Phone numbers

Address ( optional )

Referral Source ( optional )

Can add others 

---

COMPLETE MEDICAL HISTORY

Store complete history.

Include:

Chief Complaint

History of Present Illness

Mechanism of Injury

Onset

Duration

Pain Scale

Pain Diagram

Pain Nature

Pain Frequency

Aggravating Factors

Relieving Factors

Sleep

Morning Stiffness

Night Pain

Previous Episodes

Previous Treatment

Past Medical History

Past Surgical History

Family History

Medication History

Drug Allergies

Food Allergies

Smoking

Alcohol

Lifestyle

Occupation Risks

Sports Activity

Pregnancy History

Falls History

Red Flags

Yellow Flags

System Review

Neurological Symptoms

Cardiovascular Diseases

Respiratory Diseases

Diabetes

Hypertension

Cancer

Osteoporosis

Rheumatoid Arthritis

Neurological Disorders

Psychological Conditions

Other Diseases

Others

---

PHYSICAL EXAMINATION

Vital Signs

Blood Pressure

Pulse

Temperature

Respiratory Rate

Oxygen Saturation

Observation

Inspection

Palpation

Tenderness

Swelling

Skin Changes

Posture Assessment

Gait Analysis

Functional Assessment

ROM

Active ROM

Passive ROM

End Feel

Muscle Strength (MMT)

Muscle Length

Flexibility

Balance

Coordination

Reflexes

Dermatomes

Myotomes

Special Tests

Neurological Examination

Orthopedic Examination

Limb Length

Edema Measurement

Circumference Measurements

Pain Scale

Outcome Measures

Others

---

DIAGNOSIS

Medical Diagnosis

Physiotherapy Diagnosis

Problem List

Goals

Short-term Goals

Long-term Goals

Prognosis

Contraindications

Precautions

Treatment Plan

---

TREATMENT SESSIONS

Each visit should create a new treatment record.

Include:

Session Number

Date

Therapist

Subjective

Objective

Assessment

Plan

SOAP Notes

Pain Before

Pain After

Exercises Performed

Manual Therapy

Electrotherapy

Ultrasound

Shockwave

Laser

Taping

Dry Needling

Massage

Stretching

Strengthening

Balance Training

Home Exercise Program

Patient Compliance

Response to Treatment

Complications

Next Session Plan

Session Duration

Attendance

Cancellation

No-show

Digital Signature

---

EXERCISE LIBRARY

Store exercises.

Each exercise includes:

Name

Category

Target Muscle

Difficulty

Description

Video

Image

Instructions

Repetitions

Sets

Duration

Frequency

Progression

Regression

Contraindications

Home Program

Assign exercises to patient.

Track completion.

---

FILE MANAGEMENT

Upload:

X-ray

MRI

CT

Ultrasound

Blood Tests

Lab Results

Medical Reports

Referral Letters

Photos

Videos

Audio Notes

PDF Files

Word Files

Everything should remain permanently linked to patient profile.

Files uploaded to Google drive 

---

BODY CHART

Interactive body chart.

Allow therapist to mark:

Pain

Swelling

Scar

Bruise

Weakness

Spasm

Trigger Points

Numbness

Radiating Pain

---

PROGRESS TRACKING

Graphs for:

Pain

ROM

Strength

Weight

Balance

Walking Distance

Outcome Scores

Treatment Progress

Session Attendance

Patient Compliance

---

SEARCH

Instant search by:

Patient Name

Phone

Patient ID

Diagnosis

Therapist

Disease

Date

---

FILTERS

Filter patients by:

Diagnosis

Therapist

Age

Gender

Status

Date

---

PRINTING

Generate printable:

Assessment

SOAP Notes

Treatment Report

Medical Report

Progress Report

Discharge Report

Invoice

Receipt

Exercise Program

Referral Letter

PDF Export

---

BILLING

Invoices

Payments

Payment History

Discounts

Packages

Remaining Sessions

Receipts

Outstanding Balance

Refunds

---

NOTIFICATIONS

Upcoming Follow-up

Pending Payments

Missed Sessions

Reassessment Due

Treatment Completed

---

ANALYTICS

Revenue

Patients

Diagnoses

Therapist Performance

Session Statistics

Treatment Success Rate

Attendance

Patient Satisfaction

Monthly Reports

Annual Reports

---

SECURITY

Role Permissions

Audit Logs

Deleted Records Recovery

Encryption for medical files

---

SYSTEM FEATURES

Dark Mode

Light Mode

Arabic

English

Responsive Design

Offline Support

Fast Search

Auto Save

Autosuggestions

Drag and Drop Upload

Image Compression

PDF Preview

Excel Export

Cloud Storage ( All texts stored in supabase, but files stored in google drive )

Activity Logs

---

The final system should feel like a professional hospital-grade Electronic Medical Record (EMR) specifically designed for Physical Therapy Clinics, with exceptional speed, security, usability, and scalability.

تعليمات

نسيت كلمة المرور ، يتم ارسال كود اعادة تعيين كلمة المرور  الي البريد الإلكتروني الخاص بالمستخدم ، عبر البريد الالكتروني الخاص بالعياده ، قولي اعمل ايه عشان اسمح للبريد الالكتروني انه يبعت رسايل otp

بالنسبه ل Complete history  و physical examination و DIAGNOSIS و TREATMENT SESSIONS و EXERCISE LIBRARY عاوز العناصر يتم اضافتها يدويا ، وتظهر لما تتضاف ، يعني الحاجات اللي ذكرتها عباره عن امثلة الطبيب يقدر يضيف اللي عاوزه منهم واللي مش هيضيفه ميظهرش ، يعني يظهر عنده الاقتراحات اللي موجوده دي مع امكانية اضافة حاجه مش موجوده 

تخزين الملفات يتم على جوجل درايف الخاص بايميل العيادة، قولي برد  اعمل اي عشان ادي صلاحيات الرفع دي بشكل تلقائي من غير ما يظهر حاجه للمستخدم

بعتلك صورة دي لوجو المركز ، خليها هي لوجو الموقع 

دا ال @connector:google_mail:"Gmail"  اللي عاوز يبعت ال OTP 
physiolife.ptcenter@gmail.com

وبردو ال @connector:google_drive:"Google Drive"  اللي هيخزن الملفات files بكل أنواعها هو 
physiolife.ptcenter@gmail.com

وعاوز كل قاعدة البيانات ال text مش ملفات تكون على supabase اللي ربطته هنا 

اضافة ميزه عند الSuper Admin  انه يستطيع اضافة ايميل اضافي لزيادة مساحة التخزين الخاصة بالملفات

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://physiolife.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ff334d62-a488-412d-bd46-fb87e27a13fe).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
