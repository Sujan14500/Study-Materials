"""Execute every notebook top to bottom in a fresh kernel and report what broke.

    python run_all_notebooks.py                   # all notebooks, offline LLM stand-in (free)
    python run_all_notebooks.py 09_rag 11_fine    # only paths containing any of these strings
    python run_all_notebooks.py --jobs 4          # run 4 notebooks in parallel
    python run_all_notebooks.py --provider openai # really call OpenAI (costs a little)

This is the notebooks' equivalent of the courses' `node test.js`: the notebooks
are full of `assert`s that re-check what the prose claims, so a notebook that
runs clean is a notebook that still teaches what it says. Outputs are not
written back — the notebooks stay clean for the reader to run.

By default the kernels run with LLM_PROVIDER=offline and OPENAI_API_KEY removed,
so a test run never spends money even if your .env has a key.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

HERE = Path(__file__).resolve().parent


def find_notebooks(filters: list[str]) -> list[Path]:
    nbs = sorted(p for p in HERE.rglob("*.ipynb")
                 if ".venv" not in p.parts and ".ipynb_checkpoints" not in p.parts)
    if filters:
        nbs = [p for p in nbs if any(f.replace("\\", "/") in p.relative_to(HERE).as_posix() for f in filters)]
    return nbs


def run_one(path_str: str, provider: str, timeout: int) -> tuple[str, bool, float, str]:
    import nbformat
    from nbclient import NotebookClient
    from nbclient.exceptions import CellExecutionError

    os.environ["LLM_PROVIDER"] = provider
    if provider == "offline":
        os.environ.pop("OPENAI_API_KEY", None)
    os.environ.pop("MPLBACKEND", None)
    os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
    os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
    os.environ.setdefault("PYTHONWARNINGS", "ignore")

    path = Path(path_str)
    nb = nbformat.read(str(path), as_version=4)
    client = NotebookClient(nb, timeout=timeout, kernel_name="python3",
                            resources={"metadata": {"path": str(path.parent)}})
    t0 = time.time()
    try:
        client.execute()
    except CellExecutionError:
        for i, cell in enumerate(nb.cells):
            for out in cell.get("outputs", []):
                if out.get("output_type") == "error":
                    first = cell.source.strip().splitlines()[0][:80] if cell.source.strip() else ""
                    return path_str, False, time.time() - t0, (
                        f"cell {i} ({first!r}): {out.get('ename')}: {out.get('evalue', '')[:300]}")
        return path_str, False, time.time() - t0, "cell error"
    except Exception as e:  # kernel died, timeout, ...
        return path_str, False, time.time() - t0, f"{type(e).__name__}: {str(e)[:300]}"
    return path_str, True, time.time() - t0, ""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("filters", nargs="*", help="only run notebooks whose path contains one of these")
    ap.add_argument("--provider", default="offline", choices=["offline", "openai", "ollama"])
    ap.add_argument("--jobs", type=int, default=1, help="notebooks to run in parallel")
    ap.add_argument("--timeout", type=int, default=600, help="seconds per cell")
    args = ap.parse_args()

    nbs = find_notebooks(args.filters)
    if not nbs:
        print("no notebooks matched")
        return 1
    if args.jobs > 1:
        # keep parallel kernels from fighting over every core
        for var in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "OPENBLAS_NUM_THREADS"):
            os.environ.setdefault(var, str(max(1, (os.cpu_count() or 4) // args.jobs)))

    print(f"running {len(nbs)} notebook(s), provider={args.provider}, jobs={args.jobs}\n")
    t_all = time.time()
    results = []
    with ProcessPoolExecutor(max_workers=max(1, args.jobs)) as pool:
        futures = [pool.submit(run_one, str(p), args.provider, args.timeout) for p in nbs]
        for fut in as_completed(futures):
            path, ok, dt, err = fut.result()
            rel = Path(path).relative_to(HERE).as_posix()
            print(f"{'PASS' if ok else 'FAIL'}  {dt:6.1f}s  {rel}" + ("" if ok else f"\n        {err}"))
            results.append((rel, ok, dt, err))

    failed = [r for r in results if not r[1]]
    slow = sorted(results, key=lambda r: -r[2])[:5]
    print(f"\n{len(results) - len(failed)}/{len(results)} passed in {time.time() - t_all:.0f}s")
    print("slowest: " + ", ".join(f"{Path(r[0]).stem} {r[2]:.0f}s" for r in slow))
    if failed:
        print("\nFAILED:")
        for rel, _, _, err in sorted(failed):
            print(f"  {rel}\n      {err}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
