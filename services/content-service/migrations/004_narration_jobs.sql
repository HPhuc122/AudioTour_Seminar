-- Additive migration. No existing content is approved or rewritten.
IF COL_LENGTH('NarrationDrafts','IsDeleted') IS NULL
 ALTER TABLE NarrationDrafts ADD IsDeleted bit NOT NULL CONSTRAINT DF_NarrationDrafts_IsDeleted DEFAULT 0;
IF OBJECT_ID('NarrationHeads','U') IS NULL
 CREATE TABLE NarrationHeads (
  PoiId int NOT NULL PRIMARY KEY REFERENCES POIs(Id),
  NarrationId int NOT NULL REFERENCES NarrationDrafts(Id),
  SourceVersion int NOT NULL,
  SubmissionId bigint NOT NULL REFERENCES ContentSubmissions(Id)
 );
IF OBJECT_ID('NarrationJobs', 'U') IS NULL
BEGIN
 CREATE TABLE NarrationJobs (
  Id bigint IDENTITY PRIMARY KEY,
  PoiId int NOT NULL REFERENCES POIs(Id),
  NarrationId int NOT NULL REFERENCES NarrationDrafts(Id),
  SourceVersion int NOT NULL,
  SubmissionId bigint NOT NULL REFERENCES ContentSubmissions(Id),
  ReviewerId int NOT NULL REFERENCES Users(Id),
  SourceLanguage nvarchar(10) NOT NULL,
  LanguageCode nvarchar(10) NOT NULL,
  SourceText nvarchar(max) NOT NULL,
  SourceName nvarchar(200) NOT NULL,
  SourceVoice nvarchar(100) NULL,
  Status nvarchar(20) NOT NULL DEFAULT 'Queued',
  Attempts int NOT NULL DEFAULT 0,
  TotalAttempts int NOT NULL DEFAULT 0,
  MaxAttempts int NOT NULL DEFAULT 3,
  RetryCount int NOT NULL DEFAULT 0,
  ErrorCode nvarchar(60) NULL,
  ErrorMessage nvarchar(1000) NULL,
  AvailableAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  LeaseUntil datetime2 NULL,
  LeaseToken nvarchar(36) NULL,
  AudioTrackId int NULL REFERENCES AudioTracks(Id),
  ResultText nvarchar(max) NULL,
  ResultName nvarchar(200) NULL,
  CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  UpdatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT UQ_NarrationJobs UNIQUE(NarrationId, SourceVersion, LanguageCode),
  CONSTRAINT CK_NarrationJobs_Status CHECK(Status IN ('Queued','Processing','Succeeded','Failed','Superseded'))
 );
 CREATE INDEX IX_NarrationJobs_Queue ON NarrationJobs(Status, AvailableAt, Id);
 CREATE INDEX IX_NarrationJobs_PoiLanguage ON NarrationJobs(PoiId, LanguageCode, Id);
END;
-- Keep the existing one-active-manual-track rule. Generated tracks have their
-- own immutable job identity and can replace each other atomically.
IF COL_LENGTH('AudioTracks','AutomationJobId') IS NULL
 ALTER TABLE AudioTracks ADD AutomationJobId bigint NULL REFERENCES NarrationJobs(Id);
IF EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('AudioTracks') AND name='IX_AudioTracks_POIId_LanguageCode' AND filter_definition NOT LIKE '%AutomationJobId%')
BEGIN
 DROP INDEX IX_AudioTracks_POIId_LanguageCode ON AudioTracks;
 EXEC('CREATE UNIQUE INDEX IX_AudioTracks_POIId_LanguageCode ON AudioTracks(POIId,LanguageCode) WHERE IsActive=1 AND DeletedAt IS NULL AND AutomationJobId IS NULL');
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('AudioTracks') AND name='UX_AudioTracks_AutomationJob')
 EXEC('CREATE UNIQUE INDEX UX_AudioTracks_AutomationJob ON AudioTracks(AutomationJobId) WHERE AutomationJobId IS NOT NULL');
IF OBJECT_ID('NarrationPublications', 'U') IS NULL
BEGIN
 CREATE TABLE NarrationPublications (
  PoiId int NOT NULL REFERENCES POIs(Id),
  LanguageCode nvarchar(10) NOT NULL,
  JobId bigint NOT NULL REFERENCES NarrationJobs(Id),
  AudioTrackId int NOT NULL REFERENCES AudioTracks(Id),
  TranslationId int NOT NULL REFERENCES POITranslations(Id),
  SourceVersion int NOT NULL,
  PublishedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT PK_NarrationPublications PRIMARY KEY(PoiId, LanguageCode)
 );
END;
