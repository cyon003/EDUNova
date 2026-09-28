# EDUNova – AI-Powered Learning Platform

EDUNova is a web-based learning management platform designed to provide a more interactive and intelligent online learning experience for students and tutors.

The platform combines traditional learning management features with AI-assisted tools such as an AI Tutor, automatic lecture transcription, topic generation, AI-generated quizzes, and learning confusion detection.

## Main Features

### Student
- Browse and enroll in courses
- Watch lesson videos and track learning progress
- Complete lesson quizzes
- View lesson topics and navigate through lesson content
- Ask questions using the AI Tutor
- Receive AI assistance based on lesson context
- Purchase paid courses
- Free and Premium subscription plans

### Tutor
- Create and manage courses and lessons
- Upload lesson videos and learning materials
- Automatically transcribe lecture videos
- Generate lesson topics from transcripts
- Review and edit generated topics
- Create quizzes manually
- Generate quiz questions with AI from saved lesson content
- Review and edit AI-generated quizzes before saving
- View learning insights and student confusion information

### Admin
- Manage users and platform content
- Review and moderate courses
- Manage platform operations and course approval

## AI Features

### AI Tutor

EDUNova provides an AI Tutor powered by Google Gemini. Students can use it for general learning questions as well as supported lesson-context interactions.

### Automatic Lecture Transcription

Uploaded lecture videos can be transcribed using Faster-Whisper. The generated transcript can then be used by other learning features.

### Automatic Topic Generation

EDUNova analyzes lesson transcripts using Sentence Transformers to suggest meaningful lesson topics and timestamp ranges. Tutors can review, edit, accept, or reject these suggestions.

### AI Quiz Generation

Tutors can automatically generate multiple-choice quiz questions from saved lesson content using Gemini.

The AI only creates a draft. Tutors can review, modify, delete, or regenerate questions before saving the lesson, keeping the tutor in control of the final quiz.

### Confusion Detection

EDUNova records learning behavior signals and uses a Random Forest model to identify potential student confusion. The resulting learning insights help tutors identify lesson content that may require additional explanation.

## System Architecture

The main system consists of:

- **Frontend:** React + Vite
- **Backend:** Node.js + Express.js
- **Database:** MongoDB Atlas
- **AI Tutor & Quiz Generation:** Google Gemini
- **Lecture Transcription:** Faster-Whisper
- **Topic Generation:** Sentence Transformers / MiniLM
- **Confusion Detection:** Random Forest
- **Payment:** Stripe
- **Deployment:** Microsoft Azure Virtual Machine
- **Reverse Proxy:** Nginx
- **Process Management:** systemd

Simplified architecture:

Frontend (React)
        |
        v
Nginx Reverse Proxy
        |
        v
Node.js / Express Backend
        |
        +---- MongoDB Atlas
        |
        +---- Google Gemini
        |
        +---- Transcription Worker (Faster-Whisper)
        |
        +---- Topic Generation Worker (MiniLM)
        |
        +---- Confusion Detection Service (Random Forest)
        |
        +---- Stripe Payment

## Technology Stack

### Frontend
- React
- Vite
- JavaScript
- CSS

### Backend
- Node.js
- Express.js
- REST APIs
- JWT-based authentication

### Database
- MongoDB
- Mongoose
- MongoDB Atlas

### Artificial Intelligence / Machine Learning
- Google Gemini
- Faster-Whisper
- Sentence Transformers
- all-MiniLM-L6-v2
- Random Forest
- Python

### Payment
- Stripe Checkout
- Stripe Webhooks

### Deployment
- Microsoft Azure VM
- Ubuntu Linux
- Nginx
- systemd

## Learning Workflow

A typical learning workflow in EDUNova is:

1. A tutor creates a course and uploads lesson content.
2. Lecture videos can be automatically transcribed.
3. EDUNova can generate lesson topics from the transcript.
4. The tutor reviews and confirms the lesson content.
5. AI can generate draft quiz questions from saved lesson material.
6. The tutor reviews and saves the quiz.
7. Students enroll in the course and study the lessons.
8. EDUNova records learning progress and learning behavior signals.
9. The confusion detection system analyzes learning signals.
10. Tutors can use learning insights to identify content where students may need additional support.

## AI Quiz Generation Workflow

Tutor
  ↓
Select Number of Questions
  ↓
Generate with AI
  ↓
Express Backend
  ↓
Saved Lesson Content
  ↓
Google Gemini
  ↓
Server-side Validation
  ↓
Quiz Draft
  ↓
Tutor Reviews / Edits
  ↓
Save Lesson
  ↓
Quiz Available to Students

AI-generated quizzes are never automatically published. The tutor must review and save the lesson before students can access the quiz.

## Deployment

EDUNova is deployed on a Microsoft Azure Virtual Machine.

Nginx serves the frontend and acts as a reverse proxy for backend API requests. The Node.js backend and supporting AI/ML services are managed using systemd.

MongoDB Atlas is used as the cloud database, while external AI and payment functionality is provided through Google Gemini and Stripe.

## Project Goal

The goal of EDUNova is to combine learning management, artificial intelligence, and learning analytics in one platform.

Rather than replacing tutors, EDUNova uses AI to assist them with repetitive tasks such as transcription, topic organization, quiz preparation, and identifying learning difficulties.

The platform aims to help students learn more effectively while giving tutors useful information about the learning process.

## Project Status

EDUNova is developed as a Senior Project and currently includes functional implementations of its core learning, AI, quiz, payment, subscription, and learning-analysis features.
