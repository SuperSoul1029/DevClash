## March 22, 2026 - Phase F1 Completed

### What Was Completed

- Implemented frontend Phase F1 in the `frontend` app with JavaScript React files.
- Added route architecture with protected and guest-only paths:
  - `/login`
  - `/signup`
  - `/`
  - `/topics`
  - `/tests`
  - fallback `*` not found route.
- Built auth flow scaffold with context-driven login/signup/logout and loading/error states.
- Created responsive app shell with desktop and mobile navigation.
- Created reusable UI primitives:
  - `Button`
  - `Card`
  - `Chip`
  - `Badge`
  - `Modal`
  - `DataTable`
  - `ChartFrame`
  - `Spinner`
- Built F1 page scaffolds:
  - login page
  - signup page
  - home dashboard scaffold
  - topic tracker scaffold
  - test center scaffold
  - not found page.
- Reused common UI components across the major screens (dashboard/topic/test/auth) and ensured no dead routes.
- Switched frontend runtime entry to JavaScript (`main.jsx`) and updated Vite HTML entry accordingly.

### How It Was Done

- Created app providers and routing modules under `src/app`.
- Added `AuthContext` under `src/context` for centralized auth state and mock async auth actions.
- Added layout and UI primitives under `src/components/layout` and `src/components/ui`.
- Added page-level scaffolds under `src/pages` with clear guidance copy, empty states, and loading affordances.
- Replaced starter global styles with a cohesive responsive design system using CSS variables.
- Updated lint/build setup for JavaScript-first frontend flow.

### Adjustments to Next Steps

- Phase F2 can now focus directly on backend-connected planner/retention/topic state without additional routing or shell setup.
- Keep the new reusable UI primitives as the only source for cards, buttons, status chips, modal dialogs, tables, and chart wrappers.
- During F2 integration, preserve current protected-route behavior and wire real auth/profile data into `AuthContext`.

## March 22, 2026 - Phase F2 Completed

### What Was Completed

- Implemented frontend Phase F2 in the `frontend` app using JavaScript React modules.
- Added a shared learning state layer for planner, retention, and topic coverage with persistence after refresh.
- Delivered dashboard F2 experience with live metrics for:
  - retention score,
  - today plan count,
  - overdue task count,
  - weak topics.
- Delivered planner interactions with task status transitions:
  - complete task,
  - skip task,
  - replan task to a selected date.
- Delivered planner view toggles in dashboard:
  - list view (table with controls),
  - calendar view (date-grouped task cards).
- Replaced topic tracker scaffold with functional manual coverage controls:
  - mark topic completed,
  - unmark topic completed,
  - reset manual override back to auto signal.
- Added visual coverage source cues (auto vs manual override) and confidence/risk summaries.
- Kept protected routes and existing F1 navigation behavior intact.

### How It Was Done

- Created `LearningContext` in `src/context/LearningContext.jsx` as the F2 app-state provider.
- Implemented localStorage-backed state initialization and update persistence to emulate backend-connected state behavior for MVP iteration.
- Added deterministic derived state helpers for:
  - task display status (today/overdue/completed/skipped/scheduled),
  - calendar bucketing,
  - weak-topic extraction,
  - retention score recalculation based on completion, skips, and coverage.
- Wired `LearningProvider` through `src/app/AppProviders.jsx` so all protected pages can consume the same F2 state.
- Updated `src/pages/DashboardPage.jsx` to render:
  - live summary cards,
  - dynamic retention curve frame,
  - focus chips,
  - planner controls across list and calendar modes.
- Updated `src/pages/TopicTrackerPage.jsx` to render tracked topics with action buttons for manual coverage overrides.
- Extended `src/index.css` with responsive styles for inline planner actions, view toggles, and calendar cards.
- Verified quality gates:
  - `npm run lint` passes,
  - `npm run build` passes.

### Adjustments to Next Steps

- Phase F3 can now focus directly on adaptive test generation UX and exam lifecycle screens, reusing F2 weak-topic and retention signals as input hints.
- Keep `LearningContext` as the temporary contract boundary until B2/B3 backend APIs are available; then replace localStorage persistence with API calls behind the same action methods.
- Preserve policy alignment from plan: answer keys and explanations remain hidden in pre-submit flows once test attempt screens are introduced.

