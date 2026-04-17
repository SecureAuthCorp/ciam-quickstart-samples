// @snippet:step3:start
// @description Display token status and trigger manual refresh
import { Component, inject, OnInit, signal } from "@angular/core";
import { OidcSecurityService } from "angular-auth-oidc-client";

@Component({
  selector: "app-root",
  standalone: true,
  template: `
    <h1>SecureAuth Token Refresh Demo</h1>
    @if (isLoading()) {
      <p>Loading...</p>
    } @else if (errorMessage()) {
      <div style="color: red">
        <p>Error: {{ errorMessage() }}</p>
        @if (errorHint()) {
          <p>{{ errorHint() }}</p>
        }
        <button (click)="login()">Try again</button>
      </div>
    } @else if (isAuthenticated()) {
      <p>Welcome, {{ userData()?.given_name }}</p>
      <p>Token expires at: {{ tokenExpiry() }}</p>
      <button (click)="refresh()">Refresh token now</button>
      <br />
      <br />
      <button (click)="logout()">Sign out</button>
    } @else {
      <button (click)="login()">Sign in</button>
    }
  `,
})
export class App implements OnInit {
  private auth = inject(OidcSecurityService);

  isLoading = signal(true);
  isAuthenticated = signal(false);
  userData = signal<any>(null);
  tokenExpiry = signal("unknown");
  errorMessage = signal("");
  errorHint = signal("");

  ngOnInit() {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) {
      this.isLoading.set(false);
      this.errorMessage.set(params.get("error_description") || error);
      this.errorHint.set(params.get("error_hint") || "");
      return;
    }

    this.auth.checkAuth().subscribe({
      next: (response) => {
        this.updateFromResponse(response);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error("checkAuth error:", err);
        this.errorMessage.set(err?.message || "Authentication failed");
        this.isLoading.set(false);
      },
    });
  }

  login() {
    this.auth.authorize();
  }

  refresh() {
    this.auth.forceRefreshSession().subscribe({
      next: (response) => this.updateFromResponse(response),
      error: (err) => console.error("refresh error:", err),
    });
  }

  logout() {
    this.auth.logoff().subscribe({
      error: (err) => console.error("logoff error:", err),
    });
  }

  private updateFromResponse(response: {
    isAuthenticated: boolean;
    userData: any;
    accessToken?: string;
  }) {
    this.isAuthenticated.set(response.isAuthenticated);
    this.userData.set(response.userData);
    if (response.isAuthenticated && response.accessToken) {
      try {
        const payload = JSON.parse(atob(response.accessToken.split(".")[1]));
        if (payload.exp) {
          this.tokenExpiry.set(new Date(payload.exp * 1000).toLocaleTimeString());
        }
      } catch {
        // ignore parse errors
      }
    }
  }
}
// @snippet:step3:end
