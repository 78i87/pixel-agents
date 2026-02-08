import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CLAUDE_TERMINAL_PATTERN = /^Claude Code #(\d+)$/;

interface AgentState {
	id: number;
	terminalRef: vscode.Terminal;
	projectDir: string;
	jsonlFile: string;
	fileOffset: number;
	lineBuffer: string;
	activeToolIds: Set<string>;
	activeToolStatuses: Map<string, string>;
	isWaiting: boolean;
}

class ArcadiaViewProvider implements vscode.WebviewViewProvider {
	private nextAgentId = 1;
	private nextTerminalIndex = 1;
	private agents = new Map<number, AgentState>();
	private claimedFiles = new Set<string>();
	private webviewView: vscode.WebviewView | undefined;

	// Per-agent timers
	private fileWatchers = new Map<number, fs.FSWatcher>();
	private pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
	private waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();

	// Per-terminal scan state (runs continuously to pick up new JSONL files)
	private terminalProjectDirs = new Map<vscode.Terminal, string>();
	private terminalScanTimers = new Map<vscode.Terminal, ReturnType<typeof setInterval>>();

	constructor(private readonly context: vscode.ExtensionContext) {}

	private get extensionUri(): vscode.Uri {
		return this.context.extensionUri;
	}

	resolveWebviewView(webviewView: vscode.WebviewView) {
		this.webviewView = webviewView;
		webviewView.webview.options = { enableScripts: true };
		webviewView.webview.html = getWebviewContent(webviewView.webview, this.extensionUri);

		this.adoptExistingTerminals();

		webviewView.webview.onDidReceiveMessage((message) => {
			if (message.type === 'openClaude') {
				this.launchNewTerminal();
			} else if (message.type === 'focusAgent') {
				const agent = this.agents.get(message.id);
				if (agent) {
					agent.terminalRef.show();
				}
			} else if (message.type === 'closeAgent') {
				const agent = this.agents.get(message.id);
				if (agent) {
					agent.terminalRef.dispose();
				}
			} else if (message.type === 'webviewReady') {
				this.sendExistingAgents();
			} else if (message.type === 'openSessionsFolder') {
				const projectDir = this.getProjectDirPath();
				if (projectDir && fs.existsSync(projectDir)) {
					vscode.env.openExternal(vscode.Uri.file(projectDir));
				}
			}
		});

		vscode.window.onDidCloseTerminal((closed) => {
			// Remove all agents on this terminal
			for (const [id, agent] of this.agents) {
				if (agent.terminalRef === closed) {
					this.removeAgent(id);
					webviewView.webview.postMessage({ type: 'agentClosed', id });
				}
			}
			this.cleanupTerminalScan(closed);
		});

		vscode.window.onDidOpenTerminal((terminal) => {
			const match = terminal.name.match(CLAUDE_TERMINAL_PATTERN);
			if (match && !this.isTracked(terminal)) {
				const idx = parseInt(match[1], 10);
				if (idx >= this.nextTerminalIndex) {
					this.nextTerminalIndex = idx + 1;
				}
				this.startTerminalFileScan(terminal);
			}
		});
	}

	private launchNewTerminal() {
		const idx = this.nextTerminalIndex++;
		const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		const terminal = vscode.window.createTerminal({
			name: `Claude Code #${idx}`,
			cwd,
		});
		terminal.show();

		const sessionId = crypto.randomUUID();
		terminal.sendText(`claude --session-id ${sessionId}`);
		this.startTerminalFileScan(terminal, sessionId, cwd);
	}

	private startTerminalFileScan(terminal: vscode.Terminal, sessionId?: string, cwd?: string) {
		const projectDir = this.getProjectDirPath(cwd);
		if (!projectDir) {
			console.log(`[Arcadia] No project dir for terminal ${terminal.name}`);
			return;
		}
		this.terminalProjectDirs.set(terminal, projectDir);
		console.log(`[Arcadia] Terminal ${terminal.name}: scanning dir ${projectDir}`);

		const scanInterval = setInterval(() => this.scanForNewFiles(terminal, sessionId), 1000);
		this.terminalScanTimers.set(terminal, scanInterval);
	}

