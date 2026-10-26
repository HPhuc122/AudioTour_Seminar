# Azure Translator + Speech qua narration-service

Triển khai ngày 26/10/2026. Có code adapter và kiểm tra HTTP mock; **chưa gọi Azure thật, chưa bật automation, chưa phát sinh chi phí**. Không thay đổi `.env` hoặc module mobile.

## Tài liệu chính thức đã đối chiếu

- [Translator Translate v3](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/reference/v3/translate): POST, api-version=3.0, from/to, body mảng Text, response translations.
- [Translator authentication](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/reference/authentication): Ocp-Apim-Subscription-Key; thêm Ocp-Apim-Subscription-Region với resource regional/multi-service. Region có thể trống cho single-service global.
- [Translator language support](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support): vi/en/zh-Hans/ko/ja/fr.
- [Speech REST TTS](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech): POST SSML, resource key, X-Microsoft-OutputFormat, response audio bytes.
- [Speech languages/voices](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support): các locale và giọng trong bảng dưới. Có tên trong tài liệu không chứng minh giọng sẵn sàng trên resource/region cụ thể; cần xác nhận sau khi có khóa.
- [Translator response codes](https://learn.microsoft.com/en-us/azure/ai-services/translator/text-translation/reference/status-response-codes) và [Speech quotas](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-services-quotas-and-limits): cần xử lý 429/quota/capacity, không retry liên tục.

## Thành phần đã triển khai

- `services/narration-service/app/main.py`: `/translate`, `/tts`, `/health`; xác thực token nội bộ, validation và response lỗi đã lược bỏ thông tin nhạy cảm.
- `app/azure.py`: Translator REST và Speech REST, không retry HTTP ẩn; text được escape thành SSML, không nhận SSML do người dùng truyền.
- `app/config.py`: đọc biến môi trường, ánh xạ ngôn ngữ/giọng, endpoint HTTPS, tách các khóa.
- `app/store.py`: SQLite WAL, synchronous FULL, lưu response JSON/audio bytes bền vững và trạng thái idempotency; khóa transaction chống nhận trùng khi nhiều request cùng lúc.
- Content service đọc mã lỗi an toàn của adapter và Retry-After; worker không rút ngắn thời gian chờ provider.
- `scripts/serve.py narration`: chạy adapter tại cổng 8003. Docker dùng volume `narration-adapter-data` để giữ SQLite khi container được tạo lại.

## Ánh xạ mặc định

| AudioTour | Translator | Speech locale | Voice |
| --- | --- | --- | --- |
| vi | vi | vi-VN | vi-VN-HoaiMyNeural |
| en | en | en-US | en-US-AriaNeural |
| zh | zh-Hans | zh-CN | zh-CN-XiaoxiaoNeural |
| ko | ko | ko-KR | ko-KR-SunHiNeural |
| ja | ja | ja-JP | ja-JP-NanamiNeural |
| fr | fr | fr-FR | fr-FR-DeniseNeural |

`zh` hiện được chọn là tiếng Trung giản thể/Mandarin. Không tự chọn Cantonese hoặc chữ phồn thể.

`AZURE_SPEECH_VOICES_JSON` cho phép thay voice từng mã; override một phần được ghép với mặc định. Voice phải thuộc locale của mã đó. Request `voice:null`, mã ngôn ngữ hoặc locale cũ như `vi-VN` đều dùng voice đã cấu hình. Một voice name khác cấu hình bị từ chối 422 để tránh request tự chọn giọng ngoài dự kiến. Không tự đoán voice tương ứng với locale khác.

## Cấu hình, tách token và khóa

Mẫu trong `.env.example` chỉ có placeholder/giá trị không bí mật. **Ghép các biến vào `.env` hiện có, không ghi đè toàn bộ cấu hình SQL/JWT.** Đợt này không điền hay sửa `.env`.

### Content service gọi adapter nội bộ

```dotenv
ADMIN_TRANSLATION_URL=http://127.0.0.1:8003/translate
ADMIN_TTS_URL=http://127.0.0.1:8003/tts
ADMIN_PROVIDER_TOKEN=
ADMIN_PROVIDER_TOKEN_REQUIRED=true
ADMIN_AUTOMATION_ENABLED=false
```

### narration-service gọi Azure

```dotenv
NARRATION_AZURE_ENABLED=false
NARRATION_ADAPTER_TOKEN=
NARRATION_ADAPTER_CACHE_PATH=C:/xampp/htdocs/AudioTour_Seminar/services/narration-service/data/adapter.sqlite3

AZURE_TRANSLATOR_KEY=
AZURE_TRANSLATOR_REGION=
AZURE_TRANSLATOR_ENDPOINT=https://api.cognitive.microsofttranslator.com/translate

AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=
AZURE_SPEECH_ENDPOINT=
AZURE_SPEECH_OUTPUT_FORMAT=audio-24khz-48kbitrate-mono-mp3
AZURE_SPEECH_VOICES_JSON={"vi":"vi-VN-HoaiMyNeural","en":"en-US-AriaNeural","zh":"zh-CN-XiaoxiaoNeural","ko":"ko-KR-SunHiNeural","ja":"ja-JP-NanamiNeural","fr":"fr-FR-DeniseNeural"}
```

- Tạo token nội bộ riêng, điền **cùng giá trị** vào ADMIN_PROVIDER_TOKEN và NARRATION_ADAPTER_TOKEN. Adapter so sánh token constant-time. Khi thiếu token trả 503, token sai/thiếu header trả 401. Không dùng JWT Admin/Vendor hay guest token cho kết nối này.
- AZURE_TRANSLATOR_KEY và AZURE_SPEECH_KEY là khóa resource Azure, chỉ gửi sang Azure bằng Ocp-Apim-Subscription-Key; token nội bộ không được chuyển tiếp. Cấu hình từ môi trường bị từ chối nếu token nội bộ trùng một khóa Azure.
- Translator endpoint phải là **URL đầy đủ của Translate**, không kèm query: global `/translate`; custom endpoint có thể là `/translator/text/v3.0/translate`. Adapter tự thêm api-version/from/to. Dùng đúng endpoint/key/region của resource đang có.
- Speech endpoint để trống thì suy ra `https://<AZURE_SPEECH_REGION>.tts.speech.microsoft.com/cognitiveservices/v1`. Nếu dùng custom endpoint, điền **đầy đủ URL synthesis**, không phải URL portal hoặc URL lấy token. Endpoint phải là HTTPS, không chứa username/password/query/fragment. Region/endpoint không được suy ra từ locale ngôn ngữ.
- Hai cờ đều giữ false. Khi NARRATION_AZURE_ENABLED=false, adapter không gọi Azure; khi ADMIN_AUTOMATION_ENABLED=false, worker không gọi adapter. Việc đổi cờ chỉ thực hiện sau khi được cho phép chi phí. Request trực tiếp tới adapter cũng có thể phát sinh phí nếu cờ Azure đã bật, dù worker đang tắt.
- Cache chứa bản dịch/audio, không chứa token hoặc khóa, nhưng vẫn là dữ liệu nội dung cần bảo vệ. Dùng thư mục có quyền phù hợp, backup cả SQLite theo cơ chế SQLite hợp lệ; không xóa DB để thử retry.

## Request/response nội bộ

Cả hai route yêu cầu:

```http
Authorization: Bearer <internal-adapter-token>
Idempotency-Key: narration-23-v3-en
Content-Type: application/json
```

Key bắt buộc 1–200 ký tự ASCII in được, không có khoảng trắng. Namespace là `(route operation, key)`: Content hiện dùng cùng key cho dịch và TTS, hai kết quả không xung đột nhau.

`POST /translate`:

```json
{"text":"Chào mừng quý khách đến Vĩnh Hy.","name":"Điểm tham quan Vĩnh Hy","sourceLanguage":"vi","targetLanguage":"en"}
```

Adapter gửi **một** Azure Translate request chứa hai phần tử Text, theo đúng thứ tự text/name; thêm `from=vi&to=en&api-version=3.0`. Khi thành công trả trực tiếp:

```json
{"text":"<translated narration>","name":"<translated POI name>"}
```

Đây là cấu trúc dữ liệu, không phải ví dụ kết quả dịch thật đã chạy. Text tối đa 10.000 ký tự đầu vào; name tối đa 200 đơn vị UTF-16. Hai trường trả về phải không rỗng và name dịch không vượt giới hạn DB.

`POST /tts`:

```json
{"text":"<text in the target language>","languageCode":"en","voice":null}
```

Adapter tạo SSML bằng XML serializer, chọn locale/voice theo cấu hình, gửi Azure Speech. Trả **audio bytes trực tiếp** với Content-Type tương ứng, không có envelope success/data, không trả đường dẫn, base64 hay JSON audio.

| AZURE_SPEECH_OUTPUT_FORMAT | Content-Type nội bộ |
| --- | --- |
| audio-24khz-48kbitrate-mono-mp3 | audio/mpeg |
| riff-24khz-16bit-mono-pcm | audio/wav |
| ogg-24khz-16bit-mono-opus | audio/ogg |

Giới hạn SSML sau escape 60 KiB; audio 50 MiB; kiểm tra header MP3/WAV/OGG. Chưa kiểm tra chất lượng giọng hoặc codec trên thiết bị thật.

## Timeout, Retry-After và lỗi

- Adapter → Azure: connect timeout 10 giây, read/write/pool 60 giây. Vòng đọc có budget 70 giây được kiểm tra khi nhận chunk; đây không phải bộ hẹn giờ cứng ngắt mọi tình huống tại giây thứ 70. Nếu ngừng có dữ liệu, HTTPX read timeout xử lý.
- Không theo redirect và không tự retry trong HTTP adapter. Mọi retry rõ ràng do queue Content quyết định.
- Lỗi trả `{"error":{"code":"...","message":"..."}}`, header `X-Adapter-Error-Code`, `X-Adapter-Retryable` và Retry-After khi có. Không đưa response body Azure, URL chứa thông tin nhạy cảm, khóa hoặc exception network nguyên bản vào response.

| Tình huống | HTTP / xử lý |
| --- | --- |
| Sai token nội bộ | 401 AdapterAuthentication; không gọi Azure |
| Thiếu cấu hình hoặc cờ Azure tắt | 503 AdapterConfiguration; không tự retry từ Content |
| Azure 401/403 | 502 AzureAuthentication; không tự retry; kiểm tra key/region/endpoint |
| Azure 429 | 429 AzureRateLimited; lưu cooldown theo Retry-After |
| Azure 5xx | 503 AzureUnavailable; retry có cooldown |
| Không kết nối được trước khi gửi | 503 AzureConnectionFailed; có thể retry |
| Read/write/protocol timeout hoặc mất kết nối sau khi có thể đã gửi | 504 ProviderResultUnknown; lưu uncertain, chặn tự gửi lại |
| Azure trả payload/audio không hợp lệ sau HTTP thành công | 502 InvalidAzureResponse; lưu uncertain để tránh tự tính phí lại |
| Cùng key nhưng payload khác | 409 IdempotencyConflict; không gọi Azure |
| Cùng key đang xử lý | 429 RequestInProgress, Retry-After 5 giây; không gọi Azure lần hai |

Retry-After hỗ trợ số giây và HTTP-date, chuyển thành số giây dương. Khi Azure không gửi hoặc header không hợp lệ, cooldown mặc định 30 giây. Cooldown được lưu trong SQLite; request cùng key đến sớm nhận lỗi/cooldown còn lại mà không gọi Azure. Content sử dụng thời gian lớn hơn giữa backoff nội bộ và Retry-After, vẫn giới hạn số lần thử. Lỗi xác thực/cấu hình có cooldown lưu 30 giây; sau khi sửa khóa/cấu hình, chờ hết cooldown trước Admin retry.

## Idempotency và giới hạn tính phí

- Fingerprint là SHA-256 của JSON request đã validate, sắp xếp key; giữ nguyên text, không cắt khoảng trắng để coi hai nội dung khác nhau là một. Không lưu request text hoặc credentials, chỉ lưu hash và response/result state.
- SQLite BEGIN IMMEDIATE đảm bảo một owner cho một operation/key, ngay cả khi nhiều request/worker cùng host. Lưu JSON/audio bytes và trạng thái Succeeded trong cùng row. Request lặp/restart trả cùng bytes, `X-Idempotent-Replay:true`, không gọi Azure lại.
- Kết quả đã thành công không tự hết hạn. Đổi khóa/voice/format cấu hình không xóa kết quả key cũ; cần một phiên bản nội dung/key mới nếu thật sự muốn tạo kết quả khác. Không tự đổi key để vượt lỗi uncertain.
- Owner có lease 180 giây. Nếu process dừng giữa request, khi lease hết request lặp được chuyển **uncertain**, không tự giành lại để gọi Azure. Lease không được dùng như bằng chứng provider chưa thực hiện.
- Nếu Azure đã thành công nhưng kết nối/ack lưu DB mất, không thể biết chắc đã tính phí hoặc lấy lại bytes. Adapter giữ trạng thái ProviderResultUnknown và **không có endpoint tự reset**. Cần đối chiếu log/usage Azure hoặc phục hồi response/cache trước. Việc chủ động tạo key mới sau đối chiếu là quyết định có thể bị tính phí lại, không tự động thực hiện.
- Không tuyên bố exactly-once billing. SQLite chống replay sau khi đã lưu kết quả; không giải quyết giao dịch phân tán với hệ thống billing Azure. Với lỗi 5xx được retry, cũng không cam kết Azure chưa ghi nhận chi phí.
- SQLite phù hợp một host với các process dùng cùng file. Docker volume giữ dữ liệu qua recreate; không xóa volume. Triển khai nhiều host độc lập cần kho idempotency chung khác, không dùng mỗi máy một SQLite rồi coi là dedup toàn hệ thống.

## Chạy cục bộ và Docker

Cài dependencies narration-service trong môi trường Python của dự án theo quy trình nhóm; đợt này không cần tải thêm vì môi trường kiểm tra đã có thư viện. Sau khi cấu hình (vẫn giữ cả hai cờ false), từ root:

```powershell
.tooling/python/python.exe scripts/serve.py narration
```

Adapter bind cổng 8003; `GET http://127.0.0.1:8003/health` không gọi Azure. Khi chạy trực tiếp bằng uvicorn thay vì serve.py, cần nạp `.env` qua môi trường process; adapter không tự đọc một `.env` bất kỳ.

Docker Compose đã có override Content → `http://narration-service:8000/translate` và `/tts`, cache `/app/data/adapter.sqlite3` trên named volume. `.env` Windows không được dùng làm đường dẫn cache trong container; compose đã ghi đè riêng biến này. Không chạy Docker/up hoặc tạo resource trong đợt triển khai này.

Giữ hai cờ false cho tới khi tài khoản/khóa/quyền sử dụng và chi phí được xác nhận. Khi được phép thử thật: bật NARRATION_AZURE_ENABLED cho adapter và ADMIN_AUTOMATION_ENABLED cho worker, restart hai service, rồi dùng luồng Vendor → POI mới → thuyết minh → Admin duyệt → status từng ngôn ngữ → API mobile như [hướng dẫn chung](real-translation-tts.md). Bật worker có thể xử lý toàn bộ Queued, không chỉ đoạn thử; kiểm tra hàng đợi trước. Với một nguồn vi và sáu ngôn ngữ hiện bật: tối đa 5 request dịch ban đầu và 6 request TTS ban đầu, chưa tính retry; mỗi request dịch gồm cả text và name.

Mobile vẫn gọi Gateway, không gọi trực tiếp adapter hoặc nhận khóa Azure. PUBLIC_API_BASE_URL phải là IP LAN/hostname Gateway điện thoại truy cập được; dùng guest token trong header stream, không dùng localhost của điện thoại.

## Đã kiểm tra và còn cần

Đã đạt 15 kiểm tra adapter bằng HTTP mock + SQLite/file thật trong thư mục test, gồm hai endpoint, sáu ngôn ngữ, tách credentials, SSML, MP3/WAV bytes, replay sau restart, concurrent claim, xung đột nội dung, 429/HTTP-date/cooldown, lỗi auth, timeout uncertain và Content client → adapter. Bốn kiểm tra Content liên quan cũng đạt (hai SQL rollback xác minh Retry-After/giới hạn retry; hai HTTP mock hợp đồng provider). Không gọi Azure thật.

```powershell
.tooling/python/python.exe scripts/test_azure_adapter.py
```

Còn cần chủ dự án cung cấp tài khoản/resource Azure Translator và Speech đã có quyền sử dụng, hai khóa, region/endpoint đúng, token nội bộ riêng và quyền ghi kho cache bền vững. Chưa xác nhận khóa hợp lệ, quota, availability giọng trên region, chất lượng dịch/giọng hoặc phát trên điện thoại. Không tự đăng ký dịch vụ, không sửa `.env`, không bật hai cờ, không chạy E2E hoặc kiểm tra toàn dự án, không commit/push.
