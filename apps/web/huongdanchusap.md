# Hướng dẫn bàn giao phần Chủ sạp — AudioTour

**Người nhận:** thành viên phụ trách giao diện và nghiệp vụ Chủ sạp (Vendor).

**Mục tiêu:** chủ sạp đăng nhập, đăng ký/quản lý địa điểm của mình, gửi ảnh và văn bản/audio để Admin duyệt, theo dõi kết quả và thời hạn. Nội dung đã duyệt mới được cung cấp cho khách trên Mobile.

**Mốc đối chiếu:** source và SQL Server thật ngày 14/10/2026. Các mục “đã có”, “cần làm”, “đề xuất” bên dưới phải được phân biệt khi triển khai. Số lượng dữ liệu có thể thay đổi khi nhóm thao tác.

**Bổ sung theo phân công mới:** Chủ sạp phải có ít chức năng hơn Admin. Dùng phạm vi mục **15–19** làm chuẩn thiết kế giao diện và phân quyền cần triển khai. Các bảng/API ở mục trước mô tả khả năng Backend hiện tại, không có nghĩa phải đưa tất cả khả năng đó vào menu Vendor. Tài liệu này hướng dẫn cấu trúc; chưa tạo các file `/vendor` hoặc thay đổi quyền runtime.

## 1. Phạm vi công việc và cách phối hợp

Bạn phụ trách phần **Chủ sạp**, gồm giao diện, luồng sử dụng, tích hợp API và phối hợp bổ sung Backend cần thiết. Không cần xây lại Dashboard/Admin hoặc API nội dung đã có. Có thể tận dụng các component và API dùng chung trong Web hiện tại.

| Thành viên/phần việc | Trách nhiệm |
| --- | --- |
| Người làm Chủ sạp | Màn hình Vendor; đăng ký/hồ sơ; POI, ảnh, văn bản và audio trong scope; gửi/theo dõi duyệt; thông tin thời hạn; kiểm thử quyền và bàn giao API mới nếu cần |
| Người làm Admin | Duyệt hồ sơ/nội dung; từ chối có lý do; quản lý user; cấp/thu hồi scope; quản lý Tour; cấu hình; quản lý gói/đối soát sau khi chốt nghiệp vụ |
| Người làm Backend | Schema/migration tương thích; quyền server; validation; transaction/version; API thiếu; hợp đồng phản hồi và kiểm thử SQL |
| Người làm Mobile | Khách xem/nghe nội dung public; GPS/geofence, QR/player/offline; tích hợp API public. Không đưa nghiệp vụ duyệt của Admin vào Mobile |

Nếu một người kiêm Chủ sạp và Backend thì vẫn làm theo thứ tự: audit → thống nhất nghiệp vụ → API/DB → giao diện → kiểm thử. Không thêm nút hoạt động giả để coi là đã hoàn thành.

## 2. Những gì đã có, cần tận dụng

| Chức năng | Hiện trạng | Việc của người làm Chủ sạp |
| --- | --- | --- |
| Đăng nhập | Có Auth API, JWT, refresh token; Web lưu phiên đăng nhập | Dùng lại; kiểm tra lỗi đăng nhập/phiên hết hạn/tài khoản khóa |
| Đăng ký Vendor | Có `POST /api/v1/auth/register` | Bổ sung giao diện; xem lưu ý duyệt hồ sơ ở mục 5 |
| Quyền sở hữu | Backend dùng `POIs.UserId`, `Tours.UserId`, `EntityGrants` | Hiển thị dữ liệu đã được Backend lọc; không tự gửi owner/role |
| Quản lý POI | Có CRUD, tọa độ/bán kính, mô tả, bản đồ | Hoàn thiện trải nghiệm theo vai trò Vendor; chỉ chọn POI trong scope |
| Ảnh | Có upload/thay file/xem trước/đề xuất xóa | Tích hợp giao diện, loại ảnh và trạng thái duyệt |
| Văn bản giới thiệu | Có POI description, NarrationDrafts, bản dịch và review | Làm luồng nhập/sửa/preview/gửi duyệt rõ ràng |
| Audio | Có upload, tạo AudioTracks, nghe thử và kiểm quyền | Dùng form thêm file hiện có; bảo đảm upload xong thực sự có bản ghi audio |
| Trạng thái duyệt | Có Pending/Approved/Rejected/Superseded, lý do, resubmit | Hiển thị trạng thái/lý do/lịch sử đề xuất; xử lý 409 |
| Nội dung public an toàn | Canonical tách khỏi đề xuất; có version/snapshot | Không ghi trực tiếp bản public bằng dữ liệu đang sửa |
| Dashboard/thống kê | Có API tổng quan và thống kê trong scope | Nội dung hiển thị cần phù hợp chủ sạp; không suy diễn lượt kích hoạt thành nghe hoàn tất |
| Tour | Backend hiện có CRUD/bản dịch/thứ tự POI trong scope | Không đưa quản lý Tour vào phần Chủ sạp mặc định; quản lý thuộc Admin/TourOperator, cần thu hẹp quyền ghi Vendor tại Backend |
| Hồ sơ chủ sạp riêng | Chưa có schema/quy trình duyệt | Ưu tiên thiết kế sau khi nhóm chốt thông tin và chính sách |
| Gói/gia hạn/thanh toán | Chưa có nghiệp vụ đầy đủ | Phối hợp chốt schema, giá/thời hạn, bằng chứng trước khi code |
| Dịch/TTS tự động | Có adapter trong Content service, chưa có provider thật | Hiện Vendor không có quyền gọi API automation; cần thiết kế luồng yêu cầu nếu nhóm muốn |

Web hiện dùng chung shell `/admin` cho Admin và Vendor, ẩn/hiện chức năng theo role. `/admin` không có nghĩa mọi tài khoản đều có quyền Admin. Theo phạm vi mới, người làm Chủ sạp nên triển khai nhóm route `/vendor` và layout/menu riêng theo mục 16; dùng lại component/API cơ sở, không sao chép nguyên bộ màn hình Admin.

## 3. Ma trận quyền Admin và Chủ sạp

| Hành động | Chủ sạp/Vendor | Admin/SuperAdmin |
| --- | --- | --- |
| Xem/sửa POI | POI sở hữu hoặc có grant | Toàn hệ thống |
| Tạo POI | Có; Backend gán owner theo tài khoản, nội dung vào Pending | Có; vẫn vào quy trình duyệt |
| Sửa ảnh/text/audio nguồn | Theo quyền POI cha, qua đề xuất | Toàn hệ thống |
| Bản dịch POI | Phạm vi mới chỉ đọc; Backend hiện còn quyền ghi Vendor nên cần thu hẹp | Admin/ContentAdmin sửa theo scope |
| Duyệt/từ chối nội dung | **Không** | Có |
| Gửi lại hồ sơ bị từ chối | Có trong scope | Có theo quyền quản lý |
| Xem queue | Chỉ nội dung thuộc scope | Toàn queue |
| Đổi owner, cấp/thu hồi scope | **Không** | Cấp/thu hồi grant; đổi owner cần nghiệp vụ rõ, không tự đoán |
| Quản lý user/role/ngôn ngữ/cấu hình | **Không** | Có |
| Sửa trạng thái thanh toán/publication/thời hạn | **Không tự sửa** | Thời hạn đi qua đề xuất; thanh toán cần chứng cứ hợp lệ |
| Quản lý Tour | Hiện Backend cho phép trong scope; **phạm vi mới không cho Vendor quản lý Tour**, cần sửa guard Backend | Admin/TourOperator theo quyền được giao |
| Thay điểm dừng Tour | Không có chức năng trong phần Chủ sạp; Backend phải chặn thao tác ghi Vendor | Có theo nghiệp vụ quản lý |
| QR | Chỉ xem/tải QR đã cấp cho POI của mình theo phạm vi mới; API hiện còn cho CRUD nên cần thu hẹp | Quản lý/tạo/thay đổi QR |
| Giá/thời lượng quyền nghe của QR | Không cho chỉnh trong phần Chủ sạp; Backend hiện còn nhận các trường này, cần chặn | Admin quản lý theo nghiệp vụ đã chốt |
| Xem giao dịch toàn hệ thống | **Không** | Hiện có trang tra cứu read-only |
| Xem giao dịch riêng/đăng ký gói | Chưa có API Vendor hoàn chỉnh | Cần API/schema nghiệp vụ mới |
| Chạy dịch/TTS tự động | Hiện **403** với Vendor | API mới hiện chỉ Admin/SuperAdmin; provider chưa cấu hình |

