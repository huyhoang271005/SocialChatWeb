import { CONFIG } from './config.js';

function handleApiResponse(responseJson) {
  if (responseJson && typeof responseJson === 'object') {
    // Auto save accessToken or token to sessionStorage if present
    let token = null;
    if (responseJson.data) {
      token = responseJson.data.accessToken;
    }

    if (token) {
      sessionStorage.setItem('chat_access_token', token);
    }

    return responseJson;
  }
}

let isRefreshing = false;
let refreshQueue = [];

function formatDateTimeInText(text) {
  if (!text || typeof text !== 'string') return text;
  // Regex to match ISO date-time strings
  const isoRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2}|[+-]\d{4})/g;
  return text.replace(isoRegex, (match) => {
    try {
      const d = new Date(match);
      if (isNaN(d.getTime())) return match;
      return d.toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return match;
    }
  });
}

export async function refreshAccessToken() {
  if (isRefreshing) {
    return new Promise((resolve) => {
      refreshQueue.push({ resolve });
    });
  }

  isRefreshing = true;

  try {
    const { showDialog } = await import('../shared/dialog/dialog.js');
    
    const res = await fetch(`${CONFIG.API_BASE_URL}/auth/refresh-token`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      }
    });

    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      // Body is not JSON
    }

    if (res.status === 401) {
      localStorage.setItem('chat_remember_me', 'false');
      sessionStorage.clear();
      
      const serverMsg = body && body.message ? formatDateTimeInText(body.message) : null;
      const displayMsg = serverMsg || 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.';
      
      const errorResult = {
        success: false,
        message: displayMsg,
        data: null
      };

      // Show dialog and wait for user to click OK before redirecting
      await showDialog({
        title: 'Phiên đăng nhập hết hạn',
        message: displayMsg,
        type: 'warning',
        buttons: [{ text: 'Đồng ý', type: 'primary', value: true }]
      });

      window.location.hash = '#login';

      refreshQueue.forEach(({ resolve }) => resolve(errorResult));
      refreshQueue = [];
      isRefreshing = false;
      return errorResult;
    }

    if (res.status === 503) {
      window.location.href = "/maintenance.html";
      return;
    }

    if (!res.ok || !body || !body.success) {
      const serverMsg = body && body.message ? formatDateTimeInText(body.message) : null;
      const displayMsg = serverMsg || 'Lỗi khi làm mới phiên đăng nhập';

      const errorResult = {
        success: false,
        message: displayMsg,
        data: null
      };

      await showDialog({
        title: 'Lỗi phiên đăng nhập',
        message: displayMsg,
        type: 'error'
      });

      refreshQueue.forEach(({ resolve }) => resolve(errorResult));
      refreshQueue = [];
      isRefreshing = false;
      return errorResult;
    }

    const token = body.data;
    const newAccessToken = token?.accessToken;

    if (newAccessToken) {
      sessionStorage.setItem('chat_access_token', newAccessToken);
    }

    refreshQueue.forEach(({ resolve }) => resolve(body));
    refreshQueue = [];
    isRefreshing = false;

    return body;
  } catch (error) {
    const errorResult = {
      success: false,
      message: error.message || 'Lỗi kết nối máy chủ khi làm mới phiên',
      data: null
    };

    try {
      const { showDialog } = await import('../shared/dialog/dialog.js');
      await showDialog({
        title: 'Lỗi kết nối',
        message: errorResult.message,
        type: 'error'
      });
    } catch (dialogErr) {
      console.error('Failed to show dialog:', dialogErr);
    }

    refreshQueue.forEach(({ resolve }) => resolve(errorResult));
    refreshQueue = [];
    isRefreshing = false;

    return errorResult;
  }
}

// Giữ lại tên cũ để tương thích ngược với các file import khác
export const handleTokenRefresh = refreshAccessToken;

