import { api } from '../../js/core/api.js';
import { showDialog } from '../../js/shared/dialog/dialog.js';

export const ProfileView = {
  profile: null,
  emails: [],
  extendUser: null,
  roles: [],
  loading: true,
  error: null,

  // Edit Mode state
  isEditing: false,
  selectedAvatarFile: null,
  tempAvatarPreview: null,

  render() {
    return `
      <div class="profile-dashboard">
        <!-- Loading Overlay -->
        <div class="loading-overlay" id="profile-loading">
          <div class="spinner"></div>
          <div class="loading-text" id="profile-loading-text">Đang cập nhật hồ sơ...</div>
        </div>

        <div class="profile-header-bar">
          <h2 id="profile-view-title">Hồ Sơ Cá Nhân</h2>
        </div>

        <div id="profile-content-mount">
          <div class="profile-loading-state">
            <div class="spinner"></div>
            <p>Đang tải thông tin cá nhân...</p>
          </div>
        </div>
      </div>
    `;
  },

  async init(router) {
    this.isEditing = false;
    this.selectedAvatarFile = null;
    this.tempAvatarPreview = null;

    await this.fetchAndRender(true);
  },

  async fetchAndRender(forceLoad = false) {
    const mountPoint = document.getElementById('profile-content-mount');
    if (!mountPoint) return;

    // Show initial loading if it is the first time we load data
    if (this.loading && !this.profile) {
      mountPoint.innerHTML = `
        <div class="profile-loading-state">
          <div class="spinner"></div>
          <p>Đang tải thông tin cá nhân...</p>
        </div>
      `;
    }

    try {
      if (forceLoad || (!this.profile && !this.isEditing)) {
        // Fetch fresh data when not in editing state
        this.loading = true;

        // Fetch sequentially to avoid parallel 401 requests and ensure single refresh token cycle
        const profileRes = await api.get('profiles');
        if (profileRes && profileRes.success) {
          this.profile = profileRes.data;
        } else {
          this.profile = null;
          console.warn('Failed to load profile:', profileRes);
        }

        const emailsRes = await api.get('emails');
        if (emailsRes && emailsRes.success) {
          this.emails = Array.isArray(emailsRes.data) ? emailsRes.data : [];
        } else {
          this.emails = [];
          console.warn('Failed to load emails:', emailsRes);
        }

        const extendRes = await api.get('users/extend');
        if (extendRes && extendRes.success) {
          this.extendUser = extendRes.data;
        } else {
          this.extendUser = null;
          console.warn('Failed to load extendUser:', extendRes);
        }

        const rolesRes = await api.get('roles');
        if (rolesRes && rolesRes.success) {
          this.roles = Array.isArray(rolesRes.data) ? rolesRes.data : [];
        } else {
          this.roles = [];
          console.warn('Failed to load roles:', rolesRes);
        }

        if (!this.profile) {
          this.error = 'Không thể tải thông tin hồ sơ của bạn. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.';
        }
      }
    } catch (err) {
      this.error = err.message || 'Lỗi hệ thống khi tải dữ liệu.';
    } finally {
      this.loading = false;
    }

    if (this.error) {
      mountPoint.innerHTML = `
        <div class="profile-error-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--error)">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>${this.error}</p>
          <button id="btn-retry-load" class="btn btn-primary" style="width: auto; margin-top: 15px;">Thử lại</button>
        </div>
      `;
      const retryBtn = document.getElementById('btn-retry-load');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.profile = null;
          this.error = null;
          this.fetchAndRender(true);
        });
      }
      return;
    }

    const titleEl = document.getElementById('profile-view-title');
    if (titleEl) {
      titleEl.textContent = this.isEditing ? 'Chỉnh Sửa Hồ Sơ' : 'Hồ Sơ Cá Nhân';
    }

    // Process variables
    const profile = this.profile || {};
    const emails = this.emails || [];
    const extendUser = this.extendUser || {};
    const roles = this.roles || [];

    // Match role details
    let matchedRole = null;
    if (extendUser.roleId) {
      matchedRole = roles.find(r => String(r.roleId) === String(extendUser.roleId));
    }

    const defaultAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150';
    const avatarUrl = this.tempAvatarPreview || profile.avatarUrl || defaultAvatar;
    const fullName = profile.fullName || 'Chưa cập nhật';
    const username = profile.username ? `@${profile.username}` : '@chưa_có_username';
    const userId = profile.userId || extendUser.userId || 'N/A';

    const birthdayStr = this.formatDate(profile.birthday);
    const genderStr = this.formatGender(profile.gender);
    const updatedAtStr = this.formatDateTime(profile.updatedAt);
    
    const accountStatus = extendUser.accountStatus || 'PENDING';
    const statusClass = `status-${accountStatus.toLowerCase()}`;
    const statusText = this.formatStatus(accountStatus);

    const roleName = matchedRole ? matchedRole.roleName : (extendUser.roleId || 'CUSTOMER');
    const permissions = matchedRole && Array.isArray(matchedRole.permissions) ? matchedRole.permissions : [];

    // Render HTML layout
    let contentHtml = '';

    if (this.isEditing) {
      contentHtml = `
        <form id="profile-edit-form">
          <div class="profile-container-grid">
            <!-- Left Column: Main profile card in Edit Mode -->
            <div class="profile-card main-info-card">
              <div class="profile-card-cover"></div>
              
              <!-- Editable Avatar -->
              <div class="profile-avatar-container editable" id="avatar-edit-trigger" title="Thay đổi ảnh đại diện">
                <img src="${avatarUrl}" class="profile-large-avatar" id="edit-avatar-preview" alt="${fullName}">
                <div class="avatar-edit-overlay">
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span>Thay ảnh</span>
                </div>
                <input type="file" id="profile-avatar-file-input" accept="image/*" style="display: none;">
              </div>

              <!-- Editable Names and controls -->
              <div class="profile-basic-details">
                <div class="form-group" style="text-align: left; margin-bottom: 15px;">
                  <label class="form-label" for="edit-fullname">Họ và tên</label>
                  <input type="text" id="edit-fullname" class="form-input" value="${profile.fullName || ''}" placeholder="Ví dụ: Nguyễn Linh Chi" required>
                </div>
                
                <div class="form-group" style="text-align: left; margin-bottom: 20px;">
                  <label class="form-label" for="edit-username">Biệt danh (Username)</label>
                  <input type="text" id="edit-username" class="form-input" value="${profile.username || ''}" placeholder="Ví dụ: linhchi_99" required>
                </div>
                
                <div class="profile-edit-actions-row">
                  <button type="submit" class="btn btn-primary" style="width: auto; padding: 10px 24px; border-radius: 8px;">
                    Lưu hồ sơ
                  </button>
                  <button type="button" id="btn-cancel-edit" class="btn btn-secondary" style="width: auto; padding: 10px 24px; border-radius: 8px;">
                    Hủy bỏ
                  </button>
                </div>
              </div>
            </div>

            <!-- Right Column: Personal details in Edit Mode -->
            <div class="profile-card details-card">
              <h4 class="card-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Chỉnh sửa thông tin cá nhân
              </h4>
              
              <div class="details-list-edit">
                <div class="form-group" style="margin-bottom: 16px;">
                  <label class="form-label" for="edit-birthday">Ngày sinh</label>
                  <input type="date" id="edit-birthday" class="form-input" value="${profile.birthday || ''}" required>
                </div>

                <div class="form-group">
                  <label class="form-label">Giới tính</label>
                  <div class="gender-selector">
                    <div class="gender-option">
                      <input type="radio" name="edit-gender" id="gender-male" value="MALE" ${profile.gender === 'MALE' ? 'checked' : ''}>
                      <label for="gender-male" class="gender-label">Nam</label>
                    </div>
                    <div class="gender-option">
                      <input type="radio" name="edit-gender" id="gender-female" value="FEMALE" ${profile.gender === 'FEMALE' ? 'checked' : ''}>
                      <label for="gender-female" class="gender-label">Nữ</label>
                    </div>
                    <div class="gender-option">
                      <input type="radio" name="edit-gender" id="gender-other" value="OTHER" ${profile.gender === 'OTHER' ? 'checked' : ''}>
                      <label for="gender-other" class="gender-label">Khác</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Associated Emails - Readonly -->
            <div class="profile-card emails-card">
              <h4 class="card-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                Danh sách Email liên kết (${emails.length})
              </h4>
              <div class="emails-list">
                ${emails.length > 0
                  ? emails.map(email => {
                      const verifiedClass = email.verified ? 'verified-tag' : 'unverified-tag';
                      const verifiedText = email.verified ? 'Đã xác minh' : 'Chưa xác minh';
                      const dateStr = this.formatDate(email.createdAt);
                      return `
                        <div class="email-item">
                          <div class="email-info">
                            <span class="email-address">${email.emailName || 'N/A'}</span>
                            <span class="email-created">Liên kết từ: ${dateStr}</span>
                          </div>
                          <span class="email-status-badge ${verifiedClass}">${verifiedText}</span>
                        </div>
                      `;
                    }).join('')
                  : `<div class="no-emails-placeholder"><p>Chưa có email nào được liên kết.</p></div>`
                }
              </div>
            </div>

            <!-- Role & Permissions - Readonly -->
            <div class="profile-card permissions-card">
              <h4 class="card-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                Quyền hạn vai trò (${roleName})
              </h4>
              <div class="permissions-list-container">
                ${permissions.length > 0 
                  ? `<div class="permissions-chips">
                      ${permissions.map(p => `<span class="perm-chip" title="${p.permissionName}">${p.permissionName}</span>`).join('')}
                     </div>`
                  : `<div class="no-permissions-placeholder"><p>Không có quyền hạn cụ thể.</p></div>`
                }
              </div>
            </div>
          </div>
        </form>
      `;
    } else {
      contentHtml = `
        <div class="profile-container-grid">
          <!-- Left Column: Main profile card -->
          <div class="profile-card main-info-card">
            <div class="profile-card-cover"></div>
            <div class="profile-avatar-container">
              <img src="${avatarUrl}" class="profile-large-avatar" alt="${fullName}">
            </div>
            <div class="profile-basic-details">
              <h3>${fullName}</h3>
              <span class="profile-username-tag">${username}</span>
              <div class="profile-badges-row">
                <span class="role-badge role-${roleName.toLowerCase()}">${roleName}</span>
                <span class="status-badge ${statusClass}">${statusText}</span>
              </div>
              <div class="profile-user-id">
                <span>ID: <code>${userId}</code></span>
              </div>
              <div style="margin-top: 20px;">
                <button id="btn-start-edit" class="btn btn-secondary" style="width: auto; padding: 10px 20px; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
                  </svg>
                  Chỉnh sửa hồ sơ
                </button>
              </div>
            </div>
          </div>

          <!-- Right Column: Personal details -->
          <div class="profile-card details-card">
            <h4 class="card-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              Thông tin cá nhân
            </h4>
            <div class="details-list">
              <div class="detail-item">
                <span class="detail-label">Ngày sinh:</span>
                <span class="detail-value">${birthdayStr}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Giới tính:</span>
                <span class="detail-value">${genderStr}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Lần cuối cập nhật:</span>
                <span class="detail-value">${updatedAtStr}</span>
              </div>
            </div>
          </div>

          <!-- Associated Emails list -->
          <div class="profile-card emails-card">
            <h4 class="card-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                <polyline points="22,6 12,13 2,6"></polyline>
              </svg>
              Danh sách Email liên kết (${emails.length})
            </h4>
            <div class="emails-list">
              ${emails.length > 0
                ? emails.map(email => {
                    const verifiedClass = email.verified ? 'verified-tag' : 'unverified-tag';
                    const verifiedText = email.verified ? 'Đã xác minh' : 'Chưa xác minh';
                    const dateStr = this.formatDate(email.createdAt);
                    return `
                      <div class="email-item">
                        <div class="email-info">
                          <span class="email-address">${email.emailName || 'N/A'}</span>
                          <span class="email-created">Liên kết từ: ${dateStr}</span>
                        </div>
                        <span class="email-status-badge ${verifiedClass}">${verifiedText}</span>
                      </div>
                    `;
                  }).join('')
                : `<div class="no-emails-placeholder"><p>Chưa có email nào được liên kết.</p></div>`
              }
            </div>
          </div>

          <!-- Role & Permissions Details -->
          <div class="profile-card permissions-card">
            <h4 class="card-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Quyền hạn vai trò (${roleName})
            </h4>
            <div class="permissions-list-container">
              ${permissions.length > 0 
                ? `<div class="permissions-chips">
                    ${permissions.map(p => `<span class="perm-chip" title="${p.permissionName}">${p.permissionName}</span>`).join('')}
                   </div>`
                : `<div class="no-permissions-placeholder"><p>Không có quyền hạn cụ thể.</p></div>`
              }
            </div>
          </div>
        </div>
      `;
    }

    mountPoint.innerHTML = contentHtml;

    // Bind event handlers
    this.bindEvents();
  },

  bindEvents() {
    const startEditBtn = document.getElementById('btn-start-edit');
    const cancelEditBtn = document.getElementById('btn-cancel-edit');
    const editForm = document.getElementById('profile-edit-form');
    const avatarTrigger = document.getElementById('avatar-edit-trigger');
    const avatarInput = document.getElementById('profile-avatar-file-input');
    const avatarPreview = document.getElementById('edit-avatar-preview');

    if (startEditBtn) {
      startEditBtn.addEventListener('click', () => {
        this.isEditing = true;
        this.selectedAvatarFile = null;
        this.tempAvatarPreview = null;
        this.fetchAndRender();
      });
    }

    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => {
        this.isEditing = false;
        this.selectedAvatarFile = null;
        this.tempAvatarPreview = null;
        this.fetchAndRender();
      });
    }

    if (avatarTrigger && avatarInput) {
      avatarTrigger.addEventListener('click', () => {
        avatarInput.click();
      });
    }

    if (avatarInput) {
      avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          this.selectedAvatarFile = file;
          const reader = new FileReader();
          reader.onload = (event) => {
            this.tempAvatarPreview = event.target.result;
            if (avatarPreview) {
              avatarPreview.src = event.target.result;
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }

    if (editForm) {
      editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSaveProfile();
      });
    }
  },

  async handleSaveProfile() {
    const editFullname = document.getElementById('edit-fullname').value.trim();
    const editUsername = document.getElementById('edit-username').value.trim();
    const editBirthday = document.getElementById('edit-birthday').value;
    const editGender = document.querySelector('input[name="edit-gender"]:checked').value;

    const loadingOverlay = document.getElementById('profile-loading');
    const loadingText = document.getElementById('profile-loading-text');

    const toggleLoading = (isActive, msg = 'Đang xử lý...') => {
      if (loadingText) loadingText.textContent = msg;
      if (loadingOverlay) {
        if (isActive) loadingOverlay.classList.add('active');
        else loadingOverlay.classList.remove('active');
      }
    };

    toggleLoading(true, 'Đang chuẩn bị cập nhật...');

    let avatarUrl = this.profile.avatarUrl;
    let avatarId = this.profile.avatarId;

    try {
      // 1. Upload new image if chosen
      if (this.selectedAvatarFile) {
        toggleLoading(true, 'Đang tải ảnh đại diện lên máy chủ...');
        const uploadResponse = await api.uploadImage(this.selectedAvatarFile, 'avatars');
        
        if (!uploadResponse.success) {
          toggleLoading(false);
          await showDialog({
            title: 'Lỗi tải ảnh',
            message: uploadResponse.message || 'Không thể tải ảnh đại diện lên máy chủ.',
            type: 'error'
          });
          return;
        }

        avatarUrl = uploadResponse.data.publicUrl;
        avatarId = uploadResponse.data.publicId;
      }

      // 2. Put profile details
      toggleLoading(true, 'Đang lưu thông tin cá nhân...');
      
      const payload = {
        fullName: editFullname,
        username: editUsername,
        birthday: editBirthday,
        gender: editGender,
        avatarUrl: avatarUrl,
        avatarId: avatarId,
        // Compatibility variables
        publicUrl: avatarUrl,
        publicId: avatarId
      };

      const response = await api.put('profiles', payload);
      toggleLoading(false);

      if (!response.success) {
        await showDialog({
          title: 'Lỗi cập nhật',
          message: Array.isArray(response.data) ? response.data.join(', ') : (response.message || 'Không thể cập nhật hồ sơ.'),
          type: 'error'
        });
        return;
      }

      // 3. Update local copy with the updated fields and toggle edit mode off
      if (this.profile) {
        this.profile.fullName = editFullname;
        this.profile.username = editUsername;
        this.profile.birthday = editBirthday;
        this.profile.gender = editGender;
        this.profile.avatarUrl = avatarUrl;
        this.profile.avatarId = avatarId;
        this.profile.updatedAt = new Date().toISOString();
      }
      this.isEditing = false;
      this.selectedAvatarFile = null;
      this.tempAvatarPreview = null;

      await showDialog({
        title: 'Cập nhật thành công',
        message: 'Thông tin cá nhân của bạn đã được thay đổi thành công.',
        type: 'success',
        buttons: [{ text: 'Đồng ý', type: 'primary', value: true }]
      });

      // Refresh view locally
      await this.fetchAndRender(false);

    } catch (err) {
      toggleLoading(false);
      console.error(err);
      await showDialog({
        title: 'Lỗi hệ thống',
        message: err.message || 'Có lỗi hệ thống xảy ra khi lưu thông tin.',
        type: 'error'
      });
    }
  },

  formatDate(dateStr) {
    if (!dateStr) return 'Chưa cập nhật';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
      return dateStr;
    }
  },

  formatDateTime(instantStr) {
    if (!instantStr) return 'Chưa cập nhật';
    try {
      const d = new Date(instantStr);
      if (isNaN(d.getTime())) return instantStr;
      return d.toLocaleString('vi-VN', {
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
    if (!gender) return 'Chưa cập nhật';
    const mapping = {
      MALE: 'Nam',
      FEMALE: 'Nữ',
      OTHER: 'Khác'
    };
    return mapping[String(gender).toUpperCase()] || gender;
  },

  formatStatus(status) {
    if (!status) return 'Chưa xác thực';
    const mapping = {
      ACTIVE: 'Đang hoạt động',
      INACTIVE:'CHờ xác thực tài khoản',
      LOCKED: 'Đã khóa',
      BANNED: 'Đã bị cấm',
      PENDING: 'Đang chờ duyệt'
    };
    return mapping[String(status).toUpperCase()] || status;
  }
};

export default ProfileView;
