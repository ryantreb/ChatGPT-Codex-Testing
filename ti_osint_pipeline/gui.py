"""Tkinter GUI wrapper for the pipeline."""

from __future__ import annotations

import threading
import tkinter as tk
from tkinter import messagebox

from .core import run_pipeline


def _run(term: str, text: tk.Text) -> None:
    try:
        result = run_pipeline(term)
    except SystemExit as exc:  # pipeline failure
        text.delete("1.0", tk.END)
        text.insert(tk.END, f"Error: {exc}")
        return
    summary = result.get("summary", "")
    lines = [summary, "", "IoCs:"]
    lines.extend(f"- {ioc}" for ioc in result.get("iocs", []))
    lines.append("\nMITRE:")
    lines.extend(f"- {m}" for m in result.get("mitre", []))
    text.delete("1.0", tk.END)
    text.insert(tk.END, "\n".join(lines))


def main() -> None:
    root = tk.Tk()
    root.title("TI OSINT Pipeline")

    tk.Label(root, text="Search Term").pack()
    entry = tk.Entry(root)
    entry.pack(fill=tk.X)

    text = tk.Text(root, height=20, width=60)
    text.pack()

    def on_run() -> None:
        term = entry.get()
        threading.Thread(target=_run, args=(term, text), daemon=True).start()

    tk.Button(root, text="Run", command=on_run).pack()
    root.mainloop()


if __name__ == "__main__":  # pragma: no cover - GUI
    main()
