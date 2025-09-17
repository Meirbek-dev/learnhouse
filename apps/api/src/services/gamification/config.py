"""Gamification configuration (focused, UTC-first)."""

import os
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Optional

from src.db.gamification import StreakType, XPSource


class TimeZone(str, Enum):
    """Supported timezones for gamification calculations."""

    UTC = "UTC"
    ALMATY = "Asia/Almaty"
    NEW_YORK = "America/New_York"
    LONDON = "Europe/London"
    TOKYO = "Asia/Tokyo"


@dataclass(frozen=True)
class LevelConfig:
    """Level progression configuration."""

    base_xp: int = 100
    multiplier: float = 1.25
    max_level: int = 50  # Realistic ceiling

    def __post_init__(self):
        if self.base_xp <= 0:
            msg = "Base XP must be positive"
            raise ValueError(msg)
        if self.multiplier < 1.0:
            msg = "Multiplier must be >= 1.0"
            raise ValueError(msg)
        if self.max_level <= 0:
            msg = "Max level must be positive"
            raise ValueError(msg)


@dataclass(frozen=True)
class XPRewardConfig:
    """XP reward amounts for different actions.

    Note: This remains a simple dataclass for now; in future we might move to a mapping
    keyed directly by XPSource for easier dynamic overrides.
    """

    activity_completion: int = 40
    course_completion: int = 500
    chapter_completion: int = 120
    quiz_completion: int = 60
    assignment_submission: int = 70
    assignment_completion: int = 100

    # Engagement activities
    login_bonus: int = 25
    daily_goal_completion: int = 80
    peer_review: int = 30
    forum_participation: int = 15

    # Social and special
    streak_bonus: int = 100
    milestone_achievement: int = 150
    admin_award: int = 0  # Custom amount required

    def get_reward(self, source: XPSource, custom_amount: int | None = None) -> int:
        if source == XPSource.ADMIN_AWARD and custom_amount is not None:
            return max(0, custom_amount)
        return {
            XPSource.ACTIVITY_COMPLETION: self.activity_completion,
            XPSource.COURSE_COMPLETION: self.course_completion,
            XPSource.QUIZ_COMPLETION: self.quiz_completion,
            XPSource.ASSIGNMENT_SUBMISSION: self.assignment_submission,
            XPSource.LOGIN_BONUS: self.login_bonus,
            XPSource.DAILY_GOAL_COMPLETION: self.daily_goal_completion,
            XPSource.STREAK_BONUS: self.streak_bonus,
            XPSource.PEER_REVIEW: self.peer_review,
            XPSource.FORUM_PARTICIPATION: self.forum_participation,
            XPSource.MILESTONE_ACHIEVEMENT: self.milestone_achievement,
            XPSource.ADMIN_AWARD: self.admin_award,
        }.get(source, 0)

    def as_mapping(self) -> dict[str, int]:
        return {
            k: getattr(self, k)
            for k in self.__dataclass_fields__
            if not k.startswith("_")
        }


@dataclass(frozen=True)
class StreakConfig:
    """Streak tracking configuration."""

    grace_period_hours: int = 12
    # Canonical milestone sets
    milestones: tuple[int, ...] = (3, 7, 14, 30, 60, 100)
    learning_milestones: tuple[int, ...] = (3, 7, 14, 30, 90, 180, 365)
    milestone_bonuses: dict[int, int] = None
    # Optional weekly bonus cadence (in days); None to disable
    weekly_bonus_interval: int | None = None

    def __post_init__(self):
        if self.milestone_bonuses is None:
            # Default milestone bonuses
            object.__setattr__(
                self,
                "milestone_bonuses",
                {
                    3: 15,
                    7: 35,
                    14: 75,
                    30: 150,
                    90: 350,
                    180: 750,
                    365: 1500,
                },
            )

    def get_milestone_bonus(self, streak_count: int, streak_type: StreakType) -> int:
        """Get bonus XP for reaching a streak milestone."""
        if streak_count in self.milestone_bonuses:
            return self.milestone_bonuses[streak_count]
        return 0

    # Back-compat aliases used by routers/UI
    @property
    def login_milestones(self) -> tuple[int, ...]:
        # Older code expects "login_milestones"; use general milestones
        return self.milestones


