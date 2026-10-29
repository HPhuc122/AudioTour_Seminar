-- Fresh AudioTour Vinh Khanh schema only.
-- DDL is adapted from the legacy SQL structure for the active app tables; no legacy rows or EF history are included.
-- OfflinePackages, DeletedRecords and SyncHistory are intentionally omitted while offline sync is not implemented.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE TABLE [dbo].[AccessPaymentSessions](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[GuestAccessPassId] [int] NOT NULL,

	[Provider] [nvarchar](32) NOT NULL,

	[Status] [nvarchar](32) NOT NULL,

	[Amount] [decimal](18, 2) NOT NULL,

	[Currency] [nvarchar](8) NOT NULL,

	[CreatedAt] [datetime2](7) NOT NULL,

	[ExpiresAt] [datetime2](7) NOT NULL,

	[PaidAt] [datetime2](7) NULL,

	[FailureReason] [nvarchar](500) NULL,

 CONSTRAINT [PK_AccessPaymentSessions] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY]
GO

CREATE TABLE [dbo].[AnalyticsDaily](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[POIId] [int] NOT NULL,

	[Date] [date] NOT NULL,

	[TotalPlays] [int] NOT NULL,

	[GpsPlays] [int] NOT NULL,

	[QrPlays] [int] NOT NULL,

	[ManualPlays] [int] NOT NULL,

	[UniqueDevices] [int] NOT NULL,

 CONSTRAINT [PK_AnalyticsDaily] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY]
GO

