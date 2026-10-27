# Tích hợp Mobile, Web và database AudioTour

## Kiến trúc và tương thích

Mobile React Native là giao diện khách; Web React.js là CMS. Cả hai gọi Gateway FastAPI, Gateway chuyển tiếp Auth/Content service và cùng sử dụng SQL Server `VinhHyAudioTourDB`. Web không đọc file SQL trực tiếp. Chế độ xem thử dùng dữ liệu mẫu; đăng nhập mới quản lý dữ liệu thật.

Đã đối chiếu endpoint trong `apps/mobile/src/native/api.ts`, không sửa Mobile. Giữ đường dẫn, query `lang`, `languageCode`, `pageSize`, `name`, envelope và field cũ. Bổ sung URL media, ngôn ngữ, bán kính/thứ tự trong điểm dừng. Nội dung chưa duyệt trả 404/không có trong danh sách theo chính sách công khai mới.

## Database và media cục bộ

File gốc `apps/VinhHyAudioTourDB.sql` (UTF-16) có schema và seed cũ, không chứa file ảnh/audio. Lệnh CREATE DATABASE của dump chứa đường dẫn MDF tuyệt đối của máy cũ. File gốc giữ nguyên; `scripts/prepare_database.py` tạo bản import portable và từ chối ghi đè DB có sẵn.

Đã import SQL Server `localhost`, áp dụng `infra/sql/001_scope_and_review.sql` và `002_narration_publication.sql`. `.env` tại root dùng Windows Authentication, JWT secret chung Auth/Content, MEDIA_ROOT trỏ đến thư mục `services/content-service` bằng đường dẫn tuyệt đối. `.env` được Git bỏ qua. Backend đọc `.env` root độc lập thư mục chạy. Docker dùng SQL Authentication, `SQLSERVER_HOST=host.docker.internal`, `SQLSERVER_USE_WINDOWS_AUTH=false`, mount media và đặt MEDIA_ROOT theo đường dẫn container.

| Dữ liệu sau import | Tổng | Trạng thái |
| --- | ---: | --- |
| POI | 23 | 21 Approved, 2 Rejected; 4 đủ điều kiện public |
| Tour | 8 | Pending; có bản ghi đã xóa trong dữ liệu cũ |
| Audio | 20 | Pending, chưa có bằng chứng duyệt |
| Media | 46 | 38 Approved, 2 Pending, 6 Rejected từ DB cũ |
| Bản dịch POI | 35 | Pending |
| Bản dịch Tour | 7 | Pending |
| Thuyết minh | 29 | 8 Approved, 20 Pending, 1 Rejected |

**46 file media tương ứng đều chưa có trên máy này.** Khôi phục `uploads/images`, `uploads/audio` vào MEDIA_ROOT và giữ đường dẫn trong `MediaFiles.RelativePath`/`AudioTracks.FileUrl`, hoặc upload file thay thế trên Web. Stream file thiếu trả 404; duyệt file mới không tồn tại trả 409. Metadata ảnh đã được duyệt từ DB cũ có thể có URL trả 404 đến khi khôi phục file. Không dùng media giả thay dữ liệu thật.

Migration giữ các POI/Media/Narration có trạng thái đã duyệt, không tự duyệt Tour/Audio/bản dịch thiếu bằng chứng. Hiện Gateway trả 6 ngôn ngữ, 4 POI và 0 Tour public. API Tour/Audio đã kiểm thử với dữ liệu SQL thật trong transaction rollback. Cần Admin duyệt dữ liệu thật và bổ sung media để demo Mobile đầy đủ.

## Kết nối

- Gateway `http://localhost:8000`; Web dev `http://localhost:5173`, proxy `/api` sang Gateway.
- Điện thoại thật: nhóm Mobile cấu hình `EXPO_PUBLIC_API_BASE_URL=http://<IPv4 máy Backend>:8000`, cùng mạng và truy cập được cổng 8000.
- Android emulator có thể dùng `http://10.0.2.2:8000`.
- `PUBLIC_API_BASE_URL` quyết định URL bổ sung trong JSON. Để trống thì URL dạng `/api/v1/...`, ghép với Gateway base URL. Mobile hiện dựng URL từ ID nên vẫn tương thích.
- Web/Mobile không kết nối trực tiếp SQL Server.

## Endpoint Mobile giữ nguyên

