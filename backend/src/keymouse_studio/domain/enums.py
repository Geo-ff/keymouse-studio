from enum import StrEnum


class EngineState(StrEnum):
    IDLE = "idle"
    COUNTDOWN = "countdown"
    RECORDING = "recording"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPING = "stopping"
    ERROR = "error"


class OperationType(StrEnum):
    CLICKER = "clicker"
    TIMED_CLICK = "timed_click"
    RECORDING = "recording"
    PLAYBACK = "playback"


class MouseButton(StrEnum):
    LEFT = "left"
    RIGHT = "right"
    MIDDLE = "middle"


class LoopMode(StrEnum):
    COUNT = "count"
    INFINITE = "infinite"


class PositionMode(StrEnum):
    CURRENT = "current"
    FIXED = "fixed"


class ClickerInputType(StrEnum):
    MOUSE = "mouse"
    KEYBOARD = "keyboard"
