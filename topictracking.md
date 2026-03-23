# Major Update: Topic Tracker UI & Spaced Repetition Refactoring

---
**Context & Objectives:**
The core objective of this update was to overhaul the Topic Tracker tab UI to drastically reduce visual clutter, simplify interactions, and replace an opaque backend progress-detection engine with rigorous, explicit spacing-sequence rules.

**Why we made these changes:**
1. **Reduce Clutter & Improve Clarity:** The original UI featured bulky buttons and redundant columns (Confidence, Coverage Source, Completed, general Suggestions, raw Actions array), making the data table cumbersome to parse at scale. By aggressively minimizing the Tracker down to 7 essential, center-aligned datestamp columns, users gain an instantaneous vertical overview of mastery without horizontal tracking fatigue.
2. **Micro-Interactions for Space-Efficiency:** To support high data density, the large generic Status button arrays were replaced by a seamless native `<select>` dropdown. The Revision controls were compressed from full-size UI components down to hyper-compact `▲` and `▼` unicode buttons.
3. **Exact Spaced Repetition Logic:** The legacy engine governed the "Next Review Target" using ambiguous ML retention math. This was fundamentally replaced with an explicit algorithm mapping natively inside the React tree (`0=Tomorrow`, `1=+2 Days`, `2=+5 Days`, `3=+7 Days`, `4=+10 Days`, `5=+30 Days`, `>5=Convenience`). This deterministic approach ensures exact spaced intervals based on human manual clicks, and instantly trips CSS red warning limits (`var(--alert)`) when a topic crosses its targeted decay bounds.
---

## 1. Backend Changes (Node.js/Express)

### `src/controllers/coverageController.js`
- **Introduced `manualIncrementRevision(req, res)`:**
  - Queries `TopicProgress` by `userId` and `topicId`.
  - Uses MongoDB's atomic `$inc: { totalReviews: 1 }` operator and explicit `$set: { lastReviewedAt: new Date() }` to lock the immediate revision time.
  - Resolves via `returnDocument: "after"` and fires `syncSubjectLedgerByTopic(userId, topic._id)` to recompute global progress maps automatically.
- **Introduced `manualDecrementRevision(req, res)`:**
  - Performs a manual read of `TopicProgress` first to evaluate the bounds limit (minimum `totalReviews` of 0 to block negative bounds issues).
  - Explicitly executes `$set: { totalReviews: newTotal }` and re-triggers the synchronization hook block natively.
- **Updated `getCoverageState(req, res)`:**
  - Restructured the internal payload mapping structure logic in `state.map(...)`.
  - Exported raw exact `lastReviewedAt` and semantic `nextReviewAt` payloads natively into the `coverage` client payload matrix, overcoming missing properties on strict frontend typing.

### `src/routes/coverageRoutes.js`
- **Exposed Secure Mutators:**
  - Mounted `POST /api/coverage/revision-inc` binding to `manualIncrementRevision`.
  - Mounted `POST /api/coverage/revision-dec` binding to `manualDecrementRevision`.
  - Configured payload middleware utilizing the preexisting `manualCoverageSchema` validator strictly parsing identical 24-character ObjectID validation signatures natively.

---

## 2. Frontend State Logic (React Context API)

### `src/context/LearningContext.jsx`
- **Network Call Implementations:**
  - Authored `incrementRevision(topicId)` performing the `POST /revision-inc` HTTP logic before triggering an explicit `refreshCoverage()` dispatch loop, syncing global contexts.
  - Authored `decrementRevision(topicId)` pointing conversely to `POST /revision-dec`.
  - Embedded raw references directly onto the `value={}` dependency configuration to broadcast downstream.

- **Custom Deterministic Spaced Repetition Algorithm:**
  - Introduced `calculateRecommendedRevisionDate(totalReviews, lastReviewedAt)` isolating mapping complexities away from the DOM components:
    - **0 Revisions:** Generates a deterministic date of `new Date() + 1 day` (Tomorrow).
    - **1 Revision:** Parses `lastReviewedAt` and offsets locally via JS Date APIs `+ 2 days`.
    - **2 Revisions:** Offsets `lastReviewedAt` by `+ 5 days`.
    - **3 Revisions:** Offsets `lastReviewedAt` by `+ 7 days`.
    - **4 Revisions:** Offsets `lastReviewedAt` by `+ 10 days`.
    - **5 Revisions:** Offsets `lastReviewedAt` by `+ 30 days`.
    - **>5 Revisions:** Yields `null` mapping.
  - Intercepted the abstract API pipeline traversing `mapCoverageTopic` natively injecting `recommendedRevisionText`: automatically processing `null` blocks into the static prompt `"At your convenience"`, while transforming JS Date objects via native `toLocaleDateString()`.
  - Calculated an explicit strict `isRevisionDue` algorithmic boolean whenever `recommendedRevisionDate <= new Date()` to instruct client-side alerting logic securely.

---

## 3. Frontend App Interface (React Components)

### `src/pages/TopicTrackerPage.jsx` (Deep DOM Simplification)
- **Aggressive Vertical Screen Re-Alignment:**
  - Entirely unmounted and removed the "Coverage Snapshot" (`<Card>`) containing the "Covered / At Risk / Untouched" data modules to prioritize compact analytical tracking limits vertically.
  
- **Data Table Metric Stripping (`TOPIC_COLUMNS`):**
  - Eliminated "Confidence", "Completed", "Coverage Source", "Actions" and standard "Suggestions" arrays altogether.
  - Integrated explicitly embedded JSX block formatting `<>&lt;br/&gt;</>` rules across specific headers (`Revision<br/>Count`, `Questions<br/>Practiced`, `Last Revision<br/>Date`, `Recommended<br/>Revision Date`) optimizing horizontal real-estate allocations rigorously.

- **Cell Render Mapping Refactors (`createTopicRow`)**:
  - **Status:** Purged UI `Badge` component rendering layout schemas and `Button` togglers; swapped to a compact, native exact HTML `<select>` bound to React's synthetic `onChange` handler piping exactly out to `actions.markTopicCompleted` or `actions.unmarkTopicCompleted` pending strict value evaluation. Added exact CSS custom coloring variables via native `style={{...}}`.
  - **Revision Count:** Re-configured the render node to structure `<div flex>` alignment wrappers natively encompassing custom Unicode arrow elements (`▲` / `▼`). Sourced explicit bounding parameters strictly dropping standard UI sizes: `style={{ fontSize: '8px', padding: '0 4px', lineHeight: 1 }}` embedding `disabled={topic.totalReviews <= 0}` explicitly for explicit bounds blocking UX feedback.
  - **Recommended Revision Date (New):** Rendered explicitly out derived parameters matching `topic.recommendedRevisionText` securely inside deterministic colored boundaries mapping to the true boolean flag properties directly (`color: topic.isRevisionDue ? 'var(--alert)' : 'inherit'`).
  - **Alignment Wrappers:** Migrated cell return blocks (`practice`, `tests`, `lastRevision`, etc.) directly into nested `<div>` structures configured explicitly with `textAlign: 'center'`.

### `src/index.css` (Style System Overhaul)
- Excluded default strict left-aligned formatting from main CSS variables parsing global `DataTable` properties exactly targeting `.table th, .table td` and injecting explicit layout overriding variables enforcing universal `text-align: center;` grids natively.