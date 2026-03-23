# DevClash Hackathon MVP - Regenerated Execution Plan

## General Instructions:

- **IMPORTANT**: After progress, update the Workspace/Plan Progress Update.md with the progress. mention what was completed, how was it done and any adjustments to the next steps.

- For any AI related implementation, before starting the implementation, we need to have a brainstorming session to align on the exact modeling approaches, data sources, and evaluation strategies for each AI component. This will ensure that we have a clear roadmap and avoid mid-implementation pivots.

- use Javascript, not Typescript. USE MERN MERN MERN (except for AI services where Python is allowed).
- Mandatory data rule: all planner/test/quiz/practice implementations must read from and update the unified subject-topic progress ledger (covered/uncovered, completion count, practice volume/accuracy, and test scoring metrics) to keep every feature state cohesive.

## Syllabus:

Class 11 Chapter Highlights
Physics: Covers Units, Motion (Straight Line/Plane), Laws of Motion, Work/Energy/Power, Particles/Rotational Motion, Gravitation, Mechanical Properties (Solids/Fluids), Thermal Properties/Thermodynamics, Kinetic Theory, Oscillations, and Waves.
Chemistry: Covers Atomic Structure, Chemical Bonding, Thermodynamics, Equilibrium, Redox Reactions, Basic Organic Principles, and Hydrocarbons.
Mathematics: Covers Sets, Relations/Functions, Trigonometry, Complex Numbers/Quadratic Equations, Linear Inequalities, Permutations/Combinations, Binomial Theorem, Sequences/Series, Geometry (Lines, Conics, 3D), Calculus (Limits/Derivatives), Statistics, and Probability.
Biology: Focuses on Biology/Plant/Animal Kingdoms, Morphology/Anatomy of Plants, Cell Biology, Biomolecules, Plant/Animal Physiology (various systems), and Reproduction.

Class 12 Chapter Highlights
Physics: Covers Electrostatics (Charges/Fields/Potential), Current Electricity, Magnetic Effects, Induction, Alternating Currents, Waves, Optics, Modern Physics (Dual Nature/Atoms/Nuclei), and Semiconductors.
Chemistry: Covers Physical (Solutions/Electrochemistry/Kinetics), Inorganic (d- and f-Block/Coordination Compounds), and Organic Chemistry (Haloalkanes/Alcohols/Aldehydes/Amines/Biomolecules).
Mathematics: Covers Relations/Functions, Inverse Trigonometry, Matrices, Determinants, Calculus (Continuity, Derivatives, Integrals, Differential Equations), Vectors, 3D Geometry, Linear Programming, and Probability.
Biology: Covers Reproduction, Genetics/Evolution, Human Health/Diseases, Microbes, Biotechnology, and Ecology.

## 1. Final Constraints and Decisions

### Confirmed Build Rules

- Web stack follows MERN for core product services.
- AI services can use Python or any fit-for-purpose stack.
- Product language is English only.
- Test customization in MVP includes all controls:
  - difficulty,
  - question count,
  - duration,
  - question-type mix,
  - topic include/exclude,
  - negative marking.
- Answer key and explanations are visible only after submission.
- Covered topics come from in-app activity and users can manually mark or unmark completed topics.
- Vector strategy: MongoDB Atlas Vector Search as primary, Pinecone as optional fallback.

### Challenge Goal

Build a working learning intelligence system that improves retention and outcomes, not just content delivery, by combining:

1. Spaced repetition and retention
2. Autonomous planning
3. Adaptive practice and exam generation
4. Grounded AI tutoring
5. Multimodal YouTube understanding

### Hackathon Scope Freeze (Execution Priority)

- Core MVP modules to fully ship first:
  1. Spaced Repetition and Retention
  2. Autonomous Study Planner
  3. Adaptive Practice and Question Generation
- Stretch modules after core MVP is stable:
  - AI Tutor with RAG
  - Multimodal YouTube understanding
- Rule: no deep implementation work on stretch modules until core MVP demo flow is complete end to end.

---

## 2. Target Architecture

### System Architecture

- Frontend: React + TypeScript (student and mentor/admin views)
- Backend: Node.js + Express + TypeScript (MERN service core)
- Database: MongoDB + Mongoose
- Cache/Queue: Redis + BullMQ
- AI Services:
  - Python microservices for LLM orchestration, retrieval pipelines, evaluation, and transcript workflows
  - Node orchestration layer to call Python services and expose unified APIs
- Storage: Object storage for transcripts, generated artifacts, and logs

