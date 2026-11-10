import unittest
from unittest.mock import Mock, patch

from app.services.content_service import ContentService


class PublishedAudioContractTests(unittest.TestCase):
    def test_published_audio_keeps_mobile_id_and_stream_url_consistent(self):
        repo = Mock()
        repo.get_public_poi.return_value = {"id": 7}
        repo.narration_state.return_value = {
            "latest": None,
            "published": {"id": 81, "description": "Text", "name": "POI",
                          "sourceVersion": 2, "narrationId": 3, "jobId": 4,
                          "fileUrl": "uploads/audio/example.mp3"},
        }
        service = ContentService(repo)
        with patch.object(service, '_resolve_media_path'):
            track = service.get_poi(7, 'vi')['audioTracks'][0]
        self.assertEqual(track['audioTrackId'], 81)
        self.assertEqual(track['id'], 81)
        self.assertTrue(track['isAvailable'])
        self.assertTrue(track['streamUrl'].endswith('/audio/81'))