Ẩn nút là điều kiện giao diện, không thay cho quyền API. Khi Vendor tự gọi URL Admin hoặc đổi ID trong request, Backend vẫn phải từ chối. Tài khoản bị khóa/đổi vai trò không được tiếp tục dùng JWT cũ.

## 4. Luồng nghiệp vụ đã có: POI và nội dung

### 4.1. Chủ sạp tạo POI

1. Đăng nhập tài khoản có role `Vendor`.
2. Nhập mã/tên POI, mô tả, danh mục, tọa độ, bán kính và thông tin nội dung.
3. Validate tên/mã không trống, tọa độ hợp lệ, bán kính dương, số nguyên/thời gian đúng quy định.
4. Gửi API tạo POI. **Không gửi `UserId`, `ApprovalStatus`, `ReviewStatus`, `LifecycleStatus`, `PaymentStatus`, `Version` để tự đặt quyền/trạng thái.**
5. Backend gán `UserId` theo tài khoản đăng nhập và tạo nội dung chờ duyệt.
6. Giao diện báo “Đã gửi đăng ký POI để duyệt”, không báo “Đã xuất bản”.
7. Chủ sạp xem hồ sơ đã gửi, nội dung đề xuất, thời điểm và trạng thái.

### 4.2. Admin duyệt POI

1. Xem người gửi, vị trí, văn bản, thông tin đề xuất và bản hiện tại nếu có.
2. Preview nội dung/file liên quan và xác nhận trước khi duyệt.
3. Reject bắt buộc lý do; approve áp dụng proposal bằng transaction/version.
4. POI được duyệt **chưa chắc công khai ngay**: còn phụ thuộc active, xóa mềm, lifecycle, thời hạn và nghĩa vụ thanh toán nếu cấu hình có yêu cầu.
5. Chủ sạp thấy trạng thái mới; nếu bị từ chối thì sửa và gửi lại.

Duyệt tài khoản chủ sạp và duyệt POI là hai việc khác nhau. Duyệt một việc không tự duyệt việc còn lại.

### 4.3. Sửa nội dung đã được duyệt

1. Chủ sạp sửa bản đề xuất, gửi `PUT` API hiện có.
2. Backend tạo submission mới; Mobile tiếp tục đọc canonical đã duyệt.
3. Giao diện phải phân biệt **bản đang công khai** và **thay đổi chờ duyệt**; không làm người dùng tưởng bản public đã đổi.
4. Admin approve thì bản mới thay bản cũ; reject thì bản public cũ được giữ.
5. Proposal mới có thể thay proposal Pending cũ thành `Superseded`; không cho duyệt lại bản cũ.
6. Backend trả 409 khi proposal/version không còn hợp lệ: tải lại hồ sơ và thông báo, không tự ép lưu.

### 4.4. Xóa và phục hồi

- Nội dung được quản lý bằng review phải gửi yêu cầu xóa; không xóa public ngay khi Vendor bấm nút.
- Admin duyệt xóa mới tác động nội dung công khai.
- Phục hồi là thao tác Admin và đưa nội dung trở lại quy trình Pending.
- QR hiện là cấu hình trực tiếp, không thuộc cùng quy trình ContentSubmissions. Không viết thông báo “đã gửi duyệt” nếu API QR thực tế đã áp dụng thay đổi.
- Không chạy SQL DELETE/UPDATE thủ công để thay cho quy trình nghiệp vụ.

## 5. Phần thiếu ưu tiên cao: hồ sơ và duyệt Chủ sạp

**Thực trạng:** `Users` có thông tin đăng nhập, vai trò và `IsActive`; chưa có bảng hồ sơ kinh doanh/trạng thái duyệt. `AuthService.register_vendor` hiện tạo Vendor với `IsActive=True`. Trang Admin “Hồ sơ chủ sạp” chỉ tra cứu user, POI và grants, trả `approvalSupported=false`.

**Không được coi tài khoản đang active là hồ sơ đã duyệt, hoặc active=false là hồ sơ đang chờ duyệt.**

### 5.1. Nhóm cần chốt trước khi thực hiện

- Hồ sơ yêu cầu những gì: tên sạp/cơ sở, người đại diện, liên hệ, địa chỉ, mô tả, giấy tờ/ảnh nào? Đây là danh sách gợi ý, chưa phải các cột hiện có.
- Tài khoản mới có được đăng nhập để hoàn thiện hồ sơ khi chưa duyệt không?
- Trước khi duyệt có được tạo POI nháp/gửi POI không, hay phải đợi hồ sơ được duyệt?
- Một tài khoản có một hay nhiều sạp? Một sạp có nhiều POI không?
- Sửa thông tin hồ sơ đã Approved có phải duyệt lại? Giữ thông tin đã duyệt trong lúc chờ như thế nào?
- Quy tắc cho các Vendor cũ đang active: không tự backfill Approved hoặc khóa toàn bộ tài khoản cũ.

### 5.2. Công việc phải triển khai

- Form đăng ký tài khoản và màn hình hồ sơ riêng.
- Màn hình gửi hồ sơ, trạng thái và lý do từ chối; chỉnh sửa/gửi lại.
- Migration tương thích thêm hồ sơ/version/reviewer audit sau khi chốt nghiệp vụ.
- API Vendor đọc/sửa/nộp hồ sơ của chính mình; Backend lấy user từ JWT, không tin userId do client gửi.
- API Admin danh sách/chi tiết/approve/reject hồ sơ; xác nhận và lý do.
- Kiểm tra điều kiện duyệt tại Backend trước các thao tác bị hạn chế theo chính sách đã chọn.
- Giữ thông tin Approved riêng với proposal nếu hồ sơ đã duyệt được chỉnh sửa.

**Tên bảng đề xuất:** `VendorApplications` trong tài liệu migration. Bảng này **chưa tồn tại trong DB hiện tại**. Không gọi API/table tưởng tượng như thể đã triển khai.

**API có thể đề xuất:** `/api/v1/vendor/profile`, `/api/v1/vendor/application`, `/api/v1/cms/vendor-applications/...`. Đây là tên gợi ý cho hợp đồng mới, **không phải endpoint đang chạy**; nhóm Backend thống nhất trước khi frontend gọi.

**Tiêu chí hoàn thành:** Vendor A không đọc/sửa hồ sơ Vendor B; Vendor không tự approve; Admin reject có lý do; sửa/nộp lại hoạt động; policy với tài khoản cũ được kiểm thử.

## 6. Các màn hình Chủ sạp cần hoàn thiện

| Màn hình | Nội dung/thao tác cần có | Tiêu chí nghiệm thu |
| --- | --- | --- |
| Đăng ký/đăng nhập | Tài khoản/email/mật khẩu; validation; thông báo lỗi; đăng xuất/hết phiên | Không tự chọn role Admin; không mở dữ liệu quản trị khi chưa đăng nhập |
| Hồ sơ sạp | Thông tin đã thống nhất; gửi duyệt; trạng thái/lý do; gửi lại | Backend thật và chỉ hồ sơ của mình; cần migration/API mới |
| Tổng quan | POI trong scope, hồ sơ chờ/bị từ chối, nhắc nội dung thiếu/file thiếu/thời hạn | Count không bao gồm dữ liệu của chủ sạp khác |
| POI của tôi | Danh sách, tìm kiếm, lọc, phân trang; tạo/sửa/chi tiết | Owner/grant do Backend quyết định |
| Vị trí POI | Bản đồ, chọn tọa độ, bán kính, validation | Không đổi vị trí POI ngoài scope; lưu qua proposal |
| Văn bản giới thiệu | Nhập/sửa, preview toàn văn, ngôn ngữ; gửi duyệt | Phân biệt bản public và proposal; không tự đổi status |
| Ảnh | Chọn POI, upload, loại ảnh, preview, thay file/yêu cầu xóa | File thật; trạng thái Pending; giữ ảnh public cũ khi thay |
| Audio | Chọn file/tên/ngôn ngữ/POI; nghe thử; trạng thái | Có cả media và AudioTracks; retry không tải trùng |
| Bản dịch | Xem bản dịch của POI; theo dõi nội dung/ngôn ngữ đã có | Mặc định chỉ đọc; dịch/sửa bản dịch thuộc Admin/ContentAdmin; nếu mở quyền Vendor cần phân công rõ |
| Hồ sơ đã gửi | Loại hồ sơ, ngày gửi, trạng thái, lý do, chi tiết, chỉnh sửa/gửi lại | Không có nút approve/reject cho Vendor |
| QR | Xem/tải QR đã cấp ngay trong chi tiết POI | Không có form giá/quyền nghe hoặc CRUD QR cho Vendor |
| Thời hạn/gói | Xem hạn, trạng thái hết/sắp hết, yêu cầu gia hạn sau khi có nghiệp vụ | Không cho Vendor trực tiếp sửa ValidUntil/PaymentStatus |
| Giao dịch riêng | Session và bằng chứng thuộc mình sau khi có API | Không đọc giao dịch toàn hệ thống; không giả báo Paid/Verified |
| Thống kê riêng | Lượt theo POI/ngày; phân biệt lượt kích hoạt với nghe hoàn tất | Không dùng duration 0 thành thời lượng nghe thật |

