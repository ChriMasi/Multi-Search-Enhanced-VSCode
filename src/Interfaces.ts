import * as vscode from 'vscode';

// ! JS側と揃える必要がある
/**
 * 検索設定
 */
export interface SearchParams {
    /** 検索対象文字列 */
    searchText: string;
    /**  大文字小文字を区別するか */
    isCaseSensitive: boolean;
    /**  単語単位 */
    isWholeWord: boolean;
    /**  正規表現 */
    isRegex: boolean;
}

/**  検索結果 */
export interface SearchResult {
    /**  配色 */
    decoType: vscode.TextEditorDecorationType;
    /**  検索結果 */
    foundSearchees: vscode.Range[];
    /**  移動先
     *  テキストの書き換えもあるのでRangeで保持 */
    moveTarget: vscode.Range | null;
}

/**  検索設定と検索結果 */
export interface SearchItem {
    /**  UUID */
    uuid: string,
    /**  検索結果 */
    searchResult: SearchResult,
    /** color used for this search (rgba string) */
    color?: string,
    /** whether this item's overview markers are enabled */
    showOverview?: boolean,
    /**  検索設定 */
    searchParams: SearchParams
}
