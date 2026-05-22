"""Render Figure 5.1 PNG from SVG for Word embedding (requires no extra deps if SVG exists)."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SVG = ROOT / "docs" / "figures" / "figure-5-1-sigts-ai-architecture.svg"
PNG = ROOT / "docs" / "figures" / "figure-5-1-sigts-ai-architecture.png"


def render_with_cairosvg() -> bool:
    try:
        import cairosvg

        cairosvg.svg2png(url=str(SVG), write_to=str(PNG), output_width=1840, output_height=1360)
        return True
    except Exception:
        return False


def render_with_inkscape() -> bool:
    for exe in ("inkscape", r"C:\Program Files\Inkscape\bin\inkscape.exe"):
        try:
            subprocess.run(
                [exe, str(SVG), "--export-type=png", f"--export-filename={PNG}", "-w", "1840"],
                check=True,
                capture_output=True,
            )
            return PNG.is_file()
        except Exception:
            continue
    return False


def render_with_matplotlib() -> bool:
    """Fallback: redraw simplified architecture if SVG converters unavailable."""
    import matplotlib.pyplot as plt
    from matplotlib.patches import FancyBboxPatch, Polygon

    fig, ax = plt.subplots(figsize=(11.5, 8.5), dpi=160)
    ax.set_xlim(0, 11.5)
    ax.set_ylim(0, 8.5)
    ax.axis("off")
    fig.patch.set_facecolor("#f8fafc")

    def box(x, y, w, h, title, lines, fc="#fff", ec="#334155"):
        p = FancyBboxPatch(
            (x, y), w, h, boxstyle="round,pad=0.02,rounding_size=0.08",
            linewidth=1.2, edgecolor=ec, facecolor=fc,
        )
        ax.add_patch(p)
        ax.text(x + w / 2, y + h - 0.22, title, ha="center", va="top", fontsize=9, fontweight="bold")
        for i, line in enumerate(lines):
            ax.text(x + w / 2, y + h - 0.55 - i * 0.28, line, ha="center", va="top", fontsize=7)

    ax.text(5.75, 8.15, "Figure 5.1 — SIGTS Tour Help AI Architecture", ha="center", fontsize=13, fontweight="bold")
    ax.text(5.75, 7.85, "Lexical RAG-lite + optional GPT-4o; rule-based fallback (rule_kb_v1)", ha="center", fontsize=8, color="#64748b")

    box(0.4, 6.6, 10.7, 1.0, "PWA — Tour Help", ["question, history, GPS, app_context catalogue snapshot"], fc="#ecfdf5", ec="#059669")
    box(0.4, 5.2, 10.7, 0.85, "Backend — JWT", ["POST /api/ai/chat", "GET /api/ai/status"], fc="#eff6ff", ec="#2563eb")
    ax.text(5.75, 4.85, "API key & in-scope?", ha="center", fontsize=8, fontweight="bold", bbox=dict(boxstyle="round", fc="#fef9c3", ec="#ca8a04"))

    box(0.4, 2.9, 5.2, 1.55, "Path A — llm_grounded_v1", [
        "chatGrounding: tokenise → ILIKE → Postgres",
        "llmChat: system prompt + GPT-4o Chat Completions",
    ], fc="#faf5ff", ec="#7c3aed")
    box(5.9, 2.9, 5.2, 1.55, "Path B — rule_kb_v1", [
        "regex intents, scope checks, catalogue match",
        "templates; offline mirror in browser",
    ], fc="#f1f5f9", ec="#64748b")

    box(0.6, 0.35, 4.8, 1.1, "PostgreSQL", ["FAQs, safety, animals, themes, sightings, ai_query_logs"], fc="#ffedd5", ec="#ea580c")
    box(6.0, 0.35, 4.8, 1.1, "External LLM", ["OpenAI-compatible API, GPT-4o, no vector DB"], fc="#ede9fe", ec="#7c3aed")

    for x1, y1, x2, y2 in [
        (5.75, 6.6, 5.75, 6.05), (5.75, 5.2, 5.75, 4.95),
        (4.5, 4.75, 2.8, 4.45), (7.0, 4.75, 8.5, 4.45),
        (2.8, 2.9, 2.5, 1.45), (8.5, 2.9, 8.4, 1.45),
    ]:
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1), arrowprops=dict(arrowstyle="->", color="#334155", lw=1.1))

    ax.text(5.75, 0.12, "Response → Tour Help UI (nlp_mode: llm_grounded_v1 | rule_kb_v1)", ha="center", fontsize=8, color="#166534")

    fig.savefig(PNG, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    return True


def main():
    PNG.parent.mkdir(parents=True, exist_ok=True)
    if not SVG.is_file():
        print(f"Missing {SVG}", file=sys.stderr)
        sys.exit(1)

    for fn in (render_with_cairosvg, render_with_inkscape, render_with_matplotlib):
        try:
            if fn():
                print(f"Wrote {PNG}")
                return
        except Exception as e:
            print(f"{fn.__name__}: {e}", file=sys.stderr)

    print("Could not render PNG", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()
