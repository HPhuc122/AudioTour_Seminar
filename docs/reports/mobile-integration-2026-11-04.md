# Tích hợp AudioTour — 04/11/2026

## Luồng dữ liệu thực tế

- `npm start` ở Mobile đặt `EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:8002`; `api.ts` gọi Content API. Gateway 8000 chuyển cùng endpoint sang Content 8002; Auth nằm ở 8001.
- `SELECT DB_NAME()` xác nhận **AudioTourVinhKhanh**. Audit SQL/API trên cả 8000 và 8002 khớp 12 POI, 3 tour, 24 ảnh và 15 QR đích. Cả 12 POI có tọa độ trong DB; chưa xác minh GPS ngoài thực địa.
- POI public cần `IsActive=1`, chưa xóa, `LifecycleStatus=3`, `ApprovalStatus=1`, `ReviewStatus='Approved'` và còn trong `ValidFrom`/`ValidUntil`.
- Tour public cần active, chưa xóa, đã Approved. POI con vẫn chịu đầy đủ điều kiện public và sắp theo `TourPOIs.OrderIndex`. Bản dịch chỉ lấy Approved/chưa xóa; chưa có ngoại ngữ thì fallback tiếng Việt.
- CMS lưu đề xuất ở `ContentSubmissions`. Canonical public không bị ghi đè bởi Pending. Chỉ thao tác duyệt của Admin mới cập nhật canonical và tăng version.
- Audio file cần track Approved/active/chưa xóa, media cùng POI Approved ở cả hai cột trạng thái, file vật lý tồn tại và quyền khách đúng scope/chưa hết hạn. Quy tắc media áp dụng cả file dạng TTS. Text TTS không được coi là file nghe native.

## Thay đổi trong lượt này

| Nhóm | File | Thay đổi |
| --- | --- | --- |
| Web | `apps/web/docs/src/pages/admin/ContentConsole.tsx` | Khôi phục nút upload audio và nối vào form có sẵn |
| Web | `apps/web/docs/src/components/AudioUploadDialog.tsx` | Dùng dialog quản lý focus/Escape; chuẩn hóa MIME từ đuôi file; khóa POI/file sau upload; giữ media khi tạo track thất bại; tránh tạo trùng khi callback sau lưu lỗi |
| Chủ sạp | `apps/web/docs/src/pages/vendor/VendorPois.tsx` | Hướng dẫn rõ hai bước duyệt media rồi track, tiếp tục dùng form khóa POI của Chủ sạp |
| Backend | `app/services/review_service.py`, `admin_service.py` | Lấy MIME/kích thước từ media thật; chặn file rỗng và dọn file khi bước lưu media lỗi |
| Backend | `app/repositories/content_repository.py` | File TTS cũng phải có media Approved |
| Backend | `app/services/content_service.py` | Chuẩn hóa `audioTrackId`, giữ track thủ công bên cạnh audio tự sinh; mở metadata/cấp quyền/thanh toán không tạo log nghe; kiểm tra ngôn ngữ log khớp track |
| Mobile | `App.tsx`, `api.ts`, `MapPanel.tsx`, `proximity.ts` | Dwell/cooldown theo POI; loại GPS cũ/kém chính xác; lấy mẫu khi đứng yên; dừng/reset khi tắt hoặc về nền; truyền đúng trigger `gps` |
| Mobile | `DetailAudio.tsx`, `listening.ts`, 5 JSON ngôn ngữ | Đếm thời gian thực và tiến độ phát, loại tua/pause/buffering; gửi delta khi kết thúc/đóng; lỗi log có thông báo và gửi lại thủ công trong phiên |
| Kiểm tra | `scripts/audit_mobile_integration.py` | Audit chỉ đọc database/public/ảnh/QR/quyền khách, không tạo session hay duyệt |
| Kiểm tra | `scripts/check_pending_isolation.py` | Tạo/sửa/upload Pending trong transaction rollback; không gọi approve/reject |
| Kiểm tra | `tests/test_mobile_audio_flow.py`, `audio-upload.spec.ts`, `check-native-playback.cjs`, `check-api-network.cjs` | Kiểm thử riêng luồng audio, review mô phỏng, quyền, bytes/Range, GPS và log |