@dataclass(frozen=True)
class DailyCapsConfig:
    """Daily limits and caps configuration."""

    max_daily_xp: int = 500
    default_daily_goal: int = 50  # Achievable daily goal
    # Use UTC for deterministic server-day semantics
    reset_timezone: TimeZone = TimeZone.UTC
    reset_hour: int = 0  # Midnight reset

    def __post_init__(self):
        if not (0 <= self.reset_hour <= 23):
            msg = "Reset hour must be 0-23"
            raise ValueError(msg)


@dataclass(frozen=True)
class CacheConfig:
    """Cache configuration (simplified)."""

    profile_ttl_seconds: int = 300
    leaderboard_ttl_seconds: int = 900
    xp_summary_ttl_seconds: int = 120
    enabled: bool = True
    redis_key_prefix: str = "gamification"


@dataclass(frozen=True)
class GamificationConfig:
    """Main gamification configuration class."""

    timezone: TimeZone
    levels: LevelConfig
    xp_rewards: XPRewardConfig = None
    streaks: StreakConfig = None
    daily_caps: DailyCapsConfig = None
    cache: CacheConfig = None

    # Feature flags
    enable_streaks: bool = True
    enable_achievements: bool = False  # off by default until completed
    enable_leaderboards: bool = True
    enable_daily_goals: bool = True

    def __post_init__(self):
        # Initialize with defaults if None
        if self.levels is None:
            object.__setattr__(self, "levels", LevelConfig())
        if self.xp_rewards is None:
            object.__setattr__(self, "xp_rewards", XPRewardConfig())
        if self.streaks is None:
            object.__setattr__(self, "streaks", StreakConfig())
        if self.daily_caps is None:
            object.__setattr__(self, "daily_caps", DailyCapsConfig())
        if self.cache is None:
            object.__setattr__(self, "cache", CacheConfig())

    @classmethod
    def from_env(cls):  # minimal env loader
        return cls(
            levels=LevelConfig(
                base_xp=int(os.getenv("GAMIFICATION_BASE_XP", "100")),
                multiplier=float(os.getenv("GAMIFICATION_MULTIPLIER", "1.15")),
                max_level=int(os.getenv("GAMIFICATION_MAX_LEVEL", "50")),
            ),
            daily_caps=DailyCapsConfig(
                max_daily_xp=int(os.getenv("GAMIFICATION_MAX_DAILY_XP", "800")),
                default_daily_goal=int(os.getenv("GAMIFICATION_DAILY_GOAL", "50")),
            ),
            cache=CacheConfig(
                enabled=os.getenv("GAMIFICATION_CACHE_ENABLED", "true").lower()
                == "true",
            ),
            enable_streaks=os.getenv("GAMIFICATION_ENABLE_STREAKS", "true").lower()
            == "true",
            enable_achievements=os.getenv(
                "GAMIFICATION_ENABLE_ACHIEVEMENTS", "false"
            ).lower()
            == "true",
            enable_leaderboards=os.getenv(
                "GAMIFICATION_ENABLE_LEADERBOARDS", "true"
            ).lower()
            == "true",
        )


# Global configuration instance
_config: GamificationConfig | None = None


def get_gamification_config() -> GamificationConfig:
    """Get global gamification configuration."""
    global _config
    if _config is None:
        # Provide sensible production-ready defaults
        _config = GamificationConfig(
            timezone=TimeZone.UTC,
            levels=LevelConfig(),
            xp_rewards=XPRewardConfig(),
            streaks=StreakConfig(),
            daily_caps=DailyCapsConfig(),
            cache=CacheConfig(),
        )
    return _config


def set_gamification_config(config: GamificationConfig) -> None:
    """Set global gamification configuration (for testing)."""
    global _config
    _config = config
