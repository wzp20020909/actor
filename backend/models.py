from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from database import Base
import datetime

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    text_content = Column(Text)
    overview = Column(JSON)
    roles = Column(JSON)
    relationships = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
