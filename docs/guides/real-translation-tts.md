# Cấu hình dịch/TTS thật và chạy thử AudioTour

Kiểm tra ngày 26/10/2026. Hướng dẫn dựa trên adapter và cấu hình thực tế trong code, không giả định đã có dịch vụ ngoài.

**Cập nhật:** đã bổ sung adapter Azure Translator + Speech trong narration-service. Xem [cấu hình Azure, idempotency và các kiểm tra đã chạy](azure-narration-adapter.md). Tài khoản/khóa Azure chưa được cấu hình hay gọi thật; giữ automation tắt.

## Kết quả kiểm tra hiện tại

| Hạng mục | Đã xác nhận |
| --- | --- |
| Adapter Backend | `NarrationProvider` trong `services/content-service/app/services/narration_provider.py`, gọi HTTP bằng httpx |
| Nhà cung cấp đã có code adapter | Azure Translator REST + Azure Speech REST trong narration-service; chưa gọi Azure thật |
| URL dịch | Chưa cấu hình `ADMIN_TRANSLATION_URL` |
| URL TTS | Chưa cấu hình `ADMIN_TTS_URL` |
| Token adapter | Chưa có `ADMIN_PROVIDER_TOKEN`; code hiện mặc định không bắt buộc token nếu chưa đặt REQUIRED |
| Tự động | `ADMIN_AUTOMATION_ENABLED=false` |
| Địa chỉ audio cho điện thoại | Chưa cấu hình `PUBLIC_API_BASE_URL` trong môi trường hiện tại |
| Ngôn ngữ bật | API Gateway thật trả 200, gồm `vi`, `en`, `zh`, `ko`, `ja`, `fr` |
| Dịch/TTS thật | **Chưa chạy** vì thiếu cấu hình; không gọi ra dịch vụ ngoài, không phát sinh phí |
| Phát trên điện thoại | **Chưa xác nhận** |

Không gán trực tiếp URL Azure vào ADMIN_TRANSLATION_URL/ADMIN_TTS_URL. Hai biến trỏ tới `/translate` và `/tts` của narration-service; Azure endpoint/key được cấu hình riêng trong adapter. Chủ dự án đã chọn Azure; đợt này không đăng ký tài khoản, tạo khóa hoặc gọi dịch vụ trả phí.

## Biến môi trường chính xác

Mẫu đã được bổ sung vào `.env.example` tại root. **Nếu đã có `.env`, chỉ ghép các biến cần thiết, không ghi đè toàn bộ file**, vì `.env` chứa cấu hình DB/JWT hiện có. Không dán token thật vào `.env.example`, tài liệu, ảnh chụp hay log.

| Biến | Cách điền |
| --- | --- |
| `ADMIN_TRANSLATION_URL` | URL endpoint adapter nhận JSON dịch; để trống cho tới khi có adapter tương thích |
| `ADMIN_TTS_URL` | URL endpoint adapter trả binary audio; để trống cho tới khi có adapter tương thích |
| `ADMIN_PROVIDER_TOKEN` | Token Bearer của adapter nếu adapter yêu cầu xác thực; không phải mặc định khóa API của bất kỳ nhà cung cấp cụ thể nào |
| `ADMIN_PROVIDER_TOKEN_REQUIRED` | Đặt `true` khi dùng token. Chỉ dùng `false` nếu adapter được triển khai có chủ ý không yêu cầu Bearer token; không dùng để bỏ qua lỗi xác thực |
| `ADMIN_AUTOMATION_ENABLED` | Giữ `false` trong lúc điền và kiểm tra cấu hình. Đặt `true` chỉ sau khi được phép gọi adapter và đã rõ chi phí |
| `PUBLIC_API_BASE_URL` | Địa chỉ Gateway điện thoại truy cập được, ví dụ `http://192.168.1.100:8000` với IP thực tế của máy; không dùng `localhost`, `127.0.0.1` hoặc `0.0.0.0` làm URL trên điện thoại |
| `MEDIA_ROOT` | Thư mục tuyệt đối chứa `uploads/audio` và `uploads/images`, process Content có quyền ghi/đọc |

