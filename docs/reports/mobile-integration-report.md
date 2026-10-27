# Báo cáo tích hợp AudioTour Web / Backend / Mobile

Đã chỉnh source hiện tại, không tạo dự án mới, không sửa apps/mobile, không commit/push. Danh sách dưới đây là toàn bộ thay đổi đang có trong working tree ở phạm vi công việc, bao gồm chế độ xem thử từ lượt trước. Các file riêng của người dùng ở root được giữ nguyên.

## Đã triển khai

- Giữ endpoint Mobile hiện dùng; bổ sung tọa độ/bán kính/thứ tự POI/ngôn ngữ và URL media, lọc bản đã duyệt cho cả list/detail/stream/QR/access.
- Backend kiểm tra scope sở hữu/cấp quyền cho POI, Tour và nội dung con; lọc cả count/pagination. Vendor không quản lý Users/Roles, không duyệt hay tự đặt trạng thái công khai. Tài khoản bị vô hiệu hóa/đổi vai trò không dùng được JWT cũ.
- Pending proposals tách khỏi canonical public, có version, snapshot, supersede, optimistic BaseVersion và transaction/locks. Reject bắt buộc lý do; sửa/resubmit tạo Pending mới. Thay file giữ ID và bytes public cũ đến lúc duyệt; deletion có duyệt. Narration liên kết phiên bản bản dịch được xuất bản để duyệt xóa đúng bản do nó tạo.
- Web có Duyệt nội dung, xem trước ảnh/audio/đọc văn bản, từ chối, trạng thái/rejection reason, Thuyết minh và modal cấp/thu hồi quyền POI/Tour. Vendor có giao diện trong scope, không có controls Admin. Bản đồ quản trị giữ nguyên; không đưa GPS/geofencing/scan QR/phát thuyết minh khách vào Web.
- Đã import file SQL người dùng cung cấp vào DB mới VinhHyAudioTourDB, giữ file gốc, áp dụng 2 migration. Tạo .env cục bộ được Git ignore; Auth/Content dùng cùng DB và JWT secret. Backend và Gateway đang chạy ở cổng 8001/8002/8000.

## Kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Web tsc + Vite production build | PASS |
| Web ESLint | PASS |
| Web Vitest | 16/16 PASS |
| Web Playwright trên Edge, AUDIOTOUR_LIVE=1 | 10/10 PASS, gồm Gateway thật |
| Content Backend | 30/30 PASS (19 unit và 11 test SQL Server thật) |
| Auth Backend | 3/3 PASS |
| Python Ruff --select E9,F | PASS |
| Python compileall | PASS |
| git diff --check | PASS |
| Gateway chỉ đọc | anonymous CMS 401; Vendor Users 403; Admin Users 200; Vendor scoped POI 200; Admin queue 200 |

SQL tests chạy request FastAPI với SQL Server thật, rollback sau mỗi test và dọn file thử. Kiểm tra POI của người khác, grants/revoke, account disabled, publication metadata, Pending/Approve/Reject/Resubmit, giữ bản public, thứ tự Tour, bản dịch/thuyết minh, thay file ảnh, guest token và binary WAV stream. E2E nghiệp vụ dùng mock/session fixture; test live và các probe riêng xác nhận Gateway/DB thật. Chưa thử đăng nhập bằng mật khẩu seed (không biết mật khẩu và không tự đặt lại). Chưa build Docker images/chạy trên thiết bị Mobile thật. Provider sinh file TTS/tính route ngoài hệ thống chưa được kiểm thử live.

## Dữ liệu sẵn sàng và phần cần bổ sung

Gateway hiện trả 6 ngôn ngữ, 4 POI công khai, 0 Tour công khai và 87 submission Pending. Tour/Audio/bản dịch nhập từ DB chưa có bằng chứng duyệt, được giữ trong queue thay vì tự công khai. API Tour/Audio đã được kiểm thử đầy đủ với dữ liệu SQL tạo trong transaction rollback.

46 bản ghi media cũ đều thiếu file vật lý trên máy này. Khôi phục thư mục uploads/images và uploads/audio theo RelativePath/FileUrl hoặc upload/thay file bằng Web. Metadata ảnh đã Approved từ DB cũ có thể trả URL 404 trước khi khôi phục. Admin phải duyệt dữ liệu thật để nhóm Mobile có Tour/Audio đầy đủ; không coi việc import là phê duyệt. TTS text có thể nghe thử trên Web, nhưng cần upload file thật để demo Mobile hiện tại phát được TTS audio.

File DB người dùng cung cấp: [apps/VinhHyAudioTourDB.sql](../../apps/VinhHyAudioTourDB.sql) — chỉ đọc/import, không chỉnh file gốc. Cấu hình mới [.env](../../.env) chứa thông tin local, bị Git ignore và không đưa secret vào báo cáo. Web không đọc SQL trực tiếp: đăng nhập để dùng API dữ liệu thật; không đăng nhập vẫn là preview dữ liệu mẫu như yêu cầu trước.

[Tài liệu API, hướng dẫn chạy, phân quyền, DB và JSON mẫu](../api-contracts/mobile-integration.md).

