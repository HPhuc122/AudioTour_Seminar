# AudioTour: duyệt thuyết minh một lần → dịch và TTS

Cập nhật 26/10/2026. Không thay đổi module mobile. Contract này thay cho luồng automation cũ tạo các đề xuất Pending riêng cho bản dịch/audio.

Xem [hướng dẫn Azure Translator + Speech](../guides/azure-narration-adapter.md) và [cách chạy thử trên điện thoại](../guides/real-translation-tts.md). Adapter Azure đã có code trong narration-service nhưng chưa cấu hình khóa, chưa bật hoặc gọi Azure thật.

## Luồng và dữ liệu

1. Vendor tạo `POST /api/v1/narrations` hoặc sửa `PUT /api/v1/narrations/{id}/content`. Payload gồm `PoiId`, `Title`, `LanguageCode`, `TextContent`. Lưu là gửi duyệt; Backend kiểm tra scope POI.
2. Admin gọi `POST /api/v1/cms/submissions/{submissionId}/approve`. Trong **cùng transaction**, Backend lưu canonical Approved, ghi đầu phiên bản mới nhất ở `NarrationHeads` và chèn `NarrationJobs` cho từng ngôn ngữ đang bật. Không mất tác vụ nếu process dừng sau khi duyệt. Không tự xử lý nội dung Pending hoặc từ các proposal đang chỉnh sửa.
3. Worker của Content service nhận tác vụ có lease 10 phút. Snapshot DB chứa đúng văn bản/giọng/ngôn ngữ của phiên bản đã duyệt. Ngôn ngữ gốc dùng văn bản gốc; ngôn ngữ khác gọi adapter dịch. TTS nhận đúng văn bản của ngôn ngữ đích, không dùng giọng tiếng Việt cho bản dịch ngoại ngữ.
4. File được ghi `.part` rồi rename trong MEDIA_ROOT. Trong transaction công bố, kiểm tra lại source version, lần duyệt mới nhất của POI, ngôn ngữ còn bật, lease token/chưa hết hạn và file tồn tại. Cập nhật bản dịch, tạo MediaFiles/AudioTracks Approved và `NarrationPublications` cùng nhau. Các bản tự sinh kế thừa `SubmissionId` và `ReviewerId`, có audit Published, **không tạo hồ sơ duyệt thủ công mới**.
5. Bản công bố cũ của từng ngôn ngữ vẫn được phục vụ khi phiên bản mới chờ/chạy/thất bại. Khi ngôn ngữ đó hoàn tất mới đổi cặp text/audio. Ngôn ngữ khác có thể hoàn tất ở thời điểm khác.

`NarrationJobs.Status`: `Queued`, `Processing`, `Succeeded`, `Failed`, `Superseded`. Tác vụ gồm `Attempts`, `TotalAttempts`, `MaxAttempts=3`, `RetryCount`, `ErrorCode`, `ErrorMessage`, `AvailableAt`, `LeaseUntil`. Lỗi retryable được thử tối đa 3 lần mỗi chu kỳ; chờ tối thiểu backoff 5 rồi 10 giây và không ngắn hơn Retry-After. Lỗi xác thực/cấu hình và ProviderResultUnknown từ Azure adapter không tự retry. Admin có thể yêu cầu chu kỳ retry mới; `TotalAttempts` không reset. Trạng thái uncertain ở adapter vẫn chặn gọi lại cùng key cho tới khi được đối chiếu, không bị nút Admin retry bỏ qua.

Worker quét lease hết hạn khi service khởi động và trong mỗi vòng chạy. Tác vụ đang chạy ở process khác không bị cướp trước hạn; process bị dừng có thể cần chờ tối đa 10 phút để lease hết. Tác vụ hết số lần thử chuyển Failed. Token cũ không được công bố hoặc ghi đè kết quả của worker mới. Tác vụ từ phiên bản hoặc thuyết minh khác đã bị lần duyệt mới thay thế không được retry/công bố.

Unique `(NarrationId, SourceVersion, LanguageCode)` và `AudioTracks.AutomationJobId` chống kết quả trùng trong DB. Adapter nhận `Idempotency-Key: narration-{id}-v{version}-{language}` và **cần tôn trọng key này** để tránh tính phí lại nếu request ngoài đã thành công nhưng worker chưa nhận được response. Không thể cam kết exactly-once billing với dịch vụ ngoài không hỗ trợ idempotency.

