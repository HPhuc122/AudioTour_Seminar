"""Create a portable import script from the supplied SQL dump; does not execute SQL."""

from pathlib import Path

root = Path(__file__).resolve().parents[1]
source = root / "apps/VinhHyAudioTourDB.sql"
raw = source.read_bytes()
text = raw.decode(
    "utf-16" if raw.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
)
start = text.index("USE [VinhHyAudioTourDB]")
end = text.index("USE [master]", start)
output = root / ".tooling/import-audiotour.sql"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(
    "SET NOCOUNT ON;\nIF DB_ID(N'VinhHyAudioTourDB') IS NOT NULL THROW 50000, 'Database exists; refusing to overwrite.', 1;\nGO\nCREATE DATABASE [VinhHyAudioTourDB];\nGO\n"
    + text[start:end],
    encoding="utf-8",
)
print(
    f"Prepared {output}. Run sqlcmd -S localhost -E -C -b -f 65001 -i .tooling/import-audiotour.sql only on a new database."
)
