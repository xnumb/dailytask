import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const provider = new DailyTaskProvider(context.extensionUri);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(DailyTaskProvider.viewType, provider));
	context.subscriptions.push(vscode.commands.registerCommand('dailyTask.add', _ => {
		provider.add()
	}));
	context.subscriptions.push(vscode.commands.registerCommand('dailyTask.reset', _ => {
		provider.reset()
	}));
	context.subscriptions.push(vscode.commands.registerCommand('dailyTask.clear', _ => {
		provider.clear()
	}));
}

class DailyTaskProvider implements vscode.WebviewViewProvider {

	public static readonly viewType = 'dailyTask.countdown';

	private _view?: vscode.WebviewView;

	constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			// Allow scripts in the webview
			enableScripts: true,

			localResourceRoots: [
				this._extensionUri
			]
		};

		webviewView.webview.html = this._getHtml(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(data => {
			if (data.action == 'alert') {
				if (data.type == 'info') {
					vscode.window.showInformationMessage(data.msg);
				} else if (data.type == 'warn') {
					vscode.window.showWarningMessage(data.msg);
				} else if (data.type == 'err') {
					vscode.window.showErrorMessage(data.msg);
				}
			} else if (data.action == 'more') {
				this.more(data.id, data.cmd)
			}
		});
		let timer = setInterval( _ => {
			webviewView.webview.postMessage({ type: 'updateTimer' })
		}, 1000)
		webviewView.onDidDispose( _ => {
			clearInterval(timer)
		})
	}

	public add() {
		if (this._view) {
			let self = this._view
			vscode.window.showInputBox({
				password: false,
				ignoreFocusOut: true,
				placeHolder: 'add task. eg: b#workName#20',
				prompt: 'color(x,b,r,g,o,y)#taskName#duration(min)',
			}).then(res => {
				self.webview.postMessage({
					type: 'add',
					cmd: res
				})
			})
		}
	}
	public more(id: string, cmd: string) {
		if (this._view) {
			let self = this._view
			vscode.window.showQuickPick(['Edit','Set Time',  'Del', 'Sort Up', 'Sort Down', 'Cancel'], {
				canPickMany: false,
				ignoreFocusOut: true,
				placeHolder: 'Are you sure to delete the task?'
			}).then(res => {
				if (res == 'Edit') {
					this.edit(id, cmd)
				} else if (res == 'Set Time') {
					this.setTime(id)
				} else if (res == 'Del') {
					this.del(id)
				} else if (res == 'Sort Up') {
					this.sort(id, -1)
				} else if (res == 'Sort Down') {
					this.sort(id, 1)
				}
			})
		}
	}
	public sort(id: string, val: number) {
		if (this._view) {
			this._view.webview.postMessage({
				type: 'sort',
				id: id,
				val: val
			})
		}
	}
	public setTime(id: string) {
		if (this._view) {
			let self = this._view
			vscode.window.showInputBox({
				password: false,
				ignoreFocusOut: true,
				placeHolder: 'min',
				prompt: 'set current task time',
			}).then(res => {
				self.webview.postMessage({
					id: id,
					type: 'settime',
					val: res
				})
			})
		}
	}
	public del(id: string) {
		if (this._view) {
			let self = this._view
			vscode.window.showQuickPick(['Yes', 'No'], {
				canPickMany: false,
				ignoreFocusOut: true,
				placeHolder: 'Are you sure to delete the task?'
			}).then(res => {
				if (res == 'Yes') {
					self.webview.postMessage({
						type: 'del',
						id: id
					})
				}
			})
		}
	}
	public edit(id: string, cmd: string) {
		if (this._view) {
			let self = this._view
			vscode.window.showInputBox({
				password: false,
				ignoreFocusOut: true,
				value: cmd,
				placeHolder: 'edit task',
				prompt: 'The rules are the same as add tasks',
			}).then(res => {
				self.webview.postMessage({
					type: 'edit',
					id: id,
					cmd: res
				})
			})
		}
	}
	public clear() {
		if (this._view) {
			let self = this._view
			vscode.window.showQuickPick(['Yes', 'No'], {
				canPickMany: false,
				ignoreFocusOut: true,
				placeHolder: 'Are you sure to clear all task?'
			}).then(res => {
				if (res == 'Yes') {
					self.webview.postMessage({ type: 'clear' })
				}
			})
		}
	}
	public reset() {
		if (this._view) {
			let self = this._view
			vscode.window.showQuickPick(['Yes', 'No'], {
				canPickMany: false,
				ignoreFocusOut: true,
				placeHolder: 'Are you sure to reset all task?'
			}).then(res => {
				if (res == 'Yes') {
					self.webview.postMessage({ type: 'reset' })
				}
			})
		}
	}

	private _getHtml(webview: vscode.Webview) {
		const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'static', 'iconfont.js'));
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'static', 'main.js'));
		const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'static', 'main.css'));

		const nonce = getNonce();

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
				-->
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleMainUri}" rel="stylesheet">
				<title>DailyTask</title>
			</head>
			<body>
				<div class="daily">
					<div class="list" id="list"></div>
					<div class="total">
						<div class="v" id="total-value"></div>
						<div class="progress" id="total-progress"></div>
					</div>
				</div>
				<script nonce="${nonce}" src="${scriptUri}"></script>
				<script nonce="${nonce}" src="${iconUri}"></script>
			</body>
			</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}