Upload thủ công vẫn có trên Admin/Vendor và dùng quy trình duyệt cũ. Index tiếp tục giới hạn một audio thủ công đang active cho POI/ngôn ngữ, tách riêng audio tự sinh bằng AutomationJobId. Khi có bản tự sinh hoàn chỉnh, API ưu tiên cặp text/audio này; file upload thủ công không bị tự duyệt, xóa hay sửa. Xóa thuyết minh qua duyệt là xóa mềm, giữ lịch sử; chỉ gỡ publication do chính thuyết minh đó tạo.

## Migration và cấu hình

Từ root, dùng môi trường Python đã có dependencies:

```powershell
.tooling/python/python.exe scripts/migrate_narration_jobs.py
```

Migration `services/content-service/migrations/004_narration_jobs.sql` có thể chạy lại: tạo NarrationHeads/Jobs/Publications; thêm IsDeleted cho NarrationDrafts và AutomationJobId cho AudioTracks; điều chỉnh filtered index để giữ audio thủ công. Không duyệt, sửa hoặc enqueue dữ liệu cũ. Sao lưu DB theo quy trình triển khai của nhóm trước khi áp dụng trên máy khác.

Điền trong `.env` root hoặc môi trường process, **không commit khóa**:

```dotenv
ADMIN_TRANSLATION_URL=https://your-existing-adapter/translate
ADMIN_TTS_URL=https://your-existing-adapter/tts
ADMIN_PROVIDER_TOKEN=
ADMIN_PROVIDER_TOKEN_REQUIRED=true
ADMIN_AUTOMATION_ENABLED=false
PUBLIC_API_BASE_URL=http://YOUR_LAN_IP:8000
MEDIA_ROOT=C:/absolute/path/to/services/content-service
```

- Hai URL là endpoint **adapter theo contract bên dưới**, không mặc định tương thích trực tiếp với mọi API nhà cung cấp.
- Nếu adapter yêu cầu Bearer token, điền ADMIN_PROVIDER_TOKEN và giữ ADMIN_PROVIDER_TOKEN_REQUIRED=true. Nếu adapter nội bộ đã có cơ chế khác và không dùng token, đặt REQUIRED=false. Không trả URL/token provider ra API trạng thái hoặc log lỗi.
- Chỉ đặt ADMIN_AUTOMATION_ENABLED=true sau khi đã cấu hình và được chủ dự án chấp thuận sử dụng dịch vụ. Bật cờ sẽ xử lý các job Queued và có thể phát sinh phí. Đợt triển khai này **không bật cờ, không đăng ký dịch vụ, không gọi provider ngoài**.
- Khi cờ false, duyệt vẫn ghi Queued bền vững; trạng thái trả missingConfiguration, worker không gọi provider. Khi đã bật mà thiếu URL/token, job chuyển Failed với MissingConfiguration, không giả thành công. Sau khi bổ sung cấu hình, restart service và Admin retry job Failed.
- MEDIA_ROOT phải tồn tại/ghi được; điện thoại phải truy cập được PUBLIC_API_BASE_URL. Không dùng localhost làm địa chỉ API cho điện thoại thật. Các worker của cùng DB cần dùng chung MEDIA_ROOT; không chạy nhiều máy với thư mục media tách rời.

Khởi động lại Content service sau đổi biến môi trường:

```powershell
.tooling/python/python.exe scripts/serve.py content
```

Không bật automation chỉ để thử khi chưa cho phép chi phí. Có thể xác nhận đường đi bằng bộ test rollback/HTTP mock bên dưới.

## HTTP adapter

Hai adapter nhận `Authorization: Bearer ...` nếu cấu hình token, và Idempotency-Key ổn định theo phiên bản/ngôn ngữ.

`POST ADMIN_TRANSLATION_URL`, JSON:

```json
{"text":"Văn bản gốc đã duyệt","name":"Tên POI","sourceLanguage":"vi","targetLanguage":"en"}
```

Trả 200 JSON `{"text":"Translated narration","name":"Translated POI name"}`. Name tối đa 200 đơn vị UTF-16, cả hai không được trống.

