from pydantic import BaseModel, ConfigDict
from sqlmodel import SQLModel


class PydanticStrictBaseModel(BaseModel):
    model_config = ConfigDict(
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
        # loc_by_alias=False,
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


class SQLModelStrictBaseModel(SQLModel):
    model_config = ConfigDict(
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
        # use_enum_values=True,
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
        # loc_by_alias=False,
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