CREATE TABLE [dbo].[AudioTracks](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[POIId] [int] NOT NULL,

	[LanguageCode] [nvarchar](10) NOT NULL,

	[AudioType] [nvarchar](20) NOT NULL,

	[FileUrl] [nvarchar](500) NULL,

	[TTSText] [nvarchar](max) NULL,

	[DurationSeconds] [int] NULL,

	[FileSizeBytes] [bigint] NULL,

	[MimeType] [nvarchar](50) NULL,

	[IsActive] [bit] NOT NULL,

	[DeletedAt] [datetime2](7) NULL,

	[Version] [int] NOT NULL,

	[CreatedAt] [datetime2](7) NOT NULL,

	[UpdatedAt] [datetime2](7) NOT NULL,

	[Title] [nvarchar](200) NULL,

 CONSTRAINT [PK_AudioTracks] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[AuditLogs](

	[Id] [bigint] IDENTITY(1,1) NOT NULL,

	[UserId] [int] NULL,

	[TableName] [nvarchar](100) NOT NULL,

	[RecordId] [nvarchar](20) NOT NULL,

	[Action] [nvarchar](10) NOT NULL,

	[OldValues] [nvarchar](max) NULL,

	[NewValues] [nvarchar](max) NULL,

	[IPAddress] [nvarchar](50) NULL,

	[CreatedAt] [datetime2](7) NOT NULL,

 CONSTRAINT [PK_AuditLogs] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[ContentVersions](

	[Id] [bigint] IDENTITY(1,1) NOT NULL,

	[EntityType] [nvarchar](50) NOT NULL,

	[EntityId] [bigint] NOT NULL,

	[Version] [int] NOT NULL,

	[SnapshotJson] [nvarchar](max) NOT NULL,

	[CreatedBy] [int] NULL,

	[CreatedAt] [datetime2](7) NOT NULL,

 CONSTRAINT [PK_ContentVersions] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[Devices](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[DeviceId] [nvarchar](200) NOT NULL,

	[UserId] [int] NULL,

	[Platform] [nvarchar](20) NOT NULL,

	[AppVersion] [nvarchar](20) NULL,

	[OsVersion] [nvarchar](50) NULL,

	[PushToken] [nvarchar](512) NULL,

	[LastSeenAt] [datetime2](7) NOT NULL,

	[RegisteredAt] [datetime2](7) NOT NULL,

 CONSTRAINT [PK_Devices] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY]
GO

CREATE TABLE [dbo].[GuestAccessPasses](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[TokenHash] [nvarchar](128) NULL,

	[QrLocationId] [int] NOT NULL,

	[StartsAt] [datetime2](7) NULL,

	[ExpiresAt] [datetime2](7) NOT NULL,

	[IsPaid] [bit] NOT NULL,

	[Amount] [decimal](18, 2) NOT NULL,

	[Currency] [nvarchar](8) NOT NULL,

	[Status] [nvarchar](32) NOT NULL,

	[CreatedAt] [datetime2](7) NOT NULL,

	[UpdatedAt] [datetime2](7) NOT NULL,

 CONSTRAINT [PK_GuestAccessPasses] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Languages](

	[Code] [nvarchar](10) NOT NULL,

	[Name] [nvarchar](100) NOT NULL,

	[NativeName] [nvarchar](100) NOT NULL,

	[IsActive] [bit] NOT NULL,

	[SortOrder] [int] NOT NULL,

 CONSTRAINT [PK_Languages] PRIMARY KEY CLUSTERED

(

	[Code] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY]
GO

CREATE TABLE [dbo].[MediaFiles](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[FileName] [nvarchar](260) NOT NULL,

	[OriginalFileName] [nvarchar](260) NOT NULL,

	[FileType] [nvarchar](20) NOT NULL,

	[ContentType] [nvarchar](100) NOT NULL,

	[FileSize] [bigint] NOT NULL,

	[RelativePath] [nvarchar](500) NOT NULL,

	[UploadedAt] [datetime2](7) NOT NULL,

	[UploadedByUserId] [int] NULL,

	[IsDeleted] [bit] NOT NULL,

	[ApprovalStatus] [nvarchar](20) NOT NULL,

	[RejectionReason] [nvarchar](1000) NULL,

	[ReviewedAt] [datetime2](7) NULL,

	[ReviewedByUserId] [int] NULL,

	[SubmittedAt] [datetime2](7) NULL,

	[PoiId] [int] NULL,

	[ImageCategory] [nvarchar](30) NULL,

 CONSTRAINT [PK_MediaFiles] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY]
GO

CREATE TABLE [dbo].[NarrationDrafts](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[Title] [nvarchar](200) NOT NULL,

	[LanguageCode] [nvarchar](10) NOT NULL,

	[TextContent] [nvarchar](max) NOT NULL,

	[Voice] [nvarchar](100) NOT NULL,

	[Status] [nvarchar](30) NOT NULL,

	[SubmittedByUserId] [int] NOT NULL,

	[SubmittedAt] [datetime2](7) NOT NULL,

	[ReviewedByUserId] [int] NULL,

	[ReviewedAt] [datetime2](7) NULL,

	[RejectionReason] [nvarchar](1000) NULL,

	[GeneratedAudioTrackId] [int] NULL,

	[AudioGeneratedAt] [datetime2](7) NULL,

	[SimulatedAudioUrl] [nvarchar](500) NULL,

	[CreatedAt] [datetime2](7) NOT NULL,

	[UpdatedAt] [datetime2](7) NOT NULL,

	[PoiId] [int] NOT NULL,

 CONSTRAINT [PK_NarrationDrafts] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[NarrationLogs](

	[Id] [bigint] IDENTITY(1,1) NOT NULL,

	[UserId] [int] NULL,

	[POIId] [int] NOT NULL,

	[TriggerType] [nvarchar](20) NOT NULL,

	[LanguageCode] [nvarchar](10) NOT NULL,

	[PlayedAt] [datetime2](7) NOT NULL,

	[DurationPlayedSeconds] [int] NULL,

	[DeviceId] [nvarchar](200) NULL,

	[Synced] [bit] NOT NULL,

 CONSTRAINT [PK_NarrationLogs] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY]
GO

CREATE TABLE [dbo].[PoiPaymentSessions](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[PoiId] [int] NOT NULL,

	[VendorUserId] [int] NOT NULL,

	[Provider] [nvarchar](32) NOT NULL,

	[Status] [nvarchar](32) NOT NULL,

	[Amount] [decimal](18, 2) NOT NULL,

	[Currency] [nvarchar](8) NOT NULL,

	[CreatedAt] [datetime2](7) NOT NULL,

	[ExpiresAt] [datetime2](7) NOT NULL,

	[PaidAt] [datetime2](7) NULL,

	[FailureReason] [nvarchar](500) NULL,

 CONSTRAINT [PK_PoiPaymentSessions] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY]
GO

CREATE TABLE [dbo].[POIs](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[Code] [nvarchar](50) NOT NULL,

	[Address] [nvarchar](500) NULL,

	[Latitude] [decimal](9, 6) NULL,

	[Longitude] [decimal](9, 6) NULL,

	[RadiusMeters] [decimal](8, 2) NOT NULL,

	[Priority] [int] NOT NULL,

	[IsActive] [bit] NOT NULL,

	[ImageUrl] [nvarchar](500) NULL,

	[Category] [nvarchar](100) NULL,

	[CooldownSeconds] [int] NOT NULL,

	[MinDwellSeconds] [int] NOT NULL,

	[DeletedAt] [datetime2](7) NULL,

	[Version] [int] NOT NULL,

	[CreatedAt] [datetime2](7) NOT NULL,

	[UpdatedAt] [datetime2](7) NOT NULL,

	[ApprovalStatus] [tinyint] NOT NULL,

	[Description] [nvarchar](max) NULL,

	[Name] [nvarchar](max) NOT NULL,

	[ShortDescription] [nvarchar](max) NULL,

	[ImageUrls] [nvarchar](max) NULL,

	[UserId] [int] NULL,

	[ActivatedAt] [datetime2](7) NULL,

	[ActivatedByUserId] [int] NULL,

	[PaymentRequired] [bit] NOT NULL,

	[PaymentStatus] [tinyint] NOT NULL,

	[LifecycleStatus] [tinyint] NOT NULL,

	[ValidFrom] [datetime2](7) NULL,

	[ValidUntil] [datetime2](7) NULL,

 CONSTRAINT [PK_POIs] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[POITranslations](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[POIId] [int] NOT NULL,

	[LanguageCode] [nvarchar](10) NOT NULL,

	[Name] [nvarchar](200) NOT NULL,

	[Description] [nvarchar](max) NOT NULL,

	[ShortDescription] [nvarchar](500) NULL,

	[Version] [int] NOT NULL,

	[CreatedAt] [datetime2](7) NOT NULL,

	[UpdatedAt] [datetime2](7) NOT NULL,

 CONSTRAINT [PK_POITranslations] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[QRLocations](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[PoiId] [int] NULL,

	[Code] [nvarchar](200) NOT NULL,

	[IsActive] [bit] NOT NULL,

	[DeletedAt] [datetime2](7) NULL,

	[CreatedAt] [datetime2](7) NOT NULL,

	[TourId] [int] NULL,

	[UpdatedAt] [datetime2](7) NOT NULL,

	[AccessDurationMinutes] [int] NOT NULL,

	[PriceAmount] [decimal](18, 2) NOT NULL,

	[RequiresPayment] [bit] NOT NULL,

	[Name] [nvarchar](200) NULL,

 CONSTRAINT [PK_QRLocations] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Roles](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[Name] [nvarchar](50) NOT NULL,

	[Description] [nvarchar](200) NULL,

 CONSTRAINT [PK_Roles] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY]
GO

CREATE TABLE [dbo].[TourPOIs](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[TourId] [int] NOT NULL,

	[POIId] [int] NOT NULL,

	[OrderIndex] [int] NOT NULL,

 CONSTRAINT [PK_TourPOIs] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY]
GO

CREATE TABLE [dbo].[Tours](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[Code] [nvarchar](50) NOT NULL,

	[DefaultLanguage] [nvarchar](10) NOT NULL,

	[IsActive] [bit] NOT NULL,

	[EstimatedMinutes] [int] NULL,

	[DeletedAt] [datetime2](7) NULL,

	[Version] [int] NOT NULL,

	[CreatedAt] [datetime2](7) NOT NULL,

	[UpdatedAt] [datetime2](7) NOT NULL,

 CONSTRAINT [PK_Tours] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY]
GO

CREATE TABLE [dbo].[TourTranslations](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[TourId] [int] NOT NULL,

	[LanguageCode] [nvarchar](10) NOT NULL,

	[Name] [nvarchar](200) NOT NULL,

	[Description] [nvarchar](max) NULL,

 CONSTRAINT [PK_TourTranslations] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
GO

CREATE TABLE [dbo].[Users](

	[Id] [int] IDENTITY(1,1) NOT NULL,

	[Username] [nvarchar](100) NOT NULL,

	[Email] [nvarchar](254) NOT NULL,

	[PasswordHash] [nvarchar](512) NOT NULL,

	[RoleId] [int] NOT NULL,

	[PreferredLanguage] [nvarchar](10) NOT NULL,

	[IsActive] [bit] NOT NULL,

	[RefreshToken] [nvarchar](512) NULL,

	[RefreshTokenExpiry] [datetime2](7) NULL,

	[CreatedAt] [datetime2](7) NOT NULL,

	[UpdatedAt] [datetime2](7) NOT NULL,

 CONSTRAINT [PK_Users] PRIMARY KEY CLUSTERED

(

	[Id] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]

) ON [PRIMARY]
GO

/****** Object:  Index [IX_AccessPaymentSessions_ExpiresAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_AccessPaymentSessions_ExpiresAt] ON [dbo].[AccessPaymentSessions]

(

	[ExpiresAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_AccessPaymentSessions_GuestAccessPassId_Status]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_AccessPaymentSessions_GuestAccessPassId_Status] ON [dbo].[AccessPaymentSessions]

(

	[GuestAccessPassId] ASC,

	[Status] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_AnalyticsDaily_Date]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_AnalyticsDaily_Date] ON [dbo].[AnalyticsDaily]

(

	[Date] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_AnalyticsDaily_POIId_Date]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_AnalyticsDaily_POIId_Date] ON [dbo].[AnalyticsDaily]

(

	[POIId] ASC,

	[Date] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_AudioTracks_POIId_LanguageCode]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_AudioTracks_POIId_LanguageCode] ON [dbo].[AudioTracks]

(

	[POIId] ASC,

	[LanguageCode] ASC

)

WHERE ([IsActive]=(1) AND [DeletedAt] IS NULL)

WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_AudioTracks_UpdatedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_AudioTracks_UpdatedAt] ON [dbo].[AudioTracks]

(

	[UpdatedAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_AuditLogs_CreatedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_AuditLogs_CreatedAt] ON [dbo].[AuditLogs]

(

	[CreatedAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_AuditLogs_TableName_RecordId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_AuditLogs_TableName_RecordId] ON [dbo].[AuditLogs]

(

	[TableName] ASC,

	[RecordId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_AuditLogs_UserId_CreatedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_AuditLogs_UserId_CreatedAt] ON [dbo].[AuditLogs]

(

	[UserId] ASC,

	[CreatedAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_ContentVersions_CreatedBy]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_ContentVersions_CreatedBy] ON [dbo].[ContentVersions]

(

	[CreatedBy] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_ContentVersions_EntityType_EntityId_Version]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_ContentVersions_EntityType_EntityId_Version] ON [dbo].[ContentVersions]

(

	[EntityType] ASC,

	[EntityId] ASC,

	[Version] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [AK_Devices_DeviceId]    Script Date: 9/16/2026 10:01:57 PM ******/

ALTER TABLE [dbo].[Devices] ADD  CONSTRAINT [AK_Devices_DeviceId] UNIQUE NONCLUSTERED

(

	[DeviceId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_Devices_DeviceId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_Devices_DeviceId] ON [dbo].[Devices]

(

	[DeviceId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_Devices_UserId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_Devices_UserId] ON [dbo].[Devices]

(

	[UserId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_GuestAccessPasses_ExpiresAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_GuestAccessPasses_ExpiresAt] ON [dbo].[GuestAccessPasses]

(

	[ExpiresAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_GuestAccessPasses_QrLocationId_Status]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_GuestAccessPasses_QrLocationId_Status] ON [dbo].[GuestAccessPasses]

(

	[QrLocationId] ASC,

	[Status] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_GuestAccessPasses_TokenHash]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_GuestAccessPasses_TokenHash] ON [dbo].[GuestAccessPasses]

(

	[TokenHash] ASC

)

WHERE ([TokenHash] IS NOT NULL)

WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_Languages_Name]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_Languages_Name] ON [dbo].[Languages]

(

	[Name] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_MediaFiles_ApprovalStatus]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_MediaFiles_ApprovalStatus] ON [dbo].[MediaFiles]

(

	[ApprovalStatus] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_MediaFiles_FileName]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_MediaFiles_FileName] ON [dbo].[MediaFiles]

(

	[FileName] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_MediaFiles_FileType]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_MediaFiles_FileType] ON [dbo].[MediaFiles]

(

	[FileType] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_MediaFiles_IsDeleted]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_MediaFiles_IsDeleted] ON [dbo].[MediaFiles]

(

	[IsDeleted] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_MediaFiles_PoiId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_MediaFiles_PoiId] ON [dbo].[MediaFiles]

(

	[PoiId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_MediaFiles_PoiId_FileType_ApprovalStatus]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_MediaFiles_PoiId_FileType_ApprovalStatus] ON [dbo].[MediaFiles]

(

	[PoiId] ASC,

	[FileType] ASC,

	[ApprovalStatus] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_MediaFiles_ReviewedByUserId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_MediaFiles_ReviewedByUserId] ON [dbo].[MediaFiles]

(

	[ReviewedByUserId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_MediaFiles_UploadedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_MediaFiles_UploadedAt] ON [dbo].[MediaFiles]

(

	[UploadedAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_MediaFiles_UploadedByUserId_FileType_ApprovalStatus]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_MediaFiles_UploadedByUserId_FileType_ApprovalStatus] ON [dbo].[MediaFiles]

(

	[UploadedByUserId] ASC,

	[FileType] ASC,

	[ApprovalStatus] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_NarrationDrafts_GeneratedAudioTrackId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_NarrationDrafts_GeneratedAudioTrackId] ON [dbo].[NarrationDrafts]

(

	[GeneratedAudioTrackId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_NarrationDrafts_PoiId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_NarrationDrafts_PoiId] ON [dbo].[NarrationDrafts]

(

	[PoiId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_NarrationDrafts_PoiId_LanguageCode]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_NarrationDrafts_PoiId_LanguageCode] ON [dbo].[NarrationDrafts]

(

	[PoiId] ASC,

	[LanguageCode] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_NarrationDrafts_PoiId_Status]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_NarrationDrafts_PoiId_Status] ON [dbo].[NarrationDrafts]

(

	[PoiId] ASC,

	[Status] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_NarrationDrafts_ReviewedByUserId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_NarrationDrafts_ReviewedByUserId] ON [dbo].[NarrationDrafts]

(

	[ReviewedByUserId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_NarrationDrafts_Status]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_NarrationDrafts_Status] ON [dbo].[NarrationDrafts]

(

	[Status] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_NarrationDrafts_SubmittedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_NarrationDrafts_SubmittedAt] ON [dbo].[NarrationDrafts]

(

	[SubmittedAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_NarrationDrafts_SubmittedByUserId_Status]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_NarrationDrafts_SubmittedByUserId_Status] ON [dbo].[NarrationDrafts]

(

	[SubmittedByUserId] ASC,

	[Status] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_NarrationLogs_DeviceId_PlayedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_NarrationLogs_DeviceId_PlayedAt] ON [dbo].[NarrationLogs]

(

	[DeviceId] ASC,

	[PlayedAt] ASC

)

WHERE ([DeviceId] IS NOT NULL)

WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_NarrationLogs_PlayedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_NarrationLogs_PlayedAt] ON [dbo].[NarrationLogs]

(

	[PlayedAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_NarrationLogs_POIId_PlayedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_NarrationLogs_POIId_PlayedAt] ON [dbo].[NarrationLogs]

(

	[POIId] ASC,

	[PlayedAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_NarrationLogs_Synced]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_NarrationLogs_Synced] ON [dbo].[NarrationLogs]

(

	[Synced] ASC

)

WHERE ([Synced]=(0))

WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_NarrationLogs_UserId_PlayedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_NarrationLogs_UserId_PlayedAt] ON [dbo].[NarrationLogs]

(

	[UserId] ASC,

	[PlayedAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_PoiPaymentSessions_ExpiresAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_PoiPaymentSessions_ExpiresAt] ON [dbo].[PoiPaymentSessions]

(

	[ExpiresAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_PoiPaymentSessions_PoiId_Status]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_PoiPaymentSessions_PoiId_Status] ON [dbo].[PoiPaymentSessions]

(

	[PoiId] ASC,

	[Status] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_PoiPaymentSessions_VendorUserId_Status]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_PoiPaymentSessions_VendorUserId_Status] ON [dbo].[PoiPaymentSessions]

(

	[VendorUserId] ASC,

	[Status] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_POIs_ActivatedByUserId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_POIs_ActivatedByUserId] ON [dbo].[POIs]

(

	[ActivatedByUserId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_POIs_Code]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_POIs_Code] ON [dbo].[POIs]

(

	[Code] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_POIs_DeletedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_POIs_DeletedAt] ON [dbo].[POIs]

(

	[DeletedAt] ASC

)

WHERE ([DeletedAt] IS NOT NULL)

WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_POIs_Latitude_Longitude]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_POIs_Latitude_Longitude] ON [dbo].[POIs]

(

	[Latitude] ASC,

	[Longitude] ASC

)

WHERE ([IsActive]=(1) AND [DeletedAt] IS NULL)

WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_POIs_LifecycleStatus]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_POIs_LifecycleStatus] ON [dbo].[POIs]

