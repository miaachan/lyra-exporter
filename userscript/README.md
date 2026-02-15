# userscript

This folder tracks the Tampermonkey userscript used by Lyra Exporter.

## Files

- `lyra-exporter-fetch.user.js`: Local copy of the GreasyFork script.

## Source

- Script page: `https://greasyfork.org/en/scripts/539579-lyra-exporter-fetch-one-click-ai-chat-backup`
- Direct code URL: `https://greasyfork.org/en/scripts/539579-lyra-exporter-fetch-one-click-ai-chat-backup/code/Lyra%20Exporter%20Fetch%20%28One-Click%20AI%20Chat%20Backup%29.user.js`

## Update command

```bash
mkdir -p userscript
curl -fL "https://greasyfork.org/en/scripts/539579-lyra-exporter-fetch-one-click-ai-chat-backup/code/Lyra%20Exporter%20Fetch%20%28One-Click%20AI%20Chat%20Backup%29.user.js" \
  -o userscript/lyra-exporter-fetch.user.js
```