## March 22, 2026 - Phase F3 Completed

### What Was Completed

- Implemented frontend Phase F3 in the `frontend` app using JavaScript React modules.
- Replaced the Test Center scaffold with a complete adaptive exam lifecycle UX:
  - exam customization form,
  - generated exam list,
  - timed attempt interface,
  - post-submit report and explanation review,
  - adaptive next-set recommendations.
- Added full exam customization controls required by plan:
  - difficulty,
  - question count,
  - total duration,
  - question-type mix,
  - topic include/exclude,
  - negative marking toggle and value.
- Added pre-submit policy protection in UX flow:
  - answer key and explanations are not displayed during active attempts,
  - answer key and explanations are displayed only after submission.
- Added attempt-time learner signal capture:
  - answer accuracy,
  - per-question confidence,
  - per-question time tracking,
  - autosave snapshots during timed attempts.
- Added adaptive recommendation loop:
  - weak topics extracted from submission analytics,
  - targeted next question sets generated from weak topics,
  - "why this was assigned" rationale shown per recommendation.

### How It Was Done

- Extended `LearningContext` state contract to include F3 test domain models:
  - `defaultSettings`,
  - `generatedExams`,
  - `activeAttempt`,
  - `submittedAttempts`,
  - `adaptiveSets`.
- Added context action methods for complete workflow handling:
  - `createGeneratedExam`,
  - `beginExamAttempt`,
  - `saveExamAttempt`,
  - `submitExamAttempt`,
  - `generateAdaptivePracticeSet`.
- Implemented deterministic blueprint and question-generation helpers that honor customization controls and topic filters.
- Implemented scoring and post-submit analytics helpers:
  - weighted score with optional negative marking,
  - topic breakdown,
  - weak-topic extraction,
  - detailed answer review payload with explanations.
- Rebuilt `TestCenterPage` with composed cards and data tables to support create -> attempt -> submit -> review flow.
- Added new responsive styling in `src/index.css` for F3 controls and exam/review views while preserving existing visual language.
- Verified quality gates:
  - `npm.cmd run lint` passes,
  - `npm.cmd run build` passes.

### Adjustments to Next Steps

- Backend Phase B3 can now map directly to the frontend F3 context contract and replace local generation/scoring with API-backed orchestration while preserving UI behavior.
- Keep current post-submit reveal policy unchanged when integrating server APIs to ensure pre-submit endpoints do not leak key/explanation data.
- Reuse the existing adaptive recommendation rationale UI contract when backend practice endpoints become available.

## March 22, 2026 - Phase F4 Completed

### What Was Completed

- Implemented frontend Phase F4 in the `frontend` app using JavaScript React modules.
- Added a complete YouTube AI Explainer UX with protected route and navigation entry:
  - `/youtube`.
- Delivered end-to-end YouTube processing experience with robust states:
  - URL input and validation,
  - in-progress timeline with staged pipeline updates,
  - failure messaging with retry,
  - deterministic demo fallback generation for low-quality transcript scenarios.
- Delivered F4 output surface with all planned sections:
  - plain-English overview,
  - concise but detailed bullet-point explanation,
  - key concepts,
  - suggested revision cards.
- Added job history table so multiple video runs can be reviewed in one demo session.
- Preserved responsive desktop/mobile behavior with dedicated F4 styles and reveal animations.

### How It Was Done

- Added `src/pages/YouTubeExplainerPage.jsx` with staged async simulation logic and resilient state-driven rendering.
- Extended `src/context/LearningContext.jsx` with persisted YouTube explainer domain state and actions:
  - `startYoutubeExplainJob`,
  - `setYoutubeActiveJob`,
  - `setYoutubeJobProgress`,
  - `resolveYoutubeJob`,
  - `retryYoutubeJob`,
  - `runYoutubeFallback`.
- Implemented deterministic seeded output generation in context for demo reliability (success/failure/fallback paths).
- Updated `src/app/AppRouter.jsx` to register the new protected route.
- Updated `src/components/layout/AppShell.jsx` navigation to expose the F4 page.
- Extended `src/index.css` with F4-specific timeline, status, and result card styles optimized for mobile and desktop.
- Verified quality gates:
  - `npm.cmd run lint` passes,
  - `npm.cmd run build` passes.

