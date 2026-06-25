# HitFactor — Kubernetes Deployment (k3s)

Deploys the API, frontend, PostgreSQL, and PowerSync to the cluster. All three
public hostnames get HTTPS via cert-manager (`letsencrypt-prod`), which is what
makes browser↔PowerSync sync work in prod (no mixed-content issue like local dev).

| Component | Hostname | Service |
|---|---|---|
| Frontend (PWA) | `hitfactor.creativelogik.net` | `hitfactor-frontend:80` |
| Backend API | `api-hitfactor.creativelogik.net` | `hitfactor-backend:3000` |
| PowerSync | `sync-hitfactor.creativelogik.net` | `hitfactor-powersync:8080` |

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
  --build-arg VITE_API_URL=https://api-hitfactor.creativelogik.net \
  -t $REG/hitfactor-frontend:$TAG -t $REG/hitfactor-frontend:latest .

docker push $REG/hitfactor-backend:latest
docker push $REG/hitfactor-frontend:latest
```

> `VITE_API_URL` is baked at build time — rebuild the frontend image if the API
> hostname changes.

## 2. Create secrets (not committed)

```bash
kubectl create namespace hitfactor   # or: kubectl apply -f 00-namespace.yaml

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

## 3. Apply manifests

```bash
kubectl apply -f 00-namespace.yaml -f 10-postgres.yaml
kubectl -n hitfactor rollout status statefulset/postgres
kubectl apply -f 50-migrate-job.yaml        # runs drizzle migrations
kubectl -n hitfactor wait --for=condition=complete job/hitfactor-migrate --timeout=120s
kubectl apply -f 20-backend.yaml -f 30-frontend.yaml -f 40-powersync.yaml
```

(Optional dev data: `kubectl -n hitfactor create job seed --from=... ` running
`node dist/db/seed.js` — skip for real production.)

## 4. Verify

```bash
kubectl -n hitfactor get pods,ingress,certificate
kubectl -n hitfactor get certificate          # all → READY=True (needs DNS)
curl https://api-hitfactor.creativelogik.net/api/health      # {"status":"ok"}
curl https://sync-hitfactor.creativelogik.net/probes/liveness # 200
# replication slot exists (PowerSync CDC is live):
kubectl -n hitfactor exec sts/postgres -- psql -U hitfactor -d hitfactor \
  -c "SELECT slot_name, active FROM pg_replication_slots;"
```

Then open `https://hitfactor.creativelogik.net`, log in, and confirm the match
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
- For repeatable builds, wire steps 1+3 into a GitHub Actions workflow on the
  existing self-hosted runners (the `github-actions` namespace).
