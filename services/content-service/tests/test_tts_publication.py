"""Publication regression tests use mocks only, never approve database content."""
import tempfile
import unittest
from contextlib import nullcontext
from pathlib import Path
from unittest.mock import Mock, patch

from app.services.narration_jobs import NarrationJobs


class TtsPublicationTests(unittest.TestCase):
    def publish(self, current_version=2):
        repo = Mock()
        repo.transaction.side_effect = lambda: nullcontext(repo)
        repo.lock.side_effect = [{'ReviewStatus': 'Approved', 'Version': current_version}, {'Id': 1}]
        repo.fetchone.side_effect = [
            {'Status': 'Processing', 'LeaseToken': 'lease'},
            {'NarrationId': 5, 'SourceVersion': current_version},
            None, None,
        ]
        repo.scalar.side_effect = [0, 1]
        repo.create_row.side_effect = [{'Id': 11}, {'Id': 12}]
        repo.save_media_file.return_value = {'Id': 13}
        job = dict(Id=7, NarrationId=5, PoiId=1, SourceVersion=2,
                   LeaseToken='lease', LanguageCode='vi', ReviewerId=1)
        with tempfile.TemporaryDirectory() as root:
            Path(root, 'voice.wav').write_bytes(b'RIFF0000WAVEtest')
            with patch('app.services.narration_jobs.settings', media_root=root):
                result = NarrationJobs(repo).publish(job, 'Approved source text', 'POI', 'voice.wav', 'audio/wav', 16)
        return result, repo

    def test_generated_track_preserves_text_and_tts_type(self):
        result, repo = self.publish()
        self.assertTrue(result)
        payload = repo.create_row.call_args_list[1].args[1]
        self.assertEqual(payload['AudioType'], 'tts')
        self.assertEqual(payload['TTSText'], 'Approved source text')
        self.assertEqual(payload['AutomationJobId'], 7)
        self.assertEqual(payload['ReviewStatus'], 'Approved')
        self.assertEqual(payload['FileUrl'], 'voice.wav')
        repo.save_media_file.assert_called_once()

    def test_old_source_cannot_replace_current_publication(self):
        result, repo = self.publish(current_version=3)
        self.assertFalse(result)
        repo.create_row.assert_not_called()
        repo.save_media_file.assert_not_called()
