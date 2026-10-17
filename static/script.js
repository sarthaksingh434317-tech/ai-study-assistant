/**
 * AI Study Assistant - Main Interactive Frontend Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // State Management
    // ==========================================================================
    const state = {
        activePanel: 'panel-chat',
        hasApiKey: false,
        chatHistory: [],
        currentQuiz: null,
        quizIndex: 0,
        quizAnswers: {}, // questionIndex: selectedOptionIndex
        lastGeneratedNotes: '',
        lastNotesTopic: '',
        lastGeneratedMcqs: '',
        lastMcqTopic: ''
    };

    // Configure marked.js if loaded
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,
            gfm: true,
            highlight: function (code, lang) {
                if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                    try {
                        return hljs.highlight(code, { language: lang }).value;
                    } catch (e) {
                        console.error('Highlight.js error:', e);
                    }
                }
                return code;
            }
        });
    }

    // ==========================================================================
    // DOM Element References
    // ==========================================================================
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const mobileMenuToggle = document.getElementById('mobileMenuToggle');
    const closeSidebarBtn = document.getElementById('closeSidebarBtn');
    const navButtons = document.querySelectorAll('.nav-btn');
    const featurePanels = document.querySelectorAll('.feature-panel');
    const activePanelTitle = document.getElementById('activePanelTitle');
    const activePanelSubtitle = document.getElementById('activePanelSubtitle');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const quickHelpBtn = document.getElementById('quickHelpBtn');

    // API Status Elements
    const apiStatusDot = document.getElementById('apiStatusDot');
    const apiStatusLabel = document.getElementById('apiStatusLabel');
    const apiKeyBanner = document.getElementById('apiKeyBanner');
    const bannerSetupKeyBtn = document.getElementById('bannerSetupKeyBtn');
    const dismissBannerBtn = document.getElementById('dismissBannerBtn');
    const openApiKeyModalBtn = document.getElementById('openApiKeyModalBtn');
    const apiKeyModal = document.getElementById('apiKeyModal');
    const closeApiKeyModalBtn = document.getElementById('closeApiKeyModalBtn');
    const cancelApiKeyModalBtn = document.getElementById('cancelApiKeyModalBtn');
    const saveApiKeyModalBtn = document.getElementById('saveApiKeyModalBtn');
    const modalApiKeyInput = document.getElementById('modalApiKeyInput');
    const modalKeyFeedback = document.getElementById('modalKeyFeedback');

    // Help Modal Elements
    const helpModal = document.getElementById('helpModal');
    const closeHelpModalBtn = document.getElementById('closeHelpModalBtn');
    const closeHelpModalFooterBtn = document.getElementById('closeHelpModalFooterBtn');

    // Toast Notification
    const toast = document.getElementById('toastNotification');

    // Panel Metadata for Title Updates
    const panelMetadata = {
        'panel-chat': {
            title: 'AI Study Chat',
            subtitle: 'Ask questions, clarify homework problems, and explore concepts interactively.'
        },
        'panel-notes': {
            title: 'Notes Generator',
            subtitle: 'Produce structured, high-yield academic study notes on any topic.'
        },
        'panel-summarize': {
            title: 'Topic Summarizer',
            subtitle: 'Condense long articles, dense chapters, and complex subjects into digestible takeaways.'
        },
        'panel-mcq': {
            title: 'MCQ Generator',
            subtitle: 'Generate multiple-choice practice questions with verified answers and explanations.'
        },
        'panel-quiz': {
            title: 'Practice Quiz',
            subtitle: 'Test your knowledge with an interactive quiz featuring instant scoring and review.'
        },
        'panel-explain': {
            title: 'Simple Explanation (ELI5)',
            subtitle: 'Demystify intimidating, complex topics through intuitive real-world analogies.'
        }
    };

    // ==========================================================================
    // UI Notification & Toast Helpers
    // ==========================================================================
    let toastTimeout = null;
    function showToast(message, type = 'info') {
        if (!toast) return;
        clearTimeout(toastTimeout);
        toast.textContent = message;
        toast.className = `toast-notification active ${type}`;

        toastTimeout = setTimeout(() => {
            toast.className = 'toast-notification';
        }, 3500);
    }

    // ==========================================================================
    // Navigation & Panel Switching
    // ==========================================================================
    function switchPanel(panelId) {
        state.activePanel = panelId;

        // Update nav buttons
        navButtons.forEach(btn => {
            if (btn.dataset.target === panelId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update panels visibility
        featurePanels.forEach(panel => {
            if (panel.id === panelId) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });

        // Update titles
        if (panelMetadata[panelId]) {
            activePanelTitle.textContent = panelMetadata[panelId].title;
            activePanelSubtitle.textContent = panelMetadata[panelId].subtitle;
        }

        // Close mobile sidebar if open
        closeSidebar();
    }

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            if (target) switchPanel(target);
        });
    });

    // Mobile Sidebar Toggles
    function openSidebar() {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('active');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    }

    if (mobileMenuToggle) mobileMenuToggle.addEventListener('click', openSidebar);
    if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
    if (sidebarOverlay) sidebarOverlay.addEventListener('click', closeSidebar);

    // ==========================================================================
    // Theme Switcher (Dark / Light)
    // ==========================================================================
    const savedTheme = localStorage.getItem('studygenie_theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.replace('theme-light', 'theme-dark');
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    themeToggleBtn.addEventListener('click', () => {
        if (document.body.classList.contains('theme-dark')) {
            document.body.classList.replace('theme-dark', 'theme-light');
            themeToggleBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
            localStorage.setItem('studygenie_theme', 'light');
        } else {
            document.body.classList.replace('theme-light', 'theme-dark');
            themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
            localStorage.setItem('studygenie_theme', 'dark');
        }
    });

    // ==========================================================================
    // Modals (API Key & Help)
    // ==========================================================================
    function openModal(modalEl) {
        if (modalEl) modalEl.classList.remove('hidden');
    }

    function closeModal(modalEl) {
        if (modalEl) modalEl.classList.add('hidden');
    }

    if (openApiKeyModalBtn) openApiKeyModalBtn.addEventListener('click', () => openModal(apiKeyModal));
    if (bannerSetupKeyBtn) bannerSetupKeyBtn.addEventListener('click', () => openModal(apiKeyModal));
    if (closeApiKeyModalBtn) closeApiKeyModalBtn.addEventListener('click', () => closeModal(apiKeyModal));
    if (cancelApiKeyModalBtn) cancelApiKeyModalBtn.addEventListener('click', () => closeModal(apiKeyModal));
    if (dismissBannerBtn) dismissBannerBtn.addEventListener('click', () => apiKeyBanner.classList.add('hidden'));

    if (quickHelpBtn) quickHelpBtn.addEventListener('click', () => openModal(helpModal));
    if (closeHelpModalBtn) closeHelpModalBtn.addEventListener('click', () => closeModal(helpModal));
    if (closeHelpModalFooterBtn) closeHelpModalFooterBtn.addEventListener('click', () => closeModal(helpModal));

    // Close modals on clicking outside modal dialog
    window.addEventListener('click', (e) => {
        if (e.target === apiKeyModal) closeModal(apiKeyModal);
        if (e.target === helpModal) closeModal(helpModal);
    });

    // ==========================================================================
    // API Status Check & Key Verification
    // ==========================================================================
    async function checkApiStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            state.hasApiKey = !!data.hasApiKey;

            if (state.hasApiKey) {
                apiStatusDot.className = 'status-dot active';
                apiStatusLabel.textContent = 'Gemini Connected';
                apiKeyBanner.classList.add('hidden');
            } else {
                apiStatusDot.className = 'status-dot warning';
                apiStatusLabel.textContent = 'Key Required';
                apiKeyBanner.classList.remove('hidden');
            }
        } catch (err) {
            console.error('Error checking API status:', err);
            apiStatusDot.className = 'status-dot';
            apiStatusLabel.textContent = 'Server Offline';
        }
    }

    // Call on load
    checkApiStatus();

    // Save Runtime Key via Modal
    if (saveApiKeyModalBtn) {
        saveApiKeyModalBtn.addEventListener('click', async () => {
            const key = modalApiKeyInput.value.trim();
            if (!key) {
                modalKeyFeedback.className = 'feedback-msg error';
                modalKeyFeedback.textContent = 'Please enter an API key.';
                modalKeyFeedback.classList.remove('hidden');
                return;
            }

            saveApiKeyModalBtn.disabled = true;
            saveApiKeyModalBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
            modalKeyFeedback.className = 'feedback-msg hidden';

            try {
                const res = await fetch('/api/set-key', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey: key })
                });
                const data = await res.json();

                if (data.success) {
                    modalKeyFeedback.className = 'feedback-msg success';
                    modalKeyFeedback.textContent = data.message;
                    modalKeyFeedback.classList.remove('hidden');
                    state.hasApiKey = true;
                    apiStatusDot.className = 'status-dot active';
                    apiStatusLabel.textContent = 'Gemini Connected';
                    apiKeyBanner.classList.add('hidden');
                    showToast('Gemini API Key verified and active!', 'success');
                    setTimeout(() => closeModal(apiKeyModal), 1400);
                } else {
                    modalKeyFeedback.className = 'feedback-msg error';
                    modalKeyFeedback.textContent = data.error || 'Failed to verify API key.';
                    modalKeyFeedback.classList.remove('hidden');
                }
            } catch (err) {
                modalKeyFeedback.className = 'feedback-msg error';
                modalKeyFeedback.textContent = 'Network error connecting to backend.';
                modalKeyFeedback.classList.remove('hidden');
            } finally {
                saveApiKeyModalBtn.disabled = false;
                saveApiKeyModalBtn.innerHTML = '<i class="fa-solid fa-check"></i> Verify & Save';
            }
        });
    }

    // ==========================================================================
    // Quick Tag Pill Click Handlers
    // ==========================================================================
    document.querySelectorAll('.tag-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            const targetId = pill.dataset.fill;
            const value = pill.dataset.val;
            const inputEl = document.getElementById(targetId);
            if (inputEl && value) {
                inputEl.value = value;
                inputEl.focus();
            }
        });
    });

    // ==========================================================================
    // Clipboard & Download Helpers
    // ==========================================================================
    async function copyToClipboard(text, successMsg = 'Copied to clipboard!') {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            showToast(successMsg, 'success');
        } catch (e) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast(successMsg, 'success');
        }
    }

    function downloadMarkdownFile(filename, text) {
        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
        showToast(`Saved ${filename}`, 'success');
    }

    // ==========================================================================
    // FEATURE 1: AI Study Chat
    // ==========================================================================
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMessages = document.getElementById('chatMessages');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const clearChatBtn = document.getElementById('clearChatBtn');

    function appendChatMessage(role, content) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${role}-message`;

        const avatar = document.createElement('div');
        avatar.className = 'msg-avatar';
        avatar.innerHTML = role === 'user' ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';

        const body = document.createElement('div');
        body.className = 'msg-body';

        const sender = document.createElement('div');
        sender.className = 'msg-sender';
        sender.textContent = role === 'user' ? 'You' : 'StudyGenie AI';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'msg-content markdown-output';

        if (role === 'assistant' && typeof marked !== 'undefined') {
            contentDiv.innerHTML = marked.parse(content);
        } else {
            const p = document.createElement('p');
            p.textContent = content;
            contentDiv.appendChild(p);
        }

        body.appendChild(sender);
        body.appendChild(contentDiv);
        msgDiv.appendChild(avatar);
        msgDiv.appendChild(body);

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return msgDiv;
    }

    function appendChatLoading() {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'chatLoadingBubble';
        loadingDiv.className = 'message assistant-message';
        loadingDiv.innerHTML = `
            <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
            <div class="msg-body">
                <div class="msg-sender">StudyGenie AI</div>
                <div class="msg-content">
                    <span style="display:inline-flex; align-items:center; gap:6px;">
                        <i class="fa-solid fa-circle-notch fa-spin"></i> Thinking...
                    </span>
                </div>
            </div>
        `;
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeChatLoading() {
        const loadingDiv = document.getElementById('chatLoadingBubble');
        if (loadingDiv) loadingDiv.remove();
    }

    async function handleChatSubmit(e) {
        if (e) e.preventDefault();
        const message = chatInput.value.trim();
        if (!message) return;

        // Render user message
        appendChatMessage('user', message);
        state.chatHistory.push({ role: 'user', content: message });
        chatInput.value = '';
        chatInput.style.height = 'auto';

        // Show typing indicator
        appendChatLoading();
        chatSendBtn.disabled = true;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    history: state.chatHistory.slice(-6)
                })
            });

            removeChatLoading();
            const data = await res.json();

            if (data.success) {
                appendChatMessage('assistant', data.reply);
                state.chatHistory.push({ role: 'assistant', content: data.reply });
            } else {
                appendChatMessage('assistant', `⚠️ **Error:** ${data.error || 'Failed to get answer.'}`);
                if (!state.hasApiKey) {
                    showToast('Please set your Gemini API key in Settings or .env', 'error');
                }
            }
        } catch (err) {
            removeChatLoading();
            appendChatMessage('assistant', `⚠️ **Network Error:** Unable to reach the server. Please check your connection.`);
        } finally {
            chatSendBtn.disabled = false;
            chatInput.focus();
        }
    }

    if (chatForm) chatForm.addEventListener('submit', handleChatSubmit);

    // Enter sends message, Shift+Enter makes newline
    if (chatInput) {
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleChatSubmit();
            }
        });
    }

    // Clear chat
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
            state.chatHistory = [];
            chatMessages.innerHTML = `
                <div class="message assistant-message">
                    <div class="msg-avatar"><i class="fa-solid fa-robot"></i></div>
                    <div class="msg-body">
                        <div class="msg-sender">StudyGenie AI</div>
                        <div class="msg-content markdown-output">
                            <p>Chat cleared! 👋 What new question or subject would you like to explore?</p>
                        </div>
                    </div>
                </div>
            `;
            showToast('Conversation cleared', 'info');
        });
    }

    // Quick suggestions chips
    document.querySelectorAll('.chip-suggestion').forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.dataset.prompt;
            if (prompt && chatInput) {
                chatInput.value = prompt;
                handleChatSubmit();
            }
        });
    });

    // ==========================================================================
    // FEATURE 2: Notes Generator
    // ==========================================================================
    const notesForm = document.getElementById('notesForm');
    const notesTopic = document.getElementById('notesTopic');
    const notesSubject = document.getElementById('notesSubject');
    const notesLevel = document.getElementById('notesLevel');
    const notesStyle = document.getElementById('notesStyle');
    const generateNotesBtn = document.getElementById('generateNotesBtn');
    const notesLoading = document.getElementById('notesLoading');
    const notesPlaceholder = document.getElementById('notesPlaceholder');
    const notesOutput = document.getElementById('notesOutput');
    const notesResultTitle = document.getElementById('notesResultTitle');
    const copyNotesBtn = document.getElementById('copyNotesBtn');
    const downloadNotesBtn = document.getElementById('downloadNotesBtn');
    const printNotesBtn = document.getElementById('printNotesBtn');

    if (notesForm) {
        notesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const topic = notesTopic.value.trim();
            if (!topic) return;

            // UI Loading state
            generateNotesBtn.disabled = true;
            generateNotesBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating Notes...';
            notesPlaceholder.classList.add('hidden');
            notesOutput.classList.add('hidden');
            notesLoading.classList.remove('hidden');

            try {
                const res = await fetch('/api/notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic: topic,
                        subject: notesSubject.value,
                        level: notesLevel.value,
                        style: notesStyle.value
                    })
                });
                const data = await res.json();

                notesLoading.classList.add('hidden');

                if (data.success) {
                    state.lastGeneratedNotes = data.notes;
                    state.lastNotesTopic = topic;
                    notesResultTitle.textContent = `Notes: ${topic}`;
                    notesOutput.innerHTML = typeof marked !== 'undefined' ? marked.parse(data.notes) : data.notes;
                    notesOutput.classList.remove('hidden');

                    copyNotesBtn.disabled = false;
                    downloadNotesBtn.disabled = false;
                    printNotesBtn.disabled = false;
                    showToast('Study notes generated successfully!', 'success');
                } else {
                    notesPlaceholder.classList.remove('hidden');
                    showToast(data.error || 'Failed to generate study notes.', 'error');
                }
            } catch (err) {
                notesLoading.classList.add('hidden');
                notesPlaceholder.classList.remove('hidden');
                showToast('Network error while connecting to server.', 'error');
            } finally {
                generateNotesBtn.disabled = false;
                generateNotesBtn.innerHTML = '<i class="fa-solid fa-sparkles"></i> Generate Study Notes';
            }
        });
    }

    if (copyNotesBtn) {
        copyNotesBtn.addEventListener('click', () => {
            copyToClipboard(state.lastGeneratedNotes, 'Notes copied to clipboard!');
        });
    }

    if (downloadNotesBtn) {
        downloadNotesBtn.addEventListener('click', () => {
            const filename = (state.lastNotesTopic || 'study-notes')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '') + '-notes.md';
            downloadMarkdownFile(filename, state.lastGeneratedNotes);
        });
    }

    if (printNotesBtn) {
        printNotesBtn.addEventListener('click', () => {
            window.print();
        });
    }

    // ==========================================================================
    // FEATURE 3: Topic Summarizer
    // ==========================================================================
    const summarizeForm = document.getElementById('summarizeForm');
    const summarizeInput = document.getElementById('summarizeInput');
    const summarizeLength = document.getElementById('summarizeLength');
    const summarizeFormat = document.getElementById('summarizeFormat');
    const summarizeBtn = document.getElementById('summarizeBtn');
    const summaryLoading = document.getElementById('summaryLoading');
    const summaryPlaceholder = document.getElementById('summaryPlaceholder');
    const summaryOutput = document.getElementById('summaryOutput');
    const copySummaryBtn = document.getElementById('copySummaryBtn');

    let lastSummaryText = '';

    if (summarizeForm) {
        summarizeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = summarizeInput.value.trim();
            if (!text) return;

            summarizeBtn.disabled = true;
            summarizeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Summarizing...';
            summaryPlaceholder.classList.add('hidden');
            summaryOutput.classList.add('hidden');
            summaryLoading.classList.remove('hidden');

            try {
                const res = await fetch('/api/summarize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        content: text,
                        length: summarizeLength.value,
                        format: summarizeFormat.value
                    })
                });
                const data = await res.json();

                summaryLoading.classList.add('hidden');

                if (data.success) {
                    lastSummaryText = data.summary;
                    summaryOutput.innerHTML = typeof marked !== 'undefined' ? marked.parse(data.summary) : data.summary;
                    summaryOutput.classList.remove('hidden');
                    copySummaryBtn.disabled = false;
                    showToast('Summary distilled successfully!', 'success');
                } else {
                    summaryPlaceholder.classList.remove('hidden');
                    showToast(data.error || 'Failed to summarize text.', 'error');
                }
            } catch (err) {
                summaryLoading.classList.add('hidden');
                summaryPlaceholder.classList.remove('hidden');
                showToast('Network error while connecting to server.', 'error');
            } finally {
                summarizeBtn.disabled = false;
                summarizeBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Summarize Content';
            }
        });
    }

    if (copySummaryBtn) {
        copySummaryBtn.addEventListener('click', () => {
            copyToClipboard(lastSummaryText, 'Summary copied to clipboard!');
        });
    }

    // ==========================================================================
    // FEATURE 4: MCQ Generator
    // ==========================================================================
    const mcqForm = document.getElementById('mcqForm');
    const mcqTopic = document.getElementById('mcqTopic');
    const mcqCount = document.getElementById('mcqCount');
    const mcqDifficulty = document.getElementById('mcqDifficulty');
    const generateMcqBtn = document.getElementById('generateMcqBtn');
    const mcqLoading = document.getElementById('mcqLoading');
    const mcqPlaceholder = document.getElementById('mcqPlaceholder');
    const mcqOutput = document.getElementById('mcqOutput');
    const copyMcqBtn = document.getElementById('copyMcqBtn');
    const downloadMcqBtn = document.getElementById('downloadMcqBtn');

    if (mcqForm) {
        mcqForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const topic = mcqTopic.value.trim();
            if (!topic) return;

            generateMcqBtn.disabled = true;
            generateMcqBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating MCQs...';
            mcqPlaceholder.classList.add('hidden');
            mcqOutput.classList.add('hidden');
            mcqLoading.classList.remove('hidden');

            try {
                const res = await fetch('/api/mcq', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic: topic,
                        count: parseInt(mcqCount.value, 10),
                        difficulty: mcqDifficulty.value
                    })
                });
                const data = await res.json();

                mcqLoading.classList.add('hidden');

                if (data.success) {
                    state.lastGeneratedMcqs = data.mcqs;
                    state.lastMcqTopic = topic;
                    mcqOutput.innerHTML = typeof marked !== 'undefined' ? marked.parse(data.mcqs) : data.mcqs;
                    mcqOutput.classList.remove('hidden');
                    copyMcqBtn.disabled = false;
                    downloadMcqBtn.disabled = false;
                    showToast(`Generated ${mcqCount.value} MCQs!`, 'success');
                } else {
                    mcqPlaceholder.classList.remove('hidden');
                    showToast(data.error || 'Failed to generate MCQs.', 'error');
                }
            } catch (err) {
                mcqLoading.classList.add('hidden');
                mcqPlaceholder.classList.remove('hidden');
                showToast('Network error while connecting to server.', 'error');
            } finally {
                generateMcqBtn.disabled = false;
                generateMcqBtn.innerHTML = '<i class="fa-solid fa-list-ol"></i> Generate MCQs';
            }
        });
    }

    if (copyMcqBtn) {
        copyMcqBtn.addEventListener('click', () => {
            copyToClipboard(state.lastGeneratedMcqs, 'MCQs copied to clipboard!');
        });
    }

    if (downloadMcqBtn) {
        downloadMcqBtn.addEventListener('click', () => {
            const filename = (state.lastMcqTopic || 'practice-mcqs')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-') + '-mcqs.md';
            downloadMarkdownFile(filename, state.lastGeneratedMcqs);
        });
    }

    // ==========================================================================
    // FEATURE 5: Practice Quiz (Interactive Engine)
    // ==========================================================================
    const quizForm = document.getElementById('quizForm');
    const quizTopic = document.getElementById('quizTopic');
    const quizCount = document.getElementById('quizCount');
    const quizDifficulty = document.getElementById('quizDifficulty');
    const startQuizBtn = document.getElementById('startQuizBtn');

    const quizSetupCard = document.getElementById('quizSetupCard');
    const quizLoading = document.getElementById('quizLoading');
    const quizActiveCard = document.getElementById('quizActiveCard');
    const quizScoreCard = document.getElementById('quizScoreCard');

    const activeQuizTopic = document.getElementById('activeQuizTopic');
    const activeQuizDifficulty = document.getElementById('activeQuizDifficulty');
    const currentQuestionNum = document.getElementById('currentQuestionNum');
    const totalQuestionsNum = document.getElementById('totalQuestionsNum');
    const quizProgressBar = document.getElementById('quizProgressBar');
    const quizQuestionText = document.getElementById('quizQuestionText');
    const quizOptionsList = document.getElementById('quizOptionsList');
    const quizExplanationBox = document.getElementById('quizExplanationBox');
    const explanationBadge = document.getElementById('explanationBadge');
    const quizExplanationText = document.getElementById('quizExplanationText');

    const quizPrevBtn = document.getElementById('quizPrevBtn');
    const quizNextBtn = document.getElementById('quizNextBtn');
    const quizFinishBtn = document.getElementById('quizFinishBtn');

    const scoreDisplay = document.getElementById('scoreDisplay');
    const scorePercent = document.getElementById('scorePercent');
    const scoreIcon = document.getElementById('scoreIcon');
    const scoreTitle = document.getElementById('scoreTitle');
    const scoreSubtitle = document.getElementById('scoreSubtitle');
    const quizReviewList = document.getElementById('quizReviewList');
    const retakeQuizBtn = document.getElementById('retakeQuizBtn');
    const newQuizBtn = document.getElementById('newQuizBtn');

    if (quizForm) {
        quizForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const topic = quizTopic.value.trim();
            if (!topic) return;

            quizSetupCard.classList.add('hidden');
            quizActiveCard.classList.add('hidden');
            quizScoreCard.classList.add('hidden');
            quizLoading.classList.remove('hidden');

            try {
                const res = await fetch('/api/quiz', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic: topic,
                        count: parseInt(quizCount.value, 10),
                        difficulty: quizDifficulty.value
                    })
                });
                const data = await res.json();
                quizLoading.classList.add('hidden');

                if (data.success && data.quiz && Array.isArray(data.quiz.questions) && data.quiz.questions.length > 0) {
                    state.currentQuiz = data.quiz;
                    state.quizIndex = 0;
                    state.quizAnswers = {};

                    // Start interactive quiz view
                    startInteractiveQuiz();
                } else {
                    quizSetupCard.classList.remove('hidden');
                    showToast(data.error || 'Could not generate quiz format. Try a simpler topic.', 'error');
                }
            } catch (err) {
                quizLoading.classList.add('hidden');
                quizSetupCard.classList.remove('hidden');
                showToast('Network error while launching quiz.', 'error');
            }
        });
    }

    function startInteractiveQuiz() {
        if (!state.currentQuiz) return;

        quizSetupCard.classList.add('hidden');
        quizScoreCard.classList.add('hidden');
        quizActiveCard.classList.remove('hidden');

        activeQuizTopic.textContent = state.currentQuiz.title || quizTopic.value;
        activeQuizDifficulty.textContent = state.currentQuiz.difficulty || 'Intermediate';
        totalQuestionsNum.textContent = state.currentQuiz.questions.length;

        renderCurrentQuestion();
    }

    function renderCurrentQuestion() {
        const q = state.currentQuiz.questions[state.quizIndex];
        const total = state.currentQuiz.questions.length;

        currentQuestionNum.textContent = state.quizIndex + 1;
        quizProgressBar.style.width = `${((state.quizIndex + 1) / total) * 100}%`;
        quizQuestionText.textContent = q.question;

        // Render options A, B, C, D
        quizOptionsList.innerHTML = '';
        const letters = ['A', 'B', 'C', 'D'];
        const hasAnswered = state.quizAnswers.hasOwnProperty(state.quizIndex);
        const selectedIdx = state.quizAnswers[state.quizIndex];

        q.options.forEach((optText, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';

            // If already answered, color code it
            if (hasAnswered) {
                btn.disabled = true;
                if (idx === q.correct_index) {
                    btn.classList.add('correct');
                } else if (idx === selectedIdx) {
                    btn.classList.add('incorrect');
                }
            }

            btn.innerHTML = `
                <span class="option-badge">${letters[idx]}</span>
                <span class="option-text">${optText}</span>
            `;

            btn.addEventListener('click', () => handleOptionSelect(idx));
            quizOptionsList.appendChild(btn);
        });

        // Explanation Box
        if (hasAnswered) {
            quizExplanationBox.classList.remove('hidden');
            if (selectedIdx === q.correct_index) {
                explanationBadge.className = 'explanation-badge'
                explanationBadge.style.color = 'var(--success)';
                explanationBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Correct!';
            } else {
                explanationBadge.className = 'explanation-badge';
                explanationBadge.style.color = 'var(--danger)';
                explanationBadge.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Incorrect (Correct Answer: Option ${letters[q.correct_index]})`;
            }
            quizExplanationText.textContent = q.explanation || 'No additional explanation available.';
        } else {
            quizExplanationBox.classList.add('hidden');
        }

        // Navigation button states
        quizPrevBtn.disabled = state.quizIndex === 0;

        if (state.quizIndex === total - 1) {
            quizNextBtn.classList.add('hidden');
            quizFinishBtn.classList.remove('hidden');
        } else {
            quizNextBtn.classList.remove('hidden');
            quizFinishBtn.classList.add('hidden');
        }
    }

    function handleOptionSelect(optionIdx) {
        if (state.quizAnswers.hasOwnProperty(state.quizIndex)) return; // already answered

        state.quizAnswers[state.quizIndex] = optionIdx;
        renderCurrentQuestion();
    }

    if (quizPrevBtn) {
        quizPrevBtn.addEventListener('click', () => {
            if (state.quizIndex > 0) {
                state.quizIndex--;
                renderCurrentQuestion();
            }
        });
    }

    if (quizNextBtn) {
        quizNextBtn.addEventListener('click', () => {
            if (state.quizIndex < state.currentQuiz.questions.length - 1) {
                state.quizIndex++;
                renderCurrentQuestion();
            }
        });
    }

    if (quizFinishBtn) {
        quizFinishBtn.addEventListener('click', () => {
            showQuizResults();
        });
    }

    function showQuizResults() {
        quizActiveCard.classList.add('hidden');
        quizScoreCard.classList.remove('hidden');

        const questions = state.currentQuiz.questions;
        let correctCount = 0;

        questions.forEach((q, idx) => {
            if (state.quizAnswers[idx] === q.correct_index) {
                correctCount++;
            }
        });

        const total = questions.length;
        const percentage = Math.round((correctCount / total) * 100);

        scoreDisplay.textContent = `${correctCount}/${total}`;
        scorePercent.textContent = `${percentage}%`;

        if (percentage >= 80) {
            scoreIcon.textContent = '🏆';
            scoreTitle.textContent = 'Outstanding Mastery!';
            scoreSubtitle.textContent = 'You have thoroughly mastered this topic.';
        } else if (percentage >= 50) {
            scoreIcon.textContent = '👏';
            scoreTitle.textContent = 'Good Effort!';
            scoreSubtitle.textContent = 'Solid foundation. Review the breakdown below to hit 100%.';
        } else {
            scoreIcon.textContent = '📚';
            scoreTitle.textContent = 'Keep Practicing!';
            scoreSubtitle.textContent = 'Review the detailed solutions below and give it another shot.';
        }

        // Render Review breakdown
        quizReviewList.innerHTML = '';
        const letters = ['A', 'B', 'C', 'D'];

        questions.forEach((q, idx) => {
            const userChoice = state.quizAnswers[idx];
            const isCorrect = userChoice === q.correct_index;

            const item = document.createElement('div');
            item.className = `review-item ${isCorrect ? 'pass' : 'fail'}`;

            const userChoiceText = userChoice !== undefined
                ? `${letters[userChoice]}) ${q.options[userChoice]}`
                : 'Not answered';
            const correctChoiceText = `${letters[q.correct_index]}) ${q.options[q.correct_index]}`;

            item.innerHTML = `
                <div class="review-q-title">Q${idx + 1}: ${q.question}</div>
                <div class="review-answer-line">
                    <strong>Your Answer:</strong> 
                    <span style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'}">
                        ${userChoiceText} ${isCorrect ? '✓' : '✗'}
                    </span>
                </div>
                ${!isCorrect ? `
                <div class="review-answer-line">
                    <strong>Correct Answer:</strong> 
                    <span style="color: var(--success)">${correctChoiceText}</span>
                </div>` : ''}
                <div class="review-explanation">
                    <strong>Explanation:</strong> ${q.explanation}
                </div>
            `;
            quizReviewList.appendChild(item);
        });
    }

    if (retakeQuizBtn) {
        retakeQuizBtn.addEventListener('click', () => {
            state.quizIndex = 0;
            state.quizAnswers = {};
            startInteractiveQuiz();
        });
    }

    if (newQuizBtn) {
        newQuizBtn.addEventListener('click', () => {
            quizScoreCard.classList.add('hidden');
            quizSetupCard.classList.remove('hidden');
            quizTopic.focus();
        });
    }

    // ==========================================================================
    // FEATURE 6: Simple Explanation (ELI5)
    // ==========================================================================
    const explainForm = document.getElementById('explainForm');
    const explainTopic = document.getElementById('explainTopic');
    const explainAudience = document.getElementById('explainAudience');
    const explainTheme = document.getElementById('explainTheme');
    const explainBtn = document.getElementById('explainBtn');
    const explainLoading = document.getElementById('explainLoading');
    const explainPlaceholder = document.getElementById('explainPlaceholder');
    const explainOutput = document.getElementById('explainOutput');
    const copyExplainBtn = document.getElementById('copyExplainBtn');

    let lastExplanationText = '';

    if (explainForm) {
        explainForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const topic = explainTopic.value.trim();
            if (!topic) return;

            explainBtn.disabled = true;
            explainBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Simplifying...';
            explainPlaceholder.classList.add('hidden');
            explainOutput.classList.add('hidden');
            explainLoading.classList.remove('hidden');

            try {
                const res = await fetch('/api/explain', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        topic: topic,
                        audience: explainAudience.value,
                        theme: explainTheme.value
                    })
                });
                const data = await res.json();

                explainLoading.classList.add('hidden');

                if (data.success) {
                    lastExplanationText = data.explanation;
                    explainOutput.innerHTML = typeof marked !== 'undefined' ? marked.parse(data.explanation) : data.explanation;
                    explainOutput.classList.remove('hidden');
                    copyExplainBtn.disabled = false;
                    showToast('Concept simplified successfully!', 'success');
                } else {
                    explainPlaceholder.classList.remove('hidden');
                    showToast(data.error || 'Failed to explain topic.', 'error');
                }
            } catch (err) {
                explainLoading.classList.add('hidden');
                explainPlaceholder.classList.remove('hidden');
                showToast('Network error while connecting to server.', 'error');
            } finally {
                explainBtn.disabled = false;
                explainBtn.innerHTML = '<i class="fa-solid fa-lightbulb"></i> Explain In Plain English';
            }
        });
    }

    if (copyExplainBtn) {
        copyExplainBtn.addEventListener('click', () => {
            copyToClipboard(lastExplanationText, 'Explanation copied to clipboard!');
        });
    }
});
