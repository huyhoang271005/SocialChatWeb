import { api } from '../../js/core/api.js';
import { showDialog } from '../../js/shared/dialog/dialog.js';
import { t } from '../../js/core/i18n.js';

export const UsersView = {
  usersList: [],
  currentPage: 0,
  hasMore: false,
  listLoading: false,

  selectedUserId: null,
  selectedUserDetail: null,
  detailsLoading: false,
  detailsError: null,

  roles: [],
  searchTerm: '',
  currentUserExtend: null,

  render() {
    return `
      <div class="users-dashboard">
        <!-- Loading Overlay for Full Screen/Actions -->
        <div class="loading-overlay" id="users-loading-overlay">
          <div class="spinner"></div>
          <div class="loading-text" id="users-loading-text">${t('updating_config_overlay')}</div>
        </div>

        <div class="users-header">
          <div class="users-header-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-color)">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <h2>${t('users_title')}</h2>
          </div>
        </div>

        <div class="users-layout">
          <!-- Left Column: User list -->
          <div class="users-section list-section">
            <h3 class="section-title">${t('members_list_title')}</h3>
            
            <!-- Search bar -->
            <div class="users-search-container" style="display: flex; gap: 8px; flex-shrink: 0; margin-bottom: 15px;">
              <input type="text" id="users-search-input" class="form-input" placeholder="${t('search_email_placeholder')}" autocomplete="off" style="flex: 1;">
              <button id="btn-users-search" class="btn btn-primary" style="width: auto; padding: 0 16px; height: 38px; display: flex; align-items: center; justify-content: center; gap: 6px;">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                ${t('search_btn')}
              </button>
            </div>

            <!-- List box -->
            <div id="users-list-container" class="users-list-wrapper">
              ${Array(5).fill(0).map(() => `
                <div class="user-list-card-skeleton" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: hsla(230, 25%, 6%, 0.25);">
                  <div class="skeleton-loader skeleton-circle" style="width: 20px; height: 20px; flex-shrink: 0;"></div>
                  <div class="skeleton-loader skeleton-circle" style="width: 44px; height: 44px; flex-shrink: 0;"></div>
                  <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                    <div class="skeleton-loader skeleton-text" style="width: 60%; height: 12px; margin-bottom: 0;"></div>
                    <div class="skeleton-loader skeleton-text" style="width: 40%; height: 10px; margin-bottom: 0;"></div>
                  </div>
                </div>
              `).join('')}
            </div>
            
            <!-- Load More button container -->
            <div id="load-more-container" class="load-more-wrapper"></div>
          </div>

          <!-- Middle Column: Selected Users for Chat -->
          <div class="users-section selected-section">
            <h3 class="section-title">${t('create_conversation_title')}</h3>
            <div id="selected-users-container" class="selected-users-list"></div>
            <div id="chat-creation-panel" class="chat-creation-form"></div>
          </div>

          <!-- Right Column: User details -->
          <div class="users-section details-section" id="users-details-panel">
            <div class="details-placeholder-state">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-muted); margin-bottom: 12px;">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
              </svg>
              <p>${t('select_user_to_manage')}</p>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async init(router, queryParams) {
    this.router = router;
    this.selectedUserId = queryParams && queryParams.id ? queryParams.id : null;
    this.selectedUserDetail = null;
    this.detailsError = null;
    this.searchTerm = '';
    this.usersList = [];
    this.currentPage = 0;
    this.hasMore = false;
    this.currentUserExtend = null;
    this.selectedUsersForChat = new Map();

    // Render initial empty state for selected users
    this.renderSelectedUsers();

    const searchInput = document.getElementById('users-search-input');
    const searchBtn = document.getElementById('btn-users-search');
    
    const triggerSearch = () => {
      if (searchInput) {
        this.searchTerm = searchInput.value.trim();
      }
      this.loadUsers(false);
    };

    if (searchBtn) {
      searchBtn.addEventListener('click', triggerSearch);
    }

    if (searchInput) {
      searchInput.value = '';
      searchInput.placeholder = t('search_email_placeholder');
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          triggerSearch();
        }
      });
    }

    // Load initial users list only (roles and current user's extend details are lazy loaded on demand)
    await this.loadUsers();

    // If an ID is provided in query params, load details for that user
    if (this.selectedUserId) {
      this.loadUserDetail(this.selectedUserId);
    }
  },

  async loadRoles(forceRefresh = false) {
    if (!forceRefresh) {
      const cachedRoles = sessionStorage.getItem('chat_roles_cache');
      if (cachedRoles) {
        try {
          this.roles = JSON.parse(cachedRoles);
          return;
        } catch (e) {
          console.warn('Failed to parse cached roles:', e);
          sessionStorage.removeItem('chat_roles_cache');
        }
      }
    }

    try {
      const res = await api.get('roles');
      if (res && res.success && Array.isArray(res.data)) {
        this.roles = res.data;
        sessionStorage.setItem('chat_roles_cache', JSON.stringify(res.data));
      }
    } catch (err) {
      console.error('Failed to load system roles:', err);
    }
  },

  async loadCurrentUserExtend() {
    try {
      const res = await api.get('users/extend');
      if (res && res.success) {
        this.currentUserExtend = res.data;
      }
    } catch (err) {
      console.error('Failed to load current user extend details:', err);
    }
  },

  hasPermission(permissionName) {
    if (!this.currentUserExtend || !this.roles) return false;
    const userRoleId = this.currentUserExtend.roleId;
    const matchedRole = this.roles.find(r => String(r.roleId) === String(userRoleId));
    if (!matchedRole || !Array.isArray(matchedRole.permissions)) return false;
    return matchedRole.permissions.some(p => p.permissionName === permissionName);
  },

  async loadUsers(nextPage = false) {
    this.listLoading = true;

    // Update search button status if found to indicate loading
    const searchBtn = document.getElementById('btn-users-search');
    if (searchBtn) {
      searchBtn.disabled = true;
      searchBtn.innerHTML = `
        <div class="spinner-sm"></div>
        ${t('search_btn')}
      `;
    }
    
    // Show spinner if empty or when performing a new search/refresh page
    const listWrapper = document.getElementById('users-list-container');
    if (listWrapper && (this.usersList.length === 0 || !nextPage)) {
      listWrapper.innerHTML = Array(5).fill(0).map(() => `
        <div class="user-list-card-skeleton" style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; border: 1px solid var(--border-color); border-radius: var(--radius-md); background: hsla(230, 25%, 6%, 0.25); margin-bottom: 10px;">
          <div class="skeleton-loader skeleton-circle" style="width: 20px; height: 20px; flex-shrink: 0;"></div>
          <div class="skeleton-loader skeleton-circle" style="width: 44px; height: 44px; flex-shrink: 0;"></div>
          <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
            <div class="skeleton-loader skeleton-text" style="width: 60%; height: 12px; margin-bottom: 0;"></div>
            <div class="skeleton-loader skeleton-text" style="width: 40%; height: 10px; margin-bottom: 0;"></div>
          </div>
        </div>
      `).join('');
    }

    try {
      // Build request query parameters: emailName and lastId (for keyset pagination)
      let url = 'profiles/list';
      const params = [];
      
      if (this.searchTerm) {
        params.push(`emailName=${encodeURIComponent(this.searchTerm)}`);
      }
      
      if (nextPage && this.usersList.length > 0) {
        const lastUser = this.usersList[this.usersList.length - 1];
        const lastId = lastUser.userId;
        if (lastId) {
          params.push(`lastId=${encodeURIComponent(lastId)}`);
        }
      }
      
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }

      const response = await api.get(url);
      
      if (response && response.success && response.data) {
        // Handle both direct array and ResponseList wrapped structure
        const listData = Array.isArray(response.data) ? response.data : (response.data.data || []);
        this.hasMore = response.data.hasMore === true;
        
        if (nextPage) {
          this.usersList = [...this.usersList, ...listData];
        } else {
          this.usersList = listData;
        }
      } else {
        console.warn('Failed to load profiles/list:', response);
        if (!nextPage) this.usersList = [];
      }
    } catch (err) {
      console.error(err);
      if (!nextPage) this.usersList = [];
    } finally {
      this.listLoading = false;

      // Restore search button state
      const searchBtnRestored = document.getElementById('btn-users-search');
      if (searchBtnRestored) {
        searchBtnRestored.disabled = false;
        searchBtnRestored.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          ${t('search_btn')}
        `;
      }

      this.filterAndRenderList();
    }
  },

  filterAndRenderList() {
    const listWrapper = document.getElementById('users-list-container');
    const loadMoreContainer = document.getElementById('load-more-container');
    if (!listWrapper) return;

    const filtered = this.usersList; // Render all loaded items (server already filtered by emailName)

    if (filtered.length === 0) {
      listWrapper.innerHTML = `
        <div class="list-fallback-state">
          ${t('no_members_found_in_list')}
        </div>
      `;
      if (loadMoreContainer) loadMoreContainer.innerHTML = '';
      return;
    }

    const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';
    const currentUserId = localStorage.getItem('chat_user_id');

    listWrapper.innerHTML = filtered.map(user => {
      const isSelected = String(user.userId) === String(this.selectedUserId);
      const avatarUrl = user.avatarUrl || defaultAvatar;
      const isSelf = String(user.userId) === String(currentUserId);
      
      const checkboxHtml = !isSelf ? `
        <div class="user-list-checkbox-wrapper" onclick="event.stopPropagation()">
          <input type="checkbox" class="user-checkbox" data-id="${user.userId}" ${this.selectedUsersForChat && this.selectedUsersForChat.has(String(user.userId)) ? 'checked' : ''}>
        </div>
      ` : '';

      return `
        <div class="user-list-card ${isSelected ? 'active' : ''}" data-id="${user.userId}">
          ${checkboxHtml}
          <img src="${avatarUrl}" class="user-list-avatar" alt="${user.fullName}">
          <div class="user-list-info">
            <span class="user-list-name">${user.fullName || t('not_updated')}</span>
            <span class="user-list-username">@${user.username || t('no_username')}</span>
          </div>
        </div>
      `;
    }).join('');

    // Load More button rendering (keyset pagination)
    if (loadMoreContainer) {
      if (this.hasMore) {
        loadMoreContainer.innerHTML = `
          <button id="btn-load-more-users" class="btn btn-secondary" style="font-size: 0.85rem; padding: 10px 15px;">
            ${this.listLoading ? '<div class="spinner-sm"></div> ' + t('loading_more') : t('see_more')}
          </button>
        `;
        const loadMoreBtn = document.getElementById('btn-load-more-users');
        if (loadMoreBtn && !this.listLoading) {
          loadMoreBtn.addEventListener('click', () => {
            this.loadUsers(true);
          });
        }
      } else {
        loadMoreContainer.innerHTML = '';
      }
    }

    // Bind card click handlers
    const cards = listWrapper.querySelectorAll('.user-list-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const userId = card.dataset.id;
        // Skip reload if already selected
        if (String(userId) === String(this.selectedUserId) && this.selectedUserDetail) return;
        
        // Highlight active card
        cards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        this.loadUserDetail(userId);
      });
    });

    // Bind checkbox change handlers
    const checkboxes = listWrapper.querySelectorAll('.user-checkbox');
    checkboxes.forEach(cb => {
      cb.addEventListener('change', (e) => {
        const userId = cb.dataset.id;
        const userObj = this.usersList.find(u => String(u.userId) === String(userId));
        if (e.target.checked) {
          if (userObj) {
            this.selectedUsersForChat.set(String(userId), userObj);
          }
        } else {
          this.selectedUsersForChat.delete(String(userId));
        }
        this.renderSelectedUsers();
      });
    });
  },

  async loadUserDetail(userId) {
    this.selectedUserId = userId;
    this.detailsLoading = true;
    this.detailsError = null;
    this.selectedUserDetail = null;

    this.renderDetailsState();

    // Update URL hash with the user's ID without triggering re-routing
    history.replaceState(null, '', `#users?id=${userId}`);
    if (this.router) {
      this.router.currentHash = `users?id=${userId}`;
    }

    try {
      // 1. profiles/{userId} (GET)
      // 2. emails/{userId} (GET)
      // 3. users/extend/{userId} (GET)
      // Call sequentially to prevent concurrent refresh token locks
      const profileRes = await api.get(`profiles/${userId}`);
      let profile = null;
      if (profileRes && profileRes.success) {
        profile = profileRes.data;
      } else {
        console.warn(`Failed GET profiles/${userId}:`, profileRes);
      }

      const emailsRes = await api.get(`emails/${userId}`);
      let emails = [];
      if (emailsRes && emailsRes.success && Array.isArray(emailsRes.data)) {
        emails = emailsRes.data;
      } else {
        console.warn(`Failed GET emails/${userId}:`, emailsRes);
      }

      let extend = null;
      if (this.currentUserExtend && String(this.currentUserExtend.userId) === String(userId)) {
        extend = this.currentUserExtend;
      } else {
        const extendRes = await api.get(`users/extend/${userId}`);
        if (extendRes && extendRes.success) {
          extend = extendRes.data;
        } else {
          console.warn(`Failed GET users/extend/${userId}:`, extendRes);
        }
      }

      // Lazy load current user extend details for permissions check
      if (!this.currentUserExtend) {
        await this.loadCurrentUserExtend();
      }

      // Load cached roles if not in memory
      if (!this.roles || this.roles.length === 0) {
        await this.loadRoles(false);
      }

      // Check if both my own role ID and the target user's role ID are present in the cached roles
      const myRoleId = this.currentUserExtend ? this.currentUserExtend.roleId : null;
      const targetRoleId = extend ? extend.roleId : null;

      let needRolesRefresh = false;
      if (myRoleId && (!this.roles || !this.roles.find(r => String(r.roleId) === String(myRoleId)))) {
        needRolesRefresh = true;
      }
      if (targetRoleId && (!this.roles || !this.roles.find(r => String(r.roleId) === String(targetRoleId)))) {
        needRolesRefresh = true;
      }

      if (needRolesRefresh) {
        console.log('[Users] Role ID not found in cache. Refreshing roles cache...');
        await this.loadRoles(true);
      }

      if (profile) {
        this.selectedUserDetail = {
          profile,
          emails,
          extend
        };
        // Toggle view on mobile/tablet
        const dashboard = document.querySelector('.users-dashboard');
        if (dashboard) {
          dashboard.classList.add('show-details');
        }
      } else {
        this.selectedUserId = null;
        this.detailsError = t('load_user_detail_failed');
      }
    } catch (err) {
      console.error(err);
      this.selectedUserId = null;
      this.detailsError = err.message || t('server_connection_error');
    } finally {
      this.detailsLoading = false;
      this.renderDetails();
    }
  },

  renderDetailsState() {
    const detailsPanel = document.getElementById('users-details-panel');
    if (!detailsPanel) return;

    if (this.detailsLoading) {
      detailsPanel.innerHTML = `
        <div class="details-content-wrapper" style="opacity: 0.85;">
          <!-- Header Banner Skeleton -->
          <div class="user-detail-card-header" style="padding-bottom: 20px;">
            <div class="user-detail-cover skeleton-loader" style="height: 80px; border-radius: var(--radius-lg) var(--radius-lg) 0 0;"></div>
            <div class="user-detail-avatar-container" style="margin-top: -40px;">
              <div class="skeleton-loader skeleton-circle" style="width: 80px; height: 80px; border: 4px solid var(--bg-secondary);"></div>
            </div>
            <div class="user-detail-identity" style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 10px;">
              <div class="skeleton-loader skeleton-text" style="width: 35%; height: 16px; margin-bottom: 0;"></div>
              <div class="skeleton-loader skeleton-text" style="width: 20%; height: 12px; margin-bottom: 0;"></div>
              <div style="display: flex; gap: 8px; justify-content: center; width: 100%; margin-top: 4px;">
                <div class="skeleton-loader" style="width: 60px; height: 20px; border-radius: var(--radius-sm);"></div>
                <div class="skeleton-loader" style="width: 80px; height: 20px; border-radius: var(--radius-sm);"></div>
              </div>
            </div>
          </div>

          <!-- Info Grid Skeleton -->
          <div class="user-detail-grid">
            <div class="user-detail-pane" style="display: flex; flex-direction: column; gap: 12px;">
              <div class="skeleton-loader skeleton-text" style="width: 40%; height: 14px; margin-bottom: 8px;"></div>
              ${Array(3).fill(0).map(() => `
                <div style="display: flex; flex-direction: column; gap: 6px;">
                  <div class="skeleton-loader skeleton-text" style="width: 30%; height: 10px; margin-bottom: 0;"></div>
                  <div class="skeleton-loader skeleton-text" style="width: 70%; height: 12px; margin-bottom: 0;"></div>
                </div>
              `).join('')}
            </div>

            <div class="user-detail-pane" style="display: flex; flex-direction: column; gap: 12px;">
              <div class="skeleton-loader skeleton-text" style="width: 50%; height: 14px; margin-bottom: 8px;"></div>
              ${Array(2).fill(0).map(() => `
                <div style="display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--border-color); border-radius: var(--radius-sm); padding: 8px 12px;">
                  <div style="flex: 1; display: flex; flex-direction: column; gap: 6px;">
                    <div class="skeleton-loader skeleton-text" style="width: 60%; height: 12px; margin-bottom: 0;"></div>
                    <div class="skeleton-loader skeleton-text" style="width: 40%; height: 10px; margin-bottom: 0;"></div>
                  </div>
                  <div class="skeleton-loader" style="width: 60px; height: 20px; border-radius: var(--radius-sm);"></div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }
  },

  renderDetails() {
    const detailsPanel = document.getElementById('users-details-panel');
    if (!detailsPanel) return;

    if (this.detailsError) {
      detailsPanel.innerHTML = `
        <div class="details-error-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--error); margin-bottom: 12px;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>${this.detailsError}</p>
        </div>
      `;
      return;
    }

    if (!this.selectedUserDetail) {
      detailsPanel.innerHTML = `
        <div class="details-placeholder-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-muted); margin-bottom: 12px;">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
            <line x1="9" y1="9" x2="9.01" y2="9"></line>
            <line x1="15" y1="9" x2="15.01" y2="9"></line>
          </svg>
          <p>${t('select_user_to_view_details')}</p>
        </div>
      `;
      return;
    }

    const { profile, emails, extend } = this.selectedUserDetail;
    const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';
    
    const avatarUrl = profile.avatarUrl || defaultAvatar;
    const fullName = profile.fullName || t('not_updated');
    const username = profile.username ? `@${profile.username}` : `@${t('no_username')}`;
    const userId = profile.userId || (extend && extend.userId) || 'N/A';
    
    const birthdayStr = this.formatDate(profile.birthday);
    const genderStr = this.formatGender(profile.gender);
    const updatedAtStr = this.formatDateTime(profile.updatedAt);
    
    const accountStatus = (extend && extend.accountStatus) || 'PENDING';
    const currentRoleId = (extend && extend.roleId) || '';

    // Match role details for rendering tags
    const matchedRole = this.roles.find(r => String(r.roleId) === String(currentRoleId));
    const roleName = matchedRole ? matchedRole.roleName : (currentRoleId || 'CUSTOMER');

    const statusClass = `status-${accountStatus.toLowerCase()}`;
    const statusText = this.formatStatus(accountStatus);

    detailsPanel.innerHTML = `
      <div class="details-content-wrapper">
        <!-- Back Button for mobile viewports -->
        <button id="btn-back-to-users-list" class="btn btn-secondary btn-mobile-back" style="display: none; align-items: center; gap: 8px; width: auto; margin-bottom: 15px; padding: 10px 16px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          ${t('back_to_list')}
        </button>

        <!-- Info Card Banner -->
        <div class="user-detail-card-header">
          <div class="user-detail-cover"></div>
          <div class="user-detail-avatar-container">
            <img src="${avatarUrl}" class="user-detail-avatar" alt="${fullName}">
          </div>
          <div class="user-detail-identity">
            <h3>${fullName}</h3>
            <span class="user-detail-username-tag">${username}</span>
            <div class="user-detail-badges">
              <span class="role-badge role-${roleName.toLowerCase()}">${roleName}</span>
              <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
          </div>
        </div>

        <!-- Info Grid -->
        <div class="user-detail-grid">
          <!-- Profile info card -->
          <div class="user-detail-pane">
            <h4 class="pane-title">${t('personal_info')}</h4>
            <div class="pane-details-list">
              <div class="pane-detail-item">
                <span class="pane-detail-label">${t('user_id_label')}</span>
                <span class="pane-detail-value"><code>${userId}</code></span>
              </div>
              <div class="pane-detail-item">
                <span class="pane-detail-label">${t('dob_label')}:</span>
                <span class="pane-detail-value">${birthdayStr}</span>
              </div>
              <div class="pane-detail-item">
                <span class="pane-detail-label">${t('gender_label')}:</span>
                <span class="pane-detail-value">${genderStr}</span>
              </div>
              <div class="pane-detail-item">
                <span class="pane-detail-label">${t('updated_at_label')}</span>
                <span class="pane-detail-value">${updatedAtStr}</span>
              </div>
            </div>
          </div>

          <!-- Emails panel -->
          <div class="user-detail-pane">
            <h4 class="pane-title">${t('linked_emails_label')}</h4>
            <div class="pane-emails-list" style="max-height: 180px; overflow-y: auto;">
              ${emails.length > 0
                ? emails.map(email => {
                    const verifiedClass = email.verified ? 'verified-tag' : 'unverified-tag';
                    const verifiedText = email.verified ? t('status_verified_tag') : t('status_unverified_tag');
                    return `
                      <div class="pane-email-item">
                        <div class="pane-email-info">
                          <span class="pane-email-address" title="${email.emailName || 'N/A'}">${email.emailName || 'N/A'}</span>
                          <span class="pane-email-date">${t('linked_at')} ${this.formatDate(email.createdAt)}</span>
                        </div>
                        <div class="pane-email-actions">
                          <span class="email-status-badge ${verifiedClass}">${verifiedText}</span>
                          ${this.hasPermission('DELETE_EMAIL') ? `
                            <button class="btn-delete-email" data-id="${email.emailId || email.id || ''}" data-email="${email.emailName}" title="${t('delete')}">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                            </button>
                          ` : ''}
                        </div>
                      </div>
                    `;
                  }).join('')
                : `<div class="pane-no-emails">${t('no_linked_emails_details')}</div>`
              }
            </div>
            
            <!-- Form thêm email mới -->
            ${this.hasPermission('ADD_EMAIL') ? `
              <form id="add-email-form" class="add-email-row">
                <input type="email" id="new-email-input" class="form-input" placeholder="${t('new_email_placeholder')}" required style="flex: 1; font-size: 0.85rem; padding: 8px 12px;">
                <button type="submit" class="btn btn-primary" style="padding: 0 14px; font-size: 0.85rem; width: auto; height: 36px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  ${t('add_btn')}
                </button>
              </form>
            ` : ''}
          </div>
        </div>

        <!-- Administration Form -->
        ${this.hasPermission('UPDATE_EXTEND_USER') ? `
          <div class="user-detail-pane admin-action-pane" style="margin-top: 10px;">
            <h4 class="pane-title admin-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              ${t('admin_panel_title')}
            </h4>
            
            <form id="admin-update-form" class="admin-form-layout">
              <div class="form-row">
                <!-- Select Role -->
                <div class="form-group">
                  <label class="form-label" for="admin-select-role">${t('role_label')}</label>
                  <select id="admin-select-role" class="form-input select-input">
                    ${this.roles
                      .filter(r => !r.deletedAt || String(r.roleId) === String(currentRoleId))
                      .map(r => {
                        const isDeleted = r.deletedAt !== null && r.deletedAt !== undefined;
                        const displayName = isDeleted ? `${r.roleName} (${t('deleted_badge')})` : r.roleName;
                        return `
                          <option value="${r.roleId}" ${String(r.roleId) === String(currentRoleId) ? 'selected' : ''}>
                            ${displayName}
                          </option>
                        `;
                      }).join('')}
                  </select>
                </div>

                <!-- Select Status -->
                <div class="form-group">
                  <label class="form-label" for="admin-select-status">${t('account_status')}</label>
                  <select id="admin-select-status" class="form-input select-input">
                    <option value="ACTIVE" ${accountStatus === 'ACTIVE' ? 'selected' : ''}>${t('status_active_opt')}</option>
                    <option value="LOCKED" ${accountStatus === 'LOCKED' ? 'selected' : ''}>${t('status_locked_opt')}</option>
                    <option value="BANNED" ${accountStatus === 'BANNED' ? 'selected' : ''}>${t('status_banned_opt')}</option>
                  </select>
                </div>
              </div>

              <!-- Banned expiration (Only visible when BANNED is selected) -->
              <div class="form-group" id="ban-expiry-row" style="display: ${accountStatus === 'BANNED' ? 'block' : 'none'};">
                <label class="form-label" for="admin-ban-expiry">${t('ban_expiry_label')}</label>
                <input type="datetime-local" id="admin-ban-expiry" class="form-input">
              </div>

              <div style="margin-top: 15px;">
                <button type="submit" class="btn btn-primary" style="width: auto; padding: 10px 24px;">
                  ${t('update_config')}
                </button>
              </div>
            </form>
          </div>
        ` : ''}
      </div>
    `;

    // Bind admin form events & email management events
    this.bindAdminEvents();
    this.bindEmailEvents();

    // Bind click listener for back button on mobile
    const backBtn = document.getElementById('btn-back-to-users-list');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.selectedUserId = null;
        this.selectedUserDetail = null;
        
        // Remove active card styling in list
        const cards = document.querySelectorAll('.user-list-card');
        cards.forEach(c => c.classList.remove('active'));

        // Clear id from URL hash safely without triggering router refresh
        history.replaceState(null, '', '#users');
        if (this.router) {
          this.router.currentHash = 'users';
        }

        // Toggle mobile view state
        const dashboard = document.querySelector('.users-dashboard');
        if (dashboard) {
          dashboard.classList.remove('show-details');
        }

        // Render placeholder in details
        this.renderDetails();
      });
    }
  },

  bindAdminEvents() {
    const form = document.getElementById('admin-update-form');
    const statusSelect = document.getElementById('admin-select-status');
    const expiryRow = document.getElementById('ban-expiry-row');
    const expiryInput = document.getElementById('admin-ban-expiry');

    if (!form || !statusSelect) return;

    // Prepopulate expiry date if it exists
    if (this.selectedUserDetail && this.selectedUserDetail.extend && this.selectedUserDetail.extend.expireAt) {
      try {
        const dateObj = new Date(this.selectedUserDetail.extend.expireAt);
        // format to datetime-local expected string YYYY-MM-DDTHH:MM
        const tzoffset = dateObj.getTimezoneOffset() * 60000; //offset in milliseconds
        const localISOTime = (new Date(dateObj - tzoffset)).toISOString().slice(0, 16);
        if (expiryInput) expiryInput.value = localISOTime;
      } catch (err) {
        console.warn('Failed to parse expireAt:', err);
      }
    }

    // Toggle ban expiration row when status dropdown changes
    statusSelect.addEventListener('change', (e) => {
      const status = e.target.value;
      if (status === 'BANNED') {
        expiryRow.style.display = 'block';
        if (expiryInput) expiryInput.required = true;
      } else {
        expiryRow.style.display = 'none';
        if (expiryInput) {
          expiryInput.required = false;
          expiryInput.value = '';
        }
      }
    });

    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const roleId = document.getElementById('admin-select-role').value;
      const accountStatus = statusSelect.value;
      let expireAt = null;

      if (accountStatus === 'BANNED') {
        const rawExpiry = expiryInput.value;
        if (!rawExpiry) {
          await showDialog({
            title: t('data_input_error'),
            message: t('ban_expiry_required'),
            type: 'warning'
          });
          return;
        }
        try {
          expireAt = new Date(rawExpiry).toISOString();
        } catch (err) {
          await showDialog({
            title: t('invalid_datetime'),
            message: t('invalid_datetime_format'),
            type: 'error'
          });
          return;
        }
      }

      // Show loader overlay
      const overlay = document.getElementById('users-loading-overlay');
      const overlayText = document.getElementById('users-loading-text');
      const toggleOverlay = (isActive, msg = t('updating_config_overlay')) => {
        if (overlayText) overlayText.textContent = msg;
        if (overlay) {
          if (isActive) overlay.classList.add('active');
          else overlay.classList.remove('active');
        }
      };

      toggleOverlay(true, t('updating_role_status'));

      try {
        const payload = {
          userId: this.selectedUserId,
          roleId,
          accountStatus,
          expireAt
        };

        // Call api patch users
        const patchResponse = await api.patch('users', payload);
        toggleOverlay(false);

        if (patchResponse && patchResponse.success) {
          await showDialog({
            title: t('update_success_title'),
            message: t('user_update_success_msg'),
            type: 'success',
            buttons: [{ text: t('close'), type: 'primary', value: true }]
          });

          // Update local state instead of reloading API
          if (this.selectedUserDetail) {
            if (!this.selectedUserDetail.extend) {
              this.selectedUserDetail.extend = {};
            }
            this.selectedUserDetail.extend.roleId = roleId;
            this.selectedUserDetail.extend.accountStatus = accountStatus;
            this.selectedUserDetail.extend.expireAt = expireAt;
          }

          // Keep current user's extend info in sync if they updated themselves
          if (this.currentUserExtend && String(this.currentUserExtend.userId) === String(this.selectedUserId)) {
            this.currentUserExtend.roleId = roleId;
            this.currentUserExtend.accountStatus = accountStatus;
            this.currentUserExtend.expireAt = expireAt;
          }

          this.renderDetails();
        } else {
          await showDialog({
            title: t('update_error_title'),
            message: patchResponse?.message || t('user_update_failed_msg'),
            type: 'error'
          });
        }
      } catch (err) {
        toggleOverlay(false);
        console.error(err);
        await showDialog({
          title: t('system_error_title'),
          message: err.message || t('system_error_request_msg'),
          type: 'error'
        });
      }
    });
  },

  bindEmailEvents() {
    const addEmailForm = document.getElementById('add-email-form');
    const deleteEmailBtns = document.querySelectorAll('.btn-delete-email');

    // Add email event handler
    if (addEmailForm) {
      addEmailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('new-email-input');
        if (!emailInput) return;
        const emailName = emailInput.value.trim();
        if (!emailName) return;

        // Show loader overlay
        const overlay = document.getElementById('users-loading-overlay');
        const overlayText = document.getElementById('users-loading-text');
        const toggleOverlay = (isActive, msg = t('processing')) => {
          if (overlayText) overlayText.textContent = msg;
          if (overlay) {
            if (isActive) overlay.classList.add('active');
            else overlay.classList.remove('active');
          }
        };

        toggleOverlay(true, t('linking_new_email'));

        try {
          // POST to emails/{userId}
          const response = await api.post(`emails/${this.selectedUserId}`, { emailName });
          toggleOverlay(false);

          if (response && response.success) {
            // Retrieve returned emailDto
            const newEmailDto = response.data && (response.data.data || response.data);
            if (newEmailDto && this.selectedUserDetail) {
              if (!this.selectedUserDetail.emails) {
                this.selectedUserDetail.emails = [];
              }
              this.selectedUserDetail.emails.push(newEmailDto);
            }

            await showDialog({
              title: t('add_email_success_title'),
              message: t('email_linked_success_msg').replace('{email}', emailName),
              type: 'success',
              buttons: [{ text: t('close'), type: 'primary', value: true }]
            });
            
            // Clear input and re-render user details locally (no reload)
            emailInput.value = '';
            this.renderDetails();
          } else {
            await showDialog({
              title: t('add_email_failed_title'),
              message: response?.message || t('email_link_failed_msg'),
              type: 'error'
            });
          }
        } catch (err) {
          toggleOverlay(false);
          console.error(err);
          await showDialog({
            title: t('system_error_title'),
            message: err.message || t('system_error_request_msg'),
            type: 'error'
          });
        }
      });
    }

    // Delete email event handler
    deleteEmailBtns.forEach(btn => {
      btn.addEventListener('click', async () => {
        const emailId = btn.dataset.id;
        const emailName = btn.dataset.email;
        if (!emailId) return;

        const confirmDelete = await showDialog({
          title: t('confirm_delete_email_title'),
          message: t('delete_email_confirm_msg').replace('{email}', emailName),
          type: 'warning',
          buttons: [
            { text: t('cancel'), type: 'secondary', value: false },
            { text: t('delete'), type: 'danger', value: true }
          ]
        });

        if (!confirmDelete) return;

        // Show loader overlay
        const overlay = document.getElementById('users-loading-overlay');
        const overlayText = document.getElementById('users-loading-text');
        const toggleOverlay = (isActive, msg = t('processing')) => {
          if (overlayText) overlayText.textContent = msg;
          if (overlay) {
            if (isActive) overlay.classList.add('active');
            else overlay.classList.remove('active');
          }
        };

        toggleOverlay(true, t('unlinking_email'));

        try {
          // DELETE to emails/{emailId}
          const response = await api.delete(`emails/${emailId}`);
          toggleOverlay(false);

          if (response && response.success) {
            await showDialog({
              title: t('delete_email_success_title'),
              message: t('email_deleted_success_msg').replace('{email}', emailName),
              type: 'success',
              buttons: [{ text: t('close'), type: 'primary', value: true }]
            });

            // Filter out deleted email from local array and re-render (no reload)
            if (this.selectedUserDetail && this.selectedUserDetail.emails) {
              this.selectedUserDetail.emails = this.selectedUserDetail.emails.filter(
                e => String(e.emailId || e.id || '') !== String(emailId)
              );
            }
            this.renderDetails();
          } else {
            await showDialog({
              title: t('delete_email_failed_title'),
              message: response?.message || t('email_delete_failed_msg'),
              type: 'error'
            });
          }
        } catch (err) {
          toggleOverlay(false);
          console.error(err);
          await showDialog({
            title: t('system_error_title'),
            message: err.message || t('system_error_request_msg'),
            type: 'error'
          });
        }
      });
    });
  },

  renderSelectedUsers() {
    const selectedContainer = document.getElementById('selected-users-container');
    const creationPanel = document.getElementById('chat-creation-panel');
    if (!selectedContainer || !creationPanel) return;

    const dashboard = document.querySelector('.users-dashboard');

    if (!this.selectedUsersForChat || this.selectedUsersForChat.size === 0) {
      if (dashboard) {
        dashboard.classList.remove('has-selection');
      }
      selectedContainer.innerHTML = `
        <div class="selected-fallback-state" style="padding: 40px 10px; text-align: center; color: var(--text-muted); font-size: 0.85rem; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 12px; color: var(--text-muted);">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
          <p>${t('no_members_selected_chat')}</p>
        </div>
      `;
      creationPanel.innerHTML = '';
      return;
    }

    if (dashboard) {
      dashboard.classList.add('has-selection');
    }

    const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';
    
    // Render selected users list
    let selectedHtml = '';
    this.selectedUsersForChat.forEach((user, userId) => {
      const avatarUrl = user.avatarUrl || defaultAvatar;
      selectedHtml += `
        <div class="selected-user-item" data-id="${userId}">
          <div class="selected-user-info">
            <img src="${avatarUrl}" class="selected-user-avatar" alt="${user.fullName}">
            <span class="selected-user-name" title="${user.fullName}">${user.fullName}</span>
          </div>
          <button class="btn-remove-selected" data-id="${userId}" title="${t('deselect')}">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      `;
    });
    selectedContainer.innerHTML = selectedHtml;

    // Bind remove button handlers
    const removeBtns = selectedContainer.querySelectorAll('.btn-remove-selected');
    removeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.dataset.id;
        this.selectedUsersForChat.delete(String(userId));
        
        // Uncheck corresponding checkbox in the list
        const checkbox = document.querySelector(`.user-checkbox[data-id="${userId}"]`);
        if (checkbox) {
          checkbox.checked = false;
        }
        
        this.renderSelectedUsers();
      });
    });

    // Render Chat Creation Panel
    const isGroup = this.selectedUsersForChat.size > 1;
    if (isGroup) {
      creationPanel.innerHTML = `
        <form id="create-chat-form" class="admin-form-layout" style="display: flex; flex-direction: column; gap: 12px;">
          <div class="form-group" style="display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 8px;">
            <div style="position: relative; width: 60px; height: 60px; border-radius: 50%; overflow: hidden; border: 2px solid var(--border-color); background: hsla(230, 25%, 15%, 0.45);">
              <img id="chat-avatar-preview" src="https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=100&h=100" style="width: 100%; height: 100%; object-fit: cover;" alt="Preview">
            </div>
            <input type="file" id="chat-avatar-file" accept="image/*" style="display: none;">
            <button type="button" id="btn-upload-chat-avatar" class="btn btn-secondary" style="font-size: 0.8rem; padding: 6px 12px; height: 32px; display: flex; align-items: center; justify-content: center; gap: 6px; width: auto;">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <circle cx="8.5" cy="8.5" r="1.5"></circle>
                <polyline points="21 15 16 10 5 21"></polyline>
              </svg>
              ${t('choose_avatar')}
            </button>
          </div>
          <div class="form-group">
            <label class="form-label" for="chat-title-input" style="font-size: 0.8rem; margin-bottom: 4px;">${t('group_name_label')}</label>
            <input type="text" id="chat-title-input" class="form-input" placeholder="${t('group_name_placeholder')}" style="font-size: 0.85rem; padding: 8px 12px; height: 36px;">
          </div>
          <button type="submit" class="btn btn-primary" style="margin-top: 5px; width: 100%; padding: 10px; font-size: 0.85rem; height: 38px; display: flex; align-items: center; justify-content: center;">
            ${t('create_group_chat_btn')}
          </button>
        </form>
      `;

      // Select file logic
      const uploadBtn = creationPanel.querySelector('#btn-upload-chat-avatar');
      const fileInput = creationPanel.querySelector('#chat-avatar-file');
      const avatarPreview = creationPanel.querySelector('#chat-avatar-preview');

      this.selectedGroupAvatarFile = null;

      if (uploadBtn && fileInput && avatarPreview) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => {
          if (fileInput.files.length === 0) return;
          const file = fileInput.files[0];
          this.selectedGroupAvatarFile = file;
          avatarPreview.src = URL.createObjectURL(file);
        });
      }

      // Submit form logic
      const form = creationPanel.querySelector('#create-chat-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleCreateConversation(true);
      });

    } else {
      creationPanel.innerHTML = `
        <button id="btn-create-direct-chat" class="btn btn-primary" style="width: 100%; padding: 10px; font-size: 0.85rem; height: 38px; display: flex; align-items: center; justify-content: center;">
          ${t('create_direct_chat_btn')}
        </button>
      `;

      const directChatBtn = creationPanel.querySelector('#btn-create-direct-chat');
      if (directChatBtn) {
        directChatBtn.addEventListener('click', async () => {
          await this.handleCreateConversation(false);
        });
      }
    }
  },

  async handleCreateConversation(isGroup) {
    const selectedUserIds = Array.from(this.selectedUsersForChat.keys()).map(id => Number(id));
    if (selectedUserIds.length === 0) return;

    // Show loading overlay
    const overlay = document.getElementById('users-loading-overlay');
    const overlayText = document.getElementById('users-loading-text');
    const toggleOverlay = (isActive, msg = t('processing')) => {
      if (overlayText) overlayText.textContent = msg;
      if (overlay) {
        if (isActive) overlay.classList.add('active');
        else overlay.classList.remove('active');
      }
    };

    let title = null;
    let conversationAvatarUrl = null;
    let conversationAvatarId = null;

    if (isGroup) {
      const titleInput = document.getElementById('chat-title-input');
      title = titleInput ? titleInput.value.trim() || null : null;

      if (this.selectedGroupAvatarFile) {
        toggleOverlay(true, t('uploading_group_avatar'));
        try {
          const res = await api.uploadImage(this.selectedGroupAvatarFile, 'avatars');
          if (res && res.success && res.data) {
            conversationAvatarUrl = res.data.publicUrl || res.data.url;
            conversationAvatarId = res.data.publicId || res.data.id;
          } else {
            toggleOverlay(false);
            await showDialog({
              title: t('upload_image_failed_title'),
              message: res?.message || t('upload_group_avatar_failed_msg'),
              type: 'error'
            });
            return;
          }
        } catch (uploadErr) {
          toggleOverlay(false);
          console.error(uploadErr);
          await showDialog({
            title: t('upload_image_failed_title'),
            message: t('upload_group_avatar_error_msg'),
            type: 'error'
          });
          return;
        }
      }
    }

    // Build userConversations array
    const userConversations = selectedUserIds.map(userId => ({ userId }));

    toggleOverlay(true, t('creating_conversation'));

    try {
      const payload = {
        title,
        conversationAvatarUrl,
        conversationAvatarId,
        group: isGroup,
        userConversations
      };

      const res = await api.post('conversations', payload);
      toggleOverlay(false);

      if (res && res.success) {
        await showDialog({
          title: t('create_conversation_success_title'),
          message: t('create_conversation_success_msg'),
          type: 'success',
          buttons: [{ text: t('go_to_chat_btn'), type: 'primary', value: true }]
        });

        // Reset Selection state
        this.selectedUsersForChat.clear();
        this.uploadedGroupAvatarUrl = null;
        this.uploadedGroupAvatarId = null;
        this.filterAndRenderList(); // Redraw checkbox items
        this.renderSelectedUsers(); // Redraw selection panel

        // Navigate to home page and select this conversation ID
        const conversationId = res.data?.conversationId || res.data?.id;
        if (conversationId) {
          window.location.hash = `#home?conversationId=${conversationId}`;
        } else {
          window.location.hash = '#home';
        }
      } else {
        await showDialog({
          title: t('create_conversation_failed_title'),
          message: res?.message || t('create_conversation_failed_msg'),
          type: 'error'
        });
      }
    } catch (err) {
      toggleOverlay(false);
      console.error(err);
      await showDialog({
        title: t('system_error_title'),
        message: err.message || t('system_error_generic_msg'),
        type: 'error'
      });
    }
  },

  formatDate(dateStr) {
    if (!dateStr) return t('not_updated');
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const lang = localStorage.getItem('chat_lang') || 'vi';
      return d.toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  },

  formatDateTime(instantStr) {
    if (!instantStr) return t('not_updated');
    try {
      const d = new Date(instantStr);
      if (isNaN(d.getTime())) return instantStr;
      const lang = localStorage.getItem('chat_lang') || 'vi';
      return d.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return instantStr;
    }
  },

  formatGender(gender) {
    if (!gender) return t('not_updated');
    const mapping = {
      MALE: t('gender_male'),
      FEMALE: t('gender_female'),
      OTHER: t('gender_other')
    };
    return mapping[String(gender).toUpperCase()] || gender;
  },

  formatStatus(status) {
    if (!status) return t('status_unverified_tag');
    const mapping = {
      ACTIVE: t('status_active'),
      LOCKED: t('status_locked'),
      BANNED: t('status_banned'),
      PENDING: t('status_pending')
    };
    return mapping[String(status).toUpperCase()] || status;
  }
};

export default UsersView;
