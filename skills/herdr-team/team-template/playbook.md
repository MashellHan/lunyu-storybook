# Team Playbook — 论语绘本（lunyu-storybook）

Everyone first reads `AGENTS.md`, `README.md`, this playbook and their own file in `roles/`.

- The user talks to the leader. The leader handles small work directly and starts members only when distinct expertise, parallel work or independent review helps.
- Members never start or direct other members, never change roles, and write only inside their own write scope (see `skills/herdr-team/SKILL.md`). Reading anything is fine.
- Every delegated task states: objective, user context, the single write scope, constraints, acceptance criteria.
- A member reports: result, changed files, verification evidence, open issues. The leader checks the actual files before accepting.
- The user has authorized this repository's completed features to be committed, pushed, opened as PRs, independently reviewed and merged without repeated permission requests. The existing Cloudflare site also has continuing deployment authorization. Ask only for actions outside current authorization, such as new paid API calls, global installs, new public repositories or deployment destinations.
- A completed feature is not delivered until it has a commit and remote PR. The leader owns Git index/branch mutations by default; members hand back verified changes promptly. Use coherent feature commits rather than waiting for the whole book. Never stage or switch branches concurrently in the shared checkout.
- The reviewer reviews the actual PR head; fixes receive the appropriate checks and renewed review. The leader merges after blocking findings and required checks are resolved, respects branch protection, syncs local main and reports the PR/commit/merge result. A review comment from an independent agent is not a GitHub approval by a separate account. See `docs/source-control-workflow.md` in the project root.
- Gates before acceptance: applicable tests green (reuse evidence when tested inputs are unchanged); screenshots reviewed for UI changes; actual human listening for changed audio unless the user has explicitly authorized a scoped exception, without claiming it was heard; no photos of real children or people; no secrets printed or committed. Keep generated output and local test artifacts out of commits.
- Herdr pane/agent operations follow the official herdr skill.
