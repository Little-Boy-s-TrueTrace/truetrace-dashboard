# TrueTrace Compliance Command Center

Ứng dụng dành cho chuyên viên KYC/AML:

- tổng quan KYC, deepfake, AML alert, STR và tài khoản đang đóng băng;
- danh sách hồ sơ KYC cùng điểm liveness/face-match/deepfake;
- AML alert và đồ thị dòng tiền;
- STR draft song ngữ chờ chuyên viên duyệt;
- trạng thái ba TrueTrace agent.

## Cấu trúc

- `backend/`: Go gateway/auth service, proxy tới TrueTrace Spring Boot API.
- `frontend/`: React, TypeScript và Vite command center.

## Chạy local

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

Frontend chạy tại `http://localhost:3001/soc/`, Go API tại
`http://localhost:8082`. Biến `BACKEND_URL` trỏ Go gateway tới core API.

## API được dashboard sử dụng

| Màn hình | Core API |
|---|---|
| KYC | `/api/kyc/sessions` |
| AML | `/api/aml/alerts` |
| STR | `/api/str/reports` |
| Overview | `/api/compliance/stats` |
| Agent fleet | `/api/agents/status` |

## Kiểm thử

```bash
cd backend
go test ./...

cd ../frontend
npm ci
npm test -- --run
npm run build
npm run lint
```

Không đưa dashboard ra Internet trực tiếp. Production phải đặt sau gateway/TLS,
thay secret mặc định, giới hạn CORS và dùng secret manager.
