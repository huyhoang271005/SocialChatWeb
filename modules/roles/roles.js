import { api } from '../../js/core/api.js';
import { showDialog } from '../../js/shared/dialog/dialog.js';

export const RolesView = {
  roles: [],
  permissions: [],
  editingRoleId: null,

  render() {
    return `
      <div class="roles-dashboard">
        <div class="roles-header">
          <div class="roles-header-title">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-color)">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            </svg>
            <h2>Quản lý Roles & Permissions</h2>
          </div>
        </div>

        <div class="roles-layout">
          <!-- Left Section: Roles List -->
          <div class="roles-section">
            <h3 class="form-title">Danh sách Vai trò</h3>
            <div id="roles-list" class="roles-list-container">
              <div class="no-roles-fallback">
                <div class="spinner" style="margin: 0 auto 12px;"></div>
                Đang tải danh sách vai trò...
              </div>
            </div>
          </div>

          <!-- Right Section: Add/Edit Form -->
          <div class="roles-section">
            <h3 id="form-header-title" class="form-title">Thêm Vai trò mới</h3>
            <form id="role-form">
              <div class="form-group">
                <label class="form-label" for="input-role-name">Tên vai trò (Role Name)</label>
                <input type="text" id="input-role-name" class="form-input" placeholder="Ví dụ: ADMIN, MANAGER, USER..." required>
              </div>

              <div class="form-group">
                <label class="form-label">Gán quyền hạn (Permissions)</label>
                <div id="permissions-grid" class="permissions-select-grid">
                  <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--text-muted);">
                    Đang tải quyền hạn...
                  </div>
                </div>
              </div>

              <div style="display: flex; gap: 12px; margin-top: 25px;">
                <button type="submit" id="btn-submit-form" class="btn btn-primary" style="flex: 1;">Xác nhận</button>
                <button type="button" id="btn-cancel-edit" class="btn btn-secondary" style="flex: 1; display: none;">Hủy</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  },

  async init(router) {
    const roleForm = document.getElementById('role-form');
    const inputRoleName = document.getElementById('input-role-name');
    const cancelEditBtn = document.getElementById('btn-cancel-edit');
    const formHeaderTitle = document.getElementById('form-header-title');

    // Default system permissions fallback
    const defaultPermissions = [
      { permissionId: '1', permissionName: 'VIEW_CHAT' },
      { permissionId: '2', permissionName: 'SEND_MESSAGE' },
      { permissionId: '3', permissionName: 'DELETE_MESSAGE' },
      { permissionId: '4', permissionName: 'MANAGE_USERS' },
      { permissionId: '5', permissionName: 'MANAGE_ROLES' }
    ];

    // Load initial data
    await this.loadData(defaultPermissions);

    // Form Submit Handler
    if (roleForm) {
      roleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleFormSubmit();
      });
    }

    // Cancel Edit Handler
    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => {
        this.resetForm();
      });
    }
  },

  /**
   * Load roles and permissions from API
   */
  async loadData(fallbackPermissions) {
    try {
      // 1. Fetch permissions
      const permResponse = await api.get('roles/permissions');
      if (permResponse && permResponse.success && Array.isArray(permResponse.data)) {
        this.permissions = permResponse.data;
      } else {
        console.warn('[Roles] Không tải được permissions từ API, sử dụng cấu hình mặc định.');
        this.permissions = fallbackPermissions;
      }
    } catch (err) {
      console.error('[Roles] Lỗi tải permissions:', err);
      this.permissions = fallbackPermissions;
    }

    // Render permissions check list
    this.renderPermissionsGrid();

    try {
      // 2. Fetch roles
      const rolesResponse = await api.get('roles');
      if (rolesResponse && rolesResponse.success && Array.isArray(rolesResponse.data)) {
        this.roles = rolesResponse.data;
      } else {
        console.warn('[Roles] Không tải được danh sách roles từ API, hiển thị trống.');
        this.roles = [];
      }
    } catch (err) {
      console.error('[Roles] Lỗi tải roles:', err);
      this.roles = [];
    }

    // Render roles list
    this.renderRolesList();
  },

  /**
   * Render checkboxes for permissions selection
   */
  renderPermissionsGrid() {
    const grid = document.getElementById('permissions-grid');
    if (!grid) return;

    if (this.permissions.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--text-muted);">
          Không có quyền hạn nào được cấu hình
        </div>
      `;
      return;
    }

    grid.innerHTML = this.permissions.map(perm => {
      // Ensure we have a string ID for values
      const permId = perm.permissionId;
      const permName = perm.permissionName;
      return `
        <label class="permission-checkbox-label" for="chk-perm-${permId}">
          <input type="checkbox" id="chk-perm-${permId}" class="perm-checkbox" value="${permId}" data-name="${permName}">
          <span class="permission-checkbox-text">${permName}</span>
        </label>
      `;
    }).join('');
  },

  /**
   * Render the list of roles on the left panel
   */
  renderRolesList() {
    const container = document.getElementById('roles-list');
    if (!container) return;

    if (this.roles.length === 0) {
      container.innerHTML = `
        <div class="no-roles-fallback">
          Chưa có vai trò nào được cấu hình.
        </div>
      `;
      return;
    }

    container.innerHTML = this.roles.map(role => {
      const isSystemAdmin = role.roleName === 'ADMIN' || role.roleName === 'SUPERADMIN';
      const isDeleted = role.deletedAt !== null && role.deletedAt !== undefined;
      const permsHtml = Array.isArray(role.permissions) && role.permissions.length > 0
        ? role.permissions.map(p => `<span class="permission-tag">${p.permissionName}</span>`).join('')
        : `<span class="permission-tag" style="background: hsla(350, 0%, 50%, 0.1); color: var(--text-muted); border: 1px dashed hsla(0, 0%, 50%, 0.2)">Không có quyền</span>`;

      // Set actions and style variables depending on soft-deleted state
      const actionsHtml = isDeleted
        ? `
          <button class="btn-icon restore btn-restore-role" data-id="${role.roleId}" title="Phục hồi vai trò">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <polyline points="3 3 3 8 8 8"/>
            </svg>
          </button>
        `
        : `
          <button class="btn-icon btn-edit-role" data-id="${role.roleId}" title="Chỉnh sửa">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
            </svg>
          </button>
          <button class="btn-icon delete btn-delete-role" data-id="${role.roleId}" title="Xóa">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        `;

      const titleBadge = isDeleted ? `<span class="deleted-role-badge">Đã xóa</span>` : '';
      let deleteInfoHtml = '';
      if (isDeleted) {
        try {
          const localDeletedAt = new Date(role.deletedAt).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          deleteInfoHtml = `<div class="role-delete-info">Đã xóa: ${localDeletedAt} • Sẽ bị xóa vĩnh viễn sau 7 ngày</div>`;
        } catch (e) {
          deleteInfoHtml = `<div class="role-delete-info">Đã xóa • Sẽ bị xóa vĩnh viễn sau 7 ngày</div>`;
        }
      }

      return `
        <div class="role-card ${isDeleted ? 'deleted' : ''}" id="role-card-${role.roleId}">
          <div class="role-card-header">
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
              <span class="role-name-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: ${isDeleted ? 'var(--text-muted)' : (isSystemAdmin ? 'var(--error)' : 'var(--accent-color)')}">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
                ${role.roleName}
                ${titleBadge}
              </span>
              ${deleteInfoHtml}
            </div>
            <div class="role-actions">
              ${actionsHtml}
            </div>
          </div>
          <div class="permissions-tags">
            ${permsHtml}
          </div>
        </div>
      `;
    }).join('');

    // Bind Edit Action Click
    const editBtns = container.querySelectorAll('.btn-edit-role');
    editBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const roleId = btn.dataset.id;
        this.startEditMode(roleId);
      });
    });

    // Bind Delete Action Click
    const deleteBtns = container.querySelectorAll('.btn-delete-role');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const roleId = btn.dataset.id;
        this.confirmDeleteRole(roleId);
      });
    });

    // Bind Restore Action Click
    const restoreBtns = container.querySelectorAll('.btn-restore-role');
    restoreBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const roleId = btn.dataset.id;
        this.confirmRestoreRole(roleId);
      });
    });
  },

  /**
   * Enter edit mode for a specific role
   */
  startEditMode(roleId) {
    const role = this.roles.find(r => String(r.roleId) === String(roleId));
    if (!role) return;

    this.editingRoleId = role.roleId;

    // UI Updates
    document.getElementById('form-header-title').textContent = 'Cập nhật Vai trò';
    document.getElementById('input-role-name').value = role.roleName;
    document.getElementById('btn-cancel-edit').style.display = 'inline-flex';

    // Reset all checkboxes first
    const checkboxes = document.querySelectorAll('.perm-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });

    // Check permissions that are assigned to this role
    if (Array.isArray(role.permissions)) {
      role.permissions.forEach(p => {
        const cb = document.getElementById(`chk-perm-${p.permissionId}`);
        if (cb) cb.checked = true;
      });
    }

    // Scroll form into view if on mobile
    document.getElementById('role-form').scrollIntoView({ behavior: 'smooth' });
  },

  /**
   * Reset form fields and cancel edit mode
   */
  resetForm() {
    this.editingRoleId = null;
    document.getElementById('form-header-title').textContent = 'Thêm Vai trò mới';
    document.getElementById('input-role-name').value = '';
    document.getElementById('btn-cancel-edit').style.display = 'none';

    const checkboxes = document.querySelectorAll('.perm-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
  },

  /**
   * Submit form to either add or update role
   */
  async handleFormSubmit() {
    const inputRoleName = document.getElementById('input-role-name');
    const roleName = inputRoleName.value.trim();
    if (!roleName) return;

    // Gather selected permissions
    const selectedPermissions = Array.from(document.querySelectorAll('.perm-checkbox:checked'))
      .map(cb => ({
        permissionId: cb.value,
        permissionName: cb.dataset.name || ''
      }));

    try {
      if (this.editingRoleId !== null) {
        // UPDATE ROLE (PUT roles)
        const payload = {
          roleId: this.editingRoleId,
          roleName,
          permissions: selectedPermissions
        };

        const response = await api.put('roles', payload);
        if (response && response.success) {
          await showDialog({
            title: 'Cập nhật thành công',
            message: `Vai trò "${roleName}" đã được cập nhật thành công.`,
            type: 'success',
            buttons: [{ text: 'Đóng', type: 'primary', value: true }]
          });
          const updatedRole = response.data;
          if (updatedRole) {
            const index = this.roles.findIndex(r => String(r.roleId) === String(this.editingRoleId));
            if (index !== -1) {
              this.roles[index] = updatedRole;
            }
          }
          this.resetForm();
          this.renderRolesList();
        } else {
          throw new Error(response?.message || 'Có lỗi xảy ra khi cập nhật vai trò');
        }
      } else {
        // ADD ROLE (POST roles)
        const payload = {
          roleName,
          permissions: selectedPermissions
        };

        const response = await api.post('roles', payload);
        if (response && response.success) {
          await showDialog({
            title: 'Thêm thành công',
            message: `Vai trò "${roleName}" đã được thêm thành công.`,
            type: 'success',
            buttons: [{ text: 'Đóng', type: 'primary', value: true }]
          });
          const newRole = response.data;
          if (newRole) {
            this.roles.push(newRole);
          }
          this.resetForm();
          this.renderRolesList();
        } else {
          throw new Error(response?.message || 'Có lỗi xảy ra khi thêm vai trò');
        }
      }
    } catch (err) {
      console.error('[Roles] Lỗi khi lưu vai trò:', err);
      await showDialog({
        title: 'Lỗi hệ thống',
        message: err.message || 'Không thể lưu vai trò. Vui lòng thử lại sau.',
        type: 'error',
        buttons: [{ text: 'Đồng ý', type: 'primary', value: true }]
      });
    }
  },

  /**
   * Open confirmation dialog before deleting role
   */
  async confirmDeleteRole(roleId) {
    const role = this.roles.find(r => String(r.roleId) === String(roleId));
    if (!role) return;

    const confirm = await showDialog({
      title: 'Xác nhận xóa',
      message: `Bạn có chắc chắn muốn xóa vai trò "${role.roleName}"? Hành động này không thể hoàn tác.`,
      type: 'warning',
      buttons: [
        { text: 'Hủy', type: 'secondary', value: false },
        { text: 'Xóa vai trò', type: 'danger', value: true }
      ]
    });

    if (confirm) {
      try {
        const response = await api.delete(`roles/${roleId}`);
        if (response && response.success) {
          await showDialog({
            title: 'Đã xóa',
            message: `Vai trò "${role.roleName}" đã được xóa thành công.`,
            type: 'success',
            buttons: [{ text: 'Đóng', type: 'primary', value: true }]
          });
          if (this.editingRoleId === roleId) {
            this.resetForm();
          }
          const roleIndex = this.roles.findIndex(r => String(r.roleId) === String(roleId));
          if (roleIndex !== -1) {
            const deletedRole = response.data;
            this.roles[roleIndex].deletedAt = (deletedRole && deletedRole.deletedAt) || new Date().toISOString();
          }
          this.renderRolesList();
        } else {
          throw new Error(response?.message || 'Có lỗi xảy ra khi xóa vai trò');
        }
      } catch (err) {
        console.error('[Roles] Lỗi khi xóa vai trò:', err);
        await showDialog({
          title: 'Lỗi xóa vai trò',
          message: err.message || 'Không thể xóa vai trò. Vui lòng thử lại sau.',
          type: 'error',
          buttons: [{ text: 'Đồng ý', type: 'primary', value: true }]
        });
      }
    }
  },

  /**
   * Open confirmation dialog before restoring a soft-deleted role
   */
  async confirmRestoreRole(roleId) {
    const role = this.roles.find(r => String(r.roleId) === String(roleId));
    if (!role) return;

    const confirm = await showDialog({
      title: 'Xác nhận phục hồi',
      message: `Bạn có chắc chắn muốn phục hồi vai trò "${role.roleName}"?`,
      type: 'info',
      buttons: [
        { text: 'Hủy', type: 'secondary', value: false },
        { text: 'Phục hồi', type: 'primary', value: true }
      ]
    });

    if (confirm) {
      try {
        const response = await api.patch(`roles/restore/${roleId}`);
        if (response && response.success) {
          await showDialog({
            title: 'Phục hồi thành công',
            message: `Vai trò "${role.roleName}" đã được khôi phục thành công.`,
            type: 'success',
            buttons: [{ text: 'Đóng', type: 'primary', value: true }]
          });
          const roleIndex = this.roles.findIndex(r => String(r.roleId) === String(roleId));
          if (roleIndex !== -1) {
            this.roles[roleIndex].deletedAt = null;
          }
          this.renderRolesList();
        } else {
          throw new Error(response?.message || 'Có lỗi xảy ra khi phục hồi vai trò');
        }
      } catch (err) {
        console.error('[Roles] Lỗi khi phục hồi vai trò:', err);
        await showDialog({
          title: 'Lỗi phục hồi',
          message: err.message || 'Không thể phục hồi vai trò. Vui lòng thử lại sau.',
          type: 'error',
          buttons: [{ text: 'Đồng ý', type: 'primary', value: true }]
        });
      }
    }
  }
};

export default RolesView;