### Data Domains

- Identity: User, Role, Profile
- Curriculum: Subject, Topic, Concept, PrerequisiteGraph
- Learning Activity: Session, RevisionEvent, AttemptLog, CoverageSignal
- Planning: DailyPlan, PlanTask, RebalanceLog
- Assessment: TestBlueprint, GeneratedExam, Submission, ScoreReport
- Tutor/RAG: SourceDoc, Chunk, EmbeddingRef, TutorQuery, TutorResponse, Citation
- Multimodal: VideoJob, Transcript, VideoOverview, BulletExplanation, VideoSummary

### Non-Negotiable Product Behaviors

- Every tutor answer shows grounded citations.
- Every generated exam honors customization settings.
- Answer key is locked until submission is complete.
- Covered-topic model updates automatically from activity and supports manual override.

---

## 3. Frontend Plan (4 Phases, Chat-Sized)

Goal: deliver a demo-ready learning app with strong UX clarity and visible AI value.

## Phase F1 - UI Foundation and Navigation

### Scope

- Initialize React app with routing, layout shell, and auth flow.
- Build reusable component library: cards, chips, badges, modals, tables, chart wrappers.
- Add responsive navigation for desktop and mobile.

### Screens

- Login/Signup
- Home dashboard scaffold
- Topic tracker scaffold
- Test center scaffold

### Deliverables

- Stable route architecture
- Shared UI primitives used across major pages
- Basic accessibility and loading states

### Acceptance Criteria

- No dead routes or blank states without guidance
- Common components reused across at least 4 screens

## Phase F2 - Planning and Retention Experience

### Scope

- Build learner dashboard with:
  - retention score,
  - today plan,
  - overdue tasks,
  - weak topics.
- Add planner calendar/list views and task status transitions.
- Add topic progress page with manual mark/unmark completion.

### Key Interactions

- complete/skip/replan task
- mark topic completed
- unmark topic completed

### Deliverables

- End-to-end planning UX connected to backend
- Topic coverage control panel

### Acceptance Criteria

- Planner updates persist after refresh
- Manual topic mark/unmark updates UI and backend state

## Phase F3 - Adaptive Test and Practice UX

### Scope

- Build test generator form with all customization:
  - difficulty,
  - number of questions,
  - total duration,
  - question-type mix,
  - topic include/exclude,
  - negative marking toggle/value.
- Build exam-taking interface with timer and autosave.
- Build post-submit report page with score, topic breakdown, answer key, and explanations.
- Add adaptive practice loop UX:
  - capture per-question signals (accuracy, time-on-question, confidence),
  - surface weak concepts,
  - generate targeted next-question sets,
  - show "why this was assigned" to the learner.

### Deliverables

- Complete exam lifecycle UX (create -> attempt -> submit -> review)
- Practice and targeted retry UX for weak areas

### Acceptance Criteria

- Generated exam visibly changes when settings change
- Answer key and explanations remain hidden before submit and visible after submit
- Adaptive next-set recommendations change based on recent learner performance signals

## Phase F4 - YouTube AI Explainer and Demo Polish

### Scope

- Build YouTube URL input and processing status UI.
- Build output page with:
  - plain-English overview,
  - concise but detailed bullet-point explanation,
  - key concepts,
  - suggested revision cards.
- Add robust loading, retry, and failure messaging.

### Deliverables

- End-to-end YouTube explain feature in UI
- Demo mode with seeded fallback outputs

### Acceptance Criteria

- Multiple videos produce readable overviews and bullet explanations
- Judge can complete full feature walkthrough in one session

---

## 4. Backend Plan (4 Phases, MERN Core)

Goal: ship a reliable Express API layer with MongoDB models and orchestration hooks for AI.

## Phase B1 - MERN Service Foundation

### Scope

- Set up Node.js + Express + TypeScript project structure.
- Configure MongoDB and Mongoose models.
- Implement auth, profile, and curriculum endpoints.
- Add request validation, error middleware, and environment config.

### API Groups

- /auth
- /users
- /subjects
- /topics

### Deliverables

- Running backend with MongoDB persistence
- Seed scripts for demo users and curriculum

### Acceptance Criteria

- Core CRUD APIs tested and documented
- Essential indexes created for user/topic/time queries

## Phase B2 - Retention and Planner APIs

### Scope

- Implement retention state updates from revision/practice outcomes.
- Build planner service to generate daily plan and rebalance when tasks are missed.
- Build coverage engine endpoint combining:
  - activity-derived completion signals,
  - manual mark/unmark topic overrides.
