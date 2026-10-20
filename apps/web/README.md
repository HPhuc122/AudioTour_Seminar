# AudioTour Web Admin

Web React dành cho chủ sạp và quản trị viên; khách tham quan dùng Mobile React Native. Web gọi Gateway FastAPI, không kết nối SQL Server trực tiếp.

- Trang Admin yêu cầu đăng nhập. Không dùng dữ liệu mẫu thay cho dữ liệu thật hoặc lỗi Backend.
- Sidebar chia nhóm tổng quan, hồ sơ/duyệt, nội dung, dịch vụ/thanh toán, quản trị hệ thống.
- Dashboard có tổng POI/tour/audio/media, hàng đợi duyệt, cảnh báo file thiếu và thời hạn. Thống kê lọc ngày UTC, dùng tên POI thật; nhật ký kích hoạt không được coi là lượt nghe hoàn tất.
- POI, Tour, người dùng, nội dung, ảnh/audio và ngôn ngữ có tìm kiếm/lọc/phân trang qua SQL. POI đã xóa mềm không xuất hiện trong danh sách mặc định.
- Hồ sơ duyệt so sánh canonical và đề xuất; xem trước ảnh/audio/text, xác nhận duyệt, bắt buộc lý do từ chối. Bản chỉnh sửa Pending không thay bản public. Thứ tự POI trong tour cũng qua quy trình duyệt.
- Hồ sơ chủ sạp hiện tra cứu tài khoản, POI sở hữu và quyền được cấp. Chưa có quy trình duyệt hồ sơ trong schema cũ.
- Thời hạn POI dùng ValidFrom/ValidUntil; thay đổi gửi duyệt. Danh mục gói dịch vụ/mua gói/gia hạn thanh toán chưa triển khai vì cần xác nhận nghiệp vụ và migration.
- Giao dịch tra cứu PoiPaymentSessions/AccessPaymentSessions. Paid trong DB không chứng minh đã đối soát; SimulatedMoMo được ghi rõ là mô phỏng. Không có nút xác nhận thanh toán giả; Backend chặn mark-paid và payload sửa PaymentStatus.
- Thư viện Âm thanh có nút Thêm file âm thanh: chọn MP3/WAV/OGG/M4A/AAC/FLAC, POI, tên và ngôn ngữ rồi lưu. Backend lưu file thật và bản ghi AudioTracks vào Pending. Không cần nhập đường dẫn file; khi tạo bản ghi lỗi, thử lại dùng file đã tải lên để tránh tải trùng.
- Ngôn ngữ có API cấu hình thật. Dịch/TTS có adapter và hook chạy sau duyệt, nhưng provider thật chưa cấu hình; chưa bật tự động. Kết quả tạo vào Pending, audio cần duyệt media trước.
- Admin/SuperAdmin duyệt và quản lý hệ thống. Vendor/ContentAdmin/TourOperator sửa nội dung sở hữu hoặc được cấp quyền; AnalyticsViewer chỉ đọc. Backend kiểm tra role/scope độc lập với Web.
- Giữ API Mobile và không sửa apps/mobile. Web không có GPS/geofencing/scan QR của khách.
- 46 file media gốc vẫn thiếu trên máy; upload hoặc khôi phục file thật trước khi demo đầy đủ.

## Chạy cục bộ

Trong root AudioTour_Seminar mở ba terminal cho Backend, dùng Python có dependencies hoặc portable .tooling/python/python.exe:

```powershell
python scripts/serve.py auth
python scripts/serve.py content
python scripts/serve.py gateway
```

Mỗi lệnh chạy ở terminal riêng. Auth: 8001; Content: 8002; Gateway: 8000. Trong apps/web chạy npm.cmd run dev; mở http://localhost:5173. Proxy /api chuyển tới 127.0.0.1:8000. ECONNREFUSED 8000 nghĩa là Gateway chưa chạy. Backend đọc .env root; không commit secrets.

## Kiểm tra

Trong apps/web: npm.cmd run build, npm.cmd run lint, npm.cmd test. E2E trên Windows Edge:

```powershell
$env:WEB_BROWSER_CHANNEL='msedge'
$env:AUDIOTOUR_LIVE='1'
npm.cmd run test:e2e
```

E2E nghiệp vụ dùng mock ở lớp test; giao diện Admin thực tế không dùng mock. Test live trang Admin cần AUDIOTOUR_ADMIN_SESSION ngắn hạn, chỉ truyền vào tiến trình test. Không ghi token/mật khẩu vào tài liệu. Output Playwright nằm riêng ở .playwright-results để không xóa log service.

SQL integration opt-in từ root: đặt AUDIOTOUR_SQL_TESTS=1 rồi chạy python scripts/test_content.py; dữ liệu thử rollback và file thử được dọn. Auth: python scripts/test_auth.py.

[Audit và bảng đối chiếu](docs/admin-audit.md) · [Đề xuất migration chưa áp dụng](docs/admin-business-migration-proposal.md) · [Contract adapter dịch/TTS](docs/admin-provider-contract.md) · [Báo cáo kết quả](docs/admin-results.md) · [API Mobile](../../docs/api-contracts/mobile-integration.md).
