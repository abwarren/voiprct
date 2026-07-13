# AnfieldVoice (voiprct) — Scope Completion

## Summary
10/10 slices delivered. Backend complete. Mobile and web UIs exist for all features. Goal: production readiness — verify build, add reverse proxy for SSL, finalize deployment, and close remaining gaps.

---

## Deliverable 1: Docker Build Verifiable
Files: Dockerfile, docker-compose.yml, requirements.txt, entrypoint.sh

- [ ] D1-R1: `docker compose build` completes without error
  Acceptance: exit code 0, all layers cached
- [ ] D1-R2: `docker compose up -d` starts both containers (app + db) healthy
  Acceptance: `docker compose ps` shows both services healthy
- [ ] D1-R3: Health endpoint returns 200 from inside container
  Acceptance: `curl -sf http://127.0.0.1:8000/health` returns 200

## Deliverable 2: SSL/HTTPS Termination
Files: deploy/nginx.conf, docker-compose.yml update

- [ ] D2-R1: nginx reverse proxy config exists for production SSL termination
  Acceptance: nginx.conf at deploy/nginx.conf with certbot-friendly structure
- [ ] D2-R2: docker-compose includes nginx service or documented external reverse proxy setup
  Acceptance: deploy/nginx.conf committed, docker-compose.yml updated or deploy.sh documents nginx setup

## Deliverable 3: Deployment Finalization
Files: deploy.sh, .env.example, SESSION_HANDOFF.md

- [ ] D3-R1: deploy.sh scripts production deployment end-to-end (build + start + health check)
  Acceptance: deploy.sh runs to completion
- [ ] D3-R2: .env.example has all required vars with safe defaults
  Acceptance: env vars cover DB, JWT, server config, and any production additions
- [ ] D3-R3: SESSION_HANDOFF.md updated with true final state
  Acceptance: SESSION_HANDOFF reflects this final pass

## Deliverable 4: Repository Hygiene
Files: .gitignore, build-apk.sh, _setup_remote.sh

- [ ] D4-R1: Untracked files resolved (either committed or gitignored)
  Acceptance: `git status --short` shows clean working tree
- [ ] D4-R2: build-apk.sh verified as valid (syntax check)
  Acceptance: `bash -n build-apk.sh` passes
- [ ] D4-R3: .gitignore covers all generated/build artifacts
  Acceptance: node_modules, __pycache__, *.pyc, .env, android/ build outputs ignored
