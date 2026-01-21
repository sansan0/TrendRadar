import os
import aiofiles
from nicegui import ui
from app.core.config import config
from app.core.database import AsyncSessionLocal
from app.models.news import SyncLog
from sqlalchemy import select

async def admin_page():
    ui.label("Admin Panel").classes('text-2xl font-bold mb-4')

    with ui.tabs().classes('w-full') as tabs:
        config_tab = ui.tab('Configuration')
        logs_tab = ui.tab('Sync Logs')

    with ui.tab_panels(tabs, value=config_tab).classes('w-full'):

        # Configuration Tab
        with ui.tab_panel(config_tab):
            ui.label("Frequency Words Editor").classes('text-lg font-bold mb-2')

            freq_file_path = os.path.join(config.CONFIG_DIR, 'frequency_words.txt')

            # Read file content
            content = ""
            if os.path.exists(freq_file_path):
                async with aiofiles.open(freq_file_path, mode='r') as f:
                    content = await f.read()

            editor = ui.textarea(value=content).classes('w-full h-64 font-mono').props('outlined')

            async def save_config():
                new_content = editor.value
                # Atomic write
                temp_path = freq_file_path + ".tmp"
                try:
                    async with aiofiles.open(temp_path, mode='w') as f:
                        await f.write(new_content)
                    os.replace(temp_path, freq_file_path)
                    ui.notify("Configuration saved successfully!", type='positive')
                except Exception as e:
                    ui.notify(f"Error saving: {e}", type='negative')

            ui.button("Save Changes", on_click=save_config).classes('mt-4')

        # Sync Logs Tab
        with ui.tab_panel(logs_tab):
            ui.label("Synchronization History").classes('text-lg font-bold mb-2')

            log_grid = ui.aggrid({
                'columnDefs': [
                    {'headerName': 'ID', 'field': 'id', 'width': 60},
                    {'headerName': 'Start Time', 'field': 'start_time', 'width': 180},
                    {'headerName': 'Status', 'field': 'status', 'width': 100},
                    {'headerName': 'Items', 'field': 'new_items_count', 'width': 90},
                    {'headerName': 'Error', 'field': 'error_msg', 'flex': 1}
                ],
                'rowData': []
            }).classes('h-96')

            async def refresh_logs():
                async with AsyncSessionLocal() as session:
                    stmt = select(SyncLog).order_by(SyncLog.start_time.desc()).limit(50)
                    result = await session.execute(stmt)
                    logs = result.scalars().all()

                    data = []
                    for log in logs:
                        data.append({
                            'id': log.id,
                            'start_time': log.start_time.strftime('%Y-%m-%d %H:%M:%S') if log.start_time else '',
                            'status': log.status,
                            'new_items_count': log.new_items_count,
                            'error_msg': log.error_msg
                        })
                    log_grid.options['rowData'] = data
                    log_grid.update()

            await refresh_logs()
            ui.button("Refresh Logs", on_click=refresh_logs).classes('mt-4')
