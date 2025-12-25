from pydantic import BaseModel, ConfigDict
from sqlmodel import SQLModel
import os

# Determine development mode from environment to avoid importing config at module import
# time (which would create a circular import with config.config).
_env_dev = os.environ.get("PLATFORM_DEVELOPMENT_MODE", None)
if _env_dev is not None:
    is_dev_mode = bool(eval(_env_dev))
else:
    # Default to False (production) if not explicitly set.
    is_dev_mode = False


class FalsePydanticStrictBaseModel(BaseModel):
    model_config = ConfigDict(
        compiled=True,
        slots=True,
        # Use enum values, not names
        use_enum_values=True,
    )


class TruePydanticStrictBaseModel(BaseModel):
    model_config = ConfigDict(
        compiled=True,
        slots=True,
        # Core strictness settings
        strict=True,
        # Prevent extra fields completely
        # extra='forbid',
        # Validate all fields on assignment
        validate_assignment=True,
        # Validate default values
        validate_default=True,
        validate_return=True,
        # Use enum values, not names
        use_enum_values=True,
        # Prevent arbitrary types
        arbitrary_types_allowed=False,
        # String constraints
        str_strip_whitespace=True,
        # str_min_length=0,
        # str_max_length=10000,  # Prevent extremely large strings
        # JSON schema generation
        json_schema_mode="validation",
        # Serialization settings
        # ser_json_timedelta="float",
        ser_json_bytes="base64",
        loc_by_alias=False,
        # Prevent model mutation after creation for maximum stability
        # frozen=True,
        # Error handling
        # populate_by_name=True,
        # Additional strictness
        validate_call=True,
        # revalidate_instances="always",
        # Prevent aliasing issues
        alias_generator=None,
        # Strict JSON handling
        json_encoders={},
        # Regex engine for consistent behavior
        regex_engine="rust-regex",
        # debug
        validation_error_cause=True,
        # Validation settings
        hide_input_in_errors=False,
    )


class FalseSQLModelStrictBaseModel(SQLModel):
    model_config = ConfigDict(
        compiled=True,
    )


class TrueSQLModelStrictBaseModel(SQLModel):
    model_config = ConfigDict(
        compiled=True,
        # Core strictness settings
        strict=True,
        # Prevent extra fields completely
        # extra='forbid',
        # Validate all fields on assignment
        validate_assignment=True,
        # Validate default values
        validate_default=True,
        validate_return=True,
        # Use enum values, not names
        use_enum_values=True,
        # Prevent arbitrary types
        arbitrary_types_allowed=False,
        # String constraints
        str_strip_whitespace=True,
        # str_min_length=0,
        # str_max_length=10000,  # Prevent extremely large strings
        # JSON schema generation
        json_schema_mode="validation",
        # Serialization settings
        # ser_json_timedelta="float",
        ser_json_bytes="base64",
        loc_by_alias=False,
        # Prevent model mutation after creation for maximum stability
        # frozen=True,
        # Error handling
        # populate_by_name=True,
        # Additional strictness
        validate_call=True,
        # revalidate_instances="always",
        # Prevent aliasing issues
        alias_generator=None,
        # Strict JSON handling
        json_encoders={},
        # Regex engine for consistent behavior
        regex_engine="rust-regex",
        # debug
        validation_error_cause=True,
        # Validation settings
        hide_input_in_errors=False,
    )


# Default aliases selected by environment
# Use strict variants during development for maximum feedback
# and lighter (less-strict) variants in production for robustness.
PydanticStrictBaseModel: (
    type[FalsePydanticStrictBaseModel] | type[TruePydanticStrictBaseModel]
) = TruePydanticStrictBaseModel if is_dev_mode else FalsePydanticStrictBaseModel

SQLModelDefaultBase: (
    type[FalseSQLModelStrictBaseModel] | type[TrueSQLModelStrictBaseModel]
) = TrueSQLModelStrictBaseModel if is_dev_mode else FalseSQLModelStrictBaseModel

# Backwards-compatible alias: some modules import SQLModelStrictBaseModel
SQLModelStrictBaseModel = SQLModelDefaultBase

__all__: list[str] = [
    "FalsePydanticStrictBaseModel",
    "TruePydanticStrictBaseModel",
    "FalseSQLModelStrictBaseModel",
    "TrueSQLModelStrictBaseModel",
    "PydanticStrictBaseModel",
    "SQLModelDefaultBase",
    "SQLModelStrictBaseModel",
]
