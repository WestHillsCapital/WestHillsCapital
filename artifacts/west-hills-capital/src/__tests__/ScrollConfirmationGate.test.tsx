import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("wouter", () => ({
  useParams: () => ({ token: "test-token" }),
  useLocation: () => ["/", vi.fn()],
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("pdfjs-dist", () => {
  const mockPage = {
    getViewport: () => ({ width: 200, height: 300 }),
    render: vi.fn(() => ({ promise: Promise.resolve() })),
  };
  const mockDoc = {
    numPages: 1,
    getPage: vi.fn(async () => mockPage),
  };
  return {
    GlobalWorkerOptions: { workerSrc: "" },
    getDocument: vi.fn(() => ({ promise: Promise.resolve(mockDoc) })),
  };
});

vi.mock("@/components/MerlinCustomerChat", () => ({
  MerlinCustomerChat: () => null,
}));

vi.mock("@/components/SignaturePad", () => ({
  default: React.forwardRef(() => <canvas data-testid="sig-pad" />),
}));

global.createImageBitmap = vi.fn(async () => ({
  width: 200,
  height: 300,
  close: vi.fn(),
} as unknown as ImageBitmap));

global.URL.createObjectURL = vi.fn(() => "blob:mock-preview");
global.URL.revokeObjectURL = vi.fn();

global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof ResizeObserver;

const BASE_SESSION = {
  token: "test-token",
  package_name: "Test Package",
  custodian_name: null,
  depository_name: null,
  fields: [],
  prefill: {},
  answers: {},
  status: "active",
  require_scroll_confirmation: true,
  require_preview: false,
  auth_level: "none",
  org_brand_color: "#C49A38",
};

function makeResp(body: object): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    blob: async () => new Blob(),
    text: async () => JSON.stringify(body),
    headers: new Headers(),
    redirected: false,
    statusText: "OK",
    type: "basic",
    url: "",
    clone: function () { return this; },
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
    bytes: async () => new Uint8Array(),
    body: null,
    bodyUsed: false,
  } as unknown as Response;
}

function makeBlobResp(blob: Blob): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({}),
    blob: async () => blob,
    text: async () => "",
    headers: new Headers(),
    redirected: false,
    statusText: "OK",
    type: "basic",
    url: "",
    clone: function () { return this; },
    arrayBuffer: async () => new ArrayBuffer(0),
    formData: async () => new FormData(),
    bytes: async () => new Uint8Array(),
    body: null,
    bodyUsed: false,
  } as unknown as Response;
}

function buildFetchMock(overrides: { generateResponse?: object } = {}) {
  return vi.fn(async (url: string, opts?: RequestInit): Promise<Response> => {
    const u = String(url);
    if (u.endsWith("/test-token") && (!opts?.method || opts.method === "GET")) {
      return makeResp({ session: BASE_SESSION });
    }
    if (u.endsWith("/test-token") && opts?.method === "PATCH") {
      return makeResp({});
    }
    if (u.endsWith("/preview-pdf")) {
      const blob = new Blob(["fake-pdf"], { type: "application/pdf" });
      Object.defineProperty(blob, "arrayBuffer", {
        value: async () => new ArrayBuffer(8),
        configurable: true,
      });
      return makeBlobResp(blob);
    }
    if (u.endsWith("/scroll-confirm")) {
      return makeResp({});
    }
    if (u.endsWith("/generate")) {
      return makeResp(overrides.generateResponse ?? { status: "ok" });
    }
    return makeResp({});
  });
}

async function renderAndReachPreview() {
  const fetchMock = buildFetchMock();
  global.fetch = fetchMock as unknown as typeof fetch;

  render(
    <React.StrictMode>
      {React.createElement(
        (await import("@/pages/DocuFillCustomer")).default,
      )}
    </React.StrictMode>,
  );

  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: "Review Document" }),
    ).toBeInTheDocument();
  });

  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Review Document" }));
  });

  await waitFor(() => {
    expect(screen.getByTestId("scroll-view")).toBeInTheDocument();
  });

  return fetchMock;
}

function simulateScroll(pct: number) {
  const scrollEl = screen.getByTestId("scroll-view");
  const clientHeight = 500;
  const scrollHeight = 1000;
  const scrollTop = Math.round((pct / 100) * (scrollHeight - clientHeight));
  Object.defineProperty(scrollEl, "scrollTop", { value: scrollTop, configurable: true });
  Object.defineProperty(scrollEl, "scrollHeight", { value: scrollHeight, configurable: true });
  Object.defineProperty(scrollEl, "clientHeight", { value: clientHeight, configurable: true });
  fireEvent.scroll(scrollEl);
}

describe("Scroll confirmation gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("disables the proceed button when scroll depth is below 95%", async () => {
    await renderAndReachPreview();

    const btn = screen.getByRole("button", { name: "Scroll to end to continue" });
    expect(btn).toBeDisabled();

    await act(async () => {
      simulateScroll(50);
    });

    expect(screen.getByRole("button", { name: "Scroll to end to continue" })).toBeDisabled();
  });

  it("enables the proceed button after scrolling to 95% or more", async () => {
    await renderAndReachPreview();

    expect(
      screen.getByRole("button", { name: "Scroll to end to continue" }),
    ).toBeDisabled();

    await act(async () => {
      simulateScroll(100);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Proceed to sign" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Proceed to sign" }),
      ).not.toBeDisabled();
    });
  });

  it("sends scrollConfirmed: true in the generate request body when threshold is met", async () => {
    const fetchMock = buildFetchMock();
    global.fetch = fetchMock as unknown as typeof fetch;

    render(
      React.createElement(
        (await import("@/pages/DocuFillCustomer")).default,
      ),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Review Document" }),
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Review Document" }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("scroll-view")).toBeInTheDocument();
    });

    await act(async () => {
      simulateScroll(100);
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Proceed to sign" }),
      ).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Proceed to sign" }));
    });

    await waitFor(() => {
      const generateCall = fetchMock.mock.calls.find(([url]: [string]) =>
        String(url).endsWith("/generate"),
      );
      expect(generateCall).toBeDefined();
      const body = JSON.parse((generateCall![1] as RequestInit).body as string);
      expect(body.scrollConfirmed).toBe(true);
    });
  });
});
