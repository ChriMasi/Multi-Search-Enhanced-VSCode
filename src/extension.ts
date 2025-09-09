import * as vscode from 'vscode';
import * as utils from './utils';
import { ColorSearchViewProvider } from './ColorSearchViewProvider';

const DEBUG = false;

/**
 * 起動時の実行
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
    const provider = new ColorSearchViewProvider(context.extensionUri, DEBUG);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(ColorSearchViewProvider.viewType, provider));
    // アクティブなテキストエディタが変更されたとき
    const disposable = vscode.window.onDidChangeActiveTextEditor(editor => {
        // エディタが非アクティブの場合は何もしない
        if (!editor) {
            return;
        }
        utils.consoleLog('アクティブなエディタが変更されました: ' + editor.document.uri, DEBUG);
        provider.applySearchToNewEditor(editor);
    });
    context.subscriptions.push(disposable);

    // テキストが編集されたとき
    const textChangeDisposable = vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor && event.document === editor.document) {
            utils.consoleLog('テキストが編集されました: ' + event.document.uri, DEBUG);
            provider.applySearchToNewEditor(editor);
        }
    });
    context.subscriptions.push(textChangeDisposable);

    // ドキュメントを開いたとき (例: ファイル切替や新規オープン)
    const openDocDisposable = vscode.workspace.onDidOpenTextDocument(doc => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document === doc) {
            utils.consoleLog('ドキュメントが開かれました: ' + doc.uri, DEBUG);
            provider.applySearchToNewEditor(editor);
        }
    });
    context.subscriptions.push(openDocDisposable);
}

/**
 * 終了時
 */
export function deactivate() {
    // consoleLog("Deactivate");
}
