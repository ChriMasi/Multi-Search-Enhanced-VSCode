import * as vscode from 'vscode';
import * as utils from './utils';
import * as Interfaces from './Interfaces';
import { SearchHandler } from './SearchHandler';

class ColorSearchViewProvider extends SearchHandler implements vscode.WebviewViewProvider {
    public static readonly viewType = 'MultipleSearch.search';

    private view?: vscode.WebviewView;
    private editor?: vscode.TextEditor;

    // ! JSから受信
    private readonly currentSearchMsg = 'currentSearch';
    private readonly addSearchHistMsg = 'addSearchHist';
    private readonly changeHistMsg = 'changeHist';
    private readonly clearHistMsg = 'clearHist';
    private readonly deleteOneHistMsg = 'deleteOneHist';
    private readonly consoleLogMsg = 'consoleLog';
    private readonly moveResultMsg = 'moveResult';
    private readonly toggleAllOverviewMsg = 'toggleAllOverview';
    // ! JSに送信
    private readonly currentSearchResultMsg = 'currentSearchResultEvent';
    private readonly executeSearchResultMsg = 'executeSearchResultEvent';
    private readonly moveResultEventMsg = 'moveResultEvent';

    // デバッグ用
    private readonly executeSearchMsg = 'executeSearch';

    constructor(
        private readonly extensionUri: vscode.Uri,
        DEBUG: boolean
    ) {
        super(DEBUG);
        utils.consoleLog(extensionUri.path, this.DEBUG);
    }

    /**
     * VSCodeのコマンド取得
     * JSから実行される
     * @param webviewView
     * @param context
     * @param _token
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this.view = webviewView;
        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [
                this.extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((data: any) => {
            this.editor = vscode.window.activeTextEditor;
            if (!this.editor) { return; }

            const activeEditor: vscode.TextEditor = this.editor;

            // JSからのコマンド受け取り
            if (data.type == this.currentSearchMsg) {
                // 検索窓にあるテキストの検索
                this._currentSearch(activeEditor, data.searchParams);
            } else if (data.type == this.addSearchHistMsg) {
                // 検索履歴の追加
                this._addSearchHist(activeEditor, data.uuid, data.color, data.searchParams);
            } else if (data.type == this.changeHistMsg) {
                // 検索履歴の変更 (include showOverview)
                const showOverview = data.showOverview ? true : false;
                this._changeHist(activeEditor, data.uuid, data.color, data.searchParams, showOverview);
            } else if (data.type == this.clearHistMsg) {
                // 全件削除
                this._clearHist();
                } else if (data.type == this.deleteOneHistMsg) {
                // 一件削除
                this._deleteOneHist(data.uuid);
            } else if (data.type == 'toggleOverview') {
                // Webview ha richiesto toggle dei marker nella scrollbar
                const uuid: string = data.uuid;
                const showOverview: boolean = data.showOverview;
                // se è current, ri-esegui la ricerca corrente con overview
                if (uuid === 'current') {
                    if (this.editor) {
                        // ri-esegui la ricerca corrente con flag overview
                        this.currentSearchItem.searchResult.decoType.dispose();
                        this._execSearch(this.editor, this.currentSearchColor, this.currentSearchItem.searchParams, showOverview).then((searchResult) => {
                            this.currentSearchItem.searchResult = searchResult;
                            this._postExecuteSearchResultEvent('current', searchResult.foundSearchees.length);
                        });
                    }
                } else {
                    const uuidIndex: number = this.searchItems.findIndex((s) => s.uuid == uuid);
                    if (uuidIndex > -1 && this.editor) {
                        const searchItem = this.searchItems[uuidIndex];
                        searchItem.searchResult.decoType.dispose();
                        const color = searchItem.color || this.currentSearchColor;
                        this._execSearch(this.editor, color, searchItem.searchParams, showOverview).then((searchResult) => {
                            // replace with new result but keep uuid and params
                            searchItem.searchResult = searchResult;
                            this._postExecuteSearchResultEvent(uuid, searchResult.foundSearchees.length);
                        });
                    }
                }
            } else if (data.type === this.toggleAllOverviewMsg) {
                // toggle overview per tutte le ricerche
                const showAll: boolean = !!data.showAll;
                if (this.editor) {
                    // per ogni searchItem, riapplica la decorazione con overview impostato
                    for (const searchItem of this.searchItems) {
                        searchItem.searchResult.decoType.dispose();
                        const color = searchItem.color || this.currentSearchColor;
                        // ri-esegui la ricerca con showAll come flag overview
                        this._execSearch(this.editor, color, searchItem.searchParams, showAll).then((searchResult) => {
                            searchItem.searchResult = searchResult;
                            this._postExecuteSearchResultEvent(searchItem.uuid, searchResult.foundSearchees.length);
                        });
                    }
                }
            } else if (data.type == this.consoleLogMsg) {
                // JSからのコンソールログ
                utils.consoleLog(data.log, this.DEBUG);
            } else if (data.type === 'forceRefresh') {
                if (this.editor) {
                    this.applySearchToNewEditor(this.editor);
                }
            } else if (data.type == this.moveResultMsg) {
                // 次の検索結果
                this._moveResult(activeEditor, data.uuid, data.isNext);
            }
        });

        this.view.webview.postMessage({ type: this.clearHistMsg });
        this._debugSearch();
    }

    /**
     * 検索履歴の表示の更新
     * @param activeTextEditor
     */
    public async applySearchToNewEditor(activeTextEditor: vscode.TextEditor) {
        // ドキュメント取得
        const stringsinEditor: string = this._getStringsInEditor(activeTextEditor.document);

        // 検索窓の反映
        const searchResult: Interfaces.SearchResult = await this._execSearch(activeTextEditor, this.currentSearchColor, this.currentSearchItem.searchParams);
        // 内部状態更新
        this.currentSearchItem.searchResult = searchResult;
        // 表示更新
        this._postCurrentSearchResultEvent(searchResult.foundSearchees.length);
        this._postMoveResultEvent('current', 0);

        // 検索履歴の反映
        this.searchItems.forEach(searchItem => {
            const foundSearchees: vscode.Range[] = this._searchText(activeTextEditor.document, stringsinEditor, searchItem.searchParams);
            utils.consoleLog(
                `[applySearchToEditor]\t${searchItem.searchParams.searchText}, uuid: ${searchItem.uuid}, ${foundSearchees.length}件`,
                this.DEBUG
            );
            activeTextEditor.setDecorations(searchItem.searchResult.decoType, foundSearchees);
            // 内部状態更新
            searchItem.searchResult.foundSearchees = foundSearchees;
            searchItem.searchResult.moveTarget = null;
            // 表示更新
            this._postExecuteSearchResultEvent(searchItem.uuid, foundSearchees.length);
            this._postMoveResultEvent(searchItem.uuid, 0);
        });
    }

