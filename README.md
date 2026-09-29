# EDUNova – AI-Powered Learning Platform

EDUNova is a web-based learning management platform designed to provide an interactive and intelligent learning experience for students, tutors, and administrators.

The platform combines traditional learning management features with AI-assisted tools such as an AI Tutor, automatic lecture transcription, topic generation, AI-generated quizzes, and learning confusion detection.

The goal of EDUNova is to support both students and tutors by using AI to assist learning, reduce repetitive work, organize lesson content, and provide useful learning insights.

---

## Main Features

### Student Features

Students can:

- Browse available courses
- Enroll in courses
- Watch lesson videos
- Track learning progress
- Navigate lesson content using lesson topics
- Complete lesson quizzes
- View quiz results
- Ask questions using the AI Tutor
- Use supported lesson-context AI assistance
- Purchase paid courses
- Use Free or Premium membership plans

---

### Tutor Features

Tutors can:

- Create and manage courses
- Create and manage lessons
- Upload lesson videos and learning materials
- Automatically transcribe lecture videos
- Generate lesson topic suggestions
- Review, edit, accept, or reject generated topics
- Create quizzes manually
- Generate quiz questions using AI
- Review and edit AI-generated quiz drafts before saving
- View learning insights
- Identify lesson topics where students may be experiencing confusion

---

### Administrator Features

Administrators can:

- Manage users
- Manage platform content
- Review courses
- Approve or moderate course content
- Support overall platform administration

---

# AI and Intelligent Learning Features

## AI Tutor

EDUNova includes an AI Tutor powered by Google Gemini.

Students can use the AI Tutor for general educational questions. The system also supports lesson-context assistance where relevant lesson information can be provided to help the AI answer questions related to the student's current lesson.

The AI Tutor is designed to assist students rather than replace the tutor.

---

## Automatic Lecture Transcription

EDUNova can automatically transcribe uploaded lecture videos using Faster-Whisper.

Transcription is processed asynchronously by a separate Python worker rather than directly inside the main Node.js request.

The generated timestamped transcript information can be used to support lesson processing features such as automatic topic generation.

### Simplified Workflow

```text
Tutor uploads lesson video
        ↓
Backend creates transcription job
        ↓
Job stored in MongoDB
        ↓
Faster-Whisper Worker
        ↓
Timestamped transcription
        ↓
Transcription result stored
```

---

## Automatic Topic Generation

EDUNova can analyze lecture transcription data and suggest meaningful lesson topics and timestamp ranges.

Topic generation uses Sentence Transformers with the `all-MiniLM-L6-v2` model.

The topic-generation process runs through a separate Python worker.

Generated topics are suggestions rather than automatically accepted lesson content.

Tutors can:

- Review generated topics
- Edit topic titles
- Adjust timestamps
- Accept suggestions
- Reject suggestions

### Simplified Workflow

```text
Timestamped Transcript
        ↓
Topic Generation Job
        ↓
MiniLM Worker
        ↓
Suggested Topics
        ↓
Tutor Review
        ↓
Edit / Accept / Reject
```

---

## AI Quiz Generation

EDUNova allows tutors to generate draft quiz questions using Google Gemini.

Quiz generation uses saved lesson text content, such as:

- Lesson transcript
- Lesson description
- Lesson summary
- Saved topic titles

The uploaded video itself is not directly sent to Gemini for quiz generation.

Tutors choose the number of questions they want to generate. The backend sends the relevant saved lesson material to Gemini and validates the generated result before returning it to the tutor.

AI-generated questions are only **drafts**.

They are not automatically saved or published.

The tutor can review, edit, delete, or regenerate questions before using the existing lesson save process.

### AI Quiz Workflow

```text
Tutor selects number of questions
        ↓
Generate with AI
        ↓
Express Backend
        ↓
Load saved lesson content
        ↓
Google Gemini
        ↓
Server-side validation
        ↓
Quiz Draft
        ↓
Tutor reviews / edits
        ↓
Tutor saves lesson
        ↓
Course published / approved if required
        ↓
Students can access the quiz
```

This workflow keeps the tutor in control of the final quiz content.

---