Các biến nền hiện có vẫn cần đúng: `SQLSERVER_HOST`, `SQLSERVER_PORT`, `SQLSERVER_DATABASE`, `SQLSERVER_USE_WINDOWS_AUTH`; nếu dùng SQL authentication thêm `SQLSERVER_USER`/`SQLSERVER_PASSWORD`. `JWT_SECRET` phải thống nhất Auth/Content. Gateway dùng `AUTH_SERVICE_URL` và `CONTENT_SERVICE_URL`. Không thay các giá trị đang hoạt động chỉ để bổ sung dịch/TTS.

Ví dụ khung an toàn, chưa bật gọi dịch vụ:

```dotenv
# Điền URL adapter tương thích của bạn; không có endpoint mặc định.
ADMIN_TRANSLATION_URL=
ADMIN_TTS_URL=
ADMIN_PROVIDER_TOKEN=
ADMIN_PROVIDER_TOKEN_REQUIRED=true
ADMIN_AUTOMATION_ENABLED=false
PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8000
MEDIA_ROOT=C:/xampp/htdocs/AudioTour_Seminar/services/content-service
```

Code chỉ kiểm tra sự hiện diện của cấu hình trước khi chạy; URL/token có giá trị không chứng minh adapter đúng hợp đồng, khóa có quyền hay còn hạn mức. Cần kiểm tra thực tế sau khi có cấu hình và được phép sử dụng. Thông báo MissingConfiguration liệt kê tên biến, không trả giá trị khóa.

## Ngôn ngữ và định dạng

| Mã đang bật trong DB | Ngôn ngữ |
| --- | --- |
| `vi` | Tiếng Việt |
| `en` | Tiếng Anh |
| `zh` | Tiếng Trung |
| `ko` | Tiếng Hàn |
| `ja` | Tiếng Nhật |
| `fr` | Tiếng Pháp |

Đây là danh sách hệ thống đang yêu cầu, **chưa phải danh sách ngôn ngữ một nhà cung cấp thật đã được xác nhận hỗ trợ**. Worker lấy `Languages.IsActive=1` khi tạo tác vụ. Adapter phải nhận các mã này và tự ánh xạ nếu nhà cung cấp dùng mã locale khác. Ngôn ngữ gốc không gọi dịch, nhưng vẫn tạo TTS; ngôn ngữ khác dịch trước rồi TTS văn bản đã dịch. Voice của bản gốc chỉ gửi cho chính ngôn ngữ gốc; các ngôn ngữ khác gửi `voice:null` để adapter chọn giọng phù hợp.

Audio tự sinh nhận:

| Phần mở rộng | Content-Type được chấp nhận |
| --- | --- |
| `.mp3` | `audio/mpeg` |
| `.wav` | `audio/wav`, `audio/x-wav` |
| `.ogg` | `audio/ogg` |

Tối đa 50 MiB mỗi response; kiểm tra header nhận dạng audio. Không nhận JSON, base64 hoặc URL tải về thay cho bytes. Các định dạng upload thủ công có thể rộng hơn; không đồng nghĩa TTS adapter hỗ trợ AAC/M4A/FLAC. Backend không tự chuyển mã và chưa xác nhận codec thực tế trên điện thoại.

## Hợp đồng adapter cần triển khai

Hai request gửi `Authorization: Bearer <token>` khi có token. Header `Idempotency-Key` ổn định theo ID thuyết minh, phiên bản, ngôn ngữ; adapter cần tôn trọng để hạn chế gọi/tính phí trùng khi retry.

`POST ADMIN_TRANSLATION_URL`, request:

```json
{"text":"Chào mừng quý khách đến Vĩnh Hy. Chúc quý khách có chuyến tham quan vui vẻ.","name":"Điểm tham quan thử","sourceLanguage":"vi","targetLanguage":"en"}
```

Response 200 phải có `text` và `name` là chuỗi không rỗng; name tối đa 200 đơn vị UTF-16. Đây là quy định dữ liệu, không phải kết quả dịch thật đã thu được.

`POST ADMIN_TTS_URL`, request:

```json
{"text":"<văn bản đúng ngôn ngữ đích>","languageCode":"en","voice":null}
```

