# Chạy Web và Mobile AudioTour cùng nhau

## Database và dịch vụ

Máy hiện dùng SQL Server thật với database `AudioTourVinhKhanh`; dữ liệu khởi đầu là bộ seed của nhóm. Không cần chạy lại initialize, update seed hoặc reset để mở ứng dụng.

| Thành phần | Địa chỉ trên máy tính | Vai trò |
| --- | --- | --- |
| Web | http://localhost:5173 | Admin và Chủ sạp |
| Gateway | http://localhost:8000 | Web gọi API qua proxy Vite |
| Auth | http://localhost:8001 | Đăng nhập, tài khoản, phân quyền |
| Content | http://localhost:8002 | POI, tour, media, duyệt, QR, quyền khách, nhật ký |
| Expo Metro | exp://IP-LAN:8081 | Điểm mở ứng dụng Android |

Mobile chạy qua `npm start` dùng Content API tại `http://IP-LAN:8002`. Gateway 8000 cũng chuyển các API nội dung đến đúng Content Service này. Cả Web và Mobile dùng chung DB; thay đổi không nằm trong hai bộ dữ liệu riêng.

## Mở ứng dụng trên máy hiện có

Từ root, mở backend:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-backend.ps1
```

Trong terminal thứ hai:

```powershell
cd apps/web
npm.cmd run dev
```

Mở http://localhost:5173. Trên máy hiện tại, tài khoản đã đổi theo yêu cầu: Admin dùng **`admin` / `abc`**, Chủ sạp đầu tiên dùng **`user` / `abc`**. ID, vai trò và POI sở hữu được giữ nguyên. Nếu trình duyệt đang lưu phiên cũ, đăng xuất rồi đăng nhập lại.

Trên máy mới khởi tạo từ seed, tên mặc định vẫn là `local-admin`, `local-vendor`, `local-vendor-02` … `local-vendor-12`, mật khẩu seed `123456`; các tài khoản Chủ sạp còn lại trên máy này không bị đổi.

Trong terminal thứ ba:

```powershell
cd apps/mobile
npm.cmd start
```

Điện thoại cùng Wi-Fi, mở QR Expo hoặc địa chỉ `exp://IP-LAN:8081` in trong terminal bằng Expo Go/runtime phù hợp SDK của source. Kiểm tra từ trình duyệt điện thoại `http://IP-LAN:8002/health`. Không dùng `localhost` làm API của điện thoại. Khi đổi Wi-Fi, quét lại QR mới.

Nếu dependencies đã có, không cần cài lại. Trên máy mới, cài dependencies và làm theo [hướng dẫn database](local-database-bootstrap.md); không chép đè `.env` hiện tại bằng `.env.example` khi đang sử dụng DB.

## Luồng công việc liên thông

1. Chủ sạp nhập/sửa văn bản thuyết minh tiếng Việt tại POI sở hữu. Đề xuất được lưu Pending, không ghi đè nội dung public. Ảnh vẫn được tải lên riêng.
2. Admin mở hồ sơ, so sánh canonical/đề xuất và xem/nghe file. Chỉ người phụ trách xét duyệt mới xác nhận duyệt hoặc từ chối.
3. Khi Admin duyệt văn bản, hệ thống xếp yêu cầu TTS. Worker tạo file âm thanh, MediaFiles và AudioTracks kế thừa lần duyệt văn bản đó; không cần duyệt file/track riêng. Khi tạo giọng lỗi, bản công khai cũ được giữ nguyên. Xem trạng thái trên trang thuyết minh/audio.
4. Mobile kéo để làm mới Home, danh sách hoặc chi tiết, hoặc trở lại ứng dụng từ nền để tải lại nội dung đã duyệt. Khi làm mới chi tiết không tự phát lại bài đang nghe.
5. Phiên bản ảnh/audio được đưa vào URL, nên bản đã duyệt mới có cache key mới dù ID bản ghi không đổi.
6. Khách dùng QR/gói truy cập phù hợp để nghe. Bộ seed hiện là thanh toán mô phỏng, không tích hợp cổng thu tiền thật.
7. GPS hoạt động khi tab bản đồ mở và app foreground; cần đủ dwell/cooldown theo POI. Nhật ký chỉ tính thời gian thực nghe, không tính mở trang, tua, pause hoặc buffering.
8. Vé dùng deadline chung giữa các màn hình, timestamp UTC có múi giờ rõ ràng. Player dừng khi deadline quyền nghe của phiên đã hết; server vẫn kiểm tra quyền mỗi lần mở/stream.

Trong Web, Chủ sạp có thể gửi lại hồ sơ Rejected ngay trong hộp thoại chi tiết. Lỗi gửi lại hiển thị trong hộp thoại và không đóng mất nội dung đang xem.

## Kiểm tra nhanh

```powershell
# Root: chỉ đọc dữ liệu và kiểm tra API/ảnh/QR/quyền khách
.tooling/python/python.exe scripts/audit_mobile_integration.py
.tooling/python/python.exe scripts/check_web_console.py

# Root: kiểm thử Gateway bằng transport mô phỏng, không ghi DB
.tooling/python/python.exe scripts/test_gateway.py

# apps/mobile
npm.cmd run typecheck
node scripts/check-access-session.cjs
node scripts/check-native-playback.cjs
node scripts/check-api-network.cjs
node scripts/check-ui-translations.cjs
```

Các service ghi log vào `.runtime/`. Gateway trả lỗi JSON 502/504 khi không kết nối được upstream hoặc upstream hết thời gian chờ; kiểm tra terminal/log dịch vụ tương ứng trước.

## Phần cần dữ liệu và điện thoại thật

Hiện có 12 POI, 3 tour, 24 ảnh; chưa có track audio và bản dịch ngoại ngữ thật trong DB. Cần cấu hình dịch vụ TTS theo hướng dẫn adapter, bật worker và để người phụ trách duyệt văn bản thật. Không tự duyệt nội dung chỉ để test. Chưa thể xác nhận loa, camera, GPS, mạng LAN và hành vi Android thực tế chỉ bằng Android bundle.

Xem [checklist Android](android-integration-checklist.md) và [báo cáo tích hợp](../reports/mobile-integration-2026-11-04.md). Nhật ký lỗi hiện chỉ giữ trong bộ nhớ phiên, chưa có outbox bền vững/event ID chống trùng qua lỗi mạng. GPS chưa chạy nền; thanh toán chưa phải cổng thanh toán thật.
