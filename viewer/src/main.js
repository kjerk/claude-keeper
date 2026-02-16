import { Conversation } from './conversation.js';
import { ACTION, fmtModel, showToast, fullRender, renderFrom } from './render.js';
import { initPanel, openPanel, closePanel } from './panel.js';

const THEME_STORAGE_KEY = 'claude-keeper-theme';

class ClaudeKeeper {
	constructor() {
		this.conversation = null;
		this.themes = [];
		this.el = {
			dropZone: document.getElementById('drop-zone'),
			dropArea: document.getElementById('drop-area'),
			fileInput: document.getElementById('file-input'),
			app: document.getElementById('app'),
			convTitle: document.getElementById('conv-title'),
			convModel: document.getElementById('conv-model'),
			openBtn: document.getElementById('open-btn'),
			closeBtn: document.getElementById('close-btn'),
			messagesContainer: document.getElementById('messages-container'),
			dragOverlay: document.getElementById('drag-overlay'),
			themeToggle: document.getElementById('theme-toggle'),
			themeMenu: document.getElementById('theme-menu'),
		};

		initPanel();
		this.initThemes();
		this.initDropZone();
		this.initDragReplace();
		this.initEvents();
	}

	// ── Theme System ──
	initThemes() {
		this.themes = this.discoverThemes();

		// Build menu
		this.themes.forEach(theme => {
			const btn = document.createElement('button');
			btn.className = 'theme-option';
			btn.dataset.theme = theme.id;
			btn.innerHTML = `<span class="theme-option-dot" style="background:${theme.bg || (theme.type === 'dark' ? '#1a1a1a' : '#f0eeeb')}"></span>${theme.label}`;
			this.el.themeMenu.appendChild(btn);
		});

		this.updateThemeMenu();

		// Toggle menu
		this.el.themeToggle.addEventListener('click', e => {
			e.stopPropagation();
			this.el.themeMenu.classList.toggle('open');
		});

		// Select theme
		this.el.themeMenu.addEventListener('click', e => {
			const opt = e.target.closest('[data-theme]');
			if (!opt) return;
			this.setTheme(opt.dataset.theme);
			this.el.themeMenu.classList.remove('open');
		});

		// Close menu on outside click
		document.addEventListener('click', e => {
			if (!e.target.closest('#theme-picker')) {
				this.el.themeMenu.classList.remove('open');
			}
		});
	}

