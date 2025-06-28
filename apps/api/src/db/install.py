from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class InstallBase(SQLModel):
    step: int = Field(default=0)
    data: dict = Field(default={}, sa_column=Column(JSON))


class Install(InstallBase, table=True):
    id: int | None = Field(default=None, primary_key=True)
    install_uuid: str = Field(default=None)
    creation_date: str = ""
    update_date: str = ""


class InstallCreate(InstallBase):
    pass


class InstallUpdate(SQLModel):
    step: int | None = None
    data: dict | None = Field(default=None, sa_column=Column(JSON))


class InstallRead(InstallBase):
    id: int | None = Field(default=None, primary_key=True)
    install_uuid: str = Field(default=None)
    creation_date: str
    update_date: str
