from keymouse_studio.api.schemas.actions import KeyPayload
from keymouse_studio.api.schemas.recording import RecordingConfig
from keymouse_studio.domain.enums import MouseButton
from keymouse_studio.infrastructure.input.listener import RawInputEvent
from keymouse_studio.services.action_normalizer import ActionNormalizer, TimedMove, compress_moves


def test_move_compression_applies_time_sampling_and_rdp() -> None:
    points = [
        TimedMove(0, 0, 0),
        TimedMove(2_000_000, 1, 1),
        TimedMove(12_000_000, 5, 5),
        TimedMove(24_000_000, 10, 10),
    ]

    compressed = compress_moves(points, min_sample_ms=10, error_px=1)

    assert compressed == [points[0], points[-1]]


def test_normalizer_filters_reserved_combinations_and_f12() -> None:
    normalizer = ActionNormalizer(RecordingConfig(record_mouse_move=False))
    events = [
        RawInputEvent("key_down", 0, key_code="alt"),
        RawInputEvent("key_down", 1_000_000, key_code="tab"),
        RawInputEvent("key_up", 2_000_000, key_code="tab"),
        RawInputEvent("key_up", 3_000_000, key_code="alt"),
        RawInputEvent("key_down", 4_000_000, key_code="f12"),
        RawInputEvent("key_up", 5_000_000, key_code="f12"),
    ]

    for event in events:
        normalizer.process(event)

    assert normalizer.actions == []


def test_normalizer_filters_configured_control_hotkeys_as_complete_chords() -> None:
    normalizer = ActionNormalizer(
        RecordingConfig(
            record_mouse_move=False,
            control_hotkeys=["f9", "f10", "ctrl+shift+f5", "f12"],
        )
    )
    events = [
        RawInputEvent("key_down", 0, key_code="f9"),
        RawInputEvent("key_up", 1, key_code="f9"),
        RawInputEvent("key_down", 2, key_code="f10"),
        RawInputEvent("key_up", 3, key_code="f10"),
        RawInputEvent("key_down", 4, key_code="ctrl"),
        RawInputEvent("key_down", 5, key_code="shift"),
        RawInputEvent("key_down", 6, key_code="f5"),
        RawInputEvent("key_up", 7, key_code="f5"),
        RawInputEvent("key_up", 8, key_code="shift"),
        RawInputEvent("key_up", 9, key_code="ctrl"),
        RawInputEvent("key_down", 10, key_code="a"),
        RawInputEvent("key_up", 11, key_code="a"),
    ]

    for event in events:
        normalizer.process(event)

    assert [
        (action.type, action.payload.key_code)
        for action in normalizer.actions
        if isinstance(action.payload, KeyPayload)
    ] == [("key_down", "a"), ("key_up", "a")]


def test_normalizer_only_filters_exact_control_hotkey_chord() -> None:
    normalizer = ActionNormalizer(
        RecordingConfig(record_mouse_move=False, control_hotkeys=["ctrl+f9"])
    )

    normalizer.process(RawInputEvent("key_down", 0, key_code="f9"))
    normalizer.process(RawInputEvent("key_up", 1, key_code="f9"))

    assert [
        (action.type, action.payload.key_code)
        for action in normalizer.actions
        if isinstance(action.payload, KeyPayload)
    ] == [("key_down", "f9"), ("key_up", "f9")]


def test_normalizer_filters_control_hotkey_across_resume_boundary() -> None:
    normalizer = ActionNormalizer(
        RecordingConfig(record_mouse_move=False, control_hotkeys=["ctrl+f9"])
    )
    normalizer.observe_paused(RawInputEvent("key_down", 0, key_code="ctrl"))
    normalizer.observe_paused(RawInputEvent("key_down", 1, key_code="f9"))

    actions = normalizer.resume(2)

    assert actions == []
    assert normalizer.actions == []


def test_normalizer_records_keyboard_mouse_and_wheel() -> None:
    normalizer = ActionNormalizer(RecordingConfig(record_mouse_move=False))
    events = [
        RawInputEvent("key_down", 0, key_code="a", scan_code=30),
        RawInputEvent("key_up", 10_000_000, key_code="a", scan_code=30),
        RawInputEvent("mouse_button_down", 20_000_000, button=MouseButton.LEFT),
        RawInputEvent("mouse_button_up", 30_000_000, button=MouseButton.LEFT),
        RawInputEvent("mouse_wheel", 40_000_000, delta_x=1, delta_y=-2),
    ]

    for event in events:
        normalizer.process(event)

    assert [action.type for action in normalizer.actions] == [
        "key_down",
        "key_up",
        "mouse_button_down",
        "mouse_button_up",
        "mouse_wheel",
    ]
    assert [action.delay_before_ms for action in normalizer.actions] == [0, 10, 10, 10, 10]


def test_normalizer_keeps_balanced_keys_across_pause() -> None:
    normalizer = ActionNormalizer(RecordingConfig(record_mouse_move=False))
    normalizer.process(RawInputEvent("key_down", 0, key_code="ctrl"))
    normalizer.process(RawInputEvent("key_down", 1, key_code="c"))
    normalizer.pause(2)
    normalizer.observe_paused(RawInputEvent("key_up", 3, key_code="c"))
    normalizer.resume(4)
    normalizer.process(RawInputEvent("key_up", 5, key_code="ctrl"))

    keys = [
        (action.type, action.payload.key_code)
        for action in normalizer.actions
        if isinstance(action.payload, KeyPayload)
    ]
    assert keys == [
        ("key_down", "ctrl"),
        ("key_down", "c"),
        ("key_up", "c"),
        ("key_up", "ctrl"),
        ("key_down", "ctrl"),
        ("key_up", "ctrl"),
    ]


def test_suppressed_combo_state_resets_across_pause() -> None:
    normalizer = ActionNormalizer(RecordingConfig(record_mouse_move=False))
    normalizer.process(RawInputEvent("key_down", 0, key_code="alt"))
    normalizer.process(RawInputEvent("key_down", 1, key_code="tab"))
    normalizer.process(RawInputEvent("key_up", 2, key_code="tab"))
    normalizer.pause(3)
    normalizer.observe_paused(RawInputEvent("key_up", 4, key_code="alt"))
    normalizer.resume(5)
    normalizer.process(RawInputEvent("key_down", 6, key_code="alt"))
    normalizer.process(RawInputEvent("key_down", 7, key_code="a"))
    normalizer.process(RawInputEvent("key_up", 8, key_code="a"))
    normalizer.process(RawInputEvent("key_up", 9, key_code="alt"))

    assert [
        (action.type, action.payload.key_code)
        for action in normalizer.actions
        if isinstance(action.payload, KeyPayload)
    ] == [
        ("key_down", "alt"),
        ("key_down", "a"),
        ("key_up", "a"),
        ("key_up", "alt"),
    ]


def test_iterative_rdp_handles_large_input_without_recursion() -> None:
    points = [TimedMove(index, index, index % 2) for index in range(5000)]

    compressed = compress_moves(points, min_sample_ms=0, error_px=0)

    assert compressed[0] == points[0]
    assert compressed[-1] == points[-1]