	discoverThemes() {
		const themes = [];
		const seen = new Set();

		for (const sheet of document.styleSheets) {
			try {
				for (const rule of sheet.cssRules) {
					const match = rule.selectorText?.match(/\[data-theme="([^"]+)"\]/);
					if (match && !seen.has(match[1])) {
						seen.add(match[1]);
						// Temporarily apply theme to read its metadata
						const prev = document.documentElement.getAttribute('data-theme');
						document.documentElement.setAttribute('data-theme', match[1]);
						const style = getComputedStyle(document.documentElement);
						const label = style.getPropertyValue('--theme-label').trim().replace(/"/g, '') || match[1];
						const type = style.getPropertyValue('--theme-type').trim().replace(/"/g, '') || 'dark';
						const bg = style.getPropertyValue('--bg-primary').trim();
						document.documentElement.setAttribute('data-theme', prev);

						themes.push({ id: match[1], label, type, bg });
					}
				}
			} catch (_) { /* cross-origin sheets */ }
		}

		return themes;
	}

	setTheme(id) {
		document.documentElement.setAttribute('data-theme', id);
		localStorage.setItem(THEME_STORAGE_KEY, id);
		this.updateThemeMenu();
	}

	updateThemeMenu() {
		const current = document.documentElement.getAttribute('data-theme');
		this.el.themeMenu.querySelectorAll('.theme-option').forEach(btn => {
			btn.classList.toggle('active', btn.dataset.theme === current);
		});
	}

	// ── Drop Zone ──
	initDropZone() {
		const { dropArea, fileInput, openBtn, closeBtn } = this.el;

		dropArea.addEventListener('dragover', e => { e.preventDefault(); dropArea.classList.add('drag-over'); });
		dropArea.addEventListener('dragleave', () => dropArea.classList.remove('drag-over'));
		dropArea.addEventListener('drop', e => {
			e.preventDefault(); dropArea.classList.remove('drag-over');
			if (e.dataTransfer.files[0]) this.loadFile(e.dataTransfer.files[0]);
		});

		dropArea.querySelector('.drop-browse').addEventListener('click', () => fileInput.click());
		fileInput.addEventListener('change', () => { if (fileInput.files[0]) this.loadFile(fileInput.files[0]); });
		openBtn.addEventListener('click', () => { fileInput.value = ''; fileInput.click(); });
		closeBtn.addEventListener('click', () => this.unloadConversation());
	}

	// ── Drag-to-Replace Overlay ──
	initDragReplace() {
		let dragCounter = 0;

		document.addEventListener('dragenter', e => {
			if (!this.conversation) return;
			if (!e.dataTransfer.types.includes('Files')) return;
			dragCounter++;
			this.el.dragOverlay.classList.add('visible');
		});

		document.addEventListener('dragleave', () => {
			if (!this.conversation) return;
			dragCounter--;
			if (dragCounter <= 0) {
				dragCounter = 0;
				this.el.dragOverlay.classList.remove('visible');
			}
		});

		this.el.dragOverlay.addEventListener('dragover', e => e.preventDefault());

		this.el.dragOverlay.addEventListener('drop', e => {
			e.preventDefault();
			dragCounter = 0;
			this.el.dragOverlay.classList.remove('visible');
			if (e.dataTransfer.files[0]) this.loadFile(e.dataTransfer.files[0]);
		});
	}

	// ── Event Delegation ──
	initEvents() {
		this.el.messagesContainer.addEventListener('click', e => this.handleClick(e));
	}

	handleClick(e) {
		const actionEl = e.target.closest('[data-action]');
		if (!actionEl) return;

		switch (actionEl.dataset.action) {
			case ACTION.branch: {
				const divIdx = this.conversation.switchBranch(
					actionEl.dataset.parent,
					parseInt(actionEl.dataset.dir, 10)
				);
				if (divIdx !== undefined) renderFrom(this.conversation, this.el.messagesContainer, divIdx);
				break;
			}

			case ACTION.copyMsg: {
				const msg = this.conversation.getMessage(actionEl.dataset.uuid);
				if (!msg) return;
				const txt = msg.content.filter(b => b.type === 'text').map(b => b.text || '').join('\n\n').trim();
				navigator.clipboard.writeText(txt).then(() => {
					actionEl.classList.add('copied');
					showToast('Copied to clipboard');
					setTimeout(() => actionEl.classList.remove('copied'), 1800);
				}).catch(() => showToast('Copy failed'));
				break;
			}

			case ACTION.copyCode: {
				const codeEl = document.getElementById(actionEl.dataset.target);
				if (!codeEl) return;
				navigator.clipboard.writeText(codeEl.textContent).then(() => {
					actionEl.classList.add('copied');
					const orig = actionEl.innerHTML;
					actionEl.innerHTML = '✓ Copied';
					setTimeout(() => { actionEl.classList.remove('copied'); actionEl.innerHTML = orig; }, 1500);
				});
				break;
			}

			case ACTION.openAttachment: {
				const att = this.conversation.getAttachment(actionEl.dataset.id);
				if (att) openPanel(att);
				break;
			}

			case ACTION.toggleBlock: {
				const block = document.getElementById(actionEl.dataset.target);
				if (block) block.classList.toggle('open');
				break;
			}
		}
	}

	// ── File Loading ──
	loadFile(file) {
		const r = new FileReader();
		r.onload = e => {
			try {
				const data = JSON.parse(e.target.result);
				if (!data.chat_messages || !Array.isArray(data.chat_messages)) {
					showToast('Invalid format: no chat_messages found'); return;
				}
				this.loadConversation(data);
			} catch (err) { showToast('Failed to parse JSON: ' + err.message); }
		};
		r.readAsText(file);
	}

	loadConversation(data) {
		closePanel();
		this.conversation = new Conversation(data);

		this.el.convTitle.textContent = this.conversation.name;
		this.el.convModel.textContent = fmtModel(this.conversation.model);

		this.el.dropZone.classList.add('hidden');
		this.el.app.classList.add('visible');

		fullRender(this.conversation, this.el.messagesContainer);
	}

	unloadConversation() {
		closePanel();
		this.conversation = null;

		this.el.messagesContainer.innerHTML = '';
		this.el.convTitle.textContent = '';
		this.el.convModel.textContent = '';

		this.el.app.classList.remove('visible');
		this.el.dropZone.classList.remove('hidden');
	}
}

// ── Entry Point ──
new ClaudeKeeper();