### Adjustments to Next Steps

- Phase B4 and A5 can now integrate against the F4 frontend contract by replacing deterministic local resolver logic with API-backed job orchestration and transcript quality metadata.
- Keep the current fallback-first UX behavior when backend processing fails so judges can always complete the walkthrough.
- Retain current output schema sections (overview, bullets, concepts, revision cards) as stable frontend contract for backend response mapping.

## March 22, 2026 - Phase B1 Completed

### What Was Completed

- Implemented backend Phase B1 by creating a new JavaScript MERN service under `backend`.
- Added Express API foundation with environment config, MongoDB connection, and shared middleware.
- Implemented auth and profile API groups:
  - `POST /api/auth/signup`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `GET /api/users/me/profile`
  - `PUT /api/users/me/profile`
- Implemented curriculum API groups:
  - `GET /api/subjects`
  - `GET /api/subjects/:subjectId`
  - `POST /api/subjects`
  - `PATCH /api/subjects/:subjectId`
  - `DELETE /api/subjects/:subjectId`
  - `GET /api/topics`
  - `GET /api/topics/:topicId`
  - `POST /api/topics`
  - `PATCH /api/topics/:topicId`
  - `DELETE /api/topics/:topicId`
- Added Mongoose models and indexes for B1 data domains:
  - `User`,
  - `Profile`,
  - `Subject`,
  - `Topic`.
- Added request validation and centralized error handling:
  - Zod payload validators,
  - reusable validation middleware,
  - not-found and error middleware for consistent API responses.
- Added seed script for demo bootstrap with sample user/curriculum/topic data.
- Added backend docs and API index details in `backend/README.md`.

### How It Was Done

- Scaffolded `backend` with Node + Express and JavaScript-first scripts (`dev`, `start`, `lint`, `test`, `seed`).
- Configured environment and DB modules (`src/config/env.js`, `src/config/db.js`) and app/server bootstrap (`src/app.js`, `src/server.js`).
- Implemented JWT auth middleware and secure password hashing with `bcryptjs`.
- Built controller-route structure for auth, user profile, and curriculum resources.
- Added essential indexes aligned with B1 requirements:
  - user email uniqueness and role/time access,
  - profile user uniqueness,
  - subject code/class uniqueness,
  - topic subject/slug uniqueness and class+subject+updatedAt query optimization.
- Added API test coverage using Jest + Supertest + in-memory MongoDB.
- Verified quality gates:
  - `npm.cmd run lint` passes,
  - `npm.cmd run test` passes.

### Adjustments to Next Steps

- Phase B2 can now build directly on the existing auth/profile/curriculum contracts without reworking service foundations.
- Keep current API base path pattern (`/api/...`) and validation middleware contract for new retention/planner/coverage routes.
- Reuse existing model/index conventions when introducing B2 learning activity and planning collections.

## March 22, 2026 - Phase B2 Completed

### What Was Completed

- Implemented backend Phase B2 in the `backend` service using JavaScript MERN modules.
- Added retention, planner, coverage, and progress API groups:
  - `POST /api/retention/events`
  - `GET /api/retention/state`
  - `GET /api/planner/daily`
  - `POST /api/planner/tasks/:taskId/status`
  - `POST /api/planner/rebalance`
  - `POST /api/coverage/sync-activity`
  - `POST /api/coverage/manual-mark`
  - `POST /api/coverage/manual-unmark`
  - `GET /api/coverage/state`
  - `GET /api/progress/overview`
- Added B2 data models and indexes for learning activity and planning:
  - `RevisionEvent`,
  - `TopicProgress`,
  - `PlannerTask`.
- Implemented deterministic retention updates from activity outcomes (correct/incorrect/skipped/completed).
- Implemented coverage merge behavior that combines:
  - activity-driven auto coverage score,
  - manual mark/unmark overrides.
- Implemented planner generation and rebalance logic with behavior-aware triggers based on overdue/skipped/completion-rate signals.
- Added B2 integration tests validating end-to-end flows for retention, coverage, planner, and progress overview.

### How It Was Done

- Added shared learning engine utilities in `src/utils/learningEngine.js` for:
  - retention score update,
  - next-review scheduling,
  - coverage status merge,
  - planner priority and reason generation.
