"""Server-rendered share pages for social link previews (campaigns & fan zones)."""

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

    return _share_html(
        title=title,
        description=description,
        image=image,
        canonical_url=canonical_url,
        destination_url=destination_url,
        card_type="summary_large_image",
    )


def render_fan_zone_share_html(user: dict, zone: dict) -> str:
    """Social card for a user's Fan Zone page — shown by WhatsApp/Twitter/iMessage crawlers."""
    user_id = quote(str(user["id"]), safe="")
    name = str(user.get("name") or "Someone on GoodCause")
    headline = str(zone.get("headline") or f"Support {name}")
    bio = str(user.get("bio") or "")
    supporters = int(zone.get("supporters_count", 0))
    total_kobo = int(zone.get("total_received_kobo", 0))

    # Build a punchy description like BMaC cards
    desc_parts = [headline]
    if bio:
        desc_parts.append(bio[:120])
    if supporters > 0:
        received_str = f"₦{total_kobo // 100:,}" if total_kobo else ""
        supporter_str = f"{supporters} supporter{'s' if supporters != 1 else ''}"
        if received_str:
            desc_parts.append(f"{supporter_str} · {received_str} received")
        else:
            desc_parts.append(supporter_str)
    desc_parts.append("Send a small gift on GoodCause — no goal, no pressure.")
    description = escape(" · ".join(desc_parts)[:280], quote=True)

    # Prefer profile picture; fall back to default
    picture = _safe_image_url(user.get("picture"))
    image = escape(picture, quote=True)
    title_escaped = escape(headline, quote=True)

    canonical_url = f"{PUBLIC_WEB_ORIGIN}/share/fan-zone/{user_id}"
    destination_url = f"{PUBLIC_WEB_ORIGIN}/fan-zone/{user_id}"

    return _share_html(
        title=title_escaped,
        description=description,
        image=image,
        canonical_url=canonical_url,
        destination_url=destination_url,
        # Use summary (square) card so a round profile photo looks good in iMessage/Telegram
        card_type="summary",
    )


def _share_html(
    title: str,
    description: str,
    image: str,
    canonical_url: str,
    destination_url: str,
    card_type: str = "summary_large_image",
) -> str:
    """Shared HTML skeleton for all social share pages."""
    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{title} | GoodCause</title>
    <meta name="description" content="{description}">
    <link rel="canonical" href="{canonical_url}">
    <meta property="og:type" content="profile">
    <meta property="og:site_name" content="GoodCause">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:image" content="{image}">
    <meta property="og:image:alt" content="{title}">
    <meta property="og:url" content="{canonical_url}">
    <meta name="twitter:card" content="{card_type}">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{description}">
    <meta name="twitter:image" content="{image}">
    <meta http-equiv="refresh" content="0;url={destination_url}">
  </head>
  <body>
    <p>Opening <a href="{destination_url}">{title}</a> on GoodCause…</p>
  </body>
</html>"""
