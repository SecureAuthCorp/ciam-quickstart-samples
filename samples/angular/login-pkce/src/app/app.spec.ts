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

  const mockOidcService = {
    get checkAuth() {
      return checkAuthFn;
    },
    authorize: vi.fn(),
    logoff: vi.fn(() => of(null)),
  };

  beforeEach(async () => {
    checkAuthFn = () => of(makeLoginResponse({ isAuthenticated: false, userData: null }));
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

  it("should display user info when authenticated", async () => {
    checkAuthFn = () =>
      of(
        makeLoginResponse({
          isAuthenticated: true,
          userData: { given_name: "Jane", family_name: "Doe", email: "jane@example.com" },
        }),
      );
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain("Jane");
    expect(compiled.textContent).toContain("Doe");
  });

  it("should call authorize on sign in click", async () => {
    checkAuthFn = () => of(makeLoginResponse({ isAuthenticated: false, userData: null }));
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector("button");
    button.click();
    expect(mockOidcService.authorize).toHaveBeenCalled();
  });
});
