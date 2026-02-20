from dataclasses import dataclass, field

POSITION_LIMIT = 0.10  # 10% of portfolio


@dataclass
class PaperTradingEngine:
    initial_capital: float
    cash: float = field(init=False)
    positions: dict = field(default_factory=dict, init=False)
    trade_history: list = field(default_factory=list, init=False)

    def __post_init__(self):
        self.cash = self.initial_capital

    def portfolio_value(self, current_prices: dict) -> float:
        holdings_value = sum(
            pos["quantity"] * current_prices.get(sym, pos["avg_cost"])
            for sym, pos in self.positions.items()
        )
        return self.cash + holdings_value

    def _check_position_limit(
        self, symbol: str, order_value: float, current_prices: dict | None = None
    ) -> bool:
        nav = self.portfolio_value(current_prices or {})
        current_pos_value = 0.0
        if symbol in self.positions:
            pos = self.positions[symbol]
            price = (current_prices or {}).get(symbol, pos["avg_cost"])
            current_pos_value = pos["quantity"] * price
        return (current_pos_value + order_value) <= nav * POSITION_LIMIT

    def execute_buy(
        self,
        symbol: str,
        quantity: float,
        price: float,
        current_prices: dict | None = None,
    ) -> dict:
        order_value = quantity * price
        if not self._check_position_limit(symbol, order_value, current_prices):
            return {"status": "rejected", "reason": "position_limit exceeded"}
        if order_value > self.cash:
            return {"status": "rejected", "reason": "insufficient_cash"}
        self.cash -= order_value
        if symbol in self.positions:
            pos = self.positions[symbol]
            total_qty = pos["quantity"] + quantity
            pos["avg_cost"] = (
                pos["quantity"] * pos["avg_cost"] + order_value
            ) / total_qty
            pos["quantity"] = total_qty
        else:
            self.positions[symbol] = {"quantity": quantity, "avg_cost": price}
        self.trade_history.append(
            {"action": "BUY", "symbol": symbol, "quantity": quantity, "price": price}
        )
        return {
            "status": "executed",
            "symbol": symbol,
            "quantity": quantity,
            "price": price,
        }

    def execute_sell(self, symbol: str, quantity: float, price: float) -> dict:
        if symbol not in self.positions:
            return {"status": "rejected", "reason": "no_position"}
        if self.positions[symbol]["quantity"] < quantity:
            quantity = self.positions[symbol]["quantity"]
        self.cash += quantity * price
        self.positions[symbol]["quantity"] -= quantity
        if self.positions[symbol]["quantity"] <= 0:
            del self.positions[symbol]
        self.trade_history.append(
            {"action": "SELL", "symbol": symbol, "quantity": quantity, "price": price}
        )
        return {
            "status": "executed",
            "symbol": symbol,
            "quantity": quantity,
            "price": price,
        }
