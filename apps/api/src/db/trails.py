from typing import Optional, List
from pydantic import Field as PydanticField, ConfigDict
from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field
from src.db.trail_runs import TrailRunRead
from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel


class TrailBase(SQLModelStrictBaseModel):
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )


class Trail(TrailBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    trail_uuid: str = ""
    creation_date: str = ""
    update_date: str = ""


class TrailCreate(TrailBase):
    pass


class TrailRead(PydanticStrictBaseModel):
    id: Optional[int] = PydanticField(default=None)
    trail_uuid: Optional[str] = None
    org_id: int
    user_id: int
    creation_date: Optional[str] = None
    update_date: Optional[str] = None
    runs: List[TrailRunRead]

    model_config = ConfigDict(from_attributes=True)


def rebuild_trail_models() -> None:
    """
    Rebuild models to resolve Pydantic V2 forward references.
    This function is called during database initialization to ensure
    all model references are properly resolved.
    """
    # Rebuild models that may have forward references
    TrailRead.model_rebuild()
    Trail.model_rebuild()
    TrailCreate.model_rebuild()
    TrailBase.model_rebuild()
