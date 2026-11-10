# HCMC restaurant photo demo

This demo dataset replaces the earlier Vĩnh Khánh-only POI list with 12 Ho Chi Minh City food and drink locations that have identifiable, reusable venue photographs. The legacy database dump `apps/VinhHyAudioTourDB.sql` is not read or imported.

- `source.vi.json` is the Vietnamese source seed: 12 POIs, 3 Tours, approximate coordinates, and one vendor account per POI.
- Each POI has one `Highlight` photo of the named venue and one `Menu` photo. `image-rights.csv` records Commons source, author, license, and attribution for each file.
- Some venue photos show the venue interior rather than its street sign. Menu photos marked representative are real licensed dishes, but are not verified as current products of the named venue. They are explicitly described that way in the rights CSV and narration.
- Location facts and coordinates are for a local demo. Some coordinates come from photo geotags; others are approximate address-level pins. Verify business status, exact entrance, and route before public use.
- The base seed leaves foreign translations/audio empty. Prepared translations and 72 existing MP3 files are now distributed separately in `../prepared-demo-2026-11-10`; import that package once to use them without running translation/TTS again.
- One simulated global access pass remains 100,000 VND for 60 minutes; the demo does not process real payments.

The photos are from Wikimedia Commons. Keep `image-rights.csv` with the image files and provide its attribution details wherever the assets are redistributed or displayed as required by each license.
