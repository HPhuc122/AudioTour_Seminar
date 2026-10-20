# Audit Admin — SQL Server thật, 14/10/2026

Đọc sys.tables/sys.columns/sys.foreign_keys/sys.check_constraints của VinhHyAudioTourDB trước khi code. Snapshot chỉ chứa schema tại test-results/admin-schema-audit.json; không chứa mật khẩu/token.

| Nghiệp vụ | DB/API hiện có | Giao diện trước audit | Phân loại / hướng xử lý |
| --- | --- | --- | --- |
| Dashboard, thống kê | POIs, Tours, NarrationLogs, Devices; analytics API | Số tổng và biểu đồ | Có một phần; thêm hàng đợi và cảnh báo media |
| Duyệt chủ sạp | Users, Roles; chỉ IsActive, không có hồ sơ/trạng thái duyệt | Chỉ quản lý user | Cần migration; không dùng IsActive để suy diễn chờ duyệt |
| Duyệt POI/ảnh/text | ContentSubmissions, ContentVersions, POIs, MediaFiles, NarrationDrafts | Có queue, preview, reject reason | Có một phần; bổ sung search/filter, hồ sơ đầy đủ, xác nhận và thông báo |
| Quản lý POI | POIs.UserId FK Users; EntityGrants | CRUD, map và scope | Có một phần; tìm kiếm toàn bộ DB, filter, validation |
| Tour/thứ tự POI | Tours, TourPOIs, TourTranslations; proposal _pois | CRUD và editor | Có một phần; chọn POI từ dữ liệu thật, giữ bản public |
| Dịch/audio | POITranslations, AudioTracks; manual; narration-service chỉ health | CRUD/upload/nghe thử | Có một phần; provider thật chưa cấu hình, không sinh kết quả giả |
| Thời hạn POI | POIs.ValidFrom/ValidUntil | Chưa có trang riêng | Có một phần; quản lý thời hạn qua proposal, không tự gia hạn khi trả tiền |
| Danh mục gói dịch vụ | Không có bảng gói/đăng ký gói | Chưa có | Cần migration và xác nhận đối tượng/giá/thời hạn |
| Giao dịch | PoiPaymentSessions, AccessPaymentSessions; Provider mặc định SimulatedMoMo | Chưa có | Có một phần; tra cứu read-only, không coi Paid là đã đối soát |
| Bằng chứng thanh toán | Chưa có transaction ID, signature, evidence, verification audit | Chưa có | Cần migration và chọn provider; không thêm nút đánh dấu thanh toán thành công |
| Người dùng | Users/Roles; Auth API kiểm role độc lập | CRUD | Có một phần; search/filter/pagination và validation |
| Cấu hình | Languages, QRLocations; API hiện có | QR, thiếu Languages | Có một phần; cấu hình ngôn ngữ bằng API thật, trạng thái provider |

## Giai đoạn

1. Hoàn thiện trên schema hiện có: Admin yêu cầu đăng nhập và dùng DB thật; navigation theo nhóm; catalog/review tìm kiếm và phân trang ở SQL; hồ sơ và preview; dashboard; thời hạn; giao dịch read-only; Languages.
2. Đề xuất migration tách hồ sơ Vendor, danh mục gói, đăng ký và bằng chứng thanh toán. Chưa áp dụng khi nghiệp vụ chưa được xác nhận. Không backfill hoặc phê duyệt dữ liệu cũ.
3. Tích hợp adapter dịch/TTS thật qua cấu hình server. Chỉ xử lý text canonical Approved; kết quả là proposal Pending, không tự công khai. Không có provider thì trả rõ chưa cấu hình.
4. Kiểm thử SQL transaction rollback, Gateway read-only, build/lint/unit/E2E; cập nhật kết quả thực tế.

## Cần xác nhận

- Gói dành cho chủ sạp/POI hay quyền nghe khách? Thời hạn và giá, đơn vị tiền, chính sách gia hạn?
- Provider thanh toán và bằng chứng hợp lệ (webhook ký số/đối soát ngân hàng)?
- Hồ sơ chủ sạp cần thông tin nào? Duyệt hồ sơ có cấp quyền đăng nhập, tạo POI hay công khai POI?
- Nhà cung cấp dịch/TTS, API credentials, ngôn ngữ/giọng cần hỗ trợ? Chưa có cấu hình provider trong source.

Quyền sở hữu hiện dùng POIs.UserId và EntityGrants, không tự đổi owner. Giữ nguyên apps/mobile và API Mobile.
