# Modular Implementation Plan V2: Real AI & Advanced Features

## Context: The "Intelligence" Pivot
**What are we doing?** We are transforming a functional MERN-stack learning prototype into a state-of-the-art AI retention system for the DevClash 2026 Hackathon.
**Why?** The initial build provided the "plumbing" (database, routes, and UI shells), but used deterministic math and hardcoded string templates as placeholders for intelligence. To win the hackathon, we must replace these mocks with genuine LLM orchestration, RAG pipelines, and on-device Computer Vision to prove the system actually "thinks" and "adapts" to the student.

---

## General Instructions

- **CRITICAL: Strict Modularity**: To avoid merge conflicts during parallel development (or when working in branches), every Epic must be implemented in its own isolated domain. 
  - **Backend**: Create new, dedicated controllers, routes, and models for new features rather than bloating existing ones.
  - **Frontend**: Componentize everything. Use the `src/components/features/` directory for Epic-specific logic so that a change in the "Tutor" doesn't touch the "Gaze Tracker" files.
- **Progress Tracking**: After every subphase, update `PlanV2 Progress Update.md`. Mention what was built, how the AI is processing the data, and any deviations from this plan.
- **Tech Stack**: Continue using **JavaScript (MERN)** for all core services. Python is strictly reserved for standalone AI microservices (like retrieval or heavy transcript processing) if Node's ecosystem isn't sufficient.
- **Ledger Consistency**: All learning-related features (Planner, Tests, Tutor) MUST read from and update the `TopicProgress` ledger to ensure the student's mastery data remains the "Single Source of Truth."

---

## Syllabus Reference

Class 11/12 High-Weightage Chapters (Physics, Chemistry, Maths, Biology) are used as the primary data points for generating AI content, practice tests, and Mind Map nodes.

---

## Epic 0: Replace Mocks with Real Generative AI (The Missing Core)
**Goal:** Rip out the hardcoded math and string templates from the existing Phase 2 & 3 backends and replace them with API calls to a real LLM for authentic intelligence.
**Model Source:** General Purpose LLM (Gemini 1.5 Pro, GPT-4o, or Claude 3.5 Sonnet) via standard API with JSON-mode prompting.

- **Subphase 0.1: AI Study Planner Agent**
  - Inside `plannerController.js`, implement an LLM integration that takes the student's `TopicProgress` ledger as a JSON prompt and asks the LLM to output a logically rebalanced daily planner in strict JSON schema.
- **Subphase 0.2: AI Adaptive Practice Generator**
  - Inside `practiceController.js`, connect to the LLM API to analyze the "weak topics" array and generate highly targeted remedial practice questions on the fly matching the student's exact failure patterns.
- **Subphase 0.3: AI Custom Exam Generator**
  - Refactor `POST /api/tests/generate`. The backend will feed the topic list and exact user settings (e.g., difficulty, true/false vs MCQ ratio) to the LLM to generate fresh questions matched to the DevClash requirements.

---

## Epic 1: AI Gaze Detection (Proctoring)
**Goal:** Run on-device gaze and face tracking during test attempts to flag cheating without uploading video to the cloud.
**Model Source:** Lightweight Browser Computer Vision (MediaPipe Face Landmarker or face-api.js), running locally on the client.

- **Subphase 1.1: Frontend On-Device Tracking**
  - Integrate a lightweight browser-based Computer Vision ML model (like `face-api.js` or `MediaPipe`).
  - Track if the student looks away from the screen for > 3 seconds, or a second face appears.
- **Subphase 1.2: Backend Proctoring Logs Validation**
  - Update `ExamAttempt` backend schema to accept `proctoringLogs` array.
  - Modify `POST /api/tests/submit` to save evidence of cheating.

---

## Epic 2: Interactive Mind Map & Custom Notes
**Goal:** Visual, explorable representation of the syllabus where users can attach their own markdown notes to topics.
**Model Source:** N/A (Rule-based tree traversal of database hierarchy).

- **Subphase 2.1: Curriculum & Notes API (Backend)**
  - Create `CustomNote` Mongoose model and standard basic CRUD controllers (`/api/notes/:topicId`).
  - Create `/api/curriculum/mindmap` to aggregate syllabus into a nested JSON tree.
- **Subphase 2.2: Frontend Interactive Node Graph**
  - Use a graph library (e.g., `reactflow`) on `MindMapPage.jsx`.
  - Add a `<TopicNoteEditor />` drawer to write persistent markdown notes against topics.

---

## Epic 3: RAG-Powered AI Tutor
**Goal:** Grounded doubt-solving mechanism utilizing standard trusted sources (NCERT).
**Model Source:** Hybrid retrieval using **Multi-QA Embeddings** (e.g., `text-embedding-004`) + Vector Search (MongoDB Atlas) + **Gemini/GPT-4o** for context-injected synthesis.

- **Subphase 3.1: Knowledge Base Ingestion & Vector Pipeline (Backend)**
  - Script to handle connections to MongoDB Atlas Vector Search.
  - Ingest logic to chunk educational PDFs (NCERT), call a text-embedding API, and push vectors to Atlas.
- **Subphase 3.2: Frontend Chat Details**
  - Implement RAG logic in `POST /api/tutor/query` to semantic search VectorDB, inject chunks into an LLM prompt, and stream response.
  - Build `<TutorChat />` UI to render markdown and `[citation 1]` links.

---

## Epic 4: Hinglish Voice AI (Voice Bot Extension)
**Goal:** Let users talk to the tutor in Hindi/Hinglish, and let the tutor speak back.
**Model Source:** **Whisper-v3 API** (STT for translation/transcription) and **Bhashini API** or **Google Cloud Indic TTS** (for natural output speech).

- **Subphase 4.1: Audio Endpoints (Backend)**
  - `POST /api/voice/transcribe`: Calls Whisper API (Speech-to-Text).
  - `POST /api/voice/synthesize`: Calls Indic TTS API (e.g. ElevenLabs or Google TTS).
- **Subphase 4.2: Frontend Voice Hooks**
  - Add `<AudioRecorder />` to Tutor Chat. Orchestrate the pipeline (Record -> Transcribe -> RAG Tutor -> Synthesize -> Play).

---

## Epic 5: Multimodal Video Processor (YouTube Explainer)
**Goal:** Finalize the F4/B4 mock to do real video content parsing.
**Model Source:** **Youtube Transcript API** (data source) + **Gemini 1.5 Flash** (efficient parsing of long transcripts into visual note JSON).

- **Subphase 5.1: Backend AI Transcript Engine**
  - Replace the mock logic with real `youtube-transcript` extraction.
  - Implement LLM prompts to extract the Overview, Bullets, Concepts, and Flashcards from the transcript text.
- **Subphase 5.2: Frontend Output Polish**
  - Ensure the frontend successfully polls `/api/jobs/:jobId` and parses the real LLM output safely, handling timeouts or missing YouTube captions gracefully.
