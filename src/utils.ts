import * as vscode from 'vscode';

export function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function consoleLog(log: string, DEBUG: boolean) {
    if (DEBUG) {
        console.log(log);
    }
}

export function consoleError(log: string, DEBUG: boolean) {
    if (DEBUG) {
        console.error(`[ERROR] ${log}`);
    }
}
