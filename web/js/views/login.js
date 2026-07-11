// ============================================================================
// AnfieldVoice Web — Login View
// ============================================================================

export function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <h1>AnfieldVoice</h1>
        <p class="subtitle">Estate Management Portal</p>
        <div id="login-error" class="login-error"></div>
        <form id="login-form">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" placeholder="you@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" placeholder="••••••••" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary btn-lg" style="width:100%;margin-top:8px">Sign In</button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errEl = document.getElementById('login-error');
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.textContent = 'Signing in...';
    errEl.style.display = 'none';

    try {
      const { login } = await import('../api.js');
      await login(email, password);
      window.location.hash = '#/';
    } catch (err) {
      errEl.textContent = err.message || 'Invalid email or password';
      errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  };
}
