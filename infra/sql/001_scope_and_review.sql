-- Apply to the database selected by sqlcmd -d; never creates/drops a database.
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET NOCOUNT ON;
BEGIN TRANSACTION;
IF OBJECT_ID('dbo.AudioTourMigrations') IS NULL
    CREATE TABLE dbo.AudioTourMigrations (Id varchar(100) PRIMARY KEY, AppliedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME());
IF NOT EXISTS (SELECT 1 FROM dbo.AudioTourMigrations WHERE Id='001_scope_and_review')
BEGIN
    IF OBJECT_ID('dbo.POIs') IS NULL OR OBJECT_ID('dbo.Tours') IS NULL
        THROW 50001, 'Import VinhHyAudioTourDB.sql schema before applying migration.', 1;
    IF COL_LENGTH('dbo.Tours','UserId') IS NULL
        ALTER TABLE dbo.Tours ADD UserId int NULL REFERENCES dbo.Users(Id);

    DECLARE @table sysname, @sql nvarchar(max);
    DECLARE tables CURSOR LOCAL FAST_FORWARD FOR SELECT name FROM sys.tables WHERE name IN ('POIs','Tours','AudioTracks','MediaFiles','NarrationDrafts','POITranslations','TourTranslations');
    OPEN tables;
    FETCH NEXT FROM tables INTO @table;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF COL_LENGTH('dbo.'+@table,'ReviewStatus') IS NULL
        BEGIN
            SET @sql=N'ALTER TABLE dbo.'+QUOTENAME(@table)+N' ADD ReviewStatus nvarchar(20) NOT NULL DEFAULT N''Pending'' WITH VALUES;';
            EXEC sp_executesql @sql;
        END
        IF COL_LENGTH('dbo.'+@table,'RejectionReason') IS NULL
        BEGIN
            SET @sql=N'ALTER TABLE dbo.'+QUOTENAME(@table)+N' ADD RejectionReason nvarchar(1000) NULL;'; EXEC sp_executesql @sql;
        END
        IF COL_LENGTH('dbo.'+@table,'Version') IS NULL
        BEGIN
            SET @sql=N'ALTER TABLE dbo.'+QUOTENAME(@table)+N' ADD Version int NOT NULL DEFAULT 1 WITH VALUES;'; EXEC sp_executesql @sql;
        END
        FETCH NEXT FROM tables INTO @table;
    END
    CLOSE tables; DEALLOCATE tables;
    IF COL_LENGTH('dbo.POITranslations','IsDeleted') IS NULL ALTER TABLE dbo.POITranslations ADD IsDeleted bit NOT NULL DEFAULT 0 WITH VALUES;
    IF COL_LENGTH('dbo.TourTranslations','IsDeleted') IS NULL ALTER TABLE dbo.TourTranslations ADD IsDeleted bit NOT NULL DEFAULT 0 WITH VALUES;

    -- Retain only explicitly reviewed legacy content. Audio/tour/translation rows
    -- without review evidence remain Pending until an administrator reviews them.
    EXEC(N'UPDATE dbo.POIs SET ReviewStatus=CASE WHEN ApprovalStatus=1 THEN N''Approved'' WHEN ApprovalStatus=2 THEN N''Rejected'' ELSE N''Pending'' END;');
    EXEC(N'UPDATE dbo.MediaFiles SET ReviewStatus=ApprovalStatus;');
    EXEC(N'UPDATE dbo.NarrationDrafts SET ReviewStatus=CASE WHEN Status IN (N''Approved'',N''Rejected'') THEN Status ELSE N''Pending'' END;');

    CREATE TABLE dbo.EntityGrants (
        Resource varchar(30) NOT NULL CHECK (Resource IN ('pois','tours')),
        EntityId int NOT NULL,
        UserId int NOT NULL REFERENCES dbo.Users(Id),
        GrantedByUserId int NOT NULL REFERENCES dbo.Users(Id),
        GrantedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        PRIMARY KEY(Resource,EntityId,UserId)
    );
    CREATE TABLE dbo.ContentSubmissions (
        Id bigint IDENTITY PRIMARY KEY,
        Resource varchar(30) NOT NULL CHECK (Resource IN ('pois','tours','audio','media','narrations','poi-translations','tour-translations')),
        EntityId int NOT NULL,
        BaseVersion int NOT NULL,
        PayloadJson nvarchar(max) NOT NULL CHECK (ISJSON(PayloadJson)=1),
        Operation varchar(20) NOT NULL CHECK (Operation IN ('update','delete')),
        Status nvarchar(20) NOT NULL CHECK (Status IN ('Pending','Approved','Rejected','Superseded')),
        SubmittedByUserId int NULL REFERENCES dbo.Users(Id),
        SubmittedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ReviewedByUserId int NULL REFERENCES dbo.Users(Id),
        ReviewedAt datetime2 NULL,
        RejectionReason nvarchar(1000) NULL,
        CHECK (Status <> 'Rejected' OR LEN(LTRIM(RTRIM(RejectionReason))) > 0)
    );
    CREATE UNIQUE INDEX UX_ContentSubmissions_Pending ON dbo.ContentSubmissions(Resource,EntityId) WHERE Status='Pending';
    CREATE INDEX IX_ContentSubmissions_Status ON dbo.ContentSubmissions(Status,Id);
    -- Populate the queue from imported records; do not silently approve them.
    DECLARE @resource varchar(30);
    DECLARE seed CURSOR LOCAL FAST_FORWARD FOR SELECT name, CASE name WHEN 'POIs' THEN 'pois' WHEN 'Tours' THEN 'tours' WHEN 'AudioTracks' THEN 'audio' WHEN 'MediaFiles' THEN 'media' WHEN 'NarrationDrafts' THEN 'narrations' WHEN 'POITranslations' THEN 'poi-translations' ELSE 'tour-translations' END FROM sys.tables WHERE name IN ('POIs','Tours','AudioTracks','MediaFiles','NarrationDrafts','POITranslations','TourTranslations');
    OPEN seed; FETCH NEXT FROM seed INTO @table,@resource;
    WHILE @@FETCH_STATUS=0
    BEGIN
        SET @sql=N'INSERT dbo.ContentSubmissions(Resource,EntityId,BaseVersion,PayloadJson,Operation,Status) SELECT @r,t.Id,t.Version,(SELECT t.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),''update'',''Pending'' FROM dbo.'+QUOTENAME(@table)+N' t WHERE t.ReviewStatus=''Pending''';
        IF @table IN ('POIs','Tours','AudioTracks') SET @sql += N' AND t.DeletedAt IS NULL';
        IF @table='MediaFiles' SET @sql += N' AND t.IsDeleted=0';
        EXEC sp_executesql @sql,N'@r varchar(30)',@r=@resource;
        FETCH NEXT FROM seed INTO @table,@resource;
    END
    CLOSE seed; DEALLOCATE seed;
    INSERT dbo.AudioTourMigrations(Id) VALUES ('001_scope_and_review');
END
COMMIT;