    /**
     * HTMLの作成
     * @param webview
     * @returns
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Get the local path to main script run in the webview, then convert it to a uri we can use in the webview.
        const scriptUri = webview.asWebviewUri(vscode.Uri.file(this.extensionUri.fsPath + '/media/main.js'));

        // Do the same for the stylesheet.
        const styleResetUri = webview.asWebviewUri(vscode.Uri.file(this.extensionUri.fsPath + '/media/reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.file(this.extensionUri.fsPath + '/media/vscode.css'));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.file(this.extensionUri.fsPath + '/media/main.css'));
        const codiconsUri = webview.asWebviewUri(vscode.Uri.file(this.extensionUri.fsPath + '/node_modules/@vscode/codicons/dist/codicon.css'));

        // Use a nonce to only allow a specific script to be run.
        const nonce = utils.getNonce();

        function createResultBox(idPrefix: string): string {
            return `
            <div class="result-box">
                <span class="result-count" id="${idPrefix}-result-move">0</span>
                <span >/</span>
                <span class="result-count" id="${idPrefix}-result-count">0</span>
                <div class="move-buttons">
                    <button class="move-button" id="${idPrefix}-next-result">
                        <div class="icon"><i class="codicon codicon-arrow-down"></i></div>
                    </button>
                    <button class="move-button" id="${idPrefix}-prev-result">
                        <div class="icon"><i class="codicon codicon-arrow-up"></i></div>
                    </button>
                </div>
            </div>
            `;
        }
        const current_result_box = createResultBox('current');
        const total_result_box = createResultBox('total');

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleResetUri}" rel="stylesheet">
                <link href="${styleVSCodeUri}" rel="stylesheet">
                <link href="${styleMainUri}" rel="stylesheet">
                <link href="${codiconsUri}" rel="stylesheet">
                <title>Python Input</title>
            </head>
            <body>
                <div class="search-box">
                    <input id="search-input"></input>
                    <button class="search-setting" id="is-case-sensitive">
                        <div class="icon"><i class="codicon codicon-case-sensitive"></i></div>
                    </button>
                    <button class="search-setting" id="is-whole-word">
                        <div class="icon"><i class="codicon codicon-whole-word"></i></div>
                    </button>
                    <button class="search-setting" id="is-regex">
                        <div class="icon"><i class="codicon codicon-regex"></i></div>
                    </button>
                    <!-- 検索結果 -->
                    ${current_result_box}
                </div>
                <!-- 検索履歴 -->
                <div class="total-result">
                    <!-- 検索窓の検索実行 -->
                    <button class="executeSearch">
                        <div class="icon"><i class="codicon codicon-search"></i></div>
                    </button>
                    <!-- 検索履歴全削除 -->
                    <button class="clearHist">
                        <div class="icon"><i class="codicon codicon-clear-all"></i></div>
                    </button>
                    <!-- 強制リフレッシュボタン -->
                    <button class="force-refresh" id="force-refresh">
                        <div class="icon"><i class="codicon codicon-refresh"></i></div>
                    </button>
                    <!-- Global overview buttons: enable all / disable all (half width) -->
                    <button class="global-overview enable-all" id="enable-all-overview">
                        <div class="icon"><i class="codicon codicon-eye"></i></div>
                    </button>
                    <button class="global-overview disable-all" id="disable-all-overview">
                        <div class="icon"><i class="codicon codicon-eye"></i></div>
                    </button>
                        <!-- (refresh automatico al cambio file) -->
                    <!-- 検索履歴全体の結果 -->
                    <!-- ${total_result_box} -->
                </div>
                <ul class="color-list">
                </ul>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }

    // ! JSからの実行 ====================================================================================
    /**
     * 検索窓内での検索の実行
     * @param activeEditor  アクティブなエディタ
     * @param searchParams  検索設定
     */
    private async _currentSearch(activeEditor: vscode.TextEditor, searchParams: Interfaces.SearchParams) {
        this._logSearchParams(this.currentSearchMsg, 'currentSearchItem', this.currentSearchColor, searchParams);
        this.currentSearchItem.searchResult.decoType.dispose();
        const searchResult: Interfaces.SearchResult = await this._execSearch(activeEditor, this.currentSearchColor, searchParams);
        this.currentSearchItem.searchResult = searchResult;
        this.currentSearchItem.searchParams = searchParams;
        this._postCurrentSearchResultEvent(searchResult.foundSearchees.length);
        // 移動ハイライトの初期化
        this.moveHighlightDecorationType.dispose();
        this._postMoveResultEvent('current', 0);
    }

