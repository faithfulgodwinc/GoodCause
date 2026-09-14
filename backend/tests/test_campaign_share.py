import importlib
import importlib.util


def _module():
    assert importlib.util.find_spec("campaign_share") is not None, (
        "The public campaign share renderer is missing"
    )
    return importlib.import_module("campaign_share")


def test_share_html_contains_campaign_open_graph_metadata():
    html = _module().render_campaign_share_html({
        "id": "cmp_123",
        "title": "Help Ada finish school",
        "summary": "Tuition support for Ada's final semester.",
        "story": "A longer campaign story.",
        "cover_image": "https://cdn.example.org/ada.jpg",
    })

    assert '<meta property="og:title" content="Help Ada finish school">' in html
    assert '<meta property="og:description" content="Tuition support for Ada&#x27;s final semester.">' in html
    assert '<meta property="og:image" content="https://cdn.example.org/ada.jpg">' in html
    assert '<meta name="twitter:card" content="summary_large_image">' in html
    assert 'https://www.goodcause.app/c/cmp_123' in html
    assert 'https://www.goodcause.app/campaign/cmp_123' in html


def test_share_html_escapes_untrusted_campaign_content():
    html = _module().render_campaign_share_html({
        "id": "cmp_123",
        "title": '<script>alert("title")</script>',
        "summary": '"><script>alert("description")</script>',
        "cover_image": 'https://example.org/image.jpg"><script>alert("image")</script>',
    })

    assert "<script>" not in html
    assert "&lt;script&gt;" in html


def test_share_html_uses_story_and_default_image_when_optional_fields_are_missing():
    html = _module().render_campaign_share_html({
        "id": "cmp_456",
        "title": "Community borehole",
        "story": "Help provide clean water to the entire community.",
    })

    assert "Help provide clean water to the entire community." in html
    assert "https://www.goodcause.app/favicon.ico" in html
