import { Step1 } from './step1.js';
import { Step2 } from './step2.js';
import { Step3 } from './step3.js';
import { t } from '../../../js/core/i18n.js';

export const RegisterView = {
  // Shared state across registration sub-views
  state: {
    currentStep: 1,
    userId: '',
    avatarFile: null
  },

  render() {
    return `
      <div class="auth-container" style="max-width: 500px;">
        <!-- Loading Overlay -->
        <div class="loading-overlay" id="register-loading">
          <div class="spinner"></div>
          <div class="loading-text" id="register-loading-text">${t('processing')}</div>
        </div>

        <div class="auth-header">
          <h1>${t('create_account_title')}</h1>
          <p>${t('create_account_subtitle')}</p>
        </div>

        <!-- Stepper Nodes Progress Line -->
        <div class="stepper">
          <div class="stepper-progress" id="stepper-progress"></div>
          <div class="stepper-node active" id="step-node-1">1</div>
          <div class="stepper-node" id="step-node-2">2</div>
          <div class="stepper-node" id="step-node-3">3</div>
        </div>

        <!-- Inner Step Containers -->
        <div class="register-steps-container" id="steps-mount-point">
          ${Step1.render()}
          ${Step2.render()}
          ${Step3.render()}
        </div>
      </div>
    `;
  },

  init(router) {
    const startStep = sessionStorage.getItem('register_start_step') ? parseInt(sessionStorage.getItem('register_start_step')) : 1;

    // Reset view state cache
    this.state = {
      currentStep: startStep,
      email: sessionStorage.getItem('register_email') || '',
      password: '',
      fullName: '',
      userId: sessionStorage.getItem('register_user_id') || '',
      avatarFile: null
    };

    const loading = document.getElementById('register-loading');
    const loadingText = document.getElementById('register-loading-text');

    const toggleLoading = (isActive, message = t('processing')) => {
      loadingText.textContent = message;
      if (isActive) {
        loading.classList.add('active');
      } else {
        loading.classList.remove('active');
      }
    };

    const updateStepperHeader = () => {
      const step = this.state.currentStep;
      const progress = document.getElementById('stepper-progress');
      if (progress) {
        const percent = ((step - 1) / 2) * 100;
        progress.style.width = `${percent}%`;
      }

      for (let i = 1; i <= 3; i++) {
        const node = document.getElementById(`step-node-${i}`);
        if (!node) continue;
        
        if (i < step) {
          node.className = 'stepper-node completed';
          node.innerHTML = '&#10003;';
        } else if (i === step) {
          node.className = 'stepper-node active';
          node.textContent = i;
        } else {
          node.className = 'stepper-node';
          node.textContent = i;
        }
      }
    };

    const goToStep = (step) => {
      const currentCard = document.getElementById(`step-card-${this.state.currentStep}`);
      const nextCard = document.getElementById(`step-card-${step}`);
      
      if (currentCard && nextCard) {
        if (step > this.state.currentStep) {
          currentCard.classList.remove('active');
          currentCard.classList.add('slide-out');
          nextCard.classList.add('active');
        } else {
          currentCard.classList.remove('active');
          nextCard.classList.remove('slide-out');
          nextCard.classList.add('active');
        }
      }

      this.state.currentStep = step;
      updateStepperHeader();
    };

    // If starting step is not 1 (e.g. step 2), adjust card classes initially\
    const card1 = document.getElementById('step-card-1');
    const card2 = document.getElementById('step-card-2');
    const card3 = document.getElementById('step-card-3');
    if (startStep === 2) {
      if (card1) {
        card1.classList.remove('active');
        card1.classList.add('slide-out');
      }
      if (card2) {
        card2.classList.add('active');
      }
    }
    else if(startStep === 3) {
      if(card1) {
        card1.classList.remove('active');
        card1.classList.add('slide-out');
      }
      if (card2) {
        card2.classList.remove('active');
        card2.classList.add('slide-out');
      }
      if(card3){
        card3.classList.add('active');
      }
    }

    // Initialize all step action listeners
    Step1.init(this.state, goToStep, toggleLoading);
    Step2.init(this.state, goToStep, toggleLoading);
    Step3.init(this.state, goToStep, toggleLoading);

    // Initial header sync
    updateStepperHeader();
  }
};
export default RegisterView;
