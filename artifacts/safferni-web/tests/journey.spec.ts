import { test, expect, type Page, type Route } from "@playwright/test";

const user = {
  user: {
    id: "fixture-user",
    email: "traveler@example.com",
    firstName: "Ari",
    lastName: "North",
    profileImageUrl: null,
  },
};

const draft = {
  origin: "YUL",
  destinationCode: "CDG",
  destinationName: "Paris",
  departureDate: "2026-09-01",
  returnDate: "2026-09-08",
  oneWay: false,
  adults: 1,
  children: 0,
  currency: "USD",
  styles: ["food"],
};

const flight = {
  id: "flight-fixture-001",
  provider: "fixture",
  validatingAirline: "Nuitée Air",
  cabinClass: "economy",
  totalPrice: 547,
  currency: "USD",
  totalStops: 0,
  outbound: {
    durationMinutes: 459,
    segments: [{
      departureAirport: "YUL",
      arrivalAirport: "CDG",
      departureTime: "2026-09-01T13:50:00Z",
      arrivalTime: "2026-09-01T21:29:00Z",
    }],
  },
  baggage: { cabin: "1 cabin bag" },
  lastUpdatedAt: "2026-08-24T00:00:00Z",
};

const room = {
  id: "room-fixture-001",
  name: "Classic Room",
  description: "A calm room for a Paris reset.",
  totalPrice: 2100,
  currency: "USD",
  maxOccupancy: 2,
  bedTypes: ["Queen"],
  refundable: true,
  images: [],
};

const hotel = {
  id: "hotel-fixture-001",
  name: "Hotel Lutetia",
  starRating: 5,
  guestRating: 9.2,
  address: "45 Boulevard Raspail, Paris",
  totalPrice: 2100,
  currency: "USD",
  images: [],
  roomOptions: [room],
};

const searchResult = { source: "fixture", flights: [flight], hotels: [hotel] };

async function mockApi(page: Page, options: { auth?: boolean; bookingStatus?: "booked" | "booking_failed" } = {}) {
  const auth = options.auth ?? true;
  await page.route("**/api/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;

    if (path.endsWith("/auth/user")) {
      await route.fulfill({ json: auth ? user : { user: null } });
    } else if (path.endsWith("/planner/chat")) {
      await route.fulfill({
        json: {
          reply: "Paris, with a table worth travelling for.",
          draft: { ...draft, readyToSearch: true },
          readyToSearch: true,
          quickReplies: [],
        },
      });
    } else if (path.endsWith("/search")) {
      await route.fulfill({ json: searchResult });
    } else if (path.endsWith("/hotels/hotel-fixture-001/detail")) {
      await route.fulfill({ json: { ...hotel, description: "A grand hotel on the Left Bank." } });
    } else if (path.endsWith("/bookings") && route.request().method() === "POST") {
      await route.fulfill({ json: { bookingId: "booking-fixture-001", accessToken: "fixture-token", status: "booking_pending" } });
    } else if (path.endsWith("/bookings/booking-fixture-001")) {
      await route.fulfill({
        json: {
          id: "booking-fixture-001",
          status: options.bookingStatus ?? "booked",
          amountCents: 264700,
          currency: "USD",
          contactEmail: "traveler@example.com",
          destinationName: "Paris",
          departureDate: draft.departureDate,
          flightConfirmed: options.bookingStatus === "booking_failed" || options.bookingStatus === "booked",
          hotelConfirmed: options.bookingStatus === "booked",
          flightReference: options.bookingStatus === "booking_failed" ? "FL-123" : options.bookingStatus === "booked" ? "FL-123" : undefined,
          hotelReference: options.bookingStatus === "booked" ? "HT-456" : undefined,
          errorMessage: options.bookingStatus === "booking_failed" ? "The supplier could not confirm the room." : undefined,
          createdAt: "2026-08-24T00:00:00Z",
        },
      });
    } else if (path.endsWith("/logout")) {
      await route.fulfill({ status: 200, body: "signed out" });
    } else {
      await route.fulfill({ status: 200, json: {} });
    }
  });
}

test.describe("sign-in and protected routes", () => {
  test("redirects signed-out travelers to sign-in and preserves the return path", async ({ page }) => {
    await mockApi(page, { auth: false });
    await page.goto("planner?from=protected");

    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
    const signIn = page.getByTestId("link-sign-in");
    await expect(signIn).toHaveAttribute("href", /\/api\/login\?returnTo=%2Fsafferni-web%2Fplanner%3Ffrom%3Dprotected/);
  });

  test("signed-in travelers can sign out and the profile starts the OIDC logout", async ({ page }) => {
    await mockApi(page);
    await page.goto("profile");
    await expect(page.getByTestId("text-profile-name")).toHaveText("Ari");

    const logout = page.waitForRequest((request) => request.url().includes("/api/logout?returnTo="));
    await page.getByTestId("button-log-out").click();
    await logout;
  });
});

test.describe("fixture-backed booking journey", () => {
  test("searches, selects a flight, opens a stay and room, then renders confirmation", async ({ page }) => {
    await mockApi(page);
    await page.goto("planner");
    await page.getByTestId("button-quick-reply-a-long-weekend-by-the-sea").click();
    await expect(page.getByText("Paris, with a table worth travelling for.")).toBeVisible();
    await page.getByTestId("button-find-trip-options").click();

    await expect(page.getByTestId("card-flight-offer-flight-fixture-001")).toBeVisible();
    await page.getByTestId("button-select-flight-flight-fixture-001").click();
    await expect(page.getByTestId("button-select-flight-flight-fixture-001")).toContainText("Flight selected");
    await page.getByTestId("link-view-hotel-hotel-fixture-001").click();
    await expect(page.getByRole("heading", { name: "Hotel Lutetia" })).toBeVisible();
    await page.getByTestId("link-room-detail-room-fixture-001").click();
    await expect(page.getByRole("heading", { name: "Classic Room" })).toBeVisible();

    await page.getByTestId("input-booking-first-name").fill("Ari");
    await page.getByTestId("input-booking-last-name").fill("North");
    await page.getByTestId("input-booking-email").fill("traveler@example.com");
    await page.getByTestId("button-create-booking").click();
    await expect(page).toHaveURL(/\/booking\/booking-fixture-001$/);
    await expect(page.getByTestId("card-booking-status")).toContainText("Your trip is confirmed.");
    await expect(page.getByTestId("text-booking-destination")).toHaveText("Paris");
  });

  test("renders supplier failure and partial confirmation states", async ({ page }) => {
    await mockApi(page, { bookingStatus: "booking_failed" });
    await page.goto("booking/booking-fixture-001");
    await expect(page.getByTestId("card-booking-status")).toContainText("A little turbulence.");
    await expect(page.getByTestId("card-booking-status")).toContainText("The supplier could not confirm the room.");
    await expect(page.getByTestId("card-booking-status")).toContainText("Supplier confirmation");

    await expect(page.getByText("FL-123")).toBeVisible();
  });
});