# Learning Confusion Detection

EDUNova includes a learning confusion detection system designed to identify **potential student confusion** from recorded learning behavior.

The system records learning signals while students interact with lesson videos.

Examples of learning signals include:

- Video progress
- Active study time
- Pause behavior
- Replay behavior
- Lesson visits
- Lesson completion

These learning signals are processed using a trained Random Forest model.

The prediction is used as a learning indicator for tutor-facing Learning Insights.

The system does not claim that a confusion prediction proves that a student does not understand the material. Instead, it provides an indicator that may help tutors identify content that could require additional attention.

---

## Topic-Level Learning Insights

EDUNova can present learning insights at the lesson-topic level.

A topic confusion rate is shown only when enough qualifying learning data is available.

A student qualifies for a topic after reaching at least **50% unique coverage of that topic's video range**.

At least **5 qualifying students** are required before a topic confusion percentage is displayed.

When there is insufficient data, the system displays:

> Collecting learning data

This helps avoid presenting percentages based on very small amounts of learning data.

### Example

```text
Lesson 1

Variables       10% potential confusion
Loops           30% potential confusion
While Loops     80% potential confusion
```

These percentages represent learning indicators based on recorded behavior and should not be interpreted as direct measurements of student understanding or teaching quality.

---

# Course and Lesson Management

Tutors can create structured online courses containing multiple lessons.

Lessons can contain:

- Titles
- Descriptions
- Videos
- Learning resources
- Transcripts
- Topics
- Quizzes

The lesson management interface allows tutors to manage lesson content and update previously created lessons.

---

# Quiz System

EDUNova supports lesson-level quizzes.

Tutors can create quizzes manually or use AI to create an initial draft.

Supported quiz functionality includes:

- Multiple-choice questions
- True/False questions
- Correct-answer configuration
- Quiz attachments where supported
- Quiz results
- AI-generated multiple-choice drafts

AI generation does not replace the existing quiz editor. Generated questions are inserted into the same quiz-editing workflow so tutors can review them before saving.

---

# Learning Progress

EDUNova records student learning progress while students study courses.

The system can track information such as:

- Completed lessons
- Current lesson
- Video playback position
- Study time
- Recent learning activity

This allows students to continue their learning and allows the platform to support learning analytics.

---

# Payments and Memberships

EDUNova integrates Stripe for payment processing.

The platform supports:

- Paid course checkout
- Cart checkout
- Premium membership purchases
- Stripe Checkout
- Stripe webhook processing

Free courses can be enrolled in without going through Stripe payment.

---

## Membership Plans

EDUNova includes Free and Premium plans.

### Free

- Basic platform access
- Limited AI Tutor usage

### Premium

- Increased AI Tutor usage
- Premium account status

Current configured Premium pricing:

```text
Monthly: ฿99
Yearly:  ฿999
```

Premium purchases currently use one-time Stripe payments rather than automatic recurring renewal.

---

# System Architecture

EDUNova uses a multi-service architecture.

The React frontend communicates with the Node.js/Express backend through Nginx.

The backend handles the main application logic, authentication, course management, quiz management, payments, and communication with external services.

Long-running AI/ML processing such as transcription and topic generation is handled by separate workers.

```text
                         ┌─────────────────────┐
                         │       Student       │
                         │   Tutor / Admin     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   React + Vite UI   │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │        Nginx        │
                         │   Reverse Proxy     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Node.js / Express   │
                         │      Backend        │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
      ┌───────────────┐     ┌───────────────┐     ┌───────────────┐
      │ MongoDB Atlas │     │ Google Gemini │     │    Stripe     │
      │ Database/Jobs │     │ Tutor + Quiz  │     │   Payments    │
      └───────┬───────┘     └───────────────┘     └───────────────┘
              │
       ┌──────┴───────────────┐
       │                      │
       ▼                      ▼
┌────────────────┐    ┌────────────────┐
│ Faster-Whisper │    │ MiniLM Worker  │
│     Worker     │    │ Topic          │
│ Transcription  │    │ Generation     │
└────────────────┘    └────────────────┘


Student Learning Signals
          │
          ▼
┌──────────────────────┐
│ Random Forest        │
│ Confusion Detection  │
│ Service              │
└──────────┬───────────┘
           │
           ▼
     Learning Insights
```

