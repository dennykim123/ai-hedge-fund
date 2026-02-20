from app.engines.social import SocialEngine


def test_zscore_detects_spike():
    engine = SocialEngine()
    history = [10, 11, 9, 10, 12, 10, 9, 11, 10, 50]
    zscore = engine.calculate_zscore(history)
    assert zscore > 3.0, f"Spike should be 3s+, got {zscore}"


def test_zscore_normal_no_spike():
    engine = SocialEngine()
    history = [10, 11, 9, 10, 12, 10, 9, 11, 10, 10]
    zscore = engine.calculate_zscore(history)
    assert zscore < 1.5


def test_tipping_point_signal():
    engine = SocialEngine()
    result = engine.evaluate_tipping_point(
        "AAPL", mention_history=[10, 11, 9, 10, 12, 10, 9, 11, 10, 55], sentiment=0.8
    )
    assert result["is_tipping_point"] is True
    assert result["direction"] == "bullish"
    assert result["zscore"] > 3.0


def test_tipping_point_bearish():
    engine = SocialEngine()
    result = engine.evaluate_tipping_point(
        "GME", mention_history=[10, 11, 9, 10, 12, 10, 9, 11, 10, 55], sentiment=-0.5
    )
    assert result["direction"] == "bearish"


def test_zscore_short_history_returns_zero():
    # social.py 41번: len(history) < 3 → 0.0
    engine = SocialEngine()
    assert engine.calculate_zscore([]) == 0.0
    assert engine.calculate_zscore([10]) == 0.0
    assert engine.calculate_zscore([10, 20]) == 0.0


def test_zscore_uniform_history_returns_zero():
    # social.py 46번: std == 0 → 0.0
    engine = SocialEngine()
    history = [10, 10, 10, 10, 10]  # 모두 동일 → std=0
    result = engine.calculate_zscore(history)
    assert result == 0.0
