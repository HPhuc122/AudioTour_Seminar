-- Extend the existing platform constraint for browser presence. No data is removed.
SET XACT_ABORT ON;
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.Devices') AND name='CK_Devices_Platform')
    ALTER TABLE dbo.Devices DROP CONSTRAINT CK_Devices_Platform;
ALTER TABLE dbo.Devices WITH CHECK ADD CONSTRAINT CK_Devices_Platform
    CHECK (Platform IN ('android','ios','windows','web'));
