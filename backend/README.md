# DevClash Backend (Phase B4)

Node + Express + MongoDB backend foundation for the DevClash hackathon MVP.

## Stack

- JavaScript (Node.js)
- Express
- MongoDB + Mongoose
- JWT auth
- Zod validation
- Jest + Supertest tests

## Setup

1. Copy `.env.example` to `.env` and edit values.
2. Install dependencies:
   - `npm.cmd install`
3. Run server:
   - `npm.cmd run dev`

### Epic 0 LLM Configuration

To enable real AI generation for planner, practice, and exam generation endpoints:

- Set `LLM_API_KEY`
- Set `LLM_BASE_URL` (OpenAI-compatible chat-completions base URL)
- Set `LLM_MODEL` (for example `gpt-4o-mini`, `gpt-4o`, or another compatible model)
- Optional: tune `LLM_TIMEOUT_MS`

If these values are missing, the backend uses deterministic fallback generation for local reliability.

#### OpenRouter Setup

The backend now supports OpenRouter directly.

- `LLM_BASE_URL=https://openrouter.ai/api/v1`
- `LLM_MODEL=stepfun/step-3.5-flash:free` (or any OpenRouter model ID you prefer)
- `LLM_API_KEY=<your_openrouter_key>`
- Optional OpenRouter metadata headers:
  - `LLM_APP_NAME`
  - `LLM_SITE_URL`
- Optional reasoning mode:
  - `LLM_REASONING_ENABLED=true`

JSON mode behavior:

- By default, JSON mode is auto-disabled for OpenRouter-compatible calls to avoid provider/model incompatibilities.
- You can override with `LLM_FORCE_JSON_MODE=true` or `LLM_FORCE_JSON_MODE=false`.

## LLM Gateway Protocol (Phase 1)

AI generation now has a Gateway foundation to standardize model output contracts.

- Gateway entrypoint: `src/services/llmGateway/index.js`
- Contract registry: `src/services/llmGateway/contracts/registry.js`
- Initial contracts:
  - `planner.daily.tasks.v1`
  - `practice.nextset.v1`
  - `tests.generate.v1`

### Universal Envelope

Gateway expects model output in this shared shape:

- `outputType`
- `schemaVersion`
- `payload`
- `meta` (optional)

The Gateway validates the envelope and payload via Zod before returning data to controllers.

### Unified Gateway Result

Gateway returns a normalized object:

- `ok`
- `status`
- `contract` (`contractKey`, `outputType`, `schemaVersion`)
- `data` (validated payload)
- `envelope` (validated full envelope)
- `debug` (`error`, `rawOutput`, `model`, `providerBaseUrl`)

### Registering a New AI Tool Contract

1. Create a contract module in `src/services/llmGateway/contracts/` with:
   - Versioned `contractKey`
   - `outputType`
   - `schemaVersion`
   - Zod `payloadSchema`
   - `buildPrompts(input)`
2. Export the contract from `contracts/registry.js`.
3. Call `executeGatewayRequest(...)` from the feature controller.
4. Keep controller fallback behavior for reliability.

## Scripts

- `npm.cmd run dev` - Run with nodemon
- `npm.cmd run start` - Run production mode
- `npm.cmd run lint` - Lint all files
- `npm.cmd run test` - Run Jest API tests
- `npm.cmd run seed` - Seed demo users/curriculum

## API Groups (B1 + B4)

### Auth

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Users

- `GET /api/users/me/profile`
- `PUT /api/users/me/profile`

### Curriculum

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

### Retention

- `POST /api/retention/events`
- `GET /api/retention/state`

### Planner

- `GET /api/planner/daily`
- `POST /api/planner/tasks/:taskId/status`
- `POST /api/planner/rebalance`
- `POST /api/planner/generate-custom`

### Coverage

- `POST /api/coverage/sync-activity`
- `POST /api/coverage/manual-mark`
- `POST /api/coverage/manual-unmark`
- `GET /api/coverage/state`

### Progress

- `GET /api/progress/overview`
- `GET /api/progress/ledger`

### Tests

- `POST /api/tests/generate`
- `POST /api/tests/start`
- `POST /api/tests/save`
- `POST /api/tests/submit`
- `GET /api/tests/result/:attemptId`

### Practice

- `POST /api/practice/next-set`

### Tutor

- `POST /api/tutor/query`

### Media

- `POST /api/media/youtube/explain`
- `GET /api/media/youtube/explain/:jobId`

### Jobs

- `GET /api/jobs/:jobId`

### Health

- `GET /api/health`
- `GET /health`

## Indexes Added

- Users: unique email, role+createdAt
- Profiles: unique userId, classLevel+updatedAt
- Subjects: unique code+classLevel, classLevel+name
- Topics: unique subjectId+slug, classLevel+subjectId+updatedAt
- TopicProgress: unique userId+topicId, userId+nextReviewAt+retentionScore
- SubjectProgress: unique userId+subjectId, userId+updatedAt
- RevisionEvents: userId+topicId+occurredAt
- PlannerTasks: userId+dueDate+status, userId+topicId+dueDate+status
- GeneratedExams: userId+createdAt
- ExamAttempts: userId+examId+status, userId+submittedAt+status
- VideoJobs: userId+createdAt, status

## B4 Reliability Notes

- Queue mode defaults to in-memory if `REDIS_URL` is not configured.
- If Redis is configured and reachable, BullMQ is used for YouTube explain jobs.
- API-level request throttling is enabled via rate limiting middleware.
- Structured JSON request/error logging is enabled with per-request IDs.

## Seed Data

Run `npm.cmd run seed` to create:

- Demo user: `student@devclash.local` / `password123`
- Class 11 + 12 subjects
- Sample topics
