"""Simplified XP source metadata.

Production-focused mapping of XPSource -> label/description/category/default XP.
"""

from __future__ import annotations

from dataclasses import dataclass

from src.db.gamification import XPSource
from src.services.gamification.config import get_gamification_config


@dataclass(frozen=True)
class _Meta:
    label: str
    description: str
    category: str


_META: dict[XPSource, _Meta] = {
    XPSource.LOGIN_BONUS: _Meta("Daily Login", "First login of the day", "engagement"),
    XPSource.ACTIVITY_COMPLETION: _Meta(
        "Activity Completion", "Completing a learning activity", "learning"
    ),
    XPSource.COURSE_COMPLETION: _Meta(
        "Course Completion", "Finishing a course", "learning"
    ),
    XPSource.STREAK_BONUS: _Meta(
        "Streak Bonus", "Reached a streak milestone", "streak"
    ),
    XPSource.ASSIGNMENT_SUBMISSION: _Meta(
        "Assignment Submission", "Submitting an assignment", "learning"
    ),
    XPSource.PEER_REVIEW: _Meta("Peer Review", "Reviewing peer work", "community"),
    XPSource.FORUM_PARTICIPATION: _Meta(
        "Forum Participation", "Participating in discussions", "community"
    ),
    XPSource.QUIZ_COMPLETION: _Meta("Quiz Completion", "Completing a quiz", "learning"),
    XPSource.MILESTONE_ACHIEVEMENT: _Meta(
        "Milestone Achievement", "Unlocking an achievement milestone", "achievement"
    ),
    XPSource.DAILY_GOAL_COMPLETION: _Meta(
        "Daily Goal", "Reaching daily XP goal", "goal"
    ),
    XPSource.ADMIN_AWARD: _Meta("Admin Award", "Custom admin-granted XP", "admin"),
}


def list_xp_sources() -> list[dict[str, object]]:
    cfg = get_gamification_config()
    return [
        {
            "key": src.value,
            "label": meta.label,
            "description": meta.description,
            "default_xp": cfg.xp_rewards.get_reward(src),
            "category": meta.category,
        }
        for src, meta in _META.items()
    ]


def canonicalize_source(source_key: str) -> XPSource:
    return XPSource(source_key)
