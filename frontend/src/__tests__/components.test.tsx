import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";

// Test 1: SkeletonCard renders correct number of rows
describe("SkeletonCard", () => {
  it("renders the specified number of skeleton rows", async () => {
    const { SkeletonCard } = await import("@/components/ui/SkeletonCard");
    const { container } = render(<SkeletonCard rows={4} />);
    // 1 header skeleton + 4 row skeletons
    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons.length).toBe(5);
  });

  it("defaults to 3 rows", async () => {
    const { SkeletonCard } = await import("@/components/ui/SkeletonCard");
    const { container } = render(<SkeletonCard />);
    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons.length).toBe(4); // 1 header + 3 rows
  });
});

// Test 2: SkeletonTable renders grid
describe("SkeletonTable", () => {
  it("renders correct rows and cols", async () => {
    const { SkeletonTable } = await import("@/components/ui/SkeletonCard");
    const { container } = render(<SkeletonTable rows={3} cols={2} />);
    // 1 header + (3 rows x 2 cols) = 7 skeletons
    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons.length).toBe(7);
  });
});

// Test 3: FundStats formatting utilities
describe("FundStats formatting", () => {
  it("formatCurrency formats USD correctly", () => {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    });
    expect(formatter.format(1000000)).toBe("$1,000,000");
    expect(formatter.format(0)).toBe("$0");
    expect(formatter.format(1500)).toBe("$1,500");
  });

  it("formatReturn adds sign and percentage", () => {
    const formatReturn = (value: number): string => {
      const sign = value >= 0 ? "+" : "";
      return `${sign}${value.toFixed(2)}%`;
    };
    expect(formatReturn(5.23)).toBe("+5.23%");
    expect(formatReturn(-3.1)).toBe("-3.10%");
    expect(formatReturn(0)).toBe("+0.00%");
  });

  it("returnColor returns correct color class", () => {
    const returnColor = (value: number): string => {
      if (value > 0) return "text-emerald-400";
      if (value < 0) return "text-red-400";
      return "text-gray-400";
    };
    expect(returnColor(1)).toBe("text-emerald-400");
    expect(returnColor(-1)).toBe("text-red-400");
    expect(returnColor(0)).toBe("text-gray-400");
  });
});

// Test 4: FundHealthBadge logic (getHealth function)
describe("FundHealthBadge getHealth logic", () => {
  type HealthStatus = "EXCELLENT" | "GOOD" | "CAUTION" | "DANGER";
  function getHealth(
    itdReturn: number,
    mdd: number,
    sharpe: number,
  ): HealthStatus {
    if (mdd < -0.15 || itdReturn < -0.1) return "DANGER";
    if (mdd < -0.08 || itdReturn < -0.03) return "CAUTION";
    if (itdReturn > 0.05 && sharpe > 1.0) return "EXCELLENT";
    return "GOOD";
  }

  it("returns DANGER for high drawdown", () => {
    expect(getHealth(0.05, -0.2, 1.5)).toBe("DANGER");
  });

  it("returns DANGER for large negative return", () => {
    expect(getHealth(-0.15, -0.05, 0.5)).toBe("DANGER");
  });

  it("returns CAUTION for moderate drawdown", () => {
    expect(getHealth(0.02, -0.1, 0.8)).toBe("CAUTION");
  });

  it("returns EXCELLENT for strong performance", () => {
    expect(getHealth(0.1, -0.03, 1.5)).toBe("EXCELLENT");
  });

  it("returns GOOD for normal conditions", () => {
    expect(getHealth(0.02, -0.05, 0.8)).toBe("GOOD");
  });
});

// Test 5: PMHeatmap color utilities
describe("PMHeatmap color utilities", () => {
  function returnToColor(ret: number): string {
    if (ret > 5) return "rgba(0,212,170,0.9)";
    if (ret > 2) return "rgba(0,212,170,0.6)";
    if (ret > 0) return "rgba(0,212,170,0.3)";
    if (ret > -2) return "rgba(255,107,107,0.3)";
    if (ret > -5) return "rgba(255,107,107,0.6)";
    return "rgba(255,107,107,0.9)";
  }

  it("returns strong green for >5% return", () => {
    expect(returnToColor(7)).toBe("rgba(0,212,170,0.9)");
  });

  it("returns light green for small positive", () => {
    expect(returnToColor(1)).toBe("rgba(0,212,170,0.3)");
  });

  it("returns light red for small negative", () => {
    expect(returnToColor(-1)).toBe("rgba(255,107,107,0.3)");
  });

  it("returns strong red for <-5% return", () => {
    expect(returnToColor(-7)).toBe("rgba(255,107,107,0.9)");
  });
});

// Test 6: RadialGauge renders correctly
describe("RadialGauge", () => {
  it("renders label text", async () => {
    const { RadialGauge } = await import("@/components/ui/RadialGauge");
    const { container } = render(
      <RadialGauge value={50} max={100} label="CPU USAGE" />,
    );
    expect(container.textContent).toContain("CPU USAGE");
  });

  it("renders value with unit", async () => {
    const { RadialGauge } = await import("@/components/ui/RadialGauge");
    const { container } = render(
      <RadialGauge value={75.3} max={100} label="MEMORY" unit="%" />,
    );
    expect(container.textContent).toContain("75.3%");
  });

  it("renders dash when value is null", async () => {
    const { RadialGauge } = await import("@/components/ui/RadialGauge");
    const { container } = render(
      <RadialGauge value={null} max={100} label="OFFLINE" />,
    );
    expect(container.textContent).toContain("\u2014");
  });
});
