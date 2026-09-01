/* dsh-token-stats client half: the "Token Statistics" dashboard for the DSH Web GUI.
 * Loaded through the client module loader (CJS wrapper). The loader id MUST
 * equal the package name: client-modules verifies the boot graph row id
 * (the package name) against the id registered via __ModuleLoader__.load.
 *
 * Two DOM surfaces, mounted the same way the task-board plugin mounts its own
 * (plain DOM, self-healing observers, failure policy: log, never throw):
 *  a) sidebar entry rows - the dcu shells of dsh 0.1.1-rc.2 first
 *     (aside.dcu-root: .dcu-menu expanded entry + .dcu-compact-nav icon rail,
 *     one row per shell, both kept in the DOM), legacy logoRow/newSession
 *     shells as fallback;
 *  b) a dashboard view (data-dsh-tokenstats-view) riding as an extra trailing
 *     child of the center column, shown via html[data-dsh-tokenstats-active]
 *     while the conversation subtree underneath stays mounted and stateful.
 * Cross-panel cooperation: opening removes the sibling activation attributes
 * and dispatches 'dsh-panel-activate' (detail 'tokenstats'); the same event
 * from other panels closes this dashboard; clicking any other sidebar button
 * (dcu) or legacy session/workspace row also closes it.
 *
 * UI strings live in the I18N dictionary (vi/en/zh/ja) between the
 * @I18N_START / @I18N_END markers; the smoke test extracts and validates that
 * block. Language choice persists in localStorage ('dsts-lang-v1'), defaults
 * from navigator.language, and is switchable from the dashboard header.
 */
