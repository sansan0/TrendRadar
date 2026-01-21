import os
import asyncio
import edge_tts
from nicegui import ui
from app.core.database import AsyncSessionLocal
from app.core.config import config
from app.models.news import NewsItem, AIAnalysis
from sqlalchemy import select, func, text

async def news_page():
    ui.label("News Management").classes('text-2xl font-bold mb-4')

    # State for pagination
    page_state = {'page': 1, 'size': 20, 'total': 0, 'query': ''}

    # Search Bar
    search_input = ui.input(placeholder='Search title or summary...').classes('w-full mb-4').props('clearable')

    # Grid
    columns = [
        {'headerName': 'ID', 'field': 'id', 'width': 70},
        {'headerName': 'Platform', 'field': 'platform', 'width': 100, 'sortable': True, 'filter': True},
        {'headerName': 'Title', 'field': 'title', 'flex': 1, 'sortable': True, 'filter': True},
        {'headerName': 'Date', 'field': 'source_db_date', 'width': 120, 'sortable': True},
        {'headerName': 'Actions', 'field': 'action', 'cellRenderer': 'btnCellRenderer', 'width': 150}
    ]

    grid = ui.aggrid({
        'columnDefs': columns,
        'rowData': [],
        'pagination': False, # We handle pagination manually
        'domLayout': 'autoHeight'
    }).classes('w-full')

    # Pagination Controls
    with ui.row().classes('w-full justify-between items-center mt-4'):
        btn_prev = ui.button('Previous', on_click=lambda: change_page(-1)).props('disabled')
        lbl_page = ui.label('Page 1')
        btn_next = ui.button('Next', on_click=lambda: change_page(1))

    async def load_data():
        query = page_state['query']
        page = page_state['page']
        size = page_state['size']
        offset = (page - 1) * size

        async with AsyncSessionLocal() as session:
            # Count Total
            if query:
                count_stmt = select(func.count(NewsItem.id)).where(text("MATCH(title) AGAINST (:query IN BOOLEAN MODE)")).params(query=query)
            else:
                count_stmt = select(func.count(NewsItem.id))

            total_result = await session.execute(count_stmt)
            total = total_result.scalar()
            page_state['total'] = total

            # Fetch Data
            if query:
                stmt = select(NewsItem).where(
                    text("MATCH(title) AGAINST (:query IN BOOLEAN MODE)")
                ).params(query=query).offset(offset).limit(size)
            else:
                stmt = select(NewsItem).order_by(NewsItem.publish_time.desc()).offset(offset).limit(size)

            result = await session.execute(stmt)
            items = result.scalars().all()

            row_data = []
            for item in items:
                row_data.append({
                    'id': item.id,
                    'platform': item.platform,
                    'title': item.title,
                    'source_db_date': item.source_db_date,
                    'url': item.url,
                    'summary': item.summary
                })
            grid.options['rowData'] = row_data
            grid.update()

            # Update Pagination UI
            lbl_page.text = f"Page {page} of {(total // size) + 1} (Total: {total})"
            btn_prev.props(f'disabled={page <= 1}')
            btn_next.props(f'disabled={page * size >= total}')

    async def change_page(delta):
        page_state['page'] += delta
        await load_data()

    async def perform_search():
        page_state['query'] = search_input.value
        page_state['page'] = 1
        await load_data()

    # Bind search input
    search_input.on('keydown.enter', perform_search)
    ui.button('Search', on_click=perform_search).classes('mb-4')

    await load_data()

    # AI Polish & TTS Logic (Popup)
    def on_row_click(e):
        if not e.args or 'data' not in e.args:
            return
        row = e.args['data']
        open_ai_polish_dialog(row)

    grid.on('cellClicked', on_row_click)

    dialog = ui.dialog()
    with dialog, ui.card().classes('w-full max-w-2xl'):
        dialog_title = ui.label("AI Analysis").classes('text-lg font-bold')

        with ui.tabs().classes('w-full') as tabs:
            tab_analysis = ui.tab('Analysis')
            tab_tts = ui.tab('Audio (TTS)')

        with ui.tab_panels(tabs, value=tab_analysis).classes('w-full'):
            with ui.tab_panel(tab_analysis):
                dialog_content = ui.markdown("Checking cache...")

            with ui.tab_panel(tab_tts):
                tts_status = ui.label("Ready to generate audio.")
                audio_player = ui.audio('').classes('w-full hidden')

                async def generate_audio(text_content, news_id):
                    tts_status.text = "Generating audio..."
                    try:
                        # Ensure output dir exists
                        if not os.path.exists(config.AUDIO_DIR):
                            os.makedirs(config.AUDIO_DIR)

                        filename = f"news_{news_id}.mp3"
                        filepath = os.path.join(config.AUDIO_DIR, filename)

                        # Generate TTS
                        communicate = edge_tts.Communicate(text_content, "zh-CN-XiaoxiaoNeural")
                        await communicate.save(filepath)

                        # Set audio source (assuming static mount)
                        # Add random query param to bypass browser cache if file changed
                        import time
                        audio_url = f"/static/audio/{filename}?t={int(time.time())}"
                        audio_player.props(f'src={audio_url}')
                        audio_player.classes(remove='hidden')
                        audio_player.update()

                        tts_status.text = "Audio generated."
                    except Exception as e:
                        tts_status.text = f"Error: {e}"

                btn_generate_tts = ui.button('Generate Audio', icon='mic')


        async def run_ai(row):
            news_id = row['id']
            dialog_content.content = "Checking cache..."

            async with AsyncSessionLocal() as session:
                # Check Cache
                stmt = select(AIAnalysis).where(AIAnalysis.news_id == news_id)
                result = await session.execute(stmt)
                existing_analysis = result.scalar_one_or_none()

                if existing_analysis:
                    analysis_text = existing_analysis.analysis_text
                    dialog_content.content = analysis_text
                else:
                    dialog_content.content = "Generating AI Analysis..."
                    # Mock AI call (simulate delay)
                    await asyncio.sleep(1.5)

                    # Generate content
                    analysis_text = f"**AI Summary for {row['title']}:**\n\n" \
                                    f"This article from {row['platform']} discusses key trends. " \
                                    f"Our analysis indicates high relevance to the current tech landscape. " \
                                    f"\n\n*Analyzed by TrendRadar AI*"

                    # Save to Cache
                    new_analysis = AIAnalysis(
                        news_id=news_id,
                        analysis_text=analysis_text,
                        model_used="mock-model-v1"
                    )
                    session.add(new_analysis)
                    await session.commit()

                    dialog_content.content = analysis_text

            # Update TTS button action
            tts_text = f"{row['title']}。{analysis_text.replace('*', '')}"
            # Remove existing listeners to avoid duplicates if reopened?
            # NiceGUI button click handlers accumulate if added repeatedly on same instance?
            # Re-creating button or cleaning up is safer.
            btn_generate_tts.on('click', lambda: generate_audio(tts_text, row['id']), replace=True)

        ui.button('Close', on_click=dialog.close)

    def open_ai_polish_dialog(row):
        dialog_title.text = row['title']
        audio_player.classes(add='hidden')
        tts_status.text = "Ready"
        dialog.open()
        # Trigger async AI call
        ui.timer(0.1, lambda: run_ai(row), once=True)
