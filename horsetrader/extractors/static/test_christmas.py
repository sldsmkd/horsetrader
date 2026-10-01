from .christmas import load


def test_christmas_2022_has_no_duplicate_standalone_record():
    assert load() == []