- Implemented controller modules:
  - `src/controllers/retentionController.js`,
  - `src/controllers/coverageController.js`,
  - `src/controllers/plannerController.js`,
  - `src/controllers/progressController.js`.
- Implemented route modules and registered them in `src/routes/index.js`:
  - `src/routes/retentionRoutes.js`,
  - `src/routes/coverageRoutes.js`,
  - `src/routes/plannerRoutes.js`,
  - `src/routes/progressRoutes.js`.
- Added request validators:
  - `src/validators/retentionValidators.js`,
  - `src/validators/coverageValidators.js`,
  - `src/validators/plannerValidators.js`.
- Updated seed cleanup in `scripts/seed.js` to clear new B2 collections for deterministic demo reset.
- Updated backend docs in `backend/README.md` to include B2 APIs and indexes.
- Addressed mongoose v9 deprecation warnings by using `returnDocument: "after"` in `findOneAndUpdate` calls.
- Verified quality gates:
  - `npm.cmd run lint` passes,
  - `npm.cmd run test` passes.

### Adjustments to Next Steps

- Phase B3 can now reuse B2 learner-signal and topic-progress state as input to exam blueprinting and adaptive `practice/next-set` targeting.
- Preserve current policy boundaries when implementing B3: pre-submit flows must continue to avoid exposing answer keys/explanations.
- Before implementing B3 generation logic, run the required brainstorming pass on exact exam-generation constraint enforcement and secure post-submit reveal strategy.

## March 22, 2026 - Phase B3 Completed

### What Was Completed

- Implemented backend Phase B3 exam and adaptive practice APIs in the `backend` service using JavaScript MERN modules.
- Added full custom exam workflow endpoints:
  - `POST /api/tests/generate`
  - `POST /api/tests/start`
  - `POST /api/tests/save`
  - `POST /api/tests/submit`
  - `GET /api/tests/result/:attemptId`
- Added adaptive practice targeting endpoint:
  - `POST /api/practice/next-set`
- Implemented secure answer-key policy enforcement:
  - pre-submit responses hide answer keys and explanations,
  - result endpoint is locked before final submission,
  - post-submit result returns full answer key, explanations, and review analytics.
- Implemented deterministic exam generation honoring required customization controls:
  - difficulty,
  - question count,
  - duration,
  - question type mix,
  - topic include/exclude,
  - negative marking settings.
- Added post-submit scoring and analytics outputs:
  - weighted score with negative marking,
  - correct/incorrect/unattempted counts,
  - topic-level breakdown,
  - weak-topic extraction.

### How It Was Done

- Added new B3 persistence models:
  - `src/models/GeneratedExam.js`
  - `src/models/ExamAttempt.js`
- Added B3 validators:
  - `src/validators/testValidators.js`
  - `src/validators/practiceValidators.js`
- Added B3 controllers:
  - `src/controllers/testController.js`
  - `src/controllers/practiceController.js`
- Added B3 routes and API registration:
  - `src/routes/testRoutes.js`
  - `src/routes/practiceRoutes.js`
  - wired both in `src/routes/index.js`.
- Added B3 integration tests in `tests/b3.api.test.js` covering:
  - secure pre/post-submit key visibility behavior,
  - exam attempt save/submit lifecycle,
  - adaptive next-set targeting after weak performance.
- Updated supporting files:
  - seed reset cleanup for new B3 collections in `scripts/seed.js`,
  - backend API/index documentation in `backend/README.md`.
- Verified quality gates:
  - `npm.cmd run lint` passes,
  - `npm.cmd run test` passes (all suites passing).

### Adjustments to Next Steps

- Frontend F3 can now replace local exam simulation with these B3 APIs while keeping the same policy contract for key reveal timing.
- B4/A4 integration can reuse B3 weak-topic analytics as retrieval and recommendation context for tutor guidance.
- If needed before final demo hardening, add `POST /api/practice/feedback` as an optional companion endpoint to persist per-question confidence/time signals from targeted practice sessions.

## March 22, 2026 - Phase B4 Completed

### What Was Completed

- Implemented backend Phase B4 reliability and AI orchestration APIs in the `backend` service using JavaScript MERN modules.
- Added tutor endpoint with citation-enforced response contract and abstain behavior:
  - `POST /api/tutor/query`
