#!/usr/bin/env python3
"""掌握度与置信度模型。

基于学生历史答题记录，计算每个知识节点的掌握度和置信度。

掌握度 (Mastery): 0-100
  - 最近答对率 (40%)
  - 连续答对次数 (30%)
  - 时间衰减 (20%)
  - 题目难度覆盖 (10%)

置信度 (Confidence): 0-100
  - 答题次数 (40%): 次数越多越可信
  - 一致性 (30%): 答对/答错是否稳定
  - 最近表现 (30%): 最近几次的表现

用法: python tools/pipeline/mastery_model.py
产出: data/mastery.json
"""
import json, math
from datetime import datetime, timedelta
from pathlib import Path

DATA_DIR = Path("data")
MASTERY_PATH = DATA_DIR / "mastery.json"

def load_records():
    """加载学生答题记录"""
    # 从 LocalStorage 导出或模拟
    records_path = DATA_DIR / "student_records.json"
    if records_path.exists():
        return json.load(open(records_path, encoding="utf-8"))
    return []

def compute_mastery(records: list, node_id: str) -> dict:
    """计算单个知识节点的掌握度和置信度"""
    # 筛选该节点的记录
    node_records = [r for r in records if r.get("knowledgeNode") == node_id]
    
    if not node_records:
        return {"mastery": 0, "confidence": 0, "attempts": 0}
    
    # 按时间排序
    node_records.sort(key=lambda x: x.get("timestamp", 0))
    
    total = len(node_records)
    correct = sum(1 for r in node_records if r.get("correct", False))
    
    # 1. 最近答对率 (最近 5 次)
    recent = node_records[-5:]
    recent_correct = sum(1 for r in recent if r.get("correct", False))
    recent_accuracy = recent_correct / len(recent) if recent else 0
    
    # 2. 连续答对次数
    streak = 0
    for r in reversed(node_records):
        if r.get("correct", False):
            streak += 1
        else:
            break
    streak_score = min(streak / 5, 1.0)  # 5次连续答对 = 满分
    
    # 3. 时间衰减 (最近30天内的记录权重更高)
    now = datetime.now()
    decay_weights = []
    for r in node_records:
        ts = r.get("timestamp", 0)
        if ts:
            dt = datetime.fromtimestamp(ts / 1000)  # 毫秒转秒
            days_ago = (now - dt).days
            weight = math.exp(-days_ago / 30)  # 30天半衰期
        else:
            weight = 0.5
        decay_weights.append(weight)
    
    weighted_correct = sum(
        w for r, w in zip(node_records, decay_weights) if r.get("correct", False)
    )
    weighted_total = sum(decay_weights)
    time_decay_score = weighted_correct / weighted_total if weighted_total else 0
    
    # 4. 题目难度覆盖 (答对难题加分)
    difficulties = [r.get("difficulty", 3) for r in node_records]
    avg_difficulty = sum(difficulties) / len(difficulties) if difficulties else 3
    difficulty_score = min(avg_difficulty / 5, 1.0)
    
    # 掌握度 = 加权平均
    mastery = (
        recent_accuracy * 0.4 +
        streak_score * 0.3 +
        time_decay_score * 0.2 +
        difficulty_score * 0.1
    ) * 100
    
    # 置信度
    # 1. 答题次数 (最多20次满分)
    attempts_score = min(total / 20, 1.0)
    
    # 2. 一致性 (答对率的方差)
    if total >= 3:
        # 分前后两半计算方差
        half = total // 2
        first_half = node_records[:half]
        second_half = node_records[half:]
        acc1 = sum(1 for r in first_half if r.get("correct", False)) / len(first_half)
        acc2 = sum(1 for r in second_half if r.get("correct", False)) / len(second_half)
        consistency = 1 - abs(acc1 - acc2)  # 越一致越接近1
    else:
        consistency = 0.3  # 次数少，一致性低
    
    # 3. 最近表现
    recent_perf = recent_accuracy
    
    confidence = (
        attempts_score * 0.4 +
        consistency * 0.3 +
        recent_perf * 0.3
    ) * 100
    
    return {
        "mastery": round(mastery, 1),
        "confidence": round(confidence, 1),
        "attempts": total,
        "correct": correct,
        "streak": streak,
        "last_attempt": node_records[-1].get("timestamp") if node_records else None
    }

def compute_all_mastery(records: list) -> dict:
    """计算所有知识节点的掌握度"""
    # 获取所有知识节点
    nodes = set()
    for r in records:
        node = r.get("knowledgeNode")
        if node:
            nodes.add(node)
    
    result = {}
    for node in nodes:
        result[node] = compute_mastery(records, node)
    
    return result

def main():
    records = load_records()
    if not records:
        print("[INFO] 没有答题记录，生成示例数据演示")
        # 生成示例数据
        now = datetime.now().timestamp() * 1000
        records = [
            {"knowledgeNode": "主谓一致", "correct": False, "timestamp": now - 86400000*10, "difficulty": 3},
            {"knowledgeNode": "主谓一致", "correct": True, "timestamp": now - 86400000*5, "difficulty": 3},
            {"knowledgeNode": "主谓一致", "correct": True, "timestamp": now - 86400000*2, "difficulty": 4},
            {"knowledgeNode": "非谓语动词", "correct": False, "timestamp": now - 86400000*7, "difficulty": 4},
            {"knowledgeNode": "非谓语动词", "correct": False, "timestamp": now - 86400000*3, "difficulty": 4},
            {"knowledgeNode": "定语从句", "correct": True, "timestamp": now - 86400000*1, "difficulty": 3},
        ]
    
    result = compute_all_mastery(records)
    
    MASTERY_PATH.parent.mkdir(parents=True, exist_ok=True)
    json.dump(result, open(MASTERY_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    
    print(f"=== 掌握度模型已生成 ===")
    print(f"知识节点数: {len(result)}")
    print(f"产出: {MASTERY_PATH}")
    print()
    for node, data in sorted(result.items(), key=lambda x: -x[1]["mastery"]):
        print(f"  {node}: 掌握度={data['mastery']}% 置信度={data['confidence']}% ({data['attempts']}次)")

if __name__ == "__main__":
    main()