    /**
     * 検索履歴の追加
     * @param activeEditor アクティブなエディタ
     * @param uuid          UUID
     * @param color         カラーコード
     * @param searchParams  検索設定
     */
    private async _addSearchHist(activeEditor: vscode.TextEditor, uuid: string, color: string, searchParams: Interfaces.SearchParams) {
        this._logSearchParams(this.addSearchHistMsg, uuid, color, searchParams);
        this.currentSearchItem.searchResult.decoType.dispose();
        const searchResult: Interfaces.SearchResult = await this._execSearch(activeEditor, color, searchParams);
        const searchItem: Interfaces.SearchItem = {
            uuid: uuid,
            searchResult: searchResult,
            color: color,
            searchParams: searchParams,
        };
        this.searchItems.push(searchItem);
        this._postExecuteSearchResultEvent(uuid, searchResult.foundSearchees.length);
    }

    /**
     * 検索履歴の変更
     * @param activeEditor  アクティブなエディタ
     * @param uuid          UUID
     * @param color         カラーコード
     * @param searchParams  検索設定
     */
    private async _changeHist(activeEditor: vscode.TextEditor, uuid: string, color: string, searchParams: Interfaces.SearchParams, showOverview: boolean = false) {
        this._logSearchParams(this.changeHistMsg, uuid, color, searchParams);
        const uuidIndex: number = this.searchItems.findIndex((searchItem) => searchItem.uuid == uuid);
        if (uuidIndex > -1) {
            // salva il colore aggiornato e preferenza overview
            this.searchItems[uuidIndex].color = color;
            this.searchItems[uuidIndex].searchResult.decoType.dispose();
            const searchResult: Interfaces.SearchResult = await this._execSearch(activeEditor, color, searchParams, showOverview);
            this.searchItems[uuidIndex].searchResult = searchResult;
            this.searchItems[uuidIndex].searchParams.searchText = searchParams.searchText;
            this.searchItems[uuidIndex].showOverview = showOverview;
            this._postExecuteSearchResultEvent(uuid, searchResult.foundSearchees.length);
        }
    }

