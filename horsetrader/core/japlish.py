from re import sub as re_sub
from typing import Optional, Union

from horsetrader.enums import JaplishEncoding
from horsetrader.semantics import tazuna


@tazuna
class Japlish(str):

    @staticmethod
    def _normalize_text(text: str) -> str:
        if not isinstance(text, str):
            raise ValueError("text must be a string")
        _normalized = text.replace("\u3000", " ")
        _normalized = re_sub(r"\s+", " ", _normalized)
        return _normalized.strip()

    def __new__(
        cls,
        text: str,
        encoding: Optional[Union[JaplishEncoding, str]] = None,
    ) -> "Japlish":

        _ = encoding  # Encoding is handled in __init__, but we need to accept it here for signature purposes.
        return super().__new__(cls, cls._normalize_text(text))

    def __init__(
        self, text: str, encoding: Optional[Union[JaplishEncoding, str]] = None
    ):
        _ = text  # Already normalized in __new__, but we need to accept it here for signature purposes.

        self._jp_text: Optional[str] = None
        self._en_text: Optional[str] = None

        _normalized_text = str(self)

        if encoding is None:
            resolved_encoding = self._get_encoding(_normalized_text)
        else:
            resolved_encoding = self._normalize_encoding(encoding)

        self.encoding = resolved_encoding

    @staticmethod
    def _normalize_encoding(
        encoding: Union[JaplishEncoding, str],
    ) -> JaplishEncoding:

        if isinstance(encoding, JaplishEncoding):
            return encoding

        if isinstance(encoding, str):
            normalized = encoding.strip().lower()
            if normalized == JaplishEncoding.JP.value:
                return JaplishEncoding.JP
            if normalized == JaplishEncoding.EN.value:
                return JaplishEncoding.EN

        raise ValueError("encoding must be JaplishEncoding.JP or JaplishEncoding.EN")

    @staticmethod
    def _contains_japanese(text: str) -> bool:
        for c in text:
            code = ord(c)

            # Hiragana
            if 0x3040 <= code <= 0x309F:
                return True

            # Katakana + Katakana Phonetic Extensions + Halfwidth Katakana
            if 0x30A0 <= code <= 0x30FF:
                return True
            if 0x31F0 <= code <= 0x31FF:
                return True
            if 0xFF66 <= code <= 0xFF9D:
                return True

            # Kanji (CJK Unified Ideographs + Extension A + Compatibility Ideographs)
            if 0x4E00 <= code <= 0x9FFF:
                return True
            if 0x3400 <= code <= 0x4DBF:
                return True
            if 0xF900 <= code <= 0xFAFF:
                return True

        return False

    def _get_encoding(self, text: str) -> JaplishEncoding:
        if self._contains_japanese(text):
            return JaplishEncoding.JP
        return JaplishEncoding.EN

    def _apply_encoding(self) -> None:
        text = str(self)
        self._jp_text = None
        self._en_text = None

        if self._encoding == JaplishEncoding.JP:
            self._jp_text = text
        else:
            self._en_text = text

    @property
    def encoding(self) -> JaplishEncoding:
        """The base string payload's active language (JP or EN).

        Reassigning `encoding` is destructive: both `.jp` and `.en` slots are
        cleared and the active one is re-derived from the current base str.
        This is the "relabel the underlying payload" operation, not a smart
        translation set. To attach a translation without disturbing the base,
        assign to `.jp` or `.en` directly — those setters leave the other slot
        alone.
        """
        return self._encoding

    @encoding.setter
    def encoding(self, value: Union[JaplishEncoding, str]) -> None:
        self._encoding = self._normalize_encoding(value)
        self._apply_encoding()

    def __repr__(self) -> str:
        parts = [
            f"{str(self)!r}",
            f"encoding={self._encoding.value!r}",
        ]

        if self._jp_text is not None and self._encoding != JaplishEncoding.JP:
            parts.append(f"jp={self._jp_text!r}")
        if self._en_text is not None and self._encoding != JaplishEncoding.EN:
            parts.append(f"en={self._en_text!r}")

        return f"Japlish({', '.join(parts)})"

    @staticmethod
    def _validate_assigned_text(value: str, field_name: str) -> str:
        if not isinstance(value, str):
            raise ValueError(f"{field_name} must be a non-empty string")
        _normalized = Japlish._normalize_text(value)
        if not _normalized:
            raise ValueError(f"{field_name} must be a non-empty string")
        return _normalized

    @property
    def jp(self) -> str:
        if self._jp_text is None:
            raise ValueError("Japanese text not set")
        return self._jp_text

    @jp.setter
    def jp(self, value: str) -> None:
        jp_text = self._validate_assigned_text(value, "jp")
        self._jp_text = jp_text

        # If assigned JP text matches the base str payload, JP is the active encoding.
        # Don't clear _en_text — both slots can coexist (romaji JP titles have valid EN translations).
        if jp_text == str(self):
            self._encoding = JaplishEncoding.JP

    @property
    def en(self) -> str:
        if self._en_text is None:
            raise ValueError("English text not set")
        return self._en_text

    @en.setter
    def en(self, value: str) -> None:
        en_text = self._validate_assigned_text(value, "en")
        self._en_text = en_text

        # If assigned EN text matches the base str payload, EN is the active encoding.
        # Don't clear _jp_text — both slots can coexist (romaji JP titles have valid EN translations).
        if en_text == str(self):
            self._encoding = JaplishEncoding.EN

    def match(self, query: str) -> bool:
        """True if any encoded form of this text contains ``query`` (case-insensitive)."""
        needle = query.lower()
        if needle in str(self).lower():
            return True
        for attr in ("jp", "en"):
            try:
                if needle in getattr(self, attr).lower():
                    return True
            except ValueError:
                pass
        return False


if __name__ == "__main__":
    # Lightweight smoke tests.

    # Auto-detect JP from script ranges.
    jp_name = Japlish("アドマイヤグルーヴ")
    assert jp_name.encoding == JaplishEncoding.JP
    assert jp_name.jp == "アドマイヤグルーヴ"

    # Auto-detect EN for ASCII/symbol text.
    en_name = Japlish("Admire Groove ☆")
    assert en_name.encoding == JaplishEncoding.EN
    assert en_name.en == "Admire Groove ☆"

    # Explicit encoding override at construction.
    forced_en = Japlish("アドマイヤグルーヴ", encoding="en")
    assert forced_en.encoding == JaplishEncoding.EN
    assert forced_en.en == "アドマイヤグルーヴ"

    # Companion translation assignment keeps base encoding unless value matches payload.
    forced_en.jp = "Admire Groove (JP label)"
    assert forced_en.encoding == JaplishEncoding.EN
    assert forced_en.jp == "Admire Groove (JP label)"

    # Smart assignment flips active encoding when assigned value matches base payload.
    forced_en.jp = str(forced_en)
    assert forced_en.encoding == JaplishEncoding.JP
    assert forced_en.jp == "アドマイヤグルーヴ"

    # Encoding setter resets active slot from base payload.
    forced_en.encoding = JaplishEncoding.EN
    assert forced_en.en == "アドマイヤグルーヴ"
    try:
        _ = forced_en.jp
        raise AssertionError("Expected jp to be unset after encoding EN reapply")
    except ValueError:
        pass

    # Invalid encoding should fail.
    try:
        _ = Japlish("x", encoding="nope")
        raise AssertionError("Expected invalid encoding to raise ValueError")
    except ValueError:
        pass

    print("Japlish smoke tests passed")