- TODO (planner autonomy policy): finalize auto-rebalancing trigger rules, priority scoring formula, and daily time-budget constraints during implementation phase.

### API Groups

- /retention
- /planner
- /coverage
- /progress

### Deliverables

- Deterministic planning outputs
- Coverage state model with audit trail

### Acceptance Criteria

- Planner output changes with learner behavior
- Coverage endpoints correctly merge auto + manual signals

## Phase B3 - Adaptive Exam and Submission APIs

**TODO:** BEFORE IMPLEMENTING, brainstorm together on exact exam generation approach, including how to enforce customization constraints, how to structure the generation pipeline, and how to implement the post-submit key reveal policy in a secure way.

### Scope

- Implement test blueprint endpoint from customization payload.
- Implement exam generation endpoint based on covered topics + chosen settings.
- Implement secure submission workflow and post-submit result generation.
- Enforce key policy: answer key/explanations only after final submission.
- Implement adaptive practice recommendation endpoint that returns next targeted question set from weak-topic signals.

### API Groups

- /tests/generate
- /tests/start
- /tests/save
- /tests/submit
- /tests/result
- /practice/next-set

### Deliverables

- Full exam API workflow
- Result contracts with score and explanations

### Acceptance Criteria

- Pre-submit APIs never expose answer keys
- Post-submit result payload includes explanations and topic analytics
- Practice recommendation payload shifts toward weak concepts after poor attempt signals

## Phase B4 - Tutor, YouTube, and Reliability

**TODO:** BEFORE IMPLEMENTING, brainstorm together on the exact RAG architecture, including retrieval strategy, citation formatting, and abstain behavior. Also define the YouTube explain generation pipeline and fallback behavior for low-quality transcripts or generation failures.

### Scope

- Implement tutor query endpoint with citation-enforced response schema.
- Implement YouTube explain orchestration endpoint returning:
  - overview,
  - concise detailed bullets,
  - concept list,
  - summary.
- Add BullMQ job handling, rate limiting, structured logs, health checks.

### API Groups

- /tutor
- /media/youtube/explain
- /jobs
- /health

### Deliverables

- Production-style async handling for long-running AI tasks
- Unified API contracts for frontend consumption

### Acceptance Criteria

- Tutor responses always include citations
- YouTube explain endpoint returns valid schema for successful jobs

---

## 5. AI Implementation Plan (5 Phases)

**TODO:** BEFORE IMPLEMENTING ANY AI features (any feature), we need to have a brainstorming session to align on the exact modeling approaches, data sources, and evaluation strategies for each AI component. This will ensure that we have a clear roadmap and avoid mid-implementation pivots.
Goal: deliver grounded, useful intelligence that is demonstrable in hackathon constraints.

- TODO (mandatory pre-implementation step): when we enter this AI phase, BEFORE IMPLEMENTING ANYTHING, brainstorm together on data collection, data processing, feature extraction, modeling strategy, evaluation approach, and integration plan.

## Phase A1 - Corpus, Prompts, and Contracts

### Scope

- Build trusted knowledge corpus ingestion pipeline.
- Define strict JSON schemas for all AI outputs.
- Create prompt templates for:
  - planning support,
  - question generation,
  - exam generation,
  - tutor response,
  - YouTube explanation.
- TODO (model strategy): decide concrete embedding model, primary LLM, fallback model, and retrieval/rerank defaults during implementation phase.

### Deliverables

- Prompt library version 1
- Schema validation layer shared with backend

### Acceptance Criteria

- AI outputs parse reliably into defined contracts
- Rejected outputs are retried or safely failed

## Phase A2 - Retention and Coverage Intelligence

### Scope

- Implement retention scoring and next-review schedule logic.
- TODO (retention algorithm): choose and document exact forgetting-curve or SM-2-style update logic during implementation phase.
- Implement coverage inference from:
  - watched/learned events,
  - completed practice,
  - revision confirmations.
- Add merge strategy for manual mark/unmark topic actions.

### Deliverables

- Retention engine module
- Coverage inference module with confidence score

### Acceptance Criteria

- Coverage predictions align with user activity history
- Manual overrides are reflected immediately and logged

## Phase A3 - Customizable Exam Generator

### Scope

- Build generation pipeline that takes all controls:
  - difficulty,
  - count,
  - duration,
  - type distribution,
  - topic filters,
  - negative marking rules.
