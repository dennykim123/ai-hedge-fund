"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export type Locale = "en" | "ko";

const translations = {
  // Sidebar
  "nav.home": { en: "Home", ko: "홈" },
  "nav.overview": { en: "Overview", ko: "개요" },
  "nav.dashboard": { en: "Dashboard", ko: "대시보드" },
  "nav.strategic": { en: "Strategic", ko: "전략" },
  "nav.pms": { en: "AI PMs", ko: "AI PM" },
  "nav.portfolio": { en: "Portfolio", ko: "포트폴리오" },
  "nav.risk": { en: "Risk", ko: "리스크" },
  "nav.analytics": { en: "Analytics", ko: "분석" },
  "nav.backtest": { en: "Backtest", ko: "백테스트" },
  "nav.system": { en: "System", ko: "시스템" },

  // AdminVitals
  "vitals.nav": { en: "NAV", ko: "순자산" },
  "vitals.today": { en: "Today", ko: "오늘" },
  "vitals.itd": { en: "ITD", ko: "개시이래" },
  "vitals.pms": { en: "PMs", ko: "PM" },
  "vitals.pos": { en: "Pos", ko: "포지션" },
  "vitals.live": { en: "LIVE", ko: "실시간" },

  // Dashboard
  "dash.fund_nav": { en: "FUND NAV", ko: "펀드 순자산" },
  "dash.itd_return": { en: "ITD RETURN", ko: "개시이래 수익률" },
  "dash.sharpe": { en: "SHARPE", ko: "샤프 비율" },
  "dash.max_dd": { en: "MAX DD", ko: "최대 낙폭" },
  "dash.run_all": { en: "Run All Cycles", ko: "전체 사이클 실행" },
  "dash.running": { en: "Running...", ko: "실행 중..." },
  "dash.nav_history": {
    en: "FUND NAV HISTORY (60D)",
    ko: "펀드 NAV 추이 (60일)",
  },
  "dash.loading_nav": {
    en: "Loading NAV data...",
    ko: "NAV 데이터 로딩 중...",
  },
  "dash.pm_leaderboard": { en: "PM LEADERBOARD", ko: "PM 순위" },
  "dash.activity_feed": { en: "ACTIVITY FEED", ko: "활동 피드" },
  "dash.no_activity": { en: "No activity yet.", ko: "아직 활동이 없습니다." },
  "dash.run_to_see": {
    en: "Run a cycle to see trades.",
    ko: "사이클을 실행하면 거래를 볼 수 있습니다.",
  },
  "dash.cycle_complete": { en: "Cycle complete", ko: "사이클 완료" },
  "dash.trades_executed": { en: "trades executed", ko: "건 거래 실행됨" },
  "dash.error_cycle": { en: "Error running cycle", ko: "사이클 실행 오류" },

  // Portfolio
  "port.positions": { en: "POSITIONS", ko: "포지션" },
  "port.total_exposure": { en: "TOTAL EXPOSURE", ko: "총 익스포저" },
  "port.net_exposure_pct": { en: "NET EXPOSURE %", ko: "순 익스포저 %" },
  "port.trades_value": { en: "TRADES (TOTAL VALUE)", ko: "거래 (총 금액)" },
  "port.positions_tab": { en: "Positions", ko: "포지션" },
  "port.trades_tab": { en: "Trades", ko: "거래내역" },
  "port.exposure_tab": { en: "Exposure", ko: "익스포저" },
  "port.refresh": { en: "Refresh", ko: "새로고침" },
  "port.active_positions": { en: "ACTIVE POSITIONS", ko: "보유 포지션" },
  "port.no_positions": {
    en: "No positions yet. Run a trading cycle to generate positions.",
    ko: "포지션이 없습니다. 트레이딩 사이클을 실행하세요.",
  },
  "port.trade_history": { en: "TRADE HISTORY", ko: "거래 내역" },
  "port.time": { en: "TIME", ko: "시간" },
  "port.pm": { en: "PM", ko: "PM" },
  "port.action": { en: "ACTION", ko: "매매" },
  "port.symbol": { en: "SYMBOL", ko: "종목" },
  "port.qty": { en: "QTY", ko: "수량" },
  "port.price": { en: "PRICE", ko: "가격" },
  "port.value": { en: "VALUE", ko: "금액" },
  "port.conviction": { en: "CONVICTION", ko: "확신도" },
  "port.no_trades": { en: "No trades yet", ko: "거래 없음" },
  "port.net_exposure": { en: "NET EXPOSURE", ko: "순 익스포저" },
  "port.long_exposure": { en: "Long Exposure", ko: "롱 익스포저" },
  "port.short_exposure": { en: "Short Exposure", ko: "숏 익스포저" },
  "port.gross_exposure": { en: "Gross Exposure", ko: "총 익스포저" },
  "port.pm_exposure": { en: "PM EXPOSURE", ko: "PM별 익스포저" },
  "port.no_pm_exposure": {
    en: "No PM exposure data",
    ko: "PM 익스포저 데이터 없음",
  },
  "port.of_nav": { en: "of NAV", ko: "NAV 대비" },

  // Risk
  "risk.overall": { en: "OVERALL RISK ASSESSMENT", ko: "종합 리스크 평가" },
  "risk.high": { en: "HIGH RISK", ko: "고위험" },
  "risk.moderate": { en: "MODERATE RISK", ko: "중위험" },
  "risk.low": { en: "LOW RISK", ko: "저위험" },
  "risk.score": { en: "RISK SCORE", ko: "리스크 점수" },
  "risk.gross_exp": { en: "GROSS EXPOSURE", ko: "총 익스포저" },
  "risk.net_exp": { en: "NET EXPOSURE", ko: "순 익스포저" },
  "risk.margin": { en: "MARGIN UTIL", ko: "마진 사용률" },
  "risk.radar": { en: "RISK RADAR", ko: "리스크 레이더" },
  "risk.breakdown": { en: "RISK METRICS BREAKDOWN", ko: "리스크 지표 상세" },
  "risk.no_data": { en: "No risk data available", ko: "리스크 데이터 없음" },
  "risk.decisions": { en: "RISK DECISIONS (24H)", ko: "리스크 판단 (24시간)" },
  "risk.total": { en: "Total", ko: "전체" },
  "risk.approved": { en: "Approved", ko: "승인" },
  "risk.rejected": { en: "Rejected", ko: "거부" },
  "risk.approval_rate": { en: "Approval Rate", ko: "승인율" },
  "risk.concentration": { en: "CONCENTRATION", ko: "집중도" },
  "risk.top_ticker": { en: "TOP TICKER", ko: "최다 종목" },
  "risk.top_sector": { en: "TOP SECTOR", ko: "최다 섹터" },
  "risk.th_concentration": { en: "Concentration", ko: "집중도" },
  "risk.th_volatility": { en: "Volatility", ko: "변동성" },
  "risk.th_drawdown": { en: "Drawdown", ko: "낙폭" },
  "risk.th_correlation": { en: "Correlation", ko: "상관관계" },
  "risk.th_leverage": { en: "Leverage", ko: "레버리지" },
  "risk.th_liquidity": { en: "Liquidity", ko: "유동성" },

  // Analytics
  "anal.alpha": { en: "Alpha Leaderboard", ko: "알파 순위" },
  "anal.providers": { en: "By Provider", ko: "프로바이더별" },
  "anal.conviction_acc": { en: "Conviction Accuracy", ko: "확신도 정확도" },
  "anal.pm_return": { en: "PM RETURN COMPARISON", ko: "PM 수익률 비교" },
  "anal.full_alpha": { en: "FULL ALPHA LEADERBOARD", ko: "전체 알파 순위" },
  "anal.return": { en: "RETURN", ko: "수익률" },
  "anal.alpha_spy": { en: "ALPHA vs SPY", ko: "SPY 대비 알파" },
  "anal.days": { en: "DAYS", ko: "일수" },
  "anal.avg_return": { en: "AVG RETURN", ko: "평균 수익률" },
  "anal.provider_returns": {
    en: "PROVIDER AVERAGE RETURNS",
    ko: "프로바이더 평균 수익률",
  },
  "anal.conviction_cal": {
    en: "CONVICTION SCORE ACCURACY CALIBRATION",
    ko: "확신도 정확도 보정",
  },
  "anal.conv_range": { en: "CONVICTION RANGE", ko: "확신도 구간" },
  "anal.trades": { en: "TRADES", ko: "거래수" },
  "anal.correct": { en: "CORRECT", ko: "적중" },
  "anal.accuracy": { en: "ACCURACY", ko: "정확도" },
  "anal.no_trades": {
    en: "No trades recorded yet.",
    ko: "아직 기록된 거래가 없습니다.",
  },
  "anal.run_to_see": {
    en: "Run trading cycles to see conviction accuracy data.",
    ko: "트레이딩 사이클을 실행하면 확신도 데이터를 볼 수 있습니다.",
  },

  // Strategic
  "strat.regime": { en: "MARKET REGIME", ko: "시장 국면" },
  "strat.bull": { en: "Bull Market", ko: "강세장" },
  "strat.bear": { en: "Bear Market", ko: "약세장" },
  "strat.neutral": { en: "Neutral / Sideways", ko: "중립 / 횡보" },
  "strat.normal": { en: "Normal", ko: "보통" },
  "strat.confidence": { en: "Confidence", ko: "신뢰도" },
  "strat.avg_daily": { en: "Avg Daily", ko: "일평균" },
  "strat.thesis": { en: "THESIS HEALTH", ko: "투자 논제 상태" },
  "strat.active": { en: "Active", ko: "활성" },
  "strat.flagged": { en: "Flagged", ko: "주의" },
  "strat.invalid": { en: "Invalid", ko: "무효" },
  "strat.social": { en: "SOCIAL TIPPING POINTS", ko: "소셜 티핑포인트" },
  "strat.tipping": { en: "Tipping point detected!", ko: "티핑포인트 감지!" },
  "strat.pm_goals": { en: "PM STRATEGY GOALS", ko: "PM 전략 목표" },

  // System
  "sys.status": { en: "System Status", ko: "시스템 상태" },
  "sys.healthy": { en: "services healthy", ko: "서비스 정상" },
  "sys.run_cycle": { en: "Run Trading Cycle", ko: "트레이딩 사이클 실행" },
  "sys.running": { en: "Running...", ko: "실행 중..." },
  "sys.service": { en: "SERVICE STATUS", ko: "서비스 상태" },
  "sys.pipeline": { en: "ORDER PIPELINE", ko: "주문 파이프라인" },
  "sys.soq": { en: "SOQ METRICS", ko: "SOQ 지표" },
  "sys.queue": { en: "Queue", ko: "대기열" },
  "sys.latency": { en: "Latency", ko: "지연시간" },
  "sys.today": { en: "Today", ko: "오늘" },
  "sys.freshness": { en: "SIGNAL FRESHNESS", ko: "시그널 최신성" },
  "sys.no_data": { en: "No data", ko: "데이터 없음" },
  "sys.social_sources": { en: "SOCIAL DATA SOURCES", ko: "소셜 데이터 소스" },
  "sys.configure_api": {
    en: "Configure API keys in",
    ko: "API 키를 설정하세요:",
  },
  "sys.to_enable": {
    en: "to enable real social data",
    ko: "실제 소셜 데이터 활성화",
  },
  "sys.env": { en: "ENVIRONMENT", ko: "환경 설정" },
  "sys.signal_feed": { en: "SIGNAL FEED", ko: "시그널 피드" },
  "sys.broker_status": { en: "BROKER STATUS", ko: "브로커 상태" },
  "sys.kill_switch": { en: "KILL SWITCH", ko: "긴급 정지" },
  "sys.resume_all": { en: "RESUME ALL", ko: "전체 재개" },
  "sys.switch_live": { en: "SWITCH TO LIVE", ko: "실거래 전환" },
  "sys.switch_testnet": { en: "SWITCH TO TESTNET", ko: "테스트넷 전환" },
  "sys.stopped": { en: "STOPPED", ko: "정지됨" },
  "sys.reconciliation": { en: "BALANCE RECONCILIATION", ko: "잔고 대조" },
  "sys.reconcile": { en: "Reconcile", ko: "잔고 대조" },
  "sys.db_qty": { en: "DB", ko: "DB" },
  "sys.broker_qty": { en: "Broker", ko: "브로커" },
  "sys.diff": { en: "Diff", ko: "차이" },
  "sys.match": { en: "Match", ko: "일치" },
  "sys.mismatch": { en: "Mismatch", ko: "불일치" },
  "sys.no_positions": {
    en: "No positions to reconcile",
    ko: "대조할 포지션 없음",
  },
  "sys.reconciling": { en: "Reconciling...", ko: "대조 중..." },
  "sys.cycle_complete": { en: "Cycle complete", ko: "사이클 완료" },
  "sys.trades_exec": { en: "trades executed", ko: "건 거래 실행됨" },
  "sys.error_cycle": {
    en: "Error running trading cycle",
    ko: "트레이딩 사이클 실행 오류",
  },

  // Common
  "common.of_nav": { en: "of NAV", ko: "NAV 대비" },

  // PMs List Page
  "pms.title": { en: "AI Portfolio Managers", ko: "AI 포트폴리오 매니저" },
  "pms.subtitle": {
    en: "11 AI personalities, each with distinct strategies",
    ko: "11개의 AI 개성, 각각 고유한 전략 보유",
  },
  "pms.sort_return": { en: "By Return", ko: "수익률순" },
  "pms.sort_capital": { en: "By Capital", ko: "자본순" },
  "pms.sort_name": { en: "By Name", ko: "이름순" },
  "pms.total_nav": { en: "TOTAL NAV", ko: "총 순자산" },
  "pms.avg_return": { en: "AVG RETURN", ko: "평균 수익률" },
  "pms.best_pm": { en: "BEST PM", ko: "최고 PM" },
  "pms.capital": { en: "CAPITAL", ko: "자본" },
  "pms.itd_return": { en: "ITD RETURN", ko: "개시이래 수익률" },
  "pms.of_fund": { en: "of fund", ko: "펀드 비중" },
  "pms.view_details": { en: "View details →", ko: "상세보기 →" },

  // PM Detail Page
  "pm.all_pms": { en: "← All PMs", ko: "← 전체 PM" },
  "pm.not_found": { en: "PM Not Found", ko: "PM을 찾을 수 없음" },
  "pm.back_to_pms": { en: "← Back to PMs", ko: "← PM 목록으로" },
  "pm.run_cycle": { en: "▶ Run Cycle", ko: "▶ 사이클 실행" },
  "pm.running": { en: "Running...", ko: "실행 중..." },
  "pm.cycle_complete": { en: "Cycle complete", ko: "사이클 완료" },
  "pm.error_cycle": { en: "Error running cycle", ko: "사이클 실행 오류" },
  "pm.capital": { en: "CAPITAL", ko: "자본" },
  "pm.itd_return": { en: "ITD RETURN", ko: "개시이래 수익률" },
  "pm.positions": { en: "POSITIONS", ko: "포지션" },
  "pm.signals": { en: "SIGNALS", ko: "시그널" },
  "pm.cap_perf": {
    en: "CAPITAL PERFORMANCE (30D SIMULATION)",
    ko: "자본 성과 (30일 시뮬레이션)",
  },
  "pm.conviction": { en: "CONVICTION SCORE", ko: "확신도 점수" },
  "pm.latest_signal": { en: "Latest Signal", ko: "최근 시그널" },
  "pm.high_conv": { en: "High conviction", ko: "높은 확신" },
  "pm.moderate_conv": { en: "Moderate", ko: "보통" },
  "pm.low_conv": { en: "Low / HOLD", ko: "낮음 / 보유" },
  "pm.open_positions": { en: "OPEN POSITIONS", ko: "보유 포지션" },
  "pm.no_positions": { en: "No open positions", ko: "보유 포지션 없음" },
  "pm.recent_signals": { en: "RECENT SIGNALS", ko: "최근 시그널" },
  "pm.no_signals": { en: "No signals yet.", ko: "아직 시그널이 없습니다." },
  "pm.run_to_generate": {
    en: 'Click "Run Cycle" to generate.',
    ko: '"사이클 실행"을 클릭하세요.',
  },
  "pm.recent_trades": { en: "RECENT TRADES", ko: "최근 거래" },
  "pm.no_trades": { en: "No trades executed yet", ko: "아직 거래가 없습니다" },
  "pm.th_symbol": { en: "SYMBOL", ko: "종목" },
  "pm.th_action": { en: "ACTION", ko: "매매" },
  "pm.th_qty": { en: "QTY", ko: "수량" },
  "pm.th_price": { en: "PRICE", ko: "가격" },
  "pm.th_value": { en: "VALUE", ko: "금액" },
  "pm.th_conviction": { en: "CONVICTION", ko: "확신도" },
  "pm.default_desc": {
    en: "Specialized AI portfolio manager.",
    ko: "전문 AI 포트폴리오 매니저.",
  },
  "pm.desc_atlas": {
    en: "Macro regime specialist that reads interest rate cycles, VIX patterns, and currency trends to position the fund ahead of broad market shifts.",
    ko: "금리 사이클, VIX 패턴, 환율 트렌드를 분석하여 시장 변화에 앞서 포지션을 잡는 매크로 전문가.",
  },
  "pm.desc_council": {
    en: "Multi-persona consensus engine combining value, growth, and macro perspectives. Requires alignment across all three before executing.",
    ko: "가치, 성장, 매크로 관점을 결합한 다중 페르소나 합의 엔진. 세 관점이 모두 일치해야 실행.",
  },
  "pm.desc_drflow": {
    en: "Options flow analyst tracking unusual open interest and volume to detect informed money movements before price action confirms.",
    ko: "비정상 미결제약정과 거래량을 추적하여 가격 변동 전 정보력 있는 자금 흐름을 감지하는 옵션 플로우 분석가.",
  },
  "pm.desc_insider": {
    en: "Smart money tracker following SEC Form 4 filings and 13F reports to mirror institutional positioning with a 30-day lag edge.",
    ko: "SEC Form 4 공시와 13F 보고서를 추적하여 30일 시차 우위로 기관 포지션을 미러링하는 스마트머니 트래커.",
  },
  "pm.desc_maxpayne": {
    en: "Contrarian extremist. Fades panic, buys blood. Uses Fear & Greed Index and put/call ratios to identify capitulation points.",
    ko: "극단적 역투자자. 공포에 매수, 탐욕에 매도. 공포탐욕지수와 풋/콜 비율로 항복 지점을 포착.",
  },
  "pm.desc_satoshi": {
    en: "Crypto-native PM analyzing on-chain metrics, DeFi flows, and cross-asset correlation to navigate digital asset cycles.",
    ko: "온체인 지표, DeFi 자금 흐름, 크로스 자산 상관관계를 분석하여 디지털 자산 사이클을 운항하는 크립토 네이티브 PM.",
  },
  "pm.desc_quantking": {
    en: "Pure mechanical system with zero discretion. Executes RSI, MACD, Bollinger Band signals at scale with strict position sizing.",
    ko: "재량 없는 순수 기계적 시스템. RSI, MACD, 볼린저 밴드 시그널을 엄격한 포지션 사이징으로 대규모 실행.",
  },
  "pm.desc_asiatiger": {
    en: "Asia Pacific specialist capturing regime differences across Nikkei, Hang Seng, and KOSPI with time-zone arbitrage advantages.",
    ko: "닛케이, 항셍, KOSPI 간 레짐 차이를 포착하고 시간대 차익 우위를 활용하는 아시아 태평양 전문가.",
  },
  "pm.desc_momentum": {
    en: "52-week trend follower. Buys the strongest, shorts the weakest. Never fights the tape.",
    ko: "52주 추세추종 전략. 최강세 매수, 최약세 공매도. 시장 흐름에 절대 역행하지 않음.",
  },
  "pm.desc_sentinel": {
    en: "Risk manager first, trader second. Maintains constant hedge book. Activates full defensive posture when fund MDD approaches 15%.",
    ko: "리스크 관리자이자 트레이더. 상시 헤지 북 유지. 펀드 MDD가 15%에 근접하면 완전 방어 태세 가동.",
  },
  "pm.desc_voxpopuli": {
    en: "Social tipping point detector. Monitors Reddit WSB, Google Trends, and news velocity for Z-score 3σ+ breakouts before they trend.",
    ko: "소셜 티핑포인트 감지기. Reddit WSB, Google Trends, 뉴스 속도를 모니터링하여 트렌드 전 Z-score 3σ+ 이탈을 포착.",
  },

  // Backtest Page
  "bt.title": { en: "Backtesting Engine", ko: "백테스팅 엔진" },
  "bt.subtitle": {
    en: "Test quantitative strategies on historical data before live deployment",
    ko: "실전 배치 전 히스토리컬 데이터에서 퀀트 전략 테스트",
  },
  "bt.config": { en: "BACKTEST CONFIGURATION", ko: "백테스트 설정" },
  "bt.symbol": { en: "SYMBOL", ko: "종목" },
  "bt.strategy": { en: "STRATEGY", ko: "전략" },
  "bt.period": { en: "PERIOD", ko: "기간" },
  "bt.run": { en: "▶ Run Backtest", ko: "▶ 백테스트 실행" },
  "bt.running": { en: "Running...", ko: "실행 중..." },
  "bt.outperforms": {
    en: "Strategy outperforms benchmark!",
    ko: "전략이 벤치마크를 상회합니다!",
  },
  "bt.underperforms": {
    en: "Strategy underperforms benchmark",
    ko: "전략이 벤치마크를 하회합니다",
  },
  "bt.total_return_label": { en: "Total Return", ko: "총 수익률" },
  "bt.total_return": { en: "TOTAL RETURN", ko: "총 수익률" },
  "bt.sharpe": { en: "SHARPE RATIO", ko: "샤프 비율" },
  "bt.sortino": { en: "SORTINO", ko: "소르티노" },
  "bt.max_dd": { en: "MAX DRAWDOWN", ko: "최대 낙폭" },
  "bt.calmar": { en: "CALMAR RATIO", ko: "칼마 비율" },
  "bt.win_rate": { en: "WIN RATE", ko: "승률" },
  "bt.equity_curve": { en: "EQUITY CURVE", ko: "에퀴티 커브" },
  "bt.signals_analyzed": {
    en: "signal periods analyzed",
    ko: "시그널 기간 분석됨",
  },
  "bt.strategy_notes": { en: "STRATEGY NOTES", ko: "전략 노트" },
  "bt.sharpe_target": { en: "Sharpe Target:", ko: "샤프 목표:" },
  "bt.dd_target": { en: "Max DD Target:", ko: "최대 낙폭 목표:" },
  "bt.alpha_target": { en: "Alpha Target:", ko: "알파 목표:" },
  "bt.target_met": { en: "Target met", ko: "목표 달성" },
  "bt.below_target": { en: "Below target", ko: "목표 미달" },
  "bt.within_limits": { en: "Within limits", ko: "한도 이내" },
  "bt.exceeds_limit": { en: "Exceeds limit", ko: "한도 초과" },
  "bt.outperforming": { en: "Outperforming benchmark", ko: "벤치마크 상회" },
  "bt.underperforming": { en: "Underperforming", ko: "벤치마크 하회" },
  "bt.empty_title": {
    en: "Configure your backtest above and click Run",
    ko: "위에서 백테스트를 설정하고 실행을 클릭하세요",
  },
  "bt.empty_subtitle": {
    en: "Test any strategy against historical market data",
    ko: "히스토리컬 시장 데이터에서 전략을 테스트합니다",
  },

  // Overview Page
  "ov.fund_nav": { en: "FUND NAV", ko: "펀드 순자산" },
  "ov.today": { en: "TODAY", ko: "오늘" },
  "ov.itd_return": { en: "ITD RETURN", ko: "개시이래 수익률" },
  "ov.sharpe": { en: "SHARPE", ko: "샤프" },
  "ov.max_dd": { en: "MAX DD", ko: "최대 낙폭" },
  "ov.active_pms": { en: "ACTIVE PMs", ko: "활성 PM" },
  "ov.positions": { en: "POSITIONS", ko: "포지션" },
  "ov.ws_live": { en: "WebSocket Live", ko: "WebSocket 실시간" },
  "ov.polling": { en: "Polling (30s)", ko: "폴링 (30초)" },

  // Overview Sub-Components
  "ov.fund_health": { en: "FUND HEALTH", ko: "펀드 건강도" },
  "ov.health_excellent": { en: "EXCELLENT", ko: "우수" },
  "ov.health_good": { en: "GOOD", ko: "양호" },
  "ov.health_caution": { en: "CAUTION", ko: "주의" },
  "ov.health_danger": { en: "DANGER", ko: "위험" },
  "ov.itd_return_label": { en: "ITD Return", ko: "개시이래 수익률" },
  "ov.max_dd_label": { en: "Max Drawdown", ko: "최대 낙폭" },
  "ov.sharpe_label": { en: "Sharpe", ko: "샤프" },
  "ov.nav_history": { en: "NAV HISTORY (7D)", ko: "NAV 추이 (7일)" },
  "ov.data_collecting": { en: "Data collecting...", ko: "데이터 수집 중..." },
  "ov.risk_radar": { en: "RISK RADAR", ko: "리스크 레이더" },
  "ov.gross_exp": { en: "Gross Exp", ko: "총 익스포저" },
  "ov.net_exp": { en: "Net Exp", ko: "순 익스포저" },
  "ov.margin": { en: "Margin", ko: "마진" },
  "ov.concentration": { en: "Concentration", ko: "집중도" },
  "ov.volatility": { en: "Volatility", ko: "변동성" },
  "ov.pm_heatmap": { en: "PM PERFORMANCE HEATMAP", ko: "PM 성과 히트맵" },
  "ov.alert_connecting": {
    en: "Connecting to fund data...",
    ko: "펀드 데이터 연결 중...",
  },
  "ov.alert_dd_exceeded": {
    en: "Drawdown threshold exceeded",
    ko: "낙폭 임계값 초과",
  },
  "ov.alert_loss": { en: "Loss warning", ko: "손실 경고" },
  "ov.alert_fear": { en: "Extreme fear detected", ko: "극단적 공포 감지" },
  "ov.alert_vol": { en: "Volatility elevated", ko: "변동성 상승" },
  "ov.alert_excellent": {
    en: "Excellent risk-adjusted returns",
    ko: "우수한 위험조정 수익률",
  },
  "ov.alert_normal": {
    en: "All indicators within normal range — Fund operating optimally",
    ko: "모든 지표 정상 범위 — 펀드 최적 운영 중",
  },

  // Home Page
  "home.title": { en: "AI Hedge Fund", ko: "AI 헤지 펀드" },
  "home.subtitle": {
    en: "11 AI Portfolio Managers. Quant + LLM Hybrid. One Mission.",
    ko: "11명의 AI 포트폴리오 매니저. 퀀트 + LLM 하이브리드. 하나의 미션.",
  },
  "home.dashboard": { en: "Dashboard →", ko: "대시보드 →" },
  "home.ai_pms": { en: "AI PMs", ko: "AI PM" },
  "home.overview": { en: "Overview", ko: "개요" },
  "home.how_it_works": { en: "HOW IT WORKS", ko: "작동 방식" },
  "home.feat1_title": { en: "11 AI Personalities", ko: "11명의 AI 개성" },
  "home.feat1_desc": {
    en: "Atlas, The Council, Dr. Flow, Insider, Max Payne, Satoshi, Quant King, Asia Tiger, Momentum, Sentinel, Vox Populi — each with distinct strategies.",
    ko: "Atlas, The Council, Dr. Flow, Insider, Max Payne, Satoshi, Quant King, Asia Tiger, Momentum, Sentinel, Vox Populi — 각각 고유한 전략 보유.",
  },
  "home.feat2_title": { en: "Quant + LLM Hybrid", ko: "퀀트 + LLM 하이브리드" },
  "home.feat2_desc": {
    en: "Quantitative signals (RSI, momentum, options flow) filtered by LLM conviction scoring. Backtested strategies only.",
    ko: "정량 시그널(RSI, 모멘텀, 옵션 플로우)을 LLM 확신도로 필터링. 백테스트된 전략만 적용.",
  },
  "home.feat3_title": { en: "Social Tipping Points", ko: "소셜 티핑포인트" },
  "home.feat3_desc": {
    en: "Reddit, Google Trends, and news sentiment detect market-moving social signals before they become mainstream.",
    ko: "Reddit, Google Trends, 뉴스 감성으로 주류가 되기 전 시장 움직임 소셜 시그널을 감지.",
  },
  "home.feat4_title": { en: "Risk Management", ko: "리스크 관리" },
  "home.feat4_desc": {
    en: "Sharpe ratio, Sortino ratio, max drawdown monitoring. Sentinel PM maintains constant hedge positions.",
    ko: "샤프 비율, 소르티노 비율, 최대 낙폭 모니터링. Sentinel PM이 상시 헤지 포지션 유지.",
  },
  "home.personalities": {
    en: "AI PERSONALITIES × PROVIDERS",
    ko: "AI 개성 × 프로바이더",
  },
  "home.footer": {
    en: "AI Hedge Fund - 11 AI Portfolio Managers - Quant + LLM Hybrid",
    ko: "AI 헤지 펀드 - 11명의 AI 포트폴리오 매니저 - 퀀트 + LLM 하이브리드",
  },

  // FundStatsGrid
  "stats.fund_nav": { en: "FUND NAV", ko: "펀드 순자산" },
  "stats.today": { en: "TODAY", ko: "오늘" },
  "stats.prior_day": { en: "PRIOR DAY", ko: "전일" },
  "stats.itd_return": { en: "ITD RETURN", ko: "개시이래 수익률" },
  "stats.active_pms": { en: "ACTIVE PMs", ko: "활성 PM" },
  "stats.positions": { en: "POSITIONS", ko: "포지션" },
} as const;

export type TranslationKey = keyof typeof translations;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "ko",
  setLocale: () => {},
  t: (key) => translations[key]?.ko ?? key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("ko");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved && (saved === "en" || saved === "ko")) {
      setLocale(saved);
    }
  }, []);

  const handleSetLocale = (newLocale: Locale) => {
    setLocale(newLocale);
    localStorage.setItem("locale", newLocale);
  };

  const t = (key: TranslationKey): string => {
    return translations[key]?.[locale] ?? key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
