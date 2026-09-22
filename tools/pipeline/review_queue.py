#!/usr/bin/env python3
"""Stage 5: 生成人工审核队列。

用法: python tools/pipeline/review_queue.py
产出: tools/pipeline/review_queue.md
"""
import json, sys
from pathlib import Path

AUDIT_DIR = Path("tools/pipeline/audit")
REVIEW_QUEUE_PATH = Path("tools/pipeline/review_queue.md")

def main():
    if not AUDIT_DIR.exists():
        print("[ERROR] 请先运行 audit.py")
        sys.exit(1)

    audit_files = list(AUDIT_DIR.glob("*.audit.json"))
    if not audit_files:
        print("[INFO] 没有审计文件")
        sys.exit(0)

    lines = [
        "# 人工审核队列",
        "",
        f"生成时间: {__import__('datetime').datetime.now().isoformat()}",
        f"待审核文件: {len(audit_files)}",
        "",
        "---",
        ""
    ]

    total_issues = 0
    for audit_path in sorted(audit_files):
        data = json.load(open(audit_path, encoding="utf-8"))
        issues = data.get("issues", [])
        total_issues += len(issues)

        status = "⚠️ 需审核" if issues else "✅ 通过"
        lines.append(f"## {data['source_file']}  {status}")
        lines.append(f"- 章节数: {data['total_sections']}")
        lines.append(f"- 题目数: {data['total_questions']}")
        lines.append(f"- 问题数: {len(issues)}")
        lines.append("")

        if issues:
            lines.append("| 类型 | 章节 | 题号 | 描述 |")
            lines.append("|------|------|------|------|")
            for issue in issues[:20]:  # 最多显示20个
                lines.append(f"| {issue.get('type','')} | {issue.get('section','')} | {issue.get('question_id','')} | {issue.get('msg','')} |")
            if len(issues) > 20:
                lines.append(f"| ... | | | 还有 {len(issues)-20} 个问题 |")
            lines.append("")

        lines.append("---")
        lines.append("")

    # 汇总
    lines.insert(4, f"总问题数: {total_issues}")
    lines.insert(5, f"需审核文件: {sum(1 for f in audit_files if json.load(open(f,encoding='utf-8')).get('issues'))}")
    lines.insert(6, "")

    REVIEW_QUEUE_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"=== 审核队列已生成 ===")
    print(f"总文件: {len(audit_files)}")
    print(f"总问题: {total_issues}")
    print(f"产出: {REVIEW_QUEUE_PATH}")

if __name__ == "__main__":
    main()
