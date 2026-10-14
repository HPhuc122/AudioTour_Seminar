# Báo cáo toàn đồ án AudioTour — 14/10/2026

## Kết luận tiến độ

Backend quản trị và API nội dung đã chạy với SQL Server thật. Web Admin đã kết nối, có quy trình duyệt và kiểm thử. Đồ án chưa hoàn tất luồng cốt lõi GPS → phát hiện vào vùng POI → chọn nội dung/ngôn ngữ → phát audio tự động → ghi nhận thời lượng; Mobile hiện có bản đồ/GPS, QR, catalog và player nhưng chưa có engine geofence/offline hoàn chỉnh.

Đánh giá dựa trên source hiện có và truy vấn trực tiếp DB, không dựa riêng vào giao diện hoặc README. Không chấm phần trăm vì chức năng đã có code, đã kiểm thử API và đã chạy trên thiết bị là các mức khác nhau.

## Backend

| Module | Trạng thái có bằng chứng | Phần còn thiếu |
| --- | --- | --- |
| Auth | Đăng nhập JWT, refresh token, user/role/device API; kiểm tài khoản active/vai trò hiện tại; validation tài khoản | Hồ sơ duyệt chủ sạp chưa có bảng/quy trình riêng |
| Quyền nội dung | Owner POIs.UserId/Tours.UserId và EntityGrants; scope thực thi tại Backend | Cần chốt nghiệp vụ cấp quyền sau khi duyệt chủ sạp |
| POI/Tour | CRUD, tọa độ, bán kính, text, bản dịch, tour members/thứ tự; search/filter/pagination | Dữ liệu demo tour chưa duyệt; không tự phục hồi bản ghi xóa mềm |
| Duyệt/version | Pending/Approve/Reject/Resubmit, lý do, canonical riêng với đề xuất, version/snapshot/transaction | Hoàn thiện luồng duyệt hồ sơ chủ sạp sau migration |
| Media/audio | Upload file thật, metadata, private preview, thay file giữ bản public, stream có quyền nghe | Media gốc thiếu; audio mới đã upload còn chưa liên kết AudioTracks |
| API khách/QR | Catalog/detail public, resolve QR, guest access có thời hạn/theo POI hoặc tour, stream kiểm token/scope | Chưa xác nhận toàn bộ trên điện thoại thật với nội dung đầy đủ |
| Dịch/TTS | Có adapter và hook sau approval trong Content service; kiểm canonical/version, output Pending, audit và chống trùng | Provider/credentials chưa cấu hình; chưa có kết quả dịch/TTS thật |
| Tìm đường | API walking/driving dùng provider, giữ thứ tự tour và xử lý lỗi | ORS key hiện chưa cấu hình; chưa chạy provider thật |
| Analytics | Lượt kích hoạt/nghe theo ngày/POI, tổng duration từ NarrationLogs | Mobile chưa thấy gửi play-log duration; dữ liệu duration hiện 0; chưa có tuyến ẩn danh/heatmap |
| Offline/sync | OfflinePackages và sync metadata API | OfflinePackages có 0 bản ghi; sync hiện Admin-only; chưa có download/cache/content sync trên Mobile |
| Gói/thanh toán | Đọc PoiPaymentSessions/AccessPaymentSessions; thời hạn POI có staging; Admin mark-paid không có chứng cứ bị chặn | Chưa có danh mục gói, subscriptions, transaction evidence/đối soát thật; endpoint guest simulate-payment cũ vẫn là mô phỏng, không phải cổng thanh toán |
| Gateway | Cổng 8000 chuyển tiếp Auth/Content; Web proxy dùng được | Chưa có bằng chứng triển khai production |
| Narration service riêng | Source chỉ có /health | Chưa có chức năng sinh/thuyết minh thực; cổng 8003 hiện không chạy. Adapter hiện nằm trong Content service |

Nguồn chính: services/auth-service/app; services/content-service/app; gateway/main.py; services/narration-service/app/main.py. Không suy diễn tài liệu architecture.md ghi nhiệm vụ thành chức năng đã thực hiện.

## Web Admin

Đã có dashboard, sidebar phân nhóm, POI/Tour/thứ tự, bản đồ quản trị, bản dịch, thuyết minh, ảnh/audio, QR, hồ sơ duyệt so sánh bản hiện tại/đề xuất, users, statistics, languages và trang automation. Các danh sách dùng API thật, có tìm kiếm/lọc/phân trang, validation, loading/empty/error và thông báo. Chưa đăng nhập được đưa về Login, không dùng dữ liệu mẫu.

Thư viện audio có form thêm file từ máy: POI + tên + ngôn ngữ + MP3/WAV/OGG/M4A/AAC/FLAC; lưu file rồi tạo AudioTracks Pending, retry không tải trùng. Media và bản ghi audio cần duyệt trước khi public cho Mobile.

Các trang chủ sạp/gói/giao dịch phản ánh đúng giới hạn DB: chủ sạp là tra cứu user/owner/grants, gói báo thiếu schema, giao dịch read-only/chưa đối soát. Không coi những trang này là quy trình duyệt chủ sạp/mua gói/thanh toán hoàn chỉnh.

## Mobile

Repo có hai nhánh giao diện:

- Expo React Native: apps/mobile/App.tsx và src/native. Có API catalog thật, POI/tour detail, ảnh, chọn ngôn ngữ, camera QR/nhập mã, guest access, audio player phát/dừng/tua/chọn bài, map POI và theo dõi vị trí foreground bằng expo-location. Route gọi API provider. SecureStore chỉ lưu phiên quyền nghe, không phải lưu nội dung offline.
- Bản React/Vite trình diễn: apps/mobile/src/App.tsx và src/screens, sử dụng src/data.ts. Trang Packages kích hoạt bằng timer, không xác minh giao dịch. Không dùng bản này làm bằng chứng đã hoàn thiện chức năng native/Backend.