Đường dẫn `app/` và `tests/` backend trong bảng nằm dưới `services/content-service/`. Các sửa đổi local từ trước được giữ lại; bảng chỉ liệt kê công việc của lượt tích hợp này.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| Audit chỉ đọc Gateway 8000 và Content 8002 | PASS: cùng DB, 12 POI, 3 tour, 15 QR, 24 ảnh đúng ownership và SHA-256 file |
| SQL Pending isolation | PASS: sửa POI/bản dịch không đổi public; tạo POI/upload media/tạo track đều Pending và không public; scope Chủ sạp đúng; rollback được xác nhận |
| API CMS Admin/Chủ sạp sau khi restart Content | PASS: catalog/summary/statistics/review; anonymous 401 và trang quản trị riêng bị chặn 403 với Vendor |
| Backend unit | 34 PASS, 55 SQL integration cũ SKIP; 8 test mới nằm trong số PASS |
| Stream fixture WAV | HTTP 200 đúng bytes/MIME; 206 Range đúng; không token 401; sai POI 403; log duration/ngôn ngữ được kiểm tra |
| Web build + lint | PASS |
| Web unit | 27/27 PASS |
| E2E upload riêng | 4/4 PASS: Admin, Chủ sạp/tiếng Việt, retry không upload trùng, file rỗng |
| E2E review riêng, API mô phỏng | 5/5 PASS; không gọi duyệt SQL thật |
| Mobile TypeScript + đa ngôn ngữ + API network | PASS |
| GPS/listening logic | PASS: radius/accuracy/dwell/stale/gap/cooldown; seek/pause/background; flush đồng thời và retry chủ động |
| Android export | PASS với Expo AppEntry; không phải APK hoặc kết quả chạy thiết bị |

Không chạy toàn bộ E2E, không chạy các SQL test cũ có thao tác approve. Kiểm thử review dùng repository mock; kiểm thử Pending SQL không duyệt bất kỳ nội dung nào. Không tạo/reset DB, không giữ lại file/POI/track thử trong DB, không commit/push.

## Còn cần người kiểm thử thực hiện

DB vẫn **0 AudioTracks** sau rollback, chưa có bản dịch ngoại ngữ. Người quản trị cần upload một bản thu tiếng Việt thật và tự xét duyệt media rồi track; sau đó mới xác nhận phát trực tiếp với dữ liệu public thật. Các kiểm tra WAV hiện dùng file tạm và quyền/repository mô phỏng.

Chưa có Android thật/ADB để kiểm tra loa, camera, GPS, quyền hệ điều hành và hành vi nền. Mạng LAN/Firewall và tọa độ thực địa cần kiểm tra trên điện thoại. Theo [checklist Android](../guides/android-integration-checklist.md).

Gói khách hiện là thanh toán mô phỏng. Log thất bại giữ trong bộ nhớ, chưa có outbox bền vững hoặc event ID chống trùng qua mất phản hồi; không tự retry POST. Foreground proximity hiện không chạy nền. Các giới hạn này được ghi rõ trong checklist.

## Chạy lại đúng phạm vi

```powershell
# Root, Windows có quyền SQL Server
.tooling/python/python.exe scripts/audit_mobile_integration.py
.tooling/python/python.exe scripts/audit_mobile_integration.py --base-url http://127.0.0.1:8002
.tooling/python/python.exe scripts/check_pending_isolation.py

# apps/web
npm.cmd run build
npm.cmd run lint
npm.cmd test
$env:WEB_BROWSER_CHANNEL='msedge'
npm.cmd run test:e2e -- tests/e2e/audio-upload.spec.ts tests/e2e/review.spec.ts --workers=1

# apps/mobile
npm.cmd run typecheck
node scripts/check-api-network.cjs
node scripts/check-ui-translations.cjs
node scripts/check-native-playback.cjs
```

## Bổ sung hoàn thiện Web và Mobile

Các thay đổi tiếp theo giữ nguyên DB, dữ liệu và quy trình duyệt:

- `VendorSubmissionDetail.tsx` và `VendorSubmissions.tsx`: gửi lại ngay trong hộp thoại Rejected, khóa khi đang gửi, hiển thị lỗi trong hộp thoại; hồ sơ media audio mở đúng tab audio.
- `apps/mobile/App.tsx`, `HomeScreen.tsx`, `CatalogListScreen.tsx`, `CatalogDetailScreen.tsx`: refresh khi kéo hoặc trở lại foreground, kể cả kết quả tìm kiếm; refresh chi tiết không tự phát lại bài. Nội dung không còn được phép truy cập sẽ đóng chi tiết cũ.
- `accessTime.ts`, `paidAccessStore.ts`, `TicketScreen.tsx`, `DetailAudio.tsx`: chuẩn hóa UTC/offset/legacy timestamp, loại session lưu hỏng; vé dùng deadline chung không tăng lại khi đổi tab; đóng player khi deadline quyền nghe hết hạn. Không coi sự tồn tại gói trả phí toàn cục là bằng chứng mọi POI đều bị khóa.
- `content_service.py`: phản hồi hết hạn quyền khách có UTC offset rõ ràng. `content_repository.py`, `api.ts`, `PoiImages.tsx` và các màn hình hiển thị ảnh: dùng version media/track làm cache key để nội dung đã duyệt mới không dùng file cache cũ.
- `gateway/main.py`: lỗi kết nối/timeout trả JSON 502/504; giữ header quyền khách/Range và không forward Content-Encoding đã được httpx giải nén.
- `HomeScreen.tsx` và các dictionary: dùng tiêu đề khám phá ẩm thực phù hợp dataset hiện tại.
- `README.md`, Mobile README và [hướng dẫn chạy chung](../guides/run-web-mobile-together.md): phân biệt mở DB hiện có với khởi tạo máy mới, hướng dẫn đủ ba terminal Web/Backend/Mobile.