| Method / endpoint | Query/header | Response |
| --- | --- | --- |
| GET `/api/v1/languages` | `activeOnly=true` | Ngôn ngữ hoạt động |
| GET `/api/v1/public/pois` | `lang=vi&page=1&pageSize=100&name=...&search=...&category=...` | `{items,page,pageSize,total}` |
| GET `/api/v1/public/pois/{id}` | `lang=vi` | Chi tiết, tọa độ, bán kính, ảnh/audio đã duyệt |
| GET `/api/v1/public/tours` | `lang=vi&name=...` | Mảng Tour đã duyệt |
| GET `/api/v1/public/tours/{id}` | `lang=vi` | Chi tiết, `pois` theo `orderIndex` bắt đầu 0; chỉ POI đủ điều kiện public |
| GET `/api/v1/qr/resolve/{code}` | code encode | `targetType,targetId,requiresPayment`; không resolve đích chưa public |
| POST `/api/v1/public/access/start-target` | `{targetType,targetId}` | Guest token theo đích miễn phí; có phí trả `RequiresQr` |
| POST `/api/v1/public/access/start` | `{qrCode}` | Luồng quyền nghe QR cũ; không cấp cho đích chưa public |
| GET `/api/v1/public/access/validate` | `X-Guest-Access-Token` | Trạng thái, thời gian còn lại |
| GET `/api/v1/public/audio-tour/pois/{id}` | `languageCode=vi&triggerType=qr`, guest token | Chi tiết có quyền nghe; giữ hành vi activation cũ |
| GET `/api/v1/public/audio-tour/tours/{id}` | `languageCode=vi`, guest token theo Tour | Chi tiết Tour có quyền nghe |
| GET `/api/v1/public/audio/{id}` | `X-Guest-Access-Token` | Binary audio đúng scope, AudioTrack và file media liên quan đã duyệt |
| GET `/api/v1/public/media/images/{id}` | Không Bearer | Binary ảnh đã duyệt, POI đang public |
| GET `/api/v1/public/routes/tours/{id}` | `mode=walking/driving` | Giữ thứ tự; cần cấu hình provider |
| POST `/api/v1/public/routes/directions` | `{points,mode}` | Giữ API route cũ; không chuyển GPS/geofencing sang Web |

Envelope thành công: `{ "success": true, "message": "Success", "data": ... }`. Lỗi chính sách HTTP 401/403/404/409/422 có `{ "detail": "..." }` theo FastAPI. Không cấp audio chỉ vì biết ID. Preview CMS không ghi lượt nghe khách.

Bản dịch yêu cầu được ưu tiên, fallback bản `vi` đã duyệt rồi nội dung POI gốc đã duyệt. `languageCode` trên POI/Tour là ngôn ngữ được yêu cầu, không chứng minh có bản dịch ngôn ngữ đó. Audio lọc ngôn ngữ chính xác. File có `audioType=prerecorded`; input Web cũ `file` vẫn được chuẩn hóa. TTS text có `ttsText`, `isAvailable=false` khi chưa có file. Mobile demo hiện phát file qua ID, cần upload file TTS thật để phát trên Mobile. Chưa cấu hình sinh file TTS tự động; API không trả đường dẫn mô phỏng.

Ví dụ JSON minh họa (ID ví dụ, không phải seed thật): [POI list](examples/pois.json), [POI detail](examples/poi-detail.json), [Tour list](examples/tours.json), [Tour detail](examples/tour-detail.json).

## Phân quyền và version

- Admin/SuperAdmin quản lý toàn hệ thống, Users/Roles, duyệt/từ chối và cấp/thu hồi scope.
- Vendor, ContentAdmin, TourOperator chỉ sửa POI/Tour thuộc `UserId` của mình hoặc `EntityGrants`. Không tự duyệt. Admin cấp scope cho Tour cũ không có chủ sở hữu.
- Media/Audio/Narration/bản dịch POI kế thừa POI; bản dịch Tour kế thừa Tour. Thay điểm dừng cần quyền Tour và từng POI. Nếu Tour chứa POI ngoài scope thì Admin cấp đủ quyền trước khi sửa danh sách.
- List/search/count/pagination lọc scope trong SQL. Ngoài scope trả 404. Chủ sạp không được đổi owner, Version, trạng thái duyệt/công khai qua payload, không gọi Users/Roles.
- Auth/Content kiểm tra tài khoản active/vai trò hiện tại trong DB cho mỗi Bearer request. Vô hiệu hóa/đổi vai trò áp dụng với token cũ. AnalyticsViewer chỉ đọc; analytics/log của Vendor chỉ thuộc POI trong scope, không trả thiết bị toàn hệ thống.
- POST/PUT/upload tạo Pending, cả Admin tạo mới cũng vào queue. Create canonical mới Pending và không public. Sửa bản Approved lưu đề xuất vào `ContentSubmissions`, giữ canonical và bytes cũ.
- CMS hiển thị đề xuất, `SubmissionStatus`, `SubmissionId`, `RejectionReason`; Mobile chỉ đọc canonical đã duyệt. Admin approve dùng transaction, row locks, `BaseVersion`, lưu snapshot vào `ContentVersions`, cập nhật canonical/Version và submission cùng transaction.
- Đề xuất bị thay thế/đã duyệt/từ chối không duyệt lại (409). Reject cần lý do 1–1000 ký tự; bản public cũ tiếp tục được giữ. Chủ sạp sửa/lưu hoặc resubmit tạo Pending mới.
- Upload luôn Pending. Duyệt media audio trước rồi AudioTrack; file phải tồn tại trong MEDIA_ROOT và cùng POI. Thay file giữ media ID và bytes cũ đến lúc duyệt; khi thay media audio cần cập nhật AudioTrack đến file mới. Media bị duyệt xóa thì AudioTrack liên quan bị ẩn/chặn stream.
- Duyệt NarrationDraft xuất bản text vào POITranslation theo ngôn ngữ, có version/snapshot và liên kết phiên bản đã xuất bản; duyệt xóa thuyết minh sẽ gỡ bản dịch do nó xuất bản nếu chưa bị phiên bản khác thay thế. Chưa tự sinh file TTS.
- Yêu cầu xóa cũng vào queue. Admin duyệt xóa mới thay đổi bản public. Phục hồi do Admin thực hiện và đưa lại Pending.

