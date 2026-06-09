"""
Update Section 3.7 Summary table (implementation & testing technologies) in FINAL PROJECT docx
to match the implemented SIGTS stack.

Usage:
  python scripts/patch_chapter3_37_tech_table.py
  python scripts/patch_chapter3_37_tech_table.py --path "FINAL PROJECT_backup_revised.docx"
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from docx import Document

DEFAULT_PATH = Path(__file__).resolve().parents[1] / "FINAL PROJECT_backup_revised.docx"

# Row 3 — objective: implement SIGTS
OLD_IMPLEMENTATION_TOOLS = (
    "HTML  CSS  MySQL  react  JavaScript  python",
    "HTML CSS MySQL react JavaScript python",
    "HTML, CSS, MySQL, react, JavaScript, python",
)

NEW_IMPLEMENTATION_TOOLS = (
    "HTML, CSS, JavaScript, Tailwind CSS, Leaflet, Node.js, Express.js, "
    "PostgreSQL/PostGIS, JWT, Git & GitHub (hosted on Vercel with Supabase PostgreSQL)"
)

# Row 4 — objective: test & validate
OLD_TESTING_TOOLS = (
    "1.Pytest",
    "Pytest",
    "1. Pytest",
)

NEW_TESTING_TOOLS = (
    "Jest, Postman, npm run debug:all (API regression), user acceptance testing, security baseline scans"
)


def normalize(s: str) -> str:
    return " ".join(s.split()).lower()


def patch_cell_text(text: str) -> tuple[str, bool]:
    raw = text.strip()
    norm = normalize(raw)
    changed = False

    impl_norms = {normalize(x) for x in OLD_IMPLEMENTATION_TOOLS}
    test_norms = {normalize(x) for x in OLD_TESTING_TOOLS}

    if norm in impl_norms or ("mysql" in norm and "react" in norm and "python" in norm):
        return NEW_IMPLEMENTATION_TOOLS, True

    if norm in test_norms or norm == "pytest" or norm == "1.pytest":
        return NEW_TESTING_TOOLS, True

    # Partial legacy stack mentions inside implementation column
    if "mysql" in norm and "implement" not in norm and len(norm) < 120:
        return NEW_IMPLEMENTATION_TOOLS, True

    return raw, changed


def patch_table_by_header(doc: Document) -> int:
    patched = 0
    for table in doc.tables:
        if not table.rows:
            continue
        header = [c.text.strip().upper() for c in table.rows[0].cells]
        if "SPECIFIC OBJECTIVE" not in " ".join(header):
            continue
        if "TOOLS AND TECHNIQUES" not in " ".join(header):
            continue

        for row in table.rows[1:]:
            cells = row.cells
            if len(cells) < 3:
                continue
            objective = cells[1].text.strip().lower()
            tools_cell = cells[2]
            old_tools = tools_cell.text

            if "implement" in objective:
                new_text, changed = patch_cell_text(old_tools)
            elif "test" in objective and "validate" in objective:
                new_text, changed = patch_cell_text(old_tools)
            else:
                new_text, changed = old_tools, False

            if changed and new_text != old_tools.strip():
                tools_cell.text = new_text
                patched += 1

    return patched


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--path", type=Path, default=DEFAULT_PATH)
    args = parser.parse_args()

    if not args.path.exists():
        print(f"File not found: {args.path}", file=sys.stderr)
        sys.exit(1)

    doc = Document(str(args.path))
    n = patch_table_by_header(doc)
    doc.save(str(args.path))
    print(f"Patched {args.path} — updated {n} cell(s) in Section 3.7 summary table.")


if __name__ == "__main__":
    main()
