# HitFactor — Kubernetes Deployment (k3s)

Deploys the API, frontend, PostgreSQL, and PowerSync to the cluster. All three
public hostnames get HTTPS via cert-manager (`letsencrypt-prod`), which is what
makes browser↔PowerSync sync work in prod (no mixed-content issue like local dev).

| Component | Hostname | Service |
|---|---|---|
| Frontend (PWA) | `hitfactor.net` | `hitfactor-frontend:80` |
| Backend API | `api.hitfactor.net` | `hitfactor-backend:3000` |
| PowerSync | `sync.hitfactor.net` | `hitfactor-powersync:8080` |

Registry: `192.168.0.20:30500`. Namespace: `hitfactor`.

## 0. Prerequisites

- **DNS**: A-records for the three hostnames → `192.168.0.241` (ingress LB). Certs
  won't issue until these resolve publicly.
- Docker able to push to the insecure registry `192.168.0.20:30500`.
- If you change a hostname, update it in the matching Ingress, `backend-env`
  (`POWERSYNC_URL`, `CORS_ORIGIN`), the frontend image build-arg, and the
  PowerSync `audience`.

## 1. Build & push images

```bash
# from repo root
REG=192.168.0.20:30500
TAG=$(git rev-parse --short HEAD)

docker build -f backend/Dockerfile -t $REG/hitfactor-backend:$TAG -t $REG/hitfactor-backend:latest .
docker build -f frontend/Dockerfile \
  --build-arg VITE_API_URL=https://api.hitfactor.net \
  -t $REG/hitfactor-frontend:$TAG -t $REG/hitfactor-frontend:latest .

docker push $REG/hitfactor-backend:latest
docker push $REG/hitfactor-frontend:latest
```

> `VITE_API_URL` is baked at build time — rebuild the frontend image if the API
> hostname changes.

## 2. Create secrets (not committed)

```bash
kubectl apply -f overlays/production/namespace.yaml   # or overlays/staging/namespace.yaml

# DB password + connection string
PW='<choose-a-strong-password>'
kubectl -n hitfactor create secret generic hitfactor-db \
  --from-literal=POSTGRES_PASSWORD="$PW" \
  --from-literal=DATABASE_URL="postgresql://hitfactor:$PW@hitfactor-postgres:5432/hitfactor"

# JWT RS256 keypair (reuse the generated dev keys, or make a fresh pair)
kubectl -n hitfactor create secret generic hitfactor-jwt \
  --from-file=private.pem=../backend/src/config/keys/private.pem \
  --from-file=public.pem=../backend/src/config/keys/public.pem

# PowerSync config (fill the same $PW into powersync.prod.yaml first)
cp powersync.prod.example.yaml powersync.prod.yaml
sed -i "s/CHANGE_ME/$PW/g" powersync.prod.yaml
kubectl -n hitfactor create secret generic hitfactor-powersync-config \
  --from-file=powersync.yaml=powersync.prod.yaml

# PowerSync sync rules (from the canonical file in backend/)
kubectl -n hitfactor create configmap powersync-sync-rules \
  --from-file=sync-rules.yaml=../backend/sync-rules.yaml
```

Generate a fresh keypair instead of reusing dev keys:
```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem   # SPKI, matches jose importSPKI
```

## 3. Apply manifests (Kustomize)

Layout: `base/` holds the workloads; `overlays/production` and `overlays/staging`
retarget the namespace + hostnames. Apply the whole stack with one command:

```bash
kubectl apply -k overlays/production      # → hitfactor namespace, prod hostnames
kubectl -n hitfactor rollout status statefulset/postgres deployment/backend deployment/frontend deployment/powersync
```

The migrate Job is part of the base, so it runs on apply. (Optional dev data:
`kubectl apply -f 51-seed-job.yaml` — skip for real production.)

### Staging

Same flow in the `hitfactor-staging` namespace with staging hostnames
(`staging.hitfactor.net` / `api-staging.hitfactor.net` /
`sync-staging.hitfactor.net`). Create the staging secrets first (step 2, but
`-n hitfactor-staging`, and set the **staging** sync audience
`https://sync-staging.hitfactor.net` in `powersync.prod.yaml`),
then:

```bash
kubectl apply -k overlays/staging
```

## 4. Verify

```bash
kubectl -n hitfactor get pods,ingress,certificate
kubectl -n hitfactor get certificate          # all → READY=True (needs DNS)
curl https://api.hitfactor.net/api/health      # {"status":"ok"}
curl https://sync.hitfactor.net/probes/liveness # 200
# replication slot exists (PowerSync CDC is live):
kubectl -n hitfactor exec sts/postgres -- psql -U hitfactor -d hitfactor \
  -c "SELECT slot_name, active FROM pg_replication_slots;"
```

Then open `https://hitfactor.net`, log in, and confirm the match
list populates (end-to-end sync) and PSMOC/PPSA division labels render.

## 5. Updating

```bash
docker build ... && docker push ...                 # new image
kubectl -n hitfactor rollout restart deploy/backend  # or deploy/frontend
# schema change: re-apply 50-migrate-job.yaml (delete the old Job first)
```

## Notes
- The local-dev hacks (`pg_hba trust`, `NODE_TLS_REJECT_UNAUTHORIZED`, `DEV_HTTP`,
  the docker-compose image pin) are **not** used here — in-cluster traffic is plain
  HTTP and ingress terminates TLS, so they're unnecessary.
- Backend `replicas: 1` is safe with the shared JWT Secret; it can be scaled up.
- Steps 1+3 are automated by CI for ongoing deploys — see below.

## CI/CD (GitHub Actions) — same pattern as nvyt / gopickle

`.github/workflows/production-deploy.yml` runs on push to `main` on a self-hosted
in-cluster runner (labels `self-hosted, k3s, hitfactor`). It: generates a
`TIMESTAMP-SHA` tag, builds+pushes the backend and frontend images to
`192.168.0.20:30500`, runs the migrate Job, `kubectl set image` on both
deployments, waits for rollout, and health-checks the backend ClusterIP.

The base manifests in this folder are applied **once** (the steps above); CI only
bumps images — it never re-applies them. Schema changes: re-run the migrate Job
(CI does this automatically each deploy).

**One-time activation:**
1. Push the repo to `https://github.com/joannesnoel/hitfactor` (a `main` branch).
2. RBAC is already applied (`ServiceAccount github-runner-hitfactor` + Role/RoleBinding).
3. Start the runner (it registers against the repo using the shared PAT secret
   `github-actions/github-runner-secret`):
   ```bash
   kubectl apply -f github-runner/runner-deployment.yaml
   ```
4. Push to `main` → the workflow builds, deploys, and verifies automatically.
