# EDUNova Improvement Tasks — Teammate 2

## Area: Stripe Test Payment & Lesson Quiz System

### Objective
Improve EDUNova's payment process using Stripe test/sandbox functionality and allow tutors to create quizzes as part of lesson creation.

---

# Part A — Stripe Test Payment

## Task 1 — Stripe Test/Sandbox Integration

### Goal
Use Stripe Test Mode for course payments so the project can demonstrate a realistic payment flow without charging real money.

### Requirements
- Use Stripe Test Mode credentials only for development/staging.
- Never put Stripe secret keys in frontend code.
- Keep secrets in environment variables.
- Backend creates/verifies the payment.
- Connect payment to the correct:
  - student
  - course
  - amount/order
- Handle successful, failed, cancelled, and repeated payment attempts.

### Expected Workflow

```text
Student selects course
        ↓
Checkout
        ↓
Backend creates Stripe payment/checkout session
        ↓
Student uses Stripe test payment
        ↓
Stripe confirms payment
        ↓
Backend verifies confirmation
        ↓
Existing enrollment service is called
        ↓
Student receives course access
```

### Critical Requirement
Do NOT create a second independent enrollment implementation.

After verified payment succeeds, use EDUNova's existing enrollment service so duplicate-enrollment protection and the current enrollment rules remain centralized.

### Security
- Never trust a frontend `paymentSuccessful = true` value.
- Verify payment server-side.
- Never expose secret keys.
- Validate course and payment information on the backend.
- Protect against duplicate processing.
- Store Stripe/payment references needed for auditing.

### Suggested Payment Data

```text
studentId
courseId
amount
currency
provider
providerPaymentId
status
createdAt
paidAt
```

### Suggested Status Values

```text
pending
paid
failed
cancelled
refunded
```

---

# Part B — Lesson Quiz System

## Task 2 — Tutor Quiz Creation

### Goal
Allow tutors to create a quiz for a lesson before saving/publishing that lesson.

### Tutor Workflow

```text
Create Lesson
     ↓
Enter Lesson Information
     ↓
Upload Video
     ↓
Upload Documents
     ↓
Create Quiz
     ↓
Preview
     ↓
Save Lesson
```

The quiz section should appear after the lesson resources and before the final Save action.

---

## Task 3 — Quiz Question Types

For the first version, implement:

### Multiple Choice

Example:

```text
What does HTTP stand for?

A. HyperText Transfer Protocol
B. High Transfer Text Process
C. Hyper Transfer Technology Program
D. Home Tool Transfer Protocol

Correct Answer: A
```

### True / False

Example:

```text
HTTP is an application-layer protocol.

Correct Answer: True
```

Keep the first implementation simple. Additional question types can be added later.

---

## Task 4 — Quiz Data

Suggested structure:

```text
Quiz
- quizId
- lessonId
- title
- questions

Question
- questionId
- questionText
- type
- options
- correctAnswer
- points
```

### Requirements
- Quiz belongs to a lesson.
- Tutor can add multiple questions.
- Tutor can remove/edit questions before saving.
- Validate that each question has a correct answer.
- Multiple-choice questions must have valid answer options.
- Store quiz with the correct lesson.

---

## Task 5 — Student Quiz Taking

### Goal
Allow enrolled students to answer the lesson quiz.

### Workflow

```text
Student opens lesson
        ↓
Studies lesson content
        ↓
Opens lesson quiz
        ↓
Answers questions
        ↓
Submits
        ↓
Backend grades objective questions
        ↓
Result stored
        ↓
Result shown to student
```

### Suggested Attempt Data

```text
studentId
courseId
lessonId
quizId
answers
score
totalPoints
submittedAt
```

### Requirements
- Only authorized/enrolled students can submit.
- Grade answers on the backend.
- Do not send correct answers to the client before submission if avoidable.
- Save the student's result.
- Prevent students from submitting results for another student.
- Decide whether multiple attempts are allowed and enforce that rule consistently.

---

# Integration Checklist

## Payment

- [ ] Stripe Test Mode is configured.
- [ ] Secret key exists only on backend/server environment.
- [ ] Payment is associated with the authenticated student and selected course.
- [ ] Backend verifies successful payment.
- [ ] Failed/cancelled payments do not grant enrollment.
- [ ] Duplicate payment processing is handled safely.
- [ ] Existing enrollment service is reused.
- [ ] Existing enrollment behavior still works.

## Quiz

- [ ] Tutor can create quiz while creating/editing lesson.
- [ ] Quiz appears after video/documents and before Save.
- [ ] Multiple-choice questions work.
- [ ] True/False questions work.
- [ ] Correct answer is required.
- [ ] Quiz is connected to the correct lesson.
- [ ] Student can take quiz.
- [ ] Backend calculates score.
- [ ] Quiz attempt/result is stored.
- [ ] Authorization is checked for tutor and student APIs.

## Suggested Branch

```bash
git checkout main
git pull
git checkout -b feature/payment-quiz
```

## Deliverable

Two completed flows:

```text
PAYMENT

Select Course
     ↓
Stripe Test Checkout
     ↓
Server Verification
     ↓
Existing Enrollment Service
     ↓
Course Access
```

```text
QUIZ

Tutor Creates Lesson
     ↓
Uploads Video/Documents
     ↓
Creates Quiz
     ↓
Saves Lesson
     ↓
Student Studies
     ↓
Student Takes Quiz
     ↓
Backend Grades & Stores Result
```
