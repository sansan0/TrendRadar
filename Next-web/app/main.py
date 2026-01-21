import logging
import asyncio
from nicegui import ui, app
from sqlalchemy import select
from app.core.database import init_db, AsyncSessionLocal
from app.services import start_scheduler
from app.ui.auth import auth_manager
from app.ui.dashboard import dashboard_page
from app.ui.news import news_page
from app.ui.admin import admin_page
from app.core.config import config
from app.models.user import User

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mount static files for audio
app.add_static_files('/static', config.STATIC_DIR)

# Startup
@app.on_startup
async def startup():
    await init_db()

    # Ensure default admin exists
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.username == "admin")
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        if not user:
            logger.info("Creating default admin account...")
            hashed = User.get_password_hash("123456")
            admin_user = User(username="admin", hashed_password=hashed, role="SuperAdmin")
            session.add(admin_user)
            await session.commit()

    start_scheduler()

# Main Layout
@ui.page('/')
async def index():
    # Auth Check
    if not app.storage.user.get('user_id'):
        return ui.navigate.to('/login')

    with ui.header().classes(replace='row items-center') as header:
        ui.button(on_click=lambda: left_drawer.toggle(), icon='menu').props('flat color=white')
        ui.label('TrendRadar Next').classes('text-lg font-bold text-white')

        ui.space()

        # Dark Mode Toggle
        dark = ui.dark_mode()
        ui.button(icon='dark_mode', on_click=dark.toggle).props('flat color=white')

        def logout():
            app.storage.user.clear()
            ui.navigate.to('/login')

        ui.button(icon='logout', on_click=logout).props('flat color=white')

    with ui.left_drawer(value=True).classes('bg-slate-100 dark:bg-slate-800') as left_drawer:
        ui.label("Menu").classes('text-gray-500 text-sm font-bold px-4 py-2')

        with ui.column().classes('w-full gap-0'):
            def nav(name, icon, page_idx):
                ui.button(name, icon=icon, on_click=lambda: container.set_value(page_idx)).props('flat align=left').classes('w-full')

            nav("Dashboard", "dashboard", 0)
            nav("News", "article", 1)
            nav("Admin", "admin_panel_settings", 2)

    with ui.column().classes('w-full p-4') as container:
        content_area = ui.column().classes('w-full')

        async def render_page(index):
            content_area.clear()
            with content_area:
                if index == 0:
                    await dashboard_page()
                elif index == 1:
                    await news_page()
                elif index == 2:
                    await admin_page()

        # Patch nav to use render_page
        container.set_value = render_page

        # Initial Load
        await render_page(0)

# Login Page
@ui.page('/login')
def login():
    auth_manager.login_page()

@ui.page('/register')
def register():
    auth_manager.register_page()

# Run
ui.run(
    title="TrendRadar Next",
    favicon="🚀",
    storage_secret=config.SECRET_KEY,
    port=8080,
)
