# TrueTrace Compliance Command Center

Application for KYC/AML compliance officers:

- Overview of KYC, deepfake, AML alerts, STR, and frozen accounts;
- List of KYC cases with liveness/face-match/deepfake scores;
- AML alerts and money flow graph;
- Bilingual STR drafts awaiting officer review;
- Status of the three TrueTrace agents.

## Structure

- `backend/`: Go gateway/auth service, proxies to TrueTrace Spring Boot API.
- `frontend/`: React, TypeScript, and Vite command center.

## Running Locally

Backend:

```bash
cd backend
go run .
```

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

Frontend runs at `http://localhost:3001/soc/`, Go API at `http://localhost:8082`. The `BACKEND_URL` variable points the Go gateway to the core API.

## APIs Used by the Dashboard

| Screen | Core API |
|---|---|
| KYC | `/api/kyc/sessions` |
| AML | `/api/aml/alerts` |
| STR | `/api/str/reports` |
| Overview | `/api/compliance/stats` |
| Agent fleet | `/api/agents/status` |

## Testing

```bash
cd backend
go test ./...

cd ../frontend
npm ci
npm test -- --run
npm run build
npm run lint
```

Do not expose the dashboard directly to the internet. Production must be placed behind a gateway/TLS, replace default secrets, restrict CORS, and use a secret manager.