- Add adaptive generation loop for practice:
  - score weak concepts from attempt history,
  - generate similar targeted questions,
  - produce rationale metadata for recommendation.
- Add blueprint validator for balance, difficulty spread, and topic relevance.
- Generate explanation set and answer key for deferred reveal.

### Deliverables

- Exam generator service
- Exam quality checks and policy checks

### Acceptance Criteria

- Different setting combinations yield meaningfully different exams
- Generated questions map to selected covered topics and constraints
- Adaptive practice sets show measurable topic shift toward weak concepts after low-performance attempts

## Phase A4 - RAG Tutor (Grounded, English Only)

### Scope

- Build retrieval pipeline with hybrid retrieval and reranking.
- Generate responses with strict citation policy and abstain behavior.
- Keep response language in English only.

### Deliverables

- Citation-aware tutor chain
- Confidence scoring and fallback responses

### Acceptance Criteria

- Unsupported claims are avoided or clearly abstained
- Citation coverage stays high on factual responses

## Phase A5 - YouTube Explainer Pipeline

### Scope

- Implement video-to-transcript extraction.
- Build explanation generation in three layers:
  - plain-English overview,
  - concise but detailed bullet points,
  - short summary for revision.
- Add consistency checks for clarity, redundancy, and concept completeness.
- TODO (YouTube fallback behavior): define deterministic fallback output when transcript quality is low or job processing fails.

### Deliverables

- YouTube explain microservice
- Quality evaluation harness with sample videos

### Acceptance Criteria

- Outputs remain clear and useful across short and long videos
- Bullet points are concise yet sufficiently explanatory

---

## 6. Integration Plan (Chat-Wise, 5 Execution Blocks)

1. Block 1: F1 + B1 + A1
2. Block 2: F2 + B2 + A2
3. Block 3: F3 + B3 + A3 (core MVP completion gate)
4. Block 4: A4 + B4 tutor hardening (stretch after core gate)
5. Block 5: F4 + A5 YouTube + end-to-end tests + submission packaging (stretch + final packaging)

Each block is scoped to be handled in one chat without overwhelming context.

---

## 7. API Contract Snapshot for New Features

### Covered Topic Management

- POST /coverage/sync-activity
- POST /coverage/manual-mark
- POST /coverage/manual-unmark
- GET /coverage/state

### Custom Exam Workflow

- POST /tests/generate
- POST /tests/start
- POST /tests/save
- POST /tests/submit
- GET /tests/result/:attemptId

### Adaptive Practice Workflow

- POST /practice/next-set
- POST /practice/feedback

### YouTube Explanation

- POST /media/youtube/explain
- GET /media/youtube/explain/:jobId

Contract rule: pre-submit responses never contain final answer key or explanations.

---

## 8. Testing and Evidence Plan

### Functional Testing

- Planner generation and rebalancing
- Coverage auto detection from activity
- Manual mark/unmark precedence behavior
- Exam customization validity and post-submit key reveal
- YouTube explain output availability and structure
- Tutor citation rendering

### AI Quality Checks

- Coverage alignment score for generated exams
- Difficulty consistency score
- Citation faithfulness score
- YouTube explanation readability checks
- TODO (quality thresholds): define minimum pass/fail thresholds for each AI metric during implementation phase.

### Submission Evidence

- Demo walkthrough recording
- API collection and response snapshots
- Example exam variants for different settings
- Before/after coverage changes from manual overrides

---

## 9. Risk and Mitigation

### Risks

- Hallucinated tutor outputs
- Weak difficulty control in generated tests
- Noisy transcripts from YouTube audio
- Scope expansion risk

### Mitigations

- Citation-first response contract and abstain policy
- Post-generation exam validator and reject-regenerate loop
- Transcript cleanup and fallback summarization strategy
- Strict block-by-block execution with freeze points

---

## 10. Final Submission Checklist

- Working prototype covering all required modules
- GitHub repository with complete setup instructions
- Technical report with architecture, models, and trade-offs
- Presentation deck with demo story and technical design
- Test results and supporting outputs proving functionality

---

## 11. Ready One-Chat Prompts

1. Build MERN foundation with MongoDB models, auth, and curriculum APIs.
2. Implement planner, retention, and covered-topic auto plus manual mark/unmark logic.
3. Implement customizable exam generator, attempt flow, and post-submit key reveal policy.
4. Implement YouTube explain pipeline with overview and concise detailed bullets.
5. Implement RAG tutor with citation guarantees and English-only response behavior.
6. Add end-to-end tests, quality checks, and final demo packaging artifacts.
