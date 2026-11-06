#!/usr/bin/env python3
"""Builds projects/content/assets from projects/content/assets-src, or checks that it is up to date.

  python3 scripts/build-assets.py build    # make assets/ from the masters (npm run assets:build)
  python3 scripts/build-assets.py check    # fail if assets/ is out of date (npm run assets:check)

Design: docs/superpowers/specs/2026-11-06-assets-src-pipeline-design.md
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from assetlib.build import build  # noqa: E402
from assetlib.check import check  # noqa: E402
from assetlib.layout import Layout, default_layout  # noqa: E402
from assetlib.ops import BuildError  # noqa: E402
from assetlib.plan import PlanError  # noqa: E402


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('command', choices=['build', 'check'])
    parser.add_argument('--content', help='the content folder (default: projects/content)')
    args = parser.parse_args(argv)
    layout = Layout(Path(args.content).resolve()) if args.content else default_layout()
    if args.command == 'build':
        try:
            report = build(layout)
        except (PlanError, BuildError) as error:
            print('assets: {}'.format(error))
            return 1
        print('assets: built {}, unchanged {}, removed {}'.format(report.built, report.skipped, report.removed))
        return 0
    problems = check(layout)
    for problem in problems:
        print('assets: {}'.format(problem))
    if problems:
        print('assets: out of date. Run: npm run assets:build')
        return 1
    print('assets: up to date')
    return 0


if __name__ == '__main__':
    sys.exit(main())
