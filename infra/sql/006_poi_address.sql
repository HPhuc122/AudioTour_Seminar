IF COL_LENGTH(N'dbo.POIs', N'Address') IS NULL
BEGIN
    ALTER TABLE dbo.POIs ADD Address nvarchar(500) NULL;
END;
GO