(

	[LifecycleStatus] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_POIs_PaymentStatus]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_POIs_PaymentStatus] ON [dbo].[POIs]

(

	[PaymentStatus] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_POIs_UpdatedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_POIs_UpdatedAt] ON [dbo].[POIs]

(

	[UpdatedAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_POIs_UserId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_POIs_UserId] ON [dbo].[POIs]

(

	[UserId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_POIs_ValidUntil]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_POIs_ValidUntil] ON [dbo].[POIs]

(

	[ValidUntil] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_POITranslations_LanguageCode]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_POITranslations_LanguageCode] ON [dbo].[POITranslations]

(

	[LanguageCode] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_POITranslations_POIId_LanguageCode]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_POITranslations_POIId_LanguageCode] ON [dbo].[POITranslations]

(

	[POIId] ASC,

	[LanguageCode] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_POITranslations_UpdatedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_POITranslations_UpdatedAt] ON [dbo].[POITranslations]

(

	[UpdatedAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_QRLocations_Code]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_QRLocations_Code] ON [dbo].[QRLocations]

(

	[Code] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_QRLocations_DeletedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_QRLocations_DeletedAt] ON [dbo].[QRLocations]

(

	[DeletedAt] ASC

)

WHERE ([DeletedAt] IS NOT NULL)

WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_QRLocations_PoiId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_QRLocations_PoiId] ON [dbo].[QRLocations]

