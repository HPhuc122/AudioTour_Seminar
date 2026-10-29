# HCMC restaurant photo demo

This demo dataset replaces the earlier Vĩnh Khánh-only POI list with 12 Ho Chi Minh City food and drink locations that have identifiable, reusable venue photographs. The legacy database dump `apps/VinhHyAudioTourDB.sql` is not read or imported.

- `source.vi.json` is the Vietnamese source seed: 12 POIs, 3 Tours, approximate coordinates, and one vendor account per POI.
- Each POI has one `Highlight` photo of the named venue and one `Menu` photo. `image-rights.csv` records Commons source, author, license, and attribution for each file.
- Some venue photos show the venue interior rather than its street sign. Menu photos marked representative are real licensed dishes, but are not verified as current products of the named venue. They are explicitly described that way in the rights CSV and narration.
- Location facts and coordinates are for a local demo. Some coordinates come from photo geotags; others are approximate address-level pins. Verify business status, exact entrance, and route before public use.
- Translation/audio remain empty until keys and free quota are confirmed. No translation or speech generation was requested or run here.
- One simulated global access pass remains 100,000 VND for 60 minutes; the demo does not process real payments.

The photos are from Wikimedia Commons. Keep `image-rights.csv` with the image files and provide its attribution details wherever the assets are redistributed or displayed as required by each license.
