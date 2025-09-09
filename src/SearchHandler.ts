import * as vscode from 'vscode';
import * as utils from './utils';
import * as Interfaces from './Interfaces';

class SearchHandler {
    // 検索窓での検索の色
    protected readonly currentSearchColor: string = 'rgb(98, 51, 21)';  // 茶色
    // 移動先の検索結果の色
    protected readonly moveTargetSettings = {
        backgroundColor: 'rgb(21, 51, 98)',     // 青
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        fontWeight: 'bold', // 太字
    };
    // 移動先の検索結果の装飾
    protected moveHighlightDecorationType: vscode.TextEditorDecorationType = vscode.window.createTextEditorDecorationType({});

    // 検索履歴の一覧
    protected searchItems: Interfaces.SearchItem[] = [];
    // 現在の検索窓のテキストでの検索内容
    protected currentSearchItem: Interfaces.SearchItem = {
        uuid: 'currentSearchItem',
        searchResult: {
            decoType: vscode.window.createTextEditorDecorationType({}),
            foundSearchees: [],
            moveTarget: null
        },
        searchParams: {
            searchText: '',
            isCaseSensitive: false,
            isWholeWord: false,
            isRegex: false
        },
    };

    constructor(
        protected readonly DEBUG: boolean
    ) {
    }

    /**
     * 検索実行し、該当箇所をハイライトする
     * @param activeEditor アクティブなエディタ
     * @param color カラーコード
     * @param searchParams 検索設定
     * @returns ハイライト設定
     */
    protected async _execSearch(activeEditor: vscode.TextEditor, color: string, searchParams: Interfaces.SearchParams, useOverview: boolean = false): Promise<Interfaces.SearchResult> {
        const stringsinEditor: string = this._getStringsInEditor(activeEditor.document);
        // TODO: 右の全体像？のところにも表示
        // overviewRulerLane: vscode.OverviewRulerLane.Right,
        // overviewRulerColor: "#ffff00",
        const decoOptions: any = {
            backgroundColor: color,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        };
        // se richiesto, aggiungi marker nella overviewRuler
        if (useOverview) {
            // overviewRulerColor richiede un colore in formato #rrggbb o rgba
            decoOptions.overviewRulerLane = vscode.OverviewRulerLane.Right;
            decoOptions.overviewRulerColor = color;
        }
        const highlightDecorationType: vscode.TextEditorDecorationType = vscode.window.createTextEditorDecorationType(decoOptions);
        let foundSearchees: vscode.Range[] = [];
        if (searchParams.searchText != '') {
            foundSearchees = this._searchText(activeEditor.document, stringsinEditor, searchParams);
            // 文字列ハイライト
            activeEditor.setDecorations(highlightDecorationType, foundSearchees);
        }
        return {
            decoType: highlightDecorationType,
            foundSearchees: foundSearchees,
            moveTarget: null
        };
    }


    /**
     * ドキュメントを開いている場合はそのドキュメント全体を返す
     * @returns string
     */
    protected _getStringsInEditor(activeDocument: vscode.TextDocument): string {
        let result = "";
        const startPos: vscode.Position = new vscode.Position(0, 0);
        const endPos: vscode.Position = new vscode.Position(activeDocument.lineCount - 1, 10000);
        const cur_selection: vscode.Selection = new vscode.Selection(startPos, endPos);
        result = activeDocument.getText(cur_selection);
        // console.log('StringsInEditor: ' + result);
        return result;
    }

