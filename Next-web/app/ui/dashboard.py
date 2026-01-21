from nicegui import ui
from datetime import datetime, timedelta
from app.core.database import AsyncSessionLocal
from app.models.news import NewsItem
from sqlalchemy import select, func, text

async def dashboard_page():
    ui.label("Dashboard").classes('text-2xl font-bold mb-4')

    # Top: Date Picker (Range)
    # Using NiceGUI's date picker logic. For range, we might need two pickers or a custom element.
    # Simple approach: Start Date and End Date
    with ui.row().classes('w-full items-center gap-4 mb-6'):
        with ui.input('Start Date') as start_date:
            with ui.menu().props('no-parent-event') as start_menu:
                with ui.date().bind_value(start_date):
                    pass
            with start_date.add_slot('append'):
                ui.icon('edit_calendar').on('click', start_menu.open).classes('cursor-pointer')

        with ui.input('End Date') as end_date:
            with ui.menu().props('no-parent-event') as end_menu:
                with ui.date().bind_value(end_date):
                    pass
            with end_date.add_slot('append'):
                ui.icon('edit_calendar').on('click', end_menu.open).classes('cursor-pointer')

        ui.button('Filter', on_click=lambda: ui.notify("Filter not implemented in this mock")).props('primary')

    # Summary Cards
    with ui.row().classes('w-full gap-4 mb-6'):
        with ui.card().classes('w-64 p-4'):
            ui.label("Total News").classes('text-sm text-gray-500')
            # Fetch total count
            total_count = 0
            async with AsyncSessionLocal() as session:
                stmt = select(func.count(NewsItem.id))
                result = await session.execute(stmt)
                total_count = result.scalar()
            ui.label(f"{total_count:,}").classes('text-3xl font-bold')

        with ui.card().classes('w-64 p-4'):
            ui.label("System Health").classes('text-sm text-gray-500')

            # Logic to check freshness
            is_healthy = False
            last_date = "N/A"
            async with AsyncSessionLocal() as session:
                # Get latest publish time
                stmt = select(NewsItem.publish_time).order_by(NewsItem.publish_time.desc()).limit(1)
                result = await session.execute(stmt)
                latest_time = result.scalar_one_or_none()

                if latest_time:
                    last_date = latest_time.strftime("%Y-%m-%d %H:%M")
                    # Check if within 24 hours
                    if datetime.utcnow() - latest_time < timedelta(hours=24):
                        is_healthy = True

            status_text = "Healthy" if is_healthy else "Delayed"
            status_color = 'text-green-500' if is_healthy else 'text-red-500'
            ui.label(status_text).classes(f'text-3xl font-bold {status_color}')
            ui.label(f"Last update: {last_date}").classes('text-xs text-gray-400')

    # Charts (ECharts)
    with ui.row().classes('w-full gap-4'):
        # Platform Distribution
        # Fetch real data
        platform_data = []
        async with AsyncSessionLocal() as session:
            stmt = select(NewsItem.platform, func.count(NewsItem.id)).group_by(NewsItem.platform)
            result = await session.execute(stmt)
            for row in result.all():
                platform_data.append({'value': row[1], 'name': row[0]})

        ui.echart({
            'title': {'text': 'Platform Distribution'},
            'tooltip': {'trigger': 'item'},
            'series': [{
                'type': 'pie',
                'radius': '50%',
                'data': platform_data if platform_data else [{'value': 0, 'name': 'No Data'}]
            }]
        }).classes('w-1/2 h-64')

        # Top Keywords (Mock for now as we don't have keyword analysis table yet)
        ui.echart({
            'title': {'text': 'Top Keywords (Mock)'},
            'xAxis': {'data': ['AI', 'Python', 'DeepSeek', 'Docker', 'FastAPI']},
            'yAxis': {},
            'series': [{'type': 'bar', 'data': [120, 200, 150, 80, 70]}]
        }).classes('w-1/2 h-64')