Form phải có loading/disable khi đang lưu, giữ dữ liệu khi lỗi, thông báo kết quả, empty/error state, tiếng Việt thống nhất, sử dụng được trên desktop/tablet. Tránh bắt người dùng nhập ID/path kỹ thuật khi có thể chọn danh sách POI/ngôn ngữ thật.

## 7. Ảnh, văn bản, dịch và audio: quy trình đúng

### 7.1. Ảnh

- Upload file vào POI trong scope; xem preview có xác thực trên CMS.
- `MediaFiles.ImageCategory` hiện hỗ trợ `Menu` và `Highlight`; dùng nhãn tiếng Việt phù hợp, không tự thêm enum khác.
- Chỉ dùng ImageCategory cho ảnh. Audio không cần mang loại ảnh.
- Thay file là tạo proposal, không ghi đè bytes đang public trước khi duyệt.
- Upload lỗi không được báo thành công; file đã mất phải báo thiếu file và cho tải lại đúng quy trình.

### 7.2. Văn bản và bản dịch

- Có thể dùng POI description và NarrationDrafts/bản dịch hiện có; thống nhất màn hình để tránh nhiều nơi chỉnh cùng nội dung mà không rõ bản nào đang được duyệt.
- Duyệt NarrationDraft hiện xuất bản text vào POITranslation tương ứng; phải hiểu liên kết/version này trước khi sửa quy trình.
- Phạm vi mới: Vendor chỉ xem bản dịch. Admin/ContentAdmin sửa thủ công cũng phải qua Pending; không gửi bản dịch chưa duyệt cho Mobile. Backend hiện còn cho Vendor ghi bản dịch trong scope, cần thu hẹp như mục 18.
- Sáu ngôn ngữ active không có nghĩa đã có đủ bản dịch/audio của cả sáu.
- Muốn Vendor yêu cầu dịch tự động: bổ sung API/request workflow sau khi chốt, có kiểm scope và nguồn Approved. Không đổi endpoint Admin-only thành Vendor-access một cách máy móc.

### 7.3. Audio thu sẵn

**Luồng hiện có:** chọn file → `media/upload` → tạo `AudioTracks` bằng `POST /audio` → Pending → Admin duyệt media trước → Admin duyệt AudioTracks → Mobile mới nhận/phát nếu POI public và quyền nghe hợp lệ.

Thông tin tạo audio lấy từ dữ liệu thật:

```ts
// Minh họa cách ghép hai API hiện có, không phải dữ liệu seed.
const uploaded = await api.upload(fileDaChon, poiIdTrongScope, token);
await api.admin('audio', token, json('POST', {
  POIId: poiIdTrongScope,
  LanguageCode: maNgonNguDaChon,
  Title: tenDoChuSapNhap,
  AudioType: 'prerecorded',
  FileUrl: uploaded.RelativePath,
  MimeType: uploaded.ContentType,
  FileSizeBytes: uploaded.FileSize,
  IsActive: true,
}));
```

- Nếu upload thành công nhưng tạo AudioTracks lỗi, giữ media trả về để retry; không upload trùng mỗi lần bấm lưu.
- Cần cho chọn lại file audio đã upload nhưng chưa gắn track. Đây là việc còn thiếu đáng ưu tiên: snapshot hiện có 1 audio media thật chưa liên kết canonical hoặc proposal audio.
- Khi thay file media audio, cần đồng bộ proposal AudioTrack đến đường dẫn file mới theo quy trình Backend; chỉ thay bytes/media không bảo đảm track cũ tự trỏ đúng file mới.
- AudioType hiện có `prerecorded` và `tts`; `file` chỉ là input legacy được chuẩn hóa. Không tự tạo enum.
- `AudioTracks.Title` có giới hạn 200 ký tự từ schema thật. Validate để tránh tên file dài làm bước tạo track thất bại sau upload.
- Form hỗ trợ MP3/WAV/OGG/M4A/AAC/FLAC theo MIME Backend; không nhập FileUrl giả cho một file chưa tồn tại.
- Nghe thử trên CMS là để kiểm nội dung, không ghi thành lượt nghe khách.

### 7.4. Audio tạo bằng TTS

- Provider thật chưa được cấu hình. Nhãn/nút phải ghi rõ trạng thái, không hiển thị “đã tạo file” khi chỉ có TTSText.
- API automation mới nằm trong Content service, chỉ Admin/SuperAdmin; Narration service riêng hiện chỉ có health.
- Văn bản nguồn phải là canonical Approved. Output dịch/audio tạo vào Pending, không tự public.
- Tạo audio ngôn ngữ đích sau khi bản dịch đích được duyệt.
- API narration generate-audio/translations cũ hiện chưa có provider, không dùng làm bằng chứng đã sinh file.

## 8. Thời hạn, gói và thanh toán — phần cần phối hợp

### 8.1. Phân biệt hai loại tiền/quyền

| Loại | DB hiện có | Ý nghĩa |
| --- | --- | --- |
| Phí/quyền xuất bản POI của chủ sạp | `PoiPaymentSessions`, POI payment/lifecycle/time fields | Nghiệp vụ chủ sạp, cần chốt giá/thời hạn và bằng chứng |
| Quyền nghe audio của khách | `AccessPaymentSessions`, `GuestAccessPasses`, `QRLocations` | Nghiệp vụ khách Mobile; không dùng thay gói thuê của chủ sạp |

Không gộp “gia hạn sạp/POI” với “vé nghe của khách” chỉ vì cả hai đều có thời hạn.

### 8.2. Cần nhóm xác nhận

- Gói dành cho sạp, từng POI hay khách? Có dùng chung cho nhiều POI không?
- Giá, đơn vị tiền, thời hạn tính ngày/phút; miễn phí/miễn phí thanh toán có tồn tại không?
- Gia hạn nối từ ngày hết hạn hiện tại hay ngày thanh toán? POI hết hạn có bị ẩn không?
- Thanh toán chuyển khoản hay provider nào? Ai xác minh, bằng chứng và mã giao dịch lấy từ đâu?
- Chính sách đổi gói/hủy/hoàn tiền và xử lý webhook trùng.

### 8.3. Phần được làm ngay trên schema cũ

- Admin có API tra cứu thời hạn và gửi proposal thay đổi `ValidFrom/ValidUntil`.
- Chủ sạp không có quyền sửa những trường này. Nếu cần xem hạn/yêu cầu gia hạn thì thêm API chỉ đọc/yêu cầu trong scope; **API hiện tại `/cms/validity` là Admin-only**.
- Admin hiện tra cứu session thanh toán, không xác minh được bằng chứng. Chủ sạp cần API giao dịch riêng với lọc theo user/POI, không gọi endpoint Admin rồi lọc bằng JavaScript.

### 8.4. Phần cần migration/API mới

Danh mục gói, đăng ký gói và bằng chứng thanh toán chưa có schema đầy đủ. Các tên `ServicePlans`, `ServiceSubscriptions`, `PaymentVerifications` là **đề xuất**, chưa phải bảng đã triển khai.

Sau khi nhóm xác nhận: lập migration thêm bảng/cột/FK/check/index tương thích; không sửa/xóa/backfill dữ liệu cũ tùy ý. API kích hoạt/gia hạn phải kiểm bằng chứng, mã giao dịch duy nhất, đúng tiền/currency/đích, transaction và chống xử lý hai lần.

`SimulatedMoMo` hoặc `Status=Paid` trong session không đủ chứng minh thanh toán hợp lệ. Không đặt thời hạn mới chỉ vì frontend nhận callback thành công. Backend Admin `mark-paid` hiện bị chặn khi chưa có verification; endpoint guest simulate-payment cũ vẫn là mô phỏng, không phải tích hợp thanh toán thật.

## 9. API đang có để người làm Chủ sạp dùng

Base URL Web: proxy `/api` vào Gateway `http://localhost:8000`. Endpoint trong bảng đã có prefix `/api/v1`. API nội dung có xác thực dùng `Authorization: Bearer <accessToken>`. Không gửi token/password vào Git hoặc tài liệu bàn giao.

