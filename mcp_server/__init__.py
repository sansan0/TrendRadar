"""
TrendRadar MCP Server
Supports Chinese (default) and English.

Set environment variable:
    TRENDRADAR_MCP_LANG=en  # English
    TRENDRADAR_MCP_LANG=zh  # Chinese (default)

Example in mcp_config.json:
{
  "mcpServers": {
    "trendradar": {
      "command": "python",
      "args": ["-m", "trendradar.mcp_server"],
      "env": {
        "TRENDRADAR_MCP_LANG": "en"
      }
    }
  }
}
"""
import os
import locale

def get_language():
    """
    Detect language from environment variable or system locale.
    
    Returns:
        'en' for English, 'zh' for Chinese
    """
    # Check environment variable first
    lang = os.getenv('TRENDRADAR_MCP_LANG', '').lower()
    if lang.startswith('en'):
        return 'en'
    if lang.startswith('zh'):
        return 'zh'
    
    # Check system locale as fallback
    try:
        system_locale = locale.getdefaultlocale()[0]
        if system_locale and system_locale.startswith('en'):
            return 'en'
    except Exception:
        pass
    
    # Default to Chinese
    return 'zh'

# Import appropriate version based on language
_lang = get_language()

if _lang == 'en':
    from .server_en import *
else:
    from .server import *