Kiểm thử bổ sung: 18 E2E đúng phạm vi (upload 4, review 5, Chủ sạp 9); Web build/lint và 27 unit test đạt. Content có 36 test đạt, 55 SQL test cũ vẫn skip để không gọi approve; Gateway 4 test đạt. `check-access-session.cjs` kiểm tra UTC ở Việt Nam/UTC/New York, thời gian nền và SecureStore hỏng; test media xác nhận URL đổi theo version. Mobile TypeScript, API network, đa ngôn ngữ, GPS/listening và Android export được kiểm tra lại.

Các giới hạn dữ liệu/Android/outbox/thanh toán mô phỏng nêu trên vẫn còn. Chưa có file thu âm thật hoặc kết quả Android mới được cung cấp, nên không đánh dấu phát audio public hay GPS thiết bị thật đã hoàn tất.

## Tinh gọn Web theo yêu cầu

Đã đối chiếu danh sách bảng thật của `AudioTourVinhKhanh`. DB có `PoiPaymentSessions`/`AccessPaymentSessions`, nhưng giao dịch hiện là mô phỏng; theo yêu cầu đã gỡ giao diện giao dịch khỏi Web. Các màn hình Hồ sơ chủ sạp riêng (trùng dữ liệu Users/POIs/EntityGrants), Thời hạn riêng, Cấu hình chỉ chứa liên kết và Automation chưa cấu hình cũng được gỡ cả menu, route và liên kết dashboard/xem trước.

Xóa frontend `OperationsPage.tsx`, `AutomationPage.tsx`, `AutomationStatus.tsx`. Chuyển hàm ngày dùng chung sang `lib/dateTime.ts`. Các cột thật `POIs.ValidFrom`/`ValidUntil` được giữ trong form sửa POI của Admin và vẫn gửi Pending qua API POI. Tài khoản Chủ sạp tiếp tục được quản lý tại Người dùng và cấp quyền trên POI/Tour. Bảng, dữ liệu và API dùng bởi Mobile không bị xóa.

Đã cập nhật `App.tsx`, dashboard, content preview, phần nội dung Chủ sạp, form POI, README và test theo phạm vi mới. Build/lint, 27 unit test và 19 E2E liên quan đạt. Đăng nhập thật bằng Admin, kiểm tra sidebar đã gỡ các mục cũ, dashboard và bảng 12 POI: PASS. Ảnh kiểm tra cục bộ nằm tại `.runtime/admin-cleaned.png`. Danh sách live Admin test còn 10 trang tương ứng giao diện hiện tại.

## Sửa lỗi thêm nội dung và cuộn trang Chủ sạp

- `VendorPois.tsx`: bỏ cách chia nhóm bằng chỉ số `slice` khiến Giới thiệu bị render thành input số sau khi thêm trường Địa chỉ; chia theo loại trường để giữ textarea và nội dung cũ. Bổ sung giải thích/định dạng và giới hạn tọa độ, giới hạn độ dài theo cột SQL.
- `DetailDialog.tsx`, `ContentPreviewDialog.tsx`, `styles.css`: bỏ việc lưu/khôi phục `body.style.overflow` độc lập ở từng dialog. CSS khóa theo dialog/backdrop đang mở, tránh khóa sót khi hai hộp thoại đóng cùng lúc. Modal tự cuộn, nút lưu form Chủ sạp bám cuối màn hình.
- Đã tái hiện test lỗi cuộn trước sửa; sau sửa 26 E2E đúng phạm vi đạt, gồm dialog lồng nhau, màn hình thấp, tạo/sửa POI có Giới thiệu và xem trước. Build/lint đạt. Đăng nhập thật `user`, kiểm tra nhập văn bản, cuộn và gửi form ở 1280px/390px đạt; request tạo POI được chặn ở browser test, không tạo dữ liệu thử trong DB.