| API hiện có | Dùng cho |
| --- | --- |
| `POST /api/v1/auth/login` | Đăng nhập với `{username,password}` |
| `POST /api/v1/auth/register` | Tạo Vendor với `{username,email,password,preferredLanguage}`; hiện chưa duyệt hồ sơ |
| `POST /api/v1/auth/refresh` | Refresh với `{refreshToken}` |
| `GET /api/v1/languages?activeOnly=true` | Danh sách ngôn ngữ |
| `GET /api/v1/cms/catalog/pois` | Danh sách POI đã lọc scope |
| `GET /api/v1/pois/{id}` | Chi tiết CMS; có overlay proposal |
| `POST /api/v1/pois`; `PUT/DELETE /api/v1/pois/{id}` | Tạo/sửa/gửi yêu cầu xóa POI |
| `GET /api/v1/geofence/by-poi/{id}`; `PUT /api/v1/geofence/by-poi/{id}` | Đọc/sửa vị trí/thông số POI trong scope; sửa qua proposal |
| `POST /api/v1/media/upload?poiId={id}` | Multipart field `file`; ảnh có thể thêm imageCategory |
| `GET /api/v1/cms/catalog/media?poiId={id}&fileType=image` | Ảnh trong scope; đổi fileType=audio để đọc file audio |
| `POST /api/v1/media/{id}/replacement`; `DELETE /api/v1/media/{id}` | Thay file/gửi yêu cầu xóa |
| `GET /api/v1/cms/submissions/{submissionId}/preview` | Stream file đề xuất có xác thực |
| `GET /api/v1/cms/media/images/{mediaId}/stream` | Preview CMS theo media ID; endpoint này cũng có thể stream audio media |
| `GET /api/v1/cms/catalog/narrations?poiId={id}` | Danh sách thuyết minh |
| `POST /api/v1/narrations`; `PUT /api/v1/narrations/{id}/content` | Tạo/sửa thuyết minh Pending |
| `GET /api/v1/cms/catalog/poi-translations?poiId={id}` | Danh sách bản dịch |
| `POST /api/v1/poi-translations`; `PUT/DELETE /api/v1/poi-translations/{id}` | Tạo/sửa/gửi yêu cầu xóa bản dịch |
| `GET /api/v1/cms/catalog/audio?poiId={id}` | Danh sách AudioTracks |
| `POST /api/v1/audio`; `PUT/DELETE /api/v1/audio/{id}` | Tạo/sửa/gửi yêu cầu xóa AudioTracks |
| `GET /api/v1/cms/audio-preview/{audioId}/stream` | Nghe thử track có xác thực |
| `GET /api/v1/cms/review-queue` | Queue đã lọc scope; trạng thái và loại resource |
| `GET /api/v1/cms/review-dossier/{submissionId}` | Hồ sơ gồm submission, canonical, proposed, submitter |
| `POST /api/v1/cms/{resource}/{id}/resubmit` | Gửi lại hồ sơ bị từ chối |
| `GET /api/v1/cms/console-summary`; `GET /api/v1/cms/statistics` | Tổng quan và thống kê trong scope |
| `GET/POST /api/v1/qr`; `PUT/DELETE /api/v1/qr/{id}` | QR thuộc scope; chính sách giá/thời hạn cần chốt |
| `GET /api/v1/cms/catalog/tours`; `GET /api/v1/web/tours/{id}/content` | Tour được phép quản lý |
| `POST /api/v1/tours/{id}/pois`; `DELETE /api/v1/tours/{id}/pois/{poiId}`; `PUT /api/v1/tours/{id}/pois/reorder` | Đề xuất thay đổi điểm dừng trong Tour |

Query catalog: `search`, `status`, `active`, `page`, `pageSize`; nội dung con có `poiId`, media có `fileType`. Queue: `status`, `resource`, `search`, `page`, `pageSize`. Statistics: `startDate`, `endDate` theo ngày UTC. `pageSize` catalog/queue tối đa 100.

Response thành công: `{success:true,message,data}`. Danh sách phân trang có `data.items`, `total`, `page`, `pageSize`. Các row CMS phần lớn dùng tên cột PascalCase như `Id`, `POIId`, `PoiId`, `LanguageCode`, `SubmissionStatus`, `SubmissionId`; endpoint Auth có field camelCase. Không trộn kiểu tên trường.

Xử lý lỗi: 401 cần đăng nhập lại; 403 không đủ quyền; 404 không có hoặc ngoài scope; 409 proposal/version/trạng thái xung đột; 422 input không hợp lệ; 501/503 tính năng/provider chưa hỗ trợ hoặc chưa cấu hình. Đọc `detail` từ Backend, không tự đổi lỗi thành dữ liệu mẫu.

**Admin dùng riêng:** `/cms/submissions/{id}/approve|reject`, `/cms/grants/...`, `/cms/vendors`, `/cms/validity`, `/cms/transactions`, `/cms/capabilities`, `/cms/languages`, `/cms/automation/...`, Users/Roles. Vendor không được gọi để làm nghiệp vụ riêng.

API public dành cho khách/Mobile không thay cho API CMS để sửa hoặc preview nội dung Pending.

## 10. Database và file source cần đọc

### 10.1. Bảng/cột thật cần tận dụng

| DB hiện có | Vai trò |
| --- | --- |
| `Users`, `Roles` | Tài khoản/vai trò; `IsActive` không phải trạng thái duyệt hồ sơ |
| `POIs.UserId` | Chủ sở hữu POI |
| `Tours.UserId`, `TourPOIs`, `TourTranslations` | Sở hữu Tour, điểm dừng/thứ tự và bản dịch |
| `EntityGrants.Resource/EntityId/UserId` | Quyền được Admin cấp thêm |
| `POIs.ValidFrom/ValidUntil` | Thời hạn POI; không phải danh mục gói |
| `MediaFiles.PoiId/RelativePath/FileType/ApprovalStatus` | Liên kết POI, vị trí file, loại và trạng thái media |
| `AudioTracks.POIId/FileUrl/LanguageCode/AudioType` | Liên kết audio thật với POI/ngôn ngữ |
| `NarrationDrafts`, `POITranslations` | Nội dung văn bản/bản dịch; liên kết publication của narration |
| `ContentSubmissions` | Proposal: Resource, EntityId, PayloadJson, BaseVersion, Operation, Status, người gửi/reviewer/lý do |
| `ContentVersions` | Snapshot/version của nội dung |
| `PoiPaymentSessions`, `AccessPaymentSessions`, `GuestAccessPasses` | Session/quyền; chưa là bằng chứng giao dịch xác thực |
| `NarrationLogs`, `Languages`, `AuditLogs` | Thống kê, ngôn ngữ, audit |

`ReviewStatus` của canonical và `SubmissionStatus` của proposal không đồng nghĩa. Ví dụ canonical Approved và proposal Pending là bình thường: khách vẫn dùng bản Approved cũ. Phải đọc đúng dữ liệu để hiển thị.

`MediaFiles.PoiId`, `AudioTracks.POIId`, `NarrationDrafts.PoiId` viết khác nhau; không tự đổi tên cột. Role IDs và ID POI/Tour lấy từ DB/API, không hardcode theo máy một thành viên. Enum số của POI/payment phải kiểm source/schema thật, không tự suy ra từ nhãn.

### 10.2. File bắt đầu đọc trong Web

- [src/App.tsx](src/App.tsx): route, sidebar, quyền hiển thị.
- [src/contexts/Session.tsx](src/contexts/Session.tsx): session/role.
- [src/services/api.ts](src/services/api.ts): request, token, envelope, upload.
- [src/pages/admin/ResourcePage.tsx](src/pages/admin/ResourcePage.tsx): CRUD/catalog POI/Tour/users.
- [src/pages/admin/ContentConsole.tsx](src/pages/admin/ContentConsole.tsx): thuyết minh/bản dịch/ảnh/audio.
- [src/components/AudioUploadDialog.tsx](src/components/AudioUploadDialog.tsx): thêm file audio và retry.
- [src/pages/admin/ReviewConsole.tsx](src/pages/admin/ReviewConsole.tsx): dossier/status/resubmit và controls Admin.
- [src/components/PoiPicker.tsx](src/components/PoiPicker.tsx), [src/components/Editor.tsx](src/components/Editor.tsx), [src/components/MediaPreview.tsx](src/components/MediaPreview.tsx): component có thể dùng lại.
- [src/pages/admin/TourEditor.tsx](src/pages/admin/TourEditor.tsx): bản dịch và thứ tự POI.

