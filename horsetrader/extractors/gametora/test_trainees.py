from lxml import html

from .trainees import GametoraTrainees


def test_name_and_badge_uses_card_text_not_generated_classes():
    anchor = html.fromstring("""
        <a href="/ja/umamusume/characters/100202-silence-suzuka">
          <div>
            <div><span><img alt=""></span></div>
            <div><span>サイレンススズカ</span></div>
            <div><span>夏</span></div>
          </div>
        </a>
    """)

    assert GametoraTrainees._name_and_badge(anchor) == ("サイレンススズカ", "夏")


def test_name_and_badge_handles_unadorned_base_trainee():
    anchor = html.fromstring("""
        <a href="/ja/umamusume/characters/100201-silence-suzuka">
          <div>
            <div><span><img alt=""></span></div>
            <div><span>サイレンススズカ</span></div>
            <div><span>⭐⭐⭐</span></div>
          </div>
        </a>
    """)

    assert GametoraTrainees._name_and_badge(anchor) == ("サイレンススズカ", "⭐⭐⭐")


def test_variant_from_badge_supports_current_index_vocabulary():
    assert GametoraTrainees._variant_from_badge("おとぎ話") == ("FAIRY_TALE", 3)


def test_name_and_badge_rejects_an_unrecognised_card_shape():
    anchor = html.fromstring("""
        <a href="/ja/umamusume/characters/100202-silence-suzuka">
          <div>
            <div><span><img alt=""></span></div>
            <div><span>サイレンススズカ</span></div>
            <div><span>夏</span></div>
            <div><span>unrelated text</span></div>
          </div>
        </a>
    """)

    import pytest

    with pytest.raises(ValueError, match="image, name, and badge cells"):
        GametoraTrainees._name_and_badge(anchor)