    /**
     * 検索履歴の削除
     */
    private _clearHist() {
        utils.consoleLog('clearHist', this.DEBUG);
        this.currentSearchItem.searchResult.decoType.dispose();
        this.moveHighlightDecorationType.dispose();
        for (const searchItem of this.searchItems) {
            searchItem.searchResult.decoType.dispose();
        }
        this.searchItems = [];
        this._postMoveResultEvent('current', 0);
    }

    /**
     * 一項目の削除
     * @param uuid UUID
     */
    private _deleteOneHist(uuid: string) {
        utils.consoleLog(`[${this.deleteOneHistMsg}]\t${uuid}`, this.DEBUG);
        const uuidIndex: number = this.searchItems.findIndex((data) => data.uuid == uuid);
        if (uuidIndex > -1) {
            const searchItem = this.searchItems[uuidIndex];
            searchItem.searchResult.decoType.dispose();
            this.searchItems.splice(uuidIndex, 1);
        }
    }

    /**
     * 検索結果に移動する
     * @param activeEditor  アクティブなエディタ
     * @param uuid          UUID
     * @param isNext        true: 次の検索結果へ移動, false: 前の検索結果へ移動
     * @returns             移動先のインデックス
     */
    protected async _moveResult(activeEditor: vscode.TextEditor, uuid: string, isNext: boolean): Promise<number> {
        const targetIndex = await super._moveResult(activeEditor, uuid, isNext);
        this._postMoveResultEvent(uuid, targetIndex + 1);
        return targetIndex;
    }

    /**
     * 検索窓内での検索の実行イベント
     * @param value 検索結果件数
     */
    private _postCurrentSearchResultEvent(value: number) {
        this.view?.webview.postMessage(
            {
                type: this.currentSearchResultMsg,
                value: value
            }
        );
    }

    /**
     * 検索履歴へ追加イベント
     * @param uuid
     * @param value
     */
    private _postExecuteSearchResultEvent(uuid: string, value: number) {
        this.view?.webview.postMessage(
            {
                type: this.executeSearchResultMsg,
                uuid: uuid,
                value: value
            }
        );
    }

    /**
     * 検索結果の移動イベント
     * @param uuid        UUID
     * @param targetIndex 移動先のインデックス
     */
    private _postMoveResultEvent(uuid: string, targetIndex: number) {
        this.view?.webview.postMessage(
            {
                type: this.moveResultEventMsg,
                uuid: uuid,
                value: targetIndex
            }
        );
    }

    // TODO: テストに移植 ====================================================================================
    /**
     * デバッグ検索
     */
    private _debugSearch() {
        if (this.DEBUG) {
            const searchList: any[] = [
                { searchText: '東京', isCaseSensitive: false, isWholeWord: false, isRegex: false },     // 17件
                { searchText: '世界', isCaseSensitive: true, isWholeWord: false, isRegex: false },      // 9件
                { searchText: '[、。]', isCaseSensitive: false, isWholeWord: false, isRegex: true },    // 82件
                { searchText: 'Tokyo', isCaseSensitive: true, isWholeWord: false, isRegex: false },     // 17件
                { searchText: '[,.]', isCaseSensitive: false, isWholeWord: false, isRegex: true },      // 49件
                { searchText: 'you', isCaseSensitive: false, isWholeWord: true, isRegex: false },        // 4件
            ];

            for (const searchParams of searchList) {
                utils.consoleLog('[this.DEBUG] Search target: ' + searchParams.searchText, this.DEBUG);
                this.view?.webview.postMessage(
                    {
                        type: this.executeSearchMsg,
                        searchParams: searchParams
                    }
                );
            }
        }
    }
}
export { ColorSearchViewProvider };