`POST ADMIN_TTS_URL`, JSON:

```json
{"text":"Translated narration","languageCode":"en","voice":null}
```

Trả 200 với binary audio, Content-Type audio/mpeg, audio/wav, audio/x-wav hoặc audio/ogg; không trả JSON/base64/URL. Backend giới hạn 50 MB, kiểm tra header MP3/WAV/OGG. Adapter chịu trách nhiệm chất lượng giọng, mã hóa hợp lệ đầy đủ và thời lượng. Giọng nguồn chỉ gửi cho TTS ngôn ngữ gốc.

## API trạng thái Admin/Vendor

`GET /api/v1/cms/automation/status?poiId=23&page=1&pageSize=25`

Header `Authorization: Bearer <session token>`. Vendor chỉ thấy POI được sở hữu/cấp quyền; query POI ngoài scope trả 404. Admin thấy toàn bộ. Response envelope success/data:

```json
{
  "schemaReady":true,
  "automatic":false,
  "translationConfigured":false,
  "ttsConfigured":false,
  "missingConfiguration":["ADMIN_TRANSLATION_URL","ADMIN_TTS_URL","ADMIN_AUTOMATION_ENABLED=true"],
  "jobs":[{"Id":10,"PoiId":23,"NarrationId":5,"SourceVersion":3,"SubmissionId":40,"LanguageCode":"en","Status":"Queued","Attempts":0,"TotalAttempts":0,"MaxAttempts":3,"RetryCount":0,"ErrorCode":null,"ErrorMessage":null,"ready":false}],
  "total":1,"page":1,"pageSize":25
}
```

`ready` chỉ true với publication hiện hành có file tồn tại. Job Succeeded cũ vẫn được giữ để tra cứu nhưng không còn ready sau khi bị thay. Không trả snapshot văn bản, lease token, đường dẫn vật lý hoặc khóa provider.

`POST /api/v1/cms/automation/jobs/{id}/retry` (body `{}`): chỉ Admin/SuperAdmin. Chỉ retry job Failed thuộc source/head hiện hành; job đang chạy, thành công hoặc lỗi thời trả 409.

`POST /api/v1/cms/automation/narrations/{id}` (body `{}`): Admin đưa các ngôn ngữ đang bật còn thiếu vào queue cho canonical đã có bằng chứng duyệt; không tạo trùng, không reset Failed. Dùng sau khi bật thêm ngôn ngữ. Source cũ đã bị thuyết minh khác thay thế trả 409. Nguồn `pois` và `poi-translations` không còn là điểm vào tự động; dùng thuyết minh được duyệt.

Giao diện: Admin `/admin/automation`; Vendor mở POI → tab Thuyết minh. Bảng tự làm mới mỗi 10 giây, có trạng thái theo ngôn ngữ; Admin có nút Chạy lại phần thất bại.

## Hợp đồng API mobile và kiểm tra điện thoại

Giữ các endpoint hiện có:

- `GET /api/v1/public/pois/{id}?lang=en`: đọc catalog không yêu cầu token nghe; POI vẫn phải thỏa điều kiện public, đang hoạt động, trong thời hạn.
- `GET /api/v1/public/audio-tour/pois/{id}?languageCode=en`: giữ `X-Guest-Access-Token` hợp lệ theo POI/tour. Có thể ghi play log theo hành vi cũ.
- `GET /api/v1/public/audio/{audioTrackId}`: gửi cùng guest token. Hỗ trợ tải bytes bằng endpoint cũ, không trả trực tiếp đường dẫn trên đĩa.

Khi đã có publication, API trả description/name và audioTracks từ **cùng job đã hoàn tất**. Bổ sung `narration`:

```json
{
  "languageCode":"en",
  "name":"Translated POI name",
  "description":"Translated narration",
  "narration":{
    "languageCode":"en","ready":true,"publishedVersion":3,"publishedNarrationId":5,
    "availabilityError":null,
    "latest":{"jobId":15,"sourceVersion":4,"narrationId":5,"status":"Processing","attempts":1,"errorCode":null}
  },
  "audioTracks":[{"id":20,"languageCode":"en","audioType":"prerecorded","isAvailable":true,"mimeType":"audio/mpeg","streamUrl":"http://YOUR_LAN_IP:8000/api/v1/public/audio/20"}]
}
```

