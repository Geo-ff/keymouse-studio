from keymouse_studio.config import Settings


def test_settings_generate_unique_session_tokens() -> None:
    assert Settings().session_token != Settings().session_token


def test_settings_reject_non_loopback_host() -> None:
    try:
        Settings(host="0.0.0.0")
    except ValueError as exc:
        assert str(exc) == "host must be a loopback address"
    else:
        raise AssertionError("non-loopback host must be rejected")
