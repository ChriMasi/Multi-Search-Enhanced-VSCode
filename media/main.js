// TODO: ファイル分割
// こいつ追加すると何故か動かない
// import "vscode-webview"
(function () {
    // ** 変数設定 ========================================================================
    const vscode = acquireVsCodeApi();
    const oldState = vscode.getState() ||
        {
            searchHist: [],
            count: 0,
            isCaseSensitive: false,
            isWholeWord: false,
            isRegex: false,
        };
    // 現在状態
    const currentState = {
        count: oldState.count || 0,
        searchHist:  oldState.count > 0 ? oldState.searchHist : [],
        isCaseSensitive: oldState.isCaseSensitive ? true : false,
        isWholeWord: oldState.isWholeWord ? true : false,
        isRegex: oldState.isRegex ? true : false,
    showAllOverview: oldState.showAllOverview ? true : false,
    };

    // ! searchiHist
    // {
    //      uuid: string,
    //      color: string,
    //      resultCount: number // 検索結果の件数
    //      moveResult: number  // 検索結果の移動
    //      searchParams: {
    //              searchText: string,
    //              isCaseSensitive: boolean,
    //              isWholeWord: boolean,
    //              isRegex: boolean
    //      },
    // }

    // ボタン色取得
    const root = document.documentElement;
    const style = getComputedStyle(root);
    const checkedColor = style.getPropertyValue('--vscode-button-secondaryBackground');
    const uncheckedColor = style.getPropertyValue('--vscode-button-background');

    // 検索窓
    const searchInputWindow = document.querySelector('#search-input');
    // 大小区別ボタン
    const isCaseSensitiveButton = document.getElementById('is-case-sensitive');
    // 単語単位ボタン
    const isWholeWordButton = document.getElementById('is-whole-word');
    // 正規表現ボタン
    const isRegexButton = document.getElementById('is-regex');
    // 移動件数表示
    const currentResultMove = document.getElementById('current-result-move');
    // 検索件数表示
    const currentResultCount = document.getElementById('current-result-count');
    // 検索結果移動ボタン 次
    const currentNextButton = document.getElementById('current-next-result');
    // 検索結果移動ボタン 前
    const currentPrevButton = document.getElementById('current-prev-result');
    // 検索実行ボタン
    const executeSearchButton = document.querySelector('.executeSearch');
    // 履歴削除ボタン
    const clearHistButton = document.querySelector('.clearHist');
    const enableAllBtn = document.getElementById('enable-all-overview');
    const disableAllBtn = document.getElementById('disable-all-overview');
    toggleButtonColor(false, disableAllBtn);

    // ! TSに送信
    const currentSearchMsg = 'currentSearch';
    const addSearchHistMsg = 'addSearchHist';
    const changeHistMsg = 'changeHist';
    const clearHistMsg = 'clearHist';
    const deleteOneHistMsg = 'deleteOneHist';
    const toggleOverviewMsg = 'toggleOverview';
    // const nextResultMsg = 'currentNextResult';
    // const prevResultMsg = 'currentPrevResult';
    const moveResultMsg = 'moveResult';
    const consoleLogMsg = 'consoleLog';
    // ! TSから受信
    const currentResultCountMsg = 'currentSearchResultEvent';
    const executeSearchResultMsg = 'executeSearchResultEvent';
    const moveResultEventMsg = 'moveResultEvent';
    const executeSearchMsg = 'executeSearch';

    // ** 関数設定 ========================================================================
    /**
     * 検索の実行
     */
    function executeSearch() {
        const searchInput = searchInputWindow.value;
        if (searchInput != ''){
            // ボタンの押下状態取得
            const searchParams = createSearchParams(
                searchInput,
                currentState.isCaseSensitive,
                currentState.isWholeWord,
                currentState.isRegex
            );
            postAddSearchHist(searchParams);
            clearSearchingText();
        }
    }

    /**
     * 検索窓のテキストの削除
     */
    function clearSearchingText() {
        searchInputWindow.value = '';
        currentResultMove.textContent = '0';
        currentResultCount.textContent = '0';
        postCurrentSearch();
    }

    /**
     * 検索履歴の更新
     *  <ul class="color-list">
     *      <li class="color-entry" uuid="${search.uuid}">
     *          <div class="color-preview" style="background-color: search.color;"></div>
     *          <input class="color-input" type="text" value="${search.value}" textContent="${search.value}">
     *          <button class="search-setting">
     *              <span class="codicon codicon-case-sensitive"></span>
     *          </button>
     *          <button class="search-setting">
     *              <span class="codicon codicon-whole-word"></span>
     *          </button>
     *          <button class="search-setting">
     *              <span class="codicon codicon-regex"></span>
     *          </button>
     *          <span class="result-count">${search.resultCount}件</span>
     *          <button class="delete-button">
     *              <span class="codicon codicon-close"></span>
     *          </button>
     *      </li>
     *      <!-- 上記の<li>がcurrentState.searchHistの各要素に対して繰り返される -->
     *  </ul>
    */
    function updateSearchHist(){
        const ul = document.querySelector('.color-list');
        // 既存の履歴をクリア
        ul.textContent = '';
        for (const searchItem of currentState.searchHist) {
            // consoleLog(search);
            const li = document.createElement('li');
            li.className = 'color-entry';
            li.setAttribute("uuid", searchItem.uuid);
            const colorPreview = document.createElement('div');
            const input = document.createElement('input');
            const isWholeWordItemButton = document.createElement('button');
            const isCaseSensitiveItemButton = document.createElement('button');
            const isRegexItemButton = document.createElement('button');
            const resultCount = document.createElement('span');
            const deleteButton = document.createElement('button');

            {   // カラープレビュー (クリックでカラーピッカー)
                // Creiamo il riquadro di preview e inseriamo al suo interno il colorPicker
                const colorPicker = document.createElement('input');
                colorPicker.type = 'color';
                colorPicker.className = 'color-picker';
                // searchItem.color è rgba(...), converti a hex per il picker
                colorPicker.value = rgbaToHex(searchItem.color) || '#ff0000';
                colorPicker.addEventListener('input', function () {
                    // salva il nuovo colore in formato rgba e chiedi la ricerda
                    searchItem.color = hexToRgba(colorPicker.value, 0.5);
                    postChangeHist(searchItem.uuid);
                    // salva lo stato della webview
                    vscode.setState(currentState);
                });

                colorPreview.className = 'color-preview';
                // metti il picker dentro il preview (mostriamo solo il color picker)
                colorPreview.appendChild(colorPicker);
                li.appendChild(colorPreview);
            }

            {   // 検索文字列
                input.className = 'color-input';
                input.type = 'text';
                input.value = searchItem.searchParams.searchText;
                input.textContent = searchItem.searchParams.searchText;
                // 変更があって500ミリ秒空くとイベント発行
                let timeoutId = null;
                input.addEventListener('input', (event) => {
                    if (timeoutId !== null) {
                        clearTimeout(timeoutId);
                    }
                    // 新しいタイムアウトを設定
                    timeoutId = setTimeout(() => {
                        searchItem.searchParams.searchText = input.value;
                        // 文字列を変更したら再検索
                        postChangeHist(searchItem.uuid);
                        timeoutId = null;
                    }, 500);
                });
                li.appendChild(input);
            }

            {   // 大小区別
                isCaseSensitiveItemButton.className = 'search-setting';
                isCaseSensitiveItemButton.addEventListener('click', function() {
                    // 設定が変更されたら再度検索する
                    searchItem.searchParams.isCaseSensitive = !searchItem.searchParams.isCaseSensitive;
                    toggleButtonColor(searchItem.searchParams.isCaseSensitive, isCaseSensitiveItemButton);
                    postChangeHist(searchItem.uuid);
                });
                toggleButtonColor(searchItem.searchParams.isCaseSensitive, isCaseSensitiveItemButton);
                const isCaseSensitiveItemContainer = getCodicon('case-sensitive');
                isCaseSensitiveItemButton.appendChild(isCaseSensitiveItemContainer);
                li.appendChild(isCaseSensitiveItemButton);
            }

            {   // 単語単位
                isWholeWordItemButton.className = 'search-setting';
                isWholeWordItemButton.addEventListener('click', function() {
                    // 設定が変更されたら再度検索する
                    searchItem.searchParams.isWholeWord = !searchItem.searchParams.isWholeWord;
                    toggleButtonColor(searchItem.searchParams.isWholeWord, isWholeWordItemButton);
                    postChangeHist(searchItem.uuid);
                });
                toggleButtonColor(searchItem.searchParams.isWholeWord, isWholeWordItemButton);
                const isWholeWordItemContainer = getCodicon('whole-word');
                isWholeWordItemButton.appendChild(isWholeWordItemContainer);
                li.appendChild(isWholeWordItemButton);
            }

            {   // 正規表現
                isRegexItemButton.className = 'search-setting';
                isRegexItemButton.addEventListener('click', function() {
                    // 設定が変更されたら再度検索する
                    searchItem.searchParams.isRegex = !searchItem.searchParams.isRegex;
                    toggleButtonColor(searchItem.searchParams.isRegex, isRegexItemButton);
                    postChangeHist(searchItem.uuid);
                });
                toggleButtonColor(searchItem.searchParams.isRegex, isRegexItemButton);
                const isRegexItemContainer = getCodicon('regex');
                isRegexItemButton.appendChild(isRegexItemContainer);
                li.appendChild(isRegexItemButton);
            }

            {   // 移動ボタンと件数表示と×ボタン
                consoleLog('search.uuid: ' + searchItem.uuid + 'textContent: ' + searchItem.resultCount);
                const resultBox = document.createElement('div');
                resultBox.className = 'result-box';

                // ! 検索結果と移動の表示
                const resultMove = document.createElement('span');
                resultMove.className = 'result-count';
                resultMove.id = `${searchItem.uuid}-result-move`;
                resultMove.textContent = searchItem.moveResult;
                resultBox.appendChild(resultMove);

                const separator = document.createElement('span');
                separator.textContent = '/';
                resultBox.appendChild(separator);

                const resultCount = document.createElement('span');
                resultCount.className = 'result-count';
                resultCount.id = `${searchItem.uuid}-result-count`;
                resultCount.textContent = searchItem.resultCount;
                resultBox.appendChild(resultCount);

                // ! 移動ボタン
                const moveButtons = document.createElement('div');
                moveButtons.className = 'move-buttons';

                // ! ↓ボタン
                const nextButton = document.createElement('button');
                nextButton.className = 'move-button';
                nextButton.addEventListener('click', function () {
                    postMoveResult(searchItem.uuid, true);
                });
                // nextButton.id = `${idPrefix}-next-result`;
                const nextButtonIconContainer = getCodicon('arrow-down');
                nextButton.appendChild(nextButtonIconContainer);
                moveButtons.appendChild(nextButton);

                // ! ↑ボタン
                const prevButton = document.createElement('button');
                prevButton.className = 'move-button';
                prevButton.addEventListener('click', function () {
                    postMoveResult(searchItem.uuid, false);
                });
                // prevButton.id = `${idPrefix}-prev-result`;
                const prevButtonIconContainer = getCodicon('arrow-up');
                prevButton.appendChild(prevButtonIconContainer);
                moveButtons.appendChild(prevButton);

                // resultBox.appendChild(moveButtons);

                // ! ×ボタン
                deleteButton.className = 'move-button';
                const deleteButtonIconContainer = getCodicon('close');
                deleteButton.appendChild(deleteButtonIconContainer);
                deleteButton.addEventListener('click', function() {
                    postDeleteOneHist(searchItem.uuid);
                    ul.removeChild(li);
                });
                moveButtons.appendChild(deleteButton);

                // Overview toggle button: quando attivo, mostra i marker nella scrollbar
                const overviewToggle = document.createElement('button');
                overviewToggle.className = 'search-setting overview-toggle';
                // inizializzazione (falso di default)
                searchItem.showOverview = searchItem.showOverview ? true : false;
                toggleButtonColor(searchItem.showOverview, overviewToggle);
                const overviewIcon = getCodicon('eye');
                overviewToggle.appendChild(overviewIcon);
                overviewToggle.addEventListener('click', function () {
                    searchItem.showOverview = !searchItem.showOverview;
                    toggleButtonColor(searchItem.showOverview, overviewToggle);
                    postToggleOverview(searchItem.uuid, searchItem.showOverview);
                    // se c'è uno stato globale, disattivalo quando si fa il toggle manuale
                    if (currentState.showAllOverview) {
                        currentState.showAllOverview = false;
                        // aggiorna tutte le icone per riflettere che lo stato globale è off
                        updateAllOverviewIcons();
                        vscode.setState(currentState);
                    }
                });
                moveButtons.appendChild(overviewToggle);

                resultBox.appendChild(moveButtons);

                li.appendChild(resultBox);
            }

            ul.appendChild(li);
        }

        // Update the saved state
        vscode.setState(currentState);
    }

    /**
     * 検索窓内の検索設定更新
     */
    function updateSearchParamButtons() {
        if (isCaseSensitiveButton)
        {
            toggleButtonColor(currentState.isCaseSensitive, isCaseSensitiveButton);
            isCaseSensitiveButton.addEventListener('click', function() {
                currentState.isCaseSensitive = !currentState.isCaseSensitive;
                toggleButtonColor(currentState.isCaseSensitive, isCaseSensitiveButton);
                postCurrentSearch();
                vscode.setState(currentState);
            });
        }

        if (isWholeWordButton)
        {
            toggleButtonColor(currentState.isWholeWord, isWholeWordButton);
            isWholeWordButton.addEventListener('click', function() {
                currentState.isWholeWord = !currentState.isWholeWord;
                toggleButtonColor(currentState.isWholeWord, isWholeWordButton);
                postCurrentSearch();
                vscode.setState(currentState);
            });
        }

        if (isRegexButton) {
            toggleButtonColor(currentState.isRegex, isRegexButton);
            isRegexButton.addEventListener('click', function() {
                currentState.isRegex = !currentState.isRegex;
                toggleButtonColor(currentState.isRegex, isRegexButton);
                postCurrentSearch();
                vscode.setState(currentState);
            });
        }
    }
    // ** TSに送信 ================================================================
    /**
     * 検索窓内に入力された内容で一時的な検索を行う
     */
    function postCurrentSearch() {
        // ボタンの押下状態取得
        const searchParam = createSearchParams(
            searchInputWindow.value,
            currentState.isCaseSensitive,
            currentState.isWholeWord,
            currentState.isRegex
        );
        // メッセージの作成
        const message = {
            type: currentSearchMsg,
            searchParams: searchParam
        };
        vscode.postMessage(message);
    }

    /**
     * 検索履歴の追加
     * @param {SearchParams} searchParams 検索設定
     */
    function postAddSearchHist(searchParams) {
        const uuid = generateUUID();
        const color = getColor();
        const searchItem = createSearchItem(
            uuid,
            color,
            searchParams
        );
        currentState.searchHist.push(searchItem);
        // searchHist.push({value: value, color: color, uuid: uuid, searchMode: searchMode});
        updateSearchHist();
    // persist state
    vscode.setState(currentState);
        const message = Object.assign({}, { type: addSearchHistMsg }, searchItem);
        vscode.postMessage(message);
    }

    /**
     * 検索履歴の文字列を変更
     * @param {string} uuid
     */
    function postChangeHist(uuid) {
        const uuidIndex = currentState.searchHist.findIndex((data) => data.uuid == uuid);
        consoleLog(uuid + ': ' + currentState.searchHist[uuidIndex].value);
        vscode.postMessage({
            type: changeHistMsg,
            uuid: currentState.searchHist[uuidIndex].uuid,
            color: currentState.searchHist[uuidIndex].color,
            showOverview: !!currentState.searchHist[uuidIndex].showOverview,
            searchParams: currentState.searchHist[uuidIndex].searchParams
        });
    }

    /**
     * 全検索履歴の削除
     */
    function postClearHist() {
        currentState.searchHist = [];
        currentState.count = 0;
        updateSearchHist();
        vscode.postMessage({
            type: clearHistMsg,
        });
    }

    /**
     * 一項目だけ履歴の削除
     * @param {string} uuid
     */
    function postDeleteOneHist(uuid) {
        const uuidIndex = currentState.searchHist.findIndex((data) => data.uuid == uuid);
        currentState.searchHist.splice(uuidIndex, 1);
        vscode.postMessage({
            type: deleteOneHistMsg,
            uuid: uuid,
        });
        // Update the saved state
        vscode.setState(currentState);
    }

    /**
     * Forza un refresh (utile quando si cambia file nell'editor)
     */
    function postForceRefresh() {
        vscode.postMessage({ type: 'forceRefresh' });
    }

    // ** TSから受信 ================================================================
    /**
     * 検索窓内での件数表示
     *  <div class="search-box">
     *      <input id="search-input"></input>
     *      <button class="search-setting" id="is-case-sensitive">
     *          <div class="icon"><i class="codicon codicon-case-sensitive"></i></div>
     *      </button>
     *      <button class="search-setting" id="is-whole-word">
     *          <div class="icon"><i class="codicon codicon-whole-word"></i></div>
     *      </button>
     *      <button class="search-setting" id="is-regex">
     *          <div class="icon"><i class="codicon codicon-regex"></i></div>
     *      </button>
     *      <span class="result-count" id="current-result-count"></span>
     *  </div>
     */
    function recvCurrentSearchResult(num) {
        // `current-result-count`要素を取得
        const resultCountElement = document.getElementById('current-result-count');

        // 要素が存在する場合、テキスト内容を更新
        if (resultCountElement) {
            resultCountElement.textContent = `${num}`;
        }
    }

    /**
     * 履歴内での件数表示
     * @param {string} uuid
     * @param {int} num
     */
    function recvExecuteSearchResult(uuid, num) {
        const uuidIndex = currentState.searchHist.findIndex((data) => data.uuid == uuid);
        currentState.searchHist[uuidIndex].resultCount = num;
        // uuidを指定して件数表示を更新
        const resultCount = document.getElementById(`${uuid}-result-count`);
        resultCount.textContent = `${num}`;
        // se il toggle globale è attivo, aggiorna le icone per mostrare che tutti sono accesi
        if (currentState.showAllOverview) {
            updateAllOverviewIcons();
        }
    }

    /**
     * 検索結果の移動
     * @param {string} uuid 検索窓=current, 合計=total, 履歴=$uuid
     * @param {bool} isNext true: 次へ false: 前へ
     */
    function postMoveResult(uuid, isNext) {
        vscode.postMessage({
            type: moveResultMsg,
            uuid: uuid,
            isNext: isNext
        });
    }

    /**
     * 検索結果の移動時の表示の更新
     * @param {string} uuid
     * @param {number} num  何番目の検索結果か
     */
    function recvMoveResultEvent(uuid, num) {
        if (uuid === 'current') {
            currentResultMove.textContent = `${num}`;
        }
        else {
            const uuidIndex = currentState.searchHist.findIndex((data) => data.uuid == uuid);
            currentState.searchHist[uuidIndex].moveResult = num;
            // const li = document.querySelector(`li[uuid="${uuid}"]`);
            const resultMove = document.getElementById(`${uuid}-result-move`);
            resultMove.textContent = `${num}`;
        }
    }

    // ** utils ========================================================
    /**
     * ボタンの背景色をトグルする
     * @param {boolean} isChecked
     * @param {HTMLElement } button
     */
    function toggleButtonColor(isChecked, button) {
        if (isChecked) {
            // checked -> unchecked
            button.style.backgroundColor = uncheckedColor;
        } else {
            // unchecked -> checked
            button.style.backgroundColor = checkedColor;
        }
    }

    /**
     * 検索項目を作成
     * @param {string} uuid
     * @param {string} color
     * @param {SearchParams} searchParams
     * @returns
     */
    function createSearchItem(uuid, color, searchParams) {
        // resultCountとmoveResultは一旦0で初期化
        // resultCountは検索結果の件数
        // moveResultは検索結果の移動
        return {
            uuid: uuid,
            color: color,
            resultCount: 0,
            moveResult: 0,
            showOverview: false,
            searchParams: searchParams
        };
    }

    /**
     * 検索設定を作成
     * @param {string} searchText
     * @param {boolean} isCaseSensitive
     * @param {boolean} isWholeWord
     * @param {boolean} isRegex
     * @returns
     */
    function createSearchParams(searchText, isCaseSensitive, isWholeWord, isRegex) {
        return {
            searchText: searchText,
            isCaseSensitive: isCaseSensitive,
            isWholeWord: isWholeWord,
            isRegex: isRegex
        };
    }

    /**
     * カラーコードの取得
     * @returns string
     */
    // TODO: 設定ファイルから取得
    function getColor() {
        const colors = [
            '#FF0000',  // 赤
            '#FFA500',  // オレンジ
            '#FFFF00',  // 黄色
            '#008000',  // 緑
            '#00FFFF',  // 水色
            '#0000FF',  // 青
            '#800080',  // 紫
        ];
        // ritorna rgba per la decorazione e hex per il color picker valore
        const idx = currentState.count % colors.length;
        const hex = colors[idx];
        const rgba = hexToRgba(hex, 0.5);
        const selectedColor = rgba;
        currentState.count++;
        return selectedColor;
    }

    /**
     * Convert hex (#rrggbb) to rgba string with alpha
     */
    function hexToRgba(hex, alpha) {
        if (!hex) return `rgba(255,0,0,${alpha})`;
        const h = hex.replace('#', '');
        const r = parseInt(h.substring(0,2),16);
        const g = parseInt(h.substring(2,4),16);
        const b = parseInt(h.substring(4,6),16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Try to convert rgba(...) to hex string #rrggbb for color input value
     */
    function rgbaToHex(rgba) {
        if (!rgba) return '#ff0000';
        // rgba(255, 0, 0, 0.5)
        const m = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
        if (!m) return '#ff0000';
        const r = parseInt(m[1]).toString(16).padStart(2, '0');
        const g = parseInt(m[2]).toString(16).padStart(2, '0');
        const b = parseInt(m[3]).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`;
    }

    /**
     * Invia toggle overview al TypeScript
     */
    function postToggleOverview(uuid, show) {
        vscode.postMessage({ type: toggleOverviewMsg, uuid: uuid, showOverview: show });
    }

    /**
     * UUID生成
     * @returns {string} UUID
     */
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Codicon画像付きのdivタグを返す
     * @param {HTMLDivElement} iconName
     * @returns Codicon画像付きのdivタグ
     */
    function getCodicon(iconName) {
        const iconContainer = document.createElement('div');
        iconContainer.className = 'icon';
        const iconImage = document.createElement('i');
        iconImage.className = 'codicon codicon-' + iconName;
        iconContainer.appendChild(iconImage);
        return iconContainer;
    }

    /**
     * @param {string} log
     */
    function consoleLog(log){
        vscode.postMessage({ type: consoleLogMsg, log: '[js log]'+ log });
    }

    // ** 実行 ========================================================================
    {
        // 前回状態の復帰
        updateSearchHist();
        updateSearchParamButtons();
        postCurrentSearch();

        // VSCodeのコマンド受け取り
        window.addEventListener('message', event => {
            const message = event.data; // The json data that the extension sent
            switch (message.type) {
                case currentResultCountMsg: {
                    consoleLog(`${currentResultCountMsg}: ${message.value}`);
                    recvCurrentSearchResult(message.value);
                    break;
                }
                case executeSearchResultMsg: {
                    consoleLog(`${executeSearchResultMsg}: ${message.uuid}, ${message.value}`);
                    recvExecuteSearchResult(message.uuid, message.value);
                    break;
                }
                case clearHistMsg:{
                    postClearHist();
                    break;
                }
                case moveResultEventMsg:{
                    consoleLog(`${moveResultEventMsg}: ${message.uuid}, ${message.value}`);
                    recvMoveResultEvent(message.uuid, message.value);
                    break;
                }
                // デバッグ用
                case executeSearchMsg:{
                    consoleLog(`${executeSearchMsg}: ${message.value}`);
                    const searchParams = message.searchParams;
                    postAddSearchHist(searchParams);
                    break;
                }
            }
        });

        // 検索窓のテキスト入力
        let timeoutId = null;
        searchInputWindow.addEventListener('input', (event) => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
            }
            // 新しいタイムアウトを設定
            timeoutId = setTimeout(() => {
                postCurrentSearch();
                timeoutId = null;
            }, 500);
        });

        // 検索窓で移動
        // TODO: 検索履歴全体で移動
        currentNextButton.addEventListener('click', () => {
            // postCurrentSearch();
            consoleLog('currentNextButton');
            // vscode.postMessage(nextResultMsg);
            postMoveResult('current', true);
        });

        currentPrevButton.addEventListener('click', () => {
            // postCurrentSearch();
            consoleLog('currentPrevButton');
            // vscode.postMessage(prevResultMsg);
            postMoveResult('current', false);
        });

        // 検索窓内でエンター
        searchInputWindow.addEventListener('keydown', (event) => {
            if(event.key === 'Enter'){
                executeSearch();
            }
        });

        // 検索ボタン押下
        executeSearchButton.addEventListener('click', () => {
            executeSearch();
        });

        // 履歴削除ボタン押下
        clearHistButton.addEventListener('click', () => {
            postClearHist();
            clearSearchingText();
            // Update the saved state
            vscode.setState({
                searchHist: [],
                count: 0
            });
        });

        // Force refresh button
        const forceRefreshButton = document.getElementById('force-refresh');
        if (forceRefreshButton) {
            forceRefreshButton.addEventListener('click', () => {
                postForceRefresh();
            });
        }

        // Global enable/disable overview buttons (half width)
    //    const enableAllBtn = document.getElementById('enable-all-overview');
    //    const disableAllBtn = document.getElementById('disable-all-overview');
        if (enableAllBtn && disableAllBtn) {
            enableAllBtn.addEventListener('click', () => {
                // imposta showOverview=true per tutti gli item
                currentState.searchHist.forEach(s => s.showOverview = true);
                // invia a TS
                vscode.postMessage({ type: 'toggleAllOverview', showAll: true });
                // aggiorna UI: accendi tutte le icone
                updateAllOverviewIcons(true);
                // persist
                vscode.setState(currentState);
            });
            disableAllBtn.addEventListener('click', () => {
                // imposta showOverview=false per tutti gli item
                currentState.searchHist.forEach(s => s.showOverview = false);
                vscode.postMessage({ type: 'toggleAllOverview', showAll: false });
                updateAllOverviewIcons(false);
                vscode.setState(currentState);
            });
        }

        // Aggiorna le icone per ogni voce in lista in base a currentState.showAllOverview
        function updateAllOverviewIcons(forceState) {
            const items = document.querySelectorAll('.color-entry');
            items.forEach(li => {
                const uuid = li.getAttribute('uuid');
                const overviewBtn = li.querySelector('.overview-toggle');
                if (overviewBtn) {
                    if (typeof forceState === 'boolean') {
                        // forceState true => should appear ON
                        toggleButtonColor(forceState, overviewBtn);
                    } else {
                        // ripristina stato individuale
                        const index = currentState.searchHist.findIndex(s => s.uuid == uuid);
                        const state = index > -1 ? !!currentState.searchHist[index].showOverview : false;
                        toggleButtonColor(state, overviewBtn);
                    }
                }
            });
        }

    }
}());
