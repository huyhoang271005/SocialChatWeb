import { loadModuleStyle } from '../../core/router.js';

/**
 * Promise-based Custom Dialog Modal with self-contained styles loading.
 */
export function showDialog({
  title = 'Thông báo',
  message = '',
  type = 'info', // 'info', 'success', 'warning', 'error'
  buttons = [],
  showInput = false,
  inputPlaceholder = '',
  inputValue = ''
}) {
  // Dynamically load its own styles
  loadModuleStyle('js/shared/dialog/dialog.css');

  return new Promise((resolve) => {
    // 1. Create dialog elements
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = `dialog-card dialog-${type}`;
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    // Icon setup
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg class="dialog-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3" /></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg class="dialog-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg class="dialog-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>`;
    } else {
      iconSvg = `<svg class="dialog-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>`;
    }

    if (buttons.length === 0) {
      buttons = [{ text: 'Đóng', type: 'primary', value: true }];
    }

    const inputHtml = showInput 
      ? `<input type="text" inputmode="email" class="form-input dialog-input" style="margin-top: 15px; width: 100%; box-sizing: border-box;" placeholder="${inputPlaceholder}" value="${inputValue}">` 
      : '';

    dialog.innerHTML = `
      <div class="dialog-header">
        ${iconSvg}
        <h3 class="dialog-title">${title}</h3>
      </div>
      <div class="dialog-body">
        <p class="dialog-message">${message.replace(/\n/g, '<br>')}</p>
        ${inputHtml}
      </div>
      <div class="dialog-footer"></div>
    `;

    const footer = dialog.querySelector('.dialog-footer');

    buttons.forEach((btnConfig) => {
      const btn = document.createElement('button');
      btn.className = `btn btn-${btnConfig.type || 'primary'}`;
      btn.textContent = btnConfig.text;
      btn.addEventListener('click', () => {
        const inputVal = showInput ? dialog.querySelector('.dialog-input').value.trim() : '';
        if (showInput) {
          closeDialog({ buttonValue: btnConfig.value, inputValue: inputVal });
        } else {
          closeDialog(btnConfig.value);
        }
      });
      footer.appendChild(btn);
    });

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Close when clicking outside the dialog card (on the overlay background)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (showInput) {
          closeDialog({ buttonValue: null, inputValue: '' });
        } else {
          closeDialog(null);
        }
      }
    });

    setTimeout(() => {
      overlay.classList.add('active');
      dialog.classList.add('active');
      
      if (showInput) {
        const inputElement = dialog.querySelector('.dialog-input');
        if (inputElement) {
          inputElement.focus();
          // Put cursor at the end of the text safely
          try {
            const len = inputElement.value.length;
            inputElement.setSelectionRange(len, len);
          } catch (e) {
            console.warn('Failed to set selection range:', e);
          }
        }
      } else {
        const firstBtn = footer.querySelector('button');
        if (firstBtn) firstBtn.focus();
      }
    }, 10);

    function closeDialog(resolvedValue) {
      overlay.classList.remove('active');
      dialog.classList.remove('active');
      dialog.addEventListener('transitionend', () => {
        overlay.remove();
        resolve(resolvedValue);
      }, { once: true });
    }
  });
}