- Added asynchronous YouTube explain orchestration endpoints:
  - `POST /api/media/youtube/explain`
  - `GET /api/media/youtube/explain/:jobId`
- Added generic async job status endpoint:
  - `GET /api/jobs/:jobId`
- Added health check endpoint under API namespace with reliability checks:
  - `GET /api/health`
- Added queue-backed YouTube job processing with BullMQ primary mode and in-memory fallback when Redis is unavailable.
- Added reliability middleware for:
  - API rate limiting,
  - structured JSON request/error logging,
  - per-request correlation IDs.
- Added B4 model/index for async media processing state:
  - `VideoJob`.
- Added B4 integration tests for tutor, YouTube job lifecycle, jobs status, and health checks.

### How It Was Done

- Added controllers:
  - `src/controllers/tutorController.js`
  - `src/controllers/mediaController.js`
  - `src/controllers/jobController.js`
  - `src/controllers/healthController.js`
- Added routes and route registration:
  - `src/routes/tutorRoutes.js`
  - `src/routes/mediaRoutes.js`
  - `src/routes/jobRoutes.js`
  - `src/routes/healthRoutes.js`
  - wired in `src/routes/index.js`.
- Added validators:
  - `src/validators/tutorValidators.js`
  - `src/validators/mediaValidators.js`
  - `src/validators/jobValidators.js`
- Added queue/services layer:
  - `src/services/jobQueue.js`
  - `src/services/youtubeJobs.js`
  - deterministic explain generator in `src/utils/youtubeEngine.js`.
- Added reliability utilities/middleware:
  - `src/utils/logger.js`
  - `src/middleware/requestContext.js`
  - `src/middleware/structuredLogger.js`
  - `src/middleware/rateLimit.js`
  - error payload tracing update in `src/middleware/errorHandler.js`.
- Wired queue initialization in `src/server.js` and processor registration in `src/app.js`.
- Updated supporting files:
  - added new env vars in `.env.example`,
  - updated seed cleanup in `scripts/seed.js`,
  - updated backend docs in `backend/README.md`.
- Added dependencies required for B4:
  - `bullmq`
  - `ioredis`
  - `express-rate-limit`.

### Adjustments to Next Steps

- A4 can now plug real retrieval + reranking + LLM orchestration into `POST /api/tutor/query` while preserving citation and abstain contract.
- A5/B4 backend integration can replace deterministic YouTube explanation generation with transcript + model pipeline behind the same job/result schema.
- For demo reliability, keep in-memory queue fallback enabled; production should set `REDIS_URL` to activate BullMQ mode.

## March 22, 2026 - Reliability & Redis Fallback Patch

### What Was Completed

- Fixed a critical "502 Bad Gateway" error preventing signup and login during local development.
- Implemented a "fail-fast" and "graceful fallback" mechanism for the Redis-backed job queue.
- Ensured the backend server can boot successfully even when a Redis server is not reachable on `localhost:6379`.
- Verified the fix with successful REST calls to the health and auth endpoints on the live local server.

### How It Was Done

- Modified `backend/src/services/jobQueue.js` to use `lazyConnect: true` and a strict `connectTimeout`.
- Added a `retryStrategy: () => null` to prevent infinite reconnection loops that previously blocked the Express server from starting.
- Added explicit `redisConnection.connect()` and `ping()` checks with `try/catch` wrapping.
- Targeted the root cause: the frontend proxy (Vite) was returning 502 because the backend script was hanging in the `initializeQueues()` await loop before reaching the `app.listen()` call.
- Verified in PowerShell using `Invoke-WebRequest` that `POST /api/auth/signup` now returns `201 Created` instead of a gateway error.

### Adjustments to Next Steps

- Development can now proceed on machines without a local Redis installation by relying on the automatic in-memory fallback.
- Future production deployments should still provide a valid `REDIS_URL` to enable persistent BullMQ processing for YouTube jobs.
- Maintain the `npm.cmd` usage pattern in Windows environments where PowerShell execution policies might restrict standard `npm` script execution.

## March 22, 2026 - Goal-Driven Planner + Unified Subject-Topic Ledger

### What Was Completed