### 10.3. File Backend cần đối chiếu

- [Auth API](../../services/auth-service/app/api/auth.py), [Auth service](../../services/auth-service/app/services/auth_service.py): register/login/user và quyền.
- [Scope rules](../../services/content-service/app/core/access.py): owner/grants/role.
- [Review service](../../services/content-service/app/services/review_service.py): server-controlled fields, proposal/public, version, audio/media.
- [Review repository](../../services/content-service/app/repositories/review_repository.py): SQL scope, transactions và submission.
- [Admin API](../../services/content-service/app/api/admin.py), [Console API](../../services/content-service/app/api/admin_console.py): endpoint hiện có.
- [Automation API](../../services/content-service/app/api/admin_automation.py): provider và giới hạn quyền hiện tại.
- [Public repository](../../services/content-service/app/repositories/content_repository.py): điều kiện lọc public cho Mobile.

Các file cũ `ContentPage.tsx`, `ReviewPage.tsx`, `Dashboard.tsx` hiện re-export các Console tương ứng; đọc implementation thực thay vì viết thêm phiên bản trùng.

## 11. Danh sách công việc giao cho người làm Chủ sạp

| Mã | Ưu tiên | Công việc cụ thể | Kết quả phải bàn giao |
| --- | --- | --- | --- |
| CS-01 | P0 | Audit giao diện với role Vendor; lập danh sách route/nút đúng quyền | Ma trận quyền cập nhật; mọi direct URL trái quyền bị chặn |
| CS-02 | P0 | Hoàn thiện POI của tôi, detail, tạo/sửa/vị trí, validation, tìm kiếm/lọc/phân trang | Vendor A không lấy/sửa POI Vendor B; owner do server gán |
| CS-03 | P0 | Hoàn thiện text/ảnh và queue của Vendor | Preview đúng proposal, status/lý do, sửa/gửi lại; giữ public cũ |
| CS-04 | P0 | Hoàn thiện thư viện audio và chọn file audio đã upload chưa liên kết | Upload + track hoạt động; retry không trùng; preview thật; title tối đa 200 |
| CS-05 | P0 | Chuẩn bị bộ dữ liệu demo thật với người làm Admin | Ít nhất một POI có text/ảnh/audio được duyệt và nghe trên Mobile; không seed giả thay dữ liệu thật |
| CS-06 | P1 | Chốt hồ sơ chủ sạp, policy đăng nhập/tạo POI và tài khoản cũ | Đặc tả nghiệp vụ + migration/API được nhóm review trước khi áp dụng |
| CS-07 | P1 | Làm registration/profile/application/status/resubmit sau CS-06 | Luồng Vendor–Admin đầy đủ, reviewer audit/version và quyền Backend |
| CS-08 | P1 | Cho Vendor xem thời hạn trong scope, thể hiện chưa bắt đầu/sắp hết/hết hạn | API Vendor thích hợp; không gọi API Admin hoặc tự sửa hạn |
| CS-09 | P2 | Chốt gói, giá, target, provider và đối soát; làm đăng ký/gia hạn/giao dịch riêng | Migration/API thật; chỉ kích hoạt theo bằng chứng; chống lặp |
| CS-10 | P2 | Luồng yêu cầu dịch/TTS của Vendor nếu nhóm cần | Nguồn Approved, scope; provider thật; result Pending; không mở endpoint Admin tùy tiện |
| CS-11 | P1 | QR chỉ xem/tải trong POI; thống kê riêng; phối hợp chặn Tour/QR config/bản dịch write cho Vendor tại Backend | Ít chức năng hơn Admin; không có CRUD Tour/QR hoặc thống kê toàn hệ thống |
| CS-12 | Mỗi module | Test, README, báo cáo kết quả/API/migration | Build/lint/unit/E2E và SQL tests liên quan; ghi giới hạn thật |

P0: dùng được phần nội dung đã có schema để demo. P1: quy trình hồ sơ và thời hạn cần API/policy bổ sung. P2: nghiệp vụ mở rộng có thêm schema/provider; không làm trước khi nhóm xác nhận.

GPS/geofencing, hàng đợi phát theo vị trí và offline của khách là phần Mobile, không giao sang Chủ sạp chỉ vì DB có bán kính/audio. Chủ sạp cung cấp dữ liệu đúng để nhóm Mobile sử dụng.

## 12. Kịch bản kiểm thử bắt buộc

Chuẩn bị Admin, Vendor A, Vendor B từ DB/API thật. Admin cấp đúng scope theo kịch bản; không tạo giả dữ liệu production. Integration SQL dùng transaction rollback và dọn file thử.

| Kịch bản | Kết quả mong đợi |
| --- | --- |
| Chưa đăng nhập mở trang Vendor/CMS | Về Login; API protected 401 |
| Vendor A tạo POI | Owner A do server gán; Pending; Mobile chưa thấy |
| Vendor A gửi payload owner/status/version/payment | Backend từ chối, không được tự nâng quyền/công khai |
| Vendor A đổi ID thành POI Vendor B | API ngoài scope 404; không lộ dữ liệu/count |
| Search/filter/page của A | Chỉ nội dung trong scope, cả total lẫn items |
| Admin cấp/thu hồi grant | Quyền thay đổi đúng; sau thu hồi A không tiếp tục sửa POI đó |
| Vendor mở Users/Roles/Transactions/Validity/Admin automation | 403; giao diện không có thao tác quản trị |
| Vendor gọi approve/reject nội dung | 403 dù gửi HTTP thủ công |
| Admin reject không có lý do | Bị từ chối; nhập lý do hợp lệ mới xử lý |
| Vendor sửa/resubmit nội dung bị reject | Proposal Pending mới; lý do cũ không bị mất khỏi lịch sử |
| Sửa POI/ảnh/audio đã public nhưng chưa approve | Mobile tiếp tục nhận bản cũ; preview Vendor hiển thị proposal |
| Upload audio thành công nhưng create track lỗi | Báo đúng giai đoạn; retry dùng lại media, không duplicate upload |
| File đã upload nhưng chưa liên kết track | Có thể chọn file và tạo AudioTracks đúng POI; không cần upload lại |
| File không tồn tại | Preview/stream báo lỗi; approve file không tồn tại bị chặn |
| Admin duyệt AudioTrack trước media | Bị chặn; media Approved rồi track mới duyệt được |
| Audio media thuộc POI khác | Không được gắn track vào POI đang sửa |
| Ngôn ngữ không có audio/file khả dụng | Báo thiếu nội dung; không giả phát thành công |
| Proposal Superseded hoặc BaseVersion cũ | 409; không ghi đè bản mới |
| Đổi role/khóa tài khoản khi còn token | Token cũ không giữ quyền trái policy |
| Thời hạn sai thứ tự, tiền âm hoặc input quá dài | Validation ở frontend và Backend; không lỗi SQL không kiểm soát |
| Session mô phỏng/Paid không có chứng cứ | Không được coi Verified/kích hoạt/gia hạn thành công |
| Viewport desktop/tablet, mạng lỗi/double-click | Không vỡ bố cục; loading/error/disable/retry đúng |

Khi làm hồ sơ/gói mới, thêm test cho hai Vendor, Admin, version conflict, rejection/resubmit, tài khoản cũ và idempotency. Không chỉ kiểm việc nút có xuất hiện.

Các test tham khảo hiện có: `tests/e2e/review.spec.ts`, `tests/e2e/audio-upload.spec.ts`, `tests/e2e/admin-console.spec.ts`, `services/content-service/tests/test_review_sqlserver.py`, `test_admin_console_sqlserver.py`, `services/auth-service/tests/test_permissions.py`.

## 13. Chạy dự án và bàn giao

### 13.1. Chạy trên máy phát triển

Root dự án là `AudioTour_Seminar`; thư mục Web là `apps/web`. Cấu hình SQL/JWT/media ở `.env` root; dùng `.env.example` để tham khảo và không đưa secrets vào Git. Auth và Content cần cùng DB và cấu hình JWT tương thích.

Mở ba terminal riêng tại root:

```powershell
python scripts/serve.py auth
python scripts/serve.py content
python scripts/serve.py gateway
```

Nếu Python hệ thống không dùng được và repo có portable Python thì thay `python` bằng `& .\.tooling\python\python.exe`.

Trong `apps/web`:

```powershell
npm.cmd run dev
```

Mở `http://localhost:5173/login`. Gateway 8000, Auth 8001, Content 8002. Vite `ECONNREFUSED 127.0.0.1:8000` thường là Gateway chưa chạy. Để nhóm Mobile test cùng mạng, thống nhất URL backend với người làm Mobile; script LAN hiện ưu tiên Content API 8002, Web dùng Gateway 8000.

