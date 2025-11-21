from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, Mock, patch

import pytest
from fastapi import HTTPException, Request
from fastapi_another_jwt_auth import AuthJWT
from jwt import decode
from sqlmodel import Session

from src.db.users import AnonymousUser, PublicUser, User
from src.security.auth import (
    Settings,
    Token,
    TokenData,
    authenticate_user,
    create_access_token,
    get_current_user,
    non_public_endpoint,
)
from src.security.security import ALGORITHM, SECRET_KEY


class TestAuth:
    """Test cases for auth.py module"""

    @pytest.fixture
    def mock_request(self) -> Mock:
        """Create a mock request object"""
        return Mock(spec=Request)

    @pytest.fixture
    def mock_db_session(self) -> Mock:
        """Create a mock database session"""
        return Mock(spec=Session)

    @pytest.fixture
    def mock_user(self) -> Mock:
        """Create a mock user object"""
        user = Mock(spec=User)
        user.email = "test@example.com"
        user.password = "hashed_password"
        user.model_dump.return_value = {
            "id": 1,
            "email": "test@example.com",
            "username": "testuser",
            "first_name": "Test",
            "last_name": "User",
            "user_uuid": "user_123",
        }
        return user

    def test_token_model(self) -> None:
        """Test Token model"""
        token = Token(access_token="test_token", token_type="bearer")
        assert token.access_token == "test_token"
        assert token.token_type == "bearer"

    def test_token_data_model(self) -> None:
        """Test TokenData model"""
        token_data = TokenData(username="test@example.com")
        assert token_data.username == "test@example.com"

    def test_token_data_model_default(self) -> None:
        """Test TokenData model with default values"""
        token_data = TokenData()
        assert token_data.username is None

    def test_settings_model(self) -> None:
        """Test Settings model"""
        settings = Settings()
        # JWT secret is auto-generated in dev mode or from SECRET_KEY env var
        assert isinstance(settings.authjwt_secret_key, str)
        assert len(settings.authjwt_secret_key) > 0  # Ensure it's not empty
        assert settings.authjwt_token_location == {"cookies", "headers"}
        assert settings.authjwt_cookie_csrf_protect is False
        assert settings.authjwt_cookie_samesite == "lax"
        # Cookie secure flag depends on SSL configuration
        assert isinstance(settings.authjwt_cookie_secure, bool)

    # Note: get_config is a decorator function for AuthJWT.load_config
    # Testing it directly may not be appropriate in unit tests

    @pytest.mark.asyncio
    async def test_authenticate_user_success(
        self, mock_request, mock_db_session, mock_user
    ) -> None:
        """Test successful user authentication"""
        with (
            patch(
                "src.security.auth.security_get_user", new_callable=AsyncMock
            ) as mock_get_user,
            patch("src.security.auth.security_verify_password", return_value=True),
        ):
            mock_get_user.return_value = mock_user

            result = await authenticate_user(
                request=mock_request,
                email="test@example.com",
                password="correct_password",
                db_session=mock_db_session,
            )

            assert result == mock_user
            mock_get_user.assert_called_once_with(
                mock_request, mock_db_session, "test@example.com"
            )

    @pytest.mark.asyncio
    async def test_authenticate_user_user_not_found(
        self, mock_request, mock_db_session
    ) -> None:
        """Test authentication when user is not found"""
        with patch(
            "src.security.auth.security_get_user", new_callable=AsyncMock
        ) as mock_get_user:
            mock_get_user.return_value = None

            result = await authenticate_user(
                request=mock_request,
                email="nonexistent@example.com",
                password="password",
                db_session=mock_db_session,
            )

            assert result is False

    @pytest.mark.asyncio
    async def test_authenticate_user_wrong_password(
        self, mock_request, mock_db_session, mock_user
    ) -> None:
        """Test authentication with wrong password"""
        with (
            patch(
                "src.security.auth.security_get_user", new_callable=AsyncMock
            ) as mock_get_user,
            patch("src.security.auth.security_verify_password", return_value=False),
        ):
            mock_get_user.return_value = mock_user

            result = await authenticate_user(
                request=mock_request,
                email="test@example.com",
                password="wrong_password",
                db_session=mock_db_session,
            )

            assert result is False

    def test_create_access_token_default_expiry(self) -> None:
        """Test access token creation with default expiry"""
        data = {"sub": "test@example.com"}
        token = create_access_token(data)

        # Verify token is created
        assert isinstance(token, str)
        assert len(token) > 0

        # Decode and verify token
        decoded = decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert decoded["sub"] == "test@example.com"
        assert "exp" in decoded

    def test_create_access_token_custom_expiry(self) -> None:
        """Test access token creation with custom expiry"""
        data = {"sub": "test@example.com"}
        expires_delta = timedelta(hours=2)
        token = create_access_token(data, expires_delta)

        # Decode and verify token
        decoded = decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert decoded["sub"] == "test@example.com"

        # Check that expiry time exists and is in the future
        assert "exp" in decoded
        exp_time = datetime.fromtimestamp(decoded["exp"], tz=UTC)
        now = datetime.now(UTC)

        # Verify the token expires in the future
        assert exp_time > now

    @pytest.mark.asyncio
    async def test_get_current_user_authenticated(
        self, mock_request, mock_db_session, mock_user
    ) -> None:
        """Test getting current user when authenticated"""
        with patch(
            "src.security.auth.security_get_user", new_callable=AsyncMock
        ) as mock_get_user:
            mock_get_user.return_value = mock_user

            # Mock AuthJWT
            mock_authorize = Mock(spec=AuthJWT)
            mock_authorize.jwt_optional.return_value = None
            mock_authorize.get_jwt_subject.return_value = "test@example.com"

            result = await get_current_user(
                request=mock_request,
                Authorize=mock_authorize,
                db_session=mock_db_session,
            )

            assert isinstance(result, PublicUser)
            mock_get_user.assert_called_once_with(
                mock_request, mock_db_session, email="test@example.com"
            )

    @pytest.mark.asyncio
    async def test_get_current_user_anonymous(
        self, mock_request, mock_db_session
    ) -> None:
        """Test getting current user when anonymous"""
        # Mock AuthJWT
        mock_authorize = Mock(spec=AuthJWT)
        mock_authorize.jwt_optional.return_value = None
        mock_authorize.get_jwt_subject.return_value = None

        result = await get_current_user(
            request=mock_request, Authorize=mock_authorize, db_session=mock_db_session
        )

        assert isinstance(result, AnonymousUser)

    @pytest.mark.asyncio
    async def test_get_current_user_jwt_error(
        self, mock_request, mock_db_session
    ) -> None:
        """Test getting current user when JWT is invalid"""
        from jwt import PyJWTError

        # Mock AuthJWT to raise JWTError
        mock_authorize = Mock(spec=AuthJWT)
        mock_authorize.jwt_optional.side_effect = PyJWTError("Invalid token")

        with pytest.raises(HTTPException) as exc_info:
            await get_current_user(
                request=mock_request,
                Authorize=mock_authorize,
                db_session=mock_db_session,
            )

        assert exc_info.value.status_code == 401
        assert "Could not validate credentials" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_get_current_user_user_not_found(
        self, mock_request, mock_db_session
    ) -> None:
        """Test getting current user when user doesn't exist in database"""
        with patch(
            "src.security.auth.security_get_user", new_callable=AsyncMock
        ) as mock_get_user:
            mock_get_user.return_value = None

            # Mock AuthJWT
            mock_authorize = Mock(spec=AuthJWT)
            mock_authorize.jwt_optional.return_value = None
            mock_authorize.get_jwt_subject.return_value = "nonexistent@example.com"

            with pytest.raises(HTTPException) as exc_info:
                await get_current_user(
                    request=mock_request,
                    Authorize=mock_authorize,
                    db_session=mock_db_session,
                )

            assert exc_info.value.status_code == 401
            assert "Could not validate credentials" in exc_info.value.detail

    @pytest.mark.asyncio
    async def test_non_public_endpoint_authenticated(self, mock_user) -> None:
        """Test non_public_endpoint with authenticated user"""
        # Should not raise any exception
        await non_public_endpoint(mock_user)

    @pytest.mark.asyncio
    async def test_non_public_endpoint_anonymous(self) -> None:
        """Test non_public_endpoint with anonymous user"""
        anonymous_user = AnonymousUser()

        with pytest.raises(HTTPException) as exc_info:
            await non_public_endpoint(anonymous_user)

        assert exc_info.value.status_code == 401
        assert "Not authenticated" in exc_info.value.detail

    def test_jwt_secret_generation_in_dev_mode(self) -> None:
        """Test that JWT secret is properly generated in development mode"""
        from src.security.auth import _get_jwt_secret

        secret = _get_jwt_secret()

        # Verify secret is a non-empty string
        assert isinstance(secret, str)
        assert len(secret) > 0

        # Verify secret is sufficiently long (secure)
        # token_urlsafe(32) generates ~43 character base64 string
        if secret != "secret":  # If not using hardcoded dev secret
            assert len(secret) >= 32, (
                "Generated secret should be at least 32 characters"
            )

    def test_settings_cookie_security(self) -> None:
        """Test that cookie security settings are properly configured"""
        settings = Settings()

        # Verify cookie security settings
        assert (
            settings.authjwt_cookie_csrf_protect is False
        )  # CSRF protection via SameSite
        assert settings.authjwt_cookie_samesite == "lax"  # CSRF protection
        assert isinstance(settings.authjwt_cookie_secure, bool)  # Depends on SSL config

        # Verify token location includes cookies
        assert "cookies" in settings.authjwt_token_location
        assert "headers" in settings.authjwt_token_location
