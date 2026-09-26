PROMPT THIẾT KẾ FIGMA — KhanhHoi AudioTour Mobile App (React Native)

Loại sản phẩm: Ứng dụng mobile (iOS + Android) bằng React Native, thiết kế lại cho khách du lịch (guest-facing), dựa trên web public hiện có của "KhanhHoi AudioTour" — app thuyết minh audio đa ngôn ngữ tự động theo vị trí GPS cho khu ẩm thực/phố cổ Vĩnh Hy.

1. Định vị & phong cách
Dark mode làm mặc định (nền 
#030712–
#111827, card 
#1f2937/border 
#374151), chữ trắng/
#e5e7eb.
Accent chính: xanh emerald (
#10b981/
#059669) cho CTA điều hướng, nghe, xác nhận.
Accent phụ: hồng (
#db2777) chỉ dùng riêng cho nút Thanh toán/Mua vé.
Bo góc lớn (16–20px), thẻ nổi nhẹ (shadow mềm), ảnh full-bleed ở hero.
Font hệ thống (SF Pro / Roboto), tiêu đề đậm (bold/extrabold), mô tả text-sm xám 
#9ca3af.
Cảm giác: hiện đại, tối giản, giống app hướng dẫn du lịch cao cấp (không giống app CMS).
2. Kiến trúc thông tin & điều hướng

Bottom Tab Bar (5 mục, icon + label):

Trang chủ — Home
Bản đồ — Map (mặc định mở GPS)
Tour — Tours
Vé — Packages/Passes
Tìm kiếm — Search

Nút quét QR nổi bật (FAB tròn emerald, icon QR) đặt giữa/nổi trên tab bar — vì quét QR là điểm vào chính của khách thực tế.

3. Danh sách màn hình cần thiết kế

A. Onboarding (mới, web không có)

3 slide: giới thiệu app → quét QR mua vé → nghe thuyết minh tự động theo GPS
Chọn ngôn ngữ ngay từ đầu (6 cờ: Tiếng Việt, English, 中文, 한국어, 日本語, Français)

B. Trang chủ

Hero full-width: ảnh địa điểm nổi bật overlay tối, tiêu đề "KhanhHoi AudioTour", mô tả ngắn, 3 nút: Khám phá địa điểm / Khám phá tour / Gói vé
Section "Địa điểm nổi bật": carousel/grid card ảnh (16:9), tên, mô tả 2 dòng, badge category
Section "Tour nổi bật": card có thời lượng ước tính (phút), mô tả

C. Danh sách địa điểm (Địa điểm)

Grid 2 cột card ảnh, tên, mô tả ngắn, badge danh mục ở góc ảnh
Filter theo danh mục (chip scroll ngang)

D. Chi tiết địa điểm — màn hình quan trọng nhất

Ảnh hero lớn (có thể vuốt gallery)
Tên, mô tả ngắn (emerald), mô tả dài
2 nút: "Xem trên bản đồ" (emerald) / "Nghe ngay" hoặc "Chọn gói vé" nếu chưa có vé
Panel "Âm thanh theo ngôn ngữ đã chọn":
Nếu chưa có vé → Access Required panel: thông báo cần vé + nút mua
Nếu có vé → đồng hồ đếm ngược thời gian còn lại của vé, văn bản thuyết minh, audio player (waveform/progress bar, play/pause, tốc độ phát)
Nếu vé hết hạn → Access Expired panel
Section ảnh Menu (grid 2 cột)
Section ảnh Highlights (grid 2 cột)

E. Bản đồ (Map) — tính năng lõi

Full-screen map, marker tròn cho từng địa điểm (icon danh mục + số thứ tự nếu đang trong tour)
Vòng tròn bán kính geofence quanh mỗi điểm (mờ, viền emerald)
Chấm vị trí người dùng thời gian thực + vòng độ chính xác GPS
Toggle "Tự động phát khi vào khu vực" (on/off)
Card bottom-sheet khi chạm marker: ảnh, tên, nút nghe
Banner khi vào geofence: "Bạn đang ở gần [tên địa điểm] — đang phát thuyết minh"
Chỉ báo online/offline nhỏ ở góc
Nếu đang theo tuyến tour: thanh tiến trình các điểm dừng (stepper ngang)

F. Danh sách Tour

Card: khối màu emerald gradient với mã tour, tên, thời lượng ước tính, mô tả 3 dòng

G. Chi tiết Tour

Tương tự chi tiết địa điểm nhưng có danh sách điểm dừng (stop list) theo thứ tự
2 nút: "Xem chi tiết" / "Bắt đầu tuyến đường"

H. Tuyến đường Tour (Tour Route — chế độ đi bộ nghe thuyết minh)

Danh sách các điểm dừng dạng carousel/segmented control chọn điểm hiện tại
Audio player cho điểm đang chọn, đồng hồ đếm ngược vé
Trạng thái access required/expired giống địa điểm

I. Gói vé (Packages)

Danh sách card gói vé: nhãn Miễn phí/Trả phí, giá (VND), thời hạn (phút), danh sách quyền lợi (khu vực / địa điểm / ngôn ngữ)
Nút "Thanh toán" (hồng) hoặc nếu đã có vé active: đồng hồ đếm ngược + nút "Bắt đầu nghe"
Trạng thái đang xử lý thanh toán, trạng thái lỗi

J. Quét QR / Landing QR

Màn hình quét QR bằng camera (khung quét, hướng dẫn)
Sau khi quét: loading → tự động kích hoạt vé (miễn phí) hoặc màn hình yêu cầu thanh toán → sau khi có vé, điều hướng thẳng đến địa điểm/tour tương ứng, kèm badge "Vé thuyết minh toàn khu đang hoạt động" + đồng hồ đếm ngược
Trạng thái lỗi: "Mã QR không khả dụng"

K. Tìm kiếm

Ô tìm kiếm nổi bật, kết quả dạng list card (địa điểm/tour)

L. Đổi ngôn ngữ

Có thể là bottom sheet chọn ngôn ngữ (6 ngôn ngữ, cờ + tên bản ngữ) truy cập từ Home hoặc Settings
4. Component hệ thống cần dựng trong Figma (design system)
Buttons: Primary (emerald fill), Secondary (outline gray), CTA thanh toán (pink fill)
Card: Địa điểm, Tour, Gói vé
Audio Player component (progress, play/pause, track title)
Access Countdown component (đồng hồ đếm ngược dạng pill)
Status panels: AccessRequired, AccessExpired, PaymentRequired, Loading (spinner), Empty state
Category badge/chip
Bottom Tab Bar + FAB quét QR
Language selector (chip/flag list)
Map marker set (theo category, có số thứ tự cho tour)
5. Lưu ý kỹ thuật cho React Native (đưa vào phần note của file Figma)
Thiết kế theo Auto Layout tương thích React Native (Flexbox), spacing theo scale 4/8/12/16/24
Chuẩn bị 2 kích thước tham chiếu: iPhone 15 (390×844) và Android chuẩn (360×800)
Bản đồ dùng react-native-maps (không dùng Leaflet như web) — thiết kế marker dạng custom view
Audio dùng expo-av/react-native-track-player — cần trạng thái buffering, lỗi mạng
Cân nhắc offline-first nhẹ (cache ảnh/audio đã tải) vì bản MAUI gốc có SQLite offline — bản RN này có thể chỉ cache tạm bằng AsyncStorage/MMKV cho vé & ngôn ngữ đã chọn.