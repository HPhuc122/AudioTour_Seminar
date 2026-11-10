# Dịch và tạo audio cho demo AudioTour

`narration-service` hỗ trợ hai lựa chọn `NARRATION_PROVIDER=demo` và `azure`.
Chế độ demo mặc định dịch bằng MyMemory qua HTTPS (`httpx`) và tạo audio
bằng `edge-tts` 7.3.1. `deep-translator` 1.11.4 (GoogleTranslator) vẫn có thể
chọn riêng bằng `DEMO_TRANSLATOR=google`, nhưng nguồn Google đang trả 429. Không dùng Google Cloud API key, tài khoản Billing hoặc Azure resource
key. Cần Internet ở bước dịch và tạo audio. Đây là thư viện cộng đồng truy cập
dịch vụ trực tuyến; có thể gặp thay đổi dịch vụ, rate limit hoặc lỗi mạng.

## Luồng lưu nội dung

1. Content Service tạo job theo thuyết minh, phiên bản nguồn và ngôn ngữ.
2. Worker gọi `/translate` nếu khác ngôn ngữ gốc, sau đó gọi `/tts`.
3. Adapter lưu kết quả thành công vào SQLite theo `Idempotency-Key`.
   Gọi lại cùng key và payload trả kết quả đã lưu, kể cả sau khi khởi động lại.
   Key trùng nhưng payload khác trả HTTP 409. Nội dung mới phải có phiên bản mới.
4. Luồng Content Service hiện có lưu bản dịch và file MP3 vào kho nội dung;
   quy trình duyệt/công bố hiện tại quyết định khi nào Mobile đọc được nội dung.
5. Mobile đọc bản dịch và phát audio đã lưu, không gọi dịch/TTS khi mở POI.
   Kết nối tới backend vẫn cần thiết khi tải nội dung chưa có trên thiết bị.

Cache adapter là lớp chống xử lý lại request, không thay thế SQL Server và kho
media của Content Service. Giữ thư mục cache qua các lần khởi động.

## Cài đặt trên Windows

Từ thư mục gốc dự án:

```powershell
py -3.13 -m venv services/narration-service/.venv
& services/narration-service/.venv/Scripts/python.exe -m pip install -r services/narration-service/requirements.txt
```

Cấu hình trong `.env` gốc, giữ nguyên các cấu hình DB/JWT/URL khác:

```dotenv
NARRATION_PROVIDER=demo
NARRATION_DEMO_ENABLED=true
DEMO_TRANSLATOR=mymemory
NARRATION_AZURE_ENABLED=false
NARRATION_ADAPTER_TOKEN=<token-noi-bo>
ADMIN_PROVIDER_TOKEN=<cung-token-noi-bo>
ADMIN_PROVIDER_TOKEN_REQUIRED=true
ADMIN_TRANSLATION_URL=http://127.0.0.1:8003/translate
ADMIN_TTS_URL=http://127.0.0.1:8003/tts
NARRATION_ADAPTER_CACHE_PATH=D:/AudioTour/services/narration-service/data/demo-adapter.sqlite3
ADMIN_AUTOMATION_ENABLED=false
```

Token nội bộ là chuỗi ngẫu nhiên giữa Content và Narration, không phải API key
của Google. Không đưa token vào Git hoặc log.

