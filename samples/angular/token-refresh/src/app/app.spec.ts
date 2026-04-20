import { TestBed } from "@angular/core/testing";
import { OidcSecurityService, LoginResponse } from "angular-auth-oidc-client";
import { Observable, of } from "rxjs";
import { App } from "./app";

function makeLoginResponse(overrides: Partial<LoginResponse>): LoginResponse {
  return {
    isAuthenticated: false,
    userData: null,
    accessToken: "",
    idToken: "",
    configId: "",
    ...overrides,
  } as LoginResponse;
}

describe("App", () => {
  let checkAuthFn: () => Observable<LoginResponse>;
  let forceRefreshSessionFn: () => Observable<LoginResponse>;

  const mockOidcService = {
    get checkAuth() {
      return checkAuthFn;
    },
    get forceRefreshSession() {
      return forceRefreshSessionFn;
    },
    authorize: vi.fn(),
    logoff: vi.fn(() => of(null)),
  };

  beforeEach(async () => {
    checkAuthFn = () => of(makeLoginResponse({ isAuthenticated: false, userData: null }));
    forceRefreshSessionFn = () => of(makeLoginResponse({ isAuthenticated: false, userData: null }));
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .overrideProvider(OidcSecurityService, { useValue: mockOidcService })
      .compileComponents();
  });

  it("should render sign in button when not authenticated", async () => {
    checkAuthFn = () => of(makeLoginResponse({ isAuthenticated: false, userData: null }));
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector("button")?.textContent).toContain("Sign in");
  });

  it("should display token expiry and refresh button when authenticated", async () => {
    checkAuthFn = () =>
      of(
        makeLoginResponse({
          isAuthenticated: true,
          userData: { given_name: "Jane" },
          accessToken: "",
        }),
      );
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain("Jane");
    expect(compiled.textContent).toContain("Token expires at:");
    expect(compiled.querySelector("button")?.textContent).toContain("Refresh token now");
  });

  it("should call forceRefreshSession on refresh button click", async () => {
    const forceRefreshSpy = vi.fn(() =>
      of(makeLoginResponse({ isAuthenticated: true, userData: { given_name: "Jane" } })),
    );
    forceRefreshSessionFn = forceRefreshSpy;
    checkAuthFn = () =>
      of(
        makeLoginResponse({
          isAuthenticated: true,
          userData: { given_name: "Jane" },
          accessToken: "",
        }),
      );
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector("button");
    button.click();
    expect(forceRefreshSpy).toHaveBeenCalled();
  });

  it("should render error message on auth failure", async () => {
    // Simulate OAuth error in URL query params
    Object.defineProperty(window, "location", {
      value: { search: "?error=access_denied&error_description=User+denied+access" },
      writable: true,
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain("User denied access");
    // Reset location
    Object.defineProperty(window, "location", {
      value: { search: "" },
      writable: true,
    });
  });
});
