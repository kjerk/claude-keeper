// ── Action identifiers (shared between rendered HTML and event delegation) ──
export const ACTION = {
	branch: 'branch',
	copyMsg: 'copy-msg',
	copyCode: 'copy-code',
	openAttachment: 'open-attachment',
	toggleBlock: 'toggle-block',
};

// ── Icons ──
const ICON_COPY = `<svg class="icon-copy" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const ICON_CHECK = `<svg class="icon-check" width="20" height="20" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M15.1883 5.10908C15.3699 4.96398 15.6346 4.96153 15.8202 5.11592C16.0056 5.27067 16.0504 5.53125 15.9403 5.73605L15.8836 5.82003L8.38354 14.8202C8.29361 14.9279 8.16242 14.9925 8.02221 14.9989C7.88203 15.0051 7.74545 14.9526 7.64622 14.8534L4.14617 11.3533L4.08172 11.2752C3.95384 11.0811 3.97542 10.817 4.14617 10.6463C4.31693 10.4755 4.58105 10.4539 4.77509 10.5818L4.85321 10.6463L7.96556 13.7586L15.1161 5.1794L15.1883 5.10908Z"/></svg>`;

// ── Helpers ──
export function esc(s) {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function fmtSize(b) {
	if (!b && b !== 0) return '';
	if (b < 1024) return b + ' B';
	if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
	return (b / 1048576).toFixed(1) + ' MB';
}

export function fmtModel(m) {
	if (!m) return '';
	return m.replace(/-\d{8}$/, '').replace(/^claude-/, '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function showToast(msg) {
	const t = document.getElementById('toast');
	t.textContent = msg;
	t.classList.add('show');
	setTimeout(() => t.classList.remove('show'), 2200);
}

// ── Markdown Setup ──
marked.use({
	gfm: true,
	breaks: false,
	renderer: {
		code({ text, lang }) {
			const label = lang || 'code';
			const hi = lang && hljs.getLanguage(lang)
				? hljs.highlight(text, { language: lang }).value : esc(text);
			const id = 'c' + Math.random().toString(36).slice(2, 9);
			return `<pre><div class="code-block-header"><span>${esc(label)}</span><button class="code-copy-btn" data-action="${ACTION.copyCode}" data-target="${id}">⎘ Copy</button></div><code id="${id}" class="hljs language-${esc(label)}">${hi}</code></pre>`;
		},
	},
});

function renderMd(text) {
	if (!text || !text.trim()) return '';
	try { return marked.parse(text.trim()); } catch (e) { console.error('[ClaudeKeeper] Markdown parse failed:', e); return `<p>${esc(text)}</p>`; }
}

// ── Block Rendering ──
function renderBlock(b) {
	switch (b.type) {
		case 'text': return renderMd(b.text || '');

		case 'thinking': {
			const id = 't' + Math.random().toString(36).slice(2, 9);
			let sum = '';
			if (b.summaries && b.summaries.length) {
				sum = `<div class="thinking-summary">${b.summaries.map(s => esc(s.summary)).join(' · ')}</div>`;
			}
			return `<div class="thinking-block" id="${id}">
				<button class="thinking-toggle" data-action="${ACTION.toggleBlock}" data-target="${id}">
					<span class="thinking-chevron">▸</span><span>Thinking</span>
				</button>
				<div class="thinking-content">${esc(b.thinking || '')}${sum}</div>
			</div>`;
		}

		case 'tool_use': {
			const id = 'u' + Math.random().toString(36).slice(2, 9);
			const inp = typeof b.input === 'object' ? JSON.stringify(b.input, null, 2) : String(b.input || '');
			return `<div class="tool-block" id="${id}">
				<button class="tool-header" data-action="${ACTION.toggleBlock}" data-target="${id}">
					<span class="tool-chevron">▸</span><span>Tool: ${esc(b.name || 'unknown')}</span>
				</button>
				<div class="tool-content">${esc(inp)}</div>
			</div>`;
		}

		case 'tool_result': {
			const id = 'r' + Math.random().toString(36).slice(2, 9);
			let txt = '';
			if (Array.isArray(b.content)) {
				txt = b.content.filter(c => c.type === 'text').map(c => c.text || '').join('\n');
			} else if (typeof b.content === 'string') txt = b.content;
			return `<div class="tool-block" id="${id}">
				<button class="tool-header" data-action="${ACTION.toggleBlock}" data-target="${id}">
					<span class="tool-chevron">▸</span><span>Result${b.is_error ? ' (error)' : ''}</span>
				</button>
				<div class="tool-content">${esc(txt)}</div>
			</div>`;
		}

		case 'token_budget': return '';
		default: return '';
	}
}

// ── Message Rendering ──
export function mkMsg(conv, msg, index) {
	const div = document.createElement('div');
	div.className = 'message';
	div.style.animationDelay = `${Math.min(index * 0.03, 0.3)}s`;
	div.dataset.uuid = msg.uuid;

	const isHuman = msg.sender === 'human';
	const sibs = conv.getChildren(msg.parent_message_uuid);
	const sibIdx = sibs.indexOf(msg.uuid);
	const hasBranch = sibs.length > 1;

	let h = '';

	h += `<div class="message-header"><div class="message-sender">`;
	h += `<span class="sender-dot ${isHuman ? 'human' : 'assistant'}"></span>`;
	h += `<span class="sender-label">${isHuman ? 'You' : 'Claude'}</span>`;
	h += `</div></div>`;

	if (msg.attachments && msg.attachments.length) {
		msg.attachments.forEach(att => {
			h += `<div class="attachment" data-action="${ACTION.openAttachment}" data-id="${esc(att.id)}">`;
			h += `<div class="attachment-icon">📄</div>`;
			h += `<div class="attachment-info">`;
			h += `<div class="attachment-name">${esc(att.file_name)}</div>`;
			h += `<div class="attachment-detail">${att.file_type || 'file'} · ${fmtSize(att.file_size)}</div>`;
			h += `<div class="attachment-hint">Click to view</div>`;
			h += `</div></div>`;
		});
	}

	h += `<div class="message-body">`;
	msg.content.forEach(b => { h += renderBlock(b); });
	h += `</div>`;

	h += `<div class="message-footer">`;
	if (hasBranch) {
		h += `<div class="branch-nav">`;
		h += `<button class="branch-btn" data-action="${ACTION.branch}" data-parent="${esc(msg.parent_message_uuid)}" data-dir="-1" ${sibIdx === 0 ? 'disabled' : ''}>‹</button>`;
		h += `<span class="branch-label">${sibIdx + 1} / ${sibs.length}</span>`;
		h += `<button class="branch-btn" data-action="${ACTION.branch}" data-parent="${esc(msg.parent_message_uuid)}" data-dir="1" ${sibIdx === sibs.length - 1 ? 'disabled' : ''}>›</button>`;
		h += `</div>`;
	}

	if (msg.created_at) {
		h += `<div class="message-timestamp">${new Date(msg.created_at).toLocaleString()}</div>`;
	}

	h += `<div class="msg-actions">`;
	h += `<button class="msg-action-btn" data-action="${ACTION.copyMsg}" data-uuid="${esc(msg.uuid)}" title="Copy text">${ICON_COPY}${ICON_CHECK}</button>`;
	h += `</div>`;
	h += `</div>`;

	div.innerHTML = h;
	return div;
}

export function fullRender(conv, container) {
	container.innerHTML = '';
	conv.activePath.forEach((uuid, i) => container.appendChild(mkMsg(conv, conv.getMessage(uuid), i)));
}

export function renderFrom(conv, container, idx) {
	const kids = Array.from(container.children);
	for (let i = kids.length - 1; i >= idx; i--) container.removeChild(kids[i]);
	for (let i = idx; i < conv.activePath.length; i++) {
		container.appendChild(mkMsg(conv, conv.getMessage(conv.activePath[i]), i));
	}
}