Response 200 là bytes audio với một Content-Type trong bảng trên. Không trả token, thông tin thanh toán hay response body lỗi provider vào log. Lỗi HTTP được hệ thống báo bằng mã trạng thái đã lược bỏ nội dung nhạy cảm.

## Chạy thử Vendor → Admin → API mobile

Chỉ thực hiện bước bật xử lý thật khi đã có adapter hợp lệ và được phép sử dụng dịch vụ. **Với cấu hình hiện tại, dừng ở bước cấu hình; không có kết quả dịch/audio thật để báo thành công.**

1. Kiểm tra migration `004_narration_jobs.sql` đã được áp dụng. Máy hiện tại đã áp dụng; máy khác chạy từ root:

   ```powershell
   .tooling/python/python.exe scripts/migrate_narration_jobs.py
   ```

2. Điền `.env` như trên, giữ automation=false. Mở mỗi service trong terminal riêng tại root:

   ```powershell
   .tooling/python/python.exe scripts/serve.py auth
   .tooling/python/python.exe scripts/serve.py content
   .tooling/python/python.exe scripts/serve.py narration
   .tooling/python/python.exe scripts/serve.py gateway
   ```

   Web chạy ở terminal khác:

   ```powershell
   cd apps/web
   npm.cmd run dev
   ```

3. Vendor đăng nhập tài khoản thật, không chọn xem thử. Tạo **POI mới**, nhập tên/toạ độ hợp lệ và bật hoạt động. Mở POI → Thuyết minh → Thêm thuyết minh, ngôn ngữ gốc `vi`. Có thể dùng đoạn ngắn: “Chào mừng quý khách đến Vĩnh Hy. Chúc quý khách có chuyến tham quan vui vẻ.” Lưu sẽ gửi duyệt.
4. Dùng cửa sổ riêng tư đăng nhập Admin. Tại `/admin/review`, duyệt POI mới rồi duyệt thuyết minh một lần. Nếu từ chối phải nhập lý do; Vendor đọc được lý do và sửa/gửi lại. Không duyệt thêm từng bản dịch/file tự sinh.
5. Xem `/admin/automation` hoặc POI của Vendor → Thuyết minh. Với cờ false, các tác vụ ở Queued và giao diện nêu cấu hình thiếu; đây **không phải lỗi đã được dịch thành công**.
6. Trước khi cho phép chi phí, kiểm tra hàng đợi: bật cờ sẽ xử lý **mọi tác vụ Queued**, không chỉ đoạn thử. Với sáu ngôn ngữ hiện tại, một phiên bản gốc `vi` có thể cần 5 request dịch và 6 request TTS, chưa tính retry. Không tự bật/tắt ngôn ngữ hay sửa tác vụ nghiệp vụ để né giới hạn này.
7. Sau khi đã cấu hình Azure và được phép sử dụng: đặt `NARRATION_AZURE_ENABLED=true` và `ADMIN_AUTOMATION_ENABLED=true`, restart Narration và Content. Theo dõi từng ngôn ngữ tới Succeeded/ready=true. Nếu Failed, đọc ErrorCode/ErrorMessage; sửa cấu hình rồi Admin bấm Chạy lại phần thất bại. Riêng ProviderResultUnknown cần đối chiếu theo hướng dẫn Azure, không đổi key/reset DB để ép gọi lại. Queued không cần retry thủ công. Không đổi trạng thái DB bằng tay.
8. Lấy nội dung qua Gateway:

   ```http
   GET http://YOUR_LAN_IP:8000/api/v1/public/pois/{poiId}?lang=en
   ```

   Khi hoàn tất, `narration.ready=true`, có `publishedVersion`, `description` là bản dịch cùng phiên bản với audio; `audioTracks[].streamUrl` là URL Gateway. `latest.status` mô tả tác vụ mới nhất, có thể đang Processing trong khi publishedVersion cũ vẫn phát được.
9. Để nghe, dùng QR/quyền truy cập POI hiện có để lấy guest token. Nếu POI thử chưa có QR, Admin tạo QR trỏ đúng POI theo chính sách quyền nghe hiện hành. Không tạo giao dịch thanh toán giả. Với POI thử miễn phí được phép, cấu hình QR không yêu cầu thanh toán rồi gọi:

   ```http
   POST http://YOUR_LAN_IP:8000/api/v1/public/access/start-target
   Content-Type: application/json

   {"targetType":"poi","targetId":123}
   ```

   Dùng `data.accessToken` nếu flow trả trạng thái Active; không công khai/ghi token vào tài liệu.
