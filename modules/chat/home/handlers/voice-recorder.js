import { t } from '../../../../js/core/i18n.js';

export const VoiceRecorder = {
  async start(ctx, micIcon, messageInput, voiceRecordingIndicator, voiceDuration, onStopCallback, showDialog) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      ctx.recordingStream = stream;
      ctx.audioChunks = [];
      
      ctx.mediaRecorder = new MediaRecorder(stream);
      ctx.mediaRecorder.addEventListener('dataavailable', (event) => {
        ctx.audioChunks.push(event.data);
      });

      ctx.mediaRecorder.addEventListener('stop', async () => {
        if (ctx.isRecordingCanceled) {
          ctx.isRecordingCanceled = false;
          return;
        }
        const audioBlob = new Blob(ctx.audioChunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        await onStopCallback(audioFile);
      });

      // Start timer
      let recordingSeconds = 0;
      if (voiceDuration) voiceDuration.textContent = '00:00';
      
      ctx.recordingTimerInterval = setInterval(() => {
        recordingSeconds++;
        const mins = String(Math.floor(recordingSeconds / 60)).padStart(2, '0');
        const secs = String(recordingSeconds % 60).padStart(2, '0');
        if (voiceDuration) voiceDuration.textContent = `${mins}:${secs}`;
      }, 1000);

      ctx.mediaRecorder.start();
      ctx.isRecording = true;
      
      // Update UI elements
      const btnRecordVoice = document.getElementById('btn-record-voice');
      if (btnRecordVoice) {
        btnRecordVoice.style.background = '#ef4444';
        btnRecordVoice.style.color = '#ffffff';
        btnRecordVoice.style.borderColor = '#ef4444';
        btnRecordVoice.title = t('stop_recording');
      }
      if (micIcon) {
        micIcon.innerHTML = `<rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>`;
      }

      if (messageInput) messageInput.style.display = 'none';
      if (voiceRecordingIndicator) voiceRecordingIndicator.style.display = 'flex';
      const sendBtn = document.getElementById('btn-send-message');
      if (sendBtn) sendBtn.style.display = 'none';

      // Disable other buttons
      this.toggleOtherButtons(true);

    } catch (err) {
      console.error('Cannot access microphone:', err);
      if (showDialog) {
        await showDialog({
          title: t('mic_error_title'),
          message: t('mic_error_message'),
          type: 'error'
        });
      }
    }
  },

  stop(ctx) {
    if (ctx.recordingTimerInterval) {
      clearInterval(ctx.recordingTimerInterval);
      ctx.recordingTimerInterval = null;
    }

    if (ctx.mediaRecorder && ctx.mediaRecorder.state !== 'inactive') {
      try {
        ctx.mediaRecorder.stop();
      } catch (e) {}
    }

    if (ctx.recordingStream) {
      ctx.recordingStream.getTracks().forEach(track => track.stop());
      ctx.recordingStream = null;
    }

    ctx.isRecording = false;

    // Reset UI elements
    const btnRecordVoice = document.getElementById('btn-record-voice');
    const micIcon = document.getElementById('mic-icon');
    const messageInput = document.getElementById('message-input');
    const voiceRecordingIndicator = document.getElementById('voice-recording-indicator');
    const sendBtn = document.getElementById('btn-send-message');

    if (btnRecordVoice) {
      btnRecordVoice.style.background = '';
      btnRecordVoice.style.color = '';
      btnRecordVoice.style.borderColor = '';
      btnRecordVoice.title = t('record_voice');
    }

    if (micIcon) {
      micIcon.innerHTML = `
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
        <path d="M19 10v1a7 7 0 0 1-14 0v-1"></path>
        <line x1="12" y1="19" x2="12" y2="23"></line>
        <line x1="8" y1="23" x2="16" y2="23"></line>
      `;
    }

    if (messageInput) {
      messageInput.style.display = 'block';
    }
    if (voiceRecordingIndicator) voiceRecordingIndicator.style.display = 'none';
    if (sendBtn) sendBtn.style.display = 'block';

    this.toggleOtherButtons(false);
  },

  toggleOtherButtons(disabled) {
    const btnUploadImage = document.getElementById('btn-upload-image');
    const btnUploadVideo = document.getElementById('btn-upload-video');
    const btnUploadFile = document.getElementById('btn-upload-file');
    const btnToggleExtraActions = document.getElementById('btn-toggle-extra-actions');

    if (btnUploadImage) btnUploadImage.disabled = disabled;
    if (btnUploadVideo) btnUploadVideo.disabled = disabled;
    if (btnUploadFile) btnUploadFile.disabled = disabled;
    if (btnToggleExtraActions) btnToggleExtraActions.disabled = disabled;
  }
};