Chạy adapter:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-narration.ps1
```

Adapter mặc định nghe ở `127.0.0.1:8003`. `/health` báo `provider: demo` và
`demoEnabled: true`. Docker Compose dùng địa chỉ nội bộ `narration-service:8000`
và named volume cache; build lại image sau khi cập nhật requirements.

## Thử thật và xử lý nội dung của ứng dụng

```powershell
& services/narration-service/.venv/Scripts/python.exe scripts/smoke-demo-narration.py --languages vi en zh ko ja fr
```

Lệnh này gọi dịch/TTS thật với một câu mẫu, lưu MP3 và báo cáo trong
`docs/reports/demo-narration-test`. Không ghi SQL Server hoặc chạy hàng đợi nội
dung. Lần gọi audio thứ hai kiểm tra replay từ SQLite, không tạo lại audio.

Sau khi thử thành công và đã chuẩn bị các job cần demo, đặt
`ADMIN_AUTOMATION_ENABLED=true` rồi khởi động lại Content Service. Worker hiện có
sẽ xử lý các job đủ điều kiện trong hàng đợi cho tất cả ngôn ngữ đang bật.
Đặt lại `false` và khởi động lại Content để dừng nhận job mới. Không gọi hàng
loạt chỉ để kiểm tra cấu hình. Các nội dung đã tạo vẫn cần đi qua duyệt/công bố.

Giọng mặc định: `vi-VN-HoaiMyNeural`, `en-US-AriaNeural`,
`zh-CN-XiaoxiaoNeural`, `ko-KR-SunHiNeural`, `ja-JP-NanamiNeural`,
`fr-FR-DeniseNeural`. Có thể ghi đè bằng `DEMO_TTS_VOICES_JSON` (cùng định dạng
trong `.env.example`). Voice của request phải là giọng đã cấu hình, mã ngôn ngữ
hoặc locale tương ứng. Đầu ra là MP3 `audio/mpeg`, tối đa 50 MiB.

MyMemory nhận tối đa 500 **byte UTF-8** mỗi đoạn. Adapter chia đoạn theo giới
hạn byte, giữ đủ ký tự tiếng Việt/CJK/emoji; tên dịch vẫn phải đáp ứng giới hạn
200 đơn vị UTF-16 của Content Service. GoogleTranslator dùng đoạn tối đa
4.500 ký tự khi được chọn riêng. Mỗi tác vụ demo có hạn
75 giây; lỗi không lộ nội dung request hoặc thông tin provider. Rate limit trả
429 và `Retry-After`, timeout trả 504. Khi provider báo rate limit/hết quota,
SQLite lưu cooldown chung cho nguồn dịch; các job mới không tiếp tục gọi
provider trong thời gian chờ, nhưng các kết quả đã cache vẫn dùng được. Lỗi
quota nằm trong JSON HTTP 200 cũng bị từ chối, không bị lưu thành bản dịch.
Không tự đổi nguồn dịch để vượt giới hạn. Không gọi Azure/Google Cloud.

MyMemory miễn phí không tài khoản có hạn mức 5.000 ký tự/ngày. Dịch nhiều
ngôn ngữ tiêu hao hạn mức cho từng ngôn ngữ đích. Không khai báo email thay
người dùng hoặc tự mua thêm quota. Xem [hạn mức chính thức](https://mymemory.translated.net/doc/usagelimits.php)
và [giới hạn 500 byte](https://mymemory.translated.net/doc/spec.php).

TTS gặp `NoAudioReceived` được thử lại tối đa một lần sau một giây, trong cùng
hạn thời gian. Nếu vẫn lỗi, trả 503; audio dở dang của lần thất bại bị bỏ.

## Kiểm thử không gọi mạng ngoài

```powershell
Set-Location services/narration-service
& .venv/Scripts/python.exe -m unittest discover -s tests -v
```

Bao gồm hợp đồng Azure cũ và adapter demo: xác thực, sáu locale, dữ liệu dài,
voice sai, timeout, rate limit, MP3 không hợp lệ, cache sau restart và xung đột
idempotency. Trên môi trường sandbox Windows, asyncio có thể cần quyền socket
loopback dù upstream đã được giả lập.

## Kết quả kiểm tra ngày 10/11/2026 sau khi xử lý lỗi dịch

- **29 bài kiểm thử đạt**, bao gồm Azure cũ, demo, phân đoạn UTF-8, kiểm tra
  JSON MyMemory, quota, cooldown qua restart và thử lại audio rỗng.
- Đã chọn `DEMO_TRANSLATOR=mymemory` trong `.env`; GoogleTranslator không được
  gọi lại và không dùng key Google Cloud.
- Dịch và tạo MP3 thật thành công cho `vi`, `en`, `zh`, `ko`, `ja`, `fr`.
  Tiếng Việt giữ văn bản gốc. Mỗi ngôn ngữ có MP3 16–23 KB trong
  `docs/reports/demo-narration-test`; `result.json` lưu bản dịch và kết quả.
- Chạy lại toàn bộ sáu ngôn ngữ trong app mới: cả bản dịch và audio trả replay
  từ SQLite, byte audio giống hệt; không cần dịch/tạo lại.
- Adapter HTTP thật đã khởi động lại trên `127.0.0.1:8003`; health xác nhận
  `provider=demo`, `demoTranslator=mymemory`, `demoEnabled=true`.
- Gọi thật `NarrationProvider.render()` của Content Service qua hai endpoint
  của adapter: nhận bản dịch tiếng Anh và MP3 17.568 bytes; gọi lại nhận kết
  quả giống hoàn toàn. `content-chain-result.json` ghi kết quả kiểm tra.
- Giữ `ADMIN_AUTOMATION_ENABLED=false`; các kiểm tra không chạy hàng đợi SQL
  Server hoặc công bố nội dung thử nghiệm. Để xử lý các job của ứng dụng,
  dùng hướng dẫn bật worker phía trên sau khi chọn nội dung cần demo.
- Bản dịch máy, đặc biệt tên địa danh, cần được rà lại trước khi trình diễn.
