"""
定时鼠标单击：等待指定时长后在指定位置点击（用于刷课等场景，非连点器）。
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import pyautogui

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.05

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "config.json"


def load_config(path: Path) -> dict:
    if not path.is_file():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_config(path: Path, data: dict) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def format_duration(seconds: float) -> str:
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    if h:
        return f"{h}小时{m}分{sec}秒"
    if m:
        return f"{m}分{sec}秒"
    return f"{sec}秒"


def countdown_wait(total_seconds: float, tick: int = 30) -> None:
    end = time.monotonic() + total_seconds
    while True:
        remaining = end - time.monotonic()
        if remaining <= 0:
            break
        print(f"\r剩余 {format_duration(remaining)} 后点击… ", end="", flush=True)
        time.sleep(min(tick, max(0.5, remaining)))
    print("\r时间到，执行点击。                    ")


def do_click(x: int | None, y: int | None, button: str) -> None:
    if x is not None and y is not None:
        pyautogui.click(x=x, y=y, button=button)
        print(f"已在 ({x}, {y}) 执行 {button} 单击。")
    else:
        pyautogui.click(button=button)
        pos = pyautogui.position()
        print(f"已在当前位置 ({pos.x}, {pos.y}) 执行 {button} 单击。")


def capture_position() -> tuple[int, int]:
    print("请在 5 秒内把鼠标移到「下一节」按钮上…")
    for i in range(5, 0, -1):
        print(f"  {i}…", flush=True)
        time.sleep(1)
    pos = pyautogui.position()
    print(f"已记录坐标: ({pos.x}, {pos.y})")
    return pos.x, pos.y


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="定时鼠标单击（非连点）")
    p.add_argument(
        "-i",
        "--interval",
        type=float,
        default=None,
        help="两次点击间隔（秒），默认 5400（90 分钟）",
    )
    p.add_argument("-x", type=int, default=None, help="点击 X 坐标")
    p.add_argument("-y", type=int, default=None, help="点击 Y 坐标")
    p.add_argument(
        "-b",
        "--button",
        choices=("left", "right", "middle"),
        default=None,
        help="鼠标按键，默认 left",
    )
    p.add_argument(
        "-n",
        "--times",
        type=int,
        default=None,
        help="共执行几次点击（每次前都等待 interval），默认 1；0 表示无限循环",
    )
    p.add_argument(
        "--capture",
        action="store_true",
        help="启动时倒计时 5 秒并记录当前鼠标位置为点击点",
    )
    p.add_argument(
        "--save-config",
        action="store_true",
        help="将本次参数写入 config.json（需配合 --capture 或 -x/-y）",
    )
    p.add_argument(
        "-c",
        "--config",
        type=Path,
        default=DEFAULT_CONFIG_PATH,
        help="配置文件路径",
    )
    return p


def main() -> int:
    args = build_parser().parse_args()
    cfg = load_config(args.config)

    interval = args.interval if args.interval is not None else cfg.get("interval_seconds", 5400)
    button = args.button or cfg.get("button", "left")
    times = args.times if args.times is not None else cfg.get("times", 1)
    x = args.x if args.x is not None else cfg.get("x")
    y = args.y if args.y is not None else cfg.get("y")

    if args.capture:
        x, y = capture_position()
        if args.save_config:
            save_config(
                args.config,
                {
                    "interval_seconds": interval,
                    "button": button,
                    "times": times,
                    "x": x,
                    "y": y,
                },
            )
            print(f"已保存到 {args.config}")

    if interval <= 0:
        print("interval 必须大于 0", file=sys.stderr)
        return 1

    print("已启用 FAILSAFE：把鼠标快速移到屏幕左上角可紧急停止。")
    if x is not None and y is not None:
        plan = f"计划：每 {format_duration(interval)} 在 ({x}, {y}) 点击，次数={'无限' if times == 0 else times}。"
    else:
        plan = f"计划：每 {format_duration(interval)} 在当前位置点击，次数={'无限' if times == 0 else times}。"
    print(plan)

    count = 0
    try:
        while times == 0 or count < times:
            countdown_wait(interval)
            do_click(x, y, button)
            count += 1
            if times != 0 and count >= times:
                break
            print(f"已完成第 {count} 次，等待下一轮…")
    except pyautogui.FailSafeException:
        print("\n已触发 FAILSAFE，脚本已停止。")
        return 130

    print("全部完成。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())