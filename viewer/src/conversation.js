const ROOT = '00000000-0000-4000-8000-000000000000';

export class Conversation {
	constructor(data) {
		this.data = data;
		this.childrenMap = {};
		this.messageMap = {};
		this.selectedChildren = {};
		this.activePath = [];
		this.attachmentMap = {};
		this._parse();
	}

	get name() { return this.data.name || 'Untitled Conversation'; }
	get model() { return this.data.model || ''; }

	getMessage(uuid) { return this.messageMap[uuid]; }
	getChildren(parentUuid) { return this.childrenMap[parentUuid] || []; }
	getAttachment(id) { return this.attachmentMap[id]; }

	_parse() {
		this.data.chat_messages.forEach(msg => {
			this.messageMap[msg.uuid] = msg;
			const p = msg.parent_message_uuid;
			if (!this.childrenMap[p]) this.childrenMap[p] = [];
			this.childrenMap[p].push(msg.uuid);
			if (msg.attachments) {
				msg.attachments.forEach(att => { this.attachmentMap[att.id] = att; });
			}
		});

		// Walk from the current leaf to root to determine the active branch
		const pathSet = new Set();
		let cur = this.data.current_leaf_message_uuid;
		while (cur && this.messageMap[cur]) {
			pathSet.add(cur);
			cur = this.messageMap[cur].parent_message_uuid;
		}

		for (const uuid of pathSet) {
			const msg = this.messageMap[uuid];
			if (msg) this.selectedChildren[msg.parent_message_uuid] = uuid;
		}

		// Default selections for branches not on the active path
		for (const p of Object.keys(this.childrenMap)) {
			if (!this.selectedChildren[p]) this.selectedChildren[p] = this.childrenMap[p][0];
		}

		this.activePath = this.buildPath();
	}

	buildPath() {
		const path = [];
		let p = ROOT;
		while (true) {
			const sel = this.selectedChildren[p];
			if (!sel || !this.messageMap[sel]) break;
			path.push(sel);
			p = sel;
		}
		return path;
	}

	_propagate(uuid) {
		const ch = this.childrenMap[uuid];
		if (!ch || !ch.length) return;
		if (!this.selectedChildren[uuid] || !ch.includes(this.selectedChildren[uuid])) {
			this.selectedChildren[uuid] = ch[0];
		}
		this._propagate(this.selectedChildren[uuid]);
	}

	/**
	 * Switch to an adjacent sibling at the given parent node.
	 * Returns the divergence index for incremental re-render,
	 * or undefined if the switch is out of bounds.
	 */
	switchBranch(parentUuid, dir) {
		const sibs = this.childrenMap[parentUuid];
		if (!sibs) return;

		const curIdx = sibs.indexOf(this.selectedChildren[parentUuid]);
		const newIdx = curIdx + dir;
		if (newIdx < 0 || newIdx >= sibs.length) return;

		this.selectedChildren[parentUuid] = sibs[newIdx];
		this._propagate(sibs[newIdx]);

		const oldPath = this.activePath;
		const newPath = this.buildPath();

		let div = 0;
		while (div < oldPath.length && div < newPath.length && oldPath[div] === newPath[div]) div++;

		this.activePath = newPath;
		return div;
	}
}
