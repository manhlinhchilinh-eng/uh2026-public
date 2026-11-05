"""
Independent CLI Test Runner for UMS Smart Growth Hub E2E Test Suite
Executes Tiers 1 through 4 test suites, collects timing and results,
and outputs a comprehensive tier-by-tier execution report.
Dual-compatible with unittest and pytest.
Exit code 0 on all tests passing, non-zero on failure.
"""

import sys
import os
import time
import argparse
import unittest
from pathlib import Path
from typing import Dict, Any, List

# Ensure project root is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


TIER_MODULE_MAP = {
    1: ("Tier 1: Category-Partition Feature Coverage (F01-F20)", "tests.test_tier1_features"),
    2: ("Tier 2: Boundary Value Analysis & Corner Cases (F01-F20)", "tests.test_tier2_boundaries"),
    3: ("Tier 3: Combinatorial Pairwise Cross-Feature Interactions", "tests.test_tier3_pairwise"),
    4: ("Tier 4: Real-World Application Workloads (S01-S10)", "tests.test_tier4_workloads"),
}


class TierResultSummary:
    """Holds execution statistics for a single tier or combined suite."""
    def __init__(self, tier_id: int, name: str):
        self.tier_id = tier_id
        self.name = name
        self.tests_run = 0
        self.passed = 0
        self.failed = 0
        self.errors = 0
        self.skipped = 0
        self.duration_seconds = 0.0

    @property
    def pass_rate(self) -> float:
        if self.tests_run == 0:
            return 100.0
        return round((self.passed / self.tests_run) * 100, 1)

    @property
    def is_success(self) -> bool:
        return self.failed == 0 and self.errors == 0


def run_tier_suite(tier_id: int, module_name: str, verbose: bool = False) -> TierResultSummary:
    """Executes a single tier module and aggregates results."""
    title, _ = TIER_MODULE_MAP.get(tier_id, (f"Tier {tier_id} Custom", module_name))
    summary = TierResultSummary(tier_id, title)

    loader = unittest.TestLoader()
    try:
        suite = loader.loadTestsFromName(module_name)
    except Exception as e:
        print(f"[ERROR] Failed to load module {module_name}: {e}", file=sys.stderr)
        summary.errors = 1
        summary.tests_run = 1
        return summary

    verbosity_level = 2 if verbose else 0
    runner = unittest.TextTestRunner(verbosity=verbosity_level, stream=sys.stdout)

    start_time = time.time()
    result = runner.run(suite)
    duration = time.time() - start_time

    summary.tests_run = result.testsRun
    summary.failed = len(result.failures)
    summary.errors = len(result.errors)
    summary.skipped = len(result.skipped)
    summary.passed = summary.tests_run - (summary.failed + summary.errors + summary.skipped)
    summary.duration_seconds = round(duration, 3)

    return summary


def print_banner():
    """Prints the UMS Smart Growth Hub Test Suite banner."""
    print("=" * 82)
    print("  UMS SMART GROWTH HUB — AUTOMATED E2E & UNIT TEST SUITE RUNNER")
    print("  Authoritative Specifications: GDPT 2018 | CEFR | CNN High School Pathway")
    print("=" * 82)


def print_summary_table(results: List[TierResultSummary]):
    """Renders a structured summary table of tier results."""
    print("\n" + "-" * 82)
    print(f"{'Tier / Test Suite':<50} {'Run':<6} {'Pass':<6} {'Fail':<6} {'Rate':<7} {'Time':<6}")
    print("-" * 82)

    total_run = 0
    total_pass = 0
    total_fail = 0
    total_err = 0
    total_skip = 0
    total_time = 0.0

    for r in results:
        total_run += r.tests_run
        total_pass += r.passed
        total_fail += r.failed
        total_err += r.errors
        total_skip += r.skipped
        total_time += r.duration_seconds

        status_flag = "PASS" if r.is_success else "FAIL"
        time_str = f"{r.duration_seconds:.2f}s"
        rate_str = f"{r.pass_rate:.1f}%"
        tier_label = f"Tier {r.tier_id}: {r.name[:40]}"
        print(f"{tier_label:<50} {r.tests_run:<6} {r.passed:<6} {r.failed + r.errors:<6} {rate_str:<7} {time_str:<6}")

    print("-" * 82)
    overall_rate = round((total_pass / total_run) * 100, 1) if total_run > 0 else 100.0
    print(f"{'TOTAL COMBINED SUITE':<50} {total_run:<6} {total_pass:<6} {total_fail + total_err:<6} {overall_rate:.1f}%  {total_time:.2f}s")
    print("=" * 82)

    if total_fail == 0 and total_err == 0:
        print(f"  [SUCCESS] All {total_run} automated test assertions PASSED (Exit Code: 0)")
    else:
        print(f"  [FAILURE] {total_fail + total_err} test(s) FAILED out of {total_run} (Exit Code: 1)")
    print("=" * 82 + "\n")


def main():
    parser = argparse.ArgumentParser(description="UMS Smart Growth Hub Test Runner CLI")
    parser.add_argument("--tier", type=int, choices=[1, 2, 3, 4], help="Run a specific test tier (1, 2, 3, or 4)")
    parser.add_argument("--all", action="store_true", default=True, help="Run all test tiers (default)")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose test output")
    args = parser.parse_args()

    print_banner()

    tiers_to_run = [args.tier] if args.tier else [1, 2, 3, 4]
    results: List[TierResultSummary] = []

    for t_id in tiers_to_run:
        title, module_name = TIER_MODULE_MAP[t_id]
        print(f"\n>> Executing Tier {t_id}: {title}...")
        res = run_tier_suite(t_id, module_name, verbose=args.verbose)
        results.append(res)

    print_summary_table(results)

    # Return exit code 0 if all tests passed, 1 if any failure
    all_passed = all(r.is_success for r in results)
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
