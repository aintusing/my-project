"""Агент-судья: детерминированный вердикт. Модель ИИ число и уровень не назначает."""
from ..core import SEVERITIES

VERDICTS = {
    "critical": "КРИТИЧЕСКИЙ РИСК",
    "high": "ВЫСОКИЙ РИСК",
    "medium": "ЕСТЬ ПРЕДУПРЕЖДЕНИЯ",
    "none": "ЯВНЫХ ФЛАГОВ НЕ НАЙДЕНО",
    "unknown": "НЕДОСТАТОЧНО ДАННЫХ",
}


def verdict(findings, security_ok):
    """security_ok — число источников безопасности, которые реально ответили."""
    unique = {}
    for finding in findings:
        unique.setdefault((finding.code, finding.severity, finding.source), finding)
    ordered = sorted(unique.values(), key=lambda f: SEVERITIES.index(f.severity))
    worst = ordered[0].severity if ordered else "info"
    if worst in ("critical", "high"):
        level = worst
    elif security_ok == 0:
        level = "unknown"  # молчание источников никогда не значит «безопасно»
    elif worst == "medium":
        level = "medium"
    else:
        level = "none"
    confidence = "низкая" if security_ok == 0 else "средняя" if security_ok == 1 else "выше средней"
    return {"level": level, "label": VERDICTS[level], "confidence": confidence, "findings": ordered}
