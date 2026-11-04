# AudioTour Web Admin

Web React dành cho chủ sạp và quản trị viên; khách tham quan dùng Mobile React Native. Web gọi Gateway FastAPI, không kết nối SQL Server trực tiếp.

- Admin và Chủ sạp đăng nhập bằng tài khoản hệ thống. Mọi dữ liệu quản lý được lấy qua Gateway; lỗi kết nối được thông báo để người dùng thử lại.
- Sidebar chỉ giữ tổng quan, duyệt nội dung, nội dung tham quan, tài khoản và ngôn ngữ. Đã gỡ các trang Giao dịch, Hồ sơ chủ sạp riêng, Thời hạn riêng, Cấu hình hệ thống và Dịch/TTS tự động.
- Dashboard có tổng POI/tour/audio/media, hàng đợi duyệt và cảnh báo file thiếu. Thống kê lọc ngày UTC, dùng tên POI thật; nhật ký kích hoạt không được coi là lượt nghe hoàn tất.
- POI, Tour, người dùng, nội dung, ảnh/audio và ngôn ngữ có tìm kiếm/lọc/phân trang qua SQL. POI đã xóa mềm không xuất hiện trong danh sách mặc định.
- Hồ sơ duyệt so sánh canonical và đề xuất; xem trước ảnh/audio/text, xác nhận duyệt, bắt buộc lý do từ chối. Bản chỉnh sửa Pending không thay bản public. Thứ tự POI trong tour cũng qua quy trình duyệt.
- Tài khoản Chủ sạp quản lý tại Người dùng; cấp quyền trực tiếp trên POI/Tour. Không có trang hồ sơ xét duyệt Chủ sạp riêng.
- Thời hạn POI dùng các cột thật ValidFrom/ValidUntil ngay trong form sửa POI của Admin; thay đổi vẫn gửi duyệt. Không có màn hình gói dịch vụ/gia hạn riêng.
- Không hiển thị giao dịch hay thanh toán mô phỏng trên Web. Bảng/API quyền nghe của khách được giữ để Mobile tiếp tục hoạt động.
- Âm thanh được tạo từ văn bản thuyết minh đã được Admin duyệt. Thư viện audio chỉ xem/nghe kết quả; muốn sửa lời đọc phải sửa văn bản và gửi duyệt. Không tải file thu âm thủ công.
- Trạng thái tạo giọng nằm ngay trong trang thuyết minh/audio của Admin và Chủ sạp. Khi chưa cấu hình dịch vụ TTS hoặc chưa bật worker, giao diện báo chưa sẵn sàng; nghe thử trên Web không phải file đã xuất bản cho Mobile.
- Admin/SuperAdmin duyệt và quản lý hệ thống. Vendor/ContentAdmin/TourOperator sửa nội dung sở hữu hoặc được cấp quyền; AnalyticsViewer chỉ đọc. Backend kiểm tra role/scope độc lập với Web.
- Khu vực Chủ sạp dùng route `/vendor`: tổng quan trong scope, danh sách/tạo/sửa POI, ảnh, audio, trạng thái gửi duyệt, QR chỉ xem/tải theo POI và thống kê. Hồ sơ sạp, gói dịch vụ/gia hạn chưa có API đầy đủ nên không hiển thị như chức năng hoàn chỉnh.
- Chưa có tài khoản Vendor thì mở `/register` để tạo tài khoản qua `POST /api/v1/auth/register`; Backend hiện kích hoạt tài khoản ngay và chưa có quy trình xét duyệt hồ sơ Chủ sạp.
- Trang `/login` chỉ có đăng nhập và liên kết đăng ký Chủ sạp. Phiên cục bộ không hợp lệ hoặc đã hết hạn được xóa và yêu cầu đăng nhập lại.
- Source frontend hiện được nạp từ `docs/src`; TypeScript và test cũng trỏ về cùng thư mục.
- Dashboard Admin/SuperAdmin có mục Thiết bị truy cập: tổng thiết bị ghi nhận, thiết bị/tài khoản có tín hiệu trong 5 phút, số thiết bị hoạt động của từng tài khoản, tìm kiếm và phân trang. Web đã đăng nhập cập nhật mỗi 60 giây khi tab hiển thị; bảng đọc lại mỗi 30 giây. Nhiều tab cùng tài khoản/trình duyệt dùng chung ID; không phải nhận diện phần cứng. Mobile chỉ được tính khi đã gửi đăng ký/heartbeat, chưa tự động tích hợp heartbeat native trong thay đổi Web này.
- DB mới cần chạy `.tooling/python/python.exe scripts/migrate_device_presence.py` từ root để mở thêm Platform `web` trong constraint cũ. Migration đã áp dụng trên DB local. `scripts/check_device_activity.py` kiểm tra Gateway/SQL thật bằng một thiết bị thử riêng rồi xóa; không đổi tài khoản.
- Xem trước ảnh/audio/văn bản dùng hộp thoại, hỗ trợ Escape, trả focus về nút mở, báo lỗi HTTP và thu hồi blob URL khi đóng. Admin sửa được thông tin audio mà không phải nhập lại đường dẫn file.
- Chủ sạp có tìm kiếm/lọc/phân trang nội dung theo POI; thêm/sửa bản dịch và thuyết minh, sửa thông tin audio, thay ảnh và gửi yêu cầu xóa. Mọi thay đổi vẫn theo quy trình duyệt.
- Hồ sơ gửi duyệt của Chủ sạp có so sánh bản hiện tại/đề xuất, lý do từ chối, xem file đề xuất, liên kết đúng tab chỉnh sửa và gửi lại. Thanh đầu trang có đăng xuất ở cả màn hình nhỏ.
- Kiểm tra chỉ đọc API CMS với DB thật: `.tooling/python/python.exe scripts/check_web_console.py` từ root (cần quyền Windows truy cập SQL Server). Lệnh không khởi động worker, không ghi/duyệt dữ liệu và không in token.
- Giữ API Mobile và không sửa apps/mobile. Web không có GPS/geofencing/scan QR của khách.
- DB hiện tại AudioTourVinhKhanh có 12 POI, 3 tour và 24 ảnh; file audio/bản dịch ngoại ngữ cần được bổ sung qua quy trình nội dung.

## Chạy cục bộ

Windows: từ root chạy `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-backend.ps1` để khởi động Auth (8001), Content (8002) và Gateway (8000) dưới nền. Script dùng Python local, bỏ qua dịch vụ đã sẵn sàng và ghi log vào `.runtime`. Cần chạy bằng tài khoản Windows có quyền truy cập SQL Server; chỉ mở Vite chưa đủ để đăng nhập.

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
