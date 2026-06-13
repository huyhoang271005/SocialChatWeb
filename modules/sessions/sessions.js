import { api } from '../../js/core/api.js';
import { showDialog } from '../../js/shared/dialog/dialog.js';

export const SessionsView = {
  sessionsList: [],
  size: 5,
  lastId: null,
  hasMore: false,
  loading: false,
  error: null,

  render() {
    return `
      <div class="sessions-dashboard">
        <div class="sessions-header">
          <div class="sessions-header-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-color)">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
            <h2>Hoạt động & Phiên đăng nhập</h2>
          </div>
        </div>

        <div id="sessions-list-mount">
          <div class="sessions-loading-state">
            <div class="spinner"></div>
            <p>Đang tải danh sách phiên đăng nhập...</p>
          </div>
        </div>

        <div id="sessions-pagination-mount" class="sessions-pagination-container"></div>
      </div>
    `;
  },

  async init(router) {
    this.sessionsList = [];
    this.lastId = null;
    this.hasMore = false;
    this.loading = false;
    this.error = null;

    await this.loadSessions(false);
  },

  async loadSessions(nextPage = false) {
    if (this.loading) return;
    this.loading = true;
    this.error = null;

    const listMount = document.getElementById('sessions-list-mount');
    if (!nextPage && listMount) {
      listMount.innerHTML = `
        <div class="sessions-loading-state">
          <div class="spinner"></div>
          <p>Đang tải danh sách phiên đăng nhập...</p>
        </div>
      `;
    }

    try {
      let endpoint = `sessions?size=${this.size}`;
      if (nextPage && this.lastId) {
        endpoint += `&lastId=${encodeURIComponent(this.lastId)}`;
      }

      const response = await api.get(endpoint);

      if (response && response.success && response.data) {
        const listData = Array.isArray(response.data) ? response.data : (response.data.data || []);
        this.hasMore = response.data.hasMore === true;

        // Lưu lastId của bản ghi cuối trong response thô trước khi gộp và sắp xếp để tránh lệch pagination
        if (listData.length > 0) {
          const lastSession = listData[listData.length - 1];
          this.lastId = lastSession.sessionId;
        } else if (!nextPage) {
          this.lastId = null;
        }

        if (nextPage) {
          this.sessionsList = [...this.sessionsList, ...listData];
        } else {
          this.sessionsList = listData;
        }

        // Đưa phiên hiện tại (mySession === true) lên đầu danh sách
        this.sessionsList.sort((a, b) => {
          if (a.mySession && !b.mySession) return -1;
          if (!a.mySession && b.mySession) return 1;
          return 0;
        });
      } else {
        throw new Error(response?.message || 'Không thể tải danh sách phiên đăng nhập.');
      }
    } catch (err) {
      console.error(err);
      this.error = err.message || 'Lỗi kết nối máy chủ.';
    } finally {
      this.loading = false;
      this.renderList();
    }
  },

  renderList() {
    const listMount = document.getElementById('sessions-list-mount');
    const paginationMount = document.getElementById('sessions-pagination-mount');
    if (!listMount) return;

    if (this.error) {
      listMount.innerHTML = `
        <div class="sessions-error-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--error)">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>${this.error}</p>
          <button id="btn-retry-sessions" class="btn btn-primary" style="width: auto; margin-top: 15px;">Thử lại</button>
        </div>
      `;
      const retryBtn = document.getElementById('btn-retry-sessions');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => this.loadSessions(false));
      }
      if (paginationMount) paginationMount.innerHTML = '';
      return;
    }

    if (this.sessionsList.length === 0) {
      listMount.innerHTML = `
        <div class="sessions-empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--text-muted)">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <p>Không tìm thấy phiên làm việc nào.</p>
        </div>
      `;
      if (paginationMount) paginationMount.innerHTML = '';
      return;
    }

    listMount.innerHTML = `
      <div class="sessions-list">
        ${this.sessionsList.map(session => this.renderSessionCard(session)).join('')}
      </div>
    `;

    // Hiển thị nút phân trang "Xem thêm"
    if (paginationMount) {
      if (this.hasMore) {
        paginationMount.innerHTML = `
          <button id="btn-load-more-sessions" class="btn btn-secondary">
            ${this.loading ? '<div class="spinner-sm"></div> Đang tải...' : 'Xem thêm'}
          </button>
        `;
        const loadMoreBtn = document.getElementById('btn-load-more-sessions');
        if (loadMoreBtn && !this.loading) {
          loadMoreBtn.addEventListener('click', () => this.loadSessions(true));
        }
      } else {
        paginationMount.innerHTML = '';
      }
    }

    this.bindItemEvents();
  },

  renderSessionCard(session) {
    const isCurrent = session.mySession === true;
    const device = session.device || {};
    const deviceName = device.deviceName || 'Thiết bị không xác định';
    const userAgent = device.userAgent || '';
    
    // Phân tích User Agent hiển thị OS & Trình duyệt
    let osBrowserText = device.deviceType || 'Thiết bị';
    if (userAgent) {
      const parsed = this.parseUserAgent(userAgent);
      osBrowserText = `${parsed.os} • ${parsed.browser}`;
    }

    // Lấy Icon phù hợp
    const deviceIcon = this.getDeviceIcon(device.deviceType, userAgent);
    
    // Nhãn trạng thái (Badges)
    let badgesHtml = '';
    if (session.validated) {
      badgesHtml += `<span class="session-badge badge-validated">Đã xác thực</span> `;
    }
    if (session.revoked) {
      badgesHtml += `<span class="session-badge badge-revoked">Đã thu hồi</span>`;
    } else {
      badgesHtml += `<span class="session-badge badge-active">Hoạt động</span>`;
    }

    // Các nút hành động
    const actionButtons = [];
    
    // Luôn thêm nút xem lịch sử xác thực bảo mật cho tất cả các phiên
    actionButtons.push(`
      <button class="btn-action-verify-history" data-id="${session.sessionId}" title="Hiện lịch sử xác thực">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      </button>
    `);

    if (!isCurrent) {
      if (!session.revoked) {
        actionButtons.push(`
          <button class="btn-action-logout" data-id="${session.sessionId}" title="Đăng xuất thiết bị">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        `);
      }
      
      actionButtons.push(`
        <button class="btn-action-delete" data-id="${session.sessionId}" title="Xóa phiên đăng nhập">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            <line x1="10" y1="11" x2="10" y2="17"></line>
            <line x1="14" y1="11" x2="14" y2="17"></line>
          </svg>
        </button>
      `);
    }

    return `
      <div class="session-card ${isCurrent ? 'current-session' : ''} ${session.revoked ? 'revoked' : ''}" id="session-card-${session.sessionId}">
        <div class="session-main-row">
          <div class="session-device-info">
            <div class="device-icon-container">
              ${deviceIcon}
            </div>
            <div class="device-details-text">
              <div class="device-title-row">
                <span class="device-name">${deviceName}</span>
                ${isCurrent ? '<span class="current-session-badge">Thiết bị hiện tại</span>' : ''}
                ${badgesHtml}
              </div>
              <div class="device-meta-row">
                <div class="meta-item" title="Hệ điều hành & Trình duyệt">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                  <span>${osBrowserText}</span>
                </div>
                <div class="meta-item" title="Địa chỉ IP">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                  <span>${session.ipAddress || 'IP ẩn'}</span>
                </div>
                ${session.location ? `
                  <div class="meta-item" title="Vị trí">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span>${session.location}</span>
                  </div>
                ` : ''}
              </div>
              <div class="device-time-row">
                <span>Đăng nhập lần đầu: ${this.formatDateTime(session.createdAt)}</span>
                <span>Đăng nhập lần cuối: ${this.formatDateTime(session.lastLogin)}</span>
              </div>
              ${isCurrent ? `
                <div style="font-size: 0.78rem; color: var(--accent-color); margin-top: 6px; font-weight: 500; display: flex; align-items: center; gap: 4px;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <span>Đây là phiên làm việc hiện tại của bạn. Không thể đăng xuất hoặc xóa phiên này.</span>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="session-actions">
            ${actionButtons.join('')}
          </div>
        </div>
        <div class="session-verifications-container" id="verifications-${session.sessionId}" style="display: none;"></div>
      </div>
    `;
  },

  bindItemEvents() {
    const listMount = document.getElementById('sessions-list-mount');
    if (!listMount) return;

    // Sự kiện thu hồi / đăng xuất
    const logoutBtns = listMount.querySelectorAll('.btn-action-logout');
    logoutBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.handleRevoke(id);
      });
    });

    // Sự kiện xóa phiên làm việc
    const deleteBtns = listMount.querySelectorAll('.btn-action-delete');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.handleDelete(id);
      });
    });

    // Sự kiện toggle lịch sử xác thực
    const verifyBtns = listMount.querySelectorAll('.btn-action-verify-history');
    verifyBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.toggleVerifications(id);
      });
    });
  },

  async handleRevoke(sessionId) {
    const confirm = await showDialog({
      title: 'Đăng xuất thiết bị',
      message: 'Bạn có chắc chắn muốn đăng xuất khỏi thiết bị này? Phiên làm việc sẽ bị vô hiệu hóa ngay lập tức.',
      type: 'warning',
      buttons: [
        { text: 'Hủy', type: 'secondary', value: false },
        { text: 'Đăng xuất', type: 'danger', value: true }
      ]
    });

    if (!confirm) return;

    try {
      // Gọi API PATCH /sessions/revoke/{sessionId}
      const response = await api.patch(`sessions/revoke/${sessionId}`);

      if (response && response.success) {
        await showDialog({
          title: 'Đăng xuất thành công',
          message: 'Đã vô hiệu hóa phiên đăng nhập thành công.',
          type: 'success',
          buttons: [{ text: 'Đồng ý', type: 'primary', value: true }]
        });

        // Cập nhật trạng thái trực tiếp trên UI
        const index = this.sessionsList.findIndex(s => s.sessionId === sessionId);
        if (index !== -1) {
          this.sessionsList[index].revoked = true;
          this.renderList();
        }
      } else {
        throw new Error(response?.message || 'Không thể đăng xuất phiên làm việc.');
      }
    } catch (err) {
      console.error(err);
      await showDialog({
        title: 'Lỗi hệ thống',
        message: err.message || 'Không thể thu hồi phiên đăng nhập. Vui lòng thử lại sau.',
        type: 'error'
      });
    }
  },

  async handleDelete(sessionId) {
    const confirm = await showDialog({
      title: 'Xóa phiên đăng nhập',
      message: 'Bạn có chắc chắn muốn xóa hẳn phiên đăng nhập này khỏi lịch sử hoạt động?',
      type: 'warning',
      buttons: [
        { text: 'Hủy', type: 'secondary', value: false },
        { text: 'Xóa phiên', type: 'danger', value: true }
      ]
    });

    if (!confirm) return;

    try {
      // Gọi API DELETE /sessions/{sessionId}
      const response = await api.delete(`sessions/${sessionId}`);

      if (response && response.success) {
        await showDialog({
          title: 'Xóa thành công',
          message: 'Đã xóa thông tin phiên đăng nhập khỏi lịch sử hoạt động.',
          type: 'success',
          buttons: [{ text: 'Đồng ý', type: 'primary', value: true }]
        });

        // Loại bỏ phần tử khỏi danh sách local
        this.sessionsList = this.sessionsList.filter(s => s.sessionId !== sessionId);
        
        // Cập nhật lại lastId cho lần phân trang kế tiếp
        if (this.sessionsList.length > 0) {
          const lastSession = this.sessionsList[this.sessionsList.length - 1];
          this.lastId = lastSession.sessionId;
        } else {
          this.lastId = null;
        }

        this.renderList();
      } else {
        throw new Error(response?.message || 'Không thể xóa phiên đăng nhập.');
      }
    } catch (err) {
      console.error(err);
      await showDialog({
        title: 'Lỗi hệ thống',
        message: err.message || 'Không thể xóa phiên đăng nhập. Vui lòng thử lại sau.',
        type: 'error'
      });
    }
  },

  getDeviceIcon(deviceType, userAgent) {
    const type = String(deviceType || '').toUpperCase();
    const agent = String(userAgent || '').toLowerCase();

    const isMobile = type === 'MOBILE' || agent.includes('iphone') || agent.includes('android') || agent.includes('mobile');
    const isTablet = type === 'TABLET' || agent.includes('ipad') || agent.includes('tablet');

    if (isMobile) {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
          <line x1="12" y1="18" x2="12.01" y2="18"></line>
        </svg>
      `;
    }

    if (isTablet) {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" transform="rotate(90 12 12)"></rect>
          <line x1="12" y1="20" x2="12.01" y2="20"></line>
        </svg>
      `;
    }

    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="8" y1="21" x2="16" y2="21"></line>
        <line x1="12" y1="17" x2="12" y2="21"></line>
      </svg>
    `;
  },

  parseUserAgent(ua) {
    let os = 'Hệ điều hành ẩn';
    let browser = 'Trình duyệt ẩn';

    if (/windows/i.test(ua)) os = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
    else if (/android/i.test(ua)) os = 'Android';

    if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr|opera/i.test(ua)) browser = 'Chrome';
    else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) browser = 'Safari';
    else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
    else if (/edge|edg/i.test(ua)) browser = 'Edge';
    else if (/opr|opera/i.test(ua)) browser = 'Opera';

    return { os, browser };
  },

  formatDateTime(instantStr) {
    if (!instantStr) return 'Chưa ghi nhận';
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

  async toggleVerifications(sessionId) {
    const btn = document.querySelector(`.btn-action-verify-history[data-id="${sessionId}"]`);
    const container = document.getElementById(`verifications-${sessionId}`);
    if (!container || !btn) return;

    const isVisible = container.style.display === 'block';

    if (isVisible) {
      container.style.display = 'none';
      btn.classList.remove('active');
      btn.title = 'Hiện lịch sử xác thực';
    } else {
      btn.classList.add('active');
      btn.title = 'Ẩn lịch sử xác thực';
      container.style.display = 'block';

      const session = this.sessionsList.find(s => s.sessionId === sessionId);
      if (!session) return;

      // Nếu đã có danh sách đã lưu (cache), tái sử dụng, không gọi API nữa
      if (session.verifications) {
        this.renderVerifications(session, container);
      } else {
        container.innerHTML = `
          <div class="verifications-loading-state">
            <div class="spinner-sm"></div>
            <p style="margin-top: 8px;">Đang tải lịch sử xác thực...</p>
          </div>
        `;

        try {
          const response = await api.get(`verifications/session/${sessionId}`);
          if (response && response.success) {
            // Chấp nhận cả array trực tiếp lẫn ResponseList wrapper
            session.verifications = Array.isArray(response.data) ? response.data : (response.data?.data || response.data || []);
            this.renderVerifications(session, container);
          } else {
            throw new Error(response?.message || 'Không thể tải lịch sử xác thực từ máy chủ.');
          }
        } catch (err) {
          console.error(err);
          container.innerHTML = `
            <div class="verifications-error-state">
              <span style="color: var(--error); font-weight: 500;">Không thể tải lịch sử xác thực</span>
              <p>${err.message || 'Lỗi kết nối.'}</p>
              <button class="btn btn-secondary btn-retry-verify" data-id="${sessionId}" style="padding: 6px 12px; font-size: 0.78rem; width: auto; margin-top: 10px;">Thử lại</button>
            </div>
          `;
          const retryBtn = container.querySelector('.btn-retry-verify');
          if (retryBtn) {
            retryBtn.addEventListener('click', () => {
              session.verifications = null;
              this.toggleVerifications(sessionId);
            });
          }
        }
      }
    }
  },

  renderVerifications(session, container) {
    const list = session.verifications || [];
    if (list.length === 0) {
      container.innerHTML = `
        <div class="verifications-empty-state">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
            <line x1="12" y1="16" x2="12" y2="12"></line>
          </svg>
          <p style="margin-top: 8px;">Không tìm thấy lịch sử xác thực nào cho phiên này.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="verifications-title-row">
        <h4>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          </svg>
          Lịch sử xác thực bảo mật (${list.length})
        </h4>
      </div>
      <div class="verifications-list">
        ${list.map(v => {
          const typeLabel = this.formatVerificationType(v.verificationType);
          const icon = this.getVerificationTypeIcon(v.verificationType);
          const statusClass = `v-${(v.verificationStatus || 'pending').toLowerCase()}`;
          const statusLabel = this.formatVerificationStatus(v.verificationStatus);
          
          return `
            <div class="verification-row">
              <div class="verification-left">
                <div class="verification-type-icon">
                  ${icon}
                </div>
                <div class="verification-details">
                  <span class="verification-type">${typeLabel}</span>
                  <span class="verification-time">
                    Khởi tạo: ${this.formatDateTime(v.createdAt)}
                    ${v.usedAt ? ` • Xác minh: ${this.formatDateTime(v.usedAt)}` : ' • Chưa sử dụng'}
                  </span>
                </div>
              </div>
              <span class="verification-badge ${statusClass}">${statusLabel}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  formatVerificationType(type) {
    if (!type) return 'Phương thức xác thực';
    const mapping = {
      VERIFICATION_EMAIL: 'Xác thực Email',
      VERIFICATION_DEVICE: 'Xác minh Thiết bị mới',
      VERIFICATION_RESET_PASSWORD: 'Đặt lại Mật khẩu'
    };
    return mapping[String(type).toUpperCase()] || `Xác thực ${type}`;
  },

  getVerificationTypeIcon(type) {
    const t = String(type || '').toUpperCase();
    if (t.includes('EMAIL')) {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
      `;
    }
    if (t.includes('DEVICE')) {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      `;
    }
    // Mặc định hoặc Khôi phục mật khẩu
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    `;
  },

  formatVerificationStatus(status) {
    if (!status) return 'Chờ xử lý';
    const mapping = {
      PENDING: 'Chờ xác thực',
      USED: 'Đã sử dụng',
      EXPIRED: 'Đã hết hạn',
      CANCELLED: 'Đã hủy bỏ'
    };
    return mapping[String(status).toUpperCase()] || status;
  }
};

export default SessionsView;
