import { fmtSize, showToast } from './render.js';

const STORAGE_KEY = 'claude-keeper-panel-width';
const MIN_WIDTH = 280;
const MAX_WIDTH_RATIO = 0.8;

const SEL = {
	panel: 'panel',
	overlay: 'panel-overlay',
	closeBtn: 'panel-close-btn',
	copyBtn: 'panel-copy-btn',
	saveBtn: 'panel-save-btn',
	filename: 'panel-filename',
	filemeta: 'panel-filemeta',
	content: 'panel-content',
	resize: 'panel-resize',
};

let currentAttachment = null;
let el = {};

export function initPanel() {
	el = {};
	for (const [key, id] of Object.entries(SEL)) {
		el[key] = document.getElementById(id);
	}

	// Restore persisted width
	const savedWidth = localStorage.getItem(STORAGE_KEY);
	if (savedWidth) {
		el.panel.style.width = savedWidth + 'px';
	}

	el.overlay.addEventListener('click', closePanel);
	el.closeBtn.addEventListener('click', closePanel);

	document.addEventListener('keydown', e => {
		if (e.key === 'Escape' && el.panel.classList.contains('open')) closePanel();
	});

	el.copyBtn.addEventListener('click', () => {
		if (!currentAttachment || !currentAttachment.extracted_content) {
			showToast('No content to copy'); return;
		}
		navigator.clipboard.writeText(currentAttachment.extracted_content).then(() => {
			el.copyBtn.classList.add('copied');
			el.copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M15.1883 5.10908C15.3699 4.96398 15.6346 4.96153 15.8202 5.11592C16.0056 5.27067 16.0504 5.53125 15.9403 5.73605L15.8836 5.82003L8.38354 14.8202C8.29361 14.9279 8.16242 14.9925 8.02221 14.9989C7.88203 15.0051 7.74545 14.9526 7.64622 14.8534L4.14617 11.3533L4.08172 11.2752C3.95384 11.0811 3.97542 10.817 4.14617 10.6463C4.31693 10.4755 4.58105 10.4539 4.77509 10.5818L4.85321 10.6463L7.96556 13.7586L15.1161 5.1794L15.1883 5.10908Z"/></svg> Copied`;
			setTimeout(() => {
				el.copyBtn.classList.remove('copied');
				el.copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
			}, 1800);
		});
	});

	el.saveBtn.addEventListener('click', () => {
		if (!currentAttachment) return;
		const content = currentAttachment.extracted_content || '';
		const blob = new Blob([content], { type: currentAttachment.file_type || 'text/plain' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = currentAttachment.file_name || 'attachment.txt';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		showToast('Saved ' + currentAttachment.file_name);
	});

	initResize();
}

function initResize() {
	let dragging = false;

	el.resize.addEventListener('mousedown', e => {
		e.preventDefault();
		dragging = true;
		el.resize.classList.add('active');
		el.panel.style.transition = 'none';
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';
	});

	document.addEventListener('mousemove', e => {
		if (!dragging) return;
		const maxWidth = window.innerWidth * MAX_WIDTH_RATIO;
		const width = Math.min(maxWidth, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
		el.panel.style.width = width + 'px';
	});

	document.addEventListener('mouseup', () => {
		if (!dragging) return;
		dragging = false;
		el.resize.classList.remove('active');
		el.panel.style.transition = '';
		document.body.style.cursor = '';
		document.body.style.userSelect = '';
		localStorage.setItem(STORAGE_KEY, parseInt(el.panel.style.width, 10));
	});
}

export function openPanel(attachment) {
	currentAttachment = attachment;
	el.filename.textContent = attachment.file_name;
	el.filemeta.textContent = [attachment.file_type, fmtSize(attachment.file_size)].filter(Boolean).join(' · ');

	if (attachment.extracted_content) {
		el.content.className = 'panel-content';
		el.content.textContent = attachment.extracted_content;
	} else {
		el.content.className = 'panel-content panel-empty';
		el.content.textContent = 'No extracted content available for this attachment.';
	}

	el.panel.classList.add('open');
	el.overlay.classList.add('open');
}

export function closePanel() {
	el.panel.classList.remove('open');
	el.overlay.classList.remove('open');
	currentAttachment = null;
}
