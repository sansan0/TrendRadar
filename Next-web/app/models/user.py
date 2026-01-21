from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Index
from app.core.database import Base
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(128), nullable=False)
    role = Column(String(20), default="User")  # SuperAdmin, Admin, User
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def verify_password(self, plain_password):
        return pwd_context.verify(plain_password, self.hashed_password)

    @staticmethod
    def get_password_hash(password):
        return pwd_context.hash(password)


class InviteCode(Base):
    __tablename__ = "invite_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    role = Column(String(20), default="User")  # Role assigned when used
    is_used = Column(Boolean, default=False)
    used_by = Column(String(50), nullable=True) # Username who used it
    created_by = Column(String(50), nullable=False) # Admin who created it
    created_at = Column(DateTime, default=datetime.utcnow)
    used_at = Column(DateTime, nullable=True)