Trong ví dụ, version 3 vẫn phát được trong khi version 4 đang xử lý. Không coi `latest.status` là phiên bản đang phát; dùng publishedVersion. Nếu chưa có publication, ready=false; các trường legacy có thể còn nội dung công khai/fallback cũ. Không coi fallback là bản dịch tự động đã hoàn tất. Nếu file publication bị mất, audioTracks không chứa URL đó, ready=false, availabilityError=AudioFileMissing. File ảnh/thumbnail thiếu cũng không được cấp URL mới.

Trên điện thoại thật:

1. Cùng mạng với máy Gateway, cấu hình IP LAN trong PUBLIC_API_BASE_URL, cho phép truy cập cổng 8000 theo môi trường chạy của nhóm.
2. Vendor nhập văn bản gốc; Admin duyệt POI nếu POI mới, rồi duyệt thuyết minh một lần. Bật các ngôn ngữ cần dùng trước khi duyệt.
3. Sau khi đã được cho phép dùng adapter thật và bật automation, theo dõi status từng ngôn ngữ cho tới Succeeded/ready=true. Khi lỗi, xem ErrorCode/Message; sửa cấu hình rồi Admin retry. Không tự thay trạng thái trong DB.
4. Lấy guest access token bằng flow QR/quyền nghe hiện có. Không dùng JWT Admin/Vendor thay cho guest token và không cần tạo giao dịch thanh toán giả.
5. Gọi audio-tour với ngôn ngữ đích và guest token; mở streamUrl bằng player mobile, truyền guest token trong header. Kiểm tra nghe đúng ngôn ngữ, âm thanh không đứt, phát/tạm dừng/tua và HTTP range nếu player dùng. Đợt này chưa kiểm tra chất lượng giọng hoặc phát trực tiếp trên điện thoại.
6. Sửa thuyết minh, duyệt version mới. Trong khi Processing/Failed, xác nhận điện thoại vẫn nhận cặp version cũ. Chỉ chuyển khi target language hoàn tất. Token không hợp lệ phải bị từ chối.

## Đã xác minh và còn chặn

- Migration đã chạy thật trên SQL Server máy hiện tại; không enqueue/duyệt dữ liệu nghiệp vụ cũ.
- DB và lưu/đọc file thật được dùng trong 9 kiểm tra mới, mỗi test transaction rollback và dọn bytes thử; provider là fixture minh bạch chỉ trong test. Hai kiểm tra adapter dùng httpx.MockTransport. Các kiểm tra gồm version snapshot, dedup, từng ngôn ngữ, giữ cặp cũ, fence lease/version/khác draft, retry, phục hồi hết lease, scope, thiếu config, thiếu file, guest stream, coexist upload và xóa mềm giữ lịch sử.
- Năm hồi quy Vendor/Admin/upload đạt. Hai kiểm tra endpoint automation kế thừa được cập nhật và đạt. TypeScript chỉ kiểm tra diagnostics bốn file UI liên quan; không chạy E2E hoặc test/lint/build toàn dự án.
- Provider thật **chưa cấu hình**, automation vẫn false. Chưa xác nhận giọng đọc, dịch thực tế hoặc nghe trên điện thoại. Không có khóa nào được ghi vào repository. Các test thành công không chứng minh provider thật đã chạy.
- 46 file media gốc thiếu theo kiểm kê trước vẫn là dữ liệu cần khôi phục, không được thay bằng file giả.
- Khi process chết đúng lúc đã ghi bytes nhưng DB chưa commit có thể còn file UUID không được tham chiếu. File đó không được API công khai. Không tự xóa file gốc theo tuổi; cần kiểm kê/đối chiếu DB trước khi dọn. Các tác vụ HTTP có thể bị adapter tính lại phí nếu adapter không hỗ trợ idempotency.

Chạy lại đúng các kiểm tra liên quan (không dùng dịch vụ ngoài):

```powershell
$env:AUDIOTOUR_SQL_TESTS='1'
.tooling/python/python.exe scripts/test_narration_jobs.py
.tooling/python/python.exe scripts/test_vendor_review.py
```

Không commit/push trong đợt hoàn thiện này.
