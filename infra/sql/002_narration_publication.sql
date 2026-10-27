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
IF OBJECT_ID('dbo.AudioTourMigrations') IS NULL THROW 50002, 'Apply 001_scope_and_review first.', 1;
IF NOT EXISTS (SELECT 1 FROM dbo.AudioTourMigrations WHERE Id='002_narration_publication')
BEGIN
    ALTER TABLE dbo.NarrationDrafts ADD PublishedTranslationId int NULL REFERENCES dbo.POITranslations(Id), PublishedTranslationVersion int NULL;
    INSERT dbo.AudioTourMigrations(Id) VALUES ('002_narration_publication');
END
COMMIT;
