/* ============================================
   TARIFF AI - Design Tokens & Global Styles
   ============================================ */

/* === Typography Imports === */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

/* === CSS Variables - Brand Colors === */
:root {
  /* Brand Primary Colors */
  --brand-navy: #0F172A;
  --brand-navy-light: #1E293B;
  --brand-teal: #42C0B9;
  --brand-teal-dark: #2DA39D;
  --brand-gold: #E5A840;
  --brand-gold-light: #F5C463;
  
  /* Surfaces */
  --brand-surface: #1E293B;
  --brand-surface-elevated: #2D3B4F;
  --brand-surface-glass: rgba(30, 41, 59, 0.7);
  
  /* Text Colors */
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
  
  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-default: rgba(255, 255, 255, 0.12);
  --border-emphasis: rgba(66, 192, 185, 0.3);
  
  /* Shadows - Glow Effects */
  --glow-teal: 0 0 20px rgba(66, 192, 185, 0.25);
  --glow-gold: 0 0 20px rgba(229, 168, 64, 0.25);
  --glow-navy: 0 0 20px rgba(15, 23, 42, 0.5);
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-base: 250ms ease;
  --transition-slow: 400ms ease;
}

/* Light mode overrides */
.light {
  --brand-surface: #FFFFFF;
  --brand-surface-elevated: #F8FAFC;
  --brand-surface-glass: rgba(255, 255, 255, 0.8);
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-muted: #94A3B8;
  --border-subtle: rgba(0, 0, 0, 0.06);
  --border-default: rgba(0, 0, 0, 0.1);
}

/* === Typography Classes === */
.font-heading {
  font-family: 'Space Grotesk', system-ui, sans-serif;
}

.font-sans {
  font-family: 'Inter', system-ui, sans-serif;
}

.font-mono {
  font-family: 'IBM Plex Mono', monospace;
}

/* RTL Font Support */
[dir="rtl"] .font-heading,
[dir="rtl"] .font-sans {
  font-family: 'Heebo', 'Inter', system-ui, sans-serif;
}

/* === Glass Panel Effect === */
.glass-panel {
  background: var(--brand-surface-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-subtle);
  border-radius: 1.5rem;
}

.glass-panel-sm {
  background: var(--brand-surface-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-subtle);
  border-radius: 1rem;
}

/* === Card Styles === */
.card-elevated {
  background: var(--brand-surface);
  border: 1px solid var(--border-subtle);
  border-radius: 1.25rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
  transition: all var(--transition-base);
}

.card-elevated:hover {
  border-color: var(--border-emphasis);
  box-shadow: var(--glow-teal);
}

/* === Button Glow Effects === */
.btn-glow-teal {
  position: relative;
  transition: all var(--transition-base);
}

.btn-glow-teal:hover {
  box-shadow: var(--glow-teal);
  transform: translateY(-1px);
}

.btn-glow-gold {
  position: relative;
  transition: all var(--transition-base);
}

.btn-glow-gold:hover {
  box-shadow: var(--glow-gold);
  transform: translateY(-1px);
}

/* === Input Focus Styles === */
.input-brand:focus {
  outline: none;
  border-color: var(--brand-teal);
  box-shadow: 0 0 0 3px rgba(66, 192, 185, 0.15);
}

/* === Navigation Active Indicator === */
.nav-active-indicator {
  position: relative;
}

.nav-active-indicator::before {
  content: '';
  position: absolute;
  inset-inline-start: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: linear-gradient(180deg, var(--brand-teal), var(--brand-gold));
  border-radius: 0 4px 4px 0;
}

[dir="rtl"] .nav-active-indicator::before {
  border-radius: 4px 0 0 4px;
}

/* === Gradient Backgrounds === */
.gradient-brand {
  background: linear-gradient(135deg, var(--brand-navy) 0%, var(--brand-navy-light) 100%);
}

.gradient-teal {
  background: linear-gradient(135deg, var(--brand-teal) 0%, var(--brand-teal-dark) 100%);
}

.gradient-gold {
  background: linear-gradient(135deg, var(--brand-gold) 0%, var(--brand-gold-light) 100%);
}

/* === Scrollbar Styling === */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--text-muted);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* === RTL Logical Properties Helpers === */
.ms-auto { margin-inline-start: auto; }
.me-auto { margin-inline-end: auto; }
.ps-0 { padding-inline-start: 0; }
.pe-0 { padding-inline-end: 0; }
.border-s { border-inline-start-width: 1px; }
.border-e { border-inline-end-width: 1px; }

/* === Animation Keyframes === */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-shimmer {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 5px rgba(66, 192, 185, 0.3); }
  50% { box-shadow: 0 0 20px rgba(66, 192, 185, 0.5); }
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}