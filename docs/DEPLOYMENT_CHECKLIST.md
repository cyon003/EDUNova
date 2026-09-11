# Azure VM preparation checklist

Scope: fix existing functionality; prepare configuration; do not deploy or change existing database records.

- [x] Centralize enrollment policy checks; transact enrollment/order/payment writes and serialize competing operations.
- [x] Enforce session timeout without extending it on refresh; check account state and token rotation.
- [x] Honor approval setting on tutor publication; disable unsupported passing-score control.
- [ ] Review route authorization, protected uploads, progress/notes, messaging, AI and model integration.
- [ ] Add focused regression tests and run existing checks.
- [ ] Validate actual saved model loading and isolated local services where available.
- [x] Prepare same-origin HTTPS Nginx, systemd units, private Gunicorn services, dependency and environment configuration.
- [ ] Document model provisioning, backups/restores, updates/rollback and remaining external verification.

Feature map: React pages and hooks call `/api` routes in `backend/app.js`; each router uses the corresponding Mongoose models in `backend/models`. Auth uses User/RefreshSession and SMTP; courses and lessons use Course/Enrollment and protected disk resources; purchases use Cart/Order/Enrollment/PaymentSetting; notes use Note; applications use TutorApplication and private disk documents; messages use Message and Socket.IO; notifications/announcements/reports/settings use their named models; AI routes use ChatbotConversation and the private Gemini Flask service; learning signals use LearningSignal and the private model service; tutor analytics aggregate stored predictions by owned course and lesson.
