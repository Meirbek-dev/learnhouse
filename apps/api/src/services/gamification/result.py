"""Small Result type for consistent service return semantics.

Avoids inconsistent mixes of raising HTTPException vs returning raw dicts.
Domain services should return `Result[T]` and leave translation to HTTP
responses to the API layer.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass(slots=True)
class Result[T]:
    ok: bool
    value: T | None = None
    error: str | None = None
    code: str | None = None  # optional machine code

    @classmethod
    def success(cls, value: T) -> Result[T]:
        return cls(ok=True, value=value)

    @classmethod
    def fail(cls, message: str, *, code: str | None = None) -> Result[T]:
        return cls(ok=False, error=message, code=code)

    def map(self, fn: Callable[[T], T]) -> Result[T]:
        if not self.ok or self.value is None:
            return self
        try:
            return Result.success(fn(self.value))
        except Exception as e:  # pragma: no cover - defensive
            return Result.fail(str(e))


async def to_result[T](awaitable: Awaitable[T]) -> Result[T]:
    try:
        value = await awaitable
        return Result.success(value)
    except Exception as e:  # pragma: no cover
        return Result.fail(str(e))
