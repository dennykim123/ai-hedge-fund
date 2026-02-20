# AI Hedge Fund — 설계 문서

**날짜**: 2026-02-20
**목표**: threadsaver.org 클론 + 대폭 업그레이드
**한 줄 요약**: 백테스트로 검증된 퀀트 시그널 + LLM 판단으로, S&P500을 이기면서 변동성은 낮은 AI 헤지펀드

---

## 1. 핵심 목표

| 항목 | 내용 |
|---|---|
| **수익률 목표** | S&P500 초과 알파 창출 |
| **리스크 목표** | 샤프비율, 소르티노 비율 최적화 |
| **운용 방식** | Paper Trading → 소액 실전 → 점진적 증액 |
| **에셋** | 미국 주식, ETF, 옵션, 암호화폐, FX |

---

## 2. threadsaver 대비 차별화

| 항목 | threadsaver | 우리 시스템 |
|---|---|---|
| **전략 검증** | ❌ 없음 | ✅ 백테스트 엔진 내장 |
| **AI 방식** | LLM만 | 퀀트 시그널 + LLM 하이브리드 |
| **수익률 지표** | ITD Return만 | 샤프비율, 소르티노, 최대낙폭, 알파, 베타 |
| **PM간 관계** | 독립적 | 상관관계 분석 + 진짜 헤지 포지션 |
| **시그널 투명성** | "33+ signals" 블랙박스 | 각 시그널 기여도 공개 |
| **소셜 시그널** | ❌ 없음 | ✅ Reddit + Google Trends + News + X |
| **실전 전환** | Paper only | Paper → 실전 스위치 |
| **에셋** | 미국 주식 추정 | 주식 + 옵션 + 크립토 + FX |

---

## 3. 기술 스택

| 레이어 | 기술 |
|---|---|
| **프론트엔드** | Next.js + TypeScript + TailwindCSS |
| **백엔드** | FastAPI (Python) |
| **데이터베이스** | PostgreSQL |
| **실시간** | WebSocket |
| **AI/ML** | Claude, GPT-4o, Gemini, Grok, DeepSeek |
| **퀀트** | pandas, numpy, backtrader |
| **브로커** | Alpaca (주식), Binance (크립토) — 추후 IBKR |
| **소셜 데이터** | Reddit PRAW, Google Trends, NewsAPI, X API (추후) |

---

## 4. 시스템 아키텍처

```
┌─────────────────────────────────────────────┐
│              Next.js 프론트엔드               │
│  홈 │ 대시보드 │ AI PMs │ 백테스트           │
│  포트폴리오 │ 리스크 │ 어드민               │
└─────────────────┬───────────────────────────┘
                  │ REST API + WebSocket
┌─────────────────▼───────────────────────────┐
│              FastAPI 백엔드                   │
│  퀀트엔진 → LLM엔진                          │
│  소셜엔진    백테스트엔진                     │
│  리스크엔진  브로커어댑터                     │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  PostgreSQL                                  │
│  pms │ signals │ positions │ trades          │
│  nav_history │ backtest_results              │
│  social_signals                              │
└─────────────────────────────────────────────┘
```

---

## 5. AI PM 구성 (11개)

| PM | 전략 | 퀀트 시그널 | LLM |
|---|---|---|---|
| 🌍 Atlas | 매크로 레짐 | 금리/VIX/환율 | Claude |
| 🏛️ The Council | 멀티 합의 | 복합 시그널 | GPT-4o |
| 🔬 Dr. Flow | 옵션 플로우 | 옵션 OI/Volume | Gemini |
| 🕵️ Insider | 내부자 거래 | SEC 13F/Form4 | Grok |
| 💀 Max Payne | 역발상 컨트리안 | 공포탐욕지수 | DeepSeek |
| ₿ Satoshi | 크립토 전문 | 온체인 데이터 | Claude |
| 📊 Quant King | 순수 퀀트 | RSI/MACD/BB | 룰 기반 |
| 🌏 Asia Tiger | 아시아 시장 | 아시아 지표 | Gemini |
| ⚡ Momentum | 추세 추종 | 52주 모멘텀 | GPT-4o |
| 🛡️ Sentinel | 리스크 헤지 | VIX/풋옵션 | Claude |
| 📱 Vox Populi | 소셜 티핑포인트 | Reddit/Trends/News | Claude |

---

## 6. Vox Populi 소셜 시그널 파이프라인

**Phase 1~4 (무료)**
- Reddit PRAW — r/wallstreetbets, r/investing, r/CryptoCurrency
- Google Trends API — 검색량 급증 선행 지표
- NewsAPI — 속보 감성 분석

**Phase 5+ (실전 전환 후)**
- X API Basic ($100/월) — 인플루언서 시그널

**티핑포인트 감지**: 언급량 Z-score 3σ+ → LLM 노이즈 필터 → 감성 방향성 → Conviction Score

---

## 7. 성과 지표 목표

| 지표 | 목표 |
|---|---|
| 알파 | > 0 (S&P500 초과) |
| 샤프비율 | > 1.5 |
| 소르티노비율 | > 2.0 |
| 최대낙폭 (MDD) | < 15% |
| 베타 | < 0.7 |
| 칼마비율 | > 1.0 |

---

## 8. 개발 페이즈

| 페이즈 | 내용 | 기간 |
|---|---|---|
| **Phase 1** | DB + FastAPI 골격 + Next.js 홈 | 2주 |
| **Phase 2** | 퀀트 시그널 엔진 + LLM 판단 + PM 대시보드 | 3주 |
| **Phase 3** | 성과 지표 엔진 + 백테스트 | 2주 |
| **Phase 4** | Paper Trading + WebSocket + 소셜 시그널 | 2주 |
| **Phase 5** | 실전 브로커 연동 (Alpaca + Binance) | 2주 |

---

## 9. 리스크 관리

- 개별 PM 포지션 한도: 포트폴리오의 10% 이하
- 섹터 집중도 제한: 단일 섹터 25% 이하
- MDD 트리거: 15% 초과 시 자동 헤지 발동
- PM간 상관관계: 0.7 초과 시 경고
- Sentinel PM이 항상 헤지 포지션 유지