(

	[PoiId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_QRLocations_TourId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_QRLocations_TourId] ON [dbo].[QRLocations]

(

	[TourId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_Roles_Name]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_Roles_Name] ON [dbo].[Roles]

(

	[Name] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_TourPOIs_POIId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_TourPOIs_POIId] ON [dbo].[TourPOIs]

(

	[POIId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_TourPOIs_TourId_OrderIndex]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_TourPOIs_TourId_OrderIndex] ON [dbo].[TourPOIs]

(

	[TourId] ASC,

	[OrderIndex] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_TourPOIs_TourId_POIId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_TourPOIs_TourId_POIId] ON [dbo].[TourPOIs]

(

	[TourId] ASC,

	[POIId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_Tours_Code]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_Tours_Code] ON [dbo].[Tours]

(

	[Code] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_Tours_DeletedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_Tours_DeletedAt] ON [dbo].[Tours]

(

	[DeletedAt] ASC

)

WHERE ([DeletedAt] IS NOT NULL)

WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_Tours_UpdatedAt]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_Tours_UpdatedAt] ON [dbo].[Tours]

(

	[UpdatedAt] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_TourTranslations_TourId_LanguageCode]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_TourTranslations_TourId_LanguageCode] ON [dbo].[TourTranslations]

(

	[TourId] ASC,

	[LanguageCode] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_Users_Email]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_Users_Email] ON [dbo].[Users]

(

	[Email] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_Users_RoleId]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE NONCLUSTERED INDEX [IX_Users_RoleId] ON [dbo].[Users]