function isPublicOrAuthRoute(endpoint) {
  const path = endpoint.replace(/^\//, '').split('?')[0];
  return path === 'auth' || path.startsWith('auth/') ||
         path === 'users/auth' || path.startsWith('users/auth/') ||
         path === 'profiles/auth' || path.startsWith('profiles/auth/') ||
         path === 'ws' || path.startsWith('ws/') ||
         path === 'verifications' || path.startsWith('verifications/');
}

async function request(endpoint, options = {}, alreadyRefreshed = false) {
  const url = `${CONFIG.API_BASE_URL}/${endpoint.replace(/^\//, '')}`;
  const headers = {
    "Accept": "*/*",
    ...options.headers
  };

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const isSkipAuth = isPublicOrAuthRoute(endpoint);

  if (!isSkipAuth) {
    let token = sessionStorage.getItem('chat_access_token');
    if (!token || token === 'null' || token === 'undefined') {
      const result = await refreshAccessToken();
      if (!result.success) {
        return result;
      }
      token = sessionStorage.getItem('chat_access_token');
    }
    if (token && token !== 'null' && token !== 'undefined') {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const method = options.method || 'GET';
  try {
    const fetchOptions = {
      method,
      headers,
      credentials: 'include'
    };
    if (options.body) fetchOptions.body = options.body;

    const res = await fetch(url, fetchOptions);
    const body = await res.json();

    // Tự động refresh token nếu gặp lỗi 401
    if (res.status === 401 && !alreadyRefreshed && !isSkipAuth) {
      const result = await refreshAccessToken();
      if (!result.success) {
        return result;
      }
      const newAccessToken = sessionStorage.getItem('chat_access_token');
      if (!options.headers) options.headers = {};
      options.headers["Authorization"] = `Bearer ${newAccessToken}`;
      return await request(endpoint, options, true);
    }

    if (res.status === 403) {
      setTimeout(() => {
        window.history.back();
      }, 5000);
    }

    if (res.status === 503) {
      window.location.href = "/maintenance.html";
      return;
    }

    // Lưu token nếu là API đăng nhập thành công
    if (isSkipAuth) {
      handleApiResponse(body);
    }

    return body;
  } catch (err) {
    console.error(err);
    return {
      success: false,
      message: "Lỗi kết nối đến server",
      data: null
    };
  }
}

const uploadCache = new Map();

export const api = {
  get: (endpoint, headers = {}) => request(endpoint, { method: 'GET', headers }),
  post: (endpoint, body, headers = {}) => request(endpoint, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body), headers }),
  put: (endpoint, body, headers = {}) => request(endpoint, { method: 'PUT', body: body instanceof FormData ? body : JSON.stringify(body), headers }),
  patch: (endpoint, body, headers = {}) => request(endpoint, { method: 'PATCH', body: body instanceof FormData ? body : JSON.stringify(body), headers }),
  delete: (endpoint, body = null, headers = {}) => request(endpoint, { method: 'DELETE', body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : null, headers }),

  uploadImage: async (file, folderName) => {
    if (!file) {
      return {
        success: false,
        message: 'File không hợp lệ',
        data: null
      };
    }

    const fileKey = `${file.name}_${file.size}_${file.type}_${file.lastModified}`;
    if (uploadCache.has(fileKey)) {
      return {
        success: true,
        data: uploadCache.get(fileKey)
      };
    }

    try {
      // 1. Get signature from backend
      const sigResponse = await request(`images/upload-signature/${folderName}`);
      if (!sigResponse || !sigResponse.success) {
        return {
          success: false,
          message: sigResponse?.message || 'Không lấy được chữ ký tải ảnh từ hệ thống',
          data: null
        };
      }

      const signatureData = sigResponse.data;
      if (!signatureData) {
        return {
          success: false,
          message: 'Không lấy được chữ ký tải ảnh từ hệ thống',
          data: null
        };
      }

      // 2. Prepare FormData for Cloudinary
      const formData = new FormData();
      formData.append('file', file);

      // Cloudinary expects snake_case keys (api_key, timestamp, signature, folder, etc.)
      const keyMapping = {
        apiKey: 'api_key',
        cloudName: 'cloud_name',
        uploadPreset: 'upload_preset',
      };

      Object.keys(signatureData).forEach(key => {
        if (key !== 'uploadUrl' && key !== 'cloudName' && key !== 'cloud_name') {
          const formKey = keyMapping[key] || key;
          formData.append(formKey, signatureData[key]);
        }
      });

      // 3. Determine upload URL
      const cloudName = signatureData.cloudName || signatureData.cloud_name;
      const uploadUrl = signatureData.uploadUrl || `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

      // 4. Post directly to Cloudinary
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Lỗi từ Cloudinary (HTTP ${response.status})`);
      }

      const cloudinaryResult = await response.json();
      const resultData = {
        publicUrl: cloudinaryResult.secure_url || cloudinaryResult.url,
        publicId: cloudinaryResult.public_id
      };

      // Save to cache
      uploadCache.set(fileKey, resultData);

      return {
        success: true,
        data: resultData
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Không thể tải ảnh lên',
        data: null
      };
    }
  },

  uploadFile: async (file, folderName) => {
    if (!file) {
      return {
        success: false,
        message: 'File không hợp lệ',
        data: null
      };
    }

    const fileKey = `${file.name}_${file.size}_${file.type}_${file.lastModified}`;
    if (uploadCache.has(fileKey)) {
      return {
        success: true,
        data: uploadCache.get(fileKey)
      };
    }

    try {
      const sigResponse = await request(`images/upload-signature/${folderName}`);
      if (!sigResponse || !sigResponse.success) {
        return {
          success: false,
          message: sigResponse?.message || 'Không lấy được chữ ký tải tệp từ hệ thống',
          data: null
        };
      }

      const signatureData = sigResponse.data;
      if (!signatureData) {
        return {
          success: false,
          message: 'Không lấy được chữ ký tải tệp từ hệ thống',
          data: null
        };
      }

      const formData = new FormData();
      formData.append('file', file);

      const keyMapping = {
        apiKey: 'api_key',
        cloudName: 'cloud_name',
        uploadPreset: 'upload_preset',
      };

      Object.keys(signatureData).forEach(key => {
        if (key !== 'uploadUrl' && key !== 'cloudName' && key !== 'cloud_name') {
          const formKey = keyMapping[key] || key;
          formData.append(formKey, signatureData[key]);
        }
      });

      const cloudName = signatureData.cloudName || signatureData.cloud_name;
      const isImage = file.type.startsWith('image/');
      const isVideoOrAudio = file.type.startsWith('video/') || file.type.startsWith('audio/') || file.name.endsWith('.webm') || file.name.endsWith('.ogg') || file.name.endsWith('.wav') || file.name.endsWith('.mp3');
      const resourceType = isImage ? 'image' : (isVideoOrAudio ? 'video' : 'raw');
      const uploadUrl = signatureData.uploadUrl || `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Lỗi từ Cloudinary (HTTP ${response.status})`);
      }

      const cloudinaryResult = await response.json();
      const resultData = {
        publicUrl: cloudinaryResult.secure_url || cloudinaryResult.url,
        publicId: cloudinaryResult.public_id
      };

      uploadCache.set(fileKey, resultData);

      return {
        success: true,
        data: resultData
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Không thể tải tệp tin lên',
        data: null
      };
    }
  }
};
