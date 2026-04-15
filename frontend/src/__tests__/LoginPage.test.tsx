import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { http, HttpResponse } from "msw";
import { vi } from "vitest";
import { LoginPage } from "../pages/LoginPage";
import { server } from "../test/server";
import { BASE } from "../test/handlers";

// Mock useNavigate so we can assert navigation without a real router
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockNavigate.mockClear();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

test("renders username input, password input and submit button", () => {
  renderLoginPage();
  expect(screen.getByPlaceholderText("Username")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
});

test("renders the app title", () => {
  renderLoginPage();
  expect(screen.getByText("DM Toolkit")).toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Successful login
// ---------------------------------------------------------------------------

test("stores token in localStorage and navigates to / on success", async () => {
  const user = userEvent.setup();
  renderLoginPage();

  await user.type(screen.getByPlaceholderText("Username"), "admin");
  await user.type(screen.getByPlaceholderText("Password"), "changeme");
  await user.click(screen.getByRole("button", { name: /log in/i }));

  await waitFor(() => {
    expect(localStorage.getItem("auth_token")).toBe("fake-jwt-token");
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});

test("does not show an error message on successful login", async () => {
  const user = userEvent.setup();
  renderLoginPage();

  await user.type(screen.getByPlaceholderText("Username"), "admin");
  await user.type(screen.getByPlaceholderText("Password"), "changeme");
  await user.click(screen.getByRole("button", { name: /log in/i }));

  await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  expect(
    screen.queryByText(/invalid username or password/i),
  ).not.toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Failed login
// ---------------------------------------------------------------------------

test("shows error message on wrong credentials", async () => {
  const user = userEvent.setup();
  renderLoginPage();

  await user.type(screen.getByPlaceholderText("Username"), "admin");
  await user.type(screen.getByPlaceholderText("Password"), "wrongpassword");
  await user.click(screen.getByRole("button", { name: /log in/i }));

  await waitFor(() => {
    expect(
      screen.getByText(/invalid username or password/i),
    ).toBeInTheDocument();
  });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(localStorage.getItem("auth_token")).toBeNull();
});

test("does not store a token on failed login", async () => {
  const user = userEvent.setup();
  renderLoginPage();

  await user.type(screen.getByPlaceholderText("Username"), "wrong");
  await user.type(screen.getByPlaceholderText("Password"), "wrong");
  await user.click(screen.getByRole("button", { name: /log in/i }));

  await waitFor(() =>
    expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument(),
  );
  expect(localStorage.getItem("auth_token")).toBeNull();
});

test("clears previous error on a new successful attempt", async () => {
  // Override to fail first, then succeed
  server.use(
    http.post(`${BASE}/auth/login`, async ({ request }) => {
      const body = (await request.json()) as { username: string; password: string };
      if (body.password === "changeme") {
        return HttpResponse.json({
          access_token: "fake-jwt-token",
          token_type: "bearer",
        });
      }
      return HttpResponse.json({ detail: "Invalid credentials" }, { status: 401 });
    }),
  );

  const user = userEvent.setup();
  renderLoginPage();

  // First attempt — wrong password
  await user.type(screen.getByPlaceholderText("Username"), "admin");
  await user.type(screen.getByPlaceholderText("Password"), "wrong");
  await user.click(screen.getByRole("button", { name: /log in/i }));
  await waitFor(() =>
    expect(screen.getByText(/invalid username or password/i)).toBeInTheDocument(),
  );

  // Second attempt — correct password
  await user.clear(screen.getByPlaceholderText("Password"));
  await user.type(screen.getByPlaceholderText("Password"), "changeme");
  await user.click(screen.getByRole("button", { name: /log in/i }));
  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"));

  expect(
    screen.queryByText(/invalid username or password/i),
  ).not.toBeInTheDocument();
});

// ---------------------------------------------------------------------------
// Loading state
// ---------------------------------------------------------------------------

test("disables the button and shows loading text while submitting", async () => {
  // Use a handler that never resolves so we can observe the loading state
  server.use(
    http.post(`${BASE}/auth/login`, () => {
      return new Promise(() => {
        // intentionally never resolves
      });
    }),
  );

  const user = userEvent.setup();
  renderLoginPage();

  await user.type(screen.getByPlaceholderText("Username"), "admin");
  await user.type(screen.getByPlaceholderText("Password"), "changeme");
  await user.click(screen.getByRole("button", { name: /log in/i }));

  await waitFor(() => {
    const btn = screen.getByRole("button", { name: /logging in/i });
    expect(btn).toBeDisabled();
  });
});