DB dump chỉ có schema/metadata, không chứa ảnh/audio. Cần thư mục uploads thực và MEDIA_ROOT đúng; import SQL không làm file âm thanh tự xuất hiện.

### 13.2. Kiểm tra trước bàn giao

Trong Web:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
$env:WEB_BROWSER_CHANNEL='msedge'
npm.cmd run test:e2e
```

Backend từ root, với dependencies/SQL đã cấu hình:

```powershell
python scripts/test_auth.py
$env:AUDIOTOUR_SQL_TESTS='1'
python scripts/test_content.py
```

SQL tests hiện có fixture theo DB của nhóm; kiểm tài khoản/ID phù hợp trước khi chạy ở máy khác. Test E2E mặc định có mock ở lớp test; kiểm live cần bật đúng env và Backend thật. Mock test không được đưa vào màn hình Vendor production.

### 13.3. Nội dung bàn giao cuối mỗi module

- Màn hình/luồng đã hoàn thiện, quyền áp dụng và ảnh chụp demo.
- API dùng sẵn/API mới, payload/response/error và người chịu trách nhiệm Backend.
- Bảng/cột đã đối chiếu; migration đề xuất/đã được nhóm duyệt, không giấu schema thay đổi.
- Kết quả test thực tế, test nào mock/SQL thật/điện thoại thật, phần nào chưa kiểm.
- Dữ liệu demo/file thật đã chuẩn bị, ID lấy từ DB hiện tại và trạng thái duyệt.
- Việc cần người làm Admin hỗ trợ: tạo/cấp tài khoản, grants, review, hạn/gói/provider.

## 14. Các ràng buộc và lưu ý cuối

1. Audit SQL Server thật trước khi code; không giả định tên bảng/cột, FK, enum hoặc role ID.
2. Tận dụng API/component hiện có. Nếu thiếu Backend thì triển khai API đúng quyền, không tạo nút thành công giả.
3. Chỉ làm Web Chủ sạp và Backend cần thiết; không sửa `apps/mobile` hoặc phá hợp đồng API Mobile trong phạm vi bàn giao này.
4. Không xóa dữ liệu cũ, tự chuyển owner, tự approve seed, tự gia hạn hoặc tạo file/URL giả thay media thật.
5. Không tự áp dụng migration đề xuất khi nghiệp vụ chưa chốt; không tự commit/push.
6. Không gửi mật khẩu/JWT/secret trong tài liệu hoặc source.
7. Phần payment/owner/hồ sơ chưa rõ phải ghi câu hỏi và thống nhất với nhóm trước khi quyết định.
8. Làm theo từng module, kiểm thử rồi mới sang module tiếp theo.

## 15. Phạm vi giao diện Chủ sạp: ít chức năng hơn Admin

### 15.1. Menu tối thiểu cần làm

| Menu Vendor | Nội dung | Không đưa vào menu này |
| --- | --- | --- |
| Tổng quan sạp | POI trong scope, hồ sơ đang chờ/bị từ chối, nhắc thiếu nội dung | Tổng user, doanh thu/toàn bộ POI/Tour của hệ thống |
| Hồ sơ sạp | Hồ sơ của chính mình, gửi duyệt/sửa/gửi lại | Duyệt sạp khác, cấp vai trò, khóa tài khoản khác |
| POI của tôi | Danh sách/tạo/sửa POI; ảnh, text, audio gắn theo từng POI | Quản lý POI toàn hệ thống, tự đổi owner hoặc public status |
| Trạng thái gửi duyệt | Đề xuất trong scope, lý do từ chối, sửa/gửi lại | Nút duyệt/từ chối; queue toàn hệ thống |
| Thống kê của tôi | Lượt theo POI/ngày trong scope, nếu dữ liệu đã có | Thiết bị/giao dịch/tuyến của toàn hệ thống |

“Hồ sơ sạp” chỉ hoạt động khi đã có migration/API thật; trong thời gian chưa có, thể hiện chưa hỗ trợ hoặc chưa đưa vào menu hoạt động. Không hiển thị form lưu thành công giả.

“Dịch vụ của tôi” có thể bổ sung sau: xem gói/thời hạn/giao dịch riêng, yêu cầu gia hạn theo API đã được triển khai. Không đưa vào menu như chức năng hoàn chỉnh khi Backend chưa hỗ trợ.

### 15.2. Gom nội dung vào chi tiết POI

Chi tiết một POI có các tab:

1. **Thông tin:** tên, danh mục, mô tả ngắn, tọa độ/bán kính của POI đó.
2. **Giới thiệu:** văn bản nguồn, preview, thay đổi chờ duyệt.
3. **Hình ảnh:** upload/preview/thay ảnh trong POI đó.
4. **Âm thanh:** thêm file, chọn ngôn ngữ, nghe thử và trạng thái.
5. **Bản dịch:** chỉ xem bản dịch/trạng thái theo ngôn ngữ ở phạm vi mặc định.
6. **Mã QR:** chỉ xem/tải mã đã cấp, không chỉnh giá/thời gian/quyền nghe.
7. **Lịch sử gửi duyệt:** các đề xuất thuộc POI đó; không có approve/reject.

Không cần bảy menu độc lập “Bản đồ toàn hệ thống”, “Thư viện ảnh”, “Thư viện audio”, “Dịch thuật”, “TTS”, “Tour”, “QR” giống Admin. Bản đồ là công cụ chọn vị trí trong form POI; ảnh/text/audio là nội dung con của POI.

### 15.3. Chức năng không thuộc Chủ sạp

- Quản lý user/role, cấp/thu hồi grant hoặc chuyển chủ sở hữu.
- Duyệt/từ chối hồ sơ sạp, đăng ký POI, ảnh, văn bản, audio/bản dịch.
- Quản lý danh mục Tour và thứ tự điểm dừng.
- Quản lý ngôn ngữ, provider/giọng đọc/TTS và cấu hình hệ thống.
- Tạo/sửa danh mục gói, giá/quyền nghe QR, tự gia hạn hoặc đánh dấu đã thanh toán.
- Tra cứu/đối soát giao dịch và thống kê toàn hệ thống.

Chủ sạp gửi nội dung/yêu cầu; Admin xem xét, duyệt và cấu hình. Việc ít menu phải đi cùng với ít quyền ghi trên Backend.

## 16. Cấu trúc file đề xuất cho Web Chủ sạp

**Đây là cây file cần tạo trong cùng `apps/web`, không phải dự án mới và không phải cây đã tồn tại.** File có ghi “đã có” dùng lại. File hồ sơ/dịch vụ chỉ triển khai khi API/schema tương ứng sẵn sàng.

```text
apps/web/
├── src/
│   ├── App.tsx                         # Đã có: nối route Vendor/Admin và phân luồng
│   ├── contexts/
│   │   └── Session.tsx                 # Đã có: dùng chung session; không tạo session Vendor thứ hai
│   ├── layouts/
│   │   └── VendorLayout.tsx             # Mới: sidebar 5 mục, header, Outlet, đăng xuất
│   ├── routes/
│   │   ├── RoleGate.tsx                 # Mới: kiểm role trước khi mount trang/gọi API
│   │   └── vendorRoutes.tsx             # Mới: khai báo/export nhóm route Vendor
│   ├── pages/
│   │   ├── admin/                      # Đã có: giữ các trang quản trị
│   │   └── vendor/
│   │       ├── VendorDashboard.tsx       # Tổng quan trong scope
│   │       ├── VendorProfile.tsx         # Hồ sơ chính mình; cần API/migration
│   │       ├── VendorPoiList.tsx         # Danh sách POI trong scope
│   │       ├── VendorPoiEditor.tsx       # Tạo/sửa thông tin POI được phép
│   │       ├── VendorPoiDetail.tsx       # Tải POI, điều phối các tab nội dung
│   │       ├── VendorSubmissions.tsx     # Danh sách/chi tiết đề xuất, resubmit
│   │       ├── VendorStatistics.tsx      # Thống kê riêng
│   │       ├── VendorServices.tsx        # Giai đoạn sau: hạn/gói/giao dịch riêng
│   │       └── poi-tabs/
│   │           ├── IntroductionTab.tsx  # Văn bản nguồn và preview
│   │           ├── ImagesTab.tsx        # Ảnh của một POI
│   │           ├── AudioTab.tsx         # File/track của một POI
│   │           ├── TranslationsTab.tsx  # Chỉ xem bản dịch
│   │           ├── QrTab.tsx            # Chỉ xem/tải mã đã cấp
│   │           └── SubmissionHistoryTab.tsx
│   ├── components/
│   │   ├── vendor/
│   │   │   ├── VendorSidebar.tsx         # Menu tĩnh theo chức năng Vendor
│   │   │   ├── VendorPoiForm.tsx         # Whitelist trường của Vendor
│   │   │   └── VendorDossier.tsx         # Xem hồ sơ/rejection, không có duyệt
│   │   ├── Editor.tsx                  # Đã có: form chung
│   │   ├── States.tsx                  # Đã có: loading/empty/error
│   │   ├── AdminTable.tsx              # Đã có: có thể tách/dùng Filters, Pagination
│   │   ├── ReviewStatus.tsx            # Đã có: nhãn trạng thái/lý do
│   │   ├── MediaPreview.tsx            # Đã có: stream preview có xác thực
│   │   ├── PoiPicker.tsx               # Đã có: danh sách POI từ Backend
│   │   └── AudioUploadDialog.tsx        # Đã có: dùng lại; cần bổ sung khóa POI khi mở từ tab
│   ├── hooks/
│   │   └── useResource.ts              # Đã có: loader/retry, bỏ response cũ
│   ├── services/
│   │   ├── api.ts                      # Đã có: request/token/envelope dùng chung
│   │   └── vendorApi.ts                # Mới: wrapper đúng thao tác Vendor, không gọi API Admin-only
│   ├── types.ts                        # Đã có: ưu tiên dùng kiểu chung
│   └── styles.css                      # Đã có: thêm style Vendor theo thiết kế chung
└── tests/
    ├── e2e/
    │   ├── vendor-navigation.spec.ts    # Role/menu/direct URL
    │   ├── vendor-poi.spec.ts           # CRUD trong scope, validation
    │   ├── vendor-content.spec.ts       # Upload/text/audio và proposal
    │   └── vendor-submissions.spec.ts   # Reject reason/sửa/resubmit/public cũ
    └── vendor-permissions.test.ts       # Mapping quyền/whitelist form có ý nghĩa
