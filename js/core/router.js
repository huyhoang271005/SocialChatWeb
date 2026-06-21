/**
 * Dynamic Stylesheet Loader Utility
 */
export function loadModuleStyle(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

class Router {
  constructor() {
    this.currentView = null;
    this.currentHash = null;
    this.routes = {
      'login': {
        modulePath: '../../modules/auth/login/login.js',
        stylePath: 'modules/auth/login/login.css'
      },
      'roles': {
        modulePath: '../../modules/roles/roles.js',
        stylePath: 'modules/roles/roles.css'
      },
      'register': {
        modulePath: '../../modules/auth/register/register.js',
        stylePath: 'modules/auth/register/register.css'
      },
      'home': {
        modulePath: '../../modules/chat/home/home.js',
        stylePath: 'modules/chat/home/home.css'
      },
      'verify': {
        modulePath: '../../modules/auth/verify/verify.js',
        stylePath: 'modules/auth/verify/verify.css'
      },
      'reset-password': {
        modulePath: '../../modules/auth/reset-password/reset-password.js',
        stylePath: 'modules/auth/reset-password/reset-password.css'
      },
      'profile': {
        modulePath: '../../modules/profile/profile.js',
        stylePath: 'modules/profile/profile.css'
      },
      'users': {
        modulePath: '../../modules/users/users.js',
        stylePath: 'modules/users/users.css'
      },
      'sessions': {
        modulePath: '../../modules/sessions/sessions.js',
        stylePath: 'modules/sessions/sessions.css'
      }
    };

    window.addEventListener('hashchange', () => this.handleRouting());
    window.addEventListener('DOMContentLoaded', () => this.handleRouting());

    this.visualViewportResizeListener = null;
    this.visualViewportScrollListener = null;
    this.windowScrollListener = null;
  }

  navigate(route) {
    window.location.hash = `#${route}`;
  }

  async handleRouting() {
    const hash = window.location.hash.substring(1) || '';
    if (hash === this.currentHash) {
      return;
    }

    // Parse route name and query parameters
    const hashParts = hash.split('?');
    const routeName = hashParts[0];
    const queryString = hashParts[1] || '';

    const queryParams = {};
    if (queryString) {
      const pairs = queryString.split('&');
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key) {
          queryParams[decodeURIComponent(key)] = decodeURIComponent(value || '');
        }
      }
    }

    const previousRouteName = this.currentRouteName;
    this.currentRouteName = routeName;
    this.currentHash = hash;

    if (this.currentView && previousRouteName === routeName) {
      // If the route name hasn't changed, we can just update the view with new query parameters
      if (typeof this.currentView.onRouteUpdate === 'function') {
        this.currentView.onRouteUpdate(queryParams);
        return;
      }
    }

    // Call cleanup of current view if exists
    if (this.currentView && typeof this.currentView.cleanup === 'function') {
      try {
        this.currentView.cleanup();
      } catch (e) {
        console.warn('Failed to cleanup current view:', e);
      }
    }
    this.currentView = null;


    // Simple session guard using routeName instead of full hash
    let token = sessionStorage.getItem('chat_access_token');
    const profileCompleted = localStorage.getItem('chat_profile_completed') === 'true';

    // Silent token refresh if no token in session but remember me is active
    if (!token && localStorage.getItem('chat_remember_me') === 'true') {
      try {
        const { api } = await import('./api.js');
        const refreshResponse = await api.get('auth/refresh-token');
        if (refreshResponse) {
          token = (refreshResponse.data && (refreshResponse.data.accessToken || refreshResponse.data.token)) ||
            refreshResponse.accessToken || refreshResponse.token;
          const firebaseToken = (refreshResponse.data && refreshResponse.data.firebaseToken) || refreshResponse.firebaseToken;
          const userId = (refreshResponse.data && refreshResponse.data.userId) || refreshResponse.userId;
          if (token) {
            sessionStorage.setItem('chat_access_token', token);
            sessionStorage.setItem('chat_auth_token', token);
          }
          if (firebaseToken) {
            sessionStorage.setItem('chat_firebase_token', firebaseToken);
          }
          if (userId) {
            localStorage.setItem('chat_user_id', userId);
          }
        }
      } catch (err) {
        console.warn('Silent token refresh failed, clearing remember me:', err);
        localStorage.removeItem('chat_remember_me');
      }
    }

    // Đóng kết nối socket nếu đang ở trang công khai hoặc token không hợp lệ
    const publicRoutes = ['login', 'register', 'verify', 'reset-password'];
    if (publicRoutes.includes(routeName) || !token || token === 'null' || token === 'undefined') {
      try {
        const { socket } = await import('./websocket.js');
        socket.disconnect();
      } catch (e) {
        console.warn('[Router] Không thể ngắt kết nối WebSocket:', e);
      }
    }

    if (token) {
      if (profileCompleted) {
        if (routeName === 'login' || routeName === 'register' || routeName === '') {
          this.navigate('home');
          return;
        }
      } else {
        // Token exists but profile is not completed
        if (routeName === 'login') {
          sessionStorage.removeItem('chat_access_token');
          sessionStorage.removeItem('chat_auth_token');
          sessionStorage.removeItem('chat_user_id');
          token = null;
        } else if (routeName !== 'register') {
          this.navigate('register');
          return;
        }
      }
    } else {
      if (routeName === 'home' || routeName === '') {
        this.navigate('login');
        return;
      }
    }
    const isPublic = publicRoutes.includes(routeName);

    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    if (isPublic) {
      this.cleanupViewportHeightSync();
      // Remove layout structure if navigating to a public route
      appContainer.innerHTML = '';
      appContainer.className = '';

      const routeConfig = this.routes[routeName] || this.routes['login'];
      try {
        loadModuleStyle(routeConfig.stylePath);
        const viewModule = await import(routeConfig.modulePath);
        const view = viewModule.default || viewModule[Object.keys(viewModule)[0]];
        this.currentView = view;
        appContainer.innerHTML = view.render();
        view.init(this, queryParams);
      } catch (error) {
        this.renderError(appContainer, error, hash);
      }
    } else {
      // Authenticated/private route -> render master sidebar layout
      const routeConfig = this.routes[routeName] || this.routes['home'];
      try {
        loadModuleStyle(routeConfig.stylePath);
        const viewModule = await import(routeConfig.modulePath);
        const view = viewModule.default || viewModule[Object.keys(viewModule)[0]];
        this.currentView = view;

        let contentMount = document.getElementById('main-content-mount');
        if (!contentMount) {
          appContainer.innerHTML = `
            <div class="app-layout">
              <aside class="nav-sidebar">
                <div class="nav-logo" title="ChatApp">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                
                <nav class="nav-menu">
                  <a href="#home" class="nav-item" id="nav-item-home" title="Trò chuyện">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                  </a>
                  
                  <a href="#profile" class="nav-item" id="nav-item-profile" title="Trang cá nhân">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                  </a>
                  
                  <a href="#roles" class="nav-item" id="nav-item-roles" title="Quản lý Vai trò">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    </svg>
                  </a>
                  
                  <a href="#users" class="nav-item" id="nav-item-users" title="Quản lý Người dùng">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                  </a>
                  
                  <a href="#sessions" class="nav-item" id="nav-item-sessions" title="Phiên đăng nhập">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                  </a>
                </nav>
                
                <div class="nav-footer">
                  <button id="nav-btn-notifications" class="nav-notification-btn" title="Đang tải...">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-bell-icon disabled">
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                      <path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path>
                      <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path>
                      <path d="M18 8a6 6 0 0 0-9.33-5"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  </button>

                  <button id="nav-btn-logout" class="nav-logout-btn" title="Đăng xuất">
                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                  </button>
                </div>
              </aside>
              
              <main class="main-content-panel" id="main-content-mount"></main>
            </div>
          `;
          contentMount = document.getElementById('main-content-mount');
          this.bindSidebarEvents();
          this.setupViewportHeightSync();
        }

        // Highlight active navbar tab icon
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => item.classList.remove('active'));
        const activeNav = document.getElementById(`nav-item-${routeName}`);
        if (activeNav) {
          activeNav.classList.add('active');
        }

        // Render target page html
        contentMount.innerHTML = view.render();
        view.init(this, queryParams);

      } catch (error) {
        const mount = document.getElementById('main-content-mount') || appContainer;
        this.renderError(mount, error, hash);
      }
    }
  }

  async bindSidebarEvents() {
    const logoutBtn = document.getElementById('nav-btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        const { showDialog } = await import('../shared/dialog/dialog.js');
        const confirm = await showDialog({
          title: 'Đăng xuất',
          message: 'Bạn có chắc chắn muốn đăng xuất khỏi hệ thống?',
          type: 'warning',
          buttons: [
            { text: 'Hủy', type: 'secondary', value: false },
            { text: 'Đăng xuất', type: 'danger', value: true }
          ]
        });

        if (confirm) {
          try {
            const { socket } = await import('./websocket.js');
            socket.disconnect();
          } catch (e) {
            console.warn('[Router] Không thể ngắt kết nối WebSocket:', e);
          }
          localStorage.clear();
          sessionStorage.clear();
          this.navigate('login');
        }
      });
    }

    const notificationBtn = document.getElementById('nav-btn-notifications');
    if (notificationBtn) {
      try {
        const { api } = await import('./api.js');

        const updateUI = (enabled) => {
          if (enabled) {
            notificationBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-bell-icon enabled">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            `;
            notificationBtn.title = 'Tắt thông báo ứng dụng';
          } else {
            notificationBtn.innerHTML = `
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="nav-bell-icon disabled">
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                <path d="M18.63 13A17.89 17.89 0 0 1 18 8"></path>
                <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"></path>
                <path d="M18 8a6 6 0 0 0-9.33-5"></path>
                <line x1="1" y1="1" x2="23" y2="23"></line>
              </svg>
            `;
            notificationBtn.title = 'Bật thông báo ứng dụng';
          }
        };

        // Fetch initial status
        api.get('notifications/status')
          .then(res => {
            if (res && res.success) {
              updateUI(res.data === true);
            } else {
              updateUI(false);
            }
          })
          .catch(err => {
            console.warn('Failed to load initial notification status:', err);
            updateUI(false);
          });

        notificationBtn.addEventListener('click', async () => {
          const bellIcon = notificationBtn.querySelector('.nav-bell-icon');
          const isEnabled = bellIcon && bellIcon.classList.contains('enabled');
          const actionText = isEnabled ? 'tắt' : 'bật';

          const { showDialog } = await import('../shared/dialog/dialog.js');
          const confirm = await showDialog({
            title: isEnabled ? 'Tắt thông báo' : 'Bật thông báo',
            message: `Bạn có chắc chắn muốn ${actionText} thông báo ứng dụng?`,
            type: 'info',
            buttons: [
              { text: 'Hủy', type: 'secondary', value: false },
              { text: isEnabled ? 'Tắt' : 'Bật', type: isEnabled ? 'danger' : 'primary', value: true }
            ]
          });

          if (!confirm) return;

          const endpoint = isEnabled ? 'notifications/disable' : 'notifications/enable';

          let firebaseToken = sessionStorage.getItem('chat_firebase_token');
          if (!firebaseToken) {
            try {
              const { getCurrentFirebaseToken } = await import('./firebase.js');
              firebaseToken = await getCurrentFirebaseToken();
              if (firebaseToken) {
                sessionStorage.setItem('chat_firebase_token', firebaseToken);
              }
            } catch (err) {
              console.warn('Could not retrieve firebaseToken from Firebase Auth:', err);
            }
          }

          const payload = { firebaseToken: firebaseToken || '' };

          if (!isEnabled) {
            try {
              const { getFCMToken } = await import('./firebase.js');
              const fcmToken = await getFCMToken();
              if (fcmToken) {
                payload.fcmToken = fcmToken;
              }
            } catch (err) {
              console.error('Error getting fcmToken:', err);
            }
          }

          try {
            const res = await api.post(endpoint, payload);
            if (res && res.success) {
              updateUI(!isEnabled);
              await showDialog({
                title: 'Thành công',
                message: `Đã ${isEnabled ? 'tắt' : 'bật'} thông báo ứng dụng thành công!`,
                type: 'success'
              });
            } else {
              const errMsg = res?.message || 'Không thể thay đổi trạng thái thông báo.';
              await showDialog({
                title: 'Lỗi',
                message: errMsg,
                type: 'error'
              });
            }
          } catch (err) {
            console.error('Error changing notification status:', err);
            await showDialog({
              title: 'Lỗi kết nối',
              message: 'Đã xảy ra lỗi hệ thống khi kết nối đến máy chủ.',
              type: 'error'
            });
          }
        });
      } catch (err) {
        console.error('Failed to initialize notification button logic:', err);
      }
    }
  }

  renderError(container, error, hash) {
    console.error(`Không thể tải trang [${hash}]:`, error);
    container.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--error);">
        <h3>Không thể tải giao diện</h3>
        <p>${error.message}</p>
        <button onclick="location.reload()" class="btn btn-secondary" style="width: auto; margin-top: 15px;">Thử lại</button>
      </div>
    `;
  }

  setupViewportHeightSync() {
    if (!window.visualViewport) return;

    // Avoid duplicate listener registration
    if (this.visualViewportResizeListener) return;

    const adjustViewport = () => {
      const viewportHeight = window.visualViewport.height;
      const appLayout = document.querySelector('.app-layout');
      const appContainer = document.getElementById('app');
      if (appLayout) {
        appLayout.style.height = `${viewportHeight}px`;
      }
      if (appContainer) {
        appContainer.style.height = `${viewportHeight}px`;
      }

      // Auto-scroll messages to bottom if user is focusing input
      const msgContainer = document.getElementById('chat-messages-container');
      const messageInput = document.getElementById('message-input');
      if (msgContainer && messageInput && document.activeElement === messageInput) {
        setTimeout(() => {
          msgContainer.scrollTop = msgContainer.scrollHeight;
        }, 80);
      }
    };

    const preventWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    this.visualViewportResizeListener = adjustViewport;
    this.visualViewportScrollListener = adjustViewport;
    this.windowScrollListener = preventWindowScroll;

    window.visualViewport.addEventListener('resize', this.visualViewportResizeListener);
    window.visualViewport.addEventListener('scroll', this.visualViewportScrollListener);
    window.addEventListener('scroll', this.windowScrollListener);

    // Initial adjust
    adjustViewport();
  }

  cleanupViewportHeightSync() {
    if (window.visualViewport) {
      if (this.visualViewportResizeListener) {
        window.visualViewport.removeEventListener('resize', this.visualViewportResizeListener);
        this.visualViewportResizeListener = null;
      }
      if (this.visualViewportScrollListener) {
        window.visualViewport.removeEventListener('scroll', this.visualViewportScrollListener);
        this.visualViewportScrollListener = null;
      }
    }
    if (this.windowScrollListener) {
      window.removeEventListener('scroll', this.windowScrollListener);
      this.windowScrollListener = null;
    }
    const appContainer = document.getElementById('app');
    if (appContainer) {
      appContainer.style.height = '';
    }
    const appLayout = document.querySelector('.app-layout');
    if (appLayout) {
      appLayout.style.height = '';
    }
  }
}

export const router = new Router();
