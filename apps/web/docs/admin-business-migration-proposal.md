# Đề xuất migration Admin — CHƯA ÁP DỤNG

Schema hiện có đã được đọc từ SQL Server thật. Không ALTER bảng cũ, không backfill approval, không xóa dữ liệu, không seed giá/gói giả. Sau khi xác nhận nghiệp vụ, tạo migration version 003 trong infra/sql và kiểm thử trên transaction rollback trước khi áp dụng.

[Bản SQL đề xuất để review](migrations/003_admin_business.proposed.sql) có guard và toàn bộ DDL được comment; chưa được chạy. Giá, target type, đơn vị thời hạn, gói miễn phí, hồ sơ cần giấy tờ và cơ chế xác minh đều cần xác nhận trước khi chuyển thành migration thực thi.

| Bảng mới đề xuất | Cột chính và quan hệ | Nghiệp vụ cần xác nhận |
| --- | --- | --- |
| VendorApplications | Id; UserId FK Users; BusinessName; ProfileJson ISJSON; Status; RejectionReason; SubmittedAt; ReviewedAt; ReviewedByUserId FK Users; Version | Thông tin hồ sơ bắt buộc; một hồ sơ có nhiều lần nộp hay version; duyệt cho phép đăng nhập/tạo POI hay công khai nội dung? |
| ServicePlans | Id; Code unique; Name; TargetType; DurationDays > 0; PriceAmount >= 0; Currency; IsActive; Version | Gói cho POI chủ sạp hay khách nghe; giá/thời hạn cụ thể; miễn phí, gia hạn, đổi gói |
| ServiceSubscriptions | Id; PlanId FK ServicePlans; UserId FK Users nullable; PoiId FK POIs nullable; GuestAccessPassId FK GuestAccessPasses nullable; PlanVersion; AmountSnapshot; DurationDaysSnapshot; StartsAt; ExpiresAt; Status; VerificationId FK PaymentVerifications nullable | Quy tắc chọn đúng đối tượng; snapshot khi mua; cách cộng thời hạn; quyền hủy/hoàn tiền |
| PaymentVerifications | Id; PoiPaymentSessionId FK PoiPaymentSessions nullable; AccessPaymentSessionId FK AccessPaymentSessions nullable; ProviderTransactionId; Provider; Amount; Currency; EvidenceReference; EvidenceHash; VerificationMethod; VerifiedAt; VerifiedByUserId FK Users nullable | Provider và signature/webhook; bằng chứng ngân hàng; nguồn đối soát; mã giao dịch unique theo provider; thời điểm xác nhận |

Các enum của bảng mới phải được định nghĩa trong migration được duyệt. Không ánh xạ trạng thái bảng mới sang ApprovalStatus/PaymentStatus/LifecycleStatus của POIs chỉ dựa vào suy đoán. API mới sẽ dùng tên trạng thái có nghĩa, xác thực tại Backend, optimistic Version, reviewer audit và lý do từ chối.

Thanh toán: chỉ kích hoạt/gia hạn khi xác minh thành công mã giao dịch, số tiền, đơn vị tiền và đích thanh toán, đồng thời kiểm idempotency. Session có Provider=SimulatedMoMo hoặc chỉ Status=Paid không được coi là bằng chứng. Không tự chuyển session cũ sang Verified.

Quyền sở hữu: tiếp tục dùng POIs.UserId FK Users và EntityGrants. Không chuyển POI vô chủ cho người dùng hoặc tự đổi owner. Duyệt chủ sạp và duyệt POI là hai quy trình riêng.

Phần tra cứu tài khoản chủ sạp, thời hạn POI và session thanh toán đã triển khai trên schema cũ; đây không phải quy trình duyệt hồ sơ/mua gói/đối soát hoàn chỉnh.
