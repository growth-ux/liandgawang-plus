"""粮掌柜：复杂采购多 Agent 协作指挥舱领域模块。"""

import sys as _sys
import time as _time


def zlog(msg: str) -> None:
    """粮掌柜管道日志：直接 print 到 stderr + flush，确保 --reload 下也可见。"""
    ts = _time.strftime("%H:%M:%S")
    print(f"[{ts}] [zhanggui] {msg}", file=_sys.stderr, flush=True)
