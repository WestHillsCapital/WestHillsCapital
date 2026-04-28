import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("recharts", () => ({
  ComposedChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="composed-chart">{children}</div>
  ),
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
}));

const mockUseSpotHistory = vi.fn();
vi.mock("@/hooks/use-pricing", () => ({
  useSpotHistory: (...args: unknown[]) => mockUseSpotHistory(...args),
}));

import SpotChart from "@/pages/SpotChart";

const LOADED_DATA = {
  history: [
    { timestamp: "2024-01-01T00:00:00Z", goldBid: 2000, silverBid: 25 },
    { timestamp: "2024-01-02T00:00:00Z", goldBid: 2010, silverBid: 25.5 },
    { timestamp: "2024-01-03T00:00:00Z", goldBid: 2020, silverBid: 26 },
  ],
};

function makeQueryResult(overrides: {
  data?: typeof LOADED_DATA | null;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
}) {
  return {
    data: overrides.data ?? LOADED_DATA,
    isLoading: overrides.isLoading ?? false,
    isFetching: overrides.isFetching ?? false,
    isError: overrides.isError ?? false,
  };
}

function getSkeletonOverlay(): HTMLElement {
  return screen.getByTestId("chart-skeleton-overlay");
}

function getChartContent(): HTMLElement {
  return screen.getByTestId("chart-content");
}

describe("SpotChart loading-state regression tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows skeleton overlay with full opacity when isLoading is true", () => {
    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: true, isFetching: true, data: null }),
    );

    render(<SpotChart />);

    const skeleton = getSkeletonOverlay();
    expect(skeleton).toHaveStyle({ opacity: "1" });

    const content = getChartContent();
    expect(content).toHaveStyle({ opacity: "0" });
  });

  it("hides skeleton and shows chart after initial data load", async () => {
    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: false }),
    );

    render(<SpotChart />);

    const skeleton = getSkeletonOverlay();
    expect(skeleton).toHaveStyle({ opacity: "0" });

    const content = getChartContent();
    expect(content).toHaveStyle({ opacity: "1" });
  });

  it("shows skeleton when a period button is clicked (isPeriodSwitching becomes true)", async () => {
    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: false }),
    );

    render(<SpotChart />);

    expect(getChartContent()).toHaveStyle({ opacity: "1" });

    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: true }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "1W" }));
    });

    expect(getSkeletonOverlay()).toHaveStyle({ opacity: "1" });
    expect(getChartContent()).toHaveStyle({ opacity: "0" });
  });

  it("skeleton stays visible while rapidly clicking multiple period buttons", async () => {
    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: false }),
    );

    render(<SpotChart />);

    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: true }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "1W" }));
    });

    expect(getSkeletonOverlay()).toHaveStyle({ opacity: "1" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "3M" }));
    });

    expect(getSkeletonOverlay()).toHaveStyle({ opacity: "1" });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "1Y" }));
    });

    expect(getSkeletonOverlay()).toHaveStyle({ opacity: "1" });
    expect(getChartContent()).toHaveStyle({ opacity: "0" });
  });

  it("clears skeleton only after the final fetch settles", async () => {
    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: false }),
    );

    const { rerender } = render(<SpotChart />);

    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: true }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "3M" }));
    });

    expect(getSkeletonOverlay()).toHaveStyle({ opacity: "1" });

    rerender(<SpotChart />);
    expect(getSkeletonOverlay()).toHaveStyle({ opacity: "1" });

    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: false }),
    );

    await act(async () => {
      rerender(<SpotChart />);
    });

    await waitFor(() => {
      expect(getSkeletonOverlay()).toHaveStyle({ opacity: "0" });
      expect(getChartContent()).toHaveStyle({ opacity: "1" });
    });
  });

  it("shows skeleton through multiple rapid switches and clears only after final settle", async () => {
    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: false }),
    );

    const { rerender } = render(<SpotChart />);

    const periods = ["1W", "1M", "3M", "6M", "1Y"];

    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: true }),
    );

    for (const period of periods) {
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: period }));
      });
      expect(getSkeletonOverlay()).toHaveStyle({ opacity: "1" });
    }

    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: false }),
    );

    await act(async () => {
      rerender(<SpotChart />);
    });

    await waitFor(() => {
      expect(getSkeletonOverlay()).toHaveStyle({ opacity: "0" });
      expect(getChartContent()).toHaveStyle({ opacity: "1" });
    });
  });

  it("renders chart with gold and silver data after loading", async () => {
    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: false }),
    );

    render(<SpotChart />);

    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
    expect(screen.getByTestId("composed-chart")).toBeInTheDocument();

    expect(getChartContent()).toHaveStyle({ opacity: "1" });
  });

  it("shows error state when fetch fails and chart is not loading", () => {
    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isError: true, data: undefined, isLoading: false, isFetching: false }),
    );

    render(<SpotChart />);

    expect(
      screen.getByText("Price history is temporarily unavailable."),
    ).toBeInTheDocument();
  });

  it("active period button has highlighted style, others do not", () => {
    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: false }),
    );

    render(<SpotChart />);

    const activeBtn = screen.getByRole("button", { name: "1M" });
    expect(activeBtn).toHaveClass("bg-foreground");

    const inactiveBtn = screen.getByRole("button", { name: "1W" });
    expect(inactiveBtn).not.toHaveClass("bg-foreground");
  });

  it("active period button updates when a new period is selected", async () => {
    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: false }),
    );

    render(<SpotChart />);

    expect(screen.getByRole("button", { name: "1M" })).toHaveClass("bg-foreground");

    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: true }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "1Y" }));
    });

    expect(screen.getByRole("button", { name: "1Y" })).toHaveClass("bg-foreground");
    expect(screen.getByRole("button", { name: "1M" })).not.toHaveClass("bg-foreground");
  });

  it("useSpotHistory is called with the selected period", async () => {
    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: false }),
    );

    render(<SpotChart />);

    expect(mockUseSpotHistory).toHaveBeenCalledWith("1M");

    mockUseSpotHistory.mockReturnValue(
      makeQueryResult({ isLoading: false, isFetching: false }),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "5Y" }));
    });

    expect(mockUseSpotHistory).toHaveBeenCalledWith("5Y");
  });
});
