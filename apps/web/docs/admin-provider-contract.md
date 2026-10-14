# Adapter dịch/TTS thật cho Admin

Backend hỗ trợ adapter HTTP do máy chủ cấu hình. Không có provider mặc định và không tạo file/audio hoặc bản dịch mô phỏng. Admin xem trạng thái tại /admin/automation. Cần triển khai adapter thực tế của nhà cung cấp được chọn để đáp ứng contract này.

Biến môi trường root .env (không commit secrets):

```dotenv
ADMIN_TRANSLATION_URL=
ADMIN_TTS_URL=
ADMIN_PROVIDER_TOKEN=
ADMIN_AUTOMATION_ENABLED=false
```

ADMIN_PROVIDER_TOKEN gửi qua Authorization: Bearer. Không cho người dùng truyền URL provider trong payload. Nếu không cấu hình thì API tạo nội dung trả 503, giao diện vô hiệu hóa hành động tương ứng.

## Dịch

POST ADMIN_TRANSLATION_URL:

```json
{"text":"Văn bản canonical đã duyệt","name":"Tên POI","sourceLanguage":"vi","targetLanguage":"en"}
```

Response 200 JSON:

```json
{"text":"Translated introduction","name":"Translated POI name"}
```

Adapter cần dịch thật; response phải có text/name không trống. Không thay đổi bản dịch canonical đang công khai; tạo ContentSubmission Pending. Nếu đích đã có proposal Pending, dừng và giữ nguyên đề xuất đó. Bản dịch đã xóa cần phục hồi trước.

## Audio

POST ADMIN_TTS_URL:

```json
{"text":"Văn bản canonical đã duyệt","languageCode":"vi","voice":"vi-VN"}
```

Response 200 binary audio với Content-Type audio/mpeg, audio/wav, audio/x-wav hoặc audio/ogg. Giới hạn 50 MiB. Lưu file UUID thực trong MEDIA_ROOT/uploads/audio, tạo MediaFiles và AudioTracks Pending. Không ghi URL giả. Duyệt media trước, AudioTrack sau. Tạo audio của bản dịch chỉ khi bản dịch nguồn đã Approved.

## Quy trình

- POST /api/v1/cms/automation/{pois|narrations|poi-translations}/{id}, body {languages:["en"],generateAudio:true}; chỉ Admin/SuperAdmin.
- Đọc canonical Approved và kiểm Version trước/sau gọi provider; không dùng bản chỉnh sửa Pending.
- GET /api/v1/cms/automation/status trả cấu hình (không secrets) và 50 audit events mới nhất.
- Bật ADMIN_AUTOMATION_ENABLED=true để chạy sau khi duyệt. POI/thuyết minh được dịch sang ngôn ngữ active; bản dịch chỉ tạo audio nguồn. Bật sau khi provider đã được cấu hình và kiểm thử thật.
- Tác vụ lưu Started/Completed/Failed vào AuditLogs. Khóa application SQL chống tạo trùng cùng nguồn/version/languages. Completed không chạy lại; Failed có thể retry. Nếu process chết sau Started thì cần operator kiểm tra và phục hồi có kiểm soát; hiện chưa có durable worker/recovery tự động.
- Approval đã commit vẫn thành công dù provider lỗi. Kết quả provider chỉ vào queue Pending, không tự công khai.

Test adapter dùng response fixture trong transaction rollback để kiểm wiring và giữ canonical. Điều này không chứng minh dịch/giọng đọc của provider thực; cần credentials và thử provider thật sau khi lựa chọn.
