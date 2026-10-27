-- DRAFT ONLY: chưa xác nhận nghiệp vụ, KHÔNG chạy trên DB thật.
-- Các bảng/enum dưới đây là đề xuất mới, không giả định tồn tại trong schema cũ.
-- Giữ nguyên Users/POIs/payment sessions; không seed/backfill hoặc sửa dữ liệu cũ.
THROW 51000, 'Draft migration only. Confirm business rules and prepare a reviewed migration before execution.', 1;
GO

/*
BEGIN TRANSACTION;
CREATE TABLE dbo.VendorApplications (
    Id int IDENTITY PRIMARY KEY,
    UserId int NOT NULL REFERENCES dbo.Users(Id),
    BusinessName nvarchar(200) NOT NULL,
    ProfileJson nvarchar(max) NOT NULL CHECK(ISJSON(ProfileJson)=1),
    Status nvarchar(20) NOT NULL DEFAULT N'Pending'
        CHECK(Status IN (N'Pending',N'Approved',N'Rejected')),
    RejectionReason nvarchar(1000) NULL,
    SubmittedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    ReviewedAt datetime2 NULL,
    ReviewedByUserId int NULL REFERENCES dbo.Users(Id),
    Version int NOT NULL DEFAULT 1 CHECK(Version>0),
    CHECK(Status<>N'Rejected' OR LEN(LTRIM(RTRIM(RejectionReason)))>0)
);
CREATE INDEX IX_VendorApplications_Status ON dbo.VendorApplications(Status,SubmittedAt);

CREATE TABLE dbo.ServicePlans (
    Id int IDENTITY PRIMARY KEY,
    Code nvarchar(50) NOT NULL UNIQUE,
    Name nvarchar(200) NOT NULL,
    TargetType nvarchar(30) NOT NULL CHECK(TargetType IN(N'PoiPublication',N'GuestListening')),
    DurationDays int NOT NULL CHECK(DurationDays>0),
    PriceAmount decimal(18,2) NOT NULL CHECK(PriceAmount>=0),
    Currency nvarchar(8) NOT NULL,
    IsActive bit NOT NULL DEFAULT 1,
    Version int NOT NULL DEFAULT 1 CHECK(Version>0),
    CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.PaymentVerifications (
    Id int IDENTITY PRIMARY KEY,
    PoiPaymentSessionId int NULL REFERENCES dbo.PoiPaymentSessions(Id),
    AccessPaymentSessionId int NULL REFERENCES dbo.AccessPaymentSessions(Id),
    Provider nvarchar(100) NOT NULL,
    ProviderTransactionId nvarchar(200) NOT NULL,
    Amount decimal(18,2) NOT NULL CHECK(Amount>=0),
    Currency nvarchar(8) NOT NULL,
    EvidenceReference nvarchar(1000) NOT NULL,
    EvidenceHash char(64) NOT NULL,
    VerificationMethod nvarchar(50) NOT NULL,
    VerifiedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    VerifiedByUserId int NULL REFERENCES dbo.Users(Id),
    CHECK((PoiPaymentSessionId IS NOT NULL AND AccessPaymentSessionId IS NULL)
       OR (PoiPaymentSessionId IS NULL AND AccessPaymentSessionId IS NOT NULL)),
    CONSTRAINT UQ_PaymentVerification_ProviderTransaction UNIQUE(Provider,ProviderTransactionId)
);
CREATE UNIQUE INDEX UX_PaymentVerification_Poi ON dbo.PaymentVerifications(PoiPaymentSessionId) WHERE PoiPaymentSessionId IS NOT NULL;
CREATE UNIQUE INDEX UX_PaymentVerification_Access ON dbo.PaymentVerifications(AccessPaymentSessionId) WHERE AccessPaymentSessionId IS NOT NULL;

CREATE TABLE dbo.ServiceSubscriptions (
    Id int IDENTITY PRIMARY KEY,
    PlanId int NOT NULL REFERENCES dbo.ServicePlans(Id),
    PlanVersion int NOT NULL,
    UserId int NULL REFERENCES dbo.Users(Id),
    PoiId int NULL REFERENCES dbo.POIs(Id),
    GuestAccessPassId int NULL REFERENCES dbo.GuestAccessPasses(Id),
    AmountSnapshot decimal(18,2) NOT NULL CHECK(AmountSnapshot>=0),
    CurrencySnapshot nvarchar(8) NOT NULL,
    DurationDaysSnapshot int NOT NULL CHECK(DurationDaysSnapshot>0),
    StartsAt datetime2 NULL,
    ExpiresAt datetime2 NULL,
    Status nvarchar(30) NOT NULL DEFAULT N'PendingPayment'
        CHECK(Status IN(N'PendingPayment',N'Active',N'Expired',N'Cancelled')),
    VerificationId int NULL REFERENCES dbo.PaymentVerifications(Id),
    CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CHECK((PoiId IS NOT NULL AND UserId IS NOT NULL AND GuestAccessPassId IS NULL)
       OR (PoiId IS NULL AND GuestAccessPassId IS NOT NULL)),
    CHECK(ExpiresAt IS NULL OR StartsAt IS NULL OR ExpiresAt>StartsAt),
    CHECK(Status<>N'Active' OR (VerificationId IS NOT NULL AND StartsAt IS NOT NULL AND ExpiresAt IS NOT NULL))
);
-- Bổ sung cơ chế gói miễn phí/waiver sau khi xác nhận nghiệp vụ: không tự kích hoạt.
-- FK không đảm bảo UserId là owner POI, tiền/currency khớp session hay provider đã xác minh.
-- Các điều kiện đó phải được kiểm tra trong transaction Backend bằng dữ liệu thật.
COMMIT;
*/