```

Không phải tạo mọi file cùng lúc. Bắt đầu `RoleGate`, `VendorLayout`, `VendorPoiList/Editor/Detail`, `VendorSubmissions`; sau đó tách các tab khi nội dung đủ lớn. Có thể gom component nhỏ, tránh file rỗng chỉ để đúng cây.

### 16.1. Trách nhiệm từng lớp

| Lớp | Được làm | Không đặt ở đây |
| --- | --- | --- |
| Layout/sidebar | Điều hướng, header, đăng xuất, Outlet | SQL, gọi endpoint duyệt, sửa role |
| Page/tab | State tương tác, form, loading/error, gọi wrapper API | Tin ownerId từ URL là quyền hợp lệ |
| Component form/preview | Hiển thị/validation trước gửi, stream có token | Tự đặt ApprovalStatus/PaymentStatus hoặc thông báo public giả |
| `vendorApi.ts` | Tạo request đúng contract, whitelist payload | Query SQL, lấy toàn DB rồi lọc user ở client |
| Backend service/repository | Kiểm role/scope, validation, transaction/version | Tin client đã ẩn nút nên không cần kiểm quyền |

`vendorApi.ts` vẫn có thể gọi các endpoint CRUD nội dung hiện có; không bắt buộc tạo namespace `/vendor` cho mọi API. Namespace mới chỉ dành cho nghiệp vụ còn thiếu như hồ sơ/gói/giao dịch riêng. Việc endpoint có tên `cms` hoặc hàm frontend `api.admin` không tự cấp quyền Admin: JWT và guard Backend mới quyết định.

## 17. Route, menu và phân luồng đăng nhập

### 17.1. Nhóm route cần nối

| Route đề xuất | Trang | Quyền/tình trạng |
| --- | --- | --- |
| `/login` | Login hiện có | Chưa đăng nhập |
| `/register` | Form đăng ký Vendor mới | Không cho người đăng ký chọn role |
| `/vendor` hoặc `/vendor/dashboard` | VendorDashboard | Vendor |
| `/vendor/profile` | VendorProfile | Vendor; cần API hồ sơ thật |
| `/vendor/pois` | VendorPoiList | Vendor; danh sách trong scope |
| `/vendor/pois/new` | VendorPoiEditor | Vendor; tạo Pending |
| `/vendor/pois/:id` | VendorPoiDetail | Vendor; Backend kiểm scope |
| `/vendor/pois/:id/edit` | VendorPoiEditor | Vendor; chỉ trường được phép |
| `/vendor/submissions` | VendorSubmissions | Vendor; queue trong scope |
| `/vendor/submissions/:submissionId` | VendorDossier | Vendor; xem, sửa/resubmit |
| `/vendor/statistics` | VendorStatistics | Vendor; dữ liệu riêng |
| `/vendor/services` | VendorServices | Bổ sung sau khi có API thực |
| `/admin/...` | Các trang Admin hiện có | Tách khỏi Vendor; giữ đúng quyền các vai trò quản lý khác |

Ảnh/audio/text/bản dịch/QR nằm trong các tab POI, không tạo lại toàn bộ route quản trị tương ứng cho Vendor.

### 17.2. Các chỗ phải cập nhật khi triển khai

1. Trong `Login.tsx`, sau login thành công: Vendor đến `/vendor/dashboard`; vai trò quản lý khác đến nhánh được cấp. Đổi cả trường hợp đã đăng nhập mở lại `/login`, không chỉ callback submit.
2. Root `/` và route index phải chuyển theo role; không luôn đẩy Vendor về `/admin`.
3. Bọc nhóm `/vendor` bằng RoleGate cho Vendor và VendorLayout. RoleGate phải chạy trước khi page mount/gọi API.
4. Loại Vendor khỏi nhánh màn hình Admin sau khi Vendor routes sẵn sàng; nhập trực tiếp URL `/admin/users`, `/admin/tours`, `/admin/settings` không mở được trang quản trị.
5. Giữ nguyên chính sách của `ContentAdmin`, `TourOperator`, `AnalyticsViewer`; không coi họ là Vendor hoặc tự nâng họ lên Admin khi refactor.
6. Logout/hết phiên/401 phải xóa session và về Login. Reload một URL Vendor vẫn phải kiểm session/role/scope.

Ví dụ guard mới, **chỉ là hướng dẫn**, chưa được thêm vào source:

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from '../contexts/Session';

export function RoleGate({ allowed }: { allowed: string[] }) {
  const { session } = useSession();
  if (!session) return <Navigate to="/login" replace />;
  if (!allowed.includes(session.role)) {
    return <div className="state" role="alert">Bạn không có quyền mở trang này.</div>;
  }
  return <Outlet />;
}
```

Nếu tách `vendorRoutes.tsx`, export cấu hình route hoặc các phần tử `<Route>` để `App.tsx` nối đúng cách. Không đặt component tùy ý trực tiếp bên trong `<Routes>` như thể đó là `<Route>`; hoặc dùng một nested router theo `/vendor/*` nhất quán với phiên bản React Router hiện có.

### 17.3. Không tái sử dụng nguyên trang Admin cho Vendor

- Có thể dùng Filters/Pagination/ReviewStatus/MediaPreview/Editor/PoiMap, API request và types chung.
- Không đưa `ScopeEditor` vào Vendor: component này gọi Users/Grants và có nút cấp quyền Admin.
- Không mount `OperationsPage` để Vendor xem hồ sơ sạp/giao dịch/hạn: API ở đó đang Admin-only.
- Không mount `AutomationPage` cho Vendor: API đang Admin-only.
- `ContentConsole` hiện dựa trên `writeRoles`, nên Vendor có thể thấy nút sửa bản dịch. Muốn tab bản dịch chỉ đọc thì tạo wrapper/tab đúng quyền hoặc refactor capability rõ ràng; đừng copy nguyên trang rồi chỉ đổi tiêu đề.
- `ReviewConsole` hiện dùng role để ẩn approve/reject; có thể tách phần dossier dùng chung, nhưng VendorDossier chỉ có preview, lý do và resubmit.
- `AudioUploadDialog` hiện cho chọn POI. Khi mở từ chi tiết POI, truyền đúng POI; nên có chế độ khóa POI để tránh gắn nhầm. Backend vẫn kiểm parent/scope.

## 18. Thu hẹp quyền Backend cho đúng phần Chủ sạp

**Hiện trạng cần sửa khi triển khai:** `WRITE_ROLES` hiện có Vendor, và guard nội dung đang cho Vendor ghi Tour, QR, bản dịch trong scope. Tách menu/route không tự chặn những request ghi này. Đây là công việc bổ sung, chưa được áp dụng bởi tài liệu.

