# Kiểm thử AudioTour trên Android thật

Source: `apps/mobile/App.tsx` → `src/native/`. Database đang dùng là **AudioTourVinhKhanh**. Không chạy script initialize/reset database để thực hiện checklist này.

## Chuẩn bị

1. Máy tính và điện thoại cùng Wi-Fi. Backend Auth/Content/Gateway chạy ở 8001/8002/8000. Từ root có thể chạy `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-backend.ps1` bằng tài khoản Windows có quyền SQL Server.
2. Trong `apps/mobile`, chạy `npm start`. Ghi lại IP và QR Expo mới in trên terminal; mở bằng Expo Go tương thích SDK của source hoặc development build tương thích.
3. Trên trình duyệt điện thoại, kiểm tra `http://IP:8002/health` và `http://IP:8081/status`. `localhost` trên điện thoại trỏ vào điện thoại. Nếu không mở được, kiểm tra Windows Firewall, mạng khách và AP isolation; không đổi database để sửa lỗi mạng.
4. `npm start` truyền `EXPO_PUBLIC_API_BASE_URL=http://IP:8002` cho Metro. Nếu chạy `npm run start:manual`, phải cấu hình biến này bằng địa chỉ điện thoại truy cập được. Cổng 8000 cũng cung cấp cùng API qua Gateway.
5. Ghi model điện thoại, phiên bản Android, Expo/runtime, ngày giờ và loại mạng vào biên bản. Máy kiểm tra source hiện chưa có ADB/Android SDK hoặc điện thoại được kết nối, nên chưa có kết quả thiết bị thật.

## Dữ liệu audio do người quản trị chuẩn bị

Hiện DB có 12 POI, 3 tour và 24 ảnh, **chưa có audio**. Cấu hình dịch vụ TTS theo hướng dẫn adapter và bật worker. Người phụ trách chuẩn bị văn bản tiếng Việt thật cho đúng POI; không tự duyệt dữ liệu chỉ để kiểm thử.

1. Đăng nhập Chủ sạp, vào **Địa điểm của tôi → POI → Thuyết minh → Thêm thuyết minh**. Nhập tiêu đề, văn bản và chọn tiếng Việt rồi gửi duyệt.
2. Kiểm tra văn bản **Chờ duyệt**. Reload Mobile: bản public cũ vẫn giữ nguyên, chưa xuất hiện audio từ đề xuất Pending.
3. Admin vào **Duyệt nội dung**, kiểm tra văn bản và chủ động duyệt hồ sơ **Thuyết minh** đúng nghiệp vụ.
4. Xem **Tạo giọng từ văn bản**: yêu cầu chuyển từ chờ tạo giọng sang đang tạo và hoàn tất. Nếu chưa cấu hình hoặc tạo thất bại, giao diện phải báo; bản công khai cũ vẫn nguyên vẹn.
5. Khi file được tạo thành công, MediaFiles/AudioTracks kế thừa lần duyệt văn bản. Reload Mobile: `audioTracks` phải có track tiếng Việt với `audioTrackId`, `isAvailable=true` và `streamUrl`. Không upload hoặc duyệt file/track riêng.
6. Khi sửa bản public và gửi lại, Mobile tiếp tục thấy bản đã duyệt cho tới khi Admin xét duyệt đề xuất mới. Không chỉnh `ReviewStatus` trực tiếp trong SQL.

## Các ca chạy trên điện thoại