	private isFileRecent(filePath: string): boolean {
		const maxAge = vscode.workspace.getConfiguration('arcadia').get<number>('sessionMaxAgeSecs', 180);
		if (maxAge === 0) { return true; } // 0 = show all
		try {
			const mtime = fs.statSync(filePath).mtimeMs;
			return (Date.now() - mtime) < maxAge * 1000;
		} catch { return false; }
	}

	private scanForNewFiles(terminal: vscode.Terminal, sessionId?: string) {
		const projectDir = this.terminalProjectDirs.get(terminal);
		if (!projectDir) { return; }

		// Session-ID deterministic lookup (always claim own file regardless of age)
		if (sessionId) {
			const expectedFile = path.join(projectDir, `${sessionId}.jsonl`);
			try {
				if (fs.existsSync(expectedFile) && !this.claimedFiles.has(expectedFile)) {
					console.log(`[Arcadia] Terminal ${terminal.name}: found session file ${sessionId}.jsonl`);
					this.createAgentFromFile(terminal, expectedFile, projectDir);
				}
			} catch { /* file may not exist yet */ }
			// Session-ID terminals only claim their own file; /clear files are
			// picked up by the continuous generic scan below.
		}

		// Generic scan: pick up any unclaimed JSONL files in the project dir.
		// This handles adopted terminals (no session ID) and /clear files.
		// Only claim files modified within the configured max age.
		let files: string[];
		try {
			files = fs.readdirSync(projectDir)
				.filter(f => f.endsWith('.jsonl'))
				.map(f => path.join(projectDir, f));
		} catch { return; }

		for (const file of files) {
			if (!this.claimedFiles.has(file) && this.isFileRecent(file)) {
				console.log(`[Arcadia] Terminal ${terminal.name}: found unclaimed file ${path.basename(file)}`);
				this.createAgentFromFile(terminal, file, projectDir);
			}
		}
	}

	private createAgentFromFile(terminal: vscode.Terminal, filePath: string, projectDir: string) {
		const id = this.nextAgentId++;

		const agent: AgentState = {
			id,
			terminalRef: terminal,
			projectDir,
			jsonlFile: filePath,
			fileOffset: 0,
			lineBuffer: '',
			activeToolIds: new Set(),
			activeToolStatuses: new Map(),
			isWaiting: false,
		};

		this.agents.set(id, agent);
		this.claimedFiles.add(filePath);

		console.log(`[Arcadia] Agent ${id}: created, watching ${path.basename(filePath)}`);

		this.webviewView?.webview.postMessage({ type: 'agentCreated', id });
		this.startFileWatching(id, filePath);

		// Initial read
		this.readNewLines(id);
	}

	private startFileWatching(agentId: number, filePath: string) {
		// Primary: fs.watch
		try {
			const watcher = fs.watch(filePath, () => {
				this.readNewLines(agentId);
			});
			this.fileWatchers.set(agentId, watcher);
		} catch (e) {
			console.log(`[Arcadia] fs.watch failed for agent ${agentId}: ${e}`);
		}

		// Backup: poll every 2s
		const interval = setInterval(() => {
			if (!this.agents.has(agentId)) { clearInterval(interval); return; }
			this.readNewLines(agentId);
		}, 2000);
		this.pollingTimers.set(agentId, interval);
	}

	private removeAgent(agentId: number) {
		const agent = this.agents.get(agentId);
		if (!agent) { return; }

		// Stop file watching
		this.fileWatchers.get(agentId)?.close();
		this.fileWatchers.delete(agentId);
		const pt = this.pollingTimers.get(agentId);
		if (pt) { clearInterval(pt); }
		this.pollingTimers.delete(agentId);

		// Cancel waiting timer
		this.cancelWaitingTimer(agentId);

		// Unclaim file
		this.claimedFiles.delete(agent.jsonlFile);

		// Remove from maps
		this.agents.delete(agentId);
	}

	private cleanupTerminalScan(terminal: vscode.Terminal) {
		const timer = this.terminalScanTimers.get(terminal);
		if (timer) { clearInterval(timer); }
		this.terminalScanTimers.delete(terminal);
		this.terminalProjectDirs.delete(terminal);
	}

	private adoptExistingTerminals() {
		for (const terminal of vscode.window.terminals) {
			const match = terminal.name.match(CLAUDE_TERMINAL_PATTERN);
			if (match) {
				const idx = parseInt(match[1], 10);
				if (idx >= this.nextTerminalIndex) {
					this.nextTerminalIndex = idx + 1;
				}
				this.startTerminalFileScan(terminal);
			}
		}
	}

