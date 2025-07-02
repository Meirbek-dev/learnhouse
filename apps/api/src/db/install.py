from sqlalchemy import JSON, Column
from sqlmodel import Field

from src.db.strict_base_model import SQLModelStrictBaseModel


class InstallBase(SQLModelStrictBaseModel):
    step: int = Field(default=0)
    data: dict = Field(default_factory=dict, sa_column=Column(JSON))


class Install(InstallBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    install_uuid: str = Field(default=None)
    creation_date: str = ""
    update_date: str = ""


class InstallCreate(InstallBase):
    pass


class InstallUpdate(InstallBase):
    pass


class InstallRead(InstallBase):
    id: int | None = Field(default=None, primary_key=True)
    install_uuid: str = Field(default=None)
    creation_date: str
    update_date: str
