"""Server-rendered campaign share pages for social link previews."""

from html import escape
from urllib.parse import quote, urlparse


PUBLIC_WEB_ORIGIN = "https://www.goodcause.app"
DEFAULT_SHARE_IMAGE = f"{PUBLIC_WEB_ORIGIN}/favicon.ico"


def _safe_image_url(value: object) -> str:
    candidate = str(value or "").strip()
    parsed = urlparse(candidate)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return candidate
    return DEFAULT_SHARE_IMAGE


def _description(campaign: dict) -> str:
    value = campaign.get("summary") or campaign.get("story") or (
        "Support this campaign on GoodCause and help move a genuine need forward."
    )
    return " ".join(str(value).split())[:240]


def render_campaign_share_html(campaign: dict) -> str:
    campaign_id = quote(str(campaign["id"]), safe="")
    title = escape(str(campaign.get("title") or "Support a GoodCause"), quote=True)
    description = escape(_description(campaign), quote=True)
    image = escape(_safe_image_url(campaign.get("cover_image")), quote=True)
    canonical_url = f"{PUBLIC_WEB_ORIGIN}/c/{campaign_id}"
    destination_url = f"{PUBLIC_WEB_ORIGIN}/campaign/{campaign_id}"

    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{title} | GoodCause</title>
    <meta name="description" content="{description}">
    <link rel="canonical" href="{canonical_url}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="GoodCause">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:image" content="{image}">
    <meta property="og:image:alt" content="{title}">
    <meta property="og:url" content="{canonical_url}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{description}">
    <meta name="twitter:image" content="{image}">
    <meta http-equiv="refresh" content="0;url={destination_url}">
  </head>
  <body>
    <p>Opening <a href="{destination_url}">{title}</a> on GoodCause…</p>
  </body>
</html>"""