	private sendExistingAgents() {
		if (!this.webviewView) { return; }
		const agentIds: number[] = [];
		for (const id of this.agents.keys()) {
			agentIds.push(id);
		}
		agentIds.sort((a, b) => a - b);
		this.webviewView.webview.postMessage({
			type: 'existingAgents',
			agents: agentIds,
		});

		this.sendCurrentAgentStatuses();
	}

	private sendCurrentAgentStatuses() {
		if (!this.webviewView) { return; }
		for (const [agentId, agent] of this.agents) {
			// Re-send active tools
			for (const [toolId, status] of agent.activeToolStatuses) {
				this.webviewView.webview.postMessage({
					type: 'agentToolStart',
					id: agentId,
					toolId,
					status,
				});
			}
			// Re-send waiting status
			if (agent.isWaiting) {
				this.webviewView.webview.postMessage({
					type: 'agentStatus',
					id: agentId,
					status: 'waiting',
				});
			}
		}
	}

	private isTracked(terminal: vscode.Terminal): boolean {
		if (this.terminalScanTimers.has(terminal)) { return true; }
		for (const agent of this.agents.values()) {
			if (agent.terminalRef === terminal) { return true; }
		}
		return false;
	}

	// --- Transcript JSONL reading ---

	private getProjectDirPath(cwd?: string): string | null {
		const workspacePath = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
		if (!workspacePath) { return null; }
		const dirName = workspacePath.replace(/[:\\/]/g, '-');
		return path.join(os.homedir(), '.claude', 'projects', dirName);
	}

	private readNewLines(agentId: number) {
		const agent = this.agents.get(agentId);
		if (!agent) { return; }
		try {
			const stat = fs.statSync(agent.jsonlFile);
			if (stat.size <= agent.fileOffset) { return; }

			const buf = Buffer.alloc(stat.size - agent.fileOffset);
			const fd = fs.openSync(agent.jsonlFile, 'r');
			fs.readSync(fd, buf, 0, buf.length, agent.fileOffset);
			fs.closeSync(fd);
			agent.fileOffset = stat.size;

			const text = agent.lineBuffer + buf.toString('utf-8');
			const lines = text.split('\n');
			agent.lineBuffer = lines.pop() || '';

			for (const line of lines) {
				if (!line.trim()) { continue; }
				this.processTranscriptLine(agentId, line);
			}
		} catch (e) {
			console.log(`[Arcadia] Read error for agent ${agentId}: ${e}`);
		}
	}

	private clearAgentActivity(agentId: number) {
		const agent = this.agents.get(agentId);
		if (!agent) { return; }
		agent.activeToolIds.clear();
		agent.activeToolStatuses.clear();
		agent.isWaiting = false;
		this.webviewView?.webview.postMessage({ type: 'agentToolsClear', id: agentId });
		this.webviewView?.webview.postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
	}

	private cancelWaitingTimer(agentId: number) {
		const timer = this.waitingTimers.get(agentId);
		if (timer) {
			clearTimeout(timer);
			this.waitingTimers.delete(agentId);
		}
	}

	private startWaitingTimer(agentId: number, delayMs: number) {
		this.cancelWaitingTimer(agentId);
		const timer = setTimeout(() => {
			this.waitingTimers.delete(agentId);
			const agent = this.agents.get(agentId);
			if (agent) {
				agent.isWaiting = true;
			}
			this.webviewView?.webview.postMessage({
				type: 'agentStatus',
				id: agentId,
				status: 'waiting',
			});
		}, delayMs);
		this.waitingTimers.set(agentId, timer);
	}