Không thấy engine native tính vào/ra vùng bán kính, chọn POI theo khoảng cách/priority, min dwell/cooldown hay queue phát tự động. GPS watcher hiện cập nhật bản đồ. Player có playlist tour/chuyển bài thủ công; chưa thấy tự chuyển bài khi kết thúc hoặc queue theo GPS. Chưa thấy SQLite/download/cache audio/text hay API ghi duration từ player. Chưa có heatmap tuyến tham quan ẩn danh.

Chưa chạy build/kiểm thử native trên điện thoại trong lượt audit; apps/mobile hiện không có node_modules cục bộ. Không sửa Mobile. README Mobile còn ghi placeholder dù source native đã nhiều hơn; tài liệu cần nhóm Mobile cập nhật.

Script chạy LAN của Mobile hiện ưu tiên Content API cổng 8002, trong khi Web dùng Gateway 8000. Nhóm cần thống nhất entrypoint khi tích hợp/demo, đặc biệt nếu gọi Auth qua Gateway.

## Dữ liệu thật hiện tại

Snapshot tại [project-inventory-2026-10-14.json](project-inventory-2026-10-14.json).

| Loại | Tổng trong DB | Sẵn sàng hiện tại |
| --- | ---: | --- |
| POI | 23 | 4 chưa xóa mềm và đủ public; 19 còn lại đã xóa mềm |
| Tour | 8 | 3 chưa xóa mềm, 0 public |
| AudioTracks | 20 | Tất cả Pending, 0 Approved active; 20 đường dẫn đều thiếu file |
| MediaFiles chưa xóa | 47 | 46 ảnh thiếu file; 1 audio có file thật |
| Audio media mới | 1 | Chưa được liên kết bởi AudioTracks canonical hoặc proposal audio Pending |
| Ngôn ngữ | 6 | 6 active; không đồng nghĩa có đầy đủ bản dịch/audio ở cả 6 |
| QR | 28 | 5 active/chưa xóa; vẫn cần đích public/quyền phù hợp để resolve/phát |
| Người dùng | 9 | 7 active |
| Hồ sơ nội dung | 90 | Pending, cần review nghiệp vụ thật |
| Nhật ký | 211 | Tổng DurationPlayedSeconds=0; không dùng để chứng minh thời lượng nghe |
| OfflinePackages | 0 | Chưa có gói offline |
| Thanh toán | 3 session POI, 39 session access | Session không chứng minh đã thu tiền/đối soát |

Vì vậy 23 POI/8 tour trong dump không phải 23 POI/8 tour xuất hiện công khai. Có một file audio trên đĩa cũng không đồng nghĩa Mobile đã có một bài nghe; cần liên kết và duyệt.

## Chạy và kiểm thử

- Lúc audit: Web 5173, Gateway 8000, Auth 8001, Content 8002 truy cập được; Narration 8003 không truy cập được.
- Build/lint Web PASS; Vitest 21/21; Content 39/39 gồm 20 SQL integration; Auth 7/7; Python Ruff E9,F/compileall PASS.
- E2E Admin 32/32 trước form upload audio; 2/2 E2E bổ sung upload/retry. Có 16 trang được kiểm tra qua Gateway/DB thật; các thao tác ghi ở E2E nghiệp vụ dùng mock, SQL writes trong integration rollback.
- Có GitHub Actions Web/typecheck/lint/unit/E2E, Backend compile/unit và build container Web. Chưa có bằng chứng CI đã chạy trên GitHub với working tree hiện tại; SQL live tests không chạy mặc định trong CI; chưa có deployment/CD hay pipeline native Mobile hoàn chỉnh.
- Có Dockerfiles và compose; chưa xác nhận Docker production/E2E điện thoại. Workflow failure artifact còn trỏ test-results trong khi Playwright hiện dùng .playwright-results; cần cập nhật khi hoàn thiện CI.

## Thứ tự cần làm tiếp

1. Hoàn tất liên kết file audio mới vào AudioTracks đúng POI/ngôn ngữ; bổ sung ảnh thật; duyệt một bộ nhỏ để demo một POI có ảnh/text/audio và một tour 2–3 POI.
2. Kiểm thử end-to-end trên điện thoại: catalog → detail → QR/quyền nghe → stream/phát audio.
3. Nhóm Mobile hoàn thiện geofence, priority/dwell/cooldown, narration queue và xử lý vòng đời/interruption; Backend đã có thông số để cấp cho client.
4. Chọn/cấu hình provider dịch/TTS nếu cần tự động, cấu hình route provider và kiểm thử thật. Có thể dùng audio thu sẵn cho demo chức năng cốt lõi trước.
5. Gửi log thời lượng thực, sau đó triển khai offline/cache/sync và tuyến ẩn danh/heatmap theo yêu cầu.
6. Chốt hồ sơ chủ sạp, gói và đối soát thanh toán trước migration/API nghiệp vụ mới. Theo tomtatyeucau.md trong repo, thanh toán là phần mở rộng; trọng tâm đề tài vẫn là GPS/geofence/audio/QR/đa ngôn ngữ.
7. Hoàn thiện CI/CD, đóng gói/demo, tài liệu và kịch bản kiểm thử/báo cáo.

[Báo cáo Admin chi tiết](admin-results.md) · [Audit Admin](admin-audit.md) · [Migration đề xuất chưa áp dụng](admin-business-migration-proposal.md) · [Contract dịch/TTS](admin-provider-contract.md).
