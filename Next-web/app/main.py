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
    # SEO Meta Tags
    ui.add_head_html('<meta name="description" content="☁️翼枢AI速报_翼览通 - 全网热点新闻聚合与AI深度分析平台">')
    ui.add_head_html('<meta name="keywords" content="AI新闻, 热点聚合, 舆情分析, 翼枢AI, 翼览通">')
    ui.add_head_html('<meta name="author" content="翼枢AI">')

    # Auth Check
    if not app.storage.user.get('user_id'):
        return ui.navigate.to('/login')

    with ui.header().classes(replace='row items-center') as header:
        ui.button(on_click=lambda: left_drawer.toggle(), icon='menu').props('flat color=white')
        ui.label('☁️翼枢AI速报_翼览通').classes('text-lg font-bold text-white')

        ui.space()

        # Dark Mode Toggle
        dark = ui.dark_mode()
        ui.button(icon='dark_mode', on_click=dark.toggle).props('flat color=white')

        def logout():
            app.storage.user.clear()
            ui.navigate.to('/login')

        ui.button(icon='logout', on_click=logout).props('flat color=white')

    with ui.left_drawer(value=True).classes('bg-slate-100 dark:bg-slate-800') as left_drawer:
        ui.label("菜单").classes('text-gray-500 text-sm font-bold px-4 py-2')

        with ui.column().classes('w-full gap-0'):
            def nav(name, icon, page_idx):
                ui.button(name, icon=icon, on_click=lambda: container.set_value(page_idx)).props('flat align=left').classes('w-full')

            nav("数据大屏", "dashboard", 0)
            nav("新闻管理", "article", 1)
            nav("系统管理", "admin_panel_settings", 2)

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

    # Footer
    with ui.footer(fixed=False).classes('w-full bg-transparent text-gray-500 text-xs p-4 justify-center items-center column gap-2'):
        ui.label('由 ☁️翼枢AI速报_翼览通 生成')

        with ui.expansion('👉【免责声明】', icon='gavel').classes('w-full max-w-2xl bg-gray-100 dark:bg-gray-800 rounded p-2'):
            ui.markdown("""
**信息来源**：本报告所引用的所有数据（包括但不限于新闻标题、文章摘要、热榜排名）均来源于互联网公开渠道（Open Source Intelligence, OSINT）。本工具仅作为信息聚合器，不对原始信息的真实性、准确性或完整性负责。

**AI 分析提示**：报告中的“AI 分析”、“趋势解读”及“情感判断”均由人工智能模型自动生成，可能存在幻觉（Hallucination）、误读或偏差。所有分析仅供参考。

**合规性**：本报告仅供个人学习或学术研究使用。用户在使用本工具及相关数据时，请务必遵守当地法律法规（包括但不限于数据安全法、保密法）。严禁将本工具用于任何非法用途，开发者及配置提供者不承担任何因使用本报告而产生的法律责任。
            """).classes('text-xs text-gray-600 dark:text-gray-400')

# Login Page
@ui.page('/login')
def login():
    auth_manager.login_page()

@ui.page('/register')
def register():
    auth_manager.register_page()

# Run
ui.run(
    title="☁️翼枢AI速报_翼览通",
    favicon="🚀",
    storage_secret=config.SECRET_KEY,
    port=8086,
    language='zh-CN',
)
