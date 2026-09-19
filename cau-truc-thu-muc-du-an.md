# Cấu trúc thư mục dự án — AudioTour (Thuyết minh tự động đa ngôn ngữ)

Monorepo gồm 2 frontend (React.js + React Native) và 3 backend service Python (mỗi service 3 lớp), có API Gateway, hạ tầng dev, và CI/CD riêng cho từng phần.

## Sơ đồ tổng quan

```text
vinhhy-audiotour-thesis/
├── apps/
│   ├── web/                        # Frontend Web — React.js (Vite)
│   │   ├── src/
│   │   │   ├── api/                # Gọi API Gateway (axios/fetch client)
│   │   │   ├── components/         # Component UI dùng chung trong web
│   │   │   ├── features/           # Từng màn hình/nghiệp vụ (home, tours, map...)
│   │   │   ├── routes/             # Định nghĩa route
│   │   │   ├── i18n/               # Đa ngôn ngữ riêng cho web
│   │   │   └── hooks/              # Custom hooks
│   │   ├── public/
│   │   └── package.json
│   │
│   └── mobile/                     # Frontend Mobile — React Native (Expo)
│       ├── src/
│       │   ├── api/                # Gọi API Gateway (dùng lại packages/api-client)
│       │   ├── components/         # Component UI riêng cho mobile
│       │   ├── screens/            # Các màn hình (tương đương "features" ở web)
│       │   ├── navigation/         # React Navigation (stack/tab)
│       │   └── hooks/
│       ├── app.json
│       └── package.json
│
├── packages/                       # Code dùng chung giữa web & mobile
│   ├── api-client/                 # Hàm gọi API, types response, xử lý lỗi chung
│   ├── i18n/                       # Bộ từ khóa dịch dùng chung 6 ngôn ngữ
│   └── ui-tokens/                  # Màu sắc, spacing, font — design token chung
│
├── services/                       # Backend Python — mỗi service độc lập, 3 lớp
│   ├── auth-service/
│   │   ├── app/
│   │   │   ├── api/                # LỚP 1 - Presentation: FastAPI routers, nhận request
│   │   │   ├── services/           # LỚP 2 - Business: xử lý nghiệp vụ (login, cấp JWT...)
│   │   │   ├── repositories/       # LỚP 3 - Data access: truy vấn DB qua SQLAlchemy
│   │   │   ├── models/             # ORM models (bảng DB)
│   │   │   ├── schemas/            # Pydantic schema (validate request/response)
│   │   │   └── core/               # Config, security (hash mật khẩu, JWT), dependencies
│   │   ├── tests/                  # Unit test theo từng lớp
│   │   ├── alembic/                # Migration DB
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   ├── content-service/            # Quản lý địa điểm, tour, bản dịch — cùng cấu trúc 3 lớp
│   │   └── app/ (api / services / repositories / models / schemas / core)
│   │
│   └── narration-service/          # Sinh audio (TTS), quản lý audio track
│       ├── app/ (api / services / repositories / models / schemas / core)
│       └── worker/                 # Xử lý job TTS bất đồng bộ (Celery/RabbitMQ consumer)
│
├── gateway/                        # API Gateway — cổng vào duy nhất cho frontend
│   ├── routes.yml                  # Nếu dùng Kong/Nginx: cấu hình route tới từng service
│   └── main.py                     # Nếu tự viết bằng FastAPI: forward request + xác thực chung
│
├── infra/                          # Hạ tầng chạy local & triển khai
│   ├── docker-compose.yml          # Chạy toàn bộ: 3 service + gateway + Postgres/Redis/RabbitMQ
│   ├── nginx/                      # Reverse proxy config (nếu không dùng Kong)
│   └── k8s/                        # (tùy chọn) Manifest Kubernetes khi triển khai thật
│
├── .github/
│   └── workflows/                  # CI/CD — mỗi phần một pipeline riêng, độc lập
│       ├── web-ci.yml              # Test + build + deploy web
│       ├── mobile-ci.yml           # Test + build qua Expo EAS + publish store
│       ├── auth-service-ci.yml     # Test + build Docker image + deploy auth-service
│       ├── content-service-ci.yml  # Tương tự cho content-service
│       └── narration-service-ci.yml# Tương tự cho narration-service
│
├── docs/
│   ├── architecture.md             # Mô tả kiến trúc tổng thể (dùng cho báo cáo đồ án)
│   └── api-contracts/              # Định nghĩa API giữa các service (OpenAPI/Swagger)
│
└── README.md                       # Hướng dẫn chạy toàn bộ hệ thống
```

