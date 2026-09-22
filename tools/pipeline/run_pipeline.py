#!/usr/bin/env python3
"""流水线总控: 依次执行所有阶段。

用法: python tools/pipeline/run_pipeline.py [--stage STAGE] [--id EXAM_ID]
示例:
  python tools/pipeline/run_pipeline.py                    # 执行全部阶段
  python tools/pipeline/run_pipeline.py --stage scan       # 只执行扫描
  python tools/pipeline/run_pipeline.py --stage publish --id gk2024-xkb1  # 发布指定考试
"""
import argparse, subprocess, sys
from pathlib import Path

PIPELINE_DIR = Path("tools/pipeline")

STAGES = [
    ("scan", "scan_sources.py"),
    ("extract", "extract_content.py"),
    ("parse", "parse_exam.py"),
    ("audit", "audit.py"),
    ("review", "review_queue.py"),
]

def run_stage(script: str):
    """执行单个阶段脚本"""
    script_path = PIPELINE_DIR / script
    if not script_path.exists():
        print(f"[ERROR] 脚本不存在: {script_path}")
        return False
    print(f"\n{'='*60}")
    print(f"执行: {script}")
    print('='*60)
    result = subprocess.run([sys.executable, str(script_path)])
    return result.returncode == 0

def main():
    parser = argparse.ArgumentParser(description="题库导入审计发布流水线")
    parser.add_argument("--stage", choices=[s[0] for s in STAGES], help="只执行指定阶段")
    parser.add_argument("--id", help="考试 ID (用于 publish 阶段)")
    parser.add_argument("--force", action="store_true", help="强制发布")
    args = parser.parse_args()

    if args.stage == "publish":
        if not args.id:
            print("[ERROR] publish 阶段需要 --id 参数")
            sys.exit(1)
        cmd = [sys.executable, str(PIPELINE_DIR / "publish.py"), "--id", args.id]
        if args.force:
            cmd.append("--force")
        result = subprocess.run(cmd)
        sys.exit(result.returncode)

    if args.stage:
        # 只执行指定阶段
        for stage_name, script in STAGES:
            if stage_name == args.stage:
                success = run_stage(script)
                sys.exit(0 if success else 1)
        print(f"[ERROR] 未知阶段: {args.stage}")
        sys.exit(1)
    else:
        # 执行全部阶段
        for stage_name, script in STAGES:
            success = run_stage(script)
            if not success:
                print(f"[WARN] 阶段 {stage_name} 执行失败，继续下一阶段")

    print(f"\n{'='*60}")
    print("流水线执行完成")
    print('='*60)

if __name__ == "__main__":
    main()