### 18.1. Chính sách mặc định cần đạt

| Resource/hành động | Vendor mặc định | Người quản lý |
| --- | --- | --- |
| POI thông tin/vị trí, text nguồn, ảnh/audio | Ghi trong scope, luôn qua review với nội dung được quản lý bằng submission | Admin và vai trò nội dung có scope phù hợp |
| POI owner/publication/payment/time fields | Không ghi | Server/Admin theo nghiệp vụ riêng |
| Bản dịch POI | Chỉ đọc trong scope | Admin/ContentAdmin sửa theo quyền, qua review |
| Tour/bản dịch Tour/thứ tự điểm dừng | Không có API quản trị ghi cho Vendor | Admin/TourOperator và vai trò được nhóm phân công rõ |
| QR đã cấp cho POI | Chỉ đọc/tải | Admin tạo/sửa/xóa, quản lý giá/quyền/thời hạn |
| User/role/grants/languages/system/automation | Không quản lý | Theo các guard quản trị hiện có |
| Hồ sơ Vendor | Chỉ hồ sơ chính mình khi có API | Admin review |
| Hạn/gói/giao dịch | Đọc/yêu cầu trong scope qua API Vendor khi triển khai | Admin cấu hình/đối soát; không tin callback frontend |

Grant cho POI là quyền nội dung trong phạm vi POI, không phải quyền duyệt/quản trị. Grant Tour cũng không tự biến Vendor thành TourOperator nếu chính sách mới cấm Vendor quản trị Tour. Nếu một thành viên cần nhiệm vụ rộng hơn, nhóm dùng vai trò/capability được phân công và kiểm thử, không bật toàn bộ menu Admin cho Vendor.

### 18.2. File Backend phải kiểm tra và sửa đúng chỗ

```text
services/content-service/app/
├── core/access.py                     # Đã có: giữ owner/grant; thêm capability/action guard nếu cần
├── api/admin.py                       # Đã có: bảo vệ endpoint ghi Tour/QR/bản dịch, các alias cũ
├── api/admin_console.py               # Đã có: catalog/dossier/summary trong scope; admin-only giữ nguyên
├── services/review_service.py          # Đã có: kiểm action tại service, không chỉ tại router
├── repositories/review_repository.py   # Đã có: SQL count/rows lọc scope
├── api/vendor.py                      # Đề xuất mới: hồ sơ, hạn/gói/giao dịch riêng khi thiếu API
├── schemas/vendor.py                  # Đề xuất mới: DTO nghiệp vụ mới, chỉ trường được phép
├── services/vendor_service.py          # Đề xuất mới: hồ sơ/yêu cầu riêng, gọi lại service nội dung đã có
└── repositories/vendor_repository.py   # Đề xuất mới: chỉ SQL mới, không sao chép CRUD POI/media

services/auth-service/app/
├── api/auth.py                        # Đã có: register/login; không cho đăng ký tự chọn role
└── services/auth_service.py            # Đã có: phối hợp policy duyệt hồ sơ sau khi chốt schema

services/content-service/tests/
└── test_vendor_capabilities_sqlserver.py # Đề xuất mới: quyền bị cấm + scope/public preservation
```

- Chặn quyền ghi ở cả router và service thích hợp; đường gọi nội bộ/alias không được bỏ qua policy.
- Kiểm đủ create/update/delete, thêm/xóa/reorder điểm dừng, add/update/delete translation và QR create/update/delete. Không chỉ sửa endpoint danh sách.
- Không xóa Vendor khỏi `WRITE_ROLES` một cách toàn cục, vì sẽ làm hỏng POI/text/ảnh/audio hợp lệ. Kiểm quyền theo resource **và hành động**.
- Khai báo whitelist payload POI của Vendor: trường nội dung/vị trí được phép; loại owner, review, publication, payment, validity, version và reviewer metadata. Không dùng `...row` từ form để gửi nguyên bản ghi SQL.
- Đọc/sửa hồ sơ/giao dịch riêng phải dùng ID từ JWT và scope SQL, không nhận userId để truy cập tùy ý.
- Backend không có API scoped đọc hạn/giao dịch Vendor thì phải bổ sung thật; không đổi endpoint Admin toàn hệ thống thành Vendor-access rồi lọc ở client.
- Policy thu hẹp phải áp dụng cả token đang tồn tại; không cần xóa dữ liệu/owner/grants cũ để chặn một quyền ghi mới.
- Cập nhật tests trước/đồng thời với guard: những test cũ cho Vendor quản lý Tour không còn là tiêu chí đúng theo phạm vi mới. Giữ test hành vi Tour cho Admin/TourOperator, thêm test Vendor bị cấm.

Không có schema mới thì có thể triển khai ngay phần giới hạn role/action cho resource hiện có. Hồ sơ/gói/verification vẫn phải đề xuất migration trước khi thực hiện như mục 5 và 8.

## 19. Thứ tự tạo file và checklist phân quyền để bàn giao

### 19.1. Triển khai theo từng đợt

1. **Menu/route:** `RoleGate`, `VendorLayout`, `VendorSidebar`, nối `App.tsx`/Login; chỉ menu tối thiểu, không đổi behavior của vai trò khác.
2. **Nội dung POI:** `VendorPoiList`, `VendorPoiEditor`, `VendorPoiForm`, `VendorPoiDetail`, `vendorApi`; tích hợp CRUD scoped và validation hiện có.
3. **Nội dung con:** introduction/images/audio tabs; reuse preview/upload; bản dịch/QR chỉ đọc.
4. **Gửi duyệt:** `VendorSubmissions`, `VendorDossier`, history tab; rejection reason/resubmit, không có controls Admin.
5. **Backend capability:** chặn thao tác quản trị Tour/QR/bản dịch cho Vendor theo policy mới và test direct API. Không bàn giao như đã phân quyền xong nếu chỉ hoàn thành các bước giao diện.
6. **Tổng quan/thống kê:** dùng số liệu scoped thật; cảnh báo thiếu file/thiếu nội dung, không gọi Users/giao dịch toàn hệ thống.
7. **Hồ sơ/dịch vụ:** triển khai khi nhóm chốt schema/API. Không dựng mọi trang mới trước rồi mới nghĩ quyền dữ liệu.

### 19.2. Checklist thêm vào nghiệm thu

- [ ] Vendor đăng nhập đến `/vendor`, Admin đến nhánh quản trị phù hợp.
- [ ] Sidebar Vendor ít mục hơn Admin, không có Tour, Users, Grants, System, Languages, Automation hoặc queue duyệt toàn hệ thống.
- [ ] Text/ảnh/audio chỉ xuất hiện trong POI được sở hữu/cấp quyền; ID cha đổi trên request không vượt scope.
- [ ] Bản dịch và QR chỉ đọc; không có edit/delete/config giá hoặc quyền nghe cho Vendor.
- [ ] Truy cập URL Admin trực tiếp bị chặn trước khi page mount/gọi API quản trị.
- [ ] HTTP thủ công ghi Tour/QR/bản dịch trả 403 theo policy mới, kể cả các alias cũ.
- [ ] HTTP thủ công approve/reject/owner/payment/validity/grants bị chặn.
- [ ] POI/text/media/audio hợp lệ của Vendor vẫn tạo/sửa/gửi duyệt được sau khi thêm guard mới.
- [ ] Count/search/pagination/summary của Vendor vẫn chỉ phản ánh scope.
- [ ] Admin/TourOperator/ContentAdmin/AnalyticsViewer giữ đúng quyền được giao; không bị thay đổi ngoài phạm vi.
- [ ] Khóa tài khoản/đổi role/thu hồi grant có hiệu lực với token cũ.
- [ ] Chỉnh sửa Pending không làm đổi bản đã public trên API Mobile.
- [ ] Hồ sơ/gói/giao dịch chưa có Backend được ghi rõ là chưa hỗ trợ, không báo lưu/thanh toán thành công giả.

Phân quyền hoàn thành khi **menu đúng + route đúng + API đúng + scope SQL đúng**, không chỉ khi giao diện có ít nút hơn.

Tham khảo: [Báo cáo toàn đồ án](docs/project-status-2026-10-14.md), [Audit Admin](docs/admin-audit.md), [Đề xuất migration chưa áp dụng](docs/admin-business-migration-proposal.md), [Contract dịch/TTS](docs/admin-provider-contract.md), [API tích hợp Mobile](../../docs/api-contracts/mobile-integration.md).