| Ca | Thao tác | Kết quả cần đạt |
| --- | --- | --- |
| A01 | Mở app và chọn tiếng Việt | Tải đủ 12 POI và 3 tour; lỗi mạng có thông báo/thử lại |
| A02 | Mở lần lượt 12 POI, ảnh chính, ảnh menu và phóng to | Đúng ảnh của từng POI, không lẫn ID; không báo tải ảnh lỗi; ghi nhận đủ 24 ảnh |
| A03 | Mở chi tiết POI có audio sau khi người quản trị đã duyệt | Nhìn thấy đúng tên track và ngôn ngữ; không phát trước khi có quyền khách hợp lệ |
| A04 | Quét QR POI/Tour tải từ web bằng camera; thử cả nhập mã | Đến đúng loại và ID; mã sai báo lỗi; chỉ mở chi tiết không tự tạo giao dịch thanh toán |
| A05 | Dùng gói khách của bộ demo | Người kiểm thử chủ động chọn và xác nhận **thanh toán mô phỏng**; không thu tiền thật. Gói demo 100.000 VND/60 phút, không tự xác nhận bằng SQL |
| A06 | Sau khi có quyền, bấm Phát audio | Có tiếng nói thật, thời gian chạy; nhận WAV/MP3 đúng MIME; không thay file thiếu bằng tiếng đọc giả |
| A07 | Tạm dừng 10 giây, tiếp tục, tua +5/-5, kéo thanh tua | Tua hoạt động; thời gian chờ, buffering và bước nhảy tua không cộng vào thời gian nghe; pause/resume không tách thêm một lượt nghe |
| A08 | Nghe hết, quay lại danh sách hoặc chọn bài khác | Gửi log có thời gian thực đã nghe; không gửi lần nữa cho cùng phần thời gian khi vừa kết thúc rồi đóng player |
| A09 | Chuyển app sang nền/khóa máy khi đang nghe | Player được đóng, audio dừng; lần nghe được flush. Khi quay lại phải chủ động mở/phát lại, không bất ngờ phát tiếp |
| A10 | Ngắt mạng khi kết thúc/đóng audio, sau đó mở chi tiết và có mạng lại | Báo chưa gửi nhật ký; bấm **Gửi lại nhật ký nghe**. Không tự lặp POST; chưa có outbox bền vững qua việc tắt hẳn app |
| A11 | Mở tour chứa POI vừa có audio | POI theo đúng `OrderIndex`; playlist chỉ có các track đã duyệt/có file/đúng ngôn ngữ; bài trước/sau không phát chồng |
| A12 | Từ chối camera, sau đó cấp lại | Nhập QR thủ công vẫn dùng được; camera quét lại khi đã có quyền |
| A13 | Chủ sạp sửa nội dung/ảnh rồi người quản trị xét duyệt; trên Mobile kéo để làm mới Home/danh sách/chi tiết | Thấy bản mới chỉ sau khi duyệt; ảnh thay thế không bị cache bản cũ; không tự phát lại audio khi refresh |
| A14 | Đổi qua lại Home và Vé, đưa app về nền rồi mở lại; thử đổi múi giờ điện thoại | Thời gian vé không tăng lại khi đổi tab, tính cả thời gian nền; UTC không bị lệch 7 giờ; player đóng khi quyền nghe hết hạn |
| G01 | Từ chối quyền vị trí hoặc tắt GPS | Hiển thị lỗi; không tự mở POI, vẫn xem danh sách/QR được |
| G02 | Cấp vị trí chính xác khi dùng app, mở tab bản đồ, bật Tự phát gần POI | Chỉ theo dõi foreground. Dùng tọa độ POI đã được xác minh, không đổi tọa độ public để làm test |
| G03 | Đứng ngoài bán kính, sau đó vào vùng và đứng đủ `MinDwellSeconds` | Ngoài vùng không kích hoạt; trong vùng phải đủ dwell qua các mẫu GPS mới, kể cả đứng yên. Có quyền và audio thì mở/phát với trigger `gps` |
| G04 | Vào vùng nhưng chưa có gói/quyền nghe | Có thể mở chi tiết nhưng không vượt kiểm tra quyền hoặc tự thanh toán |
| G05 | Quay lại bản đồ rồi vào lại cùng POI trong cooldown | Không tự kích hoạt lại trước `CooldownSeconds`. GPS cũ >30 giây hoặc sai số >100 m/>bán kính POI không kích hoạt |
| G06 | Tắt chế độ gần POI hoặc đưa app về nền khi chờ dwell | Dừng theo dõi; reset dwell. Trở lại foreground/bật lại phải lấy các mẫu vị trí mới |

GPS/geofencing hiện là theo dõi vị trí **khi tab bản đồ đang mở và app foreground**, không đăng ký background geofencing của hệ điều hành. Cooldown lưu trong phiên app. Đường đi ORS cần API key riêng; lỗi tìm đường không phải bằng chứng audio hay GPS bị hỏng.

## Đối chiếu nhật ký

Admin có thể xem thống kê, hoặc chạy truy vấn chỉ đọc:

```sql
USE AudioTourVinhKhanh;
SELECT TOP (30) Id, POIId, TriggerType, LanguageCode,
       DurationPlayedSeconds, PlayedAt
FROM NarrationLogs
ORDER BY Id DESC;
```

Ghi lại ID POI và khoảng giờ kiểm thử. Log mới phải có `DurationPlayedSeconds >= 1`, ngôn ngữ của track và trigger `manual`/`qr`/`gps` đúng đường vào. Chỉ mở trang, quét QR hoặc mua gói không được coi là đã nghe. Các log cũ có duration NULL được giữ nguyên.

Log chưa gửi chỉ được giữ trong bộ nhớ tiến trình; tắt hẳn app làm mất hàng đợi này. Token hết hạn sẽ bị server từ chối. Gửi lại thủ công khi mất phản hồi có thể trùng với một POST server đã xử lý; API hiện chưa có event ID để chống trùng qua lỗi mạng. Không coi luồng này là đo lường exactly-once.

## Biên bản bàn giao

Mỗi ca ghi **PASS / FAIL / CHƯA CHẠY**, giờ kiểm tra, thiết bị, POI/tour/track liên quan và lỗi quan sát được. Không chép access token vào báo cáo. Chỉ đánh dấu phát audio/GPS trên thiết bị đã đạt sau khi hoàn thành A06–A11 và G01–G06 trên Android thật.
