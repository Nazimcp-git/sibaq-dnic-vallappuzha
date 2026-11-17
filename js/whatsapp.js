// ExamShield — WhatsApp messaging removed per design requirements
const WhatsAppHelper = {
  openWhatsApp() {
    console.info('[WhatsApp] Feature disabled');
  },
  renderWhatsAppPage(container) {
    if (container) container.innerHTML = '<div class="p-6 text-sm text-muted">Feature disabled.</div>';
  }
};
