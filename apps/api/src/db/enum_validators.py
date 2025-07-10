"""
Utility validators for enum fields to handle psycopg3 migration issues.

After migrating from psycopg2 to psycopg3, enum validation in Pydantic became
stricter when using strict=True mode. This module provides reusable validators
to gracefully handle string-to-enum conversion.
"""

from enum import Enum
from typing import TypeVar

from pydantic import field_validator

EnumType = TypeVar("EnumType", bound=Enum)


def create_enum_validator[EnumType: Enum](enum_class: type[EnumType], field_name: str):
    """
    Create a field validator for an enum field that handles string conversion.

    Args:
        enum_class: The enum class to validate against
        field_name: The name of the field being validated

    Returns:
        A field validator function that can be used as a decorator

    """

    @field_validator(field_name, mode="before")
    @classmethod
    def validate_enum_field(cls, v: object) -> EnumType:
        if isinstance(v, str):
            try:
                return enum_class(v)
            except ValueError:
                msg = f"Invalid {field_name}: {v}. Must be one of {[e.value for e in enum_class]}"
                raise ValueError(msg)
        return v

    return validate_enum_field


def validate_enum_string[EnumType: Enum](
    value: object, enum_class: type[EnumType]
) -> EnumType:
    """
    Validate and convert a string value to an enum instance.

    Args:
        value: The value to validate (typically a string)
        enum_class: The enum class to convert to

    Returns:
        The enum instance

    Raises:
        ValueError: If the value is not a valid enum value

    """
    if isinstance(value, str):
        try:
            return enum_class(value)
        except ValueError:
            valid_values = [e.value for e in enum_class]
            msg = f"Invalid enum value: {value}. Must be one of {valid_values}"
            raise ValueError(msg)
    elif isinstance(value, enum_class):
        return value
    else:
        msg = f"Expected string or {enum_class.__name__}, got {type(value)}"
        raise ValueError(msg)
