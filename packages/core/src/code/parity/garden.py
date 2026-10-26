"""Tuck's garden for real Python: the parity test runs every puzzle's code here and in the TypeScript interpreter,
and both must leave the same trace. Reads [{"src", "board"}] as JSON on stdin, writes [{"events", "error"}]."""

import json
import sys

STEP = {0: (0, -1), 1: (1, 0), 2: (0, 1), 3: (-1, 0)}


class Stop(Exception):
    pass


def run(src, board):
    rows = board["rows"]
    s = board["start"]
    g = {"x": s["x"], "y": s["y"], "dir": s["dir"], "pen": False, "picked": set(), "lit": set(), "planted": set()}
    events = []

    def at(x, y):
        if 0 <= y < len(rows) and 0 <= x < len(rows[y]):
            return rows[y][x]
        return " "

    def here():
        return (g["x"], g["y"])

    def paint():
        events.append(["paint", g["x"], g["y"]])

    def count(args, most):
        if len(args) > 1:
            raise Stop()
        n = 1 if not args else args[0]
        if n is True or n is False:
            n = int(n)
        if not isinstance(n, int) or n < 0 or n > most:
            raise Stop()
        return n

    def none(args):
        if args:
            raise Stop()

    def forward(*args):
        for _ in range(count(args, 20)):
            dx, dy = STEP[g["dir"]]
            x, y = g["x"] + dx, g["y"] + dy
            if at(x, y) in "#~ ":
                raise Stop()
            g["x"], g["y"] = x, y
            events.append(["move", x, y])
            if g["pen"]:
                paint()

    def turn(by, args):
        for _ in range(count(args, 4)):
            g["dir"] = (g["dir"] + by) % 4
            events.append(["turn", g["dir"]])

    def left(*args):
        turn(3, args)

    def right(*args):
        turn(1, args)

    def act(ch, done, name, args):
        none(args)
        if at(*here()) != ch or here() in g[done]:
            raise Stop()
        g[done].add(here())
        events.append([name, g["x"], g["y"]])

    def pick(*args):
        act("s", "picked", "pick", args)

    def light(*args):
        act("L", "lit", "light", args)

    def plant(*args):
        act("b", "planted", "plant", args)

    def pen_down(*args):
        none(args)
        g["pen"] = True
        events.append(["pen", True])
        paint()

    def pen_up(*args):
        none(args)
        g["pen"] = False
        events.append(["pen", False])

    def seed_here(*args):
        none(args)
        return at(*here()) == "s" and here() not in g["picked"]

    def lantern_here(*args):
        none(args)
        return at(*here()) == "L" and here() not in g["lit"]

    def bed_here(*args):
        none(args)
        return at(*here()) == "b" and here() not in g["planted"]

    def at_flag(*args):
        none(args)
        return at(*here()) == "F"

    def path_ahead(*args):
        none(args)
        dx, dy = STEP[g["dir"]]
        return at(g["x"] + dx, g["y"] + dy) not in "#~ "

    def say(*args):
        events.append(["say", " ".join(str(a) for a in args)])

    env = {name: fn for name, fn in locals().items() if callable(fn) and name not in ("run", "at", "here", "paint", "count", "none", "turn", "act")}
    env["print"] = say
    env["__builtins__"] = {"range": range, "str": str, "abs": abs, "True": True, "False": False, "None": None}
    lines = [0]

    def tracer(frame, event, arg):
        # A safety net only: runs the TypeScript side calls dizzy are left out of the comparison.
        if event == "line" and frame.f_code.co_filename == "<kid>":
            lines[0] += 1
            if lines[0] > 20000:
                raise Stop()
        return tracer

    try:
        sys.settrace(tracer)
        exec(compile(src, "<kid>", "exec"), env)
        return {"events": events, "error": False}
    except Exception:
        return {"events": events, "error": True}
    finally:
        sys.settrace(None)


if __name__ == "__main__":
    sys.setrecursionlimit(200)
    out = [run(case["src"], case["board"]) for case in json.load(sys.stdin)]
    json.dump(out, sys.stdout)
