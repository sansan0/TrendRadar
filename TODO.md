# TODO

## Cloudflare Block

The application is currently unable to fetch news data because requests to the API endpoint (`https://newsnow.busiyi.world/api/s`) are being blocked by Cloudflare.

**To resolve this, you will need to either:**

1.  **Whitelist the application's IP address:** `34.46.237.233`
2.  **Provide a proxy server:** The application can be configured to use a proxy in `config/config.yaml`.

## News Source Configuration

The news sources in `config/config.yaml` are currently placeholders (`cnn`, `foxnews`, `reuters`). You will need to replace these with valid source IDs that are supported by the `newsnow.busiyi.world` API.
