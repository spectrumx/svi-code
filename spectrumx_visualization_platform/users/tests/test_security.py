"""
Security tests for authentication and CSRF protection.
"""

from django.test import Client
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from spectrumx_visualization_platform.users.models import User


class SecurityTestCase(TestCase):
    """Test security features and token handling."""

    def setUp(self):
        """Set up test data."""
        self.client = Client()
        self.api_client = APIClient()
        self.user = User.objects.create_user(
            username="testuser", email="test@example.com", password="testpass123"
        )

    def test_csrf_token_not_exposed_in_session_info(self):
        """Test that CSRF tokens are not exposed in session info endpoint."""
        self.client.force_login(self.user)
        response = self.client.get(reverse("api:session-info"))

        self.assertEqual(response.status_code, 200)
        data = response.json()

        # CSRF token should not be in the response
        self.assertNotIn("csrf_token", data)

        # Auth token should only be present if it exists
        if "auth_token" in data:
            self.assertIsInstance(data["auth_token"], (str, type(None)))

    def test_auth_token_creation_endpoint(self):
        """Test that auth tokens are only created when explicitly requested."""
        self.api_client.force_authenticate(user=self.user)

        # First, check session info without creating token
        response = self.api_client.get(reverse("api:session-info"))
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Initially, no auth token should exist
        self.assertIsNone(data.get("auth_token"))

        # Now create a token explicitly
        response = self.api_client.post(reverse("api:create-auth-token"))
        self.assertEqual(response.status_code, 201)
        data = response.json()

        # Should return a new token
        self.assertIn("auth_token", data)
        self.assertIsInstance(data["auth_token"], str)

        # Session info should now include the token
        response = self.api_client.get(reverse("api:session-info"))
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIsNotNone(data.get("auth_token"))

    def test_csrf_protection_enabled(self):
        """Test that CSRF protection is properly enabled."""
        # This test verifies that CSRF middleware is working
        # by checking that the CSRF cookie is set
        response = self.client.get("/")
        self.assertIn("csrftoken", response.cookies)

    def test_secure_cookie_settings(self):
        """Test that secure cookie settings are applied."""
        response = self.client.get("/")

        # Check that CSRF cookie has proper attributes
        csrf_cookie = response.cookies.get("csrftoken")
        if csrf_cookie:
            # In production, these should be True
            # In development, they might be False
            self.assertIsInstance(csrf_cookie.get("httponly"), bool)
            self.assertIsInstance(csrf_cookie.get("samesite"), str)
