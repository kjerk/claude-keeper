// ==UserScript==
// @name         Claude Keeper - Conversation Exporter
// @namespace    claude-keeper
// @version      0.0.0
// @description  Export Claude conversations as JSON (Ctrl/Cmd+E or click button)
// @author       kjerk
// @match        https://claude.ai/chat/*
// @run-at       document-idle
// @icon         https://www.google.com/s2/favicons?domain=claude.ai
// @grant        none
// ==/UserScript==

(function() {
	'use strict';

	const SCRIPT_NAME = 'ClaudeKeeper';
	const DEBUG = true;

	const BUTTON_ID = 'ck-export-btn';
	const CONVERSATION_ID_PATTERN = /\/chat\/([a-f0-9-]+)/;
	const ORG_ID_PATTERN = /organizationID\\":\\"(.*?)\\"/gi;
	const API_ENDPOINT = (orgId, convId) =>
		`https://claude.ai/api/organizations/${orgId}/chat_conversations/${convId}?tree=True&rendering_mode=messages&render_all_tools=true`;

	// ── Logging ──
	function log(msg) {
		if (DEBUG) console.log(`[${SCRIPT_NAME}]`, msg);
	}

	// ── ID Extraction ──
	function getConversationId() {
		const match = CONVERSATION_ID_PATTERN.exec(window.location.pathname);
		return match ? match[1] : null;
	}

	function getOrganizationId() {
		const match = ORG_ID_PATTERN.exec(document.body.innerHTML);
		ORG_ID_PATTERN.lastIndex = 0; // reset global regex state
		return match ? match[1] : null;
	}

	// ── API ──
	async function fetchConversation() {
		const convId = getConversationId();
		if (!convId) throw new Error('No conversation ID found in URL');

		const orgId = getOrganizationId();
		if (!orgId) throw new Error('No organization ID found on page');

		log(`Fetching conversation ${convId}`);
		const resp = await fetch(API_ENDPOINT(orgId, convId), {
			credentials: 'include',
			headers: { 'Accept': 'application/json' },
		});

		if (!resp.ok) throw new Error(`API returned ${resp.status}`);
		return resp.json();
	}

	// ── Download ──
	function downloadJson(data, filename) {
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	// ── Export ──
	async function doExport() {
		const btn = document.getElementById(BUTTON_ID);
		if (!btn) return;

		const originalHTML = btn.innerHTML;
		btn.innerHTML = '⏳ Exporting…';
		btn.disabled = true;
		btn.style.opacity = '0.7';

		try {
			const data = await fetchConversation();
			const title = (data.name || 'conversation').replace(/[^a-z0-9]+/gi, '_').replace(/_+/g, '_');
			const date = new Date().toISOString().split('T')[0];
			downloadJson(data, `${title}_${date}.json`);

			btn.innerHTML = '✓ Exported';
			log('Export complete');
			setTimeout(() => {
				btn.innerHTML = originalHTML;
				btn.disabled = false;
				btn.style.opacity = '';
			}, 2000);
		} catch (err) {
			log(`Export failed: ${err.message}`);
			btn.innerHTML = '✗ Failed';
			setTimeout(() => {
				btn.innerHTML = originalHTML;
				btn.disabled = false;
				btn.style.opacity = '';
			}, 3000);
		}
	}

	// ── Button ──
	function injectButton() {
		if (document.getElementById(BUTTON_ID)) return;
		if (!getConversationId()) return;

		const btn = document.createElement('button');
		btn.id = BUTTON_ID;
		btn.innerHTML = '⬡ Export';
		btn.addEventListener('click', doExport);
		document.body.appendChild(btn);

		const style = document.createElement('style');
		style.textContent = `
			#${BUTTON_ID} {
				position: fixed;
				bottom: 20px;
				right: 20px;
				z-index: 9999;
				padding: 8px 18px;
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
				font-size: 13px;
				font-weight: 500;
				color: #a39e96;
				background: #1a1a1a;
				border: 1px solid #2a2826;
				border-radius: 8px;
				cursor: pointer;
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
				transition: all 180ms ease;
				letter-spacing: 0.02em;
			}
			#${BUTTON_ID}:hover {
				color: #e8e4df;
				background: #242424;
				border-color: #9e6f4e;
				box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
				transform: translateY(-1px);
			}
			#${BUTTON_ID}:active {
				transform: translateY(0);
			}
			#${BUTTON_ID}:disabled {
				cursor: default;
				transform: none;
			}
		`;
		document.head.appendChild(style);
		log('Button injected');
	}

	function removeButton() {
		const btn = document.getElementById(BUTTON_ID);
		if (btn) btn.remove();
	}

	// ── Keyboard Shortcut ──
	function initKeyboard() {
		document.addEventListener('keydown', e => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
				e.preventDefault();
				doExport();
			}
		});
	}

	// ── URL Change Detection ──
	function watchNavigation() {
		let lastUrl = location.href;

		// Intercept pushState/replaceState for SPA navigation
		const originalPushState = history.pushState;
		const originalReplaceState = history.replaceState;

		history.pushState = function() {
			originalPushState.apply(this, arguments);
			onUrlChange();
		};
		history.replaceState = function() {
			originalReplaceState.apply(this, arguments);
			onUrlChange();
		};
		window.addEventListener('popstate', onUrlChange);

		function onUrlChange() {
			const url = location.href;
			if (url === lastUrl) return;
			lastUrl = url;
			log('Navigation detected');

			// Short delay for SPA to settle
			setTimeout(() => {
				if (getConversationId()) {
					injectButton();
				} else {
					removeButton();
				}
			}, 300);
		}
	}

	// ── Init ──
	function init() {
		log('Initializing');
		injectButton();
		initKeyboard();
		watchNavigation();
		log('Ready');
	}

	// Run after a short delay to let the SPA settle
	setTimeout(init, 500);
})();