if (typeof window === 'undefined' || !window.__ModuleLoader__ || typeof window.__ModuleLoader__.load !== 'function') {
  console.warn('[dsh-token-stats] window.__ModuleLoader__ unavailable - client half skipped')
} else {
  window.__ModuleLoader__.load({
    id: 'dsh-token-stats',
    factory: (require) => {
      var module = { exports: {} }
      var exports = module.exports
      Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

      var React = require('react')
      var ReactDOMClient = require('react-dom/client')

      /* ---------------- constants ---------------- */

      var PANEL_NAME = 'tokenstats'
      var ENTRY_ATTR = 'data-dsh-tokenstats-entry'
      var ENTRY_SELECTOR = '[' + ENTRY_ATTR + ']'
      var VIEW_ATTR = 'data-dsh-tokenstats-view'
      var ACTIVE_ATTR = 'data-dsh-tokenstats-active'
      var OTHER_ACTIVE_ATTRS = ['data-dsh-taskboard-active', 'data-dsh-ssh-active']
      var ACTIVATE_EVENT = 'dsh-panel-activate'
      var SIDEBAR_COLUMN_SELECTOR = '[data-pane="sidebar"], [class*="sidebarCol"]'
      var CENTER_COLUMN_SELECTOR = '[data-pane="conversation"], [class*="centerCol"]'
      // Sidebar context rows that hand the center column back to the chat
      // (legacy shells only; dcu shells close on any other nav button).
      var SIDEBAR_ROW_SELECTOR =
        '[class*="sessionRow"], [class*="projectRow"], [class*="searchResultRow"], [class*="searchResultWorkspace"], [class*="newSession"]'
      // Sibling plugin entry rows this row orders itself against (legacy shells).
      var FAMILY_SELECTORS = ['[data-dsh-taskboard-entry]', '[data-dsh-ssh-entry]', ENTRY_SELECTOR]
      // New dcu sidebar (dsh 0.1.1-rc.2): expanded menu + compact rail, both live in one <aside>.
      var DCU_MENU_SELECTOR = 'aside.dcu-root .dcu-menu'
      var DCU_COMPACT_NAV_SELECTOR = 'aside.dcu-root .dcu-compact-nav'
      var ICON =
        '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">' +
        '<path d="M2.5 13.5h11" opacity="0.5"/>' +
        '<path d="M4.5 13.5V8.5"/>' +
        '<path d="M8 13.5V4"/>' +
        '<path d="M11.5 13.5V6.5"/>' +
        '</svg>'
      var PALETTE = ['#4f8cff', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6']
      var SUMMARY_URL = '/api/token-stats/summary'
      var POLL_MS = 30000
      var GROUP_IDS = ['daily', 'weekly', 'monthly']
      var LANG_KEY = 'dsts-lang-v1'

      /* ---------------- i18n ---------------- */

      var LANGS = [
        { id: 'vi', label: 'Tiếng Việt', tag: 'vi-VN' },
        { id: 'en', label: 'English', tag: 'en-US' },
        { id: 'zh', label: '中文', tag: 'zh-CN' },
        { id: 'ja', label: '日本語', tag: 'ja-JP' },
      ]

      /* @I18N_START */
      var I18N = {
        vi: {
          'entry.label': 'Thống kê Token',
          'header.title': 'Thống kê Token',
          'header.langLabel': 'Ngôn ngữ',
          'btn.close': '← Về chat',
          'btn.closeTitle': 'Đóng dashboard, về chat',
          'btn.refresh': 'Làm mới',
          'btn.refreshing': 'Đang tải…',
          'btn.retry': 'Thử lại',
          'toggle.daily': 'Ngày',
          'toggle.weekly': 'Tuần',
          'toggle.monthly': 'Tháng',
          'range.daily': '30 ngày gần nhất',
          'range.weekly': '12 tuần gần nhất',
          'range.monthly': '12 tháng gần nhất',
          'chart.title': 'Biểu đồ theo model',
          'chart.empty': 'Chưa có dữ liệu token trong khoảng này.',
          'chart.tooltipToken': 'token',
          'chart.tooltipTotal': 'Tổng',
          'chart.tooltipCost': 'Chi phí',
          'chart.tooltipNoData': 'không có dữ liệu',
          'table.title': 'Theo model (tất cả thời gian)',
          'table.model': 'Model',
          'table.input': 'Input',
          'table.output': 'Output',
          'table.cacheRead': 'Cache đọc',
          'table.total': 'Tổng',
          'table.ratio': 'Tỷ lệ',
          'table.empty': 'Chưa có dữ liệu token.',
          'card.today': 'Hôm nay',
          'card.week': 'Tuần này',
          'card.month': 'Tháng này',
          'card.all': 'Tổng tất cả',
          'state.loading': 'Đang tải thống kê token…',
          'state.idle': 'Mở bảng thống kê để nạp số liệu.',
          'state.errorPrefix': 'Không tải được thống kê: ',
          'state.bannerPrefix': '⚠ Cập nhật thất bại: ',
          'footer.updatedAt': 'Cập nhật lúc ',
          'footer.source': ' · nguồn: sổ Wallet (365 ngày gần nhất)',
        },
        en: {
          'entry.label': 'Token Statistics',
          'header.title': 'Token Statistics',
          'header.langLabel': 'Language',
          'btn.close': '← Back to chat',
          'btn.closeTitle': 'Close dashboard, back to chat',
          'btn.refresh': 'Refresh',
          'btn.refreshing': 'Loading…',
          'btn.retry': 'Retry',
          'toggle.daily': 'Day',
          'toggle.weekly': 'Week',
          'toggle.monthly': 'Month',
          'range.daily': 'last 30 days',
          'range.weekly': 'last 12 weeks',
          'range.monthly': 'last 12 months',
          'chart.title': 'Stacked by model',
          'chart.empty': 'No token usage in this range.',
          'chart.tooltipToken': 'token',
          'chart.tooltipTotal': 'Total',
          'chart.tooltipCost': 'Cost',
          'chart.tooltipNoData': 'no data',
          'table.title': 'By model (all time)',
          'table.model': 'Model',
          'table.input': 'Input',
          'table.output': 'Output',
          'table.cacheRead': 'Cache read',
          'table.total': 'Total',
          'table.ratio': 'Share',
          'table.empty': 'No token data yet.',
          'card.today': 'Today',
          'card.week': 'This week',
          'card.month': 'This month',
          'card.all': 'All time',
          'state.loading': 'Loading token statistics…',
          'state.idle': 'Open the dashboard to load data.',
          'state.errorPrefix': 'Failed to load statistics: ',
          'state.bannerPrefix': '⚠ Refresh failed: ',
          'footer.updatedAt': 'Updated at ',
          'footer.source': ' · source: Wallet ledger (last 365 days)',
        },
        zh: {
          'entry.label': 'Token 统计',
          'header.title': 'Token 统计',
          'header.langLabel': '语言',
          'btn.close': '← 返回对话',
          'btn.closeTitle': '关闭仪表盘，返回对话',
          'btn.refresh': '刷新',
          'btn.refreshing': '加载中…',
          'btn.retry': '重试',
          'toggle.daily': '日',
          'toggle.weekly': '周',
          'toggle.monthly': '月',
          'range.daily': '最近 30 天',
          'range.weekly': '最近 12 周',
          'range.monthly': '最近 12 个月',
          'chart.title': '按模型堆叠图',
          'chart.empty': '该区间内暂无 Token 用量。',
          'chart.tooltipToken': 'token',
          'chart.tooltipTotal': '总计',
          'chart.tooltipCost': '费用',
          'chart.tooltipNoData': '暂无数据',
          'table.title': '按模型（全部时间）',
          'table.model': '模型',
          'table.input': '输入',
          'table.output': '输出',
          'table.cacheRead': '缓存读取',
          'table.total': '总计',
          'table.ratio': '占比',
          'table.empty': '暂无 Token 数据。',
          'card.today': '今天',
          'card.week': '本周',
          'card.month': '本月',
          'card.all': '全部总计',
          'state.loading': '正在加载 Token 统计…',
          'state.idle': '打开仪表盘以加载数据。',
          'state.errorPrefix': '统计加载失败：',
          'state.bannerPrefix': '⚠ 刷新失败：',
          'footer.updatedAt': '更新于 ',
          'footer.source': ' · 来源：Wallet 账本（最近 365 天）',
        },
        ja: {
          'entry.label': 'トークン統計',
          'header.title': 'トークン統計',
          'header.langLabel': '言語',
          'btn.close': '← チャットに戻る',
          'btn.closeTitle': 'ダッシュボードを閉じてチャットへ戻る',
          'btn.refresh': '更新',
          'btn.refreshing': '読み込み中…',
          'btn.retry': '再試行',
          'toggle.daily': '日',
          'toggle.weekly': '週',
          'toggle.monthly': '月',
          'range.daily': '直近30日',
          'range.weekly': '直近12週',
          'range.monthly': '直近12か月',
          'chart.title': 'モデル別の積み上げグラフ',
          'chart.empty': 'この期間のトークン使用量はありません。',
          'chart.tooltipToken': 'トークン',
          'chart.tooltipTotal': '合計',
          'chart.tooltipCost': 'コスト',
          'chart.tooltipNoData': 'データなし',
          'table.title': 'モデル別（全期間）',
          'table.model': 'モデル',
          'table.input': '入力',
          'table.output': '出力',
          'table.cacheRead': 'キャッシュ読み',
          'table.total': '合計',
          'table.ratio': '比率',
          'table.empty': 'トークンデータがまだありません。',
          'card.today': '今日',
          'card.week': '今週',
          'card.month': '今月',
          'card.all': '全期間合計',
          'state.loading': 'トークン統計を読み込み中…',
          'state.idle': 'ダッシュボードを開くとデータを読み込みます。',
          'state.errorPrefix': '統計の読み込みに失敗しました：',
          'state.bannerPrefix': '⚠ 更新に失敗しました：',
          'footer.updatedAt': '更新日時 ',
          'footer.source': ' · ソース：Wallet 台帳（直近365日）',
        },
      }
      /* @I18N_END */

      var lang = (function () {
        try {
          var saved = localStorage.getItem(LANG_KEY)
          if (saved && I18N[saved]) return saved
        } catch (err) {
          // storage unavailable: fall through to detection
        }
        try {
          var nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase()
          if (nav.indexOf('vi') === 0) return 'vi'
          if (nav.indexOf('zh') === 0) return 'zh'
          if (nav.indexOf('ja') === 0) return 'ja'
          if (nav.indexOf('en') === 0) return 'en'
        } catch (err) {
          // navigator unavailable
        }
        return 'en'
      })()

      function t(key) {
        var dict = I18N[lang] || I18N.en
        var value = dict[key]
        if (value === undefined || value === null) {
          value = I18N.vi[key] !== undefined ? I18N.vi[key] : I18N.en[key]
        }
        return value === undefined || value === null ? key : value
      }

      function langTag() {
        for (var i = 0; i < LANGS.length; i++) {
          if (LANGS[i].id === lang) return LANGS[i].tag
        }
        return 'en-US'
      }

      /** Format a Date with the selected locale; timeZone defaults to UTC so
       *  calendar day-keys never shift. Returns null when Intl rejects. */
      function fmtLocaleDate(date, opts) {
        try {
          var conf = { timeZone: 'UTC' }
          for (var k in opts) conf[k] = opts[k]
          return new Intl.DateTimeFormat(langTag(), conf).format(date)
        } catch (err) {
          return null
        }
      }

      function setLang(next) {
        if (!I18N[next] || next === lang) return
        lang = next
        try {
          localStorage.setItem(LANG_KEY, next)
        } catch (err) {
          console.warn('[dsh-token-stats] save language failed:', err)
        }
        try {
          refreshEntryLabels()
        } catch (err) {
          console.warn('[dsh-token-stats] entry label refresh failed:', err)
        }
        ensureDashboard(true)
      }

      var state = {
        open: false,
        container: null,
        root: null,
      }

      function h(tag, props) {
        var children = []
        for (var i = 2; i < arguments.length; i++) children.push(arguments[i])
        return React.createElement.apply(React, [tag, props || null].concat(children))
      }

      /* ---------------- formatting helpers ---------------- */

      function fmtTokens(n) {
        var v = typeof n === 'number' && isFinite(n) ? n : 0
        if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M'
        if (v >= 1e3) return Math.round(v / 1e3) + 'K'
        return String(Math.round(v))
      }

      function fmtCost(n) {
        return '$' + (typeof n === 'number' && isFinite(n) ? n : 0).toFixed(2)
      }

      function fmtAxis(n) {
        if (n >= 1e6) return (n % 1e6 === 0 ? String(n / 1e6) : (n / 1e6).toFixed(1)) + 'M'
        if (n >= 1e3) return Math.round(n / 1e3) + 'K'
        return String(Math.round(n))
      }

      function niceMax(v) {
        if (!(v > 0)) return 1
        var exp = Math.floor(Math.log(v) / Math.LN10)
        var base = Math.pow(10, exp)
        var mults = [1, 2, 2.5, 5, 10]
        for (var i = 0; i < mults.length; i++) {
          if (mults[i] * base >= v) return mults[i] * base
        }
        return 10 * base
      }

      /** Locale-aware axis label for a series bucket key ('YYYY-MM-DD' /
       *  'YYYY-Www' / 'YYYY-MM'), formatted in UTC so keys never shift. */
      function labelFor(key, group) {
        var parts = key.split('-').map(Number)
        if (group === 'daily' && parts.length === 3) {
          var d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]))
          return fmtLocaleDate(d, { month: 'short', day: 'numeric' }) || key.slice(5)
        }
        if (group === 'weekly') {
          var m = /^(\d{4})-W(\d{2})$/.exec(key)
          if (m) {
            var jan4 = new Date(Date.UTC(+m[1], 0, 4))
            var dow = (jan4.getUTCDay() + 6) % 7
            var week1Mon = new Date(Date.UTC(+m[1], 0, 4))
            week1Mon.setUTCDate(week1Mon.getUTCDate() - dow)
            var mon = new Date(week1Mon.getTime())
            mon.setUTCDate(mon.getUTCDate() + 7 * (+m[2] - 1))
            return fmtLocaleDate(mon, { month: 'short', day: 'numeric' }) || key
          }
          return key
        }
        if (group === 'monthly' && parts.length === 2) {
          var mo = new Date(Date.UTC(parts[0], parts[1] - 1, 1))
          return fmtLocaleDate(mo, { month: 'short', year: 'numeric' }) || key
        }
        return key
      }

      function fmtTime(ms) {
        try {
          return new Intl.DateTimeFormat(langTag(), {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }).format(new Date(ms))
        } catch (err) {
          try {
            return new Date(ms).toLocaleTimeString(undefined, { hour12: false })
          } catch (err2) {
            return '--:--:--'
          }
        }
      }

      /* ---------------- styles (colors ride the dsh --dsw-alias-* tokens, dark fallbacks) ---------------- */

      var CSS = [
        // center-column takeover (attribute-scoped global rules, mirrors task-board)
        "[data-pane='conversation'], [class*='centerCol'] { position: relative; }",
        '[data-dsh-tokenstats-view] { position: absolute; inset: 0; display: none; z-index: 60; overflow-y: auto;',
        '  background: var(--dsw-alias-bg-base, #15171c); }',
        'html[' + ACTIVE_ATTR + ']:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-dsh-tokenstats-view] { display: block; }',
        'html[' + ACTIVE_ATTR + ']:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [data-pane="conversation"] > :not([data-dsh-tokenstats-view]),',
        'html[' + ACTIVE_ATTR + ']:not([data-dsh-taskboard-active]):not([data-dsh-ssh-active]) [class*="centerCol"] > :not([data-dsh-tokenstats-view]) { display: none !important; }',
        // sidebar entry row (legacy shells)
        '.dsts-entry { box-sizing: border-box; display: flex; align-items: center; gap: 8px; width: 100%; height: 36px; padding: 0 10px;',
        '  background: transparent; border: none; border-radius: 8px; color: var(--dsw-alias-label-secondary, #9aa3b2);',
        '  cursor: pointer; font-size: 13px; white-space: nowrap; }',
        '.dsts-entry:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(255,255,255,0.06)); color: var(--dsw-alias-label-primary, #e8eaf0); }',
        '.dsts-entry[data-active] { color: var(--dsw-alias-brand-primary, #4f8cff); }',
        '.dsts-entry[data-active] { background: var(--dcu-sidebar-hover, rgba(128,128,128,0.25)); }',
        '.dsts-entry.dcu-icon { width: 36px; height: 36px; padding: 0; }',
        // dcu expanded menu entry: adopt the shell grid so it looks native.
        'aside.dcu-root .dcu-menu .dsts-entry { display: grid; grid-template-columns: 20px minmax(0,1fr); column-gap: 8px; align-items: center; width: 100%; min-height: 36px; padding: 0 4px; border-radius: 8px; border: 0; background: transparent; color: var(--dcu-sidebar-navigation, inherit); font: 14px/20px var(--dcu-font, inherit); text-align: left; cursor: pointer; appearance: none; }',
        'aside.dcu-root .dcu-menu .dsts-entry:hover { background: var(--dcu-sidebar-hover, rgba(128,128,128,0.25)); color: var(--dcu-sidebar-primary, inherit); }',
        'aside.dcu-root .dcu-menu .dsts-entry .dcu-menu-icon { display: grid; place-items: center start; width: 20px; height: 20px; }',
        'aside.dcu-root .dcu-menu .dsts-entry .dcu-menu-icon svg { display: block; width: 16px; height: 16px; color: var(--dcu-sidebar-icon, currentColor); }',
        'aside.dcu-root .dcu-compact-nav .dsts-entry.dcu-icon { background: transparent; border-radius: 8px; }',
        '.dsts-entryIcon { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex: none; }',
        '.dsts-entryIcon svg { display: block; }',
        '.dsts-entryLabel { overflow: hidden; text-overflow: ellipsis; }',
        // dashboard layout
        '.dsts-viewInner { min-height: 100%; box-sizing: border-box; padding: 20px 24px 28px; display: flex; flex-direction: column; gap: 14px;',
        '  color: var(--dsw-alias-label-primary, #e8eaf0); font-size: 14px; line-height: 1.45; }',
        '.dsts-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }',
        '.dsts-headerLeft { display: flex; align-items: center; gap: 12px; min-width: 0; }',
        '.dsts-title { margin: 0; font-size: 18px; font-weight: 600; color: var(--dsw-alias-label-primary, #e8eaf0); }',
        '.dsts-tz { font-size: 11px; color: var(--dsw-alias-label-tertiary, #6f7684); border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08)); padding: 2px 8px; border-radius: 999px; }',
        '.dsts-headerRight { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }',
        '.dsts-lang { appearance: none; -webkit-appearance: none; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.12));',
        '  background: var(--dsw-alias-bg-layer-2, #20242d); color: var(--dsw-alias-label-primary, #e8eaf0); border-radius: 8px;',
        '  padding: 6px 10px; font-size: 13px; cursor: pointer; }',
        '.dsts-lang:hover { border-color: var(--dsw-alias-brand-primary, #4f8cff); }',
        '.dsts-toggle { display: inline-flex; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.12)); border-radius: 9px; overflow: hidden; }',
        '.dsts-toggleBtn { appearance: none; border: none; background: transparent; color: var(--dsw-alias-label-secondary, #9aa3b2); font-size: 13px; padding: 6px 14px; cursor: pointer; }',
        '.dsts-toggleBtn + .dsts-toggleBtn { border-left: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08)); }',
        '.dsts-toggleBtn.is-active { background: var(--dsw-alias-brand-soft, rgba(79,140,255,0.16)); color: var(--dsw-alias-brand-primary, #4f8cff); font-weight: 600; }',
        '.dsts-btn { appearance: none; border: 1px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.12)); background: var(--dsw-alias-bg-layer-2, #20242d);',
        '  color: var(--dsw-alias-label-primary, #e8eaf0); border-radius: 8px; padding: 6px 12px; font-size: 13px; cursor: pointer; }',
        '.dsts-btn:hover { border-color: var(--dsw-alias-brand-primary, #4f8cff); color: var(--dsw-alias-brand-primary, #4f8cff); }',
        '.dsts-btn:disabled { opacity: 0.6; cursor: default; }',
        '.dsts-btnPrimary { background: var(--dsw-alias-brand-soft, rgba(79,140,255,0.16)); border-color: var(--dsw-alias-brand-primary, #4f8cff); color: var(--dsw-alias-brand-primary, #4f8cff); }',
        '.dsts-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }',
        '.dsts-card { background: var(--dsw-alias-bg-layer-1, #1a1d24); border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08)); border-radius: 12px; padding: 14px 16px; }',
        '.dsts-cardLabel { font-size: 12px; color: var(--dsw-alias-label-secondary, #9aa3b2); }',
        '.dsts-cardValue { margin-top: 6px; font-size: 24px; font-weight: 650; font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-primary, #e8eaf0); }',
        '.dsts-cardCost { margin-top: 4px; font-size: 12px; color: var(--dsw-alias-state-success-primary, #34d399); }',
        '.dsts-panel { background: var(--dsw-alias-bg-layer-1, #1a1d24); border: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08)); border-radius: 12px; padding: 16px; }',
        '.dsts-panelTitle { margin: 0 0 10px; font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary, #e8eaf0); }',
        '.dsts-chart { display: block; }',
        '.dsts-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-top: 10px; }',
        '.dsts-legendItem { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary, #9aa3b2); }',
        '.dsts-legendDot { width: 10px; height: 10px; border-radius: 3px; flex: none; }',
        '.dsts-table { width: 100%; border-collapse: collapse; }',
        '.dsts-table th { text-align: left; font-size: 11px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 600;',
        '  color: var(--dsw-alias-label-tertiary, #6f7684); padding: 8px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.08)); }',
        '.dsts-table td { padding: 8px 10px; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(255,255,255,0.05)); font-size: 13px; color: var(--dsw-alias-label-primary, #e8eaf0); }',
        '.dsts-table tr:last-child td { border-bottom: none; }',
        '.dsts-tdModel { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
        '.dsts-num { text-align: right; font-variant-numeric: tabular-nums; }',
        '.dsts-strong { font-weight: 600; }',
        '.dsts-ratio { display: flex; align-items: center; gap: 8px; min-width: 150px; }',
        '.dsts-ratioTrack { flex: 1; height: 6px; border-radius: 3px; background: var(--dsw-alias-bg-layer-3, rgba(255,255,255,0.08)); overflow: hidden; }',
        '.dsts-ratioBar { height: 100%; border-radius: 3px; min-width: 2px; background: linear-gradient(90deg, var(--dsw-alias-brand-primary, #4f8cff), #7aa7ff); }',
        '.dsts-ratioText { font-size: 11px; color: var(--dsw-alias-label-tertiary, #6f7684); white-space: nowrap; font-variant-numeric: tabular-nums; }',
        '.dsts-footer { margin-top: auto; padding-top: 8px; font-size: 12px; color: var(--dsw-alias-label-tertiary, #6f7684); }',
        '.dsts-state { min-height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: var(--dsw-alias-label-secondary, #9aa3b2); }',
        '.dsts-spinner { width: 26px; height: 26px; border-radius: 50%; border: 3px solid var(--dsw-alias-border-l2, rgba(255,255,255,0.15)); border-top-color: var(--dsw-alias-brand-primary, #4f8cff); animation: dsts-spin 0.9s linear infinite; }',
        '@keyframes dsts-spin { to { transform: rotate(360deg); } }',
        '.dsts-stateError { color: var(--dsw-alias-state-error-primary, #ff7d7d); font-size: 13px; max-width: 480px; text-align: center; }',
        '.dsts-banner { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px; border-radius: 10px; font-size: 13px;',
        '  background: var(--dsw-alias-state-error-soft, rgba(255,99,99,0.12)); border: 1px solid var(--dsw-alias-state-error-primary, rgba(255,125,125,0.4));',
        '  color: var(--dsw-alias-state-error-primary, #ff9d9d); }',
        '.dsts-empty { padding: 24px; text-align: center; color: var(--dsw-alias-label-tertiary, #6f7684); }',
      ].join('\n')

      function ensureStyle() {
        if (document.getElementById('dsh-token-stats-style')) return
        var style = document.createElement('style')
        style.id = 'dsh-token-stats-style'
        style.textContent = CSS
        document.head.appendChild(style)
      }

      /* ---------------- open/close state (html attribute + cross-panel events) ---------------- */

      function syncEntryActive() {
        var buttons = document.querySelectorAll('[' + ENTRY_ATTR + ']')
        for (var i = 0; i < buttons.length; i++) {
          if (state.open) buttons[i].dataset.active = 'true'
          else delete buttons[i].dataset.active
        }
      }

      function applyActive() {
        if (state.open) {
          for (var i = 0; i < OTHER_ACTIVE_ATTRS.length; i++) document.documentElement.removeAttribute(OTHER_ACTIVE_ATTRS[i])
          document.documentElement.setAttribute(ACTIVE_ATTR, '')
          try {
            document.dispatchEvent(new CustomEvent(ACTIVATE_EVENT, { detail: PANEL_NAME }))
          } catch (err) {
            console.warn('[dsh-token-stats] dispatch ' + ACTIVATE_EVENT + ' failed:', err)
          }
        } else {
          document.documentElement.removeAttribute(ACTIVE_ATTR)
        }
        syncEntryActive()
      }

      function setOpen(next) {
        if (state.open === next) return
        state.open = next
        applyActive()
        ensureDashboard(true)
      }

      function togglePanel() {
        setOpen(!state.open)
      }

      function closePanel() {
        setOpen(false)
      }

      /* ---------------- dashboard view mounting (task-board board-mount pattern) ---------------- */

      function ensureDashboard(render) {
        if (state.container && state.container.isConnected) {
          if (render && state.root) state.root.render(h(Dashboard, { open: state.open, onClose: closePanel }))
          return true
        }
        if (state.container) {
          try {
            if (state.root) state.root.unmount()
          } catch (err) {
            console.warn('[dsh-token-stats] react unmount failed:', err)
          }
          state.root = null
          try {
            state.container.remove()
          } catch (err) {
            // already gone
          }
          state.container = null
        }
        var column = document.querySelector(CENTER_COLUMN_SELECTOR)
        if (!column) return false
        var el = document.createElement('div')
        el.setAttribute(VIEW_ATTR, '')
        el.setAttribute('data-dsh-plugin', 'token-stats')
        el.className = 'dsts-view'
        column.appendChild(el)
        state.container = el
        state.root = ReactDOMClient.createRoot(el)
        state.root.render(h(Dashboard, { open: state.open, onClose: closePanel }))
        return true
      }

      /* ---------------- sidebar entry (dcu shells first, legacy fallback) ---------------- */

      function sidebarRoot() {
        var column = document.querySelector(SIDEBAR_COLUMN_SELECTOR)
        if (!column) return undefined
        // Current shells wrap the sidebar UI: column > wrapper > root (logoRow owner).
        var logoRow = column.querySelector('[class*="logoRow"]')
        var logoOwner = logoRow && logoRow.parentElement
        return logoOwner || column.firstElementChild || undefined
      }

      function newSessionButton(root) {
        var nested = root.querySelector('button[class*="newSession"]')
        if (nested) return nested
        for (var i = 0; i < root.children.length; i++) {
          if (root.children[i].tagName === 'BUTTON') return root.children[i]
        }
        return undefined
      }

      function placeEntry(root, entry) {
        var button = newSessionButton(root)
        if (!button) return false
        if (entry.parentElement !== root) {
          // Position relative to the sibling plugin family block ('after'),
          // never to transient logoRow geometry (see task-board core).
          var row = button.closest('[class*="logoRow"]')
          var base = row && row.parentElement === root ? row : button
          var famSel = FAMILY_SELECTORS.join(', ')
          var family = []
          for (var i = 0; i < root.children.length; i++) {
            var child = root.children[i]
            if (child instanceof HTMLElement && child.matches(famSel)) family.push(child)
          }
          var anchor = family.length > 0 ? family[family.length - 1].nextElementSibling : base.nextElementSibling
          root.insertBefore(entry, anchor)
        }
        return true
      }

      function makeEntryButton(variant) {
        var label = t('entry.label')
        var entry = document.createElement('button')
        entry.type = 'button'
        entry.setAttribute(ENTRY_ATTR, '')
        entry.setAttribute('data-dsh-plugin', 'token-stats')
        entry.setAttribute('data-dsh-part', 'sidebar-entry')
        entry.setAttribute('data-dsts-variant', variant)
        entry.setAttribute('aria-label', label)
        entry.setAttribute('title', label)
        entry.addEventListener('click', function () {
          togglePanel()
        })
        if (variant === 'dcu-icon') {
          entry.className = 'dsts-entry dcu-icon'
          entry.innerHTML = ICON
        } else if (variant === 'dcu-menu') {
          entry.className = 'dsts-entry'
          entry.innerHTML = '<span class="dcu-menu-icon">' + ICON + '</span>' + label
        } else {
          entry.className = 'dsts-entry'
          entry.innerHTML = '<span class="dsts-entryIcon">' + ICON + '</span><span class="dsts-entryLabel">' + label + '</span>'
        }
        if (state.open) entry.dataset.active = 'true'
        return entry
      }

      // Per-container row registry; one row per shell (expanded / compact / legacy).
      var entryRows = new Map()

      function ensureInContainer(container, variant, keepLast) {
        if (!container || !container.isConnected) return false
        var entry = entryRows.get(container)
        if (entry && !entry.isConnected) entry = undefined
        var live = container.querySelector('[' + ENTRY_ATTR + ']')
        if (live && live !== entry) {
          entry = live
          entryRows.set(container, live)
        }
        if (!entry) {
          entry = makeEntryButton(variant)
          entryRows.set(container, entry)
        }
        if (entry.parentElement !== container) {
          container.appendChild(entry)
        } else if (keepLast === true && container.lastElementChild !== entry) {
          // The shell rendered more nav items after our row: stay trailing.
          container.appendChild(entry)
        }
        if (state.open) entry.dataset.active = 'true'
        else delete entry.dataset.active
        return true
      }

      function mountSidebarEntry() {
        var pending = 0
        var tryPlace = function () {
          // dcu shells first (dsh 0.1.1-rc.2); both exist in the DOM, one is
          // display:none depending on window width — keep a row in each.
          var placed = false
          try {
            var menu = document.querySelector(DCU_MENU_SELECTOR)
            if (menu) placed = ensureInContainer(menu, 'dcu-menu', true) || placed
            var rail = document.querySelector(DCU_COMPACT_NAV_SELECTOR)
            if (rail) placed = ensureInContainer(rail, 'dcu-icon', true) || placed
          } catch (err) {
            console.warn('[dsh-token-stats] dcu entry place failed:', err)
          }
          if (placed) return
          // Legacy shell fallback (older dsh builds, logoRow/newSession anchors).
          try {
            var root = sidebarRoot()
            if (root === undefined) return
            var entry = entryRows.get(root)
            if (entry && !entry.isConnected) entry = undefined
            var live = root.querySelector(':scope > [' + ENTRY_ATTR + ']')
            if (live && live !== entry) {
              entry = live
              entryRows.set(root, live)
            }
            if (!entry) {
              entry = makeEntryButton('legacy')
              entryRows.set(root, entry)
              placeEntry(root, entry)
            } else if (!root.contains(entry)) {
              placeEntry(root, entry)
            }
          } catch (err) {
            console.warn('[dsh-token-stats] sidebar entry place failed:', err)
          }
        }
        var schedule = function () {
          pending = pending + 1
          if (pending > 1) return
          var run = function () {
            pending = pending > 0 ? pending - 1 : 0
            tryPlace()
          }
          if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run)
          else setTimeout(run, 16)
        }
        var waitObserver = new MutationObserver(schedule)
        waitObserver.observe(document.body, { childList: true, subtree: true })
        tryPlace()
        setTimeout(tryPlace, 400)
        setTimeout(tryPlace, 1600)
      }

      /** Re-apply translated labels to every live entry row (language switch). */
      function refreshEntryLabels() {
        var label = t('entry.label')
        entryRows.forEach(function (entry) {
          if (!entry || !entry.isConnected) return
          var variant = entry.getAttribute('data-dsts-variant') || 'legacy'
          entry.setAttribute('aria-label', label)
          entry.setAttribute('title', label)
          if (variant === 'dcu-icon') entry.innerHTML = ICON
          else if (variant === 'dcu-menu') entry.innerHTML = '<span class="dcu-menu-icon">' + ICON + '</span>' + label
          else entry.innerHTML = '<span class="dsts-entryIcon">' + ICON + '</span><span class="dsts-entryLabel">' + label + '</span>'
          if (state.open) entry.dataset.active = 'true'
          else delete entry.dataset.active
        })
        var all = document.querySelectorAll('[' + ENTRY_ATTR + ']')
        for (var i = 0; i < all.length; i++) {
          all[i].setAttribute('aria-label', label)
          all[i].setAttribute('title', label)
        }
      }

      /* ---------------- global listeners ---------------- */

      function onClickSidebarRow(event) {
        if (!state.open) return
        var target = event.target
        if (!target || typeof target.closest !== 'function') return
        // dcu shell: any other sidebar button hands the center column back to the chat.
        var asideButton = target.closest('aside.dcu-root button')
        if (asideButton !== null && target.closest('[' + ENTRY_ATTR + ']') === null) setOpen(false)
        if (target.closest(SIDEBAR_ROW_SELECTOR) !== null) setOpen(false)
      }

      function onPanelActivate(event) {
        if (state.open && event && event.detail !== PANEL_NAME) setOpen(false)
      }

      /* ---------------- React dashboard ---------------- */

      function StackChart(props) {
        var buckets = props.buckets || []
        var group = props.group
        var modelTotals = new Map()
        buckets.forEach(function (b) {
          var byModel = b.byModel || {}
          Object.keys(byModel).forEach(function (m) {
            modelTotals.set(m, (modelTotals.get(m) || 0) + ((byModel[m] && byModel[m].total) || 0))
          })
        })
        var models = Array.from(modelTotals.entries())
          .sort(function (a, b) {
            return b[1] - a[1]
          })
          .map(function (e) {
            return e[0]
          })
        var colorOf = {}
        models.forEach(function (m, i) {
          colorOf[m] = PALETTE[i % PALETTE.length]
        })

        var W = 880
        var H = 300
        var L = 54
        var R = 12
        var T = 14
        var B = 54
        var plotW = W - L - R
        var plotH = H - T - B
        var n = Math.max(1, buckets.length)
        var maxTotal = 0
        buckets.forEach(function (b) {
          var tt = (b.totals && b.totals.total) || 0
          if (tt > maxTotal) maxTotal = tt
        })
        var maxVal = niceMax(Math.max(1, maxTotal))
        var band = plotW / n
        var barW = Math.min(band * 0.62, 42)
        var step = Math.max(1, Math.ceil(n / 12))
        var yOf = function (v) {
          return T + plotH * (1 - v / maxVal)
        }

        var grid = [0, 0.25, 0.5, 0.75, 1].map(function (f, i) {
          var v = maxVal * f
          return h(
            'g',
            { key: 'grid' + i },
            h('line', {
              x1: L,
              x2: W - R,
              y1: yOf(v),
              y2: yOf(v),
              stroke: 'var(--dsw-alias-border-l1, rgba(255,255,255,0.10))',
              strokeWidth: 1,
              strokeDasharray: v === 0 ? '0' : '3 4',
            }),
            h(
              'text',
              { x: L - 8, y: yOf(v) + 3.5, textAnchor: 'end', fontSize: 10, fill: 'var(--dsw-alias-label-tertiary, #6f7684)' },
              fmtAxis(v)
            )
          )
        })

        var bars = []
        buckets.forEach(function (b, i) {
          var x = L + band * i + (band - barW) / 2
          var total = (b.totals && b.totals.total) || 0
          if (total <= 0) {
            bars.push(
              h(
                'rect',
                { key: 'empty' + i, x: x, y: T + plotH - 1.5, width: barW, height: 1.5, fill: 'var(--dsw-alias-label-tertiary, #6f7684)', opacity: 0.35 },
                h('title', null, b.key + ' - ' + t('chart.tooltipNoData'))
              )
            )
            return
          }
          var lines = [b.key]
          var stack = 0
          models.forEach(function (m) {
            var entry = (b.byModel && b.byModel[m]) || null
            var v = (entry && entry.total) || 0
            if (v <= 0) return
            var yTop = yOf(stack + v)
            var yBot = yOf(stack)
            bars.push(
              h(
                'rect',
                { key: i + '|' + m, x: x, y: yTop, width: barW, height: Math.max(1, yBot - yTop), fill: colorOf[m] },
                h(
                  'title',
                  null,
                  b.key +
                    ' · ' +
                    m +
                    ': ' +
                    fmtTokens(v) +
                    ' ' +
                    t('chart.tooltipToken') +
                    (entry.cost > 0 ? ' (' + t('chart.tooltipCost') + ' ' + fmtCost(entry.cost) + ')' : '')
                )
              )
            )
            lines.push(m + ': ' + fmtTokens(v))
            stack += v
          })
          lines.push(t('chart.tooltipTotal') + ': ' + fmtTokens(total))
          if (b.cost > 0) lines.push(t('chart.tooltipCost') + ': ' + fmtCost(b.cost))
          // Invisible full-height hit area: one native <title> tooltip per
          // column with the per-model breakdown.
          bars.push(
            h(
              'rect',
              { key: 'hit' + i, x: x, y: T, width: barW, height: plotH, fill: 'transparent', style: { pointerEvents: 'all' } },
              h('title', null, lines.join('\n'))
            )
          )
        })

        var xLabels = buckets.map(function (b, i) {
          if (i % step !== 0 && i !== buckets.length - 1) return null
          var cx = L + band * i + band / 2
          var ly = T + plotH + 14
          return h(
            'text',
            {
              key: 'x' + i,
              x: cx,
              y: ly,
              textAnchor: 'end',
              fontSize: 10,
              fill: 'var(--dsw-alias-label-tertiary, #6f7684)',
              transform: 'rotate(-45 ' + cx + ' ' + ly + ')',
            },
            labelFor(b.key, group)
          )
        })

        var legend =
          models.length > 0
            ? h(
                'div',
                { className: 'dsts-legend' },
                models.map(function (m) {
                  return h(
                    'span',
                    { key: m, className: 'dsts-legendItem' },
                    h('span', { className: 'dsts-legendDot', style: { background: colorOf[m] } }),
                    m
                  )
                })
              )
            : null

        return h(
          'div',
          { className: 'dsts-panel' },
          h('h2', { className: 'dsts-panelTitle' }, t('chart.title') + ' - ' + t('range.' + group)),
          models.length === 0 ? h('div', { className: 'dsts-empty' }, t('chart.empty')) : null,
          models.length > 0
            ? h(
                'svg',
                { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', preserveAspectRatio: 'xMidYMid meet', className: 'dsts-chart' },
                grid,
                bars,
                xLabels
              )
            : null,
          legend
        )
      }

      function ModelTable(props) {
        var allTime = props.allTime || {}
        var rows = Object.keys(allTime.byModel || {})
          .map(function (model) {
            var v = allTime.byModel[model]
            return {
              model: model,
              input: v.input || 0,
              output: v.output || 0,
              cacheRead: v.cacheRead || 0,
              total: v.total || 0,
            }
          })
          .sort(function (a, b) {
            return b.total - a.total
          })
        var grand = rows.reduce(function (s, r) {
          return s + r.total
        }, 0)
        return h(
          'div',
          { className: 'dsts-panel' },
          h('h2', { className: 'dsts-panelTitle' }, t('table.title')),
          rows.length === 0
            ? h('div', { className: 'dsts-empty' }, t('table.empty'))
            : h(
                'table',
                { className: 'dsts-table' },
                h(
                  'thead',
                  null,
                  h(
                    'tr',
                    null,
                    h('th', null, t('table.model')),
                    h('th', { className: 'dsts-num' }, t('table.input')),
                    h('th', { className: 'dsts-num' }, t('table.output')),
                    h('th', { className: 'dsts-num' }, t('table.cacheRead')),
                    h('th', { className: 'dsts-num' }, t('table.total')),
                    h('th', null, t('table.ratio'))
                  )
                ),
                h(
                  'tbody',
                  null,
                  rows.map(function (r) {
                    var pct = grand > 0 ? (r.total / grand) * 100 : 0
                    return h(
                      'tr',
                      { key: r.model },
                      h('td', { className: 'dsts-tdModel', title: r.model }, r.model),
                      h('td', { className: 'dsts-num' }, fmtTokens(r.input)),
                      h('td', { className: 'dsts-num' }, fmtTokens(r.output)),
                      h('td', { className: 'dsts-num' }, fmtTokens(r.cacheRead)),
                      h('td', { className: 'dsts-num dsts-strong' }, fmtTokens(r.total)),
                      h(
                        'td',
                        null,
                        h(
                          'div',
                          { className: 'dsts-ratio' },
                          h('div', { className: 'dsts-ratioTrack' }, h('div', { className: 'dsts-ratioBar', style: { width: Math.max(2, pct) + '%' } })),
                          h('span', { className: 'dsts-ratioText' }, pct.toFixed(1) + '%')
                        )
                      )
                    )
                  })
                )
              )
        )
      }

      function LanguageSelect() {
        return h(
          'select',
          {
            className: 'dsts-lang',
            value: lang,
            'aria-label': t('header.langLabel'),
            title: t('header.langLabel'),
            onChange: function (ev) {
              var next = ev && ev.target ? ev.target.value : null
              if (next) setLang(next)
            },
          },
          LANGS.map(function (l) {
            return h('option', { key: l.id, value: l.id }, l.label)
          })
        )
      }

      function Dashboard(props) {
        var open = props.open !== false
        var onClose = props.onClose
        var groupState = React.useState('daily')
        var group = groupState[0]
        var setGroup = groupState[1]
        var dataState = React.useState(null)
        var data = dataState[0]
        var setData = dataState[1]
        var loadingState = React.useState(false)
        var loading = loadingState[0]
        var setLoading = loadingState[1]
        var errorState = React.useState(null)
        var error = errorState[0]
        var setError = errorState[1]
        var updatedAtState = React.useState(null)
        var updatedAt = updatedAtState[0]
        var setUpdatedAt = updatedAtState[1]
        var reqRef = React.useRef(0)

        var load = React.useCallback(function () {
          var id = ++reqRef.current
          setLoading(true)
          fetch(SUMMARY_URL, { cache: 'no-store' })
            .then(function (res) {
              return res
                .json()
                .catch(function () {
                  return null
                })
                .then(function (js) {
                  if (id !== reqRef.current) return
                  if (!res.ok || !js || js.error) throw new Error(js && js.error ? js.error : 'HTTP ' + res.status)
                  setData(js)
                  setError(null)
                  setUpdatedAt(Date.now())
                })
            })
            .catch(function (err) {
              if (id !== reqRef.current) return
              console.warn('[dsh-token-stats] fetch summary failed:', err)
              setError(String((err && err.message) || err))
            })
            .then(function () {
              if (id === reqRef.current) setLoading(false)
            })
        }, [])

        React.useEffect(
          function () {
            if (!open) return undefined
            load()
            var timer = setInterval(function () {
              if (!document.hidden) load()
            }, POLL_MS)
            return function () {
              clearInterval(timer)
            }
          },
          [open, load]
        )

        var headerLeft = h(
          'div',
          { className: 'dsts-headerLeft' },
          open ? h('button', { className: 'dsts-btn', onClick: onClose, title: t('btn.closeTitle') }, t('btn.close')) : null,
          h('h1', { className: 'dsts-title' }, t('header.title'))
        )

        if (!open) {
          return h(
            'div',
            { className: 'dsts-viewInner' },
            h('div', { className: 'dsts-header' }, headerLeft),
            h('div', { className: 'dsts-state' }, t('state.idle'))
          )
        }
        if (!data && loading) {
          return h(
            'div',
            { className: 'dsts-viewInner' },
            h(
              'div',
              { className: 'dsts-header' },
              headerLeft,
              h('div', { className: 'dsts-headerRight' }, h(LanguageSelect, null))
            ),
            h('div', { className: 'dsts-state' }, h('div', { className: 'dsts-spinner' }), h('div', null, t('state.loading')))
          )
        }
        if (!data && error) {
          return h(
            'div',
            { className: 'dsts-viewInner' },
            h(
              'div',
              { className: 'dsts-header' },
              headerLeft,
              h('div', { className: 'dsts-headerRight' }, h(LanguageSelect, null))
            ),
            h(
              'div',
              { className: 'dsts-state' },
              h('div', { className: 'dsts-stateError' }, t('state.errorPrefix') + error),
              h('button', { className: 'dsts-btn', onClick: load }, t('btn.retry'))
            )
          )
        }
        if (!data) return h('div', { className: 'dsts-viewInner' })

        var cards = [
          { key: 'today', label: t('card.today'), s: data.today },
          { key: 'week', label: t('card.week'), s: data.thisWeek },
          { key: 'month', label: t('card.month'), s: data.thisMonth },
          { key: 'all', label: t('card.all'), s: data.allTime },
        ]

        return h(
          'div',
          { className: 'dsts-viewInner' },
          error
            ? h(
                'div',
                { className: 'dsts-banner' },
                h('span', null, t('state.bannerPrefix') + error),
                h('button', { className: 'dsts-btn', onClick: load }, t('btn.retry'))
              )
            : null,
          h(
            'div',
            { className: 'dsts-header' },
            headerLeft,
            data.timezone ? h('span', { className: 'dsts-tz' }, data.timezone) : null,
            h(
              'div',
              { className: 'dsts-headerRight' },
              h(LanguageSelect, null),
              h(
                'div',
                { className: 'dsts-toggle' },
                GROUP_IDS.map(function (gid) {
                  return h(
                    'button',
                    {
                      key: gid,
                      className: 'dsts-toggleBtn' + (group === gid ? ' is-active' : ''),
                      onClick: function () {
                        setGroup(gid)
                      },
                    },
                    t('toggle.' + gid)
                  )
                })
              ),
              h('button', { className: 'dsts-btn dsts-btnPrimary', onClick: load, disabled: loading }, loading ? t('btn.refreshing') : t('btn.refresh'))
            )
          ),
          h(
            'div',
            { className: 'dsts-cards' },
            cards.map(function (c) {
              var s = c.s || {}
              var totals = s.totals || {}
              return h(
                'div',
                { key: c.key, className: 'dsts-card' },
                h('div', { className: 'dsts-cardLabel' }, c.label),
                h('div', { className: 'dsts-cardValue' }, fmtTokens(totals.total)),
                s.cost > 0 ? h('div', { className: 'dsts-cardCost' }, fmtCost(s.cost)) : null
              )
            })
          ),
          h(StackChart, { buckets: (data.series && data.series[group]) || [], group: group }),
          h(ModelTable, { allTime: data.allTime }),
          h(
            'div',
            { className: 'dsts-footer' },
            t('footer.updatedAt') + (updatedAt ? fmtTime(updatedAt) : '--:--:--') + t('footer.source')
          )
        )
      }

      /* ---------------- apply guard + plugin exports ---------------- */

      function claimApply() {
        if (globalThis.__dshTokenStatsApplied === true) return false
        globalThis.__dshTokenStatsApplied = true
        return true
      }

      function releaseApply() {
        globalThis.__dshTokenStatsApplied = undefined
      }

      function apply() {
        if (!claimApply()) return
        try {
          ensureStyle()
        } catch (err) {
          console.warn('[dsh-token-stats] style inject failed:', err)
        }
        try {
          mountSidebarEntry()
        } catch (err) {
          // Mount failures degrade the dashboard, never the GUI.
          console.warn('[dsh-token-stats] sidebar entry mount failed:', err)
        }
        try {
          ensureDashboard(false)
        } catch (err) {
          console.warn('[dsh-token-stats] dashboard mount failed:', err)
        }
        try {
          var viewWaitObserver = new MutationObserver(function () {
            try {
              ensureDashboard(false)
            } catch (err) {
              console.warn('[dsh-token-stats] dashboard ensure failed:', err)
            }
          })
          viewWaitObserver.observe(document.body, { childList: true, subtree: true })
        } catch (err) {
          console.warn('[dsh-token-stats] view observer failed:', err)
        }
        document.addEventListener('click', onClickSidebarRow, true)
        document.addEventListener(ACTIVATE_EVENT, onPanelActivate)
      }

      exports.inject = []
      exports.apply = apply
      exports.__releaseApply = releaseApply
      return module.exports
    },
  })
}
