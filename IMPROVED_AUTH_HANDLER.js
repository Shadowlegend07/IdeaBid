/**
 * Enhanced Authentication Handler
 * Provides detailed error messages and API connectivity diagnostics
 * 
 * Usage: Replace the submitAuth function in web/app.js with this improved version
 */

// Add this near the top of app.js after API_URL definition
async function checkApiConnectivity() {
  try {
    const response = await fetch(`${API_URL}/docs`, {
      method: 'HEAD',
      cache: 'no-store'
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function submitAuthImproved(event) {
  event.preventDefault();
  
  const form = event.currentTarget;
  const formData = Object.fromEntries(new FormData(form));
  const button = form.querySelector('#authSubmit');
  
  // Validate form data
  if (!formData.email || !formData.password) {
    showToast('Please fill in all required fields.');
    return;
  }
  
  if (authMode === 'signup' && !formData.name) {
    showToast('Name is required for signup.');
    return;
  }
  
  // Check API connectivity first
  if (!API_URL) {
    showToast('❌ API URL not configured. Check AUTH_SETUP_GUIDE.md');
    return;
  }
  
  button.disabled = true;
  button.textContent = authMode === 'signup' ? '⏳ Creating account…' : '⏳ Signing in…';
  
  try {
    // Check if API is reachable
    const isConnected = await checkApiConnectivity();
    if (!isConnected) {
      throw new Error(
        `❌ Cannot connect to API at ${API_URL}. ` +
        `Make sure the backend server is running on port 4000. ` +
        `Run: npm run start:dev in api/ folder`
      );
    }
    
    const endpoint = authMode === 'signup' ? '/v1/auth/signup' : '/v1/auth/signin';
    
    // Generate auto username for signup if needed
    const username = authMode === 'signup'
      ? (String(formData.email).split('@')[0] || 'user')
          .replace(/[^a-z0-9_]/gi, '')
          .toLowerCase() + '_' + Math.random().toString(36).slice(2, 7)
      : undefined;
    
    const payload = authMode === 'signup'
      ? {
          email: formData.email,
          name: formData.name,
          password: formData.password,
          username: username
        }
      : {
          email: formData.email,
          password: formData.password
        };
    
    console.log(`📤 ${authMode === 'signup' ? 'Signup' : 'Signin'} request to ${API_URL}${endpoint}`, {
      email: payload.email,
      hasPassword: !!payload.password,
      timestamp: new Date().toISOString()
    });
    
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      mode: 'cors',
      credentials: 'omit'
    });
    
    const result = await response.json();
    
    console.log(`📥 Response status: ${response.status}`, {
      hasAccessToken: !!result.accessToken,
      hasUser: !!result.user,
      timestamp: new Date().toISOString()
    });
    
    if (!response.ok) {
      // Handle specific error messages
      if (response.status === 400) {
        throw new Error(
          result.message || 
          (authMode === 'signup' 
            ? 'Email or username already in use. Try another email.'
            : 'Invalid email or password.')
        );
      }
      
      if (response.status === 401) {
        throw new Error(result.message || 'Unauthorized. Check your credentials.');
      }
      
      if (response.status === 403) {
        throw new Error(result.message || 'Access forbidden. Contact support.');
      }
      
      if (response.status === 500) {
        throw new Error('Server error. The backend may be experiencing issues.');
      }
      
      throw new Error(result.message || `Authentication failed (${response.status})`);
    }
    
    // Validate response structure
    if (!result.accessToken || !result.refreshToken || !result.user) {
      throw new Error('Invalid server response. Missing authentication tokens.');
    }
    
    // Save tokens and user info
    localStorage.setItem('ideabid-access-token', result.accessToken);
    localStorage.setItem('ideabid-refresh-token', result.refreshToken);
    localStorage.setItem('ideabid-user', JSON.stringify(result.user));
    
    console.log('✅ Authentication successful', {
      userId: result.user?.id,
      email: result.user?.email,
      timestamp: new Date().toISOString()
    });
    
    // Close modal and show success
    closeDialog(document.querySelector('#authModal'));
    showToast(
      authMode === 'signup'
        ? '✅ Account created successfully. Welcome to IdeaBid!'
        : '✅ Signed in successfully. Welcome back!'
    );
    
    setAuthMode('login');
    form.reset();
    
  } catch (error) {
    console.error('❌ Authentication error:', {
      message: error.message,
      authMode: authMode,
      apiUrl: API_URL,
      timestamp: new Date().toISOString()
    });
    
    // Provide actionable error messages
    let userMessage = error.message;
    
    if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
      userMessage = `❌ Cannot reach API at ${API_URL}. ` +
        `Is the backend server running? ` +
        `Try: npm run start:dev in api/ folder`;
    }
    
    if (error.message.includes('NetworkError') || error.message.includes('Network request failed')) {
      userMessage = `❌ Network error. Check if:\n` +
        `1. Backend is running on ${API_URL}\n` +
        `2. Firewall is not blocking port 4000\n` +
        `3. CORS is properly configured`;
    }
    
    showToast(userMessage);
    
  } finally {
    button.disabled = false;
    button.textContent = authMode === 'signup' ? 'Create account' : 'Log in';
  }
}

/**
 * Replace the original submitAuth function with submitAuthImproved
 * In the event listeners section at the bottom of app.js, change:
 * 
 * FROM:
 * document.querySelector('#authForm').addEventListener('submit', submitAuth);
 * 
 * TO:
 * document.querySelector('#authForm').addEventListener('submit', submitAuthImproved);
 */

// Also add API health check on page load
async function checkApiHealth() {
  try {
    const health = await checkApiConnectivity();
    const statusEl = document.querySelector('#api-status');
    if (statusEl) {
      statusEl.textContent = health ? '✅ API Connected' : '❌ API Disconnected';
      statusEl.style.color = health ? 'green' : 'red';
    }
    console.log(`API Health: ${health ? 'CONNECTED' : 'DISCONNECTED'} (${API_URL})`);
  } catch (error) {
    console.error('Health check failed:', error);
  }
}

// Call on page load
document.addEventListener('DOMContentLoaded', () => {
  checkApiHealth();
  // Check again every 30 seconds
  setInterval(checkApiHealth, 30000);
});
