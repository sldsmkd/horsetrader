from .new_year import load


def test_new_year_uses_phase_specific_archive_banners():
    records = {record["key"]: record for record in load()}

    expected = {
        "holiday-new-year-2023": (1122, "header_26400003.png"),
        "holiday-new-year-2023-countdown": (1122, "header_26400001.png"),
        "holiday-new-year-2024": (1690, "header_29300003.png"),
        "holiday-new-year-2024-countdown": (1690, "header_29300001.png"),
        "holiday-new-year-2025": (2314, "header_212000003.png"),
        "holiday-new-year-2025-countdown": (2314, "header_212000001.png"),
        "holiday-new-year-2026": (2984, "header_215200003.png"),
        "holiday-new-year-2026-countdown": (2984, "header_215200002.png"),
    }
    for key, (announcement, filename) in expected.items():
        assert records[key]["banner_url"] == (
            "https://prd-info-umamusume.akamaized.net/"
            f"announce/{announcement}/Header/{filename}"
        )

    # Umapyoi's archive does not carry the 2021-22 campaign notice.
    assert records["holiday-new-year-2022"]["banner_url"] is None
    assert records["holiday-new-year-2022-countdown"]["banner_url"] is None