## File thay đổi / tạo mới

- [.env.example](../../.env.example)
- [apps/web/README.md](../../apps/web/README.md)
- [apps/web/src/App.tsx](../../apps/web/src/App.tsx)
- [apps/web/src/components/MediaPreview.tsx](../../apps/web/src/components/MediaPreview.tsx)
- [apps/web/src/components/ReviewStatus.tsx](../../apps/web/src/components/ReviewStatus.tsx)
- [apps/web/src/components/ScopeEditor.tsx](../../apps/web/src/components/ScopeEditor.tsx)
- [apps/web/src/contexts/Session.tsx](../../apps/web/src/contexts/Session.tsx)
- [apps/web/src/pages/Login.tsx](../../apps/web/src/pages/Login.tsx)
- [apps/web/src/pages/admin/ContentPage.tsx](../../apps/web/src/pages/admin/ContentPage.tsx)
- [apps/web/src/pages/admin/ResourcePage.tsx](../../apps/web/src/pages/admin/ResourcePage.tsx)
- [apps/web/src/pages/admin/ReviewPage.tsx](../../apps/web/src/pages/admin/ReviewPage.tsx)
- [apps/web/src/pages/admin/TourEditor.tsx](../../apps/web/src/pages/admin/TourEditor.tsx)
- [apps/web/src/services/api.ts](../../apps/web/src/services/api.ts)
- [apps/web/src/services/preview.ts](../../apps/web/src/services/preview.ts)
- [apps/web/src/styles.css](../../apps/web/src/styles.css)
- [apps/web/tests/e2e/review.spec.ts](../../apps/web/tests/e2e/review.spec.ts)
- [apps/web/tests/e2e/smoke.spec.ts](../../apps/web/tests/e2e/smoke.spec.ts)
- [apps/web/tests/preview.test.ts](../../apps/web/tests/preview.test.ts)
- [docs/api-contracts/README.md](../../docs/api-contracts/README.md)
- [docs/api-contracts/examples/poi-detail.json](../../docs/api-contracts/examples/poi-detail.json)
- [docs/api-contracts/examples/pois.json](../../docs/api-contracts/examples/pois.json)
- [docs/api-contracts/examples/tour-detail.json](../../docs/api-contracts/examples/tour-detail.json)
- [docs/api-contracts/examples/tours.json](../../docs/api-contracts/examples/tours.json)
- [docs/api-contracts/mobile-integration.md](../../docs/api-contracts/mobile-integration.md)
- [infra/sql/001_scope_and_review.sql](../../infra/sql/001_scope_and_review.sql)
- [infra/sql/002_narration_publication.sql](../../infra/sql/002_narration_publication.sql)
- [scripts/check_database.py](../../scripts/check_database.py)
- [scripts/check_gateway_permissions.py](../../scripts/check_gateway_permissions.py)
- [scripts/check_mobile_api.py](../../scripts/check_mobile_api.py)
- [scripts/prepare_database.py](../../scripts/prepare_database.py)
- [scripts/serve.py](../../scripts/serve.py)
- [scripts/test_auth.py](../../scripts/test_auth.py)
- [scripts/test_content.py](../../scripts/test_content.py)
- [services/auth-service/Dockerfile](../../services/auth-service/Dockerfile)
- [services/auth-service/app/api/auth.py](../../services/auth-service/app/api/auth.py)
- [services/auth-service/app/core/config.py](../../services/auth-service/app/core/config.py)
- [services/auth-service/app/core/database.py](../../services/auth-service/app/core/database.py)
- [services/auth-service/requirements-dev.txt](../../services/auth-service/requirements-dev.txt)
- [services/auth-service/requirements.txt](../../services/auth-service/requirements.txt)
- [services/auth-service/tests/test_permissions.py](../../services/auth-service/tests/test_permissions.py)
- [services/content-service/Dockerfile](../../services/content-service/Dockerfile)
- [services/content-service/app/api/admin.py](../../services/content-service/app/api/admin.py)
- [services/content-service/app/api/web.py](../../services/content-service/app/api/web.py)
- [services/content-service/app/core/access.py](../../services/content-service/app/core/access.py)
- [services/content-service/app/core/config.py](../../services/content-service/app/core/config.py)
- [services/content-service/app/core/database.py](../../services/content-service/app/core/database.py)
- [services/content-service/app/repositories/admin_repository.py](../../services/content-service/app/repositories/admin_repository.py)
- [services/content-service/app/repositories/content_repository.py](../../services/content-service/app/repositories/content_repository.py)
- [services/content-service/app/repositories/review_repository.py](../../services/content-service/app/repositories/review_repository.py)
- [services/content-service/app/services/content_service.py](../../services/content-service/app/services/content_service.py)
- [services/content-service/app/services/review_service.py](../../services/content-service/app/services/review_service.py)
- [services/content-service/requirements-dev.txt](../../services/content-service/requirements-dev.txt)
- [services/content-service/tests/test_review_sqlserver.py](../../services/content-service/tests/test_review_sqlserver.py)
- [docs/reports/mobile-integration-report.md](../../docs/reports/mobile-integration-report.md)
