import { api } from '../../../../js/core/api.js';

export const AttachmentHandler = {
  stageFiles(files, type, stagedFiles) {
    const newStaged = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const previewUrl = (type === 'IMAGE' || type === 'VIDEO') ? URL.createObjectURL(file) : null;
      newStaged.push({ file, type, previewUrl });
    }
    return [...stagedFiles, ...newStaged];
  },

  renderStagedFiles(stagedFiles, container, onDelete) {
    if (!container) return;

    if (!stagedFiles || stagedFiles.length === 0) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }

    container.style.display = 'flex';
    container.innerHTML = stagedFiles.map((item, index) => {
      const file = item.file;
      const sizeStr = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      
      if (item.type === 'IMAGE') {
        return `
          <div class="staged-file-card square-card" data-index="${index}">
            <img class="staged-file-preview" src="${item.previewUrl}">
            <div class="staged-file-delete" data-index="${index}">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
          </div>
        `;
      } else if (item.type === 'VIDEO') {
        return `
          <div class="staged-file-card square-card" data-index="${index}">
            <video class="staged-file-preview" src="${item.previewUrl}"></video>
            <div class="staged-file-video-badge">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span>Video</span>
            </div>
            <div class="staged-file-delete" data-index="${index}">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
          </div>
        `;
      } else {
        // FILE
        return `
          <div class="staged-file-card wide-card" data-index="${index}">
            <div class="staged-file-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div class="staged-file-info">
              <div class="staged-file-name" title="${file.name}">${file.name}</div>
              <div class="staged-file-size">${sizeStr}</div>
            </div>
            <div class="staged-file-delete" data-index="${index}">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </div>
          </div>
        `;
      }
    }).join('');

    // Bind delete event
    container.querySelectorAll('.staged-file-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        onDelete(index);
      });
    });
  },

  async uploadStagedFiles(stagedFiles) {
    const uploadPromises = stagedFiles.map(async (item) => {
      const uploadFunc = (item.type === 'IMAGE') ? api.uploadImage : api.uploadFile;
      const res = await uploadFunc(item.file, 'messages');
      if (res && res.success && res.data) {
        return {
          url: res.data.publicUrl,
          fileId: res.data.publicId,
          type: item.type
        };
      } else {
        throw new Error(res?.message || `Không thể tải lên tệp ${item.file.name}`);
      }
    });

    return await Promise.all(uploadPromises);
  },

  revokeUrls(stagedFiles) {
    if (!stagedFiles) return;
    stagedFiles.forEach(item => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
  }
};
