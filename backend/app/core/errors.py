"""Domain level exceptions shared across the service layer."""
from __future__ import annotations


class AppError(Exception):
    """Base class for expected, user-facing failures."""

    status_code = 400

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(AppError):
    status_code = 404


class ConfigurationError(AppError):
    """Raised when the app is missing a required setting (e.g. the Gemini key)."""

    status_code = 503


class ExportError(AppError):
    status_code = 422
