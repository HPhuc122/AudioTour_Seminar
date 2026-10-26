import unittest
from unittest.mock import MagicMock
from fastapi import HTTPException
from app.core.admin_validation import validate_user
from app.services.auth_service import AuthService


class AdminUserValidationTests(unittest.TestCase):
    def test_vendor_registration_validates_and_fixes_role(self):
        repo = MagicMock()
        repo.list_roles.return_value = [{'id': 7, 'name': 'Vendor'}]
        repo.get_role.return_value = {'id': 7}
        repo._fetchone.return_value = None
        service = AuthService(repo)
        payload = {'username': 'vendor.test', 'email': 'vendor@example.test', 'password': 'password', 'roleId': 1}
        for change in ({'username': ' '}, {'email': 'bad@'}, {'password': ''}, {'password': 'a' * 73}):
            with self.subTest(change=change), self.assertRaises(HTTPException) as err:
                service.register_vendor({**payload, **change})
            self.assertEqual(err.exception.status_code, 422)
        repo.create_user.assert_not_called()
        repo._fetchone.return_value = {'Id': 2}
        with self.assertRaises(HTTPException) as err:
            service.register_vendor(payload)
        self.assertEqual(err.exception.status_code, 409)
        repo.create_user.assert_not_called()
        repo._fetchone.return_value = None
        service.register_vendor(payload)
        self.assertEqual(repo.create_user.call_args.args[0]['roleId'], 7)

    def test_required_fields_email_and_password_limits(self):
        good = {'username': 'admin.test', 'email': 'admin@example.test', 'password': 'test-password', 'roleId': 1}
        for patch in ({'username': '  '}, {'email': 'bad@'}, {'roleId': None}, {'password': 'a' * 73}):
            with self.subTest(patch=patch), self.assertRaises(HTTPException) as err:
                validate_user({**good, **patch}, creating=True)
            self.assertEqual(err.exception.status_code, 422)

    def test_rejects_unknown_role_before_write(self):
        repo = MagicMock(); repo.get_role.return_value = None
        with self.assertRaises(HTTPException) as err:
            AuthService(repo).create_user({'username': 'a', 'email': 'a@example.test', 'password': 'password', 'roleId': 999})
        self.assertEqual(err.exception.status_code, 422); repo.create_user.assert_not_called()

    def test_rejects_duplicate_username_before_write(self):
        repo = MagicMock(); repo.get_role.return_value = {'id': 1}; repo._fetchone.return_value = {'Id': 2}
        with self.assertRaises(HTTPException) as err:
            AuthService(repo).create_user({'username': 'duplicate', 'email': 'a@example.test', 'password': 'password', 'roleId': 1})
        self.assertEqual(err.exception.status_code, 409); repo.create_user.assert_not_called()

    def test_update_validates_email_and_keeps_blank_password(self):
        repo = MagicMock(); repo.get_user.return_value = {'id': 1}; repo._fetchone.return_value = None
        service = AuthService(repo)
        with self.assertRaises(HTTPException):
            service.update_user(1, {'email': 'bad@'})
        repo.update_user.assert_not_called()
        service.update_user(1, {'email': 'a@example.test', 'password': ''})
        self.assertIsNone(repo.update_user.call_args.args[2])