## Ý nghĩa từng nhóm thư mục

### `apps/` — Tầng giao diện
Chứa 2 ứng dụng frontend độc lập, build và deploy riêng nhau, nhưng dùng chung logic qua `packages/`.
- **`apps/web`**: ứng dụng React.js cho trình duyệt, người dùng khách truy cập qua QR/link.
- **`apps/mobile`**: ứng dụng React Native (Expo) cho iOS/Android — cùng nghiệp vụ nhưng UI native.

### `packages/` — Code dùng chung (tránh lặp code giữa web & mobile)
- **`api-client`**: nơi duy nhất định nghĩa cách gọi API Gateway, tránh mỗi app tự viết lại axios instance, xử lý lỗi khác nhau.
- **`i18n`**: 1 bộ file dịch dùng cho cả web lẫn mobile, đảm bảo đồng nhất nội dung đa ngôn ngữ.
- **`ui-tokens`**: màu, khoảng cách, font — để thiết kế web và mobile nhất quán mà không copy-paste giá trị.

### `services/` — Tầng backend, mỗi service là một domain nghiệp vụ độc lập
Mỗi service **có database riêng**, **deploy riêng**, **scale riêng** — đây là điểm thể hiện rõ nhất yêu cầu "các service giao tiếp với nhau" của giảng viên.

Bên trong mỗi service, thư mục `app/` luôn giữ đúng 3 lớp:
| Thư mục | Vai trò | Không được làm |
|---|---|---|
| `api/` | Nhận HTTP request, validate đầu vào, gọi xuống `services/`, trả response | Không chứa logic nghiệp vụ, không query DB trực tiếp |
| `services/` | Chứa nghiệp vụ thật (vd: "kiểm tra vé còn hạn không", "sinh audio mới") | Không biết gì về HTTP (request/response), không biết SQL cụ thể |
| `repositories/` | Duy nhất nơi được phép query DB (qua SQLAlchemy) | Không chứa nghiệp vụ, chỉ CRUD thuần |

Nhờ tách vậy, muốn đổi DB hay đổi framework web thì chỉ sửa 1 lớp, không ảnh hưởng lớp còn lại — đúng tinh thần kiến trúc 3 lớp mà đề bài yêu cầu.

- **`auth-service`**: đăng nhập, JWT, quản lý vé/quyền truy cập (QR access, gói vé).
- **`content-service`**: địa điểm (POI), tour, nội dung đa ngôn ngữ.
- **`narration-service`**: sinh giọng nói (TTS), quản lý file audio; có thêm `worker/` vì việc sinh audio tốn thời gian nên xử lý nền (bất đồng bộ), không chặn API chính.

### `gateway/` — Điểm vào duy nhất
Frontend (web & mobile) chỉ gọi 1 địa chỉ gateway, không cần biết sau lưng có bao nhiêu service. Gateway lo việc: định tuyến đến đúng service, xác thực chung, giới hạn tốc độ gọi (rate limit).

### `infra/` — Hạ tầng chạy & triển khai
`docker-compose.yml` giúp chạy toàn bộ hệ thống (3 service + gateway + DB + cache + message queue) bằng 1 lệnh khi demo đồ án. `k8s/` chỉ cần nếu muốn trình bày phần triển khai "chuyên nghiệp" trong báo cáo.

### `.github/workflows/` — CI/CD tách theo từng thành phần
Mỗi app/service có pipeline riêng, nghĩa là sửa `auth-service` thì chỉ `auth-service-ci.yml` chạy lại (test → build Docker image → deploy), không động tới các service khác — đây là bằng chứng rõ ràng nhất cho yêu cầu "CD/CI" ở cả 3 đầu mục của đề bài.

### `docs/`
Nơi lưu tài liệu kiến trúc và hợp đồng API giữa các service (OpenAPI) — dùng trực tiếp để viết chương "Thiết kế hệ thống" trong báo cáo đồ án.
