// @snippet:step3:start
// @description Add login and logout buttons that redirect to SecureAuth
import { Component, inject, OnInit, signal } from "@angular/core";
import { OidcSecurityService } from "angular-auth-oidc-client";

@Component({
  selector: "app-root",
  standalone: true,
  template: `
    <h1>SecureAuth Angular PKCE Demo</h1>
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
      <p>
        Welcome, {{ userData()?.given_name }} {{ userData()?.family_name }} ({{
          userData()?.email
        }})
      </p>
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
        this.isAuthenticated.set(response.isAuthenticated);
        this.userData.set(response.userData);
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

  logout() {
    this.auth.logoff().subscribe({
      error: (err) => console.error("logoff error:", err),
    });
  }
}
// @snippet:step3:end