---

# Technology Stack

## Frontend

- React
- Vite
- JavaScript
- CSS
- React Router

## Backend

- Node.js
- Express.js
- REST APIs
- JWT-based authentication

## Database

- MongoDB
- Mongoose
- MongoDB Atlas

## Artificial Intelligence

- Google Gemini
- Faster-Whisper
- Sentence Transformers
- `all-MiniLM-L6-v2`

## Machine Learning

- Random Forest
- Python

## Payments

- Stripe Checkout
- Stripe Webhooks

## Deployment

- Microsoft Azure Virtual Machine
- Ubuntu Linux
- Nginx
- systemd

---

# Main Learning Workflow

A typical EDUNova learning workflow is:

```text
Tutor creates course
        ↓
Tutor creates lessons
        ↓
Tutor uploads learning content
        ↓
Lecture video can be transcribed
        ↓
Lesson topics can be generated
        ↓
Tutor reviews lesson content
        ↓
Tutor creates quiz manually
             OR
Tutor generates AI quiz draft
        ↓
Tutor reviews and saves lesson
        ↓
Course published / approved
        ↓
Student enrolls
        ↓
Student studies lesson
        ↓
Progress and learning signals recorded
        ↓
Confusion Detection
        ↓
Learning Insights
        ↓
Tutor identifies areas that may
need additional explanation
```

---

# Asynchronous AI Processing

Some EDUNova AI features perform operations that can take longer than a normal web request.

For these operations, EDUNova uses asynchronous jobs.

MongoDB stores durable job information, while separate workers process the jobs.

For example:

```text
Express Backend
      ↓
Create Job
      ↓
MongoDB
      ↓
Python Worker
      ↓
Process AI/ML Task
      ↓
Store Result
      ↓
Frontend retrieves result
```

This architecture is used for features such as lecture transcription and topic generation.

---

# Deployment Architecture

EDUNova is deployed on a Microsoft Azure Virtual Machine.

```text
Internet
   ↓
Nginx
   ↓
React Frontend
   +
Express Backend
   ↓
MongoDB Atlas / External Services

Separate system services:
   ├── Express Backend
   ├── Transcription Worker
   ├── Topic Generation Worker
   └── Confusion Detection Service
```

Nginx serves the production frontend and acts as a reverse proxy for backend API requests.

The application services and AI/ML workers can be managed independently using systemd.

---

# Security and Access Control

EDUNova uses role-based access control for different types of users.

Main roles include:

- Student
- Tutor
- Administrator

Protected backend routes require authentication and appropriate authorization.

For example, tutor-specific operations require an authenticated tutor account, and course-management operations verify access to the relevant course.

Sensitive configuration such as API keys, database credentials, and payment secrets is stored outside the source code using environment configuration.

---

# Project Goal

The goal of EDUNova is to create an intelligent learning platform that combines:

- Online course management
- Student learning
- Artificial intelligence
- Machine learning
- Learning analytics
- Automated content assistance

EDUNova does not aim to replace tutors.

Instead, AI is used to assist tutors with tasks such as:

- Lecture transcription
- Lesson organization
- Topic suggestions
- Quiz preparation
- Identifying potential learning difficulties

At the same time, students receive a more interactive learning environment with AI assistance, quizzes, progress tracking, and structured lesson content.

---

# Project Status

EDUNova is developed as a Senior Project.

The repository contains implementations for the core learning platform together with AI-assisted tutoring, lecture transcription, topic generation, AI quiz generation, learning confusion detection, payments, subscriptions, administration, and deployment configuration.

AI and machine-learning features depend on their corresponding models, workers, environment configuration, and external services being correctly configured in the deployment environment.

---

# Important Note

Do not commit sensitive configuration to the repository.

The following should remain private:

- `.env` files
- Gemini API keys
- Stripe secret keys
- Stripe webhook secrets
- MongoDB connection strings
- Azure credentials
- Private SSH keys
- Production user data
- Uploaded private files
- Local AI model files where excluded from version control