- Implemented a unified subject-topic progress ledger in backend persistence and API responses for cross-feature cohesion.
- Expanded topic tracking metrics to persist and expose:
  - covered/not covered state,
  - completion count,
  - practice question attempts and correct count,
  - practice accuracy,
  - tests taken,
  - cumulative test score/max score,
  - average and latest test percentages.
- Added subject-level ledger persistence for per-subject rollups across all topics.
- Wired ledger updates into core learning flows:
  - planner task completion/skips,
  - retention event updates,
  - coverage signal/manual overrides,
  - test submission grading.
- Added a new goal-driven custom planner API:
  - `POST /api/planner/generate-custom`
  - accepts manual topic selection, intent (`cover`/`revise`), familiarity level, timeframe, and optional per-topic preferred date.
- Added a detailed ledger API for frontend/feature integrations:
  - `GET /api/progress/ledger`.
- Implemented frontend dashboard planner experience requested by product direction:
  - initial state shows only centered `Generate Plan` button,
  - opens customizable planner builder form,
  - users manually select topics,
  - each topic row shows progress data in-line,
  - suggested day auto-populates from progress signals and can be edited manually,
  - final plan generation creates backend planner tasks.
- Updated topic tracker tables to display the new ledger metrics for consistency across feature surfaces.

### How It Was Done

- Backend model/data updates:
  - extended `TopicProgress` schema with completion/practice/test counters and score aggregates,
  - added `SubjectProgress` model for user+subject rollups,
  - added `src/utils/progressLedger.js` to sync subject aggregates from topic progress changes.
- Backend controller/API updates:
  - `plannerController` now supports custom plan generation and writes manual planner tasks from user-defined topic inputs,
  - `testController` now writes per-topic test/practice ledger stats on submission,
  - `coverageController` now returns richer per-topic state plus per-subject summaries,
  - `progressController` now exposes `GET /api/progress/ledger` and enriched overview metrics.
- Frontend updates:
  - `LearningContext` now maps and stores subject/topic ledger metrics and includes `generateCustomPlan` action,
  - `DashboardPage` planner section rebuilt to support button-first composer flow with topic-level customization and editable schedule dates,
  - `TopicTrackerPage` columns expanded to include completion/practice/test metrics.
- Quality verification:
  - `backend`: `npm.cmd run lint` passes, `npm.cmd run test` passes,
  - `frontend`: `npm.cmd run lint` passes, `npm.cmd run build` passes.

### Adjustments to Next Steps

- Any new test/quiz/practice implementation should treat the subject-topic ledger as mandatory integration state, not optional metadata.
- Frontend test and planner surfaces can now rely on a consistent per-topic/per-subject progress contract for adaptive targeting and reporting.
- Next implementation slices should prefer extending the ledger contract (and sync points) instead of creating parallel feature-local tracking fields.

## March 22, 2026 - Reliability & Environment Troubleshooting

### What Was Completed

- Investigated and resolved a "Server crashed" error (`EADDRINUSE`) on port 5000.
- Optimized backend bootstrap to prevent duplicate `app.listen` calls and handle stale process cleanup.
- Verified workspace-wide consistency across environment configurations and port assignment logic.

### How It Was Done

- Analyzed `server.js` and `app.js` to ensure the listener is only invoked once in the entry point.
- Provided shell commands (`netstat`, `taskkill`) to resolve port conflicts from orphaned Node.js processes.
- Verified `package.json` scripts and `nodemon` configuration for reliable local development restarts.

### Adjustments to Next Steps

- Maintain port 5000 as the standard backend entry to match current frontend proxy settings.
- Ensure any future service additions (e.g., microservices) use the `env.js` port registry to avoid address collisions.

## March 23, 2026 - Epic 1 Kickoff (AI Gaze Proctoring)

### What Was Completed

- Implemented Epic 1 initial proctoring flow in the test attempt workspace with strict activation scope: proctoring starts only during an active exam attempt.
- Added explicit user permission gating before any camera-based gaze detection begins.
- Kept gaze detection fully off-screen (no webcam preview or detection overlay rendered in UI).
- Extended backend submission flow to accept and persist `proctoringLogs` into `ExamAttempt` records.

### How It Was Done

