from keymouse_studio.domain.enums import EngineState
from keymouse_studio.domain.errors import AppError, ErrorCode

_ALLOWED_TRANSITIONS: dict[EngineState, frozenset[EngineState]] = {
    EngineState.IDLE: frozenset(
        {EngineState.COUNTDOWN, EngineState.RECORDING, EngineState.RUNNING, EngineState.STOPPING}
    ),
    EngineState.COUNTDOWN: frozenset(
        {EngineState.RUNNING, EngineState.PAUSED, EngineState.STOPPING, EngineState.ERROR}
    ),
    EngineState.RECORDING: frozenset({EngineState.PAUSED, EngineState.STOPPING, EngineState.ERROR}),
    EngineState.RUNNING: frozenset({EngineState.PAUSED, EngineState.STOPPING, EngineState.ERROR}),
    EngineState.PAUSED: frozenset(
        {EngineState.COUNTDOWN, EngineState.RECORDING, EngineState.RUNNING, EngineState.STOPPING}
    ),
    EngineState.STOPPING: frozenset({EngineState.IDLE, EngineState.ERROR}),
    EngineState.ERROR: frozenset({EngineState.STOPPING}),
}


class OperationStateMachine:
    def __init__(self) -> None:
        self._state = EngineState.IDLE
        self._paused_from: EngineState | None = None

    @property
    def state(self) -> EngineState:
        return self._state

    def transition(self, target: EngineState) -> EngineState:
        if target not in _ALLOWED_TRANSITIONS[self._state]:
            raise AppError(
                ErrorCode.INVALID_STATE_TRANSITION,
                f"Cannot transition from {self._state} to {target}",
                status_code=409,
                details={"currentState": self._state, "targetState": target},
            )
        if target == EngineState.PAUSED:
            self._paused_from = self._state
        elif self._state != EngineState.PAUSED:
            self._paused_from = None
        self._state = target
        return self._state

    def resume(self) -> EngineState:
        if self._state != EngineState.PAUSED or self._paused_from is None:
            raise AppError(
                ErrorCode.INVALID_STATE_TRANSITION,
                "Operation is not paused",
                status_code=409,
            )
        target = self._paused_from
        self.transition(target)
        self._paused_from = None
        return self._state