## API CMS bổ sung

Tất cả dùng `Authorization: Bearer <token đăng nhập>`.

| Endpoint | Quyền/mục đích |
| --- | --- |
| GET `/api/v1/cms/submissions?status=Pending&page=1&pageSize=50` | Admin toàn queue; Chủ sạp trong scope |
| GET `/api/v1/cms/submissions/{id}` | Đề xuất trong scope |
| GET `/api/v1/cms/submissions/{id}/preview` | Stream đề xuất có xác thực |
| POST `/api/v1/cms/submissions/{id}/approve` | Admin/SuperAdmin |
| POST `/api/v1/cms/submissions/{id}/reject` | Admin/SuperAdmin, body `{reason}` |
| POST `/api/v1/cms/{resource}/{id}/resubmit` | Gửi lại Rejected trong scope; Pending trả 409 |
| POST `/api/v1/media/{id}/replacement` | Multipart `file`, tạo version chờ duyệt |
| GET `/api/v1/cms/grants/{resource}/{id}` | Admin; resource `pois`/`tours` |
| PUT/DELETE `/api/v1/cms/grants/{resource}/{id}/{userId}` | Admin cấp/thu hồi scope |
| PUT `/api/v1/narrations/{id}/content` | Chỉnh thuyết minh, tạo đề xuất |

CRUD và các API duyệt cũ giữ đường dẫn, bổ sung scope/submission. Duyệt cũ `/media/{id}/approve`, `/pois/{id}/approve-review` chỉ Admin. QR là cấu hình quyền nghe trong scope, không bỏ qua điều kiện public. Sync cũ chứa dữ liệu nội bộ, giữ endpoint nhưng chỉ Admin; Mobile demo hiện không dùng sync đó.

## Chạy và kiểm thử

Từ root, dùng `python` thông thường hoặc `.tooling/python/python.exe` portable:

```powershell
python scripts/prepare_database.py
# Chỉ import trên DB mới; từ chối ghi đè:
sqlcmd -S localhost -E -C -b -f 65001 -i .tooling/import-audiotour.sql
sqlcmd -S localhost -E -C -b -d VinhHyAudioTourDB -i infra/sql/001_scope_and_review.sql
sqlcmd -S localhost -E -C -b -d VinhHyAudioTourDB -i infra/sql/002_narration_publication.sql
python scripts/check_database.py
# Ba terminal:
python scripts/serve.py auth
python scripts/serve.py content
python scripts/serve.py gateway
python scripts/check_mobile_api.py
npm --prefix apps/web run build
npm --prefix apps/web run lint
npm --prefix apps/web test
$env:WEB_BROWSER_CHANNEL='msedge'
$env:AUDIOTOUR_LIVE='1'
npm --prefix apps/web run test:e2e
python scripts/test_auth.py
$env:AUDIOTOUR_SQL_TESTS='1'
python scripts/test_content.py
python -m ruff check --select E9,F services/content-service services/auth-service gateway scripts
```

SQL tests dùng transaction rollback, tài khoản active seed 1/12/13, không cần mật khẩu và không đổi mật khẩu. File thử được dọn sau test. Kiểm tra owner isolation, grants/revoke, account disabled, reject/resubmit, order, translation publication, image replacement, binary stream và guest access. Không bật SQL hoặc chưa có SQL Server: SQL suite được skip; unit còn lại vẫn chạy. E2E mặc định mock API, `AUDIOTOUR_LIVE=1` kiểm tra Gateway thật.
