// --- Theme Management ---
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    setTheme(newTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Update icons
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    const prismTheme = document.getElementById('prism-theme');

    if (theme === 'dark') {
        sunIcon.style.display = 'none';
        moonIcon.style.display = 'block';
        if (prismTheme) prismTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css';
    } else {
        sunIcon.style.display = 'block';
        moonIcon.style.display = 'none';
        if (prismTheme) prismTheme.href = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css';
    }
}

// --- Language Management ---
function switchLanguage(lang) {
    document.documentElement.lang = lang;
    localStorage.setItem('language', lang);

    // Update content visibility
    document.querySelectorAll('[data-lang]').forEach(el => {
        el.style.display = el.getAttribute('data-lang') === lang ? '' : 'none';
    });

    // Update sidebar text
    document.querySelectorAll('[data-hr], [data-en]').forEach(el => {
        el.textContent = el.getAttribute(`data-${lang}`);
    });

    // Update buttons
    document.querySelectorAll('.lang-switcher-inline button').forEach(btn => {
        btn.classList.toggle('active', btn.id === `lang-${lang}-btn`);
    });
}

// --- Sidebar & Navigation ---
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('active');
}

function initNavigation() {
    const sections = document.querySelectorAll('.section');
    const navLinks = document.querySelectorAll('.sidebar-nav a');

    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                navLinks.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
}

// --- Framework Tabs ---
function showFramework(framework) {
    document.querySelectorAll('.framework-content').forEach(content => {
        content.classList.toggle('active', content.id === framework);
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(framework));
    });
}

// --- Code Copy ---
function copyCode(button) {
    const pre = button.nextElementSibling;
    const code = pre.querySelector('code').textContent;

    navigator.clipboard.writeText(code).then(() => {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => button.textContent = originalText, 2000);
    });
}

// --- AI Assistant ---
function askAI(context) {
    let prompt = "";
    const lang = document.documentElement.lang || 'hr';

    const prompts = {
        hr: {
            general: "Zdravo BornAI! Želim naučiti više o SudReg API-ju. Možeš li mi pomoći?",
            beginner_concepts: "Pojasni mi osnovne koncepte API-ja (HTTP, JSON, Endpoint) na jednostavan način.",
            auth_help: "Trebam pomoć oko OAuth2 autentifikacije za SudReg API. Kako to funkcionira?",
            endpoints: "Možeš li mi objasniti različite krajnje točke (endpoints) SudReg API-ja i što koja radi?"
        },
        en: {
            general: "Hello BornAI! I want to learn more about the SudReg API. Can you help me?",
            beginner_concepts: "Explain the basic API concepts (HTTP, JSON, Endpoint) to me in a simple way.",
            auth_help: "I need help with OAuth2 authentication for the SudReg API. How does it work?",
            endpoints: "Can you explain the different SudReg API endpoints and what each one does?"
        }
    };

    prompt = prompts[lang][context] || prompts[lang].general;

    // Using the current structure for agent chat
    const bornAIUrl = `https://bornai.com.hr/?q=${encodeURIComponent(prompt)}`;
    window.open(bornAIUrl, '_blank');
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initial Theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);

    // 2. Initial Language (Default to HR)
    const savedLang = localStorage.getItem('language') || 'hr';
    switchLanguage(savedLang);

    // 3. Setup Navigation
    initNavigation();

    // 4. Smooth scroll fix for header offset
    document.querySelectorAll('.sidebar-nav a').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });

                // Close sidebar on mobile after click
                if (window.innerWidth <= 1024) {
                    toggleSidebar();
                }
            }
        });
    });
});