(

	[RoleId] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

/****** Object:  Index [IX_Users_Username]    Script Date: 9/16/2026 10:01:57 PM ******/

CREATE UNIQUE NONCLUSTERED INDEX [IX_Users_Username] ON [dbo].[Users]

(

	[Username] ASC

)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, SORT_IN_TEMPDB = OFF, IGNORE_DUP_KEY = OFF, DROP_EXISTING = OFF, ONLINE = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
GO

ALTER TABLE [dbo].[AccessPaymentSessions] ADD  DEFAULT (N'SimulatedMoMo') FOR [Provider]
GO

ALTER TABLE [dbo].[AccessPaymentSessions] ADD  DEFAULT (N'VND') FOR [Currency]
GO

ALTER TABLE [dbo].[AccessPaymentSessions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

ALTER TABLE [dbo].[AnalyticsDaily] ADD  DEFAULT ((0)) FOR [TotalPlays]
GO

ALTER TABLE [dbo].[AnalyticsDaily] ADD  DEFAULT ((0)) FOR [GpsPlays]
GO

ALTER TABLE [dbo].[AnalyticsDaily] ADD  DEFAULT ((0)) FOR [QrPlays]
GO

ALTER TABLE [dbo].[AnalyticsDaily] ADD  DEFAULT ((0)) FOR [ManualPlays]
GO

ALTER TABLE [dbo].[AnalyticsDaily] ADD  DEFAULT ((0)) FOR [UniqueDevices]
GO

ALTER TABLE [dbo].[AudioTracks] ADD  DEFAULT (N'tts') FOR [AudioType]
GO

ALTER TABLE [dbo].[AudioTracks] ADD  DEFAULT (N'audio/mp4') FOR [MimeType]
GO

ALTER TABLE [dbo].[AudioTracks] ADD  DEFAULT (CONVERT([bit],(1))) FOR [IsActive]
GO

ALTER TABLE [dbo].[AudioTracks] ADD  DEFAULT ((1)) FOR [Version]
GO

ALTER TABLE [dbo].[AudioTracks] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

ALTER TABLE [dbo].[AudioTracks] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO

ALTER TABLE [dbo].[AuditLogs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

ALTER TABLE [dbo].[ContentVersions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

ALTER TABLE [dbo].[Devices] ADD  DEFAULT (sysutcdatetime()) FOR [LastSeenAt]
GO

ALTER TABLE [dbo].[Devices] ADD  DEFAULT (sysutcdatetime()) FOR [RegisteredAt]
GO

ALTER TABLE [dbo].[GuestAccessPasses] ADD  DEFAULT (N'VND') FOR [Currency]
GO

ALTER TABLE [dbo].[GuestAccessPasses] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

ALTER TABLE [dbo].[GuestAccessPasses] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO

ALTER TABLE [dbo].[Languages] ADD  DEFAULT (CONVERT([bit],(1))) FOR [IsActive]
GO

ALTER TABLE [dbo].[Languages] ADD  DEFAULT ((0)) FOR [SortOrder]
GO

ALTER TABLE [dbo].[MediaFiles] ADD  DEFAULT (sysutcdatetime()) FOR [UploadedAt]
GO

ALTER TABLE [dbo].[MediaFiles] ADD  DEFAULT (CONVERT([bit],(0))) FOR [IsDeleted]
GO

ALTER TABLE [dbo].[MediaFiles] ADD  DEFAULT (N'Pending') FOR [ApprovalStatus]
GO

ALTER TABLE [dbo].[NarrationDrafts] ADD  DEFAULT (N'Pending') FOR [Status]
GO

ALTER TABLE [dbo].[NarrationDrafts] ADD  DEFAULT (sysutcdatetime()) FOR [SubmittedAt]
GO

ALTER TABLE [dbo].[NarrationDrafts] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

ALTER TABLE [dbo].[NarrationDrafts] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO

ALTER TABLE [dbo].[NarrationLogs] ADD  DEFAULT (sysutcdatetime()) FOR [PlayedAt]
GO

ALTER TABLE [dbo].[NarrationLogs] ADD  DEFAULT (CONVERT([bit],(1))) FOR [Synced]
GO

ALTER TABLE [dbo].[PoiPaymentSessions] ADD  DEFAULT (N'SimulatedMoMo') FOR [Provider]
GO

ALTER TABLE [dbo].[PoiPaymentSessions] ADD  DEFAULT (N'VND') FOR [Currency]
GO

ALTER TABLE [dbo].[PoiPaymentSessions] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

ALTER TABLE [dbo].[POIs] ADD  DEFAULT ((30.0)) FOR [RadiusMeters]
GO

ALTER TABLE [dbo].[POIs] ADD  DEFAULT ((1)) FOR [Priority]
GO

ALTER TABLE [dbo].[POIs] ADD  DEFAULT (CONVERT([bit],(1))) FOR [IsActive]
GO

ALTER TABLE [dbo].[POIs] ADD  DEFAULT ((300)) FOR [CooldownSeconds]
GO

ALTER TABLE [dbo].[POIs] ADD  DEFAULT ((5)) FOR [MinDwellSeconds]
GO

ALTER TABLE [dbo].[POIs] ADD  DEFAULT ((1)) FOR [Version]
GO

ALTER TABLE [dbo].[POIs] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

ALTER TABLE [dbo].[POIs] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO

ALTER TABLE [dbo].[POIs] ADD  DEFAULT (CONVERT([tinyint],(0))) FOR [ApprovalStatus]
GO

ALTER TABLE [dbo].[POIs] ADD  DEFAULT (N'') FOR [Name]
GO

ALTER TABLE [dbo].[POIs] ADD  DEFAULT (CONVERT([bit],(0))) FOR [PaymentRequired]
GO

ALTER TABLE [dbo].[POIs] ADD  DEFAULT (CONVERT([tinyint],(0))) FOR [PaymentStatus]
GO

ALTER TABLE [dbo].[POIs] ADD  DEFAULT (CONVERT([tinyint],(0))) FOR [LifecycleStatus]
GO

ALTER TABLE [dbo].[POITranslations] ADD  DEFAULT ((1)) FOR [Version]
GO

ALTER TABLE [dbo].[POITranslations] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

ALTER TABLE [dbo].[POITranslations] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO

ALTER TABLE [dbo].[QRLocations] ADD  DEFAULT (CONVERT([bit],(1))) FOR [IsActive]
GO

ALTER TABLE [dbo].[QRLocations] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

ALTER TABLE [dbo].[QRLocations] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO

ALTER TABLE [dbo].[QRLocations] ADD  DEFAULT ((60)) FOR [AccessDurationMinutes]
GO

ALTER TABLE [dbo].[QRLocations] ADD  DEFAULT ((0.0)) FOR [PriceAmount]
GO

ALTER TABLE [dbo].[QRLocations] ADD  DEFAULT (CONVERT([bit],(0))) FOR [RequiresPayment]
GO

ALTER TABLE [dbo].[TourPOIs] ADD  DEFAULT ((0)) FOR [OrderIndex]
GO

ALTER TABLE [dbo].[Tours] ADD  DEFAULT (N'vi') FOR [DefaultLanguage]
GO

ALTER TABLE [dbo].[Tours] ADD  DEFAULT (CONVERT([bit],(1))) FOR [IsActive]
GO

ALTER TABLE [dbo].[Tours] ADD  DEFAULT ((1)) FOR [Version]
GO

ALTER TABLE [dbo].[Tours] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

ALTER TABLE [dbo].[Tours] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO

ALTER TABLE [dbo].[Users] ADD  DEFAULT (N'vi') FOR [PreferredLanguage]
GO

ALTER TABLE [dbo].[Users] ADD  DEFAULT (CONVERT([bit],(1))) FOR [IsActive]
GO

ALTER TABLE [dbo].[Users] ADD  DEFAULT (sysutcdatetime()) FOR [CreatedAt]
GO

ALTER TABLE [dbo].[Users] ADD  DEFAULT (sysutcdatetime()) FOR [UpdatedAt]
GO

ALTER TABLE [dbo].[AccessPaymentSessions]  WITH CHECK ADD  CONSTRAINT [FK_AccessPaymentSessions_GuestAccessPasses_GuestAccessPassId] FOREIGN KEY([GuestAccessPassId])

REFERENCES [dbo].[GuestAccessPasses] ([Id])

ON DELETE CASCADE
GO

ALTER TABLE [dbo].[AccessPaymentSessions] CHECK CONSTRAINT [FK_AccessPaymentSessions_GuestAccessPasses_GuestAccessPassId]
GO

ALTER TABLE [dbo].[AnalyticsDaily]  WITH CHECK ADD  CONSTRAINT [FK_AnalyticsDaily_POIs_POIId] FOREIGN KEY([POIId])

REFERENCES [dbo].[POIs] ([Id])
GO

ALTER TABLE [dbo].[AnalyticsDaily] CHECK CONSTRAINT [FK_AnalyticsDaily_POIs_POIId]
GO

ALTER TABLE [dbo].[AudioTracks]  WITH CHECK ADD  CONSTRAINT [FK_AudioTracks_POIs_POIId] FOREIGN KEY([POIId])

REFERENCES [dbo].[POIs] ([Id])

ON DELETE CASCADE
GO

ALTER TABLE [dbo].[AudioTracks] CHECK CONSTRAINT [FK_AudioTracks_POIs_POIId]
GO

ALTER TABLE [dbo].[AuditLogs]  WITH CHECK ADD  CONSTRAINT [FK_AuditLogs_Users_UserId] FOREIGN KEY([UserId])

REFERENCES [dbo].[Users] ([Id])

ON DELETE SET NULL
GO

ALTER TABLE [dbo].[AuditLogs] CHECK CONSTRAINT [FK_AuditLogs_Users_UserId]
GO

ALTER TABLE [dbo].[ContentVersions]  WITH CHECK ADD  CONSTRAINT [FK_ContentVersions_Users_CreatedBy] FOREIGN KEY([CreatedBy])

REFERENCES [dbo].[Users] ([Id])

ON DELETE SET NULL
GO

ALTER TABLE [dbo].[ContentVersions] CHECK CONSTRAINT [FK_ContentVersions_Users_CreatedBy]
GO

ALTER TABLE [dbo].[Devices]  WITH CHECK ADD  CONSTRAINT [FK_Devices_Users_UserId] FOREIGN KEY([UserId])

REFERENCES [dbo].[Users] ([Id])

ON DELETE SET NULL
GO

ALTER TABLE [dbo].[Devices] CHECK CONSTRAINT [FK_Devices_Users_UserId]
GO

ALTER TABLE [dbo].[GuestAccessPasses]  WITH CHECK ADD  CONSTRAINT [FK_GuestAccessPasses_QRLocations_QrLocationId] FOREIGN KEY([QrLocationId])

REFERENCES [dbo].[QRLocations] ([Id])
GO

ALTER TABLE [dbo].[GuestAccessPasses] CHECK CONSTRAINT [FK_GuestAccessPasses_QRLocations_QrLocationId]
GO

ALTER TABLE [dbo].[MediaFiles]  WITH CHECK ADD  CONSTRAINT [FK_MediaFiles_POIs_PoiId] FOREIGN KEY([PoiId])

REFERENCES [dbo].[POIs] ([Id])

ON DELETE SET NULL
GO

ALTER TABLE [dbo].[MediaFiles] CHECK CONSTRAINT [FK_MediaFiles_POIs_PoiId]
GO

ALTER TABLE [dbo].[MediaFiles]  WITH CHECK ADD  CONSTRAINT [FK_MediaFiles_Users_ReviewedByUserId] FOREIGN KEY([ReviewedByUserId])

REFERENCES [dbo].[Users] ([Id])
GO

ALTER TABLE [dbo].[MediaFiles] CHECK CONSTRAINT [FK_MediaFiles_Users_ReviewedByUserId]
GO

ALTER TABLE [dbo].[MediaFiles]  WITH CHECK ADD  CONSTRAINT [FK_MediaFiles_Users_UploadedByUserId] FOREIGN KEY([UploadedByUserId])

REFERENCES [dbo].[Users] ([Id])

ON DELETE SET NULL
GO

ALTER TABLE [dbo].[MediaFiles] CHECK CONSTRAINT [FK_MediaFiles_Users_UploadedByUserId]
GO

ALTER TABLE [dbo].[NarrationDrafts]  WITH CHECK ADD  CONSTRAINT [FK_NarrationDrafts_AudioTracks_GeneratedAudioTrackId] FOREIGN KEY([GeneratedAudioTrackId])

REFERENCES [dbo].[AudioTracks] ([Id])

ON DELETE SET NULL
GO

ALTER TABLE [dbo].[NarrationDrafts] CHECK CONSTRAINT [FK_NarrationDrafts_AudioTracks_GeneratedAudioTrackId]
GO

ALTER TABLE [dbo].[NarrationDrafts]  WITH CHECK ADD  CONSTRAINT [FK_NarrationDrafts_POIs_PoiId] FOREIGN KEY([PoiId])

REFERENCES [dbo].[POIs] ([Id])
GO

ALTER TABLE [dbo].[NarrationDrafts] CHECK CONSTRAINT [FK_NarrationDrafts_POIs_PoiId]
GO

ALTER TABLE [dbo].[NarrationDrafts]  WITH CHECK ADD  CONSTRAINT [FK_NarrationDrafts_Users_ReviewedByUserId] FOREIGN KEY([ReviewedByUserId])

REFERENCES [dbo].[Users] ([Id])

ON DELETE SET NULL
GO

ALTER TABLE [dbo].[NarrationDrafts] CHECK CONSTRAINT [FK_NarrationDrafts_Users_ReviewedByUserId]
GO

ALTER TABLE [dbo].[NarrationDrafts]  WITH CHECK ADD  CONSTRAINT [FK_NarrationDrafts_Users_SubmittedByUserId] FOREIGN KEY([SubmittedByUserId])

REFERENCES [dbo].[Users] ([Id])
GO

ALTER TABLE [dbo].[NarrationDrafts] CHECK CONSTRAINT [FK_NarrationDrafts_Users_SubmittedByUserId]
GO

ALTER TABLE [dbo].[NarrationLogs]  WITH CHECK ADD  CONSTRAINT [FK_NarrationLogs_Devices_DeviceId] FOREIGN KEY([DeviceId])

REFERENCES [dbo].[Devices] ([DeviceId])

ON DELETE SET NULL
GO

ALTER TABLE [dbo].[NarrationLogs] CHECK CONSTRAINT [FK_NarrationLogs_Devices_DeviceId]
GO

ALTER TABLE [dbo].[NarrationLogs]  WITH CHECK ADD  CONSTRAINT [FK_NarrationLogs_POIs_POIId] FOREIGN KEY([POIId])

REFERENCES [dbo].[POIs] ([Id])
GO

ALTER TABLE [dbo].[NarrationLogs] CHECK CONSTRAINT [FK_NarrationLogs_POIs_POIId]
GO

ALTER TABLE [dbo].[NarrationLogs]  WITH CHECK ADD  CONSTRAINT [FK_NarrationLogs_Users_UserId] FOREIGN KEY([UserId])

REFERENCES [dbo].[Users] ([Id])

ON DELETE SET NULL
GO

ALTER TABLE [dbo].[NarrationLogs] CHECK CONSTRAINT [FK_NarrationLogs_Users_UserId]
GO

ALTER TABLE [dbo].[PoiPaymentSessions]  WITH CHECK ADD  CONSTRAINT [FK_PoiPaymentSessions_POIs_PoiId] FOREIGN KEY([PoiId])

REFERENCES [dbo].[POIs] ([Id])

ON DELETE CASCADE
GO

ALTER TABLE [dbo].[PoiPaymentSessions] CHECK CONSTRAINT [FK_PoiPaymentSessions_POIs_PoiId]
GO

ALTER TABLE [dbo].[PoiPaymentSessions]  WITH CHECK ADD  CONSTRAINT [FK_PoiPaymentSessions_Users_VendorUserId] FOREIGN KEY([VendorUserId])

REFERENCES [dbo].[Users] ([Id])
GO

ALTER TABLE [dbo].[PoiPaymentSessions] CHECK CONSTRAINT [FK_PoiPaymentSessions_Users_VendorUserId]
GO

ALTER TABLE [dbo].[POIs]  WITH CHECK ADD  CONSTRAINT [FK_POIs_Users_ActivatedByUserId] FOREIGN KEY([ActivatedByUserId])

REFERENCES [dbo].[Users] ([Id])
GO

ALTER TABLE [dbo].[POIs] CHECK CONSTRAINT [FK_POIs_Users_ActivatedByUserId]
GO

ALTER TABLE [dbo].[POIs]  WITH CHECK ADD  CONSTRAINT [FK_POIs_Users_UserId] FOREIGN KEY([UserId])

REFERENCES [dbo].[Users] ([Id])
GO

ALTER TABLE [dbo].[POIs] CHECK CONSTRAINT [FK_POIs_Users_UserId]
GO

ALTER TABLE [dbo].[POITranslations]  WITH CHECK ADD  CONSTRAINT [FK_POITranslations_POIs_POIId] FOREIGN KEY([POIId])

REFERENCES [dbo].[POIs] ([Id])

ON DELETE CASCADE
GO

ALTER TABLE [dbo].[POITranslations] CHECK CONSTRAINT [FK_POITranslations_POIs_POIId]
GO

ALTER TABLE [dbo].[QRLocations]  WITH CHECK ADD  CONSTRAINT [FK_QRLocations_POIs_PoiId] FOREIGN KEY([PoiId])

REFERENCES [dbo].[POIs] ([Id])
GO

ALTER TABLE [dbo].[QRLocations] CHECK CONSTRAINT [FK_QRLocations_POIs_PoiId]
GO

ALTER TABLE [dbo].[QRLocations]  WITH CHECK ADD  CONSTRAINT [FK_QRLocations_Tours_TourId] FOREIGN KEY([TourId])

REFERENCES [dbo].[Tours] ([Id])
GO

ALTER TABLE [dbo].[QRLocations] CHECK CONSTRAINT [FK_QRLocations_Tours_TourId]
GO

ALTER TABLE [dbo].[TourPOIs]  WITH CHECK ADD  CONSTRAINT [FK_TourPOIs_POIs_POIId] FOREIGN KEY([POIId])

REFERENCES [dbo].[POIs] ([Id])
GO

ALTER TABLE [dbo].[TourPOIs] CHECK CONSTRAINT [FK_TourPOIs_POIs_POIId]
GO

ALTER TABLE [dbo].[TourPOIs]  WITH CHECK ADD  CONSTRAINT [FK_TourPOIs_Tours_TourId] FOREIGN KEY([TourId])

REFERENCES [dbo].[Tours] ([Id])

ON DELETE CASCADE
GO

ALTER TABLE [dbo].[TourPOIs] CHECK CONSTRAINT [FK_TourPOIs_Tours_TourId]
GO

ALTER TABLE [dbo].[TourTranslations]  WITH CHECK ADD  CONSTRAINT [FK_TourTranslations_Tours_TourId] FOREIGN KEY([TourId])

REFERENCES [dbo].[Tours] ([Id])

ON DELETE CASCADE
GO

ALTER TABLE [dbo].[TourTranslations] CHECK CONSTRAINT [FK_TourTranslations_Tours_TourId]
GO

ALTER TABLE [dbo].[Users]  WITH CHECK ADD  CONSTRAINT [FK_Users_Roles_RoleId] FOREIGN KEY([RoleId])

REFERENCES [dbo].[Roles] ([Id])
GO

ALTER TABLE [dbo].[Users] CHECK CONSTRAINT [FK_Users_Roles_RoleId]
GO

ALTER TABLE [dbo].[AudioTracks]  WITH CHECK ADD  CONSTRAINT [CK_AudioTracks_File] CHECK  (([AudioType]='prerecorded' AND [FileUrl] IS NOT NULL OR [AudioType]='tts' AND [TTSText] IS NOT NULL))
GO

ALTER TABLE [dbo].[AudioTracks] CHECK CONSTRAINT [CK_AudioTracks_File]
GO

ALTER TABLE [dbo].[AudioTracks]  WITH CHECK ADD  CONSTRAINT [CK_AudioTracks_Type] CHECK  (([AudioType]='prerecorded' OR [AudioType]='tts'))
GO

ALTER TABLE [dbo].[AudioTracks] CHECK CONSTRAINT [CK_AudioTracks_Type]
GO

ALTER TABLE [dbo].[Devices]  WITH CHECK ADD  CONSTRAINT [CK_Devices_Platform] CHECK  (([Platform]='windows' OR [Platform]='ios' OR [Platform]='android'))
GO

ALTER TABLE [dbo].[Devices] CHECK CONSTRAINT [CK_Devices_Platform]
GO

ALTER TABLE [dbo].[MediaFiles]  WITH CHECK ADD  CONSTRAINT [CK_MediaFiles_ApprovalStatus] CHECK  (([ApprovalStatus]='Rejected' OR [ApprovalStatus]='Approved' OR [ApprovalStatus]='Pending'))
GO

ALTER TABLE [dbo].[MediaFiles] CHECK CONSTRAINT [CK_MediaFiles_ApprovalStatus]
GO

ALTER TABLE [dbo].[MediaFiles]  WITH CHECK ADD  CONSTRAINT [CK_MediaFiles_FileSize] CHECK  (([FileSize]>(0)))
GO

ALTER TABLE [dbo].[MediaFiles] CHECK CONSTRAINT [CK_MediaFiles_FileSize]
GO

ALTER TABLE [dbo].[MediaFiles]  WITH CHECK ADD  CONSTRAINT [CK_MediaFiles_FileType] CHECK  (([FileType]='audio' OR [FileType]='image'))
GO

ALTER TABLE [dbo].[MediaFiles] CHECK CONSTRAINT [CK_MediaFiles_FileType]
GO

ALTER TABLE [dbo].[MediaFiles]  WITH CHECK ADD  CONSTRAINT [CK_MediaFiles_ImageCategory] CHECK  (([ImageCategory] IS NULL OR ([ImageCategory]='Highlight' OR [ImageCategory]='Menu')))
GO

ALTER TABLE [dbo].[MediaFiles] CHECK CONSTRAINT [CK_MediaFiles_ImageCategory]
GO

ALTER TABLE [dbo].[NarrationDrafts]  WITH CHECK ADD  CONSTRAINT [CK_NarrationDrafts_Status] CHECK  (([Status]='AudioGenerated' OR [Status]='Rejected' OR [Status]='Approved' OR [Status]='Pending'))
GO

ALTER TABLE [dbo].[NarrationDrafts] CHECK CONSTRAINT [CK_NarrationDrafts_Status]
GO

ALTER TABLE [dbo].[NarrationLogs]  WITH CHECK ADD  CONSTRAINT [CK_NarrationLogs_Trigger] CHECK  (([TriggerType]='manual' OR [TriggerType]='qr' OR [TriggerType]='gps'))
GO

ALTER TABLE [dbo].[NarrationLogs] CHECK CONSTRAINT [CK_NarrationLogs_Trigger]
GO

ALTER TABLE [dbo].[PoiPaymentSessions]  WITH CHECK ADD  CONSTRAINT [CK_PoiPaymentSessions_Amount] CHECK  (([Amount]>=(0)))
GO

ALTER TABLE [dbo].[PoiPaymentSessions] CHECK CONSTRAINT [CK_PoiPaymentSessions_Amount]
GO

ALTER TABLE [dbo].[PoiPaymentSessions]  WITH CHECK ADD  CONSTRAINT [CK_PoiPaymentSessions_Status] CHECK  (([Status]='Expired' OR [Status]='Failed' OR [Status]='Paid' OR [Status]='Pending'))
GO

ALTER TABLE [dbo].[PoiPaymentSessions] CHECK CONSTRAINT [CK_PoiPaymentSessions_Status]
GO

ALTER TABLE [dbo].[POIs]  WITH CHECK ADD  CONSTRAINT [CK_POIs_Cooldown] CHECK  (([CooldownSeconds]>=(0)))
GO

ALTER TABLE [dbo].[POIs] CHECK CONSTRAINT [CK_POIs_Cooldown]
GO

ALTER TABLE [dbo].[POIs]  WITH CHECK ADD  CONSTRAINT [CK_POIs_Dwell] CHECK  (([MinDwellSeconds]>=(0)))
GO

ALTER TABLE [dbo].[POIs] CHECK CONSTRAINT [CK_POIs_Dwell]
GO

ALTER TABLE [dbo].[POIs]  WITH CHECK ADD  CONSTRAINT [CK_POIs_Lat] CHECK  (([Latitude]>=(-90) AND [Latitude]<=(90)))
GO

ALTER TABLE [dbo].[POIs] CHECK CONSTRAINT [CK_POIs_Lat]
GO

ALTER TABLE [dbo].[POIs]  WITH CHECK ADD  CONSTRAINT [CK_POIs_Lon] CHECK  (([Longitude]>=(-180) AND [Longitude]<=(180)))
GO

ALTER TABLE [dbo].[POIs] CHECK CONSTRAINT [CK_POIs_Lon]
GO

ALTER TABLE [dbo].[POIs]  WITH CHECK ADD  CONSTRAINT [CK_POIs_Rad] CHECK  (([RadiusMeters]>(0)))
GO

ALTER TABLE [dbo].[POIs] CHECK CONSTRAINT [CK_POIs_Rad]
GO

ALTER TABLE [dbo].[QRLocations]  WITH CHECK ADD  CONSTRAINT [CK_QRLocations_PaymentConfig] CHECK  (([PriceAmount]>=(0) AND [AccessDurationMinutes]>(0)))
GO

ALTER TABLE [dbo].[QRLocations] CHECK CONSTRAINT [CK_QRLocations_PaymentConfig]
GO

ALTER TABLE [dbo].[QRLocations]  WITH CHECK ADD  CONSTRAINT [CK_QRLocations_Target] CHECK  ((NOT ([PoiId] IS NOT NULL AND [TourId] IS NOT NULL)))
GO

ALTER TABLE [dbo].[QRLocations] CHECK CONSTRAINT [CK_QRLocations_Target]
GO