- Frontend (`TestCenterPage`) now:
  - requests camera permission only after user clicks **Allow Camera Proctoring** during an active attempt,
  - runs hidden, local detection with browser APIs (`getUserMedia` + `FaceDetector` when available),
  - logs suspicious events like `look_away_over_3s` and `second_face_detected`,
  - stops and cleans up streams/intervals when the attempt ends, changes, or page unmounts.
- Frontend (`LearningContext`) now forwards `proctoringLogs` in `POST /api/tests/submit` payload.
- Backend updates:
  - `ExamAttempt` schema now includes `proctoringLogs`,
  - submit validator accepts optional `proctoringLogs`,
  - `submitExamAttempt` appends received proctoring evidence before finalizing submission.

### Adjustments to Next Steps

- Add richer on-device gaze orientation using a dedicated face landmarks model (MediaPipe/face-api) for stronger detection fidelity beyond fallback browser detector support.
- Expand backend/API tests to assert proctoring log persistence on submit.
- Decide policy behavior for denied camera permission during tests (allow with warning vs block submission/start).

### March 23, 2026 - Epic 1 Update (Multiple Person Detection)

- Improved multi-person detection reliability by adding a cross-browser fallback detector path.
- `TestCenterPage` now uses native `FaceDetector` when available and automatically falls back to TensorFlow BlazeFace when not available.
- Existing `second_face_detected` event logging now works across a wider set of browsers while keeping the same hidden-camera, permission-gated, test-only behavior.
- Frontend dependencies updated: `@tensorflow/tfjs`, `@tensorflow-models/blazeface`.
- Verification: `frontend` lint passes.

### March 23, 2026 - Epic 1 Update (Live Popup Alert)

- Added a live popup notification in test attempt flow when multiple faces are detected.
- `TestCenterPage` now opens a modal titled **Multiple Face Detected** with detected face count and timestamp.
- Popup remains scoped to active attempts only and keeps hidden-camera behavior unchanged.
- Verification: `frontend` lint passes.
## March 22, 2026 - Epic 0 (Real Generative AI Core) Executed

### What Was Completed

- Implemented Epic 0 LLM orchestration across core generation domains in the backend service.
- Replaced deterministic-only generation paths with LLM-first JSON-mode generation (with resilient fallback) for:
  - `GET /api/planner/daily` and `POST /api/planner/rebalance` in planner generation flow,
  - `POST /api/practice/next-set` in adaptive remedial practice flow,
  - `POST /api/tests/generate` in custom exam generation flow.
- Preserved existing exam security policy behavior:
  - pre-submit payloads still hide answer keys and explanations,
  - post-submit result endpoint still reveals answer keys/explanations only after final submission.

### How It Was Done

- Added shared AI utility layer:
  - `backend/src/utils/llmClient.js` now provides OpenAI-compatible chat-completions JSON calls with strict Zod validation and timeout handling.
- Extended environment configuration:
  - `backend/src/config/env.js` now supports `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_TIMEOUT_MS`.
- Planner intelligence (Subphase 0.1):
  - `plannerController` now sends topic-ledger candidate data (`TopicProgress` + priority signals) to the LLM and expects strict daily task JSON.
  - AI responses are normalized to allowed topic IDs and persisted as planner tasks; deterministic fallback triggers if AI is unavailable or malformed.
- Practice intelligence (Subphase 0.2):
  - `practiceController` now sends weak-topic analytics to the LLM for targeted remedial MCQ/True-False generation in strict JSON.
  - Output is validated/sanitized and constrained to known weak topics; deterministic fallback remains for reliability.
- Exam intelligence (Subphase 0.3):
  - `testController` now requests full custom exam items from the LLM under strict schema constraints (topic IDs, types, options, answer index, explanation).
  - AI output is normalized and backfilled with deterministic generation if output is incomplete.

### Quality Verification

- `backend`: `npm.cmd run lint` passes.
- `backend`: `npm.cmd run test` passes (full suite green).

### Adjustments to Next Steps

- Epic 1 (Gaze Detection) can proceed independently without touching the new LLM orchestration layer.
- For production reliability, provide valid provider credentials in `.env` and monitor rate limits/latency for LLM calls.
- If required for hardening, add request-level tracing fields (provider/model/tokens/latency) around LLM calls in structured logs.
