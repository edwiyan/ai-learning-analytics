from datetime import datetime
from pydantic import BaseModel


class ConsentResponse(BaseModel):
    id: str
    user_id: str
    accepted: bool
    version: str
    timestamp: datetime

    model_config = {"from_attributes": True}


class ConsentStatusResponse(BaseModel):
    accepted: bool
    version: str | None = None
    timestamp: datetime | None = None