	private processTranscriptLine(agentId: number, line: string) {
		const agent = this.agents.get(agentId);
		if (!agent) { return; }
		try {
			const record = JSON.parse(line);

			if (record.type === 'assistant' && Array.isArray(record.message?.content)) {
				const blocks = record.message.content as Array<{
					type: string; id?: string; name?: string; input?: Record<string, unknown>;
				}>;
				const hasToolUse = blocks.some(b => b.type === 'tool_use');

				if (hasToolUse) {
					this.cancelWaitingTimer(agentId);
					agent.isWaiting = false;
					this.webviewView?.webview.postMessage({ type: 'agentStatus', id: agentId, status: 'active' });
					for (const block of blocks) {
						if (block.type === 'tool_use' && block.id) {
							const status = this.formatToolStatus(block.name || '', block.input || {});
							console.log(`[Arcadia] Agent ${agentId} tool start: ${block.id} ${status}`);
							agent.activeToolIds.add(block.id);
							agent.activeToolStatuses.set(block.id, status);
							this.webviewView?.webview.postMessage({
								type: 'agentToolStart',
								id: agentId,
								toolId: block.id,
								status,
							});
						}
					}
				} else {
					const hasText = blocks.some(b => b.type === 'text');
					if (hasText) {
						this.startWaitingTimer(agentId, 2000);
					}
				}
			} else if (record.type === 'user') {
				const content = record.message?.content;
				if (Array.isArray(content)) {
					const blocks = content as Array<{ type: string; tool_use_id?: string }>;
					const hasToolResult = blocks.some(b => b.type === 'tool_result');
					if (hasToolResult) {
						for (const block of blocks) {
							if (block.type === 'tool_result' && block.tool_use_id) {
								console.log(`[Arcadia] Agent ${agentId} tool done: ${block.tool_use_id}`);
								agent.activeToolIds.delete(block.tool_use_id);
								agent.activeToolStatuses.delete(block.tool_use_id);
								const toolId = block.tool_use_id;
								setTimeout(() => {
									this.webviewView?.webview.postMessage({
										type: 'agentToolDone',
										id: agentId,
										toolId,
									});
								}, 300);
							}
						}
					} else {
						this.cancelWaitingTimer(agentId);
						this.clearAgentActivity(agentId);
					}
				} else if (typeof content === 'string' && content.trim()) {
					this.cancelWaitingTimer(agentId);
					this.clearAgentActivity(agentId);
				}
			} else if (record.type === 'system' && record.subtype === 'turn_duration') {
				this.cancelWaitingTimer(agentId);
				agent.isWaiting = true;
				this.webviewView?.webview.postMessage({
					type: 'agentStatus',
					id: agentId,
					status: 'waiting',
				});
			}
		} catch {
			// Ignore malformed lines
		}
	}

	private formatToolStatus(toolName: string, input: Record<string, unknown>): string {
		const base = (p: unknown) => typeof p === 'string' ? path.basename(p) : '';
		switch (toolName) {
			case 'Read': return `Reading ${base(input.file_path)}`;
			case 'Edit': return `Editing ${base(input.file_path)}`;
			case 'Write': return `Writing ${base(input.file_path)}`;
			case 'Bash': {
				const cmd = (input.command as string) || '';
				return `Running: ${cmd.length > 30 ? cmd.slice(0, 30) + '\u2026' : cmd}`;
			}
			case 'Glob': return 'Searching files';
			case 'Grep': return 'Searching code';
			case 'WebFetch': return 'Fetching web content';
			case 'WebSearch': return 'Searching the web';
			case 'Task': return 'Running subtask';
			case 'AskUserQuestion': return 'Waiting for your answer';
			case 'EnterPlanMode': return 'Planning';
			case 'NotebookEdit': return `Editing notebook`;
			default: return `Using ${toolName}`;
		}
	}

	dispose() {
		for (const id of [...this.agents.keys()]) {
			this.removeAgent(id);
		}
		for (const [terminal] of this.terminalScanTimers) {
			this.cleanupTerminalScan(terminal);
		}
	}
}

let providerInstance: ArcadiaViewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
	const provider = new ArcadiaViewProvider(context);
	providerInstance = provider;

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('arcadia.panelView', provider)
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('arcadia.showPanel', () => {
			vscode.commands.executeCommand('arcadia.panelView.focus');
		})
	);
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const distPath = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
	const indexPath = vscode.Uri.joinPath(distPath, 'index.html').fsPath;

	let html = fs.readFileSync(indexPath, 'utf-8');

	html = html.replace(/(href|src)="\.\/([^"]+)"/g, (_match, attr, filePath) => {
		const fileUri = vscode.Uri.joinPath(distPath, filePath);
		const webviewUri = webview.asWebviewUri(fileUri);
		return `${attr}="${webviewUri}"`;
	});

	return html;
}

export function deactivate() {
	providerInstance?.dispose();
}
