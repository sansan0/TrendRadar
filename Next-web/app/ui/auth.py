from nicegui import ui
from fastapi import Request
from app.models.user import User, InviteCode
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from passlib.context import CryptContext
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class AuthManager:
    def __init__(self):
        pass

    def login_page(self):
        # Center the login card
        with ui.card().classes('absolute-center w-96 p-8'):
            ui.label('TrendRadar Next').classes('text-2xl font-bold text-center mb-6 w-full')

            username = ui.input('Username').classes('w-full mb-4').props('autofocus')
            password = ui.input('Password', password=True, password_toggle_button=True).classes('w-full mb-6')

            async def try_login():
                if not username.value or not password.value:
                    ui.notify("Username and password are required", color='negative')
                    return

                async with AsyncSessionLocal() as session:
                    stmt = select(User).where(User.username == username.value)
                    result = await session.execute(stmt)
                    user = result.scalar_one_or_none()

                    if user and user.verify_password(password.value):
                         ui.notify("Login successful!", type='positive')
                         # In a real app we'd set a cookie/session here
                         # For this single-page app demo, we just navigate
                         ui.navigate.to('/')
                    else:
                        ui.notify("Invalid credentials", color='negative')

            ui.button('Login', on_click=try_login).classes('w-full')

            # Simple Register Link (could be a dialog)
            with ui.row().classes('w-full justify-center mt-4'):
                ui.link('Register with Invite Code', '/register').classes('text-sm text-gray-500')

    def register_page(self):
        with ui.card().classes('absolute-center w-96 p-8'):
            ui.label('Register').classes('text-2xl font-bold text-center mb-6 w-full')

            username = ui.input('Username').classes('w-full mb-4')
            password = ui.input('Password', password=True).classes('w-full mb-4')
            invite_code = ui.input('Invite Code').classes('w-full mb-6')

            async def try_register():
                if not username.value or not password.value or not invite_code.value:
                    ui.notify("All fields are required", color='negative')
                    return

                success, msg = await self.register(username.value, password.value, invite_code.value)
                if success:
                    ui.notify(msg, type='positive')
                    ui.navigate.to('/login')
                else:
                    ui.notify(msg, color='negative')

            ui.button('Register', on_click=try_register).classes('w-full')
            ui.link('Back to Login', '/login').classes('text-sm text-gray-500 mt-4 text-center w-full block')

    async def login(self, username, password) -> bool:
        async with AsyncSessionLocal() as session:
            stmt = select(User).where(User.username == username)
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()

            if user and user.verify_password(password):
                return user
            return None

    async def register(self, username, password, invite_code) -> tuple[bool, str]:
        async with AsyncSessionLocal() as session:
            # Check invite code
            stmt = select(InviteCode).where(InviteCode.code == invite_code, InviteCode.is_used == False)
            result = await session.execute(stmt)
            code_obj = result.scalar_one_or_none()

            if not code_obj:
                return False, "Invalid or used invite code"

            # Check username
            stmt = select(User).where(User.username == username)
            result = await session.execute(stmt)
            if result.scalar_one_or_none():
                return False, "Username already exists"

            # Create user
            hashed = User.get_password_hash(password)
            new_user = User(username=username, hashed_password=hashed, role=code_obj.role)
            session.add(new_user)

            # Mark code as used
            code_obj.is_used = True
            code_obj.used_by = username
            code_obj.used_at = datetime.utcnow()

            await session.commit()
            return True, "Registration successful"

auth_manager = AuthManager()
