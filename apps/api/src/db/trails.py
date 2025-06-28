from pydantic import BaseModel, ConfigDict
from sqlalchemy import Column, ForeignKey, Integer
from sqlmodel import Field, SQLModel

from src.db.trail_runs import TrailRunRead


class TrailBase(SQLModel):
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )


class Trail(TrailBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
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


# TODO: This is a hacky way to get around the list[TrailRun] issue, find a better way to do this
class TrailRead(BaseModel):
    id: int | None = Field(default=None, primary_key=True)
    trail_uuid: str | None = None
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    creation_date: str | None = None
    update_date: str | None = None
    runs: list[TrailRunRead]
    model_config = ConfigDict(from_attributes=True, arbitrary_types_allowed=True)


def rebuild_trail_models() -> None:
    """Rebuild trail models to resolve forward references"""
    from src.db.trail_runs import rebuild_trail_run_models

    rebuild_trail_run_models()
    TrailRead.model_rebuild()