    /**
     * テキスト内を検索して該当箇所を返す
     * @returns テキスト内の位置
     */
    protected _searchText(activeDocument: vscode.TextDocument, stringsinEditor: string, searchParams: Interfaces.SearchParams): vscode.Range[] {
        // eslint-disable-next-line prefer-const
        let foundSearchees: vscode.Range[] = [];
        const regexFlags = searchParams.isCaseSensitive ? 'g' : 'gi';
        const wordBoundary = searchParams.isWholeWord ? '\\b' : '';
        // eslint-disable-next-line no-useless-escape
        const pattern = searchParams.isRegex ? searchParams.searchText : searchParams.searchText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`${wordBoundary}${pattern}${wordBoundary}`, regexFlags);
        let match: RegExpExecArray | null;
        while ((match = regex.exec(stringsinEditor)) !== null) {
            const startPos = activeDocument.positionAt(match.index);
            const endPos = activeDocument.positionAt(match.index + match[0].length);
            foundSearchees.push(new vscode.Range(startPos, endPos));
        }
        return foundSearchees;
    }

    /**
     * 検索結果に移動する
     * @param activeEditor  アクティブなエディタ
     * @param uuid          UUID
     * @param isNext        true: 次の検索結果へ移動, false: 前の検索結果へ移動
     * @returns 移動先のインデックス 見つからない場合は-1
     */
    protected async _moveResult(activeEditor: vscode.TextEditor, uuid: string, isNext: boolean): Promise<number>{
        let searchResult: Interfaces.SearchResult;
        // eslint-disable-next-line @typescript-eslint/no-inferrable-types
        let targetIndex: number = -1;
        if (uuid === 'current') {       // 現在の検索結果を使う
            searchResult = this.currentSearchItem.searchResult;
        }
        // else if (uuid === 'total') {  // TODO 全検索結果を使う}
        else {                        // uuid指定の検索結果を使う
            const searchItem = this.searchItems.find((item) => item.uuid === uuid);
            if (searchItem === undefined) {
                return targetIndex;
            }
            searchResult = searchItem.searchResult;
        }

        // 検索結果がない場合は何もしない
        if (searchResult.foundSearchees.length === 0) {
            return targetIndex;
        }
        // 移動先を取得
        if (searchResult.moveTarget === null) {
            searchResult.moveTarget = searchResult.foundSearchees[0];
            targetIndex = 0;
        } else {
            const currentIndex = searchResult.foundSearchees.indexOf(searchResult.moveTarget);
            targetIndex = isNext ? currentIndex + 1 : currentIndex - 1;
            if (targetIndex < 0) {
                // さらに前に移動しようとした場合は、最後の検索結果に移動
                targetIndex = searchResult.foundSearchees.length - 1;
            } else if (targetIndex >= searchResult.foundSearchees.length) {
                // さらに後ろに移動しようとした場合は、最初の検索結果に移動
                targetIndex = 0;
            }
            searchResult.moveTarget = searchResult.foundSearchees[targetIndex];
        }

        // 表示位置の移動
        activeEditor.selection = new vscode.Selection(searchResult.moveTarget.start, searchResult.moveTarget.end);
        activeEditor.revealRange(searchResult.moveTarget);

        // 移動先のハイライト
        this.moveHighlightDecorationType.dispose();
        if (this.moveHighlightDecorationType) {
            this.moveHighlightDecorationType.dispose();
        }
        this.moveHighlightDecorationType = vscode.window.createTextEditorDecorationType(this.moveTargetSettings);

        activeEditor.setDecorations(this.moveHighlightDecorationType, [searchResult.moveTarget]);
        return targetIndex;
    }

    /**
     * 検索実行時のログ
     * @param title         タイトル
     * @param uuid          UUID
     * @param color         カラーコード
     * @param searchParams  検索設定
     */
    protected _logSearchParams(title: string, uuid: string, color: string, searchParams: Interfaces.SearchParams) {
        utils.consoleLog(
            `[${title}]\t${searchParams.searchText}, ` +
            `uuid: ${uuid}, ` +
            `color: ${color}, ` +
            `isCaseSensitive ${searchParams.isCaseSensitive}, ` +
            `isWholeWord ${searchParams.isWholeWord}, ` +
            `isRegex ${searchParams.isRegex}`,
            this.DEBUG
        );
    }

}

export { SearchHandler };