10. Gọi API mobile và tải audio bằng cùng token:

    ```http
    GET http://YOUR_LAN_IP:8000/api/v1/public/audio-tour/pois/123?languageCode=en
    X-Guest-Access-Token: <guest-token>

    GET <audioTracks[0].streamUrl>
    X-Guest-Access-Token: <guest-token>
    ```

    JWT Admin/Vendor không thay thế guest token. File thiếu phải không có URL sẵn sàng; không tạo file giả để vượt kiểm tra.
11. Vendor sửa văn bản và gửi duyệt, Admin duyệt phiên bản mới. Trong khi chạy/lỗi, kiểm tra API vẫn giữ cặp công khai cũ; sau khi từng ngôn ngữ hoàn tất mới đổi cặp. Không dùng kết quả API này để kết luận đã nghe được trên thiết bị.

## Kiểm tra URL và phát trên điện thoại

- Máy Gateway và điện thoại cùng mạng có thể kết nối; lấy IPv4 LAN của đúng adapter Wi-Fi/Ethernet bằng `ipconfig`. Ví dụ `192.168.1.100` chỉ là mẫu, phải thay bằng IP máy thực tế.
- Gateway chạy bind `0.0.0.0:8000`, nhưng URL truy cập là `http://<IP-LAN>:8000`, không phải `http://0.0.0.0:8000`. `http://localhost:8000` trên điện thoại trỏ về điện thoại, không trỏ máy tính.
- Từ trình duyệt điện thoại mở `http://<IP-LAN>:8000/health`. Nếu chưa truy cập được, kiểm tra mạng guest/AP isolation, VPN và quyền cổng 8000 trong firewall theo cấu hình của nhóm; không tắt toàn bộ firewall.
- Sau khi đổi PUBLIC_API_BASE_URL, restart Content và lấy API chi tiết lại. Kiểm tra streamUrl chứa IP LAN hoặc hostname thật, không chứa localhost/127.0.0.1/YOUR_LAN_IP. Nếu dùng HTTPS ngoài mạng LAN, dùng hostname/HTTPS của Gateway tương ứng.
- Mở URL audio trong thanh địa chỉ trình duyệt thường **không gửi được X-Guest-Access-Token**; bị từ chối không chứng minh URL hay file hỏng. Dùng player mobile hoặc HTTP client có hỗ trợ header này. Không đưa guest token vào query string để né xác thực.
- Trên player điện thoại, cần xác nhận tiếng đọc đúng ngôn ngữ/văn bản, Content-Type/codec phù hợp, phát/tạm dừng/tua, tải theo range nếu player sử dụng, và hành vi khi token hết hạn. Cấu hình HTTP cleartext nếu ứng dụng yêu cầu do nhóm mobile phụ trách; đợt này không chỉnh mobile.

## Phân biệt mức xác nhận

- **Đã kiểm tra thật trong đợt này:** đọc code adapter và cấu hình mà chỉ hiển thị sự hiện diện của khóa; gọi API ngôn ngữ đang chạy trên Gateway, HTTP 200, xác nhận sáu mã đang bật. `.env.example` đã có đầy đủ biến dịch/TTS và hướng dẫn địa chỉ điện thoại.
- **Đã có từ đợt trước:** các kiểm tra DB/file/stream sử dụng SQL rollback và provider fixture/HTTP mock. Những kết quả này xác minh cơ chế Backend, không xác minh nhà cung cấp thật.
- **Chưa xác nhận:** URL/khóa adapter hợp lệ, dịch thật, TTS thật, chất lượng âm thanh/ngôn ngữ và phát trên điện thoại. Không có đoạn văn nào được gửi tới provider trong đợt này vì thiếu cấu hình. Không đăng ký dịch vụ, không phát sinh chi phí, không sửa `.env`, không commit/push, không chạy E2E hoặc test/lint/build toàn dự án.

Xem thêm [hợp đồng đầy đủ về tác vụ và API](../api-contracts/narration-automation.md